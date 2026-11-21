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
let isReadOnly = args.includes('--read-only');

for (const arg of args) {
  if (arg.startsWith('--env=')) targetEnv = arg.split('=')[1].trim();
  if (arg === '--production') targetEnv = 'production';
  if (arg === '--staging') targetEnv = 'staging';
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

const ownerEmail = (targetEnv === 'production'
  ? envVars.PROD_OWNER_EMAIL || envVars.BOOTSTRAP_OWNER_EMAIL
  : envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();

const ownerPassword = (targetEnv === 'production'
  ? envVars.PROD_OWNER_PASSWORD
  : envVars.BOOTSTRAP_OWNER_PASSWORD)?.trim();

const jwtSecret = (targetEnv === 'production'
  ? envVars.JWT_SIGNING_SECRET_PROD
  : envVars.JWT_SIGNING_SECRET_STAGING || envVars.JWT_SIGNING_SECRET)?.trim();

console.log('================================================================');
console.log(`=== Phase 6 Complete Verification Suite [${targetEnv.toUpperCase()}] ===`);
console.log('================================================================');
console.log('Gateway URL:   ', BASE_URL);
console.log('Read-Only Mode:', isReadOnly ? 'YES (Zero Test Writes)' : 'NO');
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
    exp: now + 3600,
  };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  const encSig = base64UrlEncode(sig);
  return `${data}.${encSig}`;
}

