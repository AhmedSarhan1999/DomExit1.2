import React, { useState } from 'react';
import {
  UserCheck,
  Eye,
  EyeOff,
  Ban,
  Trash2,
  Users,
  Check,
  Crown,
  Building2,
  Edit,
  Save,
  X,
  Lock,
  HardDrive,
  FileText,
} from 'lucide-react';
import {
  AccreditedDeveloper,
  DeveloperAccreditationRequest,
  DeveloperBankTerms,
  DocumentMetadata,
  Employee,
  InvestorApplication,
  Lot,
  PartnerEntry,
  RussianCityCode,
  SellerExitRequest,
} from '../../../types';
import { formatRubles } from '../../../utils/formatters';
import { getRegionByCode } from '../../../data/russianGeography';
import { LotsRepository } from '../../../dal/repositories/LotsRepository';
import { SellerRequestsRepository } from '../../../dal/repositories/SellerRequestsRepository';
import { PartnersRepository } from '../../../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../../../dal/repositories/InvestorClubRepository';
import { DevelopersRepository } from '../../../dal/repositories/DevelopersRepository';

export interface SellerRequestsTableTabProps {
  lots: Lot[];
  sellerRequests: SellerExitRequest[];
  pendingSellerCount: number;
  employees: Employee[];
  partners: PartnerEntry[];
  pendingPartnerCount: number;
  investors: InvestorApplication[];
  pendingInvestorCount: number;
  developerRequests: DeveloperAccreditationRequest[];
  pendingDevReqCount: number;
  developersList: AccreditedDeveloper[];
  enableVipClub: boolean;
  isOwner: boolean;
  operatorName: string;
  loadAllData: () => Promise<void>;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
  onOpenDocumentVault: (config: {
    isOpen: boolean;
    entityType: DocumentMetadata['entityType'];
    entityId: string;
    entityTitle: string;
    mode: 'seller' | 'general';
  }) => void;
  modalLotExternal?: Lot | null;
  onCloseExternalModalLot?: () => void;
}

