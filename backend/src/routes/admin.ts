import { HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json } from '../lib/http.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getS3Client } from '../lib/s3Client.js';
import { getConfig } from '../lib/config.js';
import { runYdbBackup, listBackups } from '../lib/backupService.js';
import { logger } from '../lib/logger.js';

export async function handleAdmin(
  event: YcHttpEvent,
  subPath: string
): Promise<YcHttpResponse> {
  const method = event.httpMethod.toUpperCase();
  const authUser = await getAuthenticatedUser(event);

  // Strict RBAC Gate for all /api/admin/* endpoints
  if (!authUser) {
    return json(event, 401, { error: 'Требуется авторизация' });
  }

  if (authUser.role !== 'owner') {
    return json(event, 403, { error: 'Доступ разрешен только владельцу платформы (owner)' });
  }

  const cfg = getConfig();
  const s3 = getS3Client();
  const ydb = getYdbClient();

  // 1. GET /api/admin/system-health
  if (subPath === '/system-health' && method === 'GET') {
    // 1a. Measure YDB live latency
    let ydbOk = false;
    let ydbLatencyMs = -1;
    try {
      const ydbStart = Date.now();
      await ydb.callApi('DynamoDB_20120810.ListTables', { Limit: 1 });
      ydbLatencyMs = Date.now() - ydbStart;
      ydbOk = true;
    } catch (ydbErr: any) {
      logger.error('System health check: YDB ping failed', {
        event: 'HEALTH_CHECK_YDB_FAIL',
        meta: { error: ydbErr.message },
      });
    }

    // 1b. Check S3 Buckets using ListObjectsV2Command (safe across all Yandex Cloud IAM roles)
    let publicBucketOk = false;
    let privateBucketOk = false;
    try {
      await s3.send(new ListObjectsV2Command({ Bucket: cfg.S3_PUBLIC_BUCKET, MaxKeys: 1 }));
      publicBucketOk = true;
    } catch (e: any) {
      logger.warn('System health check: public S3 check failed', { meta: { error: e.message } });
      publicBucketOk = false;
    }

    try {
      await s3.send(new ListObjectsV2Command({ Bucket: cfg.S3_PRIVATE_BUCKET, MaxKeys: 1 }));
      privateBucketOk = true;
    } catch (e: any) {
      logger.warn('System health check: private S3 check failed', { meta: { error: e.message } });
      privateBucketOk = false;
    }

    // 1c. Backups health
    const isStagingEnv = cfg.APP_ENV === 'staging';
    let backupsInfo = {
      latestDailyKey: null as string | null,
      latestDailyAt: null as string | null,
      latestDailySizeBytes: 0,
      ageHours: null as number | null,
      isHealthy: false,
      mode: isStagingEnv ? 'manual_staging' : 'automated_daily',
      totalDailyBackups: 0,
      totalPreCutoverBackups: 0,
    };

    try {
      const allBackups = await listBackups();
      const dailyBackups = allBackups.filter((b) => b.folder === 'daily');
      const preCutoverBackups = allBackups.filter((b) => b.folder === 'pre-cutover');

      backupsInfo.totalDailyBackups = dailyBackups.length;
      backupsInfo.totalPreCutoverBackups = preCutoverBackups.length;

      if (dailyBackups.length > 0) {
        const latest = dailyBackups[0];
        backupsInfo.latestDailyKey = latest.key;
        backupsInfo.latestDailyAt = latest.lastModified || null;
        backupsInfo.latestDailySizeBytes = latest.sizeBytes;

        if (latest.lastModified) {
          const ageHours = (Date.now() - new Date(latest.lastModified).getTime()) / (1000 * 60 * 60);
          backupsInfo.ageHours = Number(ageHours.toFixed(2));
          // Staging uses manual snapshot mode; Production enforces strict daily 26h threshold
          backupsInfo.isHealthy = isStagingEnv ? true : ageHours <= 26;
        }
      } else {
        backupsInfo.isHealthy = isStagingEnv;
      }
    } catch (bErr: any) {
      logger.warn('System health check: backup list error', {
        event: 'HEALTH_CHECK_BACKUP_WARN',
        meta: { error: bErr.message },
      });
    }

    // 1d. Today's journal event count
    const now = new Date();
    const yyyy = now.getUTCFullYear().toString();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const todayJournalPrefix = `_journal/${yyyy}/${mm}/${dd}/`;
    let todayEventCount = 0;

    try {
      const listJournalRes: any = await s3.send(
        new ListObjectsV2Command({
          Bucket: cfg.S3_PRIVATE_BUCKET,
          Prefix: todayJournalPrefix,
          MaxKeys: 1000,
        })
      );
      todayEventCount = listJournalRes.Contents?.length || 0;
    } catch {
      todayEventCount = 0;
    }

    // 1e. Runtime stats
    const mem = process.memoryUsage();
    const memoryRssMb = Number((mem.rss / (1024 * 1024)).toFixed(2));

    return json(event, 200, {
      status: ydbOk && privateBucketOk ? 'healthy' : 'degraded',
      timestamp: now.toISOString(),
      ydb: {
        ok: ydbOk,
        latencyMs: ydbLatencyMs,
        endpoint: cfg.YDB_DOCAPI_ENDPOINT,
      },
      storage: {
        publicBucket: cfg.S3_PUBLIC_BUCKET,
        publicBucketOk,
        privateBucket: cfg.S3_PRIVATE_BUCKET,
        privateBucketOk,
      },
      backups: backupsInfo,
      journal: {
        todayDateUtc: `${yyyy}-${mm}-${dd}`,
        todayEventCount,
      },
      runtime: {
        env: cfg.APP_ENV,
        region: cfg.YDB_REGION || 'ru-central1',
        nodeVersion: process.version,
        memoryRssMb,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  }

  // 2. GET /api/admin/backups
  if (subPath === '/backups' && method === 'GET') {
    try {
      const backups = await listBackups();
      return json(event, 200, {
        success: true,
        total: backups.length,
        backups,
      });
    } catch (err: any) {
      logger.error('Failed to list backups', {
        event: 'ADMIN_LIST_BACKUPS_ERROR',
        meta: { error: err.message },
      });
      return json(event, 500, { error: 'Не удалось получить список резервных копий' });
    }
  }

  // 3. POST /api/admin/backups/run or /backup-now
  if ((subPath === '/backups/run' || subPath === '/backup-now') && method === 'POST') {
    try {
      logger.info('Manual backup triggered by owner', {
        event: 'ADMIN_MANUAL_BACKUP_TRIGGERED',
        meta: { userId: authUser.id, email: authUser.email },
      });
      const result = await runYdbBackup({ env: cfg.APP_ENV });
      return json(event, 200, {
        success: true,
        ...result,
      });
    } catch (err: any) {
      logger.error('Manual backup execution failed', {
        event: 'ADMIN_MANUAL_BACKUP_FAIL',
        meta: { error: err.message },
      });
      return json(event, 500, {
        error: 'Ошибка при создании резервной копии',
        message: err.message,
      });
    }
  }

  return json(event, 404, { error: 'Административный маршрут не найден' });
}
