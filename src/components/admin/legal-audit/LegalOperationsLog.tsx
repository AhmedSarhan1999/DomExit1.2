import React from 'react';
import { History } from 'lucide-react';
import { Lot } from '../../../types';

interface LegalOperationsLogProps {
  lot: Lot;
}

export const LegalOperationsLog: React.FC<LegalOperationsLogProps> = ({ lot }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-slate-900">
            Журнал операций куратора (Аудиторский след решений по лоту #{lot.lotCode})
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">{lot.curatorOperationsLog?.length || 0} записей</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Точное время</th>
              <th className="py-2.5 px-3">Ответственный юрист</th>
              <th className="py-2.5 px-3">Действие</th>
              <th className="py-2.5 px-3">Подробности</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {lot.curatorOperationsLog && lot.curatorOperationsLog.length > 0 ? (
              lot.curatorOperationsLog.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-slate-500">{new Date(log.timestamp).toLocaleString('ru-RU')}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{log.curatorName}</td>
                  <td className="py-2.5 px-3 font-semibold text-indigo-700">{log.action}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">{log.notes}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400 font-sans">
                  Пока нет записей в журнале по данному лоту.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
