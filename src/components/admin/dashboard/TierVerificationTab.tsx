import React, { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  ShieldCheck,
  Building,
  CreditCard,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { TierVerificationRequest } from '../../../types';
import { TierVerificationRepository } from '../../../dal/repositories/TierVerificationRepository';
import { PaginationControls } from '../PaginationControls';
import { formatRubles } from '../../../utils/formatters';

export interface TierVerificationTabProps {
  operatorName: string;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
  onPendingCountChange?: (count: number) => void;
}

export const TierVerificationTab: React.FC<TierVerificationTabProps> = ({
  operatorName,
  showToast,
  showError,
  onPendingCountChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'archive'>('pending');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  // Pagination & Filtering
  const [items, setItems] = useState<TierVerificationRequest[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Rejection Modal State
  const [rejectingItem, setRejectingItem] = useState<TierVerificationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const loadData = async (targetSubTab = activeSubTab, targetPage = page, targetLimit = limit) => {
    setLoading(true);
    try {
      const res = await TierVerificationRepository.getRequests({
        status: targetSubTab,
        page: targetPage,
        limit: targetLimit,
      });

      setItems(res.items || []);
      setTotal(res.total || 0);

      // Also get pending count for tab badge
      if (targetSubTab === 'pending') {
        setPendingCount(res.total || 0);
        onPendingCountChange?.(res.total || 0);
      } else {
        // Query pending count in background
        TierVerificationRepository.getRequests({ status: 'pending', limit: 1 })
          .then((pRes) => {
            setPendingCount(pRes.total || 0);
            onPendingCountChange?.(pRes.total || 0);
          })
          .catch(() => {});
      }
    } catch (err: any) {
      showError(err.message || 'Не удалось загрузить заявки на верификацию');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeSubTab, page, limit);
  }, [activeSubTab, page, limit]);

  const handleSubTabChange = (newSubTab: 'pending' | 'archive') => {
    setActiveSubTab(newSubTab);
    setPage(1);
  };

  const handleOpenDocument = async (req: TierVerificationRequest) => {
    setOpeningDocId(req.id);
    try {
      const downloadUrl = await TierVerificationRepository.getDocumentUrl(req.id);
      if (downloadUrl) {
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Ссылка на документ недоступна');
      }
    } catch (err: any) {
      showError(err.message || 'Не удалось открыть документ (истек срок ссылки или ошибка S3)');
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleApprove = async (req: TierVerificationRequest) => {
    if (
      !window.confirm(
        `Подтвердить статус Gold для инвестора ${req.userName || req.userEmail}?\n\nБюджет: ${req.declaredBudgetRub.toLocaleString('ru-RU')} ₽\nПользователю будет открыт эксклюзивный доступ к стадии P1.`
      )
    ) {
      return;
    }

    setActionLoadingId(req.id);
    try {
      await TierVerificationRepository.makeDecision(req.id, 'approved');
      showToast(`Статус Gold успешно подтвержден для ${req.userName || req.userEmail}!`);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Не удалось подтвердить статус Gold');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length < 3) {
      setRejectError('Укажите причину отказа (минимум 3 символа)');
      return;
    }

    setActionLoadingId(rejectingItem.id);
    setRejectError(null);
    try {
      await TierVerificationRepository.makeDecision(rejectingItem.id, 'rejected', trimmed);
      showToast(`Заявка ${rejectingItem.id} отклонена.`);
      setRejectingItem(null);
      setRejectReason('');
      loadData();
    } catch (err: any) {
      setRejectError(err.message || 'Не удалось отклонить заявку');
    } finally {
      setActionLoadingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1.5">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>ИНВЕСТИЦИОННЫЙ РЕГЛАМЕНТ & ХРАНИЛИЩЕ 152-ФЗ</span>
            </span>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white font-black text-xs animate-pulse">
                {pendingCount} {pendingCount === 1 ? 'новая' : 'новых'}
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Верификация платежеспособности инвесторов (Статус Gold)
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Проверка выписок 100% собственных средств и писем об одобрении ипотеки. После одобрения инвестору автоматически присваивается ранг Gold с ранним доступом к стадии P1.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData()}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center space-x-1.5 shrink-0 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Обновить</span>
        </button>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => handleSubTabChange('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'pending'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Ожидают проверки</span>
          {pendingCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeSubTab === 'pending' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSubTabChange('archive')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'archive'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Архив решений</span>
        </button>
      </div>

      {/* 3. Requests Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mx-auto mb-2" />
            <span>Загрузка заявок на верификацию...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">
              {activeSubTab === 'pending'
                ? 'Нет заявок, ожидающих рассмотрения'
                : 'В архиве пока нет обработанных заявок'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {activeSubTab === 'pending'
                ? 'Все заявки инвесторов рассмотрены кураторами.'
                : 'Здесь будут отображаться одобренные и отклоненные заявки.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">Дата подачи</th>
                  <th className="py-3 px-4 font-bold">Инвестор</th>
                  <th className="py-3 px-4 font-bold">Тип подтверждения</th>
                  <th className="py-3 px-4 font-bold">Заявленный бюджет</th>
                  <th className="py-3 px-4 font-bold">Документ (S3)</th>
                  {activeSubTab === 'archive' ? (
                    <>
                      <th className="py-3 px-4 font-bold">Статус / Решение</th>
                      <th className="py-3 px-4 font-bold">Куратор</th>
                    </>
                  ) : (
                    <th className="py-3 px-4 font-bold text-right">Действия</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((req) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  const isRejected = req.status === 'rejected';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        <div>{new Date(req.createdAt).toLocaleDateString('ru-RU')}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(req.createdAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{req.userName || 'Инвестор'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{req.userEmail}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: {req.userId?.slice(-6) || 'usr'} • Ранг: {req.currentTier.toUpperCase()}
                        </div>
                      </td>

                      {/* Proof Type */}
                      <td className="py-3.5 px-4">
                        {req.proofType === 'cash_100_statement' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                            <CreditCard className="w-3 h-3 text-emerald-600" />
                            <span>100% средств</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold">
                            <Building className="w-3 h-3 text-blue-600" />
                            <span>Ипотека банка</span>
                          </span>
                        )}
                        {req.comment && (
                          <div className="text-[10px] text-slate-500 italic mt-1 max-w-[200px] truncate" title={req.comment}>
                            «{req.comment}»
                          </div>
                        )}
                      </td>

                      {/* Declared Budget */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                        {formatRubles(req.declaredBudgetRub)}
                      </td>

                      {/* Document Viewer Button */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          disabled={openingDocId === req.id}
                          onClick={() => handleOpenDocument(req)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-indigo-700 font-bold text-[11px] transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          title={`Открыть зашифрованный файл: ${req.documentName}`}
                        >
                          {openingDocId === req.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                          <span className="truncate max-w-[120px]">{req.documentName}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                        </button>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {(req.documentSize / (1024 * 1024)).toFixed(2)} МБ • 5-мин токен
                        </div>
                      </td>

                      {/* Archive Columns */}
                      {activeSubTab === 'archive' && (
                        <>
                          <td className="py-3.5 px-4">
                            {isApproved ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-black">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                                <span>🥇 Одобрено (Gold)</span>
                              </span>
                            ) : (
                              <div>
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 text-[11px] font-bold">
                                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                                  <span>Отклонено</span>
                                </span>
                                {req.reviewNote && (
                                  <div className="text-[11px] text-red-700 mt-1 max-w-[200px]" title={req.reviewNote}>
                                    Причина: {req.reviewNote}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-600">
                            <div className="font-bold text-slate-800">{req.reviewedByName || 'Куратор'}</div>
                            {req.reviewedAt && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {new Date(req.reviewedAt).toLocaleDateString('ru-RU')}{' '}
                                {new Date(req.reviewedAt).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      {/* Pending Actions */}
                      {activeSubTab === 'pending' && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              disabled={actionLoadingId === req.id}
                              onClick={() => handleApprove(req)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer disabled:opacity-50"
                              title="Присвоить ранг Gold и открыть доступ к стадии P1"
                            >
                              {actionLoadingId === req.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Одобрить Gold</span>
                            </button>

                            <button
                              type="button"
                              disabled={actionLoadingId === req.id}
                              onClick={() => {
                                setRejectingItem(req);
                                setRejectReason('');
                                setRejectError(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-red-700 font-bold text-xs border border-slate-200 hover:border-red-200 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                              title="Отклонить с указанием причины"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Отклонить</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Pagination Controls */}
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50]}
          isLoading={loading}
        />
      </div>

      {/* 5. Mandatory Rejection Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">
                  Отклонение заявки на Gold
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Отмена
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Инвестор: <strong>{rejectingItem.userName || rejectingItem.userEmail}</strong>
              <br />
              Укажите официальную причину отклонения. Причина будет отправлена пользователю и зафиксирована в протоколе <strong>audit_logs</strong>.
            </p>

            {rejectError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{rejectError}</span>
              </div>
            )}

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Например: Недостаточный остаток средств на выписке для подтверждения бюджета 15 млн ₽..."
              rows={3}
              maxLength={400}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:border-red-500 focus:outline-hidden resize-none"
            />

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={actionLoadingId === rejectingItem.id || rejectReason.trim().length < 3}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {actionLoadingId === rejectingItem.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Подтвердить отказ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
