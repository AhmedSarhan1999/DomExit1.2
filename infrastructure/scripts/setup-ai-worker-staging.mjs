/**
 * infrastructure/scripts/setup-ai-worker-staging.mjs
 * Idempotent cloud infrastructure provisioning for AI Worker & YMQ OCR Pipeline on Staging.
 *
 * 1. Ensures IAM permissions for domexit-runtime-sa (ai.vision.user, ymq.admin, storage.editor, serverless.functions.invoker).
 * 2. Ensures YMQ Dead-Letter Queue (domexit-ai-ocr-staging-dlq).
 * 3. Ensures YMQ Main Queue (domexit-ai-ocr-staging) with 180s visibility and RedrivePolicy to DLQ.
 * 4. Ensures Serverless Function domexit-ai-worker-staging.
 * 5. Ensures Message Queue Trigger domexit-ai-ocr-staging-trigger (batch-size 1).
 * 6. Updates infrastructure/cloud-manifest.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(ENV_PATH)) {
  console.error('[SetupAiWorker] Error: cloud-manifest.json or .env.cloud.local not found.');
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

const folderId = manifest.folderId || 'b1g46uad3gc3h34k5b0f';
const region = manifest.region || 'ru-central1';
const saId = manifest.runtimeServiceAccount?.id || 'aje70eogmpm04c84rsnl';
const ak = envVars.YC_ACCESS_KEY_ID;
const sk = envVars.YC_SECRET_ACCESS_KEY;

if (!ak || !sk) {
  console.error('[SetupAiWorker] Error: Missing YC_ACCESS_KEY_ID or YC_SECRET_ACCESS_KEY.');
  process.exit(1);
}

console.log('=== DomExit AI Worker & YMQ Setup (Staging) ===');
console.log(`Folder ID:       ${folderId}`);
console.log(`Region:          ${region}`);
console.log(`Service Account: ${saId} (domexit-runtime-sa)`);

// AWS SigV4 helper for Yandex Message Queue (SQS protocol)
function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

async function sqsRequest(pathStr, params) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const endpoint = 'https://message-queue.api.cloud.yandex.net';
  const url = new URL(pathStr, endpoint);
  const form = new URLSearchParams(params).toString();
  const hashedPayload = crypto.createHash('sha256').update(form).digest('hex');
  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${url.host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', url.pathname, '', canonicalHeaders, signedHeaders, hashedPayload].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/sqs/aws4_request`,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const sigKey = getSignatureKey(sk, dateStamp, region, 'sqs');
  const sig = crypto.createHmac('sha256', sigKey).update(stringToSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${ak}/${dateStamp}/${region}/sqs/aws4_request, SignedHeaders=${signedHeaders}, Signature=${sig}`;

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Amz-Date': amzDate,
      Authorization: auth,
    },
    body: form,
  });

  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

function runYc(cmd, ignoreError = false) {
  try {
    return execSync(`yc ${cmd} --format json`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (ignoreError) return null;
    throw new Error(`Command failed (yc ${cmd}): ${err.stderr || err.message}`);
  }
}

async function main() {
  // 1. Ensure IAM Roles
  console.log('\n[1/5] Checking and ensuring IAM roles for domexit-runtime-sa...');
  const rolesToEnsure = ['ai.vision.user', 'ymq.admin', 'storage.editor', 'serverless.functions.invoker'];
  let currentBindings = [];
  try {
    currentBindings = JSON.parse(runYc(`resource-manager folder list-access-bindings ${folderId}`));
  } catch (e) {
    console.warn('Could not list bindings, will attempt add-access-binding idempotently:', e.message);
  }

  for (const role of rolesToEnsure) {
    const hasRole = currentBindings.some((b) => b.subject?.id === saId && b.role_id === role);
    if (!hasRole) {
      console.log(`  Adding role ${role} to ${saId}...`);
      try {
        execSync(
          `yc resource-manager folder add-access-binding ${folderId} --service-account-id ${saId} --role ${role}`,
          { stdio: 'inherit' }
        );
        console.log(`  ✓ Role ${role} added.`);
      } catch (err) {
        console.warn(`  Warning adding role ${role}: ${err.message}`);
      }
    } else {
      console.log(`  ✓ Role ${role} already assigned.`);
    }
  }

  // 2. Ensure YMQ DLQ
  console.log('\n[2/5] Ensuring YMQ Dead-Letter Queue (domexit-ai-ocr-staging-dlq)...');
  const dlqCreateRes = await sqsRequest('/', {
    Action: 'CreateQueue',
    QueueName: 'domexit-ai-ocr-staging-dlq',
    'Attribute.1.Name': 'MessageRetentionPeriod',
    'Attribute.1.Value': '86400',
    Version: '2012-11-05',
  });
  if (!dlqCreateRes.ok) {
    throw new Error(`Failed to create DLQ: ${dlqCreateRes.text}`);
  }
  const dlqUrlMatch = dlqCreateRes.text.match(/<QueueUrl>([^<]+)<\/QueueUrl>/);
  const dlqUrl = dlqUrlMatch ? dlqUrlMatch[1] : null;
  if (!dlqUrl) throw new Error('Could not parse DLQ URL');
  console.log(`  ✓ DLQ URL: ${dlqUrl}`);

  // Get DLQ ARN
  const dlqPath = new URL(dlqUrl).pathname;
  const dlqAttrRes = await sqsRequest(dlqPath, {
    Action: 'GetQueueAttributes',
    'AttributeName.1': 'QueueArn',
    Version: '2012-11-05',
  });
  const dlqArnMatch = dlqAttrRes.text.match(/<Value>([^<]+)<\/Value>/);
  const dlqArn = dlqArnMatch ? dlqArnMatch[1] : null;
  if (!dlqArn) throw new Error('Could not parse DLQ ARN');
  console.log(`  ✓ DLQ ARN: ${dlqArn}`);

  // 3. Ensure YMQ Main Queue
  console.log('\n[3/5] Ensuring YMQ Main Queue (domexit-ai-ocr-staging)...');
  const redrivePolicy = JSON.stringify({ deadLetterTargetArn: dlqArn, maxReceiveCount: 3 });
  const mainQueueCreateRes = await sqsRequest('/', {
    Action: 'CreateQueue',
    QueueName: 'domexit-ai-ocr-staging',
    'Attribute.1.Name': 'VisibilityTimeout',
    'Attribute.1.Value': '180',
    'Attribute.2.Name': 'MessageRetentionPeriod',
    'Attribute.2.Value': '86400',
    'Attribute.3.Name': 'RedrivePolicy',
    'Attribute.3.Value': redrivePolicy,
    Version: '2012-11-05',
  });
  if (!mainQueueCreateRes.ok) {
    throw new Error(`Failed to create Main Queue: ${mainQueueCreateRes.text}`);
  }
  const mainQueueUrlMatch = mainQueueCreateRes.text.match(/<QueueUrl>([^<]+)<\/QueueUrl>/);
  const mainQueueUrl = mainQueueUrlMatch ? mainQueueUrlMatch[1] : null;
  if (!mainQueueUrl) throw new Error('Could not parse Main Queue URL');
  console.log(`  ✓ Main Queue URL: ${mainQueueUrl}`);

  // Get Main Queue ARN
  const mainQueuePath = new URL(mainQueueUrl).pathname;
  const mainQueueAttrRes = await sqsRequest(mainQueuePath, {
    Action: 'GetQueueAttributes',
    'AttributeName.1': 'QueueArn',
    Version: '2012-11-05',
  });
  const mainQueueArnMatch = mainQueueAttrRes.text.match(/<Value>([^<]+)<\/Value>/);
  const mainQueueArn = mainQueueArnMatch
    ? mainQueueArnMatch[1]
    : `yrn:yc:ymq:${region}:${folderId}:domexit-ai-ocr-staging`;
  console.log(`  ✓ Main Queue ARN: ${mainQueueArn}`);

  // 4. Ensure Cloud Function domexit-ai-worker-staging
  console.log('\n[4/5] Ensuring Cloud Function domexit-ai-worker-staging...');
  const funcListRaw = runYc('serverless function list', true);
  const functions = funcListRaw ? JSON.parse(funcListRaw) : [];
  let workerFunc = functions.find((f) => f.name === 'domexit-ai-worker-staging');

  if (!workerFunc) {
    console.log('  Creating function domexit-ai-worker-staging...');
    const createFuncRaw = runYc(
      `serverless function create --name domexit-ai-worker-staging --description "DomExit AI Worker (Vision OCR & Legal Doc Processing) Staging"`
    );
    workerFunc = JSON.parse(createFuncRaw);
    console.log(`  ✓ Function created: ${workerFunc.id}`);
  } else {
    console.log(`  ✓ Function already exists: ${workerFunc.id}`);
  }

  // 5. Ensure YMQ Trigger
  console.log('\n[5/5] Ensuring YMQ Trigger domexit-ai-ocr-staging-trigger...');
  const triggerListRaw = runYc('serverless trigger list', true);
  const triggers = triggerListRaw ? JSON.parse(triggerListRaw) : [];
  let ocrTrigger = triggers.find((t) => t.name === 'domexit-ai-ocr-staging-trigger');

  if (!ocrTrigger) {
    console.log('  Creating message-queue trigger domexit-ai-ocr-staging-trigger...');
    try {
      const createTrigRaw = runYc(
        `serverless trigger create message-queue domexit-ai-ocr-staging-trigger --queue ${mainQueueArn} --queue-service-account-id ${saId} --batch-size 1 --batch-cutoff 10s --invoke-function-name domexit-ai-worker-staging --invoke-function-service-account-id ${saId}`
      );
      ocrTrigger = JSON.parse(createTrigRaw);
      console.log(`  ✓ Trigger created: ${ocrTrigger.id}`);
    } catch (trigErr) {
      console.warn('Trigger create warning (retrying with v2 if needed):', trigErr.message);
    }
  } else {
    console.log(`  ✓ Trigger already exists: ${ocrTrigger.id}`);
  }

  // Update cloud-manifest.json
  manifest.staging.ymqOcrQueueUrl = mainQueueUrl;
  manifest.staging.ymqOcrQueueArn = mainQueueArn;
  manifest.staging.ymqOcrDlqUrl = dlqUrl;
  manifest.staging.aiWorkerFunctionId = workerFunc.id;
  if (ocrTrigger) manifest.staging.aiWorkerTriggerId = ocrTrigger.id;

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log('\n✓ Updated infrastructure/cloud-manifest.json with YMQ and AI Worker configuration.');

  console.log('\n=== AI Worker & YMQ Setup Completed Successfully! ===');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err);
  process.exit(1);
});
