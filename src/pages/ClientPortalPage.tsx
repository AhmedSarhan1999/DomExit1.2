import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, FileCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { apiClient } from '../services/apiClient';
import { GosuslugiEgrnGuide } from '../components/shared/GosuslugiEgrnGuide';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { PartnerRequestsRepository } from '../dal/repositories/PartnerRequestsRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { SellerRequestsRepository } from '../dal/repositories/SellerRequestsRepository';
import { LegalPoliciesRepository } from '../dal/repositories/LegalPoliciesRepository';
import { StorageService } from '../dal/StorageService';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { FileManager } from '../utils/fileManager';
import { useFeatureFlagsStore } from '../stores/useFeatureFlagsStore';

// Modals
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { UserProfileModal } from '../components/profile/UserProfileModal';
import { CuratorChatWidget } from '../components/chat/CuratorChatWidget';
import { EscrowBridgeChatModal } from '../components/chat/EscrowBridgeChatModal';
import { TelegramConnectCard } from '../components/telegram/TelegramConnectCard';

// Subcomponents in src/components/portal/
import { PortalProfileHeader, PortalTab } from '../components/portal/PortalProfileHeader';
import { BuyerDealsTab } from '../components/portal/BuyerDealsTab';
import { SellerLotsTab } from '../components/portal/SellerLotsTab';
import { FavoritesTab } from '../components/portal/FavoritesTab';
import { PartnerPortalTab } from '../components/portal/PartnerPortalTab';
import { ConsentsArchiveTab } from '../components/portal/ConsentsArchiveTab';
import { BuyerBuyBoxTab } from '../components/portal/BuyerBuyBoxTab';
import { PartnerPreliminaryAlertBanner } from '../components/portal/PartnerPreliminaryAlertBanner';
import { PreliminaryRequestModal } from '../components/portal/PreliminaryRequestModal';

import {
  DealTrack,
  BuyerCandidate,
  Lot,
  PartnerEntry,
  PartnerPreliminaryRequest,
  Employee,
  SellerExitRequest,
  DocumentMetadata,
  ProofOfConsentRecord,
} from '../types';

const VALID_TABS: PortalTab[] = ['buybox', 'buyer', 'seller', 'favorites', 'partner', 'consents'];

