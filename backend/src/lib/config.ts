import fs from 'node:fs';
import path from 'node:path';

// If running locally and env vars are not set, attempt loading from .env.cloud.local and .env.backend.local
const loadEnvFile = (fileName: string) => {
  try {
    const candidates = [
      path.resolve(process.cwd(), fileName),
      path.resolve(process.cwd(), '..', fileName),
    ];
    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx <= 0) continue;
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim();
          if (k && !process.env[k]) {
            process.env[k] = v;
          }
        }
        break;
      }
    }
  } catch {
    // Ignore in production cloud function
  }
};

if (!process.env.YC_ACCESS_KEY_ID) {
  loadEnvFile('.env.cloud.local');
}
if (!process.env.DADATA_API_KEY) {
  loadEnvFile('.env.backend.local');
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
  FRONTEND_URL?: string;
  YANDEX_REDIRECT_URI?: string;
  PROD_CUSTOM_DOMAIN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_API_BASE_URL?: string;
  DADATA_API_KEY?: string;
  AGENT_BRIDGE_SECRET?: string;
  EXTERNAL_AGENT_WEBHOOK_URL?: string;
  AGENT_TELEGRAM_CHAT_ID?: string;
  YMQ_OCR_QUEUE_URL?: string;
  YC_FOLDER_ID?: string;
  DAILY_OCR_PAGES_CAP?: number;
  MAX_PAGES_PER_DOC?: number;
  DAILY_GPT_CALLS_CAP?: number;
  YANDEX_AI_API_KEY?: string;
  YC_AI_IAM_TOKEN?: string;
  // DADATA_SECRET_KEY removed — cleaner.dadata.ru (paid) is permanently disabled.
  // All DaData usage is free-tier suggestions only via suggestions.dadata.ru.
  YDB_USE_V2_TABLES?: boolean;
  EMAIL_PROVIDER?: 'postbox' | 'smtp' | 'console';
  POSTBOX_SMTP_HOST?: string;
  POSTBOX_SMTP_PORT?: number;
  POSTBOX_SMTP_USER?: string;
  POSTBOX_SMTP_PASS?: string;
  EMAIL_FROM?: string;
  MESSENGER_PROVIDER?: 'telegram' | 'max';
  MAX_BOT_TOKEN?: string;
  MAX_BOT_USERNAME?: string;
  MAX_WEBHOOK_SECRET?: string;
  MAX_API_BASE_URL?: string;
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
    FRONTEND_URL: process.env.FRONTEND_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:5173',
    YANDEX_REDIRECT_URI:
      process.env.YANDEX_REDIRECT_URI ||
      `${process.env.PUBLIC_BASE_URL || 'http://localhost:5173'}/api/auth/yandex/callback`,
    PROD_CUSTOM_DOMAIN: process.env.PROD_CUSTOM_DOMAIN || '',
    TELEGRAM_BOT_TOKEN:
      process.env.TELEGRAM_BOT_TOKEN ||
      (env === 'production'
        ? process.env.TELEGRAM_BOT_TOKEN_PROD
        : process.env.TELEGRAM_BOT_TOKEN_STAGING) ||
      '',
    TELEGRAM_BOT_USERNAME:
      process.env.TELEGRAM_BOT_USERNAME ||
      (env === 'production'
        ? process.env.TELEGRAM_BOT_USERNAME_PROD
        : process.env.TELEGRAM_BOT_USERNAME_STAGING) ||
      '',
    TELEGRAM_WEBHOOK_SECRET:
      process.env.TELEGRAM_WEBHOOK_SECRET ||
      (env === 'production'
        ? process.env.TELEGRAM_WEBHOOK_SECRET_PROD
        : process.env.TELEGRAM_WEBHOOK_SECRET_STAGING) ||
      '',
    TELEGRAM_API_BASE_URL: process.env.TELEGRAM_API_BASE_URL || '',
    DADATA_API_KEY: process.env.DADATA_API_KEY || '',
    AGENT_BRIDGE_SECRET: process.env.AGENT_BRIDGE_SECRET || '',
    EXTERNAL_AGENT_WEBHOOK_URL: process.env.EXTERNAL_AGENT_WEBHOOK_URL || '',
    AGENT_TELEGRAM_CHAT_ID: process.env.AGENT_TELEGRAM_CHAT_ID || '',
    YMQ_OCR_QUEUE_URL: process.env.YMQ_OCR_QUEUE_URL || '',
    YC_FOLDER_ID: process.env.YC_FOLDER_ID || 'b1g46uad3gc3h34k5b0f',
    DAILY_OCR_PAGES_CAP: process.env.DAILY_OCR_PAGES_CAP ? Number(process.env.DAILY_OCR_PAGES_CAP) : 200,
    MAX_PAGES_PER_DOC: process.env.MAX_PAGES_PER_DOC ? Number(process.env.MAX_PAGES_PER_DOC) : 15,
    DAILY_GPT_CALLS_CAP: process.env.DAILY_GPT_CALLS_CAP ? Number(process.env.DAILY_GPT_CALLS_CAP) : 100,
    YANDEX_AI_API_KEY: process.env.YANDEX_AI_API_KEY || '',
    YC_AI_IAM_TOKEN: process.env.YC_AI_IAM_TOKEN || '',
    YDB_USE_V2_TABLES: process.env.YDB_USE_V2_TABLES === 'true',
    EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER as any) || (process.env.POSTBOX_SMTP_USER ? 'postbox' : 'console'),
    POSTBOX_SMTP_HOST: process.env.POSTBOX_SMTP_HOST || 'postbox.cloud.yandex.net',
    POSTBOX_SMTP_PORT: process.env.POSTBOX_SMTP_PORT ? Number(process.env.POSTBOX_SMTP_PORT) : 465,
    POSTBOX_SMTP_USER: process.env.POSTBOX_SMTP_USER || '',
    POSTBOX_SMTP_PASS: process.env.POSTBOX_SMTP_PASS || '',
    EMAIL_FROM: process.env.EMAIL_FROM || 'DomExit <no-reply@domexit.ru>',
    MESSENGER_PROVIDER: (process.env.MESSENGER_PROVIDER as any) || 'telegram',
    MAX_BOT_TOKEN: process.env.MAX_BOT_TOKEN || '',
    MAX_BOT_USERNAME: process.env.MAX_BOT_USERNAME || '',
    MAX_WEBHOOK_SECRET: process.env.MAX_WEBHOOK_SECRET || '',
    MAX_API_BASE_URL: process.env.MAX_API_BASE_URL || 'https://api.max.im/v1',
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
