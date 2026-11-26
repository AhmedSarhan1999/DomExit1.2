import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '../../backend/node_modules/@aws-sdk/client-s3/dist-cjs/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('[StagingReset] Missing cloud-manifest.json or .env.cloud.local');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > 0) envVars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const PROD_DB_ID = 'etnckg937628mnid7tnb';
const EXPECTED_STAGING_DB_ID = 'etnkpeqnbmb1a6cocipk';
const ydbEndpoint = (envVars.STAGING_YDB_DOCAPI_ENDPOINT || manifest.staging?.ydbDocApiEndpoint || '').trim();
const stagingDbId = (manifest.staging?.ydbDatabaseId || '').trim();

// STRICT SAFETY GUARD: Abort immediately if endpoint or ID matches Production DB!
if (
  !ydbEndpoint ||
  ydbEndpoint.includes(PROD_DB_ID) ||
  stagingDbId === PROD_DB_ID ||
  !ydbEndpoint.includes(EXPECTED_STAGING_DB_ID)
) {
  console.error(
    `[StagingReset] FATAL SAFETY ABORT: Target database is NOT Staging (${EXPECTED_STAGING_DB_ID}) or touches Production (${PROD_DB_ID})!`
  );
  process.exit(1);
}

const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || 'ru-central1';

if (!accessKeyId || !secretAccessKey) {
  console.error('[StagingReset] Missing YC_ACCESS_KEY_ID or YC_SECRET_ACCESS_KEY');
  process.exit(1);
}

const parsedUrl = new URL(ydbEndpoint);
const canonicalHost = parsedUrl.host;
const canonicalPath = parsedUrl.pathname;

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function getSigningKey(secret, dateStamp) {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 'dynamodb');
  return hmac(kService, 'aws4_request');
}

