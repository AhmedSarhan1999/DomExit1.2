import React, { useState } from 'react';
import {
  X,
  Award,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Building,
  CreditCard,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { BuyBoxTier, TierVerificationProofType, TierVerificationRequest } from '../../types';

export interface GoldUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: BuyBoxTier;
  onSuccess: (request: TierVerificationRequest) => void;
}

export const GoldUpgradeModal: React.FC<GoldUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  onSuccess,
}) => {
  const [proofType, setProofType] = useState<TierVerificationProofType>('cash_100_statement');
  const [declaredBudgetRub, setDeclaredBudgetRub] = useState<number>(15000000);
  const [comment, setComment] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(selected.type)) {
      setError('Недопустимый формат файла. Разрешены только PDF, JPG, PNG или WebP.');
      setFile(null);
      return;
    }

    if (selected.size > 15 * 1024 * 1024) {
      setError('Размер файла превышает лимит 15 МБ.');
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!declaredBudgetRub || declaredBudgetRub <= 0) {
      setError('Укажите корректный заявленный инвестиционный бюджет.');
      return;
    }

    if (!file) {
      setError('Прикрепите подтверждающий документ (выписку со счета или одобрение ипотеки).');
      return;
    }

    setUploading(true);
    setUploadProgress('Инициализация защищенного канала S3...');

    try {
      // 1. Get presigned upload URL from server
      const presign = await apiClient.post<{
        success: boolean;
        uploadUrl: string;
        storageKey: string;
      }>('/api/storage/presign-upload', {
        scope: 'document',
        lotCode: 'tier-verification',
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        fileSize: file.size,
      });

      if (!presign?.uploadUrl || !presign?.storageKey) {
        throw new Error('Не удалось получить ссылку для загрузки файла');
      }

      // 2. Direct S3 Upload
      setUploadProgress('Загрузка зашифрованного файла в приватный контур 152-ФЗ...');
      const s3UploadRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/pdf',
        },
      });

      if (!s3UploadRes.ok) {
        throw new Error(`Ошибка загрузки в хранилище (HTTP ${s3UploadRes.status})`);
      }

      // 3. Register Verification Request
      setUploadProgress('Регистрация заявки на рассмотрение куратора...');
      const res = await apiClient.tierVerification.submitRequest({
        proofType,
        declaredBudgetRub,
        documentKey: presign.storageKey,
        documentName: file.name,
        documentMime: file.type || 'application/pdf',
        documentSize: file.size,
        comment: comment.trim() || undefined,
      });

      if (res.ok && res.request) {
        onSuccess(res.request);
        onClose();
      } else {
        throw new Error(res.message || 'Не удалось зарегистрировать заявку');
      }
    } catch (err: any) {
      setError(err.message || 'Произошла непредвиденная ошибка при отправке заявки');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Заявка на статус Gold
              </h3>
              <p className="text-xs text-slate-500">
                Верификация платежеспособности для доступа к стадии P1
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Benefits Note */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs space-y-1.5 leading-relaxed">
          <div className="font-bold flex items-center space-x-1.5 text-amber-900">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Привилегии подтвержденного инвестора Gold:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-900/90 text-[11px] pl-1">
            <li>Эксклюзивный доступ 24 часа ко всем закрытым лотам платформы (Стадия P1).</li>
            <li>Приоритет в очереди сделок и прямое согласование показов.</li>
            <li>Файлы передаются в зашифрованное хранилище S3 с доступом только куратора (152-ФЗ).</li>
          </ul>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Proof Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Тип подтверждения ликвидности <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProofType('cash_100_statement')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  proofType === 'cash_100_statement'
                    ? 'bg-amber-50/70 border-amber-400 text-slate-900 ring-2 ring-amber-300/60'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold">100% средства</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Выписка из банка об остатке на счете или вкладе
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProofType('mortgage_approval')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  proofType === 'mortgage_approval'
                    ? 'bg-amber-50/70 border-amber-400 text-slate-900 ring-2 ring-amber-300/60'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Building className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold">Ипотека банка</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Письмо об одобрении лимита от банка-партнера
                </p>
              </button>
            </div>
          </div>

          {/* Declared Budget */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Заявленный инвестиционный бюджет (₽) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1000000"
              step="500000"
              value={declaredBudgetRub || ''}
              onChange={(e) => setDeclaredBudgetRub(Number(e.target.value))}
              placeholder="15000000"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold text-sm focus:border-amber-500 focus:outline-hidden"
            />
            <span className="text-[10px] text-slate-400 block">
              {(declaredBudgetRub || 0).toLocaleString('ru-RU')} ₽
            </span>
          </div>

          {/* Document File Uploader */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Подтверждающий документ (PDF, JPG, PNG до 15 МБ) <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-amber-400 transition-colors bg-slate-50/50">
              <input
                type="file"
                id="tierProofFileInput"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
              <label
                htmlFor="tierProofFileInput"
                className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
              >
                <UploadCloud className="w-7 h-7 text-amber-600" />
                <span className="text-xs font-bold text-slate-800">
                  {file ? file.name : 'Нажмите для выбора файла документа'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {file
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} МБ • Файл выбран`
                    : 'Выписка со счета, справка банка или одобрение ипотеки'}
                </span>
              </label>
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Комментарий для куратора (необязательно)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Дополнительные детали: готовность к сделке за 24ч, предпочтительный банк и т.д."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center space-x-2 text-xs text-amber-900 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
              <span>{uploadProgress || 'Обработка...'}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Отправка...</span>
                </>
              ) : (
                <>
                  <Award className="w-4 h-4" />
                  <span>Подать заявку на Gold</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
