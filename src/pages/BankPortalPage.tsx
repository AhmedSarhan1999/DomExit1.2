import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  UserCheck, 
  Banknote, 
  CreditCard, 
  FileText, 
  ArrowRight, 
  Plus, 
  AlertCircle, 
  ChevronRight, 
  Lock, 
  Coins, 
  Users, 
  UserPlus, 
  Check, 
  DollarSign, 
  HelpCircle,
  ExternalLink,
  Search,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { BankEmployee, SpecialApprovalRequest, BuyerCreditLimitRequest, DealTrack, Lot } from '../types';

export const BankPortalPage: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();

  // Active Tab: 1. employees | 2. special_approvals | 3. credit_limits | 4. escrow_closing
  const [activeTab, setActiveTab] = useState<'employees' | 'special_approvals' | 'credit_limits' | 'escrow_closing'>('credit_limits');

  const [bankEmployees, setBankEmployees] = useState<BankEmployee[]>([]);
  const [specialApprovals, setSpecialApprovals] = useState<SpecialApprovalRequest[]>([]);
  const [creditLimits, setCreditLimits] = useState<BuyerCreditLimitRequest[]>([]);
  const [activeDeals, setActiveDeals] = useState<DealTrack[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal States
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<'officer' | 'escrow_agent' | 'head_manager' | 'chief_manager'>('officer');
  const [newEmpBank, setNewEmpBank] = useState('Сбербанк');
  const [newEmpPhone, setNewEmpPhone] = useState('+7 (812) ');

  // Decision Modal for Special Approval
  const [selectedApproval, setSelectedApproval] = useState<SpecialApprovalRequest | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<'approved' | 'rejected'>('approved');
  const [approvalNotes, setApprovalNotes] = useState('');

  // Decision Modal for Credit Limit
  const [selectedLimitReq, setSelectedLimitReq] = useState<BuyerCreditLimitRequest | null>(null);
  const [approvedLimitAmount, setApprovedLimitAmount] = useState<number>(8500000);
  const [validUntilDate, setValidUntilDate] = useState('2026-12-31');
  const [limitOfficerNotes, setLimitOfficerNotes] = useState('');

  const loadData = async () => {
    const [emps, specs, limits, deals] = await Promise.all([
      BankPortalRepository.getAllBankEmployees(),
      BankPortalRepository.getAllSpecialApprovals(),
      BankPortalRepository.getAllCreditLimitRequests(),
      DealsRepository.getAll(),
    ]);

    setBankEmployees(emps);
    setSpecialApprovals(specs);
    setCreditLimits(limits);
    setActiveDeals(deals);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    await BankPortalRepository.addBankEmployee({
      name: newEmpName,
      email: newEmpEmail,
      role: newEmpRole,
      bankName: newEmpBank,
      phone: newEmpPhone,
    });

    setIsAddEmpModalOpen(false);
    setNewEmpName('');
    setNewEmpEmail('');
    setNotice(language === 'ru' ? 'Сотрудник банка успешно зарегистрирован и активирован!' : 'Bank staff registered!');
    loadData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleToggleEmp = async (id: string) => {
    await BankPortalRepository.toggleBankEmployeeStatus(id);
    loadData();
  };

  const handleDecideApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApproval) return;

    await BankPortalRepository.decideSpecialApproval(
      selectedApproval.id,
      approvalDecision,
      approvalNotes || (approvalDecision === 'approved' ? 'Аккредитовано банком на стандартных условиях эскроу' : 'Не соответствует требованиям риска банка'),
      user?.name || 'Главный менеджер банка'
    );

    setSelectedApproval(null);
    setApprovalNotes('');
    setNotice(
      language === 'ru'
        ? `Решение по объекту ${selectedApproval.complexName} зафиксировано в реестре DomExit!`
        : `Decision recorded for ${selectedApproval.complexName}!`
    );
    loadData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleApproveCreditLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLimitReq) return;

    await BankPortalRepository.approveCreditLimit(
      selectedLimitReq.id,
      approvedLimitAmount,
      validUntilDate,
      user?.name || 'Кредитный офицер банка',
      limitOfficerNotes || 'Доход и платежеспособность проверены по регламенту 214-ФЗ'
    );

    setSelectedLimitReq(null);
    setLimitOfficerNotes('');
    setNotice(
      language === 'ru'
        ? `Официальный цифровой сертификат кредитного лимита для ${selectedLimitReq.userName} выпущен и активирован!`
        : `Certified credit stamp issued for ${selectedLimitReq.userName}!`
    );
    loadData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleConfirmEscrowDeposit = async (dealId: string, amount: number) => {
    await BankPortalRepository.confirmEscrowDeposit(
      dealId,
      user?.name || 'Кредитный офицер Сбербанка',
      amount
    );
    setNotice(
      language === 'ru'
        ? 'Депонирование средств на аккредитивном счете подтверждено! Сделка переведена на этап подписания.'
        : 'Escrow deposit confirmed! Proceed to signing.'
    );
    loadData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleReleaseEscrowFunds = async (dealId: string) => {
    await BankPortalRepository.releaseEscrowFunds(
      dealId,
      user?.name || 'Кредитный офицер Сбербанка'
    );
    setNotice(
      language === 'ru'
        ? 'Аккредитив успешно раскрыт! Деньги перечислены продавцу, комиссия 2.5% зачислена, сделка закрыта.'
        : 'Escrow released! Seller received funds, deal completed.'
    );
    loadData();
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24">
      
      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 pt-8 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/60">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-bold text-emerald-400">
                  <Building2 className="w-7 h-7" />
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {language === 'ru' ? 'Партнерский банковский шлюз' : 'Partner Bank Gateway'}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                    Сбер • ВТБ • Альфа
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ru'
                    ? 'Защищенный операционный контур банков-партнеров: кредитные лимиты, спец-одобрение застройщиков и эскроу-аккредитивы (214-ФЗ).'
                    : 'Secure partner bank hub: buyer credit limits, developer special approvals, and escrow releases.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Link
                to="/admin/dashboard"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                <span>{language === 'ru' ? '← В панель управления' : '← Back to Admin'}</span>
              </Link>
            </div>

          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pt-2">
            
            <button
              onClick={() => setActiveTab('credit_limits')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'credit_limits'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{language === 'ru' ? 'Кредитные лимиты покупателей' : 'Buyer Credit Limits'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                {creditLimits.filter(l => l.status === 'pending').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('special_approvals')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'special_approvals'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'ru' ? 'Спец-одобрение объектов (нетиповые)' : 'Special Property Approvals'}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                {specialApprovals.filter(s => s.status === 'pending').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('escrow_closing')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'escrow_closing'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>{language === 'ru' ? 'Эскроу и Аккредитивы (СБР)' : 'Escrow & SBR Accounts'}</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono">
                {activeDeals.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('employees')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'employees'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{language === 'ru' ? 'Сотрудники банка' : 'Bank Employees'}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                {bankEmployees.length}
              </span>
            </button>

          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {notice && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-md animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* ================= TAB 1: BUYER CREDIT LIMITS ================= */}
        {activeTab === 'credit_limits' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {language === 'ru' ? 'Заявки на подтверждение кредитного лимита покупателей' : 'Buyer Credit Limit Verification Requests'}
                </h2>
                <p className="text-xs text-slate-400">
                  {language === 'ru'
                    ? 'Специалист банка верифицирует доход и выпускает цифровой сертификат лимита (для покупки переуступок).'
                    : 'Bank officer confirms liquidity and issues certified stamp for lot reservations.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Код заявки</th>
                    <th className="py-3 px-4">Покупатель (DEX-ID)</th>
                    <th className="py-3 px-4">Банк</th>
                    <th className="py-3 px-4">Запрошенная сумма</th>
                    <th className="py-3 px-4">Одобренный лимит</th>
                    <th className="py-3 px-4">Сертификат</th>
                    <th className="py-3 px-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {creditLimits.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">{req.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{req.userName}</div>
                        <div className="text-[11px] font-mono text-indigo-400">{req.clientCode}</div>
                        <div className="text-[10px] text-slate-500">{req.userPhone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          {req.bankName}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        {formatRubles(req.requestedAmountRub)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {req.approvedLimitRub ? formatRubles(req.approvedLimitRub) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {req.certificateNumber ? (
                          <div>
                            <span className="text-emerald-400 font-bold">{req.certificateNumber}</span>
                            <div className="text-[10px] text-slate-500">до {req.validUntil}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Ожидает выпуска</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLimitReq(req);
                              setApprovedLimitAmount(req.requestedAmountRub);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
                          >
                            {language === 'ru' ? 'Выдать штамп банка' : 'Issue Bank Stamp'}
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] inline-flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>{language === 'ru' ? 'Одобрено' : 'Approved'}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 2: SPECIAL APPROVAL REQUESTS ================= */}
        {activeTab === 'special_approvals' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-lg font-bold text-white">
                {language === 'ru' ? 'Запросы спец-одобрения нетиповых объектов и застройщиков' : 'Special Property Accreditation Requests'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'ru'
                  ? 'Объекты, не подходящие под стандартные параметры аккредитации (малые подрядчики, индивидуальные рассрочки). Банк изучает риск и подтверждает финансирование.'
                  : 'Properties from non-standard contractors or unusual installment schedules requiring bank exception approval.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {specialApprovals.map((req) => (
                <div key={req.id} className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                          #{req.lotCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : req.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {req.status === 'approved' ? '✓ Спец-одобрение выдано' : req.status === 'rejected' ? '✕ Отклонено' : 'На рассмотрении банка'}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-white mt-1.5">{req.complexName}</h3>
                      <span className="text-xs text-slate-400">{req.developer} • ДДУ {formatRubles(req.contractPriceRub)}</span>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400">
                      {req.bankName}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {language === 'ru' ? 'Обоснование запроса от куратора DomExit:' : 'Curator Justification:'}
                    </span>
                    <p className="text-slate-300 leading-relaxed">{req.reason}</p>
                    <div className="text-[10px] text-slate-500 pt-1">
                      Запросил: {req.requestedByEmployeeName} • {new Date(req.requestedAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>

                  {req.status === 'pending' ? (
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApproval(req);
                          setApprovalDecision('rejected');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-300 border border-slate-700 hover:border-rose-500/40 font-bold text-xs transition-colors cursor-pointer"
                      >
                        {language === 'ru' ? 'Отклонить' : 'Reject'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApproval(req);
                          setApprovalDecision('approved');
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
                      >
                        {language === 'ru' ? 'Выдать спец-одобрение' : 'Grant Special Approval'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900 text-xs">
                      <span className="text-slate-400 block text-[10px]">{language === 'ru' ? 'Решение банка:' : 'Bank Decision:'}</span>
                      <p className="text-slate-200 mt-0.5">{req.decisionNotes}</p>
                      <span className="text-[10px] text-slate-500 block mt-1">Офицер: {req.decidedBy}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: ESCROW & SBR WORKFLOW ================= */}
        {activeTab === 'escrow_closing' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-lg font-bold text-white">
                {language === 'ru' ? 'Контроль эскроу-аккредитивов и безопасных расчетов (СБР)' : 'Escrow & SBR Safe Settlement Room'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'ru'
                  ? 'Контроль депонирования денежных средств покупателя, подтверждение открытия аккредитива и безопасное раскрытие после электронной регистрации в Росреестре.'
                  : 'Overseeing conditional buyer deposits, escrow opening, and safe fund release after Rosreestr registration.'}
              </p>
            </div>

            <div className="space-y-4">
              {activeDeals.map((deal) => {
                const escrowStep = deal.escrowWorkflow?.step || 'escrow_pending';
                const deposited = deal.escrowWorkflow?.depositedAmountRub || deal.sellerReturnRub || 2500000;

                return (
                  <div key={deal.id} className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                            {deal.id}
                          </span>
                          <span className="font-mono text-xs text-slate-400">Лот: #{deal.lotCode}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            Сбербанк Эскроу
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-white mt-1.5">{deal.complexName || deal.lotTitle}</h3>
                        <p className="text-xs text-slate-400">
                          Продавец: {deal.sellerName || deal.clientName} • Покупатель: {deal.buyerName || 'Иван Петрович К.'}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">{language === 'ru' ? 'Сумма кэша к выплате:' : 'Seller Payout:'}</span>
                        <span className="text-xl font-black font-mono text-emerald-400">
                          {formatRubles(deposited)}
                        </span>
                      </div>
                    </div>

                    {/* Step progress pills */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
                        <div className="flex items-center space-x-1.5 text-emerald-400 font-bold mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>1. Проверка куратора</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Передано в банк</span>
                      </div>

                      <div className={`p-3 rounded-2xl border text-xs ${
                        deal.escrowWorkflow?.depositConfirmedAt
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}>
                        <div className="flex items-center space-x-1.5 font-bold mb-1">
                          {deal.escrowWorkflow?.depositConfirmedAt ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5 animate-pulse" />}
                          <span>2. Депонирование</span>
                        </div>
                        <span className="text-[10px]">
                          {deal.escrowWorkflow?.depositConfirmedAt ? 'Средства заблокированы' : 'Ожидает подтверждения банка'}
                        </span>
                      </div>

                      <div className={`p-3 rounded-2xl border text-xs ${
                        deal.escrowWorkflow?.signingProofPhotos?.length
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}>
                        <div className="font-bold mb-1">3. Подписание и видео</div>
                        <span className="text-[10px]">
                          {deal.escrowWorkflow?.signingProofPhotos?.length ? 'Документы загружены' : 'Ожидает сессии'}
                        </span>
                      </div>

                      <div className={`p-3 rounded-2xl border text-xs ${
                        deal.escrowWorkflow?.fundsReleasedAt
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}>
                        <div className="font-bold mb-1">4. Раскрытие аккредитива</div>
                        <span className="text-[10px]">
                          {deal.escrowWorkflow?.fundsReleasedAt ? 'Деньги выплачены (2.5% комиссия)' : 'Ожидает регистрации'}
                        </span>
                      </div>
                    </div>

                    {/* Operational Bank Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                      <div className="text-xs text-slate-400 font-mono">
                        Номер счета эскроу: <strong className="text-slate-200">{deal.escrowWorkflow?.escrowAccountNumber || 'АК-78401/2026-СБЕР'}</strong>
                      </div>

                      <div className="flex items-center space-x-2">
                        {!deal.escrowWorkflow?.depositConfirmedAt ? (
                          <button
                            type="button"
                            onClick={() => handleConfirmEscrowDeposit(deal.id, deposited)}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
                          >
                            {language === 'ru' ? '✓ Подтвердить депонирование средств' : '✓ Confirm Escrow Deposit'}
                          </button>
                        ) : !deal.escrowWorkflow?.fundsReleasedAt ? (
                          <button
                            type="button"
                            onClick={() => handleReleaseEscrowFunds(deal.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
                          >
                            {language === 'ru' ? '🔓 Раскрыть аккредитив и выплатить кэш' : '🔓 Release Escrow to Seller'}
                          </button>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                            ✓ Аккредитив закрыт и исполнен
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 4: BANK EMPLOYEES MANAGEMENT ================= */}
        {activeTab === 'employees' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {language === 'ru' ? 'Управление сотрудниками и офицерами банка-партнера' : 'Partner Bank Staff Management'}
                </h2>
                <p className="text-xs text-slate-400">
                  {language === 'ru'
                    ? 'Главный менеджер банка может выдавать и приостанавливать доступы кредитных офицеров и кураторов эскроу.'
                    : 'The head manager manages officer permissions, credit certifiers, and escrow operators.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddEmpModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{language === 'ru' ? 'Добавить сотрудника банка' : 'Add Bank Officer'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bankEmployees.map((emp) => (
                <div key={emp.id} className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-white">{emp.name}</h3>
                      <span className="text-xs text-emerald-400 font-mono">{emp.bankName}</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      emp.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {emp.status === 'active' ? 'Активен' : 'Приостановлен'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <div>Email: <strong className="text-slate-200">{emp.email}</strong></div>
                    <div>Телефон: <strong className="text-slate-200 font-mono">{emp.phone}</strong></div>
                    <div>Роль: <strong className="text-slate-200">
                      {emp.role === 'head_manager' ? 'Главный менеджер' : emp.role === 'escrow_agent' ? 'Куратор эскроу' : 'Кредитный офицер'}
                    </strong></div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleToggleEmp(emp.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {emp.status === 'active' ? 'Приостановить доступ' : 'Активировать'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ================= MODAL: Add Bank Employee ================= */}
      {isAddEmpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-700 space-y-5 animate-scale-up text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {language === 'ru' ? 'Регистрация нового офицера банка' : 'Register Bank Officer'}
              </h3>
              <button onClick={() => setIsAddEmpModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">ФИО сотрудника *</label>
                <input
                  type="text"
                  required
                  placeholder="Игорь Владимирович Соколов"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Корпоративный Email сотрудника *</label>
                <input
                  type="email"
                  required
                  placeholder="sokolov.i@sberbank.ru"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Банк-партнер *</label>
                <select
                  value={newEmpBank}
                  onChange={(e) => setNewEmpBank(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Сбербанк">Сбербанк (ПАО)</option>
                  <option value="ВТБ">Банк ВТБ (ПАО)</option>
                  <option value="Альфа-Банк">Альфа-Банк</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Роль в шлюзе *</label>
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="officer">Кредитный офицер (Одобрение лимитов)</option>
                  <option value="escrow_agent">Специалист по эскроу (СБР и раскрытие)</option>
                  <option value="head_manager">Главный менеджер направления</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Телефон *</label>
                <input
                  type="tel"
                  required
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEmpModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md"
                >
                  Создать аккаунт
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: Decide Special Approval ================= */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-700 space-y-5 animate-scale-up text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {approvalDecision === 'approved' ? 'Выдача спец-одобрения объекта' : 'Отклонение объекта'}
              </h3>
              <button onClick={() => setSelectedApproval(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white">{selectedApproval.complexName}</div>
              <div className="text-slate-400">{selectedApproval.developer} • {formatRubles(selectedApproval.contractPriceRub)}</div>
              <p className="text-[11px] text-slate-400 pt-1">{selectedApproval.reason}</p>
            </div>

            <form onSubmit={handleDecideApproval} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Резолюция кредитного комитета банка *</label>
                <textarea
                  rows={3}
                  required
                  placeholder={approvalDecision === 'approved' ? 'Аккредитовано банком на стандартных условиях эскроу-переуступки' : 'Высокий риск застройщика / неполный пакет документов'}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedApproval(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl font-black text-xs cursor-pointer shadow-md ${
                    approvalDecision === 'approved' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {approvalDecision === 'approved' ? 'Утвердить спец-одобрение' : 'Подтвердить отказ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: Issue Credit Stamp ================= */}
      {selectedLimitReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-700 space-y-5 animate-scale-up text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">
                  {language === 'ru' ? 'Выпуск цифрового штампа лимита' : 'Issue Certified Bank Stamp'}
                </h3>
              </div>
              <button onClick={() => setSelectedLimitReq(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white">{selectedLimitReq.userName}</div>
              <div className="font-mono text-indigo-400">{selectedLimitReq.clientCode} • {selectedLimitReq.userPhone}</div>
              <div className="text-slate-400">Запрошено: {formatRubles(selectedLimitReq.requestedAmountRub)} в {selectedLimitReq.bankName}</div>
            </div>

            <form onSubmit={handleApproveCreditLimit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {language === 'ru' ? 'Окончательный одобренный лимит (₽) *' : 'Approved Credit Limit (₽) *'}
                </label>
                <input
                  type="number"
                  required
                  step={100000}
                  value={approvedLimitAmount}
                  onChange={(e) => setApprovedLimitAmount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {language === 'ru' ? 'Срок действия сертификата *' : 'Validity Date *'}
                </label>
                <input
                  type="date"
                  required
                  value={validUntilDate}
                  onChange={(e) => setValidUntilDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {language === 'ru' ? 'Служебная отметка офицера *' : 'Officer Notes *'}
                </label>
                <textarea
                  rows={2}
                  value={limitOfficerNotes}
                  onChange={(e) => setLimitOfficerNotes(e.target.value)}
                  placeholder="Доход подтвержден по 2-НДФЛ. Лимит зафиксирован для семейной ипотеки и переуступок."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedLimitReq(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md"
                >
                  Выпустить сертификат
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
