import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
} from '../../backend/node_modules/@aws-sdk/client-s3/dist-cjs/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('[S3Lifecycle] Missing cloud-manifest.json or .env.cloud.local');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > 0) envVars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const accessKeyId = envVars.YC_ACCESS_KEY_ID?.trim();
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY?.trim();
const region = manifest.region || 'ru-central1';

if (!accessKeyId || !secretAccessKey) {
  console.error('[S3Lifecycle] Missing YC_ACCESS_KEY_ID or YC_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  endpoint: 'https://storage.yandexcloud.net',
  credentials: { accessKeyId, secretAccessKey },
});

const privateDocsRules = [
  {
    ID: 'transition-ydb-backups-to-cold-90d',
    Status: 'Enabled',
    Filter: { Prefix: '_backups/' },
    Transitions: [{ Days: 90, StorageClass: 'COLD' }],
  },
  {
    ID: 'transition-journal-to-cold-90d-and-ice-180d',
    Status: 'Enabled',
    Filter: { Prefix: '_journal/' },
    Transitions: [
      { Days: 90, StorageClass: 'COLD' },
      { Days: 180, StorageClass: 'ICE' },
    ],
  },
  {
    ID: 'abort-incomplete-multipart-uploads-7d',
    Status: 'Enabled',
    Filter: { Prefix: '' },
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
  },
];

const standardCleanupRules = [
  {
    ID: 'abort-incomplete-multipart-uploads-7d',
    Status: 'Enabled',
    Filter: { Prefix: '' },
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
  },
];

const bucketConfigs = [
  { bucket: manifest.production.privateDocsBucket, rules: privateDocsRules },
  { bucket: manifest.staging.privateDocsBucket, rules: privateDocsRules },
  { bucket: manifest.production.publicPhotosBucket, rules: standardCleanupRules },
  { bucket: manifest.staging.publicPhotosBucket, rules: standardCleanupRules },
  { bucket: manifest.production.webStaticBucket, rules: standardCleanupRules },
  { bucket: manifest.staging.webStaticBucket, rules: standardCleanupRules },
];

async function run() {
  console.log('=== Applying Idempotent S3 Lifecycle Rules to 6 DomExit Buckets ===');
  for (const cfg of bucketConfigs) {
    await s3.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: cfg.bucket,
        LifecycleConfiguration: { Rules: cfg.rules },
      })
    );
    const verified = await s3.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: cfg.bucket })
    );
    const ruleIds = (verified.Rules || []).map((r) => r.ID).join(', ');
    console.log(`✓ ${cfg.bucket}: [${ruleIds}]`);
  }
  console.log('\n=== S3 Lifecycle Rules Applied & Verified ===');
}

run().catch((err) => {
  console.error('[S3Lifecycle] Failed:', err);
  process.exit(1);
});
