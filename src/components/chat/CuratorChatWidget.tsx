import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { CuratorChatRepository } from '../../dal/repositories/CuratorChatRepository';
import { CuratorMessage } from '../../types';
import {
  Send,
  X,
  ShieldCheck,
  MessageSquare,
  Phone,
  Paperclip,
  Check,
  CheckCheck,
  User,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';

interface CuratorChatWidgetProps {
  lotCode?: string;
  dealId?: string;
  lotTitle?: string;
  curatorId?: string;
  curatorName?: string;
  curatorRole?: string;
  curatorPhone?: string;
  curatorTelegram?: string;
  curatorMax?: string;
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export const CuratorChatWidget: React.FC<CuratorChatWidgetProps> = ({
  lotCode = '',
  dealId,
  lotTitle = 'Объект DomExit',
  curatorId,
  curatorName = 'Юридический куратор DomExit',
  curatorRole = 'Персональный куратор сделки',
  curatorPhone,
  curatorTelegram = 'domexit_official',
  curatorMax,
  isOpen,
  onClose,
  embedded = false,
}) => {
  const { user, openAuthModal } = useAuth();
  const { language } = useLanguage();

  const [messages, setMessages] = useState<CuratorMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cleanLotCode = (lotCode || '').trim().toUpperCase();
  const cleanDealId = (dealId || '').trim().toUpperCase();

  const loadMessages = async () => {
    if (!cleanLotCode && !cleanDealId) return;
    const msgs = await CuratorChatRepository.getMessages(cleanLotCode, cleanDealId);
    setMessages(msgs);

    // Auto mark as read messages sent to current role
    if (user) {
      const isStaff = user.role === 'employee' || user.role === 'owner' || user.role === 'admin';
      const unreadIds = msgs
        .filter((m) => {
          if (m.isRead) return false;
          if (isStaff && (m.senderRole === 'buyer' || m.senderRole === 'seller')) return true;
          if (!isStaff && (m.senderRole === 'employee' || m.senderRole === 'owner')) return true;
          return false;
        })
        .map((m) => m.id);

      if (unreadIds.length > 0) {
        await CuratorChatRepository.markAsRead(unreadIds);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadMessages();
    const unsub = CuratorChatRepository.subscribe(() => {
      loadMessages();
    });
    return () => unsub();
  }, [cleanLotCode, cleanDealId, isOpen, user]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const currentRole: 'buyer' | 'seller' | 'employee' | 'owner' =
    user?.role === 'owner' || user?.activeRole === 'owner'
      ? 'owner'
      : user?.role === 'employee' || user?.activeRole === 'employee'
      ? 'employee'
      : user?.role === 'seller' || user?.activeRole === 'seller'
      ? 'seller'
      : 'buyer';

  const senderDisplayName =
    user?.name ||
    (currentRole === 'employee'
      ? curatorName
      : currentRole === 'owner'
      ? 'Руководство платформы'
      : currentRole === 'seller'
      ? 'Продавец'
      : 'Покупатель');

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || isSending || !user) return;

    try {
      setIsSending(true);
      await CuratorChatRepository.sendMessage({
        dealId: cleanDealId || undefined,
        lotId: cleanLotCode,
        lotCode: cleanLotCode,
        senderId: user.id,
        senderName: senderDisplayName,
        senderRole: currentRole,
        curatorId: curatorId,
        text,
      });

      setInputText('');
      await loadMessages();
    } catch (err) {
      console.error('Failed to send curator message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const content = (
    <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
      {/* Top Curator Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between shrink-0 relative">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-black flex items-center justify-center text-sm shadow-xs shrink-0">
              {curatorName.slice(0, 2).toUpperCase()}
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                Чат с куратором
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <h4 className="font-extrabold text-sm sm:text-base text-white truncate">{curatorName}</h4>
            <span className="text-[11px] text-slate-300 truncate block">
              {curatorRole} {cleanLotCode ? `• Лот #${cleanLotCode}` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {curatorPhone && (
            <a
              href={`tel:${curatorPhone.replace(/[^\d+]/g, '')}`}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={`Позвонить: ${curatorPhone}`}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          {curatorTelegram && (
            <a
              href={
                curatorTelegram.startsWith('http')
                  ? curatorTelegram
                  : `https://t.me/${curatorTelegram.replace('@', '')}`
              }
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-sky-300 transition-colors"
              title="Открыть Telegram"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 bg-slate-50 min-h-[260px] max-h-[460px]">
        {/* Welcome message from Curator */}
        <div className="flex items-start space-x-2.5 max-w-[85%]">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0">
            {curatorName.slice(0, 1)}
          </div>
          <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs border border-slate-200 shadow-2xs space-y-1 text-xs">
            <div className="flex items-center justify-between space-x-2 text-[10px] text-slate-400">
              <span className="font-bold text-slate-800">{curatorName}</span>
              <span>Платформа</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              Здравствуйте! Я ваш персональный юридический куратор по объекту{' '}
              <strong>{lotTitle}</strong> {cleanLotCode ? `(Лот #${cleanLotCode})` : ''}. Отвечу на
              любые вопросы по проверке ДДУ, эскроу-счету или согласованию сделки.
            </p>
          </div>
        </div>

        {messages.map((m) => {
          const isMine = user && m.senderId === user.id;
          const isCurator = m.senderRole === 'employee' || m.senderRole === 'owner';

          return (
            <div
              key={m.id}
              className={`flex items-start space-x-2.5 ${
                isMine ? 'justify-end' : 'justify-start max-w-[85%]'
              }`}
            >
              {!isMine && (
                <div
                  className={`w-8 h-8 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                    isCurator ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {m.senderName.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div
                className={`p-3.5 rounded-2xl text-xs space-y-1 shadow-2xs ${
                  isMine
                    ? 'bg-emerald-600 text-white rounded-tr-xs ml-auto max-w-[85%]'
                    : isCurator
                    ? 'bg-white text-slate-800 rounded-tl-xs border border-slate-200'
                    : 'bg-white text-slate-800 rounded-tl-xs border border-indigo-200'
                }`}
              >
                <div
                  className={`flex items-center justify-between space-x-2 text-[10px] ${
                    isMine ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="font-bold truncate">{m.senderName}</span>
                    {(m as any).source === 'telegram' && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-semibold bg-sky-500/20 text-sky-300">
                        <Send className="w-2 h-2" />
                        <span>TG</span>
                      </span>
                    )}
                  </div>
                  <span>{new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                {isMine && (
                  <div className="flex justify-end pt-0.5 text-emerald-200">
                    {m.isRead ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input or Guest Login Prompt */}
      {user ? (
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center space-x-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Напишите сообщение куратору..."
            disabled={isSending}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{isSending ? '...' : 'Отправить'}</span>
          </button>
        </form>
      ) : (
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center space-y-2 shrink-0">
          <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-600 font-medium">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Войдите или зарегистрируйтесь, чтобы написать персональному куратору</span>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('Войдите для прямой связи с персональным куратором')}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
          >
            Войти в аккаунт
          </button>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg h-[580px] max-h-[92vh] flex flex-col">{content}</div>
    </div>
  );
};
