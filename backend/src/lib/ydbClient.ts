import crypto from 'node:crypto';
import { getConfig } from './config.js';
import { FIELD_TO_INDEX_MAP, V2_TABLES_SCHEMA, sanitizeItemForV2 } from './ydbV2Schema.js';

export interface QueryRangeCondition {
  op: '=' | '<' | '<=' | '>' | '>=' | 'between' | 'begins_with';
  value: string;
  value2?: string;
}

export interface QueryByIndexParams {
  tableName: string;
  indexName: string;
  hashKey: string;
  hashValue: string;
  rangeKey?: string;
  rangeCondition?: QueryRangeCondition;
  scanIndexForward?: boolean;
  limit?: number;
  exclusiveStartKey?: Record<string, any> | string;
}

export interface QueryPageResult<T = any> {
  items: T[];
  lastEvaluatedKey?: Record<string, any>;
  nextCursor: string | null;
}

export function encodeCursor(keyObj?: Record<string, any> | null): string | null {
  if (!keyObj || Object.keys(keyObj).length === 0) return null;
  return Buffer.from(JSON.stringify(keyObj), 'utf-8').toString('base64url');
}

export function decodeCursor(cursor?: string | null): Record<string, any> | undefined {
  if (!cursor) return undefined;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function toDynamo(val: any): any {
  if (val === null || val === undefined) return { NULL: true };
  if (typeof val === 'string') return { S: val };
  if (typeof val === 'number') return { N: String(val) };
  if (typeof val === 'boolean') return { BOOL: val };
  if (Array.isArray(val)) return { L: val.map(toDynamo) };
  if (typeof val === 'object') {
    const m: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      if (val[k] !== undefined) m[k] = toDynamo(val[k]);
    }
    return { M: m };
  }
  return { S: String(val) };
}

