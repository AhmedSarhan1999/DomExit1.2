import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, X, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SetPasswordModal: React.FC<SetPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, refreshUserProfile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const hasMinLength = newPassword.length >= 8;
  const hasLettersAndDigits = /[A-Za-zА-Яа-я]/.test(newPassword) && /\d/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = hasMinLength && hasLettersAndDigits && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasMinLength) {
      setError('Пароль должен содержать минимум 8 символов');
      return;
    }
    if (!hasLettersAndDigits) {
      setError('Пароль должен содержать как буквы, так и цифры');
      return;
    }
    if (!passwordsMatch) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/api/auth/set-password', {
        newPassword,
        confirmPassword,
      });
      await refreshUserProfile();
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить пароль. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await apiClient.post('/api/auth/dismiss-password-setup', {});
    } catch {
      // non-blocking
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-black text-white">Создание пароля аккаунта</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Вы вошли через Яндекс ID. Задайте пароль, чтобы иметь возможность входить в DomExit как по Яндекс ID, так и по связке Email + пароль.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {user?.email && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Email аккаунта:</span>
              <span className="font-mono font-bold text-slate-900">{user.email}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Пароль успешно установлен!</h4>
              <p className="text-xs text-slate-500">
                Теперь вы можете входить в личный кабинет по электронной почте и заданному паролю.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="Минимум 8 символов"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Повторите пароль
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Requirement indicators */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex items-center space-x-2">
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      hasMinLength ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span className={hasMinLength ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
                    Не менее 8 символов
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      hasLettersAndDigits ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span className={hasLettersAndDigits ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
                    Буквы и цифры
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      passwordsMatch ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span className={passwordsMatch ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
                    Пароли совпадают
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
                >
                  Позже
                </button>
                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center space-x-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'Сохранение...' : 'Задать пароль'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
