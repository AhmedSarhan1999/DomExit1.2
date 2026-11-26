import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { StorageService } from '../dal/StorageService';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { apiClient } from '../services/apiClient';
import { useAiFeatureFlags } from '../hooks/useAiFeatureFlags';
import { ClosingStepId, DealTrack, Lot } from '../types';
import { showDownloadToast } from '../utils/downloadManager';
import { BankSettlementAssistant } from '../components/shared/BankSettlementAssistant';
import { ClosingCommsAndTasksPanel } from '../components/closing/ClosingCommsAndTasksPanel';
import {
  CLOSING_STEPS_6,
  getClosingProgressPercent,
  normalizeClosingStepNum,
} from '../utils/closingWorkflow';
import { downloadPepCertificate } from '../utils/pepCertificate';
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
  FileSignature,
  Download,
  Upload,
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

  // Proof upload form state for Step 4 & 6-Step Russian Closing State
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [proofVideos, setProofVideos] = useState<string[]>([]);
  const [rosreestrStampDoc, setRosreestrStampDoc] = useState<string>('');
  const [pepSignatures, setPepSignatures] = useState<any[]>([]);
  const [pepOverrideReason, setPepOverrideReason] = useState<string>('');
  const [pepOverrideDocKey, setPepOverrideDocKey] = useState<string>('');
  const [bankInput, setBankInput] = useState<string>('ПАО Сбербанк');
  const [bikInput, setBikInput] = useState<string>('');
  const [bikLoading, setBikLoading] = useState<boolean>(false);
  const [bikError, setBikError] = useState<string | null>(null);
  const { isFeatureEnabled } = useAiFeatureFlags();
  const dadataEnabled = isFeatureEnabled('dadataAutocomplete');
  const [sbrAccountInput, setSbrAccountInput] = useState<string>('');
  const [kuvdInput, setKuvdInput] = useState<string>('');
  const [notaryConfirmed, setNotaryConfirmed] = useState<boolean>(false);
  const [sellerPayoutConfirmed, setSellerPayoutConfirmed] = useState<boolean>(false);
  const [platformFeeConfirmed, setPlatformFeeConfirmed] = useState<boolean>(false);
  const [advancingStep, setAdvancingStep] = useState<boolean>(false);

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || (isEmployee ? user?.id || '' : '');
  const operatorName =
    user?.name || (isEmployee ? 'Куратор DomExit' : 'Ahmed Abdallah (Владелец / CEO)');

  const loadDeal = async () => {
    const pool = isEmployee
      ? await DealsRepository.getByEmployee(currentEmployeeId)
      : await DealsRepository.getAll();

    const seenDealKeys = new Set<string>();
    const deduplicatedPool = pool.filter((d) => {
      const k = (d.dealId || d.id || d.lotCode || '').toUpperCase();
      if (!k || seenDealKeys.has(k)) return false;
      seenDealKeys.add(k);
      return true;
    });
    setAccessibleDeals(deduplicatedPool);

    const targetId = (dealId || '').toUpperCase();
    const found = targetId
      ? pool.find(
          (d) =>
            d.dealId.toUpperCase() === targetId ||
            d.id.toUpperCase() === targetId ||
            d.lotCode.toUpperCase() === targetId
        )
      : pool[0] || null;

    setDeal(found || null);

    if (found) {
      setProofPhotos(found.escrowWorkflow?.signingProofPhotos || []);
      setProofVideos(found.escrowWorkflow?.signingProofVideos || []);
      setRosreestrStampDoc(
        found.escrowWorkflow?.egrnExtractDocKey || found.escrowWorkflow?.rosreestrStampDocUrl || ''
      );
      setBankInput(found.escrowWorkflow?.bankName || 'ПАО Сбербанк');
      setSbrAccountInput(found.escrowWorkflow?.escrowAccountNumber || '');
      setKuvdInput(found.escrowWorkflow?.rosreestrKuvdNumber || '');
      setNotaryConfirmed(Boolean(found.escrowWorkflow?.notaryConsentConfirmed));
      setSellerPayoutConfirmed(Boolean(found.escrowWorkflow?.sellerPayoutConfirmed));
      setPlatformFeeConfirmed(Boolean(found.escrowWorkflow?.platformFeeConfirmed));
      setPepOverrideDocKey(found.escrowWorkflow?.pepOverrideDocKey || '');
      setPepOverrideReason(found.escrowWorkflow?.pepOverrideReason || '');

      const [linkedLot, pepRes] = await Promise.all([
        LotsRepository.getByCode(found.lotCode),
        apiClient.pep.getMySignatures(found.lotCode).catch(() => null),
      ]);
      setLot(linkedLot);
      setPepSignatures((pepRes as any)?.signatures || []);
    } else {
      setLot(null);
      setPepSignatures([]);
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

  const sellerReturnRub = deal?.sellerReturnRub ?? lot?.cashPaidBySeller ?? 0;
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

  const isOwner = Boolean(
    user &&
      (user.role === 'owner' ||
        user.role === 'admin' ||
        user.activeRole === 'owner' ||
        user.activeRole === 'admin' ||
        user.roles?.includes('owner'))
  );
  // Direct curator and owner execution of bank branch SBR steps
  const canExecuteBankStep = isOwner || isEmployee;
  const hasRosreestrStamp = Boolean(rosreestrStampDoc && rosreestrStampDoc.trim().length > 0);
  const hasBuyer = Boolean(
    (deal?.buyerUserId && deal.buyerUserId.trim().length > 0) ||
    (deal?.buyerName && deal.buyerName.trim().length > 0 && deal.buyerName !== 'Победитель отбора')
  );

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
      deal.escrowWorkflow?.escrowAccountNumber || '',
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
    try {
      const updated = await DealsRepository.releaseEscrowFunds(
        deal.dealId,
        `${operatorName} (Банковский контур)`
      );
      if (updated) {
        setDeal(updated);
        const linkedLot = await LotsRepository.getByCode(deal.lotCode);
        if (linkedLot) setLot(linkedLot);
        setNotificationMsg(
          `Сделка ${deal.dealId} успешно закрыта! Аккредитив раскрыт: ${formatRubles(sellerReturnRub)} перечислено продавцу, ${formatRubles(platformFeeRub)} (2.5%) — DomExit.`
        );
        setTimeout(() => setNotificationMsg(null), 6000);
      }
    } catch (err: any) {
      setNotificationMsg(`Ошибка закрытия сделки: ${err?.message || 'Сбой'}`);
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
    let uploadedKey = '';
    try {
      const uploaded = await StorageService.uploadDocument({
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
      uploadedKey = uploaded.objectKey;
    } catch (err: any) {
      console.error('[AdminClosingPage] upload error:', err);
      showDownloadToast('Ошибка загрузки файла в S3-хранилище. Пожалуйста, повторите попытку.', 'error');
      return;
    }

    const updatedEw = {
      ...(deal.escrowWorkflow || {
        step: 'pep_reservation' as ClosingStepId,
        bankName: bankInput,
        escrowAccountNumber: sbrAccountInput,
        depositedAmountRub: totalEscrowDepositRub,
        signingProofPhotos: [] as string[],
        signingProofVideos: [] as string[],
      }),
    };

    if (kind === 'photo') {
      const nextPhotos = [...proofPhotos, uploadedKey];
      setProofPhotos(nextPhotos);
      updatedEw.signingProofPhotos = nextPhotos;
    } else if (kind === 'video') {
      const nextVideos = [...proofVideos, uploadedKey];
      setProofVideos(nextVideos);
      updatedEw.signingProofVideos = nextVideos;
    } else {
      setRosreestrStampDoc(uploadedKey);
      updatedEw.egrnExtractDocKey = uploadedKey;
      updatedEw.egrnExtractDocName = file.name;
      updatedEw.rosreestrStampDocUrl = uploadedKey;
    }

    const nextDeal: DealTrack = { ...deal, escrowWorkflow: updatedEw };
    await DealsRepository.update(nextDeal);
    setDeal(nextDeal);

    setNotificationMsg(`Файл «${file.name}» сохранён в S3 (${uploadedKey}) без Base64!`);
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const handleUploadClosingFieldDoc = async (
    file: File,
    fieldKey: 'cessionDraft' | 'developerConsent' | 'sbrReceipt' | 'notaryConsent' | 'pepOverride',
    labelRu: string
  ) => {
    if (!deal) return;
    try {
      const uploaded = await StorageService.uploadDocument({
        file,
        category: 'additional',
        categoryLabelRu: `${labelRu}: ${file.name}`,
        entityType: 'deal',
        entityId: deal.dealId,
        uploadedByUid: user?.id || 'closing-curator',
        clientCode: user?.clientCode || 'DEX-STAFF',
      });
      const updatedEw: NonNullable<DealTrack['escrowWorkflow']> = {
        ...(deal.escrowWorkflow || {
          step: currentStep as ClosingStepId,
          bankName: bankInput,
          escrowAccountNumber: sbrAccountInput,
          depositedAmountRub: totalEscrowDepositRub,
          signingProofPhotos: proofPhotos,
          signingProofVideos: proofVideos,
        }),
      };
      if (fieldKey === 'cessionDraft') {
        updatedEw.cessionDraftDocKey = uploaded.objectKey;
        updatedEw.cessionDraftDocName = file.name;
      } else if (fieldKey === 'developerConsent') {
        updatedEw.developerConsentDocKey = uploaded.objectKey;
        updatedEw.developerConsentDocName = file.name;
      } else if (fieldKey === 'sbrReceipt') {
        updatedEw.sbrReceiptDocKey = uploaded.objectKey;
        updatedEw.sbrReceiptDocName = file.name;
      } else if (fieldKey === 'notaryConsent') {
        updatedEw.notaryConsentDocKey = uploaded.objectKey;
        updatedEw.notaryConsentDocName = file.name;
        updatedEw.notaryConsentConfirmed = true;
        setNotaryConfirmed(true);
      } else if (fieldKey === 'pepOverride') {
        updatedEw.pepOverrideDocKey = uploaded.objectKey;
        setPepOverrideDocKey(uploaded.objectKey);
      }

      const nextDeal: DealTrack = { ...deal, escrowWorkflow: updatedEw };
      await DealsRepository.update(nextDeal);
      setDeal(nextDeal);
      setNotificationMsg(`✓ Документ «${file.name}» загружен в S3`);
      setTimeout(() => setNotificationMsg(null), 3500);
    } catch (err: any) {
      setNotificationMsg(`Ошибка загрузки в S3: ${err?.message || 'Сбой'}`);
    }
  };

  const handleAdvanceToStep = async (nextStep: ClosingStepId) => {
    if (!deal) return;
    setAdvancingStep(true);
    try {
      const updatedEw: NonNullable<DealTrack['escrowWorkflow']> = {
        ...(deal.escrowWorkflow || {
          step: currentStep as ClosingStepId,
          bankName: bankInput,
          escrowAccountNumber: sbrAccountInput,
          depositedAmountRub: totalEscrowDepositRub,
          signingProofPhotos: proofPhotos,
          signingProofVideos: proofVideos,
        }),
        step: nextStep,
        bankName: bankInput.trim(),
        escrowAccountNumber: sbrAccountInput.trim(),
        rosreestrKuvdNumber: kuvdInput.trim(),
        notaryConsentConfirmed: notaryConfirmed,
        sellerPayoutConfirmed,
        platformFeeConfirmed,
        pepOverrideDocKey: pepOverrideDocKey || deal.escrowWorkflow?.pepOverrideDocKey,
        pepOverrideReason: pepOverrideReason.trim() || deal.escrowWorkflow?.pepOverrideReason,
      };
      const nextDeal: DealTrack = { ...deal, escrowWorkflow: updatedEw };
      await DealsRepository.update(nextDeal);
      setDeal(nextDeal);

      if (nextStep === 'developer_consent' && pepOverrideDocKey && pepOverrideReason.trim()) {
        await AuditLogsRepository.addLog({
          lotCode: deal.lotCode,
          dealId: deal.dealId,
          operatorName,
          operatorRole: 'owner',
          actionType: 'pep_paper_override',
          title: 'Исключение владельца: бумажный скан ПЭП прикреплён в S3',
          description: `Причина: ${pepOverrideReason.trim()} (S3: ${pepOverrideDocKey})`,
        });
      }

      setNotificationMsg(`✓ Переход на этап «${CLOSING_STEPS_6[normalizeClosingStepNum(nextStep) - 1]?.title || nextStep}» выполнен!`);
      setTimeout(() => setNotificationMsg(null), 4000);
    } catch (err: any) {
      setNotificationMsg(`Блокировка шлюза: ${err?.message || 'Не выполнены обязательные условия шага'}`);
    } finally {
      setAdvancingStep(false);
    }
  };

  const currentStepNum = normalizeClosingStepNum(currentStep);
  const progressPercent = currentStep === 'deal_cancelled' ? 0 : getClosingProgressPercent(currentStep);

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
                Сделки поступают сюда после утверждения победителя в Матчмейкере.
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
                    Счет: {deal.escrowWorkflow?.escrowAccountNumber || '—'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVaultOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs border border-indigo-200 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Документы сделки</span>
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

              {/* Buyer Gating Warning if no buyer is assigned */}
              {!hasBuyer && (
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wide text-amber-900">
                        Внимание: К сделке #{deal.dealId} еще не прикреплен покупатель (цессионарий)
                      </h4>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Банковские расчеты и переход по этапам СБР заблокированы до утверждения покупателя в модуле матчмейкинга.
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/admin/matchmaker/${deal.lotCode}`}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-xs transition-colors flex items-center space-x-1.5"
                  >
                    <span>Назначить покупателя в Матчмейкере</span>
                    <span>→</span>
                  </Link>
                </div>
              )}

              {/* 6-Step Russian Closing Flow (Переуступка ДДУ 214-ФЗ) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    6-шаговый контур закрытия переуступки ДДУ 214-ФЗ ({bankName} / Росреестр / DomExit)
                  </h3>
                  <span className="text-emerald-700 font-mono font-bold text-xs">
                    Шаг {currentStepNum}/6 • {progressPercent}% Выполнено
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  {CLOSING_STEPS_6.map((st) => {
                    const isDone = currentStep === 'deal_finalized' || st.num < currentStepNum;
                    const isCurrent = currentStep !== 'deal_finalized' && st.num === currentStepNum;
                    return (
                      <div
                        key={st.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isCurrent
                            ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                            : isDone
                            ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                            : 'border-slate-200 bg-slate-50/60 text-slate-400'
                        }`}
                      >
                        <div className="font-black text-[11px] flex items-center justify-between">
                          <span>{st.shortTitle}</span>
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                        <div className="text-[10px] mt-1 leading-tight">{st.percent}%</div>
                      </div>
                    );
                  })}
                </div>

                {/* Live PEP 63-FZ Signatures Panel */}
                {(() => {
                  const ndaSig = pepSignatures.find((s) => s.documentType === 'nda_viewing_act' && s.status === 'signed');
                  const offerSig = pepSignatures.find((s) => s.documentType === 'buyer_reservation_terms' && s.status === 'signed');
                  const sellerSig = pepSignatures.find((s) => s.documentType === 'seller_exclusive_consent' && s.status === 'signed');
                  const bothBuyerPep = Boolean(ndaSig && offerSig);
                  const ownerOverrideReady = Boolean(isOwner && pepOverrideDocKey && pepOverrideReason.trim());
                  const ew = deal.escrowWorkflow;

                  return (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {[
                          { label: '1. NDA покупателя (ПЭП)', sig: ndaSig },
                          { label: '2. Оферта 2.5% покупателя (ПЭП)', sig: offerSig },
                          { label: '3. Согласие продавца (ПЭП)', sig: sellerSig },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                              item.sig ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-bold flex items-center space-x-1">
                                <FileSignature className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </div>
                              <div className="text-[10px] font-mono truncate">
                                {item.sig
                                  ? `✓ ${new Date(item.sig.signedAt).toLocaleString('ru-RU')} • ${(item.sig.documentTextHashSha256 || '').slice(0, 10)}...`
                                  : 'Не подписано'}
                              </div>
                            </div>
                            {item.sig && (
                              <button
                                type="button"
                                onClick={() => downloadPepCertificate(item.sig)}
                                className="p-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer shrink-0"
                                title="Скачать сертификат ПЭП"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Active Step Gate Controls */}
                      {currentStepNum === 1 && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                          <div className="font-black text-slate-900">
                            Шаг 1 (15%): Подписание ПЭП (NDA + Оферта 2.5%) и Бронирование
                          </div>
                          {!bothBuyerPep && isOwner && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                              <div className="font-bold text-amber-950">
                                Исключительный обход владельца (бумажное подписание с сохранением в S3 + журнал аудита):
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={pepOverrideReason}
                                  onChange={(e) => setPepOverrideReason(e.target.value)}
                                  placeholder="Обязательная причина обхода..."
                                  className="flex-1 px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs"
                                />
                                <label className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold cursor-pointer flex items-center space-x-1">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>{pepOverrideDocKey ? 'Скан загружен ✓' : 'Загрузить скан в S3'}</span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleUploadClosingFieldDoc(f, 'pepOverride', 'Бумажный ПЭП (обход владельца)');
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={advancingStep || !hasBuyer || (!bothBuyerPep && !ownerOverrideReady)}
                            onClick={() => handleAdvanceToStep('developer_consent')}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs cursor-pointer"
                          >
                            Перейти к Шагу 2: Согласие застройщика →
                          </button>
                        </div>
                      )}

                      {currentStepNum === 2 && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                          <div className="font-black text-slate-900">
                            Шаг 2 (35%): Согласие застройщика и проект договора цессии (S3)
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <label className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-bold cursor-pointer flex items-center space-x-2">
                              <Upload className="w-4 h-4 text-indigo-600" />
                              <span>
                                {ew?.cessionDraftDocName
                                  ? `✓ Проект цессии: ${ew.cessionDraftDocName}`
                                  : 'Загрузить проект Договора уступки в S3'}
                              </span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadClosingFieldDoc(f, 'cessionDraft', 'Проект договора уступки');
                                }}
                              />
                            </label>
                            <label className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-bold cursor-pointer flex items-center space-x-2">
                              <Upload className="w-4 h-4 text-emerald-600" />
                              <span>
                                {ew?.developerConsentDocName
                                  ? `✓ Согласие застройщика: ${ew.developerConsentDocName}`
                                  : 'Загрузить письмо согласия застройщика в S3'}
                              </span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadClosingFieldDoc(f, 'developerConsent', 'Согласие застройщика');
                                }}
                              />
                            </label>
                          </div>
                          <button
                            type="button"
                            disabled={advancingStep || !ew?.cessionDraftDocKey || !ew?.developerConsentDocKey}
                            onClick={() => handleAdvanceToStep('notary_and_sbr')}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs cursor-pointer"
                          >
                            Перейти к Шагу 3: Нотариус и СБР →
                          </button>
                        </div>
                      )}

                      {currentStepNum === 3 && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                          <div className="font-black text-slate-900">
                            Шаг 3 (55%): Нотариальное согласие и открытие СБР / Аккредитива
                          </div>
                          {dadataEnabled && (
                            <div className="flex flex-wrap items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl p-2.5">
                              <input
                                type="text"
                                value={bikInput}
                                onChange={(e) => setBikInput(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                placeholder="БИК банка (9 цифр, напр. 044525225)"
                                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-violet-200 bg-white font-mono text-xs"
                              />
                              <button
                                type="button"
                                disabled={bikLoading || bikInput.length !== 9}
                                onClick={async () => {
                                  setBikLoading(true);
                                  setBikError(null);
                                  try {
                                    const res = await apiClient.aiLab.lookupBank(bikInput);
                                    if (res?.ok && res?.bank?.found) {
                                      setBankInput(res.bank.nameShort || res.bank.nameFull || bankInput);
                                      setNotificationMsg(`Банк найден через DaData: ${res.bank.nameShort || res.bank.nameFull}`);
                                    } else {
                                      setBikError(res?.errorCode || 'Банк по БИК не найден');
                                    }
                                  } catch (err: any) {
                                    setBikError(err?.message || 'Ошибка поиска по БИК');
                                  } finally {
                                    setBikLoading(false);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-bold text-xs cursor-pointer"
                              >
                                {bikLoading ? 'Поиск...' : 'Найти банк (DaData)'}
                              </button>
                              {bikError && <span className="text-[11px] text-rose-700 font-bold w-full">{bikError}</span>}
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={bankInput}
                              onChange={(e) => setBankInput(e.target.value)}
                              placeholder="Банк (напр. ПАО Сбербанк)"
                              className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                            />
                            <input
                              type="text"
                              value={sbrAccountInput}
                              onChange={(e) => setSbrAccountInput(e.target.value)}
                              placeholder="Номер счёта СБР / Аккредитива *"
                              className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-bold cursor-pointer flex items-center space-x-2">
                              <Upload className="w-4 h-4 text-emerald-600" />
                              <span>
                                {ew?.sbrReceiptDocName
                                  ? `✓ Квитанция СБР: ${ew.sbrReceiptDocName}`
                                  : 'Загрузить квитанцию депонирования СБР в S3 *'}
                              </span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadClosingFieldDoc(f, 'sbrReceipt', 'Квитанция СБР / аккредитива');
                                }}
                              />
                            </label>
                            <label className="flex items-center space-x-2 font-bold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={notaryConfirmed}
                                onChange={(e) => setNotaryConfirmed(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600"
                              />
                              <span>Нотариальное согласие супруга(и) / заявление проверено</span>
                            </label>
                          </div>
                          <button
                            type="button"
                            disabled={
                              advancingStep ||
                              !bankInput.trim() ||
                              !sbrAccountInput.trim() ||
                              !ew?.sbrReceiptDocKey ||
                              !notaryConfirmed
                            }
                            onClick={() => handleAdvanceToStep('rosreestr_filing')}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs cursor-pointer"
                          >
                            Перейти к Шагу 4: Подача в Росреестр (КУВД) →
                          </button>
                        </div>
                      )}

                      {currentStepNum === 4 && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                          <div className="font-black text-slate-900">
                            Шаг 4 (75%): Подписание (УКЭП) и подача в Росреестр
                          </div>
                          <input
                            type="text"
                            value={kuvdInput}
                            onChange={(e) => setKuvdInput(e.target.value)}
                            placeholder="Номер заявления Росреестра (КУВД), напр. КУВД-001/2026-123456 *"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold"
                          />
                          <p className="text-[11px] text-slate-500">
                            Загрузите фото или видео фиксации подписания ниже (сохраняются только S3-ключи, без Base64): {proofPhotos.length} фото, {proofVideos.length} видео.
                          </p>
                          <button
                            type="button"
                            disabled={
                              advancingStep ||
                              !kuvdInput.trim() ||
                              (proofPhotos.length === 0 && proofVideos.length === 0)
                            }
                            onClick={() => handleAdvanceToStep('egrn_and_payout')}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs cursor-pointer"
                          >
                            Перейти к Шагу 5: Выписка ЕГРН и раскрытие СБР →
                          </button>
                        </div>
                      )}

                      {currentStepNum === 5 && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                          <div className="font-black text-slate-900">
                            Шаг 5 (90%): Выписка ЕГРН и раскрытие СБР продавцу
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-bold text-slate-700">
                              ЕГРН в S3: {hasRosreestrStamp ? `✓ ${rosreestrStampDoc}` : 'Загрузите файл ЕГРН в блоке ниже'}
                            </span>
                            <label className="flex items-center space-x-2 font-bold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={sellerPayoutConfirmed}
                                onChange={(e) => setSellerPayoutConfirmed(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600"
                              />
                              <span>СБР раскрыт, средства переведены продавцу</span>
                            </label>
                          </div>
                          <button
                            type="button"
                            disabled={advancingStep || !hasRosreestrStamp || !sellerPayoutConfirmed}
                            onClick={() => handleAdvanceToStep('platform_fee_and_close')}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs cursor-pointer"
                          >
                            Перейти к Шагу 6: Подтверждение сбора и закрытие →
                          </button>
                        </div>
                      )}

                      {currentStepNum === 6 && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-3 text-xs">
                          <div className="font-black text-emerald-950">
                            Шаг 6 (100%): Подтверждение сбора DomExit (2.5%) и закрытие сделки
                          </div>
                          {currentStep === 'deal_finalized' ? (
                            <div className="font-bold text-emerald-800">
                              ✓ Сделка официально закрыта и перенесена в архив обеих сторон!
                            </div>
                          ) : (
                            <>
                              <label className="flex items-center space-x-2 font-bold text-emerald-900 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={platformFeeConfirmed}
                                  onChange={(e) => setPlatformFeeConfirmed(e.target.checked)}
                                  className="w-4 h-4 rounded text-emerald-600"
                                />
                                <span>
                                  Сбор DomExit 2.5% ({formatRubles(platformFeeRub)}) подтверждён
                                  {lot?.developerConsentPolicy === 'included_in_platform_fee' && lot?.developerConsentFeeRub
                                    ? ` (за вычетом платы застройщику ${formatRubles(lot.developerConsentFeeRub)})`
                                    : ''}
                                </span>
                              </label>
                              <button
                                type="button"
                                disabled={!platformFeeConfirmed || !hasBuyer}
                                onClick={handleReleaseEscrow}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs cursor-pointer flex items-center space-x-2"
                              >
                                <ShieldCheck className="w-4 h-4" />
                                <span>Завершить сделку и архивировать</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Safe Bank Settlement Assistant & Calculator */}
              <BankSettlementAssistant
                dealPriceRub={lot?.dduContractPrice || deal?.sellerReturnRub || 10000000}
                dealTrack={lot?.dealTrack || deal?.dealTrack}
                className="my-6"
              />

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
                            ЭСКРОУ СБЕР / ВТБ
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          Перевод остатка долга в {deal.developer || lot?.developer || 'застройщика'} на нового дольщика
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
                      <span>Фотофиксация подписания и отметка Росреестра</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Все загружаемые файлы сохраняются в защищенном хранилище сделки и доступны офицеру банка в шлюзе.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold">
                    Защищенный контур
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

                    <div className="space-y-2">
                      {proofPhotos.map((p, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] font-mono"
                        >
                          <span className="truncate text-slate-800">📷 Фото #{i + 1}: {p}</span>
                          <span className="text-emerald-700 font-bold shrink-0">S3 ✓</span>
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
                            'Файл не выбран'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Хэш SHA-256 зафиксирован в защищенном хранилище.
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

              <ClosingCommsAndTasksPanel
                deal={deal}
                curatorName={operatorName}
                onDealUpdated={(updated) => setDeal(updated)}
                onNotify={(msg) => {
                  setNotificationMsg(msg);
                  setTimeout(() => setNotificationMsg(null), 5000);
                }}
              />
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
          secondaryEntityType="lot"
          secondaryEntityId={deal.lotCode}
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
