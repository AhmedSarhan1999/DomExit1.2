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

    // Auto-seeding disabled per 152-FZ Anti-Seeding Directive.
    // Collections remain in zero-state until real lots/deals are approved by Owner.
    return;
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
