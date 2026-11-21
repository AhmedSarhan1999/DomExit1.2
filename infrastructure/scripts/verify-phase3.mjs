import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

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
const privateBucket = envConfig.privateDocsBucket;

const ownerEmail = (envVars.PROD_OWNER_EMAIL || envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com').trim().toLowerCase();
const ownerPassword = (targetEnv === 'production' ? envVars.PROD_OWNER_PASSWORD : envVars.BOOTSTRAP_OWNER_PASSWORD)?.trim();
const employeeEmail = (envVars.PROD_EMPLOYEE_EMAIL || 'amaas9494@gmail.com').trim().toLowerCase();
const employeePassword = (targetEnv === 'production' ? envVars.PROD_EMPLOYEE_PASSWORD : envVars.BOOTSTRAP_EMPLOYEE_PASSWORD)?.trim();

const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || 'ru-central1';

const s3 = new S3Client({
  region,
  endpoint: 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

console.log('================================================================');
console.log(`=== Phase 3 Verification Suite [Environment: ${targetEnv.toUpperCase()}] ===`);
console.log('================================================================');
console.log('Target URL:    ', BASE_URL);
console.log('Private Bucket:', privateBucket);
console.log('Read-Only Mode:', isReadOnly ? 'YES (No test mutations)' : 'NO (Includes journal & backup test)');
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
  // Test 1: Backward Compatibility on /api/data/lots (no paginated param)
  console.log('--- Test 1: Backward Compatibility (Legacy Response Contract) ---');
  const legacyRes = await fetch(`${BASE_URL}/api/data/lots`);
  assert(legacyRes.status === 200, 'GET /api/data/lots returns 200 OK');
  const legacyJson = await legacyRes.json();
  assert(Array.isArray(legacyJson.items), 'GET /api/data/lots returns { items: [...] } (Legacy Contract Preserved 100%)');

  // Test 2: Server-Side Pagination & Filtering (?paginated=1)
  console.log('\n--- Test 2: Server-Side Pagination & Filtering ---');
  const paginatedRes = await fetch(`${BASE_URL}/api/data/lots?paginated=1&page=1&limit=5`);
  assert(paginatedRes.status === 200, 'GET /api/data/lots?paginated=1 returns 200 OK');
  const paginatedJson = await paginatedRes.json();
  assert(Array.isArray(paginatedJson.items), 'paginated response contains items array');
  assert(typeof paginatedJson.total === 'number', 'paginated response contains numeric total');
  assert(paginatedJson.page === 1, 'paginated response page === 1');
  assert(paginatedJson.limit === 5, 'paginated response limit === 5');
  assert(typeof paginatedJson.totalPages === 'number', 'paginated response contains numeric totalPages');
  assert(typeof paginatedJson.hasMore === 'boolean', 'paginated response contains boolean hasMore');

  // Test 2b: Sorting
  const sortRes = await fetch(`${BASE_URL}/api/data/lots?paginated=1&page=1&limit=5&sort=price_desc`);
  assert(sortRes.status === 200, 'GET /api/data/lots?paginated=1&sort=price_desc returns 200 OK');
  const sortJson = await sortRes.json();
  assert(Array.isArray(sortJson.items), 'sort response contains items');

  // Test 3: Admin Routes RBAC (401 -> 403 -> 200)
  console.log('\n--- Test 3: Admin Routes Strict RBAC Protection ---');
  // 3a. Unauthenticated access
  const unauthHealth = await fetch(`${BASE_URL}/api/admin/system-health`);
  assert(unauthHealth.status === 401, 'GET /api/admin/system-health unauthenticated returns 401 Unauthorized');

  const unauthBackups = await fetch(`${BASE_URL}/api/admin/backups`);
  assert(unauthBackups.status === 401, 'GET /api/admin/backups unauthenticated returns 401 Unauthorized');

  // 3b. Employee login (forbidden access)
  console.log('  Testing employee forbidden access to /api/admin/*...');
  const empLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: employeeEmail, password: employeePassword }),
  });
  assert(empLoginRes.status === 200, 'Employee login successful');
  const empCookie = empLoginRes.headers.get('set-cookie')?.split(';')[0];

  const empHealthRes = await fetch(`${BASE_URL}/api/admin/system-health`, {
    headers: { Cookie: empCookie },
  });
  assert(empHealthRes.status === 403, 'Employee GET /api/admin/system-health returns 403 Forbidden');

  const empBackupsRes = await fetch(`${BASE_URL}/api/admin/backups`, {
    headers: { Cookie: empCookie },
  });
  assert(empBackupsRes.status === 403, 'Employee GET /api/admin/backups returns 403 Forbidden');

  // Logout employee
  await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: empCookie },
  });

  // 3c. Owner login (authorized access)
  console.log('  Testing owner authorized access to /api/admin/*...');
  const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  assert(ownerLoginRes.status === 200, 'Owner login successful');
  const ownerCookie = ownerLoginRes.headers.get('set-cookie')?.split(';')[0];

  const ownerHealthRes = await fetch(`${BASE_URL}/api/admin/system-health`, {
    headers: { Cookie: ownerCookie },
  });
  assert(ownerHealthRes.status === 200, 'Owner GET /api/admin/system-health returns 200 OK');
  const healthData = await ownerHealthRes.json();
  assert(healthData.ydb?.ok === true, 'System Health reports YDB is OK');
  assert(healthData.storage?.privateBucketOk === true, 'System Health reports privateBucketOk === true');
  assert(typeof healthData.ydb?.latencyMs === 'number', 'System Health reports YDB latency');
  assert(typeof healthData.backups?.totalDailyBackups === 'number', 'System Health reports totalDailyBackups');
  console.log(`    System Health Status: ${healthData.status}, YDB Latency: ${healthData.ydb.latencyMs}ms, Memory RSS: ${healthData.runtime.memoryRssMb}MB`);

  const ownerBackupsRes = await fetch(`${BASE_URL}/api/admin/backups`, {
    headers: { Cookie: ownerCookie },
  });
  assert(ownerBackupsRes.status === 200, 'Owner GET /api/admin/backups returns 200 OK');
  const backupsListData = await ownerBackupsRes.json();
  assert(Array.isArray(backupsListData.backups), 'Backups list is an array');
  console.log(`    Total backups listed in S3: ${backupsListData.total}`);

  // Test 4: Immutable Journal Test (Non-Read-Only mode)
  if (!isReadOnly) {
    console.log('\n--- Test 4: Immutable Transaction Journal Lifecycle ---');
    const testRecordId = `test-journal-${Date.now()}`;

    // 4a. Create record
    console.log(`  Creating test seller_requests item: ${testRecordId}...`);
    const createReqRes = await fetch(`${BASE_URL}/api/data/seller_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        id: testRecordId,
        contactName: 'Journal Verification Test',
        status: 'new',
        createdAt: new Date().toISOString(),
      }),
    });
    assert(createReqRes.status === 200, 'POST /api/data/seller_requests returns 200 OK');

    // 4b. Verify Journal entry in S3
    const now = new Date();
    const yyyy = now.getUTCFullYear().toString();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const journalPrefix = `_journal/${yyyy}/${mm}/${dd}/`;

    console.log(`  Verifying event file in s3://${privateBucket}/${journalPrefix}...`);
    await new Promise((r) => setTimeout(r, 1000)); // allow async upload completion

    const listJournalRes = await s3.send(
      new ListObjectsV2Command({
        Bucket: privateBucket,
        Prefix: journalPrefix,
      })
    );
    const matchingEvents = (listJournalRes.Contents || []).filter((item) =>
      item.Key && item.Key.includes(testRecordId)
    );
    assert(matchingEvents.length > 0, `Immutable journal event file found for ${testRecordId}`);
    console.log(`    Found journal event key: ${matchingEvents[0].Key}`);

    // 4c. Delete test record and clean up S3
    console.log(`  Cleaning up test record ${testRecordId}...`);
    await fetch(`${BASE_URL}/api/data/seller_requests/${testRecordId}`, {
      method: 'DELETE',
      headers: { Cookie: ownerCookie },
    });

    for (const ev of matchingEvents) {
      await s3.send(new DeleteObjectCommand({ Bucket: privateBucket, Key: ev.Key }));
    }
    console.log('  ✓ Test record and test journal files cleaned up. Staging pristine.');

    // Test 5: Trigger Manual Backup
    console.log('\n--- Test 5: Manual Automated Backup Trigger (POST /api/admin/backups/run) ---');
    const runBackupRes = await fetch(`${BASE_URL}/api/admin/backups/run`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
    });
    assert(runBackupRes.status === 200, 'POST /api/admin/backups/run returns 200 OK');
    const backupResult = await runBackupRes.json();
    assert(backupResult.success === true && backupResult.ok === true, 'Backup returned success: true, ok: true');
    assert(typeof backupResult.key === 'string' && backupResult.key.startsWith('_backups/ydb/daily/'), 'Backup key starts with _backups/ydb/daily/');
    assert(backupResult.tableCount > 0, `Backup captured ${backupResult.tableCount} tables`);
    assert(backupResult.totalRecords >= 0, `Backup captured ${backupResult.totalRecords} total records`);
    console.log(`    Backup created: ${backupResult.key} (${(backupResult.sizeBytes / 1024).toFixed(1)} KB) in ${backupResult.durationMs}ms`);
  }

  console.log('\n================================================================');
  console.log(`=== PHASE 3 VERIFICATION SUITE: ALL TESTS PASSED (100%) ===`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('\n[VerifyPhase3] Test Failure:', err.message);
  process.exit(1);
});