export function fromDynamo(attr: any): any {
  if (!attr) return null;
  if ('S' in attr) return attr.S;
  if ('N' in attr) return Number(attr.N);
  if ('BOOL' in attr) return attr.BOOL;
  if ('NULL' in attr) return null;
  if ('L' in attr && Array.isArray(attr.L)) return attr.L.map(fromDynamo);
  if ('M' in attr && typeof attr.M === 'object') {
    const obj: Record<string, any> = {};
    for (const k of Object.keys(attr.M)) {
      obj[k] = fromDynamo(attr.M[k]);
    }
    return obj;
  }
  return null;
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: Buffer | string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

export class YdbClient {
  private endpoint: string;
  private region: string;
  private keyId: string;
  private secretKey: string;
  private canonicalHost: string;
  private canonicalPath: string;

  constructor() {
    const cfg = getConfig();
    this.endpoint = cfg.YDB_DOCAPI_ENDPOINT;
    this.region = cfg.YDB_REGION;
    this.keyId = cfg.YC_ACCESS_KEY_ID;
    this.secretKey = cfg.YC_SECRET_ACCESS_KEY;

    const url = new URL(this.endpoint);
    this.canonicalHost = url.host;
    this.canonicalPath = url.pathname;
  }

  async callApi(target: string, bodyObj: Record<string, any>): Promise<any> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const body = JSON.stringify(bodyObj);
    const bodyHash = sha256Hex(body);

    const canonicalHeaders = [
      'content-type:application/x-amz-json-1.0',
      `host:${this.canonicalHost}`,
      `x-amz-date:${amzDate}`,
      `x-amz-target:${target}`,
    ].join('\n') + '\n';

    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
    const canonicalRequest = [
      'POST',
      this.canonicalPath,
      '',
      canonicalHeaders,
      signedHeaders,
      bodyHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/dynamodb/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSigningKey(this.secretKey, dateStamp, this.region, 'dynamodb');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.keyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': target,
        'X-Amz-Date': amzDate,
        Authorization: authHeader,
      },
      body,
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw new Error(
        `[YdbClient] API ${target} failed with HTTP ${res.status}: ${data?.message || text}`
      );
    }

    return data;
  }

  private parseDynamoItems<T = any>(rawItems?: any[]): T[] {
    const items: T[] = [];
    if (!rawItems || !Array.isArray(rawItems)) return items;
    for (const rawItem of rawItems) {
      const obj: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawItem)) {
        obj[k] = fromDynamo(v);
      }
      items.push(obj as T);
    }
    return items;
  }

  isV2TablesEnabled(): boolean {
    if (process.env.YDB_USE_V2_TABLES === 'true') return true;
    return Boolean(getConfig().YDB_USE_V2_TABLES);
  }

  resolveTableName(logicalTable: string): string {
    if (!logicalTable) return logicalTable;
    if (logicalTable.endsWith('_v2')) return logicalTable;
    if (this.isV2TablesEnabled() && V2_TABLES_SCHEMA[logicalTable]) {
      return V2_TABLES_SCHEMA[logicalTable].v2TableName;
    }
    if (V2_TABLES_SCHEMA[logicalTable] && (
      logicalTable.startsWith('kyc_') ||
      logicalTable.startsWith('ai_') ||
      logicalTable.startsWith('journal_') ||
      logicalTable.startsWith('legislative_') ||
      logicalTable.startsWith('avm_') ||
      logicalTable.startsWith('eiszh_') ||
      logicalTable.startsWith('market_') ||
      logicalTable.startsWith('agent_')
    )) {
      return V2_TABLES_SCHEMA[logicalTable].v2TableName;
    }
    return logicalTable;
  }

  async getItem<T = any>(tableName: string, id: string): Promise<T | null> {
    const resolvedTable = this.resolveTableName(tableName);
    const res = await this.callApi('DynamoDB_20120810.GetItem', {
      TableName: resolvedTable,
      Key: {
        id: { S: id },
      },
    });

    if (!res?.Item) return null;

    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(res.Item)) {
      obj[k] = fromDynamo(v);
    }
    return obj as T;
  }

  async putItem(tableName: string, item: Record<string, any>): Promise<void> {
    if (!item.id) {
      throw new Error(`[YdbClient.putItem] Item missing mandatory "id" attribute.`);
    }

    const resolvedTable = this.resolveTableName(tableName);
    const isV2Write = resolvedTable.endsWith('_v2');
    const normalizedItem = isV2Write ? sanitizeItemForV2(tableName, item) : item;

    const dynamoItem: Record<string, any> = {};
    for (const [k, v] of Object.entries(normalizedItem)) {
      if (v !== undefined) {
        dynamoItem[k] = toDynamo(v);
      }
    }

    await this.callApi('DynamoDB_20120810.PutItem', {
      TableName: resolvedTable,
      Item: dynamoItem,
    });
  }

  async deleteItem(tableName: string, id: string): Promise<void> {
    const resolvedTable = this.resolveTableName(tableName);
    await this.callApi('DynamoDB_20120810.DeleteItem', {
      TableName: resolvedTable,
      Key: {
        id: { S: id },
      },
    });
  }

  async queryByIndex<T = any>(params: QueryByIndexParams): Promise<QueryPageResult<T>> {
    const resolvedTable = this.resolveTableName(params.tableName);
    const expressionNames: Record<string, string> = { '#hk': params.hashKey };
    const expressionValues: Record<string, any> = { ':hv': toDynamo(String(params.hashValue)) };
    let keyCondition = '#hk = :hv';

    if (params.rangeKey && params.rangeCondition) {
      expressionNames['#rk'] = params.rangeKey;
      const rc = params.rangeCondition;
      expressionValues[':rv1'] = toDynamo(String(rc.value));
      if (rc.op === 'between') {
        expressionValues[':rv2'] = toDynamo(String(rc.value2 ?? rc.value));
        keyCondition += ' AND #rk BETWEEN :rv1 AND :rv2';
      } else if (rc.op === 'begins_with') {
        keyCondition += ' AND begins_with(#rk, :rv1)';
      } else {
        keyCondition += ` AND #rk ${rc.op} :rv1`;
      }
    }

    const startKey =
      typeof params.exclusiveStartKey === 'string'
        ? decodeCursor(params.exclusiveStartKey)
        : params.exclusiveStartKey;

    const payload: Record<string, any> = {
      TableName: resolvedTable,
      IndexName: params.indexName,
      ConsistentRead: false, // Mandatory for GlobalSecondaryIndex queries in YDB DocAPI
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: params.scanIndexForward ?? true,
    };

    if (params.limit && params.limit > 0) {
      payload.Limit = params.limit;
    }
    if (startKey) {
      payload.ExclusiveStartKey = startKey;
    }

    const res = await this.callApi('DynamoDB_20120810.Query', payload);
    const items = this.parseDynamoItems<T>(res?.Items);
    const lastEvaluatedKey = res?.LastEvaluatedKey;

    return {
      items,
      lastEvaluatedKey,
      nextCursor: encodeCursor(lastEvaluatedKey),
    };
  }

  async queryAllByIndex<T = any>(
    params: Omit<QueryByIndexParams, 'exclusiveStartKey'>,
    maxPages = 20
  ): Promise<T[]> {
    const allItems: T[] = [];
    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    let pageCount = 0;
    const targetCap = params.limit && params.limit > 0 ? params.limit : Infinity;

    do {
      pageCount++;
      const remaining = targetCap === Infinity ? 100 : Math.min(100, Math.max(1, targetCap - allItems.length));
      const res: QueryPageResult<T> = await this.queryByIndex<T>({
        ...params,
        limit: remaining,
        exclusiveStartKey,
      });
      allItems.push(...res.items);
      exclusiveStartKey = res.lastEvaluatedKey;
    } while (exclusiveStartKey && pageCount < maxPages && allItems.length < targetCap);

    return allItems;
  }

  async scanAll<T = any>(tableName: string, limit = 1000): Promise<T[]> {
    const resolvedTable = this.resolveTableName(tableName);
    const items: T[] = [];
    let lastEvaluatedKey: any = undefined;

    do {
      const payload: Record<string, any> = {
        TableName: resolvedTable,
        Limit: Math.min(limit - items.length, 100),
      };
      if (lastEvaluatedKey) {
        payload.ExclusiveStartKey = lastEvaluatedKey;
      }

      const res = await this.callApi('DynamoDB_20120810.Scan', payload);
      items.push(...this.parseDynamoItems<T>(res?.Items));

      lastEvaluatedKey = res?.LastEvaluatedKey;
    } while (lastEvaluatedKey && items.length < limit);

    return items;
  }

  async scanPage<T = any>(
    tableName: string,
    options: {
      limit?: number;
      exclusiveStartKey?: any;
      filterExpression?: string;
      expressionAttributeNames?: Record<string, string>;
      expressionAttributeValues?: Record<string, any>;
    } = {}
  ): Promise<{ items: T[]; lastEvaluatedKey?: any }> {
    const resolvedTable = this.resolveTableName(tableName);
    const limit = options.limit || 50;
    const payload: Record<string, any> = {
      TableName: resolvedTable,
      Limit: limit,
    };
    if (options.exclusiveStartKey) {
      payload.ExclusiveStartKey = options.exclusiveStartKey;
    }
    if (options.filterExpression) {
      payload.FilterExpression = options.filterExpression;
    }
    if (options.expressionAttributeNames) {
      payload.ExpressionAttributeNames = options.expressionAttributeNames;
    }
    if (options.expressionAttributeValues) {
      payload.ExpressionAttributeValues = options.expressionAttributeValues;
    }

    const res = await this.callApi('DynamoDB_20120810.Scan', payload);
    return {
      items: this.parseDynamoItems<T>(res?.Items),
      lastEvaluatedKey: res?.LastEvaluatedKey,
    };
  }

  async findByField<T = any>(tableName: string, field: string, value: any, limit = 100): Promise<T[]> {
    const baseName = tableName.endsWith('_v2') ? tableName.slice(0, -3) : tableName;
    const indexMapping = FIELD_TO_INDEX_MAP[baseName]?.[field];

    if (this.isV2TablesEnabled() && indexMapping && value !== undefined && value !== null && String(value).trim() !== '') {
      const normalizedValue = field === 'email' ? String(value).trim().toLowerCase() : String(value).trim();
      return this.queryAllByIndex<T>({
        tableName: baseName,
        indexName: indexMapping.indexName,
        hashKey: indexMapping.hashKey,
        hashValue: normalizedValue,
        scanIndexForward: false,
        limit,
      });
    }

    const resolvedTable = this.resolveTableName(tableName);
    try {
      const items: T[] = [];
      let lastEvaluatedKey: any = undefined;

      do {
        const payload: Record<string, any> = {
          TableName: resolvedTable,
          Limit: Math.min(limit - items.length, 50),
          FilterExpression: '#f = :v',
          ExpressionAttributeNames: { '#f': field },
          ExpressionAttributeValues: { ':v': toDynamo(value) },
        };
        if (lastEvaluatedKey) {
          payload.ExclusiveStartKey = lastEvaluatedKey;
        }

        const res = await this.callApi('DynamoDB_20120810.Scan', payload);
        items.push(...this.parseDynamoItems<T>(res?.Items));

        lastEvaluatedKey = res?.LastEvaluatedKey;
      } while (lastEvaluatedKey && items.length < limit);

      return items;
    } catch (err: any) {
      console.warn(`[YdbClient.findByField] FilterExpression scan failed for ${resolvedTable}.${field}:`, err.message);
      const all = await this.scanAll<T>(tableName, 500);
      return all.filter((item: any) => item[field] === value);
    }
  }

  async batchDelete(tableName: string, ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.deleteItem(tableName, id);
      } catch (err: any) {
        console.warn(`[YdbClient.batchDelete] Failed deleting ${tableName}:${id}:`, err.message);
      }
    }
  }
}

let instance: YdbClient | null = null;
export function getYdbClient(): YdbClient {
  if (!instance) {
    instance = new YdbClient();
  }
  return instance;
}
