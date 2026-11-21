import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT_DIR, '.env.cloud.local');
const MANIFEST_FILE = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

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

const prodGwUrl = manifest.production?.apiGatewayUrl;
const stagingGwUrl = manifest.staging?.apiGatewayUrl;

const allowedOrigins = [
  prodGwUrl,
  stagingGwUrl,
  'https://domexit.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

console.log('=== Configuring S3 CORS for Production Buckets ===');
console.log('Allowed Origins:', allowedOrigins);

const corsRules = [
  {
    AllowedHeaders: ['*'],
    AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
    AllowedOrigins: allowedOrigins,
    ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
    MaxAgeSeconds: 3600,
  },
];

const targetBuckets = [
  manifest.production.publicPhotosBucket,
  manifest.production.privateDocsBucket,
  manifest.production.webStaticBucket,
];

for (const bucket of targetBuckets) {
  try {
    console.log(`Setting CORS on bucket: ${bucket}...`);
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: corsRules,
        },
      })
    );
    console.log(`✓ CORS successfully set on ${bucket}`);
  } catch (err) {
    console.error(`✗ Failed to set CORS on ${bucket}:`, err.message);
  }
}

console.log('=== Bucket CORS Configuration Complete ===');
