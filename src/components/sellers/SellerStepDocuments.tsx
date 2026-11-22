import React from 'react';
import {
  HardDrive,
  Upload,
  FileText,
  Download,
  Eye,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { SELLER_MANDATORY_DOC_SLOTS, StorageService } from '../../dal/StorageService';
import { ConsentCheckboxes, ConsentState } from '../compliance/ConsentCheckboxes';
import { DocumentCategory, DocumentMetadata, PropertyDealTrack } from '../../types';

export interface SellerStepDocumentsProps {
  dealTrack?: PropertyDealTrack;
  draftLotCode: string;
  step3Error: string | null;
  vaultDocs: DocumentMetadata[];
  onOpenVault: () => void;
  uploadedPhotos: string[];
  isUploadingPhoto: boolean;
  onAddCustomPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  consents: ConsentState;
  onConsentsChange: (consents: ConsentState) => void;
  isSubmitting: boolean;
  usedMatkap: 'no' | 'yes';
  onBackToStep2: () => void;
  onSubmitFinal: () => void;
}

export const SECONDARY_MANDATORY_DOC_SLOTS: Array<{
  category: DocumentCategory;
  titleRu: string;
  titleEn: string;
  hintRu: string;
  hintEn: string;
  required: boolean;
}> = [
  {
    category: 'ddu_contract',
    titleRu: '1. Правоустанавливающий документ (ДКП / Приватизация / Дарение)',
    titleEn: '1. Title Document (Purchase Agreement / Privatization / Gift)',
    hintRu: 'Скан или фото договора купли-продажи, приватизации или свидетельства о праве на собственность (PDF / JPG)',
    hintEn: 'Scanned sales contract or ownership title deed (PDF / JPG)',
    required: true,
  },
  {
    category: 'additional',
    titleRu: '2. Свежая выписка из ЕГРН (Госуслуги с ЭЦП)',
    titleEn: '2. Recent EGRN Extract from Gosuslugi',
    hintRu: 'Электронная выписка об объекте недвижимости с цифровой подписью Росреестра (PDF)',
    hintEn: 'Official real estate registry extract with digital signature (PDF)',
    required: true,
  },
  {
    category: 'developer_payment_cert',
    titleRu: '3. Справка о зарегистрированных лицах (Форма 9 / Госуслуги)',
    titleEn: '3. Registered Persons Certificate (Form 9)',
    hintRu: 'Опционально. Справка о регистрации по месту жительства или архивная Форма 9',
    hintEn: 'Optional. Household registration certificate Form 9',
    required: false,
  },
  {
    category: 'sfr_maternal_cap',
    titleRu: '4. Дополнительные документы (ПНД/НД, справки об отсутствии долгов ЖКУ)',
    titleEn: '4. Additional Documents (PND/ND, Utility Debt Clearances)',
    hintRu: 'Опционально. Справки из диспансеров, согласие супруга или квитанции ЖКУ',
    hintEn: 'Optional. Medical clearances or spousal consent documents',
    required: false,
  },
];

export const SellerStepDocuments: React.FC<SellerStepDocumentsProps> = ({
  dealTrack,
  draftLotCode,
  step3Error,
  vaultDocs,
  onOpenVault,
  uploadedPhotos,
  isUploadingPhoto,
  onAddCustomPhoto,
  onRemovePhoto,
  consents,
  onConsentsChange,
  isSubmitting,
  usedMatkap,
  onBackToStep2,
  onSubmitFinal,
}) => {
  const { language } = useLanguage();
  const isSecondary = dealTrack === 'secondary_dkp';

  const docSlots = isSecondary ? SECONDARY_MANDATORY_DOC_SLOTS : SELLER_MANDATORY_DOC_SLOTS;
  const mandatorySlots = docSlots.filter((s) => s.required);
  const mandatoryUploadedCount = mandatorySlots.filter((slot) =>
    vaultDocs.some((d) => d.category === slot.category && d.status !== 'rejected')
  ).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-black text-slate-900">
          {language === 'ru'
            ? 'Загрузка документов для юридической проверки'
            : 'Legal Documents Upload'}
        </h3>
        <p className="text-xs text-slate-500">
          Загрузите обязательные документы дольщика. Каждый файл сохраняется в защищенном контуре и доступен для проверки юристом.
        </p>
      </div>

      {step3Error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{step3Error}</span>
        </div>
      )}

      {/* Vault Launcher Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-emerald-300">
              Досье #{draftLotCode}
            </span>
          </div>
          <h4 className="text-base font-black">
            Обязательные документы: {mandatoryUploadedCount} из {mandatorySlots.length} загружено
          </h4>
          <p className="text-xs text-slate-300">
            Всего файлов загружено: <strong>{vaultDocs.length}</strong> (включая дополнительные документы).
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenVault}
          className="px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Открыть окно загрузки документов</span>
        </button>
      </div>

      {/* Live Checklist of Seller Documents */}
      <div className="space-y-2.5">
        {docSlots.map((slot) => {
          const found = vaultDocs.find((d) => d.category === slot.category);
          return (
            <div
              key={slot.category}
              className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                found
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start space-x-2.5">
                <FileText
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    found ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                    <span>{slot.titleRu}</span>
                    {!slot.required && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {slot.category === 'sfr_maternal_cap' ? 'Опционально — если есть дети' : 'Опционально'}
                      </span>
                    )}
                  </div>
                  {found ? (
                    <div className="text-[11px] font-mono text-emerald-800 mt-0.5">
                      ✓ {found.name} ({(found.sizeBytes / 1024).toFixed(1)} КБ • На проверке)
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">{slot.hintRu}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {found ? (
                  <>
                    <button
                      type="button"
                      onClick={() => StorageService.downloadDocument(found)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Скачать</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenVault}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Просмотр</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenVault}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Загрузить →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Photo & Floorplan Upload Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Фотографии ЖК, вида из окна и планировки ({uploadedPhotos.length})
            </h4>
            <p className="text-[11px] text-slate-500">
              Куратор проверит отсутствие персональных данных и опубликует фото в каталоге
            </p>
          </div>
          <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center space-x-1">
            <Upload className="w-3.5 h-3.5" />
            <span>Добавить фото</span>
            <input
              type="file"
              className="hidden"
              onChange={onAddCustomPhoto}
              accept="image/*"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {uploadedPhotos.length === 0 && !isUploadingPhoto && (
            <div className="col-span-2 sm:col-span-4 p-4 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
              Нет загруженных фото. Вы можете добавить реальные фотографии квартиры, вида из окна или планировки.
            </div>
          )}

          {isUploadingPhoto && (
            <div className="col-span-2 sm:col-span-4 p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl text-center text-xs text-emerald-800 flex items-center justify-center space-x-2 font-medium animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Загрузка фото в Yandex Object Storage S3...</span>
            </div>
          )}

          {uploadedPhotos.map((photo, index) => (
            <div
              key={index}
              className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100"
            >
              <img
                src={photo}
                alt={`Фото ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
                }}
              />
              <button
                type="button"
                onClick={() => onRemovePhoto(index)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 text-[10px] cursor-pointer"
                title="Удалить"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Unbundled Legal & 152-FZ / 38-FZ Consents */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <ConsentCheckboxes
          value={consents}
          onChange={onConsentsChange}
        />
      </div>

      <div className="flex justify-between items-center pt-4">
        <button
          type="button"
          onClick={onBackToStep2}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          ← Назад
        </button>
        <button
          type="button"
          disabled={isSubmitting || usedMatkap === 'yes' || !consents.pdProcessing || !consents.termsAgreed}
          onClick={onSubmitFinal}
          className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>Сохранение в базе...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Отправить заявку на аудит (0% комиссии)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
