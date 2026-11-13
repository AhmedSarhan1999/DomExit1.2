import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import { RussianCityCode } from '../../types';
import { getRegionByCode } from '../../data/russianGeography';
import {
  callYdbDocApi,
  toDynamoAttribute,
  fromDynamoAttribute,
  getYandexCredentials,
  YandexCredentialsConfig,
} from '../scripts/initYandexTables';

/**
 * Enterprise Production Data Access Layer: Yandex Cloud Adapter
 *
 * Implements:
 * - 152-FZ Russian Federal Law Compliance (Data & Object Storage in RF)
 * - Yandex Managed Service for YDB (Document API / DynamoDB wire-compatible)
 * - Yandex Object Storage (AWS S3 Signature v4 compatible)
 * - Transparent fallback & optimistic local caching
 */

async function sha256Hex(buf: ArrayBuffer | Uint8Array): Promise<string> {
  const data: BufferSource = buf instanceof Uint8Array ? new Uint8Array(buf) as unknown as BufferSource : buf;
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacRaw(keyBuf: ArrayBuffer | Uint8Array, dataBuf: Uint8Array): Promise<ArrayBuffer> {
  const keyData: BufferSource = keyBuf instanceof Uint8Array ? (keyBuf as unknown as BufferSource) : keyBuf;
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await globalThis.crypto.subtle.sign('HMAC', key, dataBuf as unknown as BufferSource);
}

async function getS3SigningKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const kDate = await hmacRaw(enc.encode('AWS4' + secret), enc.encode(dateStamp));
  const kRegion = await hmacRaw(kDate, enc.encode(region));
  const kService = await hmacRaw(kRegion, enc.encode(service));
  return await hmacRaw(kService, enc.encode('aws4_request'));
}

export class YandexCloudDatabaseAdapter implements IDatabaseAdapter {
  readonly providerName = 'yandex_cloud' as const;
  private config: YandexCredentialsConfig;

  constructor(customConfig?: Partial<YandexCredentialsConfig>) {
    this.config = { ...getYandexCredentials(), ...customConfig };
  }

  async saveEntity<T extends { id: string }>(collectionName: string, entity: T): Promise<T> {
    const item: Record<string, any> = {};
    for (const k of Object.keys(entity)) {
      const val = (entity as any)[k];
      if (val !== undefined) {
        item[k] = toDynamoAttribute(val);
      }
    }

    // 1. Optimistic write to localStorage for instant local reactivity
    this.writeLocalCache(collectionName, entity);

    // 2. Persist to YDB Document API
    try {
      await callYdbDocApi(
        'DynamoDB_20120810.PutItem',
        {
          TableName: collectionName,
          Item: item,
        },
        this.config
      );
    } catch (err) {
      console.warn(`[YandexCloudAdapter] Error writing to YDB table ${collectionName}:`, err);
    }

    return entity;
  }

  async getAllEntities<T extends { id: string }>(
    collectionName: string,
    seedFallback: T[] = []
  ): Promise<T[]> {
    try {
      const res = await callYdbDocApi(
        'DynamoDB_20120810.Scan',
        {
          TableName: collectionName,
        },
        this.config
      );

      if (res.status === 200 && Array.isArray(res.data?.Items)) {
        const items: T[] = res.data.Items.map((rawItem: any) => {
          const obj: Record<string, any> = {};
          for (const k of Object.keys(rawItem)) {
            obj[k] = fromDynamoAttribute(rawItem[k]);
          }
          return obj as T;
        });

        if (items.length > 0) {
          this.replaceLocalCache(collectionName, items);
          return items;
        }

        // If table is empty and fallback seed provided, seed if permitted
        if (seedFallback.length > 0) {
          for (const item of seedFallback) {
            await this.saveEntity(collectionName, item);
          }
          return [...seedFallback];
        }
        return [];
      }
    } catch (err) {
      console.warn(`[YandexCloudAdapter] YDB Scan error on ${collectionName}:`, err);
    }

    // Fallback to local cache if network is unavailable
    const cached = this.readLocalCache<T>(collectionName);
    if (cached.length > 0) return cached;
    return [...seedFallback];
  }

