import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import {
  Landmark,
  ShieldCheck,
  ShieldAlert,
  Crown,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Users,
  User,
  Wallet,
  Building2,
  Plus,
  Lock,
  Unlock,
  Award,
  Search,
  ExternalLink,
  Percent,
  Eye,
  FolderOpen,
  MessageSquare,
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Layers,
  Lightbulb,
  Loader2,
  Edit,
  FileCheck,
} from 'lucide-react';
import {
  withAsyncTimeout,
  isValidInn,
  getInnValidationError,
  ASYNC_NETWORK_TIMEOUT_MESSAGE,
} from '../utils/asyncGuard';
import { useAuth } from '../context/AuthContext';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { DevelopersRepository, PARTNER_BANKS, formatDeveloperOption } from '../dal/repositories/DevelopersRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import {
  AccreditedDeveloper,
  BankEmployee,
  DealTrack,
  DeveloperAccreditationRequest,
  DeveloperBankTerms,
  Lot,
  PartnerBankName,
  PartnerBankEntity,
  SpecialApprovalRequest,
  BankTabPermission,
} from '../types';
import { formatRubles } from '../utils/formatters';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { UserProfileModal } from '../components/profile/UserProfileModal';
import { EscrowBridgeChatModal } from '../components/chat/EscrowBridgeChatModal';
import { BankGatewayErrorBoundary } from '../components/common/BankGatewayErrorBoundary';
import { useEnvironmentStore } from '../stores/useEnvironmentStore';
import { useFeatureFlagsStore } from '../stores/useFeatureFlagsStore';

