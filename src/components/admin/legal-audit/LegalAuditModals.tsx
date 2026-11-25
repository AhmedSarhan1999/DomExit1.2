import React from 'react';
import { X, UploadCloud, AlertCircle, Check } from 'lucide-react';
import { LegalAuditCheckpoint, Lot } from '../../../types';

interface InspectorModalProps {
  inspectingCheckpoint: LegalAuditCheckpoint | null;
  lot: Lot;
  editScore: number;
  setEditScore: (score: number) => void;
  editStatus: 'clean' | 'attention' | 'critical';
  setEditStatus: (status: 'clean' | 'attention' | 'critical') => void;
  editNotes: string;
  setEditNotes: (notes: string) => void;
  editProofName: string;
  editProofUrl?: string;
  editProofKey?: string;
  onOpenProofDoc?: (info: { proofDocKey?: string; proofDocUrl?: string; proofDocName?: string }) => void;
  isUploadingProof: boolean;
  onUploadProofFile: () => void;
  onClose: () => void;
  onSaveVerdict: (e: React.FormEvent) => void;
}

export const InspectorModal: React.FC<InspectorModalProps> = ({
  inspectingCheckpoint,
  editScore,
  setEditScore,
  editStatus,
  setEditStatus,
  editNotes,
  setEditNotes,
  editProofName,
  editProofUrl,
  editProofKey,
  onOpenProofDoc,
  isUploadingProof,
  onUploadProofFile,
  onClose,
  onSaveVerdict,
}) => {
  if (!inspectingCheckpoint) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
              Вес: {inspectingCheckpoint.weightPercent}%
            </span>
            <h3 className="text-lg font-black text-slate-900 mt-1">
              Инспекция: {inspectingCheckpoint.shortLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSaveVerdict} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Оценка надежности ({editScore}/10):
              </label>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={editScore}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setEditScore(v);
                  if (v >= 8) setEditStatus('clean');
                  else if (v >= 5) setEditStatus('attention');
                  else setEditStatus('critical');
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Статус заключения:</label>
              <select
                value={editStatus}
                onChange={(e) => {
                  const s = e.target.value as 'clean' | 'attention' | 'critical';
                  setEditStatus(s);
                  if (s === 'clean' && editScore < 8) setEditScore(10);
                  else if (s === 'attention' && (editScore < 5 || editScore > 7)) setEditScore(6);
                  else if (s === 'critical' && editScore >= 5) setEditScore(3);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              >
                <option value="clean">ЧИСТО (8-10 баллов)</option>
                <option value="attention">ВНИМАНИЕ (5-7 баллов)</option>
                <option value="critical">КРИТИЧЕСКИЙ РИСК (1-4 балла)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">Скан подтверждения:</label>
              {(editProofKey || editProofUrl) && (
                onOpenProofDoc ? (
                  <button
                    type="button"
                    onClick={() => onOpenProofDoc({ proofDocKey: editProofKey, proofDocUrl: editProofUrl, proofDocName: editProofName })}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Открыть скан ↗</span>
                  </button>
                ) : (
                  <a
                    href={editProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center space-x-1"
                  >
                    <span>Открыть скан ↗</span>
                  </a>
                )
              )}
            </div>
            <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-center justify-between">
              <span className="text-xs text-slate-700 truncate">{editProofName || 'Файл не выбран'}</span>
              <button
                type="button"
                disabled={isUploadingProof}
                onClick={onUploadProofFile}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isUploadingProof ? 'Загрузка...' : 'Выбрать'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Замечания юриста:</label>
            <textarea
              rows={3}
              required
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              Сохранить вердикт
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RequestDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDocsList: string[];
  setSelectedDocsList: React.Dispatch<React.SetStateAction<string[]>>;
  docsNotes: string;
  setDocsNotes: (n: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const RequestDocsModal: React.FC<RequestDocsModalProps> = ({
  isOpen,
  onClose,
  selectedDocsList,
  setSelectedDocsList,
  docsNotes,
  setDocsNotes,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-5">
        <h3 className="text-base font-bold text-slate-900">Запросить документы у продавца</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2 text-xs">
            {['Справка об отсутствии задолженности от застройщика', 'Справка из СФР об остатке маткапитала', 'Нотариальное согласие супруга(и)', 'Выписка ЕГРН'].map((d) => (
              <label key={d} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDocsList.includes(d)}
                  onChange={() => setSelectedDocsList((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                />
                <span>{d}</span>
              </label>
            ))}
          </div>
          <textarea
            rows={2}
            value={docsNotes}
            onChange={(e) => setDocsNotes(e.target.value)}
            placeholder="Комментарий для продавца..."
            className="w-full p-3 rounded-xl border border-slate-200 text-xs"
          />
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
            >
              Отправить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  rejectionReason: string;
  setRejectionReason: (r: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const RejectModal: React.FC<RejectModalProps> = ({
  isOpen,
  onClose,
  rejectionReason,
  setRejectionReason,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-5">
        <div className="flex items-center space-x-2 text-rose-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="text-base font-bold text-slate-900">Отклонение объекта</h3>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <textarea
            rows={3}
            required
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Причина отклонения..."
            className="w-full p-3 rounded-xl border border-slate-200 text-xs"
          />
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
            >
              Отклонить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface LegalAuditModalsContainerProps {
  inspectingCheckpoint: LegalAuditCheckpoint | null;
  lot: Lot | null;
  editScore: number;
  setEditScore: (score: number) => void;
  editStatus: 'clean' | 'attention' | 'critical';
  setEditStatus: (status: 'clean' | 'attention' | 'critical') => void;
  editNotes: string;
  setEditNotes: (notes: string) => void;
  editProofName: string;
  editProofUrl?: string;
  editProofKey?: string;
  onOpenProofDoc?: (info: { proofDocKey?: string; proofDocUrl?: string; proofDocName?: string }) => void;
  isUploadingProof: boolean;
  onUploadProofFile: () => void;
  onCloseInspector: () => void;
  onSaveInspectorVerdict: (e: React.FormEvent) => void;
  isRequestDocsModalOpen: boolean;
  onCloseRequestDocs: () => void;
  selectedDocsList: string[];
  setSelectedDocsList: React.Dispatch<React.SetStateAction<string[]>>;
  docsNotes: string;
  setDocsNotes: (n: string) => void;
  onSubmitRequestDocs: (e: React.FormEvent) => void;
  isRejectModalOpen: boolean;
  onCloseReject: () => void;
  rejectionReason: string;
  setRejectionReason: (r: string) => void;
  onSubmitReject: (e: React.FormEvent) => void;
}

export const LegalAuditModalsContainer: React.FC<LegalAuditModalsContainerProps> = ({
  inspectingCheckpoint,
  lot,
  editScore,
  setEditScore,
  editStatus,
  setEditStatus,
  editNotes,
  setEditNotes,
  editProofName,
  editProofUrl,
  editProofKey,
  onOpenProofDoc,
  isUploadingProof,
  onUploadProofFile,
  onCloseInspector,
  onSaveInspectorVerdict,
  isRequestDocsModalOpen,
  onCloseRequestDocs,
  selectedDocsList,
  setSelectedDocsList,
  docsNotes,
  setDocsNotes,
  onSubmitRequestDocs,
  isRejectModalOpen,
  onCloseReject,
  rejectionReason,
  setRejectionReason,
  onSubmitReject,
}) => {
  return (
    <>
      {inspectingCheckpoint && lot && (
        <InspectorModal
          inspectingCheckpoint={inspectingCheckpoint}
          lot={lot}
          editScore={editScore}
          setEditScore={setEditScore}
          editStatus={editStatus}
          setEditStatus={setEditStatus}
          editNotes={editNotes}
          setEditNotes={setEditNotes}
          editProofName={editProofName}
          editProofUrl={editProofUrl}
          editProofKey={editProofKey}
          onOpenProofDoc={onOpenProofDoc}
          isUploadingProof={isUploadingProof}
          onUploadProofFile={onUploadProofFile}
          onClose={onCloseInspector}
          onSaveVerdict={onSaveInspectorVerdict}
        />
      )}

      <RequestDocsModal
        isOpen={isRequestDocsModalOpen}
        onClose={onCloseRequestDocs}
        selectedDocsList={selectedDocsList}
        setSelectedDocsList={setSelectedDocsList}
        docsNotes={docsNotes}
        setDocsNotes={setDocsNotes}
        onSubmit={onSubmitRequestDocs}
      />

      <RejectModal
        isOpen={isRejectModalOpen}
        onClose={onCloseReject}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        onSubmit={onSubmitReject}
      />
    </>
  );
};
