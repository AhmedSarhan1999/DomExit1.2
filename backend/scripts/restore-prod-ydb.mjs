import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const args = process.argv.slice(2);
let targetEnv = 'staging';
let backupKey = '';
let mode = 'missing-only';

for (const arg of args) {
  if (arg.startsWith('--env=')) targetEnv = arg.split('=')[1].trim();
  if (arg.startsWith('--backup-key=')) backupKey = arg.split('=')[1].trim();
  if (arg.startsWith('--mode=')) mode = arg.split('=')[1].trim();
}

const isConfirmedRestore = args.includes('--confirm-restore');
const isConfirmedProd = args.includes('--confirm-prod');
const isDryRun = !isConfirmedRestore;

console.log('===============================================================');
console.log(`=== DomExit YDB Safe Smart Restore Tool [${isDryRun ? 'DRY-RUN PREVIEW' : 'ACTIVE RESTORE'}] ===`);
console.log('===============================================================');
console.log('Target Environment:', targetEnv);
console.log('Backup Key:        ', backupKey || '(Will auto-detect latest daily backup)');
console.log('Mode:              ', mode);
console.log('Execution Mode:    ', isDryRun ? 'READ-ONLY DRY-RUN (0 WRITES)' : 'MUTATING RESTORE');

if (!isDryRun && targetEnv === 'production' && !isConfirmedProd) {
  console.error('\n[Restore] CRITICAL SAFETY ERROR: Restoring to production requires both --confirm-restore AND --confirm-prod flags!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const envConfig = targetEnv === 'production' ? manifest.production : manifest.staging;
const ydbEndpoint = envConfig.ydbDocApiEndpoint;
const privateBucket = envConfig.privateDocsBucket;
const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || 'ru-central1';

const s3 = new S3Client({
  region,
  endpoint: 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

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
  const url = new URL(ydbEndpoint);
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

  const res = await fetch(ydbEndpoint, {
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

function toDynamo(val) {
  if (val === null || val === undefined) return { NULL: true };
  if (typeof val === 'string') return { S: val };
  if (typeof val === 'number') return { N: String(val) };
  if (typeof val === 'boolean') return { BOOL: val };
  if (Array.isArray(val)) return { L: val.map(toDynamo) };
  if (typeof val === 'object') {
    const m = {};
    for (const k of Object.keys(val)) {
      if (val[k] !== undefined) m[k] = toDynamo(val[k]);
    }
    return { M: m };
  }
  return { S: String(val) };
}

async function run() {
  // If no backup key provided, list backups and pick latest daily
  if (!backupKey) {
    console.log(`Searching for latest daily backup in s3://${privateBucket}/_backups/ydb/daily/...`);
    const listRes = await s3.send(
      new (await import('@aws-sdk/client-s3')).ListObjectsV2Command({
        Bucket: privateBucket,
        Prefix: '_backups/ydb/daily/',
      })
    );
    const files = listRes.Contents || [];
    if (files.length === 0) {
      console.error(`[Restore] No backup files found under _backups/ydb/daily/ in ${privateBucket}`);
      process.exit(1);
    }
    files.sort((a, b) => new Date(b.LastModified).getTime() - new Date(a.LastModified).getTime());
    backupKey = files[0].Key;
    console.log(`Found latest daily backup: ${backupKey}`);
  }

  // 1. Download and decompress backup snapshot
  console.log(`\n[1/3] Downloading backup from s3://${privateBucket}/${backupKey}...`);
  const getObjRes = await s3.send(
    new GetObjectCommand({
      Bucket: privateBucket,
      Key: backupKey,
    })
  );

  const streamToBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  };

  const gzippedBuffer = await streamToBuffer(getObjRes.Body);
  console.log(`Downloaded ${gzippedBuffer.length} bytes. Decompressing...`);
  const rawJson = zlib.gunzipSync(gzippedBuffer).toString('utf-8');
  const snapshot = JSON.parse(rawJson);

  console.log('✓ Snapshot Metadata:');
  console.log('  Created At:   ', snapshot.createdAt);
  console.log('  Source Env:   ', snapshot.env);
  console.log('  Table Count:  ', snapshot.tableCount);
  console.log('  Total Records:', snapshot.totalRecords);

  // 2. Inspect live YDB tables & schemas
  console.log('\n[2/3] Inspecting live YDB tables and primary keys...');
  const tableNames = Object.keys(snapshot.tables || {});
  const comparisonResults = [];

  for (const table of tableNames) {
    const backupItems = snapshot.tables[table] || [];
    const describeRes = await callDocApi('DynamoDB_20120810.DescribeTable', { TableName: table });
    const exists = describeRes.status === 200;
    const keySchema = describeRes.data?.Table?.KeySchema || [];
    const hashKey = keySchema.find((k) => k.KeyType === 'HASH')?.AttributeName || 'id';

    let liveCount = 0;
    if (exists) {
      const scanRes = await callDocApi('DynamoDB_20120810.Scan', { TableName: table, Select: 'COUNT' });
      liveCount = scanRes.data?.Count || 0;
    }

    comparisonResults.push({
      table,
      exists,
      hashKey,
      backupCount: backupItems.length,
      liveCount,
      difference: backupItems.length - liveCount,
    });
  }

  console.log('\n----------------------------------------------------------------------');
  console.log(
    'Table Name'.padEnd(28) +
      'Status'.padEnd(10) +
      'Key'.padEnd(10) +
      'Backup'.padEnd(10) +
      'Live'.padEnd(10) +
      'Diff'
  );
  console.log('----------------------------------------------------------------------');
  for (const r of comparisonResults) {
    const statusStr = r.exists ? 'OK' : 'MISSING';
    console.log(
      r.table.padEnd(28) +
        statusStr.padEnd(10) +
        r.hashKey.padEnd(10) +
        String(r.backupCount).padEnd(10) +
        String(r.liveCount).padEnd(10) +
        (r.difference > 0 ? `+${r.difference}` : String(r.difference))
    );
  }
  console.log('----------------------------------------------------------------------');

  if (isDryRun) {
    console.log('\n=== DRY-RUN COMPLETE: 0 database modifications made. ===');
    console.log('To execute real restore, pass --confirm-restore');
    return;
  }

  // 3. Mutating Restore Execution
  console.log(`\n[3/3] Executing restore in mode [${mode}]...`);
  let restoredCount = 0;
  let skippedCount = 0;

  for (const table of tableNames) {
    const backupItems = snapshot.tables[table] || [];
    const comp = comparisonResults.find((c) => c.table === table);
    const hashKey = comp?.hashKey || 'id';

    for (const item of backupItems) {
      const keyValue = item[hashKey];
      if (!keyValue) continue;

      if (mode === 'missing-only') {
        const getRes = await callDocApi('DynamoDB_20120810.GetItem', {
          TableName: table,
          Key: { [hashKey]: { S: String(keyValue) } },
        });

        if (getRes.data?.Item) {
          skippedCount++;
          continue;
        }
      }

      // Prepare item and put
      const dynamoItem = {};
      for (const [k, v] of Object.entries(item)) {
        if (v !== undefined) dynamoItem[k] = toDynamo(v);
      }

      await callDocApi('DynamoDB_20120810.PutItem', {
        TableName: table,
        Item: dynamoItem,
      });
      restoredCount++;
    }
  }

  console.log('\n=== RESTORE COMPLETED SUCCESSFULLY ===');
  console.log(`Restored records: ${restoredCount}`);
  console.log(`Skipped records:  ${skippedCount}`);
}

run().catch((err) => {
  console.error('[Restore] Fatal Error:', err.message);
  process.exit(1);
});
