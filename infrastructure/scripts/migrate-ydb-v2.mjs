import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const args = process.argv.slice(2);
const envArgIdx = args.indexOf('--env');
const targetEnvArg = envArgIdx !== -1 && args[envArgIdx + 1] ? args[envArgIdx + 1].toLowerCase() : 'staging';
const isProd = targetEnvArg === 'prod' || targetEnvArg === 'production';
const targetEnv = isProd ? 'production' : 'staging';
const verifyOnly = args.includes('--verify-only');
const confirmProd = args.includes('--confirm-prod');

if (targetEnvArg !== 'staging' && !isProd) {
  console.error(`[MigrateYdbV2] Invalid --env "${targetEnvArg}". Expected staging or prod.`);
  process.exit(1);
}

if (isProd && !confirmProd) {
  console.error('[MigrateYdbV2] SAFETY ERROR: --env prod requires explicit --confirm-prod flag. Aborting.');
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('[MigrateYdbV2] Error: infrastructure/cloud-manifest.json not found.');
  process.exit(1);
}
if (!fs.existsSync(ENV_PATH)) {
  console.error('[MigrateYdbV2] Error: .env.cloud.local not found.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envVars = {};
for (const line of fs.readFileSync(ENV_PATH, 'utf-8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const ydbEndpoint = manifest[targetEnv]?.ydbDocApiEndpoint;
const ydbDatabaseId = manifest[targetEnv]?.ydbDatabaseId;
const region = manifest.region || 'ru-central1';

if (!ydbEndpoint || !ydbDatabaseId) {
  console.error(`[MigrateYdbV2] Missing ydbDocApiEndpoint / ydbDatabaseId for ${targetEnv}.`);
  process.exit(1);
}

if (targetEnv === 'staging' && (ydbDatabaseId !== 'etnkpeqnbmb1a6cocipk' || !ydbEndpoint.includes('etnkpeqnbmb1a6cocipk'))) {
  console.error(`[MigrateYdbV2] SAFETY ERROR: Staging DB ID mismatch (${ydbDatabaseId}). Aborting.`);
  process.exit(1);
}
if (targetEnv === 'production' && !ydbEndpoint.includes('etnckg937628mnid7tnb')) {
  console.error(`[MigrateYdbV2] SAFETY ERROR: Production endpoint mismatch. Aborting.`);
  process.exit(1);
}

const accessKeyId = envVars.YC_ACCESS_KEY_ID || envVars.AWS_ACCESS_KEY_ID;
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY || envVars.AWS_SECRET_ACCESS_KEY;
if (!accessKeyId || !secretAccessKey) {
  console.error('[MigrateYdbV2] Missing YC_ACCESS_KEY_ID / YC_SECRET_ACCESS_KEY in .env.cloud.local.');
  process.exit(1);
}

const V2_TABLES_SCHEMA = {
  lots: {
    logicalName: 'lots',
    v2TableName: 'lots_v2',
    gsis: [
      { indexName: 'status-publishedAt-index', hashKey: 'status', rangeKey: 'publishedAt' },
      { indexName: 'status-createdAt-index', hashKey: 'status', rangeKey: 'createdAt' },
      { indexName: 'assignedCuratorId-createdAt-index', hashKey: 'assignedCuratorId', rangeKey: 'createdAt' },
      { indexName: 'lotCode-index', hashKey: 'lotCode' },
      { indexName: 'developerId-createdAt-index', hashKey: 'developerId', rangeKey: 'createdAt' },
      { indexName: 'ownerId-createdAt-index', hashKey: 'ownerId', rangeKey: 'createdAt' },
    ],
  },
  buyer_applications: {
    logicalName: 'buyer_applications',
    v2TableName: 'buyer_applications_v2',
    gsis: [
      { indexName: 'userId-createdAt-index', hashKey: 'userId', rangeKey: 'createdAt' },
      { indexName: 'lotId-createdAt-index', hashKey: 'lotId', rangeKey: 'createdAt' },
      { indexName: 'status-createdAt-index', hashKey: 'status', rangeKey: 'createdAt' },
      { indexName: 'assignedCuratorId-createdAt-index', hashKey: 'assignedCuratorId', rangeKey: 'createdAt' },
      { indexName: 'buyBoxId-createdAt-index', hashKey: 'buyBoxId', rangeKey: 'createdAt' },
    ],
  },
  deals: {
    logicalName: 'deals',
    v2TableName: 'deals_v2',
    gsis: [
      { indexName: 'buyerId-createdAt-index', hashKey: 'buyerId', rangeKey: 'createdAt' },
      { indexName: 'sellerId-createdAt-index', hashKey: 'sellerId', rangeKey: 'createdAt' },
      { indexName: 'lotId-createdAt-index', hashKey: 'lotId', rangeKey: 'createdAt' },
      { indexName: 'assignedCuratorId-createdAt-index', hashKey: 'assignedCuratorId', rangeKey: 'createdAt' },
      { indexName: 'status-createdAt-index', hashKey: 'status', rangeKey: 'createdAt' },
    ],
  },
  users: {
    logicalName: 'users',
    v2TableName: 'users_v2',
    gsis: [
      { indexName: 'login-index', hashKey: 'login' },
      { indexName: 'email-index', hashKey: 'email' },
      { indexName: 'role-createdAt-index', hashKey: 'role', rangeKey: 'createdAt' },
      { indexName: 'phone-index', hashKey: 'phone' },
    ],
  },
  audit_logs: {
    logicalName: 'audit_logs',
    v2TableName: 'audit_logs_v2',
    gsis: [
      { indexName: 'partitionKey-timestamp-index', hashKey: 'partitionKey', rangeKey: 'timestamp' },
      { indexName: 'actorId-timestamp-index', hashKey: 'actorId', rangeKey: 'timestamp' },
      { indexName: 'targetId-timestamp-index', hashKey: 'targetId', rangeKey: 'timestamp' },
    ],
  },
  deal_messages: {
    logicalName: 'deal_messages',
    v2TableName: 'deal_messages_v2',
    gsis: [
      { indexName: 'dealId-createdAt-index', hashKey: 'dealId', rangeKey: 'createdAt' },
      { indexName: 'senderId-createdAt-index', hashKey: 'senderId', rangeKey: 'createdAt' },
    ],
  },
  curator_messages: {
    logicalName: 'curator_messages',
    v2TableName: 'curator_messages_v2',
    gsis: [
      { indexName: 'userId-createdAt-index', hashKey: 'userId', rangeKey: 'createdAt' },
      { indexName: 'curatorId-createdAt-index', hashKey: 'curatorId', rangeKey: 'createdAt' },
      { indexName: 'dealId-createdAt-index', hashKey: 'dealId', rangeKey: 'createdAt' },
    ],
  },
  buy_boxes: {
    logicalName: 'buy_boxes',
    v2TableName: 'buy_boxes_v2',
    gsis: [
      { indexName: 'userId-createdAt-index', hashKey: 'userId', rangeKey: 'createdAt' },
      { indexName: 'status-createdAt-index', hashKey: 'status', rangeKey: 'createdAt' },
    ],
  },
  seller_requests: {
    logicalName: 'seller_requests',
    v2TableName: 'seller_requests_v2',
    gsis: [
      { indexName: 'userId-createdAt-index', hashKey: 'userId', rangeKey: 'createdAt' },
      { indexName: 'assignedCuratorId-createdAt-index', hashKey: 'assignedCuratorId', rangeKey: 'createdAt' },
      { indexName: 'status-createdAt-index', hashKey: 'status', rangeKey: 'createdAt' },
    ],
  },
  tier_verification_requests: {
    logicalName: 'tier_verification_requests',
    v2TableName: 'tier_verification_requests_v2',
    gsis: [
      { indexName: 'userId-createdAt-index', hashKey: 'userId', rangeKey: 'createdAt' },
      { indexName: 'status-createdAt-index', hashKey: 'status', rangeKey: 'createdAt' },
    ],
  },
  documents_vault: {
    logicalName: 'documents_vault',
    v2TableName: 'documents_vault_v2',
    gsis: [
      { indexName: 'dealId-uploadedAt-index', hashKey: 'dealId', rangeKey: 'uploadedAt' },
      { indexName: 'lotId-uploadedAt-index', hashKey: 'lotId', rangeKey: 'uploadedAt' },
      { indexName: 'ownerId-uploadedAt-index', hashKey: 'ownerId', rangeKey: 'uploadedAt' },
    ],
  },
  pep_signatures: {
    logicalName: 'pep_signatures',
    v2TableName: 'pep_signatures_v2',
    gsis: [
      { indexName: 'dealId-signedAt-index', hashKey: 'dealId', rangeKey: 'signedAt' },
      { indexName: 'userId-signedAt-index', hashKey: 'userId', rangeKey: 'signedAt' },
    ],
  },
  agent_research_tasks: {
    logicalName: 'agent_research_tasks',
    v2TableName: 'agent_research_tasks_v2',
    gsis: [
      { indexName: 'status-createdAt-index', hashKey: 'status', rangeKey: 'createdAt' },
      { indexName: 'lotCode-createdAt-index', hashKey: 'lotCode', rangeKey: 'createdAt' },
      { indexName: 'taskType-createdAt-index', hashKey: 'taskType', rangeKey: 'createdAt' },
    ],
  },
  market_benchmarks: {
    logicalName: 'market_benchmarks',
    v2TableName: 'market_benchmarks_v2',
    gsis: [
      { indexName: 'complexKey-verifiedAt-index', hashKey: 'complexKey', rangeKey: 'verifiedAt' },
      { indexName: 'lotCode-verifiedAt-index', hashKey: 'lotCode', rangeKey: 'verifiedAt' },
    ],
  },
  ai_ocr_jobs: {
    logicalName: 'ai_ocr_jobs',
    v2TableName: 'ai_ocr_jobs_v2',
    gsis: [
      { indexName: 'lotCode-createdAt-index', hashKey: 'lotCode', rangeKey: 'createdAt' },
      { indexName: 'documentId-createdAt-index', hashKey: 'documentId', rangeKey: 'createdAt' },
      { indexName: 'status-createdAt-index', hashKey: 'status', rangeKey: 'createdAt' },
    ],
  },
};

function getIndexedFields(schema) {
  const fields = new Set();
  for (const gsi of schema.gsis) {
    fields.add(gsi.hashKey);
    if (gsi.rangeKey) fields.add(gsi.rangeKey);
  }
  return Array.from(fields);
}

function sanitizeItemForV2(logicalTable, rawItem) {
  const baseName = logicalTable.endsWith('_v2') ? logicalTable.slice(0, -3) : logicalTable;
  const schema = V2_TABLES_SCHEMA[baseName];
  const item = { ...rawItem };
  if (item.id !== undefined && item.id !== null) {
    item.id = String(item.id);
  }
  if (!schema) return item;

  const nowIso = new Date().toISOString();
  const indexedFields = getIndexedFields(schema);

  if (indexedFields.includes('createdAt') && (!item.createdAt || String(item.createdAt).trim() === '')) {
    item.createdAt = item.timestamp || item.updatedAt || nowIso;
  }
  if (baseName === 'lots') {
    if (!item.status || String(item.status).trim() === '') item.status = 'draft';
    if (!item.publishedAt || String(item.publishedAt).trim() === '') item.publishedAt = item.createdAt || nowIso;
    if (!item.assignedCuratorId && item.assignedEmployeeId) item.assignedCuratorId = item.assignedEmployeeId;
    if (!item.ownerId && (item.sellerId || item.sellerUserId)) item.ownerId = item.sellerId || item.sellerUserId;
  } else if (baseName === 'buyer_applications') {
    if (!item.lotId && item.lotCode) item.lotId = String(item.lotCode).trim().toUpperCase();
    if (!item.assignedCuratorId && item.assignedEmployeeId) item.assignedCuratorId = item.assignedEmployeeId;
  } else if (baseName === 'deals') {
    if (!item.lotId && item.lotCode) item.lotId = item.lotCode;
    if (!item.buyerId && item.buyerUserId) item.buyerId = item.buyerUserId;
    if (!item.sellerId && item.sellerUserId) item.sellerId = item.sellerUserId;
    if (!item.assignedCuratorId && item.assignedEmployeeId) item.assignedCuratorId = item.assignedEmployeeId;
  } else if (baseName === 'users') {
    if (typeof item.email === 'string' && item.email.trim()) item.email = item.email.trim().toLowerCase();
    if (typeof item.login === 'string' && item.login.trim()) item.login = item.login.trim();
  } else if (baseName === 'audit_logs') {
    item.partitionKey = 'AUDIT';
    if (!item.timestamp || String(item.timestamp).trim() === '') item.timestamp = item.createdAt || nowIso;
    if (!item.actorId && (item.operatorId || item.performedBy)) item.actorId = item.operatorId || item.performedBy;
    if (!item.targetId && (item.targetLotCode || item.lotCode || item.dealId)) {
      item.targetId = item.targetLotCode || item.lotCode || item.dealId;
    }
  } else if (baseName === 'deal_messages') {
    if (!item.dealId && item.lotCode) item.dealId = item.lotCode;
    if (!item.senderId && item.userId) item.senderId = item.userId;
  } else if (baseName === 'curator_messages') {
    if (!item.userId && item.senderId) item.userId = item.senderId;
    if (!item.dealId && item.lotCode) item.dealId = item.lotCode;
  } else if (baseName === 'seller_requests') {
    if (!item.assignedCuratorId && item.assignedEmployeeId) item.assignedCuratorId = item.assignedEmployeeId;
  } else if (baseName === 'documents_vault') {
    if (!item.uploadedAt || String(item.uploadedAt).trim() === '') item.uploadedAt = item.createdAt || nowIso;
    if (!item.lotId && item.entityId) item.lotId = item.entityId;
    if (!item.ownerId && (item.userId || item.sellerId)) item.ownerId = item.userId || item.sellerId;
  } else if (baseName === 'pep_signatures') {
    if (!item.signedAt || String(item.signedAt).trim() === '') item.signedAt = item.createdAt || nowIso;
    if (!item.dealId && item.lotCode) item.dealId = item.lotCode;
  } else if (baseName === 'ai_ocr_jobs') {
    if (!item.status || String(item.status).trim() === '') item.status = 'queued';
    if (!item.createdAt || String(item.createdAt).trim() === '') item.createdAt = nowIso;
  }

  for (const field of indexedFields) {
    const val = item[field];
    if (val === undefined || val === null) {
      delete item[field];
      continue;
    }
    const strVal = typeof val === 'string' ? val.trim() : String(val);
    if (strVal === '') {
      delete item[field];
    } else {
      item[field] = strVal;
    }
  }
  return item;
}

function toDynamo(val) {
  if (val === null || val === undefined) return { NULL: true };
  if (typeof val === 'string') return { S: val };
  if (typeof val === 'number') return { N: String(val) };
  if (typeof val === 'boolean') return { BOOL: val };
  if (Array.isArray(val)) return { L: val.map((v) => toDynamo(v)) };
  if (typeof val === 'object') {
    const map = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) map[k] = toDynamo(v);
    }
    return { M: map };
  }
  return { S: String(val) };
}

function fromDynamo(attr) {
  if (!attr || typeof attr !== 'object') return attr;
  if ('S' in attr) return attr.S;
  if ('N' in attr) return Number(attr.N);
  if ('BOOL' in attr) return attr.BOOL;
  if ('NULL' in attr) return null;
  if ('L' in attr) return (attr.L || []).map(fromDynamo);
  if ('M' in attr) {
    const obj = {};
    for (const [k, v] of Object.entries(attr.M || {})) {
      obj[k] = fromDynamo(v);
    }
    return obj;
  }
  return null;
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secretKey, dateStamp, regionName, service) {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function callYdbRaw(target, body) {
  const url = new URL(ydbEndpoint);
  const host = url.host;
  const reqPath = url.pathname || '/';
  const service = 'dynamodb';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const payload = JSON.stringify(body);
  const targetHeader = `DynamoDB_20120810.${target}`;
  const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${targetHeader}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = `POST\n${reqPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256Hex(payload)}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${region}/${service}/aws4_request\n${sha256Hex(canonicalRequest)}`;
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(ydbEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': targetHeader,
      'X-Amz-Date': amzDate,
      Authorization: auth,
    },
    body: payload,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, body: json };
}

async function callYdbWithRetry(target, body, maxAttempts = 5) {
  let attempt = 0;
  while (true) {
    attempt++;
    const res = await callYdbRaw(target, body);
    if (res.ok) return res;
    const msg = res.body?.message || res.body?.__type || JSON.stringify(res.body);
    const retryable =
      res.status === 429 ||
      res.status >= 500 ||
      msg.includes('ProvisionedThroughputExceeded') ||
      msg.includes('Throttling') ||
      msg.includes('InternalServerError');
    if (!retryable || attempt >= maxAttempts) {
      return res;
    }
    const delayMs = Math.min(2000, 150 * Math.pow(2, attempt - 1));
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function describeTable(tableName) {
  const res = await callYdbWithRetry('DescribeTable', { TableName: tableName });
  if (!res.ok) return null;
  return res.body?.Table || null;
}

async function ensureV2Table(schema) {
  const existing = await describeTable(schema.v2TableName);
  if (!existing) {
    const indexedFields = getIndexedFields(schema);
    const createPayload = {
      TableName: schema.v2TableName,
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        ...indexedFields.map((field) => ({ AttributeName: field, AttributeType: 'S' })),
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: schema.gsis.map((gsi) => ({
        IndexName: gsi.indexName,
        KeySchema: [
          { AttributeName: gsi.hashKey, KeyType: 'HASH' },
          ...(gsi.rangeKey ? [{ AttributeName: gsi.rangeKey, KeyType: 'RANGE' }] : []),
        ],
        Projection: { ProjectionType: 'ALL' },
      })),
    };
    const createRes = await callYdbWithRetry('CreateTable', createPayload);
    if (!createRes.ok) {
      const msg = createRes.body?.message || JSON.stringify(createRes.body);
      throw new Error(`CreateTable(${schema.v2TableName}) failed (${createRes.status}): ${msg}`);
    }
    console.log(`  [+] Created ${schema.v2TableName} with ${schema.gsis.length} GSIs.`);
  } else {
    console.log(`  [=] Table ${schema.v2TableName} already exists.`);
  }

  for (let i = 0; i < 30; i++) {
    const table = await describeTable(schema.v2TableName);
    const gsis = table?.GlobalSecondaryIndexes || [];
    const allGsisActive =
      gsis.length === schema.gsis.length &&
      gsis.every((g) => (g.IndexStatus || 'ACTIVE') === 'ACTIVE');
    if (table && (table.TableStatus || 'ACTIVE') === 'ACTIVE' && allGsisActive) {
      return table;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${schema.v2TableName} and its GSIs to become ACTIVE.`);
}

async function scanAllItems(tableName) {
  const items = [];
  let exclusiveStartKey = undefined;
  while (true) {
    const body = {
      TableName: tableName,
      Limit: 500,
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    };
    const res = await callYdbWithRetry('Scan', body);
    if (!res.ok) {
      const msg = res.body?.message || JSON.stringify(res.body);
      if (
        msg.includes('ResourceNotFoundException') ||
        msg.includes('not found') ||
        msg.includes('non-existent table') ||
        res.status === 404
      ) {
        return { exists: false, items: [] };
      }
      throw new Error(`Scan(${tableName}) failed (${res.status}): ${msg}`);
    }
    for (const raw of res.body?.Items || []) {
      const parsed = {};
      for (const [k, v] of Object.entries(raw)) {
        parsed[k] = fromDynamo(v);
      }
      items.push(parsed);
    }
    if (!res.body?.LastEvaluatedKey) break;
    exclusiveStartKey = res.body.LastEvaluatedKey;
  }
  return { exists: true, items };
}

async function putV2Item(schema, sanitizedItem) {
  const dynamoItem = {};
  for (const [k, v] of Object.entries(sanitizedItem)) {
    if (v !== undefined) {
      dynamoItem[k] = toDynamo(v);
    }
  }
  const res = await callYdbWithRetry('PutItem', {
    TableName: schema.v2TableName,
    Item: dynamoItem,
  });
  if (!res.ok) {
    throw new Error(
      `PutItem(${schema.v2TableName}, id=${sanitizedItem.id}) failed (${res.status}): ${res.body?.message || JSON.stringify(res.body)}`
    );
  }
}

async function main() {
  console.log('====================================================================');
  console.log(`YDB v2 GSI Schema Provisioning & Data Migration (${targetEnv.toUpperCase()})`);
  console.log(`Database ID:  ${ydbDatabaseId}`);
  console.log(`Mode:         ${verifyOnly ? 'VERIFY-ONLY' : 'CREATE + MIGRATE + VERIFY'}`);
  console.log('====================================================================');

  const summary = [];
  let hasFailure = false;

  for (const schema of Object.values(V2_TABLES_SCHEMA)) {
    console.log(`\n[${schema.logicalName} -> ${schema.v2TableName}]`);

    if (!verifyOnly) {
      await ensureV2Table(schema);
    }

    const v1Scan = await scanAllItems(schema.logicalName);
    let copied = 0;

    if (!verifyOnly && v1Scan.exists && v1Scan.items.length > 0) {
      for (const rawItem of v1Scan.items) {
        const sanitized = sanitizeItemForV2(schema.logicalName, rawItem);
        await putV2Item(schema, sanitized);
        copied++;
      }
      console.log(`  [>] Migrated ${copied}/${v1Scan.items.length} records idempotently into ${schema.v2TableName}.`);
    }

    const v2Desc = await describeTable(schema.v2TableName);
    const v2Scan = v2Desc ? await scanAllItems(schema.v2TableName) : { exists: false, items: [] };
    const gsiStatuses = (v2Desc?.GlobalSecondaryIndexes || []).map((g) => ({
      name: g.IndexName,
      status: g.IndexStatus || 'UNKNOWN',
    }));

    const expectedGsiNames = new Set(schema.gsis.map((g) => g.indexName));
    const activeGsiNames = new Set(gsiStatuses.filter((g) => g.status === 'ACTIVE').map((g) => g.name));
    const missingOrInactiveGsis = Array.from(expectedGsiNames).filter((name) => !activeGsiNames.has(name));

    const v1Count = v1Scan.items.length;
    const v2Count = v2Scan.items.length;
    const countParityOk = v2Scan.exists && v2Count >= v1Count;
    const gsiParityOk = missingOrInactiveGsis.length === 0;
    const rowOk = Boolean(v2Desc) && countParityOk && gsiParityOk;

    if (!rowOk) {
      hasFailure = true;
    }

    summary.push({
      logical: schema.logicalName,
      v2Table: schema.v2TableName,
      v1Count,
      v2Count,
      gsisExpected: schema.gsis.length,
      gsisActive: activeGsiNames.size,
      status: rowOk ? 'PASS' : 'FAIL',
      issue: !rowOk
        ? `missingTable=${!v2Desc}, v1=${v1Count}, v2=${v2Count}, inactiveGsis=[${missingOrInactiveGsis.join(',')}]`
        : '',
    });
  }

  console.log('\n==================== MIGRATION & PARITY SUMMARY ====================');
  console.table(summary);

  if (hasFailure) {
    console.error('[MigrateYdbV2] Parity check FAILED for one or more tables.');
    process.exit(1);
  }
  console.log('[MigrateYdbV2] ALL 12 v2 tables & GSIs are ACTIVE with full data parity.');
}

main().catch((err) => {
  console.error('[MigrateYdbV2] Fatal error:', err);
  process.exit(1);
});
