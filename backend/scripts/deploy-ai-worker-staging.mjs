/**
 * backend/scripts/deploy-ai-worker-staging.mjs
 * Builds and deploys the background AI Worker (domexit-ai-worker-staging) to Yandex Cloud.
 */

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

console.log('=== Deploying DomExit AI Worker to Staging (ru-central1) ===');

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('Error: infrastructure/cloud-manifest.json or .env.cloud.local not found!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envVars = {};
for (const line of fs.readFileSync(ENV_PATH, 'utf-8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const saId = manifest.runtimeServiceAccount?.id || envVars.YC_SERVICE_ACCOUNT_ID || 'aje70eogmpm04c84rsnl';
const funcName = 'domexit-ai-worker-staging';
const distWorkerDir = path.join(BACKEND_DIR, 'dist-worker');
const zipPath = path.join(distWorkerDir, 'ai-worker.zip');

if (!fs.existsSync(distWorkerDir)) {
  fs.mkdirSync(distWorkerDir, { recursive: true });
}

// 1. Build Worker Bundle
console.log('\n[1/3] Typechecking and building AI Worker bundle...');
execSync('npm run typecheck', { cwd: BACKEND_DIR, stdio: 'inherit' });
execSync('npm run build:ai-worker', { cwd: BACKEND_DIR, stdio: 'inherit' });

// Create zip
if (process.platform === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path '${path.join(distWorkerDir, 'ai-worker.js')}' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`zip -j "${zipPath}" "${path.join(distWorkerDir, 'ai-worker.js')}"`, { stdio: 'inherit' });
}
console.log('✓ Successfully created deployment package ai-worker.zip');

// 2. Prepare Environment Map
const envMap = {
  APP_ENV: 'staging',
  YDB_DOCAPI_ENDPOINT: manifest.staging.ydbDocApiEndpoint,
  YDB_REGION: manifest.region || 'ru-central1',
  YC_ACCESS_KEY_ID: envVars.YC_ACCESS_KEY_ID,
  YC_SECRET_ACCESS_KEY: envVars.YC_SECRET_ACCESS_KEY,
  JWT_SIGNING_SECRET: envVars.JWT_SIGNING_SECRET,
  S3_PRIVATE_BUCKET: manifest.staging.privateDocsBucket,
  S3_ENDPOINT: 'https://storage.yandexcloud.net',
  YDB_USE_V2_TABLES: 'true',
  YMQ_OCR_QUEUE_URL: manifest.staging.ymqOcrQueueUrl || '',
  YC_FOLDER_ID: manifest.folderId || 'b1g46uad3gc3h34k5b0f',
  DAILY_OCR_PAGES_CAP: '200',
  MAX_PAGES_PER_DOC: '15',
};

const envEntries = Object.entries(envMap)
  .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
  .map(([k, v]) => `${k}=${String(v).trim()}`)
  .join(',');

// 3. Deploy Function Version
console.log('\n[2/3] Deploying Cloud Function Version with Staging Environment...');
let versionOutput = '';
try {
  versionOutput = execSync(
    `yc serverless function version create --function-name ${funcName} --runtime nodejs22 --memory 512m --execution-timeout 180s --entrypoint ai-worker.handler --service-account-id ${saId} --source-path "${zipPath}" --environment "${envEntries}" --format json`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }
  );
} catch (execErr) {
  const cleanStderr = execErr.stderr
    ? execErr.stderr.replace(/--environment\s+"[^"]+"/g, '--environment "[REDACTED]"')
    : execErr.message;
  console.error('[DeployAiWorker] Error creating version:', cleanStderr);
  process.exit(1);
}

try {
  const versionData = JSON.parse(versionOutput);
  console.log('✓ AI Worker version successfully deployed!');
  console.log('  ID:         ', versionData.id);
  console.log('  Function ID:', versionData.function_id);
  console.log('  Status:     ', versionData.status);
  console.log('  Runtime:    ', versionData.runtime);
  console.log('  Memory:     ', versionData.resources?.memory);
  console.log('  Timeout:    ', versionData.execution_timeout);
} catch {
  console.log('✓ AI Worker version successfully deployed!');
}

console.log('\n[3/3] AI Worker Staging Deployment Complete!');
