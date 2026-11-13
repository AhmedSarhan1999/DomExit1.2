import { DatabaseGateway } from './DatabaseGateway';
import {
  initialLots,
  initialDeals,
  initialCandidates,
  initialPartners,
  initialEmployees,
  initialMarketSettings,
  initialBankEmployees,
  initialSellerRequests,
} from './seedData';
import { migrateToSandbox } from './scripts/migrateToSandbox';
import { useEnvironmentStore } from '../stores/useEnvironmentStore';

/**
 * Live Database Auto-Seeder & Migration Controller
 * Strictly uses DatabaseGateway (IDatabaseAdapter) — zero direct Firestore imports outside Adapter!
 */
export class DatabaseInitializer {
  private static isInitialized = false;

  static async initLiveDatabase(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 1. Run dual-environment sandbox migration
      await migrateToSandbox();

      const isProd = useEnvironmentStore.getState().isProduction;

      // 2. Warm up collections: if in production, isolated collections pass [] so they remain empty!
      await Promise.all([
        DatabaseGateway.getAll('lots', isProd ? [] : initialLots),
        DatabaseGateway.getAll('deals', isProd ? [] : initialDeals),
        DatabaseGateway.getAll('buyer_applications', isProd ? [] : initialCandidates),
        DatabaseGateway.getAll('seller_requests', isProd ? [] : initialSellerRequests),
        DatabaseGateway.getAll('partner_applications', isProd ? [] : initialPartners),
        DatabaseGateway.getAll('employees', initialEmployees),
        DatabaseGateway.getAll('market_settings', [initialMarketSettings]),
        DatabaseGateway.getAll('bank_employees', isProd ? [] : initialBankEmployees),
      ]);
    } catch (err) {
      console.warn('[DatabaseInitializer] Non-fatal migration check:', err);
    }
  }

  static clearDemoData(): void {
    const keys = [
      'domexit_fb_demo_lots',
      'domexit_fb_demo_deals',
      'domexit_fb_demo_candidates',
      'domexit_fb_demo_buyer_applications',
      'domexit_fb_demo_seller_requests',
      'domexit_fb_demo_documents_vault',
      'domexit_fb_lots',
      'domexit_fb_deals',
      'domexit_fb_candidates',
      'domexit_fb_buyer_applications',
      'domexit_fb_seller_requests',
      'domexit_fb_partners',
      'domexit_fb_partner_applications',
      'domexit_fb_investor_applications',
      'domexit_fb_bank_credit_limits',
      'domexit_fb_documents_vault',
    ];
    keys.forEach((k) => localStorage.removeItem(k));
  }

  static resetToDemoData(): void {
    this.clearDemoData();
    localStorage.removeItem('domexit_sandbox_migrated_v1');
    localStorage.removeItem('domexit_sandbox_migrated_v2');
    window.location.reload();
  }
}
