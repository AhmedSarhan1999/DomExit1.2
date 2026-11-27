import React, { useState, useEffect } from 'react';
import {
  Radar,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileSearch,
  Search,
  Shield,
  Loader2,
  Check,
  Zap,
  Download,
  Sparkles,
} from 'lucide-react';
import { Lot, LegalRadarCheckItem } from '../../../types';
import { apiClient } from '../../../services/apiClient';
import { useAiFeatureFlags } from '../../../hooks/useAiFeatureFlags';

interface LegalRadarPanelProps {
  lot: Lot;
  curatorName: string;
  onUpdateChecks?: (checks: LegalRadarCheckItem[]) => void;
  onDownloadProtocol?: (registryType: 'EFRSB' | 'FSSP') => void;
}

const REQUIRED_REGISTRIES = new Set(['fssp', 'fedresurs', 'sudrf', 'nash_dom_rf']);

interface FastRegistry {
  id: string;
  name: string;
  shortLabel: string;
  url: string;
  description: string;
  recommendedParam: 'inn' | 'name' | 'cadastral' | 'developer';
  category: 'seller' | 'developer' | 'property';
}

const REGISTRIES: FastRegistry[] = [
  {
    id: 'fssp',
    name: 'ФССП России (Банк исполнительных производств)',
    shortLabel: 'ФССП / Долги',
    url: 'https://fssp.gov.ru/iss/ip',
    description: 'Проверка долгов, исполнительных производств и арестов счетов судебными приставами',
    recommendedParam: 'name',
    category: 'seller',
  },
  {
    id: 'fedresurs',
    name: 'ЕФРСБ / Федресурс (Реестр сведений о банкротстве)',
    shortLabel: 'Федресурс / 127-ФЗ',
    url: 'https://bankrot.fedresurs.ru/',
    description: 'Поиск дел о несостоятельности (банкротстве) продавца и девелопера по ст. 213.4 127-ФЗ',
    recommendedParam: 'inn',
    category: 'seller',
  },
  {
    id: 'kad_arbitr',
    name: 'КАД Арбитраж (Картотека арбитражных дел)',
    shortLabel: 'КАД / Арбитраж',
    url: 'https://kad.arbitr.ru/',
    description: 'Поиск арбитражных споров с участием продавца, поручителей или застройщика',
    recommendedParam: 'inn',
    category: 'developer',
  },
  {
    id: 'nash_dom_rf',
    name: 'ЕИСЖС Наш.Дом.РФ (Минстрой РФ)',
    shortLabel: 'Наш.Дом.РФ / 214-ФЗ',
    url: 'https://xn--80az8a.xn--d1aqf.xn--p1ai/',
    description: 'Проверка аккредитации новостройки, эскроу-счетов, переносов сроков и проектной декларации',
    recommendedParam: 'developer',
    category: 'developer',
  },
  {
    id: 'nspd_pkk',
    name: 'НСПД / Публичная кадастровая карта Росреестра',
    shortLabel: 'Росреестр / НСПД',
    url: 'https://pkk.rosreestr.ru/',
    description: 'Проверка земельного участка, назначения земель и кадастровых границ объекта',
    recommendedParam: 'cadastral',
    category: 'property',
  },
  {
    id: 'sudrf',
    name: 'ГАС «Правосудие» (Суды общей юрисдикции РФ)',
    shortLabel: 'ГАС Правосудие / СОЮ',
    url: 'https://bsr.sudrf.ru/bigs/portal.html',
    description: 'Поиск гражданских исков, имущественных споров и семейных разбирательств в районных судах РФ',
    recommendedParam: 'name',
    category: 'seller',
  },
];

