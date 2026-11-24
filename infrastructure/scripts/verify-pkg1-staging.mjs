import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const STAGING_URL = manifest.staging.apiGatewayUrl;

const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const ownerEmail = (envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();
const ownerPassword = envVars.BOOTSTRAP_OWNER_PASSWORD?.trim();
const jwtSecret = (envVars.JWT_SIGNING_SECRET_STAGING || envVars.JWT_SIGNING_SECRET || envVars.JWT_SECRET)?.trim();

const ydbEndpoint = manifest.staging.ydbDocApiEndpoint || envVars.YDB_DOCAPI_ENDPOINT_STAGING || envVars.YDB_DOCAPI_ENDPOINT;
const accessKeyId = envVars.YC_ACCESS_KEY_ID || envVars.AWS_ACCESS_KEY_ID;
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY || envVars.AWS_SECRET_ACCESS_KEY;

function base64UrlEncode(strOrBuf) {
  const buf = typeof strOrBuf === 'string' ? Buffer.from(strOrBuf, 'utf-8') : strOrBuf;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createSignedJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 86400,
  };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  const encSig = base64UrlEncode(sig);
  return `${data}.${encSig}`;
}

// AWS SigV4 for direct YDB DocAPI operations
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

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function ydbDocApiRequest(action, payload) {
  if (!ydbEndpoint || !accessKeyId || !secretAccessKey) return null;
  const url = new URL(ydbEndpoint);
  const host = url.host;
  const path = url.pathname || '/';
  const region = 'ru-central1';
  const service = 'dynamodb';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const body = JSON.stringify(payload);
  const target = `DynamoDB_20120810.${action}`;
  const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const payloadHash = sha256Hex(body);
  const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${region}/${service}/aws4_request\n${sha256Hex(canonicalRequest)}`;
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;

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
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YDB DocAPI error ${res.status}: ${errText}`);
  }
  return res.json();
}

console.log('================================================================');
console.log('=== Executive Package 1 Verification Suite (Staging Only) ===');
console.log('Target Gateway:', STAGING_URL);
console.log('================================================================\n');

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

