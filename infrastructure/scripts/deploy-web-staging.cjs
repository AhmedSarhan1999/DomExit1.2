const fs = require('node:fs');
const path = require('node:path');
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('../../backend/node_modules/@aws-sdk/client-s3');

const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('[Deploy] Manifest not found:', MANIFEST_PATH);
  process.exit(1);
}

if (!fs.existsSync(ENV_PATH)) {
  console.error('[Deploy] .env.cloud.local not found:', ENV_PATH);
  process.exit(1);
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('[Deploy] dist directory not found. Please run npm run build first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const bucket = manifest.staging?.webStaticBucket;

if (!bucket) {
  console.error('[Deploy] staging.webStaticBucket not found in cloud-manifest.json');
  process.exit(1);
}

// Parse env
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
const region = envVars.YC_REGION?.trim() || 'ru-central1';

if (!accessKeyId || !secretAccessKey) {
  console.error('[Deploy] YC_ACCESS_KEY_ID or YC_SECRET_ACCESS_KEY missing from .env.cloud.local');
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

async function pruneStaleAssets(bucketName, currentRelPaths) {
  const pruneAllStale = process.argv.includes('--prune-all-stale');
  const keepSet = new Set(currentRelPaths);
  const cutoffMs = Date.now() - (pruneAllStale ? 24 * 3600 * 1000 : 14 * 24 * 3600 * 1000);
  const keysToDelete = [];
  let continuationToken;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'assets/',
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents || []) {
      const key = obj.Key || '';
      if (!key || keepSet.has(key)) continue;
      const lastModMs = obj.LastModified ? new Date(obj.LastModified).getTime() : 0;
      if (lastModMs > 0 && lastModMs < cutoffMs) {
        keysToDelete.push({ Key: key });
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  if (keysToDelete.length === 0) {
    console.log('✓ No stale assets/ objects to prune.');
    return 0;
  }

  let deletedCount = 0;
  for (let i = 0; i < keysToDelete.length; i += 1000) {
    const chunk = keysToDelete.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: chunk, Quiet: true },
      })
    );
    deletedCount += chunk.length;
  }
  console.log(`✓ Pruned ${deletedCount} stale assets/ objects from ${bucketName}.`);
  return deletedCount;
}

async function deploy() {
  console.log(`=== Deploying DomExit Frontend to Staging Bucket: ${bucket} ===`);
  console.log(`Source Directory: ${DIST_DIR}`);
  console.log(`Region: ${region}`);

  const files = getFiles(DIST_DIR);
  console.log(`Found ${files.length} files to upload.\n`);

  let totalBytes = 0;
  const startTime = Date.now();

  for (const file of files) {
    const ext = path.extname(file.relPath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const isNoCache =
      file.relPath === 'index.html' ||
      file.relPath.startsWith('yandex_') ||
      file.relPath === 'robots.txt' ||
      file.relPath === 'sitemap.xml';
    const isAsset = file.relPath.startsWith('assets/');

    const cacheControl = isNoCache
      ? 'no-cache, no-store, must-revalidate'
      : isAsset
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400';

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

  await pruneStaleAssets(bucket, files.map((f) => f.relPath));

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n=== Deployment Complete ===`);
  console.log(`Total Files: ${files.length}`);
  console.log(`Total Uploaded: ${totalMb} MB`);
  console.log(`Duration: ${durationSec}s`);
  console.log(`Target Bucket: ${bucket}`);
  console.log(`Live Staging URL: ${manifest.staging.apiGatewayUrl}`);
}

deploy().catch((err) => {
  console.error('[Deploy] Fatal error:', err);
  process.exit(1);
});
