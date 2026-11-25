import React, { useState } from 'react';
import { CheckCircle2, Clock, Upload, FileSignature, Check } from 'lucide-react';
import { DealActionItem, DealTrack } from '../../types';
import { StorageService } from '../../dal/StorageService';
import { apiClient } from '../../services/apiClient';

interface DealActionItemsCardProps {
  deal: DealTrack | null | undefined;
  assignee: 'seller' | 'buyer';
  userId?: string;
  clientCode?: string;
  onTaskUpdated?: () => Promise<void> | void;
  onOpenPep?: (docType: 'nda_viewing_act' | 'buyer_reservation_terms' | 'seller_exclusive_consent', lotCode: string) => void;
}

export const DealActionItemsCard: React.FC<DealActionItemsCardProps> = ({
  deal,
  assignee,
  userId,
  clientCode,
  onTaskUpdated,
  onOpenPep,
}) => {
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  if (!deal) return null;
  const tasks = (deal.actionItems || []).filter((t) => t.assignee === assignee);
  if (tasks.length === 0) return null;

  const handleUploadAndSubmit = async (task: DealActionItem, file: File) => {
    setBusyTaskId(task.id);
    try {
      const uploaded = await StorageService.uploadDocument({
        file,
        category: 'additional',
        categoryLabelRu: task.title,
        entityType: 'deal',
        entityId: deal.dealId,
        uploadedByUid: userId || 'usr-client',
        clientCode: clientCode || 'DEX-CLIENT',
      });
      await apiClient.matching.submitDealTask(deal.dealId, task.id, {
        uploadedDocKey: uploaded.objectKey,
        uploadedDocName: uploaded.name,
      });
      await onTaskUpdated?.();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleConfirm = async (task: DealActionItem) => {
    setBusyTaskId(task.id);
    try {
      await apiClient.matching.submitDealTask(deal.dealId, task.id, {
        note: 'Подтверждено клиентом в Личном кабинете',
      });
      await onTaskUpdated?.();
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5 text-xs">
      <div className="font-black text-indigo-950 uppercase tracking-wider text-[11px]">
        Задачи от куратора по сделке #{deal.lotCode} ({tasks.length})
      </div>
      <div className="space-y-2">
        {tasks.map((task) => {
          const isBusy = busyTaskId === task.id;
          return (
            <div
              key={task.id}
              className="p-3 rounded-xl bg-white border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900">{task.title}</div>
                {task.uploadedDocName && (
                  <div className="text-[11px] text-emerald-700 font-mono">
                    📎 Загружено в S3: {task.uploadedDocName}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {task.status === 'pending' ? (
                  task.kind === 'upload_doc' ? (
                    <label className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center space-x-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Загрузка...' : 'Загрузить файл'}</span>
                      <input
                        type="file"
                        className="hidden"
                        disabled={isBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadAndSubmit(task, f);
                        }}
                      />
                    </label>
                  ) : task.kind === 'sign_pep' && onOpenPep ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPep(
                            task.pepDocumentType ||
                              (assignee === 'seller' ? 'seller_exclusive_consent' : 'buyer_reservation_terms'),
                            deal.lotCode
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                        <span>Подписать ПЭП</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleConfirm(task)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Готово
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleConfirm(task)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Отправка...' : 'Подтвердить'}</span>
                    </button>
                  )
                ) : task.status === 'submitted' ? (
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>На проверке у куратора</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-black text-[10px] flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Выполнено ✓</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
