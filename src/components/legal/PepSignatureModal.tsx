import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Shield,
  X,
  Send,
  Mail,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ExternalLink,
  Clock,
  Key,
} from 'lucide-react';
import { apiClient, ApiError } from '../../services/apiClient';
import { TelegramConnectCard } from '../telegram/TelegramConnectCard';

interface PepSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'nda_viewing_act' | 'seller_exclusive_consent' | 'buyer_reservation_terms';
  lotCode: string;
  onSigned?: (signatureRecord: any) => void;
}

export const PepSignatureModal: React.FC<PepSignatureModalProps> = ({
  isOpen,
  onClose,
  documentType,
  lotCode,
  onSigned,
}) => {
  const [loading, setLoading] = useState(true);
  const [docPreview, setDocPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OTP flow state
  const [deliveryChannel, setDeliveryChannel] = useState<'email' | 'telegram'>('email');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [signLoading, setSignLoading] = useState(false);
  const [timerSec, setTimerSec] = useState(300);
  const [deliveryTargetText, setDeliveryTargetText] = useState('');
  const [needsTelegramLink, setNeedsTelegramLink] = useState(false);
  const [signedCertificate, setSignedCertificate] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadPreview();
  }, [isOpen, documentType, lotCode]);

  // Countdown timer for OTP
  useEffect(() => {
    if (!otpRequested || timerSec <= 0 || signedCertificate) return;
    const interval = setInterval(() => {
      setTimerSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpRequested, timerSec, signedCertificate]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      setNeedsTelegramLink(false);

      const res = await apiClient.pep.getPreview(documentType, lotCode);
      setDocPreview(res);

      if (res.alreadySigned && res.existingSignature) {
        setSignedCertificate({
          signedAt: res.existingSignature.signedAt,
          documentType: res.existingSignature.documentType,
          title: res.title,
          docHashSha256: res.existingSignature.docHashSha256,
          verificationMethod: res.existingSignature.verificationMethod || 'email_otp_63fz',
          signatory: {
            name: res.existingSignature.userNameMasked || 'Пользователь',
            email: 'Защищено 152-ФЗ',
            phone: 'Защищено 152-ФЗ',
          },
          legalNote:
            'Документ ранее подписан простой электронной подписью (ПЭП) в соответствии со ст. 5 и 9 Федерального закона № 63-ФЗ «Об электронной подписи».',
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить проект документа');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (channelToUse?: 'email' | 'telegram') => {
    const ch = channelToUse || deliveryChannel;
    try {
      setOtpLoading(true);
      setError(null);
      setNeedsTelegramLink(false);

      const res = await apiClient.pep.requestOtp(documentType, lotCode, ch);
      setOtpRequested(true);
      setTimerSec(res.expiresInSec || 300);

      if (res.deliveryChannel === 'telegram') {
        setDeliveryTargetText(res.telegramUsername ? `@${res.telegramUsername}` : 'Telegram');
      } else {
        setDeliveryTargetText(res.targetEmailMasked || 'ваш адрес эл. почты');
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 412) {
        setNeedsTelegramLink(true);
        setError('Для получения кода в Telegram необходимо привязать аккаунт. Вы также можете получить код прямо на ваш Email.');
      } else {
        setError(err?.message || 'Не удалось отправить проверочный код');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyAndSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setError('Введите 6-значный проверочный код');
      return;
    }

    try {
      setSignLoading(true);
      setError(null);
      const res = await apiClient.pep.verifyAndSign(documentType, lotCode, otpCode.trim());
      setSignedCertificate(res.certificate);
      if (onSigned) {
        onSigned(res.signature);
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка проверки кода подтверждения');
    } finally {
      setSignLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8 max-h-[92vh] overflow-y-auto font-sans">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-emerald-700">
              <Shield className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider">
                ПРОСТАЯ ЭЛЕКТРОННАЯ ПОДПИСЬ (ПЭП • 63-ФЗ)
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900">
              {docPreview?.title || 'Подписание юридического соглашения'}
            </h3>
            <p className="text-xs text-slate-500">
              Объект #{lotCode} • Равнозначно собственноручной подписи на бумажном носителе
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center space-x-2 animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-bold">Подготовка юридического проекта документа...</span>
          </div>
        ) : signedCertificate ? (
          /* Signature Certificate Screen */
          <div className="p-6 rounded-3xl bg-emerald-50/80 border-2 border-emerald-300 space-y-5 animate-fade-in text-xs">
            <div className="flex items-center space-x-3 text-emerald-900">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black">ДОКУМЕНТ УСПЕШНО ПОДПИСАН</h4>
                <p className="text-emerald-800 font-medium">
                  Юридический сертификат ПЭП зарегистрирован в защищенном реестре платформы
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-2 font-mono text-[11px] text-slate-800">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Документ:</span>
                <span className="font-bold">{signedCertificate.title}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Подписант:</span>
                <span className="font-bold">{signedCertificate.signatory.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Дата и время (МСК):</span>
                <span className="font-bold">{new Date(signedCertificate.signedAt).toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">SHA-256 хеш текста:</span>
                <span className="font-bold truncate max-w-xs">{signedCertificate.docHashSha256}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Канал доставки OTP:</span>
                <span className="font-bold text-emerald-800">
                  {deliveryChannel === 'email' ? 'Электронная почта' : 'Telegram-бот'}
                </span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-slate-500">Правовой статус:</span>
                <span className="font-bold text-emerald-700">ст. 5, 6, 9 ФЗ № 63-ФЗ</span>
              </div>
            </div>

            <p className="text-emerald-950 font-sans leading-relaxed text-[11px]">
              {signedCertificate.legalNote}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
            >
              Закрыть окно сертификата
            </button>
          </div>
        ) : needsTelegramLink ? (
          /* Telegram Binding Option with 1-click Email fallback */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <span className="font-bold block text-amber-950">Telegram не привязан к вашему аккаунту:</span>
              <p>
                Вы можете привязать Telegram-бота ниже, либо сразу получить проверочный код на ваш Email без дополнительных привязок.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeliveryChannel('email');
                  handleRequestOtp('email');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Получить код на Email прямо сейчас</span>
              </button>
            </div>
            <TelegramConnectCard onLinkComplete={() => loadPreview()} />
          </div>
        ) : (
          /* Document Preview & OTP Signing Flow */
          <div className="space-y-5">
            {/* Canonical Document Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Канонический текст документа ({docPreview?.version}):</span>
                <span className="font-mono truncate max-w-xs">SHA-256: {docPreview?.sha256Hex}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 max-h-56 overflow-y-auto whitespace-pre-line leading-relaxed">
                {docPreview?.text}
              </div>
            </div>

            {/* OTP Section */}
            {!otpRequested ? (
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="space-y-0.5">
                  <span className="font-black text-xs text-emerald-950 block">
                    Подписание через одноразовый проверочный код (ПЭП • 63-ФЗ)
                  </span>
                  <p className="text-[11px] text-emerald-900/80">
                    Выберите удобный способ получения 6-значного кода подтверждения:
                  </p>
                </div>

                {/* Channel Selector */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDeliveryChannel('email')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
                      deliveryChannel === 'email'
                        ? 'border-emerald-500 bg-white text-emerald-950 font-bold shadow-xs'
                        : 'border-emerald-200/60 bg-emerald-50/50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs">На Email (63-ФЗ)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Основной канал</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryChannel('telegram')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
                      deliveryChannel === 'telegram'
                        ? 'border-emerald-500 bg-white text-emerald-950 font-bold shadow-xs'
                        : 'border-emerald-200/60 bg-emerald-50/50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs">В Telegram-бот</div>
                      <div className="text-[10px] text-slate-500 font-normal">Для привязанных</div>
                    </div>
                  </button>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={otpLoading}
                    onClick={() => handleRequestOtp()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Отправка...</span>
                      </>
                    ) : (
                      <>
                        {deliveryChannel === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                        <span>
                          {deliveryChannel === 'email' ? 'Получить код на Email' : 'Получить код в Telegram'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyAndSign} className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-950">
                    Код отправлен: {deliveryTargetText}
                  </span>
                  <span className="font-mono text-emerald-800 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {Math.floor(timerSec / 60)}:{(timerSec % 60).toString().padStart(2, '0')}
                    </span>
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="relative flex-1">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6 цифр из сообщения"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-300 font-mono font-bold text-sm tracking-widest text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={signLoading || otpCode.length !== 6 || timerSec <= 0}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-black text-xs transition-colors cursor-pointer shadow-xs shrink-0 flex items-center space-x-1.5"
                  >
                    {signLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Подписание...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Подписать (ПЭП 63-ФЗ)</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Осталось попыток: 3 (после 3 неверных попыток код аннулируется)</span>
                  {timerSec <= 0 && (
                    <button
                      type="button"
                      onClick={() => handleRequestOtp()}
                      className="text-emerald-700 hover:underline font-bold cursor-pointer"
                    >
                      Запросить новый код
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
