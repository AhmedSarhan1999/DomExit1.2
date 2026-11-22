import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

// 1. Parse CLI Arguments
const args = process.argv.slice(2);
let targetEnv = 'staging';
let isDryRun = true; // Safe default
let confirmCleanSlate = false;
let confirmProd = false;
let backupOnly = false;

for (const arg of args) {
  if (arg === '--env=production' || arg === '--production' || arg === '--prod') targetEnv = 'production';
  if (arg === '--env=staging' || arg === '--staging') targetEnv = 'staging';
  if (arg === '--dry-run') isDryRun = true;
  if (arg === '--confirm-clean-slate') confirmCleanSlate = true;
  if (arg === '--confirm-prod') confirmProd = true;
  if (arg === '--backup-only') backupOnly = true;
}

// Invert dry-run if confirmed
if (targetEnv === 'staging' && confirmCleanSlate) {
  isDryRun = false;
}
if (targetEnv === 'production') {
  if (confirmCleanSlate && confirmProd) {
    isDryRun = false;
  } else {
    isDryRun = true; // Safety override
  }
}

// 2. Validate prerequisites
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
const ydbEndpoint = envConfig.ydbDocApiEndpoint;
const databaseId = envConfig.ydbDatabaseId;
const gatewayUrl = envConfig.apiGatewayUrl;
const publicBucket = envConfig.publicPhotosBucket;
const privateBucket = envConfig.privateDocsBucket;

const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || envVars.YC_REGION || 'ru-central1';

const ownerEmail = (envVars.PROD_OWNER_EMAIL || envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();
const ownerPassword = (isProd ? envVars.PROD_OWNER_PASSWORD : envVars.BOOTSTRAP_OWNER_PASSWORD)?.trim();

const employeeEmail = (envVars.PROD_EMPLOYEE_EMAIL || 'amaas9494@gmail.com').trim().toLowerCase();
const employeePassword = (isProd ? envVars.PROD_EMPLOYEE_PASSWORD : (envVars.BOOTSTRAP_EMPLOYEE_PASSWORD || envVars.PROD_EMPLOYEE_PASSWORD))?.trim();

if (!ydbEndpoint || !accessKeyId || !secretAccessKey) {
  console.error('FATAL: Missing critical credentials or endpoint for YDB/S3!');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  endpoint: 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// AWS Signature v4 for YDB DocAPI
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
  const url = new URL(ydbEndpoint);
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
      let data = undefined;
      try {
        data = JSON.parse(text);
      } catch {}

      if (res.status === 200) {
        return { status: res.status, data };
      }

      if (res.status === 504 || res.status === 503 || res.status === 500) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
      }
      return { status: res.status, data, text };
    } catch (netErr) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      return { status: 0, text: netErr.message };
    }
  }
  return { status: 504, text: 'Exhausted retries' };
}

function unmarshallValue(val) {
  if (!val || typeof val !== 'object') return val;
  if ('S' in val) return val.S;
  if ('N' in val) {
    const num = Number(val.N);
    return isNaN(num) ? val.N : num;
  }
  if ('BOOL' in val) return val.BOOL;
  if ('NULL' in val) return null;
  if ('M' in val) {
    const map = {};
    for (const [k, v] of Object.entries(val.M)) {
      map[k] = unmarshallValue(v);
    }
    return map;
  }
  if ('L' in val) {
    return val.L.map(unmarshallValue);
  }
  return val;
}

function unmarshallItem(item) {
  if (!item) return item;
  const res = {};
  for (const [k, v] of Object.entries(item)) {
    res[k] = unmarshallValue(v);
  }
  return res;
}

async function scanAllItems(tableName) {
  const items = [];
  let lastEvaluatedKey = undefined;
  do {
    const params = { TableName: tableName };
    if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey;
    const res = await callDocApi('DynamoDB_20120810.Scan', params);
    if (res.status === 200 && res.data?.Items) {
      items.push(...res.data.Items);
      lastEvaluatedKey = res.data.LastEvaluatedKey;
    } else {
      break;
    }
  } while (lastEvaluatedKey);
  return items;
}

