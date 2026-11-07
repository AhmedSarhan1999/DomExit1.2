import {
  AccreditedDeveloper,
  DeveloperAccreditationRequest,
  DeveloperBankTerms,
  PartnerBankName,
  RussianCityCode,
  ResolvedBankFinancing,
  Lot,
  SpecialApprovalRequest,
} from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { LotsRepository } from './LotsRepository';
import { AuditLogsRepository } from './AuditLogsRepository';

const DEVELOPERS_COLLECTION = 'developers';
const ACCREDITATION_REQUESTS_COLLECTION = 'developer_accreditation_requests';

export const PARTNER_BANKS: PartnerBankName[] = ['Сбербанк', 'ВТБ', 'Альфа-Банк', 'ДОМ.РФ'];

export const RUSSIAN_TOP_DEVELOPERS: string[] = [
  'ПИК',
  'Самолёт',
  'ЛСР',
  'Setl Group',
  'ФСК',
  'Эталон',
  'А101',
  'Брусника',
  'Главстрой',
  'RBI',
  'КВС',
  'ГК Пионер',
  'MR Group',
  'Sminex',
  'Донстрой',
];

function buildDefaultBankTerms(
  sberRate = 19.8,
  vtbRate = 20.2,
  alfaRate = 20.9,
  domrfRate = 19.4,
  sberPdn: 40 | 50 | 60 = 50,
  vtbPdn: 40 | 50 | 60 = 60,
  alfaPdn: 40 | 50 | 60 = 50,
  domrfPdn: 40 | 50 | 60 = 50
): DeveloperBankTerms[] {
  return [
    {
      bankName: 'Сбербанк',
      isAccredited: true,
      baseRatePercent: sberRate,
      familyMortgage6: true,
      itMortgage6: true,
      maxPdnPercent: sberPdn,
      accreditedAt: '2026-01-15T10:00:00.000Z',
    },
    {
      bankName: 'ВТБ',
      isAccredited: true,
      baseRatePercent: vtbRate,
      familyMortgage6: true,
      itMortgage6: true,
      maxPdnPercent: vtbPdn,
      accreditedAt: '2026-01-15T10:00:00.000Z',
    },
    {
      bankName: 'Альфа-Банк',
      isAccredited: true,
      baseRatePercent: alfaRate,
      familyMortgage6: true,
      itMortgage6: false,
      maxPdnPercent: alfaPdn,
      accreditedAt: '2026-01-15T10:00:00.000Z',
    },
    {
      bankName: 'ДОМ.РФ',
      isAccredited: true,
      baseRatePercent: domrfRate,
      familyMortgage6: true,
      itMortgage6: true,
      maxPdnPercent: domrfPdn,
      accreditedAt: '2026-01-15T10:00:00.000Z',
    },
  ];
}

export const INITIAL_ACCREDITED_DEVELOPERS: AccreditedDeveloper[] = [
  {
    id: 'dev-pik',
    name: 'ПИК',
    inn: '7713011336',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.5, 19.9, 20.5, 19.2, 50, 60, 50, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-samolet',
    name: 'Самолёт',
    inn: '9731004688',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.6, 20.0, 20.6, 19.3, 50, 60, 50, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-lsr',
    name: 'ЛСР',
    inn: '7838001457',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.7, 20.1, 20.8, 19.4, 50, 50, 50, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-setl-group',
    name: 'Setl Group',
    inn: '7810245481',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.4, 19.8, 20.4, 19.1, 50, 60, 50, 60),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-fsk',
    name: 'ФСК',
    inn: '7704569102',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.9, 20.3, 21.0, 19.5, 50, 50, 50, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-etalon',
    name: 'Эталон',
    inn: '7814116230',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.8, 20.2, 20.7, 19.5, 50, 60, 50, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-a101',
    name: 'А101',
    inn: '7704810149',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.7, 20.1, 20.8, 19.4, 50, 60, 50, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-brusnika',
    name: 'Брусника',
    inn: '6671382990',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.6, 20.0, 20.6, 19.2, 50, 50, 50, 60),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-glavstroy',
    name: 'Главстрой',
    inn: '7839347260',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(20.0, 20.4, 21.1, 19.6, 50, 50, 40, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-rbi',
    name: 'RBI',
    inn: '7825431809',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.5, 19.9, 20.3, 19.2, 50, 60, 60, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-kvs',
    name: 'КВС',
    inn: '7802374518',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.9, 20.3, 20.9, 19.5, 50, 50, 50, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-pioneer',
    name: 'ГК Пионер',
    inn: '7701638294',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.8, 20.2, 20.7, 19.4, 50, 60, 50, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-mr-group',
    name: 'MR Group',
    inn: '7703512904',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.6, 20.0, 20.4, 19.3, 50, 60, 60, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-sminex',
    name: 'Sminex',
    inn: '7705789123',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.5, 19.8, 20.2, 19.1, 60, 60, 60, 50),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'dev-donstroy',
    name: 'Донстрой',
    inn: '7709298345',
    isAccredited: true,
    bankTerms: buildDefaultBankTerms(19.4, 19.7, 20.3, 19.0, 50, 60, 50, 60),
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
];