export const LegalRadarPanel: React.FC<LegalRadarPanelProps> = ({
  lot,
  curatorName,
  onUpdateChecks,
  onDownloadProtocol,
}) => {
  const { isFeatureEnabled } = useAiFeatureFlags();
  const dadataEnabled = isFeatureEnabled('dadataAutocomplete');
  const autoKycEnabled = isFeatureEnabled('autoKycProvider');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [innLoading, setInnLoading] = useState(false);
  const [innResult, setInnResult] = useState<any | null>(null);
  const [innError, setInnError] = useState<string | null>(null);
  const [dadataLoading, setDadataLoading] = useState(false);
  const [dadataParty, setDadataParty] = useState<any | null>(null);
  const [dadataError, setDadataError] = useState<string | null>(null);

  // 1-Click Auto-KYC state
  const [kycLoading, setKycLoading] = useState(false);
  const [kycResult, setKycResult] = useState<any | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);
  const [showKycConfirm, setShowKycConfirm] = useState(false);
  const [protocolDownloading, setProtocolDownloading] = useState(false);
  const [appliedHints, setAppliedHints] = useState(false);

  // Local state for radar checks (resets/syncs when lot changes)
  const buildChecksMap = (items?: LegalRadarCheckItem[]) => {
    const initial: Record<string, { status: 'clean' | 'attention' | 'critical'; checkedAt?: string }> = {};
    if (items && Array.isArray(items)) {
      items.forEach((c: any) => {
        initial[c.registryId || c.registry] = { status: c.status, checkedAt: c.checkedAt };
      });
    }
    return initial;
  };

  const [checks, setChecks] = useState<Record<string, { status: 'clean' | 'attention' | 'critical'; checkedAt?: string }>>(() =>
    buildChecksMap(lot.legalRadarChecks)
  );

  useEffect(() => {
    setChecks(buildChecksMap(lot.legalRadarChecks));
    setInnResult(null);
    setInnError(null);
    setDadataParty(null);
    setDadataError(null);
  }, [lot.lotCode, lot.legalRadarChecks]);

  const sellerInn = (lot.sellerInn || '').trim() || '—';
  const sellerFullName = lot.ownerDossier?.fullNameMasked || 'Правообладатель';
  const developerName = lot.developer || 'Застройщик';
  const cadastralNumber = lot.cadastralNumber || 'Не указан (запросить из ДДУ)';

  const copyToClipboard = (text: string, key: string) => {
    if (!text || text === '—') return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleLookupInn = async () => {
    if (!lot.sellerInn || lot.sellerInn === '—') {
      setInnError('ИНН продавца не указан в карточке объекта');
      return;
    }
    setInnLoading(true);
    setInnError(null);
    setInnResult(null);

    try {
      const res = await apiClient.tools.lookupInn(lot.sellerInn);
      setInnResult(res);
    } catch (err: any) {
      setInnError(err?.message || 'Не удалось выполнить проверку ИНН');
    } finally {
      setInnLoading(false);
    }
  };

  const handleDadataPartyLookup = async () => {
    if (!lot.sellerInn || lot.sellerInn === '—') {
      setDadataError('ИНН не указан в карточке объекта');
      return;
    }
    setDadataLoading(true);
    setDadataError(null);
    setDadataParty(null);
    try {
      const res = await apiClient.aiLab.lookupParty(lot.sellerInn);
      if (res?.ok && res?.party) {
        setDadataParty(res.party);
      } else {
        setDadataError(res?.errorCode || 'Не удалось получить данные из DaData');
      }
    } catch (err: any) {
      setDadataError(err?.message || 'Ошибка запроса DaData ЕГРЮЛ');
    } finally {
      setDadataLoading(false);
    }
  };

  const handleRunKycCheck = async (forceRefresh: boolean = false) => {
    setShowKycConfirm(false);
    setKycLoading(true);
    setKycError(null);
    setAppliedHints(false);

    try {
      const res = await apiClient.aiLab.runKycCheck({
        lotCode: lot.lotCode,
        subjectType: 'individual',
        fio: lot.ownerDossier?.fullNameMasked || lot.sellerName,
        inn: lot.sellerInn && lot.sellerInn !== '—' ? lot.sellerInn : undefined,
        forceRefresh,
      });

      if (res?.ok && res?.record) {
        setKycResult(res.record);
      } else {
        setKycError(res?.hintRu || 'Не удалось выполнить автоматическую проверку');
      }
    } catch (err: any) {
      setKycError(err?.message || 'Ошибка вызова сервиса автопроверки');
    } finally {
      setKycLoading(false);
    }
  };

  const handleApplySuggestedRadarUpdates = () => {
    if (!kycResult?.suggestedRadarUpdates) return;
    const updates = kycResult.suggestedRadarUpdates;

    const newChecks = { ...checks };
    const nowIso = new Date().toISOString();

    if (updates.fssp) {
      newChecks['fssp'] = { status: updates.fssp.status, checkedAt: nowIso };
    }
    if (updates.fedresurs) {
      newChecks['fedresurs'] = { status: updates.fedresurs.status, checkedAt: nowIso };
    }
    if (updates.kad_arbitr) {
      newChecks['kad_arbitr'] = { status: updates.kad_arbitr.status, checkedAt: nowIso };
    }
    if (updates.sudrf) {
      newChecks['sudrf'] = { status: updates.sudrf.status, checkedAt: nowIso };
    }

    setChecks(newChecks);
    setAppliedHints(true);

    if (onUpdateChecks) {
      const formatted: LegalRadarCheckItem[] = Object.entries(newChecks).map(([rId, data]) => ({
        registry: rId,
        registryId: rId,
        status: data.status,
        checkedAt: data.checkedAt || nowIso,
        checkedBy: curatorName,
      }));
      onUpdateChecks(formatted);
    }
  };

  const handleDownloadKycProtocol = async (checkId: string) => {
    setProtocolDownloading(true);
    try {
      const res = await apiClient.aiLab.getKycProtocolUrl(checkId);
      if (res?.ok && res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      } else {
        alert('Не удалось сформировать ссылку для скачивания протокола');
      }
    } catch (err: any) {
      alert('Ошибка получения протокола: ' + err.message);
    } finally {
      setProtocolDownloading(false);
    }
  };

  const toggleCheckStatus = (registryId: string, status: 'clean' | 'attention' | 'critical') => {
    const updated = {
      ...checks,
      [registryId]: {
        status,
        checkedAt: new Date().toISOString(),
      },
    };
    setChecks(updated);

    if (onUpdateChecks) {
      const formatted: LegalRadarCheckItem[] = Object.entries(updated).map(([rId, data]) => ({
        registry: rId,
        registryId: rId,
        status: data.status,
        checkedAt: data.checkedAt || new Date().toISOString(),
        checkedBy: curatorName,
      }));
      onUpdateChecks(formatted);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-indigo-700">
            <Radar className="w-5 h-5 text-indigo-600 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">
              РАДАР ПРОВЕРКИ 1-CLICK • ГОСРЕЕСТРЫ РФ (0 ₽)
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900">
            Бесплатный юридический комплаенс-радар для кураторов
          </h3>
          <p className="text-xs text-slate-500">
            Быстрый переход в государственные реестры с готовыми параметрами поиска и серверной валидацией ИНН.
          </p>
        </div>

        {/* Quick Copy Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard(sellerInn, 'inn')}
            disabled={!sellerInn || sellerInn === '—'}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono font-bold border border-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>ИНН: {sellerInn}</span>
            {copiedKey === 'inn' ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => copyToClipboard(sellerFullName, 'name')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer truncate max-w-xs"
          >
            <span className="truncate">ФИО: {sellerFullName}</span>
            {copiedKey === 'name' ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => copyToClipboard(cadastralNumber, 'cadastral')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono border border-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Кадастр: {cadastralNumber}</span>
            {copiedKey === 'cadastral' ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {onDownloadProtocol && (
            <>
              <button
                type="button"
                onClick={() => onDownloadProtocol('EFRSB')}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
              >
                Протокол ЕФРСБ
              </button>
              <button
                type="button"
                onClick={() => onDownloadProtocol('FSSP')}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
              >
                Протокол ФССП
              </button>
            </>
          )}
        </div>
      </div>

      {/* 1-Click Real KYC/KYB Banner (Stage 10) */}
      {autoKycEnabled && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900/10 via-teal-900/10 to-indigo-900/10 border-2 border-emerald-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-emerald-950 tracking-wider flex items-center space-x-2">
                  <span>⚡ Автопроверка по госреестрам 1-Click</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">ФССП + ЕФРСБ + Суды + ФНС</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  Мгновенный опрос 6 госреестров через сертифицированный шлюз • Кэш 30 дней (0 ₽) • 152-ФЗ Zero-PII
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowKycConfirm(true)}
                disabled={kycLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              >
                {kycLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Проверка госреестров...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Запустить 1-Click проверку</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Confirmation Dialog */}
          {showKycConfirm && (
            <div className="p-3 bg-white rounded-xl border border-emerald-300 shadow-sm space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Подтверждение запуска автопроверки:</p>
                  <p className="text-[11px] text-slate-600">
                    Субъект: <span className="font-bold">{sellerFullName}</span> (ИНН: {sellerInn})
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Стоимость: <span className="font-bold text-emerald-700">~15–25 ₽</span> (или <span className="font-bold text-emerald-700">0 ₽</span>, если проверялся за последние 30 дней)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKycConfirm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleRunKycCheck(false)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Запустить (с кэшем 30 дн.)
                </button>
                <button
                  type="button"
                  onClick={() => handleRunKycCheck(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Принудительно обновить
                </button>
                <button
                  type="button"
                  onClick={() => setShowKycConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 text-xs"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* KYC Error */}
          {kycError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{kycError}</span>
            </div>
          )}

          {/* KYC Results Card */}
          {kycResult && (
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800">Результат 1-Click:</span>
                  {kycResult.overallRiskLevel === 'clean' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      ✓ Чисто (рисков не обнаружено)
                    </span>
                  )}
                  {kycResult.overallRiskLevel === 'attention' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                      ⚠ Требует внимания
                    </span>
                  )}
                  {kycResult.overallRiskLevel === 'critical' && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
                      ⛔ Критический юридический риск
                    </span>
                  )}

                  {kycResult.cached ? (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                      0 ₽ (кэш 30 дн.)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono">
                      ~{kycResult.estimatedCostRub || 18} ₽
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadKycProtocol(kycResult.id)}
                    disabled={protocolDownloading}
                    className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center space-x-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>{protocolDownloading ? 'Загрузка...' : 'Протокол S3 (JSON)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplySuggestedRadarUpdates}
                    disabled={appliedHints}
                    className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-200 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs"
                  >
                    {appliedHints ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Подсказки применены в Радар</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Применить подсказки в карточки Радара</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Grid of checks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                {kycResult.checks?.fssp && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">ФССП (Приставы)</span>
                      <span className={`text-[10px] font-bold ${kycResult.checks.fssp.status === 'clean' ? 'text-emerald-700' : kycResult.checks.fssp.status === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
                        {kycResult.checks.fssp.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{kycResult.checks.fssp.summaryRu}</p>
                  </div>
                )}
                {kycResult.checks?.fedresurs && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">ЕФРСБ (Банкротство)</span>
                      <span className={`text-[10px] font-bold ${kycResult.checks.fedresurs.status === 'clean' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {kycResult.checks.fedresurs.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{kycResult.checks.fedresurs.summaryRu}</p>
                  </div>
                )}
                {kycResult.checks?.kadArbitr && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">КАД Арбитраж</span>
                      <span className={`text-[10px] font-bold ${kycResult.checks.kadArbitr.status === 'clean' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {kycResult.checks.kadArbitr.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{kycResult.checks.kadArbitr.summaryRu}</p>
                  </div>
                )}
                {kycResult.checks?.sudrf && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">ГАС Правосудие (СОЮ)</span>
                      <span className={`text-[10px] font-bold ${kycResult.checks.sudrf.status === 'clean' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {kycResult.checks.sudrf.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{kycResult.checks.sudrf.summaryRu}</p>
                  </div>
                )}
                {kycResult.checks?.fns && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">ФНС / ЕГРЮЛ</span>
                      <span className={`text-[10px] font-bold ${kycResult.checks.fns.status === 'clean' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {kycResult.checks.fns.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{kycResult.checks.fns.summaryRu}</p>
                  </div>
                )}
                {kycResult.checks?.passportOrBlacklist && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">МВД Паспорт</span>
                      <span className={`text-[10px] font-bold ${kycResult.checks.passportOrBlacklist.status === 'clean' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {kycResult.checks.passportOrBlacklist.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{kycResult.checks.passportOrBlacklist.summaryRu}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Server INN Check Box */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-indigo-700" />
            <div>
              <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                Серверная проверка ИНН продавца (Контрольная сумма + ЕГРЮЛ/ЕГРИП)
              </h4>
              <p className="text-[11px] text-indigo-800/80">
                Математический алгоритм ФНС + интеграция без платных API
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {dadataEnabled && (
              <button
                type="button"
                onClick={handleDadataPartyLookup}
                disabled={dadataLoading || !sellerInn || sellerInn === '—'}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
              >
                {dadataLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>ЕГРЮЛ...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-3.5 h-3.5" />
                    <span>DaData ЕГРЮЛ</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleLookupInn}
              disabled={innLoading || !sellerInn || sellerInn === '—'}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
            >
              {innLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Проверка...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Проверить ИНН {sellerInn}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {dadataParty && (
          <div className="p-3.5 rounded-xl bg-white border border-violet-200 text-xs space-y-2 animate-fade-in font-sans">
            <div className="flex items-center justify-between">
              <span className="font-bold text-violet-950 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-violet-600" />
                <span>{dadataParty.found ? (dadataParty.nameFull || dadataParty.nameShort) : 'Организация не найдена в ЕГРЮЛ'}</span>
              </span>
              {dadataParty.statusLabelRu && (
                <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${dadataParty.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {dadataParty.statusLabelRu}
                </span>
              )}
            </div>
            {dadataParty.found && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
                {dadataParty.ogrn && (
                  <div><span className="font-bold text-slate-800">ОГРН:</span> {dadataParty.ogrn}</div>
                )}
                {dadataParty.kpp && (
                  <div><span className="font-bold text-slate-800">КПП:</span> {dadataParty.kpp}</div>
                )}
                {dadataParty.managementName && (
                  <div className="sm:col-span-2">
                    <span className="font-bold text-slate-800">Руководитель:</span> {dadataParty.managementName}
                    {dadataParty.managementPost ? ` (${dadataParty.managementPost})` : ''}
                  </div>
                )}
                {dadataParty.legalAddress && (
                  <div className="sm:col-span-2">
                    <span className="font-bold text-slate-800">Юр. адрес:</span> {dadataParty.legalAddress}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {dadataError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2 animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{dadataError}</span>
          </div>
        )}

        {innResult && (
          <div className="p-3.5 rounded-xl bg-white border border-indigo-200 text-xs space-y-2 animate-fade-in font-sans">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{innResult.message || 'ИНН валиден по контрольной сумме ФНС'}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px]">
                Источник: {innResult.source}
              </span>
            </div>
            {innResult.entity && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
                <div>
                  <span className="font-bold text-slate-800">Наименование:</span> {innResult.entity.name}
                </div>
                {innResult.entity.ogrn && (
                  <div>
                    <span className="font-bold text-slate-800">ОГРН:</span> {innResult.entity.ogrn}
                  </div>
                )}
                {innResult.entity.status && (
                  <div>
                    <span className="font-bold text-slate-800">Статус:</span> {innResult.entity.status}
                  </div>
                )}
                {innResult.entity.address && (
                  <div className="col-span-2">
                    <span className="font-bold text-slate-800">Адрес:</span> {innResult.entity.address}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {innError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2 animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{innError}</span>
          </div>
        )}
      </div>

      {/* 6 Official Fast Registries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REGISTRIES.map((reg) => {
          const checkState = checks[reg.id];
          const isRequiredReg = REQUIRED_REGISTRIES.has(reg.id);
          return (
            <div
              key={reg.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                checkState?.status === 'critical'
                  ? 'bg-rose-50/70 border-rose-300'
                  : checkState?.status === 'clean'
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : checkState?.status === 'attention'
                  ? 'bg-amber-50/40 border-amber-200'
                  : 'bg-slate-50/50 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                      {reg.category === 'seller' ? 'Продавец' : reg.category === 'developer' ? 'Девелопер' : 'Объект'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        isRequiredReg
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isRequiredReg ? 'Обязательный' : 'Доп. реестр'}
                    </span>
                  </div>
                  <a
                    href={reg.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
                  >
                    <span>Открыть</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <h4 className="text-xs font-black text-slate-900 leading-snug">
                  {reg.name}
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {reg.description}
                </p>
              </div>

              {/* Status & Action */}
              <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span
                  className={`text-[10px] font-mono font-bold ${
                    checkState?.status === 'critical'
                      ? 'text-rose-700'
                      : checkState?.checkedAt
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}
                >
                  {checkState?.status === 'critical'
                    ? 'Критический риск'
                    : checkState?.status === 'attention'
                    ? 'Внимание'
                    : checkState?.checkedAt
                    ? 'Проверено'
                    : 'Не проверено'}
                </span>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => toggleCheckStatus(reg.id, 'clean')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      checkState?.status === 'clean'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    ✓ Чисто
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCheckStatus(reg.id, 'attention')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      checkState?.status === 'attention'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    ! Внимание
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCheckStatus(reg.id, 'critical')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      checkState?.status === 'critical'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white hover:bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                    title="Обнаружены критичные риски (блокирует выдачу штампа)"
                  >
                    ✕ Риск
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
