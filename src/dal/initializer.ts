import { DatabaseGateway } from './DatabaseGateway';

/**
 * Live Database Provisioning & Cleanup Controller
 * Strictly uses DatabaseGateway (IDatabaseAdapter).
 */
export class DatabaseInitializer {
  private static isInitialized = false;

  static async initLiveDatabase(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {

      // 1. Clean up unapproved test developer 'dfdfv' from developers collection
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

        // Clean local storage cache keys
        if (typeof localStorage !== 'undefined') {
          const cacheKeys = [
            'domexit_db_developers',
            'domexit_ydb_developers',
            'domexit_fb_developers',
            'domexit_ydb_developer_accreditation_requests',
            'domexit_db_developer_accreditation_requests',
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
                      !item.developerName?.toLowerCase().includes('dfdfv') &&
                      item.inn !== '7896512304' &&
                      item.developerInn !== '7896512304' &&
                      !item.id?.includes('dfdfv')
                  );
                  localStorage.setItem(k, JSON.stringify(filtered));
                }
              } catch {}
            }
          }
        }

        // Clean any remaining mock requests from accreditation collections
        const reqs = await DatabaseGateway.getAll<any>('developer_accreditation_requests', []);
        for (const r of reqs) {
          if (
            r.id === 'DEV-ACC-dfdfv-test' ||
            r.developerName?.toLowerCase().includes('dfdfv') ||
            r.developerInn === '7896512304'
          ) {
            await DatabaseGateway.remove('developer_accreditation_requests', r.id);
          }
        }
      } catch (cleanErr) {
        console.warn('[DatabaseInitializer] cleanup notice:', cleanErr);
      }
    } catch (err) {
      console.warn('[DatabaseInitializer] Initialization error:', err);
    }
  }
}
