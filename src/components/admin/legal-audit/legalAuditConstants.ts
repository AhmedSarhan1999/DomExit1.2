import { LegalAuditCheckpoint } from '../../../types';

export function createInitialCheckpoints(): LegalAuditCheckpoint[] {
  return [
    {
      id: 'efrsb',
      title: '1. Реестр сведений о банкротстве (ЕФРСБ / Федресурс 127-ФЗ)',
      shortLabel: 'ЕФРСБ / Банкротство',
      weightPercent: 25,
      portalUrl: 'https://bankrot.fedresurs.ru/',
      score: 0,
      status: 'pending',
      notes: '',
      proofDocName: '',
      evaluated: false,
    },
    {
      id: 'fssp',
      title: '2. Исполнительные производства ФССП РФ',
      shortLabel: 'ФССП / Долги и аресты',
      weightPercent: 15,
      portalUrl: 'https://fssp.gov.ru/iss/ip',
      score: 0,
      status: 'pending',
      notes: '',
      proofDocName: '',
      evaluated: false,
    },
    {
      id: 'courts',
      title: '3. Судебные споры (ГАС Правосудие и КАД Арбитраж)',
      shortLabel: 'ГАС Правосудие / Арбитраж',
      weightPercent: 15,
      portalUrl: 'https://bsr.sudrf.ru/',
      score: 0,
      status: 'pending',
      notes: '',
      proofDocName: '',
      evaluated: false,
    },
    {
      id: 'ddu_sfr',
      title: '4. Аудит ДДУ, выписки СФР и ограничений застройщика',
      shortLabel: 'ДДУ / СФР Маткапитал / Застройщик',
      weightPercent: 45,
      portalUrl: 'https://sfr.gov.ru/',
      score: 0,
      status: 'pending',
      notes: '',
      proofDocName: '',
      evaluated: false,
    },
  ];
}

export const INITIAL_CHECKPOINTS: LegalAuditCheckpoint[] = createInitialCheckpoints();
