import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ShieldCheck, Sliders, X } from 'lucide-react';
import { CookieConsentPreferences } from '../../types';

const STORAGE_KEY = 'domexit_cookie_consent';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [preferences, setPreferences] = useState<CookieConsentPreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    updatedAt: '',
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CookieConsentPreferences = JSON.parse(stored);
        setPreferences(parsed);
        if (parsed.analytics) {
          enableAnonymizedAnalytics();
        }
      } else {
        // Show banner if not yet consented
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, []);

  const enableAnonymizedAnalytics = () => {
    if (typeof window === 'undefined') return;
    // Anonymized telemetry initialization (Block-Before-Consent compliance)
    const win = window as any;
    if (!win.ymInitialized) {
      win.ymInitialized = true;
      // Configure pseudo-metrika or official tag with IP anonymization
      if (typeof win.ym === 'function') {
        win.ym(99999999, 'init', {
          clickmap: false,
          trackLinks: true,
          accurateTrackBounce: true,
          webvisor: false, // privacy friendly
          ipAnonymization: true, // Roskomnadzor requirement
        });
      }
    }
  };

  const handleSavePreferences = (prefs: CookieConsentPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage error
    }
    setPreferences(prefs);
    setIsVisible(false);
    setShowSettingsModal(false);
    if (prefs.analytics) {
      enableAnonymizedAnalytics();
    }
  };

  const handleAcceptAll = () => {
    handleSavePreferences({
      essential: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleEssentialOnly = () => {
    handleSavePreferences({
      essential: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
    });
  };

  if (!isVisible && !showSettingsModal) return null;

  return (
    <>
      {isVisible && (
        <aside
          role="region"
          aria-label="Настройки файлов cookie"
          className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl animate-fade-in"
        >
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs text-slate-600 max-w-3xl leading-relaxed">
                <div className="font-black text-slate-900 text-sm flex items-center space-x-2">
                  <span>Файлы Cookie и конфиденциальность (152-ФЗ РФ)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    Safe Browsing
                  </span>
                </div>
                <p>
                  Платформа DomExit использует необходимые технические файлы cookie для безопасной
                  авторизации и работы расчетов эскроу. Аналитические трекеры запускаются только с
                  вашего явного согласия с анонимизацией IP-адресов. Подробнее в нашей{' '}
                  <Link
                    to="/privacy"
                    className="text-emerald-700 underline font-semibold hover:text-emerald-800"
                  >
                    Политике конфиденциальности
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Настроить</span>
              </button>

              <button
                type="button"
                onClick={handleEssentialOnly}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Только технические
              </button>

              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
              >
                Принять все
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">
                  Настройки файлов cookie и трекинга
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              {/* Category 1: Essential */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center space-x-2">
                    <span>Технические cookie (Обязательные)</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      Всегда активны
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Обеспечивают сессию, безопасное депонирование эскроу-траншей и защиту от CSRF-атак.
                  </p>
                </div>
                <input type="checkbox" checked disabled className="w-4 h-4 rounded text-emerald-600" />
              </div>

              {/* Category 2: Analytics */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900">Аналитика и веб-визор (Анонимно)</div>
                  <p className="text-slate-500 text-[11px]">
                    Сбор обезличенной статистики посещаемости с автоматической маскировкой IP-адресов
                    по стандарту 152-ФЗ.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) =>
                    setPreferences({ ...preferences, analytics: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Category 3: Marketing */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900">Рекламные сервисы (ФЗ-38)</div>
                  <p className="text-slate-500 text-[11px]">
                    Персонализация предложений по дисконтным лотам уступки и скидкам банков.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) =>
                    setPreferences({ ...preferences, marketing: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSavePreferences({
                    ...preferences,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Сохранить настройки
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
