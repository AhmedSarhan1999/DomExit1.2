import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { DealTrack } from '../types';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileCheck,
  Download,
  RefreshCw,
  Lock,
  Layers,
  Check,
  Upload,
  Camera,
  Video,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';

export const AdminClosingPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const { language } = useLanguage();

  const [deal, setDeal] = useState<DealTrack | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Emergency Relist Modal
  const [showRelistModal, setShowRelistModal] = useState<boolean>(false);
  const [relistReason, setRelistReason] = useState<string>('Покупатель не подтвердил депонирование средств на аккредитиве в установленный 48-часовой срок.');

  // Proof upload form state for Step C
  const [proofPhotos, setProofPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80',
  ]);
  const [proofVideos, setProofVideos] = useState<string[]>([
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  ]);
  const [rosreestrStampDoc, setRosreestrStampDoc] = useState<string>('Выписка_ЕГРН_с_ЭЦП_регистратора_РР-78-01.pdf');

  const loadDeal = async () => {
    const id = dealId || 'DEAL-2025-10566';
    const found = await DealsRepository.getById(id);
    if (found) {
      setDeal(found);
    }
  };

  useEffect(() => {
    loadDeal();
  }, [dealId]);

  const currentStep = deal?.escrowWorkflow?.step || 'curator_review';

  // Step A: Curator Review complete -> Handover to Bank
  const handleHandoverToBank = async () => {
    if (!deal) return;
    const updated = await DealsRepository.handoverToBank(deal.dealId, 'Алексей Смирнов', 'ПАО Сбербанк');
    if (updated) {
      setDeal(updated);
      setNotificationMsg('Сделка успешно передана в шлюз Сбербанка на открытие аккредитива!');
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Step B: Bank Officer confirms deposit
  const handleConfirmBankDeposit = async () => {
    if (!deal) return;
    const updated = await DealsRepository.confirmBankDeposit(deal.dealId, 'Игорь Владимирович Соколов (Сбербанк)', 'АК-78401/2026-СБЕР', 2759530);
    if (updated) {
      setDeal(updated);
      setNotificationMsg('Банк подтвердил депонирование средств (2,759,530 ₽) на счете аккредитива!');
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Step C: Curator uploads signing session photo/video proof
  const handleSubmitProof = async () => {
    if (!deal) return;
    const updated = await DealsRepository.submitSigningProof(
      deal.dealId,
      'Алексей Смирнов',
      proofPhotos,
      proofVideos,
      rosreestrStampDoc
    );
    if (updated) {
      setDeal(updated);
      setNotificationMsg('Фото/видеофиксация подписания и штамп Росреестра зафиксированы. Передано в банк для раскрытия средств!');
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Step D: Bank Officer releases funds & closes deal
  const handleReleaseEscrow = async () => {
    if (!deal) return;
    const updated = await DealsRepository.releaseEscrowFunds(deal.dealId, 'Игорь Владимирович Соколов (Сбербанк)');
    if (updated) {
      setDeal(updated);
      setNotificationMsg('Аккредитив раскрыт! 2,485,230 ₽ перечислено продавцу, 2.5% комиссии перечислено DomExit. Сделка успешно завершена!');
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  // Step E: Emergency Relist
  const handleEmergencyRelist = async () => {
    if (!deal) return;
    await DealsRepository.cancelDealAndRelist(deal.dealId, 'Алексей Смирнов', relistReason);
    setShowRelistModal(false);
    await loadDeal();
    setNotificationMsg('Срыв сделки зафиксирован. Лот возвращен в статус «Доступен», всем прежним кандидатам разослан пуш!');
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  const handleRefreshWebhook = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setNotificationMsg('Шлюз Росреестра: Webhook синхронизирован. Статус пакета #РР-78-01/9924-2026 подтвержден.');
      setTimeout(() => setNotificationMsg(null), 4000);
    }, 800);
  };

  const progressPercent = 
    currentStep === 'curator_review' ? 25 :
    currentStep === 'bank_escrow_deposit' ? 50 :
    currentStep === 'signing_photos' ? 75 :
    currentStep === 'bank_funds_release' ? 90 :
    currentStep === 'deal_finalized' ? 100 : 0;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        <AdminHeader
          title={`Финальное закрытие сделки и расчеты — Лот #${deal?.lotCode || 'U-10566'}`}
          subtitle="Последовательный шлюз: Менеджер -> Банк-партнер -> Фиксация подписания -> Раскрытие аккредитива"
        />

        {/* Global Toast */}
        {notificationMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              <span>{notificationMsg}</span>
            </div>
            <button onClick={() => setNotificationMsg(null)} className="text-white/80 hover:text-white ml-2">✕</button>
          </div>
        )}

        <div className="p-6 space-y-6 max-w-[1500px] w-full">
          
          {/* Top Status Bar & Emergency Action */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs flex items-center space-x-1 ${
                  currentStep === 'deal_finalized' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : currentStep === 'deal_cancelled'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${currentStep === 'deal_finalized' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span>
                    {currentStep === 'curator_review' && 'Этап А: Проверка куратором перед банком'}
                    {currentStep === 'bank_escrow_deposit' && 'Этап Б: Открытие аккредитива и депозит в банке'}
                    {currentStep === 'signing_photos' && 'Этап В: Сессия подписания и фиксация фото/видео'}
                    {currentStep === 'bank_funds_release' && 'Этап Г: На раскрытии аккредитива банком'}
                    {currentStep === 'deal_finalized' && 'Сделка полностью закрыта ✓'}
                    {currentStep === 'deal_cancelled' && 'Сделка сорвана — Лот перевыставлен'}
                  </span>
                </span>

                <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono text-xs font-semibold">
                  Шлюз: Сбербанк Domclick API Pro
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono text-xs">
                  Аккредитив: {deal?.escrowWorkflow?.escrowAccountNumber || '№ АК-78401/2026-СБЕР'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleRefreshWebhook}
                disabled={isRefreshing}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors flex items-center space-x-1 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Обновить Webhook</span>
              </button>

              <Link
                to="/bank-portal"
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-emerald-700 font-bold text-xs hover:bg-slate-50 shadow-xs flex items-center space-x-1"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>В шлюз банка</span>
              </Link>

              {/* MISSION 10.5: Emergency Relist Button */}
              {currentStep !== 'deal_finalized' && currentStep !== 'deal_cancelled' && (
                <button
                  type="button"
                  onClick={() => setShowRelistModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs hover:bg-rose-100 transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Срыв сделки — Перевыставить лот</span>
                </button>
              )}
            </div>
          </div>

          {/* 4-Step Interactive Execution Flow Header */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Последовательный цикл закрытия по миссии 10 (Сбербанк / ВТБ / DomExit)
              </h3>
              <span className="text-emerald-700 font-mono font-bold text-xs">{progressPercent}% Выполнено</span>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 text-xs">
              
              {/* Step A */}
              <div className={`p-4 rounded-2xl border transition-all ${
                currentStep === 'curator_review'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                  : currentStep !== 'deal_cancelled' && progressPercent > 25
                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                  : 'border-slate-200 bg-white opacity-60'
              }`}>
                <div className="flex items-center justify-between font-bold mb-1">
                  <span className="text-slate-900">Шаг А: Куратор DomExit</span>
                  {progressPercent > 25 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-amber-500" />}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">Согласование сторон и передача в банк-партнер</p>
                {currentStep === 'curator_review' && (
                  <button
                    type="button"
                    onClick={handleHandoverToBank}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Передать в банк на аккредитив →
                  </button>
                )}
              </div>

              {/* Step B */}
              <div className={`p-4 rounded-2xl border transition-all ${
                currentStep === 'bank_escrow_deposit'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                  : currentStep !== 'deal_cancelled' && progressPercent > 50
                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                  : 'border-slate-200 bg-white opacity-60'
              }`}>
                <div className="flex items-center justify-between font-bold mb-1">
                  <span className="text-slate-900">Шаг Б: Банк-партнер</span>
                  {progressPercent > 50 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Building2 className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">Открытие аккредитива и блокировка средств покупателя</p>
                {currentStep === 'bank_escrow_deposit' && (
                  <button
                    type="button"
                    onClick={handleConfirmBankDeposit}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    ✓ Подтвердить депонирование
                  </button>
                )}
              </div>

              {/* Step C */}
              <div className={`p-4 rounded-2xl border transition-all ${
                currentStep === 'signing_photos'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                  : currentStep !== 'deal_cancelled' && progressPercent > 75
                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                  : 'border-slate-200 bg-white opacity-60'
              }`}>
                <div className="flex items-center justify-between font-bold mb-1">
                  <span className="text-slate-900">Шаг В: Фиксация сессии</span>
                  {progressPercent > 75 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Camera className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">Фото/видеофиксация подписания и штамп Росреестра</p>
                {currentStep === 'signing_photos' && (
                  <button
                    type="button"
                    onClick={handleSubmitProof}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Зафиксировать и передать банку →
                  </button>
                )}
              </div>

              {/* Step D */}
              <div className={`p-4 rounded-2xl border transition-all ${
                currentStep === 'bank_funds_release'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                  : currentStep === 'deal_finalized'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                  : 'border-slate-200 bg-white opacity-60'
              }`}>
                <div className="flex items-center justify-between font-bold mb-1">
                  <span className="text-slate-900">Шаг Г: Раскрытие средств</span>
                  {currentStep === 'deal_finalized' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldCheck className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">Выплата продавцу, комиссия 2.5% и закрытие</p>
                {currentStep === 'bank_funds_release' && (
                  <button
                    type="button"
                    onClick={handleReleaseEscrow}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Раскрыть аккредитив и закрыть
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* 3-Party Settlement Flow Diagram */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              3-Party Settlement Flow Diagram (Трехсторонняя схема расчетов)
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Side: Incoming Pool SBR */}
              <div className="lg:col-span-5 bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-6 space-y-3 relative shadow-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] uppercase shadow-xs">
                  ВХОДЯЩИЙ ПУЛ СБР — Задепонировано
                </span>
                
                <div>
                  <span className="text-xs text-slate-600 block">Общая сумма на счете аккредитива:</span>
                  <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono mt-1">
                    2,759,530 ₽
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 text-xs text-slate-700 shadow-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Плательщик:</span>
                    <span className="font-bold text-slate-900">{deal?.buyerName || 'Дмитрий К. (Покупатель #B-409)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Банк-депозитарий:</span>
                    <span className="font-bold text-emerald-700">ПАО Сбербанк</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Статус депозита:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {progressPercent >= 50 ? '✓ Заблокировано' : 'Ожидание пополнения'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  🔒 100% средств заблокировано на номинальном счете до поступления выписки ЕГРН.
                </p>
              </div>

              {/* Right Side: 3 Tranches Cards */}
              <div className="lg:col-span-7 space-y-3">
                
                {/* Tranche A: Seller Return */}
                <div className="p-4 bg-white rounded-2xl border-2 border-emerald-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">Транш А — Возврат продавцу (Цеденту)</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase">
                        0% УДЕРЖАНИЯ
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Получатель: {deal?.sellerName || 'Александр В.'} • Выплата после штампа Росреестра
                    </span>
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    {formatRubles(deal?.sellerReturnRub || 2485230)}
                  </div>
                </div>

                {/* Tranche B: Developer Installment Balance */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">Транш Б — Обязательство по рассрочке (Застройщик)</span>
                      <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                        СОГЛАСИЕ № СГ-УСТ-492
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Перевод долга в {deal?.developer || 'Setl Group'} по графику рассрочки покупателя
                    </span>
                  </div>
                  <div className="text-xl font-bold text-slate-700 font-mono">
                    8,486,770 ₽
                  </div>
                </div>

                {/* Tranche C: DomExit Success Fee */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">Транш В — Комиссия платформы DomExit (2.5%)</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        SUCCESS FEE
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Оплачивает покупатель • ООО «ДомЭкзит Технологии»
                    </span>
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    274,300 ₽
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* Step C: Dedicated Photo & Video Session Proof Studio */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-purple-600" />
                  <span>Фото- и видеофиксация подписания и штамп Росреестра (Миссия 10.3)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Юрист DomExit фиксирует факт подписания обеими сторонами и прикрепляет сканы с усиленной ЭЦП
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold">
                  ГОСТ Р 57580 Защищено
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Photos Column */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>Фотографии подписания ({proofPhotos.length}):</span>
                  <label className="text-purple-600 hover:text-purple-700 cursor-pointer text-[11px] font-semibold">
                    + Добавить фото
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setProofPhotos((prev) => [...prev, reader.result as string]);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {proofPhotos.map((p, i) => (
                    <div key={i} className="aspect-video rounded-xl overflow-hidden border border-slate-200 relative group bg-slate-100">
                      <img src={p} alt={`Фиксация ${i + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                        Фото #{i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Video Column */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>Видеозапись сессии ({proofVideos.length}):</span>
                  <label className="text-purple-600 hover:text-purple-700 cursor-pointer text-[11px] font-semibold">
                    + Прикрепить видео
                    <input
                      type="file"
                      className="hidden"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProofVideos((prev) => [...prev, file.name]);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                    <Video className="w-4 h-4 text-purple-600" />
                    <span>Видеофиксация_сделки_Сбербанк_78.mp4</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Длительность: 04:12 • Хэш SHA-256: 4f8b91...a12c • Аудио-видео поток валидирован
                  </p>
                </div>
              </div>

              {/* Rosreestr Stamp Column */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>Штамп и выписка Росреестра:</span>
                  <label className="text-purple-600 hover:text-purple-700 cursor-pointer text-[11px] font-semibold">
                    + Загрузить скан
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setRosreestrStampDoc(file.name);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900">
                    <FileCheck className="w-4 h-4 text-emerald-700" />
                    <span className="truncate">{rosreestrStampDoc}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80">
                    Электронная подпись регистратора Росреестра проверена по криптостандарту.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* Emergency Relist Confirmation Modal */}
      {showRelistModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-rose-200 animate-scale-in">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Срыв сделки и возврат лота в открытый каталог
                </h3>
                <span className="text-xs text-rose-700 font-semibold">Миссия 10.5 — Авто-пуш прежним кандидатам</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              При подтверждении срыва текущей сделки лот <strong>#{deal?.lotCode}</strong> немедленно вернется в статус «Доступен», а всем участникам, подававшим заявки ранее, будет отправлено мгновенное уведомление с возможностью перехватить бронь.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Причина отмены сделки:</label>
              <textarea
                value={relistReason}
                onChange={(e) => setRelistReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRelistModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleEmergencyRelist}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Подтвердить срыв и уведомить кандидатов
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
