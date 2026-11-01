import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DocumentMetadata, Lot } from '../../types';
import {
  ShieldCheck,
  X,
  ArrowRight,
  UploadCloud,
  FileCheck,
  CreditCard,
  Banknote,
  AlertCircle,
} from 'lucide-react';
import { formatRubles } from '../../utils/formatters';
import {
  formatRussianPhoneInput,
  isValidRussianPhone,
  validateTextEntityName,
} from '../../utils/validators';
import { getRegionByCode } from '../../data/russianGeography';
import { useAuth } from '../../context/AuthContext';
import { CandidatesRepository } from '../../dal/repositories/CandidatesRepository';
import { StorageService } from '../../dal/StorageService';
import { FileManager } from '../../utils/fileManager';
import { ConsentCheckboxes, ConsentState } from '../compliance/ConsentCheckboxes';
import { UserConsentsRepository } from '../../dal/repositories/UserConsentsRepository';

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
  const [contact, setContact] = useState(user?.phone ? formatRussianPhoneInput(user.phone) : '+7 (');
  const [questions, setQuestions] = useState('');

  // Track 1: full_cash vs Track 2: mortgage_substitution
  const [purchaseTrack, setPurchaseTrack] = useState<'full_cash' | 'mortgage_substitution'>('full_cash');
  const [creditLimitRub, setCreditLimitRub] = useState<number>(
    Math.max(lot.remainingInstallmentDebt || 6500000, 3000000)
  );
  const [uploadedDocMeta, setUploadedDocMeta] = useState<DocumentMetadata | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);

  const [readiness, setReadiness] = useState<'48h' | '1-2weeks'>('48h');
  const [buyerConsents, setBuyerConsents] = useState<ConsentState>({
    pdProcessing: false,
    termsAgreed: false,
    ads: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (!fullName) setFullName(user.name);
      if (user.phone && contact.length <= 5) setContact(formatRussianPhoneInput(user.phone));
    }
  }, [user]);

  useEffect(() => {
    setCreditLimitRub(Math.max(lot.remainingInstallmentDebt || 6500000, 2000000));
  }, [lot.lotCode]);

  if (!isOpen) return null;

  // Real browser file upload stored directly in Yandex S3 Emulator (StorageService)
  const handleUploadBankDoc = async () => {
    try {
      setIsUploadingDoc(true);
      const selected = await FileManager.selectAndReadFile(
        purchaseTrack === 'full_cash' ? 'other' : 'mortgage_approval',
        '.pdf,.png,.jpg,.jpeg,.doc,.docx'
      );
      if (selected && selected.file) {
        const meta = await StorageService.uploadDocument({
          file: selected.file,
          category: purchaseTrack === 'full_cash' ? 'buyer_cash_statement' : 'mortgage_approval',
          categoryLabelRu:
            purchaseTrack === 'full_cash'
              ? `Выписка о ликвидности покупателя (#${lot.lotCode})`
              : `Банковское одобрение ипотеки (#${lot.lotCode})`,
          entityType: 'buyer_application',
          entityId: lot.lotCode,
          uploadedByUid: user?.id || 'guest-buyer',
          clientCode: user?.clientCode || 'DEX-BUYER',
        });
        setUploadedDocMeta(meta);
        setErrorMsg(null);
      }
    } catch (err) {
      console.warn('File upload aborted:', err);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const nameCheck = validateTextEntityName(fullName, 'ФИО покупателя');
    if (!nameCheck.valid) {
      setErrorMsg(nameCheck.messageRu || 'Укажите корректное ФИО покупателя.');
      return;
    }

    if (!isValidRussianPhone(contact)) {
      setErrorMsg(
        language === 'ru'
          ? 'Введите корректный российский номер телефона в формате +7 (XXX) XXX-XX-XX.'
          : 'Enter a valid Russian phone number formatted as +7 (XXX) XXX-XX-XX.'
      );
      return;
    }

    if (!buyerConsents.pdProcessing || !buyerConsents.termsAgreed) {
      setErrorMsg(
        language === 'ru'
          ? 'Пожалуйста, подтвердите согласие на обработку персональных данных (152-ФЗ) и согласие с условиями сервиса.'
          : 'Please accept personal data processing (152-FZ) and terms of service.'
      );
      return;
    }

    if (purchaseTrack === 'full_cash' && !uploadedDocMeta) {
      setErrorMsg(
        language === 'ru'
          ? 'Для трека «100% Кэш» прикрепите свежую банковскую выписку о наличии средств.'
          : 'Please upload a recent bank statement confirming liquidity for the 100% Cash track.'
      );
      return;
    }

    if (purchaseTrack === 'mortgage_substitution') {
      if (!uploadedDocMeta) {
        setErrorMsg(
          language === 'ru'
            ? 'Для ипотечного трека прикрепите скан или фото сертификата об одобрении кредита банком.'
            : 'Please upload the bank mortgage pre-approval certificate.'
        );
        return;
      }
      if (creditLimitRub < lot.remainingInstallmentDebt) {
        setErrorMsg(
          language === 'ru'
            ? `Одобренный лимит ипотеки не может быть меньше остатка долга застройщику (${formatRubles(
                lot.remainingInstallmentDebt
              )}).`
            : `Approved mortgage limit must cover remaining developer debt (${formatRubles(
                lot.remainingInstallmentDebt
              )}).`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await login({
          name: fullName.trim(),
          phone: contact,
          role: 'buyer',
        });
      }

      const regionLabel = getRegionByCode(lot.city).shortLabelRu;

      await CandidatesRepository.submitBid({
        lotCode: lot.lotCode,
        uid: activeUser.id,
        userId: activeUser.id,
        clientCode: activeUser.clientCode,
        phone: contact,
        email: activeUser.email,
        name: fullName.trim(),
        location: `${regionLabel} • ${lot.district}`,
        buyerTrack: purchaseTrack,
        fundingType: purchaseTrack === 'full_cash' ? 'cash' : 'family-mortgage',
        availableLiquidity:
          purchaseTrack === 'full_cash' ? lot.dduContractPrice : lot.cashPaidBySeller,
        creditLimitRub: purchaseTrack === 'mortgage_substitution' ? creditLimitRub : undefined,
        documentId: uploadedDocMeta?.id,
        bankApprovalDocUrl: uploadedDocMeta?.cloudUrl,
        bankApprovalDocName: uploadedDocMeta?.name,
        bankStatementUrl: purchaseTrack === 'full_cash' ? uploadedDocMeta?.cloudUrl : undefined,
        bankStatementName: purchaseTrack === 'full_cash' ? uploadedDocMeta?.name : undefined,
        readinessTimeline:
          readiness === '48h'
            ? `Готовность к аккредитиву 48ч${questions ? ` • ${questions}` : ''}`
            : `Выход на сделку 1–2 нед.${questions ? ` • ${questions}` : ''}`,
        status: 'pending',
      });

      await UserConsentsRepository.recordConsent({
        userId: activeUser.id,
        phone: contact,
        email: activeUser.email,
        consents: buyerConsents,
        context: `buyer_bid_lot_${lot.lotCode}`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-fadeIn">
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
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daily Selection Notice */}
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 space-y-1">
          <div className="font-bold flex items-center space-x-1.5">
            <span>Окно приема заявок открыто • Регистрация в S3-реестре</span>
          </div>
          <p className="text-[11px] text-sky-800/90 leading-relaxed">
            Заявка фиксируется с вашим персональным кодом клиента ({user?.clientCode || 'DEX-ID'}) и мгновенно поступает в модуль матчмейкинга ответственного куратора.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* The Two Purchase Tracks Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              {language === 'ru'
                ? 'Выберите трек финансирования покупки объекта:'
                : 'Select Financing Track:'}{' '}
              *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Track 1: 100% Cash */}
              <div
                onClick={() => {
                  setPurchaseTrack('full_cash');
                  setUploadedDocMeta(null);
                }}
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
                    Приоритет №1
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Оплата полной стоимости по ДДУ ({formatRubles(lot.dduContractPrice)}) через безотзывный банковский аккредитив.
                </p>
              </div>

              {/* Track 2: Seller Cash + Mortgage Substitution */}
              <div
                onClick={() => {
                  setPurchaseTrack('mortgage_substitution');
                  setUploadedDocMeta(null);
                }}
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
                    Перевод долга
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Кэш продавцу ({formatRubles(lot.cashPaidBySeller)}) + замещение остатка девелопера ({formatRubles(lot.remainingInstallmentDebt)}) ипотекой.
                </p>
              </div>

            </div>
          </div>

          {/* Conditional Field for Track 1: 100% Cash */}
          {purchaseTrack === 'full_cash' && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-emerald-950 flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>Подтверждение доступной ликвидности (Yandex S3 Vault)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Загрузите свежую банковскую выписку со счета о наличии средств на сумму не менее {formatRubles(lot.dduContractPrice)}.
              </p>
              <div>
                <button
                  type="button"
                  onClick={handleUploadBankDoc}
                  disabled={isUploadingDoc}
                  className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-emerald-400 hover:border-emerald-500 bg-white hover:bg-emerald-50/50 text-slate-800 text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  <span className="truncate">
                    {isUploadingDoc
                      ? 'Шифрование и загрузка в S3...'
                      : uploadedDocMeta
                      ? `В сейфе S3: ${uploadedDocMeta.name}`
                      : 'Загрузить выписку со счета (PDF / JPG / PNG)'}
                  </span>
                </button>
                {uploadedDocMeta && (
                  <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                    ✓ Сохранено в защищенном хранилище ({(uploadedDocMeta.sizeBytes / 1024).toFixed(1)} КБ • SHA-256)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Conditional Fields for Track 2 */}
          {purchaseTrack === 'mortgage_substitution' && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-4">
              <div className="text-xs font-bold text-amber-900 flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-amber-700" />
                <span>Подтверждение кредитного лимита банка (214-ФЗ)</span>
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
                    Минимум по остатку ДДУ: {formatRubles(lot.remainingInstallmentDebt)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Сертификат одобрения банка (PDF/JPG) *
                  </label>
                  <button
                    type="button"
                    onClick={handleUploadBankDoc}
                    disabled={isUploadingDoc}
                    className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-amber-400 hover:border-amber-500 bg-white hover:bg-amber-50/50 text-slate-800 text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-amber-600" />
                    <span className="truncate">
                      {isUploadingDoc
                        ? 'Шифрование S3...'
                        : uploadedDocMeta
                        ? `В сейфе S3: ${uploadedDocMeta.name}`
                        : 'Загрузить справку банка'}
                    </span>
                  </button>
                  {uploadedDocMeta && (
                    <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                      ✓ Документ сохранен в S3 ({(uploadedDocMeta.sizeBytes / 1024).toFixed(1)} КБ)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Inputs: Full Name & Strict Russian Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ru' ? 'Ваше полное ФИО *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={language === 'ru' ? 'Смирнов Иван Сергеевич' : 'Ivan Smirnov'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ru' ? 'Телефон РФ (+7) *' : 'Russian Phone (+7) *'}
              </label>
              <input
                type="tel"
                required
                placeholder="+7 (921) 000-00-00"
                value={contact}
                onChange={(e) => setContact(formatRussianPhoneInput(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* Readiness & Comments */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Срок выхода на сделку:
              </label>
              <select
                value={readiness}
                onChange={(e) => setReadiness(e.target.value as '48h' | '1-2weeks')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
              >
                <option value="48h">В течение 48 часов</option>
                <option value="1-2weeks">В течение 1–2 недель</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ru' ? 'Комментарий куратору:' : 'Notes to Curator:'}
              </label>
              <input
                type="text"
                placeholder={
                  language === 'ru'
                    ? 'Готов открыть аккредитив в Сбербанке / ВТБ'
                    : 'Ready to open escrow L/C'
                }
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Mandatory Green Acknowledgment & 152-FZ / 38-FZ Consents */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-2">
            <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-xl font-bold">
              {language === 'ru'
                ? '✓ Сервисный сбор платформы 2.5% выплачивается строго ПОСЛЕ государственной регистрации уступки в Росреестре (0 ₽ предоплаты).'
                : '✓ Platform service fee 2.5% is paid strictly AFTER state registration in Rosreestr (0 ₽ upfront).'}
            </div>
            <ConsentCheckboxes
              value={buyerConsents}
              onChange={setBuyerConsents}
            />
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={isSubmitting || !buyerConsents.pdProcessing || !buyerConsents.termsAgreed}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>
              {isSubmitting
                ? language === 'ru'
                  ? 'Регистрация предложения...'
                  : 'Submitting Offer...'
                : language === 'ru'
                ? 'Отправить заявку куратору лота →'
                : 'Submit Offer to Assigned Curator →'}
            </span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>

        </form>

      </div>
    </div>
  );
};
