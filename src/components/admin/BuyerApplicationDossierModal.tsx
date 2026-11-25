import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  Award,
  Clock,
  XCircle,
  Phone,
  Mail,
  Send,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { formatRubles } from '../../utils/formatters';

export interface BuyerApplicationDossierModalProps {
  app: any | null;
  lotCode: string;
  hasOtherActiveWinner: boolean;
  onClose: () => void;
  onVerify: (
    appId: string,
    status: 'verified' | 'needs_clarification' | 'pending',
    note: string
  ) => Promise<void>;
  onSelectWinner: (appId: string) => Promise<void>;
  onSetWaitlist: (
    appId: string,
    targetStatus: 'reserve_2' | 'reserve_3' | 'waitlist' | 'pending_review'
  ) => Promise<void>;
  onReject: (appId: string, reason: string) => Promise<void>;
}

const PAYMENT_LABEL: Record<string, string> = {
  cash_100: '100% Наличные / СБР',
  family_mortgage_approved: 'Семейная ипотека (одобрена)',
  standard_mortgage_approved: 'Стандартная ипотека (одобрена)',
  alternative: 'Альтернативная сделка',
};

export const BuyerApplicationDossierModal: React.FC<BuyerApplicationDossierModalProps> = ({
  app,
  lotCode,
  hasOtherActiveWinner,
  onClose,
  onVerify,
  onSelectWinner,
  onSetWaitlist,
  onReject,
}) => {
  const [note, setNote] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  useEffect(() => {
    if (app) {
      setNote(app.curatorVerificationNote || '');
      setRejectReason('');
      setShowRejectBox(false);
      setDocError(null);
    }
  }, [app?.id]);

  if (!app) return null;

  const isArchived = [
    'rejected',
    'withdrawn',
    'withdrawn_from_queue',
    'withdrawn_from_deal',
    'completed',
    'lot_closed',
    'expired',
  ].includes(String(app.queueStatus || ''));
  const isWinner = app.queueStatus === 'priority_1' || app.queueStatus === 'in_deal';
  const isStandby = app.queueStatus === 'standby_in_other_deal';

  const handleOpenProofDoc = async (objectKey: string, name: string) => {
    setDocError(null);
    try {
      const res = await apiClient.get<{ downloadUrl?: string }>(
        `/api/storage/presign-download?key=${encodeURIComponent(
          objectKey
        )}&lotCode=${encodeURIComponent(lotCode)}&filename=${encodeURIComponent(name)}`
      );
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        setDocError('Не удалось получить временную ссылку на документ');
      }
    } catch (err: any) {
      setDocError(err?.message || 'Ошибка доступа к защищённому документу S3');
    }
  };

  const handleOpenGoldDoc = async (requestId: string) => {
    setDocError(null);
    try {
      const res = await apiClient.get<{ downloadUrl?: string }>(
        `/api/tier-requests/${encodeURIComponent(requestId)}/document-url`
      );
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        setDocError('Не удалось получить ссылку на документ Gold-верификации');
      }
    } catch (err: any) {
      setDocError(err?.message || 'Ошибка доступа к документу Gold-верификации');
    }
  };

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusyAction(key);
    setDocError(null);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

  const phone = app.buyerPhone || app.userPhone || '';
  const email = app.buyerEmail || app.userEmail || '';
  const tgRaw = app.buyerTelegram || app.telegramUsername || '';
  const tgHref = tgRaw
    ? tgRaw.startsWith('http')
      ? tgRaw
      : `https://t.me/${tgRaw.replace(/^@+/, '')}`
    : '';
  const proofDocs: Array<any> = Array.isArray(app.proofDocuments) ? app.proofDocuments : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-3 rounded-t-3xl">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              Досье и проверка заявки покупателя • Лот #{lotCode}
            </span>
            <h3 className="text-base sm:text-lg font-black">
              {app.userName || email || 'Покупатель'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 text-xs text-slate-800">
          {/* Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Ранг клиента</span>
              <strong className="text-sm font-black text-slate-900">
                {app.tier === 'gold' ? '🥇 Gold' : app.tier === 'bronze' ? '🥉 Bronze' : '🥈 Silver'}
              </strong>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Живой SLA рейтинг</span>
              <strong
                className={`text-sm font-black font-mono ${
                  (app.reliabilityScore ?? 100) >= 90
                    ? 'text-emerald-700'
                    : (app.reliabilityScore ?? 100) >= 70
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {app.reliabilityScore ?? 100}/100
              </strong>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
              <span className="text-[10px] text-indigo-700 block">Closing Score</span>
              <strong className="text-sm font-black font-mono text-indigo-900">
                {app.closingScore ?? 0}/105
              </strong>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] text-emerald-700 block">Match лота</span>
              <strong className="text-sm font-black font-mono text-emerald-900">
                {app.matchScore ?? 0}%
              </strong>
            </div>
          </div>

          {/* Buyer Contacts */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              Контакты покупателя (152-ФЗ — только для куратора сделки)
            </span>
            <div className="flex flex-wrap gap-2">
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-800 hover:bg-slate-100"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{phone}</span>
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-800 hover:bg-slate-100"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{email}</span>
                </a>
              )}
              {tgHref && (
                <a
                  href={tgHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 font-bold text-sky-800 hover:bg-sky-100"
                >
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                  <span>{tgRaw}</span>
                </a>
              )}
              {!phone && !email && !tgHref && (
                <span className="text-slate-400">Контактные данные не заполнены</span>
              )}
            </div>
          </div>

          {/* Submitted Terms & Comment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                Параметры текущей заявки
              </span>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Способ расчётов:</span>
                  <strong className="text-slate-900">
                    {PAYMENT_LABEL[app.paymentMethod || 'cash_100'] || app.paymentMethod}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Подтверждённый кэш:</span>
                  <strong className="font-mono text-emerald-800">
                    {app.confirmedCashRub ? formatRubles(app.confirmedCashRub) : 'Не указан'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Цена:</span>
                  <strong>
                    {app.priceAcceptance === 'above_asking'
                      ? 'Выше рынка (+2%)'
                      : app.priceAcceptance === 'discount_requested'
                      ? 'С запросом торга'
                      : 'По полной цене'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Готовность 24ч / 48ч:</span>
                  <strong>
                    {app.readiness24h ? '24ч ✓' : '24ч ✕'} • {app.deposit48h ? '48ч ✓' : '48ч ✕'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ПЭП / NDA (63-ФЗ):</span>
                  <strong className={app.ndaSigned ? 'text-emerald-700' : 'text-amber-700'}>
                    {app.ndaSigned ? 'Подписано ✓' : 'Ожидает подписания'}
                  </strong>
                </div>
              </div>
              {app.buyerComment && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-slate-800">
                  <strong className="block text-amber-900 mb-0.5">Комментарий покупателя:</strong>
                  {app.buyerComment}
                </div>
              )}
            </div>

            {/* Buy-Box & Platform History */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                Профиль Buy-Box и история в DomExit
              </span>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Макс. бюджет (Buy-Box):</span>
                  <strong className="font-mono">
                    {app.buyBoxSummary?.maxBudgetRub
                      ? formatRubles(app.buyBoxSummary.maxBudgetRub)
                      : '—'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Заявок на платформе:</span>
                  <strong>{app.totalPlatformAppsCount || 1}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Подтверждённых просмотров:</span>
                  <strong className="text-emerald-700">{app.completedViewingsCount ?? 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Срывы / неявки (No-Show):</span>
                  <strong className={(app.noShowCount ?? 0) > 0 ? 'text-rose-600' : 'text-slate-800'}>
                    {app.noShowCount ?? 0}
                  </strong>
                </div>
                {app.buyBoxSummary?.preferredBanks && app.buyBoxSummary.preferredBanks.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Банки:</span>
                    <strong className="text-right">{app.buyBoxSummary.preferredBanks.join(', ')}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* S3 Private Proof Documents */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Прикреплённые документы покупателя (S3 Private)</span>
              </span>
              {app.goldVerification && (
                <button
                  type="button"
                  onClick={() => handleOpenGoldDoc(app.goldVerification.requestId)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold text-[11px] cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-amber-700" />
                  <span>Документ Gold-верификации</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {docError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                {docError}
              </div>
            )}

            {proofDocs.length === 0 ? (
              <div className="text-slate-500 text-[11px] bg-white p-3 rounded-xl border border-slate-200">
                Покупатель не прикреплял дополнительные файлы к этой заявке.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {proofDocs.map((doc: any, idx: number) => (
                  <button
                    key={`${doc.objectKey}-${idx}`}
                    type="button"
                    onClick={() => handleOpenProofDoc(doc.objectKey, doc.name)}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block truncate">{doc.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {Math.max(1, Math.round(Number(doc.size || 0) / 1024))} КБ • Signed URL
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Curator Verification Box */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900 flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Статус проверки куратором</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  app.curatorVerificationStatus === 'verified'
                    ? 'bg-emerald-100 text-emerald-800'
                    : app.curatorVerificationStatus === 'needs_clarification'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {app.curatorVerificationStatus === 'verified'
                  ? '✓ Проверено куратором'
                  : app.curatorVerificationStatus === 'needs_clarification'
                  ? '📝 Требуются уточнения'
                  : 'Ожидает проверки'}
              </span>
            </div>

            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Заключение по документам / платёжеспособности покупателя или запрос уточнений..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs focus:border-indigo-500 focus:outline-hidden resize-none"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() =>
                  runAction('verify', () => onVerify(app.id, 'verified', note))
                }
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {busyAction === 'verify' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>✓ Проверено куратором</span>
              </button>

              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() =>
                  runAction('clarify', () => onVerify(app.id, 'needs_clarification', note))
                }
                className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Запросить уточнение</span>
              </button>
            </div>
          </div>

          {/* Direct Individual Decisions */}
          {!isArchived && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                Индивидуальное решение по этому кандидату
              </span>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(busyAction) || isWinner || isStandby || hasOtherActiveWinner}
                  onClick={() => runAction('winner', () => onSelectWinner(app.id))}
                  title={
                    isStandby
                      ? 'Покупатель занят в другой активной сделке'
                      : hasOtherActiveWinner
                      ? 'На этом лоте уже выбран другой победитель №1'
                      : 'Назначить этого покупателя победителем №1'
                  }
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>{isWinner ? '✓ Победитель №1' : 'Выбрать Победителем №1'}</span>
                </button>

                {!isStandby && (
                  <>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => runAction('r2', () => onSetWaitlist(app.id, 'reserve_2'))}
                      className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="w-3.5 h-3.5 text-sky-600" />
                      <span>Резерв №2</span>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => runAction('r3', () => onSetWaitlist(app.id, 'reserve_3'))}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer disabled:opacity-50"
                    >
                      Резерв №3
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => runAction('wl', () => onSetWaitlist(app.id, 'waitlist'))}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer disabled:opacity-50"
                    >
                      Лист ожидания
                    </button>
                  </>
                )}

                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => setShowRejectBox((v) => !v)}
                  className="ml-auto px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold flex items-center space-x-1.5 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Отклонить</span>
                </button>
              </div>

              {showRejectBox && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <label className="font-bold text-rose-900 block">
                    Причина отклонения заявки (обязательно, увидит покупатель):
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Например: недостаточно подтверждённой ликвидности / отказ банка"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-xs focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectBox(false)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction) || rejectReason.trim().length < 3}
                      onClick={() => runAction('reject', () => onReject(app.id, rejectReason.trim()))}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-50"
                    >
                      Подтвердить отклонение
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