export const SellerRequestsTableTab: React.FC<SellerRequestsTableTabProps> = ({
  lots,
  sellerRequests,
  pendingSellerCount,
  employees,
  partners,
  pendingPartnerCount,
  investors,
  pendingInvestorCount,
  developerRequests,
  pendingDevReqCount,
  developersList,
  enableVipClub,
  isOwner,
  operatorName,
  loadAllData,
  showToast,
  showError,
  onOpenDocumentVault,
  modalLotExternal,
  onCloseExternalModalLot,
}) => {
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, string>>({});

  const onSelectEmployeeForLot = (lotId: string, employeeId: string) => {
    setSelectedEmployees((prev) => ({ ...prev, [lotId]: employeeId }));
  };

  const handleApproveAndAssignLot = async (lot: Lot, specificEmpId?: string) => {
    const empId = specificEmpId || selectedEmployees[lot.id] || lot.assignedEmployeeId;
    if (!empId) {
      showError('Выберите штатного куратора для закрепления объекта перед одобрением.');
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    await SellerRequestsRepository.approveAndAssign(lot.lotCode, emp.id, emp.name, operatorName);
    showToast(`Заявка #${lot.lotCode} одобрена и закреплена за куратором: ${emp.name}`);
    setModalLot(null);
    await loadAllData();
  };

  const handleUnpublishLot = async (lot: Lot) => {
    if (!confirm(`Снять лот #${lot.lotCode} с публикации? Он перестанет отображаться в каталоге и на витрине.`)) return;
    try {
      await LotsRepository.unpublishLot(lot.lotCode, operatorName);
      showToast(`Лот #${lot.lotCode} снят с публикации и переведен в черновик.`);
      await loadAllData();
    } catch (err: any) {
      showError(err?.message || 'Ошибка при снятии с публикации');
    }
  };

  const handleBlockLot = async (lot: Lot) => {
    const reason = prompt(`Укажите причину блокировки лота #${lot.lotCode}:`, 'Нарушение регламента платформы или правил публикации');
    if (!reason) return;
    try {
      await LotsRepository.blockLot(lot.lotCode, reason, operatorName);
      showToast(`Лот #${lot.lotCode} успешно заблокирован.`);
      await loadAllData();
    } catch (err: any) {
      showError(err?.message || 'Ошибка блокировки лота');
    }
  };

  const handleDeleteLot = async (lot: Lot) => {
    if (!confirm(`ВНИМАНИЕ! Безвозвратно удалить лот #${lot.lotCode}, связанную сделку и все заявки? Это действие необратимо.`)) return;
    try {
      await LotsRepository.deleteLotAndDeal(lot.lotCode, operatorName);
      showToast(`Лот #${lot.lotCode} и связанные сущности успешно удалены.`);
      await loadAllData();
    } catch (err: any) {
      showError(err?.message || 'Ошибка удаления лота');
    }
  };

  const handleApprovePartner = async (partnerId: string) => {
    await PartnersRepository.approve(partnerId, operatorName);
    showToast('Статус Партнера B2B одобрен! Реферальный кабинет активирован.');
    await loadAllData();
  };

  const handleApproveInvestor = async (investorId: string) => {
    await InvestorClubRepository.approve(investorId, operatorName);
    showToast('Статус VIP Инвестора подтвержден! Приоритетный ранний доступ (48ч) открыт.');
    await loadAllData();
  };

  const handleApproveDeveloperRequest = async (requestId: string) => {
    try {
      const res = await DevelopersRepository.approveAccreditationRequest(requestId, operatorName);
      if (res) {
        showToast(`Застройщик «${res.developer.name}» успешно аккредитован и добавлен в общий реестр!`);
      }
      await loadAllData();
    } catch (e: any) {
      showError(`Ошибка при аккредитации: ${e?.message || 'Сбой'}`);
    }
  };

  const handleRejectDeveloperRequest = async (requestId: string) => {
    if (!confirm('Отклонить заявку на добавление застройщика?')) return;
    try {
      await DevelopersRepository.rejectAccreditationRequest(requestId, operatorName);
      showToast('Заявка на добавление застройщика отклонена.');
      await loadAllData();
    } catch (e: any) {
      showError(`Ошибка при отклонении: ${e?.message || 'Сбой'}`);
    }
  };

  const handleSaveDeveloperEdit = async (id: string, name: string, inn: string) => {
    try {
      const updated = await DevelopersRepository.updateDeveloper(id, { name, inn }, operatorName);
      if (updated) {
        showToast(`Застройщик «${updated.name}» успешно обновлен!`);
        await loadAllData();
      }
    } catch (e: any) {
      showError(`Ошибка при сохранении: ${e?.message || 'Сбой'}`);
    }
  };

  const handleToggleDeveloperActive = async (developerId: string) => {
    try {
      const updated = await DevelopersRepository.toggleDeveloperActive(developerId, operatorName);
      if (updated) {
        showToast(
          updated.isActive !== false
            ? `Застройщик «${updated.name}» теперь активен и отображается в анкетах продавцов.`
            : `Застройщик «${updated.name}» скрыт из списка в анкетах продавцов.`
        );
        await loadAllData();
      }
    } catch (e: any) {
      showError(`Ошибка изменения статуса застройщика: ${e?.message || 'Сбой'}`);
    }
  };

  const handleDeleteDeveloper = async (developerId: string, devName: string) => {
    if (!confirm(`ВНИМАНИЕ! Вы действительно хотите безвозвратно удалить застройщика «${devName}» из реестра платформы?`)) {
      return;
    }
    try {
      const ok = await DevelopersRepository.deleteDeveloper(developerId, operatorName);
      if (ok) {
        showToast(`Застройщик «${devName}» безвозвратно удален из базы данных.`);
        await loadAllData();
      }
    } catch (e: any) {
      showError(`Ошибка при удалении застройщика: ${e?.message || 'Сбой'}`);
    }
  };

  // Modal states
  const [internalModalLot, setInternalModalLot] = useState<Lot | null>(null);
  const modalLot = modalLotExternal !== undefined ? modalLotExternal : internalModalLot;
  const setModalLot = (lot: Lot | null) => {
    setInternalModalLot(lot);
    if (!lot && onCloseExternalModalLot) {
      onCloseExternalModalLot();
    }
  };

  const [lotActionMode, setLotActionMode] = useState<'approve' | 'request_docs' | 'reject'>('approve');
  const [lotRequestedDocs, setLotRequestedDocs] = useState<string[]>([
    'Скан договора ДДУ со штампом Росреестра',
    'Справка об оплате от застройщика с печатью',
  ]);
  const [lotDocsNotes, setLotDocsNotes] = useState<string>('');
  const [lotRejectReason, setLotRejectReason] = useState<string>('');

  const [modalPartner, setModalPartner] = useState<PartnerEntry | null>(null);
  const [partnerActionMode, setPartnerActionMode] = useState<'approve' | 'request_docs' | 'reject'>('approve');
  const [partnerActionNote, setPartnerActionNote] = useState<string>('');

  const [modalInvestor, setModalInvestor] = useState<InvestorApplication | null>(null);
  const [investorActionMode, setInvestorActionMode] = useState<'approve' | 'request_docs' | 'reject'>('approve');
  const [investorActionNote, setInvestorActionNote] = useState<string>('');

  const [editingDeveloper, setEditingDeveloper] = useState<{ id: string; name: string; inn: string } | null>(null);

  const findSellerRequestForLot = (lotCode: string): SellerExitRequest | undefined =>
    sellerRequests.find((r) => r.lotCode.toUpperCase() === lotCode.toUpperCase());

  const handlePartnerModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPartner) return;
    if (partnerActionMode === 'approve') {
      await handleApprovePartner(modalPartner.id);
    } else if (partnerActionMode === 'request_docs') {
      await PartnersRepository.requestDocs(modalPartner.id, partnerActionNote.trim(), operatorName);
      showToast(`Запрос дополнительных документов отправлен партнеру.`);
      await loadAllData();
    } else {
      await PartnersRepository.reject(modalPartner.id, partnerActionNote.trim(), operatorName);
      showToast(`Заявка партнера отклонена.`);
      await loadAllData();
    }
    setModalPartner(null);
  };

  const handleInvestorModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInvestor) return;
    if (investorActionMode === 'approve') {
      await handleApproveInvestor(modalInvestor.id);
    } else if (investorActionMode === 'request_docs') {
      await InvestorClubRepository.requestDocs(modalInvestor.id, investorActionNote.trim(), operatorName);
      showToast(`Запрос подтверждения капитала направлен инвестору.`);
      await loadAllData();
    } else {
      await InvestorClubRepository.reject(modalInvestor.id, investorActionNote.trim(), operatorName);
      showToast(`Заявка VIP-инвестора отклонена.`);
      await loadAllData();
    }
    setModalInvestor(null);
  };

  const handleRequestSellerDocsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalLot) return;
    await SellerRequestsRepository.requestAdditionalDocs(
      modalLot.lotCode,
      lotRequestedDocs,
      lotDocsNotes.trim() || 'Требуется загрузить читаемые оригиналы сканов для юридической верификации.',
      operatorName
    );
    showToast(`Запрос дополнительных документов отправлен продавцу по лоту #${modalLot.lotCode}!`);
    setModalLot(null);
    await loadAllData();
  };

  const handleRejectSellerLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalLot) return;
    await SellerRequestsRepository.rejectRequest(modalLot.lotCode, lotRejectReason.trim(), operatorName);
    showToast(`Заявка по лоту #${modalLot.lotCode} отклонена. Причина зафиксирована в журнале аудита.`);
    setModalLot(null);
    await loadAllData();
  };

  return (
    <div className="space-y-6">
      {/* OWNER TRIAGE DESK 1: Seller Exit Requests & Curator Assignment */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <span>Стол рассмотрения заявок продавцов и назначения куратора (Owner Only)</span>
              {pendingSellerCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black">
                  {pendingSellerCount} ожидают решения
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Проверьте загруженные продавцом оригиналы ДДУ/СФР в хранилище документов, закрепите куратора, запросите доп. документы или отклоните с причиной.
            </p>
          </div>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
            Штат: {employees.length} кураторов
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Код лота</th>
                <th className="py-3 px-3">Регион / ЖК / Застройщик</th>
                <th className="py-3 px-3">Возврат продавцу</th>
                <th className="py-3 px-3">Статус комплаенса</th>
                <th className="py-3 px-3">Ответственный куратор</th>
                <th className="py-3 px-3 text-right">Полный аудит / Решение</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.map((lot) => {
                const region = getRegionByCode(lot.city);
                const isPendingOwner = lot.approvalStatus === 'pending_owner_approval';
                const isDocsReq = lot.additionalDocsRequested?.status === 'pending';
                const isRejected = lot.approvalStatus === 'rejected';

                return (
                  <tr
                    key={lot.id}
                    className={`transition-colors ${
                      isPendingOwner
                        ? 'bg-amber-50/40 hover:bg-amber-50/80'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      <div>#{lot.lotCode}</div>
                      {isPendingOwner && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black uppercase">
                          НОВАЯ ЗАЯВКА
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 block">{lot.complexName}</span>
                      <span className="text-[10px] text-slate-500">
                        {region.shortLabelRu}, {lot.district} • {lot.developer} • {lot.areaM2} м²
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <span className="font-bold text-emerald-700 block">
                        {formatRubles(lot.cashPaidBySeller)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ДДУ: {formatRubles(lot.dduContractPrice)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {lot.status === 'blocked' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          Заблокирован
                        </span>
                      ) : isRejected ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Отклонен
                        </span>
                      ) : isDocsReq ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          Запрошены док-ты
                        </span>
                      ) : isPendingOwner ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Ожидает решения
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Одобрен ✓
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={selectedEmployees[lot.id] || lot.assignedEmployeeId || ''}
                        onChange={(e) => onSelectEmployeeForLot(lot.id, e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[190px]"
                      >
                        <option value="">Не назначен</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.role.slice(0, 15)})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setModalLot(lot);
                            setLotActionMode(isPendingOwner ? 'approve' : 'approve');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                        >
                          Досье
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApproveAndAssignLot(lot, selectedEmployees[lot.id])}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          {isPendingOwner ? 'Одобрить' : 'Закрепить'}
                        </button>

                        {isOwner && (
                          <div className="flex items-center space-x-1 pl-1 border-l border-slate-200">
                            {lot.isPublished && lot.status !== 'draft' && (
                              <button
                                type="button"
                                onClick={() => handleUnpublishLot(lot)}
                                title="Снять с публикации (в черновик)"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 transition-colors cursor-pointer"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {lot.status !== 'blocked' && (
                              <button
                                type="button"
                                onClick={() => handleBlockLot(lot)}
                                title="Заблокировать лот"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteLot(lot)}
                              title="Удалить лот и сделку навсегда"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* OWNER TRIAGE DESK 2 & 3: Partners & VIP Investors */}
      <div className={`grid grid-cols-1 ${enableVipClub ? 'lg:grid-cols-2' : ''} gap-6`}>
        {/* Partners Approval Desk */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Заявки на статус Партнера B2B ({partners.length})</span>
              {pendingPartnerCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                  +{pendingPartnerCount} новых
                </span>
              )}
            </h3>
            <span className="text-[11px] font-mono font-bold text-purple-700">
              30 000 – 50 000 ₽ / выход
            </span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {partners.map((p) => (
              <div
                key={p.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {p.organization} • {p.phone}
                    {p.inn ? ` • ИНН ${p.inn}` : ''}
                  </div>
                  <div className="text-[10px] text-purple-700 font-mono mt-0.5">
                    Код: {p.referralCode}
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setModalPartner(p);
                      setPartnerActionMode('approve');
                      setPartnerActionNote('');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                  >
                    Досье
                  </button>
                  {p.status === 'approved' ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>Одобрен</span>
                    </span>
                  ) : p.status === 'rejected' ? (
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                      Отклонен
                    </span>
                  ) : p.status === 'docs_requested' ? (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                      Доп. док-ты
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApprovePartner(p.id)}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Одобрить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investors Approval Desk (6-step Onboarding) */}
        {enableVipClub && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Crown className="w-4 h-4 text-amber-600" />
                <span>Заявки VIP Инвесторов ({investors.length})</span>
                {pendingInvestorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    +{pendingInvestorCount} новых
                  </span>
                )}
              </h3>
              <span className="text-[11px] font-mono font-bold text-amber-700">
                Ранний доступ 48ч
              </span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {investors.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate">
                      {inv.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {inv.companyOrFund || 'Частный капитал'} • Капитал: {inv.capitalVolume}
                    </div>
                    <div className="text-[10px] text-amber-700 font-semibold mt-0.5 truncate">
                      Стратегия: {inv.strategy} • {inv.targetRegions?.slice(0, 2).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setModalInvestor(inv);
                        setInvestorActionMode('approve');
                        setInvestorActionNote('');
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                    >
                      Досье 6 шагов
                    </button>
                    {inv.status === 'approved' ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Одобрен</span>
                      </span>
                    ) : inv.status === 'rejected' ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                        Отклонен
                      </span>
                    ) : inv.status === 'docs_requested' ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                        Запрос капитала
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApproveInvestor(inv.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        Одобрить VIP
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* OWNER TRIAGE DESK 4: Developer Accreditation Requests */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Заявки на добавление застройщиков (Аккредитация) ({developerRequests.length})</span>
              {pendingDevReqCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  +{pendingDevReqCount} новых
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Проверка ИНН застройщика и добавление в официальный реестр аккредитованных девелоперов платформы.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Верификация ФНС / ЕРЗ
          </span>
        </div>

        {developerRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Нет активных заявок на добавление застройщиков
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {developerRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-900">{req.developerName}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-medium">
                      ИНН: {req.developerInn || 'не указан'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(req.requestedAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    ЖК: <span className="font-semibold text-slate-800">{req.complexName || 'Не указан'}</span>
                    {req.district && ` • Район: ${req.district}`}
                    {req.city && ` • ${req.city}`}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Продавец: <span className="font-medium text-slate-700">{req.sellerName}</span> ({req.sellerClientCode})
                    {req.contractPriceRub > 0 && ` • Цена ДДУ: ${req.contractPriceRub.toLocaleString('ru-RU')} ₽`}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                  {req.status === 'approved' ? (
                    <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Аккредитован</span>
                    </span>
                  ) : req.status === 'rejected' ? (
                    <span className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
                      Отклонен
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApproveDeveloperRequest(req.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Одобрить и добавить в список</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectDeveloperRequest(req.id)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OWNER TRIAGE DESK 5: Accredited Developers Registry & Visibility Management */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Реестр аккредитованных застройщиков (Управление списком) ({developersList.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Централизованный каталог девелоперов: скрывайте застройщиков из выпадающего списка продавцов или удаляйте навсегда.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Верификация застройщика
          </span>
        </div>

        {developersList.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            В реестре пока нет девелоперов
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Застройщик / ИНН</th>
                  <th className="py-2.5 px-3">Регионы присутствия</th>
                  <th className="py-2.5 px-3">Банки-партнеры</th>
                  <th className="py-2.5 px-3">Статус показа</th>
                  <th className="py-2.5 px-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {developersList.map((dev: AccreditedDeveloper) => {
                  const isActive = dev.isActive !== false;
                  const activeBanks = (dev.bankTerms || []).filter((b: DeveloperBankTerms) => b.isAccredited);
                  const isEditing = editingDeveloper?.id === dev.id;

                  if (isEditing) {
                    return (
                      <tr key={dev.id} className="bg-indigo-50/50">
                        <td className="py-3 px-3" colSpan={2}>
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={editingDeveloper.name}
                              onChange={(e) =>
                                setEditingDeveloper({ ...editingDeveloper, name: e.target.value })
                              }
                              placeholder="Название застройщика"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <input
                              type="text"
                              value={editingDeveloper.inn}
                              onChange={(e) =>
                                setEditingDeveloper({ ...editingDeveloper, inn: e.target.value })
                              }
                              placeholder="ИНН (10 или 12 цифр)"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] text-slate-500">Редактирование реквизитов</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] text-slate-500">
                            {isActive ? 'Статус: Активен' : 'Статус: Скрыт'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                handleSaveDeveloperEdit(editingDeveloper.id, editingDeveloper.name, editingDeveloper.inn);
                                setEditingDeveloper(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center space-x-1"
                            >
                              <Save className="w-3 h-3" />
                              <span>Сохранить</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDeveloper(null)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              Отмена
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={dev.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{dev.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">ИНН: {dev.inn || '—'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {dev.regions && dev.regions.length > 0 ? (
                            dev.regions.map((r: RussianCityCode) => (
                              <span key={r} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                                {getRegionByCode(r).shortLabelRu}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[10px]">Все регионы РФ</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-700 text-[11px]">
                          {activeBanks.length > 0
                            ? activeBanks.map((b: DeveloperBankTerms) => b.bankName).join(', ')
                            : 'Ожидает аккредитации'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {isActive ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>Активен</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 inline-flex items-center space-x-1">
                            <EyeOff className="w-3 h-3" />
                            <span>Скрыт</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* 1. Редактировать */}
                          <button
                            type="button"
                            onClick={() =>
                              setEditingDeveloper({ id: dev.id, name: dev.name, inn: dev.inn || '' })
                            }
                            title="Редактировать название или ИНН"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Edit className="w-3 h-3 text-indigo-600" />
                            <span>Редактировать</span>
                          </button>

                          {/* 2. Активен / Скрыт */}
                          <button
                            type="button"
                            onClick={() => handleToggleDeveloperActive(dev.id)}
                            title={isActive ? 'Скрыть из анкет продавцов' : 'Активировать показ'}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center space-x-1 ${
                              isActive
                                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{isActive ? 'Скрыть' : 'Активен'}</span>
                          </button>

                          {/* 3. Удалить */}
                          <button
                            type="button"
                            onClick={() => handleDeleteDeveloper(dev.id, dev.name)}
                            title="Безвозвратно удалить из базы данных"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Удалить</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. Seller Lot Dossier & 3-Way Decision Modal */}
      {modalLot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-bold text-xs">
                  #{modalLot.lotCode}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Досье продавца, облачный сейф и решение Владельца
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalLot(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const sReq = findSellerRequestForLot(modalLot.lotCode);
              const region = getRegionByCode(modalLot.city);
              return (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Регион и район:</span>
                      <strong className="text-slate-900">
                        {region.shortLabelRu}, {modalLot.district}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ЖК / Девелопер:</span>
                      <strong className="text-slate-900">
                        {modalLot.complexName} ({modalLot.developer})
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Площадь / Сдача:</span>
                      <strong className="text-slate-900">
                        {modalLot.areaM2} м² • {modalLot.deliveryDate}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Цена по ДДУ:</span>
                      <strong className="text-slate-900 font-mono">
                        {formatRubles(modalLot.dduContractPrice)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Выплачено продавцом (Кэш):</span>
                      <strong className="text-emerald-700 font-mono">
                        {formatRubles(modalLot.cashPaidBySeller)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Остаток долга застройщику:</span>
                      <strong className="text-slate-800 font-mono">
                        {formatRubles(modalLot.remainingInstallmentDebt)}
                      </strong>
                    </div>
                  </div>

                  {/* 152-FZ Owner Dossier */}
                  <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-amber-900 font-bold">
                        <Lock className="w-4 h-4 text-amber-700" />
                        <span>Персональные данные дольщика:</span>
                      </div>
                      {(sReq?.referredByPartnerCode || modalLot.referredByPartnerCode) && (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                          Реф: {sReq?.referredByPartnerCode || modalLot.referredByPartnerCode}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>
                        ФИО:{' '}
                        <strong>
                          {sReq?.sellerName || modalLot.ownerDossier?.fullNameMasked}
                        </strong>
                      </div>
                      <div>
                        Телефон:{' '}
                        <strong>
                          {sReq?.sellerPhone || modalLot.ownerDossier?.phoneMasked}
                        </strong>
                      </div>
                      <div>
                        ИНН дольщика:{' '}
                        <strong className="font-mono">
                          {sReq?.sellerInn || modalLot.sellerInn || '781432994102'}
                        </strong>
                      </div>
                      <div>
                        Договор ДДУ:{' '}
                        <strong>
                          {sReq?.dduNumber || modalLot.ownerDossier?.dduNumber}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Yandex S3 Cloud Document Vault Trigger */}
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-bold text-indigo-950 flex items-center space-x-1.5">
                        <HardDrive className="w-4 h-4 text-indigo-600" />
                        <span>Хранилище документов объекта</span>
                      </span>
                      <p className="text-[11px] text-indigo-800/80">
                        Просмотр, скачивание и индивидуальное утверждение сканов ДДУ, справок об оплате и СФР.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDocumentVault({
                          isOpen: true,
                          entityType: 'lot',
                          entityId: modalLot.lotCode,
                          entityTitle: `Досье объекта #${modalLot.lotCode} (${modalLot.complexName})`,
                          mode: 'seller',
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Открыть сейф документов</span>
                    </button>
                  </div>

                  {/* 3-Way Decision Switcher */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setLotActionMode('approve')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          lotActionMode === 'approve'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        1. Одобрить и назначить куратора
                      </button>
                      <button
                        type="button"
                        onClick={() => setLotActionMode('request_docs')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          lotActionMode === 'request_docs'
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        2. Запросить доп. документы
                      </button>
                      <button
                        type="button"
                        onClick={() => setLotActionMode('reject')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          lotActionMode === 'reject'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        3. Отклонить с причиной
                      </button>
                    </div>

                    {lotActionMode === 'approve' && (
                      <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
                        <label className="block font-bold text-slate-800">
                          Выберите ответственного штатного куратора для ведения объекта:
                        </label>
                        <select
                          value={
                            selectedEmployees[modalLot.id] || modalLot.assignedEmployeeId || ''
                          }
                          onChange={(e) => onSelectEmployeeForLot(modalLot.id, e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 font-semibold"
                        >
                          <option value="">Выберите куратора...</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} — {emp.role}
                            </option>
                          ))}
                        </select>
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setModalLot(null)}
                            className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleApproveAndAssignLot(modalLot, selectedEmployees[modalLot.id]);
                              setModalLot(null);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer"
                          >
                            ✓ Утвердить заявку и закрепить куратора
                          </button>
                        </div>
                      </div>
                    )}

                    {lotActionMode === 'request_docs' && (
                      <form
                        onSubmit={handleRequestSellerDocsSubmit}
                        className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3"
                      >
                        <span className="font-bold text-amber-950 block">
                          Отметьте документы для дозагрузки в Личном кабинете продавца:
                        </span>
                        <div className="space-y-1.5">
                          {[
                            'Скан договора ДДУ со штампом Росреестра',
                            'Справка об оплате от застройщика с печатью',
                            'Справка СФР об остатке материнского капитала',
                            'Нотариальное согласие супруги / заявление',
                          ].map((docItem) => (
                            <label key={docItem} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={lotRequestedDocs.includes(docItem)}
                                onChange={() =>
                                  setLotRequestedDocs((prev) =>
                                    prev.includes(docItem)
                                      ? prev.filter((x) => x !== docItem)
                                      : [...prev, docItem]
                                  )
                                }
                                className="w-4 h-4 accent-amber-600 rounded"
                              />
                              <span className="text-slate-800">{docItem}</span>
                            </label>
                          ))}
                        </div>
                        <textarea
                          rows={2}
                          required
                          value={lotDocsNotes}
                          onChange={(e) => setLotDocsNotes(e.target.value)}
                          placeholder="Комментарий для продавца (например: приложите страницу ДДУ с графиком рассрочки)..."
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white focus:outline-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm cursor-pointer"
                          >
                            Направить запрос продавцу
                          </button>
                        </div>
                      </form>
                    )}

                    {lotActionMode === 'reject' && (
                      <form
                        onSubmit={handleRejectSellerLotSubmit}
                        className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3"
                      >
                        <label className="block font-bold text-rose-950">
                          Причина отклонения заявки продавца *:
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={lotRejectReason}
                          onChange={(e) => setLotRejectReason(e.target.value)}
                          placeholder="Укажите юридическое или финансовое основание отказа (например: выявлены исполнительные производства ФССП / использован маткапитал без выделения долей)..."
                          className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white focus:outline-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                          >
                            ✕ Подтвердить отклонение заявки
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 2. Partner B2B Dossier & 3-Way Decision Modal */}
      {modalPartner && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Досье партнера B2B: {modalPartner.name}
              </h3>
              <button
                type="button"
                onClick={() => setModalPartner(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePartnerModalSubmit} className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div>
                  Организация: <strong>{modalPartner.organization}</strong>
                </div>
                <div>
                  Профиль: <strong>{modalPartner.role}</strong>
                </div>
                {modalPartner.inn && (
                  <div>
                    ИНН организации / ИП: <strong className="font-mono">{modalPartner.inn}</strong>
                  </div>
                )}
                {modalPartner.city && (
                  <div>
                    Регион: <strong>{getRegionByCode(modalPartner.city as any).labelRu}</strong>
                  </div>
                )}
                <div>
                  Телефон: <strong>{modalPartner.phone}</strong>
                </div>
                <div>
                  Реферальный код:{' '}
                  <strong className="font-mono text-purple-700">{modalPartner.referralCode}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onOpenDocumentVault({
                    isOpen: true,
                    entityType: 'partner_application',
                    entityId: modalPartner.clientCode || modalPartner.id,
                    entityTitle: `Документы партнера ${modalPartner.name}`,
                    mode: 'general',
                  })
                }
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <HardDrive className="w-4 h-4 text-indigo-600" />
                <span>Открыть документы партнера</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPartnerActionMode('approve')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    partnerActionMode === 'approve'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Одобрить
                </button>
                <button
                  type="button"
                  onClick={() => setPartnerActionMode('request_docs')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    partnerActionMode === 'request_docs'
                      ? 'bg-amber-500 text-slate-950 border-amber-500'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Запросить док-ты
                </button>
                <button
                  type="button"
                  onClick={() => setPartnerActionMode('reject')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    partnerActionMode === 'reject'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Отклонить
                </button>
              </div>

              {partnerActionMode !== 'approve' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {partnerActionMode === 'request_docs'
                      ? 'Какие реквизиты или свидетельства ИП/ООО запросить *:'
                      : 'Причина отказа в партнерской аккредитации *:'}
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={partnerActionNote}
                    onChange={(e) => setPartnerActionNote(e.target.value)}
                    placeholder="Введите комментарий комплаенс-службы..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalPartner(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl font-bold text-xs shadow-md cursor-pointer ${
                    partnerActionMode === 'approve'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : partnerActionMode === 'request_docs'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {partnerActionMode === 'approve'
                    ? '✓ Одобрить и активировать кабинет'
                    : partnerActionMode === 'request_docs'
                    ? 'Отправить запрос документов'
                    : 'Подтвердить отказ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VIP Investor 6-Steps Dossier & 3-Way Decision Modal */}
      {modalInvestor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Досье VIP Инвестора (6 шагов верификации)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalInvestor(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvestorModalSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">ФИО / Клиентский код:</span>
                  <strong>
                    {modalInvestor.fullName} ({modalInvestor.clientCode || 'DEX'})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Компания / Фонд:</span>
                  <strong>{modalInvestor.companyOrFund || 'Индивидуальный инвестор'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Локация и контакт:</span>
                  <strong>
                    {modalInvestor.countryAndCity} • {modalInvestor.contactTelegramOrPhone}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Объем капитала и стратегия:</span>
                  <strong className="text-amber-800">
                    {modalInvestor.capitalVolume} • {modalInvestor.strategy}
                  </strong>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block">Целевые регионы РФ:</span>
                  <strong>{modalInvestor.targetRegions?.join(', ')}</strong>
                </div>
                {modalInvestor.customProposal && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block">Индивидуальный мандат:</span>
                    <p className="text-slate-800 mt-0.5">{modalInvestor.customProposal}</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  onOpenDocumentVault({
                    isOpen: true,
                    entityType: 'investor_application',
                    entityId: modalInvestor.clientCode || modalInvestor.id,
                    entityTitle: `Подтверждение капитала VIP: ${modalInvestor.fullName}`,
                    mode: 'general',
                  })
                }
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <HardDrive className="w-4 h-4 text-indigo-600" />
                <span>Открыть сейф документов инвестора (Proof of Funds / NDA)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvestorActionMode('approve')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    investorActionMode === 'approve'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Утвердить VIP (48ч)
                </button>
                <button
                  type="button"
                  onClick={() => setInvestorActionMode('request_docs')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    investorActionMode === 'request_docs'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Запросить Proof of Funds
                </button>
                <button
                  type="button"
                  onClick={() => setInvestorActionMode('reject')}
                  className={`flex-1 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    investorActionMode === 'reject'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Отклонить
                </button>
              </div>

              {investorActionMode !== 'approve' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {investorActionMode === 'request_docs'
                      ? 'Комментарий к запросу банковской выписки / NDA *:'
                      : 'Причина отказа во включении в закрытый VIP-пул *:'}
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={investorActionNote}
                    onChange={(e) => setInvestorActionNote(e.target.value)}
                    placeholder="Введите комментарий..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalInvestor(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md cursor-pointer ${
                    investorActionMode === 'approve'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : investorActionMode === 'request_docs'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {investorActionMode === 'approve'
                    ? '✓ Утвердить статус VIP Инвестора'
                    : investorActionMode === 'request_docs'
                    ? 'Запросить подтверждение капитала'
                    : 'Подтвердить отказ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
