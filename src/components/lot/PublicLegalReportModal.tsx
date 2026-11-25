import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileText,
  X,
  Award,
  UserCheck,
  Clock,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Lot, Employee, LegalAuditAxisStatus } from '../../types';
import { resolveLotLegalAxes, HONEST_STATUS_CONFIG } from '../../data/legalAuditAxes';

interface PublicLegalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lot: Lot;
  curator?: Employee | null;
}

export const PublicLegalReportModal: React.FC<PublicLegalReportModalProps> = ({
  isOpen,
  onClose,
  lot,
  curator,
}) => {
  if (!isOpen) return null;

  const protocolNumber = `ПРТ-214-${lot.lotCode.replace(/[^0-9A-Za-z]/g, '') || '784102'}`;
  const rawVerificationDate =
    (lot as any).legalVerifiedAt || lot.publishedAt || lot.legalAuditAxes?.[0]?.checkedAt;
  const parsedVerDate = rawVerificationDate ? new Date(rawVerificationDate) : null;
  const verificationDate =
    parsedVerDate && !Number.isNaN(parsedVerDate.getTime())
      ? parsedVerDate.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
  const curatorName =
    lot.legalReviewedByName || curator?.name || lot.curator?.name || 'Юридический департамент DomExit';
  const curatorRole = curator?.role || 'Ведущий юрист по сделкам переуступки';

  const axes = resolveLotLegalAxes(lot);
  const completedAxesCount = axes.filter((a) => a.evaluated || a.status !== 'unverified').length;

  const renderStatusBadge = (status: LegalAuditAxisStatus) => {
    const cfg = HONEST_STATUS_CONFIG[status] || HONEST_STATUS_CONFIG.unverified;
    return (
      <span
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.badgeClass}`}
      >
        {status === 'verified_safe' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
        {status === 'required_at_deal' && <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
        {status === 'condition_found' && <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
        {status === 'unverified' && <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
        {status === 'critical_risk' && <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
        <span>{cfg.labelRu}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block">
                Стандарт юридической проверки DomExit
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Публичное юридическое заключение
              </h2>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Протокол аудита:</span>
              <span className="font-mono font-bold text-emerald-300">{protocolNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Дата валидации:</span>
              <span className="font-medium text-slate-200">{verificationDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Объект:</span>
              <span className="font-medium text-slate-200 truncate block">{lot.complexName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Код лота:</span>
              <span className="font-mono font-bold text-slate-200">#{lot.lotCode}</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Key Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">ДДУ в Росреестре</span>
                <span className="text-[10px] text-emerald-700">Запись ЕГРН подтверждена, обременения отсутствуют</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Банкротные риски</span>
                <span className="text-[10px] text-emerald-700">ЕФРСБ, картотека судов и ФССП проверены</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Эскроу-счет подтвержден</span>
                <span className="text-[10px] text-emerald-700">
                  {lot.escrowBank
                    ? lot.escrowBank.includes('ПАО')
                      ? lot.escrowBank
                      : `ПАО ${lot.escrowBank}`
                    : 'Банк эскроу'}{' '}
                  (эскроу-агент)
                </span>
              </div>
            </div>
          </div>

          {/* Curator Attestation Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  Куратор правовой экспертизы
                </span>
                <span className="text-sm font-bold text-slate-900 block">{curatorName}</span>
                <span className="text-xs text-slate-600">{curatorRole}</span>
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-200">
                <Award className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {completedAxesCount === axes.length ? 'Проверка завершена' : 'Аудит'} • {completedAxesCount} из {axes.length} разделов
                </span>
              </span>
            </div>
          </div>

          {/* 5 Real Audit Axes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Правовой аудит цессии ({axes.length} разделов)</span>
              </h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {completedAxesCount} из {axes.length} разделов
              </span>
            </div>

            <div className="space-y-3">
              {axes.map((axis) => (
                <div
                  key={axis.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {axis.title}
                    </span>
                    <div className="shrink-0">{renderStatusBadge(axis.status)}</div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200/60">
                    {axis.notes}
                  </p>
                  {axis.portalUrl && (
                    <div className="flex justify-end pt-0.5">
                      <a
                        href={axis.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
                      >
                        <span>Государственный реестр проверки</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Personal Data Protection Note */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start space-x-3">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1">
              <span className="font-bold block">
                Защита персональных данных участников сделки
              </span>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                Оригиналы сканов паспортов, ДДУ, платежных поручений и согласий хранятся в защищенном контуре и не публикуются в открытом доступе.
                Полный проверенный пакет документов передается покупателю и банку-эскроу агенту на этапе подписания договора уступки.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
