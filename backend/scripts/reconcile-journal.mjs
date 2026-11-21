import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const args = process.argv.slice(2);
let targetEnv = 'staging';
let sinceDate = '';

for (const arg of args) {
  if (arg.startsWith('--env=')) targetEnv = arg.split('=')[1].trim();
  if (arg.startsWith('--since=')) sinceDate = arg.split('=')[1].trim();
}

const isApply = args.includes('--apply');
const isConfirmedProd = args.includes('--confirm-prod');
const isDryRun = !isApply;

console.log('===============================================================');
console.log(`=== DomExit Journal Reconciliation Tool [${isDryRun ? 'DRY-RUN' : 'APPLY'}] ===`);
console.log('===============================================================');
console.log('Target Environment:', targetEnv);
console.log('Since Date:        ', sinceDate || '(All Journal Entries)');
console.log('Execution Mode:    ', isDryRun ? 'READ-ONLY PREVIEW' : 'MUTATING SYNC');

if (!isDryRun && targetEnv === 'production' && !isConfirmedProd) {
  console.error('\n[Reconcile] CRITICAL SAFETY: Reconciling production with --apply requires --confirm-prod!');
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
  console.log(`\n[1/3] Scanning s3://${privateBucket}/_journal/...`);
  let continuationToken = undefined;
  const journalKeys = [];

  do {
    const listRes = await s3.send(
      new ListObjectsV2Command({
        Bucket: privateBucket,
        Prefix: '_journal/',
        ContinuationToken: continuationToken,
      })
    );

    if (listRes.Contents) {
      for (const item of listRes.Contents) {
        if (!item.Key || !item.Key.endsWith('.json')) continue;
        if (sinceDate) {
          // Check if key date is >= sinceDate
          const dateMatch = item.Key.match(/_journal\/(\d{4})\/(\d{2})\/(\d{2})\//);
          if (dateMatch) {
            const keyDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
            if (keyDate < sinceDate) continue;
          }
        }
        journalKeys.push(item.Key);
      }
    }
    continuationToken = listRes.NextContinuationToken;
  } while (continuationToken);

  console.log(`Found ${journalKeys.length} journal event file(s).`);

  if (journalKeys.length === 0) {
    console.log('No journal events to reconcile.');
    return;
  }

  // Sort chronologically ascending
  journalKeys.sort();

  // 2. Fetch and aggregate state
  console.log('\n[2/3] Parsing events and aggregating state per entity...');
  const latestStates = new Map(); // key: `${collection}:${recordId}` -> { event }

  for (const k of journalKeys) {
    try {
      const getRes = await s3.send(new GetObjectCommand({ Bucket: privateBucket, Key: k }));
      const chunks = [];
      for await (const chunk of getRes.Body) chunks.push(chunk);
      const eventData = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const entityKey = `${eventData.collection}:${eventData.recordId}`;
      latestStates.set(entityKey, eventData);
    } catch (err) {
      console.warn(`Failed reading journal file ${k}:`, err.message);
    }
  }

  console.log(`Aggregated latest state for ${latestStates.size} distinct entities.`);

  // 3. Compare with live YDB
  console.log('\n[3/3] Comparing with live YDB records...');
  let missingCount = 0;
  let inSyncCount = 0;

  for (const [entityKey, eventData] of latestStates.entries()) {
    const [collection, recordId] = entityKey.split(':');
    const getRes = await callDocApi('DynamoDB_20120810.GetItem', {
      TableName: collection,
      Key: { id: { S: recordId } },
    });

    const existsInYdb = Boolean(getRes.data?.Item);

    if (eventData.action === 'DELETE' || eventData.action === 'CASCADE_DELETE') {
      if (existsInYdb) {
        console.log(`  ! Entity [${entityKey}] was DELETED in journal but still exists in YDB`);
        if (isApply) {
          await callDocApi('DynamoDB_20120810.DeleteItem', {
            TableName: collection,
            Key: { id: { S: recordId } },
          });
          console.log(`    ✓ Deleted [${entityKey}] from YDB`);
        }
      } else {
        inSyncCount++;
      }
    } else {
      // CREATE or UPDATE
      if (!existsInYdb) {
        missingCount++;
        console.log(`  + Entity [${entityKey}] is MISSING in YDB`);
        if (isApply && eventData.payload) {
          const item = { ...eventData.payload, id: recordId };
          const dynamoItem = {};
          for (const [k, v] of Object.entries(item)) {
            if (v !== undefined) dynamoItem[k] = toDynamo(v);
          }
          await callDocApi('DynamoDB_20120810.PutItem', {
            TableName: collection,
            Item: dynamoItem,
          });
          console.log(`    ✓ Restored [${entityKey}] to YDB`);
        }
      } else {
        inSyncCount++;
      }
    }
  }

  console.log('\n=== Reconciliation Summary ===');
  console.log(`Total Entities: ${latestStates.size}`);
  console.log(`In Sync:        ${inSyncCount}`);
  console.log(`Discrepancies:  ${missingCount}`);
  if (isDryRun) {
    console.log('DRY-RUN completed. Pass --apply to synchronize.');
  } else {
    console.log('Applied synchronization to YDB.');
  }
}

run().catch((err) => {
  console.error('[Reconcile] Error:', err.message);
  process.exit(1);
});
