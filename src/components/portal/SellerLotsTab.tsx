import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Upload,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  ShieldCheck,
  MessageSquare,
  Phone,
  Send,
  FolderLock,
  Download,
} from 'lucide-react';
import {
  Lot,
  DealTrack,
  SellerExitRequest,
  DocumentMetadata,
  Employee,
} from '../../types';
import { formatRubles } from '../../utils/formatters';
import { StorageService } from '../../dal/StorageService';
import { useLanguage } from '../../i18n/LanguageContext';

const STAGE_LABEL_RU: Record<DealTrack['stage'], string> = {
  initial_audit: '1. Первичный комплаенс',
  document_check: '2. Правовой аудит документов',
  packaging: '3. Упаковка и публикация',
  buyer_matching: '4. Подбор покупателя',
  closing_escrow: '5. Аккредитив и Эскроу',
  completed: '✓ Зарегистрировано в Росреестре',
};

const STAGE_NUM_MAP: Record<DealTrack['stage'], number> = {
  initial_audit: 1,
  document_check: 2,
  packaging: 3,
  buyer_matching: 4,
  closing_escrow: 5,
  completed: 5,
};

export interface SellerLotsTabProps {
  sellerLots: Lot[];
  selectedSellerLotCode: string;
  onSelectSellerLotCode: (lotCode: string) => void;
  activeSellerLot: Lot | null;
  activeSellerDeal: DealTrack | null;
  activeSellerRequest: SellerExitRequest | null;
  sellerVaultDocs: DocumentMetadata[];
  curator: Employee | null;
  isUploadingRequestedDoc: boolean;
  onUploadCuratorRequestedDoc: () => void;
  onCancelSellerRequest: (lotCode: string) => void;
  onOpenSellerVault: () => void;
  onOpenCuratorChat: (lotCode: string) => void;
}

