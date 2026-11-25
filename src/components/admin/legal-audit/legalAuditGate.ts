import {
  DocumentMetadata,
  LegalAuditAxis,
  LegalAuditCheckpoint,
  LegalRadarCheckItem,
  Lot,
} from '../../../types';
import { createInitialCheckpoints } from './legalAuditConstants';

export const REQUIRED_RADAR_IDS = ['fssp', 'fedresurs', 'sudrf', 'nash_dom_rf'] as const;

export const RADAR_REGISTRY_LABELS: Record<string, string> = {
  fssp: 'ФССП России (Долги и аресты)',
  fedresurs: 'ЕФРСБ / Федресурс (Банкротство 127-ФЗ)',
  sudrf: 'ГАС «Правосудие» (Суды РФ)',
  nash_dom_rf: 'ЕИСЖС Наш.Дом.РФ (214-ФЗ)',
  kad_arbitr: 'КАД Арбитраж',
  nspd_pkk: 'НСПД / Росреестр',
};

export interface MissingGateItem {
  id: string;
  label: string;
  tab: 1 | 2 | 3;
}

export interface LegalVerificationProgress {
  approvedMandatoryDocsCount: number;
  requiredMandatoryDocsTotal: number;
  hasApprovedDdu: boolean;
  hasApprovedDevCert: boolean;
  passedRequiredRadarCount: number;
  requiredRadarTotal: number;
  hasCriticalRadar: boolean;
  evaluatedAxesCount: number;
  axesTotal: number;
  hasCriticalAxis: boolean;
  weightedIndex: number;
  derivedCheckpoints: LegalAuditCheckpoint[];
  missingItems: MissingGateItem[];
  canApprove: boolean;
}

function getRadarItem(
  radarChecks: LegalRadarCheckItem[],
  registryId: string
): LegalRadarCheckItem | undefined {
  return radarChecks.find((c) => (c.registryId || c.registry) === registryId);
}

function isRadarPassed(item?: LegalRadarCheckItem): boolean {
  if (!item) return false;
  return ['clean', 'clear', 'attention', 'warning'].includes(String(item.status));
}

function isRadarCritical(item?: LegalRadarCheckItem): boolean {
  if (!item) return false;
  return item.status === 'critical' || item.status === 'risk';
}

