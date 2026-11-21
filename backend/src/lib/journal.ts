import crypto from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './s3Client.js';
import { getConfig } from './config.js';
import { logger } from './logger.js';

export const JOURNALED_COLLECTIONS = new Set([
  'seller_requests',
  'buyer_applications',
  'deals',
  'lots',
  'partner_applications',
  'investor_applications',
  'user_consents',
  'documents_vault',
  'pep_signatures',
]);

export function isJournaledCollection(collection: string): boolean {
  return JOURNALED_COLLECTIONS.has(collection);
}

export interface JournalEventInput {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CASCADE_DELETE';
  collection: string;
  recordId: string;
  actor: {
    userId?: string;
    role?: string;
    email?: string;
  };
  payload?: Record<string, any>;
}

export async function recordJournalEvent(input: JournalEventInput): Promise<string | null> {
  if (!isJournaledCollection(input.collection)) {
    return null;
  }

  const cfg = getConfig();
  const now = new Date();
  const iso = now.toISOString();

  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');

  const timestampSegment = iso.replace(/[:-]/g, '').replace(/\.\d{3}/, (match) => match.slice(1));
  const rand6 = crypto.randomBytes(3).toString('hex');
  const safeRecordId = (input.recordId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const actionLower = input.action.toLowerCase();

  const key = `_journal/${yyyy}/${mm}/${dd}/${timestampSegment}-${rand6}-${input.collection}-${safeRecordId}-${actionLower}.json`;

  const journalEntry = {
    schemaVersion: 1,
    env: cfg.APP_ENV || 'staging',
    timestamp: iso,
    action: input.action,
    collection: input.collection,
    recordId: input.recordId,
    actor: {
      userId: input.actor.userId || 'anonymous',
      role: input.actor.role || 'guest',
    },
    payload: input.payload || {},
  };

  try {
    const s3 = getS3Client();
    const command = new PutObjectCommand({
      Bucket: cfg.S3_PRIVATE_BUCKET,
      Key: key,
      Body: JSON.stringify(journalEntry, null, 2),
      ContentType: 'application/json; charset=utf-8',
    });

    // Enforce 3-second strict fail-safe timeout
    await s3.send(command, { abortSignal: AbortSignal.timeout(3000) });

    logger.info('Journal event recorded', {
      event: 'JOURNAL_EVENT_SAVED',
      meta: {
        key,
        action: input.action,
        collection: input.collection,
        recordId: input.recordId,
      },
    });

    return key;
  } catch (err: any) {
    // Fail-safe: log warning but never block client
    logger.warn('Failed to write immutable journal entry (non-blocking)', {
      event: 'JOURNAL_EVENT_FAILED',
      meta: {
        error: err.message,
        key,
        collection: input.collection,
        recordId: input.recordId,
      },
    });
    return null;
  }
}
