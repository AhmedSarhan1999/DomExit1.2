const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { S3Client, PutObjectCommand } = require('../../backend/node_modules/@aws-sdk/client-s3');

if (!process.argv.includes('--confirm-prod')) {
  console.error('[DeployWebProd] SAFETY ERROR: Missing required flag --confirm-prod. Aborting.');
  process.exit(1);
}

const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('[DeployWebProd] Manifest not found:', MANIFEST_PATH);
  process.exit(1);
}

if (!fs.existsSync(ENV_PATH)) {
  console.error('[DeployWebProd] .env.cloud.local not found:', ENV_PATH);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const bucket = manifest.production?.webStaticBucket;

if (!bucket) {
  console.error('[DeployWebProd] production.webStaticBucket not found in cloud-manifest.json');
  process.exit(1);
}

// 1. Build frontend
console.log('=== Building DomExit Frontend for Production ===');
console.log('[1/3] Running typecheck and production build...');
execSync('npm run typecheck', { cwd: ROOT_DIR, stdio: 'inherit' });
execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

if (!fs.existsSync(DIST_DIR)) {
  console.error('[DeployWebProd] dist directory not found after build!');
  process.exit(1);
}

// 2. Post-build security scan
console.log('\n[2/3] Performing post-build security scan on dist/ bundle...');
const FORBIDDEN_PATTERNS = [
  /YCPeO8/i,
  /docapi\.serverless\.yandexcloud\.net/i,
  /JWT_SIGNING_SECRET/i,
  /service_account_id/i,
  /private_key_id/i,
];

function scanDir(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (item.endsWith('.js') || item.endsWith('.html') || item.endsWith('.json')) {
      const content = fs.readFileSync(full, 'utf-8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`\n[DeployWebProd] SECURITY ALERT: Forbidden pattern ${pattern} matched in file: ${full}`);
          process.exit(1);
        }
      }
    }
  }
}

scanDir(DIST_DIR);
console.log('✓ Security scan passed: Zero secret keys, zero direct DB endpoints detected in dist/.');

// 3. Upload to domexit-web-prod
console.log(`\n[3/3] Deploying static bundle to production bucket: ${bucket}...`);

const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || envVars.YC_REGION?.trim() || 'ru-central1';

if (!accessKeyId || !secretAccessKey) {
  console.error('[DeployWebProd] YC_ACCESS_KEY_ID or YC_SECRET_ACCESS_KEY missing from .env.cloud.local');
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

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

function getFiles(dir, base = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const relPath = base ? `${base}/${file}` : file;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(fullPath, relPath));
    } else {
      results.push({ fullPath, relPath: relPath.replace(/\\/g, '/') });
    }
  }
  return results;
}

async function deploy() {
  const files = getFiles(DIST_DIR);
  console.log(`Found ${files.length} files to upload.\n`);

  let totalBytes = 0;
  const startTime = Date.now();

  for (const file of files) {
    const ext = path.extname(file.relPath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const isIndex = file.relPath === 'index.html';
    const isAsset = file.relPath.startsWith('assets/');

    const cacheControl = isIndex
      ? 'public, max-age=0, must-revalidate'
      : isAsset
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600';

    const fileBuffer = fs.readFileSync(file.fullPath);
    totalBytes += fileBuffer.length;

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: file.relPath,
      Body: fileBuffer,
      ContentType: contentType,
      CacheControl: cacheControl,
    });

    try {
      await s3.send(cmd);
      const kb = (fileBuffer.length / 1024).toFixed(1);
      console.log(`✓ Uploaded: ${file.relPath.padEnd(45)} [${kb} KB] (${contentType})`);
    } catch (err) {
      console.error(`✗ FAILED to upload ${file.relPath}:`, err.message);
      throw err;
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n=== Production Web Deployment Complete ===`);
  console.log(`Total Files:   ${files.length}`);
  console.log(`Total Uploaded:${totalMb} MB`);
  console.log(`Duration:      ${durationSec}s`);
  console.log(`Target Bucket: ${bucket}`);
  console.log(`Live Prod URL: ${manifest.production.apiGatewayUrl}`);
}

deploy().catch((err) => {
  console.error('[DeployWebProd] Fatal error:', err);
  process.exit(1);
});
