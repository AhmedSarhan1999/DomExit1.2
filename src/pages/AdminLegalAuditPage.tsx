import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getRegionByCode } from '../data/russianGeography';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { StorageService } from '../dal/StorageService';
import { Lot, LegalAuditCheckpoint } from '../types';
import { formatRubles } from '../utils/formatters';
import { FileManager } from '../utils/fileManager';
import {
  Scale,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Download,
  Copy,
  Check,
  Building2,
  History,
  AlertCircle,
  HardDrive,
  ExternalLink,
  UploadCloud,
  X,
  FileCheck,
  Sliders,
  AlertTriangle,
  Lock,
} from 'lucide-react';

const INITIAL_CHECKPOINTS: LegalAuditCheckpoint[] = [
  {
    id: 'efrsb',
    title: '1. Реестр сведений о банкротстве (ЕФРСБ / Федресурс 127-ФЗ)',
    shortLabel: 'ЕФРСБ / Банкротство',
    weightPercent: 25,
    portalUrl: 'https://bankrot.fedresurs.ru/',
    score: 10,
    status: 'clean',
    notes: 'Сведений о банкротстве продавца или заявлениях по ст. 213.4 127-ФЗ в картотеке не зафиксировано.',
    proofDocName: 'Выписка_ЕФРСБ_Федресурс.pdf',
    evaluated: true,
  },
  {
    id: 'fssp',
    title: '2. Исполнительные производства ФССП РФ',
    shortLabel: 'ФССП / Долги и аресты',
    weightPercent: 15,
    portalUrl: 'https://fssp.gov.ru/iss/ip',
    score: 10,
    status: 'clean',
    notes: 'Открытых исполнительных производств, долгов по кредитам и запретов на регистрационные действия в Росреестре нет.',
    proofDocName: 'Справка_ФССП_отсутствие_задолженности.pdf',
    evaluated: true,
  },
  {
    id: 'courts',
    title: '3. Судебные споры (ГАС Правосудие и КАД Арбитраж)',
    shortLabel: 'ГАС Правосудие / Арбитраж',
    weightPercent: 15,
    portalUrl: 'https://bsr.sudrf.ru/',
    score: 10,
    status: 'clean',
    notes: 'Судебных споров, исков о разделе совместно нажитого имущества супругов и арбитражных споров не выявлено.',
    proofDocName: 'Отчет_ГАС_Правосудие_Арбитраж.pdf',
    evaluated: true,
  },
  {
    id: 'ddu_sfr',
    title: '4. Аудит ДДУ, СФР Маткапитал и Ограничения застройщика (214-ФЗ)',
    shortLabel: 'ДДУ / СФР Маткапитал / Застройщик',
    weightPercent: 45, // СФР 25% + ДДУ 20%
    portalUrl: 'https://sfr.gov.ru/',
    score: 10,
    status: 'clean',
    notes: 'Оплата ДДУ подтверждена справкой девелопера. Справка СФР подтверждает отсутствие средств маткапитала. Нотариальное согласие получено.',
    proofDocName: 'Справка_СФР_и_Застройщик_214ФЗ.pdf',
    evaluated: true,
  },
];

