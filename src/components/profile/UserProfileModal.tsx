import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  Lock,
  Phone,
  Mail,
  Send,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  KeyRound,
  FileCheck,
  Building2,
  Crown,
  Briefcase,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatRussianPhoneInput, isValidRussianPhone } from '../../utils/validators';
import { UserProfile, Employee } from '../../types';
import { EmployeesRepository } from '../../dal/repositories/EmployeesRepository';
import { LotsRepository } from '../../dal/repositories/LotsRepository';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProfileModalTab = 'general' | 'avatar' | 'security' | 'roles';

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, updateUserProfile, updateUserPassword, logout } = useAuth();
  const { language } = useLanguage();

  const handleLogout = async () => {
    onClose();
    try {
      if (logout) {
        await logout();
      }
    } finally {
      navigate('/');
    }
  };

  const [activeTab, setActiveTab] = useState<ProfileModalTab>('general');

  // Fallback demo/officer profile if session not yet established in localStorage
  const currentUser: UserProfile = user || {
    id: 'usr-default-officer',
    clientCode: 'DEX-104662',
    name: 'Ahmed Abdallah (Владелец / Офицер банка)',
    email: 'amaas9499@gmail.com',
    phone: '+7 (911) 900-00-00',
    telegram: '@domexit_official',
    role: 'owner',
    roles: ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'],
    activeRole: 'owner',
    isPartnerApproved: true,
    isInvestorApproved: true,
    partnerRefCode: 'PARTNER-MASTER-OWNER',
    favorites: [],
    registeredAt: '2026-01-01T00:00:00.000Z',
  };

  // Form states
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [telegram, setTelegram] = useState<string>('');
  const [photoURL, setPhotoURL] = useState<string>('');
  const [customPhotoInput, setCustomPhotoInput] = useState<string>('');

  // Password states
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);

  // Status & Feedback states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isChangingPass, setIsChangingPass] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize data on modal open
  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || '');
      setPhone(currentUser.phone || '+7 ');
      setTelegram(currentUser.telegram || '');
      setPhotoURL(currentUser.photoURL || '');
      setCustomPhotoInput(currentUser.photoURL || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [currentUser.name, currentUser.phone, currentUser.photoURL, currentUser.telegram, isOpen]);

  if (!isOpen) return null;

  const roleLabelsRu: Record<string, string> = {
    owner: 'Владелец платформы (CEO)',
    employee: 'Куратор сделок (DomExit)',
    bank: 'Офицер банка-партнера',
    buyer: 'Покупатель / Дольщик',
    seller: 'Продавец ДДУ',
    investor: 'Резидент VIP раннего доступа (48ч)',
    partner: 'Аккредитованный партнер',
    admin: 'Системный администратор',
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRussianPhoneInput(e.target.value);
    setPhone(formatted);
  };

  // Avatar file upload handler via FileReader
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Пожалуйста, выберите файл изображения (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Размер файла аватара не должен превышать 5 МБ');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoURL(reader.result);
        setCustomPhotoInput('');
        setSuccessMessage('Аватар загружен! Нажмите «Сохранить изменения» для фиксации.');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setPhotoURL('');
    setCustomPhotoInput('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Введите корректное имя или ФИО (не менее 2 символов)');
      return;
    }

    const cleanPhone = phone.trim();
    if (cleanPhone && cleanPhone !== '+7 ' && !isValidRussianPhone(cleanPhone)) {
      setErrorMessage('Номер телефона должен соответствовать стандарту РФ: +7 (XXX) XXX-XX-XX');
      return;
    }

    setIsSaving(true);
    try {
      if (updateUserProfile) {
        await updateUserProfile({
          name: cleanName,
          phone: cleanPhone,
          telegram: telegram.trim(),
          photoURL: photoURL.trim() || undefined,
        });
      }

      // Synchronize with EmployeesRepository and assigned lots if employee
      if (
        currentUser.role === 'employee' ||
        currentUser.activeRole === 'employee' ||
        currentUser.assignedEmployeeId
      ) {
        const empId = currentUser.assignedEmployeeId || currentUser.id;
        const existingEmp = await EmployeesRepository.getById(empId);
        const updatedEmp: Employee = {
          id: empId,
          name: cleanName,
          email: currentUser.email || existingEmp?.email || 'curator@domexit.ru',
          role: existingEmp?.role || 'Ведущий куратор отдела выходов',
          phone: cleanPhone,
          telegram: telegram.trim().startsWith('@') ? telegram.trim() : `@${telegram.trim()}`,
          whatsapp: existingEmp?.whatsapp || cleanPhone,
          maxProfile: existingEmp?.maxProfile || cleanPhone,
          photoUrl: photoURL.trim() || existingEmp?.photoUrl,
          bio:
            existingEmp?.bio ||
            'Сертифицированный специалист по сделкам с уступкой прав по 214-ФЗ и аккредитивным расчетам.',
          activeLotsCount: existingEmp?.activeLotsCount || 0,
          closedDealsCount: existingEmp?.closedDealsCount || 0,
          avgSpeedDays: existingEmp?.avgSpeedDays || 8.0,
          status: existingEmp?.status || 'active',
          permissions: existingEmp?.permissions || ['legal_audit', 'packaging', 'matchmaker', 'closing'],
        };
        await EmployeesRepository.update(updatedEmp);
        await LotsRepository.updateCuratorProfileForAssignedLots(updatedEmp);
      }

      setSuccessMessage('Профиль успешно обновлен и синхронизирован!');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Не удалось сохранить профиль');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage('Новый пароль должен содержать минимум 8 символов');
      return;
    }

    if (!/[A-Za-zА-Яа-я]/.test(newPassword) || !/\d/.test(newPassword)) {
      setErrorMessage('Новый пароль должен содержать как буквы, так и цифры');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Новый пароль и подтверждение пароля не совпадают');
      return;
    }

    setIsChangingPass(true);
    try {
      if (updateUserPassword) {
        await updateUserPassword(currentPassword, newPassword);
      }
      setSuccessMessage('Пароль учетной записи успешно изменен!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ошибка смены пароля');
    } finally {
      setIsChangingPass(false);
    }
  };

  const activeRoleName = currentUser.activeRole || currentUser.role || 'buyer';
  const roleDisplay = roleLabelsRu[activeRoleName] || activeRoleName;
  const initialLetter = (currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black text-slate-900">
                  {language === 'ru' ? 'Профиль и безопасность' : 'Profile & Security'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                  {currentUser.clientCode || 'DEX-USER'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {roleDisplay} • 214-ФЗ / 152-ФЗ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'general'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Личные данные</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('avatar')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'avatar'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Аватар</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Смена пароля</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'roles'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Роли и доступы</span>
          </button>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: General Info */}
          {activeTab === 'general' && (
            <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ФИО пользователя / Полное наименование <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Иванов Иван Иванович"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Телефон (стандарт РФ +7)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="+7 (999) 000-00-00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Используется для двухфакторных SMS-кодов и согласования договоров уступки прав.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Telegram аккаунт
                </label>
                <div className="relative">
                  <Send className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Электронная почта (Логин)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={currentUser.email || 'Не указана'}
                    disabled
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 cursor-not-allowed select-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Email защищен протоколом 152-ФЗ. Для смены почты обратитесь к куратору комплаенса.
                </p>
              </div>
            </form>
          )}

          {/* TAB 2: Avatar */}
          {activeTab === 'avatar' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-5">
                <div className="relative w-24 h-24 rounded-3xl bg-slate-100 border-2 border-emerald-500/40 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={name}
                      className="w-full h-full object-cover"
                      onError={() => setPhotoURL('')}
                    />
                  ) : (
                    <span className="text-3xl font-black text-emerald-700">{initialLetter}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">Аватар профиля</h4>
                  <p className="text-xs text-slate-500">
                    Отображается в личных кабинетах, чате сделки и реестре участников.
                  </p>
                  {photoURL && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="inline-flex items-center space-x-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Удалить аватар</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Upload Drop Area */}
              <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center space-y-2 bg-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors block text-center">
                <Upload className="w-8 h-8 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Нажмите для выбора файла с устройства
                </span>
                <span className="text-[11px] text-slate-400">
                  Поддерживаются форматы PNG, JPG, WebP до 5 МБ
                </span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleAvatarFileUpload}
                  className="hidden"
                />
              </label>

              {/* Direct URL Alternative */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Либо укажите прямую ссылку на фото:
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    value={customPhotoInput}
                    onChange={(e) => setCustomPhotoInput(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customPhotoInput.trim()) {
                        setPhotoURL(customPhotoInput.trim());
                        setSuccessMessage('Ссылка на аватар применена!');
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Применить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Security & Password */}
          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Требования к безопасности пароля</span>
                </span>
                <p className="text-[11px] text-slate-600">
                  Минимум 8 символов, обязательное сочетание букв латиницы или кириллицы и арабских цифр.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Текущий пароль
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Введите текущий пароль"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Новый пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Не менее 8 символов"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Повторите новый пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повторите новый пароль"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPass || !newPassword}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isChangingPass ? 'Обновление...' : 'Обновить пароль учетной записи'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: Roles & Compliance */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Текущая активная роль:</span>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    {roleDisplay}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">ID клиента (Client Code):</span>
                  <span className="font-mono font-bold text-xs text-slate-900">
                    {currentUser.clientCode || 'DEX-000000'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Дата регистрации:</span>
                  <span className="text-xs text-slate-700">
                    {currentUser.registeredAt ? new Date(currentUser.registeredAt).toLocaleDateString('ru-RU') : '2026'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Правовой аудит 214-ФЗ:</span>
                  <span className="text-xs text-emerald-700 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Верифицирован</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Доступные роли в системе
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {(currentUser.roles || [activeRoleName]).map((r) => (
                    <div
                      key={r}
                      className="p-3 rounded-xl bg-white border border-slate-200 text-xs flex items-center space-x-2"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">
                        {roleLabelsRu[r] || r}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Выйти из аккаунта</span>
            </button>
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Безопасное соединение • TLS 1.3 • DomExit ID
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              Закрыть
            </button>

            {(activeTab === 'general' || activeTab === 'avatar') && (
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <span>Сохранение...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Сохранить профиль</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
