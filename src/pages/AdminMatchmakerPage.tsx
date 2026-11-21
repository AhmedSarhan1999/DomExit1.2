import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { Lot } from '../types';
import { StagedDropQueueManager } from '../components/admin/StagedDropQueueManager';
import {
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';

export const AdminMatchmakerPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const currentLotCode = lotId || '';
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lot, setLot] = useState<Lot | null>(null);
  const [allLots, setAllLots] = useState<Lot[]>([]);
  const [linkedDealId, setLinkedDealId] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [warningToast, setWarningToast] = useState<string | null>(null);
  const [isBuyerVaultOpen, setIsBuyerVaultOpen] = useState<boolean>(false);

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || (isEmployee ? user?.id || '' : '');
  const curatorName =
    user?.name || (isEmployee ? 'Куратор DomExit' : 'Ahmed Abdallah (Владелец / CEO)');

  const loadData = async () => {
    const lotsData = await (isEmployee
      ? LotsRepository.getByAssignedEmployee(currentEmployeeId)
      : LotsRepository.getAll({ includePendingApproval: true }));

    setAllLots(lotsData);
    const current = currentLotCode
      ? lotsData.find(
          (l) =>
            l.lotCode.toUpperCase() === currentLotCode.toUpperCase() ||
            l.id.toUpperCase() === currentLotCode.toUpperCase()
        )
      : lotsData[0] || null;

    setLot(current || null);

    if (current) {
      const deal = await DealsRepository.getById(current.lotCode);
      if (deal) {
        setLinkedDealId(deal.dealId);
      }
    }
  };

  useEffect(() => {
    loadData();
    const unsub = DatabaseGateway.subscribe(() => {
      loadData();
    });
    return unsub;
  }, [currentLotCode, isEmployee, currentEmployeeId]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={`Матчмейкер и тактовый отбор покупателей — Лот #${lot?.lotCode || currentLotCode}`}
          subtitle="Закрытый дроп, гибридная очередь покупателей и управление приоритетом депонирования"
        />

        {successToast && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-white/80 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {warningToast && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-500 text-white font-bold text-xs shadow-xl flex items-center justify-between animate-fade-in">
            <span>{warningToast}</span>
            <button
              onClick={() => setWarningToast(null)}
              className="text-white/80 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6 max-w-[1500px] w-full">
          {!lot ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 my-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-slate-900">
                Нет активных сделок на аудите — ожидаются входящие заявки от дольщиков
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Новые лоты появятся здесь автоматически после прохождения юридического комплаенса и первичного юридического аудита.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Target Lot Summary Box + Lot Selector */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                      <img src={lot.imageUrl} alt="ЖК" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-base font-black text-slate-950">{lot.complexName}</h2>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            lot.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {lot.status === 'available' ? 'Открыто окно приема' : 'В сделке'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {lot.developer} • {lot.areaM2} м² • #{lot.lotCode} • Куратор:{' '}
                        <strong>{lot.assignedEmployeeName || curatorName}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Quick Lot Selector & S3 Buyer Docs Vault */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBuyerVaultOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Документы покупателей</span>
                    </button>

                    <select
                      value={lot.lotCode}
                      onChange={(e) => navigate(`/admin/matchmaker/${e.target.value}`)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {allLots.map((l) => (
                        <option key={l.id} value={l.lotCode}>
                          #{l.lotCode} — {l.complexName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4 Financial Metric Boxes */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[11px] block font-sans">Кэш продавцу:</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">
                      {formatRubles(lot.cashPaidBySeller)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[11px] block font-sans">
                      Остаток по ДДУ:
                    </span>
                    <span className="text-base font-black text-slate-700 mt-0.5 block">
                      {formatRubles(lot.remainingInstallmentDebt)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[11px] block font-sans">
                      Суммарно по ДДУ:
                    </span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">
                      {formatRubles(lot.dduContractPrice)}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                    <span className="text-[11px] block font-sans font-bold">
                      Выгода от застройщика:
                    </span>
                    <span className="text-base font-black mt-0.5 block">
                      +{formatRubles(Math.max(0, lot.todayDeveloperPrice - lot.dduContractPrice))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Staged Drop & Hybrid Queue Manager (Phase 6 - Single Source of Truth) */}
              <StagedDropQueueManager
                lot={lot}
                onLotUpdated={loadData}
                onShowToast={(msg) => {
                  setSuccessToast(msg);
                  setTimeout(() => setSuccessToast(null), 5000);
                }}
                onShowWarning={(msg) => {
                  setWarningToast(msg);
                  setTimeout(() => setWarningToast(null), 5000);
                }}
              />

              {/* Linked Deal and Closing Quick Navigation */}
              {linkedDealId && (
                <div className="flex justify-end pt-2">
                  <Link
                    to={`/admin/closing/${linkedDealId}`}
                    className="py-3 px-5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs inline-flex items-center space-x-2 transition-colors shadow-2xs"
                  >
                    <span>Перейти в зал банковского эскроу ({linkedDealId})</span>
                    <ArrowRight className="w-4 h-4 text-emerald-600" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Buyer Applications S3 Vault */}
      {lot && (
        <DocumentVaultModal
          isOpen={isBuyerVaultOpen}
          onClose={() => setIsBuyerVaultOpen(false)}
          entityType="buyer_application"
          entityId={lot.lotCode}
          entityTitle={`Банковские справки покупателей по лоту #${lot.lotCode}`}
          uploadedByUid={user?.id || 'matchmaker-curator'}
          clientCode={user?.clientCode || 'DEX-STAFF'}
          mode="general"
          canUpload={false}
          canReview={true}
          reviewerName={curatorName}
        />
      )}
    </div>
  );
};
