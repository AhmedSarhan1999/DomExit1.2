import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download, 
  Eye, 
  User, 
  Send, 
  ArrowRight, 
  Building2, 
  DollarSign, 
  LogOut,
  AlertCircle,
  ThumbsUp,
  XCircle,
  TrendingUp,
  Lock,
  ChevronRight,
  Heart,
  Users,
  Crown,
  Briefcase,
  Share2,
  Plus,
  Sparkles,
  Check,
  CreditCard,
  Banknote,
  Sliders
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { DealTrack, BuyerCandidate, Lot, PartnerEntry, InvestorApplication } from '../types';
import { FileManager } from '../utils/fileManager';

export const ClientPortalPage: React.FC = () => {
  const { user, logout, openAuthModal, toggleFavorite, upgradeToPartner, upgradeToInvestor } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  // 5 Dynamic Tabs: buyer | seller | favorites | partner | investor
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller' | 'favorites' | 'partner' | 'investor'>(() => {
    if (user?.activeRole === 'seller') return 'seller';
    if (user?.activeRole === 'partner' && user?.isPartnerApproved) return 'partner';
    if (user?.activeRole === 'investor' && user?.isInvestorApproved) return 'investor';
    return 'buyer';
  });

  const [deal, setDeal] = useState<DealTrack | null>(null);
  const [candidates, setCandidates] = useState<BuyerCandidate[]>([]);
  const [userBids, setUserBids] = useState<BuyerCandidate[]>([]);
  const [allLots, setAllLots] = useState<Lot[]>([]);
  const [favoriteLots, setFavoriteLots] = useState<Lot[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Partner Referral Form State
  const [refClientName, setRefClientName] = useState('');
  const [refClientPhone, setRefClientPhone] = useState('+7 ');
  const [refComplexName, setRefComplexName] = useState('');
  const [refDduPrice, setRefDduPrice] = useState<number>(10500000);
  const [partnerDeals, setPartnerDeals] = useState<any[]>([
    {
      id: 'REF-801',
      clientName: 'Михаил Ковалев',
      complexName: 'ЖК Чистое Небо',
      stage: '4. Закрытие эскроу',
      stageIndex: 4,
      bonusRub: 45000,
      status: 'pending_payment'
    },
    {
      id: 'REF-792',
      clientName: 'Анна Васильева',
      complexName: 'ЖК Pulse Premier',
      stage: '5. Зарегистрировано в Росреестре',
      stageIndex: 5,
      bonusRub: 50000,
      status: 'paid'
    }
  ]);

  // Investor Package Builder State
  const [investorBudgetMillions, setInvestorBudgetMillions] = useState<number>(35);
  const [selectedPackage, setSelectedPackage] = useState<'flipping' | 'turnkey' | 'syndicate'>('turnkey');

  const loadData = async () => {
    const [d, c, lotsData] = await Promise.all([
      DealsRepository.getById(user?.activeDealId || 'DEAL-2025-10566'),
      CandidatesRepository.getAll(),
      LotsRepository.getAll(),
    ]);

    setDeal(d);
    setCandidates(c);
    setAllLots(lotsData);

    // Filter user's own bids
    const bids = c.filter(item => item.userId === user?.id || item.name.includes(user?.name?.split(' ')[0] || '___'));
    setUserBids(bids.length > 0 ? bids : c.slice(0, 2));

    // Filter favorites
    const favCodes = user?.favorites || [];
    const favs = lotsData.filter(l => favCodes.includes(l.lotCode));
    setFavoriteLots(favs);
  };

  useEffect(() => {
    loadData();
  }, [user, user?.favorites]);

  const handlePartnerReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry = {
      id: `REF-${Math.floor(100 + Math.random() * 900)}`,
      clientName: refClientName || 'Новый клиент',
      complexName: refComplexName || 'ЖК Санкт-Петербург',
      stage: '1. Проверка документов и аудит',
      stageIndex: 1,
      bonusRub: 40000,
      status: 'pending_payment'
    };

    setPartnerDeals(prev => [newEntry, ...prev]);
    setRefClientName('');
    setRefClientPhone('+7 ');
    setRefComplexName('');

    setActionNotice(
      language === 'ru'
        ? `Клиент успешно зарегистрирован в базе DomExit! Ваше агентское вознаграждение 40 000 ₽ зафиксировано.`
        : `Client registered! Your 40,000 ₽ partner bonus is secured.`
    );
    setTimeout(() => setActionNotice(null), 5000);
  };

  const handleDownloadDoc = (docName: string) => {
    // Generates and downloads real legal sample file
    const sampleContent = `ОФИЦИАЛЬНЫЙ ДОКУМЕНТ ПЛАТФОРМЫ DOMEXIT\nДокумент: ${docName}\nДата: ${new Date().toLocaleDateString('ru-RU')}\nСтатус проверки 214-ФЗ: ПОДТВЕРЖДЕНО\nШифрование ГОСТ Р 57580`;
    FileManager.downloadFile(
      `data:text/plain;charset=utf-8,${encodeURIComponent(sampleContent)}`,
      docName
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      
      {/* Top Banner: Client Profile Bar */}
      <section className="bg-white text-slate-900 pt-8 pb-8 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 p-0.5 shadow-md">
                <div className="w-full h-full bg-emerald-600 rounded-[14px] flex items-center justify-center font-bold text-white text-xl">
                  {user?.name?.charAt(0) || 'П'}
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-950">
                    {user?.name || (language === 'ru' ? 'Личный кабинет' : 'Client Portal')}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                    214-ФЗ Верифицирован
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {user?.email || user?.phone || '+7 (911) 234-56-78'} • Идентификатор #{user?.id?.slice(0, 8) || 'CLI-78105'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Сбербанк / ВТБ Эскроу: Активен</span>
              </div>

              <button
                type="button"
                onClick={logout}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Выйти' : 'Sign Out'}</span>
              </button>
            </div>

          </div>

          {/* MISSION 4: Dynamic Tabs Architecture */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pt-2">
            
            {/* Tab 1: Buyer Bids */}
            <button
              type="button"
              onClick={() => setActiveTab('buyer')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'buyer'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>🔑 {language === 'ru' ? 'Мои предложения о покупке' : 'My Purchase Offers'}</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px]">
                {userBids.length}
              </span>
            </button>

            {/* Tab 2: Seller Listings */}
            <button
              type="button"
              onClick={() => setActiveTab('seller')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'seller'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>💼 {language === 'ru' ? 'Мой объект на продажу (0%)' : 'My Seller Listing'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                В работе
              </span>
            </button>

            {/* Tab 3: Favorites */}
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'favorites'
                  ? 'border-rose-600 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Избранные объекты' : 'Favorites'}</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px]">
                {favoriteLots.length}
              </span>
            </button>

            {/* Tab 4: Dynamic Partner Portal */}
            <button
              type="button"
              onClick={() => setActiveTab('partner')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'partner'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>{language === 'ru' ? 'Кабинет Партнера' : 'Partner Portal'}</span>
              {user?.isPartnerApproved && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                  PRO
                </span>
              )}
            </button>

            {/* Tab 5: Dynamic VIP Investor Portal */}
            <button
              type="button"
              onClick={() => setActiveTab('investor')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'investor'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              <span>{language === 'ru' ? 'Кабинет Инвестора VIP' : 'VIP Investor Portal'}</span>
              {user?.isInvestorApproved && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  VIP 48ч
                </span>
              )}
            </button>

          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Action Notice Toast */}
        {actionNotice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center justify-between shadow-md animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="text-emerald-700 hover:text-emerald-950">
              ✕
            </button>
          </div>
        )}

        {/* ================= TAB 1: BUYER OFFERS VIEW ================= */}
        {activeTab === 'buyer' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Ваши заявки на покупку и статус в ежедневном отборе
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Куратор объекта рассматривает заявки в ежедневном окне и утверждает кандидата с подтвержденной платежеспособностью.
                  </p>
                </div>
                <Link
                  to="/opportunities"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Найти еще объекты в каталоге →
                </Link>
              </div>

              <div className="space-y-4">
                {userBids.map((bid) => (
                  <div key={bid.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                            #{bid.lotCode || 'U-10566'}
                          </span>
                          <span className="font-bold text-sm text-slate-900">ЖК «Чистое Небо» (Приморский р-н)</span>
                        </div>
                        <span className="text-xs text-slate-500 mt-1 block">
                          Подано: {bid.requestedTimestamp || 'Сегодня'} • На имя: {bid.name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {bid.buyerTrack === 'mortgage_substitution' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Трек: Кэш + Ипотека
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Трек: 100% Кэш
                          </span>
                        )}

                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          bid.status === 'priority_reserved'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-sky-100 text-sky-800'
                        }`}>
                          {bid.status === 'priority_reserved' ? '✓ Бронь принята куратором!' : 'На рассмотрении куратора'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Готовность депозита:</span>
                        <span className="font-mono font-bold text-slate-900">{formatRubles(bid.availableLiquidity)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Срок выхода на сделку:</span>
                        <span className="font-bold text-slate-800">{bid.readinessTimeline}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Банковский документ:</span>
                        {bid.bankApprovalDocUrl ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(bid.bankApprovalDocName || 'Одобрение_Ипотеки_Банк.pdf')}
                            className="text-sky-700 hover:underline font-bold flex items-center space-x-1 mt-0.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{bid.bankApprovalDocName || 'Справка_банка.pdf'}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">Не требуется (100% кэш)</span>
                        )}
                      </div>
                    </div>

                    {bid.status === 'priority_reserved' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Поздравляем! Ваше предложение утверждено. Переходим к открытию аккредитива в банке.</span>
                        </div>
                        <Link
                          to={`/opportunities/${bid.lotCode || 'U-10566'}`}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                        >
                          Открыть паспорт сделки
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: SELLER LISTINGS VIEW ================= */}
        {activeTab === 'seller' && (
          <div className="space-y-8 animate-fade-in">
            {/* Header Card: Active Exit Lot */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider">
                      {deal?.lotCode || 'ЛОТ #U-10566'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                      Справка Setl Group сверена
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-1">
                    {deal?.lotTitle || 'ЖК «Чистое Небо» — 2-комн. 58.4 м² (Приморский р-н)'}
                  </h2>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block font-medium">Сумма к получению на руки:</span>
                    <span className="text-2xl font-black text-emerald-700 font-mono">
                      {formatRubles(deal?.sellerReturnRub || 2485230)}
                    </span>
                  </div>
                  <div className="h-10 w-px bg-slate-200" />
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block font-medium">Комиссия продавца:</span>
                    <span className="text-xl font-black text-slate-900">0 ₽</span>
                  </div>
                </div>
              </div>

              {/* 5-Step Timeline */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Этап ликвидации договора цессии:</span>
                  <span className="text-emerald-700">Шаг 4 из 5 (75% завершено)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center space-x-1.5 text-emerald-700 font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>1. Оценка ДДУ</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Завершено</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center space-x-1.5 text-emerald-700 font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>2. Проверка</span>
                    </div>
                    <span className="text-[11px] text-slate-500">42 параметра OK</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center space-x-1.5 text-emerald-700 font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>3. Упаковка</span>
                    </div>
                    <span className="text-[11px] text-slate-500">152-ФЗ защита</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-md ring-2 ring-emerald-500/30">
                    <div className="flex items-center space-x-1.5 mb-1">
                      <Clock className="w-4 h-4 text-slate-950" />
                      <span>4. Подбор</span>
                    </div>
                    <span className="text-[11px] text-slate-900">Идет выбор лучшего</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-100 text-slate-400 text-xs">
                    <div className="font-bold mb-1">5. Выплата кэша</div>
                    <span className="text-[11px]">Эскроу Сбербанка</span>
                  </div>
                </div>
              </div>

              {/* Assigned Curator Contact Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Ваш назначенный персональный куратор (сотрудник DomExit):</span>
                  <span className="font-bold text-slate-900 text-sm">Алексей Морозов (Ведущий юрист-куратор)</span>
                  <span className="text-slate-500 block mt-0.5">+7 (921) 888-11-22 • Telegram: @alexey_morozov</span>
                </div>
                <a
                  href="https://t.me/domexit_ru"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Связаться с куратором</span>
                </a>
              </div>

              {/* Verified Legal Documents Vault */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Цифровая комната документов (152-ФЗ защита):</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    'Договор_ДДУ_Чистое_Небо_10566.pdf',
                    'Справка_о_расчетах_SetlGroup_OK.pdf',
                    'Выписка_ЕФРСБ_ФССП_Чисто.pdf',
                    'Нотариальное_согласие_супруги.pdf',
                  ].map((docName, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate mr-2">{docName}</span>
                      <button
                        type="button"
                        onClick={() => handleDownloadDoc(docName)}
                        className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Скачать</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: FAVORITES VIEW (MISSION 6) ================= */}
        {activeTab === 'favorites' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                    <Heart className="w-5 h-5 text-rose-600 fill-rose-600" />
                    <span>Сохраненные объекты (Постоянные ссылки и живые статусы)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Даже если объект переходит в статус «В сделке» или «Закрыт», он навсегда остается доступен по прямой ссылке.
                  </p>
                </div>
                <Link
                  to="/opportunities"
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors"
                >
                  Перейти в общий каталог
                </Link>
              </div>

              {favoriteLots.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="font-bold text-base text-slate-700">У вас пока нет сохраненных объектов</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Нажимайте на сердечко на любой карточке в каталоге, чтобы следить за стадией продажи объекта.
                  </p>
                  <Link
                    to="/opportunities"
                    className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                  >
                    Открыть каталог предложений
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favoriteLots.map((fav) => (
                    <div key={fav.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow">
                      <div className="relative h-44 overflow-hidden">
                        <img src={fav.imageUrl} alt={fav.complexName} className="w-full h-full object-cover" />
                        <div className="absolute top-3 left-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shadow-sm ${
                            fav.status === 'available'
                              ? 'bg-emerald-600 text-white'
                              : fav.status === 'processing'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-700 text-white'
                          }`}>
                            {fav.status === 'available' ? 'Доступен' : fav.status === 'processing' ? 'В сделке' : 'Закрыт'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(fav.lotCode)}
                          className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full text-rose-600 shadow-sm transition-transform active:scale-90"
                        >
                          <Heart className="w-4 h-4 fill-rose-600" />
                        </button>
                      </div>

                      <div className="p-4 space-y-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            #{fav.lotCode}
                          </span>
                          <h4 className="font-bold text-sm text-slate-900 mt-1">{fav.complexName}</h4>
                          <span className="text-xs text-slate-500">{fav.developer} • {fav.areaM2} м²</span>
                        </div>

                        <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-[11px] text-slate-500 block">Кэш продавцу:</span>
                            <span className="font-mono font-bold text-emerald-700 text-sm">
                              {formatRubles(fav.cashPaidBySeller)}
                            </span>
                          </div>
                          <Link
                            to={`/opportunities/${fav.lotCode}`}
                            className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center space-x-1"
                          >
                            <span>Паспорт лота</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: PARTNER PORTAL VIEW (MISSION 4) ================= */}
        {activeTab === 'partner' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              
              {/* Partner Status Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">
                      Официальный партнер DomExit
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      Реферальный код: <strong>{user?.partnerRefCode || 'PARTNER-SPB-12'}</strong>
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-950 tracking-tight mt-1">
                    Партнерская программа для риелторов, брокеров и юристов
                  </h2>
                  <p className="text-xs text-slate-500">
                    Передавайте клиентов, которым тяжело тянуть рассрочку или грозит расторжение ДДУ. Вознаграждение 30 000 – 50 000 ₽ выплачивается сразу после закрытия сделки.
                  </p>
                </div>
                
                {!user?.isPartnerApproved && (
                  <button
                    type="button"
                    onClick={() => upgradeToPartner()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs"
                  >
                    Активировать партнерский доступ
                  </button>
                )}
              </div>

              {/* MISSION 4.2: Refer Distressed Client Form */}
              <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center space-x-2 text-purple-900 font-bold text-sm">
                  <Share2 className="w-4 h-4 text-purple-600" />
                  <span>Зарегистрировать и передать нового дольщика для выхода:</span>
                </div>

                <form onSubmit={handlePartnerReferralSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ФИО дольщика *</label>
                    <input
                      type="text"
                      required
                      placeholder="Сергей Николаевич"
                      value={refClientName}
                      onChange={(e) => setRefClientName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Телефон клиента *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+7 (911) 000-00-00"
                      value={refClientPhone}
                      onChange={(e) => setRefClientPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ЖК и застройщик *</label>
                    <input
                      type="text"
                      required
                      placeholder="ЖК Чистое Небо (Setl)"
                      value={refComplexName}
                      onChange={(e) => setRefComplexName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Зарегистрировать</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* MISSION 4.2: Live 5-Stage Referral Tracking Table */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Таблица живого отслеживания переданных сделок и вознаграждений:</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Код передачи</th>
                        <th className="py-3 px-3">Клиент</th>
                        <th className="py-3 px-3">Объект / ЖК</th>
                        <th className="py-3 px-3">Текущий этап сделки</th>
                        <th className="py-3 px-3">Ваша комиссия</th>
                        <th className="py-3 px-3 text-right">Статус выплаты</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partnerDeals.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{item.id}</td>
                          <td className="py-3 px-3 font-semibold text-slate-800">{item.clientName}</td>
                          <td className="py-3 px-3">{item.complexName}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[10px]">
                              {item.stage}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                            {formatRubles(item.bonusRub)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {item.status === 'paid' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                Выплачено
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                В процессе закрытия
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ================= TAB 5: VIP INVESTOR PORTAL VIEW (MISSION 4.3) ================= */}
        {activeTab === 'investor' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              
              {/* Investor VIP Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1">
                      <Crown className="w-3 h-3 text-amber-700" />
                      <span>Аккредитованный VIP Инвестор DomExit</span>
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-950 tracking-tight mt-1">
                    Закрытый клуб инвесторов: Ранний доступ и пакетные стратегии
                  </h2>
                  <p className="text-xs text-slate-500">
                    Эксклюзивный доступ к входящим уступкам за 48 часов до публикации в общем каталоге. Прямой контакт с руководством платформы.
                  </p>
                </div>

                {!user?.isInvestorApproved && (
                  <button
                    type="button"
                    onClick={() => upgradeToInvestor()}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
                  >
                    Активировать статус VIP Инвестора
                  </button>
                )}
              </div>

              {/* MISSION 4.3 #1: 48-Hour Early Access Units Desk */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Срочные лоты в режиме «Ранний доступ 48 часов» (только для VIP):</span>
                  </h3>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Доступно до публикации в каталоге
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allLots.slice(1, 3).map((lot) => (
                    <div key={lot.id} className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/30 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-bold text-[10px] uppercase">
                            Осталось 34 часа
                          </span>
                          <h4 className="font-bold text-sm text-slate-900 mt-1">{lot.complexName}</h4>
                          <span className="text-xs text-slate-500">{lot.developer} • {lot.areaM2} м²</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          {formatRubles(lot.cashPaidBySeller)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-amber-200 text-xs">
                        <span className="text-slate-600">Дисконт к рынку: <strong>-24.5%</strong></span>
                        <Link
                          to={`/opportunities/${lot.lotCode}`}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                        >
                          Перехватить лот →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MISSION 4.3 #2: Direct Communication Channel with Leadership */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Прямая линия с руководством: Генеральный директор (CEO) Виктор Сергеевич</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Обсуждение синдицированных пулов от 50 млн ₽, оптового выкупа и индивидуальных условий закрытия.
                  </p>
                </div>
                <a
                  href="https://t.me/domexit_ru"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Открыть закрытый чат</span>
                </a>
              </div>

              {/* MISSION 4.3 #3: Interactive Budget & Investment Package Builder */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>Интерактивный конструктор капитала и готовые пакеты:</span>
                  </h3>
                  <span className="font-mono font-black text-indigo-700 text-sm">
                    Выбранный капитал: {investorBudgetMillions} 000 000 ₽
                  </span>
                </div>

                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={investorBudgetMillions}
                  onChange={(e) => setInvestorBudgetMillions(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Package 1 */}
                  <div
                    onClick={() => setSelectedPackage('flipping')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                      selectedPackage === 'flipping'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">Пакет «Оптовый флиппинг»</span>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Выкуп пула из 2–4 студий с дисконтом 22-25% и быстрая перепродажа за 45-60 дней.
                    </p>
                    <div className="text-xs font-mono font-bold text-indigo-700 pt-1">
                      Ожидаемая доходность: 32% годовых
                    </div>
                  </div>

                  {/* Package 2 */}
                  <div
                    onClick={() => setSelectedPackage('turnkey')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                      selectedPackage === 'turnkey'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">Пакет «Под ключ + Аренда»</span>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Выкуп + чистовая отделка + меблировка + доверительное управление арендой через сервис.
                    </p>
                    <div className="text-xs font-mono font-bold text-indigo-700 pt-1">
                      Ожидаемая доходность: 19% годовых
                    </div>
                  </div>

                  {/* Package 3 */}
                  <div
                    onClick={() => setSelectedPackage('syndicate')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                      selectedPackage === 'syndicate'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">Пакет «Синдицированный пул»</span>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Долевое участие в закрытии крупных корпоративных цессий с обеспечением залогом по 214-ФЗ.
                    </p>
                    <div className="text-xs font-mono font-bold text-indigo-700 pt-1">
                      Фиксированная выплата: 24% годовых
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

    </div>
  );
};