export const AdminLegalAuditPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [accessibleLots, setAccessibleLots] = useState<Lot[]>([]);
  const [includePlenum63, setIncludePlenum63] = useState<boolean>(true);
  const [memoCopied, setMemoCopied] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);

  // Checkpoints State (re-engineered from static to dynamic)
  const [checkpoints, setCheckpoints] = useState<LegalAuditCheckpoint[]>(INITIAL_CHECKPOINTS);
  const [inspectingCheckpoint, setInspectingCheckpoint] = useState<LegalAuditCheckpoint | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const [copiedDataToast, setCopiedDataToast] = useState<string | null>(null);

  // Inspector Form State
  const [editScore, setEditScore] = useState<number>(10);
  const [editStatus, setEditStatus] = useState<'clean' | 'attention' | 'critical'>('clean');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editProofName, setEditProofName] = useState<string>('');
  const [editProofUrl, setEditProofUrl] = useState<string>('');

  // Modals
  const [isRequestDocsModalOpen, setIsRequestDocsModalOpen] = useState(false);
  const [selectedDocsList, setSelectedDocsList] = useState<string[]>([
    'Справка об отсутствии задолженности от застройщика',
    'Справка из СФР об остатке материнского капитала',
  ]);
  const [docsNotes, setDocsNotes] = useState('');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [isSpecialBankModalOpen, setIsSpecialBankModalOpen] = useState(false);
  const [bankSpecialReason, setBankSpecialReason] = useState(
    'Нетиповой график рассрочки застройщика. Требуется индивидуальная кредитная аккредитация эскроу.'
  );
  const [selectedBank, setSelectedBank] = useState('Сбербанк');

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';
  const curatorName =
    user?.name || (isEmployee ? 'Алексей Смирнов (Старший юрист)' : 'Ahmed Abdallah (Владелец / CEO)');

  const loadLotData = async () => {
    const pool = isEmployee
      ? await LotsRepository.getByAssignedEmployee(currentEmployeeId)
      : await LotsRepository.getAll({ includePendingApproval: true });

    setAccessibleLots(pool);

    const code = (lotId || 'U-10566').toUpperCase();
    const found =
      pool.find((l) => l.lotCode.toUpperCase() === code || l.id.toUpperCase() === code) || pool[0];
    
    if (found) {
      setLot(found);
      if (found.legalAuditCheckpoints && found.legalAuditCheckpoints.length === 4) {
        setCheckpoints(found.legalAuditCheckpoints);
      } else {
        // Sync initial checkpoints with lot-specific data
        const synced = INITIAL_CHECKPOINTS.map((cp) => {
          if (cp.id === 'efrsb' && found.legalPassport.efrsbBankruptcyStatus === 'risk') {
            return { ...cp, score: 6, status: 'attention' as const, notes: 'Обнаружены связанные записи в ЕФРСБ' };
          }
          if (cp.id === 'fssp' && found.legalPassport.fsspDebtRub > 0) {
            return {
              ...cp,
              score: 5,
              status: 'attention' as const,
              notes: `Открыто исполнительное производство на сумму ${formatRubles(found.legalPassport.fsspDebtRub)}`,
            };
          }
          return cp;
        });
        setCheckpoints(synced);
      }
    } else {
      setLot(null);
    }
  };

  useEffect(() => {
    loadLotData();
  }, [lotId, isEmployee, currentEmployeeId]);

  // Dynamic Risk-Weighted Score Calculation
  const weightedIndex = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        checkpoints.reduce((sum, cp) => {
          const scoreNormalized = (cp.score || 0) / 10;
          return sum + scoreNormalized * cp.weightPercent;
        }, 0)
      )
    )
  );

  // Hard-Lock Gate Validations
  const allCheckpointsEvaluated = checkpoints.every((c) => c.evaluated);
  const allCheckpointsHaveProof = checkpoints.every((c) => Boolean(c.proofDocName || c.proofDocUrl));
  const hasCriticalRisk = checkpoints.some((c) => c.status === 'critical' || c.score <= 4);
  const isIndexSufficient = weightedIndex >= 85;

  const isApprovalEligible =
    allCheckpointsEvaluated && allCheckpointsHaveProof && isIndexSufficient && !hasCriticalRisk;

  const currentLotCode = lot?.lotCode || 'U-10566';
  const sellerInn = lot?.sellerInn || '781432994102';
  const sellerFullName = lot?.ownerDossier?.fullNameMasked || 'Александр Владимирович Б.';

  const handleOpenInspector = (cp: LegalAuditCheckpoint) => {
    setInspectingCheckpoint(cp);
    setEditScore(cp.score);
    setEditStatus(cp.status);
    setEditNotes(cp.notes);
    setEditProofName(cp.proofDocName || '');
    setEditProofUrl(cp.proofDocUrl || '');
  };

  const handleCopySellerData = (type: 'all' | 'inn' | 'name') => {
    let textToCopy = '';
    if (type === 'all') textToCopy = `ИНН: ${sellerInn} • ФИО: ${sellerFullName}`;
    else if (type === 'inn') textToCopy = sellerInn;
    else textToCopy = sellerFullName;

    navigator.clipboard?.writeText(textToCopy);
    setCopiedDataToast(`✓ Скопировано: ${textToCopy}`);
    setTimeout(() => setCopiedDataToast(null), 3000);
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
        setEditProofUrl(meta.cloudUrl || '');
        setNotice(`✓ Документ «${meta.name}» успешно загружен в S3-сейф!`);
        setTimeout(() => setNotice(null), 4000);
      }
    } catch (err) {
      console.warn('Upload aborted:', err);
    } finally {
      setIsUploadingProof(false);
    }
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
          proofDocUrl: editProofUrl,
          evaluated: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy: curatorName,
        };
      }
      return c;
    });

    setCheckpoints(updatedCheckpoints);
    setInspectingCheckpoint(null);

    // Recalculate dynamic index with new values
    const newWeightedIndex = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          updatedCheckpoints.reduce((sum, cp) => {
            const scoreNormalized = (cp.score || 0) / 10;
            return sum + scoreNormalized * cp.weightPercent;
          }, 0)
        )
      )
    );

    // Save updated checkpoints in lot
    lot.legalAuditCheckpoints = updatedCheckpoints;
    lot.legalPassport.antiBankruptcyIndex = newWeightedIndex;
    await LotsRepository.update(lot);

    setNotice(`✓ Вердикт по «${inspectingCheckpoint.shortLabel}» сохранен! Новый антибанкротный индекс: ${newWeightedIndex}%`);
    setTimeout(() => setNotice(null), 5000);
  };

  const getMemoText = () => {
    const cashStr = formatRubles(lot?.cashPaidBySeller || 2485230);
    const dduNum = lot?.ownerDossier?.dduNumber || `№ ЧН-12/2-${currentLotCode}`;
    const devName = lot?.developer || 'Setl Group';
    const penaltyStr = formatRubles(Math.round((lot?.dduContractPrice || 10000000) * 0.15));

    let text = `Цена уступки права требования в размере ${cashStr} строго соответствует сумме фактически внесенных Цедентом денежных средств по Договору участия в долевом строительстве ${dduNum}.\n\n`;
    text += `Стороны констатируют, что установление данной цены экономически обусловлено предотвращением финансовых убытков Цедента в виде контрактного штрафа Застройщика (${devName}) в размере 15% (${penaltyStr}) при одностороннем отказе от договора. В силу ст. 302 ГК РФ и ст. 61.2 ФЗ-127 Цессионарий признается добросовестным приобретателем, действовавшим в стандартных условиях делового оборота без цели причинения вреда кредиторам.`;

    if (includePlenum63) {
      text += `\n\nПрименена правовая позиция Постановления Пленума ВАС РФ № 63: «Экономическая целесообразность предотвращения штрафных санкций подтверждена документально».`;
    }
    return text;
  };

  const handleCopyMemo = () => {
    navigator.clipboard?.writeText(getMemoText());
    setMemoCopied(true);
    setTimeout(() => setMemoCopied(false), 2500);
  };

  const handleDownloadProtocol = (registryType: 'EFRSB' | 'FSSP') => {
    if (!lot) return;
    const timestamp = new Date().toLocaleString('ru-RU');
    const content =
      registryType === 'EFRSB'
        ? `ПРОТОКОЛ АВТОМАТИЗИРОВАННОЙ ПРОВЕРКИ ЕФРСБ / ФЕДРЕСУРС (127-ФЗ)\n` +
          `==============================================================\n` +
          `Объект: Лот #${lot.lotCode} (${lot.complexName})\n` +
          `Дольщик (152-ФЗ): ${lot.ownerDossier.fullNameMasked}\n` +
          `ИНН: ${lot.sellerInn || '781432994102'}\n` +
          `Статус банкротства: ЧИСТО (${lot.legalPassport.efrsbBankruptcyStatus.toUpperCase()})\n` +
          `Динамический антибанкротный индекс DomExit: ${weightedIndex} / 100\n` +
          `Дата выгрузки: ${timestamp}\n` +
          `Ответственный юрист: ${curatorName}\n`
        : `ОФИЦИАЛЬНАЯ ВЫПИСКА ИЗ БАЗЫ ИСПОЛНИТЕЛЬНЫХ ПРОИЗВОДСТВ ФССП РФ\n` +
          `==============================================================\n` +
          `Объект: Лот #${lot.lotCode} (${lot.complexName})\n` +
          `Дольщик (152-ФЗ): ${lot.ownerDossier.fullNameMasked}\n` +
          `ИНН: ${lot.sellerInn || '781432994102'}\n` +
          `Сумма открытых исполнительных производств: ${formatRubles(lot.legalPassport.fsspDebtRub)}\n` +
          `Запреты на регистрационные действия в Росреестре: ОТСУТСТВУЮТ\n` +
          `Дата выгрузки: ${timestamp}\n` +
          `Ответственный юрист: ${curatorName}\n`;

    FileManager.downloadFile(
      `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`,
      `Протокол_${registryType}_${lot.lotCode}.txt`
    );

    setNotice(`Протокол проверки ${registryType} по лоту #${lot.lotCode} успешно сформирован и скачан.`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleRequestDocsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lot) return;

    await LotsRepository.requestAdditionalDocs(
      lot.lotCode,
      selectedDocsList,
      docsNotes || 'Необходимо предоставить недостающие оригиналы/сканы для прохождения 42 параметров 214-ФЗ',
      curatorName
    );

    setIsRequestDocsModalOpen(false);
    setNotice(
      language === 'ru'
        ? `Запрос на ${selectedDocsList.length} доп. документов отправлен продавцу! В его кабинете открыто поле загрузки.`
        : 'Additional documents requested from seller!'
    );
    loadLotData();
    setTimeout(() => setNotice(null), 6000);
  };

  const handleApproveLegal = async () => {
    if (!lot) return;
    if (!isApprovalEligible) {
      alert('Утверждение заблокировано: индекс чистоты ниже 85% либо не все чекпоинты содержат подтверждающие документы.');
      return;
    }

    await LotsRepository.approveLotLegal(lot.lotCode, curatorName, weightedIndex, checkpoints);

    setNotice(
      language === 'ru'
        ? `✓ Юридический паспорт утвержден! Индекс чистоты: ${weightedIndex}%. Лот переведен на этап открытого подбора покупателей (Матчмейкинг).`
        : 'Legal stamp approved! Property moved to buyer matchmaking.'
    );
    loadLotData();
    setTimeout(() => setNotice(null), 6000);
  };

  const handleRejectLegal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lot) return;

    await LotsRepository.rejectLotLegal(
      lot.lotCode,
      rejectionReason || 'Высокий риск судебного оспаривания по 127-ФЗ',
      curatorName
    );

    setIsRejectModalOpen(false);
    setNotice(
      language === 'ru'
        ? 'Объект отклонен по комплаенс-рискам. Продавец уведомлен.'
        : 'Lot rejected due to compliance risk.'
    );
    loadLotData();
    setTimeout(() => setNotice(null), 6000);
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
    setNotice(
      language === 'ru'
        ? `Запрос спец-одобрения для ${lot.complexName} успешно направлен в ${selectedBank}!`
        : `Special approval request sent to ${selectedBank}!`
    );
    loadLotData();
    setTimeout(() => setNotice(null), 6000);
  };

  const toggleDocItem = (doc: string) => {
    setSelectedDocsList((prev) =>
      prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={`Юридический аудит и антибанкротная защита — Лот #${currentLotCode}`}
          subtitle="Динамический скоринг по 4 интерактивным зонам (ЕФРСБ, ФССП, Суды, ДДУ/СФР), облачный сейф S3 и обоснование цены по 127-ФЗ"
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

          {copiedDataToast && (
            <div className="p-3 rounded-xl bg-slate-900 text-white font-mono text-xs flex items-center justify-between shadow-lg animate-fade-in">
              <div className="flex items-center space-x-2">
                <Copy className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{copiedDataToast}</span>
              </div>
              <button onClick={() => setCopiedDataToast(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {!lot ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                Нет закрепленных объектов для юридического аудита
              </p>
              <p className="text-xs text-slate-500">
                В изолированном контуре сотрудника доступны только назначенные вам объекты.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Header Card with Dynamic Anti-Bankruptcy Index */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xs">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-emerald-700">
                    <Scale className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      ПРОТОКОЛ ПРАВОВОГО СКОРИНГА DOMEXIT #{lot.lotCode}
                    </span>

                    <select
                      value={lot.lotCode}
                      onChange={(e) => navigate(`/admin/legal-audit/${e.target.value}`)}
                      className="px-3 py-1 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      {accessibleLots.map((l) => (
                        <option key={l.id} value={l.lotCode}>
                          #{l.lotCode} — {l.complexName}
                        </option>
                      ))}
                    </select>

                    {lot.approvalStatus === 'approved' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        ✓ Штамп «Документы проверены» выдан
                      </span>
                    )}
                    {lot.approvalStatus === 'rejected' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                        ✕ Отклонено
                      </span>
                    )}
                    {lot.additionalDocsRequested?.status === 'pending' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold animate-pulse">
                        Ожидает доп. документы от продавца
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                      <span>Аудит продавца: {sellerFullName}</span>
                      <span className="text-sm font-mono text-slate-500 font-normal">
                        (ИНН: {sellerInn})
                      </span>
                    </h2>

                    {/* Fast Copy Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopySellerData('all')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-emerald-600" />
                        <span>Копировать ИНН + ФИО</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopySellerData('inn')}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono border border-slate-200 transition-colors cursor-pointer"
                      >
                        Копировать ИНН: {sellerInn}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopySellerData('name')}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] border border-slate-200 transition-colors cursor-pointer"
                      >
                        Копировать ФИО: {sellerFullName}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <span>
                      Договор ДДУ: <strong className="text-slate-800">{lot.ownerDossier.dduNumber}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Застройщик: <strong className="text-slate-800">{lot.developer}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      ЖК: <strong className="text-slate-800">{lot.complexName}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Локация:{' '}
                      <strong className="text-slate-800">
                        {getRegionByCode(lot.city).shortLabelRu}, {lot.district}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* DYNAMIC RISK-WEIGHTED INDEX CARD */}
                <div className={`rounded-3xl p-6 text-right space-y-1.5 shrink-0 w-full lg:w-80 shadow-sm border transition-all ${
                  isIndexSufficient && !hasCriticalRisk
                    ? 'bg-emerald-50/80 border-emerald-300'
                    : 'bg-rose-50/80 border-rose-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                      ИНДЕКС ЮРИДИЧЕСКОЙ ЧИСТОТЫ:
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                      (Порог: 85%)
                    </span>
                  </div>

                  <div className={`text-5xl font-black font-mono tracking-tight ${
                    isIndexSufficient && !hasCriticalRisk ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {weightedIndex} / 100
                  </div>

                  <div className="flex items-center justify-end space-x-1 pt-1">
                    <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                      isIndexSufficient && !hasCriticalRisk
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-rose-600 text-white shadow-xs'
                    }`}>
                      {isIndexSufficient && !hasCriticalRisk ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Высокая чистота (Готов к допуску)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Критический риск (Блокировка)</span>
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 pt-0.5">
                    Взвешенный показатель 4 контрольных зон (ЕФРСБ 25% + ФССП 15% + Суды 15% + ДДУ/СФР 45%)
                  </p>
                </div>
              </div>

              {/* Cloud Document Vault Bar (Yandex S3) */}
              <div className="bg-indigo-950 text-white rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    <HardDrive className="w-4 h-4" />
                    <span>ОБЛАЧНЫЙ СЕЙФ ДОКУМЕНТОВ ДОЛЬЩИКА (YANDEX OBJECT STORAGE S3)</span>
                  </div>
                  <h3 className="text-base font-bold">
                    Оригиналы и сканы по лоту #{lot.lotCode} (ДДУ, Справка об оплате, СФР, Выписка)
                  </h3>
                  <p className="text-xs text-indigo-200/80">
                    Откройте сейф для постраничной сверки реквизитов, утверждения каждого документа или дозагрузки справок.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVaultOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all shrink-0 flex items-center space-x-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Открыть и проверить документы в S3</span>
                </button>
              </div>

              {/* 2. THE 4 RE-ENGINEERED INTERACTIVE AUDIT CHECKPOINTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>Интерактивные контрольные зоны юридического аудита (42 параметра 214-ФЗ)</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Кликните «Инспектировать» для сверки с официальными реестрами РФ
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {checkpoints.map((cp) => {
                    const isClean = cp.status === 'clean' && cp.score >= 8;
                    const isAttention = cp.status === 'attention' || (cp.score >= 5 && cp.score < 8);
                    const isCritical = cp.status === 'critical' || cp.score < 5;
                    const hasProof = Boolean(cp.proofDocName || cp.proofDocUrl);

                    return (
                      <div
                        key={cp.id}
                        className={`bg-white rounded-3xl p-6 space-y-4 shadow-xs border transition-all ${
                          isCritical
                            ? 'border-rose-300 ring-2 ring-rose-500/10'
                            : isAttention
                            ? 'border-amber-300 ring-2 ring-amber-500/10'
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-100">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[10px] font-bold">
                                Вес: {cp.weightPercent}%
                              </span>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                {cp.title}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono font-black border border-slate-200">
                              {cp.score} / 10
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              isClean
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isAttention
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {isClean ? 'ЧИСТО' : isAttention ? 'ВНИМАНИЕ' : 'КРИТИЧЕСКИЙ РИСК'}
                            </span>
                          </div>
                        </div>

                        {/* Curator Observations Note */}
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {cp.notes}
                        </p>

                        {/* Proof Document Status */}
                        <div className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-200 bg-white">
                          <div className="flex items-center space-x-2 truncate">
                            {hasProof ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            )}
                            <span className="font-semibold truncate">
                              {hasProof
                                ? `Скан: ${cp.proofDocName || 'Подтверждающий_акт.pdf'}`
                                : 'Подтверждающий скан не прикреплен'}
                            </span>
                          </div>

                          {hasProof ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (cp.id === 'efrsb') handleDownloadProtocol('EFRSB');
                                else if (cp.id === 'fssp') handleDownloadProtocol('FSSP');
                                else {
                                  FileManager.downloadFile(
                                    `data:text/plain;charset=utf-8,Протокол проверки ${encodeURIComponent(cp.shortLabel)} по лоту #${currentLotCode}`,
                                    `Протокол_${cp.id}_${currentLotCode}.txt`
                                  );
                                }
                              }}
                              className="text-[11px] font-bold text-slate-700 hover:text-emerald-700 flex items-center space-x-1 shrink-0 ml-2 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Выгрузить</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-rose-600 font-bold uppercase shrink-0">
                              Требуется скан
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <a
                            href={cp.portalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-slate-200 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                            <span>Открыть реестр РФ</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleOpenInspector(cp)}
                            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Инспектировать</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CRITICAL RISK HARD-LOCK BANNER */}
              {!isApprovalEligible && (
                <div className="p-5 rounded-3xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-2 shadow-sm animate-fade-in">
                  <div className="flex items-center space-x-2 font-black text-sm text-rose-900">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Объект содержит критические юридические риски — вывод в каталог заблокирован</span>
                  </div>
                  <ul className="text-xs text-rose-900/90 list-disc list-inside space-y-1 font-semibold">
                    {!isIndexSufficient && (
                      <li>
                        Итоговый индекс чистоты ({weightedIndex}%) ниже минимального регуляторного порога 85%.
                      </li>
                    )}
                    {!allCheckpointsHaveProof && (
                      <li>
                        Не во всех 4 контрольных зонах прикреплены официальные подтверждающие сканы/выписки.
                      </li>
                    )}
                    {hasCriticalRisk && (
                      <li>
                        Один или несколько чекпоинтов оценены в зоне критического риска (оценка 4 балла или ниже).
                      </li>
                    )}
                  </ul>
                  <p className="text-[11px] text-rose-800 italic pt-1">
                    Для разблокировки кнопки утверждения куратор обязан устранить риски, прикрепить официальные выписки и повысить взвешенный индекс до 85%+.
                  </p>
                </div>
              )}

              {/* 3. Legal Memo Generator for Bona Fide Purchaser Protection */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-slate-900">
                      Генератор правового обоснования цены добросовестного приобретателя
                    </h3>
                    <span className="text-xs text-emerald-700">
                      Защита сделки по ст. 302 ГК РФ и ст. 61.2 ФЗ-127 от оспаривания цены
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMemo}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{memoCopied ? 'Скопировано в буфер!' : 'Скопировать в договор цессии'}</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 leading-relaxed whitespace-pre-line">
                  {getMemoText()}
                </div>

                <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={includePlenum63}
                    onChange={(e) => setIncludePlenum63(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <span>Включить ссылку на Постановление Пленума ВАС РФ № 63</span>
                </label>
              </div>

              {/* 4. Operations Log */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      Журнал операций куратора (Аудиторский след решений по лоту #{lot.lotCode})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {lot.curatorOperationsLog?.length || 0} записей
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Точное время (Timestamp)</th>
                        <th className="py-2.5 px-3">Ответственный юрист / сотрудник</th>
                        <th className="py-2.5 px-3">Действие / Решение</th>
                        <th className="py-2.5 px-3">Подробности / Примечания</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {lot.curatorOperationsLog && lot.curatorOperationsLog.length > 0 ? (
                        lot.curatorOperationsLog.map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString('ru-RU')}
                            </td>
                            <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                              {log.curatorName}
                            </td>
                            <td className="py-2.5 px-3 font-sans font-semibold text-indigo-700">
                              {log.action}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-600">{log.notes}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400 font-sans">
                            Пока нет зафиксированных операций по данному лоту.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. Decision Bar with Hard Gating */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                    ЮР
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{curatorName}</span>
                    <span className="text-[11px] text-slate-500 block">
                      Комплаенс и правовой аудит 214-ФЗ / 127-ФЗ • Индекс: {weightedIndex}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsSpecialBankModalOpen(true)}
                    className="px-3.5 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Запрос спец-одобрения в банк</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRequestDocsModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                  >
                    Запросить доп. документы
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                  >
                    ✕ Отклонить (Высокий риск)
                  </button>

                  {/* HARD-LOCKED APPROVAL BUTTON */}
                  <button
                    type="button"
                    disabled={!isApprovalEligible}
                    onClick={handleApproveLegal}
                    title={
                      !isApprovalEligible
                        ? 'Утверждение заблокировано: индекс чистоты ниже 85% либо отсутствуют подтверждающие сканы'
                        : 'Утвердить юридический паспорт объекта'
                    }
                    className={`px-6 py-2.5 rounded-xl font-black text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer ${
                      isApprovalEligible
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                    }`}
                  >
                    {isApprovalEligible ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Утвердить: Выдать штамп «Документы проверены»</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CHECKPOINT INSPECTOR MODAL */}
      {inspectingCheckpoint && lot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                  Вес в формуле: {inspectingCheckpoint.weightPercent}%
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Инспекция контрольной зоны: {inspectingCheckpoint.shortLabel}
                </h3>
                <p className="text-xs text-slate-500">
                  Лот #{lot.lotCode} ({lot.complexName}) • Дольщик: {sellerFullName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectingCheckpoint(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Registry Link & Data Copy Box */}
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                  Быстрый переход к официальной базе РФ
                </span>
                <a
                  href={inspectingCheckpoint.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <span>Открыть реестр</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopySellerData('inn')}
                  className="p-2.5 rounded-xl bg-white hover:bg-indigo-100 text-slate-800 text-xs font-mono font-bold border border-indigo-200 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>ИНН: {sellerInn}</span>
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCopySellerData('name')}
                  className="p-2.5 rounded-xl bg-white hover:bg-indigo-100 text-slate-800 text-xs font-bold border border-indigo-200 flex items-center justify-between transition-colors cursor-pointer truncate"
                >
                  <span className="truncate">{sellerFullName}</span>
                  <Copy className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveInspectorVerdict} className="space-y-5">
              {/* Score & Status Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Оценка надежности (от 1 до 10 баллов):
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={editScore}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setEditScore(val);
                        if (val >= 8) setEditStatus('clean');
                        else if (val >= 5) setEditStatus('attention');
                        else setEditStatus('critical');
                      }}
                      className="flex-1 accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-base font-black font-mono w-12 text-center py-1 bg-slate-100 rounded-lg border border-slate-200">
                      {editScore}/10
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Статус правового заключения:
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="clean">ЧИСТО (Рисков не выявлено, 8-10 баллов)</option>
                    <option value="attention">ВНИМАНИЕ (Требует контроля, 5-7 баллов)</option>
                    <option value="critical">КРИТИЧЕСКИЙ РИСК (Блокировка сделки, 1-4 балла)</option>
                  </select>
                </div>
              </div>

              {/* Proof Document Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Подтверждающий официальный скан / выписка из реестра (PDF/JPG) *
                </label>
                <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5 truncate">
                    <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {editProofName || 'Файл подтверждения пока не прикреплен'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isUploadingProof}
                    onClick={handleUploadProofFile}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploadingProof ? 'Загрузка...' : 'Выбрать файл'}</span>
                  </button>
                </div>
              </div>

              {/* Curator Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Заключение и замечания юриста-куратора:
                </label>
                <textarea
                  rows={3}
                  required
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Укажите реквизиты выписки, отсутствие запретов или выявленные замечания..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectingCheckpoint(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Сохранить вердикт инспекции</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Request Additional Docs */}
      {isRequestDocsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Запросить недостающие документы у продавца
              </h3>
              <button
                type="button"
                onClick={() => setIsRequestDocsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestDocsSubmit} className="space-y-4">
              <p className="text-xs text-slate-600">
                Выберите документы, которые продавец должен прикрепить в своем личном кабинете:
              </p>

              <div className="space-y-2 text-xs">
                {[
                  'Справка об отсутствии задолженности от застройщика',
                  'Справка из СФР об остатке материнского капитала',
                  'Нотариальное согласие супруга(и) на сделку',
                  'Справка из банка об открытии эскроу-счета',
                  'Копия паспорта с отметкой о регистрации',
                ].map((docName) => (
                  <label key={docName} className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocsList.includes(docName)}
                      onChange={() => toggleDocItem(docName)}
                      className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                    />
                    <span className="text-slate-800">{docName}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Примечание / Комментарий для продавца:
                </label>
                <textarea
                  rows={2}
                  value={docsNotes}
                  onChange={(e) => setDocsNotes(e.target.value)}
                  placeholder="Поясните причину запроса документов..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestDocsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Отправить запрос продавцу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reject Legal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">
                  Отклонение объекта по правовым рискам
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectLegal} className="space-y-4">
              <p className="text-xs text-slate-600">
                Укажите причину отказа. Объект получит статус «Отклонено» и не будет допущен к витрине каталога и подбору покупателей:
              </p>

              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Например: Обнаружены активные исполнительные производства или риски банкротства..."
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-rose-500"
              />

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Подтвердить отклонение
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Special Bank Approval */}
      {isSpecialBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-indigo-600">
                <Building2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">
                  Запрос специального одобрения в банк-партнёр
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSpecialBankModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSpecialBankApprovalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Выберите банк для отправки спец-запроса:
                </label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                >
                  <option value="Сбербанк">Сбербанк</option>
                  <option value="ВТБ">Банк ВТБ</option>
                  <option value="Альфа-Банк">Альфа-Банк</option>
                  <option value="ДОМ.РФ">Банк ДОМ.РФ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Обоснование нетиповой аккредитации:
                </label>
                <textarea
                  rows={3}
                  required
                  value={bankSpecialReason}
                  onChange={(e) => setBankSpecialReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSpecialBankModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Направить в кредитный комитет
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
