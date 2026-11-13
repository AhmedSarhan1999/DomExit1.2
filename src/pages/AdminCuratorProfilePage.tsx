import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { formatRussianPhoneInput, isValidRussianPhone } from '../utils/validators';
import { Employee } from '../types';
import {
  User,
  Phone,
  Send,
  CheckCircle2,
  Save,
  Upload,
  AlertCircle,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AdminCuratorProfilePage: React.FC = () => {
  const { language } = useLanguage();
  const { user, updateUserProfile, updateUserPassword } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState<string>('Алексей Смирнов');
  const [role, setRole] = useState<string>('Ведущий юрист по 214-ФЗ и эскроу-сделкам');
  const [phone, setPhone] = useState<string>('+7 (812) 409-32-11');
  const [telegram, setTelegram] = useState<string>('@domexit_smirnov');
  const [maxProfile, setMaxProfile] = useState<string>('+7 (812) 409-32-11');
  const [photoUrl, setPhotoUrl] = useState<string>(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  );
  const [bio, setBio] = useState<string>(
    '11 лет опыта в сопровождении сделок по 214-ФЗ, аккредитивам Сбербанка и ВТБ. Провел более 320 успешных уступок прав требований без судебных рисков.'
  );
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);
  const [isChangingPass, setIsChangingPass] = useState<boolean>(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const empId = user?.assignedEmployeeId || 'emp-1';
      const emp = await EmployeesRepository.getById(empId);
      if (emp) {
        setEmployee(emp);
        setName(emp.name);
        setRole(emp.role);
        setPhone(formatRussianPhoneInput(emp.phone));
        setTelegram(emp.telegram);
        setMaxProfile(emp.maxProfile || emp.whatsapp || emp.phone);
        if (emp.photoUrl) setPhotoUrl(emp.photoUrl);
        if (emp.bio) setBio(emp.bio);
      }
    }
    load();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!isValidRussianPhone(phone)) {
      setValidationError('Прямой телефон должен соответствовать стандарту +7 (XXX) XXX-XX-XX.');
      return;
    }

    setIsSaving(true);

    const empId = employee?.id || 'emp-1';
    const updated: Employee = {
      id: empId,
      name: name.trim(),
      email: employee?.email || 'smirnov@domexit.ru',
      role: role.trim(),
      phone,
      telegram: telegram.startsWith('@') ? telegram.trim() : `@${telegram.trim()}`,
      maxProfile: maxProfile.trim(),
      whatsapp: maxProfile.trim(),
      photoUrl,
      bio: bio.trim(),
      activeLotsCount: employee?.activeLotsCount || 3,
      closedDealsCount: employee?.closedDealsCount || 24,
      avgSpeedDays: employee?.avgSpeedDays || 7.5,
      status: employee?.status || 'active',
      permissions: employee?.permissions || ['legal_audit', 'packaging', 'matchmaker', 'closing'],
    };

    await EmployeesRepository.update(updated);

    // Synchronously update all lots currently assigned to this curator
    await LotsRepository.updateCuratorProfileForAssignedLots(updated);

    // Synchronously update user in AuthContext / UsersRepository
    if (updateUserProfile) {
      await updateUserProfile({
        name: updated.name,
        phone: updated.phone,
        telegram: updated.telegram,
        photoURL: updated.photoUrl,
      });
    }

    await AuditLogsRepository.addLog({
      operatorId: empId,
      operatorName: updated.name,
      operatorRole: 'curator',
      actionType: 'employee_created_modified',
      title: `Профиль куратора ${updated.name} обновлен`,
      description:
        'Обновлены контакты (Телефон, Telegram, профиль MAX), фотография и юридическое портфолио на закрепленных лотах.',
    });

    setIsSaving(false);
    setNotificationMsg(
      'Ваш профиль куратора успешно сохранен и автоматически синхронизирован со всеми вашими лотами!'
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (newPassword.length < 8) {
      setPasswordErrorMsg('Новый пароль должен содержать минимум 8 символов');
      return;
    }

    if (!/[A-Za-zА-Яа-я]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordErrorMsg('Новый пароль должен содержать как буквы, так и цифры');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('Новый пароль и подтверждение пароля не совпадают');
      return;
    }

    setIsChangingPass(true);
    try {
      if (updateUserPassword) {
        await updateUserPassword(currentPassword, newPassword);
      }
      setPasswordSuccessMsg('Пароль учетной записи куратора успешно изменен!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(null), 4000);
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || 'Ошибка смены пароля');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={
            language === 'ru'
              ? 'Мой профиль куратора и контакты'
              : 'Curator Profile & Direct Contacts'
          }
          subtitle="Персональная карточка эксперта, автоматически отображаемая на закрепленных объектах и в трекере клиентов"
        />

        {/* Global Toast */}
        {notificationMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              <span>{notificationMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotificationMsg(null)}
              className="text-white/80 hover:text-white ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (7 cols): Edit Profile Form & Security */}
            <div className="lg:col-span-7 space-y-6">
              <form
                onSubmit={handleSaveProfile}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs"
              >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  <span>Редактирование профессиональных данных куратора</span>
                </h3>
                <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Активный статус ✓
                </span>
              </div>

              {validationError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Photo Upload & Preview */}
              <div className="flex items-center space-x-5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-200 border-2 border-emerald-500 shrink-0">
                  <img src={photoUrl} alt="Фото куратора" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-800 block">
                    Профессиональная фотография
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Отображается покупателям и продавцам при ведении сделки в каталоге
                  </p>
                  <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Загрузить фото</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>
              </div>

              {/* Name & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ФИО полностью *:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Должность / Специализация *:
                  </label>
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              {/* Bio & Experience */}
              <div className="text-xs">
                <label className="block font-bold text-slate-700 mb-1">
                  Профессиональное резюме и опыт (214-ФЗ, банки, эскроу):
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Direct Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Прямой телефон РФ *:</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(formatRussianPhoneInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telegram (@username):</label>
                  <input
                    type="text"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sky-700 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Профиль MAX (Messenger / App) *:
                  </label>
                  <input
                    type="text"
                    placeholder="+7 (XXX) XXX-XX-XX или max://..."
                    value={maxProfile}
                    onChange={(e) => setMaxProfile(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-indigo-700 font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Save CTA */}
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Сохранение...' : 'Сохранить изменения профиля'}</span>
                </button>
              </div>
            </form>

            {/* Password Change Form */}
            <form
              onSubmit={handleChangePassword}
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  <span>Безопасность учетной записи и смена пароля</span>
                </h3>
                <span className="text-slate-500 text-xs font-semibold">
                  152-ФЗ / ГОСТ Р 57580
                </span>
              </div>

              {passwordSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}

              {passwordErrorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Текущий пароль учетной записи *:
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-indigo-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Новый пароль (мин. 8 симв.) *:
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-indigo-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Повтор нового пароля *:
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-indigo-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isChangingPass ? 'Обновление...' : 'Обновить пароль'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column (5 cols): Live Preview Card */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                    Как видит клиент
                  </span>
                </div>

                <p className="text-xs text-slate-500">
                  Так ваша карточка выглядит на публичной странице лота и в персональном кабинете дольщика:
                </p>

                {/* The Public Curator Badge */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-4 shadow-lg">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-700 border-2 border-emerald-400 shrink-0">
                      <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                        ПЕРСОНАЛЬНЫЙ КУРАТОР ОБЪЕКТА
                      </span>
                      <h4 className="text-base font-black text-white">{name}</h4>
                      <span className="text-xs text-slate-300 block">{role}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pt-1 border-t border-slate-700/60">
                    {bio}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <a
                      href={`https://t.me/${telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2.5 px-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors shadow-sm"
                    >
                      <Send className="w-3 h-3" />
                      <span>Telegram</span>
                    </a>
                    <a
                      href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                      className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors shadow-sm"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Позвонить</span>
                    </a>
                    <a
                      href={
                        maxProfile.startsWith('http') || maxProfile.startsWith('max://')
                          ? maxProfile
                          : `https://max.ru/${maxProfile.replace(/[^\d]/g, '')}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] flex items-center justify-center space-x-1 transition-colors shadow-sm"
                      title="Открыть профиль в приложении MAX"
                    >
                      <span className="w-3.5 h-3.5 rounded bg-white text-indigo-700 text-[8px] font-black flex items-center justify-center">
                        M
                      </span>
                      <span>MAX</span>
                    </a>
                  </div>
                </div>

                {/* Curator Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">В работе:</span>
                    <strong className="text-sm font-bold text-slate-900">
                      {employee?.activeLotsCount || 3} лота
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">Закрыто:</span>
                    <strong className="text-sm font-bold text-emerald-700">
                      {employee?.closedDealsCount || 24} сделки
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">Ср. срок:</span>
                    <strong className="text-sm font-bold text-slate-900">
                      {employee?.avgSpeedDays || 7.5} дн.
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