export function computeLegalVerificationProgress(params: {
  lot: Lot;
  axes: LegalAuditAxis[];
  radarChecks: LegalRadarCheckItem[];
  documents: DocumentMetadata[];
}): LegalVerificationProgress {
  const { lot, axes, radarChecks, documents } = params;
  const isSecondary = lot.dealTrack === 'secondary_dkp';
  const missingItems: MissingGateItem[] = [];

  // 1. Mandatory Seller Documents in documents_vault
  const approvedDocs = documents.filter((d) => d.status === 'approved');
  const hasApprovedDdu = approvedDocs.some((d) => d.category === 'ddu_contract');
  const hasApprovedDevCert = approvedDocs.some((d) => d.category === 'developer_payment_cert');
  const hasApprovedSecondaryTitle = approvedDocs.some(
    (d) => d.category === 'rosreestr_extract' || d.category === 'ddu_contract'
  );

  let approvedMandatoryDocsCount = 0;
  const requiredMandatoryDocsTotal = isSecondary ? 1 : 2;
  if (isSecondary) {
    if (hasApprovedSecondaryTitle) {
      approvedMandatoryDocsCount = 1;
    } else {
      missingItems.push({
        id: 'doc_egrn',
        label: 'Одобрить скан правоустанавливающего документа / ЕГРН во вкладке 1',
        tab: 1,
      });
    }
  } else {
    if (hasApprovedDdu) approvedMandatoryDocsCount++;
    else {
      missingItems.push({
        id: 'doc_ddu',
        label: 'Одобрить скан договора ДДУ (ddu_contract) во вкладке 1',
        tab: 1,
      });
    }
    if (hasApprovedDevCert) approvedMandatoryDocsCount++;
    else {
      missingItems.push({
        id: 'doc_dev_cert',
        label: 'Одобрить справку об оплате от застройщика (developer_payment_cert) во вкладке 1',
        tab: 1,
      });
    }
  }

  // 2. Mandatory Government Registries in LegalRadarPanel
  let passedRequiredRadarCount = 0;
  let hasCriticalRadar = false;

  for (const rId of REQUIRED_RADAR_IDS) {
    const item = getRadarItem(radarChecks, rId);
    if (isRadarCritical(item)) {
      hasCriticalRadar = true;
      missingItems.push({
        id: `radar_${rId}`,
        label: `Критичный риск в реестре ${RADAR_REGISTRY_LABELS[rId]}`,
        tab: 1,
      });
    } else if (isRadarPassed(item)) {
      passedRequiredRadarCount++;
    } else {
      missingItems.push({
        id: `radar_${rId}`,
        label: `Проверить реестр ${RADAR_REGISTRY_LABELS[rId]} во вкладке 1`,
        tab: 1,
      });
    }
  }

  for (const r of radarChecks) {
    if (isRadarCritical(r) && !REQUIRED_RADAR_IDS.includes((r.registryId || r.registry) as any)) {
      hasCriticalRadar = true;
      missingItems.push({
        id: `radar_extra_${r.registryId || r.registry}`,
        label: `Критичный риск в дополнительном реестре (${r.registryId || r.registry})`,
        tab: 1,
      });
    }
  }

  // 3. Five Legal Audit Axes
  let evaluatedAxesCount = 0;
  let hasCriticalAxis = false;
  const earlyAxesIds = new Set(['title_encumbrances', 'bankruptcy_debts', 'developer_settlement']);

  for (const ax of axes) {
    if (ax.status === 'critical_risk') {
      hasCriticalAxis = true;
      missingItems.push({
        id: `axis_${ax.id}`,
        label: `Критический риск в разделе «${ax.shortLabel}» (блокирует выдачу штампа)`,
        tab: 2,
      });
      continue;
    }

    const hasNotes = Boolean((ax.notes || '').trim().length >= 3);
    const isCheckedStatus = ax.status !== 'unverified';
    const isEarlyInvalidStatus = earlyAxesIds.has(ax.id) && ax.status === 'required_at_deal';

    if (ax.evaluated && isCheckedStatus && hasNotes && !isEarlyInvalidStatus) {
      evaluatedAxesCount++;
    } else if (isEarlyInvalidStatus) {
      missingItems.push({
        id: `axis_${ax.id}`,
        label: `Раздел «${ax.shortLabel}» должен быть проверен до сделки (не «на сделке»)`,
        tab: 2,
      });
    } else {
      missingItems.push({
        id: `axis_${ax.id}`,
        label: `Проверить и зафиксировать раздел «${ax.shortLabel}» с комментарием во вкладке 2`,
        tab: 2,
      });
    }
  }

  // 4. Automatically derive checkpoints & weighted Anti-Bankruptcy Index (0-100%) from Tab 1 + Tab 2
  const baseCheckpoints = createInitialCheckpoints();
  const efrsbRadar = getRadarItem(radarChecks, 'fedresurs');
  const fsspRadar = getRadarItem(radarChecks, 'fssp');
  const sudrfRadar = getRadarItem(radarChecks, 'sudrf');
  const kadRadar = getRadarItem(radarChecks, 'kad_arbitr');
  const nashDomRadar = getRadarItem(radarChecks, 'nash_dom_rf');

  const axisBankruptcy = axes.find((a) => a.id === 'bankruptcy_debts');
  const axisTitle = axes.find((a) => a.id === 'title_encumbrances');
  const axisDev = axes.find((a) => a.id === 'developer_settlement');
  const axisFamily = axes.find((a) => a.id === 'family_matkap');
  const axisCession = axes.find((a) => a.id === 'cession_escrow');

  const derivedCheckpoints: LegalAuditCheckpoint[] = baseCheckpoints.map((cp) => {
    if (cp.id === 'efrsb') {
      if (isRadarCritical(efrsbRadar) || axisBankruptcy?.status === 'critical_risk') {
        return { ...cp, score: 2, status: 'critical', evaluated: true, notes: axisBankruptcy?.notes || 'Выявлен риск в ЕФРСБ' };
      }
      if (isRadarPassed(efrsbRadar)) {
        const isClean = efrsbRadar?.status === 'clean' || efrsbRadar?.status === 'clear';
        return {
          ...cp,
          score: isClean ? 10 : 7,
          status: isClean ? 'clean' : 'attention',
          evaluated: true,
          verifiedAt: efrsbRadar?.checkedAt,
          verifiedBy: efrsbRadar?.checkedBy,
          proofDocName: axisBankruptcy?.proofDocName || '',
          proofDocKey: axisBankruptcy?.proofDocKey,
          proofDocUrl: axisBankruptcy?.proofDocUrl,
          notes: axisBankruptcy?.notes || 'Проверено по реестру ЕФРСБ (127-ФЗ).',
        };
      }
      return cp;
    }

    if (cp.id === 'fssp') {
      if (isRadarCritical(fsspRadar)) {
        return { ...cp, score: 2, status: 'critical', evaluated: true, notes: 'Выявлены критичные долги/аресты ФССП' };
      }
      if (isRadarPassed(fsspRadar)) {
        const isClean = fsspRadar?.status === 'clean' || fsspRadar?.status === 'clear';
        return {
          ...cp,
          score: isClean ? 10 : 7,
          status: isClean ? 'clean' : 'attention',
          evaluated: true,
          verifiedAt: fsspRadar?.checkedAt,
          verifiedBy: fsspRadar?.checkedBy,
          notes: 'Проверено по базе ФССП РФ.',
        };
      }
      return cp;
    }

    if (cp.id === 'courts') {
      if (isRadarCritical(sudrfRadar) || isRadarCritical(kadRadar)) {
        return { ...cp, score: 2, status: 'critical', evaluated: true, notes: 'Выявлены критичные судебные споры' };
      }
      if (isRadarPassed(sudrfRadar)) {
        const isClean =
          (sudrfRadar?.status === 'clean' || sudrfRadar?.status === 'clear') &&
          (!kadRadar || kadRadar.status === 'clean' || kadRadar.status === 'clear');
        return {
          ...cp,
          score: isClean ? 10 : 7,
          status: isClean ? 'clean' : 'attention',
          evaluated: true,
          verifiedAt: sudrfRadar?.checkedAt,
          verifiedBy: sudrfRadar?.checkedBy,
          notes: 'Проверено в ГАС Правосудие и КАД Арбитраж.',
        };
      }
      return cp;
    }

    // ddu_sfr (45%) - combines mandatory seller docs + Nash.Dom.RF + verified non-bankruptcy axes
    const relevantAxes = [axisTitle, axisDev, axisFamily, axisCession].filter(Boolean) as LegalAuditAxis[];
    const anyCrit = relevantAxes.some((a) => a.status === 'critical_risk') || isRadarCritical(nashDomRadar);
    if (anyCrit) {
      return { ...cp, score: 2, status: 'critical', evaluated: true, notes: 'Обнаружен критический риск по ДДУ/СФР/застройщику' };
    }

    const doneAxes = relevantAxes.filter((a) => a.evaluated && a.status !== 'unverified' && (a.notes || '').trim().length > 0).length;
    const docsRatio = approvedMandatoryDocsCount / requiredMandatoryDocsTotal;
    const radarDone = isRadarPassed(nashDomRadar) ? 1 : 0;
    const totalSignals = doneAxes + (docsRatio >= 1 ? 2 : docsRatio * 2) + radarDone; // max = 4 + 2 + 1 = 7

    if (totalSignals === 0) {
      return cp;
    }
    const computedScore = Math.min(10, Math.max(2, Math.round((totalSignals / 7) * 10)));
    return {
      ...cp,
      score: computedScore,
      status: computedScore >= 8 ? 'clean' : 'attention',
      evaluated: true,
      proofDocName: axisTitle?.proofDocName || axisDev?.proofDocName || '',
      proofDocKey: axisTitle?.proofDocKey || axisDev?.proofDocKey,
      proofDocUrl: axisTitle?.proofDocUrl || axisDev?.proofDocUrl,
      notes: axisDev?.notes || axisTitle?.notes || 'Комплексная проверка документов ДДУ, расчётов и девелопера.',
    };
  });

  const weightedIndex = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        derivedCheckpoints.reduce(
          (sum, cp) => sum + ((cp.evaluated ? cp.score || 0 : 0) / 10) * cp.weightPercent,
          0
        )
      )
    )
  );

  if (weightedIndex < 85 && missingItems.length === 0) {
    missingItems.push({
      id: 'index_threshold',
      label: `Индекс чистоты ${weightedIndex}% ниже порога 85%`,
      tab: 2,
    });
  }

  return {
    approvedMandatoryDocsCount,
    requiredMandatoryDocsTotal,
    hasApprovedDdu,
    hasApprovedDevCert,
    passedRequiredRadarCount,
    requiredRadarTotal: REQUIRED_RADAR_IDS.length,
    hasCriticalRadar,
    evaluatedAxesCount,
    axesTotal: axes.length || 5,
    hasCriticalAxis,
    weightedIndex,
    derivedCheckpoints,
    missingItems,
    canApprove: missingItems.length === 0 && !hasCriticalRadar && !hasCriticalAxis && weightedIndex >= 85,
  };
}
