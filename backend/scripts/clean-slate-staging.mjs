import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const STAGING_YDB_ENDPOINT = envVars.STAGING_YDB_DOCAPI_ENDPOINT;
const keyId = envVars.YC_ACCESS_KEY_ID;
const secretKey = envVars.YC_SECRET_ACCESS_KEY;

if (!STAGING_YDB_ENDPOINT || !keyId || !secretKey) {
  console.error('Missing staging endpoint or credentials in .env.cloud.local');
  process.exit(1);
}

// Safety check: verify database ID is staging (etnkpeqnbmb1a6cocipk) and NOT production (etnckg937628mnid7tnb)
if (STAGING_YDB_ENDPOINT.includes('etnckg937628mnid7tnb')) {
  console.error('FATAL: STAGING_YDB_ENDPOINT points to PRODUCTION database! Aborting immediately.');
  process.exit(1);
}

console.log('Staging Database Clean-Slate Verification & Purge');
console.log('Endpoint verified:', STAGING_YDB_ENDPOINT.split('?')[0]);

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
  const url = new URL(STAGING_YDB_ENDPOINT);
  const canonicalHost = url.host;
  const canonicalPath = url.pathname;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const body = JSON.stringify(bodyObj);
  const bodyHash = sha256Hex(body);
  const canonicalHeaders = [
    'content-type:application/x-amz-json-1.0',
    'host:' + canonicalHost,
    'x-amz-date:' + amzDate,
    'x-amz-target:' + target,
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = ['POST', canonicalPath, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');
  const credentialScope = dateStamp + '/ru-central1/dynamodb/aws4_request';
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = getSigningKey(secretKey, dateStamp, 'ru-central1', 'dynamodb');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = 'AWS4-HMAC-SHA256 Credential=' + keyId + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.0',
      'x-amz-date': amzDate,
      'x-amz-target': target,
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

async function scanTable(tableName) {
  const res = await callDocApi('DynamoDB_20120810.Scan', { TableName: tableName });
  if (res.status !== 200) {
    console.warn(`Scan ${tableName} returned status ${res.status}:`, res.data || res.text);
    return [];
  }
  return res.data?.Items || [];
}

async function run() {
  console.log('\n--- 1. Scanning users table ---');
  const userItems = await scanTable('users');
  console.log(`Found ${userItems.length} users in staging.`);
  for (const u of userItems) {
    const id = u.id?.S || '';
    const email = u.email?.S || '';
    const name = u.name?.S || '';
    const role = u.role?.S || '';
    console.log(`  User: id=${id}, email=${email}, name=${name}, role=${role}`);

    const isTest =
      name.includes('Куратор Тестовый') ||
      name.includes('Инвестор Тест') ||
      email.includes('test.buyer') ||
      email.includes('curator.') ||
      id.startsWith('usr-curator-') ||
      id.startsWith('usr-test-');

    if (isTest) {
      console.log(`    -> PURGING TEST USER: id=${id}`);
      await callDocApi('DynamoDB_20120810.DeleteItem', {
        TableName: 'users',
        Key: { id: { S: id } },
      });
    } else if (id === 'usr-staff-002' && name.includes('Алексей Смирнов')) {
      console.log(`    -> Updating ${id} name to 'Куратор DomExit'`);
      u.name = { S: 'Куратор DomExit' };
      if (u.telegram) u.telegram = { S: '@domexit_official' };
      if (u.phone) u.phone = { S: '+7 (812) 409-00-00' };
      await callDocApi('DynamoDB_20120810.PutItem', {
        TableName: 'users',
        Item: u,
      });
    }
  }

  console.log('\n--- 2. Scanning buy_boxes table ---');
  const bbItems = await scanTable('buy_boxes');
  console.log(`Found ${bbItems.length} buy_boxes in staging.`);
  for (const bb of bbItems) {
    const id = bb.id?.S || '';
    const email = bb.userEmail?.S || '';
    const name = bb.userName?.S || '';
    console.log(`  BuyBox: id=${id}, userEmail=${email}, userName=${name}`);
    const isTest =
      email.includes('test.buyer') ||
      name.includes('Инвестор Тест') ||
      id.includes('test');
    if (isTest) {
      console.log(`    -> PURGING TEST BUY_BOX: id=${id}`);
      await callDocApi('DynamoDB_20120810.DeleteItem', {
        TableName: 'buy_boxes',
        Key: { id: { S: id } },
      });
    }
  }

  console.log('\n--- 3. Scanning tier_verification_requests table ---');
  const tierReqs = await scanTable('tier_verification_requests');
  console.log(`Found ${tierReqs.length} tier requests in staging.`);
  for (const tr of tierReqs) {
    const id = tr.id?.S || '';
    const email = tr.userEmail?.S || '';
    console.log(`  TierReq: id=${id}, userEmail=${email}`);
    const isTest = email.includes('test.buyer');
    if (isTest) {
      console.log(`    -> PURGING TEST TIER REQ: id=${id}`);
      await callDocApi('DynamoDB_20120810.DeleteItem', {
        TableName: 'tier_verification_requests',
        Key: { id: { S: id } },
      });
    }
  }

  console.log('\n--- 4. Scanning lots table ---');
  const lotItems = await scanTable('lots');
  console.log(`Found ${lotItems.length} lots in staging.`);
  for (const l of lotItems) {
    const code = l.lotCode?.S || l.id?.S || '';
    const complex = l.complexName?.S || '';
    console.log(`  Lot: code=${code}, complex=${complex}`);
  }

  console.log('\n--- 4.1 Scanning employees table ---');
  const empItems = await scanTable('employees');
  console.log(`Found ${empItems.length} employees in staging.`);
  for (const emp of empItems) {
    const id = emp.id?.S || '';
    const name = emp.name?.S || '';
    console.log(`  Employee: id=${id}, name=${name}`);
    if (name.includes('Алексей Смирнов')) {
      console.log(`    -> Updating employee ${id} to 'Куратор DomExit'`);
      emp.name = { S: 'Куратор DomExit' };
      if (emp.photoUrl) emp.photoUrl = { S: '' };
      if (emp.phone) emp.phone = { S: '+7 (812) 409-00-00' };
      if (emp.telegram) emp.telegram = { S: '@domexit_official' };
      if (emp.whatsapp) emp.whatsapp = { S: '+7 (812) 409-00-00' };
      if (emp.maxProfile) emp.maxProfile = { S: '+7 (812) 409-00-00' };
      await callDocApi('DynamoDB_20120810.PutItem', {
        TableName: 'employees',
        Item: emp,
      });
    }
  }

  console.log('\n--- 5. Scanning legal_documents & developers ---');
  const legDocs = await scanTable('legal_documents');
  console.log(`Preserved legal documents count: ${legDocs.length}`);
  const devDocs = await scanTable('developers');
  console.log(`Preserved developers count: ${devDocs.length}`);

  console.log('\nClean-slate completed successfully!');
}

run().catch((e) => {
  console.error('Clean-slate failed:', e);
  process.exit(1);
});
