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
import { DevelopersRepository } from '../dal/repositories/DevelopersRepository';
import { MarketSettingsRepository } from '../dal/repositories/MarketSettingsRepository';
import { CuratorChatRepository } from '../dal/repositories/CuratorChatRepository';
import { CuratorChatWidget } from '../components/chat/CuratorChatWidget';
import { TelegramConnectCard } from '../components/telegram/TelegramConnectCard';
import { DatabaseGateway } from '../dal/DatabaseGateway';

// Modular Dashboard Subcomponents
import { AdminGovernanceCard } from '../components/admin/AdminGovernanceCard';
import { AdminSlimStatusBar } from '../components/admin/dashboard/AdminSlimStatusBar';
import { AdminTabBar, OwnerTab } from '../components/admin/dashboard/AdminTabBar';
import { DashboardOverviewTab } from '../components/admin/dashboard/DashboardOverviewTab';
import { SellerRequestsTableTab } from '../components/admin/dashboard/SellerRequestsTableTab';
import { MarketSettingsTab } from '../components/admin/dashboard/MarketSettingsTab';
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
  MarketSettings,
  UserProfile,
  DeveloperAccreditationRequest,
  AccreditedDeveloper,
  DocumentMetadata,
} from '../types';
import { CheckCircle2, Crown, Briefcase, AlertCircle, Server, Shield, Scale } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user, switchRole } = useAuth();

  const [kpis, setKpis] = useState<KPIStats | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [sellerRequests, setSellerRequests] = useState<SellerExitRequest[]>([]);
  const [employeeDeals, setEmployeeDeals] = useState<DealTrack[]>([]);
  const [allDeals, setAllDeals] = useState<DealTrack[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [candidates, setCandidates] = useState<BuyerCandidate[]>([]);
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [developerRequests, setDeveloperRequests] = useState<DeveloperAccreditationRequest[]>([]);
  const [developersList, setDevelopersList] = useState<AccreditedDeveloper[]>([]);
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
  const [activeSystemSubTab, setActiveSystemSubTab] = useState<'infra' | 'security' | 'legal'>('infra');

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
        mSettings,
        allUsers,
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
        MarketSettingsRepository.getSettings(),
        UsersRepository.getAll(),
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
      setMarketSettings(mSettings);
      setUsersList(allUsers);
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
              ? 'Генеральный обзор платформы: верификация новых продавцов и партнеров, назначение кураторов и учет комиссии 2.5%'
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
          {/* Executive Slim Status Bar (Single Row, ~52px, Light Emerald System) */}
          {isOwner && (
            <AdminSlimStatusBar
              onNavigateToSystem={() => setActiveOwnerTab('system_cms')}
              className="mb-4"
            />
          )}

          {/* =========================================================================
              OWNER MODE: Full platform financial view & Triage Desk
          ========================================================================= */}
          {isOwner && (
            <>
              {/* Executive Tab Navigation Bar (5 tabs, zero horizontal clipping) */}
              <AdminTabBar
                activeOwnerTab={activeOwnerTab}
                setActiveOwnerTab={setActiveOwnerTab}
                pendingSellerCount={pendingSellerCount}
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
                  developerRequests={developerRequests}
                  pendingDevReqCount={pendingDevReqCount}
                  developersList={developersList}
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

              {/* TAB 3: Рынок и ставки */}
              {activeOwnerTab === 'market' && (
                <MarketSettingsTab
                  marketSettings={marketSettings}
                  operatorName={operatorName}
                  loadAllData={loadAllData}
                  showToast={showToast}
                  showError={showError}
                />
              )}

              {/* TAB 4: Штат и RBAC */}
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

              {/* TAB 5: Система, Telegram и CMS (26 актов) */}
              {activeOwnerTab === 'system_cms' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Sub-tab Navigation Bar */}
                  <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveSystemSubTab('infra')}
                      className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeSystemSubTab === 'infra'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <Server className="w-4 h-4 text-sky-600" />
                      <span>5.1 Инфраструктура и Бэкап</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSystemSubTab('security')}
                      className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeSystemSubTab === 'security'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <Shield className="w-4 h-4 text-rose-600" />
                      <span>5.2 Кибербезопасность и 152-ФЗ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSystemSubTab('legal')}
                      className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeSystemSubTab === 'legal'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <Scale className="w-4 h-4 text-indigo-600" />
                      <span>5.3 Правовой CMS и Реквизиты</span>
                    </button>
                  </div>

                  {/* Sub-tab 5.1: Инфраструктура и Бэкап */}
                  {activeSystemSubTab === 'infra' && (
                    <div className="space-y-6">
                      <AdminGovernanceCard viewSection="infra_backups" showToast={showToast} />
                      <TelegramConnectCard />
                    </div>
                  )}

                  {/* Sub-tab 5.2: Кибербезопасность и 152-ФЗ */}
                  {activeSystemSubTab === 'security' && (
                    <div className="space-y-6">
                      <AdminGovernanceCard viewSection="security_waf" showToast={showToast} />
                      <LegalAndChannelsTab
                        section="pdn_incidents"
                        operatorName={operatorName}
                        showToast={showToast}
                        showError={showError}
                      />
                    </div>
                  )}

                  {/* Sub-tab 5.3: Правовой CMS и Реквизиты */}
                  {activeSystemSubTab === 'legal' && (
                    <div className="space-y-6">
                      <LegalAndChannelsTab
                        section="legal_requisites"
                        operatorName={operatorName}
                        showToast={showToast}
                        showError={showError}
                      />
                      <Suspense
                        fallback={
                          <div className="p-8 text-center text-slate-500 font-bold bg-white rounded-3xl border border-slate-200">
                            Загрузка Правового CMS (26 актов)...
                          </div>
                        }
                      >
                        <LegalCmsManager />
                      </Suspense>
                    </div>
                  )}
                </div>
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
