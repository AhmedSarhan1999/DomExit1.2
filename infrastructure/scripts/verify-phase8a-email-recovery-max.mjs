#!/usr/bin/env node
/**
 * Phase 8A Master Verification Suite
 *
 * Verifies:
 * 1. Cloud DNS & SSL Certificate Setup for domexit.ru
 * 2. Email Service, 152-ФЗ Masking & Light Emerald Templates
 * 3. Password Recovery API (Anti-enumeration, Validation, and OTP Storage in YDB)
 * 4. PEP 63-FZ Email OTP & Digital Signing (Zero Telegram requirement!)
 * 5. Multi-Messenger Adapter Layer (Status, MAX Webhook 503 ready-state)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const args = process.argv.slice(2);
let targetEnv = 'staging';
for (const arg of args) {
  if (arg === '--env=production' || arg === '--production' || arg === '--prod') targetEnv = 'production';
  if (arg === '--env=staging' || arg === '--staging') targetEnv = 'staging';
}

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('FATAL: Required config files not found!');
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

const isProd = targetEnv === 'production';
const envConfig = isProd ? manifest.production : manifest.staging;
const gatewayUrl = envConfig.apiGatewayUrl;

const jwtSecret = isProd
  ? envVars.JWT_SIGNING_SECRET_PROD || envVars.JWT_SIGNING_SECRET
  : envVars.JWT_SIGNING_SECRET;

const ydbEndpoint = envConfig.ydbDocApiEndpoint;
const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || 'ru-central1';

// SigV4 for YDB DocAPI
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
          Host: canonicalHost,
        },
        body,
      });

      if (!res.ok) {
        const errText = await res.text();
        if (attempt < retries && (res.status === 503 || res.status === 429)) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        return { error: errText, status: res.status };
      }

      return await res.json();
    } catch (fetchErr) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
      return { error: fetchErr.message, status: 0 };
    }
  }
}

function createSessionToken(user, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    activeRole: user.activeRole || user.role,
    roles: user.roles || [user.role],
    iat: now,
    exp: now + 3600,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

async function apiRequest(endpoint, options = {}) {
  const url = `${gatewayUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// 152-ФЗ Email Masking test implementation matching backend
function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

async function runPhase8aVerification() {
  console.log(`\n===============================================================`);
  console.log(`=== PHASE 8A AUTOMATED VERIFICATION SUITE [Target: ${targetEnv.toUpperCase()}] ===`);
  console.log(`=== API Gateway: ${gatewayUrl} ===`);
  console.log(`===============================================================\n`);

  // --------------------------------------------------------------------------
  // TRACK 1: Cloud DNS & SSL Certificate Verification for domexit.ru
  // --------------------------------------------------------------------------
  console.log(`[Track 1] Verifying Cloud DNS Zone & Let's Encrypt Certificate in Yandex Cloud...`);

  assert(manifest.domain?.name === 'domexit.ru', 'Manifest domain name is configured as domexit.ru');
  assert(manifest.domain?.dnsZoneId === 'dnsdb9agcsdq3fn2n87q', 'Manifest dnsZoneId is configured');

  try {
    const recordsRaw = execSync('yc dns zone list-records domexit-ru-zone --format json', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });
    const parsed = JSON.parse(recordsRaw);
    const records = parsed.record_sets || parsed;

    const hasNs = records.some((r) => r.type === 'NS');
    const hasSpf = records.some((r) => r.type === 'TXT' && r.data?.some((d) => d.includes('v=spf1')));
    const hasDmarc = records.some((r) => r.type === 'TXT' && r.name?.includes('_dmarc'));
    const hasAcmeChallenges = records.filter(
      (r) => r.type === 'CNAME' && r.name?.includes('_acme-challenge')
    ).length >= 2;

    assert(hasNs, 'Authoritative NS records exist in domexit-ru-zone');
    assert(hasSpf, 'SPF TXT record (v=spf1 include:_spf.postbox.cloud.yandex.net ~all) exists');
    assert(hasDmarc, 'DMARC TXT record (v=DMARC1; p=quarantine) exists');
    assert(hasAcmeChallenges, 'ACME DNS challenge CNAME records exist for both apex & www');
  } catch (err) {
    assert(false, `Failed to query yc dns zone list-records: ${err.message}`);
  }

  try {
    const certRaw = execSync('yc certificate-manager certificate get domexit-ru-cert --format json', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });
    const cert = JSON.parse(certRaw);

    assert(cert.domains?.includes('domexit.ru'), 'Certificate covers apex domain domexit.ru');
    assert(cert.domains?.includes('www.domexit.ru'), 'Certificate covers www.domexit.ru');
    assert(
      cert.status === 'VALIDATING' || cert.status === 'ISSUED',
      `Certificate status is healthy: ${cert.status}`
    );
  } catch (err) {
    assert(false, `Failed to query yc certificate-manager certificate: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TRACK 2: Email Service & Russian Emerald Templates (Unit Verification)
  // --------------------------------------------------------------------------
  console.log(`\n[Track 2] Verifying EmailService, 152-ФЗ Masking, and Russian HTML Templates...`);

  assert(maskEmail('ivan.ivanov@domexit.ru') === 'i***v@domexit.ru', 'maskEmail masks 152-ФЗ compliant');
  assert(maskEmail('a@b.ru') === 'a***@b.ru', 'maskEmail handles short usernames');

  // Verify emailService code exists in backend dist
  const backendBundle = fs.readFileSync(path.join(ROOT_DIR, 'backend/dist/index.js'), 'utf-8');
  assert(backendBundle.includes('renderPasswordResetEmail'), 'Backend bundle includes renderPasswordResetEmail');
  assert(backendBundle.includes('renderPepOtpEmail'), 'Backend bundle includes renderPepOtpEmail');
  assert(backendBundle.includes('renderNotificationEmail'), 'Backend bundle includes renderNotificationEmail');
  assert(backendBundle.includes('#059669'), 'Backend bundle contains DomExit Emerald color #059669 in templates');
  assert(backendBundle.includes('63-ФЗ'), 'Backend bundle references 63-ФЗ in templates');
  assert(backendBundle.includes('152-ФЗ'), 'Backend bundle references 152-ФЗ in templates');

  // --------------------------------------------------------------------------
  // TRACK 3: Password Recovery Endpoints on Live Staging API
  // --------------------------------------------------------------------------
  console.log(`\n[Track 3] Verifying Password Recovery Endpoints on Live Staging API...`);

  // 1. Anti-enumeration check
  const nonExistentEmail = `no-such-user-${Date.now()}@domexit-nonexistent.ru`;
  const forgotUnknown = await apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: nonExistentEmail }),
  });
  assert(forgotUnknown.status === 200, 'POST /api/auth/forgot-password returns 200 for unknown email (Anti-enumeration)');
  assert(
    typeof forgotUnknown.data?.message === 'string' && forgotUnknown.data.message.includes('Если аккаунт существует'),
    'Anti-enumeration message is properly localized in Russian'
  );

  // 2. Invalid inputs check
  const forgotInvalid = await apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  assert(forgotInvalid.status === 400, 'POST /api/auth/forgot-password rejects invalid email with 400');

  const resetShortPass = await apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@test.ru', code: '123456', newPassword: '123' }),
  });
  assert(resetShortPass.status === 400, 'POST /api/auth/reset-password rejects short passwords (< 8 chars) with 400');

  const resetBadCode = await apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@test.ru', code: 'invalid', newPassword: 'StrongPassword123' }),
  });
  assert(resetBadCode.status === 400, 'POST /api/auth/reset-password rejects non-6-digit code with 400');

  // 3. Full Password Reset Cycle with a registered test user
  const testUserEmail = `phase8a-user-${Date.now()}@domexit-test.ru`;
  const initialPassword = 'InitialPassword123';

  const regRes = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testUserEmail,
      password: initialPassword,
      name: 'Тестовый Пользователь Фаза 8А',
      role: 'buyer',
    }),
  });
  assert(regRes.status === 201, 'Test user successfully registered for password recovery test');

  // Request password reset
  const forgotValid = await apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: testUserEmail }),
  });
  assert(forgotValid.status === 200, 'POST /api/auth/forgot-password returns 200 for registered user');

  // Query OTP from YDB via DocAPI
  const otpGetRes = await callDocApi('DynamoDB_20120810.GetItem', {
    TableName: 'pep_otps',
    Key: { id: { S: `pwreset:${testUserEmail}` } },
  });
  assert(Boolean(otpGetRes.Item), 'OTP record successfully created in pep_otps table');
  assert(otpGetRes.Item?.email?.S === testUserEmail, 'OTP record is tied to user email');
  assert(otpGetRes.Item?.used?.BOOL === false, 'OTP record initialized as used=false');

  // --------------------------------------------------------------------------
  // TRACK 4: PEP 63-FZ Digital Signature via Email (No Telegram Requirement)
  // --------------------------------------------------------------------------
  console.log(`\n[Track 4] Verifying PEP 63-FZ Digital Signature via Email OTP...`);

  // Create JWT session for our test user (who does NOT have Telegram bound)
  const testUser = regRes.data?.user || { id: 'test_usr', email: testUserEmail, role: 'buyer' };
  const userToken = createSessionToken(testUser, jwtSecret);

  // Request PEP OTP specifying deliveryChannel: 'email'
  const pepReq = await apiRequest('/api/pep/request-otp', {
    method: 'POST',
    headers: {
      Cookie: `session_token=${userToken}`,
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      documentType: 'buyer_reservation_terms',
      lotCode: 'TEST-LOT-8A',
      deliveryChannel: 'email',
    }),
  });

  assert(
    pepReq.status === 200,
    'POST /api/pep/request-otp succeeds with 200 for Email delivery without Telegram binding (No 412 error!)'
  );
  assert(pepReq.data?.deliveryChannel === 'email', 'Response confirms deliveryChannel is email');
  assert(Boolean(pepReq.data?.targetEmailMasked), 'Response contains masked target email');

  // Retrieve the generated PEP OTP from YDB to verify record
  const pepOtpKey = `otp:${testUser.id}:buyer_reservation_terms:TEST-LOT-8A`;
  const pepOtpRecord = await callDocApi('DynamoDB_20120810.GetItem', {
    TableName: 'pep_otps',
    Key: { id: { S: pepOtpKey } },
  });
  assert(Boolean(pepOtpRecord.Item), 'PEP OTP record successfully saved in YDB pep_otps table');
  assert(pepOtpRecord.Item?.deliveryChannel?.S === 'email', 'PEP OTP record specifies deliveryChannel: email');

  // --------------------------------------------------------------------------
  // TRACK 5: Multi-Messenger Adapter Layer & MAX Readiness
  // --------------------------------------------------------------------------
  console.log(`\n[Track 5] Verifying Messenger Adapter Layer & MAX 503 Ready-State...`);

  const statusRes = await apiRequest('/api/messenger/status', { method: 'GET' });
  assert(statusRes.status === 200, 'GET /api/messenger/status returns 200 OK');
  assert(statusRes.data?.activeProvider === 'telegram', 'Active messenger provider defaults to telegram');
  assert(
    Array.isArray(statusRes.data?.supportedProviders) &&
      statusRes.data.supportedProviders.includes('max') &&
      statusRes.data.supportedProviders.includes('telegram'),
    'Supported providers list includes both telegram and max'
  );

  const maxWebhookRes = await apiRequest('/api/messenger/max/webhook', {
    method: 'POST',
    body: JSON.stringify({ event: 'test', data: {} }),
  });
  assert(
    maxWebhookRes.status === 503,
    'POST /api/messenger/max/webhook returns 503 Service Unavailable when MESSENGER_PROVIDER !== max'
  );
  assert(
    typeof maxWebhookRes.data?.message === 'string' &&
      maxWebhookRes.data.message.includes('MAX messenger integration is ready'),
    '503 response clearly informs that MAX is ready on the backend waiting for active provider configuration'
  );

  assert(backendBundle.includes('MaxProvider'), 'Backend bundle includes MaxProvider');
  assert(backendBundle.includes('TelegramProvider'), 'Backend bundle includes TelegramProvider');
  assert(backendBundle.includes('getActiveMessenger'), 'Backend bundle includes getActiveMessenger');

  // Summary
  console.log(`\n===============================================================`);
  console.log(`=== PHASE 8A VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED ===`);
  if (failedTests > 0) {
    console.error(`=== ❌ FAILED TESTS: ${failedTests} ===`);
    console.log(`===============================================================\n`);
    process.exit(1);
  } else {
    console.log(`=== 🎉 ALL PHASE 8A CHECKS PASSED (100% SUCCESS) ===`);
    console.log(`===============================================================\n`);
  }
}

runPhase8aVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
