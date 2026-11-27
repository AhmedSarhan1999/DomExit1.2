/**
 * backend/src/modules/legal-core/kyc/kycOrchestratorService.ts
 *
 * Orchestrator service for 1-Click Real KYC/KYB counterparty verification engine.
 * - 30-Day SHA-256 Dedupe Cache (0 ₽ on cached reads).
 * - S3 Protocol storage in S3_PRIVATE_BUCKET/_kyc_protocols/{tenantId}/{lotCode || 'general'}/{id}.json.
 * - Saves structured summary to kyc_checks_v2 with GSIs.
 * - Daily quota cap (default: 30 on Staging, configurable via DAILY_KYC_CHECKS_CAP).
 * - Human-in-the-Loop suggested radar updates (never blindly auto-committed).
 * - Graceful fallback when unconfigured without 500 error.
 */

import crypto from 'node:crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getYdbClient } from '../../../lib/ydbClient.js';
import { getS3Client } from '../../../lib/s3Client.js';
import { getConfig } from '../../../lib/config.js';
import { logger } from '../../../lib/logger.js';
import { appCache } from '../../../lib/cache.js';

import {
  KycInput,
  KycRecord,
  KycProviderAdapter,
  KycProviderName,
  SuggestedRadarUpdates,
} from './types.js';
import { ApiCloudAdapter } from './apiCloudAdapter.js';
import { CheckoAdapter } from './checkoAdapter.js';
import { MockSandboxAdapter } from './mockSandboxAdapter.js';

const apiCloud = new ApiCloudAdapter();
const checko = new CheckoAdapter();
const mockSandbox = new MockSandboxAdapter();

