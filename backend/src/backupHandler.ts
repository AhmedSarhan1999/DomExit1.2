import dns from 'node:dns';
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import { runYdbBackup } from './lib/backupService.js';
import { logger } from './lib/logger.js';
import { getConfig } from './lib/config.js';

export async function handler(event?: any): Promise<any> {
  const startTime = Date.now();
  const cfg = getConfig();

  logger.info('Backup Serverless Trigger invoked', {
    event: 'BACKUP_TRIGGER_INVOKED',
    meta: {
      env: cfg.APP_ENV,
      triggerType: event?.messages?.[0]?.event_metadata?.event_type || 'manual/timer',
    },
  });

  try {
    const result = await runYdbBackup({ env: cfg.APP_ENV });

    logger.info('Backup Serverless Handler completed successfully', {
      event: 'BACKUP_TRIGGER_SUCCESS',
      durationMs: Date.now() - startTime,
      meta: {
        key: result.key,
        tableCount: result.tableCount,
        totalRecords: result.totalRecords,
        sizeBytes: result.sizeBytes,
        prunedCount: result.prunedCount,
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    logger.error('Backup Serverless Handler failed', {
      event: 'BACKUP_TRIGGER_ERROR',
      durationMs: Date.now() - startTime,
      meta: {
        error: err.message,
        stack: err.stack,
      },
    });

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
