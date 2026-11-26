export interface V2GsiDefinition {
  indexName: string;
  hashKey: string;
  rangeKey?: string;
}

export interface V2TableSchema {
  logicalName: string;
  v2TableName: string;
  gsis: V2GsiDefinition[];
}

export interface FieldIndexMapping {
  indexName: string;
  hashKey: string;
  rangeKey?: string;
}

export const V2_TABLES_SCHEMA: Record<string, V2TableSchema> = {
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
  ai_legal_analyses: {
    logicalName: 'ai_legal_analyses',
    v2TableName: 'ai_legal_analyses_v2',
    gsis: [
      { indexName: 'lotCode-createdAt-index', hashKey: 'lotCode', rangeKey: 'createdAt' },
      { indexName: 'ocrJobId-index', hashKey: 'ocrJobId' },
    ],
  },
  ai_buyer_verifications: {
    logicalName: 'ai_buyer_verifications',
    v2TableName: 'ai_buyer_verifications_v2',
    gsis: [
      { indexName: 'targetId-createdAt-index', hashKey: 'targetId', rangeKey: 'createdAt' },
      { indexName: 'userId-createdAt-index', hashKey: 'userId', rangeKey: 'createdAt' },
    ],
  },
};

export const V2_LOGICAL_TABLES = Object.keys(V2_TABLES_SCHEMA);

export const FIELD_TO_INDEX_MAP: Record<string, Record<string, FieldIndexMapping>> = Object.fromEntries(
  Object.entries(V2_TABLES_SCHEMA).map(([logicalTable, schema]) => {
    const fieldMap: Record<string, FieldIndexMapping> = {};
    for (const gsi of schema.gsis) {
      if (!fieldMap[gsi.hashKey]) {
        fieldMap[gsi.hashKey] = {
          indexName: gsi.indexName,
          hashKey: gsi.hashKey,
          rangeKey: gsi.rangeKey,
        };
      }
    }
    return [logicalTable, fieldMap];
  })
);

function getIndexedFieldsForTable(schema: V2TableSchema): string[] {
  const fields = new Set<string>();
  for (const gsi of schema.gsis) {
    fields.add(gsi.hashKey);
    if (gsi.rangeKey) fields.add(gsi.rangeKey);
  }
  return Array.from(fields);
}

/**
 * Normalizes and strips empty/null/undefined indexed attributes before writing to a YDB v2 table.
 * Prevents empty-string GSI key validation errors and guarantees String ('S') types on indexed keys.
 */
export function sanitizeItemForV2(logicalTable: string, rawItem: Record<string, any>): Record<string, any> {
  const baseName = logicalTable.endsWith('_v2') ? logicalTable.slice(0, -3) : logicalTable;
  const schema = V2_TABLES_SCHEMA[baseName];
  const item: Record<string, any> = { ...rawItem };

  if (item.id !== undefined && item.id !== null) {
    item.id = String(item.id);
  }

  if (!schema) {
    return item;
  }

  const nowIso = new Date().toISOString();
  const indexedFields = getIndexedFieldsForTable(schema);

  if (indexedFields.includes('createdAt') && (!item.createdAt || String(item.createdAt).trim() === '')) {
    item.createdAt = item.timestamp || item.updatedAt || nowIso;
  }

  if (baseName === 'lots') {
    if (!item.status || String(item.status).trim() === '') {
      item.status = 'draft';
    }
    if (!item.publishedAt || String(item.publishedAt).trim() === '') {
      item.publishedAt = item.createdAt || nowIso;
    }
    if (!item.assignedCuratorId && item.assignedEmployeeId) {
      item.assignedCuratorId = item.assignedEmployeeId;
    }
    if (!item.ownerId && (item.sellerId || item.sellerUserId)) {
      item.ownerId = item.sellerId || item.sellerUserId;
    }
  } else if (baseName === 'buyer_applications') {
    if (!item.lotId && item.lotCode) {
      item.lotId = String(item.lotCode).trim().toUpperCase();
    }
    if (!item.assignedCuratorId && item.assignedEmployeeId) {
      item.assignedCuratorId = item.assignedEmployeeId;
    }
  } else if (baseName === 'deals') {
    if (!item.lotId && item.lotCode) {
      item.lotId = item.lotCode;
    }
    if (!item.buyerId && item.buyerUserId) {
      item.buyerId = item.buyerUserId;
    }
    if (!item.sellerId && item.sellerUserId) {
      item.sellerId = item.sellerUserId;
    }
    if (!item.assignedCuratorId && item.assignedEmployeeId) {
      item.assignedCuratorId = item.assignedEmployeeId;
    }
  } else if (baseName === 'users') {
    if (typeof item.email === 'string' && item.email.trim()) {
      item.email = item.email.trim().toLowerCase();
    }
    if (typeof item.login === 'string' && item.login.trim()) {
      item.login = item.login.trim();
    }
  } else if (baseName === 'audit_logs') {
    item.partitionKey = 'AUDIT';
    if (!item.timestamp || String(item.timestamp).trim() === '') {
      item.timestamp = item.createdAt || nowIso;
    }
    if (!item.actorId && (item.operatorId || item.performedBy)) {
      item.actorId = item.operatorId || item.performedBy;
    }
    if (!item.targetId && (item.targetLotCode || item.lotCode || item.dealId)) {
      item.targetId = item.targetLotCode || item.lotCode || item.dealId;
    }
  } else if (baseName === 'deal_messages') {
    if (!item.dealId && item.lotCode) {
      item.dealId = item.lotCode;
    }
    if (!item.senderId && item.userId) {
      item.senderId = item.userId;
    }
  } else if (baseName === 'curator_messages') {
    if (!item.userId && item.senderId) {
      item.userId = item.senderId;
    }
    if (!item.dealId && item.lotCode) {
      item.dealId = item.lotCode;
    }
  } else if (baseName === 'ai_ocr_jobs') {
    if (!item.status || String(item.status).trim() === '') item.status = 'queued';
    if (!item.createdAt || String(item.createdAt).trim() === '') item.createdAt = nowIso;
  } else if (baseName === 'seller_requests') {
    if (!item.assignedCuratorId && item.assignedEmployeeId) {
      item.assignedCuratorId = item.assignedEmployeeId;
    }
  } else if (baseName === 'documents_vault') {
    if (!item.uploadedAt || String(item.uploadedAt).trim() === '') {
      item.uploadedAt = item.createdAt || nowIso;
    }
    if (!item.lotId && item.entityId) {
      item.lotId = item.entityId;
    }
    if (!item.ownerId && (item.userId || item.sellerId)) {
      item.ownerId = item.userId || item.sellerId;
    }
  } else if (baseName === 'pep_signatures') {
    if (!item.signedAt || String(item.signedAt).trim() === '') {
      item.signedAt = item.createdAt || nowIso;
    }
    if (!item.dealId && item.lotCode) {
      item.dealId = item.lotCode;
    }
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

export function buildDynamoCreateTableInput(schema: V2TableSchema): Record<string, any> {
  const indexedFields = getIndexedFieldsForTable(schema);
  return {
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
}
