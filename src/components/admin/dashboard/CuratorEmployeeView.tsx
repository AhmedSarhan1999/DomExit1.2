import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users } from 'lucide-react';
import { Lot, BuyerCandidate, DealTrack } from '../../../types';
import { getRegionByCode } from '../../../data/russianGeography';

export interface CuratorEmployeeViewProps {
  currentEmployeeId: string;
  employeeLots: Lot[];
  employeeCandidates: BuyerCandidate[];
  employeeEscrowCount: number;
  employeeDeals: DealTrack[];
  formatRubles: (amount: number) => string;
}

export const CuratorEmployeeView: React.FC<CuratorEmployeeViewProps> = ({
  currentEmployeeId,
  employeeLots,
  employeeCandidates,
  employeeEscrowCount,
  employeeDeals,
  formatRubles,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            МОИ ЗАКРЕПЛЕННЫЕ ОБЪЕКТЫ
          </span>
          <div className="text-3xl font-black text-slate-900">
            {employeeLots.length} лотов
          </div>
          <p className="text-xs text-emerald-700 font-semibold">
            Назначены владельцем платформы
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            ВХОДЯЩИЕ ЗАЯВКИ ПОКУПАТЕЛЕЙ
          </span>
          <div className="text-3xl font-black text-sky-700">
            {employeeCandidates.length} предложений
          </div>
          <p className="text-xs text-slate-500">Только на ваши закрепленные лоты</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            МОИ СДЕЛКИ В ЭСКРОУ
          </span>
          <div className="text-3xl font-black text-slate-900">
            {employeeEscrowCount} сделок
          </div>
          <p className="text-xs text-slate-500">Всего в воронке: {employeeDeals.length}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            КОНФИДЕНЦИАЛЬНЫЙ КОНТУР
          </span>
          <div className="text-3xl font-black text-emerald-700">100% активна</div>
          <p className="text-xs text-slate-500">Доступ строго по назначению</p>
        </div>
      </div>

      {/* Employee Assigned Lots Desk */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              <span>Объекты в вашей непосредственной ответственности ({employeeLots.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Управляйте упаковкой объектов, правовым аудитом (5 ключевых разделов 214-ФЗ / 127-ФЗ) и отбором покупателей.
            </p>
          </div>
        </div>

        {employeeLots.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
            За вашим профилем куратора ({currentEmployeeId}) пока не закреплено активных объектов.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employeeLots.map((lot) => {
              const lotBidsCount = employeeCandidates.filter(
                (c) => c.lotCode?.toUpperCase() === lot.lotCode.toUpperCase()
              ).length;
              return (
                <div
                  key={lot.id}
                  className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        #{lot.lotCode}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {lot.complexName}
                      </h4>
                      <span className="text-xs text-slate-500">
                        {getRegionByCode(lot.city).shortLabelRu}, {lot.district} •{' '}
                        {lot.developer} • {lot.areaM2} м²
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      Кэш: {formatRubles(lot.cashPaidBySeller)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                    <Link
                      to={`/admin/packaging/${lot.lotCode}`}
                      className="py-2 px-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition-colors shadow-2xs"
                    >
                      📦 Упаковка лота
                    </Link>
                    <Link
                      to={`/admin/legal-audit/${lot.lotCode}`}
                      className="py-2 px-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition-colors shadow-2xs"
                    >
                      ⚖️ Юр. аудит (42)
                    </Link>
                    <Link
                      to={`/admin/matchmaker/${lot.lotCode}`}
                      className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs"
                    >
                      👥 Матчмейкер ({lotBidsCount})
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Direct Inbound Buyer Offers strictly for this Employee's Assigned Lots */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Users className="w-5 h-5 text-sky-600" />
              <span>
                Прямые заявки покупателей на ваши объекты ({employeeCandidates.length})
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Проверьте банковские справки и подтвердите платежеспособность лучшего кандидата.
            </p>
          </div>
          {employeeLots[0] && (
            <Link
              to={`/admin/matchmaker/${employeeLots[0].lotCode}`}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              Открыть двигатель отбора →
            </Link>
          )}
        </div>

        {employeeCandidates.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Пока нет входящих предложений покупателей по закрепленным за вами объектам.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Код / Кандидат</th>
                  <th className="py-3 px-3">Лот</th>
                  <th className="py-3 px-3">Трек финансирования</th>
                  <th className="py-3 px-3">Ликвидность</th>
                  <th className="py-3 px-3">Статус проверки</th>
                  <th className="py-3 px-3 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeCandidates.map((cand) => (
                  <tr key={cand.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-900 block">
                        {cand.code}
                      </span>
                      <span className="text-slate-600">{cand.name}</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                      #{cand.lotCode}
                    </td>
                    <td className="py-3 px-3">
                      {cand.buyerTrack === 'mortgage_substitution' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          Кэш + Ипотека
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          100% Кэш
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {formatRubles(cand.availableLiquidity)}
                    </td>
                    <td className="py-3 px-3">
                      {cand.isVerifiedByCurator ? (
                        <span className="text-emerald-700 font-bold">✓ Проверен</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Ожидает проверки</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/admin/matchmaker/${cand.lotCode}`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs"
                      >
                        Открыть в матчмейкере →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
