import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { formatRussianPhoneInput } from '../utils/validators';
import { getRegionByCode, getDistrictsForRegion, RUSSIAN_REGIONS } from '../data/russianGeography';
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
import {
  MarketSettingsRepository,
} from '../dal/repositories/MarketSettingsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { SecurityIncidentsRepository } from '../dal/repositories/SecurityIncidentsRepository';
import { LegalPoliciesRepository, CANONICAL_POLICY_NAMES, INITIAL_POLICY_TEXTS } from '../dal/repositories/LegalPoliciesRepository';
import { computeSha256 } from '../utils/crypto';
import { useEnvironmentStore } from '../stores/useEnvironmentStore';
import { useFeatureFlagsStore } from '../stores/useFeatureFlagsStore';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { useCompanyProfileStore } from '../stores/useCompanyProfileStore';
import { usePublicChannelsStore } from '../stores/usePublicChannelsStore';
import { maskSensitiveData } from '../utils/dataMasking';
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
  PartnerBankEntity,
  RussianCityCode,
  SecurityIncidentRecord,
  CompanyLegalProfile,
  PublicChannelsConfig,
  LegalPolicyType,
  LegalPolicyVersion,
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
  Sparkles,
  UserPlus,
  Save,
  X,
  Lock,
  HardDrive,
  AlertCircle,
  Landmark,
  Building2,
  Plus,
  ExternalLink,
  Loader2,
  Edit,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Send,
  MessageCircle,
  Globe,
  Bot,
  Share2,
  BarChart3,
  Phone,
  Mail,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { withAsyncTimeout, ASYNC_NETWORK_TIMEOUT_MESSAGE } from '../utils/asyncGuard';