export const SellerLotsTab: React.FC<SellerLotsTabProps> = ({
  sellerLots,
  selectedSellerLotCode,
  onSelectSellerLotCode,
  activeSellerLot,
  activeSellerDeal,
  activeSellerRequest,
  sellerVaultDocs,
  curator,
  isUploadingRequestedDoc,
  onUploadCuratorRequestedDoc,
  onCancelSellerRequest,
  onOpenSellerVault,
  onOpenCuratorChat,
}) => {
  const { language } = useLanguage();

  const activeStageNum = activeSellerDeal ? STAGE_NUM_MAP[activeSellerDeal.stage] || 1 : 2;

  if (sellerLots.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              У вас пока нет выставленных объектов ДДУ
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Если у вас есть строящаяся квартира по договору ДДУ и вы хотите безопасно уступить права через банковский аккредитив без штрафов застройщика — подайте заявку на экспресс-выход.
            </p>
          </div>
          <Link
            to="/sellers"
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Подать заявку на выход из ДДУ</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Switcher if Seller submitted multiple lots + New Exit CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {sellerLots.map((sl) => (
            <button
              key={sl.lotCode}
              type="button"
              onClick={() => onSelectSellerLotCode(sl.lotCode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeSellerLot?.lotCode === sl.lotCode
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              #{sl.lotCode} • {sl.complexName}
            </button>
          ))}
        </div>

        <Link
          to="/sellers"
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center space-x-1.5 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Подать еще один объект ДДУ</span>
        </Link>
      </div>

      {/* URGENT ALERT: Curator or Owner Requested Additional Documents */}
      {activeSellerLot?.additionalDocsRequested?.status === 'pending' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-50 border-2 border-amber-400 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                Требуется действие продавца • Проверка документов
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-950">
                Куратор запросил дополнительные документы по лоту #{activeSellerLot.lotCode}
              </h3>
              <p className="text-xs text-slate-700">
                <strong>Список:</strong>{' '}
                {activeSellerLot.additionalDocsRequested.requestedList.join(', ')}
              </p>
              {activeSellerLot.additionalDocsRequested.notes && (
                <p className="text-xs text-amber-900 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                  Комментарий юриста: {activeSellerLot.additionalDocsRequested.notes}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={isUploadingRequestedDoc}
              onClick={onUploadCuratorRequestedDoc}
              className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>
                {isUploadingRequestedDoc
                  ? 'Загрузка...'
                  : 'Загрузить запрошенный файл'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Rejection Notice if Rejected */}
      {activeSellerLot?.approvalStatus === 'rejected' && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1">
          <span className="font-black text-sm block">
            Заявка по лоту #{activeSellerLot.lotCode} отклонена комплаенсом
          </span>
          <p>
            Причина: {activeSellerLot.rejectionReason || activeSellerRequest?.rejectionReason || 'Несоответствие критериям отбора'}
          </p>
        </div>
      )}

      {/* Main Seller Exit Dossier Card */}
      {activeSellerLot && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded">
                  ЛОТ #{activeSellerLot.lotCode}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeSellerLot.approvalStatus === 'pending_owner_approval'
                      ? 'bg-amber-100 text-amber-900'
                      : activeSellerLot.approvalStatus === 'rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {activeSellerLot.approvalStatus === 'pending_owner_approval'
                    ? 'Ожидает одобрения Владельцем платформы'
                    : activeSellerLot.approvalStatus === 'rejected'
                    ? 'Отклонен'
                    : (activeSellerLot.assignedEmployeeId || (activeSellerLot as any).assignedCuratorId)
                    ? 'Одобрен и закреплен за куратором'
                    : activeSellerLot.isVerified
                    ? 'Проверен (ожидает назначения куратора)'
                    : 'Одобрен (ожидает назначения куратора)'}
                </span>
                {(activeSellerLot.approvalStatus === 'pending_owner_approval' || activeSellerLot.status === 'draft') && (
                  <button
                    type="button"
                    onClick={() => onCancelSellerRequest(activeSellerLot.lotCode)}
                    className="px-2.5 py-0.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold transition-colors cursor-pointer flex items-center space-x-1"
                    title="Отозвать заявку и удалить черновик"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Отозвать заявку / Удалить</span>
                  </button>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-1.5">
                {activeSellerLot.complexName} — {activeSellerLot.areaM2} м² ({activeSellerLot.district})
              </h2>
              <span className="text-xs text-slate-500">
                Застройщик: {activeSellerLot.developer} • Эскроу: ПАО {activeSellerLot.escrowBank}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <span className="text-xs text-slate-500 block font-medium">
                  Сумма к возврату на руки:
                </span>
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {formatRubles(activeSellerLot.cashPaidBySeller)}
                </span>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div className="text-right">
                <span className="text-xs text-slate-500 block font-medium">Комиссия продавца:</span>
                <span className="text-xl font-black text-slate-900">0 ₽</span>
              </div>
            </div>
          </div>

          {/* Live 5-Step Timeline */}
          <div className="space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-slate-700">
              <span>Текущая стадия сделки ({activeSellerDeal?.dealId || 'В обработке'}):</span>
              <div className="flex items-center space-x-3">
                <span className="text-emerald-700">
                  {activeSellerDeal
                    ? STAGE_LABEL_RU[activeSellerDeal.stage]
                    : `Этап ${activeStageNum} из 5`}
                </span>
                {activeSellerDeal && (
                  <Link
                    to={`/client/tracker/${activeSellerDeal.dealId}`}
                    className="inline-flex items-center space-x-1 text-indigo-700 hover:underline"
                  >
                    <span>Детальный трекер офферов</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                { num: 1, title: '1. Оценка ДДУ', sub: '100% возврат' },
                { num: 2, title: '2. Проверка', sub: '5 разделов 214-ФЗ' },
                { num: 3, title: '3. Упаковка', sub: 'Публикация' },
                { num: 4, title: '4. Подбор', sub: 'Матчмейкинг' },
                { num: 5, title: '5. Выплата', sub: 'Аккредитив банка' },
              ].map((st) => {
                const isDone = activeSellerDeal?.stage === 'completed' || st.num < activeStageNum;
                const isCurrent = activeSellerDeal?.stage !== 'completed' && st.num === activeStageNum;
                return (
                  <div
                    key={st.num}
                    className={`p-3 rounded-2xl text-xs border ${
                      isCurrent
                        ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-600 shadow-md'
                        : isDone
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-bold mb-1">
                      {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {isCurrent && <Clock className="w-4 h-4 text-slate-950" />}
                      <span>{st.title}</span>
                    </div>
                    <span className="text-[11px] opacity-85">{st.sub}</span>
                  </div>
                );
              })}
            </div>
            {activeSellerDeal?.escrowWorkflow && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 font-bold text-emerald-950">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {activeSellerDeal.escrowWorkflow.step === 'curator_review' &&
                      'Подготовка пакета документов куратором перед передачей в банк'}
                    {activeSellerDeal.escrowWorkflow.step === 'bank_escrow_deposit' &&
                      'Шаг 1: Документы переданы в банк • Ожидается подтверждение депонирования средств покупателя на СБР'}
                    {activeSellerDeal.escrowWorkflow.step === 'signing_photos' &&
                      'Шаг 2: Банк подтвердил депонирование средств покупателя на эскроу/СБР • Назначена сессия подписания'}
                    {activeSellerDeal.escrowWorkflow.step === 'bank_funds_release' &&
                      'Шаг 3: Штамп Росреестра загружен куратором • Передано в банк на раскрытие аккредитива и выплату вашего кэша'}
                    {activeSellerDeal.escrowWorkflow.step === 'deal_finalized' &&
                      `Шаг 4: Аккредитив СБР раскрыт! Транш ${formatRubles(
                        activeSellerDeal.sellerReturnRub
                      )} (100% кэш, 0% комиссии) перечислен вам. Сделка закрыта.`}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-emerald-700 shrink-0">
                  {activeSellerDeal.escrowWorkflow.bankName} •{' '}
                  {activeSellerDeal.escrowWorkflow.escrowAccountNumber}
                </span>
              </div>
            )}
          </div>

          {/* Assigned Curator Contact Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center space-x-3.5">
              {curator?.photoUrl ? (
                <img
                  src={curator.photoUrl}
                  alt={curator.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-sm">
                  {(activeSellerLot.curator?.name || curator?.name || 'КД')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <div>
                <span className="text-slate-500 block text-[11px]">
                  Ответственный сотрудник DomExit:
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {activeSellerLot.assignedEmployeeName ||
                    activeSellerLot.curator?.name ||
                    curator?.name ||
                    'Комплаенс-деск DomExit'}
                </span>
                <span className="text-emerald-700 font-semibold block text-[11px]">
                  {activeSellerLot.curator?.role || curator?.role || 'Ведущий юрист'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onOpenCuratorChat(activeSellerLot.lotCode)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-colors text-xs cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Чат с куратором</span>
              </button>
              {(activeSellerLot.curator?.phone || curator?.phone) && (
                <a
                  href={`tel:${(activeSellerLot.curator?.phone || curator?.phone || '').replace(/[^\d+]/g, '')}`}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-colors text-xs"
                  title={activeSellerLot.curator?.phone || curator?.phone}
                >
                  <Phone className="w-3.5 h-3.5 text-slate-600" />
                  <span>{language === 'ru' ? 'Звонок' : 'Call'}</span>
                </a>
              )}

              <a
                href={`https://t.me/${(
                  activeSellerLot.curator?.telegram ||
                  curator?.telegram ||
                  'domexit_ru'
                ).replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-colors shadow-xs text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </a>

              {(activeSellerLot.curator?.maxProfile || curator?.maxProfile || activeSellerLot.curator?.whatsapp || curator?.whatsapp) && (
                <a
                  href={
                    (activeSellerLot.curator?.maxProfile || curator?.maxProfile || activeSellerLot.curator?.whatsapp || curator?.whatsapp || '').startsWith('http')
                      ? activeSellerLot.curator?.maxProfile || curator?.maxProfile || activeSellerLot.curator?.whatsapp || curator?.whatsapp
                      : `https://max.im/${(activeSellerLot.curator?.maxProfile || curator?.maxProfile || '').replace(/[^\w]/g, '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-colors text-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>MAX</span>
                </a>
              )}
            </div>
          </div>

          {/* Live Document Vault */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <FolderLock className="w-4 h-4 text-emerald-600" />
                <span>
                  Документы по объекту ({sellerVaultDocs.length} загружено):
                </span>
              </h4>
              <button
                type="button"
                onClick={onOpenSellerVault}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Открыть хранилище документов</span>
              </button>
            </div>

            {sellerVaultDocs.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2 text-xs text-slate-500">
                <p>Документы по данному лоту еще не загружены в хранилище.</p>
                <button
                  type="button"
                  onClick={onOpenSellerVault}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                >
                  Загрузить обязательный пакет (ДДУ, Справка об оплате, СФР)
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sellerVaultDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 block truncate">
                        {doc.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {doc.categoryLabelRu || doc.category} • {(doc.sizeBytes / 1024).toFixed(0)} КБ
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {doc.status === 'approved'
                          ? 'Одобрен'
                          : doc.status === 'rejected'
                          ? 'Отклонен'
                          : 'В сейфе'}
                      </span>
                      <button
                        type="button"
                        onClick={() => StorageService.downloadDocument(doc)}
                        className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
