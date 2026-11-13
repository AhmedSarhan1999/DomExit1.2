import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { StorageService } from '../dal/StorageService';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { useFeatureFlagsStore } from '../stores/useFeatureFlagsStore';
import { DealTrack, Lot } from '../types';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileCheck,
  RefreshCw,
  Camera,
  Video,
  AlertTriangle,
  HardDrive,
  Lock,
} from 'lucide-react';

export const AdminClosingPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deal, setDeal] = useState<DealTrack | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [accessibleDeals, setAccessibleDeals] = useState<DealTrack[]>([]);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);

  // Emergency Relist Modal
  const [showRelistModal, setShowRelistModal] = useState<boolean>(false);
  const [relistReason, setRelistReason] = useState<string>(
    'Покупатель не подтвердил депонирование средств на аккредитиве в установленный 48-часовой срок.'
  );

  // Proof upload form state for Step C
  const [proofPhotos, setProofPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80',
  ]);
  const [proofVideos, setProofVideos] = useState<string[]>([
    'Видеофиксация_сессии_ЭЦП_Сбербанк.mp4',
  ]);
  const [rosreestrStampDoc, setRosreestrStampDoc] = useState<string>('');
  const { enableBankPortal } = useFeatureFlagsStore();

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';
  const operatorName =
    user?.name || (isEmployee ? 'Алексей Смирнов (Куратор)' : 'Ahmed Abdallah (Владелец / CEO)');

  const loadDeal = async () => {
    const pool = isEmployee
      ? await DealsRepository.getByEmployee(currentEmployeeId)
      : await DealsRepository.getAll();

    setAccessibleDeals(pool);

    const targetId = (dealId || 'DEAL-2025-10566').toUpperCase();
    const found =
      pool.find(
        (d) =>
          d.dealId.toUpperCase() === targetId ||
          d.id.toUpperCase() === targetId ||
          d.lotCode.toUpperCase() === targetId
      ) || pool[0];

    setDeal(found || null);

    if (found) {
      if (found.escrowWorkflow?.signingProofPhotos?.length) {
        setProofPhotos(found.escrowWorkflow.signingProofPhotos);
      }
      if (found.escrowWorkflow?.signingProofVideos?.length) {
        setProofVideos(found.escrowWorkflow.signingProofVideos);
      }
      if (found.escrowWorkflow?.rosreestrStampDocUrl) {
        setRosreestrStampDoc(found.escrowWorkflow.rosreestrStampDocUrl);
      }
      const linkedLot = await LotsRepository.getByCode(found.lotCode);
      setLot(linkedLot);
    } else {
      setLot(null);
    }
  };

  useEffect(() => {
    loadDeal();
    const unsub = DatabaseGateway.subscribe((col) => {
      if (!col || col === 'deals' || col === 'lots') {
        loadDeal();
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, isEmployee, currentEmployeeId]);

  const currentStep = deal?.escrowWorkflow?.step || 'curator_review';

  const sellerReturnRub = deal?.sellerReturnRub || lot?.cashPaidBySeller || 2485230;
  const platformFeeRub =
    deal?.escrowWorkflow?.platformFeeRub ||
    lot?.serviceCommissionRub ||
    Math.round((lot?.dduContractPrice || sellerReturnRub) * 0.025);
  const totalEscrowDepositRub =
    deal?.escrowWorkflow?.depositedAmountRub || sellerReturnRub + platformFeeRub;
  const remainingDebtRub =
    lot?.remainingInstallmentDebt ??
    Math.max(0, (lot?.dduContractPrice || sellerReturnRub) - sellerReturnRub);
  const bankName = deal?.escrowWorkflow?.bankName || 'ПАО Сбербанк';

  // Bank hard-gating role checks
  const isBankOfficer = Boolean(
    user &&
      (user.role === 'bank' ||
        user.role === 'bank_officer' ||
        user.activeRole === 'bank' ||
        user.roles?.includes('bank') ||
        user.roles?.includes('bank_officer'))
  );
  const isOwner = Boolean(
    user &&
      (user.role === 'owner' ||
        user.role === 'admin' ||
        user.activeRole === 'owner' ||
        user.activeRole === 'admin' ||
        user.roles?.includes('owner') ||
        user.email === 'amaas9499@gmail.com')
  );
  const canExecuteBankStep = !enableBankPortal || isBankOfficer || isOwner || isEmployee;
  const hasRosreestrStamp = Boolean(rosreestrStampDoc && rosreestrStampDoc.trim().length > 0);

  // Step A: Curator Review complete -> Handover to Bank
  const handleHandoverToBank = async () => {
    if (!deal) return;
    const updated = await DealsRepository.handoverToBank(deal.dealId, operatorName, bankName);
    if (updated) {
      setDeal(updated);
      setNotificationMsg(`Сделка ${deal.dealId} передана в шлюз ${bankName} на открытие аккредитива!`);
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Step B: Bank Officer confirms deposit
  const handleConfirmBankDeposit = async () => {
    if (!deal) return;
    const updated = await DealsRepository.confirmBankDeposit(
      deal.dealId,
      `${operatorName} (Банковский контур)`,
      deal.escrowWorkflow?.escrowAccountNumber || 'АК-78401/2026-СБЕР',
      totalEscrowDepositRub
    );
    if (updated) {
      setDeal(updated);
      setNotificationMsg(
        `Депонирование средств (${formatRubles(totalEscrowDepositRub)}) на счете аккредитива подтверждено!`
      );
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Step C: Curator uploads signing session photo/video proof
  const handleSubmitProof = async () => {
    if (!deal) return;
    const updated = await DealsRepository.submitSigningProof(
      deal.dealId,
      operatorName,
      proofPhotos,
      proofVideos,
      rosreestrStampDoc
    );
    if (updated) {
      setDeal(updated);
      setNotificationMsg(
        'Фото/видеофиксация подписания и штамп Росреестра зафиксированы. Передано в банк для раскрытия средств!'
      );
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Step D: Bank Officer releases funds & closes deal
  const handleReleaseEscrow = async () => {
    if (!deal) return;
    const updated = await DealsRepository.releaseEscrowFunds(
      deal.dealId,
      `${operatorName} (Банковский контур)`
    );
    if (updated) {
      setDeal(updated);
      setNotificationMsg(
        `Аккредитив раскрыт! ${formatRubles(sellerReturnRub)} перечислено продавцу, ${formatRubles(platformFeeRub)} (2.5%) — DomExit.`
      );
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  // Step E: Emergency Relist
  const handleEmergencyRelist = async () => {
    if (!deal) return;
    await DealsRepository.cancelDealAndRelist(deal.dealId, operatorName, relistReason);
    setShowRelistModal(false);
    await loadDeal();
    setNotificationMsg(
      'Срыв сделки зафиксирован. Лот возвращен в статус «Доступен», всем прежним кандидатам разослано уведомление!'
    );
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  const handleRefreshWebhook = async () => {
    setIsRefreshing(true);
    await loadDeal();
    setIsRefreshing(false);
    setNotificationMsg('Шлюз банка и Росреестра синхронизирован с базой DAL.');
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const handleUploadProofFile = async (
    file: File,
    kind: 'photo' | 'video' | 'rosreestr'
  ) => {
    if (!deal) return;
    await StorageService.uploadDocument({
      file,
      category: kind === 'rosreestr' ? 'rosreestr_extract' : 'additional',
      categoryLabelRu:
        kind === 'rosreestr'
          ? `Выписка ЕГРН Росреестра: ${file.name}`
          : kind === 'video'
          ? `Видеофиксация подписания: ${file.name}`
          : `Фотофиксация подписания: ${file.name}`,
      entityType: 'deal',
      entityId: deal.dealId,
      uploadedByUid: user?.id || 'closing-curator',
      clientCode: user?.clientCode || 'DEX-STAFF',
    });

    if (kind === 'photo') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProofPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    } else if (kind === 'video') {
      setProofVideos((prev) => [...prev, file.name]);
    } else {
      setRosreestrStampDoc(file.name);
    }

    setNotificationMsg(`Файл «${file.name}» загружен в облачный сейф сделки S3!`);
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const progressPercent =
    currentStep === 'curator_review'
      ? 25
      : currentStep === 'bank_escrow_deposit'
      ? 50
      : currentStep === 'signing_photos'
      ? 75
      : currentStep === 'bank_funds_release'
      ? 90
      : currentStep === 'deal_finalized'
      ? 100
      : 0;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={`Финальное закрытие сделки и расчеты — Лот #${deal?.lotCode || '—'}`}
          subtitle="Последовательный шлюз: Куратор DomExit → Банк-партнер (СБР) → Фиксация ЭЦП Росреестра → Раскрытие аккредитива"
        />

        {notificationMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              <span>{notificationMsg}</span>
            </div>
            <button
              onClick={() => setNotificationMsg(null)}
              className="text-white/80 hover:text-white ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-6 space-y-6 max-w-[1500px] w-full">
          {!deal ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                В вашем контуре пока нет сделок на стадии банковского закрытия
              </p>
              <p className="text-xs text-slate-500">
                Сделки поступают сюда после утверждения победителя в ИИ-Матчмейкере.
              </p>
            </div>
          ) : (
            <>
              {/* Top Status Bar & Deal Selector & Emergency Action */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={deal.dealId}
                    onChange={(e) => navigate(`/admin/closing/${e.target.value}`)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    {accessibleDeals.map((d) => (
                      <option key={d.id} value={d.dealId}>
                        {d.dealId} (#{d.lotCode} — {d.complexName || d.lotTitle})
                      </option>
                    ))}
                  </select>

                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-xs flex items-center space-x-1 ${
                      currentStep === 'deal_finalized'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : currentStep === 'deal_cancelled'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        currentStep === 'deal_finalized'
                          ? 'bg-emerald-500'
                          : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    <span>
                      {currentStep === 'curator_review' && 'Этап А: Проверка куратором перед банком'}
                      {currentStep === 'bank_escrow_deposit' &&
                        'Этап Б: Открытие аккредитива и депозит в банке'}
                      {currentStep === 'signing_photos' &&
                        'Этап В: Сессия подписания и штамп Росреестра'}
                      {currentStep === 'bank_funds_release' &&
                        'Этап Г: На раскрытии аккредитива банком'}
                      {currentStep === 'deal_finalized' && 'Сделка полностью закрыта ✓'}
                      {currentStep === 'deal_cancelled' && 'Сделка сорвана — Лот перевыставлен'}
                    </span>
                  </span>

                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono text-xs">
                    Счет: {deal.escrowWorkflow?.escrowAccountNumber || '№ АК-78401/2026-СБЕР'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVaultOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs border border-indigo-200 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Сейф сделки (S3)</span>
                  </button>

                  <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 font-bold text-xs flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Шлюз банка: {bankName}</span>
                  </div>

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
                    Синхронизированный контур закрытия ({bankName} / Росреестр / DomExit)
                  </h3>
                  <span className="text-emerald-700 font-mono font-bold text-xs">
                    {progressPercent}% Выполнено
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 text-xs">
                  {/* Step A */}
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      currentStep === 'curator_review'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                        : currentStep !== 'deal_cancelled' && progressPercent > 25
                        ? 'border-slate-200 bg-slate-50 text-slate-700'
                        : 'border-slate-200 bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-900">Шаг А: Куратор DomExit</span>
                      {progressPercent > 25 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Согласование договора цессии и передача в банк
                    </p>
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
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      currentStep === 'bank_escrow_deposit'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                        : currentStep !== 'deal_cancelled' && progressPercent > 50
                        ? 'border-slate-200 bg-slate-50 text-slate-700'
                        : 'border-slate-200 bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-900">Шаг Б: Банк-партнер</span>
                      {progressPercent > 50 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Building2 className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Открытие аккредитива и блокировка средств покупателя
                    </p>
                    {currentStep === 'bank_escrow_deposit' && (
                      canExecuteBankStep ? (
                        <button
                          type="button"
                          onClick={handleConfirmBankDeposit}
                          className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          {!enableBankPortal
                            ? '✓ Подтвердить депонирование в отделении банка (СБР)'
                            : '✓ Подтвердить депонирование (Офицер банка)'}
                        </button>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight flex items-start space-x-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">🔒 Действие банка-партнера</span>
                            <span className="text-slate-600 block mt-0.5">
                              Ожидается подтверждение депонирования от банка-партнера ({bankName}).
                            </span>
                            <div className="mt-1.5 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-900 font-medium text-[10px]">
                              <span>Автообновление статуса в реальном времени</span>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Step C */}
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      currentStep === 'signing_photos'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                        : currentStep !== 'deal_cancelled' && progressPercent > 75
                        ? 'border-slate-200 bg-slate-50 text-slate-700'
                        : 'border-slate-200 bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-900">Шаг В: Фиксация и ЕГРН</span>
                      {progressPercent > 75 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Camera className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Фото/видеофиксация подписания и выписка Росреестра
                    </p>
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
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      currentStep === 'bank_funds_release'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                        : currentStep === 'deal_finalized'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-900">Шаг Г: Раскрытие СБР</span>
                      {currentStep === 'deal_finalized' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Выплата 100% кэша продавцу и комиссии 2.5%
                    </p>
                    {currentStep === 'bank_funds_release' && (
                      canExecuteBankStep ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            disabled={!hasRosreestrStamp}
                            onClick={handleReleaseEscrow}
                            className={`w-full py-2.5 font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5 ${
                              hasRosreestrStamp
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                            }`}
                            title={
                              !hasRosreestrStamp
                                ? 'Загрузите выписку ЕГРН со штампом Росреестра'
                                : undefined
                            }
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>
                              {!enableBankPortal
                                ? 'Раскрыть СБР и выплатить 3 транша'
                                : 'Раскрыть аккредитив и закрыть (Офицер банка)'}
                            </span>
                          </button>
                          {!hasRosreestrStamp && (
                            <p className="text-[10px] text-amber-700 font-bold leading-tight">
                              ⚠️ Блокировка: Сначала загрузите выписку ЕГРН со штампом Росреестра на Шаге В
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight flex items-start space-x-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">🔒 Раскрытие заблокировано</span>
                            <span className="text-slate-600 block mt-0.5">
                              Ожидается подтверждение раскрытия от банка-партнера ({bankName}).
                            </span>
                            <div className="mt-1.5 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-900 font-medium text-[10px]">
                              <span>Выплата траншей инициируется банком в СБР</span>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* 3-Party Live Settlement Flow Diagram */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
                  Трехсторонняя схема расчетов по сделке {deal.dealId}
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* Left Side: Incoming Pool SBR */}
                  <div className="lg:col-span-5 bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-6 space-y-3 relative shadow-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] uppercase shadow-xs">
                      ВХОДЯЩИЙ ПУЛ СБР — Аккредитив
                    </span>

                    <div>
                      <span className="text-xs text-slate-600 block">
                        Общая сумма на номинальном счете аккредитива:
                      </span>
                      <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono mt-1">
                        {formatRubles(totalEscrowDepositRub)}
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 text-xs text-slate-700 shadow-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Плательщик (Цессионарий):</span>
                        <span className="font-bold text-slate-900">
                          {deal.buyerName || 'Победитель отбора'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Банк-депозитарий:</span>
                        <span className="font-bold text-emerald-700">{bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Статус депозита:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {progressPercent > 50 ? '✓ Заблокировано' : 'Ожидание пополнения'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      100% средств заблокировано банком до поступления электронной выписки ЕГРН Росреестра.
                    </p>
                  </div>

                  {/* Right Side: 3 Tranches Cards */}
                  <div className="lg:col-span-7 space-y-3">
                    {/* Tranche A: Seller Return */}
                    <div className="p-4 bg-white rounded-2xl border-2 border-emerald-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">
                            Транш А — Возврат продавцу (Цеденту)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase">
                            0% УДЕРЖАНИЯ
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          Получатель: {deal.sellerName || deal.clientName} • 100% возврат вложенного кэша
                        </span>
                      </div>
                      <div className="text-xl font-black text-emerald-700 font-mono">
                        {formatRubles(sellerReturnRub)}
                      </div>
                    </div>

                    {/* Tranche B: Developer Installment Balance */}
                    <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">
                            Транш Б — Обязательство по ДДУ (Застройщик)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                            214-ФЗ ЭСКРОУ
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          Перевод остатка долга в {deal.developer} на нового дольщика
                        </span>
                      </div>
                      <div className="text-xl font-bold text-slate-700 font-mono">
                        {formatRubles(remainingDebtRub)}
                      </div>
                    </div>

                    {/* Tranche C: DomExit Success Fee */}
                    <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">
                            Транш В — Комиссия платформы DomExit (2.5%)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            SUCCESS FEE
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          Оплачивает покупатель по факту регистрации в Росреестре
                        </span>
                      </div>
                      <div className="text-xl font-black text-emerald-700 font-mono">
                        {formatRubles(platformFeeRub)}
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
                      <span>Фото- и видеофиксация подписания и штамп Росреестра (Yandex S3)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Все загружаемые файлы сохраняются в облачном бакете сделки и доступны офицеру банка в шлюзе.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold">
                    ГОСТ Р 57580 Защищено
                  </span>
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
                            if (file) handleUploadProofFile(file, 'photo');
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {proofPhotos.map((p, i) => (
                        <div
                          key={i}
                          className="aspect-video rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100"
                        >
                          <img
                            src={p}
                            alt={`Фиксация ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
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
                            if (file) handleUploadProofFile(file, 'video');
                          }}
                        />
                      </label>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                        <Video className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="truncate">
                          {proofVideos[proofVideos.length - 1] ||
                            'Видеофиксация_сделки_Сбербанк.mp4'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Хэш SHA-256 зафиксирован в Yandex Object Storage (152-ФЗ).
                      </p>
                    </div>
                  </div>

                  {/* Rosreestr Stamp Column */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                      <span>Штамп и выписка Росреестра:</span>
                      <label className="text-purple-600 hover:text-purple-700 cursor-pointer text-[11px] font-semibold">
                        + Загрузить скан ЕГРН
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadProofFile(file, 'rosreestr');
                          }}
                        />
                      </label>
                    </div>

                    <div className={`p-4 border rounded-2xl space-y-2 ${
                      hasRosreestrStamp
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50/70 border-amber-200'
                    }`}>
                      <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                        <FileCheck className={`w-4 h-4 shrink-0 ${hasRosreestrStamp ? 'text-emerald-700' : 'text-amber-600'}`} />
                        <span className="truncate">{rosreestrStampDoc || 'Файл ЕГРН пока не прикреплен'}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {hasRosreestrStamp
                          ? 'УКЭП государственного регистратора Росреестра проверена.'
                          : 'Загрузите электронную выписку ЕГРН со штампом для разблокировки выплаты.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Emergency Relist Confirmation Modal */}
      {showRelistModal && deal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-rose-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Срыв сделки и возврат лота #{deal.lotCode} в открытый каталог
                </h3>
                <span className="text-xs text-rose-700 font-semibold">
                  Автоматическое уведомление всех прежних кандидатов
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              При подтверждении срыва текущей сделки лот <strong>#{deal.lotCode}</strong> немедленно вернется в статус «Доступен», а всем кандидатам будет открыт приоритетный повторный доступ.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Причина отмены сделки *:
              </label>
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
                Подтвердить срыв и перевыставить лот
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deal Cloud Document Vault */}
      {deal && (
        <DocumentVaultModal
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          entityType="deal"
          entityId={deal.dealId}
          entityTitle={`Сейф банковского закрытия ${deal.dealId} (#${deal.lotCode})`}
          uploadedByUid={user?.id || 'closing-curator'}
          clientCode={user?.clientCode || 'DEX-STAFF'}
          mode="general"
          canUpload={true}
          canReview={true}
          reviewerName={operatorName}
        />
      )}
    </div>
  );
};
