import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LegalPoliciesRepository } from '../../dal/repositories/LegalPoliciesRepository';
import { UsersRepository } from '../../dal/repositories/UsersRepository';
import { LegalPolicyVersion } from '../../types';
import { withAsyncTimeout, ASYNC_NETWORK_TIMEOUT_MESSAGE } from '../../utils/asyncGuard';

const CURRENT_POLICY_VERSION = '2026.1';

export const ConsentGateModal: React.FC = () => {
  const { user } = useAuth();
  const [unconsentedPolicies, setUnconsentedPolicies] = useState<LegalPolicyVersion[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [acceptedCheck, setAcceptedCheck] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Immediate synchronous guard: if user or device has already agreed to version 2026.1, suppress modal completely
  const localAgreedVersion = typeof window !== 'undefined' ? localStorage.getItem('last_agreed_version') : null;
  const isAlreadyAgreed =
    localAgreedVersion === CURRENT_POLICY_VERSION || user?.agreedPolicyVersion === CURRENT_POLICY_VERSION;

  useEffect(() => {
    if (isAlreadyAgreed || !user) {
      setIsOpen(false);
      return;
    }

    const checkConsents = async () => {
      try {
        const userId = user.id || user.email || user.clientCode || 'anon-client';
        const pending = await LegalPoliciesRepository.checkUserUnconsentedMaterialPolicies(userId);
        if (pending && pending.length > 0) {
          setUnconsentedPolicies(pending);
          setIsOpen(true);
        } else {
          setIsOpen(false);
        }
      } catch (e) {
        console.warn('Consent check failed', e);
      }
    };

    checkConsents();
  }, [user, isAlreadyAgreed]);

  if (isAlreadyAgreed || !isOpen || unconsentedPolicies.length === 0) {
    return null;
  }

  const handleAcceptAll = async () => {
    if (!acceptedCheck || !user) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await withAsyncTimeout(
        (async () => {
          const userId = user.id || user.email || user.clientCode || 'anon-client';

          // 1. Record proof of consent for each policy in vault
          for (const pol of unconsentedPolicies) {
            await LegalPoliciesRepository.recordProofOfConsent({
              userId,
              clientCode: user.clientCode,
              userFullName: user.name || user.email,
              policyType: pol.policyType,
              policyVersion: pol.versionNumber,
              policySha256: pol.sha256Hash,
              consentMethod: 'reconsent_modal',
            });
          }

          // 2. Persist consent in user profile in DB and in localStorage
          await UsersRepository.updateAgreedPolicyVersion(userId, CURRENT_POLICY_VERSION);
          if (user.id) {
            user.agreedPolicyVersion = CURRENT_POLICY_VERSION;
          }
          localStorage.setItem('last_agreed_version', CURRENT_POLICY_VERSION);
        })(),
        15000,
        ASYNC_NETWORK_TIMEOUT_MESSAGE
      );

      setIsOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 sm:p-8 space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-emerald-300 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">
                152-ФЗ «О персональных данных» • Роскомнадзор
              </span>
              <h2 className="text-xl font-black text-white">
                Обновление юридических документов
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            В регламент платформы внесены существенные изменения в соответствии с требованиями законодательства РФ. Для продолжения работы в защищенном контуре ознакомьтесь с обновленными редакциями.
          </p>
        </div>

        {/* Updated Policies List */}
        <div className="p-6 sm:p-8 space-y-4 max-h-[50vh] overflow-y-auto">
          <div className="space-y-3">
            {unconsentedPolicies.map((pol) => (
              <div
                key={pol.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{pol.policyNameRu}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">
                    v{pol.versionNumber}
                  </span>
                </div>
                <p className="text-slate-600">{pol.changeSummary}</p>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  SHA-256: {pol.sha256Hash}
                </div>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Consent Checkbox */}
          <div className="pt-2">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedCheck}
                onChange={(e) => setAcceptedCheck(e.target.checked)}
                disabled={isSubmitting}
                className="mt-1 w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 leading-relaxed group-hover:text-slate-900 select-none">
                Я подтверждаю ознакомление с обновленными редакциями документов, согласен с условиями обработки данных в защищенном контуре Yandex Cloud и даю согласие на продолжение работы.
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link
            to="/legal/archive"
            target="_blank"
            className="text-xs font-bold text-slate-600 hover:text-emerald-700 underline transition-colors"
          >
            Архив и журнал версий
          </Link>

          <button
            type="button"
            onClick={handleAcceptAll}
            disabled={!acceptedCheck || isSubmitting}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 ${
              acceptedCheck && !isSubmitting
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Фиксация согласия (ГОСТ)...</span>
              </>
            ) : (
              <span>Принять и продолжить</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
