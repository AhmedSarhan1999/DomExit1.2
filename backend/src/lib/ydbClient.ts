import crypto from 'node:crypto';
import { getConfig } from './config.js';

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

  async getItem<T = any>(tableName: string, id: string): Promise<T | null> {
    const res = await this.callApi('DynamoDB_20120810.GetItem', {
      TableName: tableName,
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

    const dynamoItem: Record<string, any> = {};
    for (const [k, v] of Object.entries(item)) {
      if (v !== undefined) {
        dynamoItem[k] = toDynamo(v);
      }
    }

    await this.callApi('DynamoDB_20120810.PutItem', {
      TableName: tableName,
      Item: dynamoItem,
    });
  }

  async deleteItem(tableName: string, id: string): Promise<void> {
    await this.callApi('DynamoDB_20120810.DeleteItem', {
      TableName: tableName,
      Key: {
        id: { S: id },
      },
    });
  }

  async scanAll<T = any>(tableName: string, limit = 1000): Promise<T[]> {
    const items: T[] = [];
    let lastEvaluatedKey: any = undefined;

    do {
      const payload: Record<string, any> = {
        TableName: tableName,
        Limit: Math.min(limit - items.length, 100),
      };
      if (lastEvaluatedKey) {
        payload.ExclusiveStartKey = lastEvaluatedKey;
      }

      const res = await this.callApi('DynamoDB_20120810.Scan', payload);

      if (res?.Items && Array.isArray(res.Items)) {
        for (const rawItem of res.Items) {
          const obj: Record<string, any> = {};
          for (const [k, v] of Object.entries(rawItem)) {
            obj[k] = fromDynamo(v);
          }
          items.push(obj as T);
        }
      }

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
    const limit = options.limit || 50;
    const payload: Record<string, any> = {
      TableName: tableName,
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
    const items: T[] = [];
    if (res?.Items && Array.isArray(res.Items)) {
      for (const rawItem of res.Items) {
        const obj: Record<string, any> = {};
        for (const [k, v] of Object.entries(rawItem)) {
          obj[k] = fromDynamo(v);
        }
        items.push(obj as T);
      }
    }

    return {
      items,
      lastEvaluatedKey: res?.LastEvaluatedKey,
    };
  }

  async findByField<T = any>(tableName: string, field: string, value: any, limit = 100): Promise<T[]> {
    try {
      const items: T[] = [];
      let lastEvaluatedKey: any = undefined;

      do {
        const payload: Record<string, any> = {
          TableName: tableName,
          Limit: Math.min(limit - items.length, 50),
          FilterExpression: '#f = :v',
          ExpressionAttributeNames: { '#f': field },
          ExpressionAttributeValues: { ':v': toDynamo(value) },
        };
        if (lastEvaluatedKey) {
          payload.ExclusiveStartKey = lastEvaluatedKey;
        }

        const res = await this.callApi('DynamoDB_20120810.Scan', payload);

        if (res?.Items && Array.isArray(res.Items)) {
          for (const rawItem of res.Items) {
            const obj: Record<string, any> = {};
            for (const [k, v] of Object.entries(rawItem)) {
              obj[k] = fromDynamo(v);
            }
            items.push(obj as T);
          }
        }

        lastEvaluatedKey = res?.LastEvaluatedKey;
      } while (lastEvaluatedKey && items.length < limit);

      return items;
    } catch (err: any) {
      console.warn(`[YdbClient.findByField] FilterExpression scan failed for ${tableName}.${field}:`, err.message);
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
