import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT_DIR, '.env.cloud.local');
const MANIFEST_FILE = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');

const args = process.argv.slice(2);
let targetEnv = 'production';
for (const arg of args) {
  if (arg.startsWith('--env=')) targetEnv = arg.split('=')[1].trim();
}

if (!fs.existsSync(ENV_FILE)) {
  console.error('[InitTables] Error: .env.cloud.local does not exist!');
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

const envConfig = targetEnv === 'staging' ? manifest.staging : manifest.production;
const ydbEndpoint = envConfig?.ydbDocApiEndpoint;
const databaseId = envConfig?.ydbDatabaseId;
const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || envVars.YC_REGION || 'ru-central1';

if (!ydbEndpoint || !accessKeyId || !secretAccessKey) {
  console.error('[InitTables] Missing critical credentials for target YDB!');
  process.exit(1);
}

console.log(`=== Safe YDB Table Initialization [${targetEnv.toUpperCase()}] (Non-Destructive) ===`);
console.log('Target Database:', databaseId);
console.log('Endpoint:       ', ydbEndpoint);

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

async function callDocApi(target, bodyObj, retries = 3) {
  const url = new URL(ydbEndpoint);
  const canonicalHost = url.host;
  const canonicalPath = url.pathname;

  for (let attempt = 1; attempt <= retries; attempt++) {
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

    try {
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
      let data = undefined;
      try {
        data = JSON.parse(text);
      } catch {}

      if (res.status === 200) {
        return { status: res.status, data };
      }

      if (res.status === 504 || res.status === 503 || res.status === 500) {
        console.warn(`  [Retry ${attempt}/${retries}] DocAPI returned ${res.status}. Retrying in 2s...`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
      }

      return { status: res.status, data, text };
    } catch (netErr) {
      console.warn(`  [Retry ${attempt}/${retries}] Network error: ${netErr.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      return { status: 0, text: netErr.message };
    }
  }
  return { status: 504, text: 'Exhausted retries' };
}

const REQUIRED_TABLES = [
  'lots',
  'deals',
  'seller_requests',
  'buyer_applications',
  'candidates',
  'documents_vault',
  'curator_messages',
  'deal_messages',
  'users',
  'employees',
  'developers',
  'developer_accreditation_requests',
  'audit_logs',
  'user_consents',
  'market_settings',
  'legal_settings',
  'legal_documents',
  'platform_settings',
  'company_profile',
  'public_channels',
  'partners',
  'partner_applications',
  'partner_preliminary_requests',
  'investor_applications',
  'vip_subscriptions',
  'partner_banks',
  'bank_employees',
  'bank_special_approvals',
  'escrow_bridge_chats',
  'security_incidents',
  // Phase 4 Telegram OS Tables
  'telegram_bindings',
  'telegram_link_tokens',
  'telegram_message_map',
];

async function run() {
  console.log(`Listing existing tables in ${targetEnv} YDB...`);
  const listRes = await callDocApi('DynamoDB_20120810.ListTables', {});
  if (listRes.status !== 200 || !listRes.data?.TableNames) {
    throw new Error(`Failed to list tables: ${JSON.stringify(listRes)}`);
  }

  const existingTables = new Set(listRes.data.TableNames);
  console.log(`Found ${existingTables.size} existing tables.`);

  let createdCount = 0;
  for (const table of REQUIRED_TABLES) {
    if (existingTables.has(table)) {
      console.log(`  - Table [${table}] already exists (SKIPPED).`);
      continue;
    }

    console.log(`  + Creating missing table [${table}]...`);
    const createRes = await callDocApi('DynamoDB_20120810.CreateTable', {
      TableName: table,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    });

    if (createRes.status === 200) {
      console.log(`    ✓ Table [${table}] created successfully.`);
      createdCount++;
    } else {
      console.error(`    ✗ Failed to create table [${table}]:`, createRes);
    }
  }

  console.log(`\n=== Table Check Complete: ${createdCount} missing tables created. Zero existing tables touched. ===`);
}

run().catch((err) => {
  console.error('[InitTables] Fatal error:', err);
  process.exit(1);
});
