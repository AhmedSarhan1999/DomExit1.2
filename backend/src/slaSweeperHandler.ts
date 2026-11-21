import dns from 'node:dns';
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import { runSlaSweep } from './lib/slaSweeperService.js';
import { logger } from './lib/logger.js';
import { getConfig } from './lib/config.js';

export async function handler(event?: any): Promise<any> {
  const startTime = Date.now();
  const cfg = getConfig();

  logger.info('SLA Sweeper Serverless Trigger invoked', {
    event: 'SLA_SWEEPER_TRIGGER_INVOKED',
    meta: {
      env: cfg.APP_ENV,
      triggerType: event?.messages?.[0]?.event_metadata?.event_type || 'timer',
    },
  });

  try {
    const result = await runSlaSweep({ env: cfg.APP_ENV });

    logger.info('SLA Sweeper Serverless Handler completed successfully', {
      event: 'SLA_SWEEPER_TRIGGER_SUCCESS',
      durationMs: Date.now() - startTime,
      meta: result,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    logger.error('SLA Sweeper Serverless Handler failed', {
      event: 'SLA_SWEEPER_TRIGGER_ERROR',
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
