/**
 * AiPackagingStudioPanel.tsx — AI Packaging Studio Component
 * Integrated into /admin/packaging for Curators, Staff & Owner.
 *
 * Submodules:
 * 1. Photo QA & 152-FZ Privacy Inspector (Watermarks, Phones, Faces, Low-res)
 * 2. Geo & Metro Enricher (Offline Russian Metro Dictionary, 0 ₽)
 * 3. Investment Copywriter & Telegram Card Generator (YandexGPT Pro)
 *
 * Human-in-the-Loop Guarantee:
 * - Never blind-modifies lot fields; only applies when curator clicks "Применить".
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Camera,
  MapPin,
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ArrowRight,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatRubles } from '../../../utils/formatters';
import { apiClient } from '../../../services/apiClient';

interface AiPackagingStudioPanelProps {
  lotCode: string;
  currentValues: {
    complexName: string;
    developer: string;
    city: string;
    district: string;
    streetAddress: string;
    areaM2: number;
    rooms: string | number;
    floor: number;
    totalFloors: number;
    deliveryDate: string;
    oldDduPrice: number;
    cashToSeller: number;
    debtToDev: number;
    todayDevPrice: number;
    isNegotiable: boolean;
    sellerPhotos: string[];
    approvedPhotos: string[];
    metroName: string;
    metroTime: string;
    metroMode: 'walk' | 'drive';
    coordinates?: { lat: number; lng: number };
  };
  onApplyMetro: (
    metroName: string,
    metroTime: string,
    metroMode: 'walk' | 'drive',
    coordinates?: { lat: number; lng: number }
  ) => void;
  onApplyCopy: (description: string, headline?: string) => void;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
}

export const AiPackagingStudioPanel: React.FC<AiPackagingStudioPanelProps> = ({
  lotCode,
  currentValues,
  onApplyMetro,
  onApplyCopy,
  showToast,
  showError,
}) => {
  const [activeTab, setActiveTab] = useState<'photos' | 'geo' | 'copy'>('copy');
  const [loadingResults, setLoadingResults] = useState(false);

  // Photo QA State
  const [photoQaLoading, setPhotoQaLoading] = useState(false);
  const [photoQaReport, setPhotoQaReport] = useState<any>(null);

  // Geo State
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoResult, setGeoResult] = useState<any>(null);
  const [metroApplied, setMetroApplied] = useState(false);

  // Copywriting State
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyTone, setCopyTone] = useState<'balanced' | 'investor' | 'family'>('balanced');
  const [copyDraft, setCopyDraft] = useState<any>(null);
  const [copyApplied, setCopyApplied] = useState(false);
  const [telegramCopied, setTelegramCopied] = useState(false);

  // Load existing results from YDB on mount
  useEffect(() => {
    if (!lotCode) return;
    setLoadingResults(true);
    apiClient.aiLab
      .getPackagingResults(lotCode)
      .then((res) => {
        if (res.ok) {
          if (res.photoQa) setPhotoQaReport({ results: res.photoQa });
          if (res.geo) setGeoResult(res.geo);
          if (res.copyDraft) setCopyDraft(res.copyDraft);
        }
      })
      .catch(() => {
        // non-fatal
      })
      .finally(() => setLoadingResults(false));
  }, [lotCode]);

  // All photos available for inspection
  const photosToInspect = Array.from(
    new Set([...(currentValues.approvedPhotos || []), ...(currentValues.sellerPhotos || [])])
  ).filter(Boolean);

  // 1. Photo QA Handler
  const handleRunPhotoQa = async (force = false) => {
    if (photosToInspect.length === 0) {
      showError('В объекте нет прикреплённых фотографий для проверки');
      return;
    }

    setPhotoQaLoading(true);
    try {
      const res = await apiClient.aiLab.runPhotoQa({
        lotCode,
        photoUrls: photosToInspect,
        forceReprocess: force,
      });

      if (res.ok && res.report) {
        setPhotoQaReport(res.report);
        showToast(
          `✓ Проверено ${res.report.totalPhotos} фото: ${res.report.cleanPhotosCount} чисто, ${res.report.warningPhotosCount} замечаний, ${res.report.rejectPhotosCount} к замене`
        );
      } else {
        showError('Не удалось выполнить проверку фото');
      }
    } catch (err: any) {
      showError(err.message || 'Ошибка проверки фото Yandex Vision');
    } finally {
      setPhotoQaLoading(false);
    }
  };

  // 2. Geo Enrich Handler
  const handleRunGeoEnrich = async () => {
    setGeoLoading(true);
    setMetroApplied(false);
    try {
      const res = await apiClient.aiLab.enrichGeo({
        lotCode,
        address: currentValues.streetAddress || currentValues.district || currentValues.complexName,
        city: currentValues.city,
        lat: currentValues.coordinates?.lat,
        lon: currentValues.coordinates?.lng,
      });

      if (res.ok && res.geo) {
        setGeoResult(res.geo);
        showToast(`✓ Найдено ${res.geo.nearestMetros?.length || 0} станции метро рядом`);
      } else {
        showError('Не удалось определить метро');
      }
    } catch (err: any) {
      showError(err.message || 'Ошибка автоподбора метро');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleApplyPrimaryMetro = () => {
    if (!geoResult?.primaryMetro) return;
    const p = geoResult.primaryMetro;
    const coords = geoResult.lat && geoResult.lon ? { lat: geoResult.lat, lng: geoResult.lon } : undefined;
    onApplyMetro(p.nameRu, String(p.walkMinutes), 'walk', coords);
    setMetroApplied(true);
    showToast(`✓ Метро «${p.nameRu}» (${p.walkMinutes} мин. пешком) перенесено в форму лота!`);
  };

  // 3. Copywriting Handler
  const handleGenerateCopy = async (force = false) => {
    if (!currentValues.complexName || currentValues.areaM2 <= 0 || currentValues.oldDduPrice <= 0) {
      showError('Для составления описания укажите ЖК, площадь и цену ДДУ');
      return;
    }

    setCopyLoading(true);
    setCopyApplied(false);
    setTelegramCopied(false);

    const buyerSavings = Math.max(0, (currentValues.todayDevPrice || 0) - currentValues.oldDduPrice);

    try {
      const res = await apiClient.aiLab.generateListingCopy({
        lotCode,
        complexName: currentValues.complexName,
        developerName: currentValues.developer,
        region: currentValues.city,
        district: currentValues.district,
        address: currentValues.streetAddress,
        areaSqm: currentValues.areaM2,
        rooms: currentValues.rooms,
        floor: currentValues.floor,
        totalFloors: currentValues.totalFloors,
        handoverQuarter: currentValues.deliveryDate,
        dduPriceRub: currentValues.oldDduPrice,
        cashToSellerRub: currentValues.cashToSeller || currentValues.oldDduPrice,
        debtToDevRub: currentValues.debtToDev || 0,
        todayDeveloperPriceRub: currentValues.todayDevPrice > 0 ? currentValues.todayDevPrice : undefined,
        buyerNetSavingsRub: buyerSavings > 0 ? buyerSavings : undefined,
        isNegotiable: currentValues.isNegotiable,
        nearestMetroName: geoResult?.primaryMetro?.nameRu || currentValues.metroName || undefined,
        nearestMetroWalkMinutes: geoResult?.primaryMetro?.walkMinutes || Number(currentValues.metroTime) || undefined,
        infraTags: geoResult?.infraTagsRu,
        tone: copyTone,
        forceReprocess: force,
      });

      if (res.ok && res.draft) {
        setCopyDraft(res.draft);
        showToast('✓ Продающее описание и карточка Telegram сгенерированы YandexGPT!');
      } else {
        showError('Не удалось сгенерировать описание');
      }
    } catch (err: any) {
      showError(err.message || 'Ошибка генерации текста YandexGPT');
    } finally {
      setCopyLoading(false);
    }
  };

  const handleApplyDescription = () => {
    if (!copyDraft) return;
    onApplyCopy(copyDraft.investmentDescriptionRu, copyDraft.headlineRu);
    setCopyApplied(true);
    showToast('✓ Текст описания и заголовок перенесены в карточку лота!');
  };

  const handleCopyTelegramPost = async () => {
    if (!copyDraft?.telegramPromoPostRu) return;
    try {
      await navigator.clipboard.writeText(copyDraft.telegramPromoPostRu);
      setTelegramCopied(true);
      showToast('✓ Текст для Telegram скопирован в буфер обмена!');
      setTimeout(() => setTelegramCopied(false), 3000);
    } catch {
      showError('Не удалось скопировать в буфер обмена');
    }
  };

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-3xl overflow-hidden shadow-sm">
      {/* Studio Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-sm tracking-wide">AI Packaging Studio</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                  152-ФЗ • Yandex Cloud
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Аудит фото на водяные знаки, автоподбор станций метро и инвестиционные описания YandexGPT
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('photos')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'photos' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>1. Фото-аудит ({photosToInspect.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('geo')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'geo' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>2. Метро & Гео</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('copy')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'copy' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>3. Описание & Telegram</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Photo QA */}
      {activeTab === 'photos' && (
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h4 className="font-bold text-sm text-slate-900">Проверка фото на водяные знаки и 152-ФЗ</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Автоматическое выявление логотипов Циан/Авито, телефонов, ссылок и лиц людей
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleRunPhotoQa(false)}
              disabled={photoQaLoading || photosToInspect.length === 0}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {photoQaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <span>{photoQaReport ? 'Перепроверить все фото' : 'Проверить все фото ИИ (Vision)'}</span>
            </button>
          </div>

          {photosToInspect.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">В объекте пока нет прикрепленных фотографий.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photosToInspect.map((photoUrl, idx) => {
                const qa = photoQaReport?.results?.find((r: any) => r.photoUrl === photoUrl);
                return (
                  <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex flex-col">
                    <div className="h-40 w-full relative bg-slate-200 overflow-hidden">
                      <img src={photoUrl} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover" />
                      {qa && (
                        <div className="absolute top-2 left-2">
                          {qa.status === 'pass' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-md">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Чисто</span>
                            </span>
                          )}
                          {qa.status === 'warning' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-md">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Внимание</span>
                            </span>
                          )}
                          {qa.status === 'reject_recommended' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-md">
                              <XCircle className="w-3 h-3" />
                              <span>Заменить</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-3 text-xs flex-1 flex flex-col justify-between">
                      {qa ? (
                        <div className="space-y-1.5">
                          {qa.width && qa.height && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Разрешение: {qa.width}×{qa.height}px
                            </span>
                          )}
                          {qa.issues && qa.issues.length > 0 ? (
                            <ul className="space-y-1">
                              {qa.issues.map((issue: any, iIdx: number) => (
                                <li
                                  key={iIdx}
                                  className={`text-[11px] leading-tight font-semibold ${
                                    issue.severity === 'high' ? 'text-rose-700' : 'text-amber-700'
                                  }`}
                                >
                                  • {issue.messageRu}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-emerald-700 font-semibold">
                              ✓ Водяных знаков и контактов не обнаружено.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">Нажмите «Проверить фото» для анализа</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Geo & Metro */}
      {activeTab === 'geo' && (
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h4 className="font-bold text-sm text-slate-900">Автоподбор ближайших станций метро</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Расчёт по официальным координатам станций метро (СПб и Москва) с пешим и транспортным временем (0 ₽)
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunGeoEnrich}
              disabled={geoLoading}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              <span>{geoResult ? 'Пересчитать метро' : 'Определить ближайшее метро (0 ₽)'}</span>
            </button>
          </div>

          {geoResult && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {geoResult.nearestMetros?.map((metro: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      idx === 0
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: metro.lineColor || '#0078C9' }}
                        />
                        <span className="font-bold text-slate-900 text-sm">
                          «{metro.nameRu}»
                        </span>
                      </div>
                      {idx === 0 && (
                        <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[10px] font-black uppercase tracking-wider">
                          Ближайшее
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <div>
                        Пешком: <strong className="text-slate-900">{metro.walkMinutes} мин.</strong> ({metro.distanceKm} км)
                      </div>
                      <div>
                        Транспортом: <strong className="text-slate-900">{metro.transportMinutes} мин.</strong>
                      </div>
                      <div className="text-[10px] text-slate-400">{metro.lineName} линия</div>
                    </div>
                  </div>
                ))}
              </div>

              {geoResult.primaryMetro && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <div className="text-xs text-emerald-950 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Рекомендуется применить: Метро «{geoResult.primaryMetro.nameRu}» (
                      {geoResult.primaryMetro.walkMinutes} мин. пешком)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyPrimaryMetro}
                    disabled={metroApplied}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      metroApplied
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 cursor-pointer shadow-xs'
                    }`}
                  >
                    {metroApplied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Метро применено в карточку</span>
                      </>
                    ) : (
                      <>
                        <span>Применить метро в карточку</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Copywriting & Telegram */}
      {activeTab === 'copy' && (
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h4 className="font-bold text-sm text-slate-900">Генератор продающего описания и Telegram-поста</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                YandexGPT Pro (ru-central1): инвестиционный фокус, 0% наценки, безопасность 214-ФЗ и отсутствие галлюцинаций
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={copyTone}
                onChange={(e) => setCopyTone(e.target.value as any)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 font-bold"
              >
                <option value="balanced">Сбалансированный тон</option>
                <option value="investor">Инвестиционный акцент</option>
                <option value="family">Семейный / Для жизни</option>
              </select>

              <button
                type="button"
                onClick={() => handleGenerateCopy(false)}
                disabled={copyLoading}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {copyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{copyDraft ? 'Перегенерировать (YandexGPT)' : 'Сгенерировать текст (YandexGPT)'}</span>
              </button>
            </div>
          </div>

          {copyDraft && (
            <div className="space-y-5 animate-fade-in">
              {/* Headline & Badges */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">
                    Заголовок объявления
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Токены: {copyDraft.inputTokens}+{copyDraft.outputTokens} • ~{copyDraft.estimatedCostRub} ₽
                  </span>
                </div>
                <h4 className="text-base font-black text-slate-900">{copyDraft.headlineRu}</h4>
              </div>

              {/* Main Description & Action */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Инвестиционное описание для каталога:
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyDescription}
                    disabled={copyApplied}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      copyApplied
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 cursor-pointer shadow-xs'
                    }`}
                  >
                    {copyApplied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Описание вставлено в карточку</span>
                      </>
                    ) : (
                      <>
                        <span>Вставить описание в карточку лота</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100 font-sans">
                  {copyDraft.investmentDescriptionRu}
                </div>
              </div>

              {/* 5 Highlights */}
              {copyDraft.highlightsRu && copyDraft.highlightsRu.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <span className="text-xs font-bold text-slate-800">Ключевые преимущества (5 тезисов):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                    {copyDraft.highlightsRu.map((item: string, hIdx: number) => (
                      <div key={hIdx} className="flex items-start space-x-2 bg-white p-2.5 rounded-xl border border-slate-100">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Telegram Post Card */}
              <div className="bg-gradient-to-br from-sky-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Send className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-sky-200">
                      Готовый пост для официального Telegram-канала DomExit
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyTelegramPost}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
                  >
                    {telegramCopied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Скопировано!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Скопировать пост для Telegram</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 leading-relaxed">
                  {copyDraft.telegramPromoPostRu}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
