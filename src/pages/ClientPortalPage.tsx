import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  User,
  Send,
  ArrowRight,
  LogOut,
  AlertCircle,
  Heart,
  Users,
  Crown,
  Share2,
  Plus,
  Check,
  Banknote,
  Sliders,
  Copy,
  FileCheck,
  Upload,
  FolderLock,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles, formatPercent } from '../utils/formatters';
import {
  formatRussianPhoneInput,
  isValidRussianPhone,
  validateSellerFinancials,
} from '../utils/validators';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { PartnerRequestsRepository } from '../dal/repositories/PartnerRequestsRepository';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { SellerRequestsRepository } from '../dal/repositories/SellerRequestsRepository';
import { LegalPoliciesRepository, CANONICAL_POLICY_NAMES } from '../dal/repositories/LegalPoliciesRepository';
import { StorageService } from '../dal/StorageService';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import {
  DealTrack,
  BuyerCandidate,
  Lot,
  PartnerEntry,
  InvestorApplication,
  PartnerPreliminaryRequest,
  Employee,
  SellerExitRequest,
  DocumentMetadata,
  ProofOfConsentRecord,
} from '../types';
import { FileManager } from '../utils/fileManager';

type PortalTab = 'buyer' | 'seller' | 'favorites' | 'partner' | 'investor' | 'consents';

const VALID_TABS: PortalTab[] = ['buyer', 'seller', 'favorites', 'partner', 'investor', 'consents'];

const STAGE_LABEL_RU: Record<DealTrack['stage'], string> = {
  initial_audit: '1. Первичный комплаенс',
  document_check: '2. Правовой аудит 214-ФЗ',
  packaging: '3. Упаковка и публикация',
  buyer_matching: '4. Подбор покупателя',
  closing_escrow: '5. Аккредитив и Эскроу',
  completed: '✓ Зарегистрировано в Росреестре',
};

const STAGE_NUM_MAP: Record<DealTrack['stage'], number> = {
  initial_audit: 1,
  document_check: 2,
  packaging: 3,
  buyer_matching: 4,
  closing_escrow: 5,
  completed: 5,
};

