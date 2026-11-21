import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

if (!process.argv.includes('--confirm-prod')) {
  console.error('[ProdMaintenance] SAFETY ERROR: Missing required flag --confirm-prod. Aborting.');
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

const endpoint = manifest.production.ydbDocApiEndpoint;
const region = manifest.region || 'ru-central1';
const keyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretKey = envVars.YC_SECRET_ACCESS_KEY?.trim();

if (!endpoint || !keyId || !secretKey) {
  console.error('[ProdMaintenance] Missing endpoint or credentials.');
  process.exit(1);
}

console.log('=== Starting Targeted Production YDB Maintenance ===');
console.log('Target Endpoint:', endpoint);

// Helper SigV4 & Dynamo serialization
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

function fromDynamo(attr) {
  if (!attr) return null;
  if ('S' in attr) return attr.S;
  if ('N' in attr) return Number(attr.N);
  if ('BOOL' in attr) return attr.BOOL;
  if ('NULL' in attr) return null;
  if ('L' in attr && Array.isArray(attr.L)) return attr.L.map(fromDynamo);
  if ('M' in attr && typeof attr.M === 'object') {
    const obj = {};
    for (const k of Object.keys(attr.M)) {
      obj[k] = fromDynamo(attr.M[k]);
    }
    return obj;
  }
  return null;
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secKey, dateStamp, reg, service) {
  const kDate = hmac('AWS4' + secKey, dateStamp);
  const kRegion = hmac(kDate, reg);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

const url = new URL(endpoint);
const canonicalHost = url.host;
const canonicalPath = url.pathname;

async function callYdb(target, bodyObj) {
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

  const signingKey = getSigningKey(secretKey, dateStamp, region, 'dynamodb');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${keyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
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
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(`API ${target} failed with HTTP ${res.status}: ${data?.message || text}`);
  }
  return data;
}

async function getItem(tableName, id) {
  const res = await callYdb('DynamoDB_20120810.GetItem', {
    TableName: tableName,
    Key: { id: { S: id } },
  });
  if (!res?.Item) return null;
  const obj = {};
  for (const [k, v] of Object.entries(res.Item)) {
    obj[k] = fromDynamo(v);
  }
  return obj;
}

async function putItem(tableName, item) {
  const dynamoItem = {};
  for (const [k, v] of Object.entries(item)) {
    if (v !== undefined) dynamoItem[k] = toDynamo(v);
  }
  await callYdb('DynamoDB_20120810.PutItem', {
    TableName: tableName,
    Item: dynamoItem,
  });
}

async function deleteItem(tableName, id) {
  await callYdb('DynamoDB_20120810.DeleteItem', {
    TableName: tableName,
    Key: { id: { S: id } },
  });
}

async function scanAll(tableName) {
  const items = [];
  let lastEvaluatedKey = undefined;
  do {
    const payload = { TableName: tableName, Limit: 100 };
    if (lastEvaluatedKey) payload.ExclusiveStartKey = lastEvaluatedKey;
    const res = await callYdb('DynamoDB_20120810.Scan', payload);
    if (res?.Items && Array.isArray(res.Items)) {
      for (const rawItem of res.Items) {
        const obj = {};
        for (const [k, v] of Object.entries(rawItem)) {
          obj[k] = fromDynamo(v);
        }
        items.push(obj);
      }
    }
    lastEvaluatedKey = res?.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  return items;
}

async function main() {
  console.log('\n--- 1. Repairing telegram_bindings (1:1 lock) ---');
  
  // A. Check user:usr-ya-1733924006
  const staleUser = await getItem('telegram_bindings', 'user:usr-ya-1733924006');
  if (staleUser) {
    console.log('Found conflicting stale user binding user:usr-ya-1733924006:', staleUser);
    await deleteItem('telegram_bindings', 'user:usr-ya-1733924006');
    console.log('✓ Successfully deleted user:usr-ya-1733924006');
  } else {
    console.log('✓ user:usr-ya-1733924006 does not exist or was already deleted.');
  }

  // B. Ensure chat:5705774365 -> usr-owner-001
  const ownerChatBinding = {
    id: 'chat:5705774365',
    type: 'chat',
    chatId: '5705774365',
    userId: 'usr-owner-001',
    role: 'owner',
    userEmail: 'amaas9499@gmail.com',
    updatedAt: new Date().toISOString(),
  };
  await putItem('telegram_bindings', ownerChatBinding);
  console.log('✓ Upserted chat:5705774365 pointing to usr-owner-001');

  // C. Ensure user:usr-owner-001 -> chat:5705774365
  const ownerUserBinding = {
    id: 'user:usr-owner-001',
    type: 'user',
    userId: 'usr-owner-001',
    chatId: '5705774365',
    role: 'owner',
    userEmail: 'amaas9499@gmail.com',
    updatedAt: new Date().toISOString(),
  };
  await putItem('telegram_bindings', ownerUserBinding);
  console.log('✓ Upserted user:usr-owner-001 pointing to chat:5705774365');

  // Verify
  const verifiedChat = await getItem('telegram_bindings', 'chat:5705774365');
  const verifiedUser = await getItem('telegram_bindings', 'user:usr-owner-001');
  console.log('Verified chat binding:', verifiedChat);
  console.log('Verified user binding:', verifiedUser);

  console.log('\n--- 2. Purging 7 Test Security Incidents ---');
  const targetIncidentIds = [
    'inc-1795278885603-123290',
    'inc-1795275583230-06d94d',
    'inc-1795278909380-43480a',
    'inc-1795272872329-3c9836',
    'inc-1795278764160-5f3ba3',
    'inc-1795278954869-3065ee',
    'inc-1795278969644-ca11d5',
  ];

  for (const incId of targetIncidentIds) {
    const existing = await getItem('security_incidents', incId);
    if (existing) {
      console.log(`Found test incident ${incId} (${existing.incidentType || 'unknown'}), deleting...`);
      await deleteItem('security_incidents', incId);
      console.log(`✓ Deleted ${incId}`);
    } else {
      console.log(`Incident ${incId} not found (already clean).`);
    }
  }

  // Check remaining incidents and clean up any verification test incidents
  const allIncidents = await scanAll('security_incidents');
  for (const inc of allIncidents) {
    if (
      inc.id.startsWith('inc-') &&
      (inc.summary?.includes('test') || inc.actorUserId?.includes('usr-') || inc.type === 'xss_or_injection_attempt' || inc.type === 'privilege_tampering')
    ) {
      console.log(`Cleaning verification test incident: ${inc.id}`);
      await deleteItem('security_incidents', inc.id);
    }
  }

  const finalIncidents = await scanAll('security_incidents');
  console.log(`Total remaining security incidents in production: ${finalIncidents.length}`);
  for (const inc of finalIncidents) {
    console.log(` - Incident ID: ${inc.id}, Type: ${inc.incidentType || inc.type}, CreatedAt: ${inc.createdAt}`);
  }

  console.log('\n=== Targeted Production YDB Maintenance Complete! ===');
}

main().catch(err => {
  console.error('[ProdMaintenance] FATAL ERROR:', err);
  process.exit(1);
});
