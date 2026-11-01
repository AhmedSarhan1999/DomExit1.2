import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Download,
  Plus,
  HardDrive,
  RefreshCw,
  Trash2,
  X,
  Lock,
} from 'lucide-react';
import { DocumentCategory, DocumentMetadata, DocumentReviewStatus } from '../../types';
import { SELLER_MANDATORY_DOC_SLOTS, StorageService } from '../../dal/StorageService';
import { useLanguage } from '../../i18n/LanguageContext';

interface DocumentVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: DocumentMetadata['entityType'];
  entityId: string;
  entityTitle?: string;
  uploadedByUid: string;
  clientCode: string;
  mode?: 'seller' | 'general';
  canUpload?: boolean;
  canReview?: boolean;
  reviewerName?: string;
  onDocumentsChanged?: (docs: DocumentMetadata[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

export const DocumentVaultModal: React.FC<DocumentVaultModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
  uploadedByUid,
  clientCode,
  mode = 'seller',
  canUpload = true,
  canReview = false,
  reviewerName = 'Куратор комплаенса 214-ФЗ',
  onDocumentsChanged,
}) => {
  const { language } = useLanguage();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [additionalDocTitle, setAdditionalDocTitle] = useState<string>('');
  const [showAdditionalInput, setShowAdditionalInput] = useState<boolean>(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<DocumentMetadata | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);

  // Curator rejection modal state
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>(
    'Нечитаемый скан страницы со штампом Росреестра. Пожалуйста, загрузите четкую копию.'
  );

  const additionalFileInputRef = useRef<HTMLInputElement | null>(null);
  const slotInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadVaultDocuments = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const list = await StorageService.getDocumentsByEntity(entityType, entityId);
      setDocuments(list);
      onDocumentsChanged?.(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVaultDocuments();
      setPreviewDoc(null);
      setPreviewUrl(null);
      setPreviewTextContent(null);
    }
  }, [isOpen, entityType, entityId]);

  if (!isOpen) return null;

  const handleUploadFile = async (
    file: File,
    category: DocumentCategory,
    categoryLabelRu: string
  ) => {
    setUploadingSlot(category);
    try {
      await StorageService.uploadDocument({
        file,
        uploadedByUid: uploadedByUid || 'usr-guest',
        clientCode: clientCode || 'DEX-000000',
        entityType,
        entityId,
        category,
        categoryLabelRu,
      });
      await loadVaultDocuments();
    } finally {
      setUploadingSlot(null);
    }
  };

  const handlePreview = async (doc: DocumentMetadata) => {
    setPreviewDoc(doc);
    setPreviewTextContent(null);
    const resolvedUrl = await StorageService.resolveObjectDataUrl(doc);
    setPreviewUrl(resolvedUrl);

    if (resolvedUrl.startsWith('blob:') && !doc.mimeType.startsWith('image/')) {
      try {
        const resp = await fetch(resolvedUrl);
        const txt = await resp.text();
        setPreviewTextContent(txt);
      } catch {
        setPreviewTextContent(null);
      }
    }
  };

  const handleStatusChange = async (
    docId: string,
    status: DocumentReviewStatus,
    reason?: string
  ) => {
    await StorageService.updateDocumentStatus(docId, status, reviewerName, reason);
    setRejectingDocId(null);
    await loadVaultDocuments();
  };

  const handleDelete = async (docId: string) => {
    await StorageService.deleteDocument(docId);
    if (previewDoc?.id === docId) {
      setPreviewDoc(null);
      setPreviewUrl(null);
    }
    await loadVaultDocuments();
  };

  const renderStatusBadge = (doc: DocumentMetadata) => {
    switch (doc.status) {
      case 'approved':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ru' ? 'Одобрен ✓' : 'Approved ✓'}</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-bold">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>{language === 'ru' ? 'Отклонен — требуется замена' : 'Rejected — Re-upload'}</span>
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{language === 'ru' ? 'На проверке комплаенса' : 'Under Compliance Review'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-300 text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
            <span>{language === 'ru' ? 'Загружен и сохранен' : 'Uploaded & Stored'}</span>
          </span>
        );
    }
  };

  const additionalDocs = documents.filter(
    (d) => !SELLER_MANDATORY_DOC_SLOTS.some((slot) => slot.category === d.category)
  );

  const completedMandatoryCount = SELLER_MANDATORY_DOC_SLOTS.filter((slot) =>
    documents.some((d) => d.category === slot.category && d.status !== 'rejected')
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Vault Header */}
        <div className="bg-[#0F172A] text-white px-6 py-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {language === 'ru'
                    ? 'Защищенный облачный сейф документов (152-ФЗ)'
                    : 'Secure Cloud Document Vault (152-FZ)'}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 font-mono text-[10px] font-bold">
                  s3://{StorageService.defaultBucket}/{entityId}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {entityTitle
                    ? `${entityTitle} • Клиент ${clientCode}`
                    : `Yandex Object Storage S3 Compatible • Клиент ${clientCode}`}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50">
          {/* Vault Progress Summary for Seller Mode */}
          {mode === 'seller' && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-black text-slate-900">
                    {language === 'ru'
                      ? `Комплектность обязательного досье продавца по 214-ФЗ: ${completedMandatoryCount} из 4 документов`
                      : `Mandatory Seller Dossier (214-FZ): ${completedMandatoryCount} of 4 documents`}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {language === 'ru'
                      ? 'Файлы шифруются контрольной суммой SHA-256 и размещаются в изолированном S3-контейнере.'
                      : 'Files are hashed with SHA-256 and stored in an isolated S3 bucket container.'}
                  </div>
                </div>
              </div>
              <div className="w-full sm:w-44 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${(completedMandatoryCount / 4) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Mandatory 4 Seller Document Slots */}
          {mode === 'seller' && (
            <div className="space-y-3">
              {SELLER_MANDATORY_DOC_SLOTS.map((slot) => {
                const slotDoc = documents.find((d) => d.category === slot.category);
                const isUploading = uploadingSlot === slot.category;

                return (
                  <div
                    key={slot.category}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all bg-white shadow-xs ${
                      slotDoc?.status === 'rejected'
                        ? 'border-rose-300 bg-rose-50/30'
                        : slotDoc
                        ? 'border-emerald-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-slate-900">
                            {language === 'ru' ? slot.titleRu : slot.titleEn}
                          </span>
                          {slotDoc ? (
                            renderStatusBadge(slotDoc)
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                              {language === 'ru' ? 'Обязательный документ' : 'Required'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {language === 'ru' ? slot.hintRu : slot.hintEn}
                        </p>

                        {slotDoc && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono">
                            <span className="font-bold text-slate-900 truncate max-w-[260px]">
                              📄 {slotDoc.name}
                            </span>
                            <span>{slotDoc.mimeType}</span>
                            <span>{formatBytes(slotDoc.sizeBytes)}</span>
                            <span>
                              {new Date(slotDoc.uploadedAt).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {slotDoc.sha256Hash && (
                              <span className="text-slate-400">
                                SHA-256: {slotDoc.sha256Hash.slice(0, 12)}…
                              </span>
                            )}
                          </div>
                        )}

                        {slotDoc?.status === 'rejected' && slotDoc.rejectionReason && (
                          <div className="mt-2 p-2.5 rounded-xl bg-rose-100/80 border border-rose-300 text-rose-900 text-xs font-semibold">
                            Причина отклонения юристом: {slotDoc.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Slot Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <input
                          ref={(el) => {
                            slotInputRefs.current[slot.category] = el;
                          }}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              handleUploadFile(f, slot.category, slot.titleRu);
                              e.target.value = '';
                            }
                          }}
                        />

                        {slotDoc && (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePreview(slotDoc)}
                              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{language === 'ru' ? 'Предпросмотр' : 'Preview'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => StorageService.downloadDocument(slotDoc)}
                              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{language === 'ru' ? 'Скачать' : 'Download'}</span>
                            </button>
                          </>
                        )}

                        {canUpload && (
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => slotInputRefs.current[slot.category]?.click()}
                            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-all ${
                              slotDoc?.status === 'rejected'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                                : slotDoc
                                ? 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            }`}
                          >
                            {isUploading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {slotDoc?.status === 'rejected'
                                ? language === 'ru'
                                  ? 'Загрузить замену'
                                  : 'Re-upload'
                                : slotDoc
                                ? language === 'ru'
                                  ? 'Обновить файл'
                                  : 'Replace'
                                : language === 'ru'
                                ? 'Загрузить файл'
                                : 'Upload File'}
                            </span>
                          </button>
                        )}

                        {canReview && slotDoc && (
                          <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(slotDoc.id, 'approved')}
                              className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                              title="Одобрить документ"
                            >
                              ✓ Одобрить
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingDocId(slotDoc.id)}
                              className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer"
                              title="Отклонить с запросом повторной загрузки"
                            >
                              ✕ Отклонить
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Additional / General Documents Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>
                  {mode === 'seller'
                    ? language === 'ru'
                      ? 'Дополнительные документы (нотариальное согласие супруга, кредитный договор, техпаспорт)'
                      : 'Additional Optional Documents'
                    : language === 'ru'
                    ? `Загруженные документы по объекту (${documents.length})`
                    : `Uploaded Documents (${documents.length})`}
                </span>
              </h4>

              {canUpload && (
                <button
                  type="button"
                  onClick={() => setShowAdditionalInput((prev) => !prev)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {language === 'ru' ? '+ Дополнительный документ' : '+ Additional Document'}
                  </span>
                </button>
              )}
            </div>

            {showAdditionalInput && canUpload && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={additionalDocTitle}
                  onChange={(e) => setAdditionalDocTitle(e.target.value)}
                  placeholder={
                    language === 'ru'
                      ? 'Название документа (например: Нотариальное согласие супруги)'
                      : 'Document title (e.g. Spousal Consent)'
                  }
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
                <input
                  ref={additionalFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleUploadFile(
                        f,
                        'additional',
                        additionalDocTitle.trim() || 'Дополнительный документ дольщика'
                      );
                      setAdditionalDocTitle('');
                      setShowAdditionalInput(false);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => additionalFileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Выбрать файл и загрузить' : 'Select & Upload'}</span>
                </button>
              </div>
            )}

            {(mode === 'seller' ? additionalDocs : documents).length === 0 ? (
              mode !== 'seller' && !loading ? (
                <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  В защищенном хранилище пока нет загруженных документов по данной записи.
                </div>
              ) : null
            ) : (
              <div className="space-y-2.5">
                {(mode === 'seller' ? additionalDocs : documents).map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {doc.categoryLabelRu || doc.name}
                        </span>
                        {renderStatusBadge(doc)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex flex-wrap gap-3">
                        <span className="text-slate-800">{doc.name}</span>
                        <span>{doc.mimeType}</span>
                        <span>{formatBytes(doc.sizeBytes)}</span>
                        <span>{new Date(doc.uploadedAt).toLocaleString('ru-RU')}</span>
                      </div>
                      {doc.status === 'rejected' && doc.rejectionReason && (
                        <div className="text-xs text-rose-700 font-semibold">
                          Причина отклонения: {doc.rejectionReason}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreview(doc)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Просмотр</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => StorageService.downloadDocument(doc)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Скачать</span>
                      </button>
                      {canUpload && doc.category === 'additional' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Удалить дополнительный документ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canReview && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(doc.id, 'approved')}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                          >
                            ✓ Одобрить
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingDocId(doc.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer"
                          >
                            ✕ Отклонить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Curator Rejection Reason Inline Box */}
          {rejectingDocId && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 space-y-3">
              <div className="text-xs font-black text-rose-950">
                Укажите причину отклонения документа (продавец увидит уведомление и кнопку повторной загрузки):
              </div>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-rose-300 bg-white text-xs text-slate-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingDocId(null)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(rejectingDocId, 'rejected', rejectionReason)}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Подтвердить отклонение
                </button>
              </div>
            </div>
          )}

          {/* Instant Inline Document Preview Pane */}
          {previewDoc && previewUrl && (
            <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4 border border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Предпросмотр объекта Yandex Object Storage (S3)
                  </div>
                  <div className="text-sm font-black text-white mt-0.5">{previewDoc.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    s3://{previewDoc.bucket}/{previewDoc.objectKey}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => StorageService.downloadDocument(previewDoc)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать оригинал</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewDoc(null);
                      setPreviewUrl(null);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Закрыть
                  </button>
                </div>
              </div>

              {previewDoc.mimeType.startsWith('image/') ||
              previewUrl.startsWith('data:image/') ? (
                <div className="bg-slate-950 rounded-2xl p-3 flex justify-center max-h-96 overflow-auto">
                  <img
                    src={previewUrl}
                    alt={previewDoc.name}
                    className="max-h-88 object-contain rounded-xl"
                  />
                </div>
              ) : previewUrl.startsWith('data:application/pdf') ? (
                <iframe
                  title={previewDoc.name}
                  src={previewUrl}
                  className="w-full h-96 rounded-2xl bg-white border border-slate-700"
                />
              ) : (
                <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {previewTextContent ||
                    `Файл: ${previewDoc.name}\nMIME: ${previewDoc.mimeType}\nРазмер: ${formatBytes(
                      previewDoc.sizeBytes
                    )}\nSHA-256: ${previewDoc.sha256Hash || 'GOST-OK'}\nГотов к прямому скачиванию.`}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500">
            {language === 'ru'
              ? `Всего файлов в контейнере: ${documents.length} • Хранилище: IndexedDB / Yandex Object Storage S3 Adapter`
              : `Total files in container: ${documents.length} • Storage: Yandex Object Storage S3 Adapter`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer"
          >
            {language === 'ru' ? 'Готово и сохранить в досье' : 'Done & Save to Dossier'}
          </button>
        </div>
      </div>
    </div>
  );
};
