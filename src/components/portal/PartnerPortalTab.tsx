import React, { useState } from 'react';
import {
  Share2,
  Check,
  Copy,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import {
  UserProfile,
  PartnerEntry,
  PartnerPreliminaryRequest,
  DealTrack,
} from '../../types';
import { formatRubles } from '../../utils/formatters';
import {
  formatRussianPhoneInput,
  isValidRussianPhone,
  validateSellerFinancials,
} from '../../utils/validators';
import { PartnerRequestsRepository } from '../../dal/repositories/PartnerRequestsRepository';
import { useLanguage } from '../../i18n/LanguageContext';

const STAGE_LABEL_RU: Record<DealTrack['stage'], string> = {
  initial_audit: '1. Первичный комплаенс',
  document_check: '2. Правовой аудит документов',
  packaging: '3. Упаковка и публикация',
  buyer_matching: '4. Подбор покупателя',
  closing_escrow: '5. Аккредитив и Эскроу',
  completed: '✓ Зарегистрировано в Росреестре',
};

export interface PartnerPortalTabProps {
  user: UserProfile | null;
  partnerAppRecord: PartnerEntry | null;
  partnerRequests: PartnerPreliminaryRequest[];
  partnerDeals: DealTrack[];
  onUpgradeToPartner: () => void;
  onRequestCreated: (newReq: PartnerPreliminaryRequest) => void;
  onShowNotice: (msg: string) => void;
  formatRemainingTime: (expiresAt: string) => { text: string; isExpired: boolean };
}

export const PartnerPortalTab: React.FC<PartnerPortalTabProps> = ({
  user,
  partnerAppRecord,
  partnerRequests,
  partnerDeals,
  onUpgradeToPartner,
  onRequestCreated,
  onShowNotice,
  formatRemainingTime,
}) => {
  const { language } = useLanguage();
  const [copiedPartnerLink, setCopiedPartnerLink] = useState<boolean>(false);

  // Form State
  const [refClientCode, setRefClientCode] = useState<string>('');
  const [refClientName, setRefClientName] = useState<string>('');
  const [refClientPhone, setRefClientPhone] = useState<string>('+7 (');
  const [refComplexName, setRefComplexName] = useState<string>('');
  const [refDeveloper, setRefDeveloper] = useState<string>('Сетл Групп');
  const [refPaidAmount, setRefPaidAmount] = useState<number>(2800000);
  const [refDduPrice, setRefDduPrice] = useState<number>(10500000);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  const activeRefCode =
    user?.partnerRefCode ||
    partnerAppRecord?.referralCode ||
    user?.referralCode ||
    'PART-0000';

  const referralUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/sellers?ref=${activeRefCode}`
      : `https://domexit.ru/sellers?ref=${activeRefCode}`;

  const handlePartnerReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerError(null);

    const cleanCode = refClientCode.trim().toUpperCase();
    if (!cleanCode.startsWith('DEX-')) {
      setPartnerError(
        language === 'ru'
          ? 'Введите уникальный ID клиента в формате DEX-XXXXXX (например, DEX-784105).'
          : 'Enter a valid client ID formatted as DEX-XXXXXX.'
      );
      return;
    }

    if (!isValidRussianPhone(refClientPhone)) {
      setPartnerError('Введите телефон клиента в стандарте РФ +7 (XXX) XXX-XX-XX.');
      return;
    }

    const finCheck = validateSellerFinancials(refPaidAmount, refDduPrice);
    if (!finCheck.valid) {
      setPartnerError(finCheck.paidErrorRu || finCheck.contractErrorRu || 'Проверьте финансовые параметры объекта.');
      return;
    }

    const verifiedUser = await PartnerRequestsRepository.verifyClientCode(cleanCode);
    if (!verifiedUser) {
      setPartnerError(
        language === 'ru'
          ? `Клиент с кодом «${cleanCode}» не найден в реестре. Дольщик должен сначала зарегистрироваться на DomExit и сообщить свой DEX-ID.`
          : `Client with ID "${cleanCode}" not found.`
      );
      return;
    }

    const newReq = await PartnerRequestsRepository.createPreliminaryRequest({
      partnerId: user?.id || 'partner-current',
      partnerName: user?.name || 'Партнер DomExit',
      partnerRefCode: activeRefCode,
      clientCode: cleanCode,
      clientName: refClientName.trim() || verifiedUser.name || 'Дольщик',
      clientPhone: refClientPhone,
      complexName: refComplexName.trim(),
      developer: refDeveloper.trim() || 'Застройщик',
      paidAmountRub: refPaidAmount,
      contractPriceRub: refDduPrice,
      notes: '',
    });

    onRequestCreated(newReq);
    setRefClientCode('');
    setRefClientName('');
    setRefClientPhone('+7 (');
    setRefComplexName('');

    onShowNotice(
      `Предварительный запрос для клиента [${newReq.clientCode}] отправлен! В кабинете клиента запущен 7-дневный таймер загрузки ДДУ.`
    );
  };

  const isApprovedPartner = Boolean(
    user?.isPartnerApproved ||
    user?.roles?.includes('partner') ||
    user?.role === 'partner' ||
    user?.activeRole === 'partner' ||
    partnerAppRecord?.status === 'approved'
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        {/* Partner Status Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isApprovedPartner
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : partnerAppRecord?.status === 'pending'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}>
                {isApprovedPartner
                  ? '✓ Аккредитованный партнер DomExit'
                  : partnerAppRecord?.status === 'pending'
                  ? '⏳ Заявка партнера на модерации у Владельца'
                  : partnerAppRecord?.status === 'docs_requested'
                  ? 'Запрошены реквизиты партнера'
                  : 'Партнерский кабинет B2B'}
              </span>
              <span className="text-xs font-mono font-bold text-slate-700">
                Реф-код:{' '}
                <strong className="text-emerald-800">
                  {activeRefCode}
                </strong>
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-950 tracking-tight mt-1">
              Партнерский деск: передача клиентов и учет вознаграждений
            </h2>
            {partnerAppRecord?.requestedDocsNotes && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl mt-1.5">
                Запрос от Владельца платформы: {partnerAppRecord.requestedDocsNotes}
              </p>
            )}
          </div>

          {!isApprovedPartner && !partnerAppRecord && (
            <button
              type="button"
              onClick={onUpgradeToPartner}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              Подать заявку на партнерский статус
            </button>
          )}
        </div>

        {/* SMART PARTNER REFERRAL LINK CARD (Unified Light Emerald) */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-400/60 rounded-3xl p-6 sm:p-7 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Ваша реферальная ссылка для продавцов недвижимости
                </h3>
                <p className="text-xs text-slate-600">
                  Автоматическая фиксация партнерского кода и 30-дневное окно атрибуции
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black self-start sm:self-auto shadow-xs">
              30 000 ₽ / сделка
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={referralUrl}
              className="flex-1 bg-white border border-emerald-300 text-emerald-950 font-mono text-xs px-4 py-3 rounded-xl font-bold select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(referralUrl);
                setCopiedPartnerLink(true);
                setTimeout(() => setCopiedPartnerLink(false), 2500);
              }}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              {copiedPartnerLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedPartnerLink ? 'Скопировано!' : 'Копировать ссылку'}</span>
            </button>
          </div>

          <p className="text-[11px] text-emerald-900 leading-relaxed">
            * Отправляйте эту ссылку клиентам, желающим выйти из ДДУ или срочно продать вторичное жилье. При переходе по ссылке ваш партнерский код будет зафиксирован автоматически, гарантируя выплату 30 000 ₽ при закрытии сделки.
          </p>
        </div>

        {/* Preliminary Client Reservation Form (7-Day Hold) */}
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-black text-sm">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>
              Фиксация клиента на 7 дней по персональному ID (DEX-XXXXXX)
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Клиент регистрируется на DomExit и сообщает вам свой код (например, <code>DEX-784105</code>). У клиента открывается 7-дневный регламент подачи заявки с автоматической привязкой к вашей партнерской комиссии.
          </p>

          {partnerError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{partnerError}</span>
            </div>
          )}

          <form
            onSubmit={handlePartnerReferralSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
          >
            <div>
              <label className="block text-slate-700 font-bold mb-1">ID клиента (DEX) *</label>
              <input
                type="text"
                required
                placeholder="DEX-784105"
                value={refClientCode}
                onChange={(e) => setRefClientCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">ФИО клиента *</label>
              <input
                type="text"
                required
                placeholder="Белов Александр Владимирович"
                value={refClientName}
                onChange={(e) => setRefClientName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Телефон РФ (+7) *</label>
              <input
                type="tel"
                required
                placeholder="+7 (911) 234-56-78"
                value={refClientPhone}
                onChange={(e) => setRefClientPhone(formatRussianPhoneInput(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">ЖК / Объект *</label>
              <input
                type="text"
                required
                placeholder="ЖК «Чистое Небо»"
                value={refComplexName}
                onChange={(e) => setRefComplexName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Застройщик / Фонд *</label>
              <input
                type="text"
                required
                placeholder="Сетл Групп / Вторичка"
                value={refDeveloper}
                onChange={(e) => setRefDeveloper(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Внесенная сумма (₽) *
              </label>
              <input
                type="number"
                required
                min={1000000}
                max={500000000}
                value={refPaidAmount}
                onChange={(e) => setRefPaidAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Полная цена договора (₽) *
              </label>
              <input
                type="number"
                required
                min={1000000}
                max={500000000}
                value={refDduPrice}
                onChange={(e) => setRefDduPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Зафиксировать (7 дней)</span>
              </button>
            </div>
          </form>
        </div>

        {/* 7-Day Referral Requests Table */}
        <div className="space-y-3 pt-2">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Ваши предварительные фиксации ({partnerRequests.length}):</span>
          </h3>

          {partnerRequests.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              У вас пока нет активных 7-дневных броней. Заполните форму выше, используя DEX-ID клиента.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Код</th>
                    <th className="py-3 px-3">ID клиента</th>
                    <th className="py-3 px-3">Клиент</th>
                    <th className="py-3 px-3">Объект / ЖК</th>
                    <th className="py-3 px-3">Внесено</th>
                    <th className="py-3 px-3 text-right">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerRequests.map((req) => {
                    const countdown = formatRemainingTime(req.expiresAt);
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{req.id}</td>
                        <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                          {req.clientCode}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          <div>{req.clientName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {req.clientPhone}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium">{req.complexName}</div>
                          <div className="text-[10px] text-slate-500">{req.developer}</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                          {formatRubles(req.paidAmountRub)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {req.status === 'completed' || req.status === 'converted_to_lot' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Сконвертирован в лот ({req.activatedLotCode || 'В работе'})</span>
                            </span>
                          ) : req.status === 'expired' || countdown.isExpired ? (
                            <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px]">
                              Истек срок 7 дней
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-[10px] inline-flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>{countdown.text}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Partner Deal Commission Table */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Сделки по вашему реф-коду и агентское вознаграждение ({partnerDeals.length}):</span>
          </h3>

          {partnerDeals.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              Когда клиент перейдет по вашей ссылке или подтвердит запрос и подаст заявку, сделка появится здесь со статусом вознаграждения.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">ID сделки</th>
                    <th className="py-3 px-3">Клиент</th>
                    <th className="py-3 px-3">Объект / Лот</th>
                    <th className="py-3 px-3">Текущий этап</th>
                    <th className="py-3 px-3">Вознаграждение</th>
                    <th className="py-3 px-3 text-right">Статус выплаты</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerDeals.map((d) => {
                    const isPaid = d.partnerPayoutStatus === 'paid';
                    const isPayable = d.stage === 'completed' || d.partnerPayoutStatus === 'payable';

                    return (
                      <tr key={d.dealId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {d.dealId}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {d.clientName || d.sellerName}
                        </td>
                        <td className="py-3 px-3">
                          {d.complexName || d.lotTitle} (#{d.lotCode})
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[10px]">
                            {STAGE_LABEL_RU[d.stage] || d.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                          {formatRubles(d.partnerRewardRub || 30000)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isPaid ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              Выплачено
                            </span>
                          ) : isPayable ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px] shadow-xs">
                              К выплате 30 000 ₽
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              В работе
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
