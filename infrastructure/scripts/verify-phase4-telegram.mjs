import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const args = process.argv.slice(2);
let targetEnv = 'staging';
let isReadOnly = false;

for (const arg of args) {
  if (arg === '--env=production' || arg === '--production') targetEnv = 'production';
  if (arg === '--env=staging' || arg === '--staging') targetEnv = 'staging';
  if (arg === '--read-only') isReadOnly = true;
}

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('ERROR: Required config files not found!');
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
const gatewayUrl = isProd
  ? manifest.production.apiGatewayUrl
  : manifest.staging.apiGatewayUrl;

const secret = isProd
  ? envVars.TELEGRAM_WEBHOOK_SECRET_PROD
  : envVars.TELEGRAM_WEBHOOK_SECRET_STAGING || envVars.TELEGRAM_WEBHOOK_SECRET;

const token = isProd
  ? envVars.TELEGRAM_BOT_TOKEN_PROD
  : envVars.TELEGRAM_BOT_TOKEN_STAGING || envVars.TELEGRAM_BOT_TOKEN;

const testEmail = 'amaas9499@gmail.com';
const testPassword = isProd
  ? envVars.PROD_OWNER_PASSWORD || envVars.BOOTSTRAP_OWNER_PASSWORD
  : envVars.BOOTSTRAP_OWNER_PASSWORD;

console.log(`=== Phase 4: Telegram Operating System Verification [${targetEnv.toUpperCase()}] ===`);
console.log(`Gateway URL: ${gatewayUrl}`);

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