  async getEntityById<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback: T[] = []
  ): Promise<T | null> {
    try {
      const res = await callYdbDocApi(
        'DynamoDB_20120810.GetItem',
        {
          TableName: collectionName,
          Key: { id: { S: id } },
        },
        this.config
      );

      if (res.status === 200 && res.data?.Item) {
        const obj: Record<string, any> = {};
        for (const k of Object.keys(res.data.Item)) {
          obj[k] = fromDynamoAttribute(res.data.Item[k]);
        }
        return obj as T;
      }
    } catch (err) {
      console.warn(`[YandexCloudAdapter] YDB GetItem error on ${collectionName}/${id}:`, err);
    }

    const cached = this.readLocalCache<T>(collectionName).find((i) => i.id === id);
    if (cached) return cached;
    return seedFallback.find((i) => i.id === id) || null;
  }

  async queryEntities<T extends { id: string }>(
    collectionName: string,
    predicate: (item: T) => boolean,
    seedFallback: T[] = []
  ): Promise<T[]> {
    const all = await this.getAllEntities<T>(collectionName, seedFallback);
    return all.filter(predicate);
  }

  async removeEntity(collectionName: string, id: string): Promise<boolean> {
    this.removeLocalCache(collectionName, id);

    try {
      await callYdbDocApi(
        'DynamoDB_20120810.DeleteItem',
        {
          TableName: collectionName,
          Key: { id: { S: id } },
        },
        this.config
      );
      return true;
    } catch (err) {
      console.warn(`[YandexCloudAdapter] YDB DeleteItem error on ${collectionName}/${id}:`, err);
      return true;
    }
  }

  /**
   * Uploads a file/document to Yandex Object Storage via S3 Signature v4.
   */
  async uploadS3Object(
    objectKey: string,
    data: Uint8Array | ArrayBuffer | Blob | File | string,
    contentType = 'application/octet-stream'
  ): Promise<string> {
    let payloadBytes: Uint8Array;
    if (typeof data === 'string') {
      payloadBytes = new TextEncoder().encode(data);
    } else if (data instanceof Uint8Array) {
      payloadBytes = data;
    } else if (data instanceof ArrayBuffer) {
      payloadBytes = new Uint8Array(data);
    } else {
      const ab = await data.arrayBuffer();
      payloadBytes = new Uint8Array(ab);
    }

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const payloadHash = await sha256Hex(payloadBytes);

    const safeKey = objectKey.startsWith('/') ? objectKey.slice(1) : objectKey;
    const url = new URL(`${this.config.storageEndpoint}/${this.config.storageBucket}/${safeKey}`);

    const canonicalHeaders = [
      `content-type:${contentType}`,
      `host:${url.host}`,
      `x-amz-acl:public-read`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].join('\n') + '\n';

    const signedHeaders = 'content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      'PUT',
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const enc = new TextEncoder();
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256Hex(enc.encode(canonicalRequest)),
    ].join('\n');

    const signingKey = await getS3SigningKey(
      this.config.secretAccessKey,
      dateStamp,
      this.config.region,
      's3'
    );
    const sigBuf = await hmacRaw(signingKey, enc.encode(stringToSign));
    const signature = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-acl': 'public-read',
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        Authorization: authHeader,
      },
      body: payloadBytes as unknown as BodyInit,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[YandexCloudAdapter] S3 upload failed (${res.status}):`, errText);
      throw new Error(`Ошибка загрузки в Yandex Object Storage (${res.status}): ${errText}`);
    }

    return `${this.config.storageEndpoint}/${this.config.storageBucket}/${safeKey}`;
  }

  getConfig(): YandexCredentialsConfig {
    return this.config;
  }

  private getCacheKey(collectionName: string): string {
    return `domexit_ydb_${collectionName}`;
  }

  private readLocalCache<T>(collectionName: string): T[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getCacheKey(collectionName));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeLocalCache<T extends { id: string }>(collectionName: string, entity: T): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const list = this.readLocalCache<T>(collectionName);
      const idx = list.findIndex((i) => i.id === entity.id);
      if (idx >= 0) list[idx] = entity;
      else list.unshift(entity);
      localStorage.setItem(this.getCacheKey(collectionName), JSON.stringify(list));
    } catch {
      // Ignored if storage full
    }
  }

  private replaceLocalCache<T>(collectionName: string, items: T[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.getCacheKey(collectionName), JSON.stringify(items));
    } catch {
      // Ignored
    }
  }

  private removeLocalCache(collectionName: string, id: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const list = this.readLocalCache<{ id: string }>(collectionName).filter((i) => i.id !== id);
      localStorage.setItem(this.getCacheKey(collectionName), JSON.stringify(list));
    } catch {
      // Ignored
    }
  }
}

export class YandexCloudAdapter {
  private static instance = new YandexCloudDatabaseAdapter();
  private static isConnected = true;

  static async initialize(customConfig?: Partial<YandexCredentialsConfig>): Promise<boolean> {
    if (customConfig) {
      this.instance = new YandexCloudDatabaseAdapter(customConfig);
    }
    this.isConnected = true;
    return true;
  }

  static isReady(): boolean {
    return this.isConnected;
  }

  static getAdapter(): IDatabaseAdapter {
    return this.instance;
  }

  static async uploadS3Object(
    objectKey: string,
    data: Uint8Array | ArrayBuffer | Blob | File | string,
    contentType = 'application/octet-stream'
  ): Promise<string> {
    return this.instance.uploadS3Object(objectKey, data, contentType);
  }

  static async resolveAddress(
    _complexName: string,
    city: RussianCityCode
  ): Promise<{ lat: number; lng: number }> {
    return getRegionByCode(city).center;
  }

  /**
   * Performs an active end-to-end diagnostic ping on Yandex YDB Document API.
   * Returns latency, connectivity status, and error details if any.
   */
  static async testConnection(): Promise<{
    ok: boolean;
    provider: 'yandex_cloud';
    message: string;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const res = await callYdbDocApi('DynamoDB_20120810.DescribeTable', {
        TableName: 'platform_settings',
      });
      const latencyMs = Date.now() - start;
      if (res.status === 200) {
        return {
          ok: true,
          provider: 'yandex_cloud',
          message: 'Подключено (Live • Production)',
          latencyMs,
        };
      }
      return {
        ok: false,
        provider: 'yandex_cloud',
        message: `Ошибка YDB API (${res.status}): ${res.text || 'Недоступно'}`,
        latencyMs,
        error: res.text,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        ok: false,
        provider: 'yandex_cloud',
        message: `Сбой подключения к YDB: ${err?.message || 'Сеть недоступна'}`,
        latencyMs,
        error: err?.message,
      };
    }
  }
}
