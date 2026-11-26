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
const APIGW_SPEC_PATH = path.join(ROOT_DIR, 'infrastructure/apigw-staging.yaml');

console.log('=== Starting DomExit Staging Deployment to Yandex Cloud (ru-central1) ===');

// 1. Verify Prerequisites
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('Error: infrastructure/cloud-manifest.json not found!');
  process.exit(1);
}
if (!fs.existsSync(ENV_PATH)) {
  console.error('Error: .env.cloud.local not found!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envVars = {};
const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (k && envVars[k] === undefined) {
      envVars[k] = v;
    }
  }
};
loadEnvFile(ENV_PATH);
loadEnvFile(path.join(ROOT_DIR, '.env.backend.local'));

const saId = manifest.runtimeServiceAccount?.id || envVars.YC_SERVICE_ACCOUNT_ID;
if (!saId) {
  console.error('Error: runtimeServiceAccount ID not found in manifest or env!');
  process.exit(1);
}

// 2. Build Backend
console.log('\n[1/5] Typechecking and building backend bundle...');
execSync('npm run typecheck', { cwd: BACKEND_DIR, stdio: 'inherit' });
execSync('npm run build', { cwd: BACKEND_DIR, stdio: 'inherit' });

// Create bundle.zip containing index.js
const distDir = path.join(BACKEND_DIR, 'dist');
const zipPath = path.join(distDir, 'bundle.zip');

if (process.platform === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path '${path.join(distDir, 'index.js')}' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`zip -j '${zipPath}' '${path.join(distDir, 'index.js')}'`, { stdio: 'inherit' });
}
console.log('✓ Successfully created deployment package bundle.zip');

// 3. Ensure Function Exists
console.log('\n[2/5] Ensuring Cloud Function domexit-api-staging exists...');
let functionId = '';
try {
  const fnRaw = execSync('yc serverless function get domexit-api-staging --format json', {
    encoding: 'utf-8',
  });
  const fnData = JSON.parse(fnRaw);
  functionId = fnData.id;
  console.log('✓ Found existing function domexit-api-staging (ID:', functionId + ')');
} catch {
  console.log('Creating new function domexit-api-staging...');
  const createRaw = execSync(
    'yc serverless function create --name domexit-api-staging --description "DomExit Staging Serverless API" --format json',
    { encoding: 'utf-8' }
  );
  const fnData = JSON.parse(createRaw);
  functionId = fnData.id;
  console.log('✓ Created function domexit-api-staging (ID:', functionId + ')');
}

// 4. Ensure API Gateway Exists & Retrieve Domain
console.log('\n[3/5] Checking / Deploying API Gateway domexit-gw-staging...');
let apigwId = '';
let apigwDomain = '';

try {
  const gwRaw = execSync('yc serverless api-gateway get domexit-gw-staging --format json', {
    encoding: 'utf-8',
  });
  const gwData = JSON.parse(gwRaw);
  apigwId = gwData.id;
  apigwDomain = gwData.domain;
  console.log('✓ Found existing API Gateway (ID:', apigwId, 'Domain:', apigwDomain + ')');

  // Update spec
  execSync(`yc serverless api-gateway update domexit-gw-staging --spec "${APIGW_SPEC_PATH}"`, {
    stdio: 'inherit',
  });
} catch {
  console.log('Creating API Gateway domexit-gw-staging...');
  const createRaw = execSync(
    `yc serverless api-gateway create domexit-gw-staging --spec "${APIGW_SPEC_PATH}" --format json`,
    { encoding: 'utf-8' }
  );
  const gwData = JSON.parse(createRaw);
  apigwId = gwData.id;
  apigwDomain = gwData.domain;
  console.log('✓ Created API Gateway (ID:', apigwId, 'Domain:', apigwDomain + ')');
}

const publicBaseUrl = `https://${apigwDomain}`;
console.log('Public API Gateway URL:', publicBaseUrl);

// 5. Deploy Cloud Function Version with Injected Environment
console.log('\n[4/5] Deploying Cloud Function Version with Staging Environment...');

