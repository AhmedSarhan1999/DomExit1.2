import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, ExternalLink, Copy } from 'lucide-react';
import { ProofOfConsentRecord } from '../../types';
import { CANONICAL_POLICY_NAMES } from '../../dal/repositories/LegalPoliciesRepository';

export interface ConsentsArchiveTabProps {
  userConsents: ProofOfConsentRecord[];
}

export const ConsentsArchiveTab: React.FC<ConsentsArchiveTabProps> = ({ userConsents }) => {
  const [copiedConsentSha, setCopiedConsentSha] = useState<string | null>(null);

  const handleCopySha = (sha: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sha);
      setCopiedConsentSha(sha);
      setTimeout(() => setCopiedConsentSha(null), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Compliance Overview Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Федеральный закон № 152-ФЗ • Статья 9
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Реестр выданных согласий и доказательств (Proof of Consent)
              </h2>
            </div>
          </div>

          <Link
            to="/legal/archive"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center space-x-1.5 shrink-0 self-start sm:self-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Публичный архив редакций</span>
          </Link>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
          В соответствии с требованиями Федерального закона № 152-ФЗ «О персональных данных» и методическими рекомендациями Роскомнадзора, платформа DomExit ведет строгий неизменяемый учет всех юридических волеизъявлений субъектов персональных данных. Каждая запись содержит криптографическую контрольную сумму (SHA-256) текста документа на момент акцепта.
        </p>

        {/* Roskomnadzor Badges */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Локализация в РФ (Yandex Cloud УЗ-1)</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
            <span>Трансграничная передача: 0% (Запрещена)</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
            <span>Стандарт хэширования: SHA-256</span>
          </span>
        </div>
      </div>

      {/* Consents List */}
      {userConsents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">
          Активных записей о согласиях пока не зафиксировано.
        </div>
      ) : (
        <div className="space-y-4">
          {userConsents.map((consent) => (
            <div
              key={consent.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Юридический документ
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      Действительно
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {CANONICAL_POLICY_NAMES[consent.policyType as keyof typeof CANONICAL_POLICY_NAMES] || consent.policyType}
                  </h3>
                </div>

                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 self-start sm:self-auto">
                  Редакция {consent.policyVersion}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Время фиксации (МСК):
                  </span>
                  <span className="font-semibold text-slate-800">
                    {new Date(consent.consentedAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Узел и сессия:
                  </span>
                  <span className="font-mono text-slate-700 truncate block">
                    {consent.ipAddress || '127.0.0.1 (Yandex Cloud DC)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Метод согласия:
                  </span>
                  <span className="font-semibold text-emerald-800">
                    {consent.consentMethod === 'reconsent_modal'
                      ? 'Модальное окно обновления'
                      : consent.consentMethod === 'portal_action'
                      ? 'Личный кабинет'
                      : 'Веб-форма регистрации'}
                  </span>
                </div>
              </div>

              {/* SHA-256 Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-3 rounded-xl font-mono text-xs">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="text-slate-400 font-sans font-bold text-[10px] uppercase shrink-0">
                    Хэш текста (SHA-256):
                  </span>
                  <span className="text-emerald-400 truncate font-semibold">
                    {consent.policySha256}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopySha(consent.policySha256)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    {copiedConsentSha === consent.policySha256 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-sans">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="font-sans">Копировать</span>
                      </>
                    )}
                  </button>

                  <Link
                    to="/legal/archive"
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[11px] font-sans font-bold transition-colors"
                  >
                    Сверить текст &rarr;
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Right of withdrawal notice */}
      <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-900 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Право на отзыв согласия (ст. 9 ч. 2 152-ФЗ)</span>
        </div>
        <p>
          Вы имеете право в любой момент полностью или частично отозвать ранее предоставленные согласия на обработку персональных данных. Для отзыва направьте заявление в свободной форме на адрес ответственного лица по защите данных:{' '}
          <a href="mailto:help@domexit.ru" className="text-emerald-700 font-bold underline">
            help@domexit.ru
          </a>{' '}
          или обратитесь к персональному юридическому куратору. Обработка данных будет прекращена в установленный законом срок до 30 календарных дней с оформлением акта об уничтожении.
        </p>
      </div>
    </div>
  );
};
