import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT_DIR, '.env.cloud.local');

if (!fs.existsSync(ENV_FILE)) {
  console.error('[Bootstrap] .env.cloud.local does not exist!');
  process.exit(1);
}

// Read env
const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const ownerEmail = envVars.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
const ownerPassword = envVars.BOOTSTRAP_OWNER_PASSWORD?.trim();
const ydbEndpoint = envVars.STAGING_YDB_DOCAPI_ENDPOINT;
const accessKeyId = envVars.YC_ACCESS_KEY_ID;
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY;
const region = envVars.YC_REGION || 'ru-central1';

if (!ownerEmail || !ownerPassword || !ydbEndpoint || !accessKeyId || !secretAccessKey) {
  console.error('[Bootstrap] Missing mandatory variables in .env.cloud.local!');
  process.exit(1);
}

console.log('--- Bootstrapping Master Owner in domexit-ydb-staging ---');
console.log('Target Email:', ownerEmail);

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

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

async function run() {
  const passwordHash = await hashPassword(ownerPassword);

  // Check if owner already exists
  const scanRes = await callDocApi('DynamoDB_20120810.Scan', {
    TableName: 'users',
    Limit: 100,
  });

  let existingOwnerId = null;
  if (scanRes.data?.Items) {
    for (const item of scanRes.data.Items) {
      if (item.email?.S?.toLowerCase() === ownerEmail) {
        existingOwnerId = item.id.S;
        break;
      }
    }
  }

  const ownerId = existingOwnerId || 'usr-owner-master';
  const now = new Date().toISOString();

  const userItem = {
    id: { S: ownerId },
    email: { S: ownerEmail },
    name: { S: 'Ahmed Abdallah (Master Owner)' },
    role: { S: 'owner' },
    activeRole: { S: 'owner' },
    roles: {
      L: [
        { S: 'owner' },
        { S: 'employee' },
        { S: 'seller' },
        { S: 'buyer' },
        { S: 'bank' },
        { S: 'partner' },
        { S: 'investor' },
      ],
    },
    phone: { S: '+7 (999) 000-00-01' },
    clientCode: { S: 'DEX-OWNER' },
    passwordHash: { S: passwordHash },
    registeredAt: { S: now },
    authProvider: { S: 'local' },
    isPartnerApproved: { BOOL: true },
    isInvestorApproved: { BOOL: true },
    partnerRefCode: { S: 'PARTNER-MASTER-OWNER' },
    favorites: { L: [] },
  };

  const putRes = await callDocApi('DynamoDB_20120810.PutItem', {
    TableName: 'users',
    Item: userItem,
  });

  if (putRes.status === 200) {
    console.log(`✓ Owner account successfully initialized in domexit-ydb-staging! (ID: ${ownerId})`);
  } else {
    console.error('Failed to put owner user in YDB:', putRes);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