export const BankPortalPage: React.FC = () => {
  const { user, quickDemoLogin, openAuthModal } = useAuth();
  const { enableBankPortal } = useFeatureFlagsStore();

  if (!enableBankPortal) {
    const isStaff = Boolean(
      user &&
        (user.activeRole === 'owner' ||
          user.activeRole === 'admin' ||
          user.activeRole === 'employee' ||
          user.role === 'admin' ||
          user.role === 'curator' ||
          user.email === 'amaas9499@gmail.com')
    );
    return <Navigate to={isStaff ? '/admin/dashboard' : '/'} replace />;
  }

  const { isProduction } = useEnvironmentStore();
  const showTestSwitchers = !isProduction;
  const [searchParams] = useSearchParams();
  const bankIdParam = searchParams.get('bankId') || searchParams.get('bank');

  const [activeTab, setActiveTab] = useState<
    'escrow' | 'developer_accreditation' | 'special' | 'staff'
  >('escrow');

  const [activePartnerBank, setActivePartnerBank] = useState<PartnerBankName>('Сбербанк');
  const [partnerBanksList, setPartnerBanksList] = useState<PartnerBankEntity[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [deals, setDeals] = useState<DealTrack[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [devRequests, setDevRequests] = useState<DeveloperAccreditationRequest[]>([]);
  const [accreditedDevs, setAccreditedDevs] = useState<AccreditedDeveloper[]>([]);
  const [specialRequests, setSpecialRequests] = useState<SpecialApprovalRequest[]>([]);
  const [bankStaff, setBankStaff] = useState<BankEmployee[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [escrowSearchQuery, setEscrowSearchQuery] = useState('');
  const [devSearchQuery, setDevSearchQuery] = useState('');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeEscrowChatDeal, setActiveEscrowChatDeal] = useState<{
    dealId: string;
    dealStage?: string;
    lotCode?: string;
    lotTitle?: string;
    bankName?: string;
    buyerName?: string;
  } | null>(null);
  const [escrowFilter, setEscrowFilter] = useState<
    'all_active' | 'pending_deposit' | 'awaiting_curator' | 'ready_for_release' | 'archived'
  >('all_active');

  // Document Vault Preview Modal
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [vaultModalTitle, setVaultModalTitle] = useState('');
  const [vaultEntityId, setVaultEntityId] = useState('U-10566');

  // Special Approval Decision Modal State (Task 5: Per-Project Granular Approval)
  const [selectedSpecialReq, setSelectedSpecialReq] = useState<SpecialApprovalRequest | null>(null);
  const [specialApprovedRate, setSpecialApprovedRate] = useState<number>(19.9);
  const [specialMaxPdn, setSpecialMaxPdn] = useState<40 | 50 | 60>(50);
  const [specialDecisionNotes, setSpecialDecisionNotes] = useState<string>(
    'Согласовано кредитным комитетом банка с открытием проектной линии эскроу'
  );
  const [expandedContractors, setExpandedContractors] = useState<Record<string, boolean>>({});

  // Developer Accreditation State (Task 4: Add & Edit Accreditation)
  const [showAddDevModal, setShowAddDevModal] = useState<boolean>(false);
  const [selectedDevToAdd, setSelectedDevToAdd] = useState<string>('');
  const [customDevNameToAdd, setCustomDevNameToAdd] = useState<string>('');
  const [customDevInnToAdd, setCustomDevInnToAdd] = useState<string>('');
  const [addDevBaseRate, setAddDevBaseRate] = useState<number>(19.8);
  const [addDevFamily6, setAddDevFamily6] = useState<boolean>(true);
  const [addDevIt6, setAddDevIt6] = useState<boolean>(true);
  const [addDevMaxPdn, setAddDevMaxPdn] = useState<40 | 50 | 60>(50);

  // Edit Developer Terms State
  const [editingDev, setEditingDev] = useState<AccreditedDeveloper | null>(null);
  const [editDevBaseRate, setEditDevBaseRate] = useState<number>(19.8);
  const [editDevFamily6, setEditDevFamily6] = useState<boolean>(true);
  const [editDevIt6, setEditDevIt6] = useState<boolean>(true);
  const [editDevMaxPdn, setEditDevMaxPdn] = useState<40 | 50 | 60>(50);

  // Competitive Intelligence State
  const [compIntel, setCompIntel] = useState<{
    minRate: number | null;
    lowestBank: string | null;
    avgRate: number | null;
    maxPdn: number | null;
    otherOffersCount: number;
    hasFamilyMortgage: boolean;
    hasItMortgage: boolean;
  } | null>(null);

  // Developer Accreditation Decision Modal State
  const [selectedDevReq, setSelectedDevReq] = useState<DeveloperAccreditationRequest | null>(null);
  const [devDecisionBank, setDevDecisionBank] = useState<PartnerBankName>('Сбербанк');
  const [devBaseRateInput, setDevBaseRateInput] = useState<number>(19.8);
  const [devFamilyMortgage6, setDevFamilyMortgage6] = useState<boolean>(true);
  const [devItMortgage6, setDevItMortgage6] = useState<boolean>(true);
  const [devMaxPdnPercent, setDevMaxPdnPercent] = useState<40 | 50 | 60>(50);
  const [devDecisionNotes, setDevDecisionNotes] = useState<string>(
    'Проектная декларация 214-ФЗ и эскроу-модель соответствуют требованиям банка'
  );

  // New Bank Staff Modal State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('+7 (495) 500-00-00');
  const [newStaffRole, setNewStaffRole] = useState<BankEmployee['role']>('officer');
  const [newStaffBank, setNewStaffBank] = useState<string>('Сбербанк');
  const [newStaffPermissions, setNewStaffPermissions] = useState<BankTabPermission[]>([
    'escrow',
    'developer_accreditation',
    'special',
    'staff',
  ]);

  // Edit Bank Staff Modal State (Full Staff CRUD)
  const [editingStaff, setEditingStaff] = useState<BankEmployee | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<BankEmployee['role']>('officer');
  const [editStaffPermissions, setEditStaffPermissions] = useState<BankTabPermission[]>([]);

  // Async Action Guard & Double-Submit State
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadData = async () => {
    try {
      const [dList, lList, devReqList, devAllList, sList, stList, pbList] = await Promise.all([
        DealsRepository.getAll(),
        LotsRepository.getAll({ includePendingApproval: true }),
        DevelopersRepository.getAllAccreditationRequests(),
        DevelopersRepository.getAllDevelopers(),
        BankPortalRepository.getAllSpecialApprovals(),
        BankPortalRepository.getAllBankEmployees(),
        BankPortalRepository.getAllPartnerBanks(),
      ]);
      setDeals(dList || []);
      setLots(lList || []);
      setDevRequests(devReqList || []);
      setAccreditedDevs(devAllList || []);
      setSpecialRequests(sList || []);
      setBankStaff(stList || []);
      setPartnerBanksList(pbList || []);

      // Safe Active Bank Resolution
      if (bankIdParam) {
        const found = (pbList || []).find(
          (b) => b?.id === bankIdParam || b?.name?.toLowerCase() === bankIdParam.toLowerCase()
        );
        if (found) {
          setActivePartnerBank(found.name as PartnerBankName);
          setDevDecisionBank(found.name as PartnerBankName);
        }
      } else if (!isOwner && userBankName) {
        setActivePartnerBank(userBankName as PartnerBankName);
        setDevDecisionBank(userBankName as PartnerBankName);
      } else if (isOwner && pbList && pbList.length > 0) {
        const exists = pbList.some((b) => b?.name === activePartnerBank);
        if (!exists && pbList[0]?.name) {
          setActivePartnerBank(pbList[0].name as PartnerBankName);
          setDevDecisionBank(pbList[0].name as PartnerBankName);
        }
      }
    } catch (err) {
      console.error('Error loading bank portal data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = DatabaseGateway.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const currentOfficerName = user?.name || `Офицер СБР (${activePartnerBank})`;

  const openLotDocumentVault = (lotCode: string, title: string, _explicitIds?: string[]) => {
    setVaultEntityId(lotCode);
    setVaultModalTitle(title);
    setVaultModalOpen(true);
  };

  // 1. Confirm Escrow Deposit (Step 2 of 4-Step Synchronized Escrow)
  const handleConfirmEscrowDeposit = async (deal: DealTrack) => {
    const depositAmount =
      deal.escrowWorkflow?.depositedAmountRub || Math.round(deal.sellerReturnRub * 1.025);
    try {
      setIsSubmittingAction(true);
      const updated = await withAsyncTimeout(
        BankPortalRepository.confirmEscrowDeposit(
          deal.dealId,
          currentOfficerName,
          depositAmount,
          activePartnerBank
        ),
        15000
      );
      if (updated) {
        if (escrowFilter === 'pending_deposit') {
          setEscrowFilter('awaiting_curator');
        }
        await loadData();
        showToast(
          `Депонирование средств (${formatRubles(
            updated.escrowWorkflow?.depositedAmountRub || deal.sellerReturnRub
          )}) подтверждено. Статус синхронизирован в кабинете Покупателя, Продавца и Комнате закрытия куратора.`
        );
      }
    } catch (err) {
      console.error('Confirm escrow deposit error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 2. Confirm Funds Release (Step 4 of 4-Step Synchronized Escrow)
  const handleConfirmFundsRelease = async (deal: DealTrack) => {
    const lot = lots.find((l) => l.lotCode === deal.lotCode);
    const feeRub = lot?.serviceCommissionRub || Math.round(deal.sellerReturnRub * 0.025);
    try {
      setIsSubmittingAction(true);
      const updated = await withAsyncTimeout(
        BankPortalRepository.releaseEscrowFunds(deal.dealId, currentOfficerName),
        15000
      );
      if (updated) {
        await loadData();
        showToast(
          `Аккредитив СБР раскрыт по штампу Росреестра! Транши перечислены: Продавцу (${formatRubles(
            deal.sellerReturnRub
          )}), Застройщику/Банку и Комиссия оператора DomExit (${formatRubles(feeRub)}). Сделка закрыта.`
        );
      }
    } catch (err) {
      console.error('Release escrow funds error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 3. Developer Accreditation Decision
  const handleDecideDeveloperAccreditation = async (decision: 'approved' | 'rejected') => {
    if (!selectedDevReq) return;
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(
        DevelopersRepository.decideAccreditationRequest({
          requestId: selectedDevReq.id,
          bankName: devDecisionBank,
          decision,
          baseRatePercent: devBaseRateInput,
          familyMortgage6: devFamilyMortgage6,
          itMortgage6: devItMortgage6,
          maxPdnPercent: devMaxPdnPercent,
          notes: devDecisionNotes,
          decidedBy: `${currentOfficerName} (${devDecisionBank})`,
        }),
        15000
      );
      const devName = selectedDevReq.developerName;
      setSelectedDevReq(null);
      await loadData();
      showToast(
        decision === 'approved'
          ? `Застройщик «${devName}» аккредитован банком ${devDecisionBank} (базовая ставка ${devBaseRateInput}%, ПДН ${devMaxPdnPercent}%) и автоматически включён в единый реестр!`
          : `Запрос на аккредитацию застройщика «${devName}» отклонён банком ${devDecisionBank}.`
      );
    } catch (err) {
      console.error('Decide accreditation request error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 4. Decide Special Approval
  const handleDecideSpecialApproval = async (status: 'approved' | 'rejected') => {
    if (!selectedSpecialReq) return;
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(
        BankPortalRepository.decideSpecialApproval(
          selectedSpecialReq.id,
          status,
          specialDecisionNotes,
          currentOfficerName
        ),
        15000
      );
      const lotCode = selectedSpecialReq.lotCode;
      setSelectedSpecialReq(null);
      await loadData();
      showToast(
        status === 'approved'
          ? `Спецсогласование по лоту #${lotCode} одобрено банком!`
          : `Спецсогласование по лоту #${lotCode} отклонено.`
      );
    } catch (err) {
      console.error('Decide special approval error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };


  const isOwner =
    user?.role === 'owner' ||
    user?.activeRole === 'owner' ||
    user?.role === 'admin' ||
    user?.roles?.includes('owner') ||
    user?.email?.toLowerCase().trim() === 'amaas9499@gmail.com';

  const matchingStaff = (bankStaff || []).find(
    (s) => s?.email && s.email.toLowerCase() === (user?.email || '').toLowerCase()
  );
  const userBankName = user?.bankName || matchingStaff?.bankName;
  const isBankRole = user?.role === 'bank' || user?.activeRole === 'bank';
  const hasNoBankAssigned = !isOwner && isBankRole && !userBankName && !matchingStaff;
  const isAuthorizedBankUser = Boolean(
    isOwner ||
      isBankRole ||
      matchingStaff ||
      user?.email?.toLowerCase().trim() === 'bank@domexit.ru'
  );

  // Strict Bank Tenant Isolation & Sovereign Preview
  useEffect(() => {
    if (bankIdParam) {
      BankPortalRepository.getAllPartnerBanks().then((banks) => {
        const found = (banks || []).find(
          (b) => b?.id === bankIdParam || b?.name?.toLowerCase() === bankIdParam.toLowerCase()
        );
        if (found) {
          setActivePartnerBank(found.name as PartnerBankName);
          setDevDecisionBank(found.name as PartnerBankName);
        }
      });
    } else if (!isOwner && userBankName) {
      setActivePartnerBank(userBankName as PartnerBankName);
      setDevDecisionBank(userBankName as PartnerBankName);
    }
  }, [isOwner, userBankName, bankIdParam]);

  const userPermissions: BankTabPermission[] = useMemo(() => {
    return isOwner
      ? ['escrow', 'developer_accreditation', 'special', 'staff']
      : (matchingStaff?.permissions || [
          'escrow',
          'developer_accreditation',
          'special',
          'staff',
        ]);
  }, [isOwner, matchingStaff?.permissions]);

  const updateCompIntel = async (devName: string) => {
    if (!devName) {
      setCompIntel(null);
      return;
    }
    const summary = await DevelopersRepository.getCompetitiveTermsSummary(devName, activePartnerBank);
    setCompIntel(summary);
  };

  useEffect(() => {
    if (editingDev) {
      updateCompIntel(editingDev.name);
    }
  }, [editingDev, activePartnerBank]);

  useEffect(() => {
    if (showAddDevModal) {
      const devName = selectedDevToAdd === '__custom__' ? customDevNameToAdd : selectedDevToAdd;
      if (devName) {
        updateCompIntel(devName);
      } else {
        setCompIntel(null);
      }
    }
  }, [showAddDevModal, selectedDevToAdd, customDevNameToAdd, activePartnerBank]);

  useEffect(() => {
    if (userPermissions.length > 0 && !userPermissions.includes(activeTab)) {
      setActiveTab(userPermissions[0]);
    }
  }, [userPermissions]);

  const isBankMatch = (dealBankName?: string, lotEscrowBank?: string, targetBank?: PartnerBankName) => {
    if (!targetBank) return true;
    if (!dealBankName && !lotEscrowBank) return true;

    if (dealBankName) {
      if (dealBankName === targetBank || dealBankName.includes(targetBank)) return true;
      if (targetBank === 'Сбербанк' && (dealBankName.includes('Сбер') || dealBankName.includes('Sber'))) return true;
      if (targetBank === 'ВТБ' && (dealBankName.includes('ВТБ') || dealBankName.includes('VTB'))) return true;
      if (targetBank === 'Альфа-Банк' && (dealBankName.includes('Альфа') || dealBankName.includes('Alfa'))) return true;
      if (targetBank === 'ДОМ.РФ' && (dealBankName.includes('ДОМ.РФ') || dealBankName.includes('Дом.РФ') || dealBankName.includes('DomRF'))) return true;
      if ((targetBank as string) === 'Совкомбанк' && dealBankName.includes('Совком')) return true;
      if ((targetBank as string) === 'Т-Банк' && (dealBankName.includes('Т-Банк') || dealBankName.includes('Тинькофф'))) return true;
    }

    if (lotEscrowBank) {
      if (targetBank === 'Сбербанк' && (lotEscrowBank === 'Sberbank' || lotEscrowBank.includes('Сбер'))) return true;
      if (targetBank === 'ВТБ' && (lotEscrowBank === 'VTB' || lotEscrowBank.includes('ВТБ'))) return true;
      if (targetBank === 'Альфа-Банк' && (lotEscrowBank === 'AlfaBank' || lotEscrowBank.includes('Альфа'))) return true;
      if (targetBank === 'ДОМ.РФ' && (lotEscrowBank === 'DomRF' || lotEscrowBank.includes('ДОМ.РФ'))) return true;
    }

    return false;
  };

  // Filtered collections strictly for activePartnerBank (Fortified against undefined/empty states)
  const tenantDeals = useMemo(() => {
    return (deals || []).filter((d) => {
      if (!d) return false;
      const lot = (lots || []).find((l) => l.lotCode === d.lotCode);
      const matches = isBankMatch(d.escrowWorkflow?.bankName, lot?.escrowBank, activePartnerBank);
      return isOwner ? (matches || !d.escrowWorkflow?.bankName) : matches;
    });
  }, [deals, lots, activePartnerBank, isOwner]);

  const activeEscrowDealsCount = useMemo(() => {
    return (tenantDeals || []).filter(
      (d) => d?.escrowWorkflow?.step !== 'deal_finalized' && d?.escrowWorkflow?.step !== 'deal_cancelled'
    ).length;
  }, [tenantDeals]);

  const pendingDepositDealsCount = useMemo(() => {
    return (tenantDeals || []).filter(
      (d) =>
        !d?.escrowWorkflow?.step ||
        d.escrowWorkflow.step === 'bank_escrow_deposit' ||
        d.escrowWorkflow.step === 'curator_review'
    ).length;
  }, [tenantDeals]);

  const awaitingCuratorDealsCount = useMemo(() => {
    return (tenantDeals || []).filter(
      (d) => d?.escrowWorkflow?.step === 'signing_photos'
    ).length;
  }, [tenantDeals]);

  const readyForReleaseDealsCount = useMemo(() => {
    return (tenantDeals || []).filter(
      (d) =>
        d?.escrowWorkflow?.step === 'bank_funds_release' ||
        Boolean(d?.escrowWorkflow?.rosreestrStampDocUrl && d?.escrowWorkflow?.step === 'signing_photos')
    ).length;
  }, [tenantDeals]);

  const archivedEscrowDealsCount = useMemo(() => {
    return (tenantDeals || []).filter(
      (d) => d?.escrowWorkflow?.step === 'deal_finalized' || d?.escrowWorkflow?.step === 'deal_cancelled'
    ).length;
  }, [tenantDeals]);

  const tenantAccreditedDevs = (accreditedDevs || []).filter((d) =>
    (d?.bankTerms || []).some((b) => b?.bankName === activePartnerBank && b?.isAccredited)
  );

  const pendingAccreditationDevs = useMemo(() => {
    const list = (accreditedDevs || []).filter((d) => {
      const isAccreditedByThisBank = (d?.bankTerms || []).some(
        (b) => b?.bankName === activePartnerBank && b?.isAccredited
      );
      return !isAccreditedByThisBank;
    });
    if (!devSearchQuery.trim()) return list;
    const q = devSearchQuery.toLowerCase().trim();
    return list.filter((dev) =>
      (dev.name && dev.name.toLowerCase().includes(q)) ||
      (dev.inn && dev.inn.toLowerCase().includes(q))
    );
  }, [accreditedDevs, activePartnerBank, devSearchQuery]);

  const tenantSpecialRequests = (specialRequests || []).filter(
    (s) => s?.bankName === activePartnerBank || !s?.bankName
  );

  const tenantBankStaff = (bankStaff || []).filter(
    (s) => s?.bankName === activePartnerBank || isOwner
  );

  const activeEscrowDeals = useMemo(() => {
    return (tenantDeals || []).filter(
      (d) => d?.escrowWorkflow?.step !== 'deal_finalized' && d?.escrowWorkflow?.step !== 'deal_cancelled'
    );
  }, [tenantDeals]);

  // Hierarchical grouping of special requests by Contractor + INN (Task 3 Architecture)
  const groupedSpecialContractors = useMemo(() => {
    const map: Record<
      string,
      {
        compositeKey: string;
        contractorName: string;
        contractorInn: string;
        requests: SpecialApprovalRequest[];
      }
    > = {};

    (tenantSpecialRequests || []).forEach((req) => {
      if (!req) return;
      const name = req.contractorName || req.developer || 'Индивидуальный застройщик / Подрядчик';
      const inn = (req.contractorInn || req.developerInn || '').trim();
      const compositeKey = `${name}:::${inn}`;

      if (!map[compositeKey]) {
        map[compositeKey] = {
          compositeKey,
          contractorName: name,
          contractorInn: inn,
          requests: [],
        };
      }
      map[compositeKey].requests.push(req);
    });

    return Object.values(map);
  }, [tenantSpecialRequests]);

  // Filtered Deals for Tab 1 with safe lowercasing & scoped search
  const filteredDeals = useMemo(() => {
    return (tenantDeals || []).filter((d) => {
      if (!d) return false;
      const step = d.escrowWorkflow?.step || 'curator_review';
      const hasRosreestr = Boolean(d.escrowWorkflow?.rosreestrStampDocUrl);

      if (escrowFilter === 'all_active') {
        if (step === 'deal_finalized' || step === 'deal_cancelled') return false;
      } else if (escrowFilter === 'pending_deposit') {
        if (step !== 'bank_escrow_deposit' && step !== 'curator_review') return false;
      } else if (escrowFilter === 'awaiting_curator') {
        if (step !== 'signing_photos' || hasRosreestr) return false;
      } else if (escrowFilter === 'ready_for_release') {
        if (step !== 'bank_funds_release' && !hasRosreestr) return false;
      } else if (escrowFilter === 'archived') {
        if (step !== 'deal_finalized' && step !== 'deal_cancelled') return false;
      }

      if (!escrowSearchQuery) return true;
      const q = escrowSearchQuery.toLowerCase().trim();
      return (
        (d.dealId && d.dealId.toLowerCase().includes(q)) ||
        (d.lotCode && d.lotCode.toLowerCase().includes(q)) ||
        (d.lotTitle && d.lotTitle.toLowerCase().includes(q)) ||
        (d.buyerName && d.buyerName.toLowerCase().includes(q)) ||
        (d.developer && d.developer.toLowerCase().includes(q)) ||
        Boolean(d.escrowWorkflow?.bankName && d.escrowWorkflow.bankName.toLowerCase().includes(q))
      );
    });
  }, [tenantDeals, escrowFilter, escrowSearchQuery]);

  const filteredAccreditedDevs = useMemo(() => {
    if (!devSearchQuery.trim()) return tenantAccreditedDevs;
    const q = devSearchQuery.toLowerCase().trim();
    return tenantAccreditedDevs.filter((dev) =>
      (dev.name && dev.name.toLowerCase().includes(q)) ||
      (dev.inn && dev.inn.toLowerCase().includes(q))
    );
  }, [tenantAccreditedDevs, devSearchQuery]);

  const filteredGroupedSpecialContractors = useMemo(() => {
    if (!projectSearchQuery.trim()) return groupedSpecialContractors;
    const q = projectSearchQuery.toLowerCase().trim();
    return groupedSpecialContractors.filter((group) => {
      const matchContractor =
        (group.contractorName && group.contractorName.toLowerCase().includes(q)) ||
        (group.contractorInn && group.contractorInn.toLowerCase().includes(q));
      if (matchContractor) return true;
      return (group.requests || []).some(
        (r) =>
          (r.complexName && r.complexName.toLowerCase().includes(q)) ||
          (r.developer && r.developer.toLowerCase().includes(q)) ||
          (r.lotCode && r.lotCode.toLowerCase().includes(q))
      );
    });
  }, [groupedSpecialContractors, projectSearchQuery]);

  const filteredBankStaff = useMemo(() => {
    if (!staffSearchQuery.trim()) return tenantBankStaff;
    const q = staffSearchQuery.toLowerCase().trim();
    return tenantBankStaff.filter((st) =>
      (st.name && st.name.toLowerCase().includes(q)) ||
      (st.email && st.email.toLowerCase().includes(q)) ||
      (st.role && st.role.toLowerCase().includes(q))
    );
  }, [tenantBankStaff, staffSearchQuery]);

  // Accredit Developer for Bank
  const handleAccreditDeveloper = async () => {
    const devName = (selectedDevToAdd === '__custom__' ? customDevNameToAdd : selectedDevToAdd).trim();
    if (!devName) {
      showToast('Укажите название застройщика.');
      return;
    }

    if (selectedDevToAdd === '__custom__') {
      const innErr = getInnValidationError(customDevInnToAdd);
      if (innErr) {
        showToast(innErr);
        return;
      }
    }

    try {
      setIsSubmittingAction(true);
      const matchedExisting = (accreditedDevs || []).find((d) => d.name === devName);
      const effectiveInn = customDevInnToAdd.trim() || matchedExisting?.inn || undefined;

      await withAsyncTimeout(
        DevelopersRepository.accreditDeveloperForBank({
          developerName: devName,
          developerInn: effectiveInn,
          bankName: activePartnerBank,
          baseRatePercent: addDevBaseRate,
          familyMortgage6: addDevFamily6,
          itMortgage6: addDevIt6,
          maxPdnPercent: addDevMaxPdn,
          officerName: currentOfficerName,
        }),
        15000
      );

      setShowAddDevModal(false);
      setSelectedDevToAdd('');
      setCustomDevNameToAdd('');
      setCustomDevInnToAdd('');
      await loadData();
      showToast(`Застройщик «${devName}» успешно аккредитован банком ${activePartnerBank}!`);
    } catch (err) {
      console.error('Accredit developer error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Edit Developer Terms
  const handleSaveDevTerms = async () => {
    if (!editingDev) return;
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(
        DevelopersRepository.accreditDeveloperForBank({
          developerId: editingDev.id,
          developerName: editingDev.name,
          developerInn: editingDev.inn,
          bankName: activePartnerBank,
          baseRatePercent: editDevBaseRate,
          familyMortgage6: editDevFamily6,
          itMortgage6: editDevIt6,
          maxPdnPercent: editDevMaxPdn,
          officerName: currentOfficerName,
        }),
        15000
      );
      setEditingDev(null);
      await loadData();
      showToast(`Условия банка ${activePartnerBank} для «${editingDev.name}» обновлены.`);
    } catch (err) {
      console.error('Save dev terms error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Revoke Developer Accreditation
  const handleRevokeDeveloperAccreditation = async (dev: AccreditedDeveloper) => {
    if (
      window.confirm(
        `Вы уверены, что хотите исключить застройщика «${dev.name}» из аккредитации банка ${activePartnerBank}?`
      )
    ) {
      try {
        setIsSubmittingAction(true);
        await withAsyncTimeout(
          DevelopersRepository.removeDeveloperAccreditation(dev.id, activePartnerBank, currentOfficerName),
          15000
        );
        await loadData();
        showToast(`Застройщик «${dev.name}» исключен из аккредитации банка ${activePartnerBank}.`);
      } catch (err) {
        console.error('Revoke accreditation error:', err);
        showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
      } finally {
        setIsSubmittingAction(false);
      }
    }
  };

  // Decide Special Approval with Project Rate & PDN
  const handleDecideProjectSpecialApproval = async (status: 'approved' | 'rejected') => {
    if (!selectedSpecialReq) return;
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(
        BankPortalRepository.decideSpecialApproval(
          selectedSpecialReq.id,
          status,
          specialDecisionNotes,
          currentOfficerName,
          status === 'approved' ? specialApprovedRate : undefined,
          status === 'approved' ? specialMaxPdn : undefined
        ),
        15000
      );
      const title = selectedSpecialReq.projectTitle || selectedSpecialReq.complexName;
      setSelectedSpecialReq(null);
      await loadData();
      showToast(
        status === 'approved'
          ? `Проект «${title}» одобрен банком (Ставка ${specialApprovedRate}%, ПДН ${specialMaxPdn}%)!`
          : `Проект отклонен.`
      );
    } catch (err) {
      console.error('Decide special approval error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Toggle staff permission
  const handleToggleStaffPermission = async (staffId: string, perm: BankTabPermission) => {
    const staffMember = bankStaff.find((s) => s.id === staffId);
    if (!staffMember) return;
    const currentPerms =
      staffMember.permissions || [
        'escrow',
        'developer_accreditation',
        'special',
        'staff',
      ];
    const updatedPerms = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm];
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(
        BankPortalRepository.updateBankEmployeePermissions(staffId, updatedPerms),
        15000
      );
      await loadData();
      showToast(`Права доступа сотрудника [${staffMember.name}] обновлены.`);
    } catch (err) {
      console.error('Toggle staff permission error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Add Bank Staff (Full Staff CRUD)
  const handleCreateBankStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) return;
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(
        BankPortalRepository.addBankEmployee({
          name: newStaffName.trim(),
          email: newStaffEmail.trim(),
          phone: newStaffPhone.trim(),
          role: newStaffRole,
          bankName: activePartnerBank,
          status: 'active',
          permissions: newStaffPermissions,
        }),
        15000
      );
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('+7 (495) 500-00-00');
      setNewStaffPermissions(['escrow', 'developer_accreditation', 'special', 'staff']);
      setShowAddStaffModal(false);
      await loadData();
      showToast(`Сотрудник банка ${newStaffName} успешно добавлен.`);
    } catch (err) {
      console.error('Create bank staff error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Edit Bank Staff (Full Staff CRUD)
  const handleUpdateBankStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editStaffName.trim() || !editStaffEmail.trim()) return;
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(
        BankPortalRepository.updateBankEmployee(editingStaff.id, {
          name: editStaffName.trim(),
          email: editStaffEmail.trim(),
          phone: editStaffPhone.trim(),
          role: editStaffRole,
          permissions: editStaffPermissions,
        }),
        15000
      );
      setEditingStaff(null);
      await loadData();
      showToast(`Данные и права доступа сотрудника «${editStaffName}» успешно обновлены.`);
    } catch (err) {
      console.error('Update bank staff error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Delete Bank Staff (Full Staff CRUD)
  const handleDeleteBankStaff = async (staff: BankEmployee) => {
    if (
      !window.confirm(
        `Вы уверены, что хотите удалить сотрудника банка «${staff.name}» (${staff.email})? Это действие необратимо.`
      )
    ) {
      return;
    }
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(BankPortalRepository.deleteBankEmployee(staff.id), 15000);
      await loadData();
      showToast(`Сотрудник банка «${staff.name}» успешно удален.`);
    } catch (err) {
      console.error('Delete bank staff error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleToggleStaffStatus = async (staffId: string) => {
    try {
      setIsSubmittingAction(true);
      await withAsyncTimeout(BankPortalRepository.toggleBankEmployeeStatus(staffId), 15000);
      await loadData();
      showToast('Статус доступа сотрудника банка обновлен.');
    } catch (err) {
      console.error('Toggle staff status error:', err);
      showToast(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const pendingEscrowCount = (tenantDeals || []).filter(
    (d) =>
      !d?.escrowWorkflow?.step ||
      d?.escrowWorkflow?.step === 'bank_escrow_deposit' ||
      d?.escrowWorkflow?.step === 'curator_review' ||
      d?.escrowWorkflow?.step === 'bank_funds_release'
  ).length;
  const pendingDevAccCount = (devRequests || []).filter((r) => r?.status === 'pending').length;
  const pendingSpecialCount = (tenantSpecialRequests || []).filter((s) => s?.status === 'pending').length;

  if (!isAuthorizedBankUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full relative z-10 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
            <Landmark className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-widest inline-block">
              Банковский комплаенс-шлюз (СБР)
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Доступ ограничен
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Раздел предназначен исключительно для уполномоченных комплаенс-офицеров банков-партнеров (Сбербанк, ВТБ, Альфа-Банк) и руководства DomExit.
            </p>
          </div>

          {showTestSwitchers ? (
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 space-y-3 text-left">
              <div className="flex items-center space-x-2 text-slate-300 text-xs font-bold border-b border-slate-700/60 pb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Тестовый контур (Активация банковского аккаунта):</span>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => quickDemoLogin('bank')}
                  className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md"
                >
                  <Landmark className="w-4 h-4 text-white" />
                  <span>Войти как Офицер эскроу (Сбербанк — Игорь Соколов)</span>
                </button>

                <button
                  type="button"
                  onClick={() => quickDemoLogin('owner')}
                  className="w-full px-4 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span>Войти как Владелец / CEO (Ahmed Abdallah)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => openAuthModal('Авторизуйтесь для доступа к банковскому шлюзу')}
                className="w-full px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
              >
                <Landmark className="w-4 h-4 text-white" />
                <span>Войти с учетной записью сотрудника банка</span>
              </button>
            </div>
          )}

          <div>
            <Link
              to="/"
              className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Вернуться на главную</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (hasNoBankAssigned) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-3xl p-8 shadow-lg text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">
            Учетная запись не привязана к банку-партнеру. Обратитесь к администратору
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Для доступа к шлюзу банка ваша учетная запись ({user?.email || 'не указан'}) должна быть закреплена за одним из банков-партнеров платформы.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoadingData && isOwner && partnerBanksList.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-lg text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
            <Landmark className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">
            Нет зарегистрированных банков-партнеров. Добавьте первый банк в Дашборде Владельца
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            В системе не найдено ни одного банка-партнера. Перейдите в дашборд владельца, чтобы добавить банк и настроить интеграцию.
          </p>
          <div className="pt-2">
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              Перейти в Дашборд Владельца
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Institutional Light Banking Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black shadow-xs">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                  DomExit • Шлюз Банка-Партнёра (214-ФЗ / СБР)
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  LIVE ESCROW GATEWAY
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                Кабинет банка {activePartnerBank}: СБР и Аккредитация
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Strict Bank Tenant Isolation: Only Owner can switch, Bank Officers locked strictly */}
            {isOwner ? (
              <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Админ-тенант:</span>
                <select
                  value={activePartnerBank}
                  onChange={(e) => {
                    const b = e.target.value as PartnerBankName;
                    setActivePartnerBank(b);
                    setDevDecisionBank(b);
                  }}
                  className="bg-white text-emerald-800 font-black text-xs px-2.5 py-1 rounded-lg border border-slate-200 focus:outline-none cursor-pointer"
                >
                  {(partnerBanksList && partnerBanksList.length > 0
                    ? partnerBanksList.map((b) => b.name as PartnerBankName)
                    : PARTNER_BANKS
                  ).map((b) => (
                    <option key={b} value={b}>
                      {b} (Режим Владельца)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Авторизованный шлюз: {activePartnerBank}</span>
              </div>
            )}

            <Link
              to="/admin/dashboard"
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>Панель владельца</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
              title="Профиль и безопасность сотрудника"
            >
              <User className="w-3.5 h-3.5 text-slate-600" />
              <span>Профиль</span>
            </button>

          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-emerald-700 text-white px-5 py-4 rounded-2xl shadow-xl border border-emerald-500 flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0 mt-0.5" />
          <div className="text-xs font-bold leading-relaxed">{toastMessage}</div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Top KPI Cards (Light Mode Institutional Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
              <span>Ожидают действий СБР</span>
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{pendingEscrowCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Депонирование и раскрытие эскроу
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
              <span>Аккредитованные застройщики</span>
              <Building2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {tenantAccreditedDevs.length}{' '}
              <span className="text-xs font-bold text-slate-400">
                / {(accreditedDevs || []).filter((d) => d?.isAccredited).length} в реестре
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Генеральная аккредитация девелоперов
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
              <span>Спецсогласования лотов</span>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{pendingSpecialCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Запросы кураторов по уступке ДДУ
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
              <span>Уполномоченные офицеры</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {(bankStaff || []).filter((s) => s?.status === 'active').length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Сбербанк • ВТБ • Альфа-Банк • ДОМ.РФ
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap gap-2">
            {userPermissions.includes('escrow') && (
              <button
                type="button"
                onClick={() => setActiveTab('escrow')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'escrow'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>1. Эскроу и СБР ({activeEscrowDeals.length})</span>
                {pendingEscrowCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === 'escrow'
                        ? 'bg-white text-emerald-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {pendingEscrowCount}
                  </span>
                )}
              </button>
            )}

            {userPermissions.includes('developer_accreditation') && (
              <button
                type="button"
                onClick={() => setActiveTab('developer_accreditation')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'developer_accreditation'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>2. Аккредитация девелоперов ({tenantAccreditedDevs.length})</span>
              </button>
            )}

            {userPermissions.includes('special') && (
              <button
                type="button"
                onClick={() => setActiveTab('special')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'special'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>3. Согласование объектов ({tenantSpecialRequests.length})</span>
                {pendingSpecialCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === 'special'
                        ? 'bg-white text-emerald-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {pendingSpecialCount}
                  </span>
                )}
              </button>
            )}

            {userPermissions.includes('staff') && (
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'staff'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>4. Сотрудники банка ({tenantBankStaff.length})</span>
              </button>
            )}
          </div>


        </div>

        {/* Loading Skeleton Screen or Active Tab Content */}
        {isLoadingData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 bg-slate-200 rounded-md" />
                    <div className="w-8 h-8 rounded-xl bg-slate-100" />
                  </div>
                  <div className="h-8 w-16 bg-slate-200 rounded-lg" />
                  <div className="h-3 w-32 bg-slate-100 rounded-md" />
                </div>
              ))}
            </div>
            <div className="h-14 bg-slate-200/60 rounded-2xl animate-pulse" />
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="h-5 w-48 bg-slate-200 rounded-md animate-pulse" />
                <div className="h-4 w-28 bg-slate-100 rounded-md animate-pulse" />
              </div>
              {[1, 2, 3].map((r) => (
                <div
                  key={r}
                  className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3 animate-pulse"
                >
                  <div className="flex justify-between">
                    <div className="h-4 w-40 bg-slate-200 rounded-md" />
                    <div className="h-4 w-20 bg-slate-200 rounded-md" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                    <div className="h-3 bg-slate-200/80 rounded-md" />
                    <div className="h-3 bg-slate-200/80 rounded-md" />
                    <div className="h-3 bg-slate-200/80 rounded-md" />
                    <div className="h-3 bg-slate-200/80 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ========================================================= */}
            {/* TAB 1: ESCROW & SBR 4-STEP REAL-TIME SYNCHRONIZATION      */}
            {/* ========================================================= */}
            {activeTab === 'escrow' && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      Единый контур закрытия сделок СБР / Эскроу (Синхронизация 4 шагов)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Шаг 1: Куратор передает пакет в банк → Шаг 2: Банк подтверждает депонирование средств покупателя → Шаг 3: Куратор загружает фото подписания и штамп Росреестра → Шаг 4: Банк раскрывает СБР и выплачивает транши.
                    </p>
                  </div>

                </div>

                {/* Persistent Lifecycle Filter Bar with Scoped Search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 bg-slate-100 rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEscrowFilter('all_active')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      escrowFilter === 'all_active'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Все сделки в работе ({activeEscrowDealsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscrowFilter('pending_deposit')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      escrowFilter === 'pending_deposit'
                        ? 'bg-white text-blue-900 shadow-xs border border-blue-200'
                        : 'text-slate-600 hover:text-blue-900'
                    }`}
                  >
                    Ожидают депонирования (Шаг 2) ({pendingDepositDealsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscrowFilter('awaiting_curator')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      escrowFilter === 'awaiting_curator'
                        ? 'bg-white text-amber-900 shadow-xs border border-amber-200'
                        : 'text-slate-600 hover:text-amber-900'
                    }`}
                  >
                    На регистрации у куратора (Шаг 3) ({awaitingCuratorDealsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscrowFilter('ready_for_release')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      escrowFilter === 'ready_for_release'
                        ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200'
                        : 'text-slate-600 hover:text-emerald-900'
                    }`}
                  >
                    Готовы к выплате (Шаг 4) ({readyForReleaseDealsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscrowFilter('archived')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      escrowFilter === 'archived'
                        ? 'bg-white text-slate-700 shadow-xs border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Закрытые сделки (Архив СБР) ({archivedEscrowDealsCount})
                  </button>
                  </div>

                  <div className="relative w-full md:w-80 shrink-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={escrowSearchQuery}
                      onChange={(e) => setEscrowSearchQuery(e.target.value)}
                      placeholder="Поиск по сделке, коду лота, ФИО, ЖК..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                  </div>
                </div>

                {filteredDeals.length === 0 ? (
                  <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {escrowSearchQuery ? 'Сделок по заданному запросу не найдено' : 'Нет активных сделок в данном статусе'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {escrowSearchQuery
                        ? 'Попробуйте изменить поисковый запрос (номер сделки, код лота, ФИО, ЖК)'
                        : `Сделки с эскроу для банка ${activePartnerBank} появятся здесь автоматически после инициализации куратором DomExit`}
                    </p>
                  </div>
                ) : (
                  filteredDeals.map((deal) => {
                    const wf = deal.escrowWorkflow;
                    const step = wf?.step || 'curator_review';
                    const lot = (lots || []).find((l) => l?.lotCode === deal.lotCode);
                    const feeRub =
                      wf?.platformFeeRub ||
                      lot?.serviceCommissionRub ||
                      Math.round((deal.sellerReturnRub || 0) * 0.025);

                return (
                  <div
                    key={deal.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                            {deal.dealId}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                            Лот #{deal.lotCode}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">
                            Банк эскроу: <strong className="text-slate-900">{wf?.bankName || 'ПАО Сбербанк'}</strong>
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            Счет СБР: {wf?.escrowAccountNumber || '40817810555000010566'}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900">
                          {deal.lotTitle} — {deal.developer}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Продавец: <strong className="text-slate-800">{deal.sellerName || deal.clientName}</strong> •
                          Покупатель: <strong className="text-slate-800">{deal.buyerName || 'Кандидат согласован'}</strong> •
                          Куратор DomExit: <strong className="text-emerald-700">{deal.curatorName}</strong>
                        </p>
                      </div>

                      {/* Tranches Breakdown */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-right">
                          <div className="text-[10px] text-slate-500 uppercase font-bold">
                            Транш №1 (Кэш Продавцу 100%)
                          </div>
                          <div className="text-sm font-black text-slate-900">
                            {formatRubles(deal.sellerReturnRub)}
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-right">
                          <div className="text-[10px] text-slate-500 uppercase font-bold">
                            Транш №2 (Долг ДДУ Застройщику)
                          </div>
                          <div className="text-sm font-black text-slate-700">
                            {formatRubles(lot?.remainingInstallmentDebt || 0)}
                          </div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 text-right">
                          <div className="text-[10px] text-emerald-700 uppercase font-bold">
                            Транш №3 (Комиссия DomExit 2.5%)
                          </div>
                          <div className="text-sm font-black text-emerald-700">
                            {formatRubles(feeRub)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4-Step Visual Progress Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                      <div
                        className={`p-3 rounded-xl border ${
                          step !== 'curator_review'
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="font-black flex items-center justify-between">
                          <span>Шаг 1. Передача в банк</span>
                          {step !== 'curator_review' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          {step !== 'curator_review'
                            ? 'Пакет ДДУ передан куратором на открытие СБР'
                            : 'Ожидает передачи пакета куратором'}
                        </div>
                      </div>

                      <div
                        className={`p-3 rounded-xl border ${
                          ['signing_photos', 'bank_funds_release', 'deal_finalized'].includes(step)
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : step === 'bank_escrow_deposit'
                            ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="font-black flex items-center justify-between">
                          <span>Шаг 2. Депонирование СБР</span>
                          {['signing_photos', 'bank_funds_release', 'deal_finalized'].includes(step) && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="text-[11px] mt-1">
                          {['signing_photos', 'bank_funds_release', 'deal_finalized'].includes(step)
                            ? 'Средства надежно заблокированы на эскроу'
                            : 'Подтверждение блокировки средств банком'}
                        </div>
                      </div>

                      <div
                        className={`p-3 rounded-xl border ${
                          ['bank_funds_release', 'deal_finalized'].includes(step)
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : step === 'signing_photos'
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="font-black flex items-center justify-between">
                          <span>Шаг 3. Подписание и Росреестр</span>
                          {['bank_funds_release', 'deal_finalized'].includes(step) && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="text-[11px] mt-1">
                          {['bank_funds_release', 'deal_finalized'].includes(step)
                            ? 'Фото подписания и штамп Росреестра загружены'
                            : 'Куратор проводит подписание и УКЭП Росреестр'}
                        </div>
                      </div>

                      <div
                        className={`p-3 rounded-xl border ${
                          step === 'deal_finalized'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : step === 'bank_funds_release'
                            ? 'bg-emerald-50/60 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="font-black flex items-center justify-between">
                          <span>Шаг 4. Раскрытие СБР</span>
                          {step === 'deal_finalized' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="text-[11px] mt-1">
                          {step === 'deal_finalized'
                            ? 'СБР раскрыт, транши выплачены, сделка закрыта'
                            : 'Выплата траншей Продавцу, Застройщику и DomExit'}
                        </div>
                      </div>
                    </div>

                    {/* Escrow Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                      <div className="flex flex-wrap items-center gap-2.5 text-xs">
                        {step === 'curator_review' && (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-bold flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <span>Шаг 1: На проверке у куратора (Ожидает передачи в банк)</span>
                          </span>
                        )}
                        {step === 'bank_escrow_deposit' && (
                          <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 font-bold flex items-center space-x-1.5">
                            <Lock className="w-4 h-4 text-blue-600" />
                            <span>Шаг 2: Требуется подтверждение депонирования средств покупателя на СБР</span>
                          </span>
                        )}
                        {step === 'signing_photos' && (
                          <span className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 font-bold flex items-center space-x-2 text-xs">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Средства надежно заблокированы на эскроу • Куратор проводит подписание и регистрацию в Росреестре</span>
                          </span>
                        )}
                        {step === 'bank_funds_release' && (
                          <span className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold flex items-center space-x-2 text-xs">
                            <Unlock className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Шаг 4: Штамп Росреестра загружен куратором! Готово к раскрытию СБР и выплате траншей</span>
                          </span>
                        )}
                        {step === 'deal_finalized' && (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Сделка официально закрыта • Все транши СБР перечислены</span>
                          </span>
                        )}
                        {step === 'deal_cancelled' && (
                          <span className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200 font-bold flex items-center space-x-1.5">
                            <XCircle className="w-4 h-4 text-red-600" />
                            <span>Сделка отменена • Лот возвращен в каталог</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveEscrowChatDeal({
                              dealId: deal.dealId,
                              dealStage: step,
                              lotCode: deal.lotCode,
                              lotTitle: deal.lotTitle,
                              bankName: wf?.bankName || activePartnerBank,
                              buyerName: deal.buyerName,
                            });
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                        >
                          <MessageSquare className="w-4 h-4 text-indigo-600" />
                          <span>Шлюз связи с покупателем</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openLotDocumentVault(
                              deal.lotCode,
                              `Досье сделки ${deal.dealId} (${deal.lotTitle})`
                            )
                          }
                          className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                        >
                          <FolderOpen className="w-4 h-4 text-emerald-600" />
                          <span>Досье S3 и штамп Росреестра</span>
                        </button>

                        {(step === 'bank_escrow_deposit' || step === 'curator_review') && (
                          <button
                            type="button"
                            onClick={() => handleConfirmEscrowDeposit(deal)}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
                          >
                            <Lock className="w-4 h-4" />
                            <span>Подтвердить депонирование средств (СБР)</span>
                          </button>
                        )}

                        {/* Step 3: Hard Gating Guard — Disabled button while curator conducts signing and registration */}
                        {step === 'signing_photos' && !wf?.rosreestrStampDocUrl && (
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              disabled={true}
                              title="Ожидаем фото подписания и штамп Росреестра от куратора"
                              className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold border border-slate-300 flex items-center space-x-2 cursor-not-allowed shadow-none"
                            >
                              <Lock className="w-4 h-4 text-slate-400" />
                              <span>Раскрыть СБР и выплатить транши</span>
                            </button>
                            <span className="text-[11px] text-slate-400 italic">
                              (Ожидаем штамп Росреестра)
                            </span>
                          </div>
                        )}

                        {/* Step 4: Gated release unlocked ONLY after curator uploaded Rosreestr stamp doc and signing proofs */}
                        {(step === 'bank_funds_release' || (step === 'signing_photos' && Boolean(wf?.rosreestrStampDocUrl))) && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openLotDocumentVault(
                                  deal.lotCode,
                                  `Штамп Росреестра и досье сделки ${deal.dealId}`
                                )
                              }
                              className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                            >
                              <FileCheck className="w-4 h-4 text-indigo-700" />
                              <span>Просмотреть штамп Росреестра и документы (S3 Хранилище)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmFundsRelease(deal)}
                              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md flex items-center space-x-2 cursor-pointer ring-2 ring-emerald-500/20"
                            >
                              <Unlock className="w-4 h-4" />
                              <span>Раскрыть СБР и выплатить транши</span>
                            </button>
                          </div>
                        )}

                        <Link
                          to={`/admin/closing/${deal.dealId}`}
                          className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-colors"
                        >
                          Комната закрытия →
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              }))}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: DEVELOPER ACCREDITATION ENGINE                     */}
        {/* ========================================================= */}
        {activeTab === 'developer_accreditation' && (
          <div className="space-y-6">
            {/* Bank's Dedicated Accredited Developers Registry */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Партнерская программа аккредитации
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {activePartnerBank}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    Наши аккредитованные застройщики ({tenantAccreditedDevs.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ставки и лимиты ПДН вашего банка автоматически подставляются в ипотечный калькулятор на страницах объектов данных девелоперов на витрине DomExit.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={devSearchQuery}
                      onChange={(e) => setDevSearchQuery(e.target.value)}
                      placeholder="Поиск по названию застройщика, ИНН..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDevToAdd('');
                      setCustomDevNameToAdd('');
                      setCustomDevInnToAdd('');
                      setShowAddDevModal(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center space-x-2 shrink-0 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить застройщика в аккредитацию</span>
                  </button>
                </div>
              </div>

              {filteredAccreditedDevs.length === 0 ? (
                <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {devSearchQuery ? 'Застройщиков по заданному запросу не найдено' : 'Нет аккредитованных застройщиков для банка'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {devSearchQuery
                      ? 'Проверьте правильность написания названия или ИНН'
                      : 'Нажмите «+ Добавить застройщика в аккредитацию», чтобы аккредитовать девелопера и настроить базовые ставки'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAccreditedDevs.map((dev) => {
                    const terms = (dev?.bankTerms || []).find(
                      (b) => b?.bankName === activePartnerBank && b?.isAccredited
                    );
                    return (
                      <div
                        key={dev.id}
                        className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all bg-white flex flex-col justify-between space-y-4 shadow-2xs"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black">
                              Аккредитован в {activePartnerBank}
                            </span>
                            {dev.inn && (
                              <span className="text-[11px] font-mono text-slate-500">
                                ИНН {dev.inn}
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-black text-slate-900 leading-snug">
                            {dev.name}
                          </h4>

                          <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Базовая ставка</div>
                              <div className="text-sm font-black text-slate-900 mt-0.5">
                                {terms?.baseRatePercent ?? 19.8}%
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Макс. ПДН</div>
                              <div className="text-sm font-black text-slate-900 mt-0.5">
                                {terms?.maxPdnPercent ?? 50}%
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {terms?.familyMortgage6 && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                                Семейная 6%
                              </span>
                            )}
                            {terms?.itMortgage6 && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                                IT-ипотека 6%
                              </span>
                            )}
                            {!terms?.familyMortgage6 && !terms?.itMortgage6 && (
                              <span className="text-[10px] text-slate-400 font-semibold">
                                Только стандартные программы
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDev(dev);
                              setEditDevBaseRate(terms?.baseRatePercent || 19.8);
                              setEditDevMaxPdn(terms?.maxPdnPercent || 50);
                              setEditDevFamily6(!!terms?.familyMortgage6);
                              setEditDevIt6(!!terms?.itMortgage6);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                          >
                            Редактировать условия
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRevokeDeveloperAccreditation(dev)}
                            className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                          >
                            Исключить
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Platform Registry: Developers Available for Bank Accreditation (Rule 1 & Rule 2) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Единый реестр платформы DomExit
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                      {pendingAccreditationDevs.length} девелоперов
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-1">
                    Застройщики, доступные для аккредитации в {activePartnerBank}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Девелоперы, зарегистрированные через согласование проектов (Шаг 3) или добавленные в систему. Нажмите «Аккредитовать», чтобы подключить генеральные ставки банка.
                  </p>
                </div>
              </div>

              {pendingAccreditationDevs.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  Все застройщики из реестра платформы уже аккредитованы в {activePartnerBank}.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingAccreditationDevs.map((dev) => {
                    const isViaProject =
                      dev.registered_via_project || dev.registrationSource === 'project_approval';
                    return (
                      <div
                        key={dev.id}
                        className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isViaProject
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isViaProject ? '✓ Одобрение проекта (Таб 3)' : 'Каталог платформы'}
                            </span>
                            {dev.inn && (
                              <span className="text-[11px] font-mono text-slate-500">
                                ИНН {dev.inn}
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-black text-slate-900 leading-snug">
                            {dev.name}
                          </h4>

                          {dev.registrationNote && (
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {dev.registrationNote}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDevToAdd(dev.name);
                            setCustomDevNameToAdd(dev.name);
                            setCustomDevInnToAdd(dev.inn || '');
                            setAddDevBaseRate(19.8);
                            setAddDevMaxPdn(50);
                            setAddDevFamily6(true);
                            setAddDevIt6(true);
                            setShowAddDevModal(true);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Аккредитовать в {activePartnerBank}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SPECIAL APPROVAL REQUESTS (GROUPED BY CONTRACTOR)  */}
        {/* ========================================================= */}
        {activeTab === 'special' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Согласование проектного финансирования и объектов малых подрядчиков ({tenantSpecialRequests.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Индивидуальный кредитный андеррайтинг, проверка смет в S3 Document Vault и назначение проектных ставок
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    placeholder="Поиск по подрядчику, ЖК, городу или ИНН..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
                  <span>Подрядчиков на проверке:</span>
                  <span className="font-black text-slate-900">{groupedSpecialContractors.length}</span>
                </div>
              </div>
            </div>

            {filteredGroupedSpecialContractors.length === 0 ? (
              <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {projectSearchQuery ? 'Объектов по заданному запросу не найдено' : 'Нет объектов на согласовании'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {projectSearchQuery
                    ? 'Проверьте название ЖК, город или ИНН подрядчика'
                    : `Все проекты подрядчиков для банка ${activePartnerBank} согласованы`}
                </p>
              </div>
            ) : (
              filteredGroupedSpecialContractors.map((entry) => {
                const isExpanded = expandedContractors[entry.compositeKey] ?? true;
                const pendingCount = (entry.requests || []).filter((r) => r?.status === 'pending').length;

                return (
                  <div
                    key={entry.compositeKey}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all"
                  >
                    {/* Contractor Header */}
                    <div
                      onClick={() =>
                        setExpandedContractors((prev) => ({
                          ...prev,
                          [entry.compositeKey]: !isExpanded,
                        }))
                      }
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 hover:bg-slate-100/70 border-b border-slate-200 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold shadow-2xs">
                          <Building2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              Подрядчик / Индивидуальный застройщик
                            </span>
                            {pendingCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                {pendingCount} требует решения
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-black text-slate-900 mt-0.5">
                            Застройщик / Подрядчик: «{entry.contractorName}» | ИНН: {entry.contractorInn || 'не указан'} | ({entry.requests.length} проекта(ов))
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-slate-500">
                          Всего проектов: {entry.requests.length}
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contractor Projects List */}
                    {isExpanded && (
                      <div className="p-5 space-y-4">
                        {(entry.requests || []).map((req) => (
                          <div
                            key={req.id}
                            className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all bg-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-2xs"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black">
                                  Лот #{req.lotCode}
                                </span>
                                {req.location && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                                    {req.location}
                                  </span>
                                )}
                                {req.status === 'pending' && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                    Ожидает решения банка
                                  </span>
                                )}
                                {req.status === 'approved' && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                    Согласовано ({req.decidedBy})
                                  </span>
                                )}
                                {req.status === 'rejected' && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                                    Отклонено
                                  </span>
                                )}
                              </div>

                              <h4 className="text-base font-black text-slate-900">
                                {req.projectTitle || req.complexName} — Себестоимость:{' '}
                                <span className="text-emerald-700">
                                  {formatRubles(req.costPriceRub || req.contractPriceRub)}
                                </span>
                              </h4>

                              <p className="text-xs text-slate-600">
                                <strong>Обоснование куратора ({req.requestedByEmployeeName}):</strong>{' '}
                                {req.reason}
                              </p>

                              {req.status === 'approved' && (
                                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-xl space-y-1">
                                  <div className="font-bold flex items-center space-x-2">
                                    <span>Утвержденные параметры финансирования:</span>
                                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[11px] font-black">
                                      Ставка {req.approvedRatePercent || 19.9}%
                                    </span>
                                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[11px] font-black">
                                      ПДН {req.maxPdnPercent || 50}%
                                    </span>
                                  </div>
                                  {req.decisionNotes && (
                                    <div className="text-[11px] text-emerald-700">
                                      Резолюция: {req.decisionNotes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openLotDocumentVault(
                                    req.lotCode,
                                    `Правовое досье и сметы проекта «${req.projectTitle || req.complexName}» (${entry.contractorName})`
                                  )
                                }
                                className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                              >
                                <Eye className="w-4 h-4 text-emerald-600" />
                                <span>Досье и сметы S3</span>
                              </button>

                              {req.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSpecialReq(req);
                                      setSpecialApprovedRate(19.9);
                                      setSpecialMaxPdn(50);
                                      setSpecialDecisionNotes(
                                        'Согласовано кредитным комитетом банка с открытием индивидуальной проектной линии'
                                      );
                                    }}
                                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs"
                                  >
                                    Одобрить финансирование проекта
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSpecialReq(req);
                                      handleDecideProjectSpecialApproval('rejected');
                                    }}
                                    className="px-3 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all cursor-pointer"
                                  >
                                    Отклонить
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: BANK STAFF MANAGEMENT & RBAC                       */}
        {/* ========================================================= */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Банковская дирекция и комплаенс
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {activePartnerBank}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-1">
                  Управление офицерами банка и ролевая модель (Bank RBAC)
                </h2>
                <p className="text-xs text-slate-500">
                  Назначение гранулярных прав: подтверждение депонирования СБР, аккредитация девелоперов и спецсогласование смет
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    placeholder="Поиск сотрудника по имени, email..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewStaffName('');
                    setNewStaffEmail('');
                    setNewStaffPhone('+7 (495) 500-00-00');
                    setNewStaffBank(activePartnerBank);
                    setNewStaffRole('officer');
                    setNewStaffPermissions(['escrow', 'developer_accreditation', 'special', 'staff']);
                    setShowAddStaffModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center space-x-2 cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить сотрудника банка</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBankStaff.length === 0 ? (
                <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-12 text-center space-y-3 col-span-full">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {staffSearchQuery ? 'Сотрудников по заданному запросу не найдено' : 'Список сотрудников банка пуст'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {staffSearchQuery
                      ? 'Проверьте правильность написания имени или email'
                      : `Сотрудники для банка ${activePartnerBank} еще не добавлены`}
                  </p>
                </div>
              ) : (
                filteredBankStaff.map((staff) => {
                  const perms = staff.permissions || [
                    'escrow',
                    'developer_accreditation',
                    'special',
                    'staff',
                  ];
                  const canManageStaff = isOwner || (matchingStaff?.isMasterAdmin && staff.id !== matchingStaff.id);

                  return (
                    <div
                      key={staff.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold">
                              {staff.bankName}
                            </span>
                            {staff.isMasterAdmin && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black">
                                Master Admin
                              </span>
                            )}
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              staff.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {staff.status === 'active' ? 'Активен' : 'Приостановлен'}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-base font-black text-slate-900">{staff.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">{staff.email}</p>
                          <p className="text-xs text-slate-500">{staff.phone}</p>
                        </div>

                        {/* Granular Bank RBAC Permissions */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                          <div className="text-[11px] font-black uppercase text-slate-600 tracking-wider">
                            Функциональные права (RBAC):
                          </div>

                          <div className="space-y-1.5 pt-0.5">
                            <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!canManageStaff}
                                checked={perms.includes('escrow')}
                                onChange={() => handleToggleStaffPermission(staff.id, 'escrow')}
                                className="rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                              />
                              <span className="font-semibold">Управление СБР и Эскроу</span>
                            </label>

                            <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!canManageStaff}
                                checked={perms.includes('developer_accreditation')}
                                onChange={() =>
                                  handleToggleStaffPermission(staff.id, 'developer_accreditation')
                                }
                                className="rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                              />
                              <span className="font-semibold">Аккредитация девелоперов</span>
                            </label>

                            <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!canManageStaff}
                                checked={perms.includes('special')}
                                onChange={() => handleToggleStaffPermission(staff.id, 'special')}
                                className="rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                              />
                              <span className="font-semibold">Финансирование подрядчиков</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 font-semibold uppercase">
                          {staff.role === 'chief_manager'
                            ? 'Гл. управляющий'
                            : staff.role === 'head_manager'
                            ? 'Руководитель дирекции'
                            : staff.role === 'escrow_agent'
                            ? 'Агент СБР / Эскроу'
                            : 'Кредитный офицер'}
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStaff(staff);
                              setEditStaffName(staff.name);
                              setEditStaffEmail(staff.email);
                              setEditStaffPhone(staff.phone || '');
                              setEditStaffRole(staff.role);
                              setEditStaffPermissions(
                                staff.permissions || [
                                  'escrow',
                                  'developer_accreditation',
                                  'special',
                                  'staff',
                                ]
                              );
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
                          >
                            Редактировать права
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingAction}
                            onClick={() => handleToggleStaffStatus(staff.id)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            {staff.status === 'active' ? 'Заблокировать' : 'Активировать'}
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingAction}
                            onClick={() => handleDeleteBankStaff(staff)}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            title="Удалить сотрудника из системы"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: DEVELOPER ACCREDITATION DECISION                   */}
      {/* ========================================================= */}
      {selectedDevReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Аккредитация застройщика в банке-партнёре
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  «{selectedDevReq.developerName}» (ИНН {selectedDevReq.developerInn})
                </h3>
                <p className="text-xs text-slate-500">
                  Объект: {selectedDevReq.complexName} (Лот #{selectedDevReq.lotCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDevReq(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Банк, принимающий решение об аккредитации:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PARTNER_BANKS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setDevDecisionBank(b)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        devDecisionBank === b
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Базовая ставка банка для девелопера (%):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="35"
                      value={devBaseRateInput}
                      onChange={(e) => setDevBaseRateInput(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900"
                    />
                    <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Норматив ПДН банка (% от дохода):
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([40, 50, 60] as const).map((pdn) => (
                      <button
                        key={pdn}
                        type="button"
                        onClick={() => setDevMaxPdnPercent(pdn)}
                        className={`py-2.5 rounded-xl text-xs font-black border ${
                          devMaxPdnPercent === pdn
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {pdn}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className="text-xs font-bold text-slate-700">
                  Доступные льготные программы для объектов застройщика:
                </div>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={devFamilyMortgage6}
                      onChange={(e) => setDevFamilyMortgage6(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Семейная ипотека 6%</span>
                  </label>

                  <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={devItMortgage6}
                      onChange={(e) => setDevItMortgage6(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>IT-ипотека 6%</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Заключение профильного департамента банка:
                </label>
                <textarea
                  rows={2}
                  value={devDecisionNotes}
                  onChange={(e) => setDevDecisionNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDevReq(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleDecideDeveloperAccreditation('rejected')}
                className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
              >
                Отклонить
              </button>
              <button
                type="button"
                onClick={() => handleDecideDeveloperAccreditation('approved')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer"
              >
                Аккредитовать девелопера
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: Special Approval Decision (Task 5: Project Financing Approval) */}
      {selectedSpecialReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Согласование проектного финансирования (214-ФЗ / Эскроу)
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  {selectedSpecialReq.projectTitle || selectedSpecialReq.complexName} (Лот #{selectedSpecialReq.lotCode})
                </h3>
                <p className="text-xs text-slate-500">
                  Подрядчик: <strong>{selectedSpecialReq.contractorName || selectedSpecialReq.developer}</strong> • Банк: {activePartnerBank}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpecialReq(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Себестоимость / Цена ДДУ:</span>
                <strong className="text-slate-900">
                  {formatRubles(selectedSpecialReq.costPriceRub || selectedSpecialReq.contractPriceRub)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Локация проекта:</span>
                <span className="font-semibold text-slate-900">
                  {selectedSpecialReq.location || 'СПб и Ленинградская область'}
                </span>
              </div>
              <div className="pt-1 text-slate-600">
                <strong>Обоснование:</strong> {selectedSpecialReq.reason}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    openLotDocumentVault(
                      selectedSpecialReq.lotCode,
                      `Досье и сметы проекта ${selectedSpecialReq.projectTitle || selectedSpecialReq.complexName}`
                    )
                  }
                  className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>Просмотреть проектную документацию и смету в S3 Vault</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Индивидуальная процентная ставка (%):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="5"
                      max="35"
                      value={specialApprovedRate}
                      onChange={(e) => setSpecialApprovedRate(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-black text-slate-900"
                    />
                    <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Норматив ПДН для покупателей:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([40, 50, 60] as const).map((pdn) => (
                      <button
                        key={pdn}
                        type="button"
                        onClick={() => setSpecialMaxPdn(pdn)}
                        className={`py-2 rounded-xl text-xs font-black border transition-all ${
                          specialMaxPdn === pdn
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pdn}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Резолюция кредитного комитета банка:
                </label>
                <textarea
                  rows={2}
                  value={specialDecisionNotes}
                  onChange={(e) => setSpecialDecisionNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setSelectedSpecialReq(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => handleDecideProjectSpecialApproval('rejected')}
                className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Отклонить
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => handleDecideProjectSpecialApproval('approved')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-60 flex items-center space-x-2"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Сохранение в базе...</span>
                  </>
                ) : (
                  <span>Одобрить финансирование проекта</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Developer to Bank Accreditation (Task 4) */}
      {showAddDevModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Аккредитация девелопера в банке
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Добавить застройщика в {activePartnerBank}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDevModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Выберите застройщика из единого реестра или добавьте нового:
                </label>
                <select
                  value={selectedDevToAdd}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedDevToAdd(val);
                    if (val && val !== '__custom__') {
                      const matched = (accreditedDevs || []).find((d) => d.name === val);
                      if (matched?.inn) setCustomDevInnToAdd(matched.inn);
                      if (matched?.name) setCustomDevNameToAdd(matched.name);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                >
                  <option value="">-- Выберите застройщика --</option>
                  {(accreditedDevs || []).map((dev) => (
                    <option key={dev.id} value={dev.name}>
                      {formatDeveloperOption(dev)}
                    </option>
                  ))}
                  <option value="__custom__">+ Добавить нового застройщика (вручную)</option>
                </select>
              </div>

              {selectedDevToAdd === '__custom__' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Наименование застройщика:
                    </label>
                    <input
                      type="text"
                      required
                      value={customDevNameToAdd}
                      onChange={(e) => setCustomDevNameToAdd(e.target.value)}
                      placeholder="ООО Северная Пальмира Девелопмент"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ИНН застройщика:
                    </label>
                    <input
                      type="text"
                      value={customDevInnToAdd}
                      onChange={(e) => setCustomDevInnToAdd(e.target.value)}
                      placeholder="7801234567"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Competitive Intelligence Widget (Task 4) */}
              {compIntel && compIntel.otherOffersCount > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-black text-slate-800">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span>Условия других банков-партнеров на DomExit</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      Предложений банков: {compIntel.otherOffersCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold">Лучшая ставка</div>
                      <div className="text-xs font-black text-emerald-700">{compIntel.minRate}%</div>
                      <div className="text-[9px] text-slate-400">{compIntel.lowestBank}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold">Средняя ставка</div>
                      <div className="text-xs font-black text-slate-900">{compIntel.avgRate}%</div>
                      <div className="text-[9px] text-slate-400">по платформе</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold">Макс. ПДН</div>
                      <div className="text-xs font-black text-slate-900">{compIntel.maxPdn}%</div>
                      <div className="text-[9px] text-slate-400">допустимо</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold">Льготные</div>
                      <div className="text-[10px] font-black text-blue-700">
                        {compIntel.hasFamilyMortgage ? 'Сем. 6% ' : ''}
                        {compIntel.hasItMortgage ? 'IT 6%' : ''}
                        {!compIntel.hasFamilyMortgage && !compIntel.hasItMortgage ? 'Стандарт' : ''}
                      </div>
                      <div className="text-[9px] text-slate-400">программы</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Базовая ставка для объектов девелопера (%):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="35"
                      value={addDevBaseRate}
                      onChange={(e) => setAddDevBaseRate(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-black text-slate-900"
                    />
                    <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Норматив ПДН банка (% от дохода):
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([40, 50, 60] as const).map((pdn) => (
                      <button
                        key={pdn}
                        type="button"
                        onClick={() => setAddDevMaxPdn(pdn)}
                        className={`py-2 rounded-xl text-xs font-black border transition-all ${
                          addDevMaxPdn === pdn
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {pdn}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className="text-xs font-bold text-slate-700">
                  Доступные льготные программы банка для этого застройщика:
                </div>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addDevFamily6}
                      onChange={(e) => setAddDevFamily6(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Семейная ипотека 6%</span>
                  </label>

                  <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addDevIt6}
                      onChange={(e) => setAddDevIt6(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>IT-ипотека 6%</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setShowAddDevModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleAccreditDeveloper}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-60 flex items-center space-x-2"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Сохранение в базе...</span>
                  </>
                ) : (
                  <span>Включить в аккредитацию</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Developer Terms (Task 4) */}
      {editingDev && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Редактирование условий аккредитации
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  «{editingDev.name}» в {activePartnerBank}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDev(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Competitive Intelligence Widget (Task 4) */}
              {compIntel && compIntel.otherOffersCount > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-black text-slate-800">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span>Условия других банков-партнеров на DomExit</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      Предложений банков: {compIntel.otherOffersCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold">Лучшая ставка</div>
                      <div className="text-xs font-black text-emerald-700">{compIntel.minRate}%</div>
                      <div className="text-[9px] text-slate-400">{compIntel.lowestBank}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold">Средняя ставка</div>
                      <div className="text-xs font-black text-slate-900">{compIntel.avgRate}%</div>
                      <div className="text-[9px] text-slate-400">по платформе</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold">Макс. ПДН</div>
                      <div className="text-xs font-black text-slate-900">{compIntel.maxPdn}%</div>
                      <div className="text-[9px] text-slate-400">допустимо</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold">Льготные</div>
                      <div className="text-[10px] font-black text-blue-700">
                        {compIntel.hasFamilyMortgage ? 'Сем. 6% ' : ''}
                        {compIntel.hasItMortgage ? 'IT 6%' : ''}
                        {!compIntel.hasFamilyMortgage && !compIntel.hasItMortgage ? 'Стандарт' : ''}
                      </div>
                      <div className="text-[9px] text-slate-400">программы</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Базовая ставка для девелопера (%):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="35"
                      value={editDevBaseRate}
                      onChange={(e) => setEditDevBaseRate(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-black text-slate-900"
                    />
                    <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Норматив ПДН банка (% от дохода):
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([40, 50, 60] as const).map((pdn) => (
                      <button
                        key={pdn}
                        type="button"
                        onClick={() => setEditDevMaxPdn(pdn)}
                        className={`py-2 rounded-xl text-xs font-black border transition-all ${
                          editDevMaxPdn === pdn
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {pdn}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className="text-xs font-bold text-slate-700">
                  Доступные льготные программы банка:
                </div>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editDevFamily6}
                      onChange={(e) => setEditDevFamily6(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Семейная ипотека 6%</span>
                  </label>

                  <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editDevIt6}
                      onChange={(e) => setEditDevIt6(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>IT-ипотека 6%</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setEditingDev(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleSaveDevTerms}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-60 flex items-center space-x-2"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Сохранение в базе...</span>
                  </>
                ) : (
                  <span>Сохранить условия</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Bank Staff (Full Staff CRUD) */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBankStaff}
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">Добавить сотрудника банка</h3>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ФИО сотрудника *</label>
              <input
                type="text"
                required
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="Иванов Пётр Сергеевич"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Корпоративный Email *
                </label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="officer@sberbank.ru"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Телефон РФ *</label>
                <input
                  type="tel"
                  required
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+7 (495) 500-00-00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Банк</label>
                <select
                  value={activePartnerBank}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold"
                >
                  <option value={activePartnerBank}>{activePartnerBank}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Уровень прав</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as BankEmployee['role'])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-semibold"
                >
                  <option value="chief_manager">Гл. управляющий</option>
                  <option value="head_manager">Руководитель дирекции</option>
                  <option value="escrow_agent">Агент СБР / Эскроу</option>
                  <option value="officer">Кредитный офицер</option>
                </select>
              </div>
            </div>

            {/* Granular Permission Checkboxes (4 Tabs) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-black uppercase text-slate-700 tracking-wider">
                Доступ к разделам шлюза (Bank RBAC):
              </div>
              <div className="space-y-1.5 text-xs text-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStaffPermissions.includes('escrow')}
                    onChange={(e) =>
                      setNewStaffPermissions(
                        e.target.checked
                          ? [...newStaffPermissions, 'escrow']
                          : newStaffPermissions.filter((p) => p !== 'escrow')
                      )
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Эскроу и СБР (Синхронизация закрытия)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStaffPermissions.includes('developer_accreditation')}
                    onChange={(e) =>
                      setNewStaffPermissions(
                        e.target.checked
                          ? [...newStaffPermissions, 'developer_accreditation']
                          : newStaffPermissions.filter((p) => p !== 'developer_accreditation')
                      )
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Аккредитация девелоперов</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStaffPermissions.includes('special')}
                    onChange={(e) =>
                      setNewStaffPermissions(
                        e.target.checked
                          ? [...newStaffPermissions, 'special']
                          : newStaffPermissions.filter((p) => p !== 'special')
                      )
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Согласование объектов (Подрядчики)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setShowAddStaffModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmittingAction}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-60 flex items-center space-x-2"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Сохранение в базе...</span>
                  </>
                ) : (
                  <span>Создать учетную запись</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Edit Bank Staff Rights & Profile (Full Staff CRUD) */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateBankStaff}
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">
                  Редактировать права сотрудника банка
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ФИО сотрудника *</label>
              <input
                type="text"
                required
                value={editStaffName}
                onChange={(e) => setEditStaffName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Корпоративный Email *
                </label>
                <input
                  type="email"
                  required
                  value={editStaffEmail}
                  onChange={(e) => setEditStaffEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Телефон РФ *</label>
                <input
                  type="tel"
                  required
                  value={editStaffPhone}
                  onChange={(e) => setEditStaffPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Должность / Роль</label>
              <select
                value={editStaffRole}
                onChange={(e) => setEditStaffRole(e.target.value as BankEmployee['role'])}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-semibold"
              >
                <option value="chief_manager">Гл. управляющий</option>
                <option value="head_manager">Руководитель дирекции</option>
                <option value="escrow_agent">Агент СБР / Эскроу</option>
                <option value="officer">Кредитный офицер</option>
              </select>
            </div>

            {/* Granular Permission Checkboxes (4 Tabs) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-black uppercase text-slate-700 tracking-wider">
                Разрешенные разделы шлюза (Bank RBAC):
              </div>
              <div className="space-y-1.5 text-xs text-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editStaffPermissions.includes('escrow')}
                    onChange={(e) =>
                      setEditStaffPermissions(
                        e.target.checked
                          ? [...editStaffPermissions, 'escrow']
                          : editStaffPermissions.filter((p) => p !== 'escrow')
                      )
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Эскроу и СБР (Синхронизация закрытия)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editStaffPermissions.includes('developer_accreditation')}
                    onChange={(e) =>
                      setEditStaffPermissions(
                        e.target.checked
                          ? [...editStaffPermissions, 'developer_accreditation']
                          : editStaffPermissions.filter((p) => p !== 'developer_accreditation')
                      )
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Аккредитация девелоперов</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editStaffPermissions.includes('special')}
                    onChange={(e) =>
                      setEditStaffPermissions(
                        e.target.checked
                          ? [...editStaffPermissions, 'special']
                          : editStaffPermissions.filter((p) => p !== 'special')
                      )
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Согласование объектов (Подрядчики)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setEditingStaff(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmittingAction}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-60 flex items-center space-x-2"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Сохранение в базе...</span>
                  </>
                ) : (
                  <span>Сохранить изменения</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Document Vault S3 Modal */}
      <DocumentVaultModal
        isOpen={vaultModalOpen}
        onClose={() => setVaultModalOpen(false)}
        entityType="lot"
        entityId={vaultEntityId}
        entityTitle={vaultModalTitle}
        uploadedByUid={user?.id || 'bank-officer'}
        clientCode={user?.clientCode || 'DEX-BANK'}
        canReview={true}
        reviewerName={`${currentOfficerName} (Банк-партнёр)`}
        onDocumentsChanged={loadData}
      />

      {/* Escrow Coordination Desk (Encrypted Chat Bridge) */}
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
          currentRole={isOwner ? 'curator' : 'bank_officer'}
          currentUserName={currentOfficerName}
        />
      )}

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default BankPortalPage;
