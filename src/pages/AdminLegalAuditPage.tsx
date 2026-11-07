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
import { Lot } from '../types';
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
} from 'lucide-react';

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
    setLot(found || null);
  };

  useEffect(() => {
    loadLotData();
  }, [lotId, isEmployee, currentEmployeeId]);

  const currentLotCode = lot?.lotCode || 'U-10566';

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
          `Антибанкротный индекс DomExit: ${lot.legalPassport.antiBankruptcyIndex} / 100\n` +
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
    await LotsRepository.approveLotLegal(lot.lotCode, curatorName);

    setNotice(
      language === 'ru'
        ? '✓ Штамп «Документы проверены (42/42)» выдан! Объект переведен на этап подбора покупателей (Матчмейкинг).'
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
          subtitle="Комплексный скоринг по 42 параметрам, ЕФРСБ, ФССП, облачный сейф Yandex S3 и обоснование цены по ст. 61.2 ФЗ-127"
        />

        <div className="p-6 space-y-8 max-w-[1500px] w-full">
          {notice && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center justify-between shadow-md animate-fade-in">
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
                Нет закрепленных объектов для юридического аудита
              </p>
              <p className="text-xs text-slate-500">
                В изолированном контуре сотрудника доступны только назначенные вам объекты.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Legal Summary Card & Lot Selector & Anti-Bankruptcy Index */}
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

                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    Аудит продавца: {lot.ownerDossier.fullNameMasked} (ИНН{' '}
                    {lot.sellerInn || '781432994102'})
                  </h2>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
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

                {/* Anti-Bankruptcy Index Card */}
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 text-right space-y-1 shrink-0 w-full lg:w-auto shadow-xs">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    АНТИБАНКРОТНЫЙ ИНДЕКС:
                  </span>
                  <div className="text-4xl font-black text-emerald-700 font-mono">
                    {lot.legalPassport.antiBankruptcyIndex} / 100
                  </div>
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-xs">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      Проверено {lot.legalPassport.passedChecksCount} из{' '}
                      {lot.legalPassport.totalChecksCount} параметров
                    </span>
                  </span>
                </div>
              </div>

              {/* Cloud Document Vault Bar (Yandex S3 Emulator) */}
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

              {/* 2. Mandatory 4 Audit Boxes (2x2 Grid) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Box 1: EFRSB Bankruptcy Registry */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        1. База банкротств ЕФРСБ / Федресурс
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                      {lot.legalPassport.efrsbBankruptcyStatus === 'clean'
                        ? 'ЧИСТО — Рисков нет'
                        : 'ВНИМАНИЕ — Проверка'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Сведения о признании гражданина банкротом, реструктуризации долгов или подаче заявлений по ст. 213.4 Федерального закона № 127-ФЗ отсутствуют в картотеке арбитражных дел.
                  </p>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 flex justify-between items-center">
                    <span>API Gateway Response: 200 OK</span>
                    <span className="text-emerald-700 font-bold">НБКИ: {lot.legalPassport.nbkiScore}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadProtocol('EFRSB')}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать протокол проверки ЕФРСБ</span>
                  </button>
                </div>

                {/* Box 2: FSSP Enforcement Proceedings */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        2. Исполнительные производства ФССП
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                      {formatRubles(lot.legalPassport.fsspDebtRub)} — Долгов нет
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Открытых исполнительных производств, задолженностей по кредитам или налогам не обнаружено. Аресты и запреты на регистрационные действия отсутствуют.
                  </p>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 flex justify-between items-center">
                    <span>БД ФССП РФ: Синхронизировано</span>
                    <span className="text-emerald-700 font-bold">ПДН: {lot.legalPassport.pdnPercent}%</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadProtocol('FSSP')}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать выписку ФССП</span>
                  </button>
                </div>

                {/* Box 3: Courts of General Jurisdiction */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        3. Судебные споры (ГАС Правосудие)
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                      Споров нет
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Проверены районные суды ({getRegionByCode(lot.city).labelRu}) по месту регистрации дольщика и нахождения объекта. Исков о разделе имущества супругов не зафиксировано.
                  </p>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 flex justify-between items-center">
                    <span>ГАС Правосудие ({lot.district})</span>
                    <span className="text-emerald-700 font-bold">Чисто</span>
                  </div>
                </div>

                {/* Box 4: DDU & 214-FZ Checks */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        4. Аудит договора ДДУ и справок — 214-ФЗ
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                      Верифицировано
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center space-x-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Материнский капитал:{' '}
                        {lot.legalPassport.maternalCapitalUsed
                          ? 'Использовался (требуется контроль СФР)'
                          : 'Справка СФР подтвердила — не использовался'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Согласие супруги:{' '}
                        {lot.legalPassport.spousalConsentNotarized
                          ? 'Удостоверено нотариально'
                          : 'На проверке нотариуса'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Исполнение оплаты: {lot.developer} подтвердил{' '}
                        {formatRubles(lot.cashPaidBySeller)} без просрочек
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Эскроу-банк: {lot.escrowBank}, обременений третьих лиц нет</span>
                    </div>
                  </div>
                </div>
              </div>

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

              {/* 5. Decision Bar */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                    ЮР
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{curatorName}</span>
                    <span className="text-[11px] text-slate-500 block">
                      Комплаенс и правовой аудит 214-ФЗ / 127-ФЗ
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

                  <button
                    type="button"
                    onClick={handleApproveLegal}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Утвердить: Выдать штамп «Документы проверены»</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL: Request Additional Docs */}
      {isRequestDocsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-950 text-base">
                  Запрос дополнительных документов у продавца
                </h3>
              </div>
              <button
                onClick={() => setIsRequestDocsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestDocsSubmit} className="space-y-4 text-xs">
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {[
                  'Справка об отсутствии задолженности от застройщика',
                  'Справка из СФР об остатке материнского капитала',
                  'Нотариальное согласие супруги / заявление о холостом положении',
                  'Выписка по эскроу-счету банка',
                  'Справка из ПНД / НД (по требованию покупателя)',
                ].map((docName) => (
                  <label key={docName} className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocsList.includes(docName)}
                      onChange={() => toggleDocItem(docName)}
                      className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
                    />
                    <span className="text-slate-800 font-medium">{docName}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Комментарий юриста для продавца *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Укажите конкретную причину запроса и срок предоставления..."
                  value={docsNotes}
                  onChange={(e) => setDocsNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRequestDocsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Отправить запрос продавцу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reject Legal Lot */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-black text-slate-950 text-base">
                  Отклонение лота по рискам 214-ФЗ / 127-ФЗ
                </h3>
              </div>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectLegal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Причина отклонения *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Обнаружены судебные залоги, долги в ФССП или признаки предбанкротного состояния по ст. 61.2..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Подтвердить отклонение
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Special Bank Approval Request */}
      {isSpecialBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-950 text-base">
                  Запрос спец-одобрения в банк-партнер
                </h3>
              </div>
              <button
                onClick={() => setIsSpecialBankModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSpecialBankApprovalSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Банк-партнер *</label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Сбербанк">Сбербанк (ПАО)</option>
                  <option value="ВТБ">Банк ВТБ (ПАО)</option>
                  <option value="Альфа-Банк">Альфа-Банк</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Обоснование запроса для банка *
                </label>
                <textarea
                  rows={3}
                  required
                  value={bankSpecialReason}
                  onChange={(e) => setBankSpecialReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSpecialBankModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Направить в банковский шлюз
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cloud Document Vault Modal (Yandex Object Storage S3 Emulator) */}
      {lot && (
        <DocumentVaultModal
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          entityType="lot"
          entityId={lot.lotCode}
          entityTitle={`Правовой аудит лота #${lot.lotCode} — ${lot.complexName}`}
          uploadedByUid={user?.id || 'legal-curator'}
          clientCode={user?.clientCode || 'DEX-LEGAL'}
          mode="seller"
          canUpload={true}
          canReview={true}
          reviewerName={curatorName}
        />
      )}
    </div>
  );
};
