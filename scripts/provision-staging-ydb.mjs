import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const ENV_FILE = path.join(ROOT_DIR, '.env.cloud.local');

// 1. Generate or retrieve static access key for domexit-runtime-sa
console.log('--- Step 2: Provisioning static access key for domexit-runtime-sa ---');
let keyId = '';
let secretKey = '';

try {
  const keyRaw = execSync(
    'yc iam access-key create --service-account-name domexit-runtime-sa --description "Runtime key for staging backend and storage" --format json',
    { encoding: 'utf-8' }
  );
  const keyData = JSON.parse(keyRaw);
  keyId = keyData.access_key.key_id;
  secretKey = keyData.secret;
  console.log('✓ Successfully created new access key for domexit-runtime-sa. Key ID:', keyId);
} catch (err) {
  console.error('Failed to create access key via yc CLI:', err.message);
  process.exit(1);
}

// 2. Generate random 64-byte hex JWT signing secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

// 3. Write .env.cloud.local
console.log('--- Writing .env.cloud.local ---');
const envContent = `# Yandex Cloud Runtime Service Account (domexit-runtime-sa)
YC_ACCESS_KEY_ID=${keyId}
YC_SECRET_ACCESS_KEY=${secretKey}
YC_SERVICE_ACCOUNT_ID=aje70eogmpm04c84rsnl

# Cloud Identifiers
YC_CLOUD_ID=b1gbu0q3jqnheri2srsu
YC_FOLDER_ID=b1g46uad3gc3h34k5b0f
YC_REGION=ru-central1

# S3 Buckets - Production
PROD_PUBLIC_PHOTOS_BUCKET=domexit-storage-vault
PROD_PRIVATE_DOCS_BUCKET=domexit-private-docs-prod
PROD_WEB_BUCKET=domexit-web-prod

# S3 Buckets - Staging
STAGING_PUBLIC_PHOTOS_BUCKET=domexit-public-photos-staging
STAGING_PRIVATE_DOCS_BUCKET=domexit-private-docs-staging
STAGING_WEB_BUCKET=domexit-web-staging
S3_ENDPOINT=https://storage.yandexcloud.net

# YDB Document API Endpoints
PROD_YDB_DATABASE_ID=etnckg937628mnid7tnb
PROD_YDB_DOCAPI_ENDPOINT=https://docapi.serverless.yandexcloud.net/ru-central1/b1gbu0q3jqnheri2srsu/etnckg937628mnid7tnb
STAGING_YDB_DATABASE_ID=etnkpeqnbmb1a6cocipk
STAGING_YDB_DOCAPI_ENDPOINT=https://docapi.serverless.yandexcloud.net/ru-central1/b1gbu0q3jqnheri2srsu/etnkpeqnbmb1a6cocipk

# Auth & Secrets
JWT_SIGNING_SECRET=${jwtSecret}
YANDEX_OAUTH_CLIENT_ID=72f6de11197d4e9da68ea1fec90c72e1
YANDEX_OAUTH_CLIENT_SECRET=
BOOTSTRAP_OWNER_EMAIL=amaas9499@gmail.com
BOOTSTRAP_OWNER_PASSWORD=
`;

fs.writeFileSync(ENV_FILE, envContent, { encoding: 'utf-8', mode: 0o600 });
console.log('✓ Successfully wrote .env.cloud.local (600 permissions, Git ignored)');

// 4. Provision tables in staging YDB
console.log('--- Step 4: Provisioning clean standard tables in domexit-ydb-staging ---');

const STAGING_ENDPOINT = 'https://docapi.serverless.yandexcloud.net/ru-central1/b1gbu0q3jqnheri2srsu/etnkpeqnbmb1a6cocipk';
const STAGING_REGION = 'ru-central1';

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secret, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function callDocApi(target, bodyObj) {
  const url = new URL(STAGING_ENDPOINT);
  const canonicalHost = 'docapi.serverless.yandexcloud.net';
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

  const credentialScope = `${dateStamp}/${STAGING_REGION}/dynamodb/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(secretKey, dateStamp, STAGING_REGION, 'dynamodb');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${keyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(STAGING_ENDPOINT, {
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
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { status: res.status, text, data };
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
  'partner_banks',
  'bank_employees',
  'bank_special_approvals',
  'escrow_bridge_chats',
  'security_incidents',
];

async function run() {
  console.log('Listing existing tables on domexit-ydb-staging...');
  const listRes = await callDocApi('DynamoDB_20120810.ListTables', {});
  if (listRes.status !== 200) {
    console.error('ListTables failed:', listRes.status, listRes.text);
    process.exit(1);
  }

  const existingTables = listRes.data?.TableNames || [];
  console.log(`Found ${existingTables.length} existing tables on domexit-ydb-staging.`);

  let createdCount = 0;
  for (const table of REQUIRED_TABLES) {
    if (existingTables.includes(table)) {
      console.log(`- Table [${table}] already exists. Skipping.`);
      continue;
    }

    process.stdout.write(`- Creating table [${table}]... `);
    const createRes = await callDocApi('DynamoDB_20120810.CreateTable', {
      TableName: table,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    });

    if (createRes.status === 200) {
      console.log('OK (200)');
      createdCount++;
    } else {
      console.log('FAILED:', createRes.status, createRes.text);
    }
  }

  console.log(`\n=== Provisioning Complete: Created ${createdCount} new tables on domexit-ydb-staging ===`);
}

run().catch((err) => {
  console.error('Fatal error in provisioning:', err);
  process.exit(1);
});
