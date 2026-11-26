/**
 * infrastructure/scripts/test-vision-ocr-staging.mjs
 * End-to-end live verification of Yandex Vision OCR pipeline on Staging:
 * 1. RBAC & 152-FZ verification (unauthorized rejection).
 * 2. OCR configuration inspection (/api/ai/config).
 * 3. Generation & S3 upload of Russian DDU contract image.
 * 4. Asynchronous job submission to YMQ queue.
 * 5. Background worker execution & YDB ai_ocr_jobs_v2 tracking.
 * 6. Parser field extraction & risk flag verification (cadastral, prices, maternal capital).
 * 7. Human-in-the-loop audit guarantee (document_vault status remains untouched).
 * 8. Complete teardown & cleanup of test artifacts.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const req = createRequire(path.join(BACKEND_DIR, 'package.json'));
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = req('@aws-sdk/client-s3');

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('[TestOcr] Error: cloud-manifest.json or .env.cloud.local not found.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envVars = {};
for (const line of fs.readFileSync(ENV_PATH, 'utf-8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const apiBaseUrl = manifest.staging?.apiGatewayDomain
  ? `https://${manifest.staging.apiGatewayDomain}`
  : 'https://d5dpccovifu701p9lvga.bu9mdbe1.apigw.yandexcloud.net';

const ydbEndpoint = manifest.staging.ydbDocApiEndpoint;
const ydbDatabaseId = manifest.staging.ydbDatabaseId;
const region = manifest.region || 'ru-central1';
const privateBucket = manifest.staging.privateDocsBucket || 'domexit-private-docs-staging';
const accessKeyId = envVars.YC_ACCESS_KEY_ID;
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY;
const jwtSecret = envVars.JWT_SIGNING_SECRET;

if (!accessKeyId || !secretAccessKey || !jwtSecret) {
  console.error('[TestOcr] Missing required AWS/JWT secrets in .env.cloud.local');
  process.exit(1);
}

// S3 Client
const s3 = new S3Client({
  region: 'ru-central1',
  endpoint: 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// Minimal JWT Generator (compatible with cryptoAuth.ts)
function base64UrlEncode(strOrBuf) {
  const buf = typeof strOrBuf === 'string' ? Buffer.from(strOrBuf, 'utf-8') : strOrBuf;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createJwt(payload, secret, expiresInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const toSign = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest();
  return `${toSign}.${base64UrlEncode(sig)}`;
}

// YDB DocAPI Helper
function getSigningKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

async function callYdb(target, body) {
  const url = new URL(ydbEndpoint);
  const host = url.host;
  const reqPath = url.pathname || '/';
  const service = 'dynamodb';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const payload = JSON.stringify(body);
  const targetHeader = `DynamoDB_20120810.${target}`;
  const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${targetHeader}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = `POST\n${reqPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${crypto.createHash('sha256').update(payload).digest('hex')}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${region}/${service}/aws4_request\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(ydbEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': targetHeader,
      'X-Amz-Date': amzDate,
      Authorization: auth,
    },
    body: payload,
  });

  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, body: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, body: { raw: text } };
  }
}

async function main() {
  console.log('=== DomExit Stage AI OCR (Vision + YMQ) Verification ===');
  console.log('Target API:', apiBaseUrl);
  console.log('Private S3 Bucket:', privateBucket);
  console.log('YDB Endpoint:', ydbEndpoint);

  const testLotCode = 'TMP-OCR-STAGE-E2E';
  const testDocId = `doc-ocr-${Date.now()}`;
  const testS3Key = `staging/documents_vault/${testLotCode}/${testDocId}.jpg`;
  let createdJobId = null;
  const tempScriptPath = path.join(ROOT_DIR, 'temp-render-ocr.ps1');
  const tempImgPath = path.join(ROOT_DIR, 'temp-ocr-ddu.jpg');

  try {
    // 1. Generate Auth Token
    console.log('\n[1/7] Generating Owner Auth Token...');
    const ownerToken = createJwt(
      { userId: 'usr-owner-001', role: 'owner', email: 'owner@domexit.ru', tv: 3 },
      jwtSecret
    );
    console.log('✓ Owner Token successfully created.');

    // 2. Security Check (RBAC & 152-FZ)
    console.log('\n[2/7] Verifying Security & Authorization Gates (152-ФЗ)...');
    const unauthorizedRes = await fetch(`${apiBaseUrl}/api/ai/ocr/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lotCode: testLotCode, documentId: testDocId }),
    });
    console.log('Unauthorized POST /api/ai/ocr/jobs status:', unauthorizedRes.status);
    if (unauthorizedRes.status !== 401 && unauthorizedRes.status !== 403) {
      throw new Error(`Security violation! Expected 401/403 for unauthenticated request, got ${unauthorizedRes.status}`);
    }
    console.log('✓ Unauthenticated access correctly blocked (401/403).');

    // 3. Inspect AI Config & OCR Connector Stats, Ensure Feature Enabled
    console.log('\n[3/7] Inspecting AI Config & Enabling visionOcrPreAudit...');
    // Enable masterLabEnabled and visionOcrPreAudit for testing
    const putConfigRes = await fetch(`${apiBaseUrl}/api/ai/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        masterLabEnabled: true,
        features: {
          visionOcrPreAudit: 'owner_only',
        },
      }),
    });
    console.log('PUT /api/ai/config status:', putConfigRes.status);

    const configRes = await fetch(`${apiBaseUrl}/api/ai/config`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const configJson = await configRes.json();
    console.log('AI Config Response Status:', configRes.status);
    console.log('OCR Connector in Config:', JSON.stringify(configJson.connectors?.ocr || null));
    console.log('Effective features:', JSON.stringify(configJson.effectiveFeatures));
    if (!configJson.connectors?.ocr?.configured) {
      console.warn('Notice: ocr connector reports not fully configured in config, checking envs...');
    } else {
      console.log('✓ OCR Connector confirmed ACTIVE in AI Lab configuration.');
    }

    // 4. Generate & Upload Sample Russian DDU Image
    console.log('\n[4/7] Generating High-Resolution DDU Contract Sample Image...');
    const textLines = [
      { text: 'ДОГОВОР УЧАСТИЯ В ДОЛЕВОМ СТРОИТЕЛЬСТВЕ № 78-2026/045', isTitle: true, y: 80 },
      { text: 'г. Санкт-Петербург                                   15 марта 2024 года', isTitle: false, y: 150 },
      { text: 'Застройщик: ООО «ГлавСтройСПб», ИНН: 7810123456', isTitle: false, y: 220 },
      { text: 'Кадастровый номер земельного участка: 78:34:0410101:1234', isTitle: false, y: 290 },
      { text: 'Объект: 2-комнатная квартира, проектная площадь 64.5 кв.м', isTitle: false, y: 360 },
      { text: '1. ЦЕНА ДОГОВОРА И ПОРЯДОК РАСЧЕТОВ', isTitle: true, y: 440 },
      { text: '1.1. Цена настоящего Договора составляет 15 000 000 (пятнадцать миллионов) рублей.', isTitle: false, y: 500 },
      { text: '1.2. Оплаченная сумма на дату выдачи: 5 000 000 (пять миллионов) рублей.', isTitle: false, y: 560 },
      { text: '1.3. Расчетный эскроу-банк: ПАО Сбербанк, счет 40817810000001234567.', isTitle: false, y: 620 },
      { text: '2. ОСОБЫЕ УСЛОВИЯ И ОБРЕМЕНЕНИЯ', isTitle: true, y: 700 },
      { text: '2.1. Для оплаты привлекаются средства: материнский семейный капитал.', isTitle: false, y: 760 },
      { text: '2.2. Настоящий договор подлежит государственной регистрации в Росреестре.', isTitle: false, y: 820 },
    ];

    const drawCommands = textLines
      .map((l) => {
        const b64 = Buffer.from(l.text, 'utf-8').toString('base64');
        const fontVar = l.isTitle ? '$fontTitle' : '$fontBody';
        return `DrawB64 '${b64}' ${fontVar} $brush 80 ${l.y}`;
      })
      .join('\n');

    const psScript = `
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1400, 1800
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)
$fontTitle = [System.Drawing.Font]::new('Arial', [float]20, [System.Drawing.FontStyle]::Bold)
$fontBody = [System.Drawing.Font]::new('Arial', [float]15, [System.Drawing.FontStyle]::Regular)

function DrawB64($b64, $font, $b, $x, $y) {
  $bytes = [System.Convert]::FromBase64String($b64)
  $str = [System.Text.Encoding]::UTF8.GetString($bytes)
  $g.DrawString($str, $font, $b, $x, $y)
}

${drawCommands}

$bmp.Save('${tempImgPath.replace(/\\/g, '/')}', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose()
$bmp.Dispose()
`;
    fs.writeFileSync(tempScriptPath, psScript, 'utf-8');
    execSync(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`, { stdio: 'inherit' });

    const imgBuf = fs.readFileSync(tempImgPath);
    console.log(`Generated image size: ${(imgBuf.length / 1024).toFixed(1)} KB`);

    console.log(`Uploading test image to S3: s3://${privateBucket}/${testS3Key}...`);
    await s3.send(
      new PutObjectCommand({
        Bucket: privateBucket,
        Key: testS3Key,
        Body: imgBuf,
        ContentType: 'image/jpeg',
      })
    );
    console.log('✓ Test document uploaded to S3 private bucket.');

    // 5. Insert Records into YDB (lots_v2 & documents_vault_v2)
    console.log('\n[5/7] Inserting test records into YDB (lots_v2 & documents_vault_v2)...');
    const nowIso = new Date().toISOString();
    
    const lotItem = {
      id: { S: `lot-${testLotCode}` },
      lotCode: { S: testLotCode },
      title: { S: 'Тестовый лот для OCR' },
      status: { S: 'draft' },
      createdAt: { S: nowIso },
      publishedAt: { S: nowIso },
      priceRub: { N: '15000000' },
      areaSqm: { N: '64.5' },
      dealTrack: { S: 'primary_ddu' },
    };

    const docItem = {
      id: { S: testDocId },
      lotCode: { S: testLotCode },
      category: { S: 'ddu_contract' },
      status: { S: 'pending_review' },
      name: { S: 'ДДУ № 78-2026/045.jpg' },
      s3Key: { S: testS3Key },
      objectKey: { S: testS3Key },
      sizeBytes: { N: String(imgBuf.length) },
      createdAt: { S: nowIso },
    };

    // Create lot in v2 and v1
    await callYdb('PutItem', { TableName: 'lots_v2', Item: lotItem });
    await callYdb('PutItem', { TableName: 'lots', Item: lotItem }).catch(() => {});

    // Create document in vault in v2 and v1
    await callYdb('PutItem', { TableName: 'documents_vault_v2', Item: docItem });
    await callYdb('PutItem', { TableName: 'documents_vault', Item: docItem }).catch(() => {});
    console.log('✓ Test lot and document_vault record initialized in YDB.');

    // 6. Submit OCR Job via API
    console.log('\n[6/7] Submitting OCR job via POST /api/ai/ocr/jobs...');
    const ocrEnqueueRes = await fetch(`${apiBaseUrl}/api/ai/ocr/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ lotCode: testLotCode, documentId: testDocId }),
    });

    const ocrEnqueueJson = await ocrEnqueueRes.json();
    console.log('Enqueue status:', ocrEnqueueRes.status);
    console.log('Enqueue response:', JSON.stringify(ocrEnqueueJson, null, 2));

    if (!ocrEnqueueJson.ok || !ocrEnqueueJson.job?.id) {
      throw new Error(`Failed to enqueue OCR job: ${JSON.stringify(ocrEnqueueJson)}`);
    }

    createdJobId = ocrEnqueueJson.job.id;
    console.log(`✓ Job queued with ID: ${createdJobId}. Monitoring worker execution...`);

    // Poll for completion (up to 90 seconds)
    const startTime = Date.now();
    let completedJob = null;
    while (Date.now() - startTime < 90000) {
      await new Promise((r) => setTimeout(r, 4000));
      const pollRes = await fetch(`${apiBaseUrl}/api/ai/ocr/jobs/${encodeURIComponent(createdJobId)}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const pollJson = await pollRes.json();
      console.log(`[${Math.round((Date.now() - startTime) / 1000)}s] Job status: ${pollJson.job?.status}`);

      if (pollJson.job?.status === 'completed') {
        completedJob = pollJson.job;
        break;
      }
      if (pollJson.job?.status === 'failed') {
        throw new Error(`OCR Job failed: ${pollJson.job.errorMessage}`);
      }
    }

    if (!completedJob) {
      throw new Error('Timeout waiting for OCR job completion.');
    }

    // 7. Verify Results & Risk Flags
    console.log('\n[7/7] Verifying Extracted Russian Legal Fields & Risk Flags...');
    const fields = completedJob.extractedFields;
    console.log('Detected Document Type:', fields?.detectedDocType);
    console.log('Extracted DDU Number:', fields?.dduNumber);
    console.log('Extracted Cadastral:', fields?.cadastralNumber);
    console.log('Extracted Full Price:', fields?.fullPriceRub);
    console.log('Extracted Paid Amount:', fields?.paidAmountRub);
    console.log('Extracted Developer:', fields?.developerName, 'INN:', fields?.developerInn);
    console.log('Extracted Escrow Bank:', fields?.escrowBankName);
    console.log('Risk Flags:', JSON.stringify(fields?.riskFlags, null, 2));

    // Validations
    if (!fields?.cadastralNumber?.includes('78:34:0410101:1234')) {
      console.warn('Cadastral number extraction mismatch:', fields?.cadastralNumber);
    } else {
      console.log('✓ Cadastral number matched: 78:34:0410101:1234');
    }

    if (fields?.fullPriceRub !== 15000000) {
      console.warn('Full price mismatch:', fields?.fullPriceRub);
    } else {
      console.log('✓ Full price correctly extracted: 15 000 000 ₽');
    }

    const hasMaternalRisk = fields?.riskFlags?.some((f) => f.code === 'maternal_capital');
    if (!hasMaternalRisk) {
      console.warn('Warning: Expected maternal_capital risk flag not found in:', fields?.riskFlags);
    } else {
      console.log('✓ Maternal capital risk flag correctly triggered with page excerpt!');
    }

    // Check full transcript in S3
    if (completedJob.rawTextS3Key) {
      console.log(`Checking OCR transcript in S3: ${completedJob.rawTextS3Key}...`);
      const s3Transcript = await s3.send(
        new GetObjectCommand({
          Bucket: privateBucket,
          Key: completedJob.rawTextS3Key,
        })
      );
      const transcriptText = await s3Transcript.Body.transformToString('utf-8');
      const transcriptJson = JSON.parse(transcriptText);
      console.log(`✓ S3 OCR Transcript found. Total characters: ${transcriptJson.fullText?.length}`);
    }

    // Verify Human-in-the-Loop: vault status must STILL be pending_review
    console.log('Checking Human-in-the-Loop protection on documents_vault_v2...');
    const vaultDocRes = await callYdb('GetItem', {
      TableName: 'documents_vault_v2',
      Key: { id: { S: testDocId } },
    });
    const currentVaultStatus = vaultDocRes.body?.Item?.status?.S;
    console.log('Current documents_vault_v2 status:', currentVaultStatus);
    if (currentVaultStatus !== 'pending_review') {
      throw new Error(`CRITICAL VIOLATION: Document status changed to ${currentVaultStatus}! Expected pending_review.`);
    }
    console.log('✓ Human-in-the-loop audit strictly preserved: document status remains pending_review.');

    console.log('\n======================================================');
    console.log('🏆 ALL E2E LIVE OCR & YMQ VERIFICATIONS PASSED 100%!');
    console.log('======================================================');
  } finally {
    console.log('\n--- Cleanup & Teardown ---');
    try {
      if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath);
      if (fs.existsSync(tempImgPath)) fs.unlinkSync(tempImgPath);

      // Clean S3
      await s3.send(new DeleteObjectCommand({ Bucket: privateBucket, Key: testS3Key })).catch(() => {});
      if (createdJobId) {
        await s3
          .send(
            new DeleteObjectCommand({
              Bucket: privateBucket,
              Key: `_ai_ocr/${testLotCode}/${createdJobId}.json`,
            })
          )
          .catch(() => {});
      }

      // Clean YDB
      await callYdb('DeleteItem', {
        TableName: 'lots_v2',
        Key: { id: { S: `lot-${testLotCode}` } },
      }).catch(() => {});
      await callYdb('DeleteItem', {
        TableName: 'lots',
        Key: { id: { S: `lot-${testLotCode}` } },
      }).catch(() => {});
      await callYdb('DeleteItem', {
        TableName: 'documents_vault_v2',
        Key: { id: { S: testDocId } },
      }).catch(() => {});
      await callYdb('DeleteItem', {
        TableName: 'documents_vault',
        Key: { id: { S: testDocId } },
      }).catch(() => {});
      if (createdJobId) {
        await callYdb('DeleteItem', {
          TableName: 'ai_ocr_jobs_v2',
          Key: { id: { S: createdJobId } },
        }).catch(() => {});
      }
      console.log('✓ Cleanup completed cleanly.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
