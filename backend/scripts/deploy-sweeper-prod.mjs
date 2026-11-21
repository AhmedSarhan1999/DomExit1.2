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
  console.error('[DeploySweeperProd] SAFETY ERROR: Missing required flag --confirm-prod. Aborting.');
  process.exit(1);
}

console.log('=== Deploying Automated 15-Minute SLA Sweeper Function & Trigger to Production ===');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('[DeploySweeperProd] Error: infrastructure/cloud-manifest.json not found!');
  process.exit(1);
}
if (!fs.existsSync(ENV_PATH)) {
  console.error('[DeploySweeperProd] Error: .env.cloud.local not found!');
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
  console.error('[DeploySweeperProd] Error: runtimeServiceAccount ID not found in manifest or env!');
  process.exit(1);
}

// 1. Build Sweeper Bundle
console.log('\n[1/4] Building standalone SLA sweeper handler bundle...');
execSync('npm run build:sweeper', { cwd: BACKEND_DIR, stdio: 'inherit' });

const distSweeperDir = path.join(BACKEND_DIR, 'dist-sweeper');
if (!fs.existsSync(distSweeperDir)) {
  fs.mkdirSync(distSweeperDir, { recursive: true });
}
const zipPath = path.join(distSweeperDir, 'sweeper.zip');

if (process.platform === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path '${path.join(distSweeperDir, 'sweeper.js')}' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`zip -j '${zipPath}' '${path.join(distSweeperDir, 'sweeper.js')}'`, { stdio: 'inherit' });
}
console.log('✓ Successfully packaged sweeper.zip');

// 2. Ensure Function domexit-sla-sweeper-prod exists
console.log('\n[2/4] Ensuring Cloud Function domexit-sla-sweeper-prod exists...');
let functionId = '';
try {
  const fnRaw = execSync('yc serverless function get domexit-sla-sweeper-prod --format json', {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const fnData = JSON.parse(fnRaw);
  functionId = fnData.id;
  console.log('✓ Found existing function domexit-sla-sweeper-prod (ID:', functionId + ')');
} catch {
  console.log('Creating function domexit-sla-sweeper-prod...');
  const createRaw = execSync(
    'yc serverless function create --name domexit-sla-sweeper-prod --description "DomExit Automated 15-Minute SLA Sweeper" --format json',
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const fnData = JSON.parse(createRaw);
  functionId = fnData.id;
  console.log('✓ Created function domexit-sla-sweeper-prod (ID:', functionId + ')');
}

// 3. Deploy Function Version
console.log('\n[3/4] Deploying function version for domexit-sla-sweeper-prod (512MB, 120s)...');
const envMap = {
  APP_ENV: 'production',
  YDB_DOCAPI_ENDPOINT: manifest.production.ydbDocApiEndpoint,
  YDB_REGION: manifest.region || 'ru-central1',
  YC_ACCESS_KEY_ID: envVars.YC_ACCESS_KEY_ID,
  YC_SECRET_ACCESS_KEY: envVars.YC_SECRET_ACCESS_KEY,
  JWT_SIGNING_SECRET: envVars.JWT_SIGNING_SECRET_PROD || envVars.JWT_SIGNING_SECRET || 'sweeper-runner-secret',
  TELEGRAM_BOT_TOKEN: envVars.TELEGRAM_BOT_TOKEN_PROD || envVars.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_BOT_USERNAME: envVars.TELEGRAM_BOT_USERNAME_PROD || 'DomExitOfficialBot',
};

const envEntries = Object.entries(envMap)
  .filter(([_, v]) => v !== undefined && v !== null && v.trim() !== '')
  .map(([k, v]) => `${k}=${v.trim()}`)
  .join(',');

let versionOutput = '';
try {
  versionOutput = execSync(
    `yc serverless function version create --function-name domexit-sla-sweeper-prod --runtime nodejs22 --memory 512m --execution-timeout 120s --entrypoint sweeper.handler --service-account-id ${saId} --source-path "${zipPath}" --environment "${envEntries}" --format json`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }
  );
} catch (execErr) {
  const cleanStderr = execErr.stderr
    ? execErr.stderr.replace(/--environment\s+"[^"]+"/g, '--environment "[REDACTED]"')
    : execErr.message;
  console.error('[DeploySweeperProd] Error creating version:', cleanStderr);
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

// 4. Ensure Timer Trigger domexit-sla-sweeper-trigger exists
console.log('\n[4/4] Configuring Cloud Timer Trigger (0/15 * * * ? * = every 15 minutes)...');
const CRON_EXPR = '0/15 * * * ? *';
let triggerId = '';

try {
  const trigRaw = execSync('yc serverless trigger get domexit-sla-sweeper-trigger --format json', {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const trigData = JSON.parse(trigRaw);
  triggerId = trigData.id;
  console.log('✓ Found existing timer trigger (ID:', triggerId, 'Status:', trigData.status + ')');
} catch {
  console.log('Creating timer trigger domexit-sla-sweeper-trigger...');
  const createTrigRaw = execSync(
    `yc serverless trigger create timer domexit-sla-sweeper-trigger --cron-expression "${CRON_EXPR}" --invoke-function-id ${functionId} --invoke-function-service-account-id ${saId} --description "DomExit 15-Minute SLA Sweeper Trigger" --format json`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const trigData = JSON.parse(createTrigRaw);
  triggerId = trigData.id;
  console.log('✓ Created timer trigger (ID:', triggerId + ')');
}

// Update manifest
manifest.production.sweeperFunctionId = functionId;
manifest.production.sweeperTriggerId = triggerId;
manifest.production.sweeperScheduleUtc = CRON_EXPR;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
console.log('✓ Manifest updated with sweeperFunctionId and sweeperTriggerId.');

console.log('\n=== Automated SLA Sweeper Deployment Finished Successfully! ===');
console.log('Sweeper Function ID:   ', functionId);
console.log('Sweeper Trigger ID:    ', triggerId);
console.log('Schedule:              ', CRON_EXPR, '(Every 15 minutes)');