export function computeSubjectHash(input: KycInput): string {
  const normInn = (input.inn || '').trim().replace(/\D/g, '');
  if (normInn) {
    return crypto.createHash('sha256').update(`inn:${normInn}`).digest('hex');
  }

  const normFio = (input.fio || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normDob = (input.birthDate || '').trim();
  const normPassport = `${(input.passportSeries || '').replace(/\D/g, '')}:${(input.passportNumber || '').replace(/\D/g, '')}`;

  const payload = `fio:${normFio}|dob:${normDob}|pass:${normPassport}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function maskSubjectLabel(input: KycInput): string {
  if (input.subjectType === 'legal_entity' || (input.companyName && !input.fio)) {
    const name = input.companyName || 'Организация';
    const inn = input.inn ? `ИНН ****${input.inn.slice(-4)}` : '';
    return `${name} ${inn}`.trim();
  }

  const fioParts = (input.fio || '').trim().split(/\s+/);
  let shortFio = input.fio || 'Физическое лицо';
  if (fioParts.length >= 2) {
    const last = fioParts[0];
    const firstInit = fioParts[1]?.[0] ? `${fioParts[1][0]}.` : '';
    const midInit = fioParts[2]?.[0] ? `${fioParts[2][0]}.` : '';
    shortFio = `${last} ${firstInit} ${midInit}`.trim();
  }

  const innMasked = input.inn ? `ИНН ****${input.inn.slice(-4)}` : '';
  const passMasked = input.passportNumber ? `паспорт ****${input.passportNumber.slice(-4)}` : '';
  const idMask = innMasked || passMasked;
  return idMask ? `${shortFio} (${idMask})` : shortFio;
}

export function getActiveAdapter(requestedProvider?: KycProviderName): KycProviderAdapter {
  if (requestedProvider === 'mock_sandbox' && process.env.NODE_ENV !== 'production') {
    return mockSandbox;
  }
  const configuredProvider = process.env.KYC_PROVIDER || 'apicloud';
  if (configuredProvider === 'checko' && checko.isConfigured()) {
    return checko;
  }
  if (apiCloud.isConfigured()) {
    return apiCloud;
  }
  if (checko.isConfigured()) {
    return checko;
  }
  // Fallback to mockSandbox only in non-production if explicitly allowed or testing
  if (process.env.NODE_ENV !== 'production' && requestedProvider === 'mock_sandbox') {
    return mockSandbox;
  }
  return apiCloud; // default adapter instance even if unconfigured (for isConfigured check)
}

export function getKycProviderStatus(): {
  configured: boolean;
  activeProvider: KycProviderName;
  estimatedCostRub: number;
  dailyCap: number;
  dailyUsed: number;
} {
  const active = getActiveAdapter();
  const configured = active.isConfigured();
  const dailyCap = parseInt(process.env.DAILY_KYC_CHECKS_CAP || '30', 10);
  const todayKey = `kyc_daily_count_${new Date().toISOString().slice(0, 10)}`;
  const dailyUsed = (appCache.get<number>(todayKey) || 0);

  return {
    configured,
    activeProvider: active.name,
    estimatedCostRub: active.estimateCostRub('individual'),
    dailyCap,
    dailyUsed,
  };
}

export async function runCounterpartyCheck(
  input: KycInput,
  requestedBy: string
): Promise<{ ok: boolean; record?: KycRecord; hintRu?: string; configured?: boolean; provider?: string }> {
  const tenantId = input.tenantId || 'domexit';
  const subjectHash = computeSubjectHash(input);
  const labelMasked = maskSubjectLabel(input);
  const ydb = getYdbClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Check 30-Day Dedupe Cache
  if (!input.forceRefresh) {
    try {
      const cachedList = ydb.isV2TablesEnabled()
        ? await ydb.queryAllByIndex<KycRecord>({
            tableName: 'kyc_checks',
            indexName: 'subjectHash-checkedAt-index',
            hashKey: 'subjectHash',
            hashValue: subjectHash,
            limit: 10,
          })
        : await ydb.findByField<KycRecord>('kyc_checks', 'subjectHash', subjectHash, 10);

      // Find non-expired completed check
      const validCached = cachedList
        .filter((r) => r.status === 'completed' && new Date(r.expiresAt).getTime() > now.getTime())
        .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];

      if (validCached) {
        logger.info('Returning 30-day cached KYC check result (0 ₽ cost)', {
          meta: { subjectHash, cachedFromCheckId: validCached.id },
        });

        const cachedRecord: KycRecord = {
          ...validCached,
          cached: true,
          cachedFromCheckId: validCached.id,
          estimatedCostRub: 0,
        };
        return { ok: true, record: cachedRecord };
      }
    } catch (err: any) {
      logger.warn('Error reading KYC cache, continuing with fresh check', { meta: { error: err.message } });
    }
  }

  // 2. Resolve provider adapter & check configuration
  const adapter = getActiveAdapter(input.provider);
  if (!adapter.isConfigured()) {
    return {
      ok: false,
      configured: false,
      provider: adapter.name,
      hintRu:
        'Провайдер госпроверок не настроен (отсутствует KYC_PROVIDER_API_KEY). Ручной аудит по 6 реестрам доступен без ограничений.',
    };
  }

  // 3. Enforce Daily Quota Cap
  const dailyCap = parseInt(process.env.DAILY_KYC_CHECKS_CAP || '30', 10);
  const todayKey = `kyc_daily_count_${nowIso.slice(0, 10)}`;
  const currentCount = appCache.get<number>(todayKey) || 0;
  if (currentCount >= dailyCap && adapter.name !== 'mock_sandbox') {
    return {
      ok: false,
      configured: true,
      provider: adapter.name,
      hintRu: `Достигнут дневной лимит автопроверок на Staging (${dailyCap} проверок в день). Используйте ручной аудит или обратитесь к администратору.`,
    };
  }

  // 4. Run Registry Checks
  const checkResult = await adapter.runChecks(input);
  const estimatedCost = input.forceRefresh && adapter.name === 'mock_sandbox' ? 0 : adapter.estimateCostRub(input.subjectType);

  // Increment daily counter
  appCache.set(todayKey, currentCount + 1, 86400);

  // 5. Generate Protocol S3 Key and Upload full protocol JSON
  const checkId = `kyc_${now.getTime()}_${crypto.randomBytes(4).toString('hex')}`;
  const protocolS3Key = `_kyc_protocols/${tenantId}/${input.lotCode || 'general'}/${checkId}.json`;

  const protocolData = {
    protocolId: checkId,
    tenantId,
    lotCode: input.lotCode || null,
    subjectType: input.subjectType,
    subjectHash,
    subjectLabelMasked: labelMasked,
    provider: adapter.name,
    overallRiskLevel: checkResult.overallRiskLevel,
    checks: checkResult.checks,
    rawResponses: checkResult.rawResponses,
    checkedAt: nowIso,
    checkedBy: requestedBy,
    legalBasis: '152-ФЗ, 214-ФЗ, 127-ФЗ',
    contentSha256: crypto.createHash('sha256').update(JSON.stringify(checkResult.checks)).digest('hex'),
  };

  try {
    const cfg = getConfig();
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: cfg.S3_PRIVATE_BUCKET,
        Key: protocolS3Key,
        Body: Buffer.from(JSON.stringify(protocolData, null, 2), 'utf-8'),
        ContentType: 'application/json',
      })
    );
  } catch (s3Err: any) {
    logger.warn('Failed to upload KYC protocol to S3 (non-fatal)', { meta: { error: s3Err.message } });
  }

  // 6. Build Suggested Radar Updates (Human-in-the-loop)
  const suggestedRadarUpdates: SuggestedRadarUpdates = {
    fssp: {
      status: checkResult.checks.fssp.status === 'clean' ? 'clean' : checkResult.checks.fssp.status === 'critical' ? 'critical' : 'attention',
      notes: checkResult.checks.fssp.summaryRu,
    },
    fedresurs: {
      status: checkResult.checks.fedresurs.status === 'clean' ? 'clean' : checkResult.checks.fedresurs.status === 'critical' ? 'critical' : 'attention',
      notes: checkResult.checks.fedresurs.summaryRu,
    },
    kad_arbitr: {
      status: checkResult.checks.kadArbitr.status === 'clean' ? 'clean' : checkResult.checks.kadArbitr.status === 'critical' ? 'critical' : 'attention',
      notes: checkResult.checks.kadArbitr.summaryRu,
    },
    sudrf: {
      status: checkResult.checks.sudrf.status === 'clean' ? 'clean' : checkResult.checks.sudrf.status === 'critical' ? 'critical' : 'attention',
      notes: checkResult.checks.sudrf.summaryRu,
    },
  };

  const expiresDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const record: KycRecord = {
    id: checkId,
    tenantId,
    lotCode: input.lotCode,
    subjectType: input.subjectType,
    subjectHash,
    subjectLabelMasked: labelMasked,
    provider: adapter.name,
    status: checkResult.status,
    overallRiskLevel: checkResult.overallRiskLevel,
    checks: checkResult.checks,
    protocolS3Key,
    estimatedCostRub: estimatedCost,
    cached: false,
    requestedBy,
    checkedAt: nowIso,
    expiresAt: expiresDate.toISOString(),
    suggestedRadarUpdates,
  };

  // 7. Save to YDB kyc_checks_v2 and audit_logs_v2
  try {
    await ydb.putItem('kyc_checks', record);
    await ydb.putItem('audit_logs', {
      id: `audit_kyc_${checkId}`,
      partitionKey: 'AUDIT',
      actorId: requestedBy,
      targetId: input.lotCode || checkId,
      action: 'KYC_CHECK_PERFORMED',
      details: {
        checkId,
        provider: adapter.name,
        overallRiskLevel: checkResult.overallRiskLevel,
        subjectHash,
        subjectLabelMasked: labelMasked,
        estimatedCostRub: estimatedCost,
      },
      timestamp: nowIso,
    });
  } catch (ydbErr: any) {
    logger.error('Failed to save KYC check to YDB', { meta: { error: ydbErr.message } });
  }

  return { ok: true, record };
}

export async function getCachedCheckById(id: string): Promise<KycRecord | null> {
  const ydb = getYdbClient();
  try {
    return await ydb.getItem<KycRecord>('kyc_checks', id);
  } catch {
    return null;
  }
}

export async function getKycChecksForLot(lotCode: string): Promise<KycRecord[]> {
  const ydb = getYdbClient();
  try {
    if (ydb.isV2TablesEnabled()) {
      return await ydb.queryAllByIndex<KycRecord>({
        tableName: 'kyc_checks',
        indexName: 'lotCode-checkedAt-index',
        hashKey: 'lotCode',
        hashValue: lotCode,
        limit: 20,
      });
    }
    return await ydb.findByField<KycRecord>('kyc_checks', 'lotCode', lotCode, 20);
  } catch (err: any) {
    logger.warn('Failed to load KYC checks for lot', { meta: { lotCode, error: err.message } });
    return [];
  }
}

export async function getProtocolDownloadUrl(protocolS3Key: string): Promise<string | null> {
  try {
    const cfg = getConfig();
    const s3 = getS3Client();
    const command = new GetObjectCommand({
      Bucket: cfg.S3_PRIVATE_BUCKET,
      Key: protocolS3Key,
    });
    return await getSignedUrl(s3 as any, command as any, { expiresIn: 3600 });
  } catch (err: any) {
    logger.warn('Failed to generate protocol signed URL', { meta: { protocolS3Key, error: err.message } });
    return null;
  }
}
