import { KPIStats } from '../../types';
import { platformKPIs } from '../seedData';

export class AnalyticsRepository {
  static async getKPIs(): Promise<KPIStats> {
    return { ...platformKPIs };
  }
}