export const INITIAL_DEVELOPER_ACCREDITATION_REQUESTS: DeveloperAccreditationRequest[] = [
  {
    id: 'DEV-ACC-2026-01',
    developerName: 'СК «Северный Горизонт Девелопмент»',
    developerInn: '7813654902',
    lotId: 'lot-pending-acc-1',
    lotCode: 'U-10566',
    complexName: 'ЖК «Аквамарин Резиденс»',
    city: 'spb',
    district: 'Приморский район',
    contractPriceRub: 11850000,
    sellerName: 'Илья Сергеевич М.',
    sellerClientCode: 'DEX-512094',
    documentIds: ['SEED-DOC-DDU-10566', 'SEED-DOC-CERT-10566'],
    status: 'pending',
    requestedAt: '2026-10-29T11:20:00.000Z',
    decisions: [],
  },
];

import { normalizeDeveloperName } from '../../utils/formatters';
export { normalizeDeveloperName };

/**
 * Standardizes display format for developer selectors: [Name] (ИНН [INN])
 * Example: "Setl Group (ИНН 7810245481)"
 */
export function formatDeveloperOption(dev: { name: string; inn?: string }): string {
  if (!dev || !dev.name) return '';
  const cleanInn = dev.inn?.trim();
  return cleanInn ? `${dev.name} (ИНН ${cleanInn})` : dev.name;
}

/**
 * Robust deduplication and attribute merging for developers across all platforms.
 * Merges records by normalized name (Russian/Latin) or matching corporate INN.
 * Guarantees zero duplicate entries (e.g. Setl Group) while merging bank terms and preserving valid INNs.
 */
