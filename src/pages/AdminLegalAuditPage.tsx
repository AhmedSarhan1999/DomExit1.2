import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { StorageService } from '../dal/StorageService';
import { apiClient } from '../services/apiClient';
import {
  DocumentMetadata,
  Lot,
  LegalAuditAxis,
  LegalAuditAxisStatus,
  LegalRadarCheckItem,
  SecondaryRiskChecklist,
} from '../types';
import { createInitialLegalAuditAxes, HONEST_STATUS_CONFIG } from '../data/legalAuditAxes';
import { LegalRadarPanel } from '../components/admin/legal-audit/LegalRadarPanel';
import { LegalAuditAxesSection } from '../components/admin/legal-audit/LegalAuditAxesSection';
import { LegalCheckpointsMatrix } from '../components/admin/legal-audit/LegalCheckpointsMatrix';
import { LegalAuditHeaderCard } from '../components/admin/legal-audit/LegalAuditHeaderCard';
import { LegalMemoGenerator } from '../components/admin/legal-audit/LegalMemoGenerator';
import { LegalOperationsLog } from '../components/admin/legal-audit/LegalOperationsLog';
import { LegalDecisionBar } from '../components/admin/legal-audit/LegalDecisionBar';
import { InlineSellerDocumentsPanel } from '../components/admin/legal-audit/InlineSellerDocumentsPanel';
import { Stage0CuratorBanner } from '../components/admin/Stage0CuratorBanner';
import { computeLegalVerificationProgress } from '../components/admin/legal-audit/legalAuditGate';
import {
  RequestDocsModal,
  RejectModal,
} from '../components/admin/legal-audit/LegalAuditModals';
import {
  CheckCircle2,
  FileSearch,
  Scale,
  ShieldCheck,
  AlertCircle,
  Radar,
} from 'lucide-react';
import { FileManager } from '../utils/fileManager';

type LegalAuditTab = 1 | 2 | 3;