const envMap = {
  APP_ENV: 'staging',
  YDB_DOCAPI_ENDPOINT: manifest.staging.ydbDocApiEndpoint,
  YDB_REGION: manifest.region || 'ru-central1',
  YC_ACCESS_KEY_ID: envVars.YC_ACCESS_KEY_ID,
  YC_SECRET_ACCESS_KEY: envVars.YC_SECRET_ACCESS_KEY,
  S3_PUBLIC_BUCKET: manifest.staging.publicPhotosBucket,
  S3_PRIVATE_BUCKET: manifest.staging.privateDocsBucket,
  S3_ENDPOINT: 'https://storage.yandexcloud.net',
  JWT_SIGNING_SECRET: envVars.JWT_SIGNING_SECRET,
  YANDEX_OAUTH_CLIENT_ID: envVars.YANDEX_OAUTH_CLIENT_ID || '72f6de11197d4e9da68ea1fec90c72e1',
  YANDEX_OAUTH_CLIENT_SECRET: envVars.YANDEX_OAUTH_CLIENT_SECRET || '',
  PUBLIC_BASE_URL: publicBaseUrl,
  FRONTEND_URL: publicBaseUrl,
  YANDEX_REDIRECT_URI: `${publicBaseUrl}/api/auth/yandex/callback`,
  BOOTSTRAP_OWNER_EMAIL: envVars.BOOTSTRAP_OWNER_EMAIL || '',
  TELEGRAM_BOT_TOKEN: envVars.TELEGRAM_BOT_TOKEN_STAGING || envVars.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_BOT_USERNAME: envVars.TELEGRAM_BOT_USERNAME_STAGING || envVars.TELEGRAM_BOT_USERNAME || 'DomExitStageBot',
  TELEGRAM_WEBHOOK_SECRET: envVars.TELEGRAM_WEBHOOK_SECRET_STAGING || envVars.TELEGRAM_WEBHOOK_SECRET || '',
  EMAIL_PROVIDER: envVars.EMAIL_PROVIDER || (envVars.POSTBOX_SMTP_USER ? 'postbox' : 'console'),
  POSTBOX_SMTP_HOST: envVars.POSTBOX_SMTP_HOST || 'postbox.cloud.yandex.net',
  POSTBOX_SMTP_PORT: envVars.POSTBOX_SMTP_PORT || '465',
  POSTBOX_SMTP_USER: envVars.POSTBOX_SMTP_USER || '',
  POSTBOX_SMTP_PASS: envVars.POSTBOX_SMTP_PASS || '',
  EMAIL_FROM: envVars.EMAIL_FROM || 'DomExit <no-reply@domexit.ru>',
  MESSENGER_PROVIDER: envVars.MESSENGER_PROVIDER || 'telegram',
  MAX_BOT_TOKEN: envVars.MAX_BOT_TOKEN || '',
  MAX_BOT_USERNAME: envVars.MAX_BOT_USERNAME || '',
  MAX_WEBHOOK_SECRET: envVars.MAX_WEBHOOK_SECRET || '',
  MAX_API_BASE_URL: envVars.MAX_API_BASE_URL || 'https://api.max-messenger.ru/bot/v1',
  DADATA_API_KEY: envVars.DADATA_API_KEY || '',
  AGENT_BRIDGE_SECRET: envVars.AGENT_BRIDGE_SECRET || '',
  EXTERNAL_AGENT_WEBHOOK_URL: envVars.EXTERNAL_AGENT_WEBHOOK_URL || '',
  AGENT_TELEGRAM_CHAT_ID: envVars.AGENT_TELEGRAM_CHAT_ID || '',
  YMQ_OCR_QUEUE_URL: manifest.staging?.ymqOcrQueueUrl || envVars.YMQ_OCR_QUEUE_URL || '',
  YC_FOLDER_ID: manifest.folderId || 'b1g46uad3gc3h34k5b0f',
  DAILY_OCR_PAGES_CAP: '200',
  MAX_PAGES_PER_DOC: '15',
  YDB_USE_V2_TABLES: 'true',
};

// Build environment string without printing secrets to console
const envEntries = Object.entries(envMap)
  .filter(([_, v]) => v !== undefined && v !== null && v.trim() !== '')
  .map(([k, v]) => `${k}=${v.trim()}`)
  .join(',');

let versionOutput = '';
try {
  versionOutput = execSync(
    `yc serverless function version create --function-name domexit-api-staging --runtime nodejs22 --memory 256m --execution-timeout 30s --entrypoint index.handler --service-account-id ${saId} --source-path "${zipPath}" --environment "${envEntries}" --format json`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }
  );
} catch (execErr) {
  const cleanStderr = execErr.stderr
    ? execErr.stderr.replace(/--environment\s+"[^"]+"/g, '--environment "[REDACTED]"')
    : execErr.message;
  console.error('[DeployStaging] Error creating version:', cleanStderr);
  process.exit(1);
}

try {
  const versionData = JSON.parse(versionOutput);
  console.log('✓ Cloud Function version successfully deployed!');
  console.log('  ID:         ', versionData.id);
  console.log('  Function ID:', versionData.function_id);
  console.log('  Status:     ', versionData.status);
  console.log('  Runtime:    ', versionData.runtime);
  console.log('  Created At: ', versionData.created_at);
  if (versionData.image_size) console.log('  Image Size: ', versionData.image_size);
} catch {
  console.log('✓ Cloud Function version successfully deployed!');
}

// 6. Update cloud-manifest.json
console.log('\n[5/5] Updating infrastructure/cloud-manifest.json...');
manifest.staging.apiFunctionId = functionId;
manifest.staging.apiGatewayId = apigwId;
manifest.staging.apiGatewayUrl = publicBaseUrl;

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
console.log('✓ Manifest updated with Staging endpoints.');

console.log('\n=== Staging Deployment Finished Successfully! ===');
console.log('Staging URL:', publicBaseUrl);
console.log('Health Check URL:', `${publicBaseUrl}/api/health`);
console.log('Yandex ID Redirect URI:', `${publicBaseUrl}/api/auth/yandex/callback`);