export function deduplicateDevelopers(rawList: AccreditedDeveloper[]): AccreditedDeveloper[] {
  if (!rawList || !Array.isArray(rawList)) return [];

  const mergedList: AccreditedDeveloper[] = [];

  for (const rawItem of rawList) {
    if (!rawItem || !rawItem.name) continue;

    const cleanName = rawItem.name.trim();
    const normName = normalizeDeveloperName(cleanName);
    const cleanInn = (rawItem.inn || '').trim().replace(/\D/g, '');
    const hasValidInn = cleanInn.length >= 10 && cleanInn !== '7700000000' && cleanInn !== '7800000000';

    // Find if an entry already exists in mergedList with same normalized name OR matching non-dummy INN
    const existingIndex = mergedList.findIndex((item) => {
      const itemNormName = normalizeDeveloperName(item.name || '');
      const itemCleanInn = (item.inn || '').trim().replace(/\D/g, '');
      const itemHasValidInn = itemCleanInn.length >= 10 && itemCleanInn !== '7700000000' && itemCleanInn !== '7800000000';

      // Match by normalized name
      if (normName && itemNormName && normName === itemNormName) {
        return true;
      }

      // Match by valid INN
      if (hasValidInn && itemHasValidInn && cleanInn === itemCleanInn) {
        return true;
      }

      return false;
    });

    if (existingIndex >= 0) {
      const existing = mergedList[existingIndex];

      // 1. Prefer valid INN
      const mergedInn = hasValidInn ? cleanInn : (existing.inn || cleanInn || '7700000000');

      // 2. Canonical name: prefer seed developer name if available, else cleanName
      const isRawSeed = INITIAL_ACCREDITED_DEVELOPERS.some((s) => s.id === rawItem.id);
      const isExistingSeed = INITIAL_ACCREDITED_DEVELOPERS.some((s) => s.id === existing.id);
      let mergedName = existing.name;
      if (isRawSeed && !isExistingSeed) {
        mergedName = rawItem.name;
      } else if (!isExistingSeed && cleanName.length > existing.name.length && !cleanName.includes('__')) {
        mergedName = cleanName;
      }

      // 3. Merge bank terms safely
      const bankTermsMap = new Map<string, DeveloperBankTerms>();
      for (const t of existing.bankTerms || []) {
        if (t?.bankName) bankTermsMap.set(t.bankName, { ...t });
      }
      for (const t of rawItem.bankTerms || []) {
        if (!t?.bankName) continue;
        const current = bankTermsMap.get(t.bankName);
        if (!current) {
          bankTermsMap.set(t.bankName, { ...t });
        } else {
          // If raw is accredited, prefer accredited
          if (t.isAccredited && !current.isAccredited) {
            bankTermsMap.set(t.bankName, { ...t });
          } else if (t.isAccredited === current.isAccredited) {
            const rawTime = t.accreditedAt ? new Date(t.accreditedAt).getTime() : 0;
            const curTime = current.accreditedAt ? new Date(current.accreditedAt).getTime() : 0;
            if (rawTime > curTime || (t.baseRatePercent && t.baseRatePercent < (current.baseRatePercent || 99))) {
              bankTermsMap.set(t.bankName, { ...current, ...t });
            }
          }
        }
      }
      const mergedBankTerms = Array.from(bankTermsMap.values());

      // 4. Combined accreditation status
      const mergedIsAccredited = existing.isAccredited || rawItem.isAccredited || mergedBankTerms.some((b) => b.isAccredited);

      // 5. Prefer seed ID or canonical ID
      const mergedId = isRawSeed ? rawItem.id : existing.id;

      mergedList[existingIndex] = {
        ...existing,
        ...rawItem,
        id: mergedId,
        name: mergedName,
        inn: mergedInn,
        isAccredited: mergedIsAccredited,
        bankTerms: mergedBankTerms,
        registered_via_project: existing.registered_via_project || rawItem.registered_via_project,
        registrationSource: existing.registrationSource || rawItem.registrationSource,
        registrationNote: existing.registrationNote || rawItem.registrationNote,
        updatedAt: new Date(Math.max(
          existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0,
          rawItem.updatedAt ? new Date(rawItem.updatedAt).getTime() : 0,
          Date.now()
        )).toISOString(),
      };
    } else {
      mergedList.push({
        ...rawItem,
        name: cleanName,
        inn: cleanInn || rawItem.inn || '7700000000',
        bankTerms: Array.isArray(rawItem.bankTerms) ? [...rawItem.bankTerms] : [],
      });
    }
  }

  // Ensure all institutional seed developers are present
  for (const seed of INITIAL_ACCREDITED_DEVELOPERS) {
    const seedNorm = normalizeDeveloperName(seed.name);
    const seedCleanInn = seed.inn.trim().replace(/\D/g, '');
    const alreadyIn = mergedList.some((m) => {
      const mNorm = normalizeDeveloperName(m.name);
      const mCleanInn = (m.inn || '').trim().replace(/\D/g, '');
      return mNorm === seedNorm || (seedCleanInn && mCleanInn === seedCleanInn);
    });
    if (!alreadyIn) {
      mergedList.push({ ...seed });
    }
  }

  // Sort alphabetically by Russian collation
  return mergedList.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

class DevelopersRepositoryController {
  async getAllDevelopers(): Promise<AccreditedDeveloper[]> {
    const raw = await DatabaseGateway.getAll<AccreditedDeveloper>(DEVELOPERS_COLLECTION, INITIAL_ACCREDITED_DEVELOPERS);
    return deduplicateDevelopers(raw);
  }

  async getAccreditedDevelopers(): Promise<AccreditedDeveloper[]> {
    const all = await this.getAllDevelopers();
    return all.filter((d) => d.isAccredited);
  }

  async findDeveloperByName(developerName: string): Promise<AccreditedDeveloper | null> {
    if (!developerName) return null;
    const norm = normalizeDeveloperName(developerName);
    const all = await this.getAllDevelopers();
    const found = all.find(
      (d) =>
        normalizeDeveloperName(d.name) === norm ||
        (d.inn && developerName.trim() === d.inn.trim()) ||
        d.id === developerName
    );
    if (found) return found;

    // Check seed fallback
    const seed = INITIAL_ACCREDITED_DEVELOPERS.find(
      (d) =>
        normalizeDeveloperName(d.name) === norm ||
        (d.inn && developerName.trim() === d.inn.trim()) ||
        d.id === developerName
    );
    return seed || null;
  }

  async isDeveloperAccredited(developerName: string): Promise<boolean> {
    if (!developerName) return false;
    const terms = await this.getBankTermsForDeveloper(developerName);
    return terms.length > 0;
  }

  async getBankTermsForDeveloper(developerName: string): Promise<DeveloperBankTerms[]> {
    if (!developerName) return [];
    const norm = normalizeDeveloperName(developerName);
    const all = await this.getAllDevelopers();

    // 1. Look in loaded developers (Firestore / cache)
    const dev = all.find(
      (d) =>
        normalizeDeveloperName(d.name) === norm ||
        (d.inn && developerName.trim() === d.inn.trim()) ||
        d.id === developerName
    );

    // 2. Look in seed accredited developers
    const seedDev = INITIAL_ACCREDITED_DEVELOPERS.find(
      (d) =>
        normalizeDeveloperName(d.name) === norm ||
        (d.inn && developerName.trim() === d.inn.trim()) ||
        d.id === developerName
    );

    // If dev found has active bankTerms, return them
    if (dev && dev.bankTerms && dev.bankTerms.length > 0) {
      const active = dev.bankTerms.filter((b) => b.isAccredited);
      if (active.length > 0) return active;
    }

    // Fallback to institutional seed terms for top developers
    if (seedDev && seedDev.bankTerms && seedDev.bankTerms.length > 0) {
      return seedDev.bankTerms.filter((b) => b.isAccredited);
    }

    return [];
  }

  /**
   * Dual-Source Bank Financing Resolver with Precedence Hierarchy (Rule 2 & Rule 3)
   * Merges:
   * 1. Institutional Developer Accreditation (Tab 2)
   * 2. Individual Project / Lot Financing Approvals (Tab 3)
   * Developer accreditation terms strictly override individual lot terms if bank appears in both.
   */
  async resolvePropertyFinancing(lot: Lot): Promise<ResolvedBankFinancing[]> {
    if (!lot) return [];

    // Source 1: Institutional Developer Accreditation terms
    const devTerms = await this.getBankTermsForDeveloper(lot.developer);

    // Source 2: Individual project / lot financing approvals
    const projectApprovals: Array<{
      bankName: string;
      approvedRatePercent: number;
      maxPdnPercent: 40 | 50 | 60;
      approvedAt?: string;
      decidedBy?: string;
      notes?: string;
    }> = [];

    // From lot.approvedFinancingBanks
    if (lot.approvedFinancingBanks && lot.approvedFinancingBanks.length > 0) {
      for (const b of lot.approvedFinancingBanks) {
        if (b?.bankName) {
          projectApprovals.push({
            bankName: b.bankName,
            approvedRatePercent: b.approvedRatePercent || 19.9,
            maxPdnPercent: (b.maxPdnPercent as 40 | 50 | 60) || 50,
            approvedAt: b.approvedAt,
            decidedBy: b.decidedBy,
            notes: b.notes,
          });
        }
      }
    }

    // From lot.approvedBankFinancing
    if (lot.approvedBankFinancing?.bankName) {
      const exists = projectApprovals.some((p) => p.bankName === lot.approvedBankFinancing?.bankName);
      if (!exists) {
        projectApprovals.push({
          bankName: lot.approvedBankFinancing.bankName,
          approvedRatePercent: lot.approvedBankFinancing.approvedRatePercent || 19.9,
          maxPdnPercent: (lot.approvedBankFinancing.maxPdnPercent as 40 | 50 | 60) || 50,
          approvedAt: lot.approvedBankFinancing.approvedAt,
          decidedBy: lot.approvedBankFinancing.decidedBy,
          notes: lot.approvedBankFinancing.notes,
        });
      }
    }

    // Also check bank_special_approvals collection for this lotCode with status === 'approved'
    try {
      const allSpecial = await DatabaseGateway.getAll<SpecialApprovalRequest>('bank_special_approvals', []);
      const lotSpecialApproved = (allSpecial || []).filter(
        (s) => s?.lotCode === lot.lotCode && s?.status === 'approved' && s?.bankName
      );
      for (const s of lotSpecialApproved) {
        const exists = projectApprovals.some((p) => p.bankName === s.bankName);
        if (!exists) {
          projectApprovals.push({
            bankName: s.bankName,
            approvedRatePercent: s.approvedRatePercent || 19.9,
            maxPdnPercent: (s.maxPdnPercent as 40 | 50 | 60) || 50,
            approvedAt: s.decidedAt,
            decidedBy: s.decidedBy,
            notes: s.decisionNotes,
          });
        }
      }
    } catch {
      // Safe fallback if collection is temporarily empty
    }

    // Rule 3: Precedence Hierarchy (Developer Terms Override Lot Terms)
    const resultMap = new Map<string, ResolvedBankFinancing>();

    // 1. Add individual project approvals
    for (const p of projectApprovals) {
      resultMap.set(p.bankName, {
        bankName: p.bankName,
        baseRatePercent: p.approvedRatePercent,
        maxPdnPercent: p.maxPdnPercent,
        familyMortgage6: true,
        itMortgage6: true,
        source: 'project',
        isAccredited: true,
        sourceLabel: 'Проектное финансирование объекта',
        accreditedAt: p.approvedAt,
        decidedBy: p.decidedBy,
      });
    }

    // 2. Overlay Developer Accreditation terms (strictly overrides project terms if bank is in both)
    for (const d of devTerms) {
      if (d?.bankName && d.isAccredited) {
        resultMap.set(d.bankName, {
          bankName: d.bankName,
          baseRatePercent: d.baseRatePercent,
          maxPdnPercent: d.maxPdnPercent || 50,
          familyMortgage6: !!d.familyMortgage6,
          itMortgage6: !!d.itMortgage6,
          source: 'developer',
          isAccredited: true,
          sourceLabel: 'Генеральная аккредитация девелопера',
          accreditedAt: d.accreditedAt,
          decidedBy: d.accreditedBy,
        });
      }
    }

    return Array.from(resultMap.values());
  }

  async isLotFinancingApproved(lot: Lot): Promise<boolean> {
    const list = await this.resolvePropertyFinancing(lot);
    return list.length > 0;
  }

  async getAllAccreditationRequests(): Promise<DeveloperAccreditationRequest[]> {
    return DatabaseGateway.getAll<DeveloperAccreditationRequest>(
      ACCREDITATION_REQUESTS_COLLECTION,
      INITIAL_DEVELOPER_ACCREDITATION_REQUESTS
    );
  }

  async createAccreditationRequest(params: {
    developerName: string;
    developerInn: string;
    lotId: string;
    lotCode: string;
    complexName: string;
    city: RussianCityCode;
    district: string;
    contractPriceRub: number;
    sellerName: string;
    sellerClientCode: string;
    documentIds: string[];
  }): Promise<DeveloperAccreditationRequest> {
    // Also ensure developer record exists in `developers` (with isAccredited = false if new)
    const existingDev = await this.findDeveloperByName(params.developerName);
    if (!existingDev) {
      const newDev: AccreditedDeveloper = {
        id: `dev-${Date.now()}`,
        name: params.developerName.trim(),
        inn: params.developerInn.trim() || '7700000000',
        isAccredited: false,
        bankTerms: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DatabaseGateway.save<AccreditedDeveloper>(DEVELOPERS_COLLECTION, newDev);
    }

    const request: DeveloperAccreditationRequest = {
      id: `DEV-ACC-${Date.now().toString().slice(-6)}`,
      developerName: params.developerName.trim(),
      developerInn: params.developerInn.trim() || '7700000000',
      lotId: params.lotId,
      lotCode: params.lotCode,
      complexName: params.complexName,
      city: params.city,
      district: params.district,
      contractPriceRub: params.contractPriceRub,
      sellerName: params.sellerName,
      sellerClientCode: params.sellerClientCode,
      documentIds: params.documentIds,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      decisions: [],
    };

    const saved = await DatabaseGateway.save<DeveloperAccreditationRequest>(
      ACCREDITATION_REQUESTS_COLLECTION,
      request
    );

    await AuditLogsRepository.addLog({
      lotCode: params.lotCode,
      operatorId: params.sellerClientCode,
      operatorName: params.sellerName,
      operatorRole: 'client',
      actionType: 'developer_accreditation_submitted',
      title: `Запрос аккредитации нового застройщика: ${params.developerName}`,
      description: `ИНН: ${params.developerInn} • Объект: ${params.complexName} (Лот ${params.lotCode}). Направлено в банки-партнёры.`,
    });

    return saved;
  }

  async decideAccreditationRequest(params: {
    requestId: string;
    bankName: PartnerBankName;
    decision: 'approved' | 'rejected';
    baseRatePercent?: number;
    familyMortgage6?: boolean;
    itMortgage6?: boolean;
    maxPdnPercent?: 40 | 50 | 60;
    notes?: string;
    decidedBy: string;
  }): Promise<DeveloperAccreditationRequest | null> {
    const req = await DatabaseGateway.getById<DeveloperAccreditationRequest>(
      ACCREDITATION_REQUESTS_COLLECTION,
      params.requestId,
      INITIAL_DEVELOPER_ACCREDITATION_REQUESTS
    );
    if (!req) return null;

    const now = new Date().toISOString();
    const filteredDecisions = (req.decisions || []).filter((d) => d.bankName !== params.bankName);
    const updatedDecisions = [
      ...filteredDecisions,
      {
        bankName: params.bankName,
        decision: params.decision,
        baseRatePercent: params.baseRatePercent ?? 19.9,
        familyMortgage6: params.familyMortgage6 ?? true,
        itMortgage6: params.itMortgage6 ?? true,
        maxPdnPercent: params.maxPdnPercent ?? 50,
        notes: params.notes,
        decidedBy: params.decidedBy,
        decidedAt: now,
      },
    ];

    const hasAnyApproved = updatedDecisions.some((d) => d.decision === 'approved');
    const updatedStatus: DeveloperAccreditationRequest['status'] = hasAnyApproved
      ? 'approved'
      : params.decision === 'rejected' && updatedDecisions.every((d) => d.decision === 'rejected')
      ? 'rejected'
      : 'pending';

    const updatedReq: DeveloperAccreditationRequest = {
      ...req,
      status: updatedStatus,
      decisions: updatedDecisions,
    };

    await DatabaseGateway.save<DeveloperAccreditationRequest>(ACCREDITATION_REQUESTS_COLLECTION, updatedReq);

    // Update or create developer record in `developers`
    let dev = await this.findDeveloperByName(req.developerName);
    if (!dev) {
      dev = {
        id: `dev-${Date.now()}`,
        name: req.developerName,
        inn: req.developerInn,
        isAccredited: false,
        bankTerms: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    const otherBankTerms = dev.bankTerms.filter((b) => b.bankName !== params.bankName);
    const updatedBankTerms: DeveloperBankTerms[] =
      params.decision === 'approved'
        ? [
            ...otherBankTerms,
            {
              bankName: params.bankName,
              isAccredited: true,
              baseRatePercent: params.baseRatePercent ?? 19.9,
              familyMortgage6: params.familyMortgage6 ?? true,
              itMortgage6: params.itMortgage6 ?? true,
              maxPdnPercent: params.maxPdnPercent ?? 50,
              accreditedAt: now,
              accreditedBy: params.decidedBy,
            },
          ]
        : otherBankTerms;

    const isNowAccredited = updatedBankTerms.some((b) => b.isAccredited);
    const updatedDev: AccreditedDeveloper = {
      ...dev,
      isAccredited: isNowAccredited,
      bankTerms: updatedBankTerms,
      updatedAt: now,
    };
    await DatabaseGateway.save<AccreditedDeveloper>(DEVELOPERS_COLLECTION, updatedDev);

    // Automatically promote all lots by this developer if accredited by at least 1 bank!
    const allLots = await LotsRepository.getAll();
    for (const lot of allLots) {
      if (
        normalizeDeveloperName(lot.developer) === normalizeDeveloperName(req.developerName) ||
        lot.lotCode === req.lotCode
      ) {
        if (isNowAccredited) {
          const cleanTags = (lot.tags || []).filter((t) => t !== 'Ожидает аккредитации банков');
          if (!cleanTags.includes(`Аккредитован: ${params.bankName}`)) {
            cleanTags.push(`Аккредитован: ${params.bankName}`);
          }
          await LotsRepository.save({
            ...lot,
            developerAccreditationStatus: 'accredited',
            tags: cleanTags,
          });
        } else if (updatedStatus === 'rejected') {
          await LotsRepository.save({
            ...lot,
            developerAccreditationStatus: 'rejected',
          });
        }
      }
    }

    await AuditLogsRepository.addLog({
      lotCode: req.lotCode,
      operatorId: params.bankName,
      operatorName: params.decidedBy,
      operatorRole: 'bank_officer',
      actionType: 'developer_accreditation_decided',
      title:
        params.decision === 'approved'
          ? `Банк ${params.bankName} аккредитовал застройщика «${req.developerName}»`
          : `Банк ${params.bankName} отклонил аккредитацию застройщика «${req.developerName}»`,
      description:
        params.decision === 'approved'
          ? `Базовая ставка: ${params.baseRatePercent ?? 19.9}%, Семейная 6%: ${
              params.familyMortgage6 ? 'Да' : 'Нет'
            }, IT 6%: ${params.itMortgage6 ? 'Да' : 'Нет'}, Лимит ПДН: ${params.maxPdnPercent ?? 50}%. Застройщик добавлен в единый реестр.`
          : `Причина/комментарий: ${params.notes || 'Не соответствует критериям проектного финансирования'}`,
    });

    return updatedReq;
  }

  async accreditDeveloperForBank(params: {
    developerId?: string;
    developerName: string;
    developerInn?: string;
    bankName: PartnerBankName;
    baseRatePercent: number;
    familyMortgage6: boolean;
    itMortgage6: boolean;
    maxPdnPercent: 40 | 50 | 60;
    officerName: string;
  }): Promise<AccreditedDeveloper> {
    const all = await this.getAllDevelopers();
    let dev = params.developerId
      ? all.find((d) => d.id === params.developerId)
      : await this.findDeveloperByName(params.developerName);

    const now = new Date().toISOString();
    const newTerms: DeveloperBankTerms = {
      bankName: params.bankName,
      isAccredited: true,
      baseRatePercent: params.baseRatePercent,
      familyMortgage6: params.familyMortgage6,
      itMortgage6: params.itMortgage6,
      maxPdnPercent: params.maxPdnPercent,
      accreditedAt: now,
      accreditedBy: params.officerName,
    };

    if (!dev) {
      dev = {
        id: `dev-${Date.now()}`,
        name: params.developerName.trim(),
        inn: params.developerInn?.trim() || '7700000000',
        isAccredited: true,
        bankTerms: [newTerms],
        createdAt: now,
        updatedAt: now,
      };
    } else {
      const otherTerms = dev.bankTerms.filter((b) => b.bankName !== params.bankName);
      dev = {
        ...dev,
        isAccredited: true,
        bankTerms: [...otherTerms, newTerms],
        updatedAt: now,
      };
    }

    await DatabaseGateway.save<AccreditedDeveloper>(DEVELOPERS_COLLECTION, dev);

    // Synchronize lots
    const allLots = await LotsRepository.getAll();
    for (const lot of allLots) {
      if (normalizeDeveloperName(lot.developer) === normalizeDeveloperName(dev.name)) {
        const cleanTags = (lot.tags || []).filter((t) => t !== 'Ожидает аккредитации банков');
        if (!cleanTags.includes(`Аккредитован: ${params.bankName}`)) {
          cleanTags.push(`Аккредитован: ${params.bankName}`);
        }
        await LotsRepository.save({
          ...lot,
          developerAccreditationStatus: 'accredited',
          tags: cleanTags,
        });
      }
    }

    await AuditLogsRepository.addLog({
      operatorName: params.officerName,
      operatorRole: 'bank_officer',
      actionType: 'developer_accreditation_decided',
      title: `Банк ${params.bankName} включил «${dev.name}» в реестр аккредитованных застройщиков`,
      description: `Ставка: ${params.baseRatePercent}%, ПДН: ${params.maxPdnPercent}%, Семейная 6%: ${
        params.familyMortgage6 ? 'Да' : 'Нет'
      }.`,
    });

    return dev;
  }

  async removeDeveloperAccreditation(
    developerId: string,
    bankName: PartnerBankName,
    officerName: string
  ): Promise<AccreditedDeveloper | null> {
    const all = await this.getAllDevelopers();
    const dev = all.find((d) => d.id === developerId);
    if (!dev) return null;

    const updatedBankTerms = dev.bankTerms.filter((b) => b.bankName !== bankName);
    const hasRemainingAccreditation = updatedBankTerms.some((b) => b.isAccredited);

    const updatedDev: AccreditedDeveloper = {
      ...dev,
      bankTerms: updatedBankTerms,
      isAccredited: hasRemainingAccreditation,
      updatedAt: new Date().toISOString(),
    };

    await DatabaseGateway.save<AccreditedDeveloper>(DEVELOPERS_COLLECTION, updatedDev);

    // Update lots tags
    const allLots = await LotsRepository.getAll();
    for (const lot of allLots) {
      if (normalizeDeveloperName(lot.developer) === normalizeDeveloperName(dev.name)) {
        const cleanTags = (lot.tags || []).filter((t) => t !== `Аккредитован: ${bankName}`);
        if (!hasRemainingAccreditation) {
          cleanTags.push('Ожидает аккредитации банков');
        }
        await LotsRepository.save({
          ...lot,
          developerAccreditationStatus: hasRemainingAccreditation
            ? 'accredited'
            : 'pending_bank_accreditation',
          tags: cleanTags,
        });
      }
    }

    await AuditLogsRepository.addLog({
      operatorName: officerName,
      operatorRole: 'bank_officer',
      actionType: 'developer_accreditation_decided',
      title: `Банк ${bankName} отозвал аккредитацию застройщика «${dev.name}»`,
      description: `Застройщик исключен из реестра банка ${bankName}.`,
    });

    return updatedDev;
  }

  async getCompetitiveTermsSummary(
    developerName: string,
    currentBank?: PartnerBankName
  ): Promise<{
    minRate: number | null;
    lowestBank: string | null;
    avgRate: number | null;
    maxPdn: number | null;
    otherOffersCount: number;
    hasFamilyMortgage: boolean;
    hasItMortgage: boolean;
  }> {
    const dev = await this.findDeveloperByName(developerName);
    if (!dev || !dev.bankTerms) {
      return {
        minRate: null,
        lowestBank: null,
        avgRate: null,
        maxPdn: null,
        otherOffersCount: 0,
        hasFamilyMortgage: false,
        hasItMortgage: false,
      };
    }

    const otherTerms = dev.bankTerms.filter(
      (b) => b.isAccredited && (!currentBank || b.bankName !== currentBank)
    );

    if (otherTerms.length === 0) {
      return {
        minRate: null,
        lowestBank: null,
        avgRate: null,
        maxPdn: null,
        otherOffersCount: 0,
        hasFamilyMortgage: false,
        hasItMortgage: false,
      };
    }

    let minRate = otherTerms[0].baseRatePercent;
    let lowestBank = otherTerms[0].bankName;
    let totalRate = 0;
    let maxPdn = otherTerms[0].maxPdnPercent;

    for (const t of otherTerms) {
      if (t.baseRatePercent < minRate) {
        minRate = t.baseRatePercent;
        lowestBank = t.bankName;
      }
      if (t.maxPdnPercent > maxPdn) {
        maxPdn = t.maxPdnPercent;
      }
      totalRate += t.baseRatePercent;
    }

    return {
      minRate,
      lowestBank,
      avgRate: Number((totalRate / otherTerms.length).toFixed(1)),
      maxPdn,
      otherOffersCount: otherTerms.length,
      hasFamilyMortgage: otherTerms.some((b) => b.familyMortgage6),
      hasItMortgage: otherTerms.some((b) => b.itMortgage6),
    };
  }

  async registerDeveloperFromProject(params: {
    name: string;
    inn: string;
    lotCode?: string;
    bankName?: string;
    ratePercent?: number;
    pdnPercent?: 40 | 50 | 60;
    registrationSource?: 'institutional' | 'project_approval' | 'seed' | 'seller_submission';
    registrationNote?: string;
  }): Promise<AccreditedDeveloper> {
    const existing = await this.findDeveloperByName(params.name);
    const now = new Date().toISOString();
    if (existing) {
      let modified = false;
      const cleanInn = params.inn?.trim();
      if (cleanInn && cleanInn !== '7700000000' && cleanInn !== '7800000000' && (!existing.inn || existing.inn === '7700000000' || existing.inn === '7800000000')) {
        existing.inn = cleanInn;
        modified = true;
      }
      if (!existing.registered_via_project && !existing.isAccredited) {
        existing.registered_via_project = true;
        modified = true;
      }
      if (modified) {
        existing.updatedAt = now;
        await DatabaseGateway.save<AccreditedDeveloper>(DEVELOPERS_COLLECTION, existing);
      }
      return existing;
    }

    const norm = normalizeDeveloperName(params.name);
    const newDev: AccreditedDeveloper = {
      id: `dev-project-${norm.replace(/[^a-z0-9]/gi, '').toLowerCase() || Date.now()}`,
      name: params.name.trim(),
      inn: params.inn?.trim() || '7814892011',
      isAccredited: false, // NOT yet institutionally accredited across all projects in Tab 2
      registered_via_project: true,
      registrationSource: params.registrationSource || 'project_approval',
      registrationNote: params.registrationNote || `Зарегистрирован через индивидуальное одобрение проекта${
        params.lotCode ? ` (Лот #${params.lotCode})` : ''
      }${params.bankName ? ` банком ${params.bankName}` : ''}`,
      bankTerms: [],
      createdAt: now,
      updatedAt: now,
    };

    await DatabaseGateway.save<AccreditedDeveloper>(DEVELOPERS_COLLECTION, newDev);
    return newDev;
  }
}

export const DevelopersRepository = new DevelopersRepositoryController();
