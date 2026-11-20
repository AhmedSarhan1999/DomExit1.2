import fs from 'node:fs';
import path from 'node:path';
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

const ownerEmail = envVars.BOOTSTRAP_OWNER_EMAIL?.trim();
const ownerPassword = envVars.BOOTSTRAP_OWNER_PASSWORD?.trim();

console.log('=== Running Live Staging Verification against Moscow API Gateway ===');
console.log('Target URL:', STAGING_URL);

async function runTests() {
  const results = [];

  // 1. GET /api/health
  console.log('\n[Test 1] GET /api/health');
  const t1Start = Date.now();
  const res1 = await fetch(`${STAGING_URL}/api/health`);
  const t1Duration = Date.now() - t1Start;
  const data1 = await res1.json();
  console.log(`Status: ${res1.status} (${t1Duration}ms), Body:`, data1);
  if (res1.status !== 200 || !data1.ok) {
    throw new Error('Test 1 failed!');
  }
  results.push({ name: 'GET /api/health', status: res1.status, timeMs: t1Duration, ok: true });

  // 2. GET /api/data/users without auth
  console.log('\n[Test 2] GET /api/data/users without cookie (Security Check)');
  const t2Start = Date.now();
  const res2 = await fetch(`${STAGING_URL}/api/data/users`);
  const t2Duration = Date.now() - t2Start;
  const data2 = await res2.json();
  console.log(`Status: ${res2.status} (${t2Duration}ms), Body:`, data2);
  if (res2.status !== 401) {
    throw new Error(`Test 2 failed! Expected 401, got ${res2.status}`);
  }
  results.push({ name: 'GET /api/data/users (unauthorized)', status: res2.status, timeMs: t2Duration, ok: true });

  // 3. POST /api/auth/login with owner credentials
  console.log('\n[Test 3] POST /api/auth/login as Master Owner');
  const t3Start = Date.now();
  const res3 = await fetch(`${STAGING_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  const t3Duration = Date.now() - t3Start;
  const data3 = await res3.json();

  // Extract Set-Cookie
  const setCookie = res3.headers.get('set-cookie');
  console.log(`Status: ${res3.status} (${t3Duration}ms)`);
  console.log('User Role:', data3.user?.role);
  console.log('PasswordHash Excluded:', data3.user?.passwordHash === undefined);
  console.log('Set-Cookie Received:', Boolean(setCookie));

  if (res3.status !== 200 || data3.user?.role !== 'owner' || !setCookie) {
    throw new Error('Test 3 failed!');
  }

  // Extract session token
  const sessionMatch = setCookie.match(/domexit_session=([^;]+)/);
  if (!sessionMatch) throw new Error('Session cookie not found in response!');
  const sessionCookieHeader = `domexit_session=${sessionMatch[1]}`;
  results.push({ name: 'POST /api/auth/login (owner)', status: res3.status, timeMs: t3Duration, ok: true });

  // 4. GET /api/auth/me with session cookie
  console.log('\n[Test 4] GET /api/auth/me using authenticated cookie');
  const t4Start = Date.now();
  const res4 = await fetch(`${STAGING_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookieHeader },
  });
  const t4Duration = Date.now() - t4Start;
  const data4 = await res4.json();
  console.log(`Status: ${res4.status} (${t4Duration}ms)`);
  console.log('Authenticated User:', data4.user?.name, 'Role:', data4.user?.role);
  console.log('PasswordHash Excluded:', data4.user?.passwordHash === undefined);

  if (res4.status !== 200 || data4.user?.role !== 'owner' || data4.user?.passwordHash) {
    throw new Error('Test 4 failed!');
  }
  results.push({ name: 'GET /api/auth/me (authenticated)', status: res4.status, timeMs: t4Duration, ok: true });

  // 5. Document Privacy & Presigned URL verification
  console.log('\n[Test 5] Private Document Upload/Download & Direct Access Privacy Test');
  const testLotCode = 'TEST-VERIF-99';
  const testFileName = 'legal_audit_contract_sample.pdf';
  const testFileContent = Buffer.from('%PDF-1.4 Test Legal Contract Content for DomExit Verification Staging\n');

  // 5a. Presign Upload
  const t5aStart = Date.now();
  const presignUploadRes = await fetch(`${STAGING_URL}/api/storage/presign-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookieHeader,
    },
    body: JSON.stringify({
      scope: 'document',
      lotCode: testLotCode,
      fileName: testFileName,
      contentType: 'application/pdf',
      fileSize: testFileContent.length,
    }),
  });
  const presignUploadData = await presignUploadRes.json();
  console.log('Presign Upload Status:', presignUploadRes.status, 'Storage Key:', presignUploadData.storageKey);
  console.log('Public URL is null:', presignUploadData.publicUrl === null);

  if (presignUploadRes.status !== 200 || !presignUploadData.uploadUrl || presignUploadData.publicUrl !== null) {
    throw new Error('5a Presign upload failed!');
  }

  // 5b. Upload file via Presigned PUT URL directly to S3
  const putRes = await fetch(presignUploadData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: testFileContent,
  });
  console.log('S3 Presigned PUT Status:', putRes.status);
  if (putRes.status !== 200) {
    throw new Error(`S3 Presigned PUT failed with status ${putRes.status}`);
  }

  // 5c. Verify direct unauthenticated S3 access returns 403 Forbidden!
  const directS3Url = `https://storage.yandexcloud.net/domexit-private-docs-staging/${presignUploadData.storageKey}`;
  const directAccessRes = await fetch(directS3Url);
  console.log('Direct S3 Unsigned Access Status (Expected 403):', directAccessRes.status);
  if (directAccessRes.status !== 403) {
    throw new Error(`Privacy breach! Direct access returned status ${directAccessRes.status} instead of 403!`);
  }

  // 5d. Presign Download
  const presignDownloadRes = await fetch(
    `${STAGING_URL}/api/storage/presign-download?key=${encodeURIComponent(
      presignUploadData.storageKey
    )}&lotCode=${testLotCode}&filename=${encodeURIComponent(testFileName)}`,
    {
      headers: { Cookie: sessionCookieHeader },
    }
  );
  const presignDownloadData = await presignDownloadRes.json();
  console.log('Presign Download Status:', presignDownloadRes.status);
  if (presignDownloadRes.status !== 200 || !presignDownloadData.downloadUrl) {
    throw new Error('5d Presign download failed!');
  }

  // 5e. Download file via Presigned GET URL and verify content matches
  const downloadRes = await fetch(presignDownloadData.downloadUrl);
  const downloadedBuf = Buffer.from(await downloadRes.arrayBuffer());
  const matches = Buffer.compare(testFileContent, downloadedBuf) === 0;
  console.log('Downloaded file matches uploaded content 100%:', matches);
  if (!matches) {
    throw new Error('Downloaded file content mismatch!');
  }

  const t5Duration = Date.now() - t5aStart;
  results.push({
    name: 'Storage: Presign PUT/GET & 403 Privacy Check',
    status: 200,
    timeMs: t5Duration,
    ok: true,
  });

  console.log('\n=== ALL 5 LIVE TESTS PASSED 100% ===');
  console.table(results);
}

runTests().catch((err) => {
  console.error('\n❌ LIVE TEST FAILED:', err);
  process.exit(1);
});
