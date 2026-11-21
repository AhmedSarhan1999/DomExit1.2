import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sliders,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Building2,
  MapPin,
  TrendingDown,
  FileCheck,
  Save,
  Check,
  Lock,
  Layers,
  Award,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { formatRubles } from '../../utils/formatters';
import { BuyerBuyBox, BuyBoxTier, BuyBoxPaymentMethod, BuyerApplication } from '../../types';
import { RUSSIAN_REGIONS } from '../../data/russianGeography';
import { PepSignatureModal } from '../legal/PepSignatureModal';

export interface BuyerBuyBoxTabProps {
  user: any;
  onOpenAuthModal?: () => void;
}

const DEFAULT_BUY_BOX: Partial<BuyerBuyBox> = {
  active: true,
  cities: ['spb'],
  districts: [],
  complexNames: [],
  dealTracks: ['ddu_cession'],
  rooms: ['1-room', '2-room'],
  maxBudgetRub: 16000000,
  minDiscountPercent: 10,
  paymentMethod: 'cash_100',
  preferredBanks: [],
  goal: 'living',
  readinessHours: 24,
  tier: 'silver',
  reliabilityScore: 100,
  noShowCount: 0,
  completedViewingsCount: 0,
};

export const BuyerBuyBoxTab: React.FC<BuyerBuyBoxTabProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [buyBox, setBuyBox] = useState<Partial<BuyerBuyBox>>(DEFAULT_BUY_BOX);
  const [tier, setTier] = useState<BuyBoxTier>('silver');
  const [matches, setMatches] = useState<any[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // NDA modal state
  const [ndaModalOpen, setNdaModalOpen] = useState(false);
  const [selectedLotForNda, setSelectedLotForNda] = useState<string>('');

  // Active Applications / Queue Status
  const [applications, setApplications] = useState<BuyerApplication[]>([]);

  const loadBuyBoxAndMatches = async () => {
    setLoading(true);
    try {
      const [bbRes, matchesRes, appsRes] = await Promise.allSettled([
        apiClient.matching.getMyBuyBox(),
        apiClient.matching.getMyMatches({ limit: 10 }),
        apiClient.get<any>('/api/data/buyer_applications?limit=100'),
      ]);

      if (bbRes.status === 'fulfilled' && bbRes.value.ok) {
        if (bbRes.value.buyBox) {
          setBuyBox(bbRes.value.buyBox);
        }
        if (bbRes.value.tier) {
          setTier(bbRes.value.tier);
        }
      }

      if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
        setMatches(matchesRes.value.matches || []);
        setTotalMatches(matchesRes.value.totalMatches || 0);
        if (matchesRes.value.buyBoxTier) {
          setTier(matchesRes.value.buyBoxTier);
        }
      }

      if (appsRes.status === 'fulfilled') {
        const items = appsRes.value?.items || (Array.isArray(appsRes.value) ? appsRes.value : []);
        const activeApps = (items || []).filter(
          (a: any) => a.userId === user?.id && a.queueStatus !== 'withdrawn'
        );
        setApplications(activeApps);
      }
    } catch (err: any) {
      console.warn('[BuyerBuyBoxTab] Non-fatal load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuyBoxAndMatches();
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await apiClient.matching.saveMyBuyBox(buyBox);
      if (res.ok) {
        setBuyBox(res.buyBox);
        setTier(res.tier);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
        // Refresh matches with updated parameters
        const matchesRes = await apiClient.matching.getMyMatches({ limit: 10 });
        if (matchesRes.ok) {
          setMatches(matchesRes.matches || []);
          setTotalMatches(matchesRes.totalMatches || 0);
        }
      }
    } catch (err: any) {
      setSaveError(err.message || 'Не удалось сохранить параметры Buy-Box');
    } finally {
      setSaving(false);
    }
  };

  const toggleCity = (cityCode: string) => {
    setBuyBox((prev) => {
      const current = prev.cities || [];
      const updated = current.includes(cityCode)
        ? current.filter((c) => c !== cityCode)
        : [...current, cityCode];
      return { ...prev, cities: updated.length ? updated : ['spb'] };
    });
  };

  const toggleDealTrack = (track: 'ddu_cession' | 'secondary_dkp') => {
    setBuyBox((prev) => {
      const current = prev.dealTracks || [];
      const updated = current.includes(track)
        ? current.filter((t) => t !== track)
        : [...current, track];
      return { ...prev, dealTracks: updated.length ? updated : ['ddu_cession'] };
    });
  };

  const toggleRoom = (roomCode: string) => {
    setBuyBox((prev) => {
      const current = prev.rooms || [];
      const updated = current.includes(roomCode)
        ? current.filter((r) => r !== roomCode)
        : [...current, roomCode];
      return { ...prev, rooms: updated.length ? updated : ['1-room'] };
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500 font-bold">Загрузка вашего инвестиционного профиля Buy-Box...</p>
      </div>
    );
  }

  const priority1App = applications.find((a) => a.queueStatus === 'priority_1');
  const reserveApps = applications.filter((a) => a.queueStatus?.startsWith('reserve') || a.queueStatus === 'waitlist');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Header & Verification Tier Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>ДЕТЕРМИНИРОВАННЫЙ BUY-BOX & ОЧЕРЕДЬ</span>
            </span>
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                tier === 'gold'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  : tier === 'bronze'
                  ? 'bg-orange-500/20 text-orange-300 border-orange-400/40'
                  : 'bg-slate-300/20 text-slate-200 border-slate-400/40'
              }`}
            >
              {tier === 'gold' ? '🥇 РАНГ GOLD' : tier === 'bronze' ? '🥉 РАНГ BRONZE' : '🥈 РАНГ SILVER'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Инвестиционные критерии подбора и статус в тактовых дропах
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {tier === 'gold'
              ? 'Вам открыт эксклюзивный ранний доступ 24 часа ко всем закрытым дропам с максимальным дисконтом.'
              : 'Для перехода в ранг Gold подтвердите наличие 100% собственных средств или одобренной ипотеки у куратора.'}
          </p>
        </div>

        {/* Reliability Score Meter */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col items-center justify-center text-center shrink-0 min-w-[200px]">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
            РЕЙТИНГ НАДЕЖНОСТИ (SLA)
          </span>
          <div className="text-3xl font-black text-emerald-400 font-mono">
            {buyBox.reliabilityScore ?? 100}/100
          </div>
          <span className="text-[11px] text-slate-300 mt-1">
            {(buyBox.noShowCount || 0) > 0 ? (
              <span className="text-amber-300 font-bold">
                ⚠️ Штраф за неявку: -{buyBox.noShowCount! * 15} баллов
              </span>
            ) : (
              '100% соблюдение обязательств'
            )}
          </span>
        </div>
      </div>

      {/* 2. PRIORITY #1 BANNER (If Buyer is #1 for any lot) */}
      {priority1App && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 rounded-3xl p-6 text-slate-950 shadow-xl border-2 border-amber-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-950 text-amber-300 font-black text-xs">
              <Award className="w-4 h-4" />
              <span>ВЫ ВЫБРАНЫ КАНДИДАТОМ №1 (ПРИОРИТЕТ)</span>
            </div>
            <h3 className="text-lg font-black tracking-tight">
              Лот #{priority1App.lotCode} готов к согласованию просмотра и внесению задатка!
            </h3>
            <p className="text-xs font-semibold text-slate-900/90">
              Дедлайн просмотра: <strong>24 часа</strong> • Дедлайн депозита: <strong>48 часов</strong>.
              Подпишите акт осмотра и соглашение о конфиденциальности ПЭП 63-ФЗ:
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedLotForNda(priority1App.lotCode);
              setNdaModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs shadow-md transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Подписать ПЭП NDA (63-ФЗ)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. RESERVE QUEUE STATUS (If buyer has applications in reserve) */}
      {reserveApps.length > 0 && !priority1App && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 text-indigo-700 font-bold text-xs">
            <Clock className="w-4 h-4" />
            <span>ВАШЕ МЕСТО В ОЧЕРЕДИ ЗАКРЫТЫХ ДРОПОВ</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reserveApps.map((app) => (
              <div
                key={app.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Лот #{app.lotCode}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Статус: <strong>{app.queueStatus === 'reserve_2' ? '№2 в резерве' : 'В листе ожидания'}</strong>
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  Closing: {app.closingScore}/105
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. BUY-BOX CONFIGURATION FORM */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>Параметры автоматического поиска (Buy-Box)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Система автоматически матчит новые лоты с дисконтом и присылает уведомления в Telegram.
            </p>
          </div>

          <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={buyBox.active !== false}
              onChange={(e) => setBuyBox((prev) => ({ ...prev, active: e.target.checked }))}
              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
            />
            <span>Активный поиск включен</span>
          </label>
        </div>

        {saveSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Критерии Buy-Box успешно сохранены! Подбор объектов обновлен.</span>
          </div>
        )}

        {saveError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target Cities */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              1. Регионы поиска (выберите один или несколько):
            </label>
            <div className="flex flex-wrap gap-2">
              {RUSSIAN_REGIONS.map((reg) => {
                const isSelected = (buyBox.cities || []).includes(reg.code);
                return (
                  <button
                    key={reg.code}
                    type="button"
                    onClick={() => toggleCity(reg.code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {reg.labelRu}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deal Tracks */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              2. Формат сделки:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleDealTrack('ddu_cession')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  (buyBox.dealTracks || []).includes('ddu_cession')
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ДДУ / Переуступка (214-ФЗ)
              </button>
              <button
                type="button"
                onClick={() => toggleDealTrack('secondary_dkp')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  (buyBox.dealTracks || []).includes('secondary_dkp')
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Вторичное жилье (ДКП)
              </button>
            </div>
          </div>

          {/* Rooms */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              3. Тип планировки:
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { code: 'studio', label: 'Студия' },
                { code: '1-room', label: '1к' },
                { code: '2-room', label: '2к' },
                { code: '3-room', label: '3к' },
                { code: '4-room', label: '4к+' },
              ].map((r) => {
                const isSelected = (buyBox.rooms || []).includes(r.code);
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => toggleRoom(r.code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              4. Форма оплаты и ликвидность:
            </label>
            <select
              value={buyBox.paymentMethod || 'cash_100'}
              onChange={(e) =>
                setBuyBox((prev) => ({
                  ...prev,
                  paymentMethod: e.target.value as BuyBoxPaymentMethod,
                }))
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="cash_100">100% Собственные средства (Кэш на аккредитив)</option>
              <option value="family_mortgage_approved">Одобренная семейная ипотека (с ПВ 20%+)</option>
              <option value="standard_mortgage_approved">Одобренная стандартная ипотека</option>
              <option value="alternative">Альтернативная сделка / Продажа имеющегося</option>
            </select>
          </div>

          {/* Max Budget */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              5. Максимальный бюджет сделки (₽):
            </label>
            <div className="relative">
              <input
                type="number"
                step="500000"
                min="3000000"
                max="100000000"
                value={buyBox.maxBudgetRub || 15000000}
                onChange={(e) =>
                  setBuyBox((prev) => ({
                    ...prev,
                    maxBudgetRub: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                {formatRubles(buyBox.maxBudgetRub || 0)}
              </span>
            </div>
          </div>

          {/* Min Discount Percent */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>6. Минимальный требуемый дисконт:</span>
              <span className="text-indigo-600 font-mono text-sm">{buyBox.minDiscountPercent || 10}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="35"
              step="1"
              value={buyBox.minDiscountPercent || 10}
              onChange={(e) =>
                setBuyBox((prev) => ({
                  ...prev,
                  minDiscountPercent: Number(e.target.value),
                }))
              }
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>От -5% (рыночные)</span>
              <span>От -15% (срочные)</span>
              <span>От -35% (дистресс)</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <span>Сохранение...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Сохранить критерии Buy-Box</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 5. MATCHED CLOSED LOTS SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Подходящие закрытые лоты по вашему Buy-Box ({totalMatches})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Лоты отобраны математическим движком по совпадению цены, локации и дисконта.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Показано {matches.length} из {totalMatches}
          </span>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-2 shadow-xs">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
            <p className="text-sm font-bold text-slate-800">Пока нет совпадений по текущим критериям</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Попробуйте расширить диапазон бюджета или снизить минимальный дисконт, либо дождитесь появления новых лотов от продавцов.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map(({ lot, score, eligibleForDrop, canApplyNow, waveStatus, remainingSeats }) => (
              <div
                key={lot.id || lot.lotCode}
                className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                      Совпадение: {score}%
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        waveStatus === 'gold_wave'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : waveStatus === 'silver_wave'
                          ? 'bg-slate-100 text-slate-800 border-slate-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {waveStatus === 'gold_wave' ? '🥇 Gold Волна' : waveStatus === 'silver_wave' ? '🥈 Silver Волна' : '🟢 Открыто'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-black text-slate-900 text-base">{lot.complexName}</h4>
                    <span className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {(lot.city || 'spb').toUpperCase()} • {lot.district}
                      </span>
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Цена предложения:</span>
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatRubles(lot.priceRub || lot.price)}
                      </span>
                    </div>
                    {lot.discountPercent && (
                      <div className="flex items-baseline justify-between text-emerald-600 text-xs font-bold">
                        <span>Дисконт от рынка:</span>
                        <span>-{lot.discountPercent}%</span>
                      </div>
                    )}
                    {remainingSeats !== null && remainingSeats !== undefined && (
                      <div className="flex items-baseline justify-between text-indigo-700 text-[11px] font-bold">
                        <span>Свободных мест в очереди:</span>
                        <span>{remainingSeats} мест</span>
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  to={`/catalog/${lot.lotCode || lot.id}`}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition-all flex items-center justify-center space-x-2"
                >
                  <span>Посмотреть объект & Подать заявку</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. PEP Signature Modal */}
      {ndaModalOpen && (
        <PepSignatureModal
          isOpen={ndaModalOpen}
          onClose={() => setNdaModalOpen(false)}
          documentType="nda_viewing_act"
          lotCode={selectedLotForNda}
          onSigned={() => {
            setNdaModalOpen(false);
            loadBuyBoxAndMatches();
          }}
        />
      )}
    </div>
  );
};
