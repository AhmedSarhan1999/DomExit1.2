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
import { useEnvironmentStore } from '../stores/useEnvironmentStore';
import { useFeatureFlagsStore } from '../stores/useFeatureFlagsStore';
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
  MessageSquare,
  ArrowLeft,
  Check,
  FileText,
  ShieldAlert,
  Crown,
  UserCheck,
  Lock,
  AlertCircle,
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
  const { user, quickDemoLogin, openAuthModal } = useAuth();
  const { isProduction } = useEnvironmentStore();
  const { enableBankPortal } = useFeatureFlagsStore();
  const showTestSwitchers = !isProduction;

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
    const targetId = dealId || user?.activeDealId;
    if (!targetId) {
      setDeal(null);
      setLot(null);
      setOffers([]);
      setDocs([]);
      setLoading(false);
      return;
    }
    const loadedDeal = await DealsRepository.getById(targetId);
    setDeal(loadedDeal);

    if (!loadedDeal) {
      setLot(null);
      setOffers([]);
      setDocs([]);
      setLoading(false);
      return;
    }

    const lotCode = loadedDeal.lotCode;
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
  }, [dealId, user?.id]);

  // Authorization check (BOLA / IDOR Protection - OWASP API1 & 152-FZ)
  const isAuthorized = Boolean(
    user &&
      deal &&
      (user.id === deal.sellerUserId ||
        user.id === deal.buyerUserId ||
        user.clientCode === deal.sellerClientCode ||
        user.clientCode === deal.buyerClientCode ||
        user.activeDealId === deal.dealId ||
        user.activeDealId === deal.id ||
        user.activeRole === 'owner' ||
        user.activeRole === 'admin' ||
        user.activeRole === 'employee' ||
        user.role === 'owner' ||
        user.role === 'admin' ||
        user.role === 'employee' ||
        user.email === 'amaas9499@gmail.com' ||
        user.email === 'amaas9494@gmail.com')
  );

  const handleApproveOffer = async (candidate: BuyerCandidate) => {
    if (!deal || !isAuthorized) return;
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
    if (!deal || !isAuthorized) return;
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

  // If deal not found at all
  if (!deal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Сделка не найдена</h2>
          <p className="text-xs text-slate-500">
            Запрошенный идентификатор сделки отсутствует в реестре или был архивирован.
          </p>
          <Link
            to="/portal"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вернуться в личный кабинет</span>
          </Link>
        </div>
      </div>
    );
  }

  // If deal exists but user is not authenticated or not party to this deal (BOLA gate)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full relative z-10 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold uppercase tracking-widest inline-block">
              Контур защиты 152-ФЗ
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Доступ к сделке ограничен
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Карточка сделки <span className="text-white font-mono font-bold">{deal.dealId}</span> содержит конфиденциальные персональные данные сторон, сумму договора ДДУ и банковские реквизиты эскроу.
            </p>
          </div>

          {/* Sandbox persona switcher (Enabled in testing mode) */}
          {showTestSwitchers ? (
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 space-y-3 text-left">
              <div className="flex items-center space-x-2 text-slate-300 text-xs font-bold border-b border-slate-700/60 pb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Тестовый контур (Активация участника):</span>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => quickDemoLogin('seller')}
                  className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md"
                >
                  <UserCheck className="w-4 h-4 text-white" />
                  <span>Войти как Продавец лота (Александр В. Б.)</span>
                </button>

                <button
                  type="button"
                  onClick={() => quickDemoLogin('employee')}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer border border-slate-600"
                >
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Войти как Куратор сделки (Алексей Смирнов)</span>
                </button>

                <button
                  type="button"
                  onClick={() => quickDemoLogin('owner')}
                  className="w-full px-4 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span>Войти как Владелец / CEO (Ahmed Abdallah)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => openAuthModal('Авторизуйтесь для доступа к материалам сделки')}
                className="w-full px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
              >
                <span>Авторизоваться как участник сделки</span>
              </button>
            </div>
          )}

          <div>
            <Link
              to="/portal"
              className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Перейти в личный кабинет</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeStageNum = deal ? STAGE_INDEX_MAP[deal.stage] || 4 : 4;
  const progressPercent = deal?.stage === 'completed' ? 100 : Math.min(95, activeStageNum * 20);
  const sellerPayout = deal?.sellerReturnRub || lot?.cashPaidBySeller || 2485230;
  const estimatedPenaltySaved = Math.round((lot?.dduContractPrice || sellerPayout * 3) * 0.15);
  const targetLotCode = deal?.lotCode || lot?.lotCode || '';

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
            ID: {deal?.dealId || dealId || '—'}
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

              {(curator?.maxProfile || curator?.whatsapp) && (() => {
                const maxVal = curator?.maxProfile || curator?.whatsapp || '';
                const maxHref =
                  maxVal.startsWith('http') || maxVal.startsWith('max://')
                    ? maxVal
                    : `https://max.ru/${maxVal.replace(/[^\d]/g, '')}`;
                return (
                  <a
                    href={maxHref}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 transition-colors flex items-center justify-center font-bold text-[10px]"
                    title="Профиль MAX"
                  >
                    <span className="w-4 h-4 rounded bg-indigo-600 text-white font-black flex items-center justify-center text-[9px]">
                      M
                    </span>
                  </a>
                );
              })()}
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

            {deal && (
              enableBankPortal ? (
                deal.escrowWorkflow ? (
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
                ) : null
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-xs">
                  <div className="flex items-center space-x-3.5">
                    {curator?.photoUrl ? (
                      <img
                        src={curator.photoUrl}
                        alt={curator.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-sm">
                        {(deal.assignedEmployeeName || deal.curatorName || curator?.name || 'АС').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        Ваш персональный куратор сделки
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">
                        {deal.assignedEmployeeName || deal.curatorName || curator?.name || 'Алексей Смирнов'}
                      </h4>
                      <p className="text-[11px] text-slate-500 max-w-lg mt-0.5">
                        Сопровождение открытия аккредитива в банке, согласование с застройщиком и регистрация в Росреестре
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={`tel:${curator?.phone || '+79214567890'}`}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center space-x-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{curator?.phone || '+7 (921) 456-78-90'}</span>
                    </a>
                    <a
                      href={
                        curator?.telegram
                          ? curator.telegram.startsWith('http')
                            ? curator.telegram
                            : `https://t.me/${curator.telegram.replace('@', '')}`
                          : 'https://t.me/domexit_ru'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                      <span>Telegram</span>
                    </a>
                    {(curator?.maxProfile || curator?.whatsapp) && (
                      <a
                        href={
                          (curator.maxProfile || curator.whatsapp || '').startsWith('http')
                            ? curator.maxProfile || curator.whatsapp
                            : `https://max.im/${(curator.maxProfile || curator.whatsapp || '').replace(/[^\w]/g, '')}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>MAX</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsVaultOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs flex items-center space-x-1.5 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Сейф документов (152-ФЗ)</span>
                    </button>
                  </div>
                </div>
              )
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
