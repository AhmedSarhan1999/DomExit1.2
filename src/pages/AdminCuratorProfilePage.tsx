import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { StorageService } from '../dal/StorageService';
import { optimizeAvatarToWebP } from '../utils/imageOptimizer';
import { UserAvatar } from '../components/shared/UserAvatar';
import { TelegramConnectCard } from '../components/telegram/TelegramConnectCard';
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

  const isOwner = Boolean(
    user && (user.role === 'owner' || user.activeRole === 'owner' || user.roles?.includes('owner'))
  );

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState<string>(user?.name || (isOwner ? 'Владелец платформы' : 'Куратор DomExit'));
  const [role, setRole] = useState<string>(
    isOwner ? 'Владелец / CEO платформы DomExit' : 'Куратор сопровождения сделок DomExit'
  );
  const [phone, setPhone] = useState<string>(user?.phone ? formatRussianPhoneInput(user.phone) : '');
  const [telegram, setTelegram] = useState<string>(user?.telegram || '');
  const [maxProfile, setMaxProfile] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>(user?.photoURL || '');
  const [bio, setBio] = useState<string>('');
  const [liveStats, setLiveStats] = useState<{ active: number; closed: number; avgDays: string }>({
    active: 0,
    closed: 0,
    avgDays: '—',
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
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
      const empId = user?.assignedEmployeeId || user?.id || '';
      const myIds = new Set([user?.id, user?.assignedEmployeeId].filter(Boolean).map(String));

      const [emp, allLots, allDeals] = await Promise.all([
        empId ? EmployeesRepository.getById(empId).catch(() => null) : Promise.resolve(null),
        LotsRepository.getAll({ includePendingApproval: true }).catch(() => []),
        DealsRepository.getAll().catch(() => []),
      ]);

      if (emp) {
        setEmployee(emp);
        setName(emp.name || user?.name || '');
        setRole(emp.role || (isOwner ? 'Владелец / CEO' : 'Куратор сделок'));
        setPhone(emp.phone ? formatRussianPhoneInput(emp.phone) : user?.phone ? formatRussianPhoneInput(user.phone) : '');
        setTelegram(emp.telegram || user?.telegram || '');
        setMaxProfile(emp.maxProfile || '');
        setPhotoUrl(emp.photoUrl || user?.photoURL || '');
        setBio(emp.bio || '');
      } else if (user) {
        setName(user.name || '');
        setRole(isOwner ? 'Владелец / CEO платформы DomExit' : 'Куратор сопровождения сделок');
        setPhone(user.phone ? formatRussianPhoneInput(user.phone) : '');
        setTelegram(user.telegram || '');
        setPhotoUrl(user.photoURL || '');
      }

      // Compute real live metrics from assigned lots & deals (0 if none)
      const myLots = (allLots || []).filter((l) =>
        myIds.has(String(l.assignedEmployeeId || (l as any).assignedCuratorId || ''))
      );
      const myDeals = (allDeals || []).filter(
        (d) =>
          myIds.has(String(d.assignedEmployeeId || '')) ||
          myLots.some((l) => l.lotCode === d.lotCode)
      );
      const closedDeals = myDeals.filter((d) => d.status === 'closed' || d.stage === 'completed');
      const activeLots = myLots.filter((l) => l.status !== 'closed');
      let avgDaysLabel = '—';
      if (closedDeals.length > 0) {
        const durations = closedDeals
          .map((d) => {
            if (!d.createdDate || !d.closedAt) return 0;
            return Math.max(
              1,
              Math.round((new Date(d.closedAt).getTime() - new Date(d.createdDate).getTime()) / 86400000)
            );
          })
          .filter((x) => x > 0);
        if (durations.length > 0) {
          avgDaysLabel = `${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)} дн.`;
        }
      }
      setLiveStats({
        active: activeLots.length,
        closed: closedDeals.length,
        avgDays: avgDaysLabel,
      });
    }
    if (user?.id) load();
  }, [user?.id, user?.assignedEmployeeId, isOwner]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (phone.trim() && !isValidRussianPhone(phone)) {
      setValidationError('Прямой телефон должен соответствовать стандарту +7 (XXX) XXX-XX-XX.');
      return;
    }

    setIsSaving(true);
    try {
      const empId = employee?.id || user?.assignedEmployeeId || user?.id || `emp-${Date.now()}`;
      const cleanTg = telegram.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@+/, '');
      const formattedTg = cleanTg ? `@${cleanTg}` : '';
      const updated: Employee = {
        id: empId,
        name: name.trim(),
        email: employee?.email || user?.email || '',
        role: role.trim(),
        phone: phone.trim(),
        telegram: formattedTg,
        maxProfile: maxProfile.trim(),
        whatsapp: maxProfile.trim(),
        photoUrl,
        bio: bio.trim(),
        activeLotsCount: liveStats.active,
        closedDealsCount: liveStats.closed,
        avgSpeedDays: employee?.avgSpeedDays || 0,
        status: employee?.status || 'active',
        permissions: employee?.permissions || ['legal_audit', 'packaging', 'matchmaker', 'closing'],
      };

      await EmployeesRepository.update(updated);
      await LotsRepository.updateCuratorProfileForAssignedLots(updated);

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
        operatorRole: isOwner ? 'owner' : 'curator',
        actionType: 'employee_created_modified',
        title: `Профиль куратора ${updated.name} обновлен`,
        description:
          'Обновлены контакты (Телефон, Telegram, MAX), фото в S3 и карточка на закрепленных лотах.',
      });

      setNotificationMsg(
        'Ваш профиль успешно сохранён в облаке и синхронизирован с карточками лотов!'
      );
      setTimeout(() => setNotificationMsg(null), 4000);
    } catch (err: any) {
      setValidationError(err?.message || 'Не удалось сохранить профиль');
    } finally {
      setIsSaving(false);
    }
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidationError(null);
    setIsUploadingPhoto(true);
    try {
      const optimized = await optimizeAvatarToWebP(file, 400, 0.85);
      const { publicUrl } = await StorageService.uploadPhoto({
        file: optimized,
        fileName: optimized.name,
        lotCode: user?.id || 'curator',
        contentType: optimized.type || 'image/webp',
        purpose: 'avatar',
      });
      setPhotoUrl(publicUrl);
      if (updateUserProfile) {
        await updateUserProfile({ photoURL: publicUrl });
      }
      setNotificationMsg('Фотография профиля загружена в облако S3!');
      setTimeout(() => setNotificationMsg(null), 3500);
    } catch (err: any) {
      setValidationError(err?.message || 'Ошибка загрузки фотографии в облако S3');
    } finally {
      setIsUploadingPhoto(false);
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
                  <UserAvatar
                    src={photoUrl}
                    name={name}
                    className="w-full h-full object-cover"
                    initialsClassName="w-full h-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xl"
                  />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-800 block">
                    Профессиональная фотография
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Загружается в S3 (WebP) и отображается покупателям и продавцам
                  </p>
                  <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isUploadingPhoto ? 'Загрузка в S3...' : 'Загрузить фото'}</span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={isUploadingPhoto}
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
                  Профессиональное резюме и опыт:
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
                  Защищенный контур
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
                      <UserAvatar
                        src={photoUrl}
                        name={name}
                        className="w-full h-full object-cover"
                        initialsClassName="w-full h-full bg-emerald-600 text-white font-black flex items-center justify-center text-base"
                      />
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

                  <div className="flex flex-wrap gap-2 pt-1">
                    {telegram.trim() && (
                      <a
                        href={`https://t.me/${telegram.replace(/^@+/, '').trim()}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors shadow-sm"
                      >
                        <Send className="w-3 h-3" />
                        <span>Telegram</span>
                      </a>
                    )}
                    {phone.trim() && (
                      <a
                        href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors shadow-sm"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Позвонить</span>
                      </a>
                    )}
                    {maxProfile.trim() && (
                      <a
                        href={
                          maxProfile.startsWith('http') || maxProfile.startsWith('max://')
                            ? maxProfile
                            : `https://max.ru/${maxProfile.replace(/^@+/, '').trim()}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] flex items-center justify-center space-x-1 transition-colors shadow-sm"
                        title="Открыть профиль в приложении MAX"
                      >
                        <span className="w-3.5 h-3.5 rounded bg-white text-indigo-700 text-[8px] font-black flex items-center justify-center">
                          M
                        </span>
                        <span>MAX</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Live Curator Metrics (0/real data, no mocks) */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">В работе:</span>
                    <strong className="text-sm font-bold text-slate-900">
                      {liveStats.active} лот(ов)
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">Закрыто:</span>
                    <strong className="text-sm font-bold text-emerald-700">
                      {liveStats.closed} сдел.
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">Ср. срок:</span>
                    <strong className="text-sm font-bold text-slate-900">
                      {liveStats.avgDays}
                    </strong>
                  </div>
                </div>

                {/* Telegram OS Binding */}
                <div className="pt-2 space-y-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-600">
                    {isOwner
                      ? 'Роль Владелец: вы получаете общеплатформенные уведомления (новые заявки продавцов, Gold-верификация, B2B партнёры, эскалации SLA и инциденты безопасности).'
                      : 'Роль Куратор: вы получаете мгновенные уведомления строго по закреплённым за вами объектам и сделкам (сообщения клиентов, ПЭП, задачи).'}
                  </div>
                  <TelegramConnectCard />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
