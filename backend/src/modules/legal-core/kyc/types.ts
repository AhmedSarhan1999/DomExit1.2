/**
 * backend/src/modules/legal-core/kyc/types.ts
 *
 * Types for 1-Click Real KYC/KYB counterparty verification engine.
 * Supports API-Cloud.ru and Checko.ru with 30-day SHA-256 dedupe cache and S3 protocols.
 */

export type KycSubjectType = 'individual' | 'legal_entity';
export type KycProviderName = 'apicloud' | 'checko' | 'mock_sandbox';
export type KycRiskLevel = 'clean' | 'attention' | 'critical' | 'unavailable';

export interface RegistryCheckResult {
  status: KycRiskLevel;
  summaryRu: string;
  activeProceedingsCount?: number;
  totalDebtRub?: number;
  bankruptcyCasesCount?: number;
  casesCount?: number;
  details?: Record<string, any>;
}

export interface KycCheckDetails {
  fssp: RegistryCheckResult;
  fedresurs: RegistryCheckResult;
  kadArbitr: RegistryCheckResult;
  sudrf: RegistryCheckResult;
  fns: RegistryCheckResult;
  passportOrBlacklist?: RegistryCheckResult;
}

export interface KycInput {
  tenantId?: string;
  lotCode?: string;
  subjectType: KycSubjectType;
  fio?: string;
  birthDate?: string; // YYYY-MM-DD
  passportSeries?: string;
  passportNumber?: string;
  inn?: string;
  ogrn?: string;
  companyName?: string;
  regionCode?: string;
  forceRefresh?: boolean;
  provider?: KycProviderName;
}

export interface SuggestedRadarUpdates {
  fssp?: { status: 'clean' | 'attention' | 'critical'; notes: string };
  fedresurs?: { status: 'clean' | 'attention' | 'critical'; notes: string };
  kad_arbitr?: { status: 'clean' | 'attention' | 'critical'; notes: string };
  sudrf?: { status: 'clean' | 'attention' | 'critical'; notes: string };
}

export interface KycRecord {
  id: string;
  tenantId: string;
  lotCode?: string;
  subjectType: KycSubjectType;
  subjectHash: string;
  subjectLabelMasked: string;
  provider: KycProviderName;
  status: 'completed' | 'partial' | 'failed';
  overallRiskLevel: 'clean' | 'attention' | 'critical';
  checks: KycCheckDetails;
  protocolS3Key: string;
  estimatedCostRub: number;
  cached: boolean;
  cachedFromCheckId?: string;
  requestedBy: string;
  checkedAt: string;
  expiresAt: string;
  suggestedRadarUpdates?: SuggestedRadarUpdates;
}

export interface KycProviderAdapter {
  name: KycProviderName;
  isConfigured(): boolean;
  estimateCostRub(subjectType: KycSubjectType): number;
  runChecks(input: KycInput): Promise<{
    checks: KycCheckDetails;
    rawResponses: Record<string, any>;
    overallRiskLevel: 'clean' | 'attention' | 'critical';
    status: 'completed' | 'partial' | 'failed';
  }>;
}
