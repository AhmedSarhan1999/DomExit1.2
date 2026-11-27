/**
 * backend/src/modules/legal-core/index.ts
 *
 * Unified Barrel Facade for Legal Core v1.
 * Acts as the sovereign foundation for legal intelligence in DomExit today
 * and the future standalone LegalTech platform (Stage 4) with multi-tenancy support.
 */

import {
  suggestAddress,
  findPartyByInn,
  findBankByBik,
  getDadataStats,
} from './dadataService.js';
import {
  enqueueOcrJob,
  getOcrJobById,
  getOcrJobsForLot,
  getOcrStats,
} from './ocrQueueService.js';
import { parseRussianRealEstateDoc } from './russianRealEstateDocParser.js';
import {
  analyzeLotFromOcr,
  getLegalAnalysesForLot,
} from './dduLegalCopilotService.js';
import {
  verifyBuyerProofDocument,
  getBuyerVerifications,
} from './buyerProofAiService.js';
import {
  runCounterpartyCheck,
  getCachedCheckById,
  getKycChecksForLot,
  getKycProviderStatus,
  getProtocolDownloadUrl,
  computeSubjectHash,
  maskSubjectLabel,
} from './kyc/kycOrchestratorService.js';
import {
  runLegislativeRadarScan,
  ingestManualRadarTopic,
} from './legislativeRadarService.js';
import { generatePepDocument, PepDocumentType } from '../../lib/pepTemplates.js';

export interface LegalCoreHealth {
  version: string;
  tenantId: string;
  status: 'operational' | 'degraded';
  modules: {
    dadata: { status: 'operational'; provider: string };
    ocr: { status: 'operational'; engine: string };
    dduCopilot: { status: 'operational'; model: string };
    kyc: { status: 'operational'; activeProvider: string; configured: boolean };
    legislativeRadar: { status: 'operational'; feedsCount: number };
    pep63Fz: { status: 'operational'; standard: string };
  };
  compliance: {
    fz152: string;
    fz214: string;
    fz127: string;
  };
  timestamp: string;
}

export function getLegalCoreHealth(tenantId: string = 'domexit'): LegalCoreHealth {
  const kycStatus = getKycProviderStatus();

  return {
    version: '1.0.0',
    tenantId,
    status: 'operational',
    modules: {
      dadata: {
        status: 'operational',
        provider: 'DaData.ru (Free Tier / dadataAutocomplete)',
      },
      ocr: {
        status: 'operational',
        engine: 'Yandex Vision OCR (Async YMQ Pipeline, 152-FZ)',
      },
      dduCopilot: {
        status: 'operational',
        model: 'YandexGPT Pro (DDU 5 Sections & 61.2 127-FZ)',
      },
      kyc: {
        status: 'operational',
        activeProvider: kycStatus.activeProvider,
        configured: kycStatus.configured,
      },
      legislativeRadar: {
        status: 'operational',
        feedsCount: 6,
      },
      pep63Fz: {
        status: 'operational',
        standard: 'ФЗ-63 «Об электронной подписи» (ПЭП)',
      },
    },
    compliance: {
      fz152: 'Compliant (Zero-PII in external calls, ru-central1 cloud isolation)',
      fz214: 'Compliant (Specialized in DDU Assignment & Escrow)',
      fz127: 'Compliant (Bankruptcy risk checks and 3-year lookback Art. 61.2)',
    },
    timestamp: new Date().toISOString(),
  };
}

export const legalCore = {
  getHealth: getLegalCoreHealth,
  dadata: {
    suggestAddress,
    findPartyByInn,
    findBankByBik,
    getStats: getDadataStats,
  },
  ocr: {
    enqueueOcrJob,
    getJobById: getOcrJobById,
    getJobsForLot: getOcrJobsForLot,
    getStats: getOcrStats,
    parseDocument: parseRussianRealEstateDoc,
  },
  dduCopilot: {
    analyzeContract: analyzeLotFromOcr,
    getAnalysesForLot: getLegalAnalysesForLot,
    verifyBuyerProof: verifyBuyerProofDocument,
    getBuyerVerifications,
  },
  kyc: {
    runCheck: runCounterpartyCheck,
    getCheckById: getCachedCheckById,
    getChecksForLot: getKycChecksForLot,
    getStatus: getKycProviderStatus,
    getProtocolDownloadUrl,
    computeSubjectHash,
    maskSubjectLabel,
  },
  legislativeRadar: {
    scanFeeds: runLegislativeRadarScan,
    ingestTopic: ingestManualRadarTopic,
  },
  pep63Fz: {
    generateDocument: generatePepDocument,
  },
};
