import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { StorageService } from '../dal/StorageService';
import {
  Lot,
  LegalAuditCheckpoint,
  LegalAuditAxis,
  LegalAuditAxisStatus,
  LegalRadarCheckItem,
  SecondaryRiskChecklist,
} from '../types';
import { DEFAULT_LEGAL_AUDIT_AXES, HONEST_STATUS_CONFIG } from '../data/legalAuditAxes';
import { INITIAL_CHECKPOINTS } from '../components/admin/legal-audit/legalAuditConstants';
import { formatRubles } from '../utils/formatters';
import { FileManager } from '../utils/fileManager';
import { useFeatureFlagsStore } from '../stores/useFeatureFlagsStore';
import { LegalRadarPanel } from '../components/admin/legal-audit/LegalRadarPanel';
import { LegalAuditAxesSection } from '../components/admin/legal-audit/LegalAuditAxesSection';
import { LegalCheckpointsMatrix } from '../components/admin/legal-audit/LegalCheckpointsMatrix';
import { LegalAuditHeaderCard } from '../components/admin/legal-audit/LegalAuditHeaderCard';
import { LegalMemoGenerator } from '../components/admin/legal-audit/LegalMemoGenerator';
import { LegalOperationsLog } from '../components/admin/legal-audit/LegalOperationsLog';
import { LegalDecisionBar } from '../components/admin/legal-audit/LegalDecisionBar';
import { LegalAuditModalsContainer } from '../components/admin/legal-audit/LegalAuditModals';
import { CheckCircle2, FileText, HardDrive } from 'lucide-react';

