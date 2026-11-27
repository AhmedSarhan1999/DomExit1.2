/**
 * DomExitConciergeWidget.tsx
 *
 * Floating Web Concierge Widget for DomExit.
 * Strictly gated behind `aiConciergeRag` feature flag (hidden if disabled).
 * Features:
 * - 4 starter quick-action prompt buttons.
 * - Source citation pills linking to verified platform pages.
 * - Guided Buy-Box extraction card with one-click "Сохранить в мой Buy-Box" confirmation.
 * - Warm Human Handoff button to call a live curator.
 * - 152-FZ PII safety and 600-character input bounds.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  Building,
  ArrowRight,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { useAiFeatureFlags } from '../../hooks/useAiFeatureFlags';
import { apiClient } from '../../services/apiClient';

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: Array<{ title: string; url: string; sourceType: string }>;
  matchedLots?: any[];
  suggestedBuyBox?: Record<string, any> | null;
  createdAt: string;
}

const STARTER_PROMPTS = [
  'Как работает переуступка ДДУ?',
  'Подобрать квартиру в Buy-Box',
  'Как защищена сделка через СБР?',
  'Продать свою квартиру с 0% комиссии',
];

export const DomExitConciergeWidget: React.FC = () => {
  const { isFeatureEnabled, loading: flagsLoading } = useAiFeatureFlags();
  const isEnabled = isFeatureEnabled('aiConciergeRag');

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [anonymousId] = useState(() => {
    let aid = localStorage.getItem('domexit_anon_id');
    if (!aid) {
      aid = 'anon_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('domexit_anon_id', aid);
    }
    return aid;
  });

  const [savingBuyBox, setSavingBuyBox] = useState(false);
  const [buyBoxSaved, setBuyBoxSaved] = useState(false);
  const [requestingHandoff, setRequestingHandoff] = useState(false);
  const [handoffDone, setHandoffDone] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: 'Здравствуйте! Я официальный AI-Консьерж DomExit. Отвечу на любые вопросы о безопасной покупке и продаже переуступок по 214-ФЗ, расчетах через эскроу/СБР и помогу сформировать ваш Buy-Box.',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }, [messages.length]);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputText).trim();
      if (!text || sending) return;

      setErrorMessage(null);
      setInputText('');
      setSending(true);

      const userMsgId = 'msg_' + Date.now();
      const userMsg: MessageItem = {
        id: userMsgId,
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await apiClient.aiLab.sendConciergeMessage({
          messageText: text,
          sessionId: sessionId || undefined,
          anonymousId,
        });

        if (res.ok) {
          if (!sessionId && res.sessionId) {
            setSessionId(res.sessionId);
          }
          if (res.remainingDailyQuota !== undefined) {
            setQuotaRemaining(res.remainingDailyQuota);
          }

          const assistantMsg: MessageItem = {
            id: 'asst_' + Date.now(),
            role: 'assistant',
            text: res.replyRu,
            citations: res.citations,
            matchedLots: res.matchedLots,
            suggestedBuyBox: res.suggestedBuyBox,
            createdAt: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Не удалось получить ответ. Попробуйте еще раз.');
      } finally {
        setSending(false);
      }
    },
    [inputText, sending, sessionId, anonymousId]
  );

  const handleApplyBuyBox = async () => {
    if (!sessionId || savingBuyBox) return;
    try {
      setSavingBuyBox(true);
      const res = await apiClient.aiLab.applyConciergeBuyBox(sessionId);
      if (res.ok) {
        setBuyBoxSaved(true);
      }
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('AUTH_REQUIRED')) {
        setErrorMessage('Для сохранения критериев Buy-Box войдите в личный кабинет на сайте.');
      } else {
        setErrorMessage(err.message || 'Ошибка сохранения Buy-Box');
      }
    } finally {
      setSavingBuyBox(false);
    }
  };

  const handleRequestHandoff = async () => {
    if (!sessionId || requestingHandoff) return;
    try {
      setRequestingHandoff(true);
      const res = await apiClient.aiLab.requestConciergeHandoff(sessionId, {
        contactNote: 'Вызов из веб-виджета AI-Консьержа',
      });
      if (res.ok) {
        setHandoffDone(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка вызова куратора');
    } finally {
      setRequestingHandoff(false);
    }
  };

  if (flagsLoading || !isEnabled) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center space-x-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 cursor-pointer border border-indigo-400/30"
          aria-label="Открыть AI-Консьерж DomExit"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-200 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse border-2 border-slate-900" />
          </div>
          <span className="text-xs font-bold tracking-wide">AI-Консьерж</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[380px] sm:w-[420px] h-[580px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h4 className="text-xs font-bold text-white">AI-Консьерж DomExit</h4>
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold border border-emerald-500/30">
                    152-ФЗ
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">RAG • YandexGPT • Суверенная база</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Свернуть"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-slate-50/60">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-2xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Citations Pill List */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 max-w-[88%]">
                    {msg.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-md text-[10px] font-medium transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[140px]">{c.title}</span>
                      </a>
                    ))}
                  </div>
                )}

                {/* Matched Lots Cards */}
                {msg.matchedLots && msg.matchedLots.length > 0 && (
                  <div className="mt-2 space-y-1.5 w-full max-w-[88%]">
                    {msg.matchedLots.map((lot, idx) => (
                      <a
                        key={idx}
                        href={`/opportunities/${lot.lotCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white rounded-xl border border-slate-200/80 hover:border-indigo-300 shadow-2xs flex items-center justify-between text-[11px] transition-all group"
                      >
                        <div className="flex items-center space-x-2">
                          <Building className="w-3.5 h-3.5 text-indigo-500" />
                          <div>
                            <span className="font-bold text-slate-800">Лот #{lot.lotCode}</span>
                            <span className="text-slate-400 ml-1.5 text-[10px]">{lot.district}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Suggested Buy-Box Card */}
                {msg.suggestedBuyBox && (
                  <div className="mt-2.5 p-3 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 rounded-2xl border border-emerald-200 text-xs text-slate-800 shadow-xs max-w-[92%] space-y-2">
                    <div className="flex items-center space-x-1.5 text-emerald-800 font-bold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Параметры для вашего Buy-Box:</span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      {msg.suggestedBuyBox.targetCity && (
                        <p>📍 Город: <span className="font-semibold text-slate-800">{msg.suggestedBuyBox.targetCity}</span></p>
                      )}
                      {msg.suggestedBuyBox.districts && msg.suggestedBuyBox.districts.length > 0 && (
                        <p>🏙️ Районы: <span className="font-semibold text-slate-800">{msg.suggestedBuyBox.districts.join(', ')}</span></p>
                      )}
                      {msg.suggestedBuyBox.maxBudgetRub && (
                        <p>💰 Бюджет: <span className="font-semibold text-slate-800">до {(msg.suggestedBuyBox.maxBudgetRub / 1000000).toFixed(1)} млн ₽</span></p>
                      )}
                    </div>

                    {!buyBoxSaved ? (
                      <button
                        type="button"
                        onClick={handleApplyBuyBox}
                        disabled={savingBuyBox}
                        className="w-full mt-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        {savingBuyBox ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>✓ Сохранить параметры в мой Buy-Box</span>
                      </button>
                    ) : (
                      <div className="p-1.5 bg-emerald-100/60 rounded-xl text-center text-emerald-800 font-bold text-[10px]">
                        ✓ Критерии успешно сохранены в ваш профиль!
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {sending && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>AI-Консьерж формирует ответ из базы...</span>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] flex items-start space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Handoff Confirmation */}
            {handoffDone && (
              <div className="p-2.5 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl text-[11px] text-center font-bold">
                ✓ Куратор уведомлен о вашем диалоге и свяжется с вами в течение 10 минут!
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starter Prompts */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 bg-white border-t border-slate-100 flex flex-wrap gap-1.5">
              {STARTER_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Bottom Bar: Human Handoff button & Message Input */}
          <div className="p-3 bg-white border-t border-slate-200/80 space-y-2">
            {!handoffDone && (
              <button
                type="button"
                onClick={handleRequestHandoff}
                disabled={requestingHandoff}
                className="w-full py-1 text-slate-500 hover:text-slate-800 text-[10px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-colors"
              >
                <UserCheck className="w-3 h-3 text-slate-400" />
                <span>Позвать живого куратора платформы</span>
              </button>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <input
                ref={inputRef}
                type="text"
                maxLength={600}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Задайте вопрос о переуступке ДДУ..."
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>

            {quotaRemaining !== null && (
              <p className="text-[9px] text-center text-slate-400">
                Осталось сообщений на сегодня: {quotaRemaining}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
