import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  HardDrive,
  RefreshCw,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { DocumentMetadata, Lot } from '../../../types';
import { SELLER_MANDATORY_DOC_SLOTS, StorageService } from '../../../dal/StorageService';

interface InlineSellerDocumentsPanelProps {
  lot: Lot;
  documents: DocumentMetadata[];
  loading: boolean;
  curatorName: string;
  onRefreshDocuments: () => Promise<void>;
  onOpenFullVault: () => void;
  onOpenRequestDocsModal: () => void;
  onNotice: (msg: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

export const InlineSellerDocumentsPanel: React.FC<InlineSellerDocumentsPanelProps> = ({
  lot,
  documents,
  loading,
  curatorName,
  onRefreshDocuments,
  onOpenFullVault,
  onOpenRequestDocsModal,
  onNotice,
}) => {
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(
    'Нечитаемый скан или отсутствуют все страницы / штамп Росреестра.'
  );

  const isSecondary = lot.dealTrack === 'secondary_dkp';
  const hasApprovedDdu = documents.some((d) => d.category === 'ddu_contract' && d.status === 'approved');
  const hasApprovedDevCert = documents.some((d) => d.category === 'developer_payment_cert' && d.status === 'approved');
  const hasApprovedEgrn = documents.some(
    (d) => (d.category === 'rosreestr_extract' || d.category === 'ddu_contract') && d.status === 'approved'
  );

  const handlePreviewDoc = async (doc: DocumentMetadata) => {
    try {
      const url = await StorageService.resolveObjectDataUrl(doc);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        onNotice('Не удалось получить защищённую ссылку для просмотра файла.');
      }
    } catch (err: any) {
      onNotice(`Ошибка открытия файла: ${err?.message || 'Сбой S3'}`);
    }
  };

  const handleApproveDoc = async (doc: DocumentMetadata) => {
    setBusyDocId(doc.id);
    try {
      await StorageService.updateDocumentStatus(doc.id, 'approved', curatorName);
      await onRefreshDocuments();
      onNotice(`✓ Документ «${doc.name}» проверен и одобрен.`);
    } finally {
      setBusyDocId(null);
    }
  };

  const handleConfirmRejectDoc = async (docId: string) => {
    setBusyDocId(docId);
    try {
      await StorageService.updateDocumentStatus(
        docId,
        'rejected',
        curatorName,
        rejectReason.trim() || 'Документ отклонён юристом'
      );
      setRejectingDocId(null);
      await onRefreshDocuments();
      onNotice('Документ отклонён с указанием причины.');
    } finally {
      setBusyDocId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-indigo-700">
            <HardDrive className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider">
              ОБЯЗАТЕЛЬНЫЕ ДОКУМЕНТЫ ПРОДАВЦА (S3 PRIVATE VAULT)
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900">
            Проверка оригиналов и сканов по лоту #{lot.lotCode}
          </h3>
          <p className="text-xs text-slate-500">
            Для допуска к упаковке и выдачи штампа необходимо просмотреть и одобрить обязательные документы продавца.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onRefreshDocuments()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
          <button
            type="button"
            onClick={onOpenRequestDocsModal}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 cursor-pointer"
          >
            Запросить доп. файлы у продавца
          </button>
          <button
            type="button"
            onClick={onOpenFullVault}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Загрузить / Все слоты S3</span>
          </button>
        </div>
      </div>

      {/* Mandatory checklist summary pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {isSecondary ? (
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between ${
              hasApprovedEgrn
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center space-x-2 font-bold">
              {hasApprovedEgrn ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>Правоустанавливающий документ / Выписка ЕГРН</span>
            </div>
            <span className="font-mono text-[11px] font-bold">
              {hasApprovedEgrn ? 'Одобрен ✓' : 'Требуется одобрение'}
            </span>
          </div>
        ) : (
          <>
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                hasApprovedDdu
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold">
                {hasApprovedDdu ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>1. Договор ДДУ (ddu_contract)</span>
              </div>
              <span className="font-mono text-[11px] font-bold">
                {hasApprovedDdu ? 'Одобрен ✓' : 'Требуется одобрение'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                hasApprovedDevCert
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold">
                {hasApprovedDevCert ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>2. Справка оплаты застройщика (developer_payment_cert)</span>
              </div>
              <span className="font-mono text-[11px] font-bold">
                {hasApprovedDevCert ? 'Одобрена ✓' : 'Требуется одобрение'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Uploaded Files List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Загрузка файлов из защищённого хранилища S3...</div>
      ) : documents.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-xs font-bold text-slate-700">
            По лоту #{lot.lotCode} пока нет загруженных документов в S3.
          </p>
          <p className="text-[11px] text-slate-500">
            Запросите сканы у продавца или загрузите их через кнопку «Загрузить / Все слоты S3».
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const slotMeta = SELLER_MANDATORY_DOC_SLOTS.find((s) => s.category === doc.category);
            const isApprovedDoc = doc.status === 'approved';
            const isRejectedDoc = doc.status === 'rejected';
            const isBusy = busyDocId === doc.id;

            return (
              <div
                key={doc.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  isApprovedDoc
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : isRejectedDoc
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <FileText
                        className={`w-5 h-5 ${
                          isApprovedDoc
                            ? 'text-emerald-600'
                            : isRejectedDoc
                            ? 'text-rose-600'
                            : 'text-indigo-600'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-slate-900 truncate">{doc.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isApprovedDoc
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : isRejectedDoc
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          {isApprovedDoc
                            ? '✓ Одобрен'
                            : isRejectedDoc
                            ? '✕ Отклонён'
                            : '⏳ Ожидает проверки'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {slotMeta?.titleRu || doc.categoryLabelRu || doc.category} • {formatBytes(doc.sizeBytes)} •{' '}
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString('ru-RU') : '—'}
                      </p>
                      {doc.reviewedBy && (
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Проверил: {doc.reviewedBy}
                          {doc.rejectionReason ? ` • Причина: ${doc.rejectionReason}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewDoc(doc)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Открыть</span>
                    </button>

                    {!isApprovedDoc && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleApproveDoc(doc)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1 shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isBusy ? 'Сохранение...' : 'Одобрить документ'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setRejectingDocId(rejectingDocId === doc.id ? null : doc.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Отклонить</span>
                    </button>
                  </div>
                </div>

                {rejectingDocId === doc.id && (
                  <div className="p-3 bg-white rounded-xl border border-rose-200 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Укажите причину отклонения документа..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleConfirmRejectDoc(doc.id)}
                      className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Подтвердить отказ
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
