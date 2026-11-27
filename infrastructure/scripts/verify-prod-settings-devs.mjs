import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envVars = {};
for (const line of fs.readFileSync(ENV_PATH, 'utf-8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const ydbEndpoint = manifest.production?.ydbDocApiEndpoint;
const region = manifest.region || 'ru-central1';
const accessKeyId = envVars.YC_ACCESS_KEY_ID || envVars.AWS_ACCESS_KEY_ID;
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY || envVars.AWS_SECRET_ACCESS_KEY;

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function getSigningKey(secretKey, dateStamp, regionName, service) {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function callYdbRaw(target, body) {
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
  const canonicalRequest = `POST\n${reqPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256Hex(payload)}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${region}/${service}/aws4_request\n${sha256Hex(canonicalRequest)}`;
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
    return { ok: res.ok, status: res.status, body: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, body: { raw: text } };
  }
}

function fromDynamo(attr) {
  if (!attr || typeof attr !== 'object') return attr;
  if ('S' in attr) return attr.S;
  if ('N' in attr) return Number(attr.N);
  if ('BOOL' in attr) return attr.BOOL;
  if ('NULL' in attr) return null;
  if ('L' in attr) return (attr.L || []).map(fromDynamo);
  if ('M' in attr) {
    const obj = {};
    for (const [k, v] of Object.entries(attr.M || {})) {
      obj[k] = fromDynamo(v);
    }
    return obj;
  }
  return null;
}

function toDynamo(val) {
  if (val === null || val === undefined) return { NULL: true };
  if (typeof val === 'string') return { S: val };
  if (typeof val === 'number') return { N: String(val) };
  if (typeof val === 'boolean') return { BOOL: val };
  if (Array.isArray(val)) return { L: val.map((v) => toDynamo(v)) };
  if (typeof val === 'object') {
    const map = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) map[k] = toDynamo(v);
    }
    return { M: map };
  }
  return { S: String(val) };
}

async function main() {
  console.log('=== Checking Developers in Production ===');
  const devsRes = await callYdbRaw('Scan', { TableName: 'developers' });
  const rawDevs = devsRes.body?.Items || [];
  const devs = rawDevs.map(fromDynamo);
  console.log('Total developers count:', devs.length);
  const validDevs = devs.filter(Boolean);
  const testDevs = validDevs.filter((d) => (d.name || '').toLowerCase().includes('test') || (d.id || '').toLowerCase().includes('test'));
  console.log('Test developers found:', testDevs.length);
  for (const d of validDevs) {
    console.log(` - ${d.id || d.name} (INN: ${d.inn || 'none'})`);
  }

  console.log('\n=== Checking ai_lab_config in Production platform_settings ===');
  const cfgRes = await callYdbRaw('GetItem', {
    TableName: 'platform_settings',
    Key: { id: { S: 'ai_lab_config' } },
  });
  const currentCfg = cfgRes.body?.Item ? fromDynamo(cfgRes.body.Item) : null;
  console.log('Current ai_lab_config:', JSON.stringify(currentCfg, null, 2));

  // Ensure safe configuration (owner_only / off)
  const safeConfig = {
    id: 'ai_lab_config',
    masterLabEnabled: true,
    features: {
      addressValidation: 'owner_only',
      avmValuation: 'owner_only',
      cbrAutoSync: 'owner_only',
      documentOcr: 'owner_only',
      legalAudit: 'owner_only',
      legislativeRadar: 'owner_only',
      journalAutoSeo: 'owner_only',
      aiConcierge: 'owner_only',
      kycVerification: 'owner_only',
      dataLensBi: 'owner_only',
    },
    dailyCaps: {
      gptCalls: 200,
      ocrPages: 200,
    },
    updatedAt: new Date().toISOString(),
  };

  const putRes = await callYdbRaw('PutItem', {
    TableName: 'platform_settings',
    Item: toDynamo(safeConfig).M,
  });
  console.log('Put safe ai_lab_config status:', putRes.status, putRes.ok ? 'SUCCESS' : putRes.body);
}

main().catch(console.error);
