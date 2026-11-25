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
} from 'lucide-react';
import { Lot, LegalRadarCheckItem } from '../../../types';
import { apiClient } from '../../../services/apiClient';

interface LegalRadarPanelProps {
  lot: Lot;
  curatorName: string;
  onUpdateChecks?: (checks: LegalRadarCheckItem[]) => void;
}

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
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [innLoading, setInnLoading] = useState(false);
  const [innResult, setInnResult] = useState<any | null>(null);
  const [innError, setInnError] = useState<string | null>(null);

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
  }, [lot.lotCode]);

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
        </div>
      </div>

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

          <button
            type="button"
            onClick={handleLookupInn}
            disabled={innLoading || !sellerInn || sellerInn === '—'}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
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
          return (
            <div
              key={reg.id}
              className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all bg-slate-50/50 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    {reg.category === 'seller' ? 'Продавец' : reg.category === 'developer' ? 'Девелопер' : 'Объект'}
                  </span>
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
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-xs">
                <span className="text-[10px] text-slate-400 font-mono">
                  {checkState?.checkedAt ? 'Проверено' : 'Не проверено'}
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