async function runTests() {
  // -----------------------------------------------------------------
  // 1. Security Barrier: Webhook Authentication Tests
  // -----------------------------------------------------------------
  console.log('\n--- Test Suite 1: Webhook Secret Token Verification ---');
  try {
    const resNoSecret = await fetch(`${gatewayUrl}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: 12345 }),
    });
    assert(resNoSecret.status === 403, `Webhook without secret rejected with 403 (Got ${resNoSecret.status})`);
  } catch (err) {
    assert(false, `Webhook without secret threw error: ${err.message}`);
  }

  try {
    const resBadSecret = await fetch(`${gatewayUrl}/api/telegram/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret-token-1234567890123456',
      },
      body: JSON.stringify({ update_id: 12346 }),
    });
    assert(resBadSecret.status === 403, `Webhook with invalid secret rejected with 403 (Got ${resBadSecret.status})`);
  } catch (err) {
    assert(false, `Webhook with invalid secret threw error: ${err.message}`);
  }

  // -----------------------------------------------------------------
  // 2. Security Barrier: REST API Authentication Tests
  // -----------------------------------------------------------------
  console.log('\n--- Test Suite 2: REST Endpoint Session Protection ---');
  try {
    const resUnauthStatus = await fetch(`${gatewayUrl}/api/telegram/status`, {
      method: 'GET',
    });
    assert(resUnauthStatus.status === 401, `GET /api/telegram/status without auth rejected with 401 (Got ${resUnauthStatus.status})`);
  } catch (err) {
    assert(false, `Unauth status check failed: ${err.message}`);
  }

  try {
    const resUnauthLink = await fetch(`${gatewayUrl}/api/telegram/link-token`, {
      method: 'POST',
    });
    assert(resUnauthLink.status === 401, `POST /api/telegram/link-token without auth rejected with 401 (Got ${resUnauthLink.status})`);
  } catch (err) {
    assert(false, `Unauth link-token check failed: ${err.message}`);
  }

  // -----------------------------------------------------------------
  // 3. Authenticated Flow & Telegram OS Status
  // -----------------------------------------------------------------
  console.log('\n--- Test Suite 3: Authenticated Session & Link Token Generation ---');
  let cookie = '';
  if (testPassword) {
    try {
      const loginRes = await fetch(`${gatewayUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      if (loginRes.ok) {
        cookie = loginRes.headers.get('set-cookie') || '';
        assert(true, `Successfully authenticated test user (${testEmail})`);
      } else {
        const body = await loginRes.json();
        console.warn(`  ⚠️ Login returned ${loginRes.status}: ${body.error || 'Check password'}`);
      }
    } catch (loginErr) {
      console.warn(`  ⚠️ Login attempt error: ${loginErr.message}`);
    }
  }

  if (cookie) {
    try {
      const statusRes = await fetch(`${gatewayUrl}/api/telegram/status`, {
        headers: { Cookie: cookie },
      });
      const statusData = await statusRes.json();
      assert(statusRes.status === 200, `GET /api/telegram/status returned 200`);
      assert(statusData.configured === true, `Telegram bot is reported configured in Cloud Function`);
      assert(typeof statusData.botUsername === 'string' && statusData.botUsername.length > 0, `Bot username returned (${statusData.botUsername})`);
    } catch (err) {
      assert(false, `Authenticated status failed: ${err.message}`);
    }

    let generatedToken = '';
    try {
      const linkRes = await fetch(`${gatewayUrl}/api/telegram/link-token`, {
        method: 'POST',
        headers: { Cookie: cookie },
      });
      const linkData = await linkRes.json();
      assert(linkRes.status === 200 && linkData.success === true, `POST /api/telegram/link-token returned 200`);
      assert(Boolean(linkData.token && linkData.deepLink), `DeepLink generated: ${linkData.deepLink}`);
      const startParam = (linkData.deepLink.split('start=')[1] || '').trim();
      assert(startParam.startsWith('bind_'), `DeepLink parameter starts with bind_`);
      assert(startParam.length === 37, `DeepLink parameter is exactly 37 characters (${startParam.length} chars)`);
      assert(startParam.length <= 64, `DeepLink parameter complies with Telegram 64-char limit`);
      generatedToken = linkData.token;
    } catch (err) {
      assert(false, `Link token generation failed: ${err.message}`);
    }

    // -----------------------------------------------------------------
    // 4. Webhook Ingestion & Dual Binding Verification (Only on Staging or non-read-only)
    // -----------------------------------------------------------------
    if (!isReadOnly && generatedToken && secret) {
      console.log('\n--- Test Suite 4: Webhook Processing & Deep Link Binding ---');
      const testChatId = 987654321;
      const testUpdateId = Math.floor(100000 + Math.random() * 899999);

      try {
        const webhookRes = await fetch(`${gatewayUrl}/api/telegram/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': secret,
          },
          body: JSON.stringify({
            update_id: testUpdateId,
            message: {
              message_id: 1,
              from: {
                id: testChatId,
                first_name: 'TestEngineer',
                username: 'domexit_test_user',
              },
              chat: {
                id: testChatId,
                type: 'private',
              },
              text: `/start bind_${generatedToken}`,
            },
          }),
        });

        assert(webhookRes.status === 200, `Webhook accepted valid update with secret (HTTP 200)`);

        // Check that binding now reflects linked = true for this user
        const checkStatusRes = await fetch(`${gatewayUrl}/api/telegram/status`, {
          headers: { Cookie: cookie },
        });
        const checkStatusData = await checkStatusRes.json();
        assert(checkStatusData.linked === true, `User profile reflects active Telegram binding`);

        // Test Unlink
        const unlinkRes = await fetch(`${gatewayUrl}/api/telegram/unlink`, {
          method: 'POST',
          headers: { Cookie: cookie },
        });
        assert(unlinkRes.status === 200, `POST /api/telegram/unlink successfully detached test binding`);

        const afterUnlinkRes = await fetch(`${gatewayUrl}/api/telegram/status`, {
          headers: { Cookie: cookie },
        });
        const afterUnlinkData = await afterUnlinkRes.json();
        assert(afterUnlinkData.linked === false, `User profile reflects unlinked state`);
      } catch (webhookErr) {
        assert(false, `Webhook simulation failed: ${webhookErr.message}`);
      }
    }
  }

  // -----------------------------------------------------------------
  // 5. Telegram Official API Live Webhook Verification
  // -----------------------------------------------------------------
  console.log('\n--- Test Suite 5: Telegram Cloud Verification (getWebhookInfo) ---');
  if (token && token.length > 20) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const tgData = await tgRes.json();
      assert(tgData.ok === true, `Telegram getWebhookInfo returned OK`);
      if (tgData.result) {
        const info = tgData.result;
        assert(info.url.includes(gatewayUrl.replace('https://', '')), `Webhook URL points to active gateway (${info.url})`);
        assert(!info.last_error_message || info.last_error_message === '', `Zero active webhook delivery errors`);
      }
    } catch (err) {
      assert(false, `Telegram cloud API error: ${err.message}`);
    }
  }

  console.log('\n======================================================');
  console.log(`Verification Complete: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
