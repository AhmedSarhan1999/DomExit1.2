import React from 'react';
import { Scale, CheckCircle2 } from 'lucide-react';
import { Lot, LegalAuditAxis } from '../../../types';

interface LegalAuditHeaderCardProps {
  lot: Lot;
  accessibleLots: Lot[];
  sellerFullName: string;
  sellerInn: string;
  axes: LegalAuditAxis[];
  onSelectLotCode: (code: string) => void;
}

export const LegalAuditHeaderCard: React.FC<LegalAuditHeaderCardProps> = ({
  lot,
  accessibleLots,
  sellerFullName,
  sellerInn,
  axes,
  onSelectLotCode,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xs">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-emerald-700">
          <Scale className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-wider">
            ПРОТОКОЛ ПРАВОВОГО СКОРИНГА #{lot.lotCode}
          </span>
          <select
            value={lot.lotCode}
            onChange={(e) => onSelectLotCode(e.target.value)}
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
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Аудит: {sellerFullName} <span className="text-sm font-mono text-slate-500">(ИНН: {sellerInn})</span>
          </h2>
          <p className="text-xs text-slate-500 pt-1">
            {lot.dealTrack === 'secondary_dkp' ? 'Вторичное жилье (ДКП)' : 'Новостройка (ДДУ / Цессия)'} • ЖК {lot.complexName} ({lot.developer})
          </p>
        </div>
      </div>

      <div className="rounded-3xl p-6 text-right space-y-2 shrink-0 w-full lg:w-84 shadow-sm border bg-emerald-50/80 border-emerald-300">
        <span className="text-[11px] font-black uppercase text-slate-700 block">СТАТУС АУДИТА:</span>
        <div className="text-xl font-black text-emerald-800 flex items-center justify-end space-x-1.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Проверено {axes.filter((a) => a.evaluated).length} из {axes.length}</span>
        </div>
      </div>
    </div>
  );
};
