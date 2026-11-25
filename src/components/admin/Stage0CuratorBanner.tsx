import React, { useEffect, useState } from 'react';
import { ShieldAlert, UserCheck } from 'lucide-react';
import { Employee, Lot } from '../../types';
import { EmployeesRepository } from '../../dal/repositories/EmployeesRepository';
import { LotsRepository } from '../../dal/repositories/LotsRepository';

interface Stage0CuratorBannerProps {
  lot: Lot;
  operatorName: string;
  onAssigned: (updatedLot: Lot) => void;
}

export const Stage0CuratorBanner: React.FC<Stage0CuratorBannerProps> = ({
  lot,
  operatorName,
  onAssigned,
}) => {
  const hasCurator = Boolean(lot.assignedEmployeeId || lot.assignedCuratorId);
  const [curators, setCurators] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (hasCurator) return;
    let active = true;
    EmployeesRepository.getAssignableCurators()
      .then((list) => {
        if (!active) return;
        setCurators(list);
        if (list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      })
      .catch(() => {
        if (active) setCurators([]);
      });
    return () => {
      active = false;
    };
  }, [hasCurator, lot.lotCode]);

  if (hasCurator) return null;

  const handleAssign = async () => {
    const target = curators.find((c) => c.id === selectedId);
    if (!target) {
      setErr('Выберите куратора из списка');
      return;
    }
    setAssigning(true);
    setErr(null);
    try {
      const updated = await LotsRepository.assignToEmployee(
        lot.lotCode,
        target.id,
        target.name,
        operatorName,
        {
          name: target.name,
          role: target.role,
          phone: target.phone,
          telegram: target.telegram,
          photoUrl: target.photoUrl,
          whatsapp: target.whatsapp,
          bio: target.bio,
        }
      );
      if (updated) {
        onAssigned(updated);
      }
    } catch (e: any) {
      setErr(e?.message || 'Не удалось назначить куратора');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
      <div className="flex items-start space-x-3">
        <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-xs sm:text-sm font-black text-amber-950">
            Этап 0: Персональный куратор ещё не назначен
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            Выдача правового штампа и публикация лота заблокированы системой безопасности. Назначьте персонального куратора (можно назначить себя) для перехода на Этап 1.
          </p>
          {err && <p className="text-xs font-bold text-rose-700">{err}</p>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={assigning || curators.length === 0}
          className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:border-amber-500"
        >
          {curators.length === 0 ? (
            <option value="">Загрузка списка...</option>
          ) : (
            curators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.role || 'Куратор'})
              </option>
            ))
          )}
        </select>

        <button
          type="button"
          onClick={handleAssign}
          disabled={assigning || !selectedId}
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-xs font-black flex items-center justify-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <UserCheck className="w-4 h-4" />
          <span>{assigning ? 'Назначение...' : 'Назначить куратора прямо сейчас'}</span>
        </button>
      </div>
    </div>
  );
};
