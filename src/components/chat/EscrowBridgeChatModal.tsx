import React, { useState, useEffect, useRef } from 'react';
import { EscrowChatMessage } from '../../types';
import { EscrowBridgeRepository } from '../../dal/repositories/EscrowBridgeRepository';
import { StorageService } from '../../dal/StorageService';
import { FileManager } from '../../utils/fileManager';
import {
  ShieldCheck,
  X,
  Send,
  Paperclip,
  Lock,
  Building2,
  User,
  CheckCheck,
  Download,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';

interface EscrowBridgeChatModalProps {
  dealId: string;
  dealStage?: string; // 'curator_review' | 'bank_escrow_deposit' | 'signing_photos' | 'bank_funds_release' | 'deal_finalized'
  lotCode?: string;
  lotTitle?: string;
  bankName?: string;
  buyerName?: string;
  isOpen: boolean;
  onClose: () => void;
  currentRole: 'buyer' | 'bank_officer' | 'curator';
  currentUserName?: string;
}

export const EscrowBridgeChatModal: React.FC<EscrowBridgeChatModalProps> = ({
  dealId,
  dealStage = 'bank_escrow_deposit',
  lotCode = 'U-10566',
  lotTitle = 'ЖК Чистое Небо',
  bankName = 'Сбербанк',
  buyerName = 'Покупатель DomExit',
  isOpen,
  onClose,
  currentRole,
  currentUserName,
}) => {
  const [messages, setMessages] = useState<EscrowChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cleanDealId = (dealId || 'DEAL-2025-10566').trim().toUpperCase();

  // Lifecycle constraint: editable only during Steps 1 & 2 ('curator_review', 'bank_escrow_deposit')
  const isReadOnly =
    dealStage === 'signing_photos' ||
    dealStage === 'bank_funds_release' ||
    dealStage === 'deal_finalized' ||
    dealStage === 'deal_cancelled';

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = EscrowBridgeRepository.subscribeToDealChat(cleanDealId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [cleanDealId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const senderDisplayName =
    currentUserName ||
    (currentRole === 'bank_officer'
      ? `Сотрудник ${bankName}`
      : currentRole === 'buyer'
      ? buyerName
      : 'Куратор DomExit');

  const handleSendMessage = async (textToSend?: string, attachment?: { url: string; name: string; type: any }) => {
    const text = (textToSend || inputText).trim();
    if (!text && !attachment) return;
    if (isReadOnly) return;

    try {
      setIsSending(true);
      await EscrowBridgeRepository.sendMessage(cleanDealId, {
        dealId: cleanDealId,
        senderRole: currentRole,
        senderName: senderDisplayName,
        text,
        attachmentUrl: attachment?.url,
        attachmentName: attachment?.name,
        attachmentType: attachment?.type,
      });
      setInputText('');
    } catch (err: any) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachDocument = async () => {
    if (isReadOnly) return;
    try {
      setIsUploading(true);
      const selected = await FileManager.selectAndReadFile('other', '.pdf,.jpg,.jpeg,.png');
      if (selected && selected.file) {
        const meta = await StorageService.uploadDocument({
          file: selected.file,
          category: 'buyer_cash_statement',
          categoryLabelRu: `Платежное поручение / Квитанция по эскроу (#${lotCode})`,
          entityType: 'deal',
          entityId: cleanDealId,
          uploadedByUid: 'user-escrow-bridge',
          clientCode: 'DEX-ESCROW',
        });

        await handleSendMessage(
          currentRole === 'buyer'
            ? `Прикреплено платежное поручение о депонировании средств на эскроу-счет: ${meta.name}`
            : `Прикреплен официальный банковский документ: ${meta.name}`,
          {
            url: meta.cloudUrl || '',
            name: meta.name,
            type: currentRole === 'buyer' ? 'wire_receipt' : 'requisites',
          }
        );

        setNotice('✓ Документ успешно загружен в защищенное хранилище и отправлен в чат!');
        setTimeout(() => setNotice(null), 4000);
      }
    } catch (err) {
      console.warn('Document attachment aborted:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const insertTemplate = (templateType: 'requisites' | 'instructions' | 'receipt_request') => {
    if (isReadOnly) return;
    if (templateType === 'requisites') {
      setInputText(
        `Реквизиты спецсчета эскроу (214-ФЗ):\nБанк: ${bankName}\nСчет эскроу: 40817810${Math.floor(
          100000000000 + Math.random() * 900000000000
        )}\nБИК: 044525225\nКорр. счет: 30101810400000000225\nНазначение: Депонирование по договору цессии (Лот #${lotCode})`
      );
    } else if (templateType === 'instructions') {
      setInputText(
        `Уважаемый покупатель! Просим осуществить межбанковский перевод суммы депозита в течение 48 часов с указанием точного назначения платежа. После отправки прикрепите скан платежного поручения с отметкой банка.`
      );
    } else if (templateType === 'receipt_request') {
      setInputText(
        `Напоминаем о необходимости загрузки платежного поручения или квитанции об исполнении перевода для фиксации депозита в банковском шлюзе.`
      );
    }
  };

  const getBankColorBadge = (bank: string) => {
    if (bank.includes('Сбер')) return 'bg-emerald-600 text-white border-emerald-500';
    if (bank.includes('ВТБ')) return 'bg-blue-600 text-white border-blue-500';
    if (bank.includes('Альфа')) return 'bg-red-600 text-white border-red-500';
    return 'bg-purple-600 text-white border-purple-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full h-[90vh] flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getBankColorBadge(bankName)}`}>
                  {bankName}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {cleanDealId}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">•</span>
                <span className="text-xs text-slate-300 font-semibold hidden sm:inline">
                  {lotTitle} (#{lotCode})
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center space-x-1.5 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Защищенный координационный шлюз эскроу (214-ФЗ)</span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & State Notice Banner */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-1.5 font-mono">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Канал зашифрован (152-ФЗ / ГОСТ Р 34.12) • Доступ: Банк ↔ Покупатель ↔ Куратор</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Этап сделки:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isReadOnly
                ? 'bg-slate-200 text-slate-700'
                : 'bg-emerald-100 text-emerald-800 animate-pulse'
            }`}>
              {isReadOnly ? 'Архив (Депозит внесен)' : 'Активен (Внесение депозита)'}
            </span>
          </div>
        </div>

        {/* Read-Only Warning if Lifecycle has advanced past deposit */}
        {isReadOnly && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center space-x-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Архив только для чтения:</strong> Банк зафиксировал поступление средств на специальный счет эскроу. Сделка переведена на этап нотариата, подписания актов и раскрытия средств.
            </span>
          </div>
        )}

        {notice && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-900 font-semibold shrink-0 animate-fade-in">
            {notice}
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Building2 className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold">История сообщений пуста</p>
              <p className="text-[11px]">Отправьте первое сообщение или реквизиты эскроу-счета.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine =
                (currentRole === 'bank_officer' && msg.senderRole === 'bank_officer') ||
                (currentRole === 'buyer' && msg.senderRole === 'buyer') ||
                (currentRole === 'curator' && msg.senderRole === 'curator');

              if (msg.isEncryptedNotice || msg.senderRole === 'curator') {
                return (
                  <div key={msg.id} className="flex justify-center my-3">
                    <div className="max-w-md bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-2 text-center text-xs text-indigo-900 shadow-xs">
                      <div className="flex items-center justify-center space-x-1.5 font-bold text-[11px] text-indigo-700 mb-0.5">
                        <Lock className="w-3 h-3" />
                        <span>Системное уведомление</span>
                      </div>
                      <p className="leading-relaxed">{msg.text}</p>
                      <span className="text-[10px] text-indigo-400 block mt-1 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 mb-1 px-1">
                    <span className="font-bold text-slate-800">{msg.senderName}</span>
                    <span>•</span>
                    <span className="font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl shadow-xs whitespace-pre-line text-xs leading-relaxed ${
                      isMine
                        ? 'bg-slate-900 text-white rounded-br-xs'
                        : msg.senderRole === 'bank_officer'
                        ? 'bg-white border-2 border-emerald-300 text-slate-900 rounded-bl-xs'
                        : 'bg-white border border-slate-200 text-slate-900 rounded-bl-xs'
                    }`}
                  >
                    {msg.text}

                    {/* Attached File Download Card */}
                    {msg.attachmentName && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/40">
                        <div className={`p-2.5 rounded-xl flex items-center justify-between gap-2 ${
                          isMine ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                        }`}>
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-[11px] font-bold truncate">{msg.attachmentName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (msg.attachmentUrl) {
                                FileManager.downloadFile(msg.attachmentUrl, msg.attachmentName || 'document.pdf');
                              } else {
                                alert(`Файл ${msg.attachmentName} сохранен в защищенном облачном сейфе S3.`);
                              }
                            }}
                            className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shrink-0"
                            title="Скачать файл"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bank Quick Templates Toolbar (Only for Bank Officer when not read-only) */}
        {!isReadOnly && currentRole === 'bank_officer' && (
          <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Шаблоны банка:</span>
            </span>
            <button
              type="button"
              onClick={() => insertTemplate('requisites')}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-[11px] font-semibold border border-slate-300 transition-colors cursor-pointer"
            >
              + Реквизиты спецсчета
            </button>
            <button
              type="button"
              onClick={() => insertTemplate('instructions')}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-[11px] font-semibold border border-slate-300 transition-colors cursor-pointer"
            >
              + Инструкция по переводу
            </button>
            <button
              type="button"
              onClick={() => insertTemplate('receipt_request')}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-[11px] font-semibold border border-slate-300 transition-colors cursor-pointer"
            >
              + Запрос платежки
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <button
              type="button"
              disabled={isReadOnly || isUploading}
              onClick={handleAttachDocument}
              title={currentRole === 'buyer' ? 'Прикрепить платежное поручение' : 'Прикрепить файл'}
              className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              disabled={isReadOnly || isSending}
              placeholder={
                isReadOnly
                  ? 'Чат переведен в архив только для чтения'
                  : currentRole === 'buyer'
                  ? 'Введите сообщение банку или прикрепите платежное поручение...'
                  : 'Введите сообщение покупателю...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
            />

            <button
              type="submit"
              disabled={isReadOnly || isSending || !inputText.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
            >
              <span>Отправить</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
