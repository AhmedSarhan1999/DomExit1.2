import React, { useState } from 'react';
import { MessageSquare, ListTodo, CheckCircle2, Clock, Plus, Send } from 'lucide-react';
import { DealTrack, DealActionItem } from '../../types';
import { CuratorChatWidget } from '../chat/CuratorChatWidget';
import { apiClient } from '../../services/apiClient';

interface ClosingCommsAndTasksPanelProps {
  deal: DealTrack;
  curatorName: string;
  onDealUpdated: (updated: DealTrack) => void;
  onNotify: (msg: string) => void;
}

const SELLER_PRESETS: Array<{
  title: string;
  kind: DealActionItem['kind'];
  pepDocumentType?: DealActionItem['pepDocumentType'];
}> = [
  { title: 'Загрузить нотариальное согласие супруга(и)', kind: 'upload_doc' },
  { title: 'Подтвердить реквизиты счета для СБР', kind: 'confirm' },
  {
    title: 'Подписать согласие ПЭП',
    kind: 'sign_pep',
    pepDocumentType: 'seller_exclusive_consent',
  },
];

const BUYER_PRESETS: Array<{
  title: string;
  kind: DealActionItem['kind'];
  pepDocumentType?: DealActionItem['pepDocumentType'];
}> = [
  {
    title: 'Подписать NDA и Оферту 2.5% (ПЭП)',
    kind: 'sign_pep',
    pepDocumentType: 'buyer_reservation_terms',
  },
  { title: 'Загрузить квитанцию открытия аккредитива / СБР', kind: 'upload_doc' },
  { title: 'Подтвердить дату подписания в банке', kind: 'confirm' },
];

export const ClosingCommsAndTasksPanel: React.FC<ClosingCommsAndTasksPanelProps> = ({
  deal,
  curatorName,
  onDealUpdated,
  onNotify,
}) => {
  const [tab, setTab] = useState<'seller_chat' | 'buyer_chat' | 'tasks'>('tasks');
  const [assignee, setAssignee] = useState<'seller' | 'buyer'>('buyer');
  const [customTitle, setCustomTitle] = useState('');
  const [customKind, setCustomKind] = useState<DealActionItem['kind']>('upload_doc');
  const [busy, setBusy] = useState(false);

  const actionItems = deal.actionItems || [];

  const handleCreateTask = async (
    title: string,
    targetAssignee: 'seller' | 'buyer',
    kind: DealActionItem['kind'],
    pepDocumentType?: DealActionItem['pepDocumentType']
  ) => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await apiClient.matching.createDealTask(deal.dealId, {
        title: title.trim(),
        assignee: targetAssignee,
        kind,
        pepDocumentType,
      });
      if (res?.ok && res.deal) {
        onDealUpdated(res.deal);
        setCustomTitle('');
        onNotify(`Задача «${title}» отправлена (${targetAssignee === 'seller' ? 'продавцу' : 'покупателю'}) и продублирована в Telegram.`);
      }
    } catch (err: any) {
      onNotify(`Ошибка создания задачи: ${err?.message || 'Сбой'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    setBusy(true);
    try {
      const res = await apiClient.matching.approveDealTask(deal.dealId, taskId);
      if (res?.ok && res.deal) {
        onDealUpdated(res.deal);
        onNotify('Задача отмечена как «Выполнено ✓».');
      }
    } catch (err: any) {
      onNotify(`Ошибка подтверждения: ${err?.message || 'Сбой'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-black text-slate-900">
            Коммуникации (152-ФЗ изоляция) и Центр задач сделки
          </h3>
          <p className="text-xs text-slate-500">
            Чаты продавца и покупателя строго изолированы друг от друга и синхронизированы с Telegram.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setTab('seller_chat')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
              tab === 'seller_chat' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>Чат с продавцом</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('buyer_chat')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
              tab === 'buyer_chat' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Чат с покупателем</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
              tab === 'tasks' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Задачи и запросы сторонам ({actionItems.length})</span>
          </button>
        </div>
      </div>

      {tab === 'seller_chat' && (
        <div className="h-[440px]">
          <CuratorChatWidget
            embedded
            isOpen
            onClose={() => {}}
            lotCode={deal.lotCode}
            dealId={deal.dealId}
            lotTitle={deal.lotTitle}
            curatorName={curatorName}
            threadChannel="seller_curator"
          />
        </div>
      )}

      {tab === 'buyer_chat' && (
        <div className="h-[440px]">
          <CuratorChatWidget
            embedded
            isOpen
            onClose={() => {}}
            lotCode={deal.lotCode}
            dealId={deal.dealId}
            lotTitle={deal.lotTitle}
            curatorName={curatorName}
            threadChannel="buyer_curator"
          />
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-5">
          {/* Quick Presets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2.5">
              <div className="text-xs font-black text-amber-950">Быстрые задачи продавцу:</div>
              <div className="flex flex-wrap gap-1.5">
                {SELLER_PRESETS.map((p) => (
                  <button
                    key={p.title}
                    type="button"
                    disabled={busy}
                    onClick={() => handleCreateTask(p.title, 'seller', p.kind, p.pepDocumentType)}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{p.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
              <div className="text-xs font-black text-emerald-950">Быстрые задачи покупателю:</div>
              <div className="flex flex-wrap gap-1.5">
                {BUYER_PRESETS.map((p) => (
                  <button
                    key={p.title}
                    type="button"
                    disabled={busy}
                    onClick={() => handleCreateTask(p.title, 'buyer', p.kind, p.pepDocumentType)}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-950 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{p.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom task creator */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value as 'seller' | 'buyer')}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="buyer">Покупателю</option>
              <option value="seller">Продавцу</option>
            </select>
            <select
              value={customKind}
              onChange={(e) => setCustomKind(e.target.value as DealActionItem['kind'])}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="upload_doc">Загрузка файла в S3</option>
              <option value="confirm">Подтверждение</option>
              <option value="sign_pep">Подпись ПЭП 63-ФЗ</option>
            </select>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Текст персональной задачи стороне сделки..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
            <button
              type="button"
              disabled={busy || !customTitle.trim()}
              onClick={() => handleCreateTask(customTitle, assignee, customKind)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-black flex items-center space-x-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Отправить</span>
            </button>
          </div>

          {/* Existing tasks list */}
          {actionItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              Активных задач пока нет. Нажмите на шаблон выше, чтобы отправить запрос продавцу или покупателю.
            </div>
          ) : (
            <div className="space-y-2.5">
              {actionItems.map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          task.assignee === 'seller'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-indigo-100 text-indigo-900'
                        }`}
                      >
                        {task.assignee === 'seller' ? 'Продавец' : 'Покупатель'}
                      </span>
                      <span className="font-bold text-slate-900">{task.title}</span>
                    </div>
                    {task.uploadedDocName && (
                      <div className="text-[11px] text-emerald-700 font-mono">
                        📎 Файл в S3: {task.uploadedDocName} ({task.uploadedDocKey})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'pending' && (
                      <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Ожидает клиента</span>
                      </span>
                    )}
                    {task.status === 'submitted' && (
                      <>
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                          На проверке у куратора
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleApproveTask(task.id)}
                          className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] cursor-pointer"
                        >
                          Принять ✓
                        </button>
                      </>
                    )}
                    {task.status === 'approved' && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-black text-[10px] flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Выполнено ✓</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
