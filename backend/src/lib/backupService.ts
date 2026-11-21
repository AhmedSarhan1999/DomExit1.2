import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getConfig } from './config.js';
import { getS3Client } from './s3Client.js';
import { fromDynamo } from './ydbClient.js';
import { logger } from './logger.js';

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

async function callDocApiDirect(
  endpoint: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  target: string,
  bodyObj: Record<string, any>,
  retries = 3
): Promise<any> {
  const url = new URL(endpoint);
  const canonicalHost = url.host;
  const canonicalPath = url.pathname;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const body = JSON.stringify(bodyObj);
    const bodyHash = sha256Hex(body);

    const canonicalHeaders = [
      'content-type:application/x-amz-json-1.0',
      `host:${canonicalHost}`,
      `x-amz-date:${amzDate}`,
      `x-amz-target:${target}`,
    ].join('\n') + '\n';

    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
    const canonicalRequest = [
      'POST',
      canonicalPath,
      '',
      canonicalHeaders,
      signedHeaders,
      bodyHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/dynamodb/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSigningKey(secretAccessKey, dateStamp, region, 'dynamodb');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    try {
      const res = await fetch(endpoint, {
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

      if (res.status === 200) {
        return data;
      }

      if (res.status === 504 || res.status === 503 || res.status === 500) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
      }

      throw new Error(`DocAPI ${target} returned HTTP ${res.status}: ${data?.message || text}`);
    } catch (err: any) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
}

export interface BackupResult {
  ok: boolean;
  key: string;
  tableCount: number;
  totalRecords: number;
  sizeBytes: number;
  durationMs: number;
  prunedCount: number;
  createdAt: string;
}

export interface BackupItemInfo {
  key: string;
  folder: 'daily' | 'pre-cutover' | 'other';
  sizeBytes: number;
  lastModified?: string;
}

export async function runYdbBackup(options?: {
  env?: 'staging' | 'production';
  maxDailyBackups?: number;
}): Promise<BackupResult> {
  const startTime = Date.now();
  const cfg = getConfig();
  const env = options?.env || cfg.APP_ENV || 'staging';
  const maxRetention = options?.maxDailyBackups || 30;

  logger.info('Starting YDB automated backup', {
    event: 'BACKUP_STARTED',
    meta: { env, targetBucket: cfg.S3_PRIVATE_BUCKET },
  });

  // 1. List all tables with pagination support
  const tableNames: string[] = [];
  let lastEvaluatedTableName: string | undefined = undefined;

  do {
    const payload: Record<string, any> = {};
    if (lastEvaluatedTableName) {
      payload.ExclusiveStartTableName = lastEvaluatedTableName;
    }

    const listRes = await callDocApiDirect(
      cfg.YDB_DOCAPI_ENDPOINT,
      cfg.YDB_REGION,
      cfg.YC_ACCESS_KEY_ID,
      cfg.YC_SECRET_ACCESS_KEY,
      'DynamoDB_20120810.ListTables',
      payload
    );

    if (listRes?.TableNames && Array.isArray(listRes.TableNames)) {
      tableNames.push(...listRes.TableNames);
    }
    lastEvaluatedTableName = listRes?.LastEvaluatedTableName;
  } while (lastEvaluatedTableName);

  logger.info(`Discovered ${tableNames.length} tables in YDB database`, {
    event: 'BACKUP_TABLES_LISTED',
    meta: { tableCount: tableNames.length },
  });

  // 2. Scan every table
  const tablesDump: Record<string, any[]> = {};
  const tableCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const tableName of tableNames) {
    const items: any[] = [];
    let lastEvaluatedKey: any = undefined;

    do {
      const scanPayload: Record<string, any> = {
        TableName: tableName,
        Limit: 100,
      };
      if (lastEvaluatedKey) {
        scanPayload.ExclusiveStartKey = lastEvaluatedKey;
      }

      const scanRes = await callDocApiDirect(
        cfg.YDB_DOCAPI_ENDPOINT,
        cfg.YDB_REGION,
        cfg.YC_ACCESS_KEY_ID,
        cfg.YC_SECRET_ACCESS_KEY,
        'DynamoDB_20120810.Scan',
        scanPayload
      );

      if (scanRes?.Items && Array.isArray(scanRes.Items)) {
        for (const rawItem of scanRes.Items) {
          const itemObj: Record<string, any> = {};
          for (const [k, v] of Object.entries(rawItem)) {
            itemObj[k] = fromDynamo(v);
          }
          items.push(itemObj);
        }
      }

      lastEvaluatedKey = scanRes?.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    tablesDump[tableName] = items;
    tableCounts[tableName] = items.length;
    totalRecords += items.length;
  }

  // 3. Construct snapshot object
  const now = new Date();
  const createdAtIso = now.toISOString();

  const snapshot = {
    schemaVersion: 1,
    createdAt: createdAtIso,
    env,
    region: cfg.YDB_REGION,
    tableCount: tableNames.length,
    totalRecords,
    tableCounts,
    tables: tablesDump,
  };

  // 4. Compress with gzip
  const jsonBuf = Buffer.from(JSON.stringify(snapshot));
  const compressedGz = zlib.gzipSync(jsonBuf, { level: 9 });

  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const backupKey = `_backups/ydb/daily/backup-${yyyy}-${mm}-${dd}-${hh}${min}.json.gz`;

  // 5. Upload to S3 private bucket
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.S3_PRIVATE_BUCKET,
      Key: backupKey,
      Body: compressedGz,
      ContentType: 'application/gzip',
    })
  );

  logger.info('Daily backup uploaded to S3 private bucket', {
    event: 'BACKUP_UPLOADED',
    meta: {
      key: backupKey,
      sizeBytes: compressedGz.length,
      tables: tableNames.length,
      records: totalRecords,
    },
  });

  // 6. Safe 30-Day Retention Policy strictly under `_backups/ydb/daily/`
  let prunedCount = 0;
  try {
    let listContinuationToken: string | undefined = undefined;
    const dailyFiles: Array<{ key: string; lastModified: Date }> = [];

    do {
      const listRes: any = await s3.send(
        new ListObjectsV2Command({
          Bucket: cfg.S3_PRIVATE_BUCKET,
          Prefix: '_backups/ydb/daily/',
          ContinuationToken: listContinuationToken,
        })
      );

      if (listRes.Contents && Array.isArray(listRes.Contents)) {
        for (const item of listRes.Contents) {
          if (item.Key && item.Key.startsWith('_backups/ydb/daily/backup-')) {
            dailyFiles.push({
              key: item.Key,
              lastModified: item.LastModified ? new Date(item.LastModified) : new Date(0),
            });
          }
        }
      }

      listContinuationToken = listRes.NextContinuationToken;
    } while (listContinuationToken);

    // Sort chronologically ascending (oldest first)
    dailyFiles.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());

    if (dailyFiles.length > maxRetention) {
      const excessCount = dailyFiles.length - maxRetention;
      const filesToDelete = dailyFiles.slice(0, excessCount);

      for (const f of filesToDelete) {
        // Red line safety check: strictly starts with _backups/ydb/daily/
        if (!f.key.startsWith('_backups/ydb/daily/')) {
          continue;
        }
        await s3.send(
          new DeleteObjectCommand({
            Bucket: cfg.S3_PRIVATE_BUCKET,
            Key: f.key,
          })
        );
        prunedCount++;
        logger.info(`Pruned expired daily backup: ${f.key}`, {
          event: 'BACKUP_PRUNED',
          meta: { key: f.key },
        });
      }
    }
  } catch (pruneErr: any) {
    logger.warn('Non-fatal error during daily backup pruning', {
      event: 'BACKUP_PRUNE_WARN',
      meta: { error: pruneErr.message },
    });
  }

  const durationMs = Date.now() - startTime;
  return {
    ok: true,
    key: backupKey,
    tableCount: tableNames.length,
    totalRecords,
    sizeBytes: compressedGz.length,
    durationMs,
    prunedCount,
    createdAt: createdAtIso,
  };
}

