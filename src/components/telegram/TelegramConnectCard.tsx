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
  const { user, isAuthenticated, openAuthModal } = useAuth();

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
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStatus();

    // Auto-refresh status when user switches back to browser tab
    const handleFocus = () => {
      fetchStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStatus]);

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

  if (!isAuthenticated) {
    return (
      <div className={`p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white ${className}`}>
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Telegram Operating System</h4>
            <p className="text-xs text-slate-400">Мгновенные уведомления и чат с куратором</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openAuthModal('Авторизуйтесь для привязки Telegram')}
          className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          Войти для подключения Telegram
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white ${className}`}>
        <div className="flex items-center justify-center space-x-2 py-4 text-xs text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Проверка подключения к Telegram...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-2xl bg-slate-900 border border-slate-800 text-white ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/10">
            <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-bold text-sm text-white">DomExit Telegram OS</h4>
              {linked ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Подключен
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Не подключен
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
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
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {errorMsg && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* State 1: Linked */}
      {linked ? (
        <div className="space-y-3.5">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-sky-400" />
                Мгновенные уведомления:
              </span>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  notificationsEnabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {notificationsEnabled ? 'Включены' : 'Выключены'}
              </button>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
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
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-sky-400 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                {testSending ? 'Отправка...' : 'Отправить тестовый пинг в Telegram'}
              </button>
              {testResult && (
                <p className="text-[11px] text-center text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
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
              className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
            >
              <span>Открыть диалог с ботом</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="button"
              onClick={handleUnlink}
              className="text-xs text-slate-500 hover:text-rose-400 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Unlink className="w-3 h-3" />
              <span>Отключить</span>
            </button>
          </div>
        </div>
      ) : (
        /* State 2: Not Linked */
        <div className="space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            Подключите Telegram, чтобы мгновенно получать статус проверки документов, уведомления о бронированиях и отвечать куратору прямо из мессенджера.
          </p>

          <button
            type="button"
            onClick={handleStartConnect}
            disabled={connecting}
            className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
            <span>{connecting ? 'Генерация защищенной ссылки...' : 'Подключить Telegram'}</span>
          </button>

          {deepLink && (
            <div className="p-3 rounded-xl bg-slate-800/80 border border-sky-500/30 text-xs space-y-2">
              <p className="text-sky-300 font-medium">
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
              <p className="text-[11px] text-slate-400 text-center">
                После нажатия «Запустить» в Telegram статус обновится автоматически.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
