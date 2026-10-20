import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { AnalyticsRepository } from '../dal/repositories/AnalyticsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { UsersRepository } from '../dal/repositories/UsersRepository';
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { MarketSettingsRepository } from '../dal/repositories/MarketSettingsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { KPIStats, Lot, Employee, BuyerCandidate, PartnerEntry, InvestorApplication, MarketSettings, UserProfile } from '../types';
import {
  TrendingUp,
  AlertTriangle,
  Building,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Search,
  ExternalLink,
  Crown,
  Briefcase,
  UserCheck,
  FileText,
  ShieldCheck,
  Users,
  Eye,
  Check,
  Building2,
  Sliders,
  UserPlus,
  Save,
  Download,
  X,
  Lock,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { language } = useLanguage();
  const { user, switchRole } = useAuth();

  const [kpis, setKpis] = useState<KPIStats | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [candidates, setCandidates] = useState<BuyerCandidate[]>([]);
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [investors, setInvestors] = useState<InvestorApplication[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, string>>({});
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Market Settings State (Mission 2.2)
  const [marketSettings, setMarketSettings] = useState<MarketSettings>({
    id: 'market_parameters',
    cbrKeyRatePercent: 23.0,
    familyMortgageRatePercent: 6.0,
    developerPenaltyPercent: 15.0,
    buyerCommissionPercent: 2.5,
    updatedAt: new Date().toISOString(),
  });
  const [isSavingMarket, setIsSavingMarket] = useState<boolean>(false);

  // Modal inspection state (Mission 11)
  const [modalLot, setModalLot] = useState<Lot | null>(null);
  const [modalPartner, setModalPartner] = useState<PartnerEntry | null>(null);
  const [modalInvestor, setModalInvestor] = useState<InvestorApplication | null>(null);

  // Add Employee Modal (Mission 13.1)
  const [showAddEmpModal, setShowAddEmpModal] = useState<boolean>(false);
  const [newEmpEmail, setNewEmpEmail] = useState<string>('');
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<string>('Куратор по 214-ФЗ');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('+7 (812) 409-');
  const [newEmpTg, setNewEmpTg] = useState<string>('@domexit_');
  const [newEmpPerms, setNewEmpPerms] = useState<string[]>(['legal_audit', 'packaging', 'matchmaker', 'closing']);

  // Users & Staff management states (Task 3)
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [staffTab, setStaffTab] = useState<'users' | 'employees'>('users');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const isOwner = user?.activeRole === 'owner' || (!user?.activeRole && true);
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';

  const loadAllData = async () => {
    const [kpiData, lotsData, empData, candData, partData, invData, mSettings, allUsers] = await Promise.all([
      AnalyticsRepository.getKPIs(),
      LotsRepository.getAll(),
      EmployeesRepository.getAll(),
      CandidatesRepository.getAll(),
      PartnersRepository.getAll(),
      InvestorClubRepository.getAll(),
      MarketSettingsRepository.getSettings(),
      UsersRepository.getAll(),
    ]);

    setKpis(kpiData);
    setLots(lotsData);
    setEmployees(empData);
    setCandidates(candData);
    setPartners(partData);
    setInvestors(invData);
    setMarketSettings(mSettings);
    setUsersList(allUsers);
  };

  useEffect(() => {
    loadAllData();
  }, [user?.activeRole]);

  // Handle saving market settings (Mission 2.2)
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
      operatorName: user?.name || 'Виктор Сергеевич (Владелец)',
      operatorRole: 'owner',
      actionType: 'market_settings_updated',
      title: 'Обновлены ключевые рыночные параметры платформы',
      description: `Ставка ЦБ: ${marketSettings.cbrKeyRatePercent}%, Семейная: ${marketSettings.familyMortgageRatePercent}%, Штраф девелопера: ${marketSettings.developerPenaltyPercent}%, Комиссия: ${marketSettings.buyerCommissionPercent}%.`,
    });

    setIsSavingMarket(false);
    setNotificationMsg('Рыночные ставки сохранены в базе и обновлены на всем сайте (RU/EN)!');
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Handle assigning a lot to an employee
  const handleAssignEmployee = async (lotId: string, specificEmpId?: string) => {
    const empId = specificEmpId || selectedEmployees[lotId];
    if (!empId) return;

    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    await LotsRepository.assignToEmployee(lotId, emp.id, emp.name);
    setNotificationMsg(`Объект #${lotId} закреплен за куратором: ${emp.name}`);
    setTimeout(() => setNotificationMsg(null), 4000);
    await loadAllData();
    if (modalLot) setModalLot(null);
  };

  // Handle approving a partner request
  const handleApprovePartner = async (partnerId: string) => {
    await PartnersRepository.approve(partnerId);
    setNotificationMsg('Статус Партнера одобрен! Кабинет партнера активирован.');
    setTimeout(() => setNotificationMsg(null), 4000);
    await loadAllData();
    if (modalPartner) setModalPartner(null);
  };

  // Handle approving an investor request
  const handleApproveInvestor = async (investorId: string) => {
    await InvestorClubRepository.approve(investorId);
    setNotificationMsg('Статус VIP Инвестора подтвержден! Ранний доступ 48ч открыт.');
    setTimeout(() => setNotificationMsg(null), 4000);
    await loadAllData();
    if (modalInvestor) setModalInvestor(null);
  };

  // Handle toggling employee status (Mission 13.1)
  const handleToggleEmp = async (empId: string) => {
    await EmployeesRepository.toggleStatus(empId);
    setNotificationMsg('Статус доступа сотрудника обновлен.');
    setTimeout(() => setNotificationMsg(null), 4000);
    await loadAllData();
  };

  // Handle updating user role dynamically (Task 3)
  const handleUpdateUserRole = async (targetUserId: string, newRole: string) => {
    setUpdatingUserId(targetUserId);
    try {
      const updated = await UsersRepository.updateRole(
        targetUserId,
        newRole,
        user?.name || 'Виктор Сергеевич (Владелец)'
      );
      if (updated) {
        setNotificationMsg(`Роль пользователя [${updated.email}] успешно изменена на «${newRole}»! Права в Firestore обновлены.`);
        setTimeout(() => setNotificationMsg(null), 4000);
        await loadAllData();
      }
    } catch (err) {
      console.error('Failed to update user role:', err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Handle adding new employee & auto-registering user (Mission 13.1 & Task 3)
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpEmail || !newEmpName) return;

    // 1. Add to Employees Repository
    await EmployeesRepository.add({
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

    // 2. Also register in Users collection so they have seamless system access
    let mappedRole: any = 'employee';
    if (newEmpRole.toLowerCase().includes('владелец') || newEmpRole.toLowerCase().includes('co-owner')) {
      mappedRole = 'owner';
    } else if (newEmpRole.toLowerCase().includes('банк')) {
      mappedRole = 'bank';
    }

    await UsersRepository.add({
      email: newEmpEmail,
      name: newEmpName,
      phone: newEmpPhone,
      telegram: newEmpTg,
      role: mappedRole === 'owner' ? 'admin' : mappedRole,
      roles: mappedRole === 'owner' 
        ? ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'] as any
        : [mappedRole],
      activeRole: mappedRole,
      isPartnerApproved: true,
      isInvestorApproved: true,
    });

    await AuditLogsRepository.addLog({
      operatorName: user?.name || 'Владелец платформы',
      operatorRole: 'owner',
      actionType: 'employee_created_modified',
      title: `Добавлен новый сотрудник: ${newEmpName}`,
      description: `Email: ${newEmpEmail}, Должность: ${newEmpRole}. Доступ куратора и учетная запись пользователя активированы.`,
    });

    setShowAddEmpModal(false);
    setNewEmpEmail('');
    setNewEmpName('');
    setNotificationMsg(`Сотрудник ${newEmpName} (${newEmpEmail}) успешно добавлен в штат и базу пользователей.`);
    setTimeout(() => setNotificationMsg(null), 4000);
    await loadAllData();
  };

  // Filter lots for employee: only assigned lots
  const employeeLots = lots.filter(l => l.assignedEmployeeId === currentEmployeeId);
  const employeeLotCodes = employeeLots.map(l => l.lotCode);
  const employeeCandidates = candidates.filter(c => c.lotCode && employeeLotCodes.includes(c.lotCode));

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* 1. Admin Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Admin Header */}
        <AdminHeader
          title={
            isOwner 
              ? 'Панель Владельца — Контроль сделок и выручки'
              : 'Кабинет Сотрудника — Управление назначенными объектами'
          }
          subtitle={
            isOwner 
              ? 'Генеральный обзор платформы: одобрение продавцов, назначение сотрудников и финансовый учет 2.5%' 
              : `Куратор: ${user?.name || 'Алексей Морозов'} | Прямой прием заявок покупателей и закрытие сделок`
          }
        />

        {/* Global Notification Banner */}
        {notificationMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              <span>{notificationMsg}</span>
            </div>
            <button onClick={() => setNotificationMsg(null)} className="text-white/80 hover:text-white ml-2">✕</button>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6 max-w-7xl">

          {/* Role Status Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl ${isOwner ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {isOwner ? <Crown className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  {isOwner 
                    ? 'Текущий режим: Владелец платформы (Генеральный директор)' 
                    : `Текущий режим: Куратор отдела выходов (${user?.name || 'Алексей Морозов'})`}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isOwner 
                    ? 'Вам доступны: глобальная выручка 2.5%, одобрение новых объектов, закрепление кураторов, одобрение партнеров/инвесторов.' 
                    : 'Конфиденциальные данные компании скрыты. Доступны: только назначенные вам объекты и прямые заявки покупателей.'}
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
              OWNER MODE: Full platform financial view & assignment desk
          ========================================================================= */}
          {isOwner && (
            <>
              {/* Top 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* KPI 1 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      НОВЫЕ ЗАЯВКИ НА ВЫХОД (СЕГОДНЯ)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      +24% к н/н
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">
                    18 заявок
                  </div>
                  <p className="text-xs text-slate-500">
                    Сумма возврата: <strong className="text-slate-800">42,500,000 ₽</strong>
                  </p>
                </div>

                {/* KPI 2 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      АКТИВНЫЕ ПРОВЕРЕННЫЕ ЛОТЫ
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                      Дисконт 18.2%
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">
                    {lots.length} объектов
                  </div>
                  <p className="text-xs text-slate-500">
                    Санкт-Петербург: 98 | Москва: 44
                  </p>
                </div>

                {/* KPI 3 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      СДЕЛКИ В БАНКАХ / РОСРЕЕСТРЕ
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                      84.6 млн ₽
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">
                    9 эскроу
                  </div>
                  <p className="text-xs text-slate-500">
                    7 в Сбере, 2 в ВТБ (раскрытие 48ч)
                  </p>
                </div>

                {/* KPI 4: Company Revenue */}
                <div className="bg-emerald-50/60 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      ОЖИДАЕМАЯ КОМИССИЯ (2.5%) МЕС.
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold uppercase shadow-xs">
                      0 ₽ с продавцов
                    </span>
                  </div>
                  <div className="text-3xl font-black text-emerald-700">
                    3,850,000 ₽
                  </div>
                  <p className="text-xs text-emerald-800/80">
                    Факт: 2,140,000 ₽ | В резерве: 1,710,000 ₽
                  </p>
                </div>

              </div>

              {/* MISSION 2.2: Централизованная панель настроек рыночных ставок и параметров */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-emerald-600" />
                      <span>Настройки рыночных ставок и параметров платформы (settings/market_parameters)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Изменение этих показателей мгновенно пересчитывает калькуляторы, страницу истории и графики на всем сайте (RU/EN).
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Синхронизация: Live Firestore
                  </span>
                </div>

                <form onSubmit={handleSaveMarketSettings} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Рыночная ипотечная ставка ЦБ РФ (%):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={marketSettings.cbrKeyRatePercent}
                      onChange={(e) => setMarketSettings({ ...marketSettings, cbrKeyRatePercent: Number(e.target.value) })}
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
                      onChange={(e) => setMarketSettings({ ...marketSettings, familyMortgageRatePercent: Number(e.target.value) })}
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
                      onChange={(e) => setMarketSettings({ ...marketSettings, developerPenaltyPercent: Number(e.target.value) })}
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
                        onChange={(e) => setMarketSettings({ ...marketSettings, buyerCommissionPercent: Number(e.target.value) })}
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
              </div>

              {/* MISSION 11: Стол рассмотрения новых заявок на продажу с кнопкой [Открыть анкету и документы] */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <UserCheck className="w-5 h-5 text-indigo-600" />
                      <span>Стол рассмотрения заявок продавцов и назначения куратора (Owner Only)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Каждая заявка сопровождается полным досье, сканами ДДУ и расчетами. Нажмите «Открыть анкету и документы» для детального анализа.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                    Штат: {employees.length} эксперта
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Код лота</th>
                        <th className="py-3 px-3">ЖК и девелопер</th>
                        <th className="py-3 px-3">Кэш продавцу</th>
                        <th className="py-3 px-3">Статус объекта</th>
                        <th className="py-3 px-3">Ответственный куратор</th>
                        <th className="py-3 px-3 text-right">Полный аудит / Назначение</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lots.slice(0, 8).map((lot) => (
                        <tr key={lot.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            #{lot.lotCode}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-900 block">{lot.complexName}</span>
                            <span className="text-[10px] text-slate-500">{lot.developer} • {lot.areaM2} м²</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                            {formatRubles(lot.cashPaidBySeller)}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              lot.status === 'available'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : lot.status === 'processing'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {lot.status === 'available' ? 'Доступен' : lot.status === 'processing' ? 'В сделке' : 'Закрыт'}
                            </span>
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
                              {/* MISSION 11: Button [Открыть анкету и документы] */}
                              <button
                                type="button"
                                onClick={() => setModalLot(lot)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                              >
                                Открыть анкету и документы
                              </button>

                              <select
                                value={selectedEmployees[lot.id] || lot.assignedEmployeeId || ''}
                                onChange={(e) => setSelectedEmployees({ ...selectedEmployees, [lot.id]: e.target.value })}
                                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="">Сотрудник...</option>
                                {employees.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => handleAssignEmployee(lot.id)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                              >
                                Закрепить
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MISSION 11: Стол рассмотрения заявок Партнеров и Инвесторов */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Partners Approval Desk */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>Заявки на статус Партнера (Агенты / Брокеры)</span>
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-purple-700">
                      Вознаграждение: 30 000 – 50 000 ₽
                    </span>
                  </div>

                  <div className="space-y-3">
                    {partners.slice(0, 4).map((p) => (
                      <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">{p.organization} • {p.phone}</div>
                          <div className="text-[10px] text-purple-700 font-mono mt-0.5">Код: {p.referralCode}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setModalPartner(p)}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                          >
                            Анкета
                          </button>
                          {p.status === 'approved' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Одобрен</span>
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
                      <span>Заявки на статус VIP Инвестора (6 шагов верификации)</span>
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-amber-700">
                      Ранний доступ 48ч
                    </span>
                  </div>

                  <div className="space-y-3">
                    {investors.slice(0, 4).map((inv) => (
                      <div key={inv.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-slate-900">{inv.fullName}</div>
                          <div className="text-[11px] text-slate-500">{inv.companyOrFund || 'Частный капитал'} • Объем: {inv.capitalVolume}</div>
                          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Стратегия: {inv.strategy}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setModalInvestor(inv)}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                          >
                            Досье 6 шагов
                          </button>
                          {inv.status === 'approved' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Одобрен</span>
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

              {/* MISSION 13.1 & TASK 3: Управление штатом, пользователями и ролями платформы */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                      <span>Управление пользователями, штатом и ролями в системе</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Контроль реальных учетных записей Google/Email, мгновенная смена ролей и доступы сотрудников.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Tab Switcher */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setStaffTab('users')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          staffTab === 'users'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Зарегистрированные аккаунты ({usersList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStaffTab('employees')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

                {/* TAB 1: Registered Users & Dynamic Role Modification (Task 3) */}
                {staffTab === 'users' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">Пользователь</th>
                          <th className="py-3 px-3">Email / Вход</th>
                          <th className="py-3 px-3">Текущая роль</th>
                          <th className="py-3 px-3">Назначить роль в системе</th>
                          <th className="py-3 px-3 text-center">Аккредитации</th>
                          <th className="py-3 px-3 text-right">Тест доступа</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersList.map((u) => {
                          const isMasterOwner = u.email?.toLowerCase() === 'amaas9499@gmail.com' || u.email?.toLowerCase() === 'ceo@domexit.ru';
                          const isTestStaff = u.email?.toLowerCase() === 'amaas9494@gmail.com';
                          const currentRole = u.activeRole || u.role || 'buyer';

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                  <span>{u.name}</span>
                                  {isMasterOwner && (
                                    <span className="px-1.5 py-0.5 rounded-sm bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                                      Владелец
                                    </span>
                                  )}
                                  {isTestStaff && (
                                    <span className="px-1.5 py-0.5 rounded-sm bg-sky-500 text-white text-[10px] font-bold">
                                      Тест аккаунт
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 font-mono text-[11px]">{u.clientCode}</div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="font-mono font-semibold text-slate-800">{u.email}</div>
                                <div className="text-[10px] text-slate-400">
                                  {u.email?.includes('@gmail.com') ? 'Google Auth / Пароль' : 'Email + Пароль DomExit2026!'}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  currentRole === 'owner' || currentRole === 'admin'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : currentRole === 'employee'
                                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                    : currentRole === 'bank'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : currentRole === 'partner'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : currentRole === 'investor'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : currentRole === 'seller'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}>
                                  {currentRole === 'owner' && '👑 Владелец (Owner)'}
                                  {currentRole === 'admin' && '👑 Владелец (Admin)'}
                                  {currentRole === 'employee' && '👨‍💼 Сотрудник (Employee)'}
                                  {currentRole === 'bank' && '🏦 Банк-партнер (Bank)'}
                                  {currentRole === 'partner' && '🤝 Партнер (Partner)'}
                                  {currentRole === 'investor' && '💎 VIP Инвестор (Investor)'}
                                  {currentRole === 'seller' && '🏠 Продавец (Seller)'}
                                  {currentRole === 'buyer' && '🔑 Покупатель (Buyer)'}
                                </span>
                              </td>

                              {/* Interactive Role Selector Dropdown (Task 3) */}
                              <td className="py-3 px-3">
                                <div className="flex items-center space-x-2">
                                  <select
                                    disabled={updatingUserId === u.id}
                                    value={currentRole === 'admin' ? 'owner' : currentRole}
                                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer hover:border-slate-400 disabled:opacity-50"
                                  >
                                    <option value="owner">👑 Владелец (owner)</option>
                                    <option value="employee">👨‍💼 Сотрудник / Куратор (employee)</option>
                                    <option value="bank">🏦 Банк-партнер (bank)</option>
                                    <option value="partner">🤝 Партнер-брокер (partner)</option>
                                    <option value="investor">💎 VIP Инвестор (investor)</option>
                                    <option value="seller">🏠 Продавец ДДУ (seller)</option>
                                    <option value="buyer">🔑 Покупатель (buyer)</option>
                                  </select>
                                  {updatingUserId === u.id && (
                                    <span className="text-[10px] text-indigo-600 font-bold animate-pulse">
                                      Сохранение...
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    u.isPartnerApproved 
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                      : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    Партнер {u.isPartnerApproved ? '✓' : '—'}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    u.isInvestorApproved 
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                      : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    Инвестор {u.isInvestorApproved ? '✓' : '—'}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => switchRole(currentRole === 'admin' ? 'owner' : currentRole as any)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors shadow-2xs"
                                  title="Переключиться на этот интерфейс прямо сейчас"
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

                {/* TAB 2: Employees List */}
                {staffTab === 'employees' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">Сотрудник</th>
                          <th className="py-3 px-3">Корпоративный Email</th>
                          <th className="py-3 px-3">Должность / Роль</th>
                          <th className="py-3 px-3">Контакты (Тел / TG)</th>
                          <th className="py-3 px-3 text-center">Активных лотов</th>
                          <th className="py-3 px-3 text-center">Закрытых сделок</th>
                          <th className="py-3 px-3 text-center">Ср. скорость</th>
                          <th className="py-3 px-3">Статус</th>
                          <th className="py-3 px-3 text-right">Действие</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{emp.name}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600 font-semibold">
                              {emp.email}
                            </td>
                            <td className="py-3 px-3 text-slate-800">
                              {emp.role}
                            </td>
                            <td className="py-3 px-3">
                              <div>{emp.phone}</div>
                              <div className="text-indigo-600 font-mono text-[11px]">{emp.telegram}</div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono text-indigo-700">
                              {lots.filter(l => l.assignedEmployeeId === emp.id).length || emp.activeLotsCount}
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono text-emerald-700">
                              {emp.closedDealsCount || 6}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {emp.avgSpeedDays || 8} дн.
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                emp.status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}>
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
              EMPLOYEE MODE: Only Assigned Lots & Direct Inbound Buyer Offers
          ========================================================================= */}
          {!isOwner && (
            <>
              {/* Employee Top Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    МОИ ЗАКРЕПЛЕННЫЕ ОБЪЕКТЫ
                  </span>
                  <div className="text-3xl font-black text-slate-900">
                    {employeeLots.length} лота
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
                    {employeeCandidates.length || 6} предложений
                  </div>
                  <p className="text-xs text-slate-500">
                    Поступают напрямую на мои лоты
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    СДЕЛКИ В ЭСКРОУ И БАНКАХ
                  </span>
                  <div className="text-3xl font-black text-slate-900">
                    2 сделки
                  </div>
                  <p className="text-xs text-slate-500">
                    Сбербанк / ВТБ расчёты
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    СТАТУС ПРОВЕРКИ 152-ФЗ
                  </span>
                  <div className="text-3xl font-black text-emerald-700">
                    100% маскировка
                  </div>
                  <p className="text-xs text-slate-500">
                    Данные дольщиков защищены
                  </p>
                </div>
              </div>

              {/* Employee Assigned Lots Desk */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Briefcase className="w-5 h-5 text-emerald-600" />
                      <span>Объекты в вашей непосредственной ответственности</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Вы управляете упаковкой, юридическим аудитом и отбором покупателей по этим лотам.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(employeeLots.length > 0 ? employeeLots : lots.slice(0, 2)).map((lot) => (
                    <div key={lot.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            #{lot.lotCode}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{lot.complexName}</h4>
                          <span className="text-xs text-slate-500">{lot.developer} • {lot.areaM2} м²</span>
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
                          👥 Матчмейкер ({candidates.filter(c => c.lotCode === lot.lotCode).length || 3})
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direct Inbound Buyer Offers to Employee */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Users className="w-5 h-5 text-sky-600" />
                      <span>Прямые заявки покупателей на ваши объекты (Ежедневное окно)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Заявки поступают напрямую в ваш кабинет без согласования владельцем. Проверьте банковские документы и выберите лучшего кандидата.
                    </p>
                  </div>
                  <Link
                    to="/admin/matchmaker/U-10566"
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    Открыть двигатель отбора →
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Код / Кандидат</th>
                        <th className="py-3 px-3">Лот</th>
                        <th className="py-3 px-3">Трек финансирования</th>
                        <th className="py-3 px-3">Ликвидность / Лимит</th>
                        <th className="py-3 px-3">Банковская справка</th>
                        <th className="py-3 px-3 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidates.slice(0, 4).map((cand) => (
                        <tr key={cand.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-900 block">{cand.code}</span>
                            <span className="text-slate-600">{cand.name}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                            #{cand.lotCode || 'U-10566'}
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
                            {cand.bankApprovalDocUrl ? (
                              <a
                                href={cand.bankApprovalDocUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-700 hover:underline flex items-center space-x-1 font-semibold"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{cand.bankApprovalDocName || 'Одобрение_Банк.pdf'}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400">Справка не требуется (100% кэш)</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Link
                              to={`/admin/matchmaker/${cand.lotCode || 'U-10566'}`}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs"
                            >
                              Принять кандидата →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>

      </div>

      {/* =========================================================================
          MISSION 11: FULL DOSSIER MODALS
      ========================================================================= */}

      {/* 1. Seller Lot Dossier Modal */}
      {modalLot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-bold text-xs">
                  #{modalLot.lotCode}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Полное досье объекта и заявка продавца
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalLot(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Жилой комплекс:</span>
                  <strong className="text-slate-900">{modalLot.complexName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Девелопер:</span>
                  <strong className="text-slate-900">{modalLot.developer}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Площадь / Сдача:</span>
                  <strong className="text-slate-900">{modalLot.areaM2} м² • {modalLot.deliveryDate}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Цена по ДДУ:</span>
                  <strong className="text-slate-900 font-mono">{formatRubles(modalLot.dduContractPrice)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Выплачено дольщиком (Кэш):</span>
                  <strong className="text-emerald-700 font-mono">{formatRubles(modalLot.cashPaidBySeller)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Остаток долга:</span>
                  <strong className="text-slate-800 font-mono">{formatRubles(modalLot.remainingInstallmentDebt)}</strong>
                </div>
              </div>

              {/* 152-FZ Masked Owner Dossier */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center space-x-2 text-amber-900 font-bold">
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span>Досье продавца (152-ФЗ Защищено):</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>ФИО: <strong>{modalLot.ownerDossier?.fullNameMasked || 'Александр В. Б.'}</strong></div>
                  <div>Телефон: <strong>{modalLot.ownerDossier?.phoneMasked || '+7 (911) ***-44-12'}</strong></div>
                  <div>Договор ДДУ: <strong>{modalLot.ownerDossier?.dduNumber || '№ ЧН-12/2-10566'}</strong></div>
                  <div>Квартира: <strong>{modalLot.ownerDossier?.apartmentNumber || '№ 418'}</strong></div>
                </div>
              </div>

              {/* Documents & Photos */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                  Прикрепленные документы и сканы:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Скан_Договора_ДДУ_SetlGroup.pdf',
                    'Справка_о_расчетах_девелопера.pdf',
                    'Нотариальное_согласие_супруги.pdf',
                    'Выписка_справка_СФР_маткапитал.pdf',
                  ].map((docName, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{docName}</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold shrink-0">Проверен ✓</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assign Curator */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label className="block font-bold text-slate-800">Закрепить за штатным куратором:</label>
                <select
                  value={selectedEmployees[modalLot.id] || modalLot.assignedEmployeeId || ''}
                  onChange={(e) => setSelectedEmployees({ ...selectedEmployees, [modalLot.id]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800"
                >
                  <option value="">Выберите куратора...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Decision Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalLot(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert(`Запрос на исправление документов отправлен дольщику #${modalLot.lotCode}`);
                    setModalLot(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 font-bold text-xs hover:bg-amber-100"
                >
                  Запросить исправления
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAssignEmployee(modalLot.id);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                >
                  Утвердить и закрепить куратора
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Partner Dossier Modal */}
      {modalPartner && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Анкета партнера: {modalPartner.name}
              </h3>
              <button
                type="button"
                onClick={() => setModalPartner(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div>Организация: <strong>{modalPartner.organization}</strong></div>
                <div>Категория: <strong>{modalPartner.role}</strong></div>
                <div>Телефон: <strong>{modalPartner.phone}</strong></div>
                <div>Реферальный код: <strong className="font-mono text-purple-700">{modalPartner.referralCode}</strong></div>
                <div>Фиксированное вознаграждение: <strong>30 000 ₽ / сделка</strong></div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPartner(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleApprovePartner(modalPartner.id)}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md"
                >
                  Одобрить доступ и активировать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. VIP Investor 6-Steps Dossier Modal */}
      {modalInvestor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Анкета VIP Инвестора (6 шагов верификации)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalInvestor(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  1. Личные и контактные данные:
                </span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>ФИО: <strong>{modalInvestor.fullName}</strong></div>
                  <div>Компания / Фонд: <strong>{modalInvestor.companyOrFund || 'Индивидуальный инвестор'}</strong></div>
                  <div>Локация: <strong>{modalInvestor.countryAndCity}</strong></div>
                  <div>Связь (TG/Тел): <strong>{modalInvestor.contactTelegramOrPhone}</strong></div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  2. Объем доступного капитала и ликвидность:
                </span>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 font-bold">
                  Объем: {modalInvestor.capitalVolume} (Готовность к сделке: 48–72 часа)
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  3. Инвестиционная стратегия:
                </span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  Стратегия: <strong>{modalInvestor.strategy}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  4. Регионы и застройщики в фокусе:
                </span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {modalInvestor.targetRegions?.join(', ') || 'Санкт-Петербург и Ленобласть (Setl Group, ЛСР)'}
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  5. Подтверждение аккредитации и NDA:
                </span>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 font-medium">
                  Соглашение о конфиденциальности (NDA) подписано ЭЦП ✓
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  6. Условия платформы DomExit:
                </span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  Согласие на комиссию 2.5% при закрытии сделки подтверждено.
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalInvestor(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveInvestor(modalInvestor.id)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md"
                >
                  Утвердить статус VIP Инвестора (Ранний доступ 48ч)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add Employee Modal (Mission 13.1 & Task 3) */}
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
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-indigo-900 space-y-1">
                <p className="font-semibold">
                  💡 Поддерживаются корпоративные адреса (@domexit.ru) и личные Gmail (@gmail.com).
                </p>
                <p className="text-[11px] text-indigo-700">
                  Пользователь сможет войти через Google или пароль <strong>DomExit2026!</strong>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email аккаунта (Google или корпоративный) *:</label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com или name@domexit.ru"
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
                <label className="block font-bold text-slate-700 mb-1">Должность / Назначаемая роль *:</label>
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 bg-white font-semibold text-slate-800"
                >
                  <option value="Куратор по 214-ФЗ">Куратор по 214-ФЗ (Координатор сделок)</option>
                  <option value="Юрист комплаенс">Юрист комплаенс (Проверка ДДУ и 152-ФЗ)</option>
                  <option value="Менеджер банка-партнера">Менеджер банка-партнера (Сбербанк / ВТБ)</option>
                  <option value="Совладелец платформы">Совладелец платформы (Полный доступ / Co-Owner)</option>
                  <option value="Бизнес-аналитик по уступкам">Бизнес-аналитик по уступкам</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Телефон:</label>
                <input
                  type="text"
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Telegram:</label>
                <input
                  type="text"
                  value={newEmpTg}
                  onChange={(e) => setNewEmpTg(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md"
                >
                  Добавить и активировать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
