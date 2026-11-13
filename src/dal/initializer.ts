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
import { initYandexTables } from './scripts/initYandexTables';
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
      // 0. Auto-provision & seed Yandex Cloud YDB tables if Yandex provider is active
      const provider = import.meta.env.VITE_DATA_PROVIDER || 'yandex';
      if (provider === 'yandex') {
        await initYandexTables();
      }

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

      // 3. Clean up unapproved test developer 'dfdfv' from developers collection,
      // while guaranteeing its pending request in developer_accreditation_requests for owner testing
      try {
        const prodDevs = await DatabaseGateway.getAll<any>('developers', []);
        for (const d of prodDevs) {
          if (
            d.name?.toLowerCase().includes('dfdfv') ||
            d.inn === '7896512304' ||
            d.id?.includes('dfdfv')
          ) {
            await DatabaseGateway.remove('developers', d.id);
          }
        }

        const demoDevs = await DatabaseGateway.getAll<any>('demo_developers', []);
        for (const d of demoDevs) {
          if (
            d.name?.toLowerCase().includes('dfdfv') ||
            d.inn === '7896512304' ||
            d.id?.includes('dfdfv')
          ) {
            await DatabaseGateway.remove('demo_developers', d.id);
          }
        }

        // Clean local storage cache keys
        if (typeof localStorage !== 'undefined') {
          const cacheKeys = [
            'domexit_db_developers',
            'domexit_ydb_developers',
            'domexit_fb_developers',
            'domexit_db_demo_developers',
            'domexit_ydb_demo_developers',
            'domexit_fb_demo_developers',
          ];
          for (const k of cacheKeys) {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                  const filtered = list.filter(
                    (item: any) =>
                      !item.name?.toLowerCase().includes('dfdfv') &&
                      item.inn !== '7896512304' &&
                      !item.id?.includes('dfdfv')
                  );
                  localStorage.setItem(k, JSON.stringify(filtered));
                }
              } catch {}
            }
          }
        }

        // Guarantee pending request for dfdfv in developer_accreditation_requests
        const reqCollections = ['developer_accreditation_requests', 'demo_developer_accreditation_requests'];
        for (const col of reqCollections) {
          const reqs = await DatabaseGateway.getAll<any>(col, []);
          const existing = reqs.find(
            (r: any) =>
              r.developerName?.toLowerCase().includes('dfdfv') ||
              r.developerInn === '7896512304'
          );
          if (existing) {
            if (existing.status !== 'pending') {
              existing.status = 'pending';
              await DatabaseGateway.save(col, existing);
            }
          } else {
            await DatabaseGateway.save(col, {
              id: 'DEV-ACC-dfdfv-test',
              developerName: 'dfdfv',
              developerInn: '7896512304',
              lotId: 'lot-test-dfdfv',
              lotCode: 'U-10566',
              complexName: 'ЖК «Тестовый Проект»',
              city: 'spb',
              district: 'Приморский район',
              contractPriceRub: 12500000,
              sellerName: 'Иван Сергеевич Т.',
              sellerClientCode: 'DEX-784105',
              documentIds: [],
              status: 'pending',
              requestedAt: new Date().toISOString(),
              decisions: [],
            });
          }
        }
      } catch (cleanErr) {
        console.warn('[DatabaseInitializer] dfdfv cleanup notice:', cleanErr);
      }
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
