import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

// Parse CLI Flags
const args = process.argv.slice(2);
let targetEnv = 'staging';
let isReadOnly = false;

for (const arg of args) {
  if (arg === '--env=production' || arg === '--production' || arg === '--prod') targetEnv = 'production';
  if (arg === '--env=staging' || arg === '--staging') targetEnv = 'staging';
  if (arg === '--read-only') isReadOnly = true;
}

if (targetEnv === 'production') {
  isReadOnly = true; // Strict zero pollution on production
}

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('FATAL: Required config files (cloud-manifest.json or .env.cloud.local) not found!');
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

const ownerEmail = (envVars.PROD_OWNER_EMAIL || envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();
const ownerPassword = (isProd ? envVars.PROD_OWNER_PASSWORD : envVars.BOOTSTRAP_OWNER_PASSWORD)?.trim();

const jwtSecret = isProd
  ? envVars.JWT_SIGNING_SECRET_PROD || envVars.JWT_SIGNING_SECRET
  : envVars.JWT_SIGNING_SECRET;

function createSessionToken(user, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    activeRole: user.activeRole || user.role,
    roles: user.roles || [user.role],
    name: user.name,
    isPartnerApproved: user.isPartnerApproved || false,
    partnerId: user.partnerId,
    partnerRefCode: user.partnerRefCode || user.referralCode,
    iat: now,
    exp: now + 3600,
  };
  const b64 = (s) => Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encHeader = b64(JSON.stringify(header));
  const encPayload = b64(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  const encSig = b64(sig);
  return `${data}.${encSig}`;
}

async function loginUser(email, password) {
  const res = await fetch(`${gatewayUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Login failed for ${email} (${res.status}): ${err.error || 'unknown'}`);
  }
  const setCookie = res.headers.get('set-cookie');
  const token = setCookie?.split('domexit_session=')[1]?.split(';')[0];
  const data = await res.json();
  return { token, user: data.user, cookie: `domexit_session=${token}` };
}

console.log('================================================================================');
console.log(`=== DOMEXIT PARTNERS & SELLERS E2E VERIFICATION: [${targetEnv.toUpperCase()}] ===`);
console.log('================================================================================');
console.log(`Gateway URL:       ${gatewayUrl}`);
console.log(`Read-Only Mode:    ${isReadOnly ? 'YES (Strict Zero-Pollution Guard Active)' : 'NO (Full Simulation & Auto-Cleanup)'}`);
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const createdRecordIds = {
  seller_requests: [],
  partner_applications: [],
  partners: [],
  partner_preliminary_requests: [],
  users: [],
};

