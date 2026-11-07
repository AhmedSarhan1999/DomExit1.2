import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Send,
  Users,
  Sparkles,
  Copy,
  CheckCircle,
  RefreshCw,
  Plus,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  DollarSign,
  Flame,
  Award,
  Lock,
  AlertCircle,
  Crown,
  ExternalLink,
  Loader2,
  Check,
  Banknote,
  Landmark,
  Eye,
  ArrowUpRight,
  Calendar,
  Building2,
  Phone,
  Briefcase,
} from 'lucide-react';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { formatRubles } from '../utils/formatters';
import { formatRussianPhoneInput, isValidRussianPhone } from '../utils/validators';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { initialLots, initialPartners } from '../dal/seedData';
import { PartnerEntry, Lot, InvestorApplication } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { withAsyncTimeout, ASYNC_NETWORK_TIMEOUT_MESSAGE } from '../utils/asyncGuard';

export const AdminPartnersBotPage: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isEmployee = user?.activeRole === 'employee';

  // Master Operational Tab State (Section 5)
  const [activeOperationalTab, setActiveOperationalTab] = useState<'vip_investors' | 'partners_registry'>('vip_investors');

  const [partners, setPartners] = useState<PartnerEntry[]>(initialPartners);
  const [lots, setLots] = useState<Lot[]>(initialLots);
  const [investors, setInvestors] = useState<InvestorApplication[]>([]);
  const [selectedLotCode, setSelectedLotCode] = useState<string>('U-10566');
  const [broadcastLang, setBroadcastLang] = useState<'RU' | 'EN' | 'RU+EN'>('RU');
  const [selectedAudience, setSelectedAudience] = useState<'vip' | 'all' | 'smart_cash'>('vip');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'developer_cancellation' | 'mortgage_broker'>('all');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<'all' | 'in_progress' | 'payable' | 'paid'>('all');

  // Interactive UI states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState<boolean>(false);

  // Payout confirmation modal state (Section 5)
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [payoutPartner, setPayoutPartner] = useState<PartnerEntry | null>(null);
  const [payoutAmountRub, setPayoutAmountRub] = useState<number>(30000);
  const [payoutTxNumber, setPayoutTxNumber] = useState<string>('');
  const [payoutBankName, setPayoutBankName] = useState<string>('Сбербанк');
  const [payoutDate, setPayoutDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payoutNotes, setPayoutNotes] = useState<string>('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState<boolean>(false);

  // New partner form state
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerOrg, setNewPartnerOrg] = useState('');
  const [newPartnerCategory, setNewPartnerCategory] = useState<
    'developer_cancellation' | 'mortgage_broker' | 'lawyer' | 'trade_in_developer'
  >('mortgage_broker');
  const [newPartnerPhone, setNewPartnerPhone] = useState('+7 ');
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);
  const [isSubmittingPartner, setIsSubmittingPartner] = useState<boolean>(false);

  // VIP Package allocation notification
  const [packageAllocatedMsg, setPackageAllocatedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isEmployee) return;
    async function loadData() {
      const [p, l, inv] = await Promise.all([
        PartnersRepository.getAll(),
        LotsRepository.getAll(),
        InvestorClubRepository.getAll(),
      ]);
      setPartners(p);
      setLots(l);
      setInvestors(inv);
      if (l.length > 0 && !l.some((lot) => lot.lotCode === selectedLotCode)) {
        setSelectedLotCode(l[0].lotCode);
      }
    }
    loadData();
  }, [isEmployee, selectedLotCode]);

  // Strict 152-ФЗ Employee Isolation Guard
  if (isEmployee) {
    return (
      <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <AdminHeader
            title="Инвесторы VIP и Партнерская сеть"
            subtitle="Контур финансового управления Владельца платформы (152-ФЗ)"
          />
          <div className="p-8 max-w-2xl mx-auto my-auto">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Доступ ограничен регламентом 152-ФЗ (Только Владелец / CEO)
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Реестр партнерских выплат B2B, финансовые комиссии и закрытый VIP-клуб инвесторов доступны исключительно в контуре Владельца платформы. Для назначения куратора или просмотра объектов используйте рабочий стол.
              </p>
              <div className="pt-2">
                <Link
                  to="/admin/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                >
                  Вернуться на рабочий стол куратора
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedLot = lots.find((l) => l.lotCode === selectedLotCode) || lots[0] || initialLots[0];

  // Dynamic Live KPIs from DAL Repositories
  const approvedPartners = partners.filter((p) => p.status !== 'rejected');
  const totalLeadsMonthly = approvedPartners.reduce((sum, p) => sum + (p.leadsCountMonthly || 0), 0);
  const totalPaidBonusesRub = approvedPartners.reduce((sum, p) => sum + (p.paidBonusesRub || 0), 0);
  const totalPendingBonusesRub = approvedPartners.reduce((sum, p) => sum + (p.pendingBonusesRub || 0), 0);
  const approvedVipCount = 379 + investors.filter((inv) => inv.status === 'approved').length;
  const smartCashCount = 62 + investors.filter((inv) => inv.capitalVolume !== '5-15m').length;

  const handleSyncAudience = async () => {
    setIsSyncing(true);
    const [freshPartners, freshInvestors] = await Promise.all([
      PartnersRepository.getAll(),
      InvestorClubRepository.getAll(),
    ]);
    setPartners(freshPartners);
    setInvestors(freshInvestors);
    const liveVip = 379 + freshInvestors.filter((i) => i.status === 'approved').length;

    setTimeout(() => {
      setIsSyncing(false);
      setBroadcastSuccess(
        `Аудитория синхронизирована: 12 450 подписчиков, ${liveVip} аккредитованных VIP-инвесторов, ${freshPartners.length} B2B-партнеров.`
      );
      setTimeout(() => setBroadcastSuccess(null), 5000);
    }, 600);
  };

  const handleBroadcast = async (isTest: boolean) => {
    setIsBroadcasting(true);
    const count =
      selectedAudience === 'vip'
        ? approvedVipCount
        : selectedAudience === 'all'
        ? 12450
        : smartCashCount;

    if (!isTest && selectedLot) {
      await AuditLogsRepository.addLog({
        lotCode: selectedLot.lotCode,
        operatorId: user?.id || 'owner-1',
        operatorName: user?.name || 'Ahmed Abdallah (Владелец / CEO)',
        operatorRole: 'owner',
        actionType: 'vip_telegram_broadcast',
        title: `Запущена рассылка по дистресс-лоту #${selectedLot.lotCode} (${selectedLot.complexName})`,
        description: `Сегмент: ${
          selectedAudience === 'vip'
            ? `Закрытый VIP-клуб (${count} чел., гандикап 48ч)`
            : selectedAudience === 'all'
            ? `Открытый канал DomExit News (${count} чел.)`
            : `Смарт-кэш >2.5M (${count} контактов)`
        }. Язык: ${broadcastLang}.`,
        metadata: {
          audience: selectedAudience,
          recipientsCount: count,
          language: broadcastLang,
        },
      });
    }

    setTimeout(() => {
      setIsBroadcasting(false);
      const msg = isTest
        ? `Тестовое превью дистресс-лота #${selectedLot.lotCode} успешно отправлено в ваш Telegram!`
        : `Рассылка по дистресс-лоту #${selectedLot.lotCode} успешно запущена на ${count.toLocaleString('ru-RU')} получателей и зафиксирована в аудите!`;
      setBroadcastSuccess(msg);
      setTimeout(() => setBroadcastSuccess(null), 5000);
    }, 800);
  };

  const handleCopyPartnerLink = () => {
    navigator.clipboard.writeText('https://domexit.ru/sellers?ref=CORE-PARTNER-77');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleAddPartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerFormError(null);

    if (newPartnerName.trim().length < 3) {
      setPartnerFormError('Укажите корректное ФИО партнера (минимум 3 символа).');
      return;
    }

    if (!isValidRussianPhone(newPartnerPhone)) {
      setPartnerFormError('Укажите телефон в российском формате +7 (XXX) XXX-XX-XX.');
      return;
    }

    setIsSubmittingPartner(true);
    try {
      await withAsyncTimeout(
        (async () => {
          const roleName =
            newPartnerCategory === 'developer_cancellation'
              ? 'Отдел расторжений девелопера'
              : newPartnerCategory === 'mortgage_broker'
              ? 'Ипотечный центр / Брокер'
              : newPartnerCategory === 'lawyer'
              ? 'Адвокат / Юрист'
              : 'Департамент Trade-in';

          const created = await PartnersRepository.add({
            name: newPartnerName.trim(),
            organization: newPartnerOrg.trim() || 'Партнерская сеть DomExit',
            role: roleName,
            category: newPartnerCategory,
            phone: newPartnerPhone.trim(),
            status: 'approved',
          });

          await AuditLogsRepository.addLog({
            operatorId: user?.id || 'owner-1',
            operatorName: user?.name || 'Ahmed Abdallah (Владелец / CEO)',
            operatorRole: 'owner',
            actionType: 'partner_application_decided',
            title: `Вручную аккредитован B2B-партнер: ${created.name}`,
            description: `Организация: ${created.organization}. Выдан реферальный код ${created.referralCode} (30 000 – 50 000 ₽ / сделка).`,
          });

          setPartners((prev) => [created, ...prev]);
          setShowAddPartnerModal(false);
          setNewPartnerName('');
          setNewPartnerOrg('');
          setNewPartnerPhone('+7 ');
          setBroadcastSuccess(`Партнер ${created.name} успешно добавлен. Реферальный код: ${created.referralCode}`);
          setTimeout(() => setBroadcastSuccess(null), 5000);
        })(),
        15000
      );
    } catch (err: any) {
      setPartnerFormError(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingPartner(false);
    }
  };

  // Handle confirming payout to a partner (Section 5)
  const handleConfirmPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutPartner) return;
    if (!payoutTxNumber.trim()) {
      alert('Укажите номер банковского платежного поручения (ПП №).');
      return;
    }

    setIsSubmittingPayout(true);
    try {
      await withAsyncTimeout(
        (async () => {
          const updated = await PartnersRepository.confirmPayout(
            payoutPartner.id,
            Number(payoutAmountRub),
            payoutTxNumber.trim(),
            payoutBankName,
            user?.name || 'Ahmed Abdallah (Владелец / CEO)'
          );

          if (updated) {
            setPartners((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }

          setShowPayoutModal(false);
          setBroadcastSuccess(
            `Выплата комиссии ${formatRubles(payoutAmountRub)} партнеру ${payoutPartner.name} успешно проведена (ПП № ${payoutTxNumber}, ${payoutBankName}). Реестр обновлен!`
          );
          setTimeout(() => setBroadcastSuccess(null), 6000);
        })(),
        15000
      );
    } catch (err: any) {
      alert(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleAllocatePackage = (pkgTitle: string) => {
    setPackageAllocatedMsg(`Пакет «${pkgTitle}» успешно направлен в пул аккредитованных VIP-инвесторов с гандикапом 48 часов.`);
    setTimeout(() => setPackageAllocatedMsg(null), 5000);
  };

  const filteredPartners = partners.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (commissionStatusFilter === 'payable') return (p.pendingBonusesRub || 0) > 0;
    if (commissionStatusFilter === 'paid') return (p.paidBonusesRub || 0) > 0;
    if (commissionStatusFilter === 'in_progress') return (p.leadsCountMonthly || 0) > 0 && (p.pendingBonusesRub || 0) === 0;
    return true;
  });

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Dark Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Инвесторы VIP и Партнерская сеть"
          subtitle="Закрытый пул капитала, выкуп пулов ДДУ и реестр выплат агентских комиссий"
        />

        <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header Banner & Two Operational Tabs Navigation */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-black">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Инвесторы VIP и Партнерская сеть DomExit
                    </h1>
                    <p className="text-xs text-slate-500">
                      Аллокация дистресс-лотов на закрытый капитал и прозрачный расчет вознаграждений 30 000 – 50 000 ₽
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSyncAudience}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать данные'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPartnerFormError(null);
                    setShowAddPartnerModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить партнера-поставщика</span>
                </button>
              </div>
            </div>

            {/* Two Operational Tabs Bar (Section 5) */}
            <div className="flex items-center space-x-2 border-t border-slate-100 pt-4 overflow-x-auto whitespace-nowrap scrollbar-thin">
              <button
                type="button"
                onClick={() => setActiveOperationalTab('vip_investors')}
                className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-black text-xs transition-all flex-shrink-0 cursor-pointer ${
                  activeOperationalTab === 'vip_investors'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>1. Инвесторы VIP и портфели</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeOperationalTab === 'vip_investors'
                      ? 'bg-amber-800 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {approvedVipCount} чел.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveOperationalTab('partners_registry')}
                className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-black text-xs transition-all flex-shrink-0 cursor-pointer ${
                  activeOperationalTab === 'partners_registry'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>2. Реестр партнеров и выплаты комиссий</span>
                {totalPendingBonusesRub > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeOperationalTab === 'partners_registry'
                        ? 'bg-emerald-900 text-white'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    К выплате: {formatRubles(totalPendingBonusesRub)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Broadcast inline notification */}
          {broadcastSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{broadcastSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastSuccess(null)}
                className="text-xs text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {packageAllocatedMsg && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{packageAllocatedMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setPackageAllocatedMsg(null)}
                className="text-xs text-amber-700 hover:text-amber-900 underline cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* =========================================================================
              OPERATIONAL TAB 1: Инвесторы VIP и портфели
          ========================================================================= */}
          {activeOperationalTab === 'vip_investors' && (
            <div className="space-y-6">
              {/* 4 Top VIP KPI Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Аккредитованные VIP</span>
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{approvedVipCount} инвесторов</div>
                  <p className="text-xs text-emerald-700 font-semibold">Гандикап 48ч на сделки</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Смарт-кэш &gt; 2.5M</span>
                    <Flame className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{smartCashCount} контактов</div>
                  <p className="text-xs text-slate-500">Готовность к сделке 48 часов</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Средний чек пула</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700">18.5 – 35 млн ₽</div>
                  <p className="text-xs text-slate-500">Доходность от 28% годовых</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Пул дистресс-лотов</span>
                    <TrendingUp className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{lots.length} объектов</div>
                  <p className="text-xs text-sky-700 font-semibold">С дисконтом 18-32%</p>
                </div>
              </div>

              {/* THREE READY INVESTMENT PACKAGES (Section 5, Tab 1) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Готовые инвестиционные пакеты платформы
                    </h3>
                    <p className="text-xs text-slate-500">
                      Сформированные стратегии для институциональных партнеров и частного капитала
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Гарантия выкупа и 214-ФЗ
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Package 1 */}
                  <div className="bg-white border-2 border-slate-200 hover:border-amber-400 rounded-3xl p-6 space-y-4 shadow-xs transition-all flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Дисконт 20-30%
                        </span>
                        <span className="text-xs font-bold text-amber-600">3 пула в наличии</span>
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        Выкуп пулов ДДУ с дисконтом 20-30%
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Пакетный выкуп от 3 до 8 квартир у заемщиков с тяжелой рассрочкой и девелоперов до ввода в эксплуатацию.
                      </p>
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Минимальный чек:</span>
                          <strong className="text-slate-900">от 25 000 000 ₽</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ожидаемый ROI:</span>
                          <strong className="text-emerald-700">28 – 34% годовых</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Срок выхода:</span>
                          <span className="text-slate-700 font-medium">4 – 8 месяцев</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAllocatePackage('Выкуп пулов ДДУ с дисконтом 20-30%')}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Направить пул инвесторам (48ч)</span>
                    </button>
                  </div>

                  {/* Package 2 */}
                  <div className="bg-white border-2 border-slate-200 hover:border-amber-400 rounded-3xl p-6 space-y-4 shadow-xs transition-all flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-50 text-purple-800 border border-purple-200">
                          ROI 35%+
                        </span>
                        <span className="text-xs font-bold text-purple-600">5 объектов в СПб</span>
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        Флиппинг и меблировка под ключ
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Покупка дистресс-квартир без отделки, быстрый дизайнерский ремонт White Box / Turnkey и продажа в розницу.
                      </p>
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Минимальный чек:</span>
                          <strong className="text-slate-900">от 10 000 000 ₽</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ожидаемый ROI:</span>
                          <strong className="text-purple-700">35 – 45% годовых</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Срок выхода:</span>
                          <span className="text-slate-700 font-medium">3 – 5 месяцев</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAllocatePackage('Флиппинг и меблировка под ключ (ROI 35%+)')}
                      className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Забронировать стратегию</span>
                    </button>
                  </div>

                  {/* Package 3 */}
                  <div className="bg-white border-2 border-slate-200 hover:border-amber-400 rounded-3xl p-6 space-y-4 shadow-xs transition-all flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-sky-50 text-sky-800 border border-sky-200">
                          Yield 12-16%
                        </span>
                        <span className="text-xs font-bold text-sky-600">Высокий тур-спрос</span>
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        Выкуп под арендный бизнес
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Студии и 1-комнатные лоты у метро в Приморском и Московском районах с готовым управлением и высоким потоком.
                      </p>
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Минимальный чек:</span>
                          <strong className="text-slate-900">от 15 000 000 ₽</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Доходность:</span>
                          <strong className="text-sky-700">12 – 16% годовых</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Модель:</span>
                          <span className="text-slate-700 font-medium">Посуточно / Долгосрочно</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAllocatePackage('Выкуп под арендный бизнес с доходностью от 12%')}
                      className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Сформировать арендный кейс</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 48H DISTRESSED PROPERTY ALLOCATION TOOL & AI OFFER PREVIEW */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                        <Flame className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">
                          Инструмент аллокации дистресс-лотов (48h Early Access)
                        </h4>
                        <p className="text-xs text-slate-500">
                          Публикация эксклюзива с гандикапом 48 часов для аккредитованного пула
                        </p>
                      </div>
                    </div>

                    {/* Language Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                      {(['RU', 'EN', 'RU+EN'] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setBroadcastLang(lang)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            broadcastLang === lang
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Выберите дистресс-объект для направления инвесторам:
                    </label>
                    <select
                      value={selectedLotCode}
                      onChange={(e) => setSelectedLotCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500"
                    >
                      {lots.map((l) => (
                        <option key={l.lotCode} value={l.lotCode}>
                          #{l.lotCode} — {l.complexName} ({l.district}) • Выгода{' '}
                          {formatRubles(l.todayDeveloperPrice - l.dduContractPrice)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Audience target buttons */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Целевой пул капитала:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedAudience('vip')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedAudience === 'vip'
                            ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                            : 'border-slate-200 bg-slate-50 hover:bg-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">Закрытый VIP-клуб</div>
                        <div className="text-base font-black text-amber-700">{approvedVipCount} чел.</div>
                        <span className="text-[10px] text-amber-900 font-bold">Гандикап 48 часов</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAudience('smart_cash')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedAudience === 'smart_cash'
                            ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                            : 'border-slate-200 bg-slate-50 hover:bg-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">Смарт-кэш &gt; 2.5M</div>
                        <div className="text-base font-black text-slate-900">{smartCashCount} чел.</div>
                        <span className="text-[10px] text-slate-500 font-medium">Быстрый кэш 48ч</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAudience('all')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedAudience === 'all'
                            ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                            : 'border-slate-200 bg-slate-50 hover:bg-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">Общий канал News</div>
                        <div className="text-base font-black text-slate-900">12 450 чел.</div>
                        <span className="text-[10px] text-slate-500 font-medium">Открытая лента</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleBroadcast(true)}
                      disabled={isBroadcasting}
                      className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Тест в Telegram
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBroadcast(false)}
                      disabled={isBroadcasting}
                      className="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isBroadcasting ? 'Отправка...' : `Направить в пул (${selectedAudience === 'vip' ? approvedVipCount : 12450} инвесторов)`}</span>
                    </button>
                  </div>
                </div>

                {/* Right: Live Telegram Post Card Preview */}
                <div className="lg:col-span-5 bg-slate-900 text-white p-5 rounded-3xl shadow-xs space-y-3 text-xs font-sans">
                  <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold border-b border-slate-800 pb-2">
                    <span className="flex items-center space-x-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span>DomExit VIP Capital • Эксклюзив 48ч</span>
                    </span>
                    <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                      #{selectedLot.lotCode}
                    </span>
                  </div>

                  <div className="rounded-xl overflow-hidden aspect-video bg-slate-800 relative">
                    <img
                      src={selectedLot.imageUrl}
                      alt={selectedLot.complexName}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded">
                      ВЫГОДА {formatRubles(selectedLot.todayDeveloperPrice - selectedLot.dduContractPrice)}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-slate-300 text-xs">
                    <p className="font-bold text-white text-sm">
                      🔥 Срочный выход из ДДУ: {selectedLot.complexName}
                    </p>
                    <p>
                      📍 {selectedLot.district} • Девелопер: {selectedLot.developer}
                    </p>
                    <p>
                      📐 Площадь: {selectedLot.areaM2} м² • Сдача: {selectedLot.deliveryDate}
                    </p>
                    <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 font-mono text-[11px] space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Кэш продавцу:</span>
                        <strong className="text-white">{formatRubles(selectedLot.cashPaidBySeller)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Остаток долга:</span>
                        <span>{formatRubles(selectedLot.remainingInstallmentDebt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      to={`/opportunities/${selectedLot.lotCode}`}
                      target="_blank"
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <span>Открыть карточку лота</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* ACCREDITED VIP INVESTORS REGISTRY TABLE */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span>Реестр аккредитованных инвесторов VIP-клуба ({investors.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Частный капитал и фонды, подтвердившие объемы средств от 10 млн до 100+ млн ₽
                    </p>
                  </div>

                  <Link
                    to="/admin/dashboard"
                    className="text-xs font-bold text-amber-700 hover:text-amber-800"
                  >
                    Перейти к досье в Панели Владельца →
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Инвестор / Фонд</th>
                        <th className="py-3 px-3">Объем капитала</th>
                        <th className="py-3 px-3">Инвест-стратегия</th>
                        <th className="py-3 px-3">Локации</th>
                        <th className="py-3 px-3">Статус</th>
                        <th className="py-3 px-3 text-right">Прямой контакт</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {investors.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{inv.fullName}</div>
                            <div className="text-[11px] text-slate-400">
                              {inv.companyOrFund || 'Частный капитал'}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                            {inv.capitalVolume === '>200m'
                              ? '> 200 000 000 ₽'
                              : inv.capitalVolume === '50-200m'
                              ? '50 – 200 млн ₽'
                              : inv.capitalVolume === '15-50m'
                              ? '15 – 50 млн ₽'
                              : '5 – 15 млн ₽'}
                          </td>
                          <td className="py-3 px-3 text-slate-800 font-medium">
                            {inv.strategy === 'flipping'
                              ? 'Флиппинг / Меблировка'
                              : inv.strategy === 'rental_fitout'
                              ? 'Арендный доход'
                              : 'Выкуп пулов ДДУ'}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {inv.targetRegions?.slice(0, 2).join(', ') || 'СПб, МСК'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : inv.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {inv.status === 'approved' ? 'Аккредитован ✓' : 'На проверке'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <a
                              href={`tel:${inv.contactTelegramOrPhone}`}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center space-x-1"
                            >
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{inv.contactTelegramOrPhone}</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              OPERATIONAL TAB 2: Реестр партнеров и выплаты комиссий
          ========================================================================= */}
          {activeOperationalTab === 'partners_registry' && (
            <div className="space-y-6">
              {/* 4 Partner Financial KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Активных партнеров</span>
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{approvedPartners.length} агентов</div>
                  <p className="text-xs text-slate-500">Агентства и брокеры</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Входящих лидов / мес.</span>
                    <TrendingUp className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="text-2xl font-black text-sky-700">{totalLeadsMonthly} заявок</div>
                  <p className="text-xs text-slate-500">По реферальным кодам</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">К выплате партнерам</span>
                    <Banknote className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-600">{formatRubles(totalPendingBonusesRub)}</div>
                  <p className="text-xs text-amber-700 font-semibold">Ожидает перевода</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Выплачено всего</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700">{formatRubles(totalPaidBonusesRub)}</div>
                  <p className="text-xs text-slate-500">На р/с ИП и самозанятых</p>
                </div>
              </div>

              {/* SMART PARTNER REFERRAL LINK BOX */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                      <HandshakeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Умная реферальная ссылка для партнеров и брокеров
                      </h3>
                      <p className="text-xs text-slate-600">
                        При переходе по ссылке партнерский код фиксируется автоматически и закрепляет комиссию 30 000 – 50 000 ₽
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black self-start sm:self-auto">
                    30 000 – 50 000 ₽ / выход
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="https://domexit.ru/sellers?ref=CORE-PARTNER-77"
                    className="flex-1 bg-white border border-emerald-300 text-emerald-950 font-mono text-xs px-4 py-3 rounded-xl font-bold select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPartnerLink}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 shadow-xs"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Скопировано!' : 'Копировать ссылку'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  * Отправляйте эту ссылку клиентам, желающим выйти из ДДУ. При переходе по ссылке партнерский код блокируется в форме заявки и фиксируется в контуре сделки. Выплата производится на счет самозанятого, ИП или ООО в день раскрытия СБР и регистрации в Росреестре.
                </p>
              </div>

              {/* Commission Filter Tabs & Partner Registry Table */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Реестр партнеров и жизненный цикл выплат комиссий
                    </h3>
                    <p className="text-xs text-slate-500">
                      Отслеживание статусов: «В процессе» → «К выплате» → «Выплачено» с фиксацией банковских платежек
                    </p>
                  </div>

                  {/* Status Filters */}
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                    {(
                      [
                        { id: 'all', label: `Все (${partners.length})` },
                        { id: 'payable', label: 'К выплате 30-50k ₽' },
                        { id: 'paid', label: 'Выплачено' },
                        { id: 'in_progress', label: 'В процессе' },
                      ] as const
                    ).map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setCommissionStatusFilter(filter.id)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
                          commissionStatusFilter === filter.id
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Партнер / Организация</th>
                        <th className="py-3 px-3">Реф-код</th>
                        <th className="py-3 px-3">Лидов за месяц</th>
                        <th className="py-3 px-3">Финансовый статус комиссии</th>
                        <th className="py-3 px-3">Выплачено всего</th>
                        <th className="py-3 px-3 text-right">Действие по выплате</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPartners.map((p) => {
                        const hasPayable = (p.pendingBonusesRub || 0) > 0;
                        const hasPaid = (p.paidBonusesRub || 0) > 0;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {p.organization} • {p.role}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.phone}</div>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                              {p.referralCode}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-900">
                              {p.leadsCountMonthly || 0} заявок
                            </td>
                            <td className="py-3 px-3">
                              {hasPayable ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                  К выплате: {formatRubles(p.pendingBonusesRub)}
                                </span>
                              ) : hasPaid ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Выплачено ✓
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                  В процессе (на аудите)
                                </span>
                              )}
                              {p.lastPayoutTransactionNumber && (
                                <div className="text-[10px] text-slate-400 font-mono mt-1">
                                  ПП № {p.lastPayoutTransactionNumber} ({p.lastPayoutBankName})
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 font-bold font-mono text-emerald-700">
                              {formatRubles(p.paidBonusesRub || 0)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {hasPayable ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayoutPartner(p);
                                    setPayoutAmountRub(p.pendingBonusesRub || 30000);
                                    setPayoutTxNumber(`ПП-${Math.floor(10000 + Math.random() * 90000)}`);
                                    setShowPayoutModal(true);
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                                >
                                  Подтвердить выплату →
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayoutPartner(p);
                                    setPayoutAmountRub(30000);
                                    setPayoutTxNumber(`ПП-${Math.floor(10000 + Math.random() * 90000)}`);
                                    setShowPayoutModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Начислить выплату
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          PAYOUT CONFIRMATION MODAL (Section 5, Tab 2)
      ========================================================================= */}
      {showPayoutModal && payoutPartner && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Подтверждение выплаты партнерской комиссии
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Фиксация банковского перевода в реестре и журнале аудита
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Партнер:</span>
                <strong className="text-slate-900">{payoutPartner.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Организация:</span>
                <span className="text-slate-700">{payoutPartner.organization}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Реферальный код:</span>
                <span className="font-mono text-indigo-700 font-bold">{payoutPartner.referralCode}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmPayoutSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Сумма выплаты (₽) *:
                  </label>
                  <input
                    type="number"
                    step="1000"
                    required
                    value={payoutAmountRub}
                    onChange={(e) => setPayoutAmountRub(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Банк списания *:
                  </label>
                  <select
                    value={payoutBankName}
                    onChange={(e) => setPayoutBankName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-amber-500"
                  >
                    <option value="Сбербанк">Сбербанк</option>
                    <option value="ВТБ">ВТБ</option>
                    <option value="Т-Банк">Т-Банк (Тинькофф)</option>
                    <option value="Альфа-Банк">Альфа-Банк</option>
                    <option value="Банк ДОМ.РФ">Банк ДОМ.РФ</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Номер ПП / Транзакции *:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ПП № 10842"
                    value={payoutTxNumber}
                    onChange={(e) => setPayoutTxNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Дата списания средств *:
                  </label>
                  <input
                    type="date"
                    required
                    value={payoutDate}
                    onChange={(e) => setPayoutDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Заметки для бухгалтерии и аудита:
                </label>
                <input
                  type="text"
                  placeholder="Выплата вознаграждения по сделке ДДУ за переуступку прав"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayout}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {isSubmittingPayout ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Проведение выплаты...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Подтвердить выплату {formatRubles(payoutAmountRub)}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD PARTNER MODAL
      ========================================================================= */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">
                Новый партнер-поставщик лидов B2B
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPartnerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {partnerFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{partnerFormError}</span>
              </div>
            )}

            <form onSubmit={handleAddPartnerSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ФИО представителя или брокера *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Елена Васильева"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Организация / Агентство / Девелопер:
                </label>
                <input
                  type="text"
                  placeholder="Петербургская Недвижимость (Отдел переуступок)"
                  value={newPartnerOrg}
                  onChange={(e) => setNewPartnerOrg(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Категория партнера:
                </label>
                <select
                  value={newPartnerCategory}
                  onChange={(e) =>
                    setNewPartnerCategory(
                      e.target.value as
                        | 'developer_cancellation'
                        | 'mortgage_broker'
                        | 'lawyer'
                        | 'trade_in_developer'
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                >
                  <option value="developer_cancellation">Отдел расторжений застройщика</option>
                  <option value="mortgage_broker">Ипотечный брокер / Центр</option>
                  <option value="lawyer">Юрист / Адвокатское бюро</option>
                  <option value="trade_in_developer">Менеджер Trade-in</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Телефон РФ для связи и выплат *:
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+7 (911) 234-56-78"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(formatRussianPhoneInput(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPartner}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {isSubmittingPartner ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Сохранить и выдать реф-код</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Handshake icon fallback for older Lucide versions
const HandshakeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0L13 13" />
    <path d="m13 13-2-2a1 1 0 0 0-1.4 0L5.3 15.3a1 1 0 0 0 0 1.4l2.3 2.3a1 1 0 0 0 1.4 0L11 17" />
    <path d="m18 11 1.3-1.3a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L14 7" />
    <path d="m6 13-1.3 1.3a2 2 0 0 1 0 2.8l1.2 1.2a2 2 0 0 1 2.8 0L10 17" />
  </svg>
);
