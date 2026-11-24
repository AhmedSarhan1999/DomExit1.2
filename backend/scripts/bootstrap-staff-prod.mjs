import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT_DIR, '.env.cloud.local');
const MANIFEST_FILE = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');

if (!process.argv.includes('--confirm-prod')) {
  console.error('[BootstrapProd] SAFETY ERROR: Missing required flag --confirm-prod. Aborting.');
  process.exit(1);
}

if (!fs.existsSync(ENV_FILE)) {
  console.error('[BootstrapProd] Error: .env.cloud.local does not exist!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const ownerEmail = (envVars.PROD_OWNER_EMAIL || envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();
const ownerPassword = envVars.PROD_OWNER_PASSWORD?.trim();
const employeeEmail = (envVars.PROD_EMPLOYEE_EMAIL || 'amaas9494@gmail.com').trim().toLowerCase();
const employeePassword = envVars.PROD_EMPLOYEE_PASSWORD?.trim();

if (!ownerPassword || !employeePassword) {
  console.error('[BootstrapProd] Error: PROD_OWNER_PASSWORD or PROD_EMPLOYEE_PASSWORD missing in .env.cloud.local!');
  process.exit(1);
}

const prodYdbEndpoint = manifest.production?.ydbDocApiEndpoint;
const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || envVars.YC_REGION || 'ru-central1';

if (!prodYdbEndpoint || !accessKeyId || !secretAccessKey) {
  console.error('[BootstrapProd] Error: Missing critical credentials or endpoint for production YDB!');
  process.exit(1);
}

console.log('=== Bootstrapping Production Staff & Platform Defaults ===');
console.log('Target Database: ', manifest.production.ydbDatabaseId);
console.log('Endpoint:        ', prodYdbEndpoint);
console.log('Owner Email:     ', ownerEmail);
console.log('Owner Password:   [REDACTED]');
console.log('Employee Email:  ', employeeEmail);
console.log('Employee Pass:   [REDACTED]');

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

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
  const url = new URL(prodYdbEndpoint);
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
      const res = await fetch(prodYdbEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.0',
          'X-Amz-Target': target,
          'X-Amz-Date': amzDate,
          Authorization: authHeader,
        },
        body,
      });

      const text = await res.text();
      let data = undefined;
      try {
        data = JSON.parse(text);
      } catch {}

      if (res.status === 200) {
        return { status: res.status, data };
      }

      if (res.status === 504 || res.status === 503 || res.status === 500) {
        console.warn(`  [Retry ${attempt}/${retries}] DocAPI returned ${res.status}. Retrying in 2s...`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
      }

      return { status: res.status, data, text };
    } catch (netErr) {
      console.warn(`  [Retry ${attempt}/${retries}] Network error: ${netErr.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      return { status: 0, text: netErr.message };
    }
  }
  return { status: 504, text: 'Exhausted retries' };
}

async function run() {
  console.log('\n[1/4] Scanning production users table...');
  const scanRes = await callDocApi('DynamoDB_20120810.Scan', {
    TableName: 'users',
    Limit: 100,
  });

  const existingUsers = scanRes.data?.Items || [];
  console.log(`Found ${existingUsers.length} total user record(s) in production.`);

  const ownerMatches = [];
  const employeeMatches = [];

  for (const item of existingUsers) {
    const email = item.email?.S?.toLowerCase()?.trim();
    if (email === ownerEmail) {
      ownerMatches.push(item);
    } else if (email === employeeEmail) {
      employeeMatches.push(item);
    }
  }

  const now = new Date().toISOString();

  // 1. Owner account
  console.log(`\n[2/4] Configuring Master Owner account (${ownerEmail})...`);
  const ownerHash = await hashPassword(ownerPassword);
  let ownerItem = ownerMatches[0] || {};
  const ownerId = ownerItem.id?.S || 'usr-owner-001';

  const updatedOwner = {
    ...ownerItem,
    id: { S: ownerId },
    email: { S: ownerEmail },
    name: ownerItem.name || { S: 'Ахмед (Владелец)' },
    clientCode: ownerItem.clientCode || { S: 'DEX-104662' },
    role: { S: 'owner' },
    activeRole: { S: 'owner' },
    roles: {
      L: [
        { S: 'owner' },
        { S: 'employee' },
        { S: 'seller' },
        { S: 'buyer' },
      ],
    },
    passwordHash: { S: ownerHash },
    isPartnerApproved: { BOOL: true },
    isInvestorApproved: { BOOL: true },
    partnerRefCode: ownerItem.partnerRefCode || { S: 'PARTNER-MASTER-OWNER' },
    authProvider: ownerItem.authProvider || { S: 'local' },
    registeredAt: ownerItem.registeredAt || { S: now },
    favorites: ownerItem.favorites || { L: [] },
  };

  const putOwnerRes = await callDocApi('DynamoDB_20120810.PutItem', {
    TableName: 'users',
    Item: updatedOwner,
  });
  if (putOwnerRes.status !== 200) {
    throw new Error(`Failed to update owner: ${JSON.stringify(putOwnerRes)}`);
  }
  console.log(`✓ Owner account configured (ID: ${ownerId}, role: owner, roles: owner,employee,seller,buyer)`);

  // 2. Employee account
  console.log(`\n[3/4] Configuring Employee account (${employeeEmail})...`);
  const employeeHash = await hashPassword(employeePassword);
  let empItem = employeeMatches[0] || {};
  const employeeId = empItem.id?.S || 'usr-staff-002';

  const updatedEmployee = {
    ...empItem,
    id: { S: employeeId },
    email: { S: employeeEmail },
    name: empItem.name || { S: 'Куратор DomExit' },
    clientCode: empItem.clientCode || { S: 'DEX-000002' },
    role: { S: 'employee' },
    activeRole: { S: 'employee' },
    roles: {
      L: [
        { S: 'employee' },
        { S: 'seller' },
        { S: 'buyer' },
      ],
    },
    assignedEmployeeId: { S: 'emp-1' },
    passwordHash: { S: employeeHash },
    isPartnerApproved: empItem.isPartnerApproved || { BOOL: false },
    isInvestorApproved: empItem.isInvestorApproved || { BOOL: false },
    authProvider: empItem.authProvider || { S: 'local' },
    registeredAt: empItem.registeredAt || { S: now },
    favorites: empItem.favorites || { L: [] },
  };

  const putEmpRes = await callDocApi('DynamoDB_20120810.PutItem', {
    TableName: 'users',
    Item: updatedEmployee,
  });
  if (putEmpRes.status !== 200) {
    throw new Error(`Failed to update employee: ${JSON.stringify(putEmpRes)}`);
  }
  console.log(`✓ Employee account configured (ID: ${employeeId}, role: employee, assignedEmployeeId: emp-1)`);

  // Ensure emp-1 in employees table
  console.log('\n[4/4] Ensuring emp-1 and platform defaults...');
  const getEmp1Res = await callDocApi('DynamoDB_20120810.GetItem', {
    TableName: 'employees',
    Key: { id: { S: 'emp-1' } },
  });

  if (!getEmp1Res.data?.Item) {
    console.log('  + Creating emp-1 in employees table...');
    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'employees',
      Item: {
        id: { S: 'emp-1' },
        name: { S: 'Куратор DomExit' },
        email: { S: employeeEmail },
        role: { S: 'Ведущий куратор отдела выходов' },
        phone: { S: '+7 (921) 888-11-22' },
        telegram: { S: '@domexit_smirnov' },
        whatsapp: { S: '+7 (921) 888-11-22' },
        bio: { S: '12 лет в сфере уступки прав по 214-ФЗ и аккредитивов. Экс-руководитель юридического блока строительного холдинга.' },
        photoUrl: { S: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' },
        activeLotsCount: { N: '1' },
        closedDealsCount: { N: '18' },
        avgSpeedDays: { N: '8.5' },
        status: { S: 'active' },
        permissions: {
          L: [
            { S: 'legal_audit' },
            { S: 'packaging' },
            { S: 'matchmaker' },
            { S: 'closing' },
          ],
        },
      },
    });
    console.log('  ✓ emp-1 created in employees');
  } else {
    console.log('  - emp-1 already exists in employees table (SKIPPED)');
  }

  // Check market_settings
  const getMarketRes = await callDocApi('DynamoDB_20120810.GetItem', {
    TableName: 'market_settings',
    Key: { id: { S: 'market_parameters' } },
  });
  if (!getMarketRes.data?.Item) {
    console.log('  + Initializing default market_parameters...');
    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'market_settings',
      Item: {
        id: { S: 'market_parameters' },
        discountThreshold: { N: '15' },
        fastSaleDays: { N: '14' },
        commissionPercent: { N: '3' },
        updatedAt: { S: now },
      },
    });
    console.log('  ✓ market_parameters initialized');
  } else {
    console.log('  - market_parameters already exists (SKIPPED)');
  }

  // Check company_profile
  const getCompanyRes = await callDocApi('DynamoDB_20120810.GetItem', {
    TableName: 'company_profile',
    Key: { id: { S: 'company_legal_profile' } },
  });
  if (!getCompanyRes.data?.Item) {
    console.log('  + Initializing default company_legal_profile...');
    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'company_profile',
      Item: {
        id: { S: 'company_legal_profile' },
        companyName: { S: 'ООО "ДомЭкзит"' },
        inn: { S: '7801356789' },
        ogrn: { S: '1227800098765' },
        legalAddress: { S: 'г. Санкт-Петербург, Невский пр-кт, д. 140' },
        updatedAt: { S: now },
      },
    });
    console.log('  ✓ company_legal_profile initialized');
  } else {
    console.log('  - company_legal_profile already exists (SKIPPED)');
  }

  console.log('\n=== Production Staff Bootstrapping Completed Successfully! ===');
}

run().catch((err) => {
  console.error('[BootstrapProd] Fatal error:', err);
  process.exit(1);
});