async function callYdb(target, bodyObj) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const body = JSON.stringify(bodyObj);
  const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:${canonicalHost}\nx-amz-date:${amzDate}\nx-amz-target:DynamoDB_20120810.${target}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = ['POST', canonicalPath, '', canonicalHeaders, signedHeaders, sha256Hex(body)].join('\n');
  const scope = `${dateStamp}/${region}/dynamodb/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = getSigningKey(secretAccessKey, dateStamp);
  const sig = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const res = await fetch(ydbEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': `DynamoDB_20120810.${target}`,
      'X-Amz-Date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    },
    body,
  });

  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    throw new Error(`YDB ${target} failed (${res.status}): ${json.message || text}`);
  }
  return json;
}

async function listAllTables() {
  const tables = [];
  let lastTable;
  do {
    const res = await callYdb('ListTables', lastTable ? { ExclusiveStartTableName: lastTable } : {});
    if (Array.isArray(res.TableNames)) tables.push(...res.TableNames);
    lastTable = res.LastEvaluatedTableName;
  } while (lastTable);
  return tables;
}

async function scanAllRaw(tableName) {
  const items = [];
  let lastKey;
  do {
    const payload = { TableName: tableName, Limit: 100 };
    if (lastKey) payload.ExclusiveStartKey = lastKey;
    const res = await callYdb('Scan', payload);
    if (Array.isArray(res.Items)) items.push(...res.Items);
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

const PROTECTED_TABLES = new Set([
  'users',
  'users_v2',
  'employees',
  'telegram_bindings',
  'developers',
  'legal_documents',
  'legal_settings',
  'market_settings',
  'platform_settings',
  'public_channels',
]);

const OPERATIONAL_WIPE_TABLES = [
  'lots', 'lots_v2',
  'deals', 'deals_v2',
  'seller_requests', 'seller_requests_v2',
  'buyer_applications', 'buyer_applications_v2',
  'documents_vault', 'documents_vault_v2',
  'deal_messages', 'deal_messages_v2',
  'curator_messages', 'curator_messages_v2',
  'escrow_bridge_chats',
  'audit_logs', 'audit_logs_v2',
  'security_incidents',
  'pep_signatures', 'pep_signatures_v2',
  'pep_otps',
  'tier_verification_requests', 'tier_verification_requests_v2',
  'candidates',
  'partners',
  'partner_applications',
  'partner_preliminary_requests',
  'investor_applications',
  'rate_limits',
  'telegram_link_tokens',
  'telegram_message_map',
  'vip_subscriptions',
];

const s3 = new S3Client({
  region,
  endpoint: 'https://storage.yandexcloud.net',
  credentials: { accessKeyId, secretAccessKey },
});

async function deleteS3Prefix(bucketName, prefix) {
  if (!bucketName || !bucketName.includes('staging')) {
    throw new Error(`Refusing S3 delete on non-staging bucket: ${bucketName}`);
  }
  const toDelete = [];
  let continuationToken;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents || []) {
      if (obj.Key) toDelete.push({ Key: obj.Key });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  if (toDelete.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 1000) {
    const chunk = toDelete.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: chunk, Quiet: true },
      })
    );
    deleted += chunk.length;
  }
  return deleted;
}

async function run() {
  console.log('===================================================================');
  console.log('=== DomExit STAGING Clean-Slate Reset (Accounts & Refs Preserved) ===');
  console.log(`Target Staging DB: ${EXPECTED_STAGING_DB_ID}`);
  console.log('===================================================================\n');

  const existingTables = new Set(await listAllTables());

  // 1. Read users to verify preserved accounts & align buy_box tiers
  const rawUsers = existingTables.has('users') ? await scanAllRaw('users') : [];
  const userTierById = new Map();
  for (const u of rawUsers) {
    const uid = u.id?.S;
    if (uid) userTierById.set(uid, u.buyerTier?.S || 'silver');
  }
  console.log(`[Protected] Preserving ${rawUsers.length} users in Staging.`);

  // 2. Reset buy_boxes counters ONLY (preserve search preferences & align tier with users.buyerTier)
  for (const bbTable of ['buy_boxes', 'buy_boxes_v2']) {
    if (!existingTables.has(bbTable)) continue;
    const boxes = await scanAllRaw(bbTable);
    let updatedCount = 0;
    for (const box of boxes) {
      const uid = box.userId?.S || '';
      const alignedTier = userTierById.get(uid) || box.tier?.S || 'silver';
      const updatedBox = {
        ...box,
        reliabilityScore: { N: '100' },
        noShowCount: { N: '0' },
        withdrawalCount: { N: '0' },
        completedDealsCount: { N: '0' },
        tier: { S: alignedTier },
        updatedAt: { S: new Date().toISOString() },
      };
      await callYdb('PutItem', { TableName: bbTable, Item: updatedBox });
      updatedCount++;
    }
    console.log(`[Reset Counters] ${bbTable}: reset SLA/test counters on ${updatedCount} Buy-Box records.`);
  }

  // 3. Wipe operational tables completely
  console.log('\n[Wiping Operational Tables in Staging]');
  for (const table of OPERATIONAL_WIPE_TABLES) {
    if (PROTECTED_TABLES.has(table)) {
      throw new Error(`Safety violation: ${table} is protected!`);
    }
    if (!existingTables.has(table)) continue;

    const rows = await scanAllRaw(table);
    let deleted = 0;
    for (const row of rows) {
      if (!row.id?.S) continue;
      await callYdb('DeleteItem', {
        TableName: table,
        Key: { id: { S: row.id.S } },
      });
      deleted++;
    }
    console.log(`  ✓ ${table.padEnd(30)} deleted: ${deleted} -> remaining: 0`);
  }

  // 4. Clean Staging S3 test objects while preserving avatars/* and _backups/*
  console.log('\n[Cleaning Staging S3 Test Files]');
  const publicBucket = manifest.staging.publicPhotosBucket;
  const privateBucket = manifest.staging.privateDocsBucket;

  const deletedPhotos = await deleteS3Prefix(publicBucket, 'photos/');
  console.log(`  ✓ ${publicBucket}/photos/* deleted: ${deletedPhotos} (avatars/* preserved)`);

  const deletedDocs = await deleteS3Prefix(privateBucket, 'documents/');
  const deletedProofs = await deleteS3Prefix(privateBucket, 'tier-proofs/');
  console.log(
    `  ✓ ${privateBucket}/documents/* (${deletedDocs}) & tier-proofs/* (${deletedProofs}) deleted (_backups/* preserved)`
  );

  // 5. Verification summary
  console.log('\n[Post-Reset Protected Table Counts]');
  for (const t of [
    'users',
    'employees',
    'telegram_bindings',
    'developers',
    'legal_documents',
    'legal_settings',
    'market_settings',
    'platform_settings',
    'public_channels',
    'buy_boxes',
  ]) {
    if (!existingTables.has(t)) continue;
    const rows = await scanAllRaw(t);
    console.log(`  ✓ ${t.padEnd(22)}: ${rows.length} records`);
  }

  console.log('\n=== Staging Clean-Slate Reset Complete! ===');
}

run().catch((err) => {
  console.error('[StagingReset] FAILED:', err);
  process.exit(1);
});
