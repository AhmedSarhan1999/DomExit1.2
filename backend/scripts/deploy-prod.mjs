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
const APIGW_SPEC_PATH = path.join(ROOT_DIR, 'infrastructure/apigw-prod.yaml');

if (!process.argv.includes('--confirm-prod')) {
  console.error('[DeployProd] SAFETY ERROR: Missing required flag --confirm-prod. Aborting.');
  process.exit(1);
}

console.log('=== Starting DomExit Production Deployment to Yandex Cloud (ru-central1) ===');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('[DeployProd] Error: infrastructure/cloud-manifest.json not found!');
  process.exit(1);
}
if (!fs.existsSync(ENV_PATH)) {
  console.error('[DeployProd] Error: .env.cloud.local not found!');
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
  console.error('[DeployProd] Error: runtimeServiceAccount ID not found in manifest or env!');
  process.exit(1);
}

const jwtSecretProd = envVars.JWT_SIGNING_SECRET_PROD?.trim();
if (!jwtSecretProd) {
  console.error('[DeployProd] Error: JWT_SIGNING_SECRET_PROD not found in .env.cloud.local!');
  process.exit(1);
}

// 1. Build Backend
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

// 2. Ensure Function Exists
console.log('\n[2/5] Ensuring Cloud Function domexit-api-prod exists...');
let functionId = '';
try {
  const fnRaw = execSync('yc serverless function get domexit-api-prod --format json', {
    encoding: 'utf-8',
  });
  const fnData = JSON.parse(fnRaw);
  functionId = fnData.id;
  console.log('✓ Found existing function domexit-api-prod (ID:', functionId + ')');
} catch {
  console.log('Creating new function domexit-api-prod...');
  const createRaw = execSync(
    'yc serverless function create --name domexit-api-prod --description "DomExit Production Serverless API" --format json',
    { encoding: 'utf-8' }
  );
  const fnData = JSON.parse(createRaw);
  functionId = fnData.id;
  console.log('✓ Created function domexit-api-prod (ID:', functionId + ')');
}

// 3. Update APIGW Spec with Function ID & Deploy API Gateway
console.log('\n[3/5] Updating API Gateway Spec & Deploying domexit-gw-prod...');
let specContent = fs.readFileSync(APIGW_SPEC_PATH, 'utf-8');
specContent = specContent.replace(/function_id:\s*[^\s]+/g, `function_id: ${functionId}`);
fs.writeFileSync(APIGW_SPEC_PATH, specContent, 'utf-8');
console.log(`✓ Spec updated with function_id: ${functionId}`);

let apigwId = '';
let apigwDomain = '';

try {
  const gwRaw = execSync('yc serverless api-gateway get domexit-gw-prod --format json', {
    encoding: 'utf-8',
  });
  const gwData = JSON.parse(gwRaw);
  apigwId = gwData.id;
  apigwDomain = gwData.domain;
  console.log('✓ Found existing API Gateway (ID:', apigwId, 'Domain:', apigwDomain + ')');

  // Update spec
  execSync(`yc serverless api-gateway update domexit-gw-prod --spec "${APIGW_SPEC_PATH}"`, {
    stdio: 'inherit',
  });
} catch {
  console.log('Creating API Gateway domexit-gw-prod...');
  const createRaw = execSync(
    `yc serverless api-gateway create domexit-gw-prod --spec "${APIGW_SPEC_PATH}" --format json`,
    { encoding: 'utf-8' }
  );
  const gwData = JSON.parse(createRaw);
  apigwId = gwData.id;
  apigwDomain = gwData.domain;
  console.log('✓ Created API Gateway (ID:', apigwId, 'Domain:', apigwDomain + ')');
}

const rawApigwUrl = `https://${apigwDomain}`;
const publicBaseUrl = manifest.production?.productionCustomDomain || 'https://domexit.ru';
console.log('API Gateway Direct URL:       ', rawApigwUrl);
console.log('Public Production Base URL:   ', publicBaseUrl);

// 4. Deploy Cloud Function Version with Injected Environment
console.log('\n[4/5] Deploying Cloud Function Version with Production Environment...');

