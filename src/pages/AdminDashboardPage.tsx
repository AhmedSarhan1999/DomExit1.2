import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
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
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { DevelopersRepository } from '../dal/repositories/DevelopersRepository';
import { MarketSettingsRepository } from '../dal/repositories/MarketSettingsRepository';
import { CuratorChatRepository } from '../dal/repositories/CuratorChatRepository';
import { CuratorChatWidget } from '../components/chat/CuratorChatWidget';
import { TelegramConnectCard } from '../components/telegram/TelegramConnectCard';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { useFeatureFlagsStore } from '../stores/useFeatureFlagsStore';

// Modular Dashboard Subcomponents
import { AdminFeatureFlagsCard } from '../components/admin/dashboard/AdminFeatureFlagsCard';
import { AdminGovernanceCard } from '../components/admin/AdminGovernanceCard';
import { AdminTabBar, OwnerTab } from '../components/admin/dashboard/AdminTabBar';
import { DashboardOverviewTab } from '../components/admin/dashboard/DashboardOverviewTab';
import { SellerRequestsTableTab } from '../components/admin/dashboard/SellerRequestsTableTab';
import { MarketSettingsTab } from '../components/admin/dashboard/MarketSettingsTab';
import { PartnerBanksTab } from '../components/admin/dashboard/PartnerBanksTab';
import { UsersRbacTab } from '../components/admin/dashboard/UsersRbacTab';
import { LegalAndChannelsTab } from '../components/admin/dashboard/LegalAndChannelsTab';
import { CuratorEmployeeView } from '../components/admin/dashboard/CuratorEmployeeView';

