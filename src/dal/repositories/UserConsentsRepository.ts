import { UserConsentRecord } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { LegalRepository } from './LegalRepository';
import { PaginatedResult } from '../../services/apiClient';

const COLLECTION = 'user_consents';

export class UserConsentsRepository {
  static async recordConsent(params: {
    userId?: string;
    clientCode?: string;
    phone?: string;
    email?: string;
    ip?: string;
    formSource?: string;
    context?: string;
    consentItems?: {
      pdProcessing: boolean;
      termsAgreed: boolean;
      ads: boolean;
      distribution?: boolean;
    };
    consents?: {
      pdProcessing: boolean;
      termsAgreed: boolean;
      ads: boolean;
      distribution?: boolean;
    };
  }): Promise<UserConsentRecord> {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'NodeJS/SSR';
    // Realistic client-side captured pseudo-IP identifier or local origin
    const ipAddress = params.ip || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1');

    const items = params.consents || params.consentItems || {
      pdProcessing: true,
      termsAgreed: true,
      ads: false,
    };

    const record: UserConsentRecord = {
      id: `consent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      userId: params.userId,
      clientCode: params.clientCode,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      policyVersion: '2026-FZ152-v2.1',
      formSource: params.formSource || params.context || 'unknown_form',
      consentItems: items,
    };

    await DatabaseGateway.save<UserConsentRecord>(COLLECTION, record);

    // Synchronize to Enterprise Legal Audit Logs with SHA-256 snapshot hashes
    try {
      const rawCtx = (params.formSource || params.context || 'seller_submission').toLowerCase();
      const actionType = rawCtx.includes('book') 
        ? 'buyer_reservation' 
        : rawCtx.includes('auth') || rawCtx.includes('register') 
        ? 'registration' 
        : rawCtx.includes('cookie') 
        ? 'cookie_consent' 
        : 'seller_submission';

      await LegalRepository.logUserConsent({
        user_id: params.userId || params.clientCode,
        phone: params.phone,
        email: params.email,
        action_type: actionType,
        consented_documents: [
          { document_slug: 'terms', is_accepted: items.termsAgreed },
          { document_slug: 'privacy', is_accepted: items.pdProcessing },
          { document_slug: 'consent-pd', is_accepted: items.pdProcessing },
          { document_slug: 'consent-ads', is_accepted: !!items.ads },
        ],
        user_agent: userAgent,
        ip_masked: ipAddress,
      });
    } catch (auditErr) {
      console.warn('[UserConsentsRepository] LegalRepository logUserConsent audit sync notice:', auditErr);
    }

    return record;
  }

  static async getAll(): Promise<UserConsentRecord[]> {
    return DatabaseGateway.getAll<UserConsentRecord>(COLLECTION, []);
  }

  static async getPaginated(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<PaginatedResult<UserConsentRecord>> {
    return DatabaseGateway.getPaginated<UserConsentRecord>(COLLECTION, {
      ...params,
      limit: params.limit || 25,
    });
  }
}
