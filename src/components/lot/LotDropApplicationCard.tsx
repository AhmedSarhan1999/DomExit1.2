import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  Flame,
  Award,
  Upload,
  FileText,
  XCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StorageService } from '../../dal/StorageService';
import {
  Lot,
  PriceAcceptance,
  BuyBoxTier,
  BuyBoxPaymentMethod,
  ApplicationProofDocument,
} from '../../types';
import { formatRubles } from '../../utils/formatters';

export interface LotDropApplicationCardProps {
  lot: Lot;
  user: any;
  onOpenAuth: () => void;
}

const PAYMENT_OPTIONS: Array<{ value: BuyBoxPaymentMethod; label: string; hint: string }> = [
  { value: 'cash_100', label: '100% наличные / СБР', hint: '+40 баллов (приоритет)' },
  { value: 'family_mortgage_approved', label: 'Семейная ипотека', hint: '+25 баллов (одобрена)' },
  { value: 'standard_mortgage_approved', label: 'Стандартная ипотека', hint: '+15 баллов' },
  { value: 'alternative', label: 'Альтернативная сделка', hint: 'Базовый трек' },
];

const ALLOWED_PROOF_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);
const MAX_PROOF_SIZE_BYTES = 15 * 1024 * 1024;

export const LotDropApplicationCard: React.FC<LotDropApplicationCardProps> = ({
  lot,
  user,
  onOpenAuth,
}) => {
  const dropConfig = lot.dropConfig;

  const defaultCash = Number(
    lot.cashPaidBySeller || (lot as any).priceRub || lot.dduContractPrice || 0
  );

  const [paymentMethod, setPaymentMethod] = useState<BuyBoxPaymentMethod>('cash_100');
  const [confirmedCashRub, setConfirmedCashRub] = useState<number>(defaultCash);
  const [priceAcceptance, setPriceAcceptance] = useState<PriceAcceptance>('full_price');
  const [readiness24h, setReadiness24h] = useState<boolean>(true);
  const [deposit48h, setDeposit48h] = useState<boolean>(true);
  const [buyerComment, setBuyerComment] = useState<string>('');
  const [proofDocuments, setProofDocuments] = useState<ApplicationProofDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [appliedApp, setAppliedApp] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<BuyBoxTier>('silver');
  const [hasGoldProofApproved, setHasGoldProofApproved] = useState<boolean>(false);
  const [hasExistingApp, setHasExistingApp] = useState<boolean>(false);
  const [activeSlotsCount, setActiveSlotsCount] = useState<number>(0);
  const [localCurrentCount, setLocalCurrentCount] = useState<number>(
    dropConfig?.currentValidApplications || 0
  );

  useEffect(() => {
    setLocalCurrentCount(dropConfig?.currentValidApplications || 0);
  }, [dropConfig?.currentValidApplications, lot.lotCode]);

  const isSelfSeller = Boolean(
    user &&
      (lot.sellerUserId === user.id ||
        (lot as any).sellerId === user.id ||
        (user.email &&
          (lot as any).sellerEmail &&
          String((lot as any).sellerEmail).trim().toLowerCase() ===
            String(user.email).trim().toLowerCase()))
  );

  const [remainingText, setRemainingText] = useState<string>('');

  const targetDeadline =
    dropConfig?.waveStatus === 'gold_wave'
      ? dropConfig?.goldExclusiveUntil
      : dropConfig?.closesAt;

  useEffect(() => {
    const updateCountdown = () => {
      if (!targetDeadline) return;
      const diffMs = new Date(targetDeadline).getTime() - Date.now();
      if (diffMs <= 0) {
        setRemainingText('Время истекло');
        return;
      }
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      setRemainingText(`${hours}ч ${mins}м ${secs}с`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [targetDeadline]);

  // Load live Buy-Box, Gold proof status, and existing lot application
  useEffect(() => {
    if (!dropConfig || dropConfig.mode !== 'staged_drop') return;
    setHasExistingApp(false);
    setAppliedApp(null);
    setHasGoldProofApproved(false);
    if (!user) return;
    const fetchUserStatus = async () => {
      try {
        const [bbRes, myAppsRes, tierReqRes] = await Promise.all([
          apiClient.matching.getMyBuyBox().catch(() => null),
          apiClient.matching.getMyApplications().catch(() => null),
          apiClient.get<{ ok?: boolean; requests?: any[] }>('/api/tier-requests/my').catch(() => null),
        ]);

        const resolvedTier =
          bbRes?.buyBox?.tier || bbRes?.tier || myAppsRes?.tier || (user.buyerTier as BuyBoxTier);
        if (resolvedTier) {
          setUserTier(resolvedTier);
        }
        if (bbRes?.buyBox?.paymentMethod) {
          setPaymentMethod(bbRes.buyBox.paymentMethod);
        }
        if (defaultCash > 0) {
          setConfirmedCashRub(defaultCash);
        } else if (bbRes?.buyBox?.availableLiquidityRub) {
          setConfirmedCashRub(Number(bbRes.buyBox.availableLiquidityRub));
        }

        const approvedGold =
          resolvedTier === 'gold' &&
          Boolean(
            (tierReqRes?.requests || []).some((r: any) => r.status === 'approved') ||
              resolvedTier === 'gold'
          );
        setHasGoldProofApproved(approvedGold);

        if (myAppsRes?.ok) {
          setActiveSlotsCount(myAppsRes.activeCount || 0);
          const targetCode = String(lot.lotCode || '').trim().toUpperCase();
          const activeMatch = (myAppsRes.activeApplications || []).find(
            (a: any) => String(a.lotCode || '').trim().toUpperCase() === targetCode
          );
          const archivedMatch = (myAppsRes.archivedApplications || []).find(
            (a: any) => String(a.lotCode || '').trim().toUpperCase() === targetCode
          );
          const matchedApp = activeMatch || archivedMatch;
          if (matchedApp) {
            const qStatus = String(matchedApp.queueStatus || '');
            const isVoluntaryWithdrawn =
              (qStatus === 'withdrawn_from_queue' || qStatus === 'withdrawn') &&
              lot.status === 'available';
            setAppliedApp(matchedApp);
            setHasExistingApp(!isVoluntaryWithdrawn);
          }
        }
      } catch (err) {
        console.warn('[LotDropApplicationCard] Failed to fetch user status:', err);
      }
    };
    fetchUserStatus();
  }, [dropConfig?.mode, user?.id, lot.lotCode]);

  if (!dropConfig || dropConfig.mode !== 'staged_drop') {
    return null;
  }

  const maxCap = dropConfig.maxApplicationsCap || 5;
  const currentCount = localCurrentCount;
  const remainingSeats = Math.max(0, maxCap - currentCount);

  const isGoldWave = dropConfig.waveStatus === 'gold_wave';
  const isCapped = dropConfig.waveStatus === 'capped_closed' || remainingSeats <= 0;
  const isExpired = dropConfig.waveStatus === 'expired_closed';
  const isGoldRestricted = isGoldWave && userTier !== 'gold';

  const appQueueStatus = String(appliedApp?.queueStatus || '');
  const isCompletedWinner = Boolean(
    hasExistingApp && appliedApp && (appQueueStatus === 'completed' || appliedApp.status === 'completed')
  );
  const isActiveWinner = Boolean(
    hasExistingApp && appliedApp && (appQueueStatus === 'priority_1' || appQueueStatus === 'in_deal')
  );
  const isRejectedApp = Boolean(
    hasExistingApp && appliedApp && (appQueueStatus === 'rejected' || appliedApp.status === 'rejected')
  );
  const isWaitlistApp = Boolean(
    hasExistingApp &&
      appliedApp &&
      (appQueueStatus === 'reserve_2' || appQueueStatus === 'reserve_3' || appQueueStatus === 'waitlist')
  );

  const RU_QUEUE_STATUS_MAP: Record<string, string> = {
    pending_review: 'На рассмотрении куратора',
    priority_1: 'Вы выбраны победителем (Приоритет №1)',
    in_deal: 'Вы в активной сделке по объекту',
    reserve_2: 'Лист ожидания (Резерв №2)',
    reserve_3: 'Лист ожидания (Резерв №3)',
    waitlist: 'Лист ожидания',
    standby_in_other_deal: `В листе ожидания (активная сделка по #${appliedApp?.activeDealLotCode || 'другому лоту'})`,
    deposit_paid: 'Задаток подтверждён',
    completed: 'Сделка успешно завершена (Вы — владелец)',
    lot_closed: 'Объект продан другому покупателю (сделка закрыта)',
    rejected: 'Заявка отклонена куратором',
    expired: 'Истекло время ожидания',
    withdrawn_from_deal: 'Вы отказались от сделки',
    withdrawn_from_queue: 'Заявка отозвана вами',
    withdrawn: 'Заявка отозвана вами',
  };

  const handleUploadProofFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      onOpenAuth();
      return;
    }

    setErrorMessage(null);
    const remainingSlots = Math.max(0, 3 - proofDocuments.length);
    if (remainingSlots === 0) {
      setErrorMessage('Можно прикрепить не более 3 подтверждающих документов.');
      return;
    }

    const picked = Array.from(files).slice(0, remainingSlots);
    setUploadingDoc(true);
    try {
      const uploadedList: ApplicationProofDocument[] = [];
      for (const file of picked) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_PROOF_EXT.has(ext)) {
          throw new Error(`Файл «${file.name}» не поддерживается. Разрешены: PDF, JPG, PNG, WebP.`);
        }
        if (file.size > MAX_PROOF_SIZE_BYTES) {
          throw new Error(`Файл «${file.name}» превышает максимальный размер 15 МБ.`);
        }

        const meta = await StorageService.uploadDocument({
          file,
          category:
            paymentMethod === 'family_mortgage_approved' || paymentMethod === 'standard_mortgage_approved'
              ? 'mortgage_approval'
              : 'buyer_cash_statement',
          entityType: 'buyer_application',
          entityId: lot.lotCode,
          uploadedByUid: user.id,
          clientCode: user.clientCode || 'BUYER',
          categoryLabelRu: 'Подтверждение платежеспособности покупателя',
        });

        uploadedList.push({
          name: file.name,
          objectKey: meta.objectKey,
          mimeType: meta.mimeType,
          size: meta.sizeBytes,
          uploadedAt: meta.uploadedAt,
        });
      }
      setProofDocuments((prev) => [...prev, ...uploadedList].slice(0, 3));
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ошибка при загрузке документа в защищенное хранилище S3');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenOwnProof = async (doc: ApplicationProofDocument) => {
    try {
      const res = await apiClient.get<{ downloadUrl?: string }>(
        `/api/storage/presign-download?key=${encodeURIComponent(
          doc.objectKey
        )}&lotCode=${encodeURIComponent(lot.lotCode)}&filename=${encodeURIComponent(doc.name)}`
      );
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Не удалось открыть защищённый документ');
    }
  };

  const handleWithdrawQueue = async () => {
    if (!appliedApp?.id) return;
    setWithdrawing(true);
    setErrorMessage(null);
    try {
      await apiClient.matching.withdrawApplication(
        appliedApp.id,
        'Отзыв заявки покупателем со страницы объекта'
      );
      setHasExistingApp(false);
      setAppliedApp(null);
      setActiveSlotsCount((c) => Math.max(0, c - 1));
      setLocalCurrentCount((c) => Math.max(0, c - 1));
    } catch (err: any) {
      setErrorMessage(err?.message || 'Не удалось отозвать заявку');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    if (!confirmedCashRub || confirmedCashRub <= 0) {
      setErrorMessage('Укажите сумму подтверждённых средств (₽).');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.matching.applyToLotDrop(lot.lotCode, {
        paymentMethod,
        confirmedCashRub: Math.round(Number(confirmedCashRub)),
        priceAcceptance,
        readiness24h,
        deposit48h,
        buyerComment: buyerComment.trim() || undefined,
        proofDocuments,
        ndaSigned: true,
      });

      if (res.ok) {
        setAppliedApp(res.application);
        setHasExistingApp(true);
        setActiveSlotsCount((c) => c + 1);
        if (typeof res.currentValidApplications === 'number') {
          setLocalCurrentCount(res.currentValidApplications);
        } else {
          setLocalCurrentCount((c) => c + 1);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Не удалось отправить заявку в тактовый дроп');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 text-slate-900 border border-emerald-200/90 shadow-xs space-y-4">
      {/* Wave Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center space-x-1.5 ${
              isGoldWave
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : dropConfig.waveStatus === 'silver_wave'
                ? 'bg-slate-100 text-slate-800 border-slate-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isCompletedWinner
                ? '🏆 СДЕЛКА ЗАВЕРШЕНА'
                : isActiveWinner
                ? '👑 ВЫ — ПОБЕДИТЕЛЬ ОТБОРА'
                : lot.status === 'closed'
                ? '✓ ЛОТ ПРОДАН'
                : lot.status === 'in_deal'
                ? '🔒 ОБЪЕКТ В СДЕЛКЕ'
                : isGoldWave
                ? '🥇 РАННИЙ ДОСТУП: ВОЛНА GOLD'
                : dropConfig.waveStatus === 'silver_wave'
                ? '🥈 ОТКРЫТЫЙ РАУНД: SILVER'
                : isCapped
                ? '🛑 КВОТА ИСЧЕРПАНА'
                : '⌛ РАУНД ЗАВЕРШЕН'}
            </span>
          </span>
        </div>

        {/* Live Countdown */}
        {!isCompletedWinner &&
          !isActiveWinner &&
          lot.status === 'available' &&
          !isCapped &&
          !isExpired &&
          remainingText && (
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-amber-700">
              <Clock className="w-3.5 h-3.5" />
              <span>{remainingText}</span>
            </div>
          )}
      </div>

      {/* Seats Meter */}
      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Ограничение очереди:</span>
          <span className="font-bold font-mono text-slate-900">
            Осталось {remainingSeats} из {maxCap} мест
          </span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isCapped ? 'bg-rose-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${Math.min(100, (currentCount / maxCap) * 100)}%` }}
          />
        </div>
      </div>

      {/* Self-Owner Guard OR Personalized Application Status Cards */}
      {isSelfSeller ? (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2 text-indigo-950">
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>Это ваш объект (вы продавец)</span>
          </div>
          <p className="text-[11px] text-indigo-700 leading-relaxed">
            Подача заявки на покупку собственного объекта недоступна. Управляйте продажей и документами в разделе «Я продавец» личного кабинета.
          </p>
          <Link
            to="/portal?tab=seller"
            className="inline-flex items-center space-x-1 text-xs font-black text-indigo-700 hover:underline"
          >
            <span>Перейти в кабинет продавца</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : isCompletedWinner ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 space-y-2 text-emerald-950">
          <div className="flex items-center space-x-2 text-emerald-900 font-black text-xs">
            <Award className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>🎉 Поздравляем! Вы приобрели этот объект (Сделка завершена)</span>
          </div>
          <p className="text-xs text-emerald-900 leading-relaxed">
            Сделка по лоту #{lot.lotCode} закрыта, права зарегистрированы. Документы закрытия и выписка доступны в вашем кабинете.
          </p>
          <Link
            to="/portal?tab=buyer"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
          >
            <span>Открыть документы сделки в кабинете</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : isActiveWinner ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 space-y-2 text-emerald-950">
          <div className="flex items-center space-x-2 text-emerald-900 font-black text-xs">
            <Award className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>👑 Вы выбраны победителем по этому объекту</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Вы зафиксированы как <strong>Приоритет №1</strong> (Closing Score:{' '}
            <strong>{appliedApp?.closingScore || 100}/105</strong>). Персональный куратор сопровождает банковское закрытие и эскроу/СБР.
          </p>
          <Link
            to="/portal?tab=buyer"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
          >
            <span>Перейти в активную сделку в кабинете</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : isRejectedApp ? (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 space-y-2.5 text-rose-950">
          <div className="flex items-center space-x-2 text-rose-900 font-black text-xs">
            <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Заявка по лоту #{lot.lotCode} отклонена</span>
          </div>
          {appliedApp?.rejectionReason && (
            <div className="p-2.5 rounded-xl bg-white border border-rose-200 text-xs text-rose-900">
              <span className="font-bold block text-[11px] text-rose-700 mb-0.5">
                Причина решения куратора:
              </span>
              {appliedApp.rejectionReason}
            </div>
          )}
          <p className="text-[11px] text-slate-700 leading-relaxed">
            Ваша квота из лимита 3 активных заявок автоматически освобождена — вы можете подобрать и подать заявку на другой объект.
          </p>
          <Link
            to="/opportunities"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
          >
            <span>Посмотреть другие объекты</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : isWaitlistApp ? (
        <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-200 space-y-2.5 text-sky-950">
          <div className="flex items-center space-x-2 text-sky-900 font-black text-xs">
            <Clock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              ⏳ Вы в листе ожидания (
              {appQueueStatus === 'reserve_2'
                ? 'Резерв №2'
                : appQueueStatus === 'reserve_3'
                ? 'Резерв №3'
                : 'Лист ожидания'}
              )
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Объект сейчас в брони или отборе с другим приоритетным покупателем, но ваша заявка зафиксирована с Closing Score{' '}
            <strong>{appliedApp?.closingScore || 0}/105</strong>. Если бронь освободится, куратор передаст сделку по очереди.
          </p>
          {Array.isArray(appliedApp?.proofDocuments) && appliedApp.proofDocuments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {appliedApp.proofDocuments.map((doc: ApplicationProofDocument, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleOpenOwnProof(doc)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-[11px] font-bold text-sky-800 hover:bg-sky-100 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span className="truncate max-w-[160px]">{doc.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              to="/portal?tab=buyer"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold"
            >
              <span>Кабинет покупателя</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              disabled={withdrawing}
              onClick={handleWithdrawQueue}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {withdrawing ? 'Отзыв...' : 'Отозвать заявку (без штрафа)'}
            </button>
          </div>
        </div>
      ) : hasExistingApp && appliedApp ? (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-300 space-y-2.5 text-slate-900">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
            <Clock className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>Ваша заявка по лоту #{lot.lotCode} принята</span>
          </div>
          <p className="text-xs text-slate-700">
            Ваш Closing Score: <strong>{appliedApp.closingScore || 0}/105</strong>. Статус в очереди:{' '}
            <strong className="text-indigo-800">
              {RU_QUEUE_STATUS_MAP[appQueueStatus] || 'На рассмотрении куратора'}
            </strong>
            .
          </p>
          {appliedApp.curatorVerificationStatus === 'verified' && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3" />
              <span>Документы и условия проверены куратором</span>
            </span>
          )}
          {appliedApp.curatorVerificationStatus === 'needs_clarification' && (
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              <strong>Запрос куратора:</strong>{' '}
              {appliedApp.curatorVerificationNote || 'Необходимо уточнить детали заявки в кабинете'}
            </div>
          )}
          {Array.isArray(appliedApp.proofDocuments) && appliedApp.proofDocuments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {appliedApp.proofDocuments.map((doc: ApplicationProofDocument, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleOpenOwnProof(doc)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <FileText className="w-3 h-3 text-indigo-600" />
                  <span className="truncate max-w-[160px]">{doc.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              to="/portal?tab=buyer"
              className="inline-flex items-center space-x-1 text-xs font-black text-indigo-700 hover:underline"
            >
              <span>Управлять заявкой в кабинете</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {appQueueStatus !== 'standby_in_other_deal' && !['lot_closed', 'expired'].includes(appQueueStatus) && (
              <button
                type="button"
                disabled={withdrawing}
                onClick={handleWithdrawQueue}
                className="ml-auto px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-700 cursor-pointer disabled:opacity-50"
              >
                {withdrawing ? '...' : 'Отозвать (без штрафа)'}
              </button>
            )}
          </div>
        </div>
      ) : lot.status === 'closed' ? (
        <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-800 space-y-1">
          <div className="font-bold flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>✓ Сделка по объекту завершена</span>
          </div>
          <p className="text-[11px] text-slate-600">
            Объект продан, права требования зарегистрированы в Росреестре.
          </p>
        </div>
      ) : lot.status === 'in_deal' ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
          <div className="font-bold flex items-center space-x-1.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>🔒 Объект в активной сделке</span>
          </div>
          <p className="text-[11px] text-amber-800">
            Приоритетный покупатель выбран и оформляет сделку с куратором. Новые заявки временно приостановлены.
          </p>
        </div>
      ) : activeSlotsCount >= 3 ? (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-amber-950">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Достигнут лимит активных заявок (3 из 3)</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Одновременно можно участвовать не более чем в 3 сделках/очередях. Вы можете отозвать одну из открытых заявок в личном кабинете, чтобы подать на этот объект.
          </p>
        </div>
      ) : isCapped ? (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>Лимит мест ({maxCap}) в текущем тактовом окне исчерпан. Ожидайте ротации.</span>
        </div>
      ) : isExpired ? (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 flex items-center space-x-2">
          <Clock className="w-4 h-4 shrink-0 text-slate-400" />
          <span>Окно приема заявок завершено.</span>
        </div>
      ) : isGoldRestricted ? (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-900">
          <div className="flex items-center space-x-2 font-bold text-amber-800">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Окно раннего доступа Gold</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Подача заявок для Silver откроется автоматически после завершения окна Gold. Вы можете подать предварительную заявку через нашего Telegram-бота.
          </p>
        </div>
      ) : (
        /* Enhanced Application Form */
        <form onSubmit={handleApply} className="space-y-3.5 pt-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Gold Proof Pre-Verified Banner */}
          {hasGoldProofApproved && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>✓ Платежеспособность подтверждена статусом Gold</span>
            </div>
          )}

          {/* 1. Payment Method */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              1. Способ расчётов:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentMethod === opt.value
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-[11px]">{opt.label}</div>
                  <div className="text-[10px] opacity-80">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Confirmed Cash */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              2. Подтверждённый бюджет / наличные (₽):
            </label>
            <input
              type="number"
              min={100000}
              step={50000}
              value={confirmedCashRub || ''}
              onChange={(e) => setConfirmedCashRub(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="Сумма доступных средств"
            />
            {confirmedCashRub > 0 && (
              <span className="text-[10px] text-slate-500 font-semibold block">
                {formatRubles(confirmedCashRub)}
              </span>
            )}
          </div>

          {/* 3. Price Acceptance */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              3. Ценовое предложение:
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setPriceAcceptance('full_price')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  priceAcceptance === 'full_price'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-[11px]">Полная цена</div>
                <div className="text-[10px] opacity-80">По цене лота</div>
              </button>

              <button
                type="button"
                onClick={() => setPriceAcceptance('above_asking')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  priceAcceptance === 'above_asking'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-[11px] flex items-center space-x-1">
                  <span>Выше (+2%)</span>
                  <Flame className="w-3 h-3 text-amber-300" />
                </div>
                <div className="text-[10px] opacity-80">+5 в Closing</div>
              </button>

              <button
                type="button"
                onClick={() => setPriceAcceptance('discount_requested')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  priceAcceptance === 'discount_requested'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-[11px]">С торгом</div>
                <div className="text-[10px] opacity-80">Указать в комм.</div>
              </button>
            </div>
          </div>

          {/* 4. SLA Readiness */}
          <div className="space-y-1.5 pt-0.5 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={readiness24h}
                onChange={(e) => setReadiness24h(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 border-slate-300 bg-white focus:ring-emerald-500"
              />
              <span>Готовность выйти на подписание/просмотр за 24ч (+10 баллов)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={deposit48h}
                onChange={(e) => setDeposit48h(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 border-slate-300 bg-white focus:ring-emerald-500"
              />
              <span>Готовность внести задаток/обеспечение за 48ч (+10 баллов)</span>
            </label>
          </div>

          {/* 5. Buyer Comment */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              4. Комментарий куратору (необязательно):
            </label>
            <textarea
              rows={2}
              value={buyerComment}
              onChange={(e) => setBuyerComment(e.target.value)}
              maxLength={1000}
              placeholder="Банк одобренной ипотеки, источник средств, пожелания по просмотру..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* 6. Private Proof Documents Uploader */}
          <div className="space-y-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Прикрепить подтверждающие документы (до 3)</span>
              </span>
              <span className="text-[10px] text-slate-400">PDF/JPG/PNG/WebP ≤ 15 МБ</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              multiple
              onChange={handleUploadProofFiles}
              className="hidden"
            />

            {proofDocuments.length > 0 && (
              <div className="space-y-1.5">
                {proofDocuments.map((doc, idx) => (
                  <div
                    key={`${doc.objectKey}-${idx}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate font-semibold text-slate-800">{doc.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({Math.max(1, Math.round(doc.size / 1024))} КБ)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProofDocuments((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                      title="Удалить файл"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {proofDocuments.length < 3 && (
              <button
                type="button"
                disabled={uploadingDoc}
                onClick={() => (user ? fileInputRef.current?.click() : onOpenAuth())}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-300 bg-white hover:bg-indigo-50/60 text-indigo-700 font-bold text-[11px] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {uploadingDoc ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Загрузка в защищённое хранилище S3...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {hasGoldProofApproved
                        ? 'Добавить дополнительный документ (выписка / ипотека)'
                        : 'Прикрепить выписку со счёта или одобрение ипотеки (152-ФЗ)'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || uploadingDoc}
            className="w-full py-3.5 mt-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <span>Отправка заявки...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Подать заявку в тактовый дроп</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
