import { CompanyLegalProfile } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';

const COLLECTION = 'platform_settings';
const PROFILE_ID = 'company_legal_profile';

export const DEFAULT_COMPANY_LEGAL_PROFILE: CompanyLegalProfile = {
  id: PROFILE_ID,
  fullName: 'Общество с ограниченной ответственностью «ДОМЭКЗИТ»',
  shortName: 'ООО «ДОМЭКЗИТ» (DomExit LLC)',
  entityType: 'ООО',
  inn: '7814892015',
  kpp: '781401001',
  ogrn: '1267800045120',
  legalAddress: '197342, Россия, г. Санкт-Петербург, Ланское шоссе, д. 14, корп. 1, лит. А, пом. 12-Н',
  postalAddress: '197342, г. Санкт-Петербург, Ланское шоссе, д. 14, корп. 1',
  generalDirector: 'Абдаллах Ахмед Мохамед',
  dpoName: 'Абдаллах Ахмед Мохамед',
  privacyEmail: 'privacy@domexit.ru',
  officialPhone: '+7 (812) 900-00-00',
  bankName: 'Северо-Западный банк ПАО Сбербанк г. Санкт-Петербург',
  bik: '044030653',
  checkingAccount: '40702810955000012345',
  correspondentAccount: '30101810500000000653',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

export class CompanyProfileRepository {
  static async getProfile(): Promise<CompanyLegalProfile> {
    const existing = await DatabaseGateway.getById<CompanyLegalProfile>(COLLECTION, PROFILE_ID, [DEFAULT_COMPANY_LEGAL_PROFILE]);
    return existing || DEFAULT_COMPANY_LEGAL_PROFILE;
  }

  static async updateProfile(profile: Partial<CompanyLegalProfile>): Promise<CompanyLegalProfile> {
    const current = await this.getProfile();
    const updated: CompanyLegalProfile = {
      ...current,
      ...profile,
      id: PROFILE_ID,
      updatedAt: new Date().toISOString(),
    };
    await DatabaseGateway.save<CompanyLegalProfile>(COLLECTION, updated);
    return updated;
  }
}
