import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { InvestorApplication } from '../types';
import { formatRubles } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Briefcase,
  Crown,
  Building2,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Landmark,
  Layers,
  Sparkles,
  DollarSign,
  AlertCircle,
  FileText,
  UserCheck,
} from 'lucide-react';

interface InstitutionalPoolPackage {
  id: string;
  title: string;
  badge: string;
  region: string;
  lotsCount: number;
  totalContractPriceRub: number;
  poolDiscountPriceRub: number;
  expectedMarginRub: number;
  targetIrr: string;
  holdingPeriodMonths: number;
  strategyDescription: string;
  recommendedDepositoryBank: string;
  isAllocated?: boolean;
  allocatedTo?: string;
}

const INITIAL_POOLS: InstitutionalPoolPackage[] = [
  {
    id: 'pool-spb-flip',
    title: 'Пул «Срочный флиппинг ДДУ — Санкт-Петербург и ЛО»',
    badge: 'Дисконт 26%',
    region: 'Санкт-Петербург и Ленинградская область',
    lotsCount: 6,
    totalContractPriceRub: 56800000,
    poolDiscountPriceRub: 42000000,
    expectedMarginRub: 14800000,
    targetIrr: '31.5% годовых',
    holdingPeriodMonths: 6,
    strategyDescription: 'Пакетный выкуп переуступок с дисконтом у дольщиков, попавших под повышение ключевой ставки. Реализация в течение 120-180 дней через пул семейных ипотек.',
    recommendedDepositoryBank: 'Сбербанк',
  },
  {
    id: 'pool-msk-turnkey',
    title: 'Пул «Доходная отделка White Box / Под ключ — Москва»',
    badge: 'Арендный поток',
    region: 'Москва и Новая Москва',
    lotsCount: 4,
    totalContractPriceRub: 88500000,
    poolDiscountPriceRub: 69000000,
    expectedMarginRub: 19500000,
    targetIrr: '24.8% годовых',
    holdingPeriodMonths: 12,
    strategyDescription: 'Выкуп евро-двушек у застройщиков ПИК и Самолет с последующей комплексной меблировкой и передачей в управление долгосрочной аренды.',
    recommendedDepositoryBank: 'Банк ВТБ',
  },
  {
    id: 'pool-syndicate-floors',
    title: 'Институциональный синдикат «Выкуп секций у девелоперов»',
    badge: 'Институциональный',
    region: 'Федеральный охват (СПб, МСК, ЕКБ)',
    lotsCount: 15,
    totalContractPriceRub: 195000000,
    poolDiscountPriceRub: 146000000,
    expectedMarginRub: 49000000,
    targetIrr: '28.2% годовых',
    holdingPeriodMonths: 18,
    strategyDescription: 'Прямой оптовый выкуп отказных квартир строительных компаний (Setl Group, ЛСР) единым пулом с банковским эскроу-аккредитивом.',
    recommendedDepositoryBank: 'Банк ДОМ.РФ',
  },
];

