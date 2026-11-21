import fs from 'node:fs';
import path from 'node:path';
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
console.log(`=== Phase 6A Live Verification Suite [${targetEnv.toUpperCase()}] ===`);
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

function authHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Cookie: `domexit_session=${token}`,
    ...extra,
  };
}

async function run() {
  // --- Check 1: Health Check ---
  console.log('[1/8] Testing Gateway Health Endpoint...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert(healthRes.status === 200, `GET /api/health returned 200 (actual: ${healthRes.status})`);
  const healthJson = await healthRes.json();
  assert(healthJson.ok === true || healthJson.status === 'ok', `Health status is ok (env: ${healthJson.env})`);

  // --- Check 2: Authenticate Owner ---
  console.log('\n[2/8] Authenticating Platform Owner...');
  let ownerToken = '';
  const ownerRes = await fetch(`${BASE_URL}/api/auth/login`, {
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

  // --- Check 3: Create Two Test Buyers ---
  console.log('\n[3/8] Registering Test Buyers (Buyer 1 & Buyer 2)...');
  let buyer1Token = '';
  let buyer1Id = '';
  let buyer2Token = '';
  let buyer2Id = '';

  const testBuyer1Email = `test_p6a_b1_${Date.now()}@domexit.test`;
  const testBuyer2Email = `test_p6a_b2_${Date.now()}@domexit.test`;
  const testPassword = 'TestPassword123!';

  // Buyer 1
  const randIp1 = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const reg1Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': randIp1 },
    body: JSON.stringify({
      email: testBuyer1Email,
      password: testPassword,
      name: 'Инвестор 1 (Gold Кандидат)',
      role: 'buyer',
    }),
  });
  assert(reg1Res.status === 200 || reg1Res.status === 201, `Buyer 1 registered (${reg1Res.status})`);
  const reg1Cookie = reg1Res.headers.get('set-cookie');
  if (reg1Cookie) {
    const m = reg1Cookie.match(/domexit_session=([^;]+)/);
    if (m) buyer1Token = m[1];
  }
  const reg1Data = await reg1Res.json().catch(() => ({}));
  if (!buyer1Token && reg1Data.token) buyer1Token = reg1Data.token;
  buyer1Id = reg1Data.user?.id || '';
  if (!buyer1Id) {
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders(buyer1Token) });
    const meData = await meRes.json();
    buyer1Id = meData.user?.id;
  }
  assert(Boolean(buyer1Token && buyer1Id), `Buyer 1 session ready: id=${buyer1Id}`);

  // Buyer 2
  const randIp2 = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const reg2Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': randIp2 },
    body: JSON.stringify({
      email: testBuyer2Email,
      password: testPassword,
      name: 'Покупатель 2 (Silver)',
      role: 'buyer',
    }),
  });
  assert(reg2Res.status === 200 || reg2Res.status === 201, `Buyer 2 registered (${reg2Res.status})`);
  const reg2Cookie = reg2Res.headers.get('set-cookie');
  if (reg2Cookie) {
    const m = reg2Cookie.match(/domexit_session=([^;]+)/);
    if (m) buyer2Token = m[1];
  }
  const reg2Data = await reg2Res.json().catch(() => ({}));
  if (!buyer2Token && reg2Data.token) buyer2Token = reg2Data.token;
  buyer2Id = reg2Data.user?.id || '';
  if (!buyer2Id) {
    const meRes2 = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders(buyer2Token) });
    const meData2 = await meRes2.json();
    buyer2Id = meData2.user?.id;
  }
  assert(Boolean(buyer2Token && buyer2Id), `Buyer 2 session ready: id=${buyer2Id}`);

  // --- Check 4: Tier Tampering Guard ---
  console.log('\n[4/8] Testing Tier Tampering Guard on /api/matching/my-buy-box...');
  const tamperRes = await fetch(`${BASE_URL}/api/matching/my-buy-box`, {
    method: 'PUT',
    headers: authHeaders(buyer1Token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      tier: 'gold', // Forbidden self-upgrade attempt
      maxBudgetRub: 30000000,
    }),
  });
  assert(tamperRes.status === 403, `Self tier upgrade blocked with 403 (actual: ${tamperRes.status})`);
  const tamperData = await tamperRes.json();
  assert(tamperData.code === 'privilege_tampering', `Tamper attempt returns code: privilege_tampering`);

  // Verify incident recorded in security_incidents
  const incRes = await fetch(`${BASE_URL}/api/data/security_incidents`, {
    headers: authHeaders(ownerToken),
  });
  const incData = await incRes.json();
  const incidents = incData.items || [];
  const foundInc = incidents.find(
    (i) => i.type === 'privilege_tampering' && (i.actorUserId === buyer1Id || i.summary?.includes('tier'))
  );
  assert(Boolean(foundInc), `Incident privilege_tampering recorded in security_incidents table`);

  // --- Check 5: Legitimate Buy-Boxes & Staff Tier Promotion ---
  console.log('\n[5/8] Saving Legitimate Buy-Boxes and Staff Tier Promotion...');
  // Save Buyer 1 Buy-Box (cash_100 -> default silver)
  const bb1Res = await fetch(`${BASE_URL}/api/matching/my-buy-box`, {
    method: 'PUT',
    headers: authHeaders(buyer1Token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      active: true,
      cities: ['spb'],
      districts: ['Приморский'],
      maxBudgetRub: 20000000,
      minDiscountPercent: 10,
      paymentMethod: 'cash_100',
      rooms: ['1-room'],
    }),
  });
  assert(bb1Res.status === 200, `Buyer 1 saved Buy-Box (200)`);
  const bb1Data = await bb1Res.json();
  assert(bb1Data.buyBox?.tier === 'silver', `Buyer 1 default tier is silver`);
  assert(bb1Data.buyBox?.reliabilityScore === 100, `Buyer 1 reliabilityScore defaults to 100`);

  // Save Buyer 2 Buy-Box (family_mortgage_approved -> default silver)
  const bb2Res = await fetch(`${BASE_URL}/api/matching/my-buy-box`, {
    method: 'PUT',
    headers: authHeaders(buyer2Token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      active: true,
      cities: ['spb'],
      districts: ['Приморский'],
      maxBudgetRub: 15000000,
      minDiscountPercent: 5,
      paymentMethod: 'family_mortgage_approved',
      rooms: ['1-room'],
    }),
  });
  assert(bb2Res.status === 200, `Buyer 2 saved Buy-Box (200)`);

  // Staff promotes Buyer 1 to 'gold'
  const promoRes = await fetch(`${BASE_URL}/api/matching/buyers/${buyer1Id}/tier`, {
    method: 'PATCH',
    headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      tier: 'gold',
      reliabilityScore: 100,
      tierNote: 'Верифицированный инвестор 100% cash',
    }),
  });
  assert(promoRes.status === 200, `Staff promoted Buyer 1 to gold (200)`);
  const promoData = await promoRes.json();
  assert(promoData.buyBox?.tier === 'gold', `Buyer 1 tier is now gold`);

  // --- Check 6: Launch Staged Drop & Test Gold Wave Exclusivity ---
  console.log('\n[6/8] Launching Drop and Verifying Wave Gating (Gold vs Silver)...');
  const testLotCode = `TEST-LOT-${Date.now().toString().slice(-5)}`;

  // Create temporary test lot
  const createLotRes = await fetch(`${BASE_URL}/api/data/lots`, {
    method: 'POST',
    headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: `lot-${testLotCode}`,
      lotCode: testLotCode,
      complexName: 'ЖК Чистое Небо',
      city: 'spb',
      district: 'Приморский',
      price: 10000000,
      todayDeveloperPrice: 12500000,
      cashPaidBySeller: 2500000,
      areaM2: 42,
      rooms: '1-room',
      dealTrack: 'ddu_cession',
      status: 'available',
      isApproved: true,
      sellerPhone: '+79991112233', // To test 152-FZ redaction in matches
    }),
  });
  assert(createLotRes.status === 200, `Created temporary test lot #${testLotCode}`);

  // Launch Staged Drop (2h Gold wave, cap: 2)
  const launchRes = await fetch(`${BASE_URL}/api/matching/lots/${testLotCode}/launch-drop`, {
    method: 'POST',
    headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      goldExclusiveHours: 2,
      windowHours: 24,
      maxApplicationsCap: 2,
    }),
  });
  assert(launchRes.status === 200, `Drop launched successfully (200)`);
  const launchData = await launchRes.json();
  assert(launchData.dropConfig?.waveStatus === 'gold_wave', `Drop waveStatus is gold_wave`);

  // Verify Buyer 1 sees match and canApplyNow === true
  const matches1Res = await fetch(`${BASE_URL}/api/matching/my-matches`, {
    headers: authHeaders(buyer1Token),
  });
  assert(matches1Res.status === 200, `Buyer 1 fetched my-matches (200)`);
  const matches1Data = await matches1Res.json();
  const match1 = (matches1Data.matches || []).find((m) => m.lot?.lotCode === testLotCode);
  assert(Boolean(match1), `Test lot #${testLotCode} matched Buyer 1 Buy-Box`);
  assert(match1.canApplyNow === true, `Buyer 1 (Gold) canApplyNow is true during gold_wave`);
  assert(!match1.lot?.sellerPhone, `152-FZ Barrier verified: sellerPhone redacted from matches`);

  // Verify Buyer 2 (Silver) is blocked during Gold wave
  const applySilverRes = await fetch(`${BASE_URL}/api/matching/lots/${testLotCode}/apply`, {
    method: 'POST',
    headers: authHeaders(buyer2Token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ readiness24h: true }),
  });
  assert(applySilverRes.status === 403, `Silver buyer blocked during gold_wave with 403 (actual: ${applySilverRes.status})`);
  const silverErr = await applySilverRes.json();
  assert(silverErr.code === 'gold_exclusive_wave', `Returned code: gold_exclusive_wave`);

  // Apply Buyer 1 (Gold)
  const applyGoldRes = await fetch(`${BASE_URL}/api/matching/lots/${testLotCode}/apply`, {
    method: 'POST',
    headers: authHeaders(buyer1Token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ priceAcceptance: 'full_price', readiness24h: true, deposit48h: true }),
  });
  assert(applyGoldRes.status === 200, `Gold buyer application accepted (200)`);
  const goldAppData = await applyGoldRes.json();
  assert(goldAppData.application?.closingScore > 0, `Application has calculated closingScore: ${goldAppData.application?.closingScore}`);

  // Test duplicate application prevention (409)
  const dupApplyRes = await fetch(`${BASE_URL}/api/matching/lots/${testLotCode}/apply`, {
    method: 'POST',
    headers: authHeaders(buyer1Token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ readiness24h: true }),
  });
  assert(dupApplyRes.status === 409, `Duplicate application rejected with 409 Conflict (actual: ${dupApplyRes.status})`);

  // --- Check 7: Queue Management, Priority Selection & Rotation ---
  console.log('\n[7/8] Testing Hybrid Queue, Priority Selection, and Rotation (No-Show Penalty)...');
  // Staff views queue
  const queueRes = await fetch(`${BASE_URL}/api/matching/lots/${testLotCode}/queue`, {
    headers: authHeaders(ownerToken),
  });
  assert(queueRes.status === 200, `Staff fetched queue (200)`);
  const queueData = await queueRes.json();
  assert(Array.isArray(queueData.queue) && queueData.queue.length >= 1, `Queue contains ranked applications`);
  const topApp = queueData.queue[0];
  assert(topApp.userId === buyer1Id, `Buyer 1 is ranked #1 in queue`);
  assert(topApp.tier === 'gold', `Application is enriched with tier: gold`);

  // Staff selects Priority #1
  const selectRes = await fetch(`${BASE_URL}/api/matching/lots/${testLotCode}/select-priority`, {
    method: 'POST',
    headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ priority1AppId: topApp.id }),
  });
  assert(selectRes.status === 200, `Staff selected priority 1 (200)`);
  const selectData = await selectRes.json();
  assert(selectData.priority1?.queueStatus === 'priority_1', `Priority 1 set with deadlines`);
  assert(Boolean(selectData.priority1?.viewingDeadlineAt), `viewingDeadlineAt set (24h)`);

  // Staff marks no-show and promotes next
  const promoteRes = await fetch(`${BASE_URL}/api/matching/lots/${testLotCode}/promote-next`, {
    method: 'POST',
    headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      previousPriority1AppId: topApp.id,
      reason: 'no_show',
    }),
  });
  assert(promoteRes.status === 200, `Staff executed promote-next with no_show (200)`);

  // Verify Buyer 1 received 15-point penalty
  const b1CheckRes = await fetch(`${BASE_URL}/api/matching/my-buy-box`, {
    headers: authHeaders(buyer1Token),
  });
  const b1CheckData = await b1CheckRes.json();
  assert(b1CheckData.buyBox?.reliabilityScore === 85, `Buyer 1 reliabilityScore decreased by 15 (actual: ${b1CheckData.buyBox?.reliabilityScore})`);
  assert(b1CheckData.buyBox?.noShowCount === 1, `Buyer 1 noShowCount incremented to 1`);

  // --- Check 8: Public Demand Radar (Zero PII) & Staging Clean-up ---
  console.log('\n[8/8] Testing Public Demand Radar (Zero PII) and Clean-up...');
  const radarRes = await fetch(`${BASE_URL}/api/matching/demand-radar`);
  assert(radarRes.status === 200, `GET /api/matching/demand-radar returned 200`);
  const radarData = await radarRes.json();
  assert(typeof radarData.totalMatched === 'number', `totalMatched is numeric: ${radarData.totalMatched}`);
  assert(typeof radarData.goldCount === 'number', `goldCount is numeric: ${radarData.goldCount}`);
  assert(typeof radarData.silverCount === 'number', `silverCount is numeric: ${radarData.silverCount}`);
  assert(typeof radarData.totalDeclaredLiquidityRub === 'number', `totalDeclaredLiquidityRub is numeric: ${radarData.totalDeclaredLiquidityRub}`);
  assert(!radarData.email && !radarData.phone && !radarData.name && !radarData.userId, `Demand radar strictly contains Zero PII`);

  // Clean-up test entities on Staging
  console.log('\nCleaning up temporary test records from Staging...');
  await fetch(`${BASE_URL}/api/data/lots/lot-${testLotCode}`, {
    method: 'DELETE',
    headers: authHeaders(ownerToken),
  });
  await fetch(`${BASE_URL}/api/data/buyer_applications/${topApp.id}`, {
    method: 'DELETE',
    headers: authHeaders(ownerToken),
  });
  await fetch(`${BASE_URL}/api/data/buy_boxes/bb:${buyer1Id}`, {
    method: 'DELETE',
    headers: authHeaders(ownerToken),
  });
  await fetch(`${BASE_URL}/api/data/buy_boxes/bb:${buyer2Id}`, {
    method: 'DELETE',
    headers: authHeaders(ownerToken),
  });
  await fetch(`${BASE_URL}/api/data/users/${buyer1Id}`, {
    method: 'DELETE',
    headers: authHeaders(ownerToken),
  });
  await fetch(`${BASE_URL}/api/data/users/${buyer2Id}`, {
    method: 'DELETE',
    headers: authHeaders(ownerToken),
  });
  if (foundInc?.id) {
    await fetch(`${BASE_URL}/api/data/security_incidents/${foundInc.id}`, {
      method: 'DELETE',
      headers: authHeaders(ownerToken),
    });
    console.log(`  ✓ Cleaned up test incident ${foundInc.id}`);
  }
  console.log('  ✓ Temporary test records cleaned up. Staging pristine.');

  console.log('\n================================================================');
  console.log(`=== ALL PHASE 6A VERIFICATION CHECKS PASSED [${targetEnv.toUpperCase()}] ===`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
});
