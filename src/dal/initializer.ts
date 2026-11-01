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
      // Warm up & ensure all canonical collections are hydrated via DatabaseGateway
      await Promise.all([
        DatabaseGateway.getAll('lots', initialLots),
        DatabaseGateway.getAll('deals', initialDeals),
        DatabaseGateway.getAll('buyer_applications', initialCandidates),
        DatabaseGateway.getAll('seller_requests', initialSellerRequests),
        DatabaseGateway.getAll('partner_applications', initialPartners),
        DatabaseGateway.getAll('employees', initialEmployees),
        DatabaseGateway.getAll('market_settings', [initialMarketSettings]),
        DatabaseGateway.getAll('bank_employees', initialBankEmployees),
      ]);
    } catch (err) {
      console.warn('[DatabaseInitializer] Non-fatal migration check:', err);
    }
  }

  static clearDemoData(): void {
    const keys = [
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
    window.location.reload();
  }
}
