import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKEND_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

if (!process.argv.includes('--confirm-prod')) {
  console.error('[DeployBackupProd] SAFETY ERROR: Missing required flag --confirm-prod. Aborting.');
  process.exit(1);
}

console.log('=== Deploying Automated Daily YDB Backup Function & Trigger to Production ===');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('[DeployBackupProd] Error: infrastructure/cloud-manifest.json not found!');
  process.exit(1);
}
if (!fs.existsSync(ENV_PATH)) {
  console.error('[DeployBackupProd] Error: .env.cloud.local not found!');
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

const saId = manifest.runtimeServiceAccount?.id || envVars.YC_SERVICE_ACCOUNT_ID;
if (!saId) {
  console.error('[DeployBackupProd] Error: runtimeServiceAccount ID not found in manifest or env!');
  process.exit(1);
}

// 1. Build Backup Bundle
console.log('\n[1/4] Building standalone backup handler bundle...');
execSync('npm run build:backup', { cwd: BACKEND_DIR, stdio: 'inherit' });

const distBackupDir = path.join(BACKEND_DIR, 'dist-backup');
const zipPath = path.join(distBackupDir, 'backup.zip');

if (process.platform === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path '${path.join(distBackupDir, 'backup.js')}' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`zip -j '${zipPath}' '${path.join(distBackupDir, 'backup.js')}'`, { stdio: 'inherit' });
}
console.log('✓ Successfully packaged backup.zip');

// 2. Ensure Function domexit-backup-prod exists
console.log('\n[2/4] Ensuring Cloud Function domexit-backup-prod exists...');
let functionId = '';
try {
  const fnRaw = execSync('yc serverless function get domexit-backup-prod --format json', {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const fnData = JSON.parse(fnRaw);
  functionId = fnData.id;
  console.log('✓ Found existing function domexit-backup-prod (ID:', functionId + ')');
} catch {
  console.log('Creating function domexit-backup-prod...');
  const createRaw = execSync(
    'yc serverless function create --name domexit-backup-prod --description "DomExit Automated Daily YDB Backup" --format json',
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const fnData = JSON.parse(createRaw);
  functionId = fnData.id;
  console.log('✓ Created function domexit-backup-prod (ID:', functionId + ')');
}

// 3. Deploy Function Version
console.log('\n[3/4] Deploying function version for domexit-backup-prod (512MB, 180s)...');
const envMap = {
  APP_ENV: 'production',
  YDB_DOCAPI_ENDPOINT: manifest.production.ydbDocApiEndpoint,
  YDB_REGION: manifest.region || 'ru-central1',
  YC_ACCESS_KEY_ID: envVars.YC_ACCESS_KEY_ID,
  YC_SECRET_ACCESS_KEY: envVars.YC_SECRET_ACCESS_KEY,
  S3_PRIVATE_BUCKET: manifest.production.privateDocsBucket,
  S3_PUBLIC_BUCKET: manifest.production.publicPhotosBucket,
  S3_ENDPOINT: 'https://storage.yandexcloud.net',
  JWT_SIGNING_SECRET: envVars.JWT_SIGNING_SECRET_PROD || envVars.JWT_SIGNING_SECRET || 'backup-runner-secret',
};

const envEntries = Object.entries(envMap)
  .filter(([_, v]) => v !== undefined && v !== null && v.trim() !== '')
  .map(([k, v]) => `${k}=${v.trim()}`)
  .join(',');

let versionOutput = '';
try {
  versionOutput = execSync(
    `yc serverless function version create --function-name domexit-backup-prod --runtime nodejs22 --memory 512m --execution-timeout 180s --entrypoint backup.handler --service-account-id ${saId} --source-path "${zipPath}" --environment "${envEntries}" --format json`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }
  );
} catch (execErr) {
  const cleanStderr = execErr.stderr
    ? execErr.stderr.replace(/--environment\s+"[^"]+"/g, '--environment "[REDACTED]"')
    : execErr.message;
  console.error('[DeployBackupProd] Error creating version:', cleanStderr);
  process.exit(1);
}

try {
  const vData = JSON.parse(versionOutput);
  console.log('✓ Function version deployed:');
  console.log('  ID:         ', vData.id);
  console.log('  Status:     ', vData.status);
  console.log('  Created At: ', vData.created_at);
} catch {
  console.log('✓ Function version deployed successfully');
}

// 4. Ensure Timer Trigger domexit-daily-backup-trigger exists
console.log('\n[4/4] Configuring Cloud Timer Trigger (0 2 * * ? * = 05:00 MSK)...');
const CRON_EXPR = '0 2 * * ? *';
let triggerId = '';

try {
  const trigRaw = execSync('yc serverless trigger get domexit-daily-backup-trigger --format json', {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const trigData = JSON.parse(trigRaw);
  triggerId = trigData.id;
  console.log('✓ Found existing timer trigger (ID:', triggerId, 'Status:', trigData.status + ')');
} catch {
  console.log('Creating timer trigger domexit-daily-backup-trigger...');
  const createTrigRaw = execSync(
    `yc serverless trigger create timer domexit-daily-backup-trigger --cron-expression "${CRON_EXPR}" --invoke-function-id ${functionId} --invoke-function-service-account-id ${saId} --description "DomExit Daily Automated YDB Backup Trigger" --format json`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const trigData = JSON.parse(createTrigRaw);
  triggerId = trigData.id;
  console.log('✓ Created timer trigger (ID:', triggerId + ')');
}

// Update manifest
manifest.production.backupFunctionId = functionId;
manifest.production.backupTriggerId = triggerId;
manifest.production.backupScheduleUtc = CRON_EXPR;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
console.log('✓ Manifest updated with backupFunctionId and backupTriggerId.');

console.log('\n=== Automated Backup Deployment Finished Successfully! ===');
console.log('Backup Function ID:   ', functionId);
console.log('Backup Trigger ID:    ', triggerId);
console.log('Schedule:             ', CRON_EXPR, '(02:00 UTC = 05:00 Moscow Time Daily)');