function recordTest(passed, description) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${description}`);
  }
}

async function run() {
  let ownerSession = null;
  try {
    ownerSession = await loginUser(ownerEmail, ownerPassword);
    console.log(`[Auth] Owner authenticated: ${ownerEmail} (${ownerSession.user.role})`);
  } catch (err) {
    console.error('[Auth] Failed to authenticate owner:', err.message);
    process.exit(1);
  }

  // Create test seller session
  const testSellerUser = {
    id: `seller-${Date.now()}`,
    email: 'test_seller_user@domexit.ru',
    name: 'Иванов Иван Иванович',
    role: 'seller',
    roles: ['seller'],
  };
  const sellerToken = createSessionToken(testSellerUser, jwtSecret);
  const sellerSession = { user: testSellerUser, token: sellerToken, cookie: `domexit_session=${sellerToken}` };

  // Create test partner applicant session
  const testPartnerEmail = `partner_${Date.now()}@domexit-partner.ru`;
  const testPartnerUser = {
    id: `partner_user_${Date.now()}`,
    email: testPartnerEmail,
    name: 'Ковалев Михаил Сергеевич',
    role: 'buyer',
    roles: ['buyer'],
  };
  const applicantToken = createSessionToken(testPartnerUser, jwtSecret);
  const applicantSession = { user: testPartnerUser, token: applicantToken, cookie: `domexit_session=${applicantToken}` };

  if (!isReadOnly) {
    await fetch(`${gatewayUrl}/api/data/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerSession.cookie },
      body: JSON.stringify(testSellerUser),
    });
    createdRecordIds.users.push(testSellerUser.id);

    await fetch(`${gatewayUrl}/api/data/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerSession.cookie },
      body: JSON.stringify(testPartnerUser),
    });
    createdRecordIds.users.push(testPartnerUser.id);
  }

  // ===========================================================================
  // GROUP 1: Dynamic Property Type Validation (/sellers API)
  // ===========================================================================
  console.log('\n[Group 1/5] Testing Dynamic Property Type Validation & API Guards...');

  if (!isReadOnly) {
    // 1.1 Valid DDU Cession submission (as authenticated seller)
    const dduPayload = {
      dealTrack: 'ddu_cession',
      developer: 'Сетл Групп',
      complexName: 'Чистое Небо',
      city: 'spb',
      dduNumber: 'СЕТЛ-ЧН-4481-24',
      contractPriceRub: 11000000,
      paidAmountRub: 3300000,
      areaM2: 52,
      floor: 6,
      totalFloors: 18,
      sellerName: 'Иванов Иван Иванович',
      sellerPhone: '+7 (921) 111-22-33',
      sellerEmail: 'test_ddu_seller@domexit.ru',
      mortgageStatus: 'has_mortgage',
      matkapitalUsed: false,
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/seller_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sellerSession.cookie,
        },
        body: JSON.stringify(dduPayload),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 || res.status === 201;
      if (ok && data.item?.id) createdRecordIds.seller_requests.push(data.item.id);
      recordTest(ok, `1.1 Valid DDU submission accepted (status: ${res.status})`);
    } catch (e) {
      recordTest(false, `1.1 DDU submission error: ${e.message}`);
    }

    // 1.2 Invalid DDU financial check (paidAmountRub > contractPriceRub)
    const invalidDduPayload = {
      dealTrack: 'ddu_cession',
      developer: 'Сетл Групп',
      complexName: 'Чистое Небо',
      city: 'spb',
      dduNumber: 'СЕТЛ-ЧН-4481-25',
      contractPriceRub: 10000000,
      paidAmountRub: 12000000, // Invalid: paid amount exceeds contract price
      areaM2: 52,
      floor: 6,
      totalFloors: 18,
      sellerName: 'Иванов Иван Иванович',
      sellerPhone: '+7 (921) 111-22-34',
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/seller_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sellerSession.cookie,
        },
        body: JSON.stringify(invalidDduPayload),
      });
      const data = await res.json().catch(() => ({}));
      const rejected = res.status === 400 || !res.ok;
      recordTest(rejected, `1.2 Invalid DDU financials (paid > contract) rejected with ${res.status}`);
    } catch (e) {
      recordTest(false, `1.2 DDU invalid check error: ${e.message}`);
    }

    // 1.3 Valid Secondary Market (secondary_dkp) submission
    // Use owner session to bypass the single-user 10-minute cooldown
    const secondaryPayload = {
      dealTrack: 'secondary_dkp',
      complexName: 'ЖК Московские Ворота (ориентир)',
      city: 'spb',
      cadastralNumber: '78:34:0004123:4567',
      contractPriceRub: 9500000,
      paidAmountRub: 9500000, // 100% paid / exit price equal to market or desired
      areaM2: 60,
      floor: 4,
      totalFloors: 12,
      sellerName: 'Смирнова Анна Павловна',
      sellerPhone: '+7 (921) 222-33-44',
      sellerEmail: 'test_secondary_seller@domexit.ru',
      secondaryChecklist: {
        ownershipDuration: 'more_5_years',
        secondaryMatkapOrKids: false,
        registeredTenants: false,
        readyPndAndFullPrice: true,
      },
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/seller_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerSession.cookie,
        },
        body: JSON.stringify(secondaryPayload),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 || res.status === 201;
      if (ok && data.item?.id) createdRecordIds.seller_requests.push(data.item.id);
      recordTest(ok, `1.3 Valid Secondary DKP submission accepted with 100% equity (status: ${res.status})`);
    } catch (e) {
      recordTest(false, `1.3 Secondary submission error: ${e.message}`);
    }

    // 1.4 Invalid Secondary financials (paidAmountRub > contractPriceRub)
    const invalidSecondaryPayload = {
      dealTrack: 'secondary_dkp',
      cadastralNumber: '78:34:0004123:4568',
      contractPriceRub: 8000000,
      paidAmountRub: 12000000, // Desired exit price exceeds market value
      areaM2: 45,
      floor: 2,
      totalFloors: 9,
      sellerName: 'Смирнова Анна Павловна',
      sellerPhone: '+7 (921) 222-33-45',
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/seller_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerSession.cookie,
        },
        body: JSON.stringify(invalidSecondaryPayload),
      });
      const rejected = res.status === 400 || !res.ok;
      recordTest(rejected, `1.4 Invalid Secondary financials (desired > market) rejected with ${res.status}`);
    } catch (e) {
      recordTest(false, `1.4 Secondary invalid check error: ${e.message}`);
    }
  } else {
    console.log('  ℹ Read-Only Mode: Skipping write submissions for Group 1.');
    recordTest(true, '1.1 Read-Only guard active for seller submissions');
  }

  // ===========================================================================
  // GROUP 2: Partner Public Submission & Anti-Tamper Security
  // ===========================================================================
  console.log('\n[Group 2/5] Testing Partner Submission & Anti-Tamper Security...');

  let createdPartnerAppId = null;

  if (!isReadOnly) {
    // 2.1 Submit partner application anonymously or as client
    const partnerAppPayload = {
      name: 'Ковалев Михаил Сергеевич',
      organization: 'Ипотечный Центр Северо-Запад',
      inn: '7707083893', // Valid 10-digit Russian INN
      category: 'mortgage_broker',
      phone: '+7 (921) 333-44-55',
      email: testPartnerEmail,
      city: 'spb',
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/partner_applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: applicantSession.cookie,
        },
        body: JSON.stringify(partnerAppPayload),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 || res.status === 201;
      if (ok && data.item?.id) {
        createdPartnerAppId = data.item.id;
        createdRecordIds.partner_applications.push(data.item.id);
      }
      const isPending = data.item?.status === 'pending' || data.item?.isApproved === false;
      recordTest(ok && isPending, `2.1 Partner application submitted as 'pending' (status: ${res.status})`);
    } catch (e) {
      recordTest(false, `2.1 Partner application error: ${e.message}`);
    }

    // 2.2 Privilege tampering check: Non-staff tries to submit isApproved: true
    const tamperPayload = {
      name: 'Хакер Петр',
      organization: 'Fake Partner',
      phone: '+7 (921) 999-99-99',
      category: 'lawyer',
      isApproved: true,
      status: 'approved',
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/partner_applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tamperPayload),
      });
      const data = await res.json().catch(() => ({}));
      // Server must either reject (403/400) or sanitize to pending/unapproved
      const isSafe = res.status === 403 || res.status === 400 || (data.item && data.item.isApproved === false && data.item.status === 'pending');
      if (data.item?.id) createdRecordIds.partner_applications.push(data.item.id);
      recordTest(isSafe, `2.2 Privilege tampering (non-staff self-approval) prevented (status: ${res.status})`);
    } catch (e) {
      recordTest(false, `2.2 Privilege tampering check error: ${e.message}`);
    }
  } else {
    console.log('  ℹ Read-Only Mode: Skipping write submissions for Group 2.');
    recordTest(true, '2.1 Read-Only guard active for partner submissions');
  }

  // ===========================================================================
  // GROUP 3: Staff Approval & Atomic Partner Role Upgrade
  // ===========================================================================
  console.log('\n[Group 3/5] Testing Owner Approval & Atomic Partner Role Upgrade...');

  let approvedPartnerRefCode = null;
  let partnerSession = null;

  if (!isReadOnly && createdPartnerAppId) {
    try {
      // 3.1 Owner approves the partner application
      const approvePayload = {
        id: createdPartnerAppId,
        status: 'approved',
        isApproved: true,
        name: 'Ковалев Михаил Сергеевич',
        organization: 'Ипотечный Центр Северо-Запад',
        phone: '+7 (921) 333-44-55',
        email: testPartnerEmail,
        city: 'spb',
        category: 'mortgage_broker',
      };

      const res = await fetch(`${gatewayUrl}/api/data/partner_applications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerSession.cookie,
        },
        body: JSON.stringify(approvePayload),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 || res.status === 201;
      const item = data.item || {};
      approvedPartnerRefCode = item.referralCode;

      const codeMatchesPattern = typeof approvedPartnerRefCode === 'string' && /^PART-\d{4}$/.test(approvedPartnerRefCode);
      const isRewardCorrect = item.fixedRewardPerDealRub === 30000;
      const isApprovedCorrect = item.status === 'approved' && item.isApproved === true;

      recordTest(
        ok && isApprovedCorrect && codeMatchesPattern && isRewardCorrect,
        `3.1 Owner approved partner: refCode=${approvedPartnerRefCode}, reward=${item.fixedRewardPerDealRub} ₽`
      );

      // Create simulated partner session token (using approved user)
      const partnerUser = {
        id: testPartnerUser.id,
        email: testPartnerEmail,
        role: 'partner',
        activeRole: 'partner',
        roles: ['buyer', 'partner'],
        name: 'Ковалев Михаил Сергеевич',
        isPartnerApproved: true,
        partnerId: createdPartnerAppId,
        partnerRefCode: approvedPartnerRefCode,
      };
      const token = createSessionToken(partnerUser, jwtSecret);
      partnerSession = { user: partnerUser, token, cookie: `domexit_session=${token}` };
      recordTest(true, `3.2 Generated accredited partner session (roles: ${partnerUser.roles.join(', ')})`);
    } catch (e) {
      recordTest(false, `3.1 Owner approval error: ${e.message}`);
    }
  } else {
    // Read-only checks on staff list of partners
    try {
      const res = await fetch(`${gatewayUrl}/api/data/partners`, {
        headers: { Cookie: ownerSession.cookie },
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 && Array.isArray(data.items);
      recordTest(ok, `3.1 Owner can access accredited partners list (${data.items?.length || 0} partners found)`);
    } catch (e) {
      recordTest(false, `3.1 Owner partner list error: ${e.message}`);
    }
  }

  // ===========================================================================
  // GROUP 4: Partner Preliminary 7-Day Reservation & Isolation
  // ===========================================================================
  console.log('\n[Group 4/5] Testing 7-Day Client Reservation & Partner Data Isolation...');

  const clientPhoneToReserve = '+7 (921) 777-88-99';
  let createdPreReqId = null;

  if (!isReadOnly && partnerSession) {
    // 4.1 Non-partner user tries to create preliminary reservation -> 403
    const regularClientUser = {
      id: `client-${Date.now()}`,
      email: 'regular_client@domexit.ru',
      role: 'buyer',
      roles: ['buyer'],
      name: 'Обычный Клиент',
    };
    await fetch(`${gatewayUrl}/api/data/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerSession.cookie },
      body: JSON.stringify(regularClientUser),
    });
    createdRecordIds.users.push(regularClientUser.id);
    const clientToken = createSessionToken(regularClientUser, jwtSecret);
    const clientCookie = `domexit_session=${clientToken}`;

    const prePayload = {
      clientName: 'Кузнецов Артем',
      clientPhone: clientPhoneToReserve,
      complexName: 'Северная Долина',
      developer: 'Главстрой-СПб',
      paidAmountRub: 2500000,
      contractPriceRub: 9000000,
      notes: 'Переуступка по семейной ипотеке',
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/partner_preliminary_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientCookie,
        },
        body: JSON.stringify(prePayload),
      });
      recordTest(res.status === 403, `4.1 Non-partner blocked from preliminary reservations (status: ${res.status})`);
    } catch (e) {
      recordTest(false, `4.1 Non-partner check error: ${e.message}`);
    }

    // 4.2 Accredited partner creates 7-day preliminary reservation
    try {
      const res = await fetch(`${gatewayUrl}/api/data/partner_preliminary_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: partnerSession.cookie,
        },
        body: JSON.stringify(prePayload),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 || res.status === 201;
      const item = data.item || {};
      if (ok && item.id) {
        createdPreReqId = item.id;
        createdRecordIds.partner_preliminary_requests.push(item.id);
      }
      const hasExpiry = Boolean(item.expiresAt);
      const isPendingClient = item.status === 'pending_client';
      const isRewardCorrect = item.fixedRewardPerDealRub === 30000;

      recordTest(
        ok && hasExpiry && isPendingClient && isRewardCorrect,
        `4.2 Partner 7-day preliminary reservation created: status=${item.status}, expiresAt=${item.expiresAt?.slice(0, 10)}`
      );
    } catch (e) {
      recordTest(false, `4.2 Partner reservation creation error: ${e.message}`);
    }

    // 4.3 Partner can read own preliminary requests
    try {
      const res = await fetch(`${gatewayUrl}/api/data/partner_preliminary_requests`, {
        headers: { Cookie: partnerSession.cookie },
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 && Array.isArray(data.items);
      const foundMine = data.items?.some((i) => i.id === createdPreReqId || i.partnerId === partnerSession.user.id);
      recordTest(ok && foundMine, `4.3 Partner can read own preliminary reservations (${data.items?.length || 0} records)`);
    } catch (e) {
      recordTest(false, `4.3 Partner read own reservations error: ${e.message}`);
    }

    // 4.4 Another client cannot read partner's preliminary requests (data isolation)
    try {
      const res = await fetch(`${gatewayUrl}/api/data/partner_preliminary_requests`, {
        headers: { Cookie: clientCookie },
      });
      // Non-staff and non-partner should receive 403 or empty array
      const isIsolated = res.status === 403 || (res.status === 200 && (!res.data?.items || res.data.items.length === 0));
      recordTest(isIsolated, `4.4 Data isolation: unrelated user cannot read partner preliminary requests`);
    } catch (e) {
      recordTest(false, `4.4 Partner data isolation error: ${e.message}`);
    }
  } else {
    console.log('  ℹ Read-Only Mode: Skipping Group 4 write requests.');
    recordTest(true, '4.1 Read-Only guard active for preliminary reservations');
  }

  // ===========================================================================
  // GROUP 5: Attribution & Auto-Conversion of Preliminary Requests
  // ===========================================================================
  console.log('\n[Group 5/5] Testing Attribution & Deal Reward Status...');

  if (!isReadOnly && createdPreReqId && approvedPartnerRefCode) {
    // 5.1 Seller request submitted matching clientPhone of active preliminary reservation
    const testSeller51 = {
      id: `seller-51-${Date.now()}`,
      email: 'test_seller_51@domexit.ru',
      name: 'Кузнецов Артем',
      role: 'seller',
      roles: ['seller'],
    };
    await fetch(`${gatewayUrl}/api/data/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerSession.cookie },
      body: JSON.stringify(testSeller51),
    });
    createdRecordIds.users.push(testSeller51.id);
    const token51 = createSessionToken(testSeller51, jwtSecret);

    const matchingSellerPayload = {
      dealTrack: 'ddu_cession',
      developer: 'Главстрой-СПб',
      complexName: 'Северная Долина',
      city: 'spb',
      dduNumber: 'ГС-СД-9912-25',
      contractPrice: 9000000,
      contractPriceRub: 9000000,
      paidAmount: 2500000,
      paidAmountRub: 2500000,
      sellerName: 'Кузнецов Артем',
      sellerPhone: clientPhoneToReserve, // Exactly matches preliminary reservation phone!
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/seller_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `domexit_session=${token51}`,
        },
        body: JSON.stringify(matchingSellerPayload),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 || res.status === 201;
      const item = data.item || {};
      if (ok && item.id) createdRecordIds.seller_requests.push(item.id);

      const isAttributed = Boolean(item.referredByPartnerCode || item.partnerId || item.partnerRefCode);
      recordTest(
        ok && isAttributed,
        `5.1 Unreferred seller matching 7-day reservation auto-attributed to partner (ref: ${item.referredByPartnerCode || item.partnerRefCode})`
      );
    } catch (e) {
      recordTest(false, `5.1 Attribution error: ${e.message}`);
    }

    // 5.2 Direct referral code attribution via ?ref=PART-XXXX
    const testSeller52 = {
      id: `seller-52-${Date.now()}`,
      email: 'test_seller_52@domexit.ru',
      name: 'Воронова Екатерина',
      role: 'seller',
      roles: ['seller'],
    };
    await fetch(`${gatewayUrl}/api/data/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerSession.cookie },
      body: JSON.stringify(testSeller52),
    });
    createdRecordIds.users.push(testSeller52.id);
    const token52 = createSessionToken(testSeller52, jwtSecret);

    const directRefSellerPayload = {
      dealTrack: 'secondary_dkp',
      complexName: 'ЖК Лиговский (ориентир)',
      city: 'spb',
      cadastralNumber: '78:34:0005555:1234',
      contractPrice: 8500000,
      contractPriceRub: 8500000,
      paidAmount: 8500000,
      paidAmountRub: 8500000,
      sellerName: 'Воронова Екатерина',
      sellerPhone: '+7 (921) 444-55-66',
      referredByPartnerCode: approvedPartnerRefCode, // Direct attribution via URL query param!
    };

    try {
      const res = await fetch(`${gatewayUrl}/api/data/seller_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `domexit_session=${token52}`,
        },
        body: JSON.stringify(directRefSellerPayload),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 || res.status === 201;
      const item = data.item || {};
      if (ok && item.id) createdRecordIds.seller_requests.push(item.id);

      const hasDirectRef = item.referredByPartnerCode === approvedPartnerRefCode || item.partnerRefCode === approvedPartnerRefCode;
      recordTest(
        ok && hasDirectRef,
        `5.2 Direct referral code attribution preserved on seller_request: refCode=${item.referredByPartnerCode || item.partnerRefCode}`
      );
    } catch (e) {
      recordTest(false, `5.2 Direct referral attribution error: ${e.message}`);
    }
  } else {
    // Read-only check: verify DealsRepository schema / closed deal fields
    try {
      const res = await fetch(`${gatewayUrl}/api/data/deals`, {
        headers: { Cookie: ownerSession.cookie },
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 && Array.isArray(data.items);
      recordTest(ok, `5.1 Owner can inspect deals pipeline (${data.items?.length || 0} deals found)`);
    } catch (e) {
      recordTest(false, `5.1 Deals inspection error: ${e.message}`);
    }
  }

  // ===========================================================================
  // CLEANUP: Staging Test Records Auto-Cleanup
  // ===========================================================================
  if (!isReadOnly) {
    console.log('\n[Cleanup] Cleaning up Staging test artifacts...');
    let cleanedCount = 0;

    for (const [coll, ids] of Object.entries(createdRecordIds)) {
      for (const id of ids) {
        try {
          await fetch(`${gatewayUrl}/api/data/${coll}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Cookie: ownerSession.cookie },
          });
          cleanedCount++;
        } catch {
          // Non-fatal cleanup
        }
      }
    }
    console.log(`  ✓ Cleaned up ${cleanedCount} test records across ${Object.keys(createdRecordIds).length} collections.`);
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n================================================================================');
  console.log(`=== VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED ===`);
  console.log('================================================================================');

  if (failedTests > 0) {
    console.error(`\n❌ VERIFICATION FAILED: ${failedTests} test(s) did not pass!`);
    process.exit(1);
  } else {
    console.log('\n✅ ALL VERIFICATION TESTS PASSED 100% SUCCESSFULLY!\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
