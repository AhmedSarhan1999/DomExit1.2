import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Lot } from '../../types';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  X, 
  ArrowRight, 
  UploadCloud, 
  FileCheck, 
  CreditCard, 
  Banknote, 
  AlertCircle 
} from 'lucide-react';
import { formatRubles } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { CandidatesRepository } from '../../dal/repositories/CandidatesRepository';
import { FileManager } from '../../utils/fileManager';

interface BookingModalProps {
  lot: Lot;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  lot,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { language } = useLanguage();
  const { user, login } = useAuth();

  const [fullName, setFullName] = useState(user?.name || '');
  const [contact, setContact] = useState(user?.phone || '+7 ');
  const [questions, setQuestions] = useState('');
  
  // Track 1: full_cash vs Track 2: mortgage_substitution
  const [purchaseTrack, setPurchaseTrack] = useState<'full_cash' | 'mortgage_substitution'>('full_cash');
  const [creditLimitRub, setCreditLimitRub] = useState<number>(lot.remainingInstallmentDebt || 8500000);
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; url: string; size: number } | null>(null);
  
  const [readiness, setReadiness] = useState<'48h' | '1-2weeks' | 'studying'>('48h');
  const [agreementChecked, setAgreementChecked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real browser file upload for Bank Pre-Approval Certificate
  const handleUploadBankDoc = async () => {
    try {
      const file = await FileManager.selectAndReadFile('mortgage_approval', '.pdf,.png,.jpg,.jpeg,.doc,.docx');
      if (file) {
        setUploadedDoc({
          name: file.name,
          url: file.dataUrl || '',
          size: file.size || file.sizeBytes,
        });
        setErrorMsg(null);
      }
    } catch (err) {
      console.warn('File upload aborted:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!agreementChecked) {
      setErrorMsg(language === 'ru' ? 'Пожалуйста, подтвердите согласие с регламентом 214-ФЗ' : 'Please accept 214-FZ terms');
      return;
    }

    if (purchaseTrack === 'full_cash' && !uploadedDoc) {
      setErrorMsg(
        language === 'ru'
          ? 'Для трека «100% Кэш» обязательно прикрепите свежую выписку со счета о наличии средств для подтверждения ликвидности.'
          : 'Please upload a recent bank statement confirming liquidity for the 100% Cash track.'
      );
      return;
    }

    if (purchaseTrack === 'mortgage_substitution' && !uploadedDoc) {
      setErrorMsg(
        language === 'ru'
          ? 'Для ипотечного трека обязательно прикрепите скан или фото справки/сертификата об одобрении кредита банком.'
          : 'Please upload the bank mortgage pre-approval certificate for Track 2.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Ensure user is logged in
      let currentUserId = user?.id;
      if (!user) {
        const loggedUser = await login({
          name: fullName || 'Покупатель ' + lot.lotCode,
          phone: contact || '+7 (921) 987-65-43',
          role: 'buyer',
        });
        currentUserId = loggedUser.id;
      }

      // 2. Submit candidate bid to CandidatesRepository & Firestore
      await CandidatesRepository.submitBid({
        lotCode: lot.lotCode,
        userId: currentUserId,
        name: fullName || user?.name || 'Покупатель ' + lot.lotCode,
        location: lot.city === 'spb' ? 'Санкт-Петербург' : 'Москва',
        buyerTrack: purchaseTrack,
        fundingType: purchaseTrack === 'full_cash' ? 'cash' : 'family-mortgage',
        availableLiquidity: purchaseTrack === 'full_cash' 
          ? lot.dduContractPrice 
          : lot.cashPaidBySeller,
        creditLimitRub: purchaseTrack === 'mortgage_substitution' ? creditLimitRub : undefined,
        bankApprovalDocUrl: uploadedDoc?.url,
        bankApprovalDocName: uploadedDoc?.name,
        readinessTimeline: readiness === '48h' ? 'Наличные на руках — 48ч' : '1–2 недели',
        status: 'pending',
      });

      setIsSubmitting(false);
      onSuccess();
    } catch (err: any) {
      console.error('Bid submission error:', err);
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Ошибка подачи заявки');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative my-8 max-h-[92vh] overflow-y-auto">
        
        {/* Header & Badges */}
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{language === 'ru' ? 'Ежедневное окно подачи заявок 214-ФЗ' : 'Daily 214-FZ Application Window'}</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              {language === 'ru'
                ? 'Подача предложения о покупке лота'
                : 'Submit Purchase Offer'}
            </h2>
            <p className="text-xs text-slate-500">
              {lot.complexName} (#{lot.lotCode}) • {lot.areaM2} м² • Выплата продавцу: {formatRubles(lot.cashPaidBySeller)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daily Selection Notice */}
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 space-y-1">
          <div className="font-bold flex items-center space-x-1.5">
            <span>📅 Окно приема заявок на сегодня открыто</span>
          </div>
          <p className="text-[11px] text-sky-800/90 leading-relaxed">
            Все заявки на этот объект направляются напрямую ответственному куратору. Завтра в 10:00 куратор проведет отбор и утвердит покупателя с лучшей подтвержденной платежеспособностью.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* MISSION 5: The Two Purchase Tracks Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              {language === 'ru' ? 'Выберите مسار (трек) покупки объекта:' : 'Select Purchase Track:'} *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Track 1: 100% Cash */}
              <div
                onClick={() => setPurchaseTrack('full_cash')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                  purchaseTrack === 'full_cash'
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-slate-900">
                      Трек 1: 100% Кэш
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
                    Быстрый выход
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Оплата полной стоимости по ДДУ ({formatRubles(lot.dduContractPrice)}) через банковский аккредитив Сбербанка/ВТБ.
                </p>
              </div>

              {/* Track 2: Seller Cash + Mortgage Substitution */}
              <div
                onClick={() => setPurchaseTrack('mortgage_substitution')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                  purchaseTrack === 'mortgage_substitution'
                    ? 'border-amber-500 bg-amber-50/70 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-xs text-slate-900">
                      Трек 2: Кэш + Ипотека
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
                    Замещение долга
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Кэш продавцу ({formatRubles(lot.cashPaidBySeller)}) + замещение остатка застройщика ({formatRubles(lot.remainingInstallmentDebt)}) ипотекой.
                </p>
              </div>

            </div>
          </div>

          {/* Conditional Field for Track 1: 100% Cash (Mandatory Bank Statement) */}
          {purchaseTrack === 'full_cash' && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3 animate-fade-in">
              <div className="text-xs font-bold text-emerald-950 flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>Обязательное подтверждение доступной ликвидности (100% Кэш)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Загрузите свежую банковскую выписку со счета или депозита о наличии денежных средств на сумму не менее {formatRubles(lot.dduContractPrice)}.
              </p>
              <div>
                <button
                  type="button"
                  onClick={handleUploadBankDoc}
                  className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-emerald-400 hover:border-emerald-500 bg-white hover:bg-emerald-50/50 text-slate-800 text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-2xs"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  <span className="truncate">
                    {uploadedDoc ? `Прикреплено: ${uploadedDoc.name}` : 'Загрузить свежую выписку со счета (PDF/JPG)'}
                  </span>
                </button>
                {uploadedDoc && (
                  <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                    ✓ Выписка успешно загружена ({(uploadedDoc.size / 1024).toFixed(1)} КБ)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Conditional Fields for Track 2 (Mandatory Bank Pre-Approval Certificate + Credit Limit) */}
          {purchaseTrack === 'mortgage_substitution' && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-4 animate-fade-in">
              <div className="text-xs font-bold text-amber-900 flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-amber-700" />
                <span>Обязательное подтверждение кредитоспособности (214-ФЗ)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Одобренный лимит ипотеки (₽) *
                  </label>
                  <input
                    type="number"
                    required
                    min={lot.remainingInstallmentDebt}
                    value={creditLimitRub}
                    onChange={(e) => setCreditLimitRub(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-amber-500 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Минимум для погашения долга застройщику: {formatRubles(lot.remainingInstallmentDebt)}
                  </span>
                </div>

                {/* Real File Upload Button */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Справка об одобрении банка (PDF/JPG) *
                  </label>
                  <button
                    type="button"
                    onClick={handleUploadBankDoc}
                    className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-amber-400 hover:border-amber-500 bg-white hover:bg-amber-50/50 text-slate-800 text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-2xs"
                  >
                    <UploadCloud className="w-4 h-4 text-amber-600" />
                    <span className="truncate">
                      {uploadedDoc ? `Прикреплено: ${uploadedDoc.name}` : 'Загрузить справку из банка'}
                    </span>
                  </button>
                  {uploadedDoc && (
                    <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                      ✓ Документ успешно загружен ({(uploadedDoc.size / 1024).toFixed(1)} КБ)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Inputs: Full Name & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ru' ? 'Ваше полное имя *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={language === 'ru' ? 'Иван Сергеевич П.' : 'John Doe'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ru' ? 'Номер телефона / Telegram *' : 'Phone / Telegram *'}
              </label>
              <input
                type="text"
                required
                placeholder="+7 (___) ___-__-__"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* Textarea Questions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === 'ru'
                ? 'Дополнительные комментарии или готовность выйти на сделку:'
                : 'Additional comments or timeline:'}
            </label>
            <textarea
              rows={2}
              placeholder={language === 'ru' ? 'Например: готов внести депозит на аккредитив завтра, согласовано с банком' : 'e.g. ready to deposit into escrow tomorrow'}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Mandatory Green Acknowledgment */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={agreementChecked}
                onChange={(e) => setAgreementChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600 shrink-0"
              />
              <span className="leading-snug">
                {language === 'ru'
                  ? 'Согласен с комиссией сервиса 2.5%, выплачиваемой строго ПОСЛЕ государственной регистрации права в Росреестре (0 ₽ предоплаты). Подтверждаю юридическую проверку и подачу в ежедневное окно отбора.'
                  : 'I agree to the 2.5% service commission paid strictly AFTER state registration in Rosreestr (0 ₽ upfront).'}
              </span>
            </label>
          </div>

          {/* Action Button: Emerald CTA */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
          >
            <span>
              {isSubmitting
                ? (language === 'ru' ? 'Регистрация предложения...' : 'Submitting Offer...')
                : (language === 'ru' ? 'Отправить заявку куратору лота ->' : 'Submit Offer to Assigned Curator ->')}
            </span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>

        </form>

      </div>
    </div>
  );
};

