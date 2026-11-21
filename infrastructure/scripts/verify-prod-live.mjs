import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const PROD_URL = manifest.production?.apiGatewayUrl;
const ownerEmail = (envVars.PROD_OWNER_EMAIL || envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();
const ownerPassword = envVars.PROD_OWNER_PASSWORD?.trim();
const employeeEmail = (envVars.PROD_EMPLOYEE_EMAIL || 'amaas9494@gmail.com').trim().toLowerCase();
const employeePassword = envVars.PROD_EMPLOYEE_PASSWORD?.trim();

if (!PROD_URL) {
  console.error('[VerifyProd] Error: production.apiGatewayUrl missing from cloud-manifest.json');
  process.exit(1);
}

console.log('================================================================');
console.log('=== DomExit Production Live Verification Suite (Moscow ru-central1) ===');
console.log('================================================================');
console.log('Production URL: ', PROD_URL);
console.log('Owner Email:    ', ownerEmail);
console.log('Employee Email: ', employeeEmail);
console.log('');

let allPassed = true;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    allPassed = false;
    throw new Error(message);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

async function runTests() {
  // Test 1: Static Web & SPA Routing
  console.log('--- Test Suite 1: Static Web & SPA Routing ---');
  const routes = ['/', '/opportunities', '/sellers', '/admin/dashboard'];
  for (const r of routes) {
    const res = await fetch(`${PROD_URL}${r}`);
    const text = await res.text();
    assert(res.status === 200, `GET ${r} returns status 200`);
    assert(text.includes('id="root"'), `GET ${r} contains <div id="root">`);
    assert(text.includes('DomExit'), `GET ${r} contains title DomExit`);
  }

  // Test 2: Production API Health & Strict Security Headers
  console.log('\n--- Test Suite 2: API Health & Production Security Headers ---');
  const healthRes = await fetch(`${PROD_URL}/api/health`);
  assert(healthRes.status === 200, 'GET /api/health returns 200 OK');
  const healthJson = await healthRes.json();
  assert(healthJson.ok === true, 'Health response has ok: true');
  assert(healthJson.env === 'production', 'Health response has env: "production"');
  assert(healthJson.region === 'ru-central1', 'Health response has region: "ru-central1"');

  const headers = healthRes.headers;
  assert(headers.get('strict-transport-security') !== null, 'Strict-Transport-Security header present');
  assert(headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff present');
  assert(headers.get('x-frame-options') === 'DENY', 'X-Frame-Options: DENY present');
  assert(headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy: strict-origin-when-cross-origin present');

  // Test 3: Unauthorized Access Protection
  console.log('\n--- Test Suite 3: Unauthorized Access Protection ---');
  const unauthRes = await fetch(`${PROD_URL}/api/data/users`);
  assert(unauthRes.status === 401, 'GET /api/data/users without cookie returns 401 Unauthorized');

  // Test 4: Full Authentication Lifecycle
  console.log('\n--- Test Suite 4: Full Authentication Lifecycle ---');
  // 4a. Owner login
  console.log('  Testing Owner Login...');
  const ownerLoginRes = await fetch(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  assert(ownerLoginRes.status === 200, 'Owner login returns 200 OK');
  const ownerLoginData = await ownerLoginRes.json();
  assert(ownerLoginData.success === true, 'Owner login success is true');
  assert(ownerLoginData.user?.role === 'owner', 'Owner user role is owner');

  const setCookie = ownerLoginRes.headers.get('set-cookie');
  assert(setCookie && setCookie.includes('domexit_session'), 'domexit_session cookie set on login');

  // Extract cookie for subsequent calls
  const sessionCookie = setCookie.split(';')[0];

  // 4b. GET /api/auth/me
  const meRes = await fetch(`${PROD_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  assert(meRes.status === 200, 'GET /api/auth/me with session returns 200 OK');
  const meData = await meRes.json();
  assert(meData.user?.email === ownerEmail, `Authenticated user email matches ${ownerEmail}`);
  assert(meData.user?.role === 'owner', 'Authenticated user role is owner');
  assert(Array.isArray(meData.user?.roles) && meData.user.roles.includes('owner'), 'User roles contains owner');

  // 4c. Switch Role
  console.log('  Testing Role Switching...');
  const switchRes = await fetch(`${PROD_URL}/api/auth/switch-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ targetRole: 'employee' }),
  });
  assert(switchRes.status === 200, 'Switch role to employee returns 200 OK');
  const switchData = await switchRes.json();
  assert(switchData.activeRole === 'employee', 'Active role changed to employee');

  // Switch back to owner
  const switchBackRes = await fetch(`${PROD_URL}/api/auth/switch-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ targetRole: 'owner' }),
  });
  assert(switchBackRes.status === 200, 'Switch role back to owner returns 200 OK');

  // 4d. Logout Owner
  const logoutRes = await fetch(`${PROD_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
  });
  assert(logoutRes.status === 200, 'Logout returns 200 OK');

  // 4e. Employee login
  console.log('  Testing Employee Login...');
  const empLoginRes = await fetch(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: employeeEmail, password: employeePassword }),
  });
  assert(empLoginRes.status === 200, 'Employee login returns 200 OK');
  const empLoginData = await empLoginRes.json();
  assert(empLoginData.user?.role === 'employee', 'Employee user role is employee');
  assert(empLoginData.user?.assignedEmployeeId === 'emp-1', 'Employee assignedEmployeeId is emp-1');

  const empCookie = empLoginRes.headers.get('set-cookie')?.split(';')[0];
  const empMeRes = await fetch(`${PROD_URL}/api/auth/me`, {
    headers: { Cookie: empCookie },
  });
  assert(empMeRes.status === 200, 'Employee GET /api/auth/me returns 200 OK');

  // Logout employee
  await fetch(`${PROD_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: empCookie },
  });

  // Re-login owner for storage test
  const reLoginRes = await fetch(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  const ownerActiveCookie = reLoginRes.headers.get('set-cookie')?.split(';')[0];

  // Test 5: Private Document Storage Lifecycle
  console.log('\n--- Test Suite 5: Private Document Storage Lifecycle ---');
  const presignUploadRes = await fetch(`${PROD_URL}/api/storage/presign-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerActiveCookie,
    },
    body: JSON.stringify({
      scope: 'document',
      lotCode: 'audit-test-lot',
      fileName: 'security-audit-report.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
    }),
  });
  assert(presignUploadRes.status === 200, 'POST /api/storage/presign-upload returns 200 OK');
  const presignData = await presignUploadRes.json();
  assert(presignData.success === true, 'Presign upload success: true');
  assert(presignData.bucketType === 'private-docs', 'Presign bucketType is private-docs');
  assert(presignData.publicUrl === null, 'Private document publicUrl is strictly null');
  assert(typeof presignData.uploadUrl === 'string', 'uploadUrl is a valid URL');
  assert(typeof presignData.storageKey === 'string', 'storageKey is returned');

  const testKey = presignData.storageKey;
  const testPayload = Buffer.from('%PDF-1.4 test document content for domexit prod verification', 'utf-8');

  console.log('  Uploading test document via presigned PUT...');
  const s3PutRes = await fetch(presignData.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: testPayload,
  });
  assert(s3PutRes.status === 200, `PUT to presigned upload URL returns 200 OK (got ${s3PutRes.status})`);

  // Direct anonymous GET must fail with 403 Forbidden
  console.log('  Testing Direct Anonymous Access to Private Object...');
  const directUrl = `https://storage.yandexcloud.net/${manifest.production.privateDocsBucket}/${testKey}`;
  const directRes = await fetch(directUrl);
  assert(directRes.status === 403, `Direct anonymous access to private bucket returns 403 Forbidden (got ${directRes.status})`);

  // Authorized Presigned Download
  console.log('  Testing Authorized Presigned Download...');
  const presignDownloadRes = await fetch(
    `${PROD_URL}/api/storage/presign-download?key=${encodeURIComponent(testKey)}&lotCode=audit-test-lot`,
    {
      headers: { Cookie: ownerActiveCookie },
    }
  );
  assert(presignDownloadRes.status === 200, 'GET /api/storage/presign-download returns 200 OK');
  const downloadData = await presignDownloadRes.json();
  assert(downloadData.success === true, 'Download presign success: true');
  assert(typeof downloadData.downloadUrl === 'string', 'Valid presigned downloadUrl returned');

  // Fetch file from presigned download URL
  const fileFetchRes = await fetch(downloadData.downloadUrl);
  assert(fileFetchRes.status === 200, 'Presigned download URL returns 200 OK');
  const fetchedBytes = await fileFetchRes.arrayBuffer();
  assert(Buffer.from(fetchedBytes).equals(testPayload), 'Downloaded content matches original uploaded bytes');

  // Test 6: Yandex OAuth Start Redirect
  console.log('\n--- Test Suite 6: Yandex OAuth Start Redirect ---');
  const oauthRes = await fetch(`${PROD_URL}/api/auth/yandex/start`, {
    redirect: 'manual',
  });
  assert(oauthRes.status === 302, 'GET /api/auth/yandex/start returns 302 Redirect');
  const oauthLocation = oauthRes.headers.get('location');
  assert(
    oauthLocation && oauthLocation.includes('oauth.yandex.ru/authorize'),
    'OAuth redirect targets oauth.yandex.ru/authorize'
  );
  assert(
    oauthLocation && oauthLocation.includes('client_id='),
    'OAuth redirect includes client_id parameter'
  );
  assert(
    oauthLocation && oauthLocation.includes(encodeURIComponent(`${PROD_URL}/api/auth/yandex/callback`)),
    'OAuth redirect includes correct production callback URI'
  );

  console.log('\n================================================================');
  console.log(`=== ALL PRODUCTION VERIFICATION TESTS PASSED SUCCESSFULLY! ===`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n[VerifyProd] Fatal Verification Error:', err.message);
  process.exit(1);
});
