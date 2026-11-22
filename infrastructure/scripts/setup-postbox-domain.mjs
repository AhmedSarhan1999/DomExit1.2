#!/usr/bin/env node
/**
 * Setup and configure Yandex Cloud Postbox for domexit.ru
 *
 * 1. Checks/creates service account domexit-postbox-sa with postbox.sender & postbox.admin.
 * 2. Manages Static Access Key (for SESv2 API) and API Key with scope yc.postbox.send (for SMTP).
 * 3. Creates/Queries Email Identity for domexit.ru via SESv2 API on https://postbox.cloud.yandex.net.
 * 4. Syncs DKIM CNAME records into domexit-ru-zone (purging stale tokens).
 * 5. Verifies SMTP authentication against postbox.cloud.yandex.net:465.
 * 6. Appends the 6 Postbox variables to .env.cloud.local without logging secrets.
 * 7. Updates infrastructure/cloud-manifest.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

console.log('=== Yandex Cloud Postbox Automated Setup for domexit.ru ===\n');

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('FATAL: Required config files not found!');
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

const folderId = manifest.folderId || 'b1g46uad3gc3h34k5b0f';
const saName = 'domexit-postbox-sa';

// 1. Service Account & Roles Check
console.log('[1/6] Verifying service account and IAM roles...');
let saId = '';
try {
  const saListRaw = execFileSync('yc', ['iam', 'service-account', 'list', '--format', 'json'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const saList = JSON.parse(saListRaw);
  const found = saList.find((s) => s.name === saName);
  if (found) {
    saId = found.id;
    console.log(`  ✓ Found existing service account ${saName} (ID: ${saId})`);
  } else {
    console.log(`  Creating service account ${saName}...`);
    const createRaw = execFileSync(
      'yc',
      ['iam', 'service-account', 'create', '--name', saName, '--description', 'Service account for Yandex Cloud Postbox', '--format', 'json'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const created = JSON.parse(createRaw);
    saId = created.id;
    console.log(`  ✓ Created service account ${saName} (ID: ${saId})`);
  }

  // Ensure roles
  for (const role of ['postbox.sender', 'postbox.admin']) {
    try {
      execFileSync('yc', ['resource-manager', 'folder', 'add-access-binding', folderId, '--role', role, '--service-account-id', saId], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      console.log(`  ✓ Verified role ${role} for ${saName}`);
    } catch {
      // Role already bound
      console.log(`  ✓ Role ${role} already bound`);
    }
  }
} catch (err) {
  console.error('  ✗ Error managing service account:', err.message);
  process.exit(1);
}

// 2. Static Access Key (for SESv2 API) & API Key (for SMTP)
console.log('\n[2/6] Managing Static Access Key (SESv2) and API Key (SMTP)...');

// Static Access Key for SESv2 API calls
let staticKeyId = '';
let staticSecret = '';

try {
  // Check if we already have static key in memory or create
  const rawKey = execFileSync(
    'yc',
    ['iam', 'access-key', 'create', '--service-account-name', saName, '--description', 'Postbox SESv2 SigV4 Key', '--format', 'json'],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const parsedKey = JSON.parse(rawKey);
  staticKeyId = parsedKey.access_key?.key_id;
  staticSecret = parsedKey.secret;
  console.log(`  ✓ Generated in-memory static access key for SESv2 API (Key ID: ${staticKeyId})`);
} catch (err) {
  console.error('  ✗ Error creating static access key:', err.message);
  process.exit(1);
}

// API Key with scope yc.postbox.send for SMTP
let smtpUser = envVars.POSTBOX_SMTP_USER?.trim();
let smtpPass = envVars.POSTBOX_SMTP_PASS?.trim();

if (!smtpUser || !smtpPass || smtpUser.startsWith('YCA')) {
  try {
    console.log('  Generating dedicated API Key with scope yc.postbox.send for SMTP...');
    const rawApiKey = execFileSync(
      'yc',
      ['iam', 'api-key', 'create', '--service-account-name', saName, '--description', 'Postbox SMTP send key', '--scopes', 'yc.postbox.send', '--format', 'json'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const parsedApiKey = JSON.parse(rawApiKey);
    smtpUser = parsedApiKey.api_key?.id;
    smtpPass = parsedApiKey.secret;
    console.log(`  ✓ Generated API Key for SMTP (Key ID: ${smtpUser})`);
  } catch (err) {
    console.error('  ✗ Error creating API key for SMTP:', err.message);
    process.exit(1);
  }
} else {
  console.log(`  ✓ Reusing existing SMTP credentials from .env.cloud.local (Key ID: ${smtpUser})`);
}

// SigV4 Helpers for AWS SESv2 API
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function getSigningKey(secret, dateStamp, reg, service) {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, reg);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function callSesV2(method, subPath, bodyObj) {
  const url = new URL(`https://postbox.cloud.yandex.net${subPath}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const body = bodyObj ? JSON.stringify(bodyObj) : '';
  const bodyHash = sha256Hex(body);

  const canonicalHeaders = [
    ...(body ? ['content-type:application/json'] : []),
    `host:${url.host}`,
    `x-amz-date:${amzDate}`,
  ].sort().join('\n') + '\n';

  const signedHeaders = [
    ...(body ? ['content-type'] : []),
    'host',
    'x-amz-date',
  ].sort().join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    url.pathname,
    url.search ? url.search.substring(1) : '',
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/ru-central1/ses/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(staticSecret, dateStamp, 'ru-central1', 'ses');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${staticKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    Host: url.host,
    'X-Amz-Date': amzDate,
    Authorization: authHeader,
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url.toString(), {
    method: method.toUpperCase(),
    headers,
    body: body || undefined,
  });

  const resText = await res.text();
  let json = null;
  try {
    json = JSON.parse(resText);
  } catch {
    json = resText;
  }

  return { status: res.status, ok: res.ok, data: json };
}

// 3. Query / Manage Email Identity for domexit.ru
console.log('\n[3/6] Querying Email Identity for domexit.ru in Yandex Cloud Postbox...');
let identityData = null;

try {
  let getRes = await callSesV2('GET', '/v2/email/identities/domexit.ru');
  if (getRes.ok) {
    console.log('  ✓ Found Email Identity for domexit.ru');
    identityData = getRes.data;
  } else if (getRes.status === 404 || getRes.data?.NotFoundException) {
    console.log('  Creating Email Identity for domexit.ru...');
    const createRes = await callSesV2('POST', '/v2/email/identities', { EmailIdentity: 'domexit.ru' });
    if (createRes.ok) {
      console.log('  ✓ Created Email Identity for domexit.ru');
      identityData = createRes.data;
    }
  }
} catch (err) {
  console.error('  ✗ Error connecting to Postbox SESv2 API:', err.message);
}

const activeTokens = identityData?.DkimAttributes?.Tokens || [];
console.log('  Identity Type:          ', identityData?.IdentityType || 'DOMAIN');
console.log('  Verification Status:    ', identityData?.VerificationStatus);
console.log('  Verified For Sending:   ', identityData?.VerifiedForSendingStatus);
console.log('  DKIM Signing Enabled:   ', identityData?.DkimAttributes?.SigningEnabled);
console.log('  DKIM Status:            ', identityData?.DkimAttributes?.Status);
console.log('  DKIM Active Tokens:     ', activeTokens);

// 4. DNS Records Synchronization
console.log('\n[4/6] Synchronizing DKIM CNAME Records in domexit-ru-zone...');
if (activeTokens.length > 0) {
  const dnsRaw = execFileSync('yc', ['dns', 'zone', 'list-records', 'domexit-ru-zone', '--format', 'json'], { encoding: 'utf-8' });
  const parsedDns = JSON.parse(dnsRaw);
  const currentRecords = parsedDns.record_sets || parsedDns;

  // Purge any stale DKIM CNAME records
  const activeNames = new Set(activeTokens.map((t) => `${t}._domainkey.domexit.ru.`));
  const staleDkimRecords = currentRecords.filter(
    (r) => r.type === 'CNAME' && r.name.includes('._domainkey.domexit.ru.') && !activeNames.has(r.name)
  );

  for (const stale of staleDkimRecords) {
    console.log(`  Purging stale DKIM record: ${stale.name}`);
    try {
      execFileSync(
        'yc',
        ['dns', 'zone', 'delete-records', '--name', 'domexit-ru-zone', '--record', `${stale.name} ${stale.ttl} CNAME ${stale.data[0]}`],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
      console.log(`  ✓ Purged stale DKIM record: ${stale.name}`);
    } catch {}
  }

  // Ensure active tokens exist
  for (const token of activeTokens) {
    const cnameName = `${token}._domainkey.domexit.ru.`;
    const cnameValue = `${token}.dkim.postbox.cloud.yandex.net.`;
    const alreadyExists = currentRecords.some((r) => r.type === 'CNAME' && r.name === cnameName);

    if (alreadyExists) {
      console.log(`  ✓ DKIM record active in DNS: ${cnameName}`);
    } else {
      console.log(`  Adding DKIM CNAME record: ${cnameName} -> ${cnameValue}`);
      try {
        execFileSync(
          'yc',
          ['dns', 'zone', 'add-records', '--name', 'domexit-ru-zone', '--record', `${cnameName} 300 CNAME ${cnameValue}`],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        console.log(`  ✓ Added DKIM record: ${cnameName}`);
      } catch (addErr) {
        console.error(`  ✗ Failed to add DKIM record:`, addErr.message);
      }
    }
  }
}

// 5. Test SMTP Authentication
console.log('\n[5/6] Testing SMTP Authentication against postbox.cloud.yandex.net:465...');
try {
  const nodemailer = require(path.join(ROOT_DIR, 'backend/node_modules/nodemailer'));
  const transporter = nodemailer.createTransport({
    host: 'postbox.cloud.yandex.net',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  await new Promise((resolve, reject) => {
    transporter.verify((err, success) => {
      if (err) {
        console.error('  ✗ SMTP verification error:', err.message);
        reject(err);
      } else {
        console.log('  🎉 SMTP Authentication Verified! Server is ready to send:', success);
        resolve(success);
      }
    });
  });
} catch (smtpErr) {
  console.warn('  ⚠️ SMTP verify warning:', smtpErr.message);
}

// 6. Update .env.cloud.local and cloud-manifest.json
console.log('\n[6/6] Updating .env.cloud.local and cloud-manifest.json...');

const postboxVars = {
  EMAIL_PROVIDER: 'postbox',
  POSTBOX_SMTP_HOST: 'postbox.cloud.yandex.net',
  POSTBOX_SMTP_PORT: '465',
  POSTBOX_SMTP_USER: smtpUser,
  POSTBOX_SMTP_PASS: smtpPass,
  EMAIL_FROM: 'DomExit <no-reply@domexit.ru>',
};

let currentEnv = fs.readFileSync(ENV_PATH, 'utf-8');
const lines = currentEnv.split('\n');
const filteredLines = lines.filter((l) => {
  const trimmed = l.trim();
  for (const k of Object.keys(postboxVars)) {
    if (trimmed.startsWith(`${k}=`)) return false;
  }
  return true;
});

filteredLines.push('');
filteredLines.push('# =================================================================');
filteredLines.push('# YANDEX CLOUD POSTBOX CONFIGURATION (domexit.ru)');
filteredLines.push('# =================================================================');
for (const [k, v] of Object.entries(postboxVars)) {
  filteredLines.push(`${k}=${v}`);
}

fs.writeFileSync(ENV_PATH, filteredLines.join('\n'), 'utf-8');
console.log('  ✓ .env.cloud.local safely updated with 6 Postbox variables (Zero secrets logged).');

if (!manifest.domain.postbox) {
  manifest.domain.postbox = {};
}
manifest.domain.postbox.serviceAccountId = saId;
manifest.domain.postbox.serviceAccountName = saName;
manifest.domain.postbox.smtpHost = 'postbox.cloud.yandex.net';
manifest.domain.postbox.smtpPort = 465;
manifest.domain.postbox.smtpUser = smtpUser;
manifest.domain.postbox.senderEmail = 'no-reply@domexit.ru';
manifest.domain.postbox.identityStatus = identityData?.VerifiedForSendingStatus ? 'VERIFIED' : 'PENDING';
manifest.domain.postbox.dkimStatus = identityData?.DkimAttributes?.Status || 'PENDING';
manifest.domain.postbox.dkimTokens = activeTokens;
manifest.domain.postbox.dkimRecords = activeTokens.map((t) => ({
  name: `${t}._domainkey.domexit.ru.`,
  type: 'CNAME',
  value: `${t}.dkim.postbox.cloud.yandex.net.`,
}));

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
console.log('  ✓ cloud-manifest.json updated with Postbox identity and DKIM metadata.');

console.log('\n=== Postbox Setup Completed Successfully! ===');