export const AdminLegalAuditPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [accessibleLots, setAccessibleLots] = useState<Lot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);

  // Axes and Checkpoints State
  const [axes, setAxes] = useState<LegalAuditAxis[]>(DEFAULT_LEGAL_AUDIT_AXES);
  const [checkpoints, setCheckpoints] = useState<LegalAuditCheckpoint[]>(INITIAL_CHECKPOINTS);
  const [inspectingCheckpoint, setInspectingCheckpoint] = useState<LegalAuditCheckpoint | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);

  // Inspector Form State
  const [editScore, setEditScore] = useState<number>(10);
  const [editStatus, setEditStatus] = useState<'clean' | 'attention' | 'critical'>('clean');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editProofName, setEditProofName] = useState<string>('');

  // Modals State
  const [isRequestDocsModalOpen, setIsRequestDocsModalOpen] = useState(false);
  const [selectedDocsList, setSelectedDocsList] = useState<string[]>([
    'Справка об отсутствии задолженности от застройщика',
    'Справка из СФР об остатке материнского капитала',
  ]);
  const [docsNotes, setDocsNotes] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { enableBankPortal } = useFeatureFlagsStore();
  const [isSpecialBankModalOpen, setIsSpecialBankModalOpen] = useState(false);
  const [bankSpecialReason, setBankSpecialReason] = useState(
    'Нетиповой график рассрочки застройщика. Требуется индивидуальная кредитная аккредитация эскроу.'
  );
  const [selectedBank, setSelectedBank] = useState('Сбербанк');

  const isOwner = user?.role === 'owner' || user?.activeRole === 'owner';
  const isEmployee = user?.activeRole === 'employee' && !isOwner;
  const currentEmployeeId = user?.assignedEmployeeId || (isEmployee ? user?.id || '' : '');
  const curatorName =
    user?.name || (isEmployee ? 'Куратор DomExit (Юрист)' : 'Руководство платформы DomExit');

  const loadLotData = async () => {
    let pool = isEmployee
      ? await LotsRepository.getByAssignedEmployee(currentEmployeeId)
      : await LotsRepository.getAll({ includePendingApproval: true });

    const code = (lotId || '').toUpperCase();
    let found: Lot | null = code
      ? pool.find((l) => l.lotCode.toUpperCase() === code || l.id.toUpperCase() === code) || null
      : pool[0] || null;

    if (!found && code) {
      found = await LotsRepository.getByCode(code);
      if (found && !pool.some((p) => p.lotCode.toUpperCase() === found!.lotCode.toUpperCase())) {
        pool = [found, ...pool];
      }
    }

    const seenPoolCodes = new Set<string>();
    pool = pool.filter((l) => {
      const c = (l.lotCode || l.id || '').toUpperCase();
      if (!c || seenPoolCodes.has(c)) return false;
      seenPoolCodes.add(c);
      return true;
    });

    setAccessibleLots(pool);

    if (found) {
      setLot(found);
      setAxes(found.legalAuditAxes && found.legalAuditAxes.length >= 4 ? found.legalAuditAxes : DEFAULT_LEGAL_AUDIT_AXES);
      setCheckpoints(found.legalAuditCheckpoints && found.legalAuditCheckpoints.length === 4 ? found.legalAuditCheckpoints : INITIAL_CHECKPOINTS);
    } else {
      setLot(null);
    }
  };

  useEffect(() => {
    loadLotData();
  }, [lotId, isEmployee, currentEmployeeId]);

  const weightedIndex = Math.min(
    100,
    Math.max(0, Math.round(checkpoints.reduce((sum, cp) => sum + ((cp.score || 0) / 10) * cp.weightPercent, 0)))
  );

  const currentLotCode = lot?.lotCode || '';
  const sellerInn = lot?.sellerInn || '—';
  const sellerFullName = lot?.ownerDossier?.fullNameMasked || 'Правообладатель';

  const handleOpenInspector = (cp: LegalAuditCheckpoint) => {
    setInspectingCheckpoint(cp);
    setEditScore(cp.score);
    setEditStatus(cp.status);
    setEditNotes(cp.notes);
    setEditProofName(cp.proofDocName || '');
  };

  const handleUploadProofFile = async () => {
    if (!lot) return;
    try {
      setIsUploadingProof(true);
      const selected = await FileManager.selectAndReadFile('other', '.pdf,.png,.jpg,.jpeg');
      if (selected && selected.file) {
        const meta = await StorageService.uploadDocument({
          file: selected.file,
          category: 'rosreestr_extract',
          categoryLabelRu: `Подтверждение аудита (${inspectingCheckpoint?.shortLabel || 'Реестр'}) #${lot.lotCode}`,
          entityType: 'lot',
          entityId: lot.lotCode,
          uploadedByUid: user?.id || 'curator',
          clientCode: 'DEX-LEGAL',
        });
        setEditProofName(meta.name);
        setNotice(`✓ Документ «${meta.name}» успешно загружен в хранилище!`);
        setTimeout(() => setNotice(null), 4000);
      }
    } catch (err) {
      console.warn('Upload aborted:', err);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleAxisStatusChange = (axisId: string, newStatus: LegalAuditAxisStatus) => {
    setAxes((prev) =>
      prev.map((ax) =>
        ax.id === axisId
          ? { ...ax, status: newStatus, checkedAt: new Date().toISOString(), checkedBy: curatorName }
          : ax
      )
    );
  };

  const handleAxisNotesChange = (axisId: string, newNotes: string) => {
    setAxes((prev) => prev.map((ax) => (ax.id === axisId ? { ...ax, notes: newNotes } : ax)));
  };

  const handleSaveAxis = async (axisId: string) => {
    if (!lot) return;
    const targetAxis = axes.find((a) => a.id === axisId);
    if (!targetAxis) return;
    const updatedAxes = axes.map((a) =>
      a.id === axisId
        ? { ...a, checkedAt: new Date().toISOString(), checkedBy: curatorName, evaluated: true }
        : a
    );
    setAxes(updatedAxes);
    lot.legalAuditAxes = updatedAxes;
    await LotsRepository.update(lot);
    setNotice(`✓ Раздел «${targetAxis.shortLabel}» зафиксирован: ${HONEST_STATUS_CONFIG[targetAxis.status].labelRu}`);
    setTimeout(() => setNotice(null), 5000);
  };

  const handleApplyStandardVerdict = async () => {
    if (!lot) return;
    const verifiedAxes: LegalAuditAxis[] = axes.map((ax) => ({
      ...ax,
      evaluated: true,
      checkedAt: new Date().toISOString(),
      checkedBy: curatorName,
    }));
    setAxes(verifiedAxes);
    lot.legalAuditAxes = verifiedAxes;
    lot.approvalStatus = 'approved';
    lot.isVerified = true;
    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Стандартный вердикт чистой сделки',
      notes: 'Все разделы проверены и зафиксированы с реалистичными статусами рынка.',
    });
    await LotsRepository.update(lot);
    setNotice('✓ Стандартный вердикт применен и сохранен в базе!');
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSaveInspectorVerdict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingCheckpoint || !lot) return;
    const updatedCheckpoints = checkpoints.map((c) => {
      if (c.id === inspectingCheckpoint.id) {
        return {
          ...c,
          score: editScore,
          status: editStatus,
          notes: editNotes,
          proofDocName: editProofName,
          evaluated: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy: curatorName,
        };
      }
      return c;
    });
    setCheckpoints(updatedCheckpoints);
    setInspectingCheckpoint(null);
    lot.legalAuditCheckpoints = updatedCheckpoints;
    lot.legalPassport.antiBankruptcyIndex = weightedIndex;
    await LotsRepository.update(lot);
    setNotice(`✓ Вердикт по «${inspectingCheckpoint.shortLabel}» сохранен!`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleManualVerifyCheckpoint = async (checkpointId: string) => {
    if (!lot) return;
    const updatedCheckpoints = checkpoints.map((c) => {
      if (c.id === checkpointId) {
        return {
          ...c,
          score: 10,
          status: 'clean' as const,
          evaluated: true,
          proofDocName: c.proofDocName || `Акт_ручной_проверки_${c.shortLabel.replace(/[\s/]/g, '_')}.pdf`,
          verifiedAt: new Date().toISOString(),
          verifiedBy: curatorName,
          notes: c.notes ? `${c.notes} [Проверено вручную юристом: рисков нет]` : 'Проверено вручную старшим юристом.',
        };
      }
      return c;
    });
    setCheckpoints(updatedCheckpoints);
    lot.legalAuditCheckpoints = updatedCheckpoints;
    lot.legalPassport.antiBankruptcyIndex = 100;
    await LotsRepository.update(lot);
    setNotice(`✓ Контрольная точка «${checkpointId}» подтверждена (10/10).`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleManualVerifyAll = async () => {
    if (!lot) return;
    const verified = checkpoints.map((c) => ({
      ...c,
      score: 10,
      status: 'clean' as const,
      evaluated: true,
      proofDocName: c.proofDocName || `Акт_ручной_проверки_${c.shortLabel.replace(/[\s/]/g, '_')}.pdf`,
      verifiedAt: new Date().toISOString(),
      verifiedBy: curatorName,
      notes: c.notes || 'Проверено вручную: соответствие законодательству РФ подтверждено.',
    }));
    setCheckpoints(verified);
    lot.legalAuditCheckpoints = verified;
    lot.legalPassport.antiBankruptcyIndex = 100;
    await LotsRepository.update(lot);
    setNotice('✓ Все 4 контрольные зоны подтверждены вручную (100%)!');
    setTimeout(() => setNotice(null), 4000);
  };

  const handleDownloadProtocol = (registryType: 'EFRSB' | 'FSSP') => {
    if (!lot) return;
    const timestamp = new Date().toLocaleString('ru-RU');
    const content =
      registryType === 'EFRSB'
        ? `ПРОТОКОЛ ПРОВЕРКИ ЕФРСБ / ФЕДРЕСУРС (127-ФЗ)\nОбъект: Лот #${lot.lotCode} (${lot.complexName})\nДольщик: ${lot.ownerDossier.fullNameMasked}\nИНН: ${lot.sellerInn || '781432994102'}\nДата: ${timestamp}\nЮрист: ${curatorName}\n`
        : `ВЫПИСКА ИЗ БАЗЫ ИСПОЛНИТЕЛЬНЫХ ПРОИЗВОДСТВ ФССП РФ\nОбъект: Лот #${lot.lotCode} (${lot.complexName})\nДольщик: ${lot.ownerDossier.fullNameMasked}\nИНН: ${lot.sellerInn || '781432994102'}\nДата: ${timestamp}\nЮрист: ${curatorName}\n`;

    FileManager.downloadFile(
      `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`,
      `Протокол_${registryType}_${lot.lotCode}.txt`
    );
    setNotice(`Протокол проверки ${registryType} успешно скачан.`);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleUpdateRadarChecks = async (checksList: LegalRadarCheckItem[]) => {
    if (!lot) return;
    lot.legalRadarChecks = checksList;
    await LotsRepository.update(lot);
  };

  const handleUpdateSecondaryChecklist = async (checklist: SecondaryRiskChecklist) => {
    if (!lot) return;
    lot.secondaryRiskChecklist = checklist;
    await LotsRepository.update(lot);
    setNotice('✓ Чек-лист рисков вторичного рынка обновлен!');
    setTimeout(() => setNotice(null), 3000);
  };

  const handleApproveLegal = async () => {
    if (!lot) return;
    const verifiedAxes: LegalAuditAxis[] = axes.map((ax) => ({
      ...ax,
      evaluated: true,
      checkedAt: new Date().toISOString(),
      checkedBy: curatorName,
    }));
    setAxes(verifiedAxes);
    await LotsRepository.approveLotLegal(lot.lotCode, curatorName, 100, checkpoints, verifiedAxes);
    setNotice('✓ Юридический паспорт утвержден! Штамп «Документы проверены» выдан.');
    loadLotData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleRejectLegal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lot) return;
    await LotsRepository.rejectLotLegal(lot.lotCode, rejectionReason || 'Высокий риск судебного оспаривания', curatorName);
    setIsRejectModalOpen(false);
    setNotice('Объект отклонен по комплаенс-рискам.');
    loadLotData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleRequestDocsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lot) return;
    await LotsRepository.requestAdditionalDocs(lot.lotCode, selectedDocsList, docsNotes, curatorName);
    setIsRequestDocsModalOpen(false);
    setNotice('Запрос доп. документов отправлен продавцу!');
    loadLotData();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSpecialBankApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lot) return;
    await BankPortalRepository.requestSpecialApproval({
      lotId: lot.id,
      lotCode: lot.lotCode,
      complexName: lot.complexName,
      developer: lot.developer,
      contractPriceRub: lot.dduContractPrice,
      requestedByEmployeeId: currentEmployeeId,
      requestedByEmployeeName: curatorName,
      bankName: selectedBank,
      reason: bankSpecialReason,
    });
    setIsSpecialBankModalOpen(false);
    setNotice(`Запрос спец-одобрения для ${lot.complexName} направлен в ${selectedBank}!`);
    loadLotData();
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={`Юридический аудит и комплаенс — Лот #${currentLotCode}`}
          subtitle="Комплексный правовой аудит, проверка в реестрах РФ и обоснование чистоты сделки"
        />

        <div className="p-4 sm:p-6 space-y-6 max-w-[1500px] w-full">
          {notice && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center justify-between shadow-xs animate-fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{notice}</span>
              </div>
              <button onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {!lot ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                {isOwner ? 'Объект для правового аудита не найден' : 'Нет закрепленных объектов для юридического аудита'}
              </p>
            </div>
          ) : (
            <>
              {/* Header Card */}
              <LegalAuditHeaderCard
                lot={lot}
                accessibleLots={accessibleLots}
                sellerFullName={sellerFullName}
                sellerInn={sellerInn}
                axes={axes}
                onSelectLotCode={(code) => navigate(`/admin/legal-audit/${code}`)}
              />

              {/* 1. Free Russian Legal Radar Panel */}
              <LegalRadarPanel lot={lot} curatorName={curatorName} onUpdateChecks={handleUpdateRadarChecks} />

              {/* Document Vault Bar */}
              <div className="bg-indigo-950 text-white rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    <HardDrive className="w-4 h-4" />
                    <span>ХРАНИЛИЩЕ ДОКУМЕНТОВ ПО ОБЪЕКТУ</span>
                  </div>
                  <h3 className="text-base font-bold">Оригиналы и сканы по лоту #{lot.lotCode}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVaultOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all shrink-0 flex items-center space-x-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Открыть и проверить документы</span>
                </button>
              </div>

              {/* 2. Legal Audit Axes Section (Dual-Track Cession & Secondary) */}
              <LegalAuditAxesSection
                lot={lot}
                axes={axes}
                curatorName={curatorName}
                onAxisStatusChange={handleAxisStatusChange}
                onAxisNotesChange={handleAxisNotesChange}
                onSaveAxis={handleSaveAxis}
                onApplyStandardVerdict={handleApplyStandardVerdict}
                onUpdateSecondaryChecklist={handleUpdateSecondaryChecklist}
              />

              {/* 3. Checkpoints Matrix */}
              <LegalCheckpointsMatrix
                checkpoints={checkpoints}
                weightedIndex={weightedIndex}
                onOpenInspector={handleOpenInspector}
                onManualVerifyCheckpoint={handleManualVerifyCheckpoint}
                onManualVerifyAll={handleManualVerifyAll}
                onDownloadProtocol={handleDownloadProtocol}
              />

              {/* 4. Legal Memo Generator */}
              <LegalMemoGenerator lot={lot} />

              {/* 5. Operations Log */}
              <LegalOperationsLog lot={lot} />

              {/* 6. Decision Bar */}
              <LegalDecisionBar
                curatorName={curatorName}
                enableBankPortal={enableBankPortal}
                onOpenBankModal={() => setIsSpecialBankModalOpen(true)}
                onOpenRequestDocsModal={() => setIsRequestDocsModalOpen(true)}
                onOpenRejectModal={() => setIsRejectModalOpen(true)}
                onApproveLegal={handleApproveLegal}
              />
            </>
          )}
        </div>
      </div>

      {/* Modals Container */}
      <LegalAuditModalsContainer
        inspectingCheckpoint={inspectingCheckpoint}
        lot={lot}
        editScore={editScore}
        setEditScore={setEditScore}
        editStatus={editStatus}
        setEditStatus={setEditStatus}
        editNotes={editNotes}
        setEditNotes={setEditNotes}
        editProofName={editProofName}
        isUploadingProof={isUploadingProof}
        onUploadProofFile={handleUploadProofFile}
        onCloseInspector={() => setInspectingCheckpoint(null)}
        onSaveInspectorVerdict={handleSaveInspectorVerdict}
        isRequestDocsModalOpen={isRequestDocsModalOpen}
        onCloseRequestDocs={() => setIsRequestDocsModalOpen(false)}
        selectedDocsList={selectedDocsList}
        setSelectedDocsList={setSelectedDocsList}
        docsNotes={docsNotes}
        setDocsNotes={setDocsNotes}
        onSubmitRequestDocs={handleRequestDocsSubmit}
        isRejectModalOpen={isRejectModalOpen}
        onCloseReject={() => setIsRejectModalOpen(false)}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        onSubmitReject={handleRejectLegal}
        enableBankPortal={enableBankPortal}
        isSpecialBankModalOpen={isSpecialBankModalOpen}
        onCloseBankModal={() => setIsSpecialBankModalOpen(false)}
        selectedBank={selectedBank}
        setSelectedBank={setSelectedBank}
        bankSpecialReason={bankSpecialReason}
        setBankSpecialReason={setBankSpecialReason}
        onSubmitBankModal={handleSpecialBankApprovalSubmit}
      />

      {/* Cloud S3 Document Vault Modal */}
      {lot && (
        <DocumentVaultModal
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          entityType="lot"
          entityId={lot.lotCode}
          entityTitle={`${lot.complexName} (${lot.district})`}
          uploadedByUid={user?.id || 'curator'}
          clientCode={user?.clientCode || 'DEX-LEGAL'}
          canReview={true}
          reviewerName={curatorName}
        />
      )}
    </div>
  );
};
