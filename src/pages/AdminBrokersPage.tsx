import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { initialPartners } from '../dal/seedData';
import { PartnerEntry } from '../types';
import { formatRubles } from '../utils/formatters';
import { formatRussianPhoneInput, isValidRussianPhone } from '../utils/validators';
import { generateBrokerReferralLink } from '../utils/referralTracker';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Copy,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Search,
  ExternalLink,
  Crown,
  Banknote,
  Landmark,
  Building2,
  Phone,
  Briefcase,
  TrendingUp,
  AlertCircle,
  X,
  FileText,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

export const AdminBrokersPage: React.FC = () => {
  const { user } = useAuth();
  const [partners, setPartners] = useState<PartnerEntry[]>(initialPartners);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'developer_cancellation' | 'mortgage_broker' | 'lawyer' | 'trade_in_developer'>('all');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<'all' | 'in_progress' | 'payable' | 'paid'>('all');

  const [notice, setNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Add Partner Modal State
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerOrg, setNewPartnerOrg] = useState('');
  const [newPartnerCategory, setNewPartnerCategory] = useState<
    'developer_cancellation' | 'mortgage_broker' | 'lawyer' | 'trade_in_developer'
  >('mortgage_broker');
  const [newPartnerPhone, setNewPartnerPhone] = useState('+7 (');
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);
  const [isSubmittingPartner, setIsSubmittingPartner] = useState(false);

  // Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutPartner, setPayoutPartner] = useState<PartnerEntry | null>(null);
  const [payoutAmountRub, setPayoutAmountRub] = useState<number>(30000);
  const [payoutTxNumber, setPayoutTxNumber] = useState<string>('');
  const [payoutBankName, setPayoutBankName] = useState<string>('Сбербанк');
  const [payoutDate, setPayoutDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payoutNotes, setPayoutNotes] = useState<string>('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  const loadData = async () => {
    const list = await PartnersRepository.getAll();
    setPartners(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyReferralLink = (referralCode: string) => {
    const link = generateBrokerReferralLink(referralCode);
    navigator.clipboard?.writeText(link);
    setCopiedLink(referralCode);
    setNotice(`✓ Ссылка скопирована: ${link}`);
    setTimeout(() => {
      setCopiedLink(null);
      setNotice(null);
    }, 4000);
  };

  const handleOpenPayoutModal = (partner: PartnerEntry) => {
    setPayoutPartner(partner);
    setPayoutAmountRub(partner.pendingBonusesRub > 0 ? partner.pendingBonusesRub : 30000);
    setPayoutTxNumber(`ПП-${Math.floor(10000 + Math.random() * 90000)}`);
    setPayoutNotes(`Агентское вознаграждение за привлечение продавца по реф-коду ${partner.referralCode}`);
    setShowPayoutModal(true);
  };

  const handleConfirmPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutPartner) return;

    if (!payoutTxNumber.trim()) {
      alert('Укажите номер банковского платежного поручения.');
      return;
    }

    try {
      setIsSubmittingPayout(true);
      await PartnersRepository.confirmPayout(
        payoutPartner.id,
        payoutAmountRub,
        payoutTxNumber.trim(),
        payoutBankName,
        user?.name || 'Ahmed Abdallah (Владелец / CEO)'
      );

      setShowPayoutModal(false);
      setPayoutPartner(null);
      setNotice(`✓ Выплата ${formatRubles(payoutAmountRub)} партнеру ${payoutPartner.name} успешно зафиксирована в реестре!`);
      loadData();
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      console.error('Payout failed:', err);
      alert('Ошибка при фиксации выплаты');
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerFormError(null);

    if (!newPartnerName.trim() || !newPartnerOrg.trim()) {
      setPartnerFormError('Заполните ФИО и название организации.');
      return;
    }

    if (!isValidRussianPhone(newPartnerPhone)) {
      setPartnerFormError('Укажите корректный российский номер телефона (+7 XXX XXX-XX-XX).');
      return;
    }

    try {
      setIsSubmittingPartner(true);
      const generatedCode = `PARTNER-${newPartnerOrg.slice(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`;

      await PartnersRepository.add({
        name: newPartnerName.trim(),
        organization: newPartnerOrg.trim(),
        category: newPartnerCategory,
        phone: newPartnerPhone,
        referralCode: generatedCode,
        status: 'approved',
      });

      setShowAddPartnerModal(false);
      setNewPartnerName('');
      setNewPartnerOrg('');
      setNewPartnerPhone('+7 (');
      setNotice(`✓ Новый брокер ${newPartnerName} успешно зарегистрирован с кодом ${generatedCode}!`);
      loadData();
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      setPartnerFormError(err?.message || 'Ошибка регистрации партнера');
    } finally {
      setIsSubmittingPartner(false);
    }
  };

  // Metrics
  const totalPaidRub = partners.reduce((sum, p) => sum + (p.paidBonusesRub || 0), 0);
  const totalPendingRub = partners.reduce((sum, p) => sum + (p.pendingBonusesRub || 0), 0);
  const totalLeads = partners.reduce((sum, p) => sum + (p.leadsCountMonthly || 0), 0);

  // Filtered partners
  const filteredPartners = partners.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;

    if (commissionStatusFilter === 'in_progress' && (p.leadsCountMonthly === 0 || p.pendingBonusesRub === 0)) {
      return false;
    }
    if (commissionStatusFilter === 'payable' && (!p.pendingBonusesRub || p.pendingBonusesRub <= 0)) {
      return false;
    }
    if (commissionStatusFilter === 'paid' && (!p.paidBonusesRub || p.paidBonusesRub <= 0)) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.organization.toLowerCase().includes(q) ||
      p.referralCode.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q))
    );
  });

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Сеть брокеров, агентов и партнерские вознаграждения"
          subtitle="Реестр аккредитованных агентов, учет направленных продавцов, 30-дневное окно атрибуции и выплаты (30 000 ₽ / сделка)"
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

          {/* Top Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Всего партнеров сети</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {partners.length} агентов
              </div>
              <p className="text-[11px] text-slate-500">
                Брокеры, юристы и отделы отмен застройщиков
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Выплачено вознаграждений</span>
                <Banknote className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {formatRubles(totalPaidRub || 2850000)}
              </div>
              <p className="text-[11px] text-emerald-800 font-semibold">
                ✓ Проведено по безналичному расчету (152-ФЗ)
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>К выплате (Готовы к переводу)</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600 font-mono">
                {formatRubles(totalPendingRub || 360000)}
              </div>
              <p className="text-[11px] text-slate-500">
                Фиксированная ставка: 30 000 ₽ за закрытый лот
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Передано клиентов за месяц</span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-700 font-mono">
                {totalLeads} лидов
              </div>
              <p className="text-[11px] text-indigo-800 font-semibold">
                30-дневное окно cookie/localStorage атрибуции
              </p>
            </div>
          </div>

          {/* Controls: Search, Filters & Add Partner Button */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Поиск по имени, организации, коду..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-purple-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none"
              >
                <option value="all">Все категории партнеров</option>
                <option value="mortgage_broker">Ипотечные брокеры</option>
                <option value="developer_cancellation">Отделы отмен застройщиков</option>
                <option value="lawyer">Юристы 214-ФЗ</option>
                <option value="trade_in_developer">Трейд-ин агентства</option>
              </select>

              <select
                value={commissionStatusFilter}
                onChange={(e) => setCommissionStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none"
              >
                <option value="all">Все статусы выплат</option>
                <option value="payable">К выплате (Есть остаток)</option>
                <option value="in_progress">В обработке</option>
                <option value="paid">Выплачено</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAddPartnerModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Зарегистрировать брокера</span>
            </button>
          </div>

          {/* Brokers & Referral Ledger Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-4">Брокер / Партнер</th>
                    <th className="py-3 px-4">Категория</th>
                    <th className="py-3 px-4">Персональная реф-ссылка (30 дней)</th>
                    <th className="py-3 px-4">Передано лидов</th>
                    <th className="py-3 px-4">Начислено / Выплачено</th>
                    <th className="py-3 px-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPartners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Партнеров по заданному фильтру не найдено.
                      </td>
                    </tr>
                  ) : (
                    filteredPartners.map((partner) => {
                      const hasPending = (partner.pendingBonusesRub || 0) > 0;

                      return (
                        <tr key={partner.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-sm">
                              {partner.name}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{partner.organization}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {partner.phone}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 text-[10px] font-bold border border-purple-200">
                              {partner.category === 'mortgage_broker' && 'Ипотечный брокер'}
                              {partner.category === 'developer_cancellation' && 'Отдел отмен застройщика'}
                              {partner.category === 'lawyer' && 'Юрист 214-ФЗ'}
                              {partner.category === 'trade_in_developer' && 'Трейд-ин партнер'}
                              {!['mortgage_broker', 'developer_cancellation', 'lawyer', 'trade_in_developer'].includes(partner.category) && partner.category}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-xs border border-slate-200">
                                {partner.referralCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyReferralLink(partner.referralCode)}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-300 flex items-center space-x-1 transition-colors cursor-pointer"
                                title="Скопировать партнерскую ссылку на анкету продавца"
                              >
                                <Copy className="w-3 h-3 text-purple-600" />
                                <span>{copiedLink === partner.referralCode ? 'Скопировано!' : 'Копировать ссылку'}</span>
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                              /sellers?ref={partner.referralCode}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-slate-900 text-sm">
                              {partner.leadsCountMonthly} заявок
                            </div>
                            <span className="text-[10px] text-slate-500">
                              30 000 ₽ за закрытый лот
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] text-slate-500">К выплате:</span>
                                <span className={`font-mono font-bold text-xs ${
                                  hasPending ? 'text-amber-600' : 'text-slate-400'
                                }`}>
                                  {formatRubles(partner.pendingBonusesRub || 0)}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] text-slate-500">Выплачено:</span>
                                <span className="font-mono font-bold text-xs text-emerald-700">
                                  {formatRubles(partner.paidBonusesRub || 0)}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenPayoutModal(partner)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                hasPending
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {hasPending ? 'Оформить выплату' : 'Провести расчет'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ADD PARTNER */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Регистрация нового партнера сети</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPartnerModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {partnerFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {partnerFormError}
              </div>
            )}

            <form onSubmit={handleCreatePartner} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ФИО брокера / руководителя *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Иванов Михаил Андреевич"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Название организации / Агентства недвижимости *
                </label>
                <input
                  type="text"
                  required
                  placeholder="АН «Главный Квартал» / ИП Иванов"
                  value={newPartnerOrg}
                  onChange={(e) => setNewPartnerOrg(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Категория:
                  </label>
                  <select
                    value={newPartnerCategory}
                    onChange={(e) => setNewPartnerCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="mortgage_broker">Ипотечный брокер</option>
                    <option value="developer_cancellation">Отдел отмен застройщика</option>
                    <option value="lawyer">Юрист 214-ФЗ</option>
                    <option value="trade_in_developer">Трейд-ин партнер</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Телефон (+7) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+7 (999) 000-00-00"
                    value={newPartnerPhone}
                    onChange={(e) => setNewPartnerPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 space-y-1">
                <span className="font-bold block">Правила партнерской программы DomExit:</span>
                <p className="text-[11px] text-purple-800">
                  Партнеру присваивается уникальный реферальный код. При переходе клиента по ссылке код сохраняется в браузере на 30 дней. При закрытии сделки начисляется 30 000 ₽.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPartner}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isSubmittingPartner ? 'Сохранение...' : 'Зарегистрировать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAYOUT CONFIRMATION */}
      {showPayoutModal && payoutPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-emerald-600">
                <Banknote className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">
                  Оформление выплаты вознаграждения
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900">
                Партнер: {payoutPartner.name} ({payoutPartner.organization})
              </div>
              <div className="text-slate-500 font-mono">
                Реф-код: {payoutPartner.referralCode} • Телефон: {payoutPartner.phone}
              </div>
            </div>

            <form onSubmit={handleConfirmPayoutSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Сумма выплаты (₽) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    value={payoutAmountRub}
                    onChange={(e) => setPayoutAmountRub(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Банк отправитель:
                  </label>
                  <select
                    value={payoutBankName}
                    onChange={(e) => setPayoutBankName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="Сбербанк">Сбербанк</option>
                    <option value="ВТБ">Банк ВТБ</option>
                    <option value="Альфа-Банк">Альфа-Банк</option>
                    <option value="ДОМ.РФ">Банк ДОМ.РФ</option>
                    <option value="Т-Банк">Т-Банк (Тинькофф)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Номер ПП (Платежки) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ПП-49210"
                    value={payoutTxNumber}
                    onChange={(e) => setPayoutTxNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Дата перевода:
                  </label>
                  <input
                    type="date"
                    required
                    value={payoutDate}
                    onChange={(e) => setPayoutDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Назначение платежа / Примечание:
                </label>
                <textarea
                  rows={2}
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayout}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isSubmittingPayout ? 'Фиксация...' : 'Подтвердить исполнение выплаты'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