export const AdminDashboardPage: React.FC = () => {
  const { user, switchRole } = useAuth();
  const { currentEnv, isProduction, toggleEnvironment } = useEnvironmentStore();
  const { enableVipClub, enableBankPortal, toggleFlag } = useFeatureFlagsStore();
  const canSwitchEnvironment =
    user?.email === 'amaas9499@gmail.com' || user?.activeRole === 'owner';

  const handleToggleEnvironment = () => {
    const nextIsProd = !isProduction;
    toggleEnvironment();
    showToast(
      nextIsProd
        ? 'Активирован Боевой режим (Production) — чистая промышленная база'
        : 'Активирован Режим песочницы (Sandbox) — демонстрационные данные'
    );
  };

  const [kpis, setKpis] = useState<KPIStats | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [sellerRequests, setSellerRequests] = useState<SellerExitRequest[]>([]);
  const [employeeDeals, setEmployeeDeals] = useState<DealTrack[]>([]);
  const [allDeals, setAllDeals] = useState<DealTrack[]>([]);
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

  // District Yield & Capital Growth Engine State (Task 1: Two-Tier Location Selector)
  const [selectedYieldCity, setSelectedYieldCity] = useState<RussianCityCode>('spb');
  const [selectedYieldDistrict, setSelectedYieldDistrict] = useState<string>('Приморский район');
  const [districtDailyRentPct, setDistrictDailyRentPct] = useState<number>(0.05);
  const [districtMonthlyRentPct, setDistrictMonthlyRentPct] = useState<number>(0.65);
  const [districtAnnualGrowthPct, setDistrictAnnualGrowthPct] = useState<number>(11.5);
  const [isSavingDistrictYield, setIsSavingDistrictYield] = useState<boolean>(false);

  // Partner Banks Management State (Task 7)
  const [partnerBanks, setPartnerBanks] = useState<PartnerBankEntity[]>([]);
  const [showAddBankModal, setShowAddBankModal] = useState<boolean>(false);
  const [newBankName, setNewBankName] = useState<string>('');
  const [newBankAdminEmail, setNewBankAdminEmail] = useState<string>('');
  const [newBankContactPhone, setNewBankContactPhone] = useState<string>('+7 (800) ');
  const [newBankContactPerson, setNewBankContactPerson] = useState<string>('');
  const [newBankTempPassword, setNewBankTempPassword] = useState<string>('DomExit2026!');
  const [newBankLogoUrl, setNewBankLogoUrl] = useState<string>('');
  const [isSavingBank, setIsSavingBank] = useState<boolean>(false);

  // Edit & Delete Bank States
  const [showEditBankModal, setShowEditBankModal] = useState<boolean>(false);
  const [editingBank, setEditingBank] = useState<PartnerBankEntity | null>(null);
  const [editBankName, setEditBankName] = useState<string>('');
  const [editBankAdminEmail, setEditBankAdminEmail] = useState<string>('');
  const [editBankLogoUrl, setEditBankLogoUrl] = useState<string>('');
  const [editBankContactPhone, setEditBankContactPhone] = useState<string>('');
  const [editBankContactPerson, setEditBankContactPerson] = useState<string>('');
  const [isUpdatingBank, setIsUpdatingBank] = useState<boolean>(false);

  const [showDeleteBankModal, setShowDeleteBankModal] = useState<boolean>(false);
  const [deletingBank, setDeletingBank] = useState<PartnerBankEntity | null>(null);
  const [isDeletingBank, setIsDeletingBank] = useState<boolean>(false);

  // Company Legal Profile & 152-FZ / 38-FZ Compliance State
  const {
    profile: globalLegalProfile,
    updateProfile: updateGlobalLegalProfile,
    isLoading: isLegalProfileLoading,
  } = useCompanyProfileStore();
  const [legalForm, setLegalForm] = useState<CompanyLegalProfile>(globalLegalProfile);
  const [isSavingLegalForm, setIsSavingLegalForm] = useState<boolean>(false);
  const [legalSaveSuccess, setLegalSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (globalLegalProfile) {
      setLegalForm(globalLegalProfile);
    }
  }, [globalLegalProfile]);

  // Roskomnadzor 24h Incident Protocol State (ч. 3.1 ст. 21 № 152-ФЗ)
  const [incidents, setIncidents] = useState<SecurityIncidentRecord[]>([]);
  const [showAddIncidentModal, setShowAddIncidentModal] = useState<boolean>(false);
  const [newIncidentTitle, setNewIncidentTitle] = useState<string>('');
  const [newIncidentDesc, setNewIncidentDesc] = useState<string>('');
  const [newIncidentSeverity, setNewIncidentSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [newIncidentRecordsCount, setNewIncidentRecordsCount] = useState<number>(10);
  const [isReportingIncident, setIsReportingIncident] = useState<boolean>(false);
  const [selectedIncidentDraft, setSelectedIncidentDraft] = useState<SecurityIncidentRecord | null>(null);

  // AI Data Masking Interactive Tester
  const [maskingInput, setMaskingInput] = useState<string>(
    'Покупатель Иванов Иван Иванович, тел: +7 (921) 123-45-67, email: ivan.ivanov@mail.ru, паспорт РФ 4012 № 345678, ДДУ № 78-СБ-12/2024.'
  );

  // Executive Tabbed Architecture State (Section 4)
  type OwnerTab = 'overview' | 'sellers' | 'market' | 'banks' | 'legal';
  const [activeOwnerTab, setActiveOwnerTab] = useState<OwnerTab>('overview');

  // Policy Versioning & SHA-256 Cryptographic Registry State (152-FZ)
  const [legalVersions, setLegalVersions] = useState<LegalPolicyVersion[]>([]);
  const [selectedNewPolicyType, setSelectedNewPolicyType] = useState<LegalPolicyType>('privacy');
  const [newPolicyVersionNumber, setNewPolicyVersionNumber] = useState<string>('2.2');
  const [newPolicyChangeType, setNewPolicyChangeType] = useState<'minor' | 'material'>('material');
  const [newPolicyChangeSummary, setNewPolicyChangeSummary] = useState<string>('Актуализация формулировок в связи с новыми требованиями Роскомнадзора 2026 г.');
  const [newPolicyText, setNewPolicyText] = useState<string>(INITIAL_POLICY_TEXTS.privacy || '');
  const [computedNewPolicySha, setComputedNewPolicySha] = useState<string>('');
  const [isPublishingPolicy, setIsPublishingPolicy] = useState<boolean>(false);
  const [policyPublishSuccess, setPolicyPublishSuccess] = useState<boolean>(false);

  // Live recalculate SHA-256 when text changes
  useEffect(() => {
    let active = true;
    computeSha256(newPolicyText).then((hash) => {
      if (active) setComputedNewPolicySha(hash);
    });
    return () => { active = false; };
  }, [newPolicyText]);

  // When policy type dropdown changes, prefill with existing text
  const handleSelectPolicyTypeForNewVersion = (pType: LegalPolicyType) => {
    setSelectedNewPolicyType(pType);
    const existing = legalVersions.filter((v) => v.policyType === pType && v.isCurrent)[0];
    if (existing) {
      setNewPolicyText(existing.fullText);
      const parts = existing.versionNumber.split('.');
      if (parts.length === 2) {
        setNewPolicyVersionNumber(`${parts[0]}.${Number(parts[1]) + 1}`);
      }
    } else {
      setNewPolicyText(INITIAL_POLICY_TEXTS[pType] || '');
      setNewPolicyVersionNumber('2.2');
    }
  };

  const handlePublishNewPolicyVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyText.trim()) return;
    setIsPublishingPolicy(true);
    try {
      await withAsyncTimeout(
        (async () => {
          const published = await LegalPoliciesRepository.publishNewVersion({
            policyType: selectedNewPolicyType,
            versionNumber: newPolicyVersionNumber,
            changeType: newPolicyChangeType,
            changeSummary: newPolicyChangeSummary,
            fullText: newPolicyText,
            createdBy: operatorName,
          });

          await AuditLogsRepository.addLog({
            operatorName,
            operatorRole: 'owner',
            actionType: 'company_profile_updated',
            title: `Опубликована новая редакция: ${published.policyNameRu} v${published.versionNumber}`,
            description: `Тип изменений: ${published.changeType === 'material' ? 'Существенные (требуется повторное согласие)' : 'Минорные'}. SHA-256: ${published.sha256Hash}`,
          });

          const refreshed = await LegalPoliciesRepository.getAllVersions();
          setLegalVersions(refreshed);
          setPolicyPublishSuccess(true);
          showToast(`Редакция v${published.versionNumber} успешно опубликована с хэшем SHA-256!`);
          setTimeout(() => setPolicyPublishSuccess(false), 4000);
        })(),
        15000
      );
    } catch (err: any) {
      showError(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsPublishingPolicy(false);
    }
  };

    // Social Channels & Public Links Hub State (Section 2)
  const {
    channels: globalChannels,
    updateChannels: updateGlobalChannels,
    isLoading: isChannelsLoading,
  } = usePublicChannelsStore();
  const [channelsForm, setChannelsForm] = useState<PublicChannelsConfig>(globalChannels);
  const [isSavingChannels, setIsSavingChannels] = useState<boolean>(false);
  const [channelsSaveSuccess, setChannelsSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (globalChannels) {
      setChannelsForm(globalChannels);
    }
  }, [globalChannels]);

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

  // Edit Employee Modal
  const [showEditEmpModal, setShowEditEmpModal] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editEmpName, setEditEmpName] = useState<string>('');
  const [editEmpEmail, setEditEmpEmail] = useState<string>('');
  const [editEmpRole, setEditEmpRole] = useState<string>('');
  const [editEmpPhone, setEditEmpPhone] = useState<string>('');
  const [editEmpTg, setEditEmpTg] = useState<string>('');
  const [editEmpPerms, setEditEmpPerms] = useState<('legal_audit' | 'packaging' | 'matchmaker' | 'closing')[]>([
    'legal_audit',
    'packaging',
    'matchmaker',
    'closing',
  ]);
  const [isSubmittingEmp, setIsSubmittingEmp] = useState<boolean>(false);

  // Users & Staff management states
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [staffTab, setStaffTab] = useState<'users' | 'employees'>('users');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const isEmployee = Boolean(user && user.activeRole === 'employee');
  const isOwner = Boolean(
    user &&
      (user.activeRole === 'owner' ||
        user.activeRole === 'admin' ||
        user.role === 'owner' ||
        user.role === 'admin' ||
        user.email === 'amaas9499@gmail.com')
  );
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';
  const operatorName =
    user?.name || (isOwner ? 'Ahmed Abdallah (Владелец / CEO)' : 'Алексей Смирнов (Куратор)');

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
      pBanks,
      incData,
      allDealsData,
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
      SecurityIncidentsRepository.getAll(),
      DealsRepository.getAll(),
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
    setPartnerBanks(pBanks);
    setIncidents(incData);
    setAllDeals(allDealsData);
  };

  useEffect(() => {
    loadAllData();
    const unsub = DatabaseGateway.subscribe(() => {
      loadAllData();
    });
    return unsub;
  }, [user?.activeRole, currentEmployeeId, currentEnv]);

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

  // Handle saving company legal requisites
  const handleSaveLegalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLegalForm(true);
    setLegalSaveSuccess(false);
    try {
      await withAsyncTimeout(
        (async () => {
          await updateGlobalLegalProfile(legalForm);
          await AuditLogsRepository.addLog({
            operatorName,
            operatorRole: 'owner',
            actionType: 'company_profile_updated',
            title: 'Обновлены официальные реквизиты компании (152-ФЗ / 38-ФЗ)',
            description: `Обновлены реквизиты ООО «ДОМЭКЗИТ» (ИНН ${legalForm.inn}, КПП ${legalForm.kpp}, ОГРН ${legalForm.ogrn}). Изменения применены ко всем 5 юридическим документам и футеру.`,
          });
          setLegalSaveSuccess(true);
          showToast('Официальные юридические реквизиты компании сохранены и синхронизированы!');
          setTimeout(() => setLegalSaveSuccess(false), 4000);
        })(),
        15000
      );
    } catch (err: any) {
      showError(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSavingLegalForm(false);
    }
  };

  // Handle saving public social channels & platform contacts (Section 2)
  const handleSaveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingChannels(true);
    setChannelsSaveSuccess(false);
    try {
      await withAsyncTimeout(
        (async () => {
          await updateGlobalChannels(channelsForm);
          await AuditLogsRepository.addLog({
            operatorName,
            operatorRole: 'owner',
            actionType: 'company_profile_updated',
            title: 'Обновлены официальные каналы связи и социальные сети платформы',
            description: `Telegram: ${channelsForm.telegramChannelUrl}, Бот: ${channelsForm.telegramBotUrl}, MAX: ${channelsForm.maxProfileUrl}, Горячая линия: ${channelsForm.hotlinePhone}.`,
          });
          setChannelsSaveSuccess(true);
          showToast('Каналы связи и ссылки соцсетей сохранены и обновлены на всем сайте!');
          setTimeout(() => setChannelsSaveSuccess(false), 4000);
        })(),
        15000
      );
    } catch (err: any) {
      showError(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSavingChannels(false);
    }
  };

  // Handle registering new security incident (Roskomnadzor 24h)
  const handleReportSecurityIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidentTitle.trim() || !newIncidentDesc.trim()) {
      showError('Укажите название и подробное описание инцидента безопасности.');
      return;
    }
    setIsReportingIncident(true);
    try {
      await withAsyncTimeout(
        (async () => {
          const inc = await SecurityIncidentsRepository.reportIncident({
            title: newIncidentTitle.trim(),
            description: newIncidentDesc.trim(),
            severity: newIncidentSeverity,
            affectedRecordsCount: Number(newIncidentRecordsCount),
            companyInn: legalForm.inn,
            companyName: legalForm.shortName,
          });
          const allInc = await SecurityIncidentsRepository.getAll();
          setIncidents(allInc);
          setShowAddIncidentModal(false);
          setNewIncidentTitle('');
          setNewIncidentDesc('');
          setSelectedIncidentDraft(inc);
          showToast(`Инцидент зафиксирован! Сформирован проект уведомления в Роскомнадзор (Срок: 24ч).`);
        })(),
        15000
      );
    } catch (err: any) {
      showError(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsReportingIncident(false);
    }
  };

  const handleUpdateIncidentStatus = async (
    inc: SecurityIncidentRecord,
    newStatus: 'investigating' | 'notified_rkn' | 'resolved'
  ) => {
    const updated: SecurityIncidentRecord = {
      ...inc,
      status: newStatus,
      reportedToRoskomnadzor: newStatus === 'notified_rkn' || newStatus === 'resolved' ? true : inc.reportedToRoskomnadzor,
      roskomnadzorNotificationDate:
        newStatus === 'notified_rkn' && !inc.roskomnadzorNotificationDate
          ? new Date().toISOString()
          : inc.roskomnadzorNotificationDate,
      resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : inc.resolvedAt,
    };
    await SecurityIncidentsRepository.updateIncident(updated);
    const allInc = await SecurityIncidentsRepository.getAll();
    setIncidents(allInc);
    showToast(`Статус инцидента «${inc.title}» обновлен: ${newStatus === 'notified_rkn' ? 'Уведомление в РКН отправлено' : newStatus === 'resolved' ? 'Инцидент закрыт' : 'На расследовании'}`);
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
    try {
      setIsSubmittingEmp(true);
      await withAsyncTimeout(EmployeesRepository.toggleStatus(empId), 15000);
      showToast('Статус доступа сотрудника обновлен.');
      await loadAllData();
    } catch (err) {
      console.error('Toggle employee status error:', err);
      showError(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingEmp(false);
    }
  };

  // Delete employee (Full Staff CRUD)
  const handleDeleteEmp = async (emp: Employee) => {
    if (
      !window.confirm(
        `Вы уверены, что хотите удалить сотрудника «${emp.name}» (${emp.email})? Это действие необратимо и удалит профиль сотрудника.`
      )
    ) {
      return;
    }
    try {
      setIsSubmittingEmp(true);
      await withAsyncTimeout(EmployeesRepository.delete(emp.id), 15000);
      await AuditLogsRepository.addLog({
        operatorName,
        operatorRole: 'owner',
        actionType: 'employee_created_modified',
        title: `Удален сотрудник: ${emp.name}`,
        description: `Сотрудник ${emp.name} (${emp.email}) удален из системы.`,
      });
      showToast(`Сотрудник «${emp.name}» успешно удален.`);
      await loadAllData();
    } catch (err) {
      console.error('Delete employee error:', err);
      showError(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingEmp(false);
    }
  };

  // Edit employee details (Full Staff CRUD)
  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !editEmpName.trim() || !editEmpEmail.trim()) return;

    try {
      setIsSubmittingEmp(true);
      await withAsyncTimeout(
        EmployeesRepository.update({
          ...editingEmp,
          name: editEmpName.trim(),
          email: editEmpEmail.trim(),
          role: editEmpRole,
          phone: editEmpPhone.trim(),
          telegram: editEmpTg.trim(),
          permissions: editEmpPerms,
        }),
        15000
      );

      await AuditLogsRepository.addLog({
        operatorName,
        operatorRole: 'owner',
        actionType: 'employee_created_modified',
        title: `Обновлены данные сотрудника: ${editEmpName}`,
        description: `Email: ${editEmpEmail}, Должность: ${editEmpRole}. Права обновлены.`,
      });

      setShowEditEmpModal(false);
      setEditingEmp(null);
      showToast(`Данные сотрудника «${editEmpName}» успешно сохранены.`);
      await loadAllData();
    } catch (err) {
      console.error('Edit employee error:', err);
      showError(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingEmp(false);
    }
  };

  const handleOpenEditBank = (bank: PartnerBankEntity) => {
    setEditingBank(bank);
    setEditBankName(bank.name);
    setEditBankAdminEmail(bank.masterAdminEmail);
    setEditBankLogoUrl(bank.logoUrl || '');
    setEditBankContactPhone(bank.contactPhone || '');
    setEditBankContactPerson(bank.contactPerson || '');
    setShowEditBankModal(true);
  };

  const handleSaveEditBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank || !editBankName.trim() || !editBankAdminEmail.trim()) return;
    try {
      setIsUpdatingBank(true);
      await BankPortalRepository.updatePartnerBank(
        editingBank.id,
        {
          name: editBankName.trim(),
          masterAdminEmail: editBankAdminEmail.trim(),
          logoUrl: editBankLogoUrl.trim() || undefined,
          contactPhone: editBankContactPhone.trim(),
          contactPerson: editBankContactPerson.trim(),
        },
        operatorName
      );
      const updatedBanks = await BankPortalRepository.getAllPartnerBanks();
      setPartnerBanks(updatedBanks);
      setShowEditBankModal(false);
      setEditingBank(null);
      showToast(`Параметры банка «${editBankName}» успешно обновлены!`);
    } catch {
      showError('Ошибка при обновлении параметров банка.');
    } finally {
      setIsUpdatingBank(false);
    }
  };

  const handleOpenDeleteBank = (bank: PartnerBankEntity) => {
    setDeletingBank(bank);
    setShowDeleteBankModal(true);
  };

  const handleConfirmDeleteBank = async () => {
    if (!deletingBank) return;
    try {
      setIsDeletingBank(true);
      await BankPortalRepository.deletePartnerBank(deletingBank.id, operatorName);
      const updatedBanks = await BankPortalRepository.getAllPartnerBanks();
      setPartnerBanks(updatedBanks);
      setShowDeleteBankModal(false);
      setDeletingBank(null);
      showToast(`Банк «${deletingBank.name}» удален из партнерской сети DomExit.`);
    } catch {
      showError('Ошибка при удалении банка-партнера.');
    } finally {
      setIsDeletingBank(false);
    }
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

    try {
      setIsSubmittingEmp(true);
      const createdEmp = await withAsyncTimeout(
        EmployeesRepository.add({
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
        }),
        15000
      );

      let mappedRole: 'employee' | 'owner' | 'bank' = 'employee';
      if (
        newEmpRole.toLowerCase().includes('владелец') ||
        newEmpRole.toLowerCase().includes('co-owner')
      ) {
        mappedRole = 'owner';
      } else if (newEmpRole.toLowerCase().includes('банк')) {
        mappedRole = 'bank';
      }

      await withAsyncTimeout(
        UsersRepository.add({
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
        }),
        15000
      );

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
    } catch (err) {
      console.error('Add employee error:', err);
      showError(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingEmp(false);
    }
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
          {/* Master Environment Switcher (Owner Exclusive) */}
          {canSwitchEnvironment && (
            <div
              className={`rounded-2xl border-2 p-4 sm:p-5 shadow-sm transition-all duration-200 ${
                isProduction
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-amber-400 bg-amber-500/10'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                      isProduction
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-700'
                        : 'bg-amber-500/20 border-amber-400 text-amber-700'
                    }`}
                  >
                    {isProduction ? (
                      <ShieldCheck className="w-6 h-6 text-emerald-700" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-700" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          isProduction
                            ? 'bg-emerald-200 text-emerald-900 border-emerald-300'
                            : 'bg-amber-200 text-amber-900 border-amber-300'
                        }`}
                      >
                        {isProduction ? 'PRODUCTION • БОЕВОЙ' : 'SANDBOX • ПЕСОЧНИЦА'}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {isProduction
                          ? 'Промышленный контур 214-ФЗ'
                          : 'Тестовый симуляционный контур'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm font-medium text-slate-900">
                      {isProduction ? (
                        <>
                          🔒 <strong>БОЕВОЙ РЕЖИМ (PRODUCTION)</strong> — Чистая промышленная база. Все создаваемые лоты, сделки и эскроу-аккаунты являются юридически значимыми.
                        </>
                      ) : (
                        <>
                          ⚠️ <strong>РЕЖИМ ПЕСОЧНИЦЫ (SANDBOX)</strong> — Отображаются тестовые данные для симуляции и демонстрации. Реальные клиенты не видят эти объекты.
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleEnvironment}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer shrink-0 ${
                    isProduction
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                  {isProduction ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-slate-950" />
                      <span>Переключиться в Песочницу (Demo)</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-white" />
                      <span>Переключиться в Боевой режим (Production)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Master Feature Flags Management (Owner Exclusive) */}
          {isOwner && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Управление модулями платформы (Feature Flags)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Динамическое включение и отключение сервисных модулей без перезагрузки системы
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Phase 1 MVP
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Flag 1: VIP Club */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    enableVipClub ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-slate-900">
                          Модуль раннего доступа (VIP-клуб 48ч и подписки)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {enableVipClub
                          ? 'Включено: закрытый каталог /vip-catalog и платные подписки активны.'
                          : 'Выключено (Запуск после подключения ЮKassa): все объекты публикуются в открытом каталоге.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toggleFlag('enableVipClub');
                        showToast(
                          !enableVipClub
                            ? 'VIP-клуб 48ч и витрина раннего доступа активированы'
                            : 'VIP-клуб отключен. Каталог открыт для всех покупателей напрямую.'
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        enableVipClub ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          enableVipClub ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Flag 2: Bank Portal */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    enableBankPortal ? 'bg-sky-50/40 border-sky-300' : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Landmark className="w-4 h-4 text-sky-600" />
                        <span className="text-xs font-bold text-slate-900">
                          Модуль банковского шлюза (Кабинет банков-партнеров)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {enableBankPortal
                          ? 'Включено: прямой кабинет банков /bank-portal и учет офицеров СБР активны.'
                          : 'Выключено (Работа через аккредитивы и кураторов): сделки закрываются куратором на месте.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toggleFlag('enableBankPortal');
                        showToast(
                          !enableBankPortal
                            ? 'Банковский шлюз /bank-portal активирован'
                            : 'Банковский шлюз отключен. Работа ведется куратором через отделения банков.'
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        enableBankPortal ? 'bg-sky-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          enableBankPortal ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              {/* Executive 5-Tab Navigation Bar (Section 4) */}
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto whitespace-nowrap scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setActiveOwnerTab('overview')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
                    activeOwnerTab === 'overview'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Сводка и метрики</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveOwnerTab('sellers')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
                    activeOwnerTab === 'sellers'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Заявки продавцов</span>
                  {pendingSellerCount > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        activeOwnerTab === 'sellers'
                          ? 'bg-white text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {pendingSellerCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveOwnerTab('market')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
                    activeOwnerTab === 'market'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>Рыночные ставки и локации</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveOwnerTab('banks')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
                    activeOwnerTab === 'banks'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  <span>Банки-партнеры</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      activeOwnerTab === 'banks'
                        ? 'bg-white text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {partnerBanks.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveOwnerTab('legal')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
                    activeOwnerTab === 'legal'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Юридический профиль и соцсети</span>
                </button>
              </div>

              {/* =========================================================================
                  TAB 1: Сводка и метрики (Overview & Financials)
              ========================================================================= */}
              {activeOwnerTab === 'overview' && (
                <div className="space-y-6">
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

                  {/* Deals Pipeline & Critical Deadlines Summary */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                          <Landmark className="w-5 h-5 text-emerald-600" />
                          <span>Воронка сделок и мониторинг СБР / Эскроу</span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          Текущие сделки на этапах одобрения, депонирования и регистрации в Росреестре.
                        </p>
                      </div>
                      <Link
                        to="/admin/pipeline"
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors flex items-center space-x-1.5"
                      >
                        <span>Полная воронка сделок →</span>
                      </Link>
                    </div>

                    {allDeals.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
                        Активных сделок в воронке пока нет
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-700">
                          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-3">Код сделки / Лот</th>
                              <th className="py-3 px-3">Участники</th>
                              <th className="py-3 px-3">Банк-партнер</th>
                              <th className="py-3 px-3">Сумма СБР</th>
                              <th className="py-3 px-3">Текущий этап</th>
                              <th className="py-3 px-3 text-right">Комната сделки</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {allDeals.slice(0, 6).map((deal) => {
                              const stageBadge = {
                                initial_audit: { label: 'Аудит документов', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                                document_check: { label: 'Проверка комплаенс', color: 'bg-sky-50 text-sky-800 border-sky-200' },
                                packaging: { label: 'Упаковка и скоринг', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                                buyer_matching: { label: 'Поиск покупателя', color: 'bg-purple-50 text-purple-800 border-purple-200' },
                                closing_escrow: { label: 'Эскроу в банке', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                                completed: { label: 'Сделка закрыта ✓', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
                              }[deal.stage] || { label: deal.stage, color: 'bg-slate-100 text-slate-700 border-slate-200' };

                              const dealBank = deal.escrowWorkflow?.bankName || 'Сбербанк';
                              const dealAmount = deal.escrowWorkflow?.depositedAmountRub || deal.sellerReturnRub || 0;

                              return (
                                <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-3 px-3">
                                    <div className="font-bold text-slate-900 font-mono">{deal.dealId}</div>
                                    <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{deal.lotTitle || deal.lotCode}</div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="text-slate-900 font-medium">{deal.buyerName || 'Покупатель'}</div>
                                    <div className="text-[11px] text-slate-400">Продавец: {deal.sellerName || deal.clientName || 'Собственник'}</div>
                                  </td>
                                  <td className="py-3 px-3 font-semibold text-slate-800">
                                    {dealBank}
                                  </td>
                                  <td className="py-3 px-3 font-bold font-mono text-emerald-700">
                                    {dealAmount ? formatRubles(dealAmount) : '—'}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${stageBadge.color}`}>
                                      {stageBadge.label}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <Link
                                      to={`/admin/closing/${deal.dealId}`}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors inline-flex items-center space-x-1"
                                    >
                                      <span>Открыть</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Urgent Attention Desk: Lots awaiting approval / docs */}
                  {lots.filter(l => l.approvalStatus === 'pending_owner_approval' || l.additionalDocsRequested?.status === 'pending').length > 0 && (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-3xl p-6 space-y-4 shadow-xs">
                      <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-5 h-5 text-amber-700" />
                          <h4 className="text-sm font-black text-amber-950">
                            Объекты, требующие внимания владельца ({lots.filter(l => l.approvalStatus === 'pending_owner_approval' || l.additionalDocsRequested?.status === 'pending').length})
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveOwnerTab('sellers')}
                          className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                        >
                          Перейти к рассмотрению заявок →
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {lots
                          .filter(l => l.approvalStatus === 'pending_owner_approval' || l.additionalDocsRequested?.status === 'pending')
                          .slice(0, 6)
                          .map(lot => (
                            <div key={lot.id} className="p-3 bg-white rounded-2xl border border-amber-200/80 space-y-2">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-xs text-slate-900 truncate">{lot.complexName}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  lot.approvalStatus === 'pending_owner_approval'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {lot.approvalStatus === 'pending_owner_approval' ? 'Ожидает аккредитации' : 'Запрос документов'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">{lot.district} • {lot.developer}</p>
                              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                                <span className="font-bold font-mono text-emerald-700">{formatRubles(lot.cashPaidBySeller)}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveOwnerTab('sellers');
                                    setModalLot(lot);
                                    setLotActionMode('approve');
                                  }}
                                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                                >
                                  Рассмотреть →
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB 2: Заявки продавцов (Sellers Triage Desk)
              ========================================================================= */}
              {activeOwnerTab === 'sellers' && (
                <div className="space-y-6">
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

                </div>
              )}

              {/* =========================================================================
                  TAB 3: Рыночные ставки и локации (Market & District Engine)
              ========================================================================= */}
              {activeOwnerTab === 'market' && (
                <div className="space-y-6">
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

                {/* District Yield & Capital Growth Engine (Task 1: Two-Tier Location Selector) */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        District Yield & Capital Growth Engine (Двухуровневый селектор локаций)
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        Управление коэффициентами аренды и прогнозом роста цен по регионам и районам
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Автоматический пересчет ROI и капитализации в карточках лотов
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs items-end">
                    {/* Tier 1: City / Federal Region */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        1. Город / Регион *:
                      </label>
                      <select
                        value={selectedYieldCity}
                        onChange={async (e) => {
                          const newCity = e.target.value as RussianCityCode;
                          setSelectedYieldCity(newCity);
                          const cityDistricts = getDistrictsForRegion(newCity);
                          const firstDistrict = cityDistricts[0]?.nameRu || 'Приморский район';
                          setSelectedYieldDistrict(firstDistrict);
                          const cfg = await MarketSettingsRepository.getDistrictYieldConfig(
                            firstDistrict,
                            newCity
                          );
                          setDistrictDailyRentPct(cfg.dailyRentPercentOfMarket);
                          setDistrictMonthlyRentPct(cfg.monthlyRentPercentOfMarket);
                          setDistrictAnnualGrowthPct(cfg.annualGrowthPercent);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                      >
                        {RUSSIAN_REGIONS.map((reg) => (
                          <option key={reg.code} value={reg.code}>
                            {reg.shortLabelRu || reg.labelRu}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tier 2: District belonging to selected city */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        2. Район / Локация *:
                      </label>
                      <select
                        value={selectedYieldDistrict}
                        onChange={async (e) => {
                          const distName = e.target.value;
                          setSelectedYieldDistrict(distName);
                          const cfg = await MarketSettingsRepository.getDistrictYieldConfig(
                            distName,
                            selectedYieldCity
                          );
                          setDistrictDailyRentPct(cfg.dailyRentPercentOfMarket);
                          setDistrictMonthlyRentPct(cfg.monthlyRentPercentOfMarket);
                          setDistrictAnnualGrowthPct(cfg.annualGrowthPercent);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                      >
                        {getDistrictsForRegion(selectedYieldCity).map((dist) => (
                          <option key={dist.nameRu} value={dist.nameRu}>
                            {dist.nameRu}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Посуточно (%/сут.):
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
                        Долгосрочно (%/мес.):
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
                        Рост цены (%/год):
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
                                city: selectedYieldCity,
                                dailyRentPercentOfMarket: districtDailyRentPct,
                                monthlyRentPercentOfMarket: districtMonthlyRentPct,
                                annualGrowthPercent: districtAnnualGrowthPct,
                                updatedAt: new Date().toISOString(),
                              },
                              user?.name || 'Ahmed Abdallah (CEO)'
                            );
                          const latestSettings = await MarketSettingsRepository.getSettings();
                          setMarketSettings(latestSettings);
                          setIsSavingDistrictYield(false);
                          setNotificationMsg(
                            `Коэффициенты доходности для района «${savedCfg.districtNameRu}» (${selectedYieldCity.toUpperCase()}) сохранены (Посуточно: ${savedCfg.dailyRentPercentOfMarket}%, Долгосрочно: ${savedCfg.monthlyRentPercentOfMarket}%, Рост: +${savedCfg.annualGrowthPercent}%/год).`
                          );
                        }}
                        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingDistrictYield ? '...' : 'Обновить район'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 4: Банки-партнеры (Partner Banks Hub)
          ========================================================================= */}
          {activeOwnerTab === 'banks' && (
            <div className="space-y-6">
              {/* PARTNER BANKS MANAGEMENT & INTEGRATION HUB (Task 7) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        Управление банками-партнерами (Partner Bank Escrow & Integration Hub)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Мониторинг счетов СБР/Эскроу, ключевых KPI одобрения девелоперов и подключение новых банковских шлюзов
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddBankModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-xs flex items-center space-x-2 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить новый банк-партнер</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {partnerBanks.map((bank) => (
                    <div
                      key={bank.id}
                      className="bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl p-5 space-y-4 transition-all shadow-xs hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                            {bank.logoUrl ? (
                              <img src={bank.logoUrl} alt={bank.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Building2 className="w-5 h-5 text-emerald-700" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900">{bank.name}</h4>
                            <span className="text-[10px] font-bold text-slate-400 block">{bank.contactPerson || 'Офис эскроу'}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Активен ✓
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Эскроу-счета:</span>
                          <strong className="text-sm font-black text-slate-900">{bank.kpis.escrowAccountsCount}</strong>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Объем в СБР:</span>
                          <strong className="text-xs font-black text-emerald-700 font-mono">
                            {formatRubles(bank.kpis.totalEscrowRub)}
                          </strong>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Ср. скорость:</span>
                          <strong className="text-sm font-black text-slate-900">{bank.kpis.avgApprovalDays} дн.</strong>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Одобрение:</span>
                          <strong className="text-sm font-black text-emerald-700">{bank.kpis.devApprovalRatePercent}%</strong>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditBank(bank)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer border border-slate-200"
                            title="Редактировать параметры банка"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteBank(bank)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer border border-rose-200"
                            title="Удалить банк из партнерской сети"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <Link
                          to={`/admin/bank-gateway?bankId=${bank.id}`}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs"
                        >
                          <span>В шлюз</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 5: Юридический профиль и соцсети (Legal, Compliance & Social Hub)
          ========================================================================= */}
          {activeOwnerTab === 'legal' && (
            <div className="space-y-6">
              {/* COMPLIANCE & LEGAL HUB: 152-FZ / 38-FZ / ROSKOMNADZOR */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-black">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          Правовой профиль и реквизиты компании (152-ФЗ / 38-ФЗ)
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                          Роскомнадзор 2026 Ready
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Официальные банковские и юридические реквизиты. Динамически подставляются во все 5 публичных документов платформы и сквозной подвал сайта.
                      </p>
                    </div>
                  </div>

                  {/* Public Legal Pages Quick Links */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to="/privacy"
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
                    >
                      <span>Политика 152-ФЗ</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                    <Link
                      to="/terms"
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
                    >
                      <span>Условия и СБР</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                    <Link
                      to="/consent-pd"
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
                    >
                      <span>Согласие ПДн</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                    <Link
                      to="/consent-ads"
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
                    >
                      <span>Реклама 38-ФЗ</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                    <Link
                      to="/consent-distribution"
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
                    >
                      <span>Распространение 10.1</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                  </div>
                </div>

                <form onSubmit={handleSaveLegalProfile} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Полное наименование:
                      </label>
                      <input
                        type="text"
                        value={legalForm.fullName}
                        onChange={(e) => setLegalForm({ ...legalForm, fullName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Краткое наименование:
                      </label>
                      <input
                        type="text"
                        value={legalForm.shortName}
                        onChange={(e) => setLegalForm({ ...legalForm, shortName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        ОПФ:
                      </label>
                      <select
                        value={legalForm.entityType}
                        onChange={(e) => setLegalForm({ ...legalForm, entityType: e.target.value as 'ООО' | 'АО' | 'ИП' })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                        required
                      >
                        <option value="ООО">ООО</option>
                        <option value="АО">АО</option>
                        <option value="ИП">ИП</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        ИНН:
                      </label>
                      <input
                        type="text"
                        value={legalForm.inn}
                        onChange={(e) => setLegalForm({ ...legalForm, inn: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        КПП:
                      </label>
                      <input
                        type="text"
                        value={legalForm.kpp}
                        onChange={(e) => setLegalForm({ ...legalForm, kpp: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        ОГРН:
                      </label>
                      <input
                        type="text"
                        value={legalForm.ogrn}
                        onChange={(e) => setLegalForm({ ...legalForm, ogrn: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500 font-mono"
                        required
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Юридический адрес:
                      </label>
                      <input
                        type="text"
                        value={legalForm.legalAddress}
                        onChange={(e) => setLegalForm({ ...legalForm, legalAddress: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Почтовый адрес для корреспонденции:
                      </label>
                      <input
                        type="text"
                        value={legalForm.postalAddress}
                        onChange={(e) => setLegalForm({ ...legalForm, postalAddress: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Генеральный директор:
                      </label>
                      <input
                        type="text"
                        value={legalForm.generalDirector}
                        onChange={(e) => setLegalForm({ ...legalForm, generalDirector: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Ответственный за ПДн (DPO):
                      </label>
                      <input
                        type="text"
                        value={legalForm.dpoName}
                        onChange={(e) => setLegalForm({ ...legalForm, dpoName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Email для обращений ПДн:
                      </label>
                      <input
                        type="email"
                        value={legalForm.privacyEmail}
                        onChange={(e) => setLegalForm({ ...legalForm, privacyEmail: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Телефон DPO / компании:
                      </label>
                      <input
                        type="text"
                        value={legalForm.officialPhone}
                        onChange={(e) => setLegalForm({ ...legalForm, officialPhone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Банк:
                      </label>
                      <input
                        type="text"
                        value={legalForm.bankName}
                        onChange={(e) => setLegalForm({ ...legalForm, bankName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        БИК банка:
                      </label>
                      <input
                        type="text"
                        value={legalForm.bik}
                        onChange={(e) => setLegalForm({ ...legalForm, bik: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Расчетный счет (Р/с):
                      </label>
                      <input
                        type="text"
                        value={legalForm.checkingAccount}
                        onChange={(e) => setLegalForm({ ...legalForm, checkingAccount: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500 font-mono"
                        required
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Корреспондентский счет (К/с):
                      </label>
                      <input
                        type="text"
                        value={legalForm.correspondentAccount}
                        onChange={(e) => setLegalForm({ ...legalForm, correspondentAccount: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end items-center space-x-3 pt-3 border-t border-slate-100">
                    {legalSaveSuccess && (
                      <span className="text-emerald-600 font-bold text-xs flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Реквизиты сохранены и обновлены!</span>
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingLegalForm}
                      className="px-6 py-2.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
                    >
                      {isSavingLegalForm ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Сохранение в базе...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Сохранить реквизиты и обновить юридические документы</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* SOCIAL CHANNELS & PUBLIC LINKS HUB (Section 2) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          Каналы связи и социальные сети платформы
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Realtime Sync
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Централизованное управление публичными каналами, ботами и контактами платформы DomExit. Изменения мгновенно транслируются в шапку, подвал и карточки кураторов.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveChannels} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                        <Send className="w-3.5 h-3.5 text-sky-500" />
                        <span>Telegram-канал лотов:</span>
                      </label>
                      <input
                        type="url"
                        value={channelsForm.telegramChannelUrl}
                        onChange={(e) => setChannelsForm({ ...channelsForm, telegramChannelUrl: e.target.value })}
                        placeholder="https://t.me/domexit_spb"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                        <Bot className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Telegram-бот:</span>
                      </label>
                      <input
                        type="url"
                        value={channelsForm.telegramBotUrl}
                        onChange={(e) => setChannelsForm({ ...channelsForm, telegramBotUrl: e.target.value })}
                        placeholder="https://t.me/DomExitBot"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                        <span>Закрытый VIP-клуб:</span>
                      </label>
                      <input
                        type="url"
                        value={channelsForm.vipClubTelegramUrl}
                        onChange={(e) => setChannelsForm({ ...channelsForm, vipClubTelegramUrl: e.target.value })}
                        placeholder="https://t.me/+domexit_vip_investors"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Официальный профиль MAX:</span>
                      </label>
                      <input
                        type="url"
                        value={channelsForm.maxProfileUrl}
                        onChange={(e) => setChannelsForm({ ...channelsForm, maxProfileUrl: e.target.value })}
                        placeholder="https://max.ru/domexit"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                        <Share2 className="w-3.5 h-3.5 text-blue-500" />
                        <span>VK Сообщество:</span>
                      </label>
                      <input
                        type="url"
                        value={channelsForm.vkCommunityUrl}
                        onChange={(e) => setChannelsForm({ ...channelsForm, vkCommunityUrl: e.target.value })}
                        placeholder="https://vk.com/domexit_ru"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>Телефон горячей линии:</span>
                      </label>
                      <input
                        type="text"
                        value={channelsForm.hotlinePhone}
                        onChange={(e) => setChannelsForm({ ...channelsForm, hotlinePhone: e.target.value })}
                        placeholder="+7 (812) 409-32-00"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>Email службы поддержки:</span>
                      </label>
                      <input
                        type="email"
                        value={channelsForm.supportEmail}
                        onChange={(e) => setChannelsForm({ ...channelsForm, supportEmail: e.target.value })}
                        placeholder="info@domexit.ru"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end items-center space-x-3 pt-3 border-t border-slate-100">
                    {channelsSaveSuccess && (
                      <span className="text-emerald-600 font-bold text-xs flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Каналы связи сохранены и обновлены!</span>
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingChannels}
                      className="px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
                    >
                      {isSavingChannels ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Сохранение в базе...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Сохранить каналы связи и обновить ссылки</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* SECURITY INCIDENTS & ROSKOMNADZOR 24H PROTOCOL */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 font-black">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          Протокол инцидентов безопасности ПДн (ч. 3.1 ст. 21 № 152-ФЗ)
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          Роскомнадзор 24ч Дедлайн
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Официальный журнал регистрации неправомерной передачи или утечки персональных данных с генерацией уведомления регулятору.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddIncidentModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all shadow-xs flex items-center space-x-2 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Зафиксировать инцидент (Роскомнадзор 24ч)</span>
                  </button>
                </div>

                {/* Incident Log Records */}
                <div className="space-y-3">
                  {incidents.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">
                        Инцидентов утечки или неправомерной обработки персональных данных не зафиксировано
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Контур защищен по стандартам ч. 3.1 ст. 21 № 152-ФЗ с обязательной 24-часовой нотификацией регулятора.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {incidents.map((inc) => (
                        <div
                          key={inc.id}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    inc.severity === 'critical'
                                      ? 'bg-rose-600 text-white'
                                      : inc.severity === 'high'
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'bg-slate-200 text-slate-800'
                                  }`}
                                >
                                  {inc.severity.toUpperCase()}
                                </span>
                                <h4 className="text-sm font-black text-slate-900">{inc.title}</h4>
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-1">
                                Зафиксирован: {new Date(inc.timestamp).toLocaleString('ru-RU')} • Дедлайн: {new Date(inc.deadline24h).toLocaleString('ru-RU')}
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inc.status === 'resolved'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : inc.status === 'notified_rkn'
                                  ? 'bg-sky-100 text-sky-800 border border-sky-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                              }`}
                            >
                              {inc.status === 'resolved'
                                ? 'Инцидент закрыт ✓'
                                : inc.status === 'notified_rkn'
                                ? 'РКН уведомлен'
                                : 'На расследовании'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {inc.description}
                          </p>

                          <div className="text-[11px] text-slate-500 flex justify-between">
                            <span>Затронуто записей: <strong className="text-slate-800">{inc.affectedRecordsCount}</strong></span>
                            <span>{inc.reportedToRoskomnadzor ? '✓ Уведомлен Роскомнадзор' : '⚠ Требуется уведомление'}</span>
                          </div>

                          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedIncidentDraft(inc)}
                              className="text-[11px] font-bold text-sky-700 hover:text-sky-800 flex items-center space-x-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Черновик в РКН</span>
                            </button>

                            <div className="flex items-center space-x-1.5">
                              {inc.status === 'investigating' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateIncidentStatus(inc, 'notified_rkn')}
                                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                                >
                                  Отметить отправку в РКН
                                </button>
                              )}
                              {inc.status !== 'resolved' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateIncidentStatus(inc, 'resolved')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                                >
                                  Закрыть инцидент
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AI DATA MASKING ENGINE TESTING GATEWAY */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      <span>Шлюз ИИ-маскирования персональных данных (AI Data Masking / Роскомнадзор)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Принудительная деперсонализация российских персональных данных перед передачей во внешние LLM-модели (ГОСТ Р 55036 и ст. 7 152-ФЗ).
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Active Guard: ON
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Исходный текст запроса к ИИ (содержит ПДн):
                    </label>
                    <textarea
                      rows={3}
                      value={maskingInput}
                      onChange={(e) => setMaskingInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-xs focus:bg-white focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Результат маскирования (передается в LLM):
                    </label>
                    <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 text-slate-900 font-mono text-xs leading-relaxed min-h-[75px] select-all">
                      {maskSensitiveData(maskingInput)}
                    </div>
                  </div>
                </div>
              </div>

              {/* POLICY VERSIONING & IMMUTABLE REGISTRY (152-FZ / 38-FZ / SHA-256) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          Реестр версий юридических документов и контрольных сумм SHA-256
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          152-ФЗ / 38-ФЗ Immutable
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Управление жизненным циклом правовых актов платформы. Публикация версий с типом «Материальные изменения» автоматически активирует защитный экран повторного согласия (ConsentGateModal) для пользователей.
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/legal/archive"
                    target="_blank"
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Открыть публичный архив редакций</span>
                  </Link>
                </div>

                {/* Current Active Policies List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Текущие действующие редакции документов:
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {legalVersions.filter((v) => v.isCurrent).map((v) => (
                      <div
                        key={v.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate max-w-[180px]">
                            {v.policyNameRu}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">
                            v{v.versionNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {v.changeSummary}
                        </p>
                        <div className="text-[10px] font-mono text-slate-400 truncate bg-white p-1.5 rounded border border-slate-200">
                          SHA-256: {v.sha256Hash}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Дата вступления: {v.effectiveDate}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* New Version Publishing Form */}
                <form onSubmit={handlePublishNewPolicyVersion} className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4 text-xs">
                  <h4 className="font-black text-sm text-slate-900 flex items-center space-x-2">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>Опубликовать новую редакцию документа (с вычислением SHA-256)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Документ *</label>
                      <select
                        value={selectedNewPolicyType}
                        onChange={(e) => handleSelectPolicyTypeForNewVersion(e.target.value as LegalPolicyType)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:border-emerald-500"
                      >
                        <option value="privacy">Политика ПДн (152-ФЗ)</option>
                        <option value="user_agreement">Пользовательское соглашение</option>
                        <option value="cookies">Файлы Cookie</option>
                        <option value="advertising_consent">Реклама (38-ФЗ)</option>
                        <option value="public_distribution_consent">Распространение (ст. 10.1 152-ФЗ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Номер версии *</label>
                      <input
                        type="text"
                        value={newPolicyVersionNumber}
                        onChange={(e) => setNewPolicyVersionNumber(e.target.value)}
                        placeholder="Например: 2.2"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Характер изменений *</label>
                      <select
                        value={newPolicyChangeType}
                        onChange={(e) => setNewPolicyChangeType(e.target.value as 'minor' | 'material')}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:border-emerald-500"
                      >
                        <option value="material">Существенные (Повторное согласие пользователей)</option>
                        <option value="minor">Технические (Без блокирующего согласия)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Краткое описание изменений (Changelog) *</label>
                    <input
                      type="text"
                      value={newPolicyChangeSummary}
                      onChange={(e) => setNewPolicyChangeSummary(e.target.value)}
                      placeholder="Опишите, какие пункты изменены (для пользователей и Роскомнадзора)..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-bold text-slate-700">Полный текст документа *</label>
                      <span className="text-[11px] font-mono text-emerald-700 font-bold">
                        Контрольная сумма в реальном времени: {computedNewPolicySha.substring(0, 16)}...
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={newPolicyText}
                      onChange={(e) => setNewPolicyText(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-mono text-xs focus:border-emerald-500"
                      required
                    />
                  </div>

                  {/* SHA-256 Calculated Preview */}
                  <div className="bg-slate-900 text-white p-3 rounded-xl font-mono text-xs flex items-center justify-between">
                    <span className="text-slate-400">SHA-256 FIPS-180-4:</span>
                    <span className="text-emerald-400 font-semibold truncate ml-2">
                      {computedNewPolicySha || 'Вычисление...'}
                    </span>
                  </div>

                  <div className="flex justify-end items-center space-x-3 pt-2">
                    {policyPublishSuccess && (
                      <span className="text-emerald-600 font-bold text-xs flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Новая редакция сохранена в неизменяемый реестр!</span>
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isPublishingPolicy || !newPolicyText.trim()}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
                    >
                      {isPublishingPolicy ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Публикация и хэширование...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Опубликовать редакцию и активировать SHA-256</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
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
                      <span>Добавить сотрудника</span>
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
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEmp(emp);
                                    setEditEmpName(emp.name);
                                    setEditEmpEmail(emp.email);
                                    setEditEmpRole(emp.role);
                                    setEditEmpPhone(emp.phone);
                                    setEditEmpTg(emp.telegram || '');
                                    setEditEmpPerms(
                                      (emp.permissions as ('legal_audit' | 'packaging' | 'matchmaker' | 'closing')[]) || [
                                        'legal_audit',
                                        'packaging',
                                        'matchmaker',
                                        'closing',
                                      ]
                                    );
                                    setShowEditEmpModal(true);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer"
                                  title="Редактировать профиль и права"
                                >
                                  Редактировать
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubmittingEmp}
                                  onClick={() => handleToggleEmp(emp.id)}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {emp.status === 'active' ? 'Приостановить' : 'Активировать'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubmittingEmp}
                                  onClick={() => handleDeleteEmp(emp)}
                                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                  title="Удалить сотрудника"
                                >
                                  Удалить
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
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
                  disabled={isSubmittingEmp}
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEmp}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60 flex items-center space-x-2"
                >
                  {isSubmittingEmp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Сохранение в базе...</span>
                    </>
                  ) : (
                    <span>Создать и активировать доступ</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4.1 Edit Employee Modal (Full Staff CRUD) */}
      {showEditEmpModal && editingEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <span>Редактировать профиль сотрудника</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditEmpModal(false);
                  setEditingEmp(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditEmployeeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email аккаунта (корпоративный) *:
                </label>
                <input
                  type="email"
                  required
                  value={editEmpEmail}
                  onChange={(e) => setEditEmpEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ФИО сотрудника *:</label>
                <input
                  type="text"
                  required
                  value={editEmpName}
                  onChange={(e) => setEditEmpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Должность / Роль *:</label>
                <select
                  value={editEmpRole}
                  onChange={(e) => setEditEmpRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="Куратор по 214-ФЗ">Куратор по 214-ФЗ (Координатор сделок)</option>
                  <option value="Старший юрист комплаенса">Старший юрист комплаенса (42 проверки)</option>
                  <option value="Кредитный офицер банка">Кредитный офицер банка-партнера</option>
                  <option value="Ведущий куратор отдела выходов">Ведущий куратор отдела выходов</option>
                  <option value="Совладелец (Co-Owner)">Совладелец платформы (Co-Owner)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Телефон РФ *:</label>
                  <input
                    type="tel"
                    required
                    value={editEmpPhone}
                    onChange={(e) => setEditEmpPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telegram:</label>
                  <input
                    type="text"
                    value={editEmpTg}
                    onChange={(e) => setEditEmpTg(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                <div className="font-bold text-slate-700">Назначенные модули доступа:</div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPerms.includes('legal_audit')}
                      onChange={(e) => {
                        setEditEmpPerms(
                          e.target.checked
                            ? [...editEmpPerms, 'legal_audit']
                            : editEmpPerms.filter((p) => p !== 'legal_audit')
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>Юр. комплаенс</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPerms.includes('packaging')}
                      onChange={(e) => {
                        setEditEmpPerms(
                          e.target.checked
                            ? [...editEmpPerms, 'packaging']
                            : editEmpPerms.filter((p) => p !== 'packaging')
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>Упаковка лотов</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPerms.includes('matchmaker')}
                      onChange={(e) => {
                        setEditEmpPerms(
                          e.target.checked
                            ? [...editEmpPerms, 'matchmaker']
                            : editEmpPerms.filter((p) => p !== 'matchmaker')
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>Матчмейкинг</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPerms.includes('closing')}
                      onChange={(e) => {
                        setEditEmpPerms(
                          e.target.checked
                            ? [...editEmpPerms, 'closing']
                            : editEmpPerms.filter((p) => p !== 'closing')
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>Комната закрытия</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingEmp}
                  onClick={() => {
                    setShowEditEmpModal(false);
                    setEditingEmp(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEmp}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60 flex items-center space-x-2"
                >
                  {isSubmittingEmp ? (
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
        </div>
      )}

      {/* Modal: Add New Partner Bank (Task 7) */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Подключение нового банка-партнера
                  </h3>
                  <p className="text-xs text-slate-500">
                    Создание шлюза СБР / Эскроу и учетной записи Master Bank Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBankModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newBankName.trim() || !newBankAdminEmail.trim()) {
                  showError('Укажите наименование банка и Master Admin Email.');
                  return;
                }
                setIsSavingBank(true);
                try {
                  await BankPortalRepository.addPartnerBank({
                    name: newBankName.trim(),
                    masterAdminEmail: newBankAdminEmail.trim(),
                    contactPhone: newBankContactPhone.trim(),
                    contactPerson: newBankContactPerson.trim(),
                    logoUrl: newBankLogoUrl.trim() || undefined,
                    tempPassword: newBankTempPassword.trim(),
                  });
                  const updatedBanks = await BankPortalRepository.getAllPartnerBanks();
                  setPartnerBanks(updatedBanks);
                  setIsSavingBank(false);
                  setShowAddBankModal(false);
                  setNewBankName('');
                  setNewBankAdminEmail('');
                  setNewBankContactPerson('');
                  showToast(`Банк-партнер «${newBankName}» успешно подключен к контуру DomExit!`);
                } catch {
                  setIsSavingBank(false);
                  showError('Ошибка при подключении банка-партнера.');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Наименование кредитной организации / банка *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: ПАО «Газпромбанк», ПАО «Совкомбанк»"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Master Bank Admin Email *:
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="officer@partnerbank.ru"
                    value={newBankAdminEmail}
                    onChange={(e) => setNewBankAdminEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Временный пароль для входа *:
                  </label>
                  <input
                    type="text"
                    required
                    value={newBankTempPassword}
                    onChange={(e) => setNewBankTempPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ФИО руководителя направления / офицера:
                  </label>
                  <input
                    type="text"
                    placeholder="Иванов Сергей Николаевич"
                    value={newBankContactPerson}
                    onChange={(e) => setNewBankContactPerson(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Прямой телефон эскроу-департамента:
                  </label>
                  <input
                    type="tel"
                    value={newBankContactPhone}
                    onChange={(e) => setNewBankContactPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  URL официального логотипа (опционально):
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={newBankLogoUrl}
                  onChange={(e) => setNewBankLogoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-[11px] focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                ℹ️ При подключении автоматически активируется выделенный банковский шлюз в контуре DomExit. Уполномоченному администратору банка будут делегированы права подтверждения депонирования СБР, аккредитации застройщиков и утверждения кредитных лимитов.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSavingBank ? 'Подключение...' : 'Подключить банк'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Partner Bank */}
      {showEditBankModal && editingBank && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Редактировать параметры банка
                  </h3>
                  <p className="text-xs text-slate-500">
                    Изменение реквизитов и контактных данных шлюза СБР / Эскроу
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditBank} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Наименование кредитной организации / банка *:
                </label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Master Bank Admin Email *:
                </label>
                <input
                  type="email"
                  required
                  value={editBankAdminEmail}
                  onChange={(e) => setEditBankAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ФИО руководителя направления / офицера:
                  </label>
                  <input
                    type="text"
                    value={editBankContactPerson}
                    onChange={(e) => setEditBankContactPerson(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Прямой телефон эскроу-департамента:
                  </label>
                  <input
                    type="tel"
                    value={editBankContactPhone}
                    onChange={(e) => setEditBankContactPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  URL официального логотипа (опционально):
                </label>
                <input
                  type="url"
                  value={editBankLogoUrl}
                  onChange={(e) => setEditBankLogoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-[11px] focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditBankModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingBank}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  {isUpdatingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isUpdatingBank ? 'Сохранение...' : 'Сохранить изменения'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Partner Bank */}
      {showDeleteBankModal && deletingBank && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Удалить банк из сети?
                </h3>
                <p className="text-xs text-rose-600 font-bold">
                  {deletingBank.name}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs leading-relaxed">
              Удаление банка приведет к немедленной блокировке доступа для учетной записи <strong>{deletingBank.masterAdminEmail}</strong> и отзыву прав всех привязанных банковских офицеров.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteBankModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeletingBank}
                onClick={handleConfirmDeleteBank}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                {isDeletingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeletingBank ? 'Удаление...' : 'Да, удалить банк'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 152-FZ Security Incident Registration Modal */}
      {showAddIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Регистрация инцидента безопасности ПДн
                  </h3>
                  <span className="text-[11px] font-bold text-rose-600">
                    ч. 3.1 ст. 21 № 152-ФЗ (Дедлайн уведомления РКН: 24 часа)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddIncidentModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportSecurityIncident} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Краткое наименование инцидента *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Несанкционированная попытка выгрузки базы контактов"
                  value={newIncidentTitle}
                  onChange={(e) => setNewIncidentTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Уровень критичности инцидента *:
                </label>
                <select
                  value={newIncidentSeverity}
                  onChange={(e) => setNewIncidentSeverity(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-rose-500"
                >
                  <option value="low">Низкий (Локальный сбой без компрометации)</option>
                  <option value="medium">Средний (Затронуты контактные данные без паспортов)</option>
                  <option value="high">Высокий (Компрометация чувствительных данных / ДДУ)</option>
                  <option value="critical">Критический (Массовая утечка или атака на контур)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ориентировочное число затронутых субъектов ПДн *:
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newIncidentRecordsCount}
                  onChange={(e) => setNewIncidentRecordsCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Подробное описание обстоятельств и причин инцидента *:
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Опишите хронологию событий, затронутые категории ПДн и принятые первичные меры локализации..."
                  value={newIncidentDesc}
                  onChange={(e) => setNewIncidentDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-rose-500 text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ⚖️ <strong>Внимание:</strong> После сохранения система автоматически сформирует официальный текст уведомления для направления в Федеральную службу по надзору в сфере связи, информационных технологий и массовых коммуникаций (Роскомнадзор).
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddIncidentModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isReportingIncident}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  {isReportingIncident ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Формирование протокола...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Зафиксировать и сформировать проект</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roskomnadzor 24h Notification Draft Viewer Modal */}
      {selectedIncidentDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Официальный черновик уведомления в Роскомнадзор
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    В соответствии с ч. 3.1 ст. 21 Федерального закона № 152-ФЗ
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncidentDraft(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-[380px] overflow-y-auto select-all border border-slate-800">
                {selectedIncidentDraft.roskomnadzorDraft}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  Дедлайн направления: {new Date(selectedIncidentDraft.deadline24h).toLocaleString('ru-RU')}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedIncidentDraft.roskomnadzorDraft || '');
                      showToast('Официальный текст уведомления скопирован в буфер обмена!');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Скопировать в буфер</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIncidentDraft(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Закрыть окно
                  </button>
                </div>
              </div>
            </div>
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
