import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const args = process.argv.slice(2);
const envArgIdx = args.indexOf('--env');
const targetEnvArg = (envArgIdx !== -1 && args[envArgIdx + 1]) ? args[envArgIdx + 1] : 'staging';
const targetEnv = (targetEnvArg === 'prod' || targetEnvArg === 'production') ? 'production' : targetEnvArg;

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const ydbEndpoint = manifest[targetEnv]?.ydbDocApiEndpoint;
if (!ydbEndpoint) {
  console.error(`Missing ydbDocApiEndpoint in manifest for environment: ${targetEnv}`);
  process.exit(1);
}

const accessKeyId = envVars.YC_ACCESS_KEY_ID || envVars.AWS_ACCESS_KEY_ID;
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY || envVars.AWS_SECRET_ACCESS_KEY;
if (!accessKeyId || !secretAccessKey) {
  console.error('Missing YC_ACCESS_KEY_ID or YC_SECRET_ACCESS_KEY in .env.cloud.local');
  process.exit(1);
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function callYdb(target, body) {
  const url = new URL(ydbEndpoint);
  const host = url.host;
  const reqPath = url.pathname || '/';
  const region = 'ru-central1';
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
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: res.status, ok: res.ok, body: json };
}

// Desired Secondary Index configurations across critical collections
const DESIRED_INDEXES = {
  users: [
    { name: 'email-index', attribute: 'email', type: 'S' },
    { name: 'yandexId-index', attribute: 'yandexId', type: 'S' },
    { name: 'phoneNormalized-index', attribute: 'phoneNormalized', type: 'S' },
  ],
  lots: [
    { name: 'lotCode-index', attribute: 'lotCode', type: 'S' },
    { name: 'status-index', attribute: 'status', type: 'S' },
  ],
  seller_requests: [
    { name: 'userId-index', attribute: 'userId', type: 'S' },
    { name: 'lotCode-index', attribute: 'lotCode', type: 'S' },
    { name: 'status-index', attribute: 'status', type: 'S' },
  ],
  deals: [
    { name: 'userId-index', attribute: 'userId', type: 'S' },
    { name: 'lotCode-index', attribute: 'lotCode', type: 'S' },
    { name: 'status-index', attribute: 'status', type: 'S' },
  ],
  tier_verification_requests: [
    { name: 'userId-index', attribute: 'userId', type: 'S' },
    { name: 'status-index', attribute: 'status', type: 'S' },
  ],
};

async function ensureTableIndexes(tableName, indexes) {
  console.log(`\n--- Inspecting table: ${tableName} ---`);
  const desc = await callYdb('DescribeTable', { TableName: tableName });
  if (!desc.ok) {
    console.warn(`  ⚠️ Table ${tableName} returned HTTP ${desc.status}:`, desc.body?.message || desc.body);
    return;
  }

  const table = desc.body.Table || {};
  console.log('  Table KeySchema:', JSON.stringify(table.KeySchema), 'AttributeDefinitions:', JSON.stringify(table.AttributeDefinitions));
  const existingGsi = table.GlobalSecondaryIndexes || [];
  const existingNames = new Set(existingGsi.map((g) => g.IndexName));
  console.log(`  Existing GSIs: [${Array.from(existingNames).join(', ') || 'none'}]`);

  for (const idx of indexes) {
    if (existingNames.has(idx.name)) {
      console.log(`  ✓ Index ${idx.name} already exists.`);
      continue;
    }

    console.log(`  Creating index ${idx.name} on field "${idx.attribute}"...`);
    const existingAttrs = table.AttributeDefinitions || [{ AttributeName: 'id', AttributeType: 'S' }];
    const hasAttr = existingAttrs.some((a) => a.AttributeName === idx.attribute);
    const attrDefs = hasAttr
      ? existingAttrs
      : [...existingAttrs, { AttributeName: idx.attribute, AttributeType: idx.type }];

    const updatePayload = {
      TableName: tableName,
      AttributeDefinitions: attrDefs,
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: idx.name,
            KeySchema: [{ AttributeName: idx.attribute, KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
          },
        },
      ],
    };

    const updateRes = await callYdb('UpdateTable', updatePayload);
    if (updateRes.ok) {
      console.log(`  ✓ Successfully triggered creation of GSI: ${idx.name}`);
    } else {
      const errMsg = updateRes.body?.message || JSON.stringify(updateRes.body);
      if (
        errMsg.includes('already exists') ||
        errMsg.includes('ResourceInUseException') ||
        errMsg.includes('ConflictException')
      ) {
        console.log(`  ✓ Index ${idx.name} is already provisioned or in progress.`);
      } else {
        console.warn(`  Notice on index ${idx.name} (${updateRes.status}):`, errMsg);
      }
    }
  }
}

async function main() {
  console.log('================================================================');
  console.log('=== YDB Document API Idempotent Index Provisioning ===');
  console.log(`Environment: ${targetEnv}`);
  console.log(`Endpoint:    ${ydbEndpoint}`);
  console.log('================================================================');

  for (const [tableName, indexes] of Object.entries(DESIRED_INDEXES)) {
    try {
      await ensureTableIndexes(tableName, indexes);
    } catch (err) {
      console.error(`Error processing table ${tableName}:`, err.message);
    }
  }

  console.log('\n================================================================');
  console.log('✓ YDB Index Inspection and Provisioning Completed.');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during index provisioning:', err);
  process.exit(1);
});