const LegalCmsManager = React.lazy(() =>
  import('../components/admin/LegalCmsManager').then((m) => ({ default: m.LegalCmsManager }))
);

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
  UserProfile,
  PartnerBankEntity,
  DeveloperAccreditationRequest,
  AccreditedDeveloper,
  DocumentMetadata,
} from '../types';
import { CheckCircle2, Crown, Briefcase, AlertCircle } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user, switchRole } = useAuth();
  const { enableVipClub } = useFeatureFlagsStore();

  const [kpis, setKpis] = useState<KPIStats | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [sellerRequests, setSellerRequests] = useState<SellerExitRequest[]>([]);
  const [employeeDeals, setEmployeeDeals] = useState<DealTrack[]>([]);
  const [allDeals, setAllDeals] = useState<DealTrack[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [candidates, setCandidates] = useState<BuyerCandidate[]>([]);
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [investors, setInvestors] = useState<InvestorApplication[]>([]);
  const [developerRequests, setDeveloperRequests] = useState<DeveloperAccreditationRequest[]>([]);
  const [developersList, setDevelopersList] = useState<AccreditedDeveloper[]>([]);
  const [partnerBanks, setPartnerBanks] = useState<PartnerBankEntity[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

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

  // Navigation Tabs State
  const [activeOwnerTab, setActiveOwnerTab] = useState<OwnerTab>('overview');

  // Curator dialogs & Chat modal State
  const [curatorDialogs, setCuratorDialogs] = useState<
    Array<{
      lotCode: string;
      dealId?: string;
      senderName: string;
      senderRole: string;
      lastMessage: any;
      unreadCount: number;
    }>
  >([]);
  const [activeCuratorChatLot, setActiveCuratorChatLot] = useState<string | null>(null);

  // Modal inspection state for lots
  const [modalLot, setModalLot] = useState<Lot | null>(null);

  // Cloud Document Vault Modal State
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

  const operatorName = user?.name || user?.email || 'Ahmed Abdallah (CEO)';
  const isOwner = user?.role === 'owner' || user?.activeRole === 'owner';
  const isEmployee = user?.role === 'employee' || user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || user?.id || '';

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // Data Loading
  const loadAllData = async () => {
    try {
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
        pBanks,
        allDealsData,
        devReqsData,
        allDevsData,
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
        BankPortalRepository.getAllPartnerBanks(),
        DealsRepository.getAll(),
        DevelopersRepository.getAllAccreditationRequests(),
        DevelopersRepository.getAllDevelopers(),
      ]);

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

      const seenLotCodes = new Set<string>();
      const deduplicatedLots = sortedLots.filter((l) => {
        const code = (l.lotCode || l.id || '').toUpperCase();
        if (!code || seenLotCodes.has(code)) return false;
        seenLotCodes.add(code);
        return true;
      });

      setKpis(kpiData);
      setLots(deduplicatedLots);
      setSellerRequests(sellerReqs);
      setEmployees(empData);
      setCandidates(candData);
      setPartners(partData);
      setInvestors(invData);
      setMarketSettings(mSettings);
      setUsersList(allUsers);
      setPartnerBanks(pBanks);
      setAllDeals(allDealsData);
      setDeveloperRequests(devReqsData);
      setDevelopersList(allDevsData);

      if (isEmployee) {
        const myDeals = allDealsData.filter((d) => d.assignedEmployeeId === currentEmployeeId);
        setEmployeeDeals(myDeals);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
    const unsub = DatabaseGateway.subscribe(() => {
      loadAllData();
    });
    return unsub;
  }, [user?.activeRole, currentEmployeeId]);

  useEffect(() => {
    async function fetchDialogs() {
      const d = await CuratorChatRepository.getRecentDialogs(
        isOwner ? undefined : user?.assignedEmployeeId || user?.id,
        isOwner
      );
      setCuratorDialogs(d);
    }
    fetchDialogs();
    const unsub = CuratorChatRepository.subscribe(() => {
      fetchDialogs();
    });
    return unsub;
  }, [user, isOwner]);

  // Isolated employee collections
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
  const pendingDevReqCount = developerRequests.filter((r) => r.status === 'pending').length;

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
              : `Куратор: ${operatorName} | Конфиденциальный контур: только закрепленные лоты и заявки покупателей`
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
          {/* Master Feature Flags Management (Owner Exclusive) */}
          {isOwner && <AdminFeatureFlagsCard showToast={showToast} />}

          {/* Master Governance, Security & Backup Management (Owner Exclusive) */}
          {isOwner && <AdminGovernanceCard showToast={showToast} className="mb-6" />}

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
                    ? 'Доступны: глобальная комиссия 2.5%, верификация документов, одобрение продавцов/партнеров/VIP-инвесторов.'
                    : 'Финансовые показатели платформы и чужие сделки скрыты. Доступны только назначенные вам объекты.'}
                </span>
              </div>
            </div>
          </div>

          {/* Telegram OS Connect Card for Staff & Owner */}
          <TelegramConnectCard className="mb-6 shadow-sm" />

          {/* =========================================================================
              OWNER MODE: Full platform financial view & Triage Desk
          ========================================================================= */}
          {isOwner && (
            <>
              {/* Executive 7-Tab Navigation Bar */}
              <AdminTabBar
                activeOwnerTab={activeOwnerTab}
                setActiveOwnerTab={setActiveOwnerTab}
                pendingSellerCount={pendingSellerCount}
                partnerBanksCount={partnerBanks.length}
                usersAndStaffCount={employees.length + usersList.length}
              />

              {/* TAB 1: Сводка и метрики */}
              {activeOwnerTab === 'overview' && (
                <DashboardOverviewTab
                  kpis={kpis}
                  sellerRequests={sellerRequests}
                  pendingSellerCount={pendingSellerCount}
                  lots={lots}
                  allDeals={allDeals}
                  curatorDialogs={curatorDialogs}
                  onNavigateToSellers={() => setActiveOwnerTab('sellers')}
                  onInspectLot={(lot) => {
                    setModalLot(lot);
                    setActiveOwnerTab('sellers');
                  }}
                  onOpenCuratorChat={(lotCode) => setActiveCuratorChatLot(lotCode)}
                />
              )}

              {/* TAB 2: Заявки продавцов & Управление застройщиками */}
              {activeOwnerTab === 'sellers' && (
                <SellerRequestsTableTab
                  lots={lots}
                  sellerRequests={sellerRequests}
                  pendingSellerCount={pendingSellerCount}
                  employees={employees}
                  partners={partners}
                  pendingPartnerCount={pendingPartnerCount}
                  investors={investors}
                  pendingInvestorCount={pendingInvestorCount}
                  developerRequests={developerRequests}
                  pendingDevReqCount={pendingDevReqCount}
                  developersList={developersList}
                  enableVipClub={enableVipClub}
                  isOwner={isOwner}
                  operatorName={operatorName}
                  loadAllData={loadAllData}
                  showToast={showToast}
                  showError={showError}
                  onOpenDocumentVault={setVaultConfig}
                  modalLotExternal={modalLot}
                  onCloseExternalModalLot={() => setModalLot(null)}
                />
              )}

              {/* TAB 3: Рыночные ставки и калькулятор локаций */}
              {activeOwnerTab === 'market' && (
                <MarketSettingsTab
                  marketSettings={marketSettings}
                  operatorName={operatorName}
                  loadAllData={loadAllData}
                  showToast={showToast}
                  showError={showError}
                />
              )}

              {/* TAB 4: Банки-партнеры */}
              {activeOwnerTab === 'banks' && (
                <PartnerBanksTab
                  partnerBanks={partnerBanks}
                  setPartnerBanks={setPartnerBanks}
                  operatorName={operatorName}
                  formatRubles={formatRubles}
                  showToast={showToast}
                  showError={showError}
                />
              )}

              {/* TAB 5: Пользователи, штат и RBAC */}
              {activeOwnerTab === 'users_rbac' && (
                <UsersRbacTab
                  usersList={usersList}
                  employees={employees}
                  lots={lots}
                  operatorName={operatorName}
                  loadAllData={loadAllData}
                  switchRole={switchRole}
                  showToast={showToast}
                  showError={showError}
                />
              )}

              {/* TAB 6: Профиль компании, соцсети и ИБ */}
              {activeOwnerTab === 'company_profile' && (
                <LegalAndChannelsTab
                  operatorName={operatorName}
                  showToast={showToast}
                  showError={showError}
                />
              )}

              {/* TAB 7: Правовой CMS и Реестр (26 актов) */}
              {activeOwnerTab === 'legal_cms' && (
                <Suspense
                  fallback={
                    <div className="p-8 text-center text-slate-500 font-bold">
                      Загрузка Правового CMS...
                    </div>
                  }
                >
                  <LegalCmsManager />
                </Suspense>
              )}
            </>
          )}

          {/* =========================================================================
              EMPLOYEE MODE: Data Isolation (Only Assigned Lots & Inbound Bids)
          ========================================================================= */}
          {!isOwner && (
            <CuratorEmployeeView
              currentEmployeeId={currentEmployeeId}
              employeeLots={employeeLots}
              employeeCandidates={employeeCandidates}
              employeeEscrowCount={employeeEscrowCount}
              employeeDeals={employeeDeals}
              formatRubles={formatRubles}
            />
          )}
        </div>
      </div>

      {/* Cloud Document Vault Modal */}
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

      {/* Curator Chat Widget Modal */}
      {activeCuratorChatLot && (
        <CuratorChatWidget
          lotCode={activeCuratorChatLot}
          isOpen={true}
          onClose={() => setActiveCuratorChatLot(null)}
          curatorName={operatorName}
          curatorRole="Куратор платформы DomExit"
        />
      )}
    </div>
  );
};
