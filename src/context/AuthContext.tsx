import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, PartnerEntry } from '../types';
import { UsersRepository } from '../dal/repositories/UsersRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { apiClient, ApiError } from '../services/apiClient';
import { clientCache } from '../services/clientCache';
import { swrCache } from '../dal/cache/SWRCache';

type UserRole = 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner';

export const MASTER_OWNER_EMAILS = ['amaas9499@gmail.com', 'ceo@domexit.ru'];

export const TEST_STAFF_EMAILS = [
  'amaas9494@gmail.com',
  'employee@domexit.ru',
  'morozov@domexit.ru',
];

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authIntentText?: string;
  loading: boolean;
  authError: string | null;
  openAuthModal: (intentText?: string, callback?: () => void) => void;
  closeAuthModal: () => void;
  loginWithYandex: () => void;
  loginWithGoogle: () => Promise<UserProfile>;
  loginWithEmail: (email: string, pass: string) => Promise<UserProfile>;
  registerWithEmail: (
    email: string,
    pass: string,
    name: string,
    phone: string,
    role?: 'buyer' | 'seller' | 'partner' | 'investor'
  ) => Promise<UserProfile>;
  login: (data: Partial<UserProfile>) => Promise<UserProfile>;
  logout: () => Promise<void>;
  toggleFavorite: (lotCode: string) => Promise<void>;
  isFavorite: (lotCode: string) => boolean;
  switchRole: (
    role: 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner'
  ) => void;
  upgradeToPartner: (details?: Partial<PartnerEntry>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updateUserProfile: (
    data: Partial<Pick<UserProfile, 'name' | 'phone' | 'telegram' | 'photoURL' | 'inn'>>
  ) => Promise<UserProfile>;
  updateUserPassword: (currentPass: string, newPass: string) => Promise<void>;
  setPassword?: (newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authIntentText, setAuthIntentText] = useState<string | undefined>(undefined);
  const [successCallback, setSuccessCallback] = useState<(() => void) | null>(null);

  // Initialize Session from HttpOnly Cookie on mount via /api/auth/me
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const res = await apiClient.get<{ user?: UserProfile }>('/api/auth/me');
        if (isMounted) {
          if (res?.user) {
            setUser(res.user);
          } else {
            setUser(null);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const openAuthModal = (intentText?: string, callback?: () => void) => {
    setAuthIntentText(intentText);
    setAuthError(null);
    if (callback) {
      setSuccessCallback(() => callback);
    } else {
      setSuccessCallback(null);
    }
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthIntentText(undefined);
    setAuthError(null);
    setSuccessCallback(null);
  };

  const loginWithYandex = () => {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    window.location.href = `${apiBase}/api/auth/yandex/start`;
  };

  const loginWithGoogle = async (): Promise<UserProfile> => {
    throw new Error('Авторизация через Google отключена в соответствии с 149-ФЗ. Используйте Яндекс ID.');
  };

  const loginWithEmail = async (email: string, pass: string): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await apiClient.post<{ success: boolean; user: UserProfile }>(
        '/api/auth/login',
        { email, password: pass }
      );
      if (!res?.user) {
        throw new Error('Не удалось получить профиль пользователя');
      }

      setUser(res.user);
      swrCache.clear();
      clientCache.clear();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('domexit:dal_updated', {
            detail: { collectionName: 'users', id: res.user.id },
          })
        );
      }

      closeAuthModal();
      successCallback?.();
      return res.user;
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Ошибка авторизации';
      setAuthError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string,
    phone: string,
    role: 'buyer' | 'seller' | 'partner' | 'investor' = 'buyer'
  ): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await apiClient.post<{ success: boolean; user: UserProfile }>(
        '/api/auth/register',
        {
          email,
          password: pass,
          name,
          phone,
          role: role === 'seller' ? 'seller' : 'buyer',
        }
      );

      if (!res?.user) {
        throw new Error('Ошибка создания профиля пользователя');
      }

      setUser(res.user);
      swrCache.clear();
      clientCache.clear();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('domexit:dal_updated', {
            detail: { collectionName: 'users', id: res.user.id },
          })
        );
      }

      closeAuthModal();
      successCallback?.();
      return res.user;
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Ошибка регистрации';
      setAuthError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: Partial<UserProfile>): Promise<UserProfile> => {
    if (data.email) {
      const existing = await UsersRepository.getByEmail(data.email);
      if (existing) {
        setUser(existing);
        return existing;
      }
    }
    const current: UserProfile = user || {
      id: `usr-${Date.now()}`,
      clientCode: data.clientCode || 'DEX-GUEST',
      phone: data.phone || '+7 (999) 000-00-00',
      email: data.email || 'guest@domexit.ru',
      name: data.name || 'Гость',
      role: (data.role as any) || 'buyer',
      activeRole: (data.activeRole as any) || data.role || 'buyer',
      roles: (data.roles as any) || ['buyer'],
      isPartnerApproved: false,
      isInvestorApproved: false,
      registeredAt: new Date().toISOString(),
      favorites: [],
    };
    setUser(current);
    return current;
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Non-fatal if session already expired
    } finally {
      setUser(null);
      swrCache.clear();
      clientCache.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('domexit:dal_updated'));
      }
      setLoading(false);
    }
  };

  const switchRole = async (
    targetRole: 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner'
  ) => {
    if (!user) return;
    try {
      await apiClient.post<{ success: boolean; activeRole: string }>(
        '/api/auth/switch-role',
        { targetRole }
      );
      setUser((prev) => (prev ? { ...prev, activeRole: targetRole as any } : null));
      swrCache.clear();
      clientCache.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('domexit:dal_updated', {
            detail: { collectionName: 'users', id: user.id },
          })
        );
      }
    } catch (err: any) {
      console.warn('[AuthContext] switchRole notice:', err.message);
      // Fallback local state if role exists in user.roles
      const roles = user.roles || [user.role];
      if (roles.includes(targetRole as any)) {
        setUser((prev) => (prev ? { ...prev, activeRole: targetRole as any } : null));
      }
    }
  };

  const updateUserProfile = async (
    data: Partial<Pick<UserProfile, 'name' | 'phone' | 'telegram' | 'photoURL' | 'inn'>>
  ): Promise<UserProfile> => {
    if (!user) throw new Error('Не авторизован');
    try {
      const res = await apiClient.patch<{ success: boolean; user: UserProfile }>(
        '/api/auth/profile',
        data
      );
      const updated = res.user || { ...user, ...data };
      setUser(updated);
      swrCache.invalidatePrefix(`getById:users:${user.id}`);
      return updated;
    } catch (err: any) {
      console.error('[AuthContext] updateUserProfile error:', err);
      throw err;
    }
  };

  const toggleFavorite = async (lotCode: string): Promise<void> => {
    if (!user) {
      openAuthModal('Войдите, чтобы сохранить объект в избранное');
      return;
    }

    const currentFavs = user.favorites || [];
    const nextFavs = currentFavs.includes(lotCode)
      ? currentFavs.filter((c) => c !== lotCode)
      : [...currentFavs, lotCode];

    try {
      const res = await apiClient.patch<{ success: boolean; user: UserProfile }>(
        '/api/auth/profile',
        { favorites: nextFavs }
      );
      setUser(res.user || { ...user, favorites: nextFavs });
    } catch {
      setUser((prev) => (prev ? { ...prev, favorites: nextFavs } : null));
    }
  };

  const isFavorite = (lotCode: string): boolean => {
    return Boolean(user?.favorites?.includes(lotCode));
  };

  const refreshUserProfile = async (): Promise<void> => {
    try {
      const res = await apiClient.get<{ user?: UserProfile }>('/api/auth/me');
      if (res?.user) {
        setUser(res.user);
      }
    } catch {
      // Non-fatal
    }
  };

  const upgradeToPartner = async (details?: Partial<PartnerEntry>): Promise<void> => {
    if (!user) return;
    try {
      await PartnersRepository.add({
        userId: user.id,
        uid: user.id,
        clientCode: user.clientCode,
        name: details?.name || user.name,
        phone: details?.phone || user.phone || '',
        email: user.email,
        ...details,
      });
      await refreshUserProfile();
    } catch (err) {
      console.warn('[AuthContext] upgradeToPartner notice:', err);
    }
  };

  const updateUserPassword = async (currentPass: string, newPass: string): Promise<void> => {
    if (!user) throw new Error('Пользователь не авторизован');
    if (user.hasPassword === false) {
      await apiClient.post('/api/auth/set-password', {
        newPassword: newPass,
        confirmPassword: newPass,
      });
    } else {
      await apiClient.post('/api/auth/change-password', {
        currentPassword: currentPass,
        newPassword: newPass,
        confirmPassword: newPass,
      });
    }
    await refreshUserProfile();
  };

  const setPassword = async (newPass: string): Promise<void> => {
    await apiClient.post('/api/auth/set-password', {
      newPassword: newPass,
      confirmPassword: newPass,
    });
    await refreshUserProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isAuthModalOpen,
        authIntentText,
        loading,
        authError,
        openAuthModal,
        closeAuthModal,
        loginWithYandex,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        login,
        logout,
        toggleFavorite,
        isFavorite,
        switchRole,
        upgradeToPartner,
        refreshUserProfile,
        updateUserProfile,
        updateUserPassword,
        setPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