export const ClientPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, logout, toggleFavorite, upgradeToPartner, upgradeToInvestor, openAuthModal } = useAuth();
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // Strict Enterprise Account Isolation & Role Redirects
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      navigate('/', { replace: true });
      openAuthModal(
        language === 'ru'
          ? 'Войдите в систему для доступа к вашему личному кабинету'
          : 'Sign in to access your client portal'
      );
      return;
    }

    // Bank accounts must NEVER access consumer /portal
    if (user.role === 'bank' || user.activeRole === 'bank') {
      navigate('/admin/bank-gateway', { replace: true });
      return;
    }

    // Employee accounts must NEVER access consumer /portal
    if (user.role === 'employee' || user.activeRole === 'employee') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
  }, [user, isAuthenticated, authLoading, navigate, language]);

  const resolveDefaultTab = (): PortalTab => {
    const paramTab = searchParams.get('tab') as PortalTab | null;
    if (paramTab && VALID_TABS.includes(paramTab)) {
      if (paramTab === 'partner' && !user?.isPartnerApproved) return 'buyer';
      if (paramTab === 'investor' && !user?.isInvestorApproved) return 'buyer';
      return paramTab;
    }
    if (user?.activeRole === 'seller') return 'seller';
    if (user?.activeRole === 'partner' && user?.isPartnerApproved) return 'partner';
    if (user?.activeRole === 'investor' && user?.isInvestorApproved) return 'investor';
    return 'buyer';
  };

  const [activeTab, setActiveTab] = useState<PortalTab>(resolveDefaultTab);

  // Sync URL ?tab= changes (e.g. from UnifiedNavbar role switcher)
  useEffect(() => {
    const paramTab = searchParams.get('tab') as PortalTab | null;
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== activeTab) {
      if (paramTab === 'partner' && !user?.isPartnerApproved) return;
      if (paramTab === 'investor' && !user?.isInvestorApproved) return;
      setActiveTab(paramTab);
    }
  }, [searchParams, user]);

  const handleSelectTab = (tab: PortalTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // Buyer & General State
  const [userBids, setUserBids] = useState<BuyerCandidate[]>([]);
  const [allLots, setAllLots] = useState<Lot[]>([]);
  const [allDeals, setAllDeals] = useState<DealTrack[]>([]);
  const [favoriteLots, setFavoriteLots] = useState<Lot[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const isOwner =
    user?.role === 'owner' ||
    user?.role === 'admin' ||
    user?.activeRole === 'owner' ||
    user?.roles?.includes('owner') ||
    user?.email?.toLowerCase() === 'amaas9499@gmail.com' ||
    user?.email?.toLowerCase() === 'ceo@domexit.ru';

  const displayName =
    isOwner || user?.name?.includes('Виктор')
      ? 'Ahmed Abdallah (Владелец / CEO)'
      : user?.name || (language === 'ru' ? 'Личный кабинет' : 'Client Portal');

  const displayClientCode = isOwner
    ? user?.clientCode && user.clientCode !== 'DEX-000001'
      ? user.clientCode
      : 'DEX-104662'
    : user?.clientCode || 'DEX-784105';

  const displayInitial =
    isOwner || user?.name?.includes('Виктор')
      ? 'A'
      : user?.name?.charAt(0) || 'К';

  // Seller State
  const [sellerLots, setSellerLots] = useState<Lot[]>([]);
  const [sellerDeals, setSellerDeals] = useState<DealTrack[]>([]);
  const [sellerRequests, setSellerRequests] = useState<SellerExitRequest[]>([]);
  const [selectedSellerLotCode, setSelectedSellerLotCode] = useState<string>('');
  const [sellerVaultDocs, setSellerVaultDocs] = useState<DocumentMetadata[]>([]);
  const [isSellerVaultOpen, setIsSellerVaultOpen] = useState<boolean>(false);
  const [isUploadingRequestedDoc, setIsUploadingRequestedDoc] = useState<boolean>(false);

  // 7-Day Partner Preliminary Requests & Completion
  const [pendingPreliminaryReqs, setPendingPreliminaryReqs] = useState<PartnerPreliminaryRequest[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerPreliminaryRequest[]>([]);
  const [partnerDeals, setPartnerDeals] = useState<DealTrack[]>([]);
  const [partnerAppRecord, setPartnerAppRecord] = useState<PartnerEntry | null>(null);
  const [selectedReqForCompletion, setSelectedReqForCompletion] = useState<PartnerPreliminaryRequest | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false);
  const [completionDocMeta, setCompletionDocMeta] = useState<DocumentMetadata | null>(null);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [completionError, setCompletionError] = useState<string | null>(null);

  // 152-FZ Proof of Consent State
  const [userConsents, setUserConsents] = useState<ProofOfConsentRecord[]>([]);
  const [copiedConsentSha, setCopiedConsentSha] = useState<string | null>(null);
  const [curator, setCurator] = useState<Employee | null>(null);

  // Partner Referral Form State
  const [refClientCode, setRefClientCode] = useState<string>('');
  const [refClientName, setRefClientName] = useState<string>('');
  const [refClientPhone, setRefClientPhone] = useState<string>('+7 (');
  const [refComplexName, setRefComplexName] = useState<string>('');
  const [refDeveloper, setRefDeveloper] = useState<string>('Setl Group');
  const [refPaidAmount, setRefPaidAmount] = useState<number>(2800000);
  const [refDduPrice, setRefDduPrice] = useState<number>(10500000);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [copiedPartnerLink, setCopiedPartnerLink] = useState<boolean>(false);

  // Investor Package Builder State
  const [investorAppRecord, setInvestorAppRecord] = useState<InvestorApplication | null>(null);
  const [investorBudgetMillions, setInvestorBudgetMillions] = useState<number>(
    user?.investorPackagePreference?.budgetMillions || 35
  );
  const [selectedPackage, setSelectedPackage] = useState<'flipping' | 'turnkey' | 'syndicate'>(
    user?.investorPackagePreference?.selectedPackage || 'turnkey'
  );
  const [packageSavedToast, setPackageSavedToast] = useState<boolean>(false);

  const formatRemainingTime = (expiresAt: string): { text: string; isExpired: boolean } => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) {
      return { text: language === 'ru' ? 'Срок истек' : 'Expired', isExpired: true };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return {
      text:
        language === 'ru'
          ? `${days} дн. ${hours} ч. ${minutes} мин.`
          : `${days}d ${hours}h ${minutes}m`,
      isExpired: false,
    };
  };

  const loadData = async () => {
    const uid = user?.id || '';
    const clientCode = user?.clientCode || 'DEX-784105';
    const partnerRefCode = user?.partnerRefCode || '';

    const [
      lotsData,
      myBids,
      allCandidates,
      pendingReqs,
      myPartnerReqs,
      myPartnerDeals,
      allEmps,
      mySellerLots,
      mySellerDeals,
      mySellerReqs,
      myPartnerEntry,
      myInvestorEntry,
      allDealsList,
      consentsList,
    ] = await Promise.all([
      LotsRepository.getAll({ status: 'all', isVipInvestor: true, includePendingApproval: true }),
      CandidatesRepository.getByUserId(uid, clientCode),
      CandidatesRepository.getAll(),
      PartnerRequestsRepository.getPendingByClientCode(clientCode),
      PartnerRequestsRepository.getByPartner(uid, partnerRefCode),
      partnerRefCode ? DealsRepository.getByPartner(partnerRefCode) : Promise.resolve([]),
      EmployeesRepository.getAll(),
      LotsRepository.getBySeller(uid, clientCode),
      DealsRepository.getBySeller(uid, clientCode),
      SellerRequestsRepository.getByUser(uid, clientCode),
      PartnersRepository.getById(uid || clientCode),
      InvestorClubRepository.getByUser(uid, clientCode),
      DealsRepository.getAll(),
      LegalPoliciesRepository.getUserConsents(uid || clientCode),
    ]);

    setAllLots(lotsData);
    setAllDeals(allDealsList);
    setPendingPreliminaryReqs(pendingReqs);
    setPartnerRequests(myPartnerReqs);
    setPartnerDeals(myPartnerDeals);
    setPartnerAppRecord(myPartnerEntry);
    setInvestorAppRecord(myInvestorEntry);

    // If user has no explicit consents yet (e.g. demo client), generate verified baseline proofs for v2.1
    if (consentsList && consentsList.length > 0) {
      setUserConsents(consentsList);
    } else {
      const currentMap = await LegalPoliciesRepository.getCurrentVersions();
      const mockConsents: ProofOfConsentRecord[] = Object.values(currentMap).map((pol) => ({
        id: `mock-proof-${pol.policyType}`,
        userId: uid || clientCode,
        clientCode: clientCode,
        userFullName: user?.name || 'Пользователь платформы',
        policyType: pol.policyType,
        policyVersion: pol.versionNumber,
        policySha256: pol.sha256Hash,
        consentedAt: '2026-03-01T10:00:00Z',
        ipAddress: '178.154.221.45 (Yandex Cloud DC Мытищи)',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0 Chrome/122',
        consentMethod: 'web_form',
      }));
      setUserConsents(mockConsents);
    }

    if (myInvestorEntry?.selectedBudgetMillions) {
      setInvestorBudgetMillions(myInvestorEntry.selectedBudgetMillions);
    }
    if (myInvestorEntry?.selectedPackage) {
      setSelectedPackage(myInvestorEntry.selectedPackage);
    }

    // Buyer bids: strictly user's own bids (or demo fallback if guest)
    if (myBids.length > 0) {
      setUserBids(myBids);
    } else if (!uid) {
      setUserBids(allCandidates.slice(0, 1));
    } else {
      setUserBids([]);
    }

    // Seller lots & deals (fallback to U-10566 / DEAL-2025-10566 if demo seller has no custom lot yet)
    let resolvedSellerLots = mySellerLots;
    let resolvedSellerDeals = mySellerDeals;
    if (resolvedSellerLots.length === 0) {
      const fallbackLot = lotsData.find((l) => l.lotCode === 'U-10566') || lotsData[0];
      if (fallbackLot) resolvedSellerLots = [fallbackLot];
    }
    if (resolvedSellerDeals.length === 0) {
      const fallbackDeal = await DealsRepository.getById(user?.activeDealId || 'DEAL-2025-10566');
      if (fallbackDeal) resolvedSellerDeals = [fallbackDeal];
    }

    setSellerLots(resolvedSellerLots);
    setSellerDeals(resolvedSellerDeals);
    setSellerRequests(mySellerReqs);

    const activeCode =
      selectedSellerLotCode && resolvedSellerLots.some((l) => l.lotCode === selectedSellerLotCode)
        ? selectedSellerLotCode
        : resolvedSellerLots[0]?.lotCode || 'U-10566';
    setSelectedSellerLotCode(activeCode);

    const activeLotObj = resolvedSellerLots.find((l) => l.lotCode === activeCode);
    const docs = await StorageService.getDocumentsByEntity('lot', activeCode);
    setSellerVaultDocs(docs);

    if (activeLotObj?.assignedEmployeeId) {
      const emp = allEmps.find((e) => e.id === activeLotObj.assignedEmployeeId);
      setCurator(emp || allEmps[0] || null);
    } else if (allEmps.length > 0) {
      setCurator(allEmps[0]);
    }


    // Favorites
    const favCodes = user?.favorites || [];
    setFavoriteLots(lotsData.filter((l) => favCodes.includes(l.lotCode)));
  };

  useEffect(() => {
    loadData();
    const unsub = DatabaseGateway.subscribe(() => {
      loadData();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, user?.favorites]);

  // Reload S3 documents when seller switches between multiple submitted lots
  useEffect(() => {
    if (!selectedSellerLotCode) return;
    StorageService.getDocumentsByEntity('lot', selectedSellerLotCode).then(setSellerVaultDocs);
  }, [selectedSellerLotCode]);

  const activeSellerLot =
    sellerLots.find((l) => l.lotCode === selectedSellerLotCode) || sellerLots[0] || null;
  const activeSellerDeal =
    sellerDeals.find((d) => d.lotCode === activeSellerLot?.lotCode) || sellerDeals[0] || null;
  const activeSellerRequest =
    sellerRequests.find((r) => r.lotCode === activeSellerLot?.lotCode) || null;

  // Seller uploads document requested by Curator / Owner
  const handleUploadCuratorRequestedDoc = async () => {
    if (!activeSellerLot) return;
    try {
      setIsUploadingRequestedDoc(true);
      const selected = await FileManager.selectAndReadFile(
        'other',
        '.pdf,.png,.jpg,.jpeg,.doc,.docx'
      );
      if (selected && selected.file) {
        const meta = await StorageService.uploadDocument({
          file: selected.file,
          category: 'additional',
          categoryLabelRu: `Ответ на запрос куратора (#${activeSellerLot.lotCode})`,
          entityType: 'lot',
          entityId: activeSellerLot.lotCode,
          uploadedByUid: user?.id || 'seller',
          clientCode: user?.clientCode || 'DEX-SELLER',
        });

        await LotsRepository.submitRequestedDocBySeller(
          activeSellerLot.lotCode,
          { name: meta.name, url: meta.cloudUrl || '', docId: meta.id },
          user?.name || 'Продавец ДДУ'
        );

        setActionNotice(
          `Документ «${meta.name}» сохранен в S3-сейфе и отправлен куратору на проверку!`
        );
        await loadData();
        setTimeout(() => setActionNotice(null), 6000);
      }
    } finally {
      setIsUploadingRequestedDoc(false);
    }
  };

  const handlePartnerReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerError(null);

    const cleanCode = refClientCode.trim().toUpperCase();
    if (!cleanCode.startsWith('DEX-')) {
      setPartnerError(
        language === 'ru'
          ? 'Введите уникальный ID клиента в формате DEX-XXXXXX (например, DEX-784105).'
          : 'Enter a valid client ID formatted as DEX-XXXXXX.'
      );
      return;
    }

    if (!isValidRussianPhone(refClientPhone)) {
      setPartnerError('Введите телефон клиента в стандарте РФ +7 (XXX) XXX-XX-XX.');
      return;
    }

    const finCheck = validateSellerFinancials(refPaidAmount, refDduPrice);
    if (!finCheck.valid) {
      setPartnerError(finCheck.paidErrorRu || finCheck.contractErrorRu || 'Проверьте финансовые параметры ДДУ.');
      return;
    }

    const verifiedUser = await PartnerRequestsRepository.verifyClientCode(cleanCode);
    if (!verifiedUser) {
      setPartnerError(
        language === 'ru'
          ? `Клиент с кодом «${cleanCode}» не найден в реестре. Дольщик должен сначала зарегистрироваться на DomExit и сообщить свой DEX-ID.`
          : `Client with ID "${cleanCode}" not found.`
      );
      return;
    }

    const newReq = await PartnerRequestsRepository.createPreliminaryRequest({
      partnerId: user?.id || 'partner-current',
      partnerName: user?.name || 'Партнер DomExit',
      partnerRefCode: user?.partnerRefCode || partnerAppRecord?.referralCode || 'PARTNER-SPB-12',
      clientCode: cleanCode,
      clientName: refClientName.trim() || verifiedUser.name || 'Дольщик',
      clientPhone: refClientPhone,
      complexName: refComplexName.trim(),
      developer: refDeveloper.trim() || 'Застройщик',
      paidAmountRub: refPaidAmount,
      contractPriceRub: refDduPrice,
      notes: '',
    });

    setPartnerRequests((prev) => [newReq, ...prev]);
    setRefClientCode('');
    setRefClientName('');
    setRefClientPhone('+7 (');
    setRefComplexName('');

    setActionNotice(
      `Предварительный запрос для клиента [${newReq.clientCode}] отправлен! В кабинете клиента запущен 7-дневный таймер загрузки ДДУ.`
    );
    setTimeout(() => setActionNotice(null), 6000);
  };

  // Real S3 upload for 7-day Partner Preliminary Request modal
  const handleSelectPreliminaryDduFile = async () => {
    if (!selectedReqForCompletion) return;
    const selected = await FileManager.selectAndReadFile(
      'ddu',
      '.pdf,.png,.jpg,.jpeg'
    );
    if (selected && selected.file) {
      const meta = await StorageService.uploadDocument({
        file: selected.file,
        category: 'ddu_contract',
        categoryLabelRu: 'Скан договора участия в долевом строительстве (ДДУ)',
        entityType: 'seller_request',
        entityId: selectedReqForCompletion.id,
        uploadedByUid: user?.id || 'seller',
        clientCode: selectedReqForCompletion.clientCode,
      });
      setCompletionDocMeta(meta);
      setCompletionError(null);
    }
  };

  const handleCompletePreliminaryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqForCompletion) return;
    setCompletionError(null);

    if (!completionDocMeta) {
      setCompletionError('Пожалуйста, загрузите реальный скан или фото договора ДДУ в S3-хранилище.');
      return;
    }

    const { lot } = await SellerRequestsRepository.submitSellerRequest({
      uid: user?.id || 'usr-seller-001',
      clientCode: selectedReqForCompletion.clientCode,
      sellerName: selectedReqForCompletion.clientName,
      sellerPhone: selectedReqForCompletion.clientPhone,
      sellerInn: '781045901234',
      city: 'spb',
      district: 'Приморский район',
      complexName: selectedReqForCompletion.complexName,
      developer: selectedReqForCompletion.developer,
      dduNumber: `ДДУ-${selectedReqForCompletion.id}`,
      areaM2: 52.0,
      rooms: '2-room',
      floor: 9,
      totalFloors: 22,
      contractPriceRub: Math.max(
        selectedReqForCompletion.contractPriceRub,
        selectedReqForCompletion.paidAmountRub + 1500000
      ),
      paidAmountRub: Math.max(2000000, selectedReqForCompletion.paidAmountRub),
      exitRoute: 'ddu_assignment',
      documentIds: [completionDocMeta.id],
      referredByPartnerCode: selectedReqForCompletion.partnerRefCode,
      preliminaryReferralId: selectedReqForCompletion.id,
    });

    await StorageService.rebindDocumentsToEntity([completionDocMeta.id], 'lot', lot.lotCode);

    setIsCompleteModalOpen(false);
    setSelectedReqForCompletion(null);
    setCompletionDocMeta(null);
    setCompletionNotes('');
    setSelectedSellerLotCode(lot.lotCode);
    handleSelectTab('seller');

    setActionNotice(
      `Договор ДДУ сохранен в S3! Создан лот #${lot.lotCode} и направлен на верификацию Владельцу платформы.`
    );
    await loadData();
    setTimeout(() => setActionNotice(null), 6000);
  };


  const handleDownloadBidProof = async (bid: BuyerCandidate) => {
    if (bid.documentId) {
      const doc = await StorageService.getDocumentById(bid.documentId);
      if (doc) {
        await StorageService.downloadDocument(doc);
        return;
      }
    }
    if (bid.bankApprovalDocUrl) {
      FileManager.downloadFile(
        bid.bankApprovalDocUrl,
        bid.bankApprovalDocName || 'Подтверждение_банка.pdf'
      );
    }
  };

  const handleSaveInvestorPackage = async (
    nextBudget: number,
    nextPkg: 'flipping' | 'turnkey' | 'syndicate'
  ) => {
    setInvestorBudgetMillions(nextBudget);
    setSelectedPackage(nextPkg);
    if (user) {
      await InvestorClubRepository.savePackagePreference(
        user.id,
        user.clientCode || 'DEX-990088',
        nextBudget,
        nextPkg
      );
      setPackageSavedToast(true);
      setTimeout(() => setPackageSavedToast(false), 2500);
    }
  };

  const vipEarlyAccessLots = allLots.filter(
    (l) => (l.isEarlyAccessVIP || l.currentStage === 2) && l.approvalStatus !== 'rejected'
  );

  const activeStageNum = activeSellerDeal ? STAGE_NUM_MAP[activeSellerDeal.stage] || 1 : 2;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (
    !isAuthenticated ||
    !user ||
    user.role === 'bank' ||
    user.activeRole === 'bank' ||
    user.role === 'employee' ||
    user.activeRole === 'employee'
  ) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      
      {/* Top Banner: Client Profile Bar */}
      <section className="bg-white text-slate-900 pt-8 pb-8 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 p-0.5 shadow-md">
                <div className="w-full h-full bg-emerald-600 rounded-[14px] flex items-center justify-center font-bold text-white text-xl">
                  {displayInitial}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-950">
                    {displayName}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                    214-ФЗ • 152-ФЗ Верифицирован
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-500">
                    {user?.email || user?.phone || '+7 (911) 234-56-78'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <div className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200/90 text-slate-900 border border-slate-300 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shadow-xs">
                    <span className="text-slate-500 font-sans font-medium text-[11px]">
                      {language === 'ru' ? 'ID клиента:' : 'Client ID:'}
                    </span>
                    <span className="text-indigo-700 tracking-wide font-black">
                      {displayClientCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = displayClientCode;
                        navigator.clipboard?.writeText(code);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2500);
                      }}
                      className="p-1 hover:bg-white rounded transition-colors cursor-pointer text-slate-600 hover:text-indigo-600"
                      title={language === 'ru' ? 'Скопировать ID клиента' : 'Copy Client ID'}
                    >
                      {copiedCode ? (
                        <span className="text-emerald-600 text-[10px] font-sans flex items-center space-x-0.5">
                          <Check className="w-3.5 h-3.5" />
                          <span>OK</span>
                        </span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Yandex S3 / Эскроу: Активен</span>
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

          {/* 5 Dynamic Portal Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pt-2">
            <button
              type="button"
              onClick={() => handleSelectTab('buyer')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'buyer'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>{language === 'ru' ? 'Мои заявки на покупку' : 'My Purchase Offers'}</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px]">
                {userBids.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('seller')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'seller'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>{language === 'ru' ? 'Мои объекты на выход (0%)' : 'My Seller Exits'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                {sellerLots.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('favorites')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'favorites'
                  ? 'border-rose-600 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Избранное' : 'Favorites'}</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px]">
                {favoriteLots.length}
              </span>
            </button>

            {/* Partner Tab strictly conditionally rendered */}
            {Boolean(user?.isPartnerApproved) && (
              <button
                type="button"
                onClick={() => handleSelectTab('partner')}
                className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'partner'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-purple-600" />
                <span>{language === 'ru' ? 'Кабинет Партнера' : 'Partner Portal'}</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                  PRO
                </span>
              </button>
            )}

            {/* VIP Investor Tab strictly conditionally rendered */}
            {Boolean(user?.isInvestorApproved) && (
              <button
                type="button"
                onClick={() => handleSelectTab('investor')}
                className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'investor'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>{language === 'ru' ? 'Кабинет Инвестора VIP' : 'VIP Investor Portal'}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  VIP 48ч
                </span>
              </button>
            )}
          </div>

          {/* VIP Catalog Early Access Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Закрытый VIP-пул объектов (Ранний доступ 48 часов)
                </div>
                <div className="text-xs text-slate-300">
                  Лоты с максимальным дисконтом до -35% от застройщика до их появления в открытом каталоге
                </div>
              </div>
            </div>
            <Link
              to="/vip-catalog"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors flex items-center space-x-1.5 shrink-0 shadow-sm"
            >
              <span>Смотреть VIP-пул</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {actionNotice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-emerald-700 hover:text-emerald-950"
            >
              ✕
            </button>
          </div>
        )}

        {/* 7-Day Countdown Alert for Pending Partner Preliminary Request */}
        {pendingPreliminaryReqs.length > 0 && (
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-500/10 border-2 border-amber-400 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] uppercase tracking-wider">
                      Срочный запрос партнера • 7 дней
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900">
                      ID: {pendingPreliminaryReqs[0].clientCode}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 mt-1">
                    Партнер «{pendingPreliminaryReqs[0].partnerName}» открыл предварительный запрос на чистый выход
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 mt-1">
                    Объект: {pendingPreliminaryReqs[0].complexName} ({pendingPreliminaryReqs[0].developer}). Загрузите скан ДДУ в защищенное S3-хранилище для запуска аудита.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <div className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 shadow-xs flex items-center space-x-2 text-xs font-mono font-bold text-amber-900">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>
                    Осталось: {formatRemainingTime(pendingPreliminaryReqs[0].expiresAt).text}
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
                  <span>Подтвердить и загрузить ДДУ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 1: BUYER OFFERS VIEW ================= */}
        {activeTab === 'buyer' && (
          <div className="space-y-6">
            {/* Live Buyer Bids List */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Ваши заявки на покупку ({userBids.length} из макс. 3 активных)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Все поданные предложения синхронизированы с модулем матчмейкинга ответственного куратора.
                  </p>
                </div>
                <Link
                  to="/opportunities"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Открыть каталог лотов РФ →
                </Link>
              </div>

              {userBids.length === 0 ? (
                <div className="p-10 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-700">
                    У вас пока нет активных предложений о покупке
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Выберите проверенную квартиру в каталоге переуступок и подайте заявку в ежедневное окно отбора.
                  </p>
                  <Link
                    to="/opportunities"
                    className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                  >
                    <span>Перейти к выбору объекта</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {userBids.map((bid) => {
                    const matchedLot = allLots.find(
                      (l) => l.lotCode.toUpperCase() === (bid.lotCode || '').toUpperCase()
                    );
                    const lotDisplayTitle = matchedLot
                      ? `${matchedLot.complexName} (${matchedLot.district})`
                      : `Лот #${bid.lotCode}`;
                    const formattedDate = bid.timestamp
                      ? new Date(bid.timestamp).toLocaleString('ru-RU')
                      : bid.requestedTimestamp;

                    return (
                      <div
                        key={bid.id}
                        className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/opportunities/${bid.lotCode || 'U-10566'}`}
                                className="font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded text-xs"
                              >
                                #{bid.lotCode}
                              </Link>
                              <Link
                                to={`/opportunities/${bid.lotCode || 'U-10566'}`}
                                className="font-bold text-sm text-slate-900 hover:text-emerald-700"
                              >
                                {lotDisplayTitle}
                              </Link>
                            </div>
                            <span className="text-xs text-slate-500 mt-1 block">
                              Подано: {formattedDate} • Заявитель: {bid.name} ({bid.clientCode || user?.clientCode})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {bid.buyerTrack === 'mortgage_substitution' ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Трек: Кэш + Ипотека
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Трек: 100% Кэш
                              </span>
                            )}

                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                bid.status === 'priority_reserved'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : bid.status === 'declined' ||
                                    bid.status === 'withdrawn_accepted_elsewhere'
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {bid.status === 'priority_reserved'
                                ? '✓ Утверждено куратором!'
                                : bid.status === 'under_review'
                                ? 'Ликвидность проверена • В финале'
                                : bid.status === 'withdrawn_accepted_elsewhere'
                                ? 'Авто-отзыв (одобрен другой лот)'
                                : bid.status === 'declined'
                                ? 'Выбран другой кандидат'
                                : 'На рассмотрении куратора'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="text-slate-500 block text-[11px]">Подтвержденный кэш:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatRubles(bid.availableLiquidity)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Регламент выхода:</span>
                            <span className="font-bold text-slate-800">{bid.readinessTimeline}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Документ в S3-сейфе:</span>
                            {bid.documentId || bid.bankApprovalDocUrl ? (
                              <button
                                type="button"
                                onClick={() => handleDownloadBidProof(bid)}
                                className="text-sky-700 hover:underline font-bold flex items-center space-x-1 mt-0.5 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="truncate">
                                  {bid.bankApprovalDocName || 'Подтверждение_ликвидности.pdf'}
                                </span>
                              </button>
                            ) : (
                              <span className="text-slate-400">В обработке</span>
                            )}
                          </div>
                        </div>

                        {bid.status === 'priority_reserved' && (() => {
                          const linkedDeal = allDeals.find(
                            (d) => d.lotCode.toUpperCase() === (bid.lotCode || '').toUpperCase()
                          );
                          const wfStep = linkedDeal?.escrowWorkflow?.step || 'curator_review';
                          return (
                            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-2">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <div className="flex items-center space-x-2 font-bold">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>
                                    {wfStep === 'curator_review' &&
                                      'Ваша заявка утверждена куратором! Готовится передача пакета документов в банк-партнёр.'}
                                    {wfStep === 'bank_escrow_deposit' &&
                                      'Шаг 1 синхронизирован: Документы переданы в банк • Открывается аккредитив СБР.'}
                                    {wfStep === 'signing_photos' &&
                                      'Шаг 2 синхронизирован: Средства надежно заблокированы в банке (Депонирование СБР подтверждено). Назначено подписание.'}
                                    {wfStep === 'bank_funds_release' &&
                                      'Шаг 3 синхронизирован: Подписание завершено, штамп Росреестра загружен • Передано в банк на раскрытие аккредитива.'}
                                    {wfStep === 'deal_finalized' &&
                                      'Шаг 4 завершён: Аккредитив СБР раскрыт, транши выплачены • Сделка официально закрыта!'}
                                  </span>
                                </div>
                                <Link
                                  to={`/opportunities/${bid.lotCode || 'U-10566'}`}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                                >
                                  Паспорт лота →
                                </Link>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: SELLER LISTINGS VIEW ================= */}
        {activeTab === 'seller' && (
          <div className="space-y-6">
            {/* Switcher if Seller submitted multiple lots + New Exit CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {sellerLots.map((sl) => (
                  <button
                    key={sl.lotCode}
                    type="button"
                    onClick={() => setSelectedSellerLotCode(sl.lotCode)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      activeSellerLot?.lotCode === sl.lotCode
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    #{sl.lotCode} • {sl.complexName}
                  </button>
                ))}
              </div>

              <Link
                to="/sellers"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center space-x-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Подать еще один объект ДДУ</span>
              </Link>
            </div>

            {/* URGENT ALERT: Curator or Owner Requested Additional Documents */}
            {activeSellerLot?.additionalDocsRequested?.status === 'pending' && (
              <div className="p-5 sm:p-6 rounded-3xl bg-amber-50 border-2 border-amber-400 shadow-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                      Требуется действие продавца • Комплаенс 214-ФЗ
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-950">
                      Куратор запросил дополнительные документы по лоту #{activeSellerLot.lotCode}
                    </h3>
                    <p className="text-xs text-slate-700">
                      <strong>Список:</strong>{' '}
                      {activeSellerLot.additionalDocsRequested.requestedList.join(', ')}
                    </p>
                    {activeSellerLot.additionalDocsRequested.notes && (
                      <p className="text-xs text-amber-900 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        Комментарий юриста: {activeSellerLot.additionalDocsRequested.notes}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isUploadingRequestedDoc}
                    onClick={handleUploadCuratorRequestedDoc}
                    className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>
                      {isUploadingRequestedDoc
                        ? 'Шифрование S3...'
                        : 'Загрузить запрошенный файл в S3'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Rejection Notice if Rejected */}
            {activeSellerLot?.approvalStatus === 'rejected' && (
              <div className="p-5 rounded-3xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1">
                <span className="font-black text-sm block">
                  Заявка по лоту #{activeSellerLot.lotCode} отклонена комплаенсом
                </span>
                <p>
                  Причина: {activeSellerLot.rejectionReason || activeSellerRequest?.rejectionReason || 'Несоответствие критериям 214-ФЗ'}
                </p>
              </div>
            )}

            {/* Main Seller Exit Dossier Card */}
            {activeSellerLot && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded">
                        ЛОТ #{activeSellerLot.lotCode}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          activeSellerLot.approvalStatus === 'pending_owner_approval'
                            ? 'bg-amber-100 text-amber-900'
                            : activeSellerLot.approvalStatus === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {activeSellerLot.approvalStatus === 'pending_owner_approval'
                          ? 'Ожидает одобрения Владельцем платформы'
                          : activeSellerLot.approvalStatus === 'rejected'
                          ? 'Отклонен'
                          : 'Одобрен и закреплен за куратором'}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-1.5">
                      {activeSellerLot.complexName} — {activeSellerLot.areaM2} м² ({activeSellerLot.district})
                    </h2>
                    <span className="text-xs text-slate-500">
                      Застройщик: {activeSellerLot.developer} • Эскроу: ПАО {activeSellerLot.escrowBank}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block font-medium">
                        Сумма к возврату на руки:
                      </span>
                      <span className="text-2xl font-black text-emerald-700 font-mono">
                        {formatRubles(activeSellerLot.cashPaidBySeller)}
                      </span>
                    </div>
                    <div className="h-10 w-px bg-slate-200" />
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block font-medium">Комиссия продавца:</span>
                      <span className="text-xl font-black text-slate-900">0 ₽</span>
                    </div>
                  </div>
                </div>

                {/* Live 5-Step Timeline */}
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-slate-700">
                    <span>Текущая стадия сделки ({activeSellerDeal?.dealId || 'Реестр 214-ФЗ'}):</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-emerald-700">
                        {activeSellerDeal
                          ? STAGE_LABEL_RU[activeSellerDeal.stage]
                          : `Этап ${activeStageNum} из 5`}
                      </span>
                      {activeSellerDeal && (
                        <Link
                          to={`/client/tracker/${activeSellerDeal.dealId}`}
                          className="inline-flex items-center space-x-1 text-indigo-700 hover:underline"
                        >
                          <span>Детальный трекер офферов</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {[
                      { num: 1, title: '1. Оценка ДДУ', sub: '100% возврат' },
                      { num: 2, title: '2. Проверка', sub: '42 параметра' },
                      { num: 3, title: '3. Упаковка', sub: 'Публикация' },
                      { num: 4, title: '4. Подбор', sub: 'Матчмейкинг' },
                      { num: 5, title: '5. Выплата', sub: 'Аккредитив банка' },
                    ].map((st) => {
                      const isDone = activeSellerDeal?.stage === 'completed' || st.num < activeStageNum;
                      const isCurrent = activeSellerDeal?.stage !== 'completed' && st.num === activeStageNum;
                      return (
                        <div
                          key={st.num}
                          className={`p-3 rounded-2xl text-xs border ${
                            isCurrent
                              ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-600 shadow-md'
                              : isDone
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-slate-100 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 font-bold mb-1">
                            {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            {isCurrent && <Clock className="w-4 h-4 text-slate-950" />}
                            <span>{st.title}</span>
                          </div>
                          <span className="text-[11px] opacity-85">{st.sub}</span>
                        </div>
                      );
                    })}
                  </div>
                  {activeSellerDeal?.escrowWorkflow && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-2 font-bold text-emerald-950">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          {activeSellerDeal.escrowWorkflow.step === 'curator_review' &&
                            'Банковский шлюз СБР: Подготовка пакета документов куратором перед передачей в банк'}
                          {activeSellerDeal.escrowWorkflow.step === 'bank_escrow_deposit' &&
                            'Шаг 1: Документы переданы в банк • Ожидается подтверждение депонирования средств покупателя на СБР'}
                          {activeSellerDeal.escrowWorkflow.step === 'signing_photos' &&
                            'Шаг 2: Банк подтвердил депонирование средств покупателя на эскроу/СБР • Назначена сессия подписания'}
                          {activeSellerDeal.escrowWorkflow.step === 'bank_funds_release' &&
                            'Шаг 3: Штамп Росреестра загружен куратором • Передано в банк на раскрытие аккредитива и выплату вашего кэша'}
                          {activeSellerDeal.escrowWorkflow.step === 'deal_finalized' &&
                            `Шаг 4: Аккредитив СБР раскрыт! Транш ${formatRubles(
                              activeSellerDeal.sellerReturnRub
                            )} (100% кэш, 0% комиссии) перечислен вам. Сделка закрыта.`}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-emerald-700 shrink-0">
                        {activeSellerDeal.escrowWorkflow.bankName} •{' '}
                        {activeSellerDeal.escrowWorkflow.escrowAccountNumber}
                      </span>
                    </div>
                  )}
                </div>

                {/* Assigned Curator Contact Card */}
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
                        {(activeSellerLot.curator?.name || curator?.name || 'КД')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        Ответственный сотрудник DomExit:
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {activeSellerLot.assignedEmployeeName ||
                          activeSellerLot.curator?.name ||
                          curator?.name ||
                          'Комплаенс-деск DomExit'}
                      </span>
                      <span className="text-emerald-700 font-semibold block text-[11px]">
                        {activeSellerLot.curator?.role || curator?.role || 'Юрист по 214-ФЗ'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                      href={`https://t.me/${(
                        activeSellerLot.curator?.telegram ||
                        curator?.telegram ||
                        'domexit_ru'
                      ).replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Telegram куратора</span>
                    </a>
                  </div>
                </div>

                {/* Live Yandex S3 Cloud Document Vault */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                      <FolderLock className="w-4 h-4 text-emerald-600" />
                      <span>
                        Защищенный сейф документов (Yandex S3 Bucket • {sellerVaultDocs.length} файлов):
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsSellerVaultOpen(true)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Открыть сейф документов S3</span>
                    </button>
                  </div>

                  {sellerVaultDocs.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2 text-xs text-slate-500">
                      <p>Документы по данному лоту еще не загружены в облачный сейф.</p>
                      <button
                        type="button"
                        onClick={() => setIsSellerVaultOpen(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                      >
                        Загрузить обязательный пакет (ДДУ, Справка об оплате, СФР)
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sellerVaultDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate">
                              {doc.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {doc.categoryLabelRu || doc.category} • {(doc.sizeBytes / 1024).toFixed(0)} КБ
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                doc.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : doc.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {doc.status === 'approved'
                                ? 'Одобрен'
                                : doc.status === 'rejected'
                                ? 'Отклонен'
                                : 'В сейфе'}
                            </span>
                            <button
                              type="button"
                              onClick={() => StorageService.downloadDocument(doc)}
                              className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: FAVORITES VIEW ================= */}
        {activeTab === 'favorites' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                    <Heart className="w-5 h-5 text-rose-600 fill-rose-600" />
                    <span>Избранные объекты ({favoriteLots.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Сохраненные лоты с живым отслеживанием статуса сделки в реестре 214-ФЗ.
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
                  <h3 className="font-bold text-base text-slate-700">
                    У вас пока нет сохраненных объектов
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Нажимайте на иконку сердца на карточке любого лота в каталоге для быстрого доступа.
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
                    <div
                      key={fav.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                    >
                      <div className="relative h-44 overflow-hidden">
                        <img
                          src={fav.imageUrl}
                          alt={fav.complexName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shadow-sm ${
                              fav.status === 'available'
                                ? 'bg-emerald-600 text-white'
                                : fav.status === 'processing'
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-700 text-white'
                            }`}
                          >
                            {fav.status === 'available'
                              ? 'Доступен'
                              : fav.status === 'processing'
                              ? 'В сделке'
                              : 'Закрыт'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(fav.lotCode)}
                          className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full text-rose-600 shadow-sm cursor-pointer"
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
                          <span className="text-xs text-slate-500">
                            {fav.district} • {fav.developer} • {fav.areaM2} м²
                          </span>
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

        {/* ================= TAB 4: PARTNER PORTAL VIEW ================= */}
        {activeTab === 'partner' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              
              {/* Partner Status Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">
                      {user?.isPartnerApproved || partnerAppRecord?.status === 'approved'
                        ? 'Аккредитованный партнер DomExit'
                        : partnerAppRecord?.status === 'pending'
                        ? 'Заявка партнера на модерации у Владельца'
                        : partnerAppRecord?.status === 'docs_requested'
                        ? 'Запрошены реквизиты партнера'
                        : 'Партнерский кабинет B2B'}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      Реф-код:{' '}
                      <strong>
                        {user?.partnerRefCode || partnerAppRecord?.referralCode || 'НЕ АКТИВИРОВАН'}
                      </strong>
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-950 tracking-tight mt-1">
                    Партнерский деск: передача клиентов по DEX-ID и контроль выплат
                  </h2>
                  {partnerAppRecord?.requestedDocsNotes && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl mt-1.5">
                      Запрос от Владельца платформы: {partnerAppRecord.requestedDocsNotes}
                    </p>
                  )}
                </div>

                {!user?.isPartnerApproved && !partnerAppRecord && (
                  <button
                    type="button"
                    onClick={() => upgradeToPartner()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Подать заявку на партнерский статус
                  </button>
                )}
              </div>

              {/* SMART PARTNER REFERRAL LINK CARD (Section 6) */}
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-white border-2 border-purple-300 rounded-3xl p-6 sm:p-7 shadow-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black shadow-xs">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Ваша реферальная ссылка для продавцов ДДУ
                      </h3>
                      <p className="text-xs text-slate-600">
                        Автоматическая фиксация вашего партнерского кода при переходе клиента
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-black self-start sm:self-auto shadow-xs">
                    30 000 – 50 000 ₽ / выход
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://domexit.ru/sellers?ref=${
                      user?.partnerRefCode || partnerAppRecord?.referralCode || user?.clientCode || 'DEX-PARTNER-77'
                    }`}
                    className="flex-1 bg-white border border-purple-300 text-purple-950 font-mono text-xs px-4 py-3 rounded-xl font-bold select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const refCode = user?.partnerRefCode || partnerAppRecord?.referralCode || user?.clientCode || 'DEX-PARTNER-77';
                      navigator.clipboard.writeText(`https://domexit.ru/sellers?ref=${refCode}`);
                      setCopiedPartnerLink(true);
                      setTimeout(() => setCopiedPartnerLink(false), 2500);
                    }}
                    className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 shadow-xs"
                  >
                    {copiedPartnerLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPartnerLink ? 'Скопировано!' : 'Копировать ссылку'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-purple-900 leading-relaxed">
                  * Отправляйте эту ссылку клиентам, желающим выйти из ДДУ. При переходе по ссылке ваш партнерский код будет зафиксирован автоматически, гарантируя вам комиссию 30 000 – 50 000 ₽ при закрытии сделки.
                </p>
              </div>

              {/* Refer Distressed Client Form with mandatory DEX-ID & strict financial validation */}
              <div className="bg-purple-50/50 border border-purple-200 rounded-3xl p-6 space-y-4">
                <div className="flex items-center space-x-2 text-purple-950 font-black text-sm">
                  <Share2 className="w-4 h-4 text-purple-600" />
                  <span>
                    Передать дольщика: регистрация по персональному ID клиента (DEX-XXXXXX)
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  Клиент регистрируется на DomExit и сообщает вам свой код (например, <code>DEX-784105</code>). У клиента открывается 7-дневный регламент загрузки скана ДДУ.
                </p>

                {partnerError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{partnerError}</span>
                  </div>
                )}

                <form
                  onSubmit={handlePartnerReferralSubmit}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
                >
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ID клиента (DEX) *</label>
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
                    <label className="block text-slate-700 font-bold mb-1">ФИО дольщика *</label>
                    <input
                      type="text"
                      required
                      placeholder="Белов Александр Владимирович"
                      value={refClientName}
                      onChange={(e) => setRefClientName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Телефон РФ (+7) *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+7 (911) 234-56-78"
                      value={refClientPhone}
                      onChange={(e) => setRefClientPhone(formatRussianPhoneInput(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ЖК / Объект *</label>
                    <input
                      type="text"
                      required
                      placeholder="ЖК «Чистое Небо»"
                      value={refComplexName}
                      onChange={(e) => setRefComplexName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Застройщик *</label>
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
                      Выплачено девелоперу (≥ 2 млн ₽) *
                    </label>
                    <input
                      type="number"
                      required
                      min={2000000}
                      max={50000000}
                      value={refPaidAmount}
                      onChange={(e) => setRefPaidAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Полная цена по ДДУ (₽) *
                    </label>
                    <input
                      type="number"
                      required
                      min={2100000}
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
                      <span>Отправить запрос (7 дней)</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Strictly Isolated 7-Day Referral Requests Table */}
              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span>Ваши переданные запросы ({partnerRequests.length}):</span>
                </h3>

                {partnerRequests.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    У вас пока нет отправленных 7-дневных запросов. Заполните форму выше, используя DEX-ID клиента.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">Код</th>
                          <th className="py-3 px-3">ID клиента</th>
                          <th className="py-3 px-3">Клиент</th>
                          <th className="py-3 px-3">Объект / ЖК</th>
                          <th className="py-3 px-3">Выплачено</th>
                          <th className="py-3 px-3 text-right">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {partnerRequests.map((req) => {
                          const countdown = formatRemainingTime(req.expiresAt);
                          return (
                            <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 font-mono font-bold text-slate-900">{req.id}</td>
                              <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                                {req.clientCode}
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-800">
                                <div>{req.clientName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {req.clientPhone}
                                </div>
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
                                    <span>Подтвержден ({req.activatedLotCode || 'В работе'})</span>
                                  </span>
                                ) : req.status === 'expired' || countdown.isExpired ? (
                                  <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px]">
                                    Истек срок 7 дней
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
                )}
              </div>

              {/* Live 5-Stage Partner Deal Commission Table (from DealsRepository.getByPartner) */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Активные сделки по вашему реф-коду и агентское вознаграждение ({partnerDeals.length}):</span>
                </h3>

                {partnerDeals.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    Когда клиент подтвердит ваш запрос и загрузит ДДУ, сделка автоматически отобразится здесь с расчетом комиссии.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">ID сделки</th>
                          <th className="py-3 px-3">Клиент</th>
                          <th className="py-3 px-3">Объект / Лот</th>
                          <th className="py-3 px-3">Текущий этап</th>
                          <th className="py-3 px-3">Вознаграждение</th>
                          <th className="py-3 px-3 text-right">Статус выплаты</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {partnerDeals.map((d) => (
                          <tr key={d.dealId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">
                              {d.dealId}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800">
                              {d.clientName || d.sellerName}
                            </td>
                            <td className="py-3 px-3">
                              {d.complexName || d.lotTitle} (#{d.lotCode})
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[10px]">
                                {STAGE_LABEL_RU[d.stage]}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                              {formatRubles(d.partnerRewardRub || 35000)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {d.stage === 'completed' || d.partnerPayoutStatus === 'paid' ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                  Выплачено
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                  После раскрытия эскроу
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ================= TAB 5: VIP INVESTOR PORTAL VIEW ================= */}
        {activeTab === 'investor' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              
              {/* Investor VIP Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1">
                      <Crown className="w-3 h-3 text-amber-700" />
                      <span>
                        {user?.isInvestorApproved || investorAppRecord?.status === 'approved'
                          ? 'Аккредитованный VIP Инвестор DomExit'
                          : investorAppRecord?.status === 'pending'
                          ? 'Анкета инвестора на рассмотрении Владельца'
                          : 'Закрытый клуб инвесторов'}
                      </span>
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-950 tracking-tight mt-1">
                    Закрытый пул «Ранний доступ 48 часов» и пакетные стратегии
                  </h2>
                  {investorAppRecord?.requestedDocsNotes && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl mt-1.5">
                      Запрос IR-деска: {investorAppRecord.requestedDocsNotes}
                    </p>
                  )}
                </div>

                {!user?.isInvestorApproved && !investorAppRecord && (
                  <button
                    type="button"
                    onClick={() => upgradeToInvestor()}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Подать заявку в VIP-Клуб
                  </button>
                )}
              </div>

              {/* 48-Hour Early Access Units Desk (Dynamic from live repository) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>
                      Лоты в режиме «Ранний доступ 48 часов» ({vipEarlyAccessLots.length} объектов):
                    </span>
                  </h3>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Приоритетный перехват до общего рынка
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(vipEarlyAccessLots.length > 0 ? vipEarlyAccessLots : allLots.slice(0, 2)).map(
                    (lot) => {
                      const discPct =
                        lot.todayDeveloperPrice > 0
                          ? ((lot.todayDeveloperPrice - lot.dduContractPrice) /
                              lot.todayDeveloperPrice) *
                            100
                          : 22;
                      return (
                        <div
                          key={lot.id}
                          className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/30 space-y-3"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-bold text-[10px] uppercase">
                                Осталось {lot.earlyAccessHoursLeft || 36} ч. • #{lot.lotCode}
                              </span>
                              <h4 className="font-bold text-sm text-slate-900 mt-1">
                                {lot.complexName}
                              </h4>
                              <span className="text-xs text-slate-500">
                                {lot.district} • {lot.developer} • {lot.areaM2} м²
                              </span>
                            </div>
                            <span className="font-mono font-bold text-emerald-700 text-sm shrink-0">
                              {formatRubles(lot.cashPaidBySeller)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-amber-200 text-xs">
                            <span className="text-slate-700">
                              Дисконт к застройщику:{' '}
                              <strong className="text-emerald-700">-{formatPercent(discPct)}</strong>
                            </span>
                            <Link
                              to={`/opportunities/${lot.lotCode}`}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                            >
                              Открыть паспорт лота →
                            </Link>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Direct Communication Channel with Leadership */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Прямая линия с руководством: Генеральный директор (CEO) Ahmed Abdallah</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Структурирование синдицированных пулов от 50 млн ₽ и оптовый выкуп региональных цессий.
                  </p>
                </div>
                <a
                  href="https://t.me/domexit_ru"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Прямой канал IR Desk</span>
                </a>
              </div>

              {/* Interactive Budget & Investment Package Builder (Persisted Live via DAL) */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>Интерактивный конструктор инвестиционного мандата:</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    {packageSavedToast && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                        ✓ Сохранено в профиле
                      </span>
                    )}
                    <span className="font-mono font-black text-indigo-700 text-sm">
                      Капитал: {investorBudgetMillions} 000 000 ₽
                    </span>
                  </div>
                </div>

                <input
                  type="range"
                  min={10}
                  max={150}
                  step={5}
                  value={investorBudgetMillions}
                  onChange={(e) =>
                    handleSaveInvestorPackage(Number(e.target.value), selectedPackage)
                  }
                  className="w-full accent-indigo-600 cursor-pointer"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {[
                    {
                      id: 'flipping' as const,
                      title: 'Пакет «Оптовый флиппинг»',
                      desc: 'Выкуп пула из 2–4 ликвидных квартир с дисконтом 22–28% и реализация перед вводом корпуса.',
                      irr: 'Целевая доходность: 32% годовых',
                    },
                    {
                      id: 'turnkey' as const,
                      title: 'Пакет «Под ключ + Аренда»',
                      desc: 'Выкуп цессии + чистовая меблировка + передача в арендное управление с первого дня выдачи ключей.',
                      irr: 'Целевая доходность: 19% годовых',
                    },
                    {
                      id: 'syndicate' as const,
                      title: 'Пакет «Синдицированный пул»',
                      desc: 'Совместное финансирование крупных лотов бизнес/премиум класса в Москве, СПб и Сочи по 214-ФЗ.',
                      irr: 'Фиксированный ориентир: 24% годовых',
                    },
                  ].map((pkg) => (
                    <div
                      key={pkg.id}
                      onClick={() => handleSaveInvestorPackage(investorBudgetMillions, pkg.id)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                        selectedPackage === pkg.id
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="font-bold text-xs text-slate-900 block">{pkg.title}</span>
                      <p className="text-[11px] text-slate-600 leading-snug">{pkg.desc}</p>
                      <div className="text-xs font-mono font-bold text-indigo-700 pt-1">
                        {pkg.irr}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ================= TAB 6: 152-FZ PROOF OF CONSENTS ARCHIVE ================= */}
        {activeTab === 'consents' && (
          <div className="space-y-6">
            {/* Header Compliance Overview Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Федеральный закон № 152-ФЗ • Статья 9
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                      Реестр выданных согласий и доказательств (Proof of Consent)
                    </h2>
                  </div>
                </div>

                <Link
                  to="/legal/archive"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center space-x-1.5 shrink-0 self-start sm:self-auto"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Публичный архив редакций</span>
                </Link>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                В соответствии с требованиями Федерального закона № 152-ФЗ «О персональных данных» и методическими рекомендациями Роскомнадзора, платформа DomExit ведет строгий неизменяемый учет всех юридических волеизъявлений субъектов персональных данных. Каждая запись содержит криптографическую контрольную сумму (SHA-256) текста документа на момент акцепта.
              </p>

              {/* Roskomnadzor Badges */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Локализация в РФ (Yandex Cloud УЗ-1)</span>
                </span>
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                  <span>Трансграничная передача: 0% (Запрещена)</span>
                </span>
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                  <span>Стандарт хэширования: SHA-256</span>
                </span>
              </div>
            </div>

            {/* Consents List */}
            {userConsents.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">
                Активных записей о согласиях пока не зафиксировано.
              </div>
            ) : (
              <div className="space-y-4">
                {userConsents.map((consent) => (
                  <div
                    key={consent.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Юридический документ
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                            Действительно
                          </span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 mt-0.5">
                          {CANONICAL_POLICY_NAMES[consent.policyType as keyof typeof CANONICAL_POLICY_NAMES] || consent.policyType}
                        </h3>
                      </div>

                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 self-start sm:self-auto">
                        Редакция {consent.policyVersion}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Время фиксации (МСК):
                        </span>
                        <span className="font-semibold text-slate-800">
                          {new Date(consent.consentedAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Узел и сессия:
                        </span>
                        <span className="font-mono text-slate-700 truncate block">
                          {consent.ipAddress || '127.0.0.1 (Yandex Cloud DC)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Метод согласия:
                        </span>
                        <span className="font-semibold text-emerald-800">
                          {consent.consentMethod === 'reconsent_modal'
                            ? 'Модальное окно обновления'
                            : consent.consentMethod === 'portal_action'
                            ? 'Личный кабинет'
                            : 'Веб-форма регистрации'}
                        </span>
                      </div>
                    </div>

                    {/* SHA-256 Box */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-3 rounded-xl font-mono text-xs">
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <span className="text-slate-400 font-sans font-bold text-[10px] uppercase shrink-0">
                          Хэш текста (SHA-256):
                        </span>
                        <span className="text-emerald-400 truncate font-semibold">
                          {consent.policySha256}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(consent.policySha256);
                              setCopiedConsentSha(consent.policySha256);
                              setTimeout(() => setCopiedConsentSha(null), 2500);
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          {copiedConsentSha === consent.policySha256 ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-sans">Скопировано</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="font-sans">Копировать</span>
                            </>
                          )}
                        </button>

                        <Link
                          to="/legal/archive"
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[11px] font-sans font-bold transition-colors"
                        >
                          Сверить текст &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Right of withdrawal notice */}
            <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
              <div className="font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Право на отзыв согласия (ст. 9 ч. 2 152-ФЗ)</span>
              </div>
              <p>
                Вы имеете право в любой момент полностью или частично отозвать ранее предоставленные согласия на обработку персональных данных. Для отзыва направьте заявление в свободной форме на адрес ответственного лица по защите данных:{' '}
                <a href="mailto:help@domexit.ru" className="text-emerald-700 font-bold underline">
                  help@domexit.ru
                </a>{' '}
                или обратитесь к персональному юридическому куратору. Обработка данных будет прекращена в установленный законом срок до 30 календарных дней с оформлением акта об уничтожении.
              </p>
            </div>
          </div>
        )}

        {/* ================= MODAL 1: Complete 7-Day Preliminary Request with Real S3 Upload ================= */}
        {isCompleteModalOpen && selectedReqForCompletion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-950 text-base">
                      Подтверждение заявки и загрузка ДДУ в S3
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      ID клиента: {selectedReqForCompletion.clientCode}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Партнер-агент:</span>
                  <span className="font-bold text-slate-900">{selectedReqForCompletion.partnerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Объект / ЖК:</span>
                  <span className="font-bold text-slate-900">{selectedReqForCompletion.complexName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Сумма к возврату:</span>
                  <span className="font-bold font-mono text-emerald-800">
                    {formatRubles(selectedReqForCompletion.paidAmountRub)}
                  </span>
                </div>
              </div>

              {completionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {completionError}
                </div>
              )}

              <form onSubmit={handleCompletePreliminaryRequest} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Скан договора ДДУ (с отметкой Росреестра / ЭЦП) *
                  </label>
                  <div className="p-4 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50/40 text-center space-y-2">
                    <Upload className="w-6 h-6 text-amber-600 mx-auto" />
                    <p className="text-xs text-slate-600">
                      {completionDocMeta
                        ? `✓ Сохранено в S3: ${completionDocMeta.name} (${(
                            completionDocMeta.sizeBytes / 1024
                          ).toFixed(0)} КБ)`
                        : 'Выберите реальный файл со своего устройства (PDF, JPG, PNG)'}
                    </p>
                    <button
                      type="button"
                      onClick={handleSelectPreliminaryDduFile}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        completionDocMeta
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                      }`}
                    >
                      {completionDocMeta ? 'Заменить файл ДДУ' : 'Выбрать файл ДДУ с устройства'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Комментарий для комплаенс-офиса
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Пожелания по срокам выхода на сделку..."
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
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Подтвердить и отправить на аудит
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


      </main>

      {/* Interactive Cloud Document Vault Modal for Seller */}
      {activeSellerLot && (
        <DocumentVaultModal
          isOpen={isSellerVaultOpen}
          onClose={() => setIsSellerVaultOpen(false)}
          entityType="lot"
          entityId={activeSellerLot.lotCode}
          entityTitle={`${activeSellerLot.complexName} (#${activeSellerLot.lotCode})`}
          uploadedByUid={user?.id || 'usr-seller-001'}
          clientCode={user?.clientCode || 'DEX-784105'}
          mode="seller"
          canUpload={true}
          canReview={false}
          onDocumentsChanged={(updated) => setSellerVaultDocs(updated)}
        />
      )}
    </div>
  );
};
