import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Users,
  Wallet,
  Building2,
  CreditCard,
  Plus,
  Lock,
  Unlock,
  Award,
  Search,
  ExternalLink,
  Percent,
  Eye,
  FolderOpen,
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Layers,
  Lightbulb,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { DevelopersRepository, PARTNER_BANKS, RUSSIAN_TOP_DEVELOPERS } from '../dal/repositories/DevelopersRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import {
  AccreditedDeveloper,
  BankEmployee,
  BuyerCreditLimitRequest,
  DealTrack,
  DeveloperAccreditationRequest,
  DeveloperBankTerms,
  Lot,
  PartnerBankName,
  SpecialApprovalRequest,
  BankTabPermission,
} from '../types';
import { formatRubles } from '../utils/formatters';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';

export const BankPortalPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'escrow' | 'developer_accreditation' | 'special' | 'credit_limits' | 'staff'
  >('escrow');

  const [activePartnerBank, setActivePartnerBank] = useState<PartnerBankName>('Сбербанк');
  const [deals, setDeals] = useState<DealTrack[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [devRequests, setDevRequests] = useState<DeveloperAccreditationRequest[]>([]);
  const [accreditedDevs, setAccreditedDevs] = useState<AccreditedDeveloper[]>([]);
  const [specialRequests, setSpecialRequests] = useState<SpecialApprovalRequest[]>([]);
  const [creditRequests, setCreditRequests] = useState<BuyerCreditLimitRequest[]>([]);
  const [bankStaff, setBankStaff] = useState<BankEmployee[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Document Vault Preview Modal
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [vaultModalTitle, setVaultModalTitle] = useState('');
  const [vaultEntityId, setVaultEntityId] = useState('U-10566');

  // Credit Limit Decision Modal State
  const [selectedCreditReq, setSelectedCreditReq] = useState<BuyerCreditLimitRequest | null>(null);
  const [approvedLimitInput, setApprovedLimitInput] = useState<number>(12500000);
  const [validUntilInput, setValidUntilInput] = useState<string>('2026-12-31');
  const [creditDecisionNotes, setCreditDecisionNotes] = useState<string>(
    'Одобрено по программе замещения ипотечного долга 214-ФЗ'
  );

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadData = async () => {
    const [dList, lList, devReqList, devAllList, sList, cList, stList] = await Promise.all([
      DealsRepository.getAll(),
      LotsRepository.getAll({ includePendingApproval: true }),
      DevelopersRepository.getAllAccreditationRequests(),
      DevelopersRepository.getAllDevelopers(),
      BankPortalRepository.getAllSpecialApprovals(),
      BankPortalRepository.getAllCreditLimitRequests(),
      BankPortalRepository.getAllBankEmployees(),
    ]);
    setDeals(dList);
    setLots(lList);
    setDevRequests(devReqList);
    setAccreditedDevs(devAllList);
    setSpecialRequests(sList);
    setCreditRequests(cList);
    setBankStaff(stList);
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
    const updated = await BankPortalRepository.confirmEscrowDeposit(
      deal.dealId,
      currentOfficerName,
      depositAmount
    );
    if (updated) {
      await loadData();
      showToast(
        `Депонирование средств (${formatRubles(
          updated.escrowWorkflow?.depositedAmountRub || deal.sellerReturnRub
        )}) подтверждено. Статус синхронизирован в кабинете Покупателя, Продавца и Комнате закрытия куратора.`
      );
    }
  };

  // 2. Confirm Funds Release (Step 4 of 4-Step Synchronized Escrow)
  const handleConfirmFundsRelease = async (deal: DealTrack) => {
    const lot = lots.find((l) => l.lotCode === deal.lotCode);
    const feeRub = lot?.serviceCommissionRub || Math.round(deal.sellerReturnRub * 0.025);
    const updated = await BankPortalRepository.releaseEscrowFunds(deal.dealId, currentOfficerName);
    if (updated) {
      await loadData();
      showToast(
        `Аккредитив СБР раскрыт по штампу Росреестра! Транши перечислены: Продавцу (${formatRubles(
          deal.sellerReturnRub
        )}), Застройщику/Банку и Комиссия оператора DomExit (${formatRubles(feeRub)}). Сделка закрыта.`
      );
    }
  };

  // 3. Developer Accreditation Decision
  const handleDecideDeveloperAccreditation = async (decision: 'approved' | 'rejected') => {
    if (!selectedDevReq) return;
    await DevelopersRepository.decideAccreditationRequest({
      requestId: selectedDevReq.id,
      bankName: devDecisionBank,
      decision,
      baseRatePercent: devBaseRateInput,
      familyMortgage6: devFamilyMortgage6,
      itMortgage6: devItMortgage6,
      maxPdnPercent: devMaxPdnPercent,
      notes: devDecisionNotes,
      decidedBy: `${currentOfficerName} (${devDecisionBank})`,
    });
    setSelectedDevReq(null);
    await loadData();
    showToast(
      decision === 'approved'
        ? `Застройщик «${selectedDevReq.developerName}» аккредитован банком ${devDecisionBank} (базовая ставка ${devBaseRateInput}%, ПДН ${devMaxPdnPercent}%) и автоматически включён в единый реестр!`
        : `Запрос на аккредитацию застройщика «${selectedDevReq.developerName}» отклонён банком ${devDecisionBank}.`
    );
  };

  // 4. Decide Special Approval
  const handleDecideSpecialApproval = async (status: 'approved' | 'rejected') => {
    if (!selectedSpecialReq) return;
    await BankPortalRepository.decideSpecialApproval(
      selectedSpecialReq.id,
      status,
      specialDecisionNotes,
      currentOfficerName
    );
    setSelectedSpecialReq(null);
    await loadData();
    showToast(
      status === 'approved'
        ? `Спецсогласование по лоту #${selectedSpecialReq.lotCode} одобрено банком!`
        : `Спецсогласование по лоту #${selectedSpecialReq.lotCode} отклонено.`
    );
  };

  // 5. Decide Credit Limit
  const handleDecideCreditLimit = async (status: 'approved' | 'rejected') => {
    if (!selectedCreditReq) return;
    if (status === 'approved') {
      await BankPortalRepository.approveCreditLimit(
        selectedCreditReq.id,
        approvedLimitInput,
        validUntilInput,
        currentOfficerName,
        creditDecisionNotes
      );
    } else {
      await BankPortalRepository.rejectCreditLimit(
        selectedCreditReq.id,
        currentOfficerName,
        creditDecisionNotes
      );
    }
    setSelectedCreditReq(null);
    await loadData();
    showToast(
      status === 'approved'
        ? `Кредитный сертификат на ${formatRubles(approvedLimitInput)} выпущен для ${selectedCreditReq.userName}!`
        : `Заявка на кредитный лимит для ${selectedCreditReq.userName} отклонена.`
    );
  };

  const isOwner = user?.role === 'owner' || user?.roles?.includes('owner');
  const matchingStaff = bankStaff.find(
    (s) => s.email.toLowerCase() === (user?.email || '').toLowerCase()
  );
  const userBankName = user?.bankName || user?.bankCreditLimit?.bankName || matchingStaff?.bankName;

  // Strict Bank Tenant Isolation
  useEffect(() => {
    if (!isOwner && userBankName) {
      setActivePartnerBank(userBankName as PartnerBankName);
      setDevDecisionBank(userBankName as PartnerBankName);
    }
  }, [isOwner, userBankName]);

  const userPermissions: BankTabPermission[] = useMemo(() => {
    return isOwner
      ? ['escrow', 'developer_accreditation', 'special', 'credit_limits', 'staff']
      : (matchingStaff?.permissions || [
          'escrow',
          'developer_accreditation',
          'special',
          'credit_limits',
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
  }, [userPermissions, activeTab]);

  // Filtered collections strictly for activePartnerBank
  const tenantDeals = deals.filter(
    (d) =>
      !d.escrowWorkflow?.bankName ||
      d.escrowWorkflow?.bankName === activePartnerBank ||
      d.escrowWorkflow?.bankName.includes(activePartnerBank)
  );

  const tenantAccreditedDevs = accreditedDevs.filter((d) =>
    d.bankTerms.some((b) => b.bankName === activePartnerBank && b.isAccredited)
  );

  const tenantSpecialRequests = specialRequests.filter(
    (s) => s.bankName === activePartnerBank || !s.bankName
  );

  const tenantCreditRequests = creditRequests.filter(
    (c) => c.bankName === activePartnerBank || !c.bankName
  );

  const tenantBankStaff = bankStaff.filter(
    (s) => s.bankName === activePartnerBank || isOwner
  );

  // Grouping special requests by contractor (Task 5)
  const groupedSpecialByContractor = tenantSpecialRequests.reduce((acc, req) => {
    const key = req.contractorName || req.developer || 'Независимый подрядчик';
    if (!acc[key]) acc[key] = [];
    acc[key].push(req);
    return acc;
  }, {} as Record<string, SpecialApprovalRequest[]>);

  // Accredit Developer for Bank
  const handleAccreditDeveloper = async () => {
    const devName = (selectedDevToAdd === '__custom__' ? customDevNameToAdd : selectedDevToAdd).trim();
    if (!devName) {
      showToast('Укажите название застройщика.');
      return;
    }
    await DevelopersRepository.accreditDeveloperForBank({
      developerName: devName,
      developerInn: customDevInnToAdd.trim() || undefined,
      bankName: activePartnerBank,
      baseRatePercent: addDevBaseRate,
      familyMortgage6: addDevFamily6,
      itMortgage6: addDevIt6,
      maxPdnPercent: addDevMaxPdn,
      officerName: currentOfficerName,
    });
    setShowAddDevModal(false);
    setSelectedDevToAdd('');
    setCustomDevNameToAdd('');
    setCustomDevInnToAdd('');
    await loadData();
    showToast(`Застройщик «${devName}» успешно аккредитован банком ${activePartnerBank}!`);
  };

  // Edit Developer Terms
  const handleSaveDevTerms = async () => {
    if (!editingDev) return;
    await DevelopersRepository.accreditDeveloperForBank({
      developerId: editingDev.id,
      developerName: editingDev.name,
      developerInn: editingDev.inn,
      bankName: activePartnerBank,
      baseRatePercent: editDevBaseRate,
      familyMortgage6: editDevFamily6,
      itMortgage6: editDevIt6,
      maxPdnPercent: editDevMaxPdn,
      officerName: currentOfficerName,
    });
    setEditingDev(null);
    await loadData();
    showToast(`Условия банка ${activePartnerBank} для «${editingDev.name}» обновлены.`);
  };

  // Revoke Developer Accreditation
  const handleRevokeDeveloperAccreditation = async (dev: AccreditedDeveloper) => {
    if (window.confirm(`Вы уверены, что хотите исключить застройщика «${dev.name}» из аккредитации банка ${activePartnerBank}?`)) {
      await DevelopersRepository.removeDeveloperAccreditation(dev.id, activePartnerBank, currentOfficerName);
      await loadData();
      showToast(`Застройщик «${dev.name}» исключен из аккредитации банка ${activePartnerBank}.`);
    }
  };

  // Decide Special Approval with Project Rate & PDN
  const handleDecideProjectSpecialApproval = async (status: 'approved' | 'rejected') => {
    if (!selectedSpecialReq) return;
    await BankPortalRepository.decideSpecialApproval(
      selectedSpecialReq.id,
      status,
      specialDecisionNotes,
      currentOfficerName,
      status === 'approved' ? specialApprovedRate : undefined,
      status === 'approved' ? specialMaxPdn : undefined
    );
    setSelectedSpecialReq(null);
    await loadData();
    showToast(
      status === 'approved'
        ? `Проект «${selectedSpecialReq.projectTitle || selectedSpecialReq.complexName}» одобрен банком (Ставка ${specialApprovedRate}%, ПДН ${specialMaxPdn}%)!`
        : `Проект отклонен.`
    );
  };

  // Toggle staff permission
  const handleToggleStaffPermission = async (staffId: string, perm: BankTabPermission) => {
    const staffMember = bankStaff.find((s) => s.id === staffId);
    if (!staffMember) return;
    const currentPerms = staffMember.permissions || ['escrow', 'developer_accreditation', 'special', 'credit_limits', 'staff'];
    const updatedPerms = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm];
    await BankPortalRepository.updateBankEmployeePermissions(staffId, updatedPerms);
    await loadData();
    showToast(`Права доступа сотрудника [${staffMember.name}] обновлены.`);
  };

  // 6. Add Bank Staff
  const handleCreateBankStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) return;
    await BankPortalRepository.addBankEmployee({
      name: newStaffName.trim(),
      email: newStaffEmail.trim(),
      phone: newStaffPhone.trim(),
      role: newStaffRole,
      bankName: activePartnerBank,
      status: 'active',
      permissions: ['escrow', 'developer_accreditation', 'special', 'credit_limits'],
    });
    setNewStaffName('');
    setNewStaffEmail('');
    setShowAddStaffModal(false);
    await loadData();
    showToast(`Сотрудник банка ${newStaffName} успешно добавлен.`);
  };

  const handleToggleStaffStatus = async (staffId: string) => {
    await BankPortalRepository.toggleBankEmployeeStatus(staffId);
    await loadData();
    showToast('Статус доступа сотрудника банка обновлен.');
  };

  const pendingEscrowCount = tenantDeals.filter(
    (d) =>
      d.escrowWorkflow?.step === 'bank_escrow_deposit' ||
      d.escrowWorkflow?.step === 'bank_funds_release'
  ).length;
  const pendingDevAccCount = devRequests.filter((r) => r.status === 'pending').length;
  const pendingSpecialCount = tenantSpecialRequests.filter((s) => s.status === 'pending').length;
  const pendingCreditCount = tenantCreditRequests.filter((c) => c.status === 'pending').length;

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
                Кабинет банка {activePartnerBank}: СБР, Аккредитация и Лимиты
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
                  {PARTNER_BANKS.map((b) => (
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
            <Link
              to="/"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <span>На витрину</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <span>Аккредитация застройщиков</span>
              <Building2 className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {pendingDevAccCount}{' '}
              <span className="text-xs font-bold text-slate-400">
                / {accreditedDevs.filter((d) => d.isAccredited).length} в реестре
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Заявки новых девелоперов 214-ФЗ
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
              <span>Заявки на кредитный лимит</span>
              <CreditCard className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{pendingCreditCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Предварительный скоринг покупателей
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
              <span>Уполномоченные офицеры</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {bankStaff.filter((s) => s.status === 'active').length}
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
                <span>1. Эскроу и СБР (Синхронизация закрытия)</span>
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
                <span>2. Аккредитация девелоперов</span>
                {pendingDevAccCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === 'developer_accreditation'
                        ? 'bg-white text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {pendingDevAccCount}
                  </span>
                )}
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
                <span>3. Согласование объектов (Подрядчики)</span>
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

            {userPermissions.includes('credit_limits') && (
              <button
                type="button"
                onClick={() => setActiveTab('credit_limits')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'credit_limits'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>4. Кредитные лимиты покупателей</span>
                {pendingCreditCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === 'credit_limits'
                        ? 'bg-white text-emerald-700'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {pendingCreditCount}
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
                <span>5. Сотрудники банка ({tenantBankStaff.length})</span>
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по коду лота, ФИО, ЖК..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

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
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shrink-0">
                Real-Time DAL Sync
              </span>
            </div>

            {deals
              .filter(
                (d) =>
                  !searchQuery ||
                  d.dealId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  d.lotCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  d.lotTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (d.buyerName || '').toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((deal) => {
                const wf = deal.escrowWorkflow;
                const step = wf?.step || 'curator_review';
                const lot = lots.find((l) => l.lotCode === deal.lotCode);
                const feeRub =
                  wf?.platformFeeRub ||
                  lot?.serviceCommissionRub ||
                  Math.round(deal.sellerReturnRub * 0.025);

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
                          <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center space-x-1.5">
                            <Camera className="w-4 h-4 text-amber-600" />
                            <span>Депонирование подтверждено • Ожидаем фото подписания и штамп Росреестра от куратора</span>
                          </span>
                        )}
                        {step === 'bank_funds_release' && (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center space-x-1.5">
                            <Unlock className="w-4 h-4 text-emerald-600" />
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

                        {(step === 'bank_funds_release' || step === 'signing_photos') && (
                          <button
                            type="button"
                            onClick={() => handleConfirmFundsRelease(deal)}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
                          >
                            <Unlock className="w-4 h-4" />
                            <span>Раскрыть СБР и выплатить транши</span>
                          </button>
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
              })}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: DEVELOPER ACCREDITATION ENGINE                     */}
        {/* ========================================================= */}
        {activeTab === 'developer_accreditation' && (
          <div className="space-y-6">
            {/* Incoming Developer Accreditation Requests */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Заявки на аккредитацию новых застройщиков (Developer Accreditation Workflow)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Достаточно одобрения хотя бы одного банка-партнёра, чтобы застройщик автоматически перешёл в статус аккредитованного и появился в фильтрах каталога и форме продавца.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  Активный банк: {activePartnerBank}
                </span>
              </div>

              {devRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Нет новых запросов на аккредитацию застройщиков.
                </div>
              ) : (
                <div className="space-y-4">
                  {devRequests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 text-xs font-black">
                            ИНН: {req.developerInn}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                            Лот #{req.lotCode}
                          </span>
                          {req.status === 'pending' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                              Ожидает аккредитации банков
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                              Аккредитован банками ({req.decisions.filter((d) => d.decision === 'approved').length})
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                              Отклонен
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-black text-slate-900">
                          Застройщик: «{req.developerName}» — {req.complexName}
                        </h3>
                        <p className="text-xs text-slate-600">
                          Район: <strong>{req.district}</strong> • Цена по ДДУ:{' '}
                          <strong>{formatRubles(req.contractPriceRub)}</strong> • Продавец:{' '}
                          <strong>
                            {req.sellerName} ({req.sellerClientCode})
                          </strong>
                        </p>

                        {req.decisions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {req.decisions.map((dec) => (
                              <span
                                key={dec.bankName}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                                  dec.decision === 'approved'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-red-50 border-red-200 text-red-700'
                                }`}
                              >
                                {dec.bankName}:{' '}
                                {dec.decision === 'approved'
                                  ? `Аккредитован (Базовая ${dec.baseRatePercent}%, ПДН ${dec.maxPdnPercent}%)`
                                  : 'Отклонен'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openLotDocumentVault(
                              req.lotCode,
                              `Документы застройщика «${req.developerName}» (ДДУ, справка об оплате, план)`,
                              req.documentIds
                            )
                          }
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-emerald-600" />
                          <span>Проверить ДДУ и проект</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDevReq(req);
                            setDevDecisionBank(activePartnerBank);
                            setDevBaseRateInput(19.8);
                            setDevFamilyMortgage6(true);
                            setDevItMortgage6(true);
                            setDevMaxPdnPercent(50);
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer"
                        >
                          Принять решение ({activePartnerBank})
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                  <span>+ Добавить застройщика в аккредитацию</span>
                </button>
              </div>

              {tenantAccreditedDevs.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <div className="text-sm font-bold text-slate-700">
                    Нет аккредитованных застройщиков в банке {activePartnerBank}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Нажмите «+ Добавить застройщика в аккредитацию», чтобы аккредитовать девелопера и настроить базовые ставки
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tenantAccreditedDevs.map((dev) => {
                    const terms = dev.bankTerms.find(
                      (b) => b.bankName === activePartnerBank && b.isAccredited
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
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span>Подрядчиков на проверке:</span>
                <span className="font-black text-slate-900">{Object.keys(groupedSpecialByContractor).length}</span>
              </div>
            </div>

            {Object.keys(groupedSpecialByContractor).length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <div className="text-sm font-bold text-slate-700">Нет запросов на спецсогласование</div>
                <div className="text-xs text-slate-400 mt-1">
                  Все проекты подрядчиков для банка {activePartnerBank} согласованы
                </div>
              </div>
            ) : (
              Object.entries(groupedSpecialByContractor).map(([contractorName, reqs]) => {
                const isExpanded = expandedContractors[contractorName] ?? true;
                const pendingCount = reqs.filter((r) => r.status === 'pending').length;

                return (
                  <div
                    key={contractorName}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all"
                  >
                    {/* Contractor Header */}
                    <div
                      onClick={() =>
                        setExpandedContractors((prev) => ({
                          ...prev,
                          [contractorName]: !isExpanded,
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
                            {contractorName}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-slate-500">
                          Всего проектов: {reqs.length}
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
                        {reqs.map((req) => (
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
                                    `Правовое досье и сметы проекта «${req.projectTitle || req.complexName}» (${contractorName})`
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
        {/* TAB 4: BUYER CREDIT LIMITS                                */}
        {/* ========================================================= */}
        {activeTab === 'credit_limits' && (
          <div className="space-y-4">
            {creditRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-black">
                      Код клиента: {req.clientCode}
                    </span>
                    <span className="text-xs text-slate-600 font-semibold">{req.bankName}</span>
                    {req.status === 'pending' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                        На скоринге
                      </span>
                    )}
                    {req.status === 'approved' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                        Лимит одобрен: {formatRubles(req.approvedLimitRub || req.requestedAmountRub)}
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                        Отказано
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    {req.userName} ({req.userPhone})
                  </h3>
                  <p className="text-xs text-slate-600">
                    Запрошенный лимит:{' '}
                    <strong className="text-slate-900">
                      {formatRubles(req.requestedAmountRub)}
                    </strong>
                    {req.certificateNumber && (
                      <span className="ml-3 text-emerald-700 font-mono">
                        Сертификат: {req.certificateNumber} (до {req.validUntil})
                      </span>
                    )}
                  </p>
                  {req.notes && <p className="text-xs text-slate-500">{req.notes}</p>}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCreditReq(req);
                      setApprovedLimitInput(req.approvedLimitRub || req.requestedAmountRub);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer"
                  >
                    {req.status === 'pending'
                      ? 'Выдать кредитный сертификат'
                      : 'Изменить лимит'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: BANK STAFF MANAGEMENT & RBAC                       */}
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
                  Назначение гранулярных прав: подтверждение депонирования СБР, аккредитация девелоперов, спецсогласование смет и кредитный скоринг
                </p>
              </div>

              {(isOwner || matchingStaff?.isMasterAdmin) && (
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center space-x-2 cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить офицера банка</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tenantBankStaff.map((staff) => {
                const perms = staff.permissions || [
                  'escrow',
                  'developer_accreditation',
                  'special',
                  'credit_limits',
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

                          <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!canManageStaff}
                              checked={perms.includes('credit_limits')}
                              onChange={() =>
                                handleToggleStaffPermission(staff.id, 'credit_limits')
                              }
                              className="rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                            />
                            <span className="font-semibold">Кредитные лимиты покупателей</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-semibold uppercase">
                        {staff.role === 'chief_manager'
                          ? 'Гл. управляющий'
                          : staff.role === 'head_manager'
                          ? 'Руководитель дирекции'
                          : staff.role === 'escrow_agent'
                          ? 'Агент СБР / Эскроу'
                          : 'Кредитный офицер'}
                      </span>

                      {canManageStaff && (
                        <button
                          type="button"
                          onClick={() => handleToggleStaffStatus(staff.id)}
                          className="text-xs font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          {staff.status === 'active' ? 'Заблокировать' : 'Активировать'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

      {/* MODAL: Credit Limit Decision */}
      {selectedCreditReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">
              Решение по кредитному лимиту: {selectedCreditReq.userName}
            </h3>
            <p className="text-xs text-slate-500">
              Код клиента: {selectedCreditReq.clientCode} • Банк: {selectedCreditReq.bankName}
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Одобренная сумма лимита (₽)
              </label>
              <input
                type="number"
                value={approvedLimitInput}
                onChange={(e) => setApprovedLimitInput(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Срок действия сертификата
              </label>
              <input
                type="date"
                value={validUntilInput}
                onChange={(e) => setValidUntilInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Комментарий кредитного инспектора
              </label>
              <textarea
                rows={2}
                value={creditDecisionNotes}
                onChange={(e) => setCreditDecisionNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCreditReq(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleDecideCreditLimit('rejected')}
                className="px-4 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold"
              >
                Отказать
              </button>
              <button
                type="button"
                onClick={() => handleDecideCreditLimit('approved')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black"
              >
                Одобрить и выпустить
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
                onClick={() => setSelectedSpecialReq(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleDecideProjectSpecialApproval('rejected')}
                className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
              >
                Отклонить
              </button>
              <button
                type="button"
                onClick={() => handleDecideProjectSpecialApproval('approved')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer"
              >
                Одобрить финансирование проекта
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
                  Выберите застройщика из каталога или добавьте нового:
                </label>
                <select
                  value={selectedDevToAdd}
                  onChange={(e) => setSelectedDevToAdd(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                >
                  <option value="">-- Выберите застройщика --</option>
                  {RUSSIAN_TOP_DEVELOPERS.map((devName: string) => (
                    <option key={devName} value={devName}>
                      {devName}
                    </option>
                  ))}
                  <option value="__custom__">+ Добавить нового застройщика</option>
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
                onClick={() => setShowAddDevModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAccreditDeveloper}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer"
              >
                Включить в аккредитацию
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
                onClick={() => setEditingDev(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveDevTerms}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer"
              >
                Сохранить условия
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Bank Staff */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBankStaff}
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-black text-slate-900">Добавить сотрудника банка</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ФИО и должность</label>
              <input
                type="text"
                required
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="Иванов П.С. (Старший офицер СБР)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Корпоративный Email
              </label>
              <input
                type="email"
                required
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="officer@sberbank.ru"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Банк</label>
                <select
                  value={newStaffBank}
                  onChange={(e) => setNewStaffBank(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900"
                >
                  <option value="Сбербанк">ПАО Сбербанк</option>
                  <option value="ВТБ">Банк ВТБ (ПАО)</option>
                  <option value="Альфа-Банк">АО Альфа-Банк</option>
                  <option value="ДОМ.РФ">Банк ДОМ.РФ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Уровень прав</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as BankEmployee['role'])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900"
                >
                  <option value="chief_manager">Гл. управляющий</option>
                  <option value="head_manager">Руководитель дирекции</option>
                  <option value="escrow_agent">Агент СБР / Эскроу</option>
                  <option value="officer">Кредитный офицер</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black"
              >
                Создать учетную запись
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
    </div>
  );
};

export default BankPortalPage;
