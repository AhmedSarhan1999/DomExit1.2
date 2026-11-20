import React, { useState } from 'react';
import { Briefcase, UserPlus, Edit, X, Loader2 } from 'lucide-react';
import { UserProfile, Employee, Lot } from '../../../types';
import { EmployeesRepository } from '../../../dal/repositories/EmployeesRepository';
import { UsersRepository } from '../../../dal/repositories/UsersRepository';
import { AuditLogsRepository } from '../../../dal/repositories/AuditLogsRepository';
import { withAsyncTimeout, ASYNC_NETWORK_TIMEOUT_MESSAGE } from '../../../utils/asyncGuard';
import { formatRussianPhoneInput } from '../../../utils/validators';

export interface UsersRbacTabProps {
  usersList: UserProfile[];
  employees: Employee[];
  lots: Lot[];
  operatorName: string;
  loadAllData: () => Promise<void>;
  switchRole: (
    role:
      | 'buyer'
      | 'seller'
      | 'partner'
      | 'investor'
      | 'employee'
      | 'owner'
      | 'bank'
  ) => void;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
}

export const UsersRbacTab: React.FC<UsersRbacTabProps> = ({
  usersList,
  employees,
  lots,
  operatorName,
  loadAllData,
  switchRole,
  showToast,
  showError,
}) => {
  const [staffTab, setStaffTab] = useState<'users' | 'employees'>('users');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Add Employee Modal State
  const [showAddEmpModal, setShowAddEmpModal] = useState<boolean>(false);
  const [newEmpEmail, setNewEmpEmail] = useState<string>('');
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<string>('Куратор сделок');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('+7 (');
  const [newEmpTg, setNewEmpTg] = useState<string>('@');
  const [newEmpPerms] = useState<('legal_audit' | 'packaging' | 'matchmaker' | 'closing')[]>([
    'legal_audit',
    'packaging',
    'matchmaker',
    'closing',
  ]);
  const [isSubmittingEmp, setIsSubmittingEmp] = useState<boolean>(false);

  // Edit Employee Modal State
  const [showEditEmpModal, setShowEditEmpModal] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editEmpEmail, setEditEmpEmail] = useState<string>('');
  const [editEmpName, setEditEmpName] = useState<string>('');
  const [editEmpRole, setEditEmpRole] = useState<string>('Куратор сделок');
  const [editEmpPhone, setEditEmpPhone] = useState<string>('');
  const [editEmpTg, setEditEmpTg] = useState<string>('');
  const [editEmpPerms, setEditEmpPerms] = useState<('legal_audit' | 'packaging' | 'matchmaker' | 'closing')[]>([
    'legal_audit',
    'packaging',
    'matchmaker',
    'closing',
  ]);

  // Update user role dynamically
  const handleUpdateUserRole = async (targetUserId: string, newRole: string) => {
    setUpdatingUserId(targetUserId);
    try {
      const updated = await UsersRepository.updateRole(targetUserId, newRole, operatorName);
      if (updated) {
        showToast(`Роль пользователя [${updated.email}] изменена на «${newRole}».`);
        await loadAllData();
      }
    } catch (err) {
      console.error('Failed to update user role:', err);
      showError('Ошибка при изменении роли пользователя.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Toggle employee status
  const handleToggleEmp = async (empId: string) => {
    try {
      setIsSubmittingEmp(true);
      await withAsyncTimeout(EmployeesRepository.toggleStatus(empId), 15000);
      showToast('Статус доступа сотрудника обновлен.');
      await loadAllData();
    } catch (err) {
      console.error('Toggle employee status error:', err);
      showError(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingEmp(false);
    }
  };

  // Delete employee (Full Staff CRUD)
  const handleDeleteEmp = async (emp: Employee) => {
    if (
      !window.confirm(
        `Вы уверены, что хотите удалить сотрудника «${emp.name}» (${emp.email})? Это действие необратимо и удалит профиль сотрудника.`
      )
    ) {
      return;
    }
    try {
      setIsSubmittingEmp(true);
      await withAsyncTimeout(EmployeesRepository.delete(emp.id), 15000);
      await AuditLogsRepository.addLog({
        operatorName,
        operatorRole: 'owner',
        actionType: 'employee_created_modified',
        title: `Удален сотрудник: ${emp.name}`,
        description: `Сотрудник ${emp.name} (${emp.email}) удален из системы.`,
      });
      showToast(`Сотрудник «${emp.name}» успешно удален.`);
      await loadAllData();
    } catch (err) {
      console.error('Delete employee error:', err);
      showError(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingEmp(false);
    }
  };

  // Edit employee details (Full Staff CRUD)
  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !editEmpName.trim() || !editEmpEmail.trim()) return;

    try {
      setIsSubmittingEmp(true);
      await withAsyncTimeout(
        EmployeesRepository.update({
          ...editingEmp,
          name: editEmpName.trim(),
          email: editEmpEmail.trim(),
          role: editEmpRole,
          phone: editEmpPhone.trim(),
          telegram: editEmpTg.trim(),
          permissions: editEmpPerms,
        }),
        15000
      );

      await AuditLogsRepository.addLog({
        operatorName,
        operatorRole: 'owner',
        actionType: 'employee_created_modified',
        title: `Обновлены данные сотрудника: ${editEmpName}`,
        description: `Email: ${editEmpEmail}, Должность: ${editEmpRole}. Права обновлены.`,
      });

      setShowEditEmpModal(false);
      setEditingEmp(null);
      showToast(`Данные сотрудника «${editEmpName}» успешно сохранены.`);
      await loadAllData();
    } catch (err) {
      console.error('Edit employee error:', err);
      showError(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingEmp(false);
    }
  };

  // Add new employee & auto-register user
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpEmail || !newEmpName) return;

    try {
      setIsSubmittingEmp(true);
      const createdEmp = await withAsyncTimeout(
        EmployeesRepository.add({
          email: newEmpEmail,
          name: newEmpName,
          role: newEmpRole,
          phone: newEmpPhone,
          telegram: newEmpTg,
          permissions: newEmpPerms,
          status: 'active',
          activeLotsCount: 0,
          closedDealsCount: 0,
          avgSpeedDays: 8.0,
        }),
        15000
      );

      let mappedRole: 'employee' | 'owner' | 'bank' = 'employee';
      if (
        newEmpRole.toLowerCase().includes('владелец') ||
        newEmpRole.toLowerCase().includes('co-owner')
      ) {
        mappedRole = 'owner';
      } else if (newEmpRole.toLowerCase().includes('банк')) {
        mappedRole = 'bank';
      }

      await withAsyncTimeout(
        UsersRepository.add({
          email: newEmpEmail,
          name: newEmpName,
          phone: newEmpPhone,
          telegram: newEmpTg,
          assignedEmployeeId: createdEmp.id,
          role: mappedRole === 'owner' ? 'admin' : mappedRole,
          roles:
            mappedRole === 'owner'
              ? ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer']
              : [mappedRole],
          activeRole: mappedRole,
          isPartnerApproved: true,
          isInvestorApproved: true,
        }),
        15000
      );

      await AuditLogsRepository.addLog({
        operatorName,
        operatorRole: 'owner',
        actionType: 'employee_created_modified',
        title: `Добавлен новый сотрудник: ${newEmpName}`,
        description: `Email: ${newEmpEmail}, Должность: ${newEmpRole}. Доступ куратора активирован.`,
      });

      setShowAddEmpModal(false);
      setNewEmpEmail('');
      setNewEmpName('');
      showToast(`Сотрудник ${newEmpName} (${newEmpEmail}) успешно добавлен в штат.`);
      await loadAllData();
    } catch (err) {
      console.error('Add employee error:', err);
      showError(ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmittingEmp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Staff, Users & Role Management */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              <span>Управление пользователями, штатом и ролями RBAC</span>
            </h3>
            <p className="text-xs text-slate-500">
              Контроль учетных записей, мгновенная смена ролей и доступы штатных кураторов.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setStaffTab('users')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  staffTab === 'users'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Аккаунты ({usersList.length})
              </button>
              <button
                type="button"
                onClick={() => setStaffTab('employees')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  staffTab === 'employees'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Штатные кураторы ({employees.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAddEmpModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Добавить сотрудника</span>
            </button>
          </div>
        </div>

        {staffTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Пользователь</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Текущая роль</th>
                  <th className="py-3 px-3">Назначить роль</th>
                  <th className="py-3 px-3 text-center">Аккредитации</th>
                  <th className="py-3 px-3 text-right">Тест доступа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => {
                  const isMasterOwner =
                    u.email?.toLowerCase() === 'amaas9499@gmail.com' ||
                    u.email?.toLowerCase() === 'ceo@domexit.ru';
                  const currentRole = u.activeRole || u.role || 'buyer';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>{u.name}</span>
                          {isMasterOwner && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                              CEO
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          {u.clientCode}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                        {u.email}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {currentRole}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          disabled={updatingUserId === u.id}
                          value={currentRole === 'admin' ? 'owner' : currentRole}
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
                        >
                          <option value="owner">👑 Владелец (owner)</option>
                          <option value="employee">👨‍💼 Куратор (employee)</option>
                          <option value="bank">🏦 Банк-партнер (bank)</option>
                          <option value="partner">🤝 Партнер B2B (partner)</option>
                          <option value="investor">💎 VIP Инвестор (investor)</option>
                          <option value="seller">🏠 Продавец ДДУ (seller)</option>
                          <option value="buyer">🔑 Покупатель (buyer)</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              u.isPartnerApproved
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            Партнер {u.isPartnerApproved ? '✓' : '—'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              u.isInvestorApproved
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            VIP {u.isInvestorApproved ? '✓' : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            switchRole(
                              (currentRole === 'admin'
                                ? 'owner'
                                : currentRole === 'bank_officer'
                                ? 'bank'
                                : currentRole) as
                                | 'buyer'
                                | 'seller'
                                | 'partner'
                                | 'investor'
                                | 'employee'
                                | 'owner'
                                | 'bank'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Войти под ролью →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {staffTab === 'employees' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Сотрудник</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Должность</th>
                  <th className="py-3 px-3">Контакты</th>
                  <th className="py-3 px-3 text-center">Закреплено лотов</th>
                  <th className="py-3 px-3">Статус</th>
                  <th className="py-3 px-3 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{emp.name}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{emp.email}</td>
                    <td className="py-3 px-3 text-slate-800">{emp.role}</td>
                    <td className="py-3 px-3">
                      <div>{emp.phone}</div>
                      <div className="text-indigo-600 font-mono text-[11px]">
                        {emp.telegram}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold font-mono text-indigo-700">
                      {lots.filter((l) => l.assignedEmployeeId === emp.id).length}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          emp.status === 'active'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {emp.status === 'active' ? 'Активен' : 'Приостановлен'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEmp(emp);
                            setEditEmpName(emp.name);
                            setEditEmpEmail(emp.email);
                            setEditEmpRole(emp.role);
                            setEditEmpPhone(emp.phone);
                            setEditEmpTg(emp.telegram || '');
                            setEditEmpPerms(
                              (emp.permissions as ('legal_audit' | 'packaging' | 'matchmaker' | 'closing')[]) || [
                                'legal_audit',
                                'packaging',
                                'matchmaker',
                                'closing',
                              ]
                            );
                            setShowEditEmpModal(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer"
                          title="Редактировать профиль и права"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingEmp}
                          onClick={() => handleToggleEmp(emp.id)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {emp.status === 'active' ? 'Приостановить' : 'Активировать'}
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingEmp}
                          onClick={() => handleDeleteEmp(emp)}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          title="Удалить сотрудника"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Employee */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Добавить сотрудника / назначить роль</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEmpModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email аккаунта (корпоративный или Google) *:
                </label>
                <input
                  type="email"
                  required
                  placeholder="curator@domexit.ru"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ФИО сотрудника *:</label>
                <input
                  type="text"
                  required
                  placeholder="Алексей Николаевич Смирнов"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Должность / Роль *:</label>
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="Куратор сделок">Куратор сделок (Координатор)</option>
                  <option value="Старший юрист комплаенса">Старший юрист комплаенса (42 проверки)</option>
                  <option value="Кредитный офицер банка">Кредитный офицер банка-партнера</option>
                  <option value="Совладелец (Co-Owner)">Совладелец платформы (Co-Owner)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Телефон РФ *:</label>
                  <input
                    type="tel"
                    required
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telegram:</label>
                  <input
                    type="text"
                    value={newEmpTg}
                    onChange={(e) => setNewEmpTg(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingEmp}
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEmp}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60 flex items-center space-x-2"
                >
                  {isSubmittingEmp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Сохранение в базе...</span>
                    </>
                  ) : (
                    <span>Создать и активировать доступ</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee */}
      {showEditEmpModal && editingEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <span>Редактировать профиль сотрудника</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditEmpModal(false);
                  setEditingEmp(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditEmployeeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email аккаунта (корпоративный) *:
                </label>
                <input
                  type="email"
                  required
                  value={editEmpEmail}
                  onChange={(e) => setEditEmpEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ФИО сотрудника *:</label>
                <input
                  type="text"
                  required
                  value={editEmpName}
                  onChange={(e) => setEditEmpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Должность / Роль *:</label>
                <select
                  value={editEmpRole}
                  onChange={(e) => setEditEmpRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="Куратор сделок">Куратор сделок (Координатор)</option>
                  <option value="Старший юрист комплаенса">Старший юрист комплаенса (42 проверки)</option>
                  <option value="Кредитный офицер банка">Кредитный офицер банка-партнера</option>
                  <option value="Ведущий куратор отдела выходов">Ведущий куратор отдела выходов</option>
                  <option value="Совладелец (Co-Owner)">Совладелец платформы (Co-Owner)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Телефон РФ *:</label>
                  <input
                    type="tel"
                    required
                    value={editEmpPhone}
                    onChange={(e) => setEditEmpPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telegram:</label>
                  <input
                    type="text"
                    value={editEmpTg}
                    onChange={(e) => setEditEmpTg(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                <div className="font-bold text-slate-700">Назначенные модули доступа:</div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPerms.includes('legal_audit')}
                      onChange={(e) => {
                        setEditEmpPerms(
                          e.target.checked
                            ? [...editEmpPerms, 'legal_audit']
                            : editEmpPerms.filter((p) => p !== 'legal_audit')
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>Юр. комплаенс</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPerms.includes('packaging')}
                      onChange={(e) => {
                        setEditEmpPerms(
                          e.target.checked
                            ? [...editEmpPerms, 'packaging']
                            : editEmpPerms.filter((p) => p !== 'packaging')
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>Упаковка лотов</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPerms.includes('matchmaker')}
                      onChange={(e) => {
                        setEditEmpPerms(
                          e.target.checked
                            ? [...editEmpPerms, 'matchmaker']
                            : editEmpPerms.filter((p) => p !== 'matchmaker')
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>Матчмейкинг</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPerms.includes('closing')}
                      onChange={(e) => {
                        setEditEmpPerms(
                          e.target.checked
                            ? [...editEmpPerms, 'closing']
                            : editEmpPerms.filter((p) => p !== 'closing')
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>Комната закрытия</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingEmp}
                  onClick={() => {
                    setShowEditEmpModal(false);
                    setEditingEmp(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEmp}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60 flex items-center space-x-2"
                >
                  {isSubmittingEmp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Сохранение в базе...</span>
                    </>
                  ) : (
                    <span>Сохранить изменения</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
