import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { DevelopersRepository, PARTNER_BANKS } from '../dal/repositories/DevelopersRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import {
  AccreditedDeveloper,
  BankEmployee,
  BuyerCreditLimitRequest,
  DealTrack,
  DeveloperAccreditationRequest,
  Lot,
  PartnerBankName,
  SpecialApprovalRequest,
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

  // Special Approval Decision Modal State
  const [selectedSpecialReq, setSelectedSpecialReq] = useState<SpecialApprovalRequest | null>(null);
  const [specialDecisionNotes, setSpecialDecisionNotes] = useState<string>(
    'Согласовано кредитным комитетом банка без штрафных санкций'
  );

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

  // 6. Add Bank Staff
  const handleCreateBankStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) return;
    await BankPortalRepository.addBankEmployee({
      name: newStaffName.trim(),
      email: newStaffEmail.trim(),
      phone: newStaffPhone.trim(),
      role: newStaffRole,
      bankName: newStaffBank,
      status: 'active',
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

  const pendingEscrowCount = deals.filter(
    (d) =>
      d.escrowWorkflow?.step === 'bank_escrow_deposit' ||
      d.escrowWorkflow?.step === 'bank_funds_release'
  ).length;
  const pendingDevAccCount = devRequests.filter((r) => r.status === 'pending').length;
  const pendingSpecialCount = specialRequests.filter((s) => s.status === 'pending').length;
  const pendingCreditCount = creditRequests.filter((c) => c.status === 'pending').length;

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
                Кабинет уполномоченного банка: Эскроу, Аккредитация застройщиков и Лимиты
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active Partner Bank Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              {PARTNER_BANKS.map((bank) => (
                <button
                  key={bank}
                  type="button"
                  onClick={() => {
                    setActivePartnerBank(bank);
                    setDevDecisionBank(bank);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activePartnerBank === bank
                      ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {bank}
                </button>
              ))}
            </div>

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
              <span>3. Спецсогласования объектов</span>
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
              <span>5. Сотрудники банка ({bankStaff.length})</span>
            </button>
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

            {/* Central Registry of Accredited Russian Developers */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Единый реестр аккредитованных застройщиков РФ ({accreditedDevs.filter((d) => d.isAccredited).length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ставки и лимиты ПДН каждого банка автоматически подставляются в ипотечный калькулятор на странице объектов этого девелопера.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <th className="py-3 px-3">Застройщик</th>
                      <th className="py-3 px-3">ИНН</th>
                      <th className="py-3 px-3">Аккредитовавшие банки и ставки</th>
                      <th className="py-3 px-3">Льготные программы</th>
                      <th className="py-3 px-3">Статус в каталоге</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accreditedDevs.map((dev) => (
                      <tr key={dev.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-black text-slate-900">{dev.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{dev.inn}</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {dev.bankTerms
                              .filter((b) => b.isAccredited)
                              .map((b) => (
                                <span
                                  key={b.bankName}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[11px]"
                                >
                                  {b.bankName}: {b.baseRatePercent}% (ПДН {b.maxPdnPercent}%)
                                </span>
                              ))}
                            {dev.bankTerms.filter((b) => b.isAccredited).length === 0 && (
                              <span className="text-amber-700 font-semibold">
                                Ожидает решения банков
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {dev.bankTerms.some((b) => b.familyMortgage6) && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                                Семейная 6%
                              </span>
                            )}
                            {dev.bankTerms.some((b) => b.itMortgage6) && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                                IT-ипотека 6%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {dev.isAccredited ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                              Аккредитован
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px]">
                              На проверке
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
        )}

        {/* ========================================================= */}
        {/* TAB 3: SPECIAL APPROVAL REQUESTS                          */}
        {/* ========================================================= */}
        {activeTab === 'special' && (
          <div className="space-y-4">
            {specialRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black">
                      Лот #{req.lotCode}
                    </span>
                    <span className="text-xs text-slate-600 font-semibold">{req.bankName}</span>
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
                  <h3 className="text-lg font-black text-slate-900">
                    {req.complexName} ({req.developer}) — Цена ДДУ:{' '}
                    {formatRubles(req.contractPriceRub)}
                  </h3>
                  <p className="text-xs text-slate-600">
                    <strong>Основание запроса ({req.requestedByEmployeeName}):</strong> {req.reason}
                  </p>
                  {req.decisionNotes && (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                      <strong>Резолюция банка:</strong> {req.decisionNotes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      openLotDocumentVault(
                        req.lotCode,
                        `Правовое досье лота #${req.lotCode} (${req.complexName})`
                      )
                    }
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>Документы S3</span>
                  </button>
                  {req.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => setSelectedSpecialReq(req)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer"
                    >
                      Принять решение
                    </button>
                  )}
                </div>
              </div>
            ))}
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
        {/* TAB 5: BANK STAFF MANAGEMENT                              */}
        {/* ========================================================= */}
        {activeTab === 'staff' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Управление сотрудниками и офицерами банков-партнёров
                </h2>
                <p className="text-xs text-slate-500">
                  Назначение прав подтверждения депонирования средств, аккредитации девелоперов и раскрытия СБР
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center space-x-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить офицера банка</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankStaff.map((staff) => (
                <div
                  key={staff.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold">
                        {staff.bankName}
                      </span>
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
                    <h4 className="text-base font-black text-slate-900">{staff.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{staff.email}</p>
                    <p className="text-xs text-slate-500">{staff.phone}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase">
                      {staff.role === 'chief_manager'
                        ? 'Гл. управляющий'
                        : staff.role === 'head_manager'
                        ? 'Руководитель дирекции'
                        : staff.role === 'escrow_agent'
                        ? 'Агент СБР / Эскроу'
                        : 'Кредитный офицер'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleStaffStatus(staff.id)}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      {staff.status === 'active' ? 'Заблокировать' : 'Активировать'}
                    </button>
                  </div>
                </div>
              ))}
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

      {/* MODAL: Special Approval Decision */}
      {selectedSpecialReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">
              Спецсогласование лота #{selectedSpecialReq.lotCode}
            </h3>
            <p className="text-xs text-slate-500">
              {selectedSpecialReq.complexName} • {selectedSpecialReq.bankName}
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Резолюция банка
              </label>
              <textarea
                rows={3}
                value={specialDecisionNotes}
                onChange={(e) => setSpecialDecisionNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSpecialReq(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleDecideSpecialApproval('rejected')}
                className="px-4 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold"
              >
                Отклонить
              </button>
              <button
                type="button"
                onClick={() => handleDecideSpecialApproval('approved')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black"
              >
                Одобрить уступку
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