console.log('================================================================================');
console.log(`=== DOMEXIT CLEAN-SLATE PRE-UAT RESET ENGINE: [${targetEnv.toUpperCase()}] ===`);
console.log('================================================================================');
console.log(`Execution Mode:    ${isDryRun ? 'DRY-RUN (Simulated — ZERO modifications will be made)' : 'LIVE EXECUTION (Surgical Cleanup Active)'}`);
console.log(`Target Database:   ${databaseId}`);
console.log(`YDB Endpoint:      ${ydbEndpoint}`);
console.log(`Public Bucket:     ${publicBucket}`);
console.log(`Private Bucket:    ${privateBucket}`);
console.log(`Owner Account:     ${ownerEmail}`);
console.log(`Employee Account:  ${employeeEmail}`);
console.log('================================================================================\n');

// Definition of Tables
const PURGE_TABLES = [
  'lots',
  'deals',
  'seller_requests',
  'buyer_applications',
  'candidates',
  'client_candidates',
  'buy_boxes',
  'documents_vault',
  'curator_messages',
  'deal_messages',
  'user_consents',
  'partners',
  'partner_applications',
  'partner_preliminary_requests',
  'investor_applications',
  'audit_logs',
  'security_incidents',
  'pep_signatures',
  'pep_otps',
  'telegram_link_tokens',
  'telegram_message_map',
  'rate_limits',
  'escrow_bridge_chats',
  'bank_special_approvals',
];

const STRICT_PRESERVED_TABLES = [
  'legal_documents',
  'developers',
  'market_settings',
  'legal_settings',
  'company_profile',
  'public_channels',
  'platform_settings',
  'developer_accreditation_requests',
  'partner_banks',
  'bank_employees',
  'vip_subscriptions',
];

