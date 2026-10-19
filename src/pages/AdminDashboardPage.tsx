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
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { KPIStats, Lot, Employee, BuyerCandidate, PartnerEntry, InvestorApplication } from '../types';
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
  Building2
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
  const [activeTab, setActiveTab] = useState<'all' | 'sellers' | 'buyers' | 'investors'>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, string>>({});
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const isOwner = user?.activeRole === 'owner' || (!user?.activeRole && true);
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';

  const loadAllData = async () => {
    const [kpiData, lotsData, empData, candData, partData, invData] = await Promise.all([
      AnalyticsRepository.getKPIs(),
      LotsRepository.getAll(),
      EmployeesRepository.getAll(),
      CandidatesRepository.getAll(),
      PartnersRepository.getAll(),
      InvestorClubRepository.getAll(),
    ]);

    setKpis(kpiData);
    setLots(lotsData);
    setEmployees(empData);
    setCandidates(candData);
    setPartners(partData);
    setInvestors(invData);
  };

  useEffect(() => {
    loadAllData();
  }, [user?.activeRole]);

  // Handle assigning a lot to an employee
  const handleAssignEmployee = async (lotId: string) => {
    const empId = selectedEmployees[lotId];
    if (!empId) return;

    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    await LotsRepository.assignToEmployee(lotId, emp.id, emp.name);
    setNotificationMsg(`Объект успешно закреплен за куратором: ${emp.name}`);
    setTimeout(() => setNotificationMsg(null), 4000);
    await loadAllData();
  };

  // Handle approving a partner request
  const handleApprovePartner = async (partnerId: string) => {
    await PartnersRepository.approve(partnerId);
    setNotificationMsg('Статус Партнера успешно одобрен! Кабинет партнера активирован.');
    setTimeout(() => setNotificationMsg(null), 4000);
    await loadAllData();
  };

  // Handle approving an investor request
  const handleApproveInvestor = async (investorId: string) => {
    await InvestorClubRepository.approve(investorId);
    setNotificationMsg('Статус VIP Инвестора успешно подтвержден! Кабинет инвестора активирован.');
    setTimeout(() => setNotificationMsg(null), 4000);
    await loadAllData();
  };

  // Filter lots for employee: only assigned lots
  const employeeLots = lots.filter(l => l.assignedEmployeeId === currentEmployeeId);
  // Buyer candidates directed to employee's lots
  const employeeLotCodes = employeeLots.map(l => l.lotCode);
  const employeeCandidates = candidates.filter(c => c.lotCode && employeeLotCodes.includes(c.lotCode));

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      
      {/* 1. Admin Sidebar (Light Theme + Role filtered) */}
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
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>{notificationMsg}</span>
            </div>
            <button onClick={() => setNotificationMsg(null)} className="text-white/80 hover:text-white">✕</button>
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
              {/* Top 4 KPI Cards (Owner sees full revenue) */}
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

                {/* KPI 4: Company Revenue (STRICTLY OWNER ONLY) */}
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

              {/* MISSION 3: Стол рассмотрения новых заявок на продажу и назначения ответственного сотрудника */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <UserCheck className="w-5 h-5 text-indigo-600" />
                      <span>Стол рассмотрения заявок продавцов и назначения куратора (Owner Only)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Заявка от продавца поступает к владельцу. После одобрения владелец закрепляет ответственного сотрудника, который ведет лот до закрытия.
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
                        <th className="py-3 px-3 text-right">Назначение / Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lots.slice(0, 6).map((lot) => (
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
                                Не назначен (ожидает распределения)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <select
                                value={selectedEmployees[lot.id] || lot.assignedEmployeeId || ''}
                                onChange={(e) => setSelectedEmployees({ ...selectedEmployees, [lot.id]: e.target.value })}
                                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="">Выберите сотрудника...</option>
                                {employees.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.role})
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

              {/* MISSION 3: Стол рассмотрения заявок Партнеров и Инвесторов */}
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
                    {partners.slice(0, 3).map((p) => (
                      <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">{p.organization} • {p.phone}</div>
                          <div className="text-[10px] text-purple-700 font-mono mt-0.5">Код: {p.referralCode}</div>
                        </div>
                        <div className="flex items-center space-x-2">
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
                              Одобрить доступ
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Investors Approval Desk */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Crown className="w-4 h-4 text-amber-600" />
                      <span>Заявки на статус VIP Инвестора (Закрытый клуб)</span>
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-amber-700">
                      Ранний доступ 48ч
                    </span>
                  </div>

                  <div className="space-y-3">
                    {investors.slice(0, 3).map((inv) => (
                      <div key={inv.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-slate-900">{inv.fullName}</div>
                          <div className="text-[11px] text-slate-500">{inv.companyOrFund || 'Частный капитал'} • {inv.capitalVolume}</div>
                          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Стратегия: {inv.strategy}</div>
                        </div>
                        <div className="flex items-center space-x-2">
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
            </>
          )}

          {/* =========================================================================
              EMPLOYEE MODE: Only Assigned Lots & Direct Inbound Buyer Offers
              (Company 2.5% revenue and unassigned lots are completely hidden!)
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

              {/* MISSION 3 & 5: Direct Inbound Buyer Offers to Employee */}
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

    </div>
  );
};

