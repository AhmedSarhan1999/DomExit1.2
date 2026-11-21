import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT_DIR, '.env.cloud.local');
const MANIFEST_FILE = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');

if (!fs.existsSync(ENV_FILE)) {
  console.error('[Backup] Error: .env.cloud.local does not exist!');
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_FILE)) {
  console.error('[Backup] Error: infrastructure/cloud-manifest.json does not exist!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const prodYdbEndpoint = manifest.production?.ydbDocApiEndpoint;
const prodPrivateDocsBucket = manifest.production?.privateDocsBucket || 'domexit-private-docs-prod';
const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || envVars.YC_REGION || 'ru-central1';

if (!prodYdbEndpoint || !accessKeyId || !secretAccessKey) {
  console.error('[Backup] Missing critical credentials for production YDB/S3!');
  process.exit(1);
}

console.log('=== Pre-Cutover Production Snapshot & Backup ===');
console.log('Target Database:', manifest.production.ydbDatabaseId);
console.log('Endpoint:       ', prodYdbEndpoint);
console.log('Backup Bucket:  ', prodPrivateDocsBucket);

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secret, dateStamp, reg, service) {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, reg);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function callDocApi(target, bodyObj) {
  const url = new URL(prodYdbEndpoint);
  const canonicalHost = url.host;
  const canonicalPath = url.pathname;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const body = JSON.stringify(bodyObj);
  const bodyHash = sha256Hex(body);

  const canonicalHeaders = [
    'content-type:application/x-amz-json-1.0',
    `host:${canonicalHost}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:${target}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = [
    'POST',
    canonicalPath,
    '',
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/dynamodb/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, 'dynamodb');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(prodYdbEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': target,
      'X-Amz-Date': amzDate,
      Authorization: authHeader,
    },
    body,
  });

  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, text };
  }
}

function unmarshallValue(val) {
  if (!val || typeof val !== 'object') return val;
  if ('S' in val) return val.S;
  if ('N' in val) {
    const num = Number(val.N);
    return isNaN(num) ? val.N : num;
  }
  if ('BOOL' in val) return val.BOOL;
  if ('NULL' in val) return null;
  if ('M' in val) {
    const map = {};
    for (const [k, v] of Object.entries(val.M)) {
      map[k] = unmarshallValue(v);
    }
    return map;
  }
  if ('L' in val) {
    return val.L.map(unmarshallValue);
  }
  return val;
}

function unmarshallItem(item) {
  if (!item) return item;
  const res = {};
  for (const [k, v] of Object.entries(item)) {
    res[k] = unmarshallValue(v);
  }
  return res;
}

const CANONICAL_TABLES = [
  'users',
  'lots',
  'deals',
  'audit_logs',
  'client_candidates',
  'seller_requests',
  'company_profile',
  'market_settings',
  'legal_settings',
  'employees',
  'partners',
  'investor_applications',
  'vip_subscriptions',
  'escrow_messages',
  'legal_revisions',
  'user_consents',
  'knowledge_articles',
  'developers',
  'platform_settings',
  'curator_messages',
  'security_incidents',
  'bank_special_approvals',
  'partner_banks',
];

async function run() {
  console.log('\n[1/4] Discovering existing tables in production YDB...');
  const listRes = await callDocApi('DynamoDB_20120810.ListTables', {});
  if (listRes.status !== 200 || !listRes.data?.TableNames) {
    throw new Error(`Failed to list tables in production YDB: ${JSON.stringify(listRes)}`);
  }

  const existingTables = listRes.data.TableNames;
  console.log(`Found ${existingTables.length} table(s) in production.`);

  const backupData = {
    metadata: {
      databaseId: manifest.production.ydbDatabaseId,
      backupTimestamp: new Date().toISOString(),
      region,
      tableCount: existingTables.length,
      totalRecordCount: 0,
    },
    tables: {},
  };

  const tableStats = [];
  const demoTables = [];

  console.log('\n[2/4] Scanning all table contents with full pagination...');
  for (const tableName of existingTables) {
    if (tableName.startsWith('demo_')) {
      demoTables.push(tableName);
    }

    let items = [];
    let exclusiveStartKey = undefined;

    do {
      const scanReq = {
        TableName: tableName,
        Limit: 100,
      };
      if (exclusiveStartKey) {
        scanReq.ExclusiveStartKey = exclusiveStartKey;
      }

      const scanRes = await callDocApi('DynamoDB_20120810.Scan', scanReq);
      if (scanRes.status !== 200) {
        console.warn(`  Warning: failed to scan table ${tableName}:`, scanRes);
        break;
      }

      if (scanRes.data?.Items) {
        items = items.concat(scanRes.data.Items.map(unmarshallItem));
      }

      exclusiveStartKey = scanRes.data?.LastEvaluatedKey;
    } while (exclusiveStartKey);

    backupData.tables[tableName] = items;
    backupData.metadata.totalRecordCount += items.length;
    tableStats.push({ tableName, count: items.length });
    console.log(`  ✓ Table '${tableName}': ${items.length} records`);
  }

  // Identify missing canonical tables
  const existingSet = new Set(existingTables);
  const missingCanonical = CANONICAL_TABLES.filter((t) => !existingSet.has(t));

  console.log('\n[3/4] Compressing snapshot archive...');
  const jsonBuffer = Buffer.from(JSON.stringify(backupData, null, 2), 'utf-8');
  const gzippedBuffer = zlib.gzipSync(jsonBuffer, { level: 9 });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
  const archiveFilename = `pre-cutover-${dateStr}.json.gz`;

  // Save local copy
  const localBackupDir = path.join(ROOT_DIR, 'infrastructure/backups');
  if (!fs.existsSync(localBackupDir)) {
    fs.mkdirSync(localBackupDir, { recursive: true });
  }
  const localBackupPath = path.join(localBackupDir, archiveFilename);
  fs.writeFileSync(localBackupPath, gzippedBuffer);
  console.log(`  ✓ Saved local backup: ${localBackupPath} (${(gzippedBuffer.length / 1024).toFixed(1)} KB)`);

  console.log('\n[4/4] Uploading snapshot archive to production.privateDocsBucket...');
  const s3 = new S3Client({
    region,
    endpoint: 'https://storage.yandexcloud.net',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    maxAttempts: 5,
  });

  const s3Key = `_backups/ydb/${archiveFilename}`;
  let uploaded = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  Upload attempt ${attempt}/3...`);
      await s3.send(
        new PutObjectCommand({
          Bucket: prodPrivateDocsBucket,
          Key: s3Key,
          Body: gzippedBuffer,
          ContentType: 'application/gzip',
        })
      );
      uploaded = true;
      break;
    } catch (err) {
      console.warn(`  Upload attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!uploaded) {
    throw new Error(`Failed to upload snapshot archive to S3 after 3 attempts`);
  }
  console.log(`  ✓ Uploaded to S3: s3://${prodPrivateDocsBucket}/${s3Key} (Private)`);

  console.log('\n=== Snapshot Summary ===');
  console.log(`Total Tables:        ${existingTables.length}`);
  console.log(`Total Records:       ${backupData.metadata.totalRecordCount}`);
  console.log(`Demo Tables:         ${demoTables.length > 0 ? demoTables.join(', ') : 'None'}`);
  console.log(`Missing Canonical:   ${missingCanonical.length > 0 ? missingCanonical.join(', ') : 'None'}`);
  console.log(`Archive S3 Key:      ${s3Key}`);
  console.log('✓ Pre-cutover backup completed successfully without modifying any data.');
}

run().catch((err) => {
  console.error('[Backup] Fatal error:', err);
  process.exit(1);
});