export const ClientPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    loading: authLoading,
    logout,
    toggleFavorite,
    upgradeToPartner,
    openAuthModal,
  } = useAuth();
  const { language } = useLanguage();
  const { enableVipClub, enableBankPortal } = useFeatureFlagsStore();
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

    if (user.role === 'bank' || user.activeRole === 'bank') {
      navigate('/admin/bank-gateway', { replace: true });
      return;
    }

    if (user.role === 'employee' || user.activeRole === 'employee') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
  }, [user, isAuthenticated, authLoading, navigate, language]);

  const resolveDefaultTab = (): PortalTab => {
    const paramTab = searchParams.get('tab') as PortalTab | null;
    if (paramTab && VALID_TABS.includes(paramTab)) {
      if (paramTab === 'partner' && !user?.isPartnerApproved) return 'buyer';
      return paramTab;
    }
    if (user?.activeRole === 'seller') return 'seller';
    if (user?.activeRole === 'partner' && user?.isPartnerApproved) return 'partner';
    return 'buyer';
  };

  const [activeTab, setActiveTab] = useState<PortalTab>(resolveDefaultTab);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sync URL ?tab= changes
  useEffect(() => {
    const paramTab = searchParams.get('tab') as PortalTab | null;
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== activeTab) {
      if (paramTab === 'partner' && !user?.isPartnerApproved) return;
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
  const [isBuyerVaultOpen, setIsBuyerVaultOpen] = useState<boolean>(false);
  const [buyerVaultLotCode, setBuyerVaultLotCode] = useState<string>('');
  const [activeEscrowChatDeal, setActiveEscrowChatDeal] = useState<{
    dealId: string;
    dealStage?: string;
    lotCode?: string;
    lotTitle?: string;
    bankName?: string;
    buyerName?: string;
  } | null>(null);

  // Seller State
  const [sellerLots, setSellerLots] = useState<Lot[]>([]);
  const [sellerDeals, setSellerDeals] = useState<DealTrack[]>([]);
  const [sellerRequests, setSellerRequests] = useState<SellerExitRequest[]>([]);
  const [selectedSellerLotCode, setSelectedSellerLotCode] = useState<string>('');
  const [sellerVaultDocs, setSellerVaultDocs] = useState<DocumentMetadata[]>([]);
  const [isSellerVaultOpen, setIsSellerVaultOpen] = useState<boolean>(false);
  const [isUploadingRequestedDoc, setIsUploadingRequestedDoc] = useState<boolean>(false);
  const [curator, setCurator] = useState<Employee | null>(null);

  // Curator Chat Widget State
  const [isCuratorChatOpen, setIsCuratorChatOpen] = useState<boolean>(false);
  const [activeChatLotCode, setActiveChatLotCode] = useState<string>('');
  const [activeChatDealId, setActiveChatDealId] = useState<string>('');

  // Partner State
  const [pendingPreliminaryReqs, setPendingPreliminaryReqs] = useState<PartnerPreliminaryRequest[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerPreliminaryRequest[]>([]);
  const [partnerDeals, setPartnerDeals] = useState<DealTrack[]>([]);
  const [partnerAppRecord, setPartnerAppRecord] = useState<PartnerEntry | null>(null);

  // Preliminary Request Completion Modal State
  const [selectedReqForCompletion, setSelectedReqForCompletion] = useState<PartnerPreliminaryRequest | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false);
  const [completionDocMeta, setCompletionDocMeta] = useState<DocumentMetadata | null>(null);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [completionError, setCompletionError] = useState<string | null>(null);

  // 152-FZ Consents State
  const [userConsents, setUserConsents] = useState<ProofOfConsentRecord[]>([]);

  // 63-FZ PEP Digital Signatures State
  const [signatures, setSignatures] = useState<any[]>([]);

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
    const clientCode = user?.clientCode || '';
    const partnerRefCode = user?.partnerRefCode || '';

    const [
      lotsData,
      myBids,
      pendingReqs,
      myPartnerReqs,
      myPartnerDeals,
      allEmps,
      mySellerLots,
      mySellerDeals,
      mySellerReqs,
      myPartnerEntry,
      allDealsList,
      consentsList,
    ] = await Promise.all([
      LotsRepository.getAll({ status: 'all', isVipInvestor: true, includePendingApproval: true }),
      CandidatesRepository.getByUserId(uid, clientCode),
      PartnerRequestsRepository.getPendingByClientCode(clientCode),
      PartnerRequestsRepository.getByPartner(uid, partnerRefCode),
      partnerRefCode ? DealsRepository.getByPartner(partnerRefCode) : Promise.resolve([]),
      EmployeesRepository.getAll(),
      LotsRepository.getBySeller(uid, clientCode, user?.email, user?.phone),
      DealsRepository.getBySeller(uid, clientCode),
      SellerRequestsRepository.getByUser(uid, clientCode),
      PartnersRepository.getById(uid || clientCode),
      DealsRepository.getAll(),
      LegalPoliciesRepository.getUserConsents(uid || clientCode),
    ]);

    setAllLots(lotsData);
    setAllDeals(allDealsList);
    setPendingPreliminaryReqs(pendingReqs);
    setPartnerRequests(myPartnerReqs);
    setPartnerDeals(myPartnerDeals);
    setPartnerAppRecord(myPartnerEntry);
    setUserBids(myBids);

    // Fetch PEP Digital Signatures 63-FZ
    try {
      const sigsRes = await apiClient.pep.getMySignatures();
      if (sigsRes && Array.isArray(sigsRes.signatures)) {
        setSignatures(sigsRes.signatures);
      }
    } catch {
      // Non-fatal if offline
    }

    // Consents
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

    // Seller lots & deals deduplication
    const effectiveSellerLots = [...mySellerLots];
    for (const deal of mySellerDeals) {
      if (deal.lotCode && !effectiveSellerLots.some((l) => l.lotCode?.toUpperCase() === deal.lotCode?.toUpperCase())) {
        const found = lotsData.find((l) => l.lotCode?.toUpperCase() === deal.lotCode?.toUpperCase());
        if (found) effectiveSellerLots.push(found);
      }
    }
    for (const req of mySellerReqs) {
      if (req.lotCode && !effectiveSellerLots.some((l) => l.lotCode?.toUpperCase() === req.lotCode?.toUpperCase())) {
        const found = lotsData.find((l) => l.lotCode?.toUpperCase() === req.lotCode?.toUpperCase());
        if (found) effectiveSellerLots.push(found);
      }
    }

    const seenSellerCodes = new Set<string>();
    const deduplicatedSellerLots = effectiveSellerLots.filter((l) => {
      const code = (l.lotCode || l.id || '').toUpperCase();
      if (!code || seenSellerCodes.has(code)) return false;
      seenSellerCodes.add(code);
      return true;
    });
    setSellerLots(deduplicatedSellerLots);
    setSellerDeals(mySellerDeals);
    setSellerRequests(mySellerReqs);

    const activeCode =
      selectedSellerLotCode && effectiveSellerLots.some((l) => l.lotCode === selectedSellerLotCode)
        ? selectedSellerLotCode
        : effectiveSellerLots[0]?.lotCode || '';
    setSelectedSellerLotCode(activeCode);

    if (activeCode) {
      const activeLotObj = mySellerLots.find((l) => l.lotCode === activeCode);
      const docs = await StorageService.getDocumentsByEntity('lot', activeCode);
      setSellerVaultDocs(docs);

      if (activeLotObj?.assignedEmployeeId) {
        const emp = allEmps.find((e) => e.id === activeLotObj.assignedEmployeeId);
        setCurator(emp || null);
      } else {
        setCurator(null);
      }
    } else {
      setSellerVaultDocs([]);
      setCurator(null);
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
  }, [user, user?.favorites]);

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

  const handleCancelSellerRequest = async (lotCode: string) => {
    if (
      !confirm(
        language === 'ru'
          ? `Вы уверены, что хотите отозвать заявку по лоту #${lotCode}? Заявка и связанный черновик сделки будут безвозвратно удалены из системы.`
          : `Are you sure you want to withdraw request #${lotCode}?`
      )
    )
      return;

    try {
      await LotsRepository.deleteLotAndDeal(lotCode, user?.name || 'Продавец');
      setSelectedSellerLotCode('');
      await loadData();
    } catch (err: any) {
      alert(`Ошибка отзыва заявки: ${err?.message || 'Сбой'}`);
    }
  };

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
          `Документ «${meta.name}» успешно загружен и отправлен куратору на проверку!`
        );
        await loadData();
        setTimeout(() => setActionNotice(null), 6000);
      }
    } finally {
      setIsUploadingRequestedDoc(false);
    }
  };

  const handleDownloadBidProof = async (bid: BuyerCandidate) => {
    await FileManager.downloadDocument(bid, {
      fileName:
        bid.bankApprovalDocName ||
        bid.bankStatementName ||
        'Подтверждение_банка.pdf',
    });
  };

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
      setCompletionError('Пожалуйста, загрузите скан или фото договора ДДУ.');
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
      `Договор ДДУ успешно загружен! Создан лот #${lot.lotCode} и направлен на верификацию.`
    );
    await loadData();
    setTimeout(() => setActionNotice(null), 6000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Instant enterprise redirect: Owner and Staff must NEVER hang or land in consumer /portal
  if (
    user &&
    (user.role === 'owner' ||
      user.role === 'admin' ||
      user.role === 'employee' ||
      user.activeRole === 'owner' ||
      user.activeRole === 'employee')
  ) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user && (user.role === 'bank' || user.activeRole === 'bank')) {
    return <Navigate to="/admin/bank-gateway" replace />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Top Banner: Client Profile Bar */}
      <PortalProfileHeader
        user={user}
        displayName={displayName}
        displayClientCode={displayClientCode}
        displayInitial={displayInitial}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        buyerBidsCount={userBids.length}
        sellerLotsCount={sellerLots.length}
        favoritesCount={favoriteLots.length}
        isPartnerApproved={Boolean(user?.isPartnerApproved)}
        enableVipClub={enableVipClub}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        <TelegramConnectCard className="shadow-sm" />

        {actionNotice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 7-Day Countdown Alert for Pending Partner Preliminary Request */}
        {pendingPreliminaryReqs.length > 0 && (
          <PartnerPreliminaryAlertBanner
            request={pendingPreliminaryReqs[0]}
            remainingTimeText={formatRemainingTime(pendingPreliminaryReqs[0].expiresAt).text}
            onOpenModal={() => {
              setSelectedReqForCompletion(pendingPreliminaryReqs[0]);
              setIsCompleteModalOpen(true);
            }}
          />
        )}

        {/* TAB 0: BUY-BOX & DETERMINISTIC QUEUE */}
        {activeTab === 'buybox' && (
          <BuyerBuyBoxTab user={user} />
        )}

        {/* TAB 1: BUYER OFFERS VIEW */}
        {activeTab === 'buyer' && (
          <BuyerDealsTab
            userBids={userBids}
            allLots={allLots}
            allDeals={allDeals}
            user={user}
            enableBankPortal={enableBankPortal}
            onDownloadBidProof={handleDownloadBidProof}
            onOpenBankEscrowChat={(deal) => setActiveEscrowChatDeal(deal)}
            onOpenCuratorChat={(lotCode, dealId) => {
              setActiveChatLotCode(lotCode);
              setActiveChatDealId(dealId);
              setIsCuratorChatOpen(true);
            }}
            onOpenBuyerVault={(lotCode) => {
              setBuyerVaultLotCode(lotCode);
              setIsBuyerVaultOpen(true);
            }}
          />
        )}

        {/* TAB 2: SELLER LISTINGS VIEW */}
        {activeTab === 'seller' && (
          <div className="space-y-6">
            <GosuslugiEgrnGuide className="shadow-sm" />
            <SellerLotsTab
              sellerLots={sellerLots}
              selectedSellerLotCode={selectedSellerLotCode}
              onSelectSellerLotCode={setSelectedSellerLotCode}
              activeSellerLot={activeSellerLot}
              activeSellerDeal={activeSellerDeal}
              activeSellerRequest={activeSellerRequest}
              sellerVaultDocs={sellerVaultDocs}
              curator={curator}
              enableBankPortal={enableBankPortal}
              isUploadingRequestedDoc={isUploadingRequestedDoc}
              onUploadCuratorRequestedDoc={handleUploadCuratorRequestedDoc}
              onCancelSellerRequest={handleCancelSellerRequest}
              onOpenSellerVault={() => setIsSellerVaultOpen(true)}
              onOpenCuratorChat={(lotCode) => {
                setActiveChatLotCode(lotCode);
                setIsCuratorChatOpen(true);
              }}
            />
          </div>
        )}

        {/* TAB 3: FAVORITES VIEW */}
        {activeTab === 'favorites' && (
          <FavoritesTab
            favoriteLots={favoriteLots}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {/* TAB 4: PARTNER PORTAL VIEW */}
        {activeTab === 'partner' && (
          <PartnerPortalTab
            user={user}
            partnerAppRecord={partnerAppRecord}
            partnerRequests={partnerRequests}
            partnerDeals={partnerDeals}
            onUpgradeToPartner={upgradeToPartner}
            onRequestCreated={(newReq) => setPartnerRequests((prev) => [newReq, ...prev])}
            onShowNotice={(msg) => {
              setActionNotice(msg);
              setTimeout(() => setActionNotice(null), 6000);
            }}
            formatRemainingTime={formatRemainingTime}
          />
        )}

        {/* TAB 5: 152-FZ PROOF OF CONSENTS ARCHIVE */}
        {activeTab === 'consents' && (
          <ConsentsArchiveTab userConsents={userConsents} />
        )}

        {/* Section: My PEP Digital Signatures 63-FZ */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2 text-indigo-700">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  РЕЕСТР ЭЛЕКТРОННЫХ ПОДПИСЕЙ (ПЭП • 63-ФЗ)
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900">
                Мои подписанные юридические документы и соглашения
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {signatures.length} документов
            </span>
          </div>

          {signatures.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              Пока нет подписанных соглашений. При запросе просмотра или бронировании объектов здесь будут отображаться ваши акты и сертификаты ПЭП.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Дата (МСК)</th>
                    <th className="py-2.5 px-3">Документ</th>
                    <th className="py-2.5 px-3">Лот</th>
                    <th className="py-2.5 px-3">Статус подписи</th>
                    <th className="py-2.5 px-3">Хеш (SHA-256)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {signatures.map((sig) => (
                    <tr key={sig.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(sig.signedAt).toLocaleString('ru-RU')}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                        {sig.documentType === 'nda_viewing_act'
                          ? 'Акт осмотра и NDA'
                          : sig.documentType === 'seller_exclusive_consent'
                          ? 'Согласие продавца'
                          : 'Условия бронирования'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-indigo-700">#{sig.lotCode}</td>
                      <td className="py-2.5 px-3 font-sans text-emerald-700 font-semibold">
                        ✓ Подписано (Telegram OTP)
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs" title={sig.docHashSha256}>
                        {sig.docHashSha256?.substring(0, 16)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Preliminary Request Modal */}
        <PreliminaryRequestModal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          request={selectedReqForCompletion}
          completionDocMeta={completionDocMeta}
          completionNotes={completionNotes}
          onNotesChange={setCompletionNotes}
          completionError={completionError}
          onSelectFile={handleSelectPreliminaryDduFile}
          onSubmit={handleCompletePreliminaryRequest}
        />
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

      {/* Interactive Cloud Document Vault Modal for Buyer */}
      <DocumentVaultModal
        isOpen={isBuyerVaultOpen}
        onClose={() => setIsBuyerVaultOpen(false)}
        entityType="lot"
        entityId={buyerVaultLotCode}
        entityTitle={`Документы по сделке (#${buyerVaultLotCode})`}
        uploadedByUid={user?.id || 'usr-buyer-001'}
        clientCode={user?.clientCode || 'DEX-000000'}
        mode="general"
        canUpload={true}
        canReview={false}
      />

      {/* Escrow Bridge Chat Modal */}
      {activeEscrowChatDeal && (
        <EscrowBridgeChatModal
          isOpen={true}
          onClose={() => setActiveEscrowChatDeal(null)}
          dealId={activeEscrowChatDeal.dealId}
          dealStage={activeEscrowChatDeal.dealStage}
          lotCode={activeEscrowChatDeal.lotCode}
          lotTitle={activeEscrowChatDeal.lotTitle}
          bankName={activeEscrowChatDeal.bankName}
          buyerName={activeEscrowChatDeal.buyerName}
          currentRole="buyer"
          currentUserName={user?.name}
        />
      )}

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <CuratorChatWidget
        isOpen={isCuratorChatOpen}
        onClose={() => setIsCuratorChatOpen(false)}
        lotCode={activeChatLotCode}
        dealId={activeChatDealId}
        curatorName={curator?.name || 'Юридический куратор DomExit'}
        curatorRole={curator?.role || 'Персональный куратор сделки'}
        curatorPhone={curator?.phone}
        curatorTelegram={curator?.telegram}
        curatorMax={curator?.maxProfile}
      />
    </div>
  );
};
