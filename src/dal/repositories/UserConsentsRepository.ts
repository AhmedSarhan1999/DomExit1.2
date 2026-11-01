import { UserConsentRecord } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';

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
    return record;
  }

  static async getAll(): Promise<UserConsentRecord[]> {
    return DatabaseGateway.getAll<UserConsentRecord>(COLLECTION, []);
  }
}