async function run() {
  // 1. Health check
  console.log('[1/8] Checking API Health...');
  const healthRes = await fetch(`${STAGING_URL}/api/health`);
  assert(healthRes.status === 200, 'GET /api/health returns 200 OK');

  // 2. Platform Owner authentication
  console.log('\n[2/8] Establishing Platform Owner Session...');
  let ownerHeaders;
  let loginRes = await fetch(`${STAGING_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });

  if (loginRes.status === 200) {
    const ownerCookie = loginRes.headers.get('set-cookie') || '';
    ownerHeaders = {
      'Content-Type': 'application/json',
      Cookie: ownerCookie,
    };
    console.log('  ✓ Owner session established via password login.');
  } else if (jwtSecret) {
    const ownerPayload = {
      userId: 'usr-owner-001',
      email: ownerEmail,
      role: 'owner',
      activeRole: 'owner',
      roles: ['owner', 'employee', 'partner', 'seller', 'buyer'],
      tv: 1,
    };
    const ownerToken = createSignedJwt(ownerPayload, jwtSecret);
    ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
      Cookie: `domexit_session=${ownerToken}`,
    };
    console.log('  ✓ Owner session established via signed cryptographic token.');
  } else {
    throw new Error('Failed to authenticate owner and no JWT secret available');
  }

  // 3. Lot Details: Guest verification
  console.log('\n[3/8] Testing Lot Details endpoint as GUEST (Unauthenticated)...');
  const guestLotRes = await fetch(`${STAGING_URL}/api/data/lots/U-81331`);
  assert(guestLotRes.status === 200, 'GET /api/data/lots/U-81331 returns 200 OK for guest');
  const guestLotData = await guestLotRes.json();
  assert(Boolean(guestLotData.item), 'Guest response contains lot item');
  assert(guestLotData.item.status === 'available', 'Guest sees lot as available');
  assert(guestLotData.item.sellerPhone === undefined, '152-FZ Barrier: sellerPhone is stripped for guest');
  assert(guestLotData.item.sellerEmail === undefined, '152-FZ Barrier: sellerEmail is stripped for guest');
  assert(guestLotData.item.sellerInn === undefined, '152-FZ Barrier: sellerInn is stripped for guest');
  assert(guestLotData.item.apartmentNumber === undefined, '152-FZ Barrier: apartmentNumber is stripped for guest');
  assert(Boolean(guestLotData.item.complexName), 'Guest sees complexName: ' + guestLotData.item.complexName);
  assert(Number(guestLotData.item.dduContractPrice) > 0, 'Guest sees dduContractPrice: ' + guestLotData.item.dduContractPrice);

  // 4. Lot Details: Regular Client (buyer) verification
  console.log('\n[4/8] Testing Lot Details endpoint as REGULAR CLIENT (buyer)...');
  const buyerPayload = {
    userId: 'usr-buyer-test-client',
    email: 'client.buyer.test@domexit.ru',
    role: 'buyer',
    activeRole: 'buyer',
    roles: ['buyer', 'seller'],
    tv: 1,
  };
  const buyerToken = createSignedJwt(buyerPayload, jwtSecret);
  const buyerHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${buyerToken}`,
    Cookie: `domexit_session=${buyerToken}`,
  };

  const buyerLotRes = await fetch(`${STAGING_URL}/api/data/lots/U-81331`, { headers: buyerHeaders });
  assert(buyerLotRes.status === 200, 'GET /api/data/lots/U-81331 returns 200 OK for client');
  const buyerLotData = await buyerLotRes.json();
  assert(buyerLotData.item.sellerPhone === undefined, '152-FZ Barrier: sellerPhone is stripped for client');
  assert(buyerLotData.item.sellerEmail === undefined, '152-FZ Barrier: sellerEmail is stripped for client');
  assert(buyerLotData.item.sellerInn === undefined, '152-FZ Barrier: sellerInn is stripped for client');

  // 5. Lot Details: Nonexistent Lot check
  console.log('\n[5/8] Testing Lot Details endpoint for Non-existent Lot...');
  const notFoundRes = await fetch(`${STAGING_URL}/api/data/lots/NONEXISTENT-LOT-999XYZ`);
  assert(notFoundRes.status === 404, 'GET /api/data/lots/NONEXISTENT-LOT-999XYZ returns 404 Not Found');

  // 6. Unified Auth: Test user without password (OAuth-only account)
  console.log('\n[6/8] Testing Unified Auth: OAuth-only account login restriction...');
  const testOAuthUserId = `usr-test-oauth-${Date.now().toString().slice(-6)}`;
  const testOAuthEmail = `test.oauth.${Date.now()}@yandex.ru`;

  // Seed test user into YDB without password
  await ydbDocApiRequest('PutItem', {
    TableName: 'users',
    Item: {
      id: { S: testOAuthUserId },
      email: { S: testOAuthEmail },
      name: { S: 'Yandex Test User' },
      role: { S: 'buyer' },
      activeRole: { S: 'buyer' },
      roles: { L: [{ S: 'buyer' }, { S: 'seller' }] },
      authProvider: { S: 'yandex' },
      authProviders: { L: [{ S: 'yandex' }] },
      phone: { S: '+7 (999) 123-45-67' },
      phoneNormalized: { S: '+79991234567' },
      tokenVersion: { N: '1' },
      registeredAt: { S: new Date().toISOString() },
    },
  });
  console.log('  ✓ Created temporary OAuth-only test user in Staging YDB.');

  // Try to login with password before setting password
  const oauthLoginRes = await fetch(`${STAGING_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testOAuthEmail, password: 'ArbitraryPassword123' }),
  });
  const oauthStatus = oauthLoginRes.status;
  const oauthBodyText = await oauthLoginRes.text();
  console.log('oauthLoginRes status:', oauthStatus, 'body:', oauthBodyText);
  let oauthLoginData;
  try { oauthLoginData = JSON.parse(oauthBodyText); } catch {}
  assert(oauthStatus === 400, 'POST /api/auth/login for OAuth-only account returns 400 Bad Request');
  assert(oauthLoginData?.code === 'oauth_only_account', 'Response code is oauth_only_account');
  assert(oauthLoginData?.error?.includes('Яндекс ID'), 'Error explains that account is configured via Yandex ID');

  // 7. Unified Auth: set-password and session invalidation via tokenVersion
  console.log('\n[7/8] Testing POST /api/auth/set-password & tokenVersion session invalidation...');
  // Initial token with tv = 1
  const initialOAuthToken = createSignedJwt(
    {
      userId: testOAuthUserId,
      email: testOAuthEmail,
      role: 'buyer',
      activeRole: 'buyer',
      roles: ['buyer', 'seller'],
      tv: 1,
    },
    jwtSecret
  );

  // Validate set-password input: short password (< 8 chars)
  const shortPassRes = await fetch(`${STAGING_URL}/api/auth/set-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${initialOAuthToken}`,
    },
    body: JSON.stringify({ newPassword: '123', confirmPassword: '123' }),
  });
  assert(shortPassRes.status === 400, 'POST /api/auth/set-password rejects short password with 400');

  // Validate set-password input: mismatched passwords
  const mismatchRes = await fetch(`${STAGING_URL}/api/auth/set-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${initialOAuthToken}`,
    },
    body: JSON.stringify({ newPassword: 'GoodPassword123', confirmPassword: 'DifferentPassword123' }),
  });
  assert(mismatchRes.status === 400, 'POST /api/auth/set-password rejects mismatched passwords with 400');

  // Valid set-password call
  const validPass = 'SecurePass9876!';
  const setPassRes = await fetch(`${STAGING_URL}/api/auth/set-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${initialOAuthToken}`,
    },
    body: JSON.stringify({ newPassword: validPass, confirmPassword: validPass }),
  });
  assert(setPassRes.status === 200, 'POST /api/auth/set-password succeeds with 200 OK');
  const setPassData = await setPassRes.json();
  assert(setPassData.user.hasPassword === true, 'User profile now reflects hasPassword: true');
  assert(setPassData.user.tokenVersion === 2, 'User tokenVersion incremented to 2');
  assert(setPassData.user.authProviders.includes('password'), 'authProviders includes password');
  assert(setPassData.user.authProviders.includes('yandex'), 'authProviders preserves yandex');

  const setPassCookie = setPassRes.headers.get('set-cookie') || '';
  assert(setPassCookie.includes('domexit_session='), 'New session cookie issued on set-password');

  // Critical verification: Old session token (tv: 1) MUST now be rejected with 401 Unauthorized
  const oldSessionCheck = await fetch(`${STAGING_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${initialOAuthToken}`,
      Cookie: `domexit_session=${initialOAuthToken}`,
    },
  });
  assert(oldSessionCheck.status === 401, 'CRITICAL: Old token with tv=1 is REJECTED with 401 Unauthorized (tokenVersion session invalidation)!');

  // New session check via set-password cookie
  const newSessionCheck = await fetch(`${STAGING_URL}/api/auth/me`, {
    headers: {
      Cookie: setPassCookie,
    },
  });
  assert(newSessionCheck.status === 200, 'New session cookie with tv=2 is ACCEPTED with 200 OK');
  const newMeData = await newSessionCheck.json();
  assert(newMeData.user.hasPassword === true, '/api/auth/me confirms hasPassword: true');
  assert(newMeData.user.tokenVersion === 2, '/api/auth/me confirms tokenVersion: 2');

  // 8. Test login with newly created password and change-password flow
  console.log('\n[8/8] Testing Login with new password and POST /api/auth/change-password...');
  const newLoginRes = await fetch(`${STAGING_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testOAuthEmail, password: validPass }),
  });
  assert(newLoginRes.status === 200, 'POST /api/auth/login with newly set password SUCCEEDS with 200 OK');
  const loginCookie = newLoginRes.headers.get('set-cookie') || '';

  // Change password: bad current password
  const badCurrentPassRes = await fetch(`${STAGING_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: loginCookie,
    },
    body: JSON.stringify({
      currentPassword: 'WrongPassword123',
      newPassword: 'BrandNewPassword123',
      confirmPassword: 'BrandNewPassword123',
    }),
  });
  assert(badCurrentPassRes.status === 400, 'POST /api/auth/change-password rejects wrong current password with 400');

  // Change password: correct current password
  const nextPass = 'BrandNewPassword123!';
  const changePassRes = await fetch(`${STAGING_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: loginCookie,
    },
    body: JSON.stringify({
      currentPassword: validPass,
      newPassword: nextPass,
      confirmPassword: nextPass,
    }),
  });
  assert(changePassRes.status === 200, 'POST /api/auth/change-password succeeds with 200 OK');
  const changePassData = await changePassRes.json();
  assert(changePassData.user.tokenVersion === 3, 'User tokenVersion incremented to 3');

  // Dismiss password setup
  const dismissRes = await fetch(`${STAGING_URL}/api/auth/dismiss-password-setup`, {
    method: 'POST',
    headers: {
      Cookie: changePassRes.headers.get('set-cookie') || loginCookie,
    },
  });
  assert(dismissRes.status === 200, 'POST /api/auth/dismiss-password-setup returns 200 OK');

  // Clean up test user from Staging YDB
  await ydbDocApiRequest('DeleteItem', {
    TableName: 'users',
    Key: {
      id: { S: testOAuthUserId },
    },
  });
  console.log('  ✓ Cleaned up temporary test user from Staging YDB.');

  console.log('\n================================================================');
  console.log('🎉 ALL EXECUTIVE PACKAGE 1 VERIFICATIONS PASSED 100% ON STAGING!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
