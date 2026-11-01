import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { formatRussianPhoneInput } from '../utils/validators';
import { getRegionByCode } from '../data/russianGeography';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { AnalyticsRepository } from '../dal/repositories/AnalyticsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { SellerRequestsRepository } from '../dal/repositories/SellerRequestsRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { UsersRepository } from '../dal/repositories/UsersRepository';
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import {
  MarketSettingsRepository,
  DEFAULT_DISTRICT_YIELD_CONFIGS,
} from '../dal/repositories/MarketSettingsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import {
  KPIStats,
  Lot,
  DealTrack,
  SellerExitRequest,
  Employee,
  BuyerCandidate,
  PartnerEntry,
  InvestorApplication,
  MarketSettings,
  DistrictYieldConfig,
  UserProfile,
  DocumentMetadata,
} from '../types';
import {
  CheckCircle2,
  Crown,
  Briefcase,
  UserCheck,
  FileText,
  Users,
  Check,
  Sliders,
  UserPlus,
  Save,
  X,
  Lock,
  HardDrive,
  AlertCircle,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user, switchRole } = useAuth();

  const [kpis, setKpis] = useState<KPIStats | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [sellerRequests, setSellerRequests] = useState<SellerExitRequest[]>([]);
  const [employeeDeals, setEmployeeDeals] = useState<DealTrack[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [candidates, setCandidates] = useState<BuyerCandidate[]>([]);
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [investors, setInvestors] = useState<InvestorApplication[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, string>>({});
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Market Settings State
  const [marketSettings, setMarketSettings] = useState<MarketSettings>({
    id: 'market_parameters',
    cbrKeyRatePercent: 21.0,
    familyMortgageRatePercent: 6.0,
    developerPenaltyPercent: 15.0,
    buyerCommissionPercent: 2.5,
    updatedAt: new Date().toISOString(),
  });
  const [isSavingMarket, setIsSavingMarket] = useState<boolean>(false);

  // District Yield & Capital Growth Engine State (Task 4)
  const [selectedYieldDistrict, setSelectedYieldDistrict] = useState<string>('Приморский район');
  const [districtDailyRentPct, setDistrictDailyRentPct] = useState<number>(0.05);
  const [districtMonthlyRentPct, setDistrictMonthlyRentPct] = useState<number>(0.65);
  const [districtAnnualGrowthPct, setDistrictAnnualGrowthPct] = useState<number>(11.5);
  const [isSavingDistrictYield, setIsSavingDistrictYield] = useState<boolean>(false);

  // Modal inspection state
  const [modalLot, setModalLot] = useState<Lot | null>(null);
  const [lotActionMode, setLotActionMode] = useState<'approve' | 'request_docs' | 'reject'>('approve');
  const [lotRejectReason, setLotRejectReason] = useState<string>('');
  const [lotDocsNotes, setLotDocsNotes] = useState<string>('');
  const [lotRequestedDocs, setLotRequestedDocs] = useState<string[]>([
    'Справка об оплате от застройщика с печатью',
    'Справка СФР об остатке материнского капитала',
  ]);

  const [modalPartner, setModalPartner] = useState<PartnerEntry | null>(null);
  const [partnerActionMode, setPartnerActionMode] = useState<'approve' | 'request_docs' | 'reject'>('approve');
  const [partnerActionNote, setPartnerActionNote] = useState<string>('');

  const [modalInvestor, setModalInvestor] = useState<InvestorApplication | null>(null);
  const [investorActionMode, setInvestorActionMode] = useState<'approve' | 'request_docs' | 'reject'>('approve');
  const [investorActionNote, setInvestorActionNote] = useState<string>('');

  // Cloud Document Vault Modal (Yandex Object Storage S3 Emulator)
  const [vaultConfig, setVaultConfig] = useState<{
    isOpen: boolean;
    entityType: DocumentMetadata['entityType'];
    entityId: string;
    entityTitle: string;
    mode: 'seller' | 'general';
  }>({
    isOpen: false,
    entityType: 'lot',
    entityId: '',
    entityTitle: '',
    mode: 'seller',
  });

  // Add Employee Modal
  const [showAddEmpModal, setShowAddEmpModal] = useState<boolean>(false);
  const [newEmpEmail, setNewEmpEmail] = useState<string>('');
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<string>('Куратор по 214-ФЗ');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('+7 (812) 409-32-00');
  const [newEmpTg, setNewEmpTg] = useState<string>('@domexit_');
  const [newEmpPerms] = useState<string[]>(['legal_audit', 'packaging', 'matchmaker', 'closing']);

  // Users & Staff management states
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [staffTab, setStaffTab] = useState<'users' | 'employees'>('users');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const isEmployee = user?.activeRole === 'employee';
  const isOwner = !isEmployee;
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';
  const operatorName =
    user?.name || (isOwner ? 'Виктор Сергеевич (Владелец / CEO)' : 'Алексей Смирнов (Куратор)');

  const showToast = (msg: string) => {
    setErrorMsg(null);
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4500);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4500);
  };

  const loadAllData = async () => {
    if (isEmployee) {
      const [assignedLots, empDeals, candData] = await Promise.all([
        LotsRepository.getByAssignedEmployee(currentEmployeeId),
        DealsRepository.getByEmployee(currentEmployeeId),
        CandidatesRepository.getAll(),
      ]);
      setLots(assignedLots);
      setEmployeeDeals(empDeals);
      setCandidates(candData);
      return;
    }

    const [
      kpiData,
      lotsData,
      sellerReqs,
      empData,
      candData,
      partData,
      invData,
      mSettings,
      allUsers,
    ] = await Promise.all([
      AnalyticsRepository.getKPIs(),
      LotsRepository.getAll({ includePendingApproval: true }),
      SellerRequestsRepository.getAll(),
      EmployeesRepository.getAll(),
      CandidatesRepository.getAll(),
      PartnersRepository.getAll(),
      InvestorClubRepository.getAll(),
      MarketSettingsRepository.getSettings(),
      UsersRepository.getAll(),
    ]);

    // Sort lots so pending owner approval & docs requested appear first in Triage Desk
    const sortedLots = [...lotsData].sort((a, b) => {
      const rank = (l: Lot) =>
        l.approvalStatus === 'pending_owner_approval'
          ? 0
          : l.additionalDocsRequested?.status === 'pending'
          ? 1
          : !l.assignedEmployeeId
          ? 2
          : l.approvalStatus === 'rejected'
          ? 4
          : 3;
      return rank(a) - rank(b);
    });

    setKpis(kpiData);
    setLots(sortedLots);
    setSellerRequests(sellerReqs);
    setEmployees(empData);
    setCandidates(candData);
    setPartners(partData);
    setInvestors(invData);
    setMarketSettings(mSettings);
    setUsersList(allUsers);
  };

  useEffect(() => {
    loadAllData();
  }, [user?.activeRole, currentEmployeeId]);

  const findSellerRequestForLot = (lotCode: string): SellerExitRequest | undefined =>
    sellerRequests.find((r) => r.lotCode.toUpperCase() === lotCode.toUpperCase());

  // Handle saving market settings
  const handleSaveMarketSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMarket(true);
    await MarketSettingsRepository.saveSettings({
      cbrKeyRatePercent: Number(marketSettings.cbrKeyRatePercent),
      familyMortgageRatePercent: Number(marketSettings.familyMortgageRatePercent),
      developerPenaltyPercent: Number(marketSettings.developerPenaltyPercent),
      buyerCommissionPercent: Number(marketSettings.buyerCommissionPercent),
    });

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'market_settings_updated',
      title: 'Обновлены ключевые рыночные параметры платформы',
      description: `Ставка ЦБ: ${marketSettings.cbrKeyRatePercent}%, Семейная: ${marketSettings.familyMortgageRatePercent}%, Штраф девелопера: ${marketSettings.developerPenaltyPercent}%, Комиссия: ${marketSettings.buyerCommissionPercent}%.`,
    });

    setIsSavingMarket(false);
    showToast('Рыночные ставки сохранены и мгновенно синхронизированы с ипотечным калькулятором (RU/EN)!');
  };

  // Owner Decision 1: Approve Seller Request & Assign Curator
  const handleApproveAndAssignLot = async (lot: Lot, specificEmpId?: string) => {
    const empId = specificEmpId || selectedEmployees[lot.id] || lot.assignedEmployeeId;
    if (!empId) {
      showError('Выберите штатного куратора для закрепления объекта перед одобрением.');
      return;
    }

    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    await SellerRequestsRepository.approveAndAssign(lot.lotCode, emp.id, emp.name, operatorName);
    showToast(`Заявка #${lot.lotCode} одобрена и закреплена за куратором: ${emp.name}`);
    setModalLot(null);
    await loadAllData();
  };

  // Owner Decision 2: Request Additional Docs from Seller
  const handleRequestSellerDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalLot) return;
    if (lotRequestedDocs.length === 0 && !lotDocsNotes.trim()) {
      showError('Укажите перечень запрашиваемых документов или комментарий.');
      return;
    }

    await SellerRequestsRepository.requestAdditionalDocs(
      modalLot.lotCode,
      lotRequestedDocs,
      lotDocsNotes.trim() || 'Требуется загрузить читаемые оригиналы сканов для верификации по 214-ФЗ.',
      operatorName
    );
    showToast(`Запрос дополнительных документов отправлен продавцу по лоту #${modalLot.lotCode}!`);
    setModalLot(null);
    setLotDocsNotes('');
    await loadAllData();
  };

  // Owner Decision 3: Reject Seller Request with Reason
  const handleRejectSellerLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalLot) return;
    if (!lotRejectReason.trim()) {
      showError('Укажите обязательную причину отказа.');
      return;
    }

    await SellerRequestsRepository.rejectRequest(modalLot.lotCode, lotRejectReason.trim(), operatorName);
    showToast(`Заявка по лоту #${modalLot.lotCode} отклонена. Причина зафиксирована в журнале аудита.`);
    setModalLot(null);
    setLotRejectReason('');
    await loadAllData();
  };

  // Partner Triage Decisions (Approve / Request Docs / Reject)
  const handleApprovePartner = async (partnerId: string) => {
    await PartnersRepository.approve(partnerId, operatorName);
    showToast('Статус Партнера B2B одобрен! Реферальный кабинет активирован.');
    setModalPartner(null);
    await loadAllData();
  };

  const handlePartnerModalDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPartner) return;

    if (partnerActionMode === 'approve') {
      await handleApprovePartner(modalPartner.id);
      return;
    }
    if (!partnerActionNote.trim()) {
      showError('Укажите комментарий или причину решения для партнера.');
      return;
    }

    if (partnerActionMode === 'request_docs') {
      await PartnersRepository.requestDocs(modalPartner.id, partnerActionNote.trim(), operatorName);
      showToast(`Запрос дополнительных документов отправлен партнеру ${modalPartner.name}.`);
    } else {
      await PartnersRepository.reject(modalPartner.id, partnerActionNote.trim(), operatorName);
      showToast(`Заявка партнера ${modalPartner.name} отклонена.`);
    }

    setPartnerActionNote('');
    setModalPartner(null);
    await loadAllData();
  };

  // VIP Investor Triage Decisions (Approve / Request Docs / Reject)
  const handleApproveInvestor = async (investorId: string) => {
    await InvestorClubRepository.approve(investorId, operatorName);
    showToast('Статус VIP Инвестора подтвержден! Приоритетный ранний доступ (48ч) открыт.');
    setModalInvestor(null);
    await loadAllData();
  };

  const handleInvestorModalDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInvestor) return;

    if (investorActionMode === 'approve') {
      await handleApproveInvestor(modalInvestor.id);
      return;
    }
    if (!investorActionNote.trim()) {
      showError('Укажите комментарий или причину отказа для инвестора.');
      return;
    }

    if (investorActionMode === 'request_docs') {
      await InvestorClubRepository.requestDocs(modalInvestor.id, investorActionNote.trim(), operatorName);
      showToast(`Запрос подтверждения капитала направлен инвестору ${modalInvestor.fullName}.`);
    } else {
      await InvestorClubRepository.reject(modalInvestor.id, investorActionNote.trim(), operatorName);
      showToast(`Заявка VIP-инвестора ${modalInvestor.fullName} отклонена.`);
    }

    setInvestorActionNote('');
    setModalInvestor(null);
    await loadAllData();
  };

  // Toggle employee status
  const handleToggleEmp = async (empId: string) => {
    await EmployeesRepository.toggleStatus(empId);
    showToast('Статус доступа сотрудника обновлен.');
    await loadAllData();
  };

  // Update user role dynamically
  const handleUpdateUserRole = async (targetUserId: string, newRole: string) => {
    setUpdatingUserId(targetUserId);
    try {
      const updated = await UsersRepository.updateRole(targetUserId, newRole, operatorName);
      if (updated) {
        showToast(`Роль пользователя [${updated.email}] изменена на «${newRole}».`);
        await loadAllData();
      }
    } catch (err) {
      console.error('Failed to update user role:', err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Add new employee & auto-register user
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpEmail || !newEmpName) return;

    const createdEmp = await EmployeesRepository.add({
      email: newEmpEmail,
      name: newEmpName,
      role: newEmpRole,
      phone: newEmpPhone,
      telegram: newEmpTg,
      permissions: newEmpPerms,
      status: 'active',
      activeLotsCount: 0,
      closedDealsCount: 0,
      avgSpeedDays: 8.0,
    });

    let mappedRole: 'employee' | 'owner' | 'bank' = 'employee';
    if (
      newEmpRole.toLowerCase().includes('владелец') ||
      newEmpRole.toLowerCase().includes('co-owner')
    ) {
      mappedRole = 'owner';
    } else if (newEmpRole.toLowerCase().includes('банк')) {
      mappedRole = 'bank';
    }

    await UsersRepository.add({
      email: newEmpEmail,
      name: newEmpName,
      phone: newEmpPhone,
      telegram: newEmpTg,
      assignedEmployeeId: createdEmp.id,
      role: mappedRole === 'owner' ? 'admin' : mappedRole,
      roles:
        mappedRole === 'owner'
          ? ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer']
          : [mappedRole],
      activeRole: mappedRole,
      isPartnerApproved: true,
      isInvestorApproved: true,
    });

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'employee_created_modified',
      title: `Добавлен новый сотрудник: ${newEmpName}`,
      description: `Email: ${newEmpEmail}, Должность: ${newEmpRole}. Доступ куратора активирован.`,
    });

    setShowAddEmpModal(false);
    setNewEmpEmail('');
    setNewEmpName('');
    showToast(`Сотрудник ${newEmpName} (${newEmpEmail}) успешно добавлен в штат.`);
    await loadAllData();
  };

  // Strictly isolated employee collections
  const employeeLots = isEmployee
    ? lots.filter((l) => l.assignedEmployeeId === currentEmployeeId)
    : [];
  const employeeLotCodes = employeeLots.map((l) => l.lotCode.toUpperCase());
  const employeeCandidates = isEmployee
    ? candidates.filter((c) => c.lotCode && employeeLotCodes.includes(c.lotCode.toUpperCase()))
    : [];
  const employeeEscrowCount = isEmployee
    ? employeeDeals.filter((d) => d.stage === 'closing_escrow').length
    : 0;

  const pendingSellerCount = lots.filter((l) => l.approvalStatus === 'pending_owner_approval').length;
  const pendingPartnerCount = partners.filter((p) => p.status === 'pending').length;
  const pendingInvestorCount = investors.filter((i) => i.status === 'pending').length;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={
            isOwner
              ? 'Панель Владельца — Контроль заявок, сделок и выручки'
              : 'Кабинет Сотрудника — Управление назначенными объектами'
          }
          subtitle={
            isOwner
              ? 'Генеральный обзор платформы: верификация новых продавцов, партнеров и VIP-инвесторов, назначение кураторов и учет комиссии 2.5%'
              : `Куратор: ${operatorName} | Строгая изоляция 152-ФЗ: только закрепленные лоты и прямые заявки покупателей`
          }
        />

        {/* Global Notification Banners */}
        {notificationMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              <span>{notificationMsg}</span>
            </div>
            <button onClick={() => setNotificationMsg(null)} className="text-white/80 hover:text-white ml-2 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-600 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-white shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-white/80 hover:text-white ml-2 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6 max-w-7xl">
          {/* Role Status Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-xl ${
                  isOwner ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {isOwner ? <Crown className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  {isOwner
                    ? 'Текущий режим: Владелец платформы (Генеральный директор)'
                    : `Текущий режим: Куратор отдела выходов (${operatorName})`}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isOwner
                    ? 'Доступны: глобальная выручка 2.5%, верификация сейфов документов (Yandex S3), одобрение продавцов/партнеров/VIP-инвесторов.'
                    : 'Финансовая выручка платформы и чужие сделки скрыты (152-ФЗ). Доступны только назначенные вам объекты.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => switchRole(isOwner ? 'employee' : 'owner')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors shrink-0 cursor-pointer"
            >
              {isOwner ? 'Переключиться в Кабинет Сотрудника' : 'Переключиться в Панель Владельца'}
            </button>
          </div>

          {/* =========================================================================
              OWNER MODE: Full platform financial view & Triage Desk
          ========================================================================= */}
          {isOwner && (
            <>
              {/* Top 4 Live KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      ЗАЯВКИ НА ВЫХОД В КОНТУРЕ
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      {pendingSellerCount > 0
                        ? `${pendingSellerCount} новых`
                        : kpis?.todayNewRequestsGrowth || 'Активно'}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">
                    {kpis?.todayNewRequestsCount ?? sellerRequests.length} заявок
                  </div>
                  <p className="text-xs text-slate-500">
                    Сумма возврата:{' '}
                    <strong className="text-slate-800">
                      {formatRubles(kpis?.todayNewRequestsReturnRub || 0)}
                    </strong>
                  </p>
                </div>

                {/* KPI 2 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      АКТИВНЫЕ ЛОТЫ В РЕЕСТРЕ
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                      Дисконт {kpis?.averageDiscountPercent ?? 21.8}%
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">
                    {kpis?.activeLotsCount ?? lots.length} объектов
                  </div>
                  <p className="text-xs text-slate-500">
                    СПб: {kpis?.activeLotsSpbCount ?? 0} | МСК: {kpis?.activeLotsMskCount ?? 0} | Регионы РФ:{' '}
                    {kpis?.activeLotsRegionsCount ?? 0}
                  </p>
                </div>

                {/* KPI 3 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      СДЕЛКИ В БАНКАХ / РОСРЕЕСТРЕ
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                      {formatRubles(kpis?.dealsInEscrowTotalRub || 0)}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">
                    {kpis?.dealsInEscrowStageCount ?? 0} эскроу
                  </div>
                  <p className="text-xs text-slate-500">
                    Сбербанк: {kpis?.dealsInSberCount ?? 0} | ВТБ/Альфа: {kpis?.dealsInVtbCount ?? 0}
                  </p>
                </div>

                {/* KPI 4: Company Revenue */}
                <div className="bg-emerald-50/60 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      ОЖИДАЕМАЯ КОМИССИЯ (2.5%)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold uppercase shadow-xs">
                      0 ₽ с продавцов
                    </span>
                  </div>
                  <div className="text-3xl font-black text-emerald-700">
                    {formatRubles(kpis?.expectedCommissionMonthlyRub || 0)}
                  </div>
                  <p className="text-xs text-emerald-800/80">
                    Факт: {formatRubles(kpis?.actualCommissionMonthlyRub || 0)} | В резерве:{' '}
                    {formatRubles(kpis?.reservedCommissionMonthlyRub || 0)}
                  </p>
                </div>
              </div>

              {/* Centralized Market Settings Panel */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-emerald-600" />
                      <span>Настройки рыночных ставок и параметров платформы (DAL Live Sync)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Изменение ключевой ставки ЦБ РФ мгновенно обновляет ипотечный калькулятор (ПДН &lt; 50%) в карточках всех лотов.
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Синхронизация: DAL Gateway
                  </span>
                </div>

                <form
                  onSubmit={handleSaveMarketSettings}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs"
                >
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ключевая / Рыночная ставка ЦБ РФ (%):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={marketSettings.cbrKeyRatePercent}
                      onChange={(e) =>
                        setMarketSettings({
                          ...marketSettings,
                          cbrKeyRatePercent: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Базовая ставка семейной ипотеки (%):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={marketSettings.familyMortgageRatePercent}
                      onChange={(e) =>
                        setMarketSettings({
                          ...marketSettings,
                          familyMortgageRatePercent: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Средний штраф за расторжение (%):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={marketSettings.developerPenaltyPercent}
                      onChange={(e) =>
                        setMarketSettings({
                          ...marketSettings,
                          developerPenaltyPercent: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Комиссия платформы (покупатель) (%):
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        step="0.1"
                        value={marketSettings.buyerCommissionPercent}
                        onChange={(e) =>
                          setMarketSettings({
                            ...marketSettings,
                            buyerCommissionPercent: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={isSavingMarket}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors shrink-0 flex items-center space-x-1 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingMarket ? '...' : 'Сохранить'}</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* District Yield & Capital Growth Engine (Task 4) */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        District Yield & Capital Growth Engine
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        Управление коэффициентами аренды и прогнозом роста цен по районам (3 и 5 лет)
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Автоматический пересчет ROI и капитализации в карточках лотов
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs items-end">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Выберите район / локацию:
                      </label>
                      <select
                        value={selectedYieldDistrict}
                        onChange={async (e) => {
                          const distName = e.target.value;
                          setSelectedYieldDistrict(distName);
                          const cfg = await MarketSettingsRepository.getDistrictYieldConfig(distName);
                          setDistrictDailyRentPct(cfg.dailyRentPercentOfMarket);
                          setDistrictMonthlyRentPct(cfg.monthlyRentPercentOfMarket);
                          setDistrictAnnualGrowthPct(cfg.annualGrowthPercent);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                      >
                        {Object.keys({
                          ...DEFAULT_DISTRICT_YIELD_CONFIGS,
                          ...(marketSettings.districtYieldConfigs || {}),
                        }).map((distKey) => (
                          <option key={distKey} value={distKey}>
                            {distKey}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Посуточная аренда (% от рынка/сут.):
                      </label>
                      <input
                        type="number"
                        step="0.005"
                        min="0.01"
                        max="1"
                        value={districtDailyRentPct}
                        onChange={(e) => setDistrictDailyRentPct(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Долгосрочная аренда (% от рынка/мес.):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="5"
                        value={districtMonthlyRentPct}
                        onChange={(e) => setDistrictMonthlyRentPct(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Прогноз роста цены (% годовых):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="35"
                        value={districtAnnualGrowthPct}
                        onChange={(e) => setDistrictAnnualGrowthPct(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        disabled={isSavingDistrictYield}
                        onClick={async () => {
                          setIsSavingDistrictYield(true);
                          const savedCfg: DistrictYieldConfig =
                            await MarketSettingsRepository.saveDistrictYieldConfig(
                              {
                                districtNameRu: selectedYieldDistrict,
                                dailyRentPercentOfMarket: districtDailyRentPct,
                                monthlyRentPercentOfMarket: districtMonthlyRentPct,
                                annualGrowthPercent: districtAnnualGrowthPct,
                                updatedAt: new Date().toISOString(),
                              },
                              user?.name || 'Виктор Сергеевич (CEO)'
                            );
                          const latestSettings = await MarketSettingsRepository.getSettings();
                          setMarketSettings(latestSettings);
                          setIsSavingDistrictYield(false);
                          setNotificationMsg(
                            `Коэффициенты доходности для района «${savedCfg.districtNameRu}» сохранены (Посуточно: ${savedCfg.dailyRentPercentOfMarket}%, Долгосрочно: ${savedCfg.monthlyRentPercentOfMarket}%, Рост: +${savedCfg.annualGrowthPercent}%/год).`
                          );
                        }}
                        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingDistrictYield ? 'Сохранение...' : 'Обновить район'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* OWNER TRIAGE DESK 1: Seller Exit Requests & Curator Assignment */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <UserCheck className="w-5 h-5 text-indigo-600" />
                      <span>Стол рассмотрения заявок продавцов и назначения куратора (Owner Only)</span>
                      {pendingSellerCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black">
                          {pendingSellerCount} ожидают решения
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Проверьте загруженные продавцом оригиналы ДДУ/СФР в облачном сейфе (Yandex S3), закрепите куратора, запросите доп. документы или отклоните с причиной.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                    Штат: {employees.length} кураторов
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Код лота</th>
                        <th className="py-3 px-3">Регион / ЖК / Застройщик</th>
                        <th className="py-3 px-3">Возврат продавцу</th>
                        <th className="py-3 px-3">Статус комплаенса</th>
                        <th className="py-3 px-3">Ответственный куратор</th>
                        <th className="py-3 px-3 text-right">Полный аудит / Решение</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lots.map((lot) => {
                        const region = getRegionByCode(lot.city);
                        const isPendingOwner = lot.approvalStatus === 'pending_owner_approval';
                        const isDocsReq = lot.additionalDocsRequested?.status === 'pending';
                        const isRejected = lot.approvalStatus === 'rejected';

                        return (
                          <tr
                            key={lot.id}
                            className={`transition-colors ${
                              isPendingOwner
                                ? 'bg-amber-50/40 hover:bg-amber-50/80'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">
                              <div>#{lot.lotCode}</div>
                              {isPendingOwner && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black uppercase">
                                  НОВАЯ ЗАЯВКА
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-900 block">
                                {lot.complexName}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {region.shortLabelRu}, {lot.district} • {lot.developer} • {lot.areaM2} м²
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono">
                              <span className="font-bold text-emerald-700 block">
                                {formatRubles(lot.cashPaidBySeller)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ДДУ: {formatRubles(lot.dduContractPrice)}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {isRejected ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Отклонен
                                </span>
                              ) : isDocsReq ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                  Запрошены док-ты
                                </span>
                              ) : isPendingOwner ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  На проверке CEO
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    lot.status === 'available'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : lot.status === 'processing'
                                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {lot.status === 'available'
                                    ? 'В каталоге'
                                    : lot.status === 'processing'
                                    ? 'В сделке'
                                    : 'Закрыт'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {lot.assignedEmployeeName ? (
                                <div className="flex items-center space-x-1.5 text-slate-900 font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span>{lot.assignedEmployeeName}</span>
                                </div>
                              ) : (
                                <span className="text-amber-600 font-medium text-[11px] italic">
                                  Не назначен
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalLot(lot);
                                    setLotActionMode('approve');
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                                >
                                  Анкета и Сейф S3
                                </button>

                                <select
                                  value={selectedEmployees[lot.id] || lot.assignedEmployeeId || ''}
                                  onChange={(e) =>
                                    setSelectedEmployees({
                                      ...selectedEmployees,
                                      [lot.id]: e.target.value,
                                    })
                                  }
                                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="">Куратор...</option>
                                  {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.name}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => handleApproveAndAssignLot(lot)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                                >
                                  {isPendingOwner ? 'Одобрить' : 'Закрепить'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OWNER TRIAGE DESK 2 & 3: Partners & VIP Investors */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Partners Approval Desk */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>Заявки на статус Партнера B2B ({partners.length})</span>
                      {pendingPartnerCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                          +{pendingPartnerCount} новых
                        </span>
                      )}
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-purple-700">
                      30 000 – 50 000 ₽ / выход
                    </span>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {partners.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">{p.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {p.organization} • {p.phone}
                            {p.inn ? ` • ИНН ${p.inn}` : ''}
                          </div>
                          <div className="text-[10px] text-purple-700 font-mono mt-0.5">
                            Код: {p.referralCode}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setModalPartner(p);
                              setPartnerActionMode('approve');
                              setPartnerActionNote('');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                          >
                            Досье
                          </button>
                          {p.status === 'approved' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Одобрен</span>
                            </span>
                          ) : p.status === 'rejected' ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                              Отклонен
                            </span>
                          ) : p.status === 'docs_requested' ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              Доп. док-ты
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApprovePartner(p.id)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              Одобрить
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Investors Approval Desk (6-step Onboarding) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Crown className="w-4 h-4 text-amber-600" />
                      <span>Заявки VIP Инвесторов ({investors.length})</span>
                      {pendingInvestorCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          +{pendingInvestorCount} новых
                        </span>
                      )}
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-amber-700">
                      Ранний доступ 48ч
                    </span>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {investors.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">
                            {inv.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {inv.companyOrFund || 'Частный капитал'} • Капитал: {inv.capitalVolume}
                          </div>
                          <div className="text-[10px] text-amber-700 font-semibold mt-0.5 truncate">
                            Стратегия: {inv.strategy} • {inv.targetRegions?.slice(0, 2).join(', ')}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setModalInvestor(inv);
                              setInvestorActionMode('approve');
                              setInvestorActionNote('');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                          >
                            Досье 6 шагов
                          </button>
                          {inv.status === 'approved' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Одобрен</span>
                            </span>
                          ) : inv.status === 'rejected' ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                              Отклонен
                            </span>
                          ) : inv.status === 'docs_requested' ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              Запрос капитала
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApproveInvestor(inv.id)}
                              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              Одобрить VIP
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Staff, Users & Role Management */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                      <span>Управление пользователями, штатом и ролями RBAC</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Контроль учетных записей, мгновенная смена ролей и доступы штатных кураторов.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setStaffTab('users')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          staffTab === 'users'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Аккаунты ({usersList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStaffTab('employees')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          staffTab === 'employees'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Штатные кураторы ({employees.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddEmpModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ Добавить сотрудника</span>
                    </button>
                  </div>
                </div>

                {staffTab === 'users' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">Пользователь</th>
                          <th className="py-3 px-3">Email</th>
                          <th className="py-3 px-3">Текущая роль</th>
                          <th className="py-3 px-3">Назначить роль</th>
                          <th className="py-3 px-3 text-center">Аккредитации</th>
                          <th className="py-3 px-3 text-right">Тест доступа</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersList.map((u) => {
                          const isMasterOwner =
                            u.email?.toLowerCase() === 'amaas9499@gmail.com' ||
                            u.email?.toLowerCase() === 'ceo@domexit.ru';
                          const currentRole = u.activeRole || u.role || 'buyer';

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                  <span>{u.name}</span>
                                  {isMasterOwner && (
                                    <span className="px-1.5 py-0.5 rounded-sm bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                                      CEO
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 font-mono text-[11px]">
                                  {u.clientCode}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                                {u.email}
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                  {currentRole}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <select
                                  disabled={updatingUserId === u.id}
                                  value={currentRole === 'admin' ? 'owner' : currentRole}
                                  onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                  className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
                                >
                                  <option value="owner">👑 Владелец (owner)</option>
                                  <option value="employee">👨‍💼 Куратор (employee)</option>
                                  <option value="bank">🏦 Банк-партнер (bank)</option>
                                  <option value="partner">🤝 Партнер B2B (partner)</option>
                                  <option value="investor">💎 VIP Инвестор (investor)</option>
                                  <option value="seller">🏠 Продавец ДДУ (seller)</option>
                                  <option value="buyer">🔑 Покупатель (buyer)</option>
                                </select>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      u.isPartnerApproved
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    Партнер {u.isPartnerApproved ? '✓' : '—'}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      u.isInvestorApproved
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    VIP {u.isInvestorApproved ? '✓' : '—'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    switchRole(
                                      (currentRole === 'admin'
                                        ? 'owner'
                                        : currentRole === 'bank_officer'
                                        ? 'bank'
                                        : currentRole) as
                                        | 'buyer'
                                        | 'seller'
                                        | 'partner'
                                        | 'investor'
                                        | 'employee'
                                        | 'owner'
                                        | 'bank'
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Войти под ролью →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {staffTab === 'employees' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">Сотрудник</th>
                          <th className="py-3 px-3">Email</th>
                          <th className="py-3 px-3">Должность</th>
                          <th className="py-3 px-3">Контакты</th>
                          <th className="py-3 px-3 text-center">Закреплено лотов</th>
                          <th className="py-3 px-3">Статус</th>
                          <th className="py-3 px-3 text-right">Действие</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-900">{emp.name}</td>
                            <td className="py-3 px-3 font-mono text-slate-600">{emp.email}</td>
                            <td className="py-3 px-3 text-slate-800">{emp.role}</td>
                            <td className="py-3 px-3">
                              <div>{emp.phone}</div>
                              <div className="text-indigo-600 font-mono text-[11px]">
                                {emp.telegram}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono text-indigo-700">
                              {lots.filter((l) => l.assignedEmployeeId === emp.id).length}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  emp.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {emp.status === 'active' ? 'Активен' : 'Приостановлен'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleEmp(emp.id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                {emp.status === 'active' ? 'Приостановить' : 'Активировать'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* =========================================================================
              EMPLOYEE MODE: Strict Data Isolation (Only Assigned Lots & Inbound Bids)
          ========================================================================= */}
          {!isOwner && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    МОИ ЗАКРЕПЛЕННЫЕ ОБЪЕКТЫ
                  </span>
                  <div className="text-3xl font-black text-slate-900">
                    {employeeLots.length} лотов
                  </div>
                  <p className="text-xs text-emerald-700 font-semibold">
                    Назначены владельцем платформы
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    ВХОДЯЩИЕ ЗАЯВКИ ПОКУПАТЕЛЕЙ
                  </span>
                  <div className="text-3xl font-black text-sky-700">
                    {employeeCandidates.length} предложений
                  </div>
                  <p className="text-xs text-slate-500">Только на ваши закрепленные лоты</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    МОИ СДЕЛКИ В ЭСКРОУ
                  </span>
                  <div className="text-3xl font-black text-slate-900">
                    {employeeEscrowCount} сделок
                  </div>
                  <p className="text-xs text-slate-500">Всего в воронке: {employeeDeals.length}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    ИЗОЛЯЦИЯ КОНТУРА 152-ФЗ
                  </span>
                  <div className="text-3xl font-black text-emerald-700">100% активна</div>
                  <p className="text-xs text-slate-500">Доступ строго по назначению</p>
                </div>
              </div>

              {/* Employee Assigned Lots Desk */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Briefcase className="w-5 h-5 text-emerald-600" />
                      <span>Объекты в вашей непосредственной ответственности ({employeeLots.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Управляйте упаковкой 152-ФЗ, юридическим аудитом (42 пункта) и ежедневным отбором покупателей.
                    </p>
                  </div>
                </div>

                {employeeLots.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    За вашим профилем куратора ({currentEmployeeId}) пока не закреплено активных объектов.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employeeLots.map((lot) => {
                      const lotBidsCount = employeeCandidates.filter(
                        (c) => c.lotCode?.toUpperCase() === lot.lotCode.toUpperCase()
                      ).length;
                      return (
                        <div
                          key={lot.id}
                          className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                #{lot.lotCode}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900 mt-1">
                                {lot.complexName}
                              </h4>
                              <span className="text-xs text-slate-500">
                                {getRegionByCode(lot.city).shortLabelRu}, {lot.district} •{' '}
                                {lot.developer} • {lot.areaM2} м²
                              </span>
                            </div>
                            <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              Кэш: {formatRubles(lot.cashPaidBySeller)}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                            <Link
                              to={`/admin/packaging/${lot.lotCode}`}
                              className="py-2 px-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition-colors shadow-2xs"
                            >
                              📦 Упаковка 152-ФЗ
                            </Link>
                            <Link
                              to={`/admin/legal-audit/${lot.lotCode}`}
                              className="py-2 px-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition-colors shadow-2xs"
                            >
                              ⚖️ Юр. аудит (42)
                            </Link>
                            <Link
                              to={`/admin/matchmaker/${lot.lotCode}`}
                              className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs"
                            >
                              👥 Матчмейкер ({lotBidsCount})
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Direct Inbound Buyer Offers strictly for this Employee's Assigned Lots */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Users className="w-5 h-5 text-sky-600" />
                      <span>
                        Прямые заявки покупателей на ваши объекты ({employeeCandidates.length})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Проверьте банковские справки и подтвердите платежеспособность лучшего кандидата.
                    </p>
                  </div>
                  {employeeLots[0] && (
                    <Link
                      to={`/admin/matchmaker/${employeeLots[0].lotCode}`}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      Открыть двигатель отбора →
                    </Link>
                  )}
                </div>

                {employeeCandidates.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    Пока нет входящих предложений покупателей по закрепленным за вами объектам.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">Код / Кандидат</th>
                          <th className="py-3 px-3">Лот</th>
                          <th className="py-3 px-3">Трек финансирования</th>
                          <th className="py-3 px-3">Ликвидность</th>
                          <th className="py-3 px-3">Статус проверки</th>
                          <th className="py-3 px-3 text-right">Действие</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employeeCandidates.map((cand) => (
                          <tr key={cand.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-slate-900 block">
                                {cand.code}
                              </span>
                              <span className="text-slate-600">{cand.name}</span>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                              #{cand.lotCode}
                            </td>
                            <td className="py-3 px-3">
                              {cand.buyerTrack === 'mortgage_substitution' ? (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                  Кэш + Ипотека
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                  100% Кэш
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">
                              {formatRubles(cand.availableLiquidity)}
                            </td>
                            <td className="py-3 px-3">
                              {cand.isVerifiedByCurator ? (
                                <span className="text-emerald-700 font-bold">✓ Проверен</span>
                              ) : (
                                <span className="text-amber-700 font-semibold">Ожидает проверки</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Link
                                to={`/admin/matchmaker/${cand.lotCode}`}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs"
                              >
                                Открыть в матчмейкере →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          FULL DOSSIER & GOVERNANCE TRIAGE MODALS
      ========================================================================= */}

      {/* 1. Seller Lot Dossier & 3-Way Decision Modal */}
      {modalLot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-bold text-xs">
                  #{modalLot.lotCode}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Досье продавца, облачный сейф и решение Владельца
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalLot(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const sReq = findSellerRequestForLot(modalLot.lotCode);
              const region = getRegionByCode(modalLot.city);
              return (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Регион и район:</span>
                      <strong className="text-slate-900">
                        {region.shortLabelRu}, {modalLot.district}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ЖК / Девелопер:</span>
                      <strong className="text-slate-900">
                        {modalLot.complexName} ({modalLot.developer})
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Площадь / Сдача:</span>
                      <strong className="text-slate-900">
                        {modalLot.areaM2} м² • {modalLot.deliveryDate}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Цена по ДДУ:</span>
                      <strong className="text-slate-900 font-mono">
                        {formatRubles(modalLot.dduContractPrice)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Выплачено продавцом (Кэш):</span>
                      <strong className="text-emerald-700 font-mono">
                        {formatRubles(modalLot.cashPaidBySeller)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Остаток долга застройщику:</span>
                      <strong className="text-slate-800 font-mono">
                        {formatRubles(modalLot.remainingInstallmentDebt)}
                      </strong>
                    </div>
                  </div>

                  {/* 152-FZ Owner Dossier */}
                  <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-amber-900 font-bold">
                        <Lock className="w-4 h-4 text-amber-700" />
                        <span>Персональные данные дольщика (контур Владельца 152-ФЗ):</span>
                      </div>
                      {(sReq?.referredByPartnerCode || modalLot.referredByPartnerCode) && (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                          Реф: {sReq?.referredByPartnerCode || modalLot.referredByPartnerCode}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>
                        ФИО:{' '}
                        <strong>
                          {sReq?.sellerName || modalLot.ownerDossier?.fullNameMasked}
                        </strong>
                      </div>
                      <div>
                        Телефон:{' '}
                        <strong>
                          {sReq?.sellerPhone || modalLot.ownerDossier?.phoneMasked}
                        </strong>
                      </div>
                      <div>
                        ИНН дольщика:{' '}
                        <strong className="font-mono">
                          {sReq?.sellerInn || modalLot.sellerInn || '781432994102'}
                        </strong>
                      </div>
                      <div>
                        Договор ДДУ:{' '}
                        <strong>
                          {sReq?.dduNumber || modalLot.ownerDossier?.dduNumber}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Yandex S3 Cloud Document Vault Trigger */}
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-bold text-indigo-950 flex items-center space-x-1.5">
                        <HardDrive className="w-4 h-4 text-indigo-600" />
                        <span>Облачный сейф документов (Yandex Object Storage S3)</span>
                      </span>
                      <p className="text-[11px] text-indigo-800/80">
                        Просмотр, скачивание и индивидуальное утверждение сканов ДДУ, справок об оплате и СФР.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setVaultConfig({
                          isOpen: true,
                          entityType: 'lot',
                          entityId: modalLot.lotCode,
                          entityTitle: `Досье объекта #${modalLot.lotCode} (${modalLot.complexName})`,
                          mode: 'seller',
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Открыть сейф документов</span>
                    </button>
                  </div>

                  {/* 3-Way Decision Switcher */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setLotActionMode('approve')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          lotActionMode === 'approve'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        1. Одобрить и назначить куратора
                      </button>
                      <button
                        type="button"
                        onClick={() => setLotActionMode('request_docs')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          lotActionMode === 'request_docs'
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        2. Запросить доп. документы
                      </button>
                      <button
                        type="button"
                        onClick={() => setLotActionMode('reject')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          lotActionMode === 'reject'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        3. Отклонить с причиной
                      </button>
                    </div>

                    {lotActionMode === 'approve' && (
                      <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
                        <label className="block font-bold text-slate-800">
                          Выберите ответственного штатного куратора для ведения объекта:
                        </label>
                        <select
                          value={
                            selectedEmployees[modalLot.id] || modalLot.assignedEmployeeId || ''
                          }
                          onChange={(e) =>
                            setSelectedEmployees({
                              ...selectedEmployees,
                              [modalLot.id]: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 font-semibold"
                        >
                          <option value="">Выберите куратора...</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} — {emp.role}
                            </option>
                          ))}
                        </select>
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setModalLot(null)}
                            className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveAndAssignLot(modalLot)}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer"
                          >
                            ✓ Утвердить заявку и закрепить куратора
                          </button>
                        </div>
                      </div>
                    )}

                    {lotActionMode === 'request_docs' && (
                      <form
                        onSubmit={handleRequestSellerDocs}
                        className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3"
                      >
                        <span className="font-bold text-amber-950 block">
                          Отметьте документы для дозагрузки в Личном кабинете продавца:
                        </span>
                        <div className="space-y-1.5">
                          {[
                            'Скан договора ДДУ со штампом Росреестра',
                            'Справка об оплате от застройщика с печатью',
                            'Справка СФР об остатке материнского капитала',
                            'Нотариальное согласие супруги / заявление',
                          ].map((docItem) => (
                            <label
                              key={docItem}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={lotRequestedDocs.includes(docItem)}
                                onChange={() =>
                                  setLotRequestedDocs((prev) =>
                                    prev.includes(docItem)
                                      ? prev.filter((x) => x !== docItem)
                                      : [...prev, docItem]
                                  )
                                }
                                className="w-4 h-4 accent-amber-600 rounded"
                              />
                              <span className="text-slate-800">{docItem}</span>
                            </label>
                          ))}
                        </div>
                        <textarea
                          rows={2}
                          required
                          value={lotDocsNotes}
                          onChange={(e) => setLotDocsNotes(e.target.value)}
                          placeholder="Комментарий для продавца (например: приложите страницу ДДУ с графиком рассрочки)..."
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white focus:outline-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm cursor-pointer"
                          >
                            Направить запрос продавцу
                          </button>
                        </div>
                      </form>
                    )}

                    {lotActionMode === 'reject' && (
                      <form
                        onSubmit={handleRejectSellerLot}
                        className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3"
                      >
                        <label className="block font-bold text-rose-950">
                          Причина отклонения заявки продавца (214-ФЗ / 127-ФЗ) *:
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={lotRejectReason}
                          onChange={(e) => setLotRejectReason(e.target.value)}
                          placeholder="Укажите юридическое или финансовое основание отказа (например: выявлены исполнительные производства ФССП / использован маткапитал без выделения долей)..."
                          className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white focus:outline-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                          >
                            ✕ Подтвердить отклонение заявки
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 2. Partner B2B Dossier & 3-Way Decision Modal */}
      {modalPartner && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Досье партнера B2B: {modalPartner.name}
              </h3>
              <button
                type="button"
                onClick={() => setModalPartner(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePartnerModalDecision} className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div>
                  Организация: <strong>{modalPartner.organization}</strong>
                </div>
                <div>
                  Профиль: <strong>{modalPartner.role}</strong>
                </div>
                {modalPartner.inn && (
                  <div>
                    ИНН организации / ИП: <strong className="font-mono">{modalPartner.inn}</strong>
                  </div>
                )}
                {modalPartner.city && (
                  <div>
                    Регион: <strong>{getRegionByCode(modalPartner.city as any).labelRu}</strong>
                  </div>
                )}
                <div>
                  Телефон: <strong>{modalPartner.phone}</strong>
                </div>
                <div>
                  Реферальный код:{' '}
                  <strong className="font-mono text-purple-700">{modalPartner.referralCode}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setVaultConfig({
                    isOpen: true,
                    entityType: 'partner_application',
                    entityId: modalPartner.clientCode || modalPartner.id,
                    entityTitle: `Документы партнера ${modalPartner.name}`,
                    mode: 'general',
                  })
                }
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <HardDrive className="w-4 h-4 text-indigo-600" />
                <span>Открыть сейф документов партнера (Yandex S3)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPartnerActionMode('approve')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    partnerActionMode === 'approve'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Одобрить
                </button>
                <button
                  type="button"
                  onClick={() => setPartnerActionMode('request_docs')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    partnerActionMode === 'request_docs'
                      ? 'bg-amber-500 text-slate-950 border-amber-500'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Запросить док-ты
                </button>
                <button
                  type="button"
                  onClick={() => setPartnerActionMode('reject')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    partnerActionMode === 'reject'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Отклонить
                </button>
              </div>

              {partnerActionMode !== 'approve' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {partnerActionMode === 'request_docs'
                      ? 'Какие реквизиты или свидетельства ИП/ООО запросить *:'
                      : 'Причина отказа в партнерской аккредитации *:'}
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={partnerActionNote}
                    onChange={(e) => setPartnerActionNote(e.target.value)}
                    placeholder="Введите комментарий комплаенс-службы..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalPartner(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl font-bold text-xs shadow-md cursor-pointer ${
                    partnerActionMode === 'approve'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : partnerActionMode === 'request_docs'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {partnerActionMode === 'approve'
                    ? '✓ Одобрить и активировать кабинет'
                    : partnerActionMode === 'request_docs'
                    ? 'Отправить запрос документов'
                    : 'Подтвердить отказ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VIP Investor 6-Steps Dossier & 3-Way Decision Modal */}
      {modalInvestor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Досье VIP Инвестора (6 шагов верификации)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalInvestor(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvestorModalDecision} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">ФИО / Клиентский код:</span>
                  <strong>
                    {modalInvestor.fullName} ({modalInvestor.clientCode || 'DEX'})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Компания / Фонд:</span>
                  <strong>{modalInvestor.companyOrFund || 'Индивидуальный инвестор'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Локация и контакт:</span>
                  <strong>
                    {modalInvestor.countryAndCity} • {modalInvestor.contactTelegramOrPhone}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Объем капитала и стратегия:</span>
                  <strong className="text-amber-800">
                    {modalInvestor.capitalVolume} • {modalInvestor.strategy}
                  </strong>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block">Целевые регионы РФ:</span>
                  <strong>{modalInvestor.targetRegions?.join(', ')}</strong>
                </div>
                {modalInvestor.customProposal && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block">Индивидуальный мандат:</span>
                    <p className="text-slate-800 mt-0.5">{modalInvestor.customProposal}</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setVaultConfig({
                    isOpen: true,
                    entityType: 'investor_application',
                    entityId: modalInvestor.clientCode || modalInvestor.id,
                    entityTitle: `Подтверждение капитала VIP: ${modalInvestor.fullName}`,
                    mode: 'general',
                  })
                }
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <HardDrive className="w-4 h-4 text-indigo-600" />
                <span>Открыть сейф документов инвестора (Proof of Funds / NDA)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvestorActionMode('approve')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    investorActionMode === 'approve'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Утвердить VIP (48ч)
                </button>
                <button
                  type="button"
                  onClick={() => setInvestorActionMode('request_docs')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    investorActionMode === 'request_docs'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Запросить Proof of Funds
                </button>
                <button
                  type="button"
                  onClick={() => setInvestorActionMode('reject')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    investorActionMode === 'reject'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Отклонить
                </button>
              </div>

              {investorActionMode !== 'approve' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {investorActionMode === 'request_docs'
                      ? 'Комментарий к запросу банковской выписки / NDA *:'
                      : 'Причина отказа во включении в закрытый VIP-пул *:'}
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={investorActionNote}
                    onChange={(e) => setInvestorActionNote(e.target.value)}
                    placeholder="Введите комментарий..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalInvestor(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md cursor-pointer ${
                    investorActionMode === 'approve'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : investorActionMode === 'request_docs'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {investorActionMode === 'approve'
                    ? '✓ Утвердить статус VIP Инвестора'
                    : investorActionMode === 'request_docs'
                    ? 'Запросить подтверждение капитала'
                    : 'Подтвердить отказ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Employee Modal */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Добавить сотрудника / назначить роль</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEmpModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email аккаунта (корпоративный или Google) *:
                </label>
                <input
                  type="email"
                  required
                  placeholder="curator@domexit.ru"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ФИО сотрудника *:</label>
                <input
                  type="text"
                  required
                  placeholder="Алексей Николаевич Смирнов"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Должность / Роль *:</label>
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="Куратор по 214-ФЗ">Куратор по 214-ФЗ (Координатор сделок)</option>
                  <option value="Старший юрист комплаенса">Старший юрист комплаенса (42 проверки)</option>
                  <option value="Кредитный офицер банка">Кредитный офицер банка-партнера</option>
                  <option value="Совладелец (Co-Owner)">Совладелец платформы (Co-Owner)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Телефон РФ *:</label>
                  <input
                    type="tel"
                    required
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telegram:</label>
                  <input
                    type="text"
                    value={newEmpTg}
                    onChange={(e) => setNewEmpTg(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Создать и активировать доступ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Production Cloud Document Vault Modal (Yandex S3 Emulator) */}
      <DocumentVaultModal
        isOpen={vaultConfig.isOpen}
        onClose={() => setVaultConfig((prev) => ({ ...prev, isOpen: false }))}
        entityType={vaultConfig.entityType}
        entityId={vaultConfig.entityId}
        entityTitle={vaultConfig.entityTitle}
        uploadedByUid={user?.id || 'owner-review'}
        clientCode={user?.clientCode || 'DEX-CEO-001'}
        mode={vaultConfig.mode}
        canUpload={true}
        canReview={true}
        reviewerName={operatorName}
      />
    </div>
  );
};