async function run() {
  try {
    // --- Check 1: Health Check ---
    console.log('[1/8] Testing Gateway Health Endpoint...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, `GET /api/health returned 200 (actual: ${healthRes.status})`);
    const healthJson = await healthRes.json();
    assert(healthJson.ok === true || healthJson.status === 'ok', `Health status is ok (env: ${healthJson.env})`);

    // --- Check 2: Authenticate Platform Owner ---
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

    // --- Check 3: Demand Radar & Aggregation API (Public, Zero PII) ---
    console.log('\n[3/8] Testing Demand Radar Aggregations (Zero PII)...');
    const radarRes = await fetch(`${BASE_URL}/api/matching/demand-radar?city=spb`);
    assert(radarRes.status === 200, `GET /api/matching/demand-radar returned 200`);
    const radarData = await radarRes.json();
    assert(radarData.ok === true, `Demand radar returned ok=true`);
    assert(typeof radarData.totalDeclaredLiquidityRub === 'number', `totalDeclaredLiquidityRub is number (${radarData.totalDeclaredLiquidityRub})`);
    assert(typeof radarData.goldCount === 'number', `goldCount is number (${radarData.goldCount})`);
    assert(typeof radarData.silverCount === 'number', `silverCount is number (${radarData.silverCount})`);
    assert(typeof radarData.totalMatched === 'number', `totalMatched is number (${radarData.totalMatched})`);
    // Verify strictly ZERO PII in payload
    const radarStr = JSON.stringify(radarData);
    assert(!radarStr.includes('@') && !radarStr.includes('phone') && !radarStr.includes('userId'), `Demand radar response contains strictly ZERO PII`);

    // --- Check 4: Anonymous Protection on Matching Routes ---
    console.log('\n[4/8] Testing Anonymous Access Denial (401 Unauthorized)...');
    const anonEndp1 = await fetch(`${BASE_URL}/api/matching/my-buy-box`);
    assert(anonEndp1.status === 401, `GET /my-buy-box without token returned 401 (actual: ${anonEndp1.status})`);

    const anonEndp2 = await fetch(`${BASE_URL}/api/matching/my-matches`);
    assert(anonEndp2.status === 401, `GET /my-matches without token returned 401 (actual: ${anonEndp2.status})`);

    const anonEndp3 = await fetch(`${BASE_URL}/api/matching/lots/DEMO-LOT/queue`);
    assert(anonEndp3.status === 401, `GET /lots/:id/queue without token returned 401 (actual: ${anonEndp3.status})`);

    const anonEndp4 = await fetch(`${BASE_URL}/api/matching/lots/DEMO-LOT/launch-drop`, { method: 'POST' });
    assert(anonEndp4.status === 401, `POST /lots/:id/launch-drop without token returned 401 (actual: ${anonEndp4.status})`);

    const anonEndp5 = await fetch(`${BASE_URL}/api/matching/lots/DEMO-LOT/apply-drop`, { method: 'POST' });
    assert(anonEndp5.status === 401, `POST /lots/:id/apply-drop without token returned 401 (actual: ${anonEndp5.status})`);

    const anonEndp6 = await fetch(`${BASE_URL}/api/matching/lots/DEMO-LOT/select-priority`, { method: 'POST' });
    assert(anonEndp6.status === 401, `POST /lots/:id/select-priority without token returned 401 (actual: ${anonEndp6.status})`);

    const anonEndp7 = await fetch(`${BASE_URL}/api/matching/lots/DEMO-LOT/promote-next`, { method: 'POST' });
    assert(anonEndp7.status === 401, `POST /lots/:id/promote-next without token returned 401 (actual: ${anonEndp7.status})`);

    // --- Check 5: Staff-Only Route Protection & Role Isolation (403 Forbidden) ---
    console.log('\n[5/8] Testing Staff Role Isolation (Non-Staff Denied with 403)...');
    // Fetch a regular user from YDB users list via owner token (read-only)
    const usersRes = await fetch(`${BASE_URL}/api/data/users?limit=20`, { headers: authHeaders(ownerToken) });
    const usersData = await usersRes.json();
    const regularUser = (usersData.items || []).find((u) => u.role === 'buyer' || u.role === 'user' || !u.role);
    const regularUserId = regularUser ? regularUser.id : 'usr-regular-client';
    const regularUserEmail = regularUser ? regularUser.email : 'client@domexit.test';

    // Sign session token for regular client
    const clientToken = createSignedJwt(
      { userId: regularUserId, email: regularUserEmail, role: 'user' },
      jwtSecret
    );

    // Find any existing lot to test staff-only mutation
    const lotsRes = await fetch(`${BASE_URL}/api/data/lots?limit=5`, { headers: authHeaders(ownerToken) });
    const lotsData = await lotsRes.json();
    const targetLotCode = (lotsData.items && lotsData.items[0]?.lotCode) || (lotsData.items && lotsData.items[0]?.id) || 'U-62090';

    // 5a. Non-staff launch-drop -> 403
    const staffDropRes = await fetch(`${BASE_URL}/api/matching/lots/${targetLotCode}/launch-drop`, {
      method: 'POST',
      headers: authHeaders(clientToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ goldExclusiveHours: 2 }),
    });
    assert(staffDropRes.status === 403, `Non-staff launch-drop returned 403 (actual: ${staffDropRes.status})`);

    // 5b. Non-staff update buyer tier -> 403
    const staffTierRes = await fetch(`${BASE_URL}/api/matching/buyers/${regularUserId}/tier`, {
      method: 'POST',
      headers: authHeaders(clientToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tier: 'gold' }),
    });
    assert(staffTierRes.status === 403, `Non-staff tier update returned 403 (actual: ${staffTierRes.status})`);

    // 5c. Non-staff select priority -> 403
    const staffPriorityRes = await fetch(`${BASE_URL}/api/matching/lots/${targetLotCode}/select-priority`, {
      method: 'POST',
      headers: authHeaders(clientToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ priority1AppId: 'app-fake-id' }),
    });
    assert(staffPriorityRes.status === 403, `Non-staff select-priority returned 403 (actual: ${staffPriorityRes.status})`);

    // 5d. Non-staff promote next -> 403
    const staffPromoteRes = await fetch(`${BASE_URL}/api/matching/lots/${targetLotCode}/promote-next`, {
      method: 'POST',
      headers: authHeaders(clientToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ previousPriority1AppId: 'app-fake-id', reason: 'no_show' }),
    });
    assert(staffPromoteRes.status === 403, `Non-staff promote-next returned 403 (actual: ${staffPromoteRes.status})`);

    // --- Check 6: Privilege Tampering Guard (Tier Self-Upgrade Blocked) ---
    console.log('\n[6/8] Testing Privilege Tampering Guard on Buy-Box Mutation...');
    const tamperRes = await fetch(`${BASE_URL}/api/matching/my-buy-box`, {
      method: 'PUT',
      headers: authHeaders(clientToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        tier: 'gold', // Forbidden self-upgrade attempt
        maxBudgetRub: 35000000,
        paymentMethod: 'cash_100',
      }),
    });
    const tamperData = await tamperRes.json();
    assert(tamperRes.status === 403, `Tier self-upgrade rejected with 403 (actual: ${tamperRes.status})`);
    assert(tamperData.code === 'privilege_tampering', `Error code matches 'privilege_tampering' (actual: ${tamperData.code})`);

    // --- Check 7: Read-Only Buy-Box & Matches Retrieval for Owner ---
    console.log('\n[7/8] Testing Read-Only Buy-Box & Matches Retrieval (Owner)...');
    const myBbRes = await fetch(`${BASE_URL}/api/matching/my-buy-box`, { headers: authHeaders(ownerToken) });
    assert(myBbRes.status === 200, `GET /api/matching/my-buy-box returned 200`);
    const myBbData = await myBbRes.json();
    assert(myBbData.ok === true && (myBbData.buyBox !== undefined), `Buy-Box response is valid (buyBox: ${myBbData.buyBox ? 'configured' : 'null'})`);

    const myMatchesRes = await fetch(`${BASE_URL}/api/matching/my-matches`, { headers: authHeaders(ownerToken) });
    assert(myMatchesRes.status === 200, `GET /api/matching/my-matches returned 200`);
    const myMatchesData = await myMatchesRes.json();
    assert(myMatchesData.ok === true && Array.isArray(myMatchesData.matches), `Matches array returned (count=${myMatchesData.matches.length})`);

    // --- Check 8: Cloud 15-Minute SLA Sweeper Function & Trigger Existence ---
    console.log('\n[8/8] Inspecting Cloud 15-Minute SLA Sweeper Function & Timer Trigger...');
    const fnName = targetEnv === 'production' ? 'domexit-sla-sweeper-prod' : 'domexit-sla-sweeper-prod';
    const trigName = 'domexit-sla-sweeper-trigger';

    const fnRaw = execSync(`yc serverless function get ${fnName} --format json`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    });
    const fnData = JSON.parse(fnRaw);
    assert(fnData.status === 'ACTIVE', `Cloud Function ${fnName} is ACTIVE (ID: ${fnData.id})`);

    const trigRaw = execSync(`yc serverless trigger get ${trigName} --format json`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    });
    const trigData = JSON.parse(trigRaw);
    assert(trigData.status === 'ACTIVE', `Timer Trigger ${trigName} is ACTIVE (ID: ${trigData.id})`);
    assert(trigData.rule?.timer?.cron_expression === '0/15 * * * ? *', `Cron expression is 0/15 * * * ? * (actual: ${trigData.rule?.timer?.cron_expression})`);

    console.log('\n================================================================');
    console.log(`🎉 ALL PHASE 6 CHECKS PASSED [${targetEnv.toUpperCase()} - READ-ONLY]`);
    console.log('Zero test records written to production YDB.');
    console.log('================================================================');
  } catch (err) {
    console.error('\nVerification failed:', err.message);
    process.exit(1);
  }
}

run();