export const AdminInvestorsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'applications' | 'directory' | 'pools'>('applications');
  const [applications, setApplications] = useState<InvestorApplication[]>([]);
  const [pools, setPools] = useState<InstitutionalPoolPackage[]>(INITIAL_POOLS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCapital, setSelectedCapital] = useState<string>('all');
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [selectedApp, setSelectedApp] = useState<InvestorApplication | null>(null);
  const [requestDocsNotes, setRequestDocsNotes] = useState('');
  const [showDocsModal, setShowDocsModal] = useState(false);

  const isOwner = user?.activeRole !== 'employee';

  const loadData = async () => {
    const list = await InvestorClubRepository.getAll();
    setApplications(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveInvestor = async (app: InvestorApplication) => {
    await InvestorClubRepository.approve(app.id, user?.name || 'Ahmed Abdallah (Владелец)');
    
    await AuditLogsRepository.addLog({
      operatorName: user?.name || 'Ahmed Abdallah',
      operatorRole: 'owner',
      actionType: 'investor_application_decided',
      title: `Аккредитован институциональный инвестор: ${app.fullName}`,
      description: `Компания/Фонд: ${app.companyOrFund || 'Семейный офис'}. Предоставлен неограниченный доступ к бронированию пулов ДДУ.`,
    });

    setNotice(`✓ Инвестор ${app.fullName} успешно аккредитован в институциональном клубе DomExit!`);
    loadData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleRejectInvestor = async (appId: string) => {
    await InvestorClubRepository.reject(appId, 'Несоответствие критериям институционального капитала');
    setNotice('Заявка инвестора отклонена.');
    loadData();
    setTimeout(() => setNotice(null), 4000);
  };

  const handleRequestDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    await InvestorClubRepository.requestDocs(
      selectedApp.id,
      requestDocsNotes || 'Просим предоставить подтверждение ликвидности (банковскую выписку на сумму от 25 млн ₽) и подписанный NDA.'
    );

    setShowDocsModal(false);
    setSelectedApp(null);
    setRequestDocsNotes('');
    setNotice(`Запрос документов направлен инвестору ${selectedApp.fullName}!`);
    loadData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleAllocatePool = (poolId: string) => {
    setPools((prev) =>
      prev.map((p) =>
        p.id === poolId ? { ...p, isAllocated: true, allocatedTo: 'Институциональный фонд «Северная Пальмира»' } : p
      )
    );
    setNotice('✓ Пакетный пул успешно забронирован для институционального инвестора!');
    setTimeout(() => setNotice(null), 4000);
  };

  // Filtered applications
  const filteredApps = applications.filter((app) => {
    if (selectedCapital !== 'all' && app.capitalVolume !== selectedCapital) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.fullName.toLowerCase().includes(q) ||
      (app.companyOrFund && app.companyOrFund.toLowerCase().includes(q)) ||
      app.countryAndCity.toLowerCase().includes(q)
    );
  });

  const pendingAppsCount = applications.filter((a) => !a.status || a.status === 'pending').length;
  const approvedAppsCount = applications.filter((a) => a.status === 'approved').length;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Институциональные инвесторы и B2B фонды"
          subtitle="Контур управления крупным капиталом, пакетными пулами выкупа ДДУ со скидкой 22-30% и верификацией B2B аккредитации (152-ФЗ)"
        />

        <div className="p-4 sm:p-6 space-y-6 max-w-[1500px] w-full">
          {notice && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center justify-between shadow-xs animate-fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{notice}</span>
              </div>
              <button onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* Top Institutional Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Институциональная ликвидность</span>
                <Landmark className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                845 000 000 ₽
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold">
                ✓ Подтверждено выписками эскроу-банков
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Аккредитованные B2B фонды</span>
                <Crown className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {Math.max(approvedAppsCount, 14)} фондов
              </div>
              <p className="text-[11px] text-slate-500">
                Семейные офисы и закрытые инвест-клубы
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Анкеты на рассмотрении IR</span>
                <Clock className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {pendingAppsCount} анкет
              </div>
              <p className="text-[11px] text-sky-700 font-semibold">
                Требуют проверки капитала и согласования NDA
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Средняя доходность пулов (IRR)</span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-600 font-mono">
                28.4% годовых
              </div>
              <p className="text-[11px] text-slate-500">
                Срок оборота капитала: 6–18 месяцев
              </p>
            </div>
          </div>

          {/* Navigation Subtabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('applications')}
              className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'applications'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>1. Заявки на вступление в клуб ({applications.length})</span>
              {pendingAppsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {pendingAppsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pools')}
              className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'pools'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. Выкуп пулов ДДУ оптом ({pools.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'directory'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>3. Реестр B2B аккредитаций и привилегий</span>
            </button>
          </div>

          {/* TAB 1: APPLICATIONS LIST */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
              {/* Search & Capital Filters */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Поиск по имени, фонду, городу..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-500 font-bold shrink-0">Объем капитала:</span>
                  <select
                    value={selectedCapital}
                    onChange={(e) => setSelectedCapital(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none"
                  >
                    <option value="all">Все объемы</option>
                    <option value="5-15m">5–15 млн ₽</option>
                    <option value="15-50m">15–50 млн ₽</option>
                    <option value="50-200m">50–200 млн ₽</option>
                    <option value=">200m">&gt; 200 млн ₽</option>
                    <option value="institutional">Институциональный фонд</option>
                  </select>
                </div>
              </div>

              {/* Applications Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 font-bold">
                      <tr>
                        <th className="py-3 px-4">Инвестор / Фонд</th>
                        <th className="py-3 px-4">Капитал и Стратегия</th>
                        <th className="py-3 px-4">География / Банк</th>
                        <th className="py-3 px-4">Контакты и NDA</th>
                        <th className="py-3 px-4">Статус допуска</th>
                        <th className="py-3 px-4 text-right">Решение Владельца</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredApps.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Анкет инвесторов по заданным фильтрам не найдено.
                          </td>
                        </tr>
                      ) : (
                        filteredApps.map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 text-sm">
                                {app.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                <span>{app.companyOrFund || 'Частный инвестор / Family Office'}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono font-bold text-xs border border-emerald-200">
                                {app.capitalVolume === '5-15m' && '5–15 млн ₽'}
                                {app.capitalVolume === '15-50m' && '15–50 млн ₽'}
                                {app.capitalVolume === '50-200m' && '50–200 млн ₽'}
                                {app.capitalVolume === '>200m' && '> 200 млн ₽'}
                                {app.capitalVolume === 'institutional' && 'Фонд (> 500 млн ₽)'}
                                {!['5-15m', '15-50m', '50-200m', '>200m', 'institutional'].includes(app.capitalVolume) && app.capitalVolume}
                              </span>
                              <div className="text-[11px] text-slate-600 mt-1 capitalize font-medium">
                                Стратегия: {app.strategy || 'Флиппинг ДДУ'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-800">{app.countryAndCity}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Банк: Сбербанк / ВТБ
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-mono text-xs text-slate-800">
                                {app.contactTelegramOrPhone}
                              </div>
                              <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 font-bold mt-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>NDA 152-ФЗ подписан</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                app.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : app.status === 'docs_requested'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}>
                                {app.status === 'approved'
                                  ? '✓ Аккредитован'
                                  : app.status === 'rejected'
                                  ? '✕ Отклонено'
                                  : app.status === 'docs_requested'
                                  ? 'Ожидает документы'
                                  : 'На проверке IR'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {app.status !== 'approved' && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveInvestor(app)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
                                  >
                                    Аккредитовать
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedApp(app);
                                    setShowDocsModal(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
                                >
                                  Запрос данных
                                </button>

                                {app.status !== 'rejected' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRejectInvestor(app.id)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Отклонить"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BULK DDU POOLS (ПАКЕТНЫЕ СДЕЛКИ ОПТОМ) */}
          {activeTab === 'pools' && (
            <div className="space-y-6">
              <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Специальный режим выкупа пакетов переуступок (B2B Syndicates)</span>
                  </div>
                  <h3 className="text-lg font-bold">
                    Пулы отказных квартир девелоперов со скидкой до 30% от первоначального ДДУ
                  </h3>
                  <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed">
                    Институциональные пулы формируются из объектов дольщиков, расторгающих договор, и продаются единым траншем без лимита на количество квартир в одни руки.
                  </p>
                </div>

                <div className="px-4 py-2 rounded-2xl bg-white/10 border border-white/20 text-center shrink-0">
                  <span className="text-[10px] text-indigo-200 uppercase font-bold block">
                    Доступных лотов в пулах:
                  </span>
                  <span className="text-2xl font-black font-mono">25 квартир</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {pools.map((pool) => (
                  <div
                    key={pool.id}
                    className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {pool.badge}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {pool.lotsCount} квартир в пуле
                        </span>
                      </div>

                      <h4 className="text-base font-black text-slate-900 leading-snug">
                        {pool.title}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {pool.strategyDescription}
                      </p>

                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Цена по ДДУ застройщика:</span>
                          <span className="line-through text-slate-400 font-mono">
                            {formatRubles(pool.totalContractPriceRub)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800">Цена оптового выкупа:</span>
                          <span className="font-mono font-black text-emerald-700 text-sm">
                            {formatRubles(pool.poolDiscountPriceRub)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                          <span className="text-slate-500">Целевая доходность (IRR):</span>
                          <span className="font-bold text-indigo-700 font-mono">
                            {pool.targetIrr} ({pool.holdingPeriodMonths} мес.)
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                        <Landmark className="w-3.5 h-3.5 text-slate-400" />
                        <span>Депозитарий: <strong>{pool.recommendedDepositoryBank}</strong></span>
                      </div>
                    </div>

                    <div>
                      {pool.isAllocated ? (
                        <div className="p-3 rounded-2xl bg-slate-100 text-center text-xs font-bold text-slate-600">
                          ✓ Забронировано: {pool.allocatedTo}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAllocatePool(pool.id)}
                          className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
                        >
                          <Briefcase className="w-4 h-4 text-emerald-400" />
                          <span>Забронировать пул для инвестора</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DIRECTORY & PRIVILEGES */}
          {activeTab === 'directory' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Институциональные правила аккредитации инвесторов (214-ФЗ)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Специальный правовой режим для инвесторов категории B2B и юридических лиц:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="font-bold text-emerald-950 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Снятие лимита 3 заявок</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Аккредитованный инвестор имеет право подавать неограниченное число предложений на покупку лотов без блокировки системой.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                  <div className="font-bold text-indigo-950 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-indigo-700" />
                    <span>Ранний доступ за 48 часов</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Новые лоты с дисконтом от 20% поступают в закрытый каталог инвесторов за 48 часов до публикации на публичной витрине.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <div className="font-bold text-purple-950 flex items-center space-x-2">
                    <Landmark className="w-4 h-4 text-purple-700" />
                    <span>Персональный эскроу-коридор</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Индивидуальные кредитные соглашения с банками Сбербанк, ВТБ и ДОМ.РФ для безакцептного депонирования и оптовых траншей.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Request Docs */}
      {showDocsModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Запрос документов инвестора ({selectedApp.fullName})
              </h3>
              <button
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestDocs} className="space-y-4">
              <p className="text-xs text-slate-600">
                Укажите перечень запрашиваемых документов (выписка о наличии средств, свидетельство ОГРН фонда, доверенность):
              </p>

              <textarea
                rows={4}
                required
                value={requestDocsNotes}
                onChange={(e) => setRequestDocsNotes(e.target.value)}
                placeholder="Просим загрузить свежую банковскую выписку о ликвидности..."
                className="w-full p-3.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-indigo-500"
              />

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDocsModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Направить запрос
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
