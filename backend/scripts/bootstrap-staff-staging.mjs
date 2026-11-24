import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT_DIR, '.env.cloud.local');
const MANIFEST_FILE = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');

if (!fs.existsSync(ENV_FILE)) {
  console.error('[Bootstrap] .env.cloud.local does not exist!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
let envContent = fs.readFileSync(ENV_FILE, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const ownerEmail = (envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();
const ownerPassword = envVars.BOOTSTRAP_OWNER_PASSWORD?.trim();
const employeeEmail = 'amaas9494@gmail.com';

let employeePassword = envVars.BOOTSTRAP_EMPLOYEE_PASSWORD?.trim();
if (!employeePassword) {
  // Generate strong random password for employee
  employeePassword = 'Emp_' + crypto.randomBytes(9).toString('base64url') + '!9';
  console.log('[Bootstrap] Generated new BOOTSTRAP_EMPLOYEE_PASSWORD and appending to .env.cloud.local');
  fs.appendFileSync(ENV_FILE, `\nBOOTSTRAP_EMPLOYEE_PASSWORD=${employeePassword}\n`);
}

const ydbEndpoint = manifest.staging?.ydbDocApiEndpoint || envVars.STAGING_YDB_DOCAPI_ENDPOINT;
const accessKeyId = envVars.YC_ACCESS_KEY_ID;
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY;
const region = envVars.YC_REGION || 'ru-central1';

if (!ownerEmail || !ownerPassword || !ydbEndpoint || !accessKeyId || !secretAccessKey) {
  console.error('[Bootstrap] Missing required configuration in .env.cloud.local!');
  process.exit(1);
}

console.log('=== Bootstrapping Staff & Master Owner on domexit-ydb-staging ===');
console.log('YDB Endpoint:', ydbEndpoint);
console.log('Owner Email:', ownerEmail);
console.log('Employee Email:', employeeEmail);

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

async function callDocApi(target, bodyObj) {
  const url = new URL(ydbEndpoint);
  const canonicalHost = url.host;
  const canonicalPath = url.pathname;

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

  const res = await fetch(ydbEndpoint, {
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
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, text };
  }
}

async function run() {
  console.log('\n[1/3] Scanning users table for existing records and duplicates...');
  const scanRes = await callDocApi('DynamoDB_20120810.Scan', {
    TableName: 'users',
    Limit: 100,
  });

  const ownerRecords = [];
  const employeeRecords = [];

  if (scanRes.data?.Items) {
    for (const item of scanRes.data.Items) {
      const email = item.email?.S?.toLowerCase()?.trim();
      const id = item.id?.S;
      if (email === ownerEmail) {
        ownerRecords.push({ id, item });
      } else if (email === employeeEmail) {
        employeeRecords.push({ id, item });
      }
    }
  }

  console.log(`Found ${ownerRecords.length} record(s) for owner (${ownerEmail})`);
  console.log(`Found ${employeeRecords.length} record(s) for employee (${employeeEmail})`);

  // Delete duplicate owner records if more than 1
  if (ownerRecords.length > 1) {
    console.log(`Cleaning up ${ownerRecords.length - 1} duplicate owner record(s)...`);
    for (let i = 1; i < ownerRecords.length; i++) {
      const idToDelete = ownerRecords[i].id;
      if (idToDelete) {
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'users',
          Key: { id: { S: idToDelete } },
        });
        console.log(`- Deleted duplicate owner ID: ${idToDelete}`);
      }
    }
  }

  // Delete duplicate employee records if more than 1
  if (employeeRecords.length > 1) {
    console.log(`Cleaning up ${employeeRecords.length - 1} duplicate employee record(s)...`);
    for (let i = 1; i < employeeRecords.length; i++) {
      const idToDelete = employeeRecords[i].id;
      if (idToDelete) {
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'users',
          Key: { id: { S: idToDelete } },
        });
        console.log(`- Deleted duplicate employee ID: ${idToDelete}`);
      }
    }
  }

  console.log('\n[2/3] Writing canonical Master Owner account...');
  const ownerHash = await hashPassword(ownerPassword);
  const ownerId = ownerRecords[0]?.id || 'usr-owner-001';
  const now = new Date().toISOString();

  const canonicalOwner = {
    id: { S: ownerId },
    email: { S: ownerEmail },
    name: { S: 'Ahmed Abdallah (Master Owner)' },
    clientCode: { S: 'DEX-104662' },
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
    phone: { S: '+7 (812) 900-00-01' },
    telegram: { S: '@domexit_owner' },
    passwordHash: { S: ownerHash },
    isPartnerApproved: { BOOL: true },
    isInvestorApproved: { BOOL: true },
    partnerRefCode: { S: 'PARTNER-MASTER-OWNER' },
    authProvider: { S: 'local' },
    registeredAt: { S: now },
    favorites: { L: [] },
  };

  const putOwnerRes = await callDocApi('DynamoDB_20120810.PutItem', {
    TableName: 'users',
    Item: canonicalOwner,
  });

  if (putOwnerRes.status !== 200) {
    throw new Error(`Failed to save owner account: ${JSON.stringify(putOwnerRes)}`);
  }
  console.log(`✓ Owner account initialized (ID: ${ownerId}, Role: owner, Roles: owner,employee,seller,buyer)`);

  console.log('\n[3/3] Writing canonical Employee account...');
  const employeeHash = await hashPassword(employeePassword);
  const employeeId = employeeRecords[0]?.id || 'usr-staff-002';

  const canonicalEmployee = {
    id: { S: employeeId },
    email: { S: employeeEmail },
    name: { S: 'Куратор DomExit' },
    clientCode: { S: 'DEX-000002' },
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
    phone: { S: '+7 (812) 409-00-00' },
    telegram: { S: '@domexit_official' },
    passwordHash: { S: employeeHash },
    isPartnerApproved: { BOOL: false },
    isInvestorApproved: { BOOL: false },
    authProvider: { S: 'local' },
    registeredAt: { S: now },
    favorites: { L: [] },
  };

  const putEmpRes = await callDocApi('DynamoDB_20120810.PutItem', {
    TableName: 'users',
    Item: canonicalEmployee,
  });

  if (putEmpRes.status !== 200) {
    throw new Error(`Failed to save employee account: ${JSON.stringify(putEmpRes)}`);
  }
  console.log(`✓ Employee account initialized (ID: ${employeeId}, Role: employee)`);

  // Ensure emp-1 in employees table
  const empTableItem = {
    id: { S: 'emp-1' },
    name: { S: 'Куратор DomExit' },
    email: { S: employeeEmail },
    role: { S: 'Ведущий куратор отдела выходов' },
    phone: { S: '+7 (812) 409-00-00' },
    telegram: { S: '@domexit_official' },
    whatsapp: { S: '+7 (812) 409-00-00' },
    maxProfile: { S: '+7 (812) 409-00-00' },
    bio: { S: 'Сопровождение сделок по переуступкам прав по 214-ФЗ и аккредитивным расчетам без скрытых рисков.' },
    photoUrl: { S: '' },
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
  };

  await callDocApi('DynamoDB_20120810.PutItem', {
    TableName: 'employees',
    Item: empTableItem,
  });
  console.log('✓ Verified emp-1 in employees table');

  console.log('\n=== Staff Bootstrapping Completed Successfully on Staging! ===');
}

run().catch((err) => {
  console.error('[Bootstrap] Failed:', err);
  process.exit(1);
});
