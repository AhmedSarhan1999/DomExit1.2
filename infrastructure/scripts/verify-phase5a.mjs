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
console.log(`=== Phase 5A Live Verification Suite [${targetEnv.toUpperCase()}] ===`);
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
  let ownerToken = '';
  let buyerToken = '';
  const testBuyerEmail = `test_p5a_${Date.now()}@domexit.test`;
  const testPassword = 'TestPassword123!';

  // Step 1: Owner Login
  console.log('[1/7] Authenticating Platform Owner...');
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/domexit_session=([^;]+)/);
      if (match) ownerToken = match[1];
    }
    const data = await loginRes.json();
    assert(loginRes.status === 200 && data.user?.role === 'owner', `Owner login successful (status=${loginRes.status}, role=${data.user?.role})`);
  } catch (err) {
    assert(false, `Owner authentication failed: ${err.message}`);
  }

  // Step 2: Test Admin Governance & Health Endpoints
  console.log('\n[2/7] Testing Admin Governance & System Health Endpoints...');
  try {
    // 2a. System Health
    const healthRes = await fetch(`${BASE_URL}/api/admin/system-health`, {
      headers: { Cookie: `domexit_session=${ownerToken}` },
    });
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, `GET /api/admin/system-health returns 200`);
    assert(healthData.ydb && typeof healthData.ydb.latencyMs === 'number', `YDB health monitored with latency (${healthData.ydb?.latencyMs}ms)`);
    assert(healthData.storage && healthData.storage.publicBucketOk && healthData.storage.privateBucketOk, `Storage buckets verified healthy`);
    assert(healthData.backups && typeof healthData.backups.totalDailyBackups === 'number', `Backups metadata accessible (daily count=${healthData.backups?.totalDailyBackups})`);

    // 2b. Backups List
    const backupsRes = await fetch(`${BASE_URL}/api/admin/backups`, {
      headers: { Cookie: `domexit_session=${ownerToken}` },
    });
    const backupsData = await backupsRes.json();
    assert(backupsRes.status === 200 && Array.isArray(backupsData.backups), `GET /api/admin/backups returns valid list (total=${backupsData.total})`);

    // 2c. Security Incidents (Owner Only)
    const incRes = await fetch(`${BASE_URL}/api/data/security_incidents`, {
      headers: { Cookie: `domexit_session=${ownerToken}` },
    });
    const incData = await incRes.json();
    assert(incRes.status === 200 && Array.isArray(incData.items), `GET /api/data/security_incidents returns 200 for Owner`);

    // 2d. Security Incidents Forbidden for Anonymous
    const anonIncRes = await fetch(`${BASE_URL}/api/data/security_incidents`);
    assert(anonIncRes.status === 401 || anonIncRes.status === 403, `GET /api/data/security_incidents blocked for visitor (status=${anonIncRes.status})`);
  } catch (err) {
    assert(false, `Admin governance check failed: ${err.message}`);
  }

  // If in Read-Only mode on production, test validation rejections directly without creating permanent buyer
  console.log('\n[3/7] Testing Input Validation & Dangerous Payload Rejection...');
  try {
    // 3a. XSS & Injection Rejection
    const xssRes = await fetch(`${BASE_URL}/api/data/seller_requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: '<script>alert("hack")</script>',
        contractPriceRub: 15000000,
        paidAmountRub: 5000000,
      }),
    });
    const xssData = await xssRes.json();
    assert(xssRes.status === 400 && xssData.code === 'xss_or_injection_attempt', `XSS malicious payload rejected with 400 & code xss_or_injection_attempt`);

    // 3b. Floor Constraint Rejection (floor > totalFloors)
    const floorRes = await fetch(`${BASE_URL}/api/data/seller_requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floor: 25,
        totalFloors: 10,
        contractPriceRub: 15000000,
        paidAmountRub: 5000000,
      }),
    });
    assert(floorRes.status === 400, `Invalid floor constraint (floor 25 > 10) rejected with 400`);

    // 3c. DDU Price Bounds Rejection (< 1,000,000)
    const priceRes = await fetch(`${BASE_URL}/api/data/seller_requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractPriceRub: 500,
        paidAmountRub: 100,
      }),
    });
    assert(priceRes.status === 400, `Contract price below 1,000,000 ₽ rejected with 400`);

    // 3d. Paid amount > Contract price Rejection
    const overPaidRes = await fetch(`${BASE_URL}/api/data/seller_requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractPriceRub: 10000000,
        paidAmountRub: 20000000,
      }),
    });
    assert(overPaidRes.status === 400, `Paid amount exceeding contract price rejected with 400`);
  } catch (err) {
    assert(false, `Payload validation check failed: ${err.message}`);
  }

  console.log('\n[4/7] Testing Non-Existent Lot Bid & Anonymous Gates...');
  try {
    const fakeLotRes = await fetch(`${BASE_URL}/api/data/buyer_applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lotCode: 'NON-EXISTENT-LOT-99999',
        availableLiquidity: 10000000,
      }),
    });
    assert(fakeLotRes.status === 404 || fakeLotRes.status === 401 || fakeLotRes.status === 400, `Bid on non-existent lot returned ${fakeLotRes.status} (expected 404/401/400)`);
  } catch (err) {
    assert(false, `Non-existent lot test failed: ${err.message}`);
  }

  // Create temporary buyer on staging for role-specific tests
  if (!isReadOnly) {
    console.log('\n[5/7] Testing Role Quotas & Privilege Escalation Guards...');
    try {
      // Register temporary test buyer
      const randomIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
      const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': randomIp },
        body: JSON.stringify({
          email: testBuyerEmail,
          password: testPassword,
          name: 'Test Phase5A Buyer',
          role: 'buyer',
        }),
      });
      const regCookie = regRes.headers.get('set-cookie');
      if (regCookie) {
        const m = regCookie.match(/domexit_session=([^;]+)/);
        if (m) buyerToken = m[1];
      }
      assert(regRes.status === 201 && buyerToken, `Registered test buyer ${testBuyerEmail}`);

      // 5a. Privilege Escalation Guard
      const privRes = await fetch(`${BASE_URL}/api/data/lots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `domexit_session=${buyerToken}`,
        },
        body: JSON.stringify({
          title: 'Fake Owner Lot',
          role: 'owner',
          isApproved: true,
          dduContractPrice: 10000000,
          cashPaidBySeller: 5000000,
        }),
      });
      const privData = await privRes.json();
      assert(privRes.status === 403 && privData.code === 'privilege_tampering', `Privilege escalation (role: owner) blocked with 403 & code privilege_tampering`);

      // 5b. Chat Contact Leak Guard
      const leakMsgRes = await fetch(`${BASE_URL}/api/data/curator_messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `domexit_session=${buyerToken}`,
        },
        body: JSON.stringify({
          text: 'Позвоните мне срочно на +7 (999) 123-45-67 или пишите в t.me/my_direct_telegram',
          lotCode: 'TEST-LOT',
        }),
      });
      const leakData = await leakMsgRes.json();
      assert(leakMsgRes.status === 400 && leakData.code === 'chat_contact_leak_attempt', `Chat contact leak blocked with 400 & code chat_contact_leak_attempt`);

      // 5c. Chat Legitimate Message (No false positive on prices or DDU)
      const validMsgRes = await fetch(`${BASE_URL}/api/data/curator_messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `domexit_session=${buyerToken}`,
        },
        body: JSON.stringify({
          text: 'Здравствуйте! Интересует лот за 10 500 000 рублей по договору ДДУ 78-123456.',
          lotCode: 'TEST-LOT',
        }),
      });
      assert(validMsgRes.status === 200, `Legitimate message with financial prices and DDU accepted (status 200, no false leak alarm)`);

      // 5d. Storage Upload Quota check
      const uploadQuotaRes = await fetch(`${BASE_URL}/api/storage/presign-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `domexit_session=${buyerToken}`,
        },
        body: JSON.stringify({
          scope: 'photo',
          fileName: 'test.jpg',
          contentType: 'image/jpeg',
          fileSize: 1024,
        }),
      });
      assert(uploadQuotaRes.status === 200, `Storage presign-upload allowed within quota`);
    } catch (err) {
      assert(false, `Role quota and guard check failed: ${err.message}`);
    }

    console.log('\n[6/7] Verifying Security Incident Recorded in YDB...');
    try {
      const incRes = await fetch(`${BASE_URL}/api/data/security_incidents`, {
        headers: { Cookie: `domexit_session=${ownerToken}` },
      });
      const incData = await incRes.json();
      const items = incData.items || [];
      const foundPrivIncident = items.find((i) => i.type === 'privilege_tampering');
      const foundXssIncident = items.find((i) => i.type === 'xss_or_injection_attempt');
      const foundLeakIncident = items.find((i) => i.type === 'chat_contact_leak_attempt');

      assert(Boolean(foundPrivIncident), `Incident 'privilege_tampering' recorded in security_incidents`);
      assert(Boolean(foundXssIncident), `Incident 'xss_or_injection_attempt' recorded in security_incidents`);
      assert(Boolean(foundLeakIncident), `Incident 'chat_contact_leak_attempt' recorded in security_incidents`);
    } catch (err) {
      assert(false, `Security incidents verification failed: ${err.message}`);
    }

    console.log('\n[7/7] Cleaning up test records...');
    try {
      // Find created test user and delete
      const usersRes = await fetch(`${BASE_URL}/api/data/users`, {
        headers: { Cookie: `domexit_session=${ownerToken}` },
      });
      const usersData = await usersRes.json();
      const testUser = (usersData.items || []).find((u) => u.email === testBuyerEmail);
      if (testUser?.id) {
        await fetch(`${BASE_URL}/api/data/users/${testUser.id}`, {
          method: 'DELETE',
          headers: { Cookie: `domexit_session=${ownerToken}` },
        });
        console.log(`  ✓ Cleaned up test user ${testBuyerEmail}`);
      }
    } catch (cleanErr) {
      console.warn('  ⚠ Cleanup notice:', cleanErr.message);
    }
  } else {
    console.log('\n[5-7/7] Skipped mutation tests (Read-Only Mode active).');
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log(`🎉 ALL PHASE 5A VERIFICATION CHECKS PASSED ON ${targetEnv.toUpperCase()}!`);
  } else {
    console.error(`❌ SOME PHASE 5A CHECKS FAILED ON ${targetEnv.toUpperCase()}!`);
    process.exit(1);
  }
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal error during Phase 5A verification:', err);
  process.exit(1);
});