export const AdminLegalAuditPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [accessibleLots, setAccessibleLots] = useState<Lot[]>([]);
  const [activeTab, setActiveTab] = useState<LegalAuditTab>(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // Documents Vault State
  const [vaultDocs, setVaultDocs] = useState<DocumentMetadata[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);

  // Axes & Radar State (True Zero-State Default)
  const [axes, setAxes] = useState<LegalAuditAxis[]>(() => createInitialLegalAuditAxes());
  const [radarChecks, setRadarChecks] = useState<LegalRadarCheckItem[]>([]);
  const [uploadingAxisId, setUploadingAxisId] = useState<string | null>(null);

  // Modals State
  const [isRequestDocsModalOpen, setIsRequestDocsModalOpen] = useState(false);
  const [selectedDocsList, setSelectedDocsList] = useState<string[]>([
    'Справка об отсутствии задолженности от застройщика',
    'Справка из СФР об остатке материнского капитала',
  ]);
  const [docsNotes, setDocsNotes] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isOwner = user?.role === 'owner' || user?.activeRole === 'owner';
  const isEmployee = user?.activeRole === 'employee' && !isOwner;
  const currentEmployeeId = user?.assignedEmployeeId || (isEmployee ? user?.id || '' : '');
  const curatorName =
    user?.name || (isEmployee ? 'Куратор DomExit (Юрист)' : 'Руководство платформы DomExit');

  const showToast = (msg: string) => {
    setErrorMsg(null);
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const loadDocumentsForLot = async (code: string) => {
    if (!code) {
      setVaultDocs([]);
      return;
    }
    setLoadingDocs(true);
    try {
      const docs = await StorageService.getDocumentsByEntity('lot', code);
      setVaultDocs(docs || []);
    } catch {
      setVaultDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

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
      const loadedAxes =
        Array.isArray(found.legalAuditAxes) && found.legalAuditAxes.length === 5
          ? found.legalAuditAxes
          : createInitialLegalAuditAxes();
      setAxes(loadedAxes);
      setRadarChecks(Array.isArray(found.legalRadarChecks) ? found.legalRadarChecks : []);
      await loadDocumentsForLot(found.lotCode);
    } else {
      setLot(null);
      setVaultDocs([]);
      setAxes(createInitialLegalAuditAxes());
      setRadarChecks([]);
    }
  };

  useEffect(() => {
    loadLotData();
  }, [lotId, isEmployee, currentEmployeeId]);

  const progress = useMemo(() => {
    if (!lot) {
      return {
        approvedMandatoryDocsCount: 0,
        requiredMandatoryDocsTotal: 2,
        hasApprovedDdu: false,
        hasApprovedDevCert: false,
        passedRequiredRadarCount: 0,
        requiredRadarTotal: 4,
        hasCriticalRadar: false,
        evaluatedAxesCount: 0,
        axesTotal: 5,
        hasCriticalAxis: false,
        weightedIndex: 0,
        derivedCheckpoints: [],
        missingItems: [],
        canApprove: false,
      };
    }
    return computeLegalVerificationProgress({
      lot,
      axes,
      radarChecks,
      documents: vaultDocs,
    });
  }, [lot, axes, radarChecks, vaultDocs]);

  const currentLotCode = lot?.lotCode || '';
  const sellerInn = lot?.sellerInn || '—';
  const sellerFullName = lot?.ownerDossier?.fullNameMasked || 'Правообладатель';

  const handleOpenProofDoc = async (docInfo: {
    proofDocKey?: string;
    proofDocUrl?: string;
    proofDocName?: string;
  }) => {
    if (!lot) return;
    if (docInfo.proofDocKey) {
      try {
        const res = await apiClient.get<{ success: boolean; downloadUrl: string }>(
          `/api/storage/presign-download?key=${encodeURIComponent(docInfo.proofDocKey)}&lotCode=${encodeURIComponent(lot.lotCode)}&filename=${encodeURIComponent(docInfo.proofDocName || 'proof.pdf')}`
        );
        if (res?.downloadUrl) {
          window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch (err: any) {
        setErrorMsg(`Ошибка получения защищённой ссылки S3: ${err?.message || 'Сбой'}`);
        return;
      }
    }
    if (docInfo.proofDocUrl) {
      window.open(docInfo.proofDocUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setErrorMsg('Скан подтверждения ещё не загружен в защищённое хранилище S3.');
  };

  const handleUploadAxisProof = async (axisId: string) => {
    if (!lot) return;
    const axis = axes.find((a) => a.id === axisId);
    if (!axis) return;
    try {
      setUploadingAxisId(axisId);
      const selected = await FileManager.selectAndReadFile('other', '.pdf,.png,.jpg,.jpeg');
      if (selected && selected.file) {
        const meta = await StorageService.uploadDocument({
          file: selected.file,
          category: 'rosreestr_extract',
          categoryLabelRu: `Подтверждение (${axis.shortLabel}) #${lot.lotCode}`,
          entityType: 'lot',
          entityId: lot.lotCode,
          uploadedByUid: user?.id || 'curator',
          clientCode: 'DEX-LEGAL',
        });
        const objectKey = meta.key || meta.objectKey || '';
        const updatedAxes = axes.map((a) =>
          a.id === axisId
            ? {
                ...a,
                proofDocName: meta.name,
                proofDocKey: objectKey,
                proofDocUrl: meta.url || '',
              }
            : a
        );
        setAxes(updatedAxes);
        const updatedProgress = computeLegalVerificationProgress({
          lot,
          axes: updatedAxes,
          radarChecks,
          documents: vaultDocs,
        });
        lot.legalAuditAxes = updatedAxes;
        lot.legalAuditCheckpoints = updatedProgress.derivedCheckpoints;
        lot.legalPassport.antiBankruptcyIndex = updatedProgress.weightedIndex;
        await LotsRepository.update(lot);
        await loadDocumentsForLot(lot.lotCode);
        showToast(`✓ Скан «${meta.name}» прикреплён к разделу «${axis.shortLabel}».`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось загрузить файл подтверждения');
    } finally {
      setUploadingAxisId(null);
    }
  };

  const handleAxisStatusChange = (axisId: string, newStatus: LegalAuditAxisStatus) => {
    setAxes((prev) =>
      prev.map((ax) =>
        ax.id === axisId
          ? {
              ...ax,
              status: newStatus,
              evaluated: newStatus === 'unverified' ? false : ax.evaluated,
            }
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
    if (targetAxis.status === 'unverified') {
      setErrorMsg('Выберите итоговый статус раздела перед сохранением.');
      return;
    }
    if (!targetAxis.notes || targetAxis.notes.trim().length < 3) {
      setErrorMsg('Добавьте фактическое заключение/комментарий юриста по разделу.');
      return;
    }

    const updatedAxes: LegalAuditAxis[] = axes.map((a) =>
      a.id === axisId
        ? { ...a, checkedAt: new Date().toISOString(), checkedBy: curatorName, evaluated: true }
        : a
    );
    setAxes(updatedAxes);

    const updatedProgress = computeLegalVerificationProgress({
      lot,
      axes: updatedAxes,
      radarChecks,
      documents: vaultDocs,
    });

    lot.legalAuditAxes = updatedAxes;
    lot.legalAuditCheckpoints = updatedProgress.derivedCheckpoints;
    lot.legalPassport.antiBankruptcyIndex = updatedProgress.weightedIndex;
    lot.legalPassport.passedChecksCount = updatedProgress.evaluatedAxesCount;
    await LotsRepository.update(lot);
    setLot({ ...lot });

    showToast(
      `✓ Раздел «${targetAxis.shortLabel}» зафиксирован: ${HONEST_STATUS_CONFIG[targetAxis.status].labelRu} (Индекс: ${updatedProgress.weightedIndex}%)`
    );
  };

  const handleDownloadProtocol = (registryType: 'EFRSB' | 'FSSP') => {
    if (!lot) return;
    const timestamp = new Date().toLocaleString('ru-RU');
    const innValue = lot.sellerInn || 'Не указан';
    const content =
      registryType === 'EFRSB'
        ? `ПРОТОКОЛ ПРОВЕРКИ ЕФРСБ / ФЕДРЕСУРС (127-ФЗ)\nОбъект: Лот #${lot.lotCode} (${lot.complexName})\nДольщик: ${lot.ownerDossier.fullNameMasked}\nИНН: ${innValue}\nДата: ${timestamp}\nЮрист: ${curatorName}\n`
        : `ВЫПИСКА ИЗ БАЗЫ ИСПОЛНИТЕЛЬНЫХ ПРОИЗВОДСТВ ФССП РФ\nОбъект: Лот #${lot.lotCode} (${lot.complexName})\nДольщик: ${lot.ownerDossier.fullNameMasked}\nИНН: ${innValue}\nДата: ${timestamp}\nЮрист: ${curatorName}\n`;

    FileManager.downloadFile(
      `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`,
      `Протокол_${registryType}_${lot.lotCode}.txt`
    );
    showToast(`Протокол проверки ${registryType} сформирован и скачан.`);
  };

  const handleUpdateRadarChecks = async (checksList: LegalRadarCheckItem[]) => {
    if (!lot) return;
    setRadarChecks(checksList);
    const updatedProgress = computeLegalVerificationProgress({
      lot,
      axes,
      radarChecks: checksList,
      documents: vaultDocs,
    });
    lot.legalRadarChecks = checksList;
    lot.legalAuditCheckpoints = updatedProgress.derivedCheckpoints;
    lot.legalPassport.antiBankruptcyIndex = updatedProgress.weightedIndex;
    await LotsRepository.update(lot);
    setLot({ ...lot });
  };

  const handleUpdateSecondaryChecklist = async (checklist: SecondaryRiskChecklist) => {
    if (!lot) return;
    lot.secondaryRiskChecklist = checklist;
    await LotsRepository.update(lot);
    showToast('✓ Чек-лист рисков вторичного рынка обновлён.');
  };

  const hasAssignedCurator = Boolean(lot?.assignedEmployeeId || lot?.assignedCuratorId);

  const handleApproveLegal = async () => {
    if (!lot) return;
    if (!hasAssignedCurator) {
      setErrorMsg('Этап 0: Сначала назначьте персонального куратора (можно назначить себя).');
      return;
    }
    if (!progress.canApprove) {
      setErrorMsg('Завершите все обязательные проверки документов, госреестров и разделов перед выдачей штампа.');
      return;
    }

    setIsApproving(true);
    setErrorMsg(null);
    try {
      const nowIso = new Date().toISOString();
      const verifiedAxes: LegalAuditAxis[] = axes.map((ax) => ({
        ...ax,
        evaluated: true,
        checkedAt: ax.checkedAt || nowIso,
        checkedBy: ax.checkedBy || curatorName,
      }));
      setAxes(verifiedAxes);

      await LotsRepository.approveLotLegal(
        lot.lotCode,
        curatorName,
        progress.weightedIndex,
        progress.derivedCheckpoints,
        verifiedAxes,
        radarChecks
      );

      showToast('✓ Штамп «Документы проверены» выдан! Переходим на этап упаковки лота...');
      navigate(`/admin/packaging/${lot.lotCode}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка при утверждении правового аудита (Gate Blocked)');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectLegal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lot) return;
    await LotsRepository.rejectLotLegal(
      lot.lotCode,
      rejectionReason || 'Высокий риск судебного оспаривания',
      curatorName
    );
    setIsRejectModalOpen(false);
    showToast('Объект отклонён по комплаенс-рискам.');
    await loadLotData();
  };

  const handleRequestDocsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lot) return;
    await LotsRepository.requestAdditionalDocs(lot.lotCode, selectedDocsList, docsNotes, curatorName);
    setIsRequestDocsModalOpen(false);
    showToast('Запрос дополнительных документов отправлен продавцу.');
    await loadLotData();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={`Юридический аудит и комплаенс — Лот #${currentLotCode}`}
          subtitle="Поэтапный правовой аудит 214-ФЗ / 127-ФЗ: Документы и Реестры → 5 Разделов → Решение и Передача в упаковку"
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

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 font-semibold text-xs flex items-center justify-between shadow-xs animate-fade-in">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-950 cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {!lot ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                {isOwner ? 'Объект для правового аудита не найден' : 'Нет закреплённых объектов для юридического аудита'}
              </p>
            </div>
          ) : (
            <>
              {/* Fixed Progress & Property Header Card */}
              <LegalAuditHeaderCard
                lot={lot}
                accessibleLots={accessibleLots}
                sellerFullName={sellerFullName}
                sellerInn={sellerInn}
                progress={progress}
                onSelectLotCode={(code) => navigate(`/admin/legal-audit/${code}`)}
              />

              <Stage0CuratorBanner
                lot={lot}
                operatorName={curatorName}
                onAssigned={(updated) => {
                  setLot(updated);
                  showToast(`✓ Куратор ${updated.assignedEmployeeName || ''} закреплён. Лот переведён на Этап 1.`);
                }}
              />

              {/* 3-Tab Sequential Navigation Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-wrap gap-2 shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab(1)}
                  className={`flex-1 min-w-[210px] px-4 py-3 rounded-xl text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    activeTab === 1
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <Radar className={`w-4 h-4 ${activeTab === 1 ? 'text-emerald-400' : 'text-indigo-600'}`} />
                    <span>1. Документы и Госреестры</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      activeTab === 1 ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {progress.approvedMandatoryDocsCount}/{progress.requiredMandatoryDocsTotal} док •{' '}
                    {progress.passedRequiredRadarCount}/{progress.requiredRadarTotal} рег
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab(2)}
                  className={`flex-1 min-w-[210px] px-4 py-3 rounded-xl text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    activeTab === 2
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <FileSearch className={`w-4 h-4 ${activeTab === 2 ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span>2. Юридическая проверка (5 разделов)</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      activeTab === 2 ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {progress.evaluatedAxesCount} из {progress.axesTotal}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab(3)}
                  className={`flex-1 min-w-[210px] px-4 py-3 rounded-xl text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    activeTab === 3
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <Scale className={`w-4 h-4 ${activeTab === 3 ? 'text-emerald-400' : 'text-amber-600'}`} />
                    <span>3. Заключение 61.2 ФЗ-127 и Решение</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      progress.canApprove
                        ? 'bg-emerald-500 text-slate-950'
                        : activeTab === 3
                        ? 'bg-white/15 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {progress.canApprove ? 'Готово ✓' : `${progress.weightedIndex}%`}
                  </span>
                </button>
              </div>

              {/* TAB 1: Inline Seller Documents + INN Lookup + 6 Government Registries Radar */}
              {activeTab === 1 && (
                <div className="space-y-6">
                  <InlineSellerDocumentsPanel
                    lot={lot}
                    documents={vaultDocs}
                    loading={loadingDocs}
                    curatorName={curatorName}
                    onRefreshDocuments={() => loadDocumentsForLot(lot.lotCode)}
                    onOpenFullVault={() => setIsVaultOpen(true)}
                    onOpenRequestDocsModal={() => setIsRequestDocsModalOpen(true)}
                    onNotice={showToast}
                  />

                  <LegalRadarPanel
                    lot={lot}
                    curatorName={curatorName}
                    onUpdateChecks={handleUpdateRadarChecks}
                    onDownloadProtocol={handleDownloadProtocol}
                  />
                </div>
              )}

              {/* TAB 2: 5 Legal Audit Axes + Proof Scans + Auto-Computed Index Summary */}
              {activeTab === 2 && (
                <div className="space-y-6">
                  <LegalAuditAxesSection
                    lot={lot}
                    axes={axes}
                    curatorName={curatorName}
                    uploadingAxisId={uploadingAxisId}
                    onAxisStatusChange={handleAxisStatusChange}
                    onAxisNotesChange={handleAxisNotesChange}
                    onSaveAxis={handleSaveAxis}
                    onUploadAxisProof={handleUploadAxisProof}
                    onOpenProofDoc={handleOpenProofDoc}
                    onUpdateSecondaryChecklist={handleUpdateSecondaryChecklist}
                  />

                  <LegalCheckpointsMatrix
                    checkpoints={progress.derivedCheckpoints}
                    weightedIndex={progress.weightedIndex}
                    onOpenProofDoc={handleOpenProofDoc}
                  />
                </div>
              )}

              {/* TAB 3: Stamp Readiness Checklist + Legal Memo 61.2 FZ-127 + Audit Operations Log */}
              {activeTab === 3 && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
                    <div className="flex items-center space-x-2 text-indigo-700">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-base font-black text-slate-900">
                        Чек-лист готовности к выдаче штампа «Документы проверены»
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div
                        className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                          progress.approvedMandatoryDocsCount >= progress.requiredMandatoryDocsTotal
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-bold">Обязательные документы продавца (S3 Vault)</span>
                        <span className="font-mono font-black">
                          {progress.approvedMandatoryDocsCount >= progress.requiredMandatoryDocsTotal ? '✓ Готово' : '✗ Ожидает'}
                        </span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                          progress.passedRequiredRadarCount >= progress.requiredRadarTotal && !progress.hasCriticalRadar
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-bold">4 обязательных госреестра РФ (ФССП, ЕФРСБ, Суды, Дом.РФ)</span>
                        <span className="font-mono font-black">
                          {progress.passedRequiredRadarCount >= progress.requiredRadarTotal && !progress.hasCriticalRadar
                            ? '✓ Проверено'
                            : `✗ ${progress.passedRequiredRadarCount}/${progress.requiredRadarTotal}`}
                        </span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                          progress.evaluatedAxesCount === progress.axesTotal && !progress.hasCriticalAxis
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-bold">5 разделов юридической экспертизы (с комментариями)</span>
                        <span className="font-mono font-black">
                          {progress.evaluatedAxesCount === progress.axesTotal && !progress.hasCriticalAxis
                            ? '✓ 5 из 5'
                            : `✗ ${progress.evaluatedAxesCount}/${progress.axesTotal}`}
                        </span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                          progress.weightedIndex >= 85
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-bold">Индекс антибанкротной чистоты (порог ≥ 85%)</span>
                        <span className="font-mono font-black">{progress.weightedIndex}%</span>
                      </div>
                    </div>
                  </div>

                  <LegalMemoGenerator lot={lot} />
                  <LegalOperationsLog lot={lot} />
                </div>
              )}

              {/* Persistent Bottom Decision & Strict Gate Bar */}
              <LegalDecisionBar
                lot={lot}
                curatorName={curatorName}
                canApprove={hasAssignedCurator && progress.canApprove}
                isApproving={isApproving}
                missingItems={progress.missingItems}
                onSwitchTab={setActiveTab}
                onOpenRequestDocsModal={() => setIsRequestDocsModalOpen(true)}
                onOpenRejectModal={() => setIsRejectModalOpen(true)}
                onApproveLegal={handleApproveLegal}
              />
            </>
          )}
        </div>
      </div>

      {/* Request Docs & Rejection Modals */}
      <RequestDocsModal
        isOpen={isRequestDocsModalOpen}
        onClose={() => setIsRequestDocsModalOpen(false)}
        selectedDocsList={selectedDocsList}
        setSelectedDocsList={setSelectedDocsList}
        docsNotes={docsNotes}
        setDocsNotes={setDocsNotes}
        onSubmit={handleRequestDocsSubmit}
      />

      <RejectModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        onSubmit={handleRejectLegal}
      />

      {/* Full Cloud S3 Document Vault Modal */}
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
          onDocumentsChanged={(docs) => setVaultDocs(docs)}
        />
      )}
    </div>
  );
};