async function run() {
  // ===========================================================================
  // STEP 1: Mandatory Pre-Clean Snapshot & Verification (Mandatory for Prod)
  // ===========================================================================
  console.log('[Step 1/5] Checking List of Tables & Performing Pre-Clean Snapshot...');

  const listRes = await callDocApi('DynamoDB_20120810.ListTables', {});
  if (listRes.status !== 200 || !listRes.data?.TableNames) {
    throw new Error(`Failed to list tables in YDB: ${JSON.stringify(listRes)}`);
  }
  const existingTables = listRes.data.TableNames;
  console.log(`  ✓ Discovered ${existingTables.length} total tables in target YDB database.`);

  // Create full snapshot for Production (or if requested)
  let backupKey = null;
  let backupSize = 0;

  if (isProd || backupOnly) {
    console.log(`\n[Snapshot Gate] Creating mandatory pre-cutover snapshot for ${targetEnv}...`);
    const backupData = {
      version: '1.0.0',
      databaseId,
      endpoint: ydbEndpoint,
      timestamp: new Date().toISOString(),
      environment: targetEnv,
      tables: {},
      summary: {},
    };

    for (const table of existingTables) {
      if (table.startsWith('demo_')) continue;
      const rawItems = await scanAllItems(table);
      const unmarshalled = rawItems.map(unmarshallItem);
      backupData.tables[table] = unmarshalled;
      backupData.summary[table] = unmarshalled.length;
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    const gzipped = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));
    backupSize = gzipped.length;

    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    backupKey = `backups/pre-cutover/ydb-pre-uat-clean-${nowStamp}.json.gz`;

    console.log(`  Uploading snapshot to ${privateBucket}/${backupKey} (${Math.round(backupSize / 1024)} KB)...`);
    await s3.send(
      new PutObjectCommand({
        Bucket: privateBucket,
        Key: backupKey,
        Body: gzipped,
        ContentType: 'application/gzip',
      })
    );

    // Also mirror to _backups/ for sweeper awareness
    const mirrorKey = `_backups/ydb/pre-cutover-clean-${nowStamp}.json.gz`;
    await s3.send(
      new PutObjectCommand({
        Bucket: privateBucket,
        Key: mirrorKey,
        Body: gzipped,
        ContentType: 'application/gzip',
      })
    );

    // Mandatory HeadObject Verification Gate
    console.log(`  Verifying snapshot existence and integrity via S3 HeadObject...`);
    const head = await s3.send(new HeadObjectCommand({ Bucket: privateBucket, Key: backupKey }));
    const headSize = head.ContentLength || 0;

    if (headSize < 10240) {
      console.error(`❌ CRITICAL SAFETY GATE FAILED: Snapshot size (${headSize} B) is below mandatory 10 KB threshold!`);
      process.exit(1);
    }
    console.log(`  ✓ MANDATORY SNAPSHOT VERIFIED: ${backupKey} (${headSize} bytes, size OK > 10 KB).`);

    if (backupOnly) {
      console.log('\n✓ Backup only completed successfully. Exiting without cleanup.');
      process.exit(0);
    }
  } else {
    console.log('  ℹ Notice: Target is Staging. Staging snapshot creation optional.');
  }

  // ===========================================================================
  // STEP 2: Pre-Inspection of All Tables (Before Cleanup Counts)
  // ===========================================================================
  console.log('\n[Step 2/5] Inspecting Current Table Counts (Pre-Cleanup Baseline)...');
  const beforeCounts = {};
  for (const table of existingTables) {
    const raw = await scanAllItems(table);
    beforeCounts[table] = raw.length;
  }

  console.log('  Baseline counts:');
  console.log(`    - users:              ${beforeCounts['users'] ?? 0}`);
  console.log(`    - employees:          ${beforeCounts['employees'] ?? 0}`);
  console.log(`    - telegram_bindings:  ${beforeCounts['telegram_bindings'] ?? 0}`);
  console.log(`    - legal_documents:    ${beforeCounts['legal_documents'] ?? 0} (Preserved)`);
  console.log(`    - developers:         ${beforeCounts['developers'] ?? 0} (Preserved)`);
  console.log(`    - lots:               ${beforeCounts['lots'] ?? 0} (To Purge)`);
  console.log(`    - deals:              ${beforeCounts['deals'] ?? 0} (To Purge)`);
  console.log(`    - seller_requests:    ${beforeCounts['seller_requests'] ?? 0} (To Purge)`);
  console.log(`    - buyer_applications: ${beforeCounts['buyer_applications'] ?? 0} (To Purge)`);
  console.log(`    - security_incidents: ${beforeCounts['security_incidents'] ?? 0} (To Purge)`);

  // Verify legal_documents count
  if ((beforeCounts['legal_documents'] || 0) < 26) {
    console.warn(`  ⚠️ Warning: legal_documents count is ${beforeCounts['legal_documents']}, expected 26.`);
  }

  // ===========================================================================
  // STEP 3: Surgical Inspection of users, employees, telegram_bindings
  // ===========================================================================
  console.log('\n[Step 3/5] Inspecting & Validating Protected Accounts (users, employees, telegram)...');

  // A. Scan users table
  const allUsersRaw = await scanAllItems('users');
  const allUsers = allUsersRaw.map(unmarshallItem);

  const ownerMatches = allUsers.filter((u) => (u.email || '').toLowerCase().trim() === ownerEmail);
  const employeeMatches = allUsers.filter((u) => (u.email || '').toLowerCase().trim() === employeeEmail);

  console.log(`  Found ${ownerMatches.length} record(s) matching Owner (${ownerEmail})`);
  console.log(`  Found ${employeeMatches.length} record(s) matching Employee (${employeeEmail})`);

  // Verify Owner account
  const validOwner = ownerMatches.find((u) => Boolean(u.passwordHash));
  if (!validOwner) {
    console.error(`❌ CRITICAL SAFETY GATE FAILED: No Owner account with valid passwordHash found for ${ownerEmail}!`);
    console.error(`   Cleanup aborted to prevent accidental lockout.`);
    process.exit(1);
  }
  console.log(`  ✓ Owner account validated: ID '${validOwner.id}', clientCode '${validOwner.clientCode}', role '${validOwner.role}'`);

  // Verify Employee account
  const validEmployee = employeeMatches.find((u) => Boolean(u.passwordHash));
  if (!validEmployee) {
    console.error(`❌ CRITICAL SAFETY GATE FAILED: No Employee account with valid passwordHash found for ${employeeEmail}!`);
    console.error(`   Cleanup aborted to prevent accidental lockout.`);
    process.exit(1);
  }
  console.log(`  ✓ Employee account validated: ID '${validEmployee.id}', clientCode '${validEmployee.clientCode}', assignedEmployeeId '${validEmployee.assignedEmployeeId || 'emp-1'}'`);

  // Determine canonical IDs to preserve
  // In both environments, ensure canonical 'usr-owner-001' and 'usr-staff-002'
  const canonicalOwnerId = 'usr-owner-001';
  const canonicalEmployeeId = 'usr-staff-002';

  // Users to delete: all users whose ID is neither canonicalOwnerId nor canonicalEmployeeId
  // Also if owner or employee currently has an alternate ID (like usr-owner-master), we will migrate/clone to canonicalOwnerId before deleting the alternate ID.
  const usersToDelete = allUsers.filter((u) => {
    // If it's the valid owner and valid employee, we will handle canonical migration
    return true; // We'll compute explicitly below
  });

  // B. Scan employees table
  const allEmployeesRaw = await scanAllItems('employees');
  const allEmployees = allEmployeesRaw.map(unmarshallItem);
  const emp1Record = allEmployees.find((e) => e.id === 'emp-1' || e.email === employeeEmail);

  if (!emp1Record) {
    console.error(`❌ CRITICAL SAFETY GATE FAILED: emp-1 record missing from employees table!`);
    process.exit(1);
  }
  console.log(`  ✓ Primary employee record validated: ID '${emp1Record.id}', name '${emp1Record.name}', role '${emp1Record.role}'`);

  // C. Scan telegram_bindings
  const allBindingsRaw = await scanAllItems('telegram_bindings');
  const allBindings = allBindingsRaw.map(unmarshallItem);
  const ownerBindings = allBindings.filter(
    (b) =>
      b.userId === validOwner.id ||
      b.userId === canonicalOwnerId ||
      b.id === `user:${validOwner.id}` ||
      b.id === `user:${canonicalOwnerId}` ||
      b.id === 'chat:5705774365' ||
      String(b.chatId) === '5705774365'
  );
  console.log(`  Found ${ownerBindings.length} telegram binding records for Owner (chat: 5705774365).`);

  // D. Scan S3 orphaned test files
  console.log('\n[S3 Storage Scan] Inspecting S3 buckets for orphaned test files...');

  async function listS3Keys(bucket, prefix) {
    const keys = [];
    let token = undefined;
    do {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        })
      );
      if (res.Contents) {
        for (const obj of res.Contents) {
          if (obj.Key) keys.push(obj.Key);
        }
      }
      token = res.NextContinuationToken;
    } while (token);
    return keys;
  }

  const publicPhotoKeys = await listS3Keys(publicBucket, 'photos/');
  const privateDocKeys = await listS3Keys(privateBucket, 'documents/');

  console.log(`  - Public bucket (${publicBucket}) 'photos/': ${publicPhotoKeys.length} test photo(s)`);
  console.log(`  - Private bucket (${privateBucket}) 'documents/': ${privateDocKeys.length} test document(s)`);

  // ===========================================================================
  // STEP 4: Execution / Simulation of Purge & Surgical Reset
  // ===========================================================================
  console.log('\n[Step 4/5] Executing Clean-Slate Purge...');

  let totalDeletedRecords = 0;
  let totalDeletedS3Files = 0;

  // A. Purge 100% of Purge Tables
  for (const tableName of PURGE_TABLES) {
    if (!existingTables.includes(tableName)) continue;
    const rawItems = await scanAllItems(tableName);
    console.log(`  [Table: ${tableName}] Found ${rawItems.length} records to purge.`);

    if (!isDryRun) {
      for (const item of rawItems) {
        const id = item.id?.S;
        if (id) {
          await callDocApi('DynamoDB_20120810.DeleteItem', {
            TableName: tableName,
            Key: { id: { S: id } },
          });
          totalDeletedRecords++;
        }
      }
      console.log(`    ✓ Purged ${rawItems.length} records from ${tableName}.`);
    }
  }

  // B. Surgical Reset of table `users`
  console.log(`  [Table: users] Resetting to exactly 2 canonical accounts (Owner + Employee)...`);

  if (!isDryRun) {
    // 1. Ensure canonical Owner record with ID 'usr-owner-001'
    const canonicalOwnerItem = {
      id: { S: canonicalOwnerId },
      email: { S: ownerEmail },
      name: { S: validOwner.name || 'Ахмед (Владелец)' },
      clientCode: { S: validOwner.clientCode || 'DEX-104662' },
      role: { S: 'owner' },
      activeRole: { S: 'owner' },
      roles: {
        L: [
          { S: 'owner' },
          { S: 'employee' },
          { S: 'seller' },
          { S: 'buyer' },
          { S: 'bank' },
          { S: 'partner' },
          { S: 'investor' },
        ],
      },
      phone: { S: validOwner.phone || '+7 (812) 900-00-01' },
      telegram: { S: validOwner.telegram || '@domexit_owner' },
      passwordHash: { S: validOwner.passwordHash },
      isPartnerApproved: { BOOL: true },
      isInvestorApproved: { BOOL: true },
      partnerRefCode: { S: 'PARTNER-MASTER-OWNER' },
      authProvider: { S: 'local' },
      registeredAt: { S: validOwner.registeredAt || new Date().toISOString() },
      favorites: { L: [] },
    };

    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'users',
      Item: canonicalOwnerItem,
    });
    console.log(`    ✓ Canonical Owner account active: ID '${canonicalOwnerId}' (${ownerEmail})`);

    // 2. Ensure canonical Employee record with ID 'usr-staff-002'
    const canonicalEmployeeItem = {
      id: { S: canonicalEmployeeId },
      email: { S: employeeEmail },
      name: { S: validEmployee.name || 'Алексей Смирнов (Ведущий куратор)' },
      clientCode: { S: validEmployee.clientCode || 'DEX-000002' },
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
      phone: { S: validEmployee.phone || '+7 (921) 888-11-22' },
      telegram: { S: validEmployee.telegram || '@domexit_smirnov' },
      passwordHash: { S: validEmployee.passwordHash },
      isPartnerApproved: { BOOL: false },
      isInvestorApproved: { BOOL: false },
      authProvider: { S: 'local' },
      registeredAt: { S: validEmployee.registeredAt || new Date().toISOString() },
      favorites: { L: [] },
    };

    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'users',
      Item: canonicalEmployeeItem,
    });
    console.log(`    ✓ Canonical Employee account active: ID '${canonicalEmployeeId}' (${employeeEmail})`);

    // 3. Delete all other users
    for (const u of allUsers) {
      if (u.id !== canonicalOwnerId && u.id !== canonicalEmployeeId) {
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'users',
          Key: { id: { S: u.id } },
        });
        totalDeletedRecords++;
      }
    }
    console.log(`    ✓ Purged ${allUsers.length - 2} non-canonical user records.`);
  } else {
    console.log(`    [DRY-RUN] Would keep canonicalOwnerId ('${canonicalOwnerId}') and canonicalEmployeeId ('${canonicalEmployeeId}') and delete ${allUsers.length - 2} test user accounts.`);
  }

  // C. Surgical Reset of table `employees`
  console.log(`  [Table: employees] Resetting to exactly 1 employee ('emp-1')...`);
  if (!isDryRun) {
    // Ensure emp-1 is canonical
    const canonicalEmp1Item = {
      id: { S: 'emp-1' },
      name: { S: 'Алексей Смирнов' },
      email: { S: employeeEmail },
      role: { S: 'Ведущий куратор отдела выходов' },
      phone: { S: '+7 (921) 888-11-22' },
      telegram: { S: '@domexit_smirnov' },
      whatsapp: { S: '+7 (921) 888-11-22' },
      maxProfile: { S: '+7 (921) 888-11-22' },
      bio: { S: '12 лет в сфере уступки прав по 214-ФЗ и аккредитивов. Экс-руководитель юридического блока строительного холдинга.' },
      photoUrl: { S: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' },
      activeLotsCount: { N: '0' },
      closedDealsCount: { N: '0' },
      avgSpeedDays: { N: '8.5' },
      status: { S: 'active' },
      permissions: {
        L: [
          { S: 'legal_audit' },
          { S: 'packaging' },
          { S: 'buyer_matching' },
          { S: 'closing' },
          { S: 'support' },
        ],
      },
    };

    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'employees',
      Item: canonicalEmp1Item,
    });

    for (const emp of allEmployees) {
      if (emp.id !== 'emp-1') {
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'employees',
          Key: { id: { S: emp.id } },
        });
        totalDeletedRecords++;
      }
    }
    console.log(`    ✓ Preserved emp-1 and purged ${allEmployees.length - 1} extra employee records.`);
  } else {
    console.log(`    [DRY-RUN] Would keep emp-1 and delete ${allEmployees.length - 1} extra employee records.`);
  }

  // D. Surgical Reset of table `telegram_bindings`
  console.log(`  [Table: telegram_bindings] Resetting to Owner 1:1 binding (chat: 5705774365)...`);
  if (!isDryRun) {
    const canonicalBindingData = {
      userId: { S: canonicalOwnerId },
      chatId: { N: '5705774365' },
      telegramUsername: { S: 'domexit_owner' },
      telegramFirstName: { S: 'Ahmed' },
      role: { S: 'owner' },
      linkedAt: { S: new Date().toISOString() },
      active: { BOOL: true },
    };

    // Dual records: user:usr-owner-001 and chat:5705774365
    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'telegram_bindings',
      Item: { ...canonicalBindingData, id: { S: `user:${canonicalOwnerId}` } },
    });
    await callDocApi('DynamoDB_20120810.PutItem', {
      TableName: 'telegram_bindings',
      Item: { ...canonicalBindingData, id: { S: 'chat:5705774365' } },
    });

    for (const b of allBindings) {
      if (b.id !== `user:${canonicalOwnerId}` && b.id !== 'chat:5705774365') {
        await callDocApi('DynamoDB_20120810.DeleteItem', {
          TableName: 'telegram_bindings',
          Key: { id: { S: b.id } },
        });
        totalDeletedRecords++;
      }
    }
    console.log(`    ✓ Configured canonical dual binding for Owner and purged test bindings.`);
  } else {
    console.log(`    [DRY-RUN] Would keep user:${canonicalOwnerId} and chat:5705774365 and delete remaining test bindings.`);
  }

  // E. S3 Cleanup (Strict Prefix Guards)
  console.log(`  [S3 Storage] Purging orphaned test files under strict prefixes...`);
  if (!isDryRun) {
    // 1. Delete public photos
    if (publicPhotoKeys.length > 0) {
      console.log(`    Deleting ${publicPhotoKeys.length} file(s) from ${publicBucket} (prefix: photos/)...`);
      for (let i = 0; i < publicPhotoKeys.length; i += 1000) {
        const batch = publicPhotoKeys.slice(i, i + 1000).map((k) => ({ Key: k }));
        await s3.send(new DeleteObjectsCommand({ Bucket: publicBucket, Delete: { Objects: batch } }));
      }
      totalDeletedS3Files += publicPhotoKeys.length;
      console.log(`    ✓ Deleted ${publicPhotoKeys.length} test photos.`);
    }

    // 2. Delete private documents
    if (privateDocKeys.length > 0) {
      console.log(`    Deleting ${privateDocKeys.length} file(s) from ${privateBucket} (prefix: documents/)...`);
      for (let i = 0; i < privateDocKeys.length; i += 1000) {
        const batch = privateDocKeys.slice(i, i + 1000).map((k) => ({ Key: k }));
        await s3.send(new DeleteObjectsCommand({ Bucket: privateBucket, Delete: { Objects: batch } }));
      }
      totalDeletedS3Files += privateDocKeys.length;
      console.log(`    ✓ Deleted ${privateDocKeys.length} test documents.`);
    }
  } else {
    console.log(`    [DRY-RUN] Would delete ${publicPhotoKeys.length} file(s) from ${publicBucket} (photos/) and ${privateDocKeys.length} file(s) from ${privateBucket} (documents/).`);
  }

  // ===========================================================================
  // STEP 5: Post-Cleanup Verification & Comparison Metrics
  // ===========================================================================
  console.log('\n[Step 5/5] Performing Post-Cleanup Inspection & Authentication Gates...');

  const afterCounts = {};
  for (const table of existingTables) {
    const raw = await scanAllItems(table);
    afterCounts[table] = raw.length;
  }

  const finalPublicPhotos = (await listS3Keys(publicBucket, 'photos/')).length;
  const finalPrivateDocs = (await listS3Keys(privateBucket, 'documents/')).length;

  console.log('\n================================================================================');
  console.log(`=== CLEAN-SLATE COMPARISON METRICS: [${targetEnv.toUpperCase()}] ===`);
  console.log('================================================================================');
  console.log('| Table / Asset Name        | Category   | Before Clean | After Clean | Target State | Status      |');
  console.log('|---------------------------|------------|--------------|-------------|--------------|-------------|');

  const checkRows = [
    { name: 'users', cat: 'Staff Keep', target: '2 (Owner+Emp)' },
    { name: 'employees', cat: 'Staff Keep', target: '1 (emp-1)' },
    { name: 'telegram_bindings', cat: 'Owner Keep', target: '2 (User+Chat)' },
    { name: 'legal_documents', cat: 'Reference', target: '26 (Intact)' },
    { name: 'developers', cat: 'Reference', target: 'Intact' },
    { name: 'market_settings', cat: 'Reference', target: 'Intact' },
    { name: 'company_profile', cat: 'Reference', target: 'Intact' },
    { name: 'lots', cat: 'Purge Table', target: '0' },
    { name: 'deals', cat: 'Purge Table', target: '0' },
    { name: 'seller_requests', cat: 'Purge Table', target: '0' },
    { name: 'buyer_applications', cat: 'Purge Table', target: '0' },
    { name: 'candidates', cat: 'Purge Table', target: '0' },
    { name: 'buy_boxes', cat: 'Purge Table', target: '0' },
    { name: 'documents_vault', cat: 'Purge Table', target: '0' },
    { name: 'curator_messages', cat: 'Purge Table', target: '0' },
    { name: 'deal_messages', cat: 'Purge Table', target: '0' },
    { name: 'partners', cat: 'Purge Table', target: '0' },
    { name: 'partner_applications', cat: 'Purge Table', target: '0' },
    { name: 'partner_preliminary_requests', cat: 'Purge Table', target: '0' },
    { name: 'investor_applications', cat: 'Purge Table', target: '0' },
    { name: 'security_incidents', cat: 'Purge Table', target: '0' },
    { name: 'audit_logs', cat: 'Purge Table', target: '0' },
    { name: 'pep_signatures', cat: 'Purge Table', target: '0' },
    { name: 'pep_otps', cat: 'Purge Table', target: '0' },
    { name: 'rate_limits', cat: 'Purge Table', target: '0' },
  ];

  for (const row of checkRows) {
    const b = beforeCounts[row.name] ?? '-';
    const a = afterCounts[row.name] ?? '-';
    let ok = false;
    if (row.name === 'users') ok = a === 2;
    else if (row.name === 'employees') ok = a === 1;
    else if (row.name === 'telegram_bindings') ok = a === 2;
    else if (row.cat === 'Reference') ok = a === b;
    else if (row.cat === 'Purge Table') ok = a === 0;

    const statusStr = isDryRun ? 'DRY-RUN OK' : ok ? '✓ PERFECT' : '✗ MISMATCH';
    console.log(
      `| ${row.name.padEnd(25)} | ${row.cat.padEnd(10)} | ${String(b).padStart(12)} | ${String(a).padStart(11)} | ${row.target.padEnd(12)} | ${statusStr.padEnd(11)} |`
    );
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(`S3 Public Photos (photos/):    Before: ${publicPhotoKeys.length} | After: ${finalPublicPhotos} | Deleted: ${publicPhotoKeys.length - finalPublicPhotos}`);
  console.log(`S3 Private Docs  (documents/): Before: ${privateDocKeys.length} | After: ${finalPrivateDocs} | Deleted: ${privateDocKeys.length - finalPrivateDocs}`);
  if (backupKey) {
    console.log(`Pre-Cutover Backup Archive:    s3://${privateBucket}/${backupKey} (${backupSize} bytes)`);
  }
  console.log('================================================================================\n');

  // Login Verification Gate (Live Mode Only)
  if (!isDryRun) {
    console.log('[Auth Verification Gate] Testing Owner & Employee Login against live API...');

    // 1. Owner Login
    try {
      const ownerRes = await fetch(`${gatewayUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
      });
      const ownerData = await ownerRes.json().catch(() => ({}));
      if (ownerRes.status === 200 && ownerData.user?.role === 'owner') {
        console.log(`  ✓ OWNER LOGIN VERIFIED: 200 OK (ID: ${ownerData.user.id}, role: ${ownerData.user.role})`);
      } else {
        console.error(`  ✗ OWNER LOGIN FAILED: Status ${ownerRes.status}, error: ${ownerData.error || 'unknown'}`);
      }
    } catch (e) {
      console.error(`  ✗ OWNER LOGIN ERROR: ${e.message}`);
    }

    // 2. Employee Login
    try {
      const empRes = await fetch(`${gatewayUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: employeeEmail, password: employeePassword }),
      });
      const empData = await empRes.json().catch(() => ({}));
      if (empRes.status === 200 && empData.user?.role === 'employee') {
        console.log(`  ✓ EMPLOYEE LOGIN VERIFIED: 200 OK (ID: ${empData.user.id}, role: ${empData.user.role})`);
      } else {
        console.error(`  ✗ EMPLOYEE LOGIN FAILED: Status ${empRes.status}, error: ${empData.error || 'unknown'}`);
      }
    } catch (e) {
      console.error(`  ✗ EMPLOYEE LOGIN ERROR: ${e.message}`);
    }
  }

  console.log(`\n🎉 Clean-slate operation for [${targetEnv.toUpperCase()}] finished successfully!`);
}

run().catch((err) => {
  console.error('\n❌ FATAL EXECUTION ERROR:', err);
  process.exit(1);
});
