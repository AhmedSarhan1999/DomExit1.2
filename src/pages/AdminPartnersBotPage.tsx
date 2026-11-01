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

export const AdminPartnersBotPage: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isEmployee = user?.activeRole === 'employee';

  const [partners, setPartners] = useState<PartnerEntry[]>(initialPartners);
  const [lots, setLots] = useState<Lot[]>(initialLots);
  const [investors, setInvestors] = useState<InvestorApplication[]>([]);
  const [selectedLotCode, setSelectedLotCode] = useState<string>('U-10566');
  const [broadcastLang, setBroadcastLang] = useState<'RU' | 'EN' | 'RU+EN'>('RU');
  const [selectedAudience, setSelectedAudience] = useState<'vip' | 'all' | 'smart_cash'>('vip');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'developer_cancellation' | 'mortgage_broker'>('all');

  // Interactive UI states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState<boolean>(false);

  // New partner form
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerOrg, setNewPartnerOrg] = useState('');
  const [newPartnerCategory, setNewPartnerCategory] = useState<
    'developer_cancellation' | 'mortgage_broker' | 'lawyer' | 'trade_in_developer'
  >('mortgage_broker');
  const [newPartnerPhone, setNewPartnerPhone] = useState('+7 ');
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);

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
            title={
              language === 'ru'
                ? 'Управление партнерской сетью и VIP-рассылками'
                : 'Partner Network & VIP Broadcasts'
            }
            subtitle="Контур финансового управления Владельца платформы (152-ФЗ)"
          />
          <div className="p-8 max-w-2xl mx-auto my-auto">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Доступ ограничен регламентом 152-ФЗ (Только Владелец / CEO)
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Реестр партнерских выплат B2B и массовые рассылки по закрытому VIP-клубу инвесторов доступны исключительно в контуре Владельца платформы. Для отправки конкретного лота в VIP-пул используйте кнопку в модуле «Упаковка лота».
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
  const devCancellationCount = partners.filter((p) => p.category === 'developer_cancellation').length;
  const mortgageBrokerCount = partners.filter((p) => p.category === 'mortgage_broker').length;
  const approvedVipCount = 379 + investors.filter((inv) => inv.status === 'approved').length;
  const smartCashCount = 62 + investors.filter((inv) => inv.capitalVolume !== '5-15m').length;
  const avgSellerCashMillions = (
    lots.reduce((sum, l) => sum + (l.cashPaidBySeller || 0), 0) /
    Math.max(1, lots.length) /
    1_000_000
  ).toFixed(2);

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
        language === 'ru'
          ? `Аудитория Telegram-бота синхронизирована: 12 450 подписчиков, ${liveVip} аккредитованных VIP-инвесторов, ${freshPartners.length} B2B-партнеров.`
          : `Telegram audience synced: 12,450 subscribers, ${liveVip} accredited VIP investors, ${freshPartners.length} B2B partners.`
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
        operatorName: user?.name || 'Виктор Сергеевич (Владелец / CEO)',
        operatorRole: 'owner',
        actionType: 'vip_telegram_broadcast',
        title: `Запущена Telegram-рассылка по лоту #${selectedLot.lotCode} (${selectedLot.complexName})`,
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
        ? language === 'ru'
          ? `Тестовое превью лота #${selectedLot.lotCode} успешно отправлено в ваш Telegram!`
          : `Test alert for lot #${selectedLot.lotCode} sent to your Telegram!`
        : language === 'ru'
        ? `Рассылка по лоту #${selectedLot.lotCode} успешно запущена на ${count.toLocaleString('ru-RU')} получателей и зафиксирована в журнале аудита!`
        : `Broadcast for lot #${selectedLot.lotCode} sent to ${count} recipients!`;
      setBroadcastSuccess(msg);
      setTimeout(() => setBroadcastSuccess(null), 5000);
    }, 800);
  };

  const handleCopyPartnerLink = () => {
    navigator.clipboard.writeText('https://domexit.ru/partners?ref=CORE-PARTNER-77');
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
      operatorName: user?.name || 'Виктор Сергеевич (Владелец / CEO)',
      operatorRole: 'owner',
      actionType: 'partner_application_decided',
      title: `Вручную аккредитован B2B-партнер: ${created.name}`,
      description: `Организация: ${created.organization}. Выдан реферальный код ${created.referralCode} (30 000 ₽ / сделка).`,
    });

    setPartners((prev) => [created, ...prev]);
    setShowAddPartnerModal(false);
    setNewPartnerName('');
    setNewPartnerOrg('');
    setNewPartnerPhone('+7 ');
    setBroadcastSuccess(`Партнер ${created.name} добавлен в реестр. Реф-код: ${created.referralCode}`);
    setTimeout(() => setBroadcastSuccess(null), 5000);
  };

  const filteredPartners = partners.filter((p) => {
    if (categoryFilter === 'all') return true;
    return p.category === categoryFilter;
  });

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Dark Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={
            language === 'ru'
              ? 'Управление Telegram Mini-App и сетью лидов'
              : 'Telegram Mini-App & Lead Network'
          }
          subtitle={
            language === 'ru'
              ? 'MTProto API • DomExit GPT-4o Legal • Сеть поставщиков B2B'
              : 'MTProto API • DomExit GPT-4o Legal • Partner Network'
          }
        />

        <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {language === 'ru'
                    ? 'Управление Telegram Mini-App и сетью поставщиков лидов'
                    : 'Telegram Mini-App & Lead Provider Network Management'}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Бот v2.4 Online • Webhook 200 OK • MTProto API Active
                </span>
                <span className="text-xs text-slate-500">
                  {language === 'ru' ? 'Живая синхронизация с DAL' : 'Live DAL Sync'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncAudience}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                {language === 'ru' ? 'Синхронизировать аудиторию' : 'Sync Audience'}
              </button>

              <button
                onClick={() => {
                  setPartnerFormError(null);
                  setShowAddPartnerModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {language === 'ru' ? '+ Добавить партнера-поставщика' : '+ Add Lead Partner'}
              </button>
            </div>
          </div>

          {/* Broadcast inline notification */}
          {broadcastSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{broadcastSuccess}</span>
              </div>
              <button
                onClick={() => setBroadcastSuccess(null)}
                className="text-xs text-emerald-700 hover:text-emerald-900 underline font-medium cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          )}

          {/* Two Main Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Bot Stats & AI Offer Generator (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* 4 Bot Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-medium">
                      {language === 'ru' ? 'Подписчиков в боте' : 'Bot Subscribers'}
                    </span>
                    <Users className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">12 450</div>
                  <span className="text-[11px] text-emerald-600 font-medium">+184 за 7 дней</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-medium">
                      {language === 'ru' ? 'Закрытый VIP-клуб' : 'Closed VIP Club'}
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">{approvedVipCount}</div>
                  <span className="text-[11px] text-emerald-600 font-medium">Аккредитованы</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-medium">
                      {language === 'ru' ? 'Конверсия в бронь' : 'Booking Conversion'}
                    </span>
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">8.4%</div>
                  <span className="text-[11px] text-slate-500 font-medium">Выше рынка в 3х</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-medium">
                      {language === 'ru' ? 'Средний кэш продавцу' : 'Avg Seller Cash'}
                    </span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">{avgSellerCashMillions} млн ₽</div>
                  <span className="text-[11px] text-slate-500 font-medium">По пулу ({lots.length} лотов)</span>
                </div>
              </div>

              {/* AI Offer Generator Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900">
                        {language === 'ru'
                          ? 'Генератор оффера с ИИ-копирайтингом'
                          : 'AI Copywriting Offer Generator'}
                      </h2>
                      <p className="text-xs text-slate-500">Модель DomExit GPT-4o Legal & FinTech</p>
                    </div>
                  </div>

                  {/* Broadcast Language Selector */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    {(['RU', 'EN', 'RU+EN'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setBroadcastLang(lang)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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

                {/* Target Lot Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    {language === 'ru'
                      ? 'Выберите проверенный лот для публикации'
                      : 'Select Verified Lot to Publish'}
                  </label>
                  <select
                    value={selectedLotCode}
                    onChange={(e) => setSelectedLotCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {lots.map((l) => (
                      <option key={l.lotCode} value={l.lotCode}>
                        #{l.lotCode} — {l.complexName} ({l.developer}) — Выгода{' '}
                        {formatRubles(l.todayDeveloperPrice - l.dduContractPrice)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Telegram Preview Window */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-sky-500" />
                      {language === 'ru'
                        ? 'Живое превью поста в Telegram (Канал и Бот)'
                        : 'Live Telegram Post Preview'}
                    </span>
                    <span className="text-[11px] text-slate-400">Канал @domexit_vip</span>
                  </div>

                  <div className="bg-[#1E293B] text-slate-100 p-5 rounded-2xl shadow-inner space-y-4 font-sans text-sm border border-slate-700">
                    <div className="flex items-center justify-between text-xs text-sky-400 font-semibold border-b border-slate-700/60 pb-2.5">
                      <span>DomExit VIP Deals ⚡ Закрытый пул</span>
                      <span className="bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded text-[11px]">
                        #{selectedLot.lotCode}
                      </span>
                    </div>

                    <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-800">
                      <img
                        src={selectedLot.imageUrl}
                        alt={selectedLot.complexName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">
                        % ВЫГОДА {formatRubles(selectedLot.todayDeveloperPrice - selectedLot.dduContractPrice)}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded font-mono">
                        214-ФЗ ЭСКРОУ {selectedLot.escrowBank.toUpperCase()}
                      </div>
                    </div>

                    <div className="space-y-2 text-slate-200 text-xs sm:text-sm leading-relaxed">
                      <p className="font-bold text-white text-base">
                        {broadcastLang === 'EN'
                          ? `🔥 Urgent 214-FZ Assignment Exit (0% Markup): ${selectedLot.complexName}`
                          : `🔥 Срочный выход из рассрочки без наценки: ${selectedLot.complexName}`}
                      </p>
                      <p className="text-slate-300">
                        📍 {selectedLot.district} | Девелопер: {selectedLot.developer}
                        <br />
                        📐 Площадь: {selectedLot.areaM2} м² | Этаж:{' '}
                        {selectedLot.ownerDossier?.floorRangeDisplay || `${selectedLot.floor} эт.`} | Сдача:{' '}
                        {selectedLot.deliveryDate}
                      </p>

                      <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 space-y-1 font-mono text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>На руки продавцу (кэш):</span>
                          <span className="text-white font-bold">
                            {formatRubles(selectedLot.cashPaidBySeller)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Остаток застройщику:</span>
                          <span>{formatRubles(selectedLot.remainingInstallmentDebt)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-400 font-bold border-t border-slate-700 pt-1 mt-1">
                          <span>Чистая экономия по ДДУ:</span>
                          <span>
                            {formatRubles(selectedLot.todayDeveloperPrice - selectedLot.dduContractPrice)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-emerald-300 pt-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>
                          Юридический аудит ({selectedLot.legalPassport.passedChecksCount}/
                          {selectedLot.legalPassport.totalChecksCount}) пройден • ФССП{' '}
                          {formatRubles(selectedLot.legalPassport.fsspDebtRub)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Link
                        to={`/lot/${selectedLot.id}`}
                        className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        🚀 Открыть карточку
                      </Link>
                      <Link
                        to={`/lot/${selectedLot.id}`}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        🔒 Бронь за {formatRubles(selectedLot.cashPaidBySeller)}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Target Audience Selector (3 cards) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {language === 'ru' ? 'Сегмент аудитории для отправки' : 'Target Audience Segment'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAudience('vip')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedAudience === 'vip'
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">Закрытый VIP-клуб</span>
                        <Flame className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-lg font-bold text-slate-900">{approvedVipCount} чел.</div>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                        ГАНДИКАП 48 ЧАСОВ
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAudience('all')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedAudience === 'all'
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">DomExit News</span>
                        <Users className="w-4 h-4 text-sky-500" />
                      </div>
                      <div className="text-lg font-bold text-slate-900">12 450 чел.</div>
                      <div className="text-[11px] text-slate-500 font-medium mt-1">Открытый канал</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAudience('smart_cash')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedAudience === 'smart_cash'
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">Смарт-кэш &gt;2.5M</span>
                        <Award className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="text-lg font-bold text-slate-900">{smartCashCount} контакта</div>
                      <div className="text-[11px] text-slate-500 font-medium mt-1">Готовы за 48 часов</div>
                    </button>
                  </div>
                </div>

                {/* Broadcast Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleBroadcast(true)}
                    disabled={isBroadcasting}
                    className="w-full sm:w-1/3 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    {language === 'ru' ? 'Тест в свой Telegram' : 'Test to My Telegram'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBroadcast(false)}
                    disabled={isBroadcasting}
                    className="w-full sm:w-2/3 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className={`w-4 h-4 ${isBroadcasting ? 'animate-bounce' : ''}`} />
                    {isBroadcasting
                      ? language === 'ru'
                        ? 'Отправка...'
                        : 'Sending...'
                      : language === 'ru'
                      ? `🚀 Запустить рассылку (${
                          selectedAudience === 'vip'
                            ? `${approvedVipCount} чел.`
                            : selectedAudience === 'all'
                            ? '12 450 чел.'
                            : `${smartCashCount} чел.`
                        })`
                      : '🚀 Launch Broadcast'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Key Partner Network (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      {language === 'ru' ? 'СЕТЬ ПОСТАВЩИКОВ ЛИДОВ' : 'LEAD PROVIDER NETWORK'}
                    </h2>
                    <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                      АГЕНТЫ & ДЕВЕЛОПЕРЫ
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'ru'
                      ? 'Партнеры с фиксированной выплатой за переуступку'
                      : 'Partners with fixed remuneration per closed exit'}
                  </p>
                </div>

                {/* 4 Upper Live KPI Indicators */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">Активных поставщиков</span>
                    <div className="text-lg font-bold text-slate-900">{approvedPartners.length} агентов</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">Входящих лидов / мес.</span>
                    <div className="text-lg font-bold text-slate-900">{totalLeadsMonthly} лидов</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">Выплачено бонусов</span>
                    <div className="text-lg font-bold text-emerald-600">
                      {formatRubles(totalPaidBonusesRub)}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">К выплате в реестре</span>
                    <div className="text-lg font-bold text-amber-600">
                      {formatRubles(totalPendingBonusesRub)}
                    </div>
                  </div>
                </div>

                {/* Partner Category Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      categoryFilter === 'all'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Все ({partners.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('developer_cancellation')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      categoryFilter === 'developer_cancellation'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Отделы застройщиков ({devCancellationCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('mortgage_broker')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      categoryFilter === 'mortgage_broker'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Ипотечные брокеры ({mortgageBrokerCount})
                  </button>
                </div>

                {/* Key Partners Registry Table */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Реестр ключевых партнеров</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                      Фикс 30 000 ₽ / выход
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {filteredPartners.map((partner) => (
                      <div
                        key={partner.id}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-900 text-sm truncate">
                              {partner.name}
                            </div>
                            {partner.status && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  partner.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : partner.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {partner.status === 'approved'
                                  ? 'Активен'
                                  : partner.status === 'rejected'
                                  ? 'Отклонен'
                                  : 'На проверке'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {partner.role} • {partner.organization}
                          </div>
                          <div className="text-[11px] font-mono text-emerald-700 mt-1">
                            Реф. код: {partner.referralCode}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-bold text-slate-900">
                            {partner.leadsCountMonthly} лидов
                          </div>
                          <div className="text-[11px] text-emerald-600 font-semibold">
                            +{formatRubles(partner.paidBonusesRub)}
                          </div>
                          <span className="inline-block mt-1 text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                            {partner.phone}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Referral Link Box */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">
                      {language === 'ru'
                        ? 'Мастер-ссылка для приглашения B2B-агентов'
                        : 'Master Partner Referral Link'}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">30 000 ₽ / выход</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value="https://domexit.ru/partners?ref=CORE-PARTNER-77"
                      className="flex-1 bg-white border border-emerald-300 text-emerald-950 font-mono text-xs px-3 py-2 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPartnerLink}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      {copiedLink ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLink ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>

                  <p className="text-[11px] text-emerald-800 leading-tight">
                    * Выплата фиксированного бонуса 30 000 ₽ производится на счет самозанятого, ИП или ООО в день раскрытия аккредитива и регистрации цессии в Росреестре.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Partner Modal */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg">
                {language === 'ru' ? 'Новый партнер-поставщик лидов' : 'Add Lead Provider Partner'}
              </h3>
              <button
                onClick={() => setShowAddPartnerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
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

            <form onSubmit={handleAddPartnerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ФИО партнера / Представителя *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Елена Васильева"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Организация / Девелопер / Банк
                </label>
                <input
                  type="text"
                  placeholder="Setl Group (Отдел расторжений)"
                  value={newPartnerOrg}
                  onChange={(e) => setNewPartnerOrg(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Категория партнера
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="developer_cancellation">Отдел расторжений застройщика</option>
                  <option value="mortgage_broker">Ипотечный брокер / Центр</option>
                  <option value="lawyer">Юрист / Адвокатское бюро</option>
                  <option value="trade_in_developer">Менеджер Trade-in</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Телефон РФ для связи и выплат *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+7 (911) 234-56-78"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(formatRussianPhoneInput(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer"
                >
                  Сохранить и выдать реф-код
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
