import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import {
  Send,
  CheckCircle2,
  Bell,
  BellOff,
  Unlink,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface TelegramConnectCardProps {
  className?: string;
  compact?: boolean;
  onLinkComplete?: () => void;
}

export const TelegramConnectCard: React.FC<TelegramConnectCardProps> = ({
  className = '',
  compact = false,
  onLinkComplete,
}) => {
  const { user, isAuthenticated, loading: authLoading, openAuthModal } = useAuth();

  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [botUsername, setBotUsername] = useState('');
  const [linked, setLinked] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | undefined>();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [connecting, setConnecting] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setErrorMsg(null);
      const res = await apiClient.telegram.getStatus();
      setConfigured(res.configured);
      setBotUsername(res.botUsername);
      setLinked(res.linked);
      if (res.linked && onLinkComplete) {
        onLinkComplete();
      }
      setTelegramUsername(res.telegramUsername);
      setNotificationsEnabled(res.notificationsEnabled !== false);
    } catch (err: any) {
      console.warn('Failed to load telegram status:', err.message);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, onLinkComplete]);

  useEffect(() => {
    fetchStatus();

    // Auto-refresh status when user switches back to browser tab
    const handleFocus = () => {
      fetchStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStatus]);

  // Polling every 3 seconds for 2 minutes after generating connect link
  useEffect(() => {
    if (!deepLink || linked) return;
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 120000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [deepLink, linked, fetchStatus]);

  const handleStartConnect = async () => {
    if (!isAuthenticated) {
      openAuthModal('Авторизуйтесь для привязки Telegram к вашему аккаунту');
      return;
    }

    try {
      setConnecting(true);
      setErrorMsg(null);
      const data = await apiClient.telegram.createLinkToken();
      setDeepLink(data.deepLink);

      // Open Telegram link in new window/tab
      window.open(data.deepLink, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setErrorMsg(err.message || 'Не удалось сгенерировать ссылку для привязки');
    } finally {
      setConnecting(false);
    }
  };

  const handleToggleNotifications = async () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    try {
      await apiClient.telegram.updatePreferences(nextVal);
    } catch (err: any) {
      setNotificationsEnabled(!nextVal); // rollback
      setErrorMsg('Не удалось сохранить настройки уведомлений');
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Вы уверены, что хотите отключить уведомления в Telegram?')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.telegram.unlink();
      setLinked(false);
      setTelegramUsername(undefined);
      setDeepLink(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка при отключении');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setTestSending(true);
      setTestResult(null);
      const res = await apiClient.telegram.testNotification();
      if (res.sent) {
        setTestResult('Тестовое сообщение успешно доставлено в Telegram!');
      } else {
        setTestResult(res.description || 'Не удалось отправить сообщение');
      }
    } catch (err: any) {
      setTestResult(`Ошибка: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  };

  if (compact) {
    if (!isAuthenticated) {
      return (
        <div className={`p-3 rounded-2xl bg-white border border-slate-200 text-slate-800 shadow-xs flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-200/60 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Telegram OS</span>
              <span className="text-[11px] text-slate-500">Войдите для мгновенных пуш-уведомлений и чата</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('Авторизуйтесь для привязки Telegram')}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Войти
          </button>
        </div>
      );
    }

    if (loading) {
      return (
        <div className={`p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 shadow-xs flex items-center justify-center space-x-2 text-xs ${className}`}>
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
          <span>Проверка подключения к Telegram...</span>
        </div>
      );
    }

    return (
      <div className={`p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-white to-sky-50/50 border border-emerald-200/80 text-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs text-slate-900">Telegram OS:</span>
              {linked ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{telegramUsername ? `@${telegramUsername}` : 'Подключен'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Не подключен
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {linked
                ? 'Мгновенные статусы сделок и прямая связь с куратором в Telegram'
                : 'Подключите Telegram для получения статусов проверки и уведомлений'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {linked ? (
            <a
              href={`https://t.me/${botUsername || 'DomExitOfficialBot'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-sky-600 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <span>Диалог с ботом</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleStartConnect}
              disabled={connecting}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 -rotate-12" />
              <span>{connecting ? 'Генерация...' : 'Подключить Telegram'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={`p-5 rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-xs ${className}`}>
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900">Telegram Operating System</h4>
            <p className="text-xs text-slate-500">Мгновенные уведомления и чат с куратором</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openAuthModal('Авторизуйтесь для привязки Telegram')}
          className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          Войти для подключения Telegram
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`p-5 rounded-2xl bg-white border border-slate-200 text-slate-600 shadow-xs ${className}`}>
        <div className="flex items-center justify-center space-x-2 py-4 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
          <span>Проверка подключения к Telegram...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0 shadow-2xs">
            <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-bold text-sm text-slate-900">DomExit Telegram OS</h4>
              {linked ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Подключен
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Не подключен
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {linked
                ? telegramUsername
                  ? `@${telegramUsername}`
                  : 'Аккаунт привязан к боту'
                : 'Синхронизация статусов, сделок и прямой чат'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchStatus}
          title="Обновить статус"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {errorMsg && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {errorMsg}
        </div>
      )}

      {/* State 1: Linked */}
      {linked ? (
        <div className="space-y-3.5">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-medium flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-sky-600" />
                Мгновенные уведомления:
              </span>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  notificationsEnabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {notificationsEnabled ? 'Включены' : 'Выключены'}
              </button>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Шифрование сессии и защита персональных данных (152-ФЗ)
            </div>
          </div>

          {/* Owner-only test notification button */}
          {user?.role === 'owner' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={testSending}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-sky-700 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                {testSending ? 'Отправка...' : 'Отправить тестовый пинг в Telegram'}
              </button>
              {testResult && (
                <p className="text-[11px] text-center text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  {testResult}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <a
              href={`https://t.me/${botUsername || 'DomExitOfficialBot'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-600 hover:text-sky-700 font-bold inline-flex items-center gap-1 transition-colors"
            >
              <span>Открыть диалог с ботом</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="button"
              onClick={handleUnlink}
              className="text-xs text-slate-400 hover:text-rose-600 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Unlink className="w-3 h-3" />
              <span>Отключить</span>
            </button>
          </div>
        </div>
      ) : (
        /* State 2: Not Linked */
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Подключите Telegram, чтобы мгновенно получать статус проверки документов, уведомления о бронированиях и отвечать куратору прямо из мессенджера.
          </p>

          <button
            type="button"
            onClick={handleStartConnect}
            disabled={connecting}
            className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
            <span>{connecting ? 'Генерация защищенной ссылки...' : 'Подключить Telegram'}</span>
          </button>

          {deepLink && (
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs space-y-2">
              <p className="text-sky-900 font-bold">
                1. Ссылка открыта в новом окне. Если окно заблокировано:
              </p>
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-center font-bold block transition-colors"
              >
                Перейти в бота и нажать Start
              </a>
              <p className="text-[11px] text-slate-500 text-center">
                После нажатия «Запустить» в Telegram статус обновится автоматически.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
