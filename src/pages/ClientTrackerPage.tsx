import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { StorageService } from '../dal/StorageService';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { BuyerCandidate, DealTrack, DocumentMetadata, Employee, Lot } from '../types';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  FolderLock,
  Plus,
  Send,
  Phone,
  MessageCircle,
  ArrowLeft,
  Check,
  FileText,
} from 'lucide-react';

const STAGE_INDEX_MAP: Record<DealTrack['stage'], number> = {
  initial_audit: 1,
  document_check: 2,
  packaging: 3,
  buyer_matching: 4,
  closing_escrow: 5,
  completed: 5,
};

export const ClientTrackerPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();

  const [deal, setDeal] = useState<DealTrack | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [offers, setOffers] = useState<BuyerCandidate[]>([]);
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [curator, setCurator] = useState<Employee | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadTracker = async () => {
    setLoading(true);
    const targetId = dealId || 'DEAL-2025-10566';
    const loadedDeal = await DealsRepository.getById(targetId);
    setDeal(loadedDeal);

    const lotCode = loadedDeal?.lotCode || 'U-10566';
    const [loadedLot, lotOffers, vaultDocs, emps] = await Promise.all([
      LotsRepository.getByCode(lotCode),
      CandidatesRepository.getByLotCode(lotCode),
      StorageService.getDocumentsByEntity('lot', lotCode),
      EmployeesRepository.getAll(),
    ]);

    setLot(loadedLot);
    setOffers(lotOffers);
    setDocs(vaultDocs);

    if (loadedLot?.assignedEmployeeId) {
      const assigned = emps.find((e) => e.id === loadedLot.assignedEmployeeId);
      setCurator(assigned || emps[0] || null);
    } else if (emps.length > 0) {
      setCurator(emps[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTracker();
    const unsub = DatabaseGateway.subscribe((col) => {
      if (!col || col === 'deals' || col === 'lots' || col === 'candidates') {
        loadTracker();
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const handleApproveOffer = async (candidate: BuyerCandidate) => {
    if (!deal) return;
    await CandidatesRepository.acceptCandidate(
      deal.lotCode,
      candidate.id,
      user?.name || deal.sellerName || 'Продавец ДДУ'
    );
    setToastMessage(
      `Кандидат ${candidate.code} (${candidate.name}) согласован для открытия аккредитива!`
    );
    await loadTracker();
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleDeclineOffer = async (candidate: BuyerCandidate) => {
    await CandidatesRepository.updateStatus(candidate.id, 'declined');
    setToastMessage(`Оффер ${candidate.code} отклонен.`);
    await loadTracker();
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeStageNum = deal ? STAGE_INDEX_MAP[deal.stage] || 4 : 4;
  const progressPercent = deal?.stage === 'completed' ? 100 : Math.min(95, activeStageNum * 20);
  const sellerPayout = deal?.sellerReturnRub || lot?.cashPaidBySeller || 2485230;
  const estimatedPenaltySaved = Math.round((lot?.dduContractPrice || sellerPayout * 3) * 0.15);
  const targetLotCode = deal?.lotCode || lot?.lotCode || 'U-10566';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6 w-full">
        
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/portal?tab=seller"
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'ru' ? 'Назад в Личный кабинет продавца' : 'Back to Seller Portal'}</span>
          </Link>

          <span className="font-mono text-xs font-bold text-slate-500">
            ID: {deal?.dealId || dealId || 'DEAL-2025-10566'}
          </span>
        </div>

        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button type="button" onClick={() => setToastMessage(null)}>
              ✕
            </button>
          </div>
        )}

        {/* 1. Welcome Card & Dedicated Curator */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Синхронизировано с реестром 214-ФЗ</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                <span>Эскроу ПАО {lot?.escrowBank || 'Сбербанк'}</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-950">
              Трекер чистого выхода: {lot?.complexName || deal?.lotTitle || 'ЖК «Чистое Небо»'} (Лот #{targetLotCode})
            </h1>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                Сумма возврата: {formatRubles(sellerPayout)}
              </span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                0 ₽ комиссия продавца (100% возврат)
              </span>
            </div>
          </div>

          {/* Dedicated Curator Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 w-full lg:w-auto">
            <div className="flex items-center space-x-3.5">
              {curator?.photoUrl ? (
                <img
                  src={curator.photoUrl}
                  alt={curator.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                  {(curator?.name || 'АМ').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {language === 'ru' ? 'Персональный куратор' : 'Dedicated Curator'}
                </span>
                <span className="text-xs font-bold text-slate-900 block">
                  {curator?.name || deal?.curatorName || 'Алексей Морозов'}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold block">
                  {curator?.role || 'Ведущий юрист по 214-ФЗ'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
              <a
                href={
                  (curator?.telegram || '').startsWith('http')
                    ? curator?.telegram
                    : `https://t.me/${(curator?.telegram || 'domexit_ru').replace('@', '')}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-all flex-1 sm:flex-initial"
              >
                <Send className="w-3 h-3 text-white" />
                <span>Telegram</span>
              </a>

              {curator?.phone && (
                <a
                  href={`tel:${curator.phone.replace(/[^\d+]/g, '')}`}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                  title={curator.phone}
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}

              {curator?.whatsapp && (
                <a
                  href={`https://wa.me/${curator.whatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 transition-colors"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 2. Live 5-Step Progress Card & Live Buyer Offers */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <h2 className="font-bold text-slate-900 uppercase tracking-wider text-sm">
                Статус сделки в реальном времени
              </h2>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                Прогресс: {progressPercent}% • Этап {activeStageNum} из 5
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                { num: 1, title: '1. Оценка ДДУ', sub: '100% возврат' },
                { num: 2, title: '2. Правовой аудит', sub: '42 параметра' },
                { num: 3, title: '3. Упаковка лота', sub: 'Публикация в реестре' },
                { num: 4, title: '4. Подбор покупателя', sub: `${offers.length} офферов` },
                { num: 5, title: '5. Аккредитив и ЕГРН', sub: 'Выплата кэша' },
              ].map((st) => {
                const isDone = deal?.stage === 'completed' || st.num < activeStageNum;
                const isCurrent = deal?.stage !== 'completed' && st.num === activeStageNum;
                return (
                  <div
                    key={st.num}
                    className={`rounded-2xl p-3.5 space-y-1 border ${
                      isCurrent
                        ? 'bg-emerald-50 border-2 border-emerald-500 shadow-sm'
                        : isDone
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold flex items-center space-x-1 ${
                        isCurrent
                          ? 'text-emerald-950 font-black'
                          : isDone
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      {isCurrent && <Clock className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{st.title}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 block">{st.sub}</span>
                  </div>
                );
              })}
            </div>

            {deal?.escrowWorkflow && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 font-bold text-emerald-950">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {deal.escrowWorkflow.step === 'curator_review' &&
                      'Шлюз СБР: Подготовка пакета документов куратором к передаче в уполномоченный банк'}
                    {deal.escrowWorkflow.step === 'bank_escrow_deposit' &&
                      'Шаг 1 синхронизирован: Документы переданы в банк • Открывается аккредитив СБР'}
                    {deal.escrowWorkflow.step === 'signing_photos' &&
                      'Шаг 2 синхронизирован: Банк подтвердил депонирование средств покупателя на СБР • Сессия подписания'}
                    {deal.escrowWorkflow.step === 'bank_funds_release' &&
                      'Шаг 3 синхронизирован: Штамп Росреестра загружен • Передано в банк на раскрытие СБР'}
                    {deal.escrowWorkflow.step === 'deal_finalized' &&
                      `Шаг 4 завершён: Аккредитив СБР раскрыт! Транш ${formatRubles(
                        sellerPayout
                      )} (100% кэш) выплачен продавцу. Сделка официально закрыта.`}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-emerald-700 shrink-0">
                  {deal.escrowWorkflow.bankName} • {deal.escrowWorkflow.escrowAccountNumber}
                </span>
              </div>
            )}
          </div>

          {/* Live Incoming Buyer Offers */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Поступившие предложения покупателей ({offers.length})
              </h3>
              <span className="text-xs text-slate-500">
                Живые заявки из реестра матчмейкинга
              </span>
            </div>

            {offers.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                Лот проходит этап подготовки / ожидания входящих заявок в ежедневном окне отбора.
              </div>
            ) : (
              <div className="space-y-3">
                {offers.map((cand) => {
                  const isReserved = cand.status === 'priority_reserved';
                  const isDeclined = cand.status === 'declined';
                  return (
                    <div
                      key={cand.id}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isReserved
                          ? 'border-2 border-emerald-500 bg-emerald-50/50'
                          : isDeclined
                          ? 'border-slate-200 bg-slate-50 opacity-60'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-sm text-slate-900">
                            Кандидат #{cand.code} ({cand.name})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              cand.buyerTrack === 'full_cash'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {cand.buyerTrack === 'full_cash' ? '100% КЭШ' : 'КЭШ + ИПОТЕКА'}
                          </span>
                          {isReserved && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                              ✓ ВЫБРАН ДЛЯ СДЕЛКИ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          Подтвержденная ликвидность: <strong>{formatRubles(cand.availableLiquidity)}</strong> •{' '}
                          {cand.readinessTimeline}
                        </p>
                      </div>

                      {!isReserved && !isDeclined && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApproveOffer(cand)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                          >
                            ✓ Согласовать кандидата
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineOffer(cand)}
                            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. Bottom 2 Parallel Sections: Live S3 Document Vault & Financial Benefit Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left: Live S3 Document Vault */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                  <FolderLock className="w-4 h-4 text-emerald-600" />
                  <span>Защищенный сейф документов (Yandex S3 • 152-ФЗ)</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  Загружено документов: {docs.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsVaultOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Управление сейфом</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {docs.length === 0 ? (
                <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                  В сейфе пока нет загруженных сканов. Нажмите «Управление сейфом» для загрузки ДДУ и справок.
                </div>
              ) : (
                docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 block truncate">
                          {doc.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {doc.categoryLabelRu || doc.category} • {(doc.sizeBytes / 1024).toFixed(0)} КБ
                        </span>
                      </div>
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
                        title="Скачать оригинал"
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Benefit Summary & Analytics */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 pb-3 border-b border-slate-100">
              Финансовая сводка чистого выхода
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5">
                <span className="text-[11px] text-emerald-800 font-bold block">СУММА К ВЫПЛАТЕ НА РУКИ:</span>
                <span className="text-xl font-black text-emerald-700 block">
                  {formatRubles(sellerPayout)}
                </span>
                <span className="text-[10px] text-emerald-800/80 block">100% возврат вложенных средств</span>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5">
                <span className="text-[11px] text-amber-800 font-bold block">ПРЕДОТВРАЩЕННЫЙ УБЫТОК:</span>
                <span className="text-xl font-black text-amber-700 block">
                  +{formatRubles(estimatedPenaltySaved)}
                </span>
                <span className="text-[10px] text-amber-800/80 block">Штраф девелопера при расторжении</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
              <span className="text-slate-600">Застройщик и банк эскроу:</span>
              <span className="font-bold text-slate-900">
                {lot?.developer || 'Setl Group'} • ПАО {lot?.escrowBank || 'Сбербанк'}
              </span>
            </div>

            <div className="space-y-1.5 pt-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-rose-600">
                  Штраф расторжения: -{formatRubles(estimatedPenaltySaved)}
                </span>
                <span className="text-emerald-700">
                  Чистый выход DomExit: {formatRubles(sellerPayout)}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-rose-500 h-full w-[35%]" />
                <div className="bg-emerald-500 h-full w-[65%]" />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Interactive Document Vault Modal */}
      <DocumentVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        entityType="lot"
        entityId={targetLotCode}
        entityTitle={`${lot?.complexName || deal?.lotTitle || 'Объект ДДУ'} (#${targetLotCode})`}
        uploadedByUid={user?.id || deal?.sellerUserId || 'usr-seller-001'}
        clientCode={user?.clientCode || deal?.sellerClientCode || 'DEX-784105'}
        mode="seller"
        canUpload={true}
        canReview={false}
        onDocumentsChanged={(updated) => setDocs(updated)}
      />
    </div>
  );
};
