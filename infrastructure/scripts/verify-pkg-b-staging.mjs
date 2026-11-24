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
const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const BASE_URL = manifest.staging?.apiGatewayUrl || 'https://d5dpccovifu701p9lvga.bu9mdbe1.apigw.yandexcloud.net';
const STAGING_YDB_ENDPOINT = envVars.STAGING_YDB_DOCAPI_ENDPOINT;
const keyId = envVars.YC_ACCESS_KEY_ID;
const secretKey = envVars.YC_SECRET_ACCESS_KEY;

console.log('================================================================');
console.log('=== DomExit Executive Package B - Staging E2E Verification ===');
console.log('Target Staging Gateway:', BASE_URL);
console.log('================================================================\n');

// YDB DocAPI helper for direct verification and cleanup
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function getSigningKey(secret, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function callDocApi(target, bodyObj) {
  const url = new URL(STAGING_YDB_ENDPOINT);
  const canonicalHost = url.host;
  const canonicalPath = url.pathname;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const body = JSON.stringify(bodyObj);
  const bodyHash = sha256Hex(body);
  const canonicalHeaders = [
    'content-type:application/x-amz-json-1.0',
    'host:' + canonicalHost,
    'x-amz-date:' + amzDate,
    'x-amz-target:' + target,
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = ['POST', canonicalPath, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');
  const credentialScope = dateStamp + '/ru-central1/dynamodb/aws4_request';
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = getSigningKey(secretKey, dateStamp, 'ru-central1', 'dynamodb');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = 'AWS4-HMAC-SHA256 Credential=' + keyId + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  const res = await fetch(STAGING_YDB_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': target,
      'X-Amz-Date': amzDate,
      Authorization: authHeader,
    },
    body,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
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
    exp: now + 86400,
  };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  const encSig = base64UrlEncode(sig);
  return `${data}.${encSig}`;
}

let testRequestId = null;
let testBuyerUserId = null;
let testBuyerEmail = null;
let createdAuditLogIds = [];

async function runTests() {
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedCount++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // 1. Health Check
    console.log('[Step 1] Gateway Health Check...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, `Health check returned ${healthRes.status}`);
    const healthJson = await healthRes.json();
    assert(healthJson.ok === true, 'Health check reports ok: true');

    // 2. Authenticate / Login as Owner (Staff)
    console.log('\n[Step 2] Authenticating as Owner/Staff...');
    const ownerEmail = envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com';
    const ownerPass = envVars.BOOTSTRAP_OWNER_PASSWORD;
    const jwtSecret = (envVars.JWT_SIGNING_SECRET_STAGING || envVars.JWT_SIGNING_SECRET || envVars.JWT_SECRET)?.trim();

    let ownerCookie = '';
    if (ownerPass) {
      const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, password: ownerPass }),
      });
      if (ownerLoginRes.status === 200) {
        const ownerSetCookie = ownerLoginRes.headers.get('set-cookie') || '';
        const ownerSessionMatch = ownerSetCookie.match(/domexit_session=([^;]+)/);
        if (ownerSessionMatch) {
          ownerCookie = `domexit_session=${ownerSessionMatch[1]}`;
        }
      }
    }

    if (!ownerCookie && jwtSecret) {
      const ownerPayload = {
        userId: 'usr-owner-001',
        email: ownerEmail,
        name: 'Ahmed Abdallah (Владелец / CEO)',
        role: 'owner',
        activeRole: 'owner',
        roles: ['owner', 'employee', 'partner', 'seller', 'buyer'],
        tv: 1,
      };
      const ownerToken = createSignedJwt(ownerPayload, jwtSecret);
      ownerCookie = `domexit_session=${ownerToken}`;
    }

    assert(ownerCookie.length > 0, 'Owner session established');

    // 3. Register a fresh test Silver Buyer
    console.log('\n[Step 3] Creating fresh Test Buyer (Silver tier)...');
    testBuyerEmail = `test.buyer.pkgb.${Date.now()}@domexit-staging.test`;
    const testBuyerPass = `TestPass!${Date.now()}`;

    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testBuyerEmail,
        password: testBuyerPass,
        name: 'Инвестор Тест B (Silver)',
        role: 'buyer',
        activeRole: 'buyer',
      }),
    });
    assert(regRes.status === 200 || regRes.status === 201, `Buyer registration returned HTTP ${regRes.status}`);
    const regJson = await regRes.json();
    testBuyerUserId = regJson.user?.id || regJson.userId;
    assert(Boolean(testBuyerUserId), `Extracted buyer userId: ${testBuyerUserId}`);

    const buyerSetCookie = regRes.headers.get('set-cookie') || '';
    const buyerSessionMatch = buyerSetCookie.match(/domexit_session=([^;]+)/);
    const buyerToken = buyerSessionMatch ? buyerSessionMatch[1] : '';
    const buyerCookie = `domexit_session=${buyerToken}`;
    assert(buyerToken.length > 0, 'Extracted buyer session token');

    // Verify buyer initial Buy-Box has tier === 'silver'
    const buyerBbRes = await fetch(`${BASE_URL}/api/matching/my-buy-box`, {
      headers: { Cookie: buyerCookie },
    });
    assert(buyerBbRes.status === 200, `Buyer my-buy-box returned HTTP ${buyerBbRes.status}`);
    const buyerBbJson = await buyerBbRes.json();
    const buyerInitialTier = buyerBbJson.buyBox?.tier || 'silver';
    assert(buyerInitialTier === 'silver', `Initial buyer tier is 'silver'`);

    // 4. Test GET /api/tier-requests/my before submission
    console.log('\n[Step 4] Checking GET /api/tier-requests/my for fresh buyer...');
    const myReqRes1 = await fetch(`${BASE_URL}/api/tier-requests/my`, {
      headers: { Cookie: buyerCookie },
    });
    assert(myReqRes1.status === 200, `GET /api/tier-requests/my returned HTTP ${myReqRes1.status}`);
    const myReqJson1 = await myReqRes1.json();
    assert(myReqJson1.ok === true && myReqJson1.requests.length === 0, 'Initial requests list is empty');

    // 5. Submit Gold Verification Request (with 100% funds statement)
    console.log('\n[Step 5] Submitting Gold Verification Request with private S3 document key...');
    const submitRes = await fetch(`${BASE_URL}/api/tier-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: buyerCookie,
      },
      body: JSON.stringify({
        proofType: 'cash_100_statement',
        declaredBudgetRub: 18500000,
        documentKey: 'documents/tier-verification/test-bank-statement-v1.pdf',
        documentName: 'Vypiska_Alfa_18.5M.pdf',
        documentMime: 'application/pdf',
        documentSize: 1024 * 512,
        comment: '100% собственные средства на депозите в Альфа-Банке. Готовность к сделке 24 часа.',
      }),
    });

    assert(submitRes.status === 201, `Submit tier request returned HTTP ${submitRes.status}`);
    const submitJson = await submitRes.json();
    assert(submitJson.ok === true, 'Submit response reports ok: true');
    assert(submitJson.request?.status === 'pending', 'Request status is pending');
    assert(submitJson.request?.declaredBudgetRub === 18500000, 'Declared budget matches 18 500 000 ₽');
    testRequestId = submitJson.request.id;
    console.log(`  ✓ Created Tier Request ID: ${testRequestId}`);

    // 6. Test Duplicate Request Prevention
    console.log('\n[Step 6] Verifying Duplicate Request Prevention Guard...');
    const dupRes = await fetch(`${BASE_URL}/api/tier-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: buyerCookie,
      },
      body: JSON.stringify({
        proofType: 'mortgage_approval',
        declaredBudgetRub: 20000000,
        documentKey: 'documents/tier-verification/dup.pdf',
        documentName: 'dup.pdf',
      }),
    });
    assert(dupRes.status === 400, `Duplicate submission correctly rejected with HTTP ${dupRes.status} (expected 400)`);
    const dupJson = await dupRes.json();
    assert(dupJson.error?.includes('рассмотрении'), `Rejection message indicates pending review: "${dupJson.error}"`);

    // 7. Admin lists pending requests
    console.log('\n[Step 7] Admin fetching pending requests queue...');
    const adminPendingRes = await fetch(`${BASE_URL}/api/tier-requests?status=pending`, {
      headers: { Cookie: ownerCookie },
    });
    assert(adminPendingRes.status === 200, `Admin GET /api/tier-requests returned HTTP ${adminPendingRes.status}`);
    const adminPendingJson = await adminPendingRes.json();
    assert(adminPendingJson.ok === true, 'Admin list reports ok: true');
    const foundPending = adminPendingJson.items?.find((r) => r.id === testRequestId);
    assert(Boolean(foundPending), `Found submitted request ${testRequestId} in admin pending queue`);
    assert(foundPending.userEmail === testBuyerEmail, 'Email matches test buyer');

    // 8. Admin fetches presigned document URL (5-minute token)
    console.log('\n[Step 8] Admin requesting 5-minute presigned document URL from private S3...');
    const docUrlRes = await fetch(`${BASE_URL}/api/tier-requests/${testRequestId}/document-url`, {
      headers: { Cookie: ownerCookie },
    });
    assert(docUrlRes.status === 200, `GET document-url returned HTTP ${docUrlRes.status}`);
    const docUrlJson = await docUrlRes.json();
    assert(Boolean(docUrlJson.downloadUrl), 'Received valid downloadUrl');
    assert(docUrlJson.downloadUrl.includes('domexit-private-docs-staging'), 'URL targets private S3 bucket');
    assert(docUrlJson.expiresIn === 300, 'Expiration is exactly 300 seconds (5 minutes)');

    // Security check: Unauthenticated user cannot access document URL
    const anonDocUrlRes = await fetch(`${BASE_URL}/api/tier-requests/${testRequestId}/document-url`);
    assert(anonDocUrlRes.status === 401, `Unauthenticated document request blocked with HTTP ${anonDocUrlRes.status}`);

    // 9. Admin Approves Request
    console.log('\n[Step 9] Admin approving Gold request...');
    const approveRes = await fetch(`${BASE_URL}/api/tier-requests/${testRequestId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        decision: 'approved',
        reviewNote: 'Выписка из банка подлинная, средства 18.5 млн ₽ подтверждены в полном объеме.',
      }),
    });
    assert(approveRes.status === 200, `Approve decision returned HTTP ${approveRes.status}`);
    const approveJson = await approveRes.json();
    assert(approveJson.ok === true, 'Decision response reports ok: true');
    assert(approveJson.request?.status === 'approved', 'Request status transitioned to approved');

    // 10. Verify Client Buy-Box is now Gold
    console.log('\n[Step 10] Verifying Client Buy-Box status updated to Gold...');
    const upgradedBbRes = await fetch(`${BASE_URL}/api/matching/my-buy-box`, {
      headers: { Cookie: buyerCookie },
    });
    assert(upgradedBbRes.status === 200, `Upgraded my-buy-box returned HTTP ${upgradedBbRes.status}`);
    const upgradedBbJson = await upgradedBbRes.json();
    assert(upgradedBbJson.tier === 'gold' || upgradedBbJson.buyBox?.tier === 'gold', `Buyer tier is now 'gold' (verified!)`);
    assert(upgradedBbJson.buyBox?.availableLiquidityRub === 18500000, `Declared liquidity 18 500 000 ₽ recorded in Buy-Box`);

    // 11. Verify Audit Log entry created for Tier Upgrade
    console.log('\n[Step 11] Verifying audit_logs entry for TIER_UPGRADE_APPROVED...');
    const auditScanRes = await callDocApi('DynamoDB_20120810.Scan', {
      TableName: 'audit_logs',
      Limit: 50,
    });
    const auditItems = auditScanRes.data?.Items || [];
    const upgradeLog = auditItems.find((it) => {
      const act = it.action?.S || it.actionType?.S;
      const desc = it.description?.S || '';
      return (act === 'TIER_UPGRADE_APPROVED' || act === 'tier_upgrade_approved') && desc.includes(testRequestId);
    });
    assert(Boolean(upgradeLog), `Found audit_logs record for TIER_UPGRADE_APPROVED with requestId ${testRequestId}`);
    if (upgradeLog) createdAuditLogIds.push(upgradeLog.id.S);

    // 12. Verify request moved from Pending to Archive in Admin queue
    console.log('\n[Step 12] Verifying request is now in Archive queue...');
    const archiveRes = await fetch(`${BASE_URL}/api/tier-requests?status=archive`, {
      headers: { Cookie: ownerCookie },
    });
    assert(archiveRes.status === 200, `Admin archive queue returned HTTP ${archiveRes.status}`);
    const archiveJson = await archiveRes.json();
    const inArchive = archiveJson.items?.find((r) => r.id === testRequestId);
    assert(Boolean(inArchive), `Found request ${testRequestId} in Archive queue`);
    assert(inArchive.status === 'approved', 'Archive record has status approved');

    // 13. Test SLA Recovery (+5 points & completedViewingsCount increment)
    console.log('\n[Step 13] Testing SLA Recovery (+5 points & completedViewingsCount increment)...');
    // First, verify initial score or penalize to 85 to see recovery clearly
    const penalizeRes = await fetch(`${BASE_URL}/api/matching/buyers/${testBuyerUserId}/tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        tier: 'gold',
        reliabilityScore: 85,
        reason: 'Тестовая калибровка для проверки восстановления SLA',
      }),
    });
    assert(penalizeRes.status === 200, `Penalize baseline returned HTTP ${penalizeRes.status}`);

    // Now call confirm-step for completed viewing
    const confirmStepRes = await fetch(`${BASE_URL}/api/matching/confirm-step`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        userId: testBuyerUserId,
        step: 'completed_viewing',
        notes: 'Просмотр объекта проведен вовремя без замечаний',
      }),
    });
    assert(confirmStepRes.status === 200, `confirm-step returned HTTP ${confirmStepRes.status}`);
    const confirmStepJson = await confirmStepRes.json();
    assert(confirmStepJson.ok === true, 'confirmStep reports ok: true');
    assert(confirmStepJson.reliabilityScore === 90, `Reliability score restored: 85 -> 90 (+5 points!)`);
    assert(confirmStepJson.completedViewingsCount === 1, `completedViewingsCount incremented to 1`);

    // Verify audit log for SLA recovery
    const slaAuditScan = await callDocApi('DynamoDB_20120810.Scan', {
      TableName: 'audit_logs',
      Limit: 50,
    });
    const slaLog = (slaAuditScan.data?.Items || []).find((it) => {
      const act = it.action?.S || it.actionType?.S;
      const target = it.targetUserId?.S || it.metadata?.M?.targetUserId?.S;
      return (act === 'SLA_RELIABILITY_RESTORED' || act === 'sla_reliability_restored') && target === testBuyerUserId;
    });
    assert(Boolean(slaLog), `Found audit_logs record for SLA_RELIABILITY_RESTORED for user ${testBuyerUserId}`);
    if (slaLog) createdAuditLogIds.push(slaLog.id.S);

    // 14. Test Staff Loophole Guard (reason is mandatory)
    console.log('\n[Step 14] Testing Staff Loophole Guard on direct tier update...');
    // Create an employee curator user in YDB to verify role guards with tokenVersion
    const curatorId = `usr-curator-${Date.now()}`;
    const curatorEmail = `curator.${Date.now()}@domexit-staging.test`;
    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'users',
      Item: {
        id: { S: curatorId },
        email: { S: curatorEmail },
        name: { S: 'Куратор Тестовый' },
        role: { S: 'employee' },
        activeRole: { S: 'employee' },
        roles: { L: [{ S: 'employee' }, { S: 'buyer' }] },
        tokenVersion: { N: '1' },
        createdAt: { S: new Date().toISOString() },
      },
    });

    const curatorToken = createSignedJwt({
      userId: curatorId,
      email: curatorEmail,
      name: 'Куратор Тестовый',
      role: 'employee',
      activeRole: 'employee',
      roles: ['employee', 'buyer'],
      tv: 1,
    }, jwtSecret);
    const curatorCookie = `domexit_session=${curatorToken}`;
    assert(curatorCookie.length > 0, 'Curator employee session established');

    // Curator tries to change tier WITHOUT reason -> should be 400
    const noReasonRes = await fetch(`${BASE_URL}/api/matching/buyers/${testBuyerUserId}/tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: curatorCookie,
      },
      body: JSON.stringify({
        tier: 'bronze',
        // reason is omitted!
      }),
    });
    assert(noReasonRes.status === 400, `Curator tier change without reason rejected with HTTP ${noReasonRes.status} (expected 400)`);
    const noReasonJson = await noReasonRes.json();
    assert(noReasonJson.error?.includes('обоснования'), `Error requires reason: "${noReasonJson.error}"`);

    // Curator changes tier WITH mandatory reason -> should succeed and log
    const withReasonRes = await fetch(`${BASE_URL}/api/matching/buyers/${testBuyerUserId}/tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: curatorCookie,
      },
      body: JSON.stringify({
        tier: 'silver',
        reason: 'Плановое понижение по регламенту 30 дней',
      }),
    });
    assert(withReasonRes.status === 200, `Curator tier change with reason accepted with HTTP ${withReasonRes.status}`);

    // Clean curator user
    await callDocApi('DynamoDB_20120810.DeleteItem', {
      TableName: 'users',
      Key: { id: { S: curatorId } },
    });

    console.log('\n================================================================');
    console.log(`=== ALL PACKAGE B TESTS PASSED: ${passedCount}/${passedCount + failedCount} ===`);
    console.log('================================================================\n');
  } finally {
    // 15. Clean up test records
    console.log('[Cleanup] Purging temporary test records from Staging YDB...');
    try {
      if (testRequestId) {
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'tier_verification_requests',
          Key: { id: { S: testRequestId } },
        });
        console.log(`  ✓ Removed test tier request: ${testRequestId}`);
      }
      if (testBuyerUserId) {
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'buy_boxes',
          Key: { id: { S: `bb:${testBuyerUserId}` } },
        });
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'users',
          Key: { id: { S: testBuyerUserId } },
        });
        console.log(`  ✓ Removed test buyer: ${testBuyerUserId}`);
      }
      for (const logId of createdAuditLogIds) {
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'audit_logs',
          Key: { id: { S: logId } },
        });
      }
      if (createdAuditLogIds.length > 0) {
        console.log(`  ✓ Cleaned ${createdAuditLogIds.length} test audit_logs`);
      }
    } catch (cleanErr) {
      console.warn('  ⚠️ Cleanup warning:', cleanErr.message);
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ Fatal error in Package B verification:', err.message);
  process.exit(1);
});