const envMap = {
  APP_ENV: 'production',
  YDB_DOCAPI_ENDPOINT: manifest.production.ydbDocApiEndpoint,
  YDB_REGION: manifest.region || 'ru-central1',
  YC_ACCESS_KEY_ID: envVars.YC_ACCESS_KEY_ID,
  YC_SECRET_ACCESS_KEY: envVars.YC_SECRET_ACCESS_KEY,
  S3_PUBLIC_BUCKET: manifest.production.publicPhotosBucket,
  S3_PRIVATE_BUCKET: manifest.production.privateDocsBucket,
  S3_ENDPOINT: 'https://storage.yandexcloud.net',
  JWT_SIGNING_SECRET: jwtSecretProd,
  YANDEX_OAUTH_CLIENT_ID: envVars.YANDEX_OAUTH_CLIENT_ID || '72f6de11197d4e9da68ea1fec90c72e1',
  YANDEX_OAUTH_CLIENT_SECRET: envVars.YANDEX_OAUTH_CLIENT_SECRET || '',
  PUBLIC_BASE_URL: publicBaseUrl,
  FRONTEND_URL: publicBaseUrl,
  YANDEX_REDIRECT_URI: `${publicBaseUrl}/api/auth/yandex/callback`,
  PROD_CUSTOM_DOMAIN: publicBaseUrl,
  RAW_APIGW_URL: rawApigwUrl,
  BOOTSTRAP_OWNER_EMAIL: envVars.PROD_OWNER_EMAIL || envVars.BOOTSTRAP_OWNER_EMAIL || 'amaas9499@gmail.com',
  TELEGRAM_BOT_TOKEN: envVars.TELEGRAM_BOT_TOKEN_PROD || envVars.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_BOT_USERNAME: envVars.TELEGRAM_BOT_USERNAME_PROD || envVars.TELEGRAM_BOT_USERNAME || 'DomExitOfficialBot',
  TELEGRAM_WEBHOOK_SECRET: envVars.TELEGRAM_WEBHOOK_SECRET_PROD || envVars.TELEGRAM_WEBHOOK_SECRET || '',
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
  YDB_USE_V2_TABLES: 'true',
  YMQ_OCR_QUEUE_URL: manifest.production.ymqOcrQueueUrl || '',
  YC_FOLDER_ID: manifest.folderId || 'b1g46uad3gc3h34k5b0f',
  DAILY_GPT_CALLS_CAP: '200',
  DAILY_OCR_PAGES_CAP: '200',
  MAX_PAGES_PER_DOC: '15',
};

// Build environment string without printing secrets to console
const envEntries = Object.entries(envMap)
  .filter(([_, v]) => v !== undefined && v !== null && v.trim() !== '')
  .map(([k, v]) => `${k}=${v.trim()}`)
  .join(',');

console.log('Configuring function environment: APP_ENV=production, target YDB database:', manifest.production.ydbDatabaseId);

let versionOutput = '';
try {
  versionOutput = execSync(
    `yc serverless function version create --function-name domexit-api-prod --runtime nodejs22 --memory 256m --execution-timeout 30s --entrypoint index.handler --service-account-id ${saId} --source-path "${zipPath}" --environment "${envEntries}" --format json`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }
  );
} catch (execErr) {
  const cleanStderr = execErr.stderr
    ? execErr.stderr.replace(/--environment\s+"[^"]+"/g, '--environment "[REDACTED]"')
    : execErr.message;
  console.error('[DeployProd] Error creating version:', cleanStderr);
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

// 5. Update cloud-manifest.json
console.log('\n[5/5] Updating infrastructure/cloud-manifest.json...');
manifest.production.apiFunctionId = functionId;
manifest.production.apiGatewayId = apigwId;
manifest.production.apiGatewayUrl = publicBaseUrl;

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
console.log('✓ Manifest updated with Production endpoints.');

console.log('\n=== Production Deployment Finished Successfully! ===');
console.log('Production URL:        ', publicBaseUrl);
console.log('Health Check URL:      ', `${publicBaseUrl}/api/health`);
console.log('Yandex ID Redirect URI:', `${publicBaseUrl}/api/auth/yandex/callback`);
