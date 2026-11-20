import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark,
  Plus,
  Building2,
  Edit,
  Trash2,
  ExternalLink,
  Save,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { PartnerBankEntity } from '../../../types';
import { BankPortalRepository } from '../../../dal/repositories/BankPortalRepository';
import { formatRussianPhoneInput } from '../../../utils/validators';

export interface PartnerBanksTabProps {
  partnerBanks: PartnerBankEntity[];
  setPartnerBanks: React.Dispatch<React.SetStateAction<PartnerBankEntity[]>>;
  operatorName: string;
  formatRubles: (val: number) => string;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
}

export const PartnerBanksTab: React.FC<PartnerBanksTabProps> = ({
  partnerBanks,
  setPartnerBanks,
  operatorName,
  formatRubles,
  showToast,
  showError,
}) => {
  // Add modal state
  const [showAddBankModal, setShowAddBankModal] = useState<boolean>(false);
  const [newBankName, setNewBankName] = useState<string>('');
  const [newBankAdminEmail, setNewBankAdminEmail] = useState<string>('');
  const [newBankTempPassword, setNewBankTempPassword] = useState<string>('DomExit2026!Bank');
  const [newBankContactPhone, setNewBankContactPhone] = useState<string>('');
  const [newBankContactPerson, setNewBankContactPerson] = useState<string>('');
  const [newBankLogoUrl, setNewBankLogoUrl] = useState<string>('');
  const [isSavingBank, setIsSavingBank] = useState<boolean>(false);

  // Edit modal state
  const [showEditBankModal, setShowEditBankModal] = useState<boolean>(false);
  const [editingBank, setEditingBank] = useState<PartnerBankEntity | null>(null);
  const [editBankName, setEditBankName] = useState<string>('');
  const [editBankAdminEmail, setEditBankAdminEmail] = useState<string>('');
  const [editBankLogoUrl, setEditBankLogoUrl] = useState<string>('');
  const [editBankContactPhone, setEditBankContactPhone] = useState<string>('');
  const [editBankContactPerson, setEditBankContactPerson] = useState<string>('');
  const [isUpdatingBank, setIsUpdatingBank] = useState<boolean>(false);

  // Delete modal state
  const [showDeleteBankModal, setShowDeleteBankModal] = useState<boolean>(false);
  const [deletingBank, setDeletingBank] = useState<PartnerBankEntity | null>(null);
  const [isDeletingBank, setIsDeletingBank] = useState<boolean>(false);

  const handleOpenEditBank = (bank: PartnerBankEntity) => {
    setEditingBank(bank);
    setEditBankName(bank.name);
    setEditBankAdminEmail(bank.masterAdminEmail);
    setEditBankLogoUrl(bank.logoUrl || '');
    setEditBankContactPhone(bank.contactPhone || '');
    setEditBankContactPerson(bank.contactPerson || '');
    setShowEditBankModal(true);
  };

  const handleSaveEditBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank || !editBankName.trim() || !editBankAdminEmail.trim()) return;
    try {
      setIsUpdatingBank(true);
      await BankPortalRepository.updatePartnerBank(
        editingBank.id,
        {
          name: editBankName.trim(),
          masterAdminEmail: editBankAdminEmail.trim(),
          logoUrl: editBankLogoUrl.trim() || undefined,
          contactPhone: editBankContactPhone.trim(),
          contactPerson: editBankContactPerson.trim(),
        },
        operatorName
      );
      const updatedBanks = await BankPortalRepository.getAllPartnerBanks();
      setPartnerBanks(updatedBanks);
      setShowEditBankModal(false);
      setEditingBank(null);
      showToast(`Параметры банка «${editBankName}» успешно обновлены!`);
    } catch {
      showError('Ошибка при обновлении параметров банка.');
    } finally {
      setIsUpdatingBank(false);
    }
  };

  const handleOpenDeleteBank = (bank: PartnerBankEntity) => {
    setDeletingBank(bank);
    setShowDeleteBankModal(true);
  };

  const handleConfirmDeleteBank = async () => {
    if (!deletingBank) return;
    try {
      setIsDeletingBank(true);
      await BankPortalRepository.deletePartnerBank(deletingBank.id, operatorName);
      const updatedBanks = await BankPortalRepository.getAllPartnerBanks();
      setPartnerBanks(updatedBanks);
      setShowDeleteBankModal(false);
      setDeletingBank(null);
      showToast(`Банк «${deletingBank.name}» удален из партнерской сети DomExit.`);
    } catch {
      showError('Ошибка при удалении банка-партнера.');
    } finally {
      setIsDeletingBank(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PARTNER BANKS MANAGEMENT & INTEGRATION HUB (Task 7) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Управление банками-партнерами (Partner Bank Escrow & Integration Hub)
              </h3>
              <p className="text-xs text-slate-500">
                Мониторинг счетов СБР/Эскроу, ключевых KPI одобрения девелоперов и подключение новых банковских шлюзов
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddBankModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-xs flex items-center space-x-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить новый банк-партнер</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {partnerBanks.map((bank) => (
            <div
              key={bank.id}
              className="bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl p-5 space-y-4 transition-all shadow-xs hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                    {bank.logoUrl ? (
                      <img src={bank.logoUrl} alt={bank.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Building2 className="w-5 h-5 text-emerald-700" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{bank.name}</h4>
                    <span className="text-[10px] font-bold text-slate-400 block">{bank.contactPerson || 'Офис эскроу'}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Активен ✓
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Эскроу-счета:</span>
                  <strong className="text-sm font-black text-slate-900">{bank.kpis.escrowAccountsCount}</strong>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Объем в СБР:</span>
                  <strong className="text-xs font-black text-emerald-700 font-mono">
                    {formatRubles(bank.kpis.totalEscrowRub)}
                  </strong>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Ср. скорость:</span>
                  <strong className="text-sm font-black text-slate-900">{bank.kpis.avgApprovalDays} дн.</strong>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Одобрение:</span>
                  <strong className="text-sm font-black text-emerald-700">{bank.kpis.devApprovalRatePercent}%</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditBank(bank)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer border border-slate-200"
                    title="Редактировать параметры банка"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteBank(bank)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer border border-rose-200"
                    title="Удалить банк из партнерской сети"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Link
                  to={`/admin/bank-gateway?bankId=${bank.id}`}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs"
                >
                  <span>В шлюз</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add New Partner Bank (Task 7) */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Подключение нового банка-партнера
                  </h3>
                  <p className="text-xs text-slate-500">
                    Создание шлюза СБР / Эскроу и учетной записи Master Bank Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBankModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newBankName.trim() || !newBankAdminEmail.trim()) {
                  showError('Укажите наименование банка и Master Admin Email.');
                  return;
                }
                setIsSavingBank(true);
                try {
                  await BankPortalRepository.addPartnerBank({
                    name: newBankName.trim(),
                    masterAdminEmail: newBankAdminEmail.trim(),
                    contactPhone: newBankContactPhone.trim(),
                    contactPerson: newBankContactPerson.trim(),
                    logoUrl: newBankLogoUrl.trim() || undefined,
                    tempPassword: newBankTempPassword.trim(),
                  });
                  const updatedBanks = await BankPortalRepository.getAllPartnerBanks();
                  setPartnerBanks(updatedBanks);
                  setIsSavingBank(false);
                  setShowAddBankModal(false);
                  setNewBankName('');
                  setNewBankAdminEmail('');
                  setNewBankContactPerson('');
                  showToast(`Банк-партнер «${newBankName}» успешно подключен к контуру DomExit!`);
                } catch {
                  setIsSavingBank(false);
                  showError('Ошибка при подключении банка-партнера.');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Наименование кредитной организации / банка *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: ПАО «Газпромбанк», ПАО «Совкомбанк»"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Master Bank Admin Email *:
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="officer@partnerbank.ru"
                    value={newBankAdminEmail}
                    onChange={(e) => setNewBankAdminEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Временный пароль для входа *:
                  </label>
                  <input
                    type="text"
                    required
                    value={newBankTempPassword}
                    onChange={(e) => setNewBankTempPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ФИО руководителя направления / офицера:
                  </label>
                  <input
                    type="text"
                    placeholder="Иванов Сергей Николаевич"
                    value={newBankContactPerson}
                    onChange={(e) => setNewBankContactPerson(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Прямой телефон эскроу-департамента:
                  </label>
                  <input
                    type="tel"
                    value={newBankContactPhone}
                    onChange={(e) => setNewBankContactPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  URL официального логотипа (опционально):
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={newBankLogoUrl}
                  onChange={(e) => setNewBankLogoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-[11px] focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                ℹ️ При подключении автоматически активируется выделенный банковский шлюз в контуре DomExit. Уполномоченному администратору банка будут делегированы права подтверждения депонирования СБР, аккредитации застройщиков и утверждения кредитных лимитов.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSavingBank ? 'Подключение...' : 'Подключить банк'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Partner Bank */}
      {showEditBankModal && editingBank && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Редактировать параметры банка
                  </h3>
                  <p className="text-xs text-slate-500">
                    Изменение реквизитов и контактных данных шлюза СБР / Эскроу
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditBank} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Наименование кредитной организации / банка *:
                </label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Master Bank Admin Email *:
                </label>
                <input
                  type="email"
                  required
                  value={editBankAdminEmail}
                  onChange={(e) => setEditBankAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ФИО руководителя направления / офицера:
                  </label>
                  <input
                    type="text"
                    value={editBankContactPerson}
                    onChange={(e) => setEditBankContactPerson(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Прямой телефон эскроу-департамента:
                  </label>
                  <input
                    type="tel"
                    value={editBankContactPhone}
                    onChange={(e) => setEditBankContactPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  URL официального логотипа (опционально):
                </label>
                <input
                  type="url"
                  value={editBankLogoUrl}
                  onChange={(e) => setEditBankLogoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-[11px] focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditBankModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingBank}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  {isUpdatingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isUpdatingBank ? 'Сохранение...' : 'Сохранить изменения'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Partner Bank */}
      {showDeleteBankModal && deletingBank && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Удалить банк из сети?
                </h3>
                <p className="text-xs text-rose-600 font-bold">
                  {deletingBank.name}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs leading-relaxed">
              Удаление банка приведет к немедленной блокировке доступа для учетной записи <strong>{deletingBank.masterAdminEmail}</strong> и отзыву прав всех привязанных банковских офицеров.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteBankModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeletingBank}
                onClick={handleConfirmDeleteBank}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                {isDeletingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeletingBank ? 'Удаление...' : 'Да, удалить банк'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
