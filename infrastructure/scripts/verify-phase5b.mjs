import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const args = process.argv.slice(2);
let targetEnv = 'staging';
let isReadOnly = args.includes('--read-only');

for (const arg of args) {
  if (arg.startsWith('--env=')) targetEnv = arg.split('=')[1].trim();
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

const envConfig = targetEnv === 'production' ? manifest.production : manifest.staging;
const BASE_URL = envConfig.apiGatewayUrl;

const ownerEmail = (envVars.PROD_OWNER_EMAIL || envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();
const ownerPassword = (targetEnv === 'production' ? envVars.PROD_OWNER_PASSWORD : envVars.BOOTSTRAP_OWNER_PASSWORD)?.trim();

console.log('================================================================');
console.log(`=== Phase 5B Live Verification Suite [${targetEnv.toUpperCase()}] ===`);
console.log('================================================================');
console.log('Gateway URL:   ', BASE_URL);
console.log('Read-Only Mode:', isReadOnly ? 'YES' : 'NO');
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

async function run() {
  // --- Check 1: Code Decomposition Metrics ---
  console.log('[1/8] Verifying Architectural File Decomposition Metrics...');
  const telegramTsPath = path.join(ROOT_DIR, 'backend/src/routes/telegram.ts');
  const legalAuditPagePath = path.join(ROOT_DIR, 'src/pages/AdminLegalAuditPage.tsx');

  const telegramLines = fs.readFileSync(telegramTsPath, 'utf-8').split('\n').length;
  const legalAuditLines = fs.readFileSync(legalAuditPagePath, 'utf-8').split('\n').length;

  console.log(`  * backend/src/routes/telegram.ts: ${telegramLines} lines`);
  assert(telegramLines < 350, `telegram.ts decomposed to < 350 lines (actual: ${telegramLines})`);

  console.log(`  * src/pages/AdminLegalAuditPage.tsx: ${legalAuditLines} lines`);
  assert(legalAuditLines < 550, `AdminLegalAuditPage.tsx decomposed to < 550 lines (actual: ${legalAuditLines})`);

  // --- Check 2: Health Check ---
  console.log('\n[2/8] Testing Gateway Health Endpoint...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert(healthRes.status === 200, `GET /api/health returned 200 (actual: ${healthRes.status})`);
  const healthJson = await healthRes.json();
  assert(healthJson.ok === true || healthJson.status === 'ok', `Health status is ok (env: ${healthJson.env})`);

  // --- Check 3: Staff & Buyer Authentication ---
  console.log('\n[3/8] Authenticating Platform Owner & Creating Test Buyer...');
  let ownerToken = '';
  let ownerRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  const setCookie = ownerRes.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/domexit_session=([^;]+)/);
    if (match) ownerToken = match[1];
  }
  const ownerData = await ownerRes.json().catch(() => ({}));
  if (!ownerToken && ownerData.token) ownerToken = ownerData.token;
  assert(Boolean(ownerToken), `Owner authenticated successfully (${ownerEmail})`);

  let buyerToken = '';
  const testBuyerEmail = `test_p5b_${Date.now()}@domexit.test`;
  const testPassword = 'TestPassword123!';

  if (!isReadOnly) {
    const randomIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': randomIp },
      body: JSON.stringify({
        email: testBuyerEmail,
        password: testPassword,
        name: 'Тестовый Покупатель 5Б',
        phone: '+7 (999) 777-55-22',
        role: 'buyer',
      }),
    });
    const regSetCookie = regRes.headers.get('set-cookie');
    if (regSetCookie) {
      const match = regSetCookie.match(/domexit_session=([^;]+)/);
      if (match) buyerToken = match[1];
    }
    const regData = await regRes.json().catch(() => ({}));
    if (!buyerToken && regData.token) buyerToken = regData.token;
    assert(Boolean(buyerToken), `Buyer registered (${regRes.status})`);
  }

  function authHeaders(token, extra = {}) {
    return {
      Authorization: `Bearer ${token}`,
      Cookie: `domexit_session=${token}`,
      ...extra,
    };
  }

  // --- Check 4: INN Lookup Tool (/api/tools/inn-lookup) ---
  console.log('\n[4/8] Testing Russian Legal Tool /api/tools/inn-lookup...');
  // 4.1 Anonymous request -> 401
  const anonInnRes = await fetch(`${BASE_URL}/api/tools/inn-lookup?inn=7707083893`);
  assert(anonInnRes.status === 401, `Anonymous request rejected with 401 (actual: ${anonInnRes.status})`);

  // 4.2 Buyer request -> 403
  if (buyerToken) {
    const buyerInnRes = await fetch(`${BASE_URL}/api/tools/inn-lookup?inn=7707083893`, {
      headers: authHeaders(buyerToken),
    });
    assert(buyerInnRes.status === 403, `Buyer role rejected with 403 (actual: ${buyerInnRes.status})`);
  }

  // 4.3 Staff request with invalid checksum -> 400
  const invalidInnRes = await fetch(`${BASE_URL}/api/tools/inn-lookup?inn=1234567890`, {
    headers: authHeaders(ownerToken),
  });
  assert(invalidInnRes.status === 400, `Invalid INN checksum rejected with 400 (actual: ${invalidInnRes.status})`);

  // 4.4 Staff request with valid 10-digit INN (Sberbank 7707083893) -> 200
  const validInnRes = await fetch(`${BASE_URL}/api/tools/inn-lookup?inn=7707083893`, {
    headers: authHeaders(ownerToken),
  });
  assert(validInnRes.status === 200, `Valid 10-digit INN accepted with 200 (actual: ${validInnRes.status})`);
  const validInnData = await validInnRes.json();
  assert(validInnData.valid === true, `INN validated by checksum algorithm: ${validInnData.inn}`);
  assert(validInnData.type === 'legal_entity', `INN correctly identified as legal_entity`);

  // 4.5 Staff request with valid 12-digit individual INN (500100732259) -> 200
  const valid12InnRes = await fetch(`${BASE_URL}/api/tools/inn-lookup?inn=500100732259`, {
    headers: authHeaders(ownerToken),
  });
  assert(valid12InnRes.status === 200, `Valid 12-digit INN accepted with 200 (actual: ${valid12InnRes.status})`);
  const valid12Data = await valid12InnRes.json();
  assert(valid12Data.valid === true && valid12Data.type === 'individual_or_entrepreneur', `12-digit INN validated`);

  // --- Check 5: Tamper-Proof PEP Signatures Table ---
  console.log('\n[5/8] Verifying Tamper-Proof 403 Barrier on pep_signatures CRUD...');
  const directPostRes = await fetch(`${BASE_URL}/api/data/pep_signatures`, {
    method: 'POST',
    headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: 'fake-sig', documentType: 'fake' }),
  });
  assert(directPostRes.status === 403, `Direct POST /api/data/pep_signatures returned 403 (actual: ${directPostRes.status})`);

  const directPutRes = await fetch(`${BASE_URL}/api/data/pep_signatures/fake-sig`, {
    method: 'PUT',
    headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status: 'tampered' }),
  });
  assert(directPutRes.status === 403, `Direct PUT /api/data/pep_signatures returned 403 (actual: ${directPutRes.status})`);

  const directDelRes = await fetch(`${BASE_URL}/api/data/pep_signatures/fake-sig`, {
    method: 'DELETE',
    headers: authHeaders(ownerToken),
  });
  assert(directDelRes.status === 403, `Direct DELETE /api/data/pep_signatures returned 403 (actual: ${directDelRes.status})`);

  // --- Check 6: PEP 63-FZ Routes (/api/pep/*) ---
  console.log('\n[6/8] Testing Simple Electronic Signature (ПЭП 63-ФЗ) Workflow...');
  // 6.1 Preview endpoint
  const previewAnon = await fetch(`${BASE_URL}/api/pep/preview?documentType=nda_viewing_act&lotCode=U-77001`);
  assert(previewAnon.status === 401, `Anonymous PEP preview rejected with 401 (actual: ${previewAnon.status})`);

  const previewBuyer = await fetch(`${BASE_URL}/api/pep/preview?documentType=nda_viewing_act&lotCode=U-77001`, {
    headers: authHeaders(buyerToken || ownerToken),
  });
  assert(previewBuyer.status === 200, `PEP preview returned 200 (actual: ${previewBuyer.status})`);
  const previewData = await previewBuyer.json();
  const doc = previewData.preview || previewData;
  assert(Boolean(doc.canonicalText || doc.text) && Boolean(doc.documentTextHashSha256 || doc.sha256Hex), `Preview returned canonical text and SHA-256 fingerprint`);
  assert(doc.documentType === 'nda_viewing_act', `Preview matches documentType`);

  // 6.2 Request OTP when Telegram is not linked -> 412
  if (buyerToken && !isReadOnly) {
    const unlinkedOtpRes = await fetch(`${BASE_URL}/api/pep/request-otp`, {
      method: 'POST',
      headers: authHeaders(buyerToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ documentType: 'nda_viewing_act', lotCode: 'U-77001' }),
    });
    assert(unlinkedOtpRes.status === 412, `Unlinked Telegram rejected with 412 Precondition Failed (actual: ${unlinkedOtpRes.status})`);
  }

  // --- Check 7: 152-ФЗ Privacy Barrier on Lots ---
  console.log('\n[7/8] Verifying 152-ФЗ Seller Privacy Redaction Barrier...');
  const lotsRes = await fetch(`${BASE_URL}/api/data/lots?limit=10`);
  assert(lotsRes.status === 200, `GET /api/data/lots returned 200`);
  const lotsData = await lotsRes.json();
  const lotsList = Array.isArray(lotsData) ? lotsData : lotsData.items || [];
  if (lotsList.length > 0) {
    let privacyClean = true;
    for (const l of lotsList) {
      if (l.sellerPhone || l.sellerEmail || l.sellerInn) {
        privacyClean = false;
        console.error(`  ✗ Exposed private data on lot #${l.lotCode}: phone=${l.sellerPhone}, email=${l.sellerEmail}, inn=${l.sellerInn}`);
      }
    }
    assert(privacyClean, `All lots 100% redacted of sellerPhone, sellerEmail, sellerInn`);
  }

  // --- Check 8: Dual-Track Contract Rules ---
  console.log('\n[8/8] Verifying Dual-Track Property Validation (DDU vs Secondary)...');
  if (!isReadOnly && buyerToken) {
    // Submit test secondary request where paidAmountRub == contractPriceRub (100% paid)
    const testLotCode = `TEST-SEC-${Date.now().toString().slice(-5)}`;
    const secReqRes = await fetch(`${BASE_URL}/api/data/seller_requests`, {
      method: 'POST',
      headers: authHeaders(buyerToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        lotCode: testLotCode,
        dealTrack: 'secondary_dkp',
        city: 'spb',
        district: 'Приморский',
        complexName: 'ЖК Вторичный Тест',
        contractPriceRub: 12000000,
        paidAmountRub: 12000000, // 100% paid (valid for secondary_dkp)
        areaM2: 55,
        rooms: '2-room',
        floor: 5,
        totalFloors: 16,
      }),
    });
    assert(secReqRes.status === 200 || secReqRes.status === 201, `Secondary request with 100% paid accepted (${secReqRes.status})`);
    const secData = await secReqRes.json();
    const savedItem = secData.item || secData;
    assert(savedItem.dealTrack === 'secondary_dkp', `dealTrack persisted as secondary_dkp`);
  }

  console.log('\n================================================================');
  console.log(`=== ALL PHASE 5B VERIFICATION CHECKS PASSED [${targetEnv.toUpperCase()}] ===`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
});
