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
  Sliders,
  Copy,
  ExternalLink,
  FileCheck,
  Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { PartnerRequestsRepository } from '../dal/repositories/PartnerRequestsRepository';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { DealTrack, BuyerCandidate, Lot, PartnerEntry, InvestorApplication, PartnerPreliminaryRequest, BuyerCreditLimitRequest, Employee } from '../types';
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
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Task 4: 7-Day Partner Preliminary Requests & Completion
  const [pendingPreliminaryReqs, setPendingPreliminaryReqs] = useState<PartnerPreliminaryRequest[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerPreliminaryRequest[]>([]);
  const [selectedReqForCompletion, setSelectedReqForCompletion] = useState<PartnerPreliminaryRequest | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false);
  const [completionFileUploaded, setCompletionFileUploaded] = useState<boolean>(false);
  const [completionNotes, setCompletionNotes] = useState<string>('');

  // Task 6: Buyer Bank Credit Limit State
  const [creditLimitRequest, setCreditLimitRequest] = useState<BuyerCreditLimitRequest | null>(null);
  const [isCreditLimitModalOpen, setIsCreditLimitModalOpen] = useState<boolean>(false);
  const [requestedCreditAmount, setRequestedCreditAmount] = useState<number>(8500000);
  const [selectedBank, setSelectedBank] = useState<string>('Сбербанк');
  const [curator, setCurator] = useState<Employee | null>(null);

  // Partner Referral Form State
  const [refClientCode, setRefClientCode] = useState<string>('');
  const [refClientName, setRefClientName] = useState<string>('');
  const [refClientPhone, setRefClientPhone] = useState<string>('+7 ');
  const [refComplexName, setRefComplexName] = useState<string>('');
  const [refDeveloper, setRefDeveloper] = useState<string>('Setl Group');
  const [refPaidAmount, setRefPaidAmount] = useState<number>(2500000);
  const [refDduPrice, setRefDduPrice] = useState<number>(10500000);
  const [refNotes, setRefNotes] = useState<string>('');
  const [partnerError, setPartnerError] = useState<string | null>(null);

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

  const formatRemainingTime = (expiresAt: string): { text: string; isExpired: boolean } => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) {
      return { text: language === 'ru' ? 'Срок истек' : 'Expired', isExpired: true };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return {
      text: language === 'ru' ? `${days} дн. ${hours} ч. ${minutes} мин.` : `${days}d ${hours}h ${minutes}m`,
      isExpired: false
    };
  };

  const loadData = async () => {
    const clientCode = user?.clientCode || 'DEX-784105';
    const [d, c, lotsData, pendingReqs, allPartnerReqs, allCreditLimits, allEmps] = await Promise.all([
      DealsRepository.getById(user?.activeDealId || 'DEAL-2025-10566'),
      CandidatesRepository.getAll(),
      LotsRepository.getAll(),
      PartnerRequestsRepository.getPendingByClientCode(clientCode),
      PartnerRequestsRepository.getAll(),
      BankPortalRepository.getAllCreditLimitRequests(),
      EmployeesRepository.getAll(),
    ]);

    setDeal(d);
    setCandidates(c);
    setAllLots(lotsData);
    setPendingPreliminaryReqs(pendingReqs);
    setPartnerRequests(allPartnerReqs);
    if (allEmps && allEmps.length > 0) {
      setCurator(allEmps[0]);
    }

    // Find credit limit for current user
    const userLimit = allCreditLimits.find(l => l.userId === user?.id || l.clientCode === clientCode);
    if (userLimit) {
      setCreditLimitRequest(userLimit);
    } else if (user?.bankCreditLimit) {
      setCreditLimitRequest({
        id: 'user-cached-limit',
        userId: user.id,
        clientCode: user.clientCode || 'DEX-409112',
        userName: user.name,
        userPhone: user.phone || '+7 (921) 000-00-00',
        requestedAmountRub: user.bankCreditLimit.approvedLimitRub,
        approvedLimitRub: user.bankCreditLimit.approvedLimitRub,
        validUntil: user.bankCreditLimit.validUntil,
        bankName: user.bankCreditLimit.bankName,
        certificateNumber: user.bankCreditLimit.certificateNumber,
        reviewedBy: 'Ведущий специалист банка',
        requestedAt: user.bankCreditLimit.issuedAt,
        status: 'approved',
      });
    }

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
    setPartnerError(null);

    const cleanCode = refClientCode.trim().toUpperCase();
    if (!cleanCode.startsWith('DEX-')) {
      setPartnerError(
        language === 'ru'
          ? 'Пожалуйста, введите уникальный ID клиента в формате DEX-XXXXXX (например, DEX-784105).'
          : 'Please enter a valid client ID formatted as DEX-XXXXXX (e.g. DEX-784105).'
      );
      return;
    }

    const verifiedUser = await PartnerRequestsRepository.verifyClientCode(cleanCode);
    if (!verifiedUser) {
      setPartnerError(
        language === 'ru'
          ? `Клиент с номером «${cleanCode}» не найден в реестре. Дольщик должен сначала зарегистрироваться на DomExit и передать вам свой персональный ID аккаунта.`
          : `Client with ID "${cleanCode}" not found. The client must first register on DomExit to receive their personal account ID.`
      );
      return;
    }

    const newReq = await PartnerRequestsRepository.createPreliminaryRequest({
      partnerId: user?.id || 'partner-current',
      partnerName: user?.name || 'Партнер DomExit',
      partnerRefCode: user?.partnerRefCode || 'PARTNER-SPB-12',
      clientCode: cleanCode,
      clientName: refClientName || verifiedUser.name || 'Дольщик',
      clientPhone: refClientPhone || verifiedUser.phone || '+7 (911) 000-00-00',
      complexName: refComplexName,
      developer: refDeveloper || 'Застройщик',
      paidAmountRub: refPaidAmount,
      contractPriceRub: refDduPrice,
      notes: refNotes,
    });

    setPartnerRequests(prev => [newReq, ...prev]);
    setRefClientCode('');
    setRefClientName('');
    setRefClientPhone('+7 ');
    setRefComplexName('');
    setRefNotes('');

    setActionNotice(
      language === 'ru'
        ? `Предварительный запрос для клиента [${newReq.clientCode}] успешно отправлен! В кабинете клиента включен 7-дневный таймер для загрузки ДДУ.`
        : `Preliminary request sent for client [${newReq.clientCode}]! A 7-day countdown has been started in the client portal.`
    );
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handleCompletePreliminaryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqForCompletion) return;

    if (!completionFileUploaded) {
      alert(language === 'ru' ? 'Пожалуйста, прикрепите скан или фото договора ДДУ!' : 'Please attach your DDU agreement!');
      return;
    }

    await PartnerRequestsRepository.completeByClient(selectedReqForCompletion.id, 'lot-new-submitted');
    setIsCompleteModalOpen(false);
    setSelectedReqForCompletion(null);
    setCompletionFileUploaded(false);

    setActionNotice(
      language === 'ru'
        ? 'Договор ДДУ успешно прикреплен! Заявка передана на юридическую проверку куратору DomExit.'
        : 'DDU agreement uploaded! Your application has been handed over to the legal curator.'
    );
    loadData();
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handleRequestCreditLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const req = await BankPortalRepository.requestCreditLimit({
      userId: user?.id || 'user-current',
      clientCode: user?.clientCode || 'DEX-784105',
      userName: user?.name || 'Клиент DomExit',
      userPhone: user?.phone || '+7 (921) 000-00-00',
      userEmail: user?.email,
      requestedAmountRub: requestedCreditAmount,
      bankName: selectedBank,
    });

    setCreditLimitRequest(req);
    setIsCreditLimitModalOpen(false);
    setActionNotice(
      language === 'ru'
        ? `Запрос на кредитный лимит передан в ${selectedBank}. Специалист банка рассмотрит заявку в течение 24 часов.`
        : `Credit limit request submitted to ${selectedBank}. Bank officer will review within 24 hours.`
    );
    setTimeout(() => setActionNotice(null), 6000);
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
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-500">
                    {user?.email || user?.phone || '+7 (911) 234-56-78'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <div className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200/90 text-slate-900 border border-slate-300 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shadow-xs">
                    <span className="text-slate-500 font-sans font-medium text-[11px]">{language === 'ru' ? 'Уникальный ID клиента:' : 'Unique Client ID:'}</span>
                    <span className="text-indigo-700 tracking-wide font-black">{user?.clientCode || 'DEX-784105'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = user?.clientCode || 'DEX-784105';
                        navigator.clipboard.writeText(code);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2500);
                      }}
                      className="p-1 hover:bg-white rounded transition-colors cursor-pointer text-slate-600 hover:text-indigo-600"
                      title={language === 'ru' ? 'Скопировать ID клиента' : 'Copy Client ID'}
                    >
                      {copiedCode ? (
                        <span className="text-emerald-600 text-[10px] font-sans flex items-center space-x-0.5">
                          <Check className="w-3.5 h-3.5" />
                          <span>{language === 'ru' ? 'Скопировано!' : 'Copied!'}</span>
                        </span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
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

        {/* MISSION 4: 7-Day Countdown Alert for Pending Partner Preliminary Request */}
        {pendingPreliminaryReqs.length > 0 && (
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-500/10 border-2 border-amber-400 shadow-xl space-y-3 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] uppercase tracking-wider">
                      {language === 'ru' ? 'Срочный запрос партнера • 7 дней' : 'Urgent Partner Request • 7 Days'}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900">
                      ID: {pendingPreliminaryReqs[0].clientCode}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 mt-1">
                    {language === 'ru'
                      ? `Партнер «${pendingPreliminaryReqs[0].partnerName}» открыл предварительный запрос на чистый выход`
                      : `Partner "${pendingPreliminaryReqs[0].partnerName}" opened preliminary clean exit request`}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 mt-1">
                    {language === 'ru'
                      ? `Объект: ${pendingPreliminaryReqs[0].complexName} (${pendingPreliminaryReqs[0].developer}). Подтвердите данные и прикрепите фото договора ДДУ для запуска юридического аудита куратором DomExit.`
                      : `Property: ${pendingPreliminaryReqs[0].complexName} (${pendingPreliminaryReqs[0].developer}). Please confirm and upload your DDU agreement to start the curator audit.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <div className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 shadow-xs flex items-center space-x-2 text-xs font-mono font-bold text-amber-900">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>
                    {language === 'ru' ? 'Осталось: ' : 'Remaining: '}
                    {formatRemainingTime(pendingPreliminaryReqs[0].expiresAt).text}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedReqForCompletion(pendingPreliminaryReqs[0]);
                    setIsCompleteModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{language === 'ru' ? 'Подтвердить и прикрепить ДДУ' : 'Confirm & Upload DDU'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 1: BUYER OFFERS VIEW ================= */}
        {activeTab === 'buyer' && (
          <div className="space-y-6 animate-fade-in">
            {/* Task 6: Bank Credit Limit Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border border-emerald-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>{language === 'ru' ? 'Банковский кредитный лимит' : 'Bank Credit Limit'}</span>
                  </span>
                  {creditLimitRequest?.status === 'approved' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[10px]">
                      {language === 'ru' ? 'ОДОБРЕНО БАНКОМ' : 'BANK APPROVED'}
                    </span>
                  )}
                  {creditLimitRequest?.status === 'pending' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px]">
                      {language === 'ru' ? 'НА РАССМОТРЕНИИ' : 'UNDER REVIEW'}
                    </span>
                  )}
                </div>

                {creditLimitRequest?.status === 'approved' ? (
                  <div>
                    <div className="flex items-baseline space-x-3">
                      <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                        {formatRubles(creditLimitRequest.approvedLimitRub || 9000000)}
                      </span>
                      <span className="text-xs text-slate-300">
                        ({creditLimitRequest.bankName} • Сертификат {creditLimitRequest.certificateNumber})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {language === 'ru'
                        ? `Лимит действителен до ${creditLimitRequest.validUntil || '31.12.2026'}. Официальный штамп банка автоматически подтверждает вашу платежеспособность при бронировании лотов.`
                        : `Limit valid until ${creditLimitRequest.validUntil || '31.12.2026'}. Certified bank stamp verifies your liquidity for lot bookings.`}
                    </p>
                  </div>
                ) : creditLimitRequest?.status === 'pending' ? (
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {language === 'ru' ? 'Заявка на лимит передана кредитному офицеру' : 'Credit limit request is under review'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {language === 'ru'
                        ? `Запрошено: ${formatRubles(creditLimitRequest.requestedAmountRub)} в ${creditLimitRequest.bankName}. Ожидается выпуск цифрового сертификата.`
                        : `Requested: ${formatRubles(creditLimitRequest.requestedAmountRub)} at ${creditLimitRequest.bankName}. Pending certificate issue.`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {language === 'ru' ? 'Получите официальный кредитный лимит банка-партнера' : 'Get a Certified Bank Credit Limit'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {language === 'ru'
                        ? 'Сбербанк и ВТБ аккредитуют покупателей DomExit по ускоренному регламенту. Одобренный лимит дает приоритет 1-го порядка при выборе куратором.'
                        : 'Sberbank and VTB certify DomExit buyers with expedited processing. An approved limit gives 1st order priority.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                {creditLimitRequest?.status === 'approved' ? (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/40 text-right">
                    <span className="block text-[10px] text-emerald-300 uppercase tracking-wider font-bold">
                      {language === 'ru' ? 'Статус верификации' : 'Verification Status'}
                    </span>
                    <span className="text-xs font-mono font-bold text-white flex items-center justify-end space-x-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{language === 'ru' ? '100% Доверенный покупатель' : '100% Trusted Buyer'}</span>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreditLimitModalOpen(true)}
                    className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>{language === 'ru' ? 'Запросить кредитный лимит в банке' : 'Request Bank Credit Limit'}</span>
                  </button>
                )}
              </div>
            </div>

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

              {/* Assigned Curator Contact Card (Mission 14) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                <div className="flex items-center space-x-3.5">
                  {curator?.photoUrl ? (
                    <img
                      src={curator.photoUrl}
                      alt={curator.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-sm">
                      {(curator?.name || 'АМ').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      {language === 'ru' ? 'Ваш персональный куратор сделки (сотрудник DomExit):' : 'Your Dedicated Deal Curator (DomExit):'}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {curator?.name || 'Алексей Морозов'}
                    </span>
                    <span className="text-emerald-700 font-semibold block text-[11px]">
                      {curator?.role || 'Ведущий юрист-куратор'}
                    </span>
                    <span className="text-slate-500 block text-[11px] mt-0.5">
                      {curator?.phone || '+7 (921) 888-11-22'} • Telegram: {curator?.telegram || '@alexey_morozov'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={
                      (curator?.telegram || '').startsWith('http')
                        ? curator?.telegram
                        : `https://t.me/${(curator?.telegram || 'domexit_ru').replace('@', '')}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram</span>
                  </a>

                  {curator?.phone && (
                    <a
                      href={`tel:${curator.phone.replace(/[^\d+]/g, '')}`}
                      className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-colors"
                      title={curator.phone}
                    >
                      <span>{language === 'ru' ? 'Звонок' : 'Call'}</span>
                    </a>
                  )}
                </div>
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

              {/* MISSION 4.2: Refer Distressed Client Form with mandatory DEX-ID */}
              <div className="bg-purple-50/50 border border-purple-200 rounded-3xl p-6 space-y-4">
                <div className="flex items-center space-x-2 text-purple-950 font-black text-sm">
                  <Share2 className="w-4 h-4 text-purple-600" />
                  <span>{language === 'ru' ? 'Передать дольщика: регистрация по персональному ID клиента (DEX-XXXXXX)' : 'Refer Client: Register by Personal Client ID (DEX-XXXXXX)'}</span>
                </div>

                <p className="text-xs text-slate-600">
                  {language === 'ru'
                    ? 'Антифрод-регламент платформы: клиент должен создать аккаунт на DomExit и сообщить вам свой Уникальный ID. После отправки у клиента будет 7 дней для подтверждения запроса и загрузки ДДУ.'
                    : 'Platform anti-fraud rule: client must create an account on DomExit and provide their Unique ID. The client has 7 days to confirm and upload DDU.'}
                </p>

                {partnerError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center space-x-2 animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{partnerError}</span>
                  </div>
                )}

                <form onSubmit={handlePartnerReferralSubmit} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {language === 'ru' ? 'Уникальный ID клиента *' : 'Unique Client ID *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="DEX-784105"
                      value={refClientCode}
                      onChange={(e) => setRefClientCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl border border-purple-300 bg-white font-mono font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {language === 'ru' ? 'ФИО дольщика *' : 'Client Full Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Александр Владимирович Б."
                      value={refClientName}
                      onChange={(e) => setRefClientName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {language === 'ru' ? 'Телефон клиента *' : 'Client Phone *'}
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+7 (911) 234-56-78"
                      value={refClientPhone}
                      onChange={(e) => setRefClientPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {language === 'ru' ? 'ЖК / Объект *' : 'Complex / Property *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ЖК Чистое Небо (Корпус 12)"
                      value={refComplexName}
                      onChange={(e) => setRefComplexName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {language === 'ru' ? 'Застройщик *' : 'Developer *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Setl Group"
                      value={refDeveloper}
                      onChange={(e) => setRefDeveloper(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {language === 'ru' ? 'Выплачено застройщику (₽) *' : 'Paid to Developer (₽) *'}
                    </label>
                    <input
                      type="number"
                      required
                      value={refPaidAmount}
                      onChange={(e) => setRefPaidAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {language === 'ru' ? 'Цена по договору ДДУ (₽) *' : 'DDU Contract Price (₽) *'}
                    </label>
                    <input
                      type="number"
                      required
                      value={refDduPrice}
                      onChange={(e) => setRefDduPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{language === 'ru' ? 'Отправить запрос (7 дней)' : 'Send Request (7 Days)'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* MISSION 4.2: Live 7-Day Referral Requests Table */}
              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span>{language === 'ru' ? 'Реестр запросов с 7-дневным регламентом подтверждения:' : '7-Day Preliminary Referral Registry:'}</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Код</th>
                        <th className="py-3 px-3">ID клиента</th>
                        <th className="py-3 px-3">Клиент</th>
                        <th className="py-3 px-3">Объект / ЖК</th>
                        <th className="py-3 px-3">Выплачено</th>
                        <th className="py-3 px-3 text-right">Регламент и статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partnerRequests.map((req) => {
                        const countdown = formatRemainingTime(req.expiresAt);
                        return (
                          <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">{req.id}</td>
                            <td className="py-3 px-3 font-mono font-bold text-indigo-700">{req.clientCode}</td>
                            <td className="py-3 px-3 font-semibold text-slate-800">
                              <div>{req.clientName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{req.clientPhone}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-medium">{req.complexName}</div>
                              <div className="text-[10px] text-slate-500">{req.developer}</div>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                              {formatRubles(req.paidAmountRub)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {req.status === 'completed' ? (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center space-x-1">
                                  <Check className="w-3 h-3" />
                                  <span>{language === 'ru' ? 'Подтвержден клиентом' : 'Confirmed by Client'}</span>
                                </span>
                              ) : req.status === 'expired' || countdown.isExpired ? (
                                <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px]">
                                  {language === 'ru' ? 'Истек срок 7 дней' : '7 Days Expired'}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-[10px] inline-flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>{countdown.text}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MISSION 4.2: Live 5-Stage Referral Tracking Table */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'ru' ? 'Отслеживание активных сделок и агентского вознаграждения:' : 'Deal Tracking & Commission Rewards:'}</span>
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

        {/* ================= MODAL 1: Complete 7-Day Preliminary Request ================= */}
        {isCompleteModalOpen && selectedReqForCompletion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-scale-up">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-950 text-base">
                      {language === 'ru' ? 'Подтверждение заявки на чистый выход' : 'Confirm Clean Exit Request'}
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      ID клиента: {selectedReqForCompletion.clientCode}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">{language === 'ru' ? 'Партнер-агент:' : 'Partner Agent:'}</span>
                  <span className="font-bold text-slate-900">{selectedReqForCompletion.partnerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{language === 'ru' ? 'Объект / ЖК:' : 'Property / Complex:'}</span>
                  <span className="font-bold text-slate-900">{selectedReqForCompletion.complexName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{language === 'ru' ? 'Выплачено застройщику:' : 'Paid to Developer:'}</span>
                  <span className="font-bold font-mono text-emerald-800">{formatRubles(selectedReqForCompletion.paidAmountRub)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-amber-200/60 font-mono text-amber-900">
                  <span>{language === 'ru' ? 'Остаток регламента 7 дней:' : 'Time Left:'}</span>
                  <span className="font-bold">{formatRemainingTime(selectedReqForCompletion.expiresAt).text}</span>
                </div>
              </div>

              <form onSubmit={handleCompletePreliminaryRequest} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {language === 'ru' ? 'ФИО владельца договора *' : 'Contract Owner Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    defaultValue={selectedReqForCompletion.clientName}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {language === 'ru' ? 'Скан или фотографии договора ДДУ (с синей печатью Росреестра) *' : 'DDU Agreement Scan or Photos *'}
                  </label>
                  <div className="p-4 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50/40 text-center space-y-2">
                    <Upload className="w-6 h-6 text-amber-600 mx-auto" />
                    <p className="text-xs text-slate-600">
                      {completionFileUploaded
                        ? '✓ Файл прикреплен: DDU_Dogovor_214FZ_scan.pdf'
                        : 'Нажмите для выбора файла (PDF, JPG, PNG до 25 МБ)'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCompletionFileUploaded(true)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        completionFileUploaded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                      }`}
                    >
                      {completionFileUploaded ? '✓ ДДУ успешно загружен' : 'Выбрать скан ДДУ'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {language === 'ru' ? 'Комментарий для куратора (пожелания по срокам или сумме)' : 'Curator Notes'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Например: хочу вернуть 100% выплаченного, график рассрочки до декабря..."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCompleteModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    {language === 'ru' ? 'Отмена' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                  >
                    {language === 'ru' ? 'Подтвердить и отправить куратору DomExit' : 'Confirm & Submit to Curator'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 2: Request Bank Credit Limit ================= */}
        {isCreditLimitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-scale-up">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-950 text-base">
                      {language === 'ru' ? 'Запрос официального кредитного лимита' : 'Bank Credit Limit Application'}
                    </h3>
                    <span className="text-xs text-slate-500">
                      Партнерские банки: Сбербанк, ВТБ, Альфа-Банк
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreditLimitModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRequestCreditLimit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {language === 'ru' ? 'Выберите банк-партнер *' : 'Select Partner Bank *'}
                  </label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Сбербанк">Сбербанк (Эскроу и семейная ипотека)</option>
                    <option value="ВТБ">Банк ВТБ (ПАО) (Быстрое одобрение цессий)</option>
                    <option value="Альфа-Банк">Альфа-Банк (СБР и рассрочки)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-700 font-bold">
                      {language === 'ru' ? 'Желаемый кредитный лимит (₽):' : 'Requested Credit Limit (₽):'}
                    </label>
                    <span className="font-mono font-black text-emerald-700 text-sm">
                      {formatRubles(requestedCreditAmount)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2000000}
                    max={20000000}
                    step={500000}
                    value={requestedCreditAmount}
                    onChange={(e) => setRequestedCreditAmount(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                    <span>2 000 000 ₽</span>
                    <span>10 000 000 ₽</span>
                    <span>20 000 000 ₽</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {language === 'ru' ? 'Тип подтверждения дохода *' : 'Income Proof Type *'}
                  </label>
                  <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-500">
                    <option>Справка 2-НДФЛ (Основное место работы)</option>
                    <option>Выписка по зарплатной карте Сбербанк / ВТБ</option>
                    <option>Справка для самозанятых (Мой Налог)</option>
                    <option>Декларация ИП (УСН 6%)</option>
                  </select>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Преимущество на DomExit:</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Одобренный банком штамп лимита закрепляется в вашем профиле и дает гарантию быстрого бронирования квартир по ценам 2023–2024 гг. без повторных проверок.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreditLimitModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    {language === 'ru' ? 'Отмена' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                  >
                    {language === 'ru' ? 'Отправить в банк на аккредитацию' : 'Submit for Bank Accreditation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

    </div>
  );
};

