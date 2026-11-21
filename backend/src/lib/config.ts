import fs from 'node:fs';
import path from 'node:path';

// If running locally and env vars are not set, attempt loading from .env.cloud.local
if (!process.env.YC_ACCESS_KEY_ID) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.cloud.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...vParts] = trimmed.split('=');
        if (k && !process.env[k]) {
          process.env[k] = vParts.join('=');
        }
      }
    }
  } catch {
    // Ignore in production cloud function
  }
}

export interface BackendConfig {
  APP_ENV: 'staging' | 'production';
  YDB_DOCAPI_ENDPOINT: string;
  YDB_REGION: string;
  YC_ACCESS_KEY_ID: string;
  YC_SECRET_ACCESS_KEY: string;
  S3_PUBLIC_BUCKET: string;
  S3_PRIVATE_BUCKET: string;
  S3_ENDPOINT: string;
  JWT_SIGNING_SECRET: string;
  YANDEX_OAUTH_CLIENT_ID: string;
  YANDEX_OAUTH_CLIENT_SECRET: string;
  PUBLIC_BASE_URL: string;
  PROD_CUSTOM_DOMAIN?: string;
}

export function getConfig(): BackendConfig {
  const env = (process.env.APP_ENV || 'staging') as 'staging' | 'production';

  const cfg: BackendConfig = {
    APP_ENV: env,
    YDB_DOCAPI_ENDPOINT:
      process.env.YDB_DOCAPI_ENDPOINT ||
      (env === 'production'
        ? process.env.PROD_YDB_DOCAPI_ENDPOINT
        : process.env.STAGING_YDB_DOCAPI_ENDPOINT) ||
      '',
    YDB_REGION: process.env.YDB_REGION || process.env.YC_REGION || 'ru-central1',
    YC_ACCESS_KEY_ID: process.env.YC_ACCESS_KEY_ID || '',
    YC_SECRET_ACCESS_KEY: process.env.YC_SECRET_ACCESS_KEY || '',
    S3_PUBLIC_BUCKET:
      process.env.S3_PUBLIC_BUCKET ||
      (env === 'production'
        ? process.env.PROD_PUBLIC_PHOTOS_BUCKET || 'domexit-storage-vault'
        : process.env.STAGING_PUBLIC_PHOTOS_BUCKET || 'domexit-public-photos-staging'),
    S3_PRIVATE_BUCKET:
      process.env.S3_PRIVATE_BUCKET ||
      (env === 'production'
        ? process.env.PROD_PRIVATE_DOCS_BUCKET || 'domexit-private-docs-prod'
        : process.env.STAGING_PRIVATE_DOCS_BUCKET || 'domexit-private-docs-staging'),
    S3_ENDPOINT: process.env.S3_ENDPOINT || 'https://storage.yandexcloud.net',
    JWT_SIGNING_SECRET:
      process.env.JWT_SIGNING_SECRET ||
      (env === 'production' ? process.env.JWT_SIGNING_SECRET_PROD : '') ||
      '',
    YANDEX_OAUTH_CLIENT_ID: process.env.YANDEX_OAUTH_CLIENT_ID || '72f6de11197d4e9da68ea1fec90c72e1',
    YANDEX_OAUTH_CLIENT_SECRET: process.env.YANDEX_OAUTH_CLIENT_SECRET || '',
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'http://localhost:5173',
    PROD_CUSTOM_DOMAIN: process.env.PROD_CUSTOM_DOMAIN || '',
  };

  const missing: string[] = [];
  if (!cfg.YDB_DOCAPI_ENDPOINT) missing.push('YDB_DOCAPI_ENDPOINT');
  if (!cfg.YC_ACCESS_KEY_ID) missing.push('YC_ACCESS_KEY_ID');
  if (!cfg.YC_SECRET_ACCESS_KEY) missing.push('YC_SECRET_ACCESS_KEY');
  if (!cfg.JWT_SIGNING_SECRET) missing.push('JWT_SIGNING_SECRET');

  if (missing.length > 0) {
    throw new Error(`[BackendConfig] Missing critical environment variables: ${missing.join(', ')}`);
  }

  return cfg;
}
