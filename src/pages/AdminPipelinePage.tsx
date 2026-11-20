import React, { useState, useEffect } from 'react';

import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import { formatRubles } from '../utils/formatters';

import { AdminSidebar } from '../components/layout/AdminSidebar';

import { AdminHeader } from '../components/layout/AdminHeader';

import { DealsRepository } from '../dal/repositories/DealsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';

import { DatabaseGateway } from '../dal/DatabaseGateway';

import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';

import { DealTrack, Lot, DocumentMetadata } from '../types';
import { StorageService } from '../dal/StorageService';
import { CuratorChatRepository } from '../dal/repositories/CuratorChatRepository';
import { CuratorChatWidget } from '../components/chat/CuratorChatWidget';
import { downloadDocumentFile } from '../utils/downloadManager';

import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  MessageSquare,
  FileText,
  Download,
  Eye,
  ExternalLink,
  ShieldCheck,
  Building2,
  User,
  Sliders,
  Clock,
  ChevronRight,
} from 'lucide-react';



export const AdminPipelinePage: React.FC = () => {

  const { user } = useAuth();

  const [deals, setDeals] = useState<DealTrack[]>([]);

  const [activeRouteFilter, setActiveRouteFilter] = useState<string>('all');

  const [urgentOnly, setUrgentOnly] = useState<boolean>(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // CRM Slide-Over Drawer & Curator Chat State
  const [selectedDealForDrawer, setSelectedDealForDrawer] = useState<DealTrack | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'chat'>('overview');
  const [drawerLot, setDrawerLot] = useState<Lot | null>(null);
  const [drawerDocs, setDrawerDocs] = useState<DocumentMetadata[]>([]);
  const [loadingDrawerDocs, setLoadingDrawerDocs] = useState<boolean>(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});



  const isEmployee = user?.activeRole === 'employee';

  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';

  const operatorName =

    user?.name || (isEmployee ? 'Алексей Смирнов (Куратор)' : 'Ahmed Abdallah (Владелец / CEO)');



  useEffect(() => {

    async function loadDeals() {

      const data = isEmployee

        ? await DealsRepository.getByEmployee(currentEmployeeId)

        : await DealsRepository.getAll();

      setDeals(data);

    }

    loadDeals();

    const unsub = DatabaseGateway.subscribe(() => {

      loadDeals();

    });

    return unsub;
  }, [isEmployee, currentEmployeeId]);

  // Load details & documents when a deal is selected in Slide-Over Drawer
  useEffect(() => {
    if (!selectedDealForDrawer) {
      setDrawerLot(null);
      setDrawerDocs([]);
      return;
    }
    async function loadDrawerDetails() {
      setLoadingDrawerDocs(true);
      try {
        const [lot, docs] = await Promise.all([
          LotsRepository.getByCode(selectedDealForDrawer!.lotCode),
          StorageService.getDocumentsByEntity('lot', selectedDealForDrawer!.lotCode),
        ]);
        setDrawerLot(lot);
        setDrawerDocs(docs);
      } catch (err) {
        console.warn('Failed to load drawer info:', err);
      } finally {
        setLoadingDrawerDocs(false);
      }
    }
    loadDrawerDetails();
  }, [selectedDealForDrawer]);

  // Track unread messages for badges
  useEffect(() => {
    async function loadUnreads() {
      const dialogs = await CuratorChatRepository.getRecentDialogs(
        isEmployee ? currentEmployeeId : undefined,
        !isEmployee
      );
      const map: Record<string, number> = {};
      dialogs.forEach((d) => {
        map[d.lotCode] = d.unreadCount;
        if (d.dealId) map[d.dealId] = d.unreadCount;
      });
      setUnreadMap(map);
    }
    loadUnreads();
    const unsub = CuratorChatRepository.subscribe(() => {
      loadUnreads();
    });
    return unsub;
  }, [isEmployee, currentEmployeeId]);



  const moveDealStage = async (deal: DealTrack, nextStage: DealTrack['stage'], nextLabel: string) => {

    const updated = await DealsRepository.updateStage(deal.dealId, nextStage);

    if (updated) {

      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));

      const stageNumMap: Record<DealTrack['stage'], number> = {
        initial_audit: 1,
        document_check: 2,
        packaging: 3,
        buyer_matching: 4,
        closing_escrow: 5,
        completed: 5,
      };
      try {
        const lot = await LotsRepository.getByCode(deal.lotCode);
        if (lot) {
          lot.currentStage = stageNumMap[nextStage] || 3;
          if (nextStage === 'closing_escrow') lot.status = 'in_deal';
          else if (nextStage === 'completed') lot.status = 'closed';
          else if (nextStage === 'buyer_matching') lot.status = 'available';
          await LotsRepository.update(lot);
        }
      } catch (lotErr) {
        console.warn('[AdminPipelinePage] Failed to sync lot stage:', lotErr);
      }

      await AuditLogsRepository.addLog({

        lotCode: deal.lotCode,

        dealId: deal.dealId,

        operatorName,

        operatorRole: isEmployee ? 'curator' : 'owner',

        actionType: 'packaging_published',

        title: `Сделка ${deal.dealId} (#${deal.lotCode}) переведена на этап: ${nextLabel}`,

        description: `Оператор ${operatorName} обновил статус сделки в канбан-воронке.`,

      });



      setToastMsg(`Сделка #${deal.lotCode} переведена: ${nextLabel}`);

      setTimeout(() => setToastMsg(null), 4000);

    }

  };



  const dduCount = deals.filter((d) => d.route === 'ddu_assignment').length;

  const fastCashCount = deals.filter((d) => d.route === 'fast_cash').length;

  const tradeInCount = deals.filter((d) => d.route === 'trade_in_6').length;

  const urgentCount = deals.filter((d) => d.daysLeft <= 14).length;



  const avgDays =

    deals.length > 0

      ? (deals.reduce((acc, d) => acc + Math.max(1, d.daysLeft), 0) / deals.length).toFixed(1)

      : '9.5';



  const filteredDeals = deals.filter((d) => {

    if (activeRouteFilter !== 'all' && d.route !== activeRouteFilter) return false;

    if (urgentOnly && d.daysLeft > 14) return false;

    return true;

  });



  const columns: {

    stage: DealTrack['stage'];

    title: string;

    next?: DealTrack['stage'];

    nextTitle?: string;

  }[] = [

    {

      stage: 'initial_audit',

      title: '1. Первичный аудит ДДУ',

      next: 'document_check',

      nextTitle: 'В документы →',

    },

    {

      stage: 'document_check',

      title: '2. Проверка документов',

      next: 'packaging',

      nextTitle: 'В упаковку →',

    },

    {

      stage: 'packaging',

      title: '3. Упаковка и публикация',

      next: 'buyer_matching',

      nextTitle: 'В подбор →',

    },

    {

      stage: 'buyer_matching',

      title: '4. Подбор покупателя',

      next: 'closing_escrow',

      nextTitle: 'На эскроу →',

    },

    { stage: 'closing_escrow', title: '5. Сделка и выплата (Эскроу)' },

  ];



  return (

    <div className="flex min-h-screen bg-slate-50 text-slate-900">

      <AdminSidebar />



      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        <AdminHeader

          title={

            isEmployee

              ? 'Моя воронка сопровождения сделок (Изолированный контур)'

              : 'Глобальная воронка сопровождения выходов и сделок'

          }

          subtitle="Канбан-управление этапами переуступок 214-ФЗ, комплаенса 152-ФЗ и банковских расчетов"

        />



        {toastMsg && (

          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between">

            <div className="flex items-center space-x-2">

              <CheckCircle2 className="w-4 h-4 shrink-0" />

              <span>{toastMsg}</span>

            </div>

            <button onClick={() => setToastMsg(null)} className="text-white/80 hover:text-white cursor-pointer">

              ✕

            </button>

          </div>

        )}



        <div className="p-6 space-y-6 max-w-[1600px] w-full">

          {/* Top Conversion Bar */}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">

            <div>

              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">

                {isEmployee ? `КУРАТОР: ${operatorName}` : 'ИНСТИТУЦИОНАЛЬНЫЙ КОНТРОЛЬ'}

              </span>

              <h2 className="text-xl font-black text-slate-900">

                Канбан-воронка 5 этапов ({deals.length} сделок)

              </h2>

            </div>



            <div className="flex items-center space-x-4">

              <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-right shadow-xs">

                <span className="text-[10px] text-slate-500 uppercase block">Активных в работе</span>

                <span className="text-base font-black text-emerald-700">{deals.length}</span>

              </div>

              <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-right shadow-xs">

                <span className="text-[10px] text-slate-500 uppercase block">Средний резерв</span>

                <span className="text-base font-black text-sky-700">{avgDays} дн.</span>

              </div>

            </div>

          </div>



          {/* Route Filters & Controls */}

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">

              {[

                { id: 'all', label: `Все маршруты (${deals.length})` },

                { id: 'ddu_assignment', label: `Маршрут 1: ДДУ Переуступка (${dduCount})` },

                { id: 'fast_cash', label: `Маршрут 2: Быстрый кэш (${fastCashCount})` },

                { id: 'trade_in_6', label: `Маршрут 3: Трейд-ин 6% (${tradeInCount})` },

              ].map((r) => (

                <button

                  key={r.id}

                  type="button"

                  onClick={() => setActiveRouteFilter(r.id)}

                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${

                    activeRouteFilter === r.id

                      ? 'bg-white text-emerald-800 font-bold shadow-xs'

                      : 'text-slate-600 hover:text-slate-900'

                  }`}

                >

                  {r.label}

                </button>

              ))}

            </div>



            <div className="flex items-center space-x-2">

              <button

                type="button"

                onClick={() => setUrgentOnly(!urgentOnly)}

                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs ${

                  urgentOnly

                    ? 'bg-rose-600 text-white border-rose-600'

                    : 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'

                }`}

              >

                <AlertTriangle className="w-3.5 h-3.5" />

                <span>&le;14 дней ({urgentCount})</span>

              </button>



              <Link

                to="/sellers"

                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"

              >

                <Plus className="w-3.5 h-3.5 stroke-[3]" />

                <span>Создать сделку</span>

              </Link>

            </div>

          </div>



          {/* Zero-State or 5 Interactive Kanban Columns */}

          {deals.length === 0 ? (

            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 my-8 shadow-xs">

              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">

                <CheckCircle2 className="w-8 h-8" />

              </div>

              <div className="max-w-md mx-auto space-y-2">

                <h3 className="text-lg font-bold text-slate-900">

                  Нет активных сделок на аудите — ожидаются входящие заявки от дольщиков

                </h3>

                <p className="text-xs text-slate-500">

                  Все входящие запросы на переуступку по 214-ФЗ автоматически поступают в этот канбан после первичного скоринга.

                </p>

              </div>

              <Link

                to="/sellers"

                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center space-x-2"

              >

                <Plus className="w-4 h-4" />

                <span>Подать заявку на выход из ДДУ</span>

              </Link>

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">

            {columns.map((col) => {

              const colDeals = filteredDeals.filter(

                (d) =>

                  d.stage === col.stage ||

                  (col.stage === 'closing_escrow' && d.stage === 'completed')

              );

              const colVolume = colDeals.reduce((sum, d) => sum + d.sellerReturnRub, 0);



              return (

                <div

                  key={col.stage}

                  className="bg-slate-100/70 rounded-2xl border border-slate-200 p-3.5 space-y-3 min-h-[550px] flex flex-col justify-between"

                >

                  <div className="space-y-1 pb-2 border-b border-slate-200">

                    <div className="flex justify-between items-center">

                      <h4 className="text-xs font-bold text-slate-900 tracking-tight truncate">

                        {col.title}

                      </h4>

                      <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-emerald-700 font-mono font-bold text-[10px] flex items-center justify-center shadow-xs">

                        {colDeals.length}

                      </span>

                    </div>

                    <span className="text-[10px] text-slate-500 block font-mono">

                      Объем: {formatRubles(colVolume)}

                    </span>

                  </div>



                  <div className="space-y-3 flex-1 overflow-y-auto">

                    {colDeals.length === 0 ? (

                      <div className="py-12 text-center text-xs text-slate-400">

                        Нет активных сделок на этапе

                      </div>

                    ) : (

                      colDeals.map((deal) => (

                        <div

                          key={deal.id}

                          className="bg-white border border-slate-200/90 hover:border-emerald-300 rounded-xl p-3.5 space-y-2.5 transition-all shadow-xs"

                        >

                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-mono font-bold text-slate-800">
                              #{deal.lotCode}
                            </span>

                            <div className="flex items-center space-x-1.5">
                              {unreadMap[deal.lotCode] > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] flex items-center space-x-0.5 animate-pulse">
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  <span>{unreadMap[deal.lotCode]}</span>
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  deal.daysLeft <= 6
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {deal.daysLeft === 0 ? 'Закрыто' : `${deal.daysLeft} дн.`}
                              </span>
                            </div>
                          </div>



                          <div>

                            <h5 className="font-bold text-xs text-slate-900 leading-tight">

                              {deal.lotTitle}

                            </h5>

                            <span className="text-[10px] text-slate-500 block mt-0.5">

                              {deal.developer} • Клиент: {deal.clientName}

                            </span>

                          </div>



                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px] space-y-0.5 font-mono">

                            <div className="flex justify-between text-emerald-700 font-bold">

                              <span>Возврат:</span>

                              <span>{formatRubles(deal.sellerReturnRub)}</span>

                            </div>

                            <div className="flex justify-between text-slate-500">

                              <span>Дисконт:</span>

                              <span>-{formatRubles(deal.discountRub)}</span>

                            </div>

                          </div>



                          {/* Direct Operational Links */}

                          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">

                            <Link

                              to={`/admin/legal-audit/${deal.lotCode}`}

                              className="py-1 px-2 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-center"

                            >

                              ⚖️ Аудит

                            </Link>

                            <Link

                              to={

                                deal.stage === 'closing_escrow'

                                  ? `/admin/closing/${deal.dealId}`

                                  : deal.stage === 'buyer_matching'

                                  ? `/admin/matchmaker/${deal.lotCode}`

                                  : `/admin/packaging/${deal.lotCode}`

                              }

                              className="py-1 px-2 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-center"

                            >

                              {deal.stage === 'closing_escrow'

                                ? '🏦 Эскроу'

                                : deal.stage === 'buyer_matching'

                                ? '👥 Подбор'

                                : '📦 Упаковка'}

                            </Link>

                          </div>



                          <div className="flex items-center space-x-2 text-[10px] text-slate-500">

                            <span className="text-emerald-700 flex items-center space-x-1 font-semibold">

                              <CheckCircle2 className="w-3 h-3" />

                              <span>ФССП: Чисто</span>

                            </span>

                            <span>•</span>

                            <span className="truncate">{deal.curatorName}</span>

                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDealForDrawer(deal);
                              setDrawerTab('overview');
                            }}
                            className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-all flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer"
                          >
                            <Sliders className="w-3 h-3 text-emerald-400" />
                            <span>Панель сделки & Чат</span>
                          </button>

                          {col.next && (

                            <button

                              type="button"

                              onClick={() =>

                                moveDealStage(deal, col.next!, col.nextTitle || col.next!)

                              }

                              className="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-[11px] font-bold transition-all flex items-center justify-center space-x-1 border border-slate-200 shadow-xs cursor-pointer"

                            >

                              <span>{col.nextTitle}</span>

                            </button>

                          )}

                        </div>

                      ))

                    )}

                  </div>

                </div>

              );

            })}

          </div>

          )}

        </div>

      </div>

      {/* CRM SLIDE-OVER DRAWER FOR DEAL & CURATOR CHAT */}
      {selectedDealForDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs animate-fade-in flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
            {/* Drawer Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-400/30">
                    #{selectedDealForDrawer.lotCode}
                  </span>
                  <span className="text-xs text-slate-300">Сделка {selectedDealForDrawer.dealId}</span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  {selectedDealForDrawer.lotTitle || selectedDealForDrawer.developer}
                </h3>
                <p className="text-xs text-slate-300">
                  Клиент: {selectedDealForDrawer.clientName} • Ответственный: {selectedDealForDrawer.curatorName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDealForDrawer(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center border-b border-slate-200 px-6 pt-3 bg-slate-50 gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setDrawerTab('overview')}
                className={`pb-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
                  drawerTab === 'overview'
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Досье и документы ({drawerDocs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('chat')}
                className={`pb-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer relative ${
                  drawerTab === 'chat'
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Чат с клиентом</span>
                {(unreadMap[selectedDealForDrawer.lotCode] || 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px]">
                    {unreadMap[selectedDealForDrawer.lotCode]}
                  </span>
                )}
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {drawerTab === 'overview' && (
                <div className="space-y-6">
                  {/* Financial Overview */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Финансовые параметры сделки
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Возврат продавцу:</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {formatRubles(selectedDealForDrawer.sellerReturnRub)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Дисконт покупателю:</span>
                        <span className="font-bold text-emerald-700 text-sm">
                          -{formatRubles(selectedDealForDrawer.discountRub)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Маршрут:</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {selectedDealForDrawer.route}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      to={`/admin/legal-audit/${selectedDealForDrawer.lotCode}`}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold text-center flex items-center justify-center space-x-1.5 border border-slate-200"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Юр. аудит</span>
                    </Link>
                    <Link
                      to={`/admin/packaging/${selectedDealForDrawer.lotCode}`}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold text-center flex items-center justify-center space-x-1.5 border border-slate-200"
                    >
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Упаковка</span>
                    </Link>
                    <Link
                      to={`/admin/closing/${selectedDealForDrawer.dealId}`}
                      className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold text-center flex items-center justify-center space-x-1.5 border border-emerald-200"
                    >
                      <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Эскроу комната</span>
                    </Link>
                  </div>

                  {/* Document Vault in Drawer */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Документы по сделке в Yandex S3 ({drawerDocs.length})</span>
                      </h4>
                    </div>

                    {loadingDrawerDocs ? (
                      <div className="py-8 text-center text-xs text-slate-500">Загрузка документов из S3...</div>
                    ) : drawerDocs.length === 0 ? (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 space-y-1">
                        <p>В защищенном хранилище пока нет загруженных сканов по лоту #{selectedDealForDrawer.lotCode}.</p>
                        <p className="text-[11px] text-slate-400">Продавец может загрузить их через Личный кабинет.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {drawerDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-900 block truncate">{doc.name}</span>
                                <span className="text-[10px] text-slate-400 block">
                                  {doc.categoryLabelRu || doc.category} • {(doc.sizeBytes / 1024).toFixed(1)} КБ
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => downloadDocumentFile(doc)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-colors cursor-pointer"
                              title="Скачать документ"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Скачать</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {drawerTab === 'chat' && (
                <div className="h-[520px]">
                  <CuratorChatWidget
                    isOpen={true}
                    onClose={() => {}}
                    embedded={true}
                    lotCode={selectedDealForDrawer.lotCode}
                    dealId={selectedDealForDrawer.dealId}
                    lotTitle={selectedDealForDrawer.lotTitle}
                    curatorId={selectedDealForDrawer.assignedEmployeeId || currentEmployeeId}
                    curatorName={operatorName}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>

  );

};

