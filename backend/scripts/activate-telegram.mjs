import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

// 1. Parse Arguments
const args = process.argv.slice(2);
let targetEnv = 'staging';
let confirmProd = false;

for (const arg of args) {
  if (arg === '--env=production' || arg === '--production') targetEnv = 'production';
  if (arg === '--env=staging' || arg === '--staging') targetEnv = 'staging';
  if (arg === '--confirm-prod') confirmProd = true;
}

if (targetEnv === 'production' && !confirmProd) {
  console.error('ERROR: Modifying production Telegram webhook requires --confirm-prod flag!');
  process.exit(1);
}

// 2. Load Config
if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('ERROR: Required config files (cloud-manifest.json or .env.cloud.local) not found!');
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

const isProd = targetEnv === 'production';
const token = isProd
  ? envVars.TELEGRAM_BOT_TOKEN_PROD
  : envVars.TELEGRAM_BOT_TOKEN_STAGING || envVars.TELEGRAM_BOT_TOKEN;

const secret = isProd
  ? envVars.TELEGRAM_WEBHOOK_SECRET_PROD
  : envVars.TELEGRAM_WEBHOOK_SECRET_STAGING || envVars.TELEGRAM_WEBHOOK_SECRET;

const botUsername = isProd
  ? envVars.TELEGRAM_BOT_USERNAME_PROD || 'DomExitOfficialBot'
  : envVars.TELEGRAM_BOT_USERNAME_STAGING || envVars.TELEGRAM_BOT_USERNAME || 'DomExitStageBot';

const gatewayUrl = isProd
  ? manifest.production.apiGatewayUrl
  : manifest.staging.apiGatewayUrl;

if (!token || token.length < 20) {
  console.error(`ERROR: Bot token for ${targetEnv} is missing or invalid!`);
  process.exit(1);
}

if (!secret || secret.length < 16) {
  console.error(`ERROR: Webhook secret for ${targetEnv} is missing or too short!`);
  process.exit(1);
}

if (!gatewayUrl) {
  console.error(`ERROR: API Gateway URL for ${targetEnv} is missing from manifest!`);
  process.exit(1);
}

const webhookUrl = `${gatewayUrl.replace(/\/$/, '')}/api/telegram/webhook`;

console.log(`=== Activating Telegram Bot [${targetEnv.toUpperCase()}] ===`);
console.log(`Bot Username:  @${botUsername}`);
console.log(`Gateway URL:   ${gatewayUrl}`);
console.log(`Webhook URL:   ${webhookUrl}`);
console.log(`Secret Token:  [CONFIGURED - ${secret.length} bytes]`);

async function callTg(method, payload = {}) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description} (code ${data.error_code})`);
  }
  return data.result;
}

async function run() {
  try {
    // Step 1: Verify Bot Identity
    console.log('\n[1/3] Verifying bot identity (getMe)...');
    const me = await callTg('getMe');
    console.log(`✓ Connected as @${me.username} (ID: ${me.id}, Name: "${me.first_name}")`);

    // Step 2: Set Bot Commands (Russian OS Menu)
    console.log('\n[2/3] Setting Russian bot command list (setMyCommands)...');
    const commands = [
      { command: 'menu', description: 'Главное командное меню платформы' },
      { command: 'stats', description: 'Оперативная сводка (Руководство)' },
      { command: 'tasks', description: 'Открытые задачи и лоты без куратора' },
      { command: 'mytasks', description: 'Мои активные лоты в работе' },
      { command: 'team', description: 'Состав команды и статус привязки' },
      { command: 'mydeals', description: 'Мои объекты и статус оформления' },
      { command: 'cancel', description: 'Отменить ввод или режим ответа' },
      { command: 'unlink', description: 'Отвязать Telegram-аккаунт' },
    ];
    await callTg('setMyCommands', { commands });
    console.log(`✓ Set ${commands.length} commands successfully.`);

    // Step 3: Register Webhook
    console.log('\n[3/3] Registering Webhook with API Gateway (setWebhook)...');
    await callTg('setWebhook', {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
    console.log('✓ Webhook successfully registered with Telegram (drop_pending_updates: true)!');

    // Step 4: Verify Webhook Info
    const info = await callTg('getWebhookInfo');
    console.log('\n=== Webhook Status ===');
    console.log('  URL:                   ', info.url);
    console.log('  Has Custom Cert:       ', info.has_custom_certificate);
    console.log('  Pending Updates Count: ', info.pending_update_count);
    console.log('  Max Connections:       ', info.max_connections || 40);
    console.log('  Allowed Updates:       ', (info.allowed_updates || []).join(', '));
    if (info.last_error_date) {
      console.warn('  ⚠️ Last Error Date:     ', new Date(info.last_error_date * 1000).toISOString());
      console.warn('  ⚠️ Last Error Message:  ', info.last_error_message);
    } else {
      console.log('  Last Error:             None (Clean)');
    }

    console.log(`\n🎉 Telegram Bot @${me.username} is LIVE and ready on ${targetEnv}!\n`);
  } catch (err) {
    console.error('\n❌ Activation failed:', err.message);
    process.exit(1);
  }
}

run();