export async function listBackups(): Promise<BackupItemInfo[]> {
  const cfg = getConfig();
  const s3 = getS3Client();
  const backups: BackupItemInfo[] = [];
  let continuationToken: string | undefined = undefined;

  do {
    const listRes: any = await s3.send(
      new ListObjectsV2Command({
        Bucket: cfg.S3_PRIVATE_BUCKET,
        Prefix: '_backups/ydb/',
        ContinuationToken: continuationToken,
      })
    );

    if (listRes.Contents && Array.isArray(listRes.Contents)) {
      for (const item of listRes.Contents) {
        if (!item.Key) continue;

        let folder: 'daily' | 'pre-cutover' | 'other' = 'other';
        if (item.Key.startsWith('_backups/ydb/daily/')) {
          folder = 'daily';
        } else if (item.Key.includes('pre-cutover')) {
          folder = 'pre-cutover';
        }

        backups.push({
          key: item.Key,
          folder,
          sizeBytes: item.Size || 0,
          lastModified: item.LastModified ? item.LastModified.toISOString() : undefined,
        });
      }
    }

    continuationToken = listRes.NextContinuationToken;
  } while (continuationToken);

  // Sort newest first
  backups.sort((a, b) => {
    const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
    const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
    return timeB - timeA;
  });

  return backups;
}
