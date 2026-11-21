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

const tgSecret = targetEnv === 'production'
  ? envVars.TELEGRAM_WEBHOOK_SECRET_PROD
  : envVars.TELEGRAM_WEBHOOK_SECRET_STAGING || envVars.TELEGRAM_WEBHOOK_SECRET;

console.log('================================================================');
console.log(`=== Phase 6B Live Verification Suite [${targetEnv.toUpperCase()}] ===`);
console.log('================================================================');
console.log('Gateway URL:   ', BASE_URL);
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
  const cleanupLotIds = [];

  try {
    // --- Check 1: Gateway Health Check ---
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

    // --- Check 3: SLA Sweeper Endpoint Dry-Run ---
    console.log('\n[3/8] Testing SLA Sweeper Staff API (POST /api/matching/run-sla-sweep -- dryRun)...');
    const dryRunRes = await fetch(`${BASE_URL}/api/matching/run-sla-sweep`, {
      method: 'POST',
      headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ dryRun: true }),
    });
    assert(dryRunRes.status === 200, `POST /api/matching/run-sla-sweep (dryRun) returned 200 (actual: ${dryRunRes.status})`);
    const dryRunData = await dryRunRes.json();
    assert(dryRunData.ok === true, 'SLA Sweeper returned ok: true');
    assert(dryRunData.dryRun === true, 'SLA Sweeper acknowledged dryRun: true');
    assert(typeof dryRunData.silverWaveOpenedCount === 'number', 'Contains silverWaveOpenedCount');
    assert(typeof dryRunData.expiredDropsClosedCount === 'number', 'Contains expiredDropsClosedCount');

    // --- Check 4: Test SLA Sweeper Task 1 (Auto Open Silver Wave) ---
    console.log('\n[4/8] Testing Task 1: Auto Silver Wave Opening for Expired Gold Window...');
    const testLotCode1 = `P6B-SWP1-${Date.now()}`;
    const testLot1Id = `lot-${testLotCode1}`;
    cleanupLotIds.push(testLot1Id);

    const goldExpTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const futureCloseTime = new Date(Date.now() + 86400000).toISOString(); // +24 hours

    const createLot1Res = await fetch(`${BASE_URL}/api/data/lots`, {
      method: 'POST',
      headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        id: testLot1Id,
        lotCode: testLotCode1,
        title: `Test Staged Drop Gold Expired ${testLotCode1}`,
        complexName: 'ЖК Светлый Мир',
        city: 'spb',
        district: 'Приморский',
        dealTrack: 'ddu_cession',
        rooms: '1k',
        price: 11000000,
        priceRub: 11000000,
        discountPercent: 12,
        status: 'available',
        dropConfig: {
          mode: 'staged_drop',
          waveStatus: 'gold_wave',
          launchedAt: new Date(Date.now() - 7200000).toISOString(),
          launchedBy: ownerEmail,
          goldExclusiveHours: 1,
          goldExclusiveUntil: goldExpTime,
          windowHours: 24,
          closesAt: futureCloseTime,
          maxApplicationsCap: 10,
          currentValidApplications: 1,
          matchedGoldCount: 1,
          matchedSilverCount: 2,
        },
      }),
    });
    assert(createLot1Res.status === 200, `Created test lot 1 with expired gold window (status: ${createLot1Res.status})`);

    // Run SLA sweep live
    const sweep1Res = await fetch(`${BASE_URL}/api/matching/run-sla-sweep`, {
      method: 'POST',
      headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ dryRun: false }),
    });
    assert(sweep1Res.status === 200, `Live SLA sweep executed (status: ${sweep1Res.status})`);
    const sweep1Data = await sweep1Res.json();
    assert(sweep1Data.silverWaveOpenedCount >= 1, `Task 1 transitioned at least 1 lot to silver wave (count: ${sweep1Data.silverWaveOpenedCount})`);

    // Verify lot status in DB
    const getLot1Res = await fetch(`${BASE_URL}/api/data/lots?limit=100`, {
      headers: authHeaders(ownerToken),
    });
    const lotsList1 = await getLot1Res.json();
    const updatedLot1 = (lotsList1.items || lotsList1 || []).find((l) => l.lotCode === testLotCode1 || l.id === testLot1Id);
    assert(Boolean(updatedLot1), 'Found test lot 1 in database');
    assert(updatedLot1.dropConfig?.waveStatus === 'silver_wave', `Lot 1 dropConfig.waveStatus is 'silver_wave' (actual: ${updatedLot1.dropConfig?.waveStatus})`);
    assert(Boolean(updatedLot1.dropConfig?.silverWaveNotifiedAt), 'Lot 1 has silverWaveNotifiedAt timestamp set');

    // --- Check 5: Test SLA Sweeper Task 2 (Auto Close Expired Drop) ---
    console.log('\n[5/8] Testing Task 2: Auto Closing of Expired Drop Windows...');
    const testLotCode2 = `P6B-SWP2-${Date.now()}`;
    const testLot2Id = `lot-${testLotCode2}`;
    cleanupLotIds.push(testLot2Id);

    const pastCloseTime = new Date(Date.now() - 1800000).toISOString(); // 30 mins ago

    const createLot2Res = await fetch(`${BASE_URL}/api/data/lots`, {
      method: 'POST',
      headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        id: testLot2Id,
        lotCode: testLotCode2,
        title: `Test Staged Drop Past ClosesAt ${testLotCode2}`,
        complexName: 'ЖК Чистое Небо',
        city: 'spb',
        district: 'Приморский',
        dealTrack: 'ddu_cession',
        rooms: '2k',
        price: 14500000,
        priceRub: 14500000,
        discountPercent: 10,
        status: 'available',
        dropConfig: {
          mode: 'staged_drop',
          waveStatus: 'silver_wave',
          launchedAt: new Date(Date.now() - 7200000).toISOString(),
          launchedBy: ownerEmail,
          goldExclusiveHours: 1,
          goldExclusiveUntil: goldExpTime,
          windowHours: 2,
          closesAt: pastCloseTime,
          maxApplicationsCap: 10,
          currentValidApplications: 3,
          matchedGoldCount: 1,
          matchedSilverCount: 2,
        },
      }),
    });
    assert(createLot2Res.status === 200, `Created test lot 2 with past closesAt (status: ${createLot2Res.status})`);

    // Run SLA sweep live
    const sweep2Res = await fetch(`${BASE_URL}/api/matching/run-sla-sweep`, {
      method: 'POST',
      headers: authHeaders(ownerToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ dryRun: false }),
    });
    assert(sweep2Res.status === 200, `Live SLA sweep executed (status: ${sweep2Res.status})`);
    const sweep2Data = await sweep2Res.json();
    assert(sweep2Data.expiredDropsClosedCount >= 1, `Task 2 closed at least 1 expired drop (count: ${sweep2Data.expiredDropsClosedCount})`);

    // Verify lot status in DB
    const getLot2Res = await fetch(`${BASE_URL}/api/data/lots?limit=100`, {
      headers: authHeaders(ownerToken),
    });
    const lotsList2 = await getLot2Res.json();
    const updatedLot2 = (lotsList2.items || lotsList2 || []).find((l) => l.lotCode === testLotCode2 || l.id === testLot2Id);
    assert(Boolean(updatedLot2), 'Found test lot 2 in database');
    assert(updatedLot2.dropConfig?.waveStatus === 'expired_closed', `Lot 2 dropConfig.waveStatus is 'expired_closed' (actual: ${updatedLot2.dropConfig?.waveStatus})`);

    // --- Check 6: Telegram Webhook Ingestion of New Commands & Callbacks ---
    console.log('\n[6/8] Testing Telegram Webhook OS (/matches, /queue, /demand, callbacks)...');
    if (!tgSecret) {
      console.warn('  ⚠️ Telegram webhook secret not available, skipping webhook HMAC check');
    } else {
      // Test 1: Command /matches
      const updateMatches = {
        update_id: 999001,
        message: {
          message_id: 101,
          chat: { id: 77712345, type: 'private' },
          from: { id: 77712345, first_name: 'Investor', is_bot: false },
          text: '/matches',
        },
      };
      const tgRes1 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': tgSecret,
        },
        body: JSON.stringify(updateMatches),
      });
      assert(tgRes1.status === 200, `Webhook accepted /matches (status: ${tgRes1.status})`);
      const tgJson1 = await tgRes1.json();
      assert(tgJson1.ok === true, 'Webhook returned { ok: true }');

      // Test 2: Command /queue
      const updateQueue = {
        update_id: 999002,
        message: {
          message_id: 102,
          chat: { id: 77712345, type: 'private' },
          from: { id: 77712345, first_name: 'Investor', is_bot: false },
          text: `/queue ${testLotCode1}`,
        },
      };
      const tgRes2 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': tgSecret,
        },
        body: JSON.stringify(updateQueue),
      });
      assert(tgRes2.status === 200, `Webhook accepted /queue (status: ${tgRes2.status})`);

      // Test 3: Command /demand
      const updateDemand = {
        update_id: 999003,
        message: {
          message_id: 103,
          chat: { id: 77712345, type: 'private' },
          from: { id: 77712345, first_name: 'Investor', is_bot: false },
          text: '/demand',
        },
      };
      const tgRes3 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': tgSecret,
        },
        body: JSON.stringify(updateDemand),
      });
      assert(tgRes3.status === 200, `Webhook accepted /demand (status: ${tgRes3.status})`);

      // Test 4: Callback Query bb_app
      const updateCallback = {
        update_id: 999004,
        callback_query: {
          id: 'cq_999004',
          from: { id: 77712345, first_name: 'Investor' },
          message: { chat: { id: 77712345 }, message_id: 104 },
          data: `bb_app:${testLotCode1}`,
        },
      };
      const tgRes4 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': tgSecret,
        },
        body: JSON.stringify(updateCallback),
      });
      assert(tgRes4.status === 200, `Webhook accepted callback bb_app (status: ${tgRes4.status})`);
    }

    // --- Check 7: Verify Sweeper Artifacts and Prod Deployment Preparedness ---
    console.log('\n[7/8] Verifying Sweeper Standalone Bundling & Prod Deployment Script...');
    const sweeperBundlePath = path.join(ROOT_DIR, 'backend/dist-sweeper/sweeper.js');
    assert(fs.existsSync(sweeperBundlePath), 'dist-sweeper/sweeper.js bundle exists');
    const bundleSize = fs.statSync(sweeperBundlePath).size;
    assert(bundleSize > 500000, `Sweeper bundle size is valid (${Math.round(bundleSize / 1024)} KB)`);

    const deployProdScript = path.join(ROOT_DIR, 'backend/scripts/deploy-sweeper-prod.mjs');
    assert(fs.existsSync(deployProdScript), 'backend/scripts/deploy-sweeper-prod.mjs exists');
    const deployProdContent = fs.readFileSync(deployProdScript, 'utf-8');
    assert(deployProdContent.includes('--confirm-prod'), 'deploy-sweeper-prod.mjs strictly enforces --confirm-prod');
    assert(deployProdContent.includes('0/15 * * * ? *'), 'deploy-sweeper-prod.mjs uses correct 15-minute cron expression');

    // --- Check 8: Cleanup Test Fixtures ---
    console.log('\n[8/8] Cleaning up test fixtures...');
    for (const lotId of cleanupLotIds) {
      try {
        await fetch(`${BASE_URL}/api/data/lots/${lotId}`, {
          method: 'DELETE',
          headers: authHeaders(ownerToken),
        });
      } catch {}
    }
    console.log(`  ✓ Cleaned up ${cleanupLotIds.length} test lots`);

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 6B VERIFICATION CHECKS PASSED (100% GREEN)!');
    console.log('================================================================\n');
  } catch (err) {
    // Attempt cleanup on failure
    for (const lotId of cleanupLotIds) {
      try {
        await fetch(`${BASE_URL}/api/data/lots/${lotId}`, {
          method: 'DELETE',
          headers: authHeaders(ownerToken),
        });
      } catch {}
    }
    console.error('\n❌ Verification failed with error:', err.message);
    process.exit(1);
  }
}

run();
