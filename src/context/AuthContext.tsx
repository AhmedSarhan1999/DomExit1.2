import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth, googleProvider } from '../dal/firebase';
import { UserProfile, PartnerEntry, InvestorApplication } from '../types';
import { UsersRepository } from '../dal/repositories/UsersRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';

export const MASTER_OWNER_EMAILS = ['amaas9499@gmail.com', 'ceo@domexit.ru'];

export const TEST_STAFF_EMAILS = [
  'amaas9494@gmail.com',
  'employee@domexit.ru',
  'morozov@domexit.ru',
];

export const DEMO_PASSWORD = 'DomExit2026!';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
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
    role: 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner' | 'bank'
  ) => void;
  upgradeToPartner: (details?: Partial<PartnerEntry>) => Promise<void>;
  upgradeToInvestor: (details?: Partial<InvestorApplication>) => Promise<void>;
  activateVipSubscription: () => Promise<void>;
  quickDemoLogin: (
    role: 'owner' | 'employee' | 'bank' | 'partner' | 'investor' | 'seller' | 'buyer'
  ) => Promise<UserProfile>;
  refreshUserProfile: () => Promise<void>;
  updateUserProfile: (
    data: Partial<Pick<UserProfile, 'name' | 'phone' | 'telegram' | 'photoURL'>>
  ) => Promise<UserProfile>;
  updateUserPassword: (currentPass: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'domexit_current_user_v3';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authIntentText, setAuthIntentText] = useState<string | undefined>(undefined);
  const [successCallback, setSuccessCallback] = useState<(() => void) | null>(null);

  // Sync with Firebase Auth state changes strictly through UsersRepository (DAL)
  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncUserFromAuthProvider(fbUser);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for Yandex OAuth redirect hash token (#access_token=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('token='))) {
      const cleanHash = hash.replace(/^#/, '');
      const params = new URLSearchParams(cleanHash);
      const token = params.get('access_token') || params.get('token');
      if (token) {
        handleYandexAuthCallback(token);
      }
    }
  }, []);

  const loginWithYandex = () => {
    const clientId = import.meta.env.VITE_YANDEX_OAUTH_CLIENT_ID || '72f6de11197d4e9da68ea1fec90c72e1';
    const configuredRedirect = import.meta.env.VITE_YANDEX_OAUTH_REDIRECT_URI;
    const redirectUri =
      configuredRedirect || (typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://domexit-official.netlify.app/');
    const yandexAuthUrl = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}`;
    if (typeof window !== 'undefined') {
      window.location.href = yandexAuthUrl;
    }
  };

  const handleYandexAuthCallback = async (accessToken: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('https://login.yandex.ru/info?format=json', {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Ошибка ответа Yandex OAuth API (${res.status})`);
      }

      const yandexUser = await res.json();
      const rawEmail = (yandexUser.default_email || `${yandexUser.id}@yandex.ru`).trim().toLowerCase();
      const displayName =
        yandexUser.real_name ||
        yandexUser.display_name ||
        `${yandexUser.first_name || ''} ${yandexUser.last_name || ''}`.trim() ||
        'Пользователь Яндекс';
      const phone = yandexUser.default_phone?.number || '+7 (999) 000-00-00';
      const avatarId = yandexUser.default_avatar_id;
      const avatarUrl = avatarId
        ? `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`
        : undefined;

      // Check if user exists in YDB via UsersRepository
      let profile = await UsersRepository.getByEmail(rawEmail);

      const isMasterOwner = MASTER_OWNER_EMAILS.some((e) => e.toLowerCase() === rawEmail);
      const isTestStaff = TEST_STAFF_EMAILS.some((e) => e.toLowerCase() === rawEmail);

      if (!profile) {
        const clientCode = `DEX-${Math.floor(100000 + Math.random() * 900000)}`;
        profile = {
          id: `usr-ya-${yandexUser.id || Date.now()}`,
          clientCode,
          name: displayName,
          email: rawEmail,
          phone,
          telegram: '',
          photoURL: avatarUrl,
          roles: isMasterOwner
            ? ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer']
            : isTestStaff
            ? ['employee', 'buyer', 'seller', 'partner', 'investor']
            : ['buyer', 'seller'],
          role: isMasterOwner ? 'admin' : isTestStaff ? 'employee' : 'client',
          activeRole: isMasterOwner ? 'owner' : isTestStaff ? 'employee' : 'buyer',
          isPartnerApproved: isMasterOwner,
          isInvestorApproved: isMasterOwner,
          partnerRefCode: isMasterOwner ? 'PARTNER-MASTER-OWNER' : `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`,
          favorites: [],
          registeredAt: new Date().toISOString(),
        };
      } else {
        if (avatarUrl && !profile.photoURL) profile.photoURL = avatarUrl;
        if (phone && (!profile.phone || profile.phone === '+7 (911) 000-00-00')) {
          profile.phone = phone;
        }
        if (isMasterOwner) {
          profile.role = 'admin';
          profile.roles = ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'];
          profile.activeRole = 'owner';
        }
      }

      await persistUserState(profile!);

      // Clean up URL hash without full reload
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      if (successCallback) successCallback();
      closeAuthModal();

      // Role-Based Post-Login Redirect: Staff/Owner directly to /admin/dashboard
      const isStaffOrOwner =
        profile.role === 'owner' ||
        profile.role === 'admin' ||
        profile.role === 'employee' ||
        profile.activeRole === 'owner' ||
        profile.activeRole === 'employee';

      const targetPath = isStaffOrOwner
        ? '/admin/dashboard'
        : profile.role === 'bank' || profile.activeRole === 'bank'
        ? '/admin/bank-gateway'
        : '/portal';

      if (typeof window !== 'undefined') {
        if (window.location.pathname === '/' || window.location.pathname === '/portal') {
          window.location.href = targetPath;
        }
      }
    } catch (err: any) {
      console.warn('[AuthContext] Yandex OAuth callback error:', err);
      setAuthError(err?.message || 'Ошибка авторизации через Яндекс ID');
    } finally {
      setLoading(false);
    }
  };

  const persistUserState = async (profile: UserProfile): Promise<UserProfile> => {
    setUser(profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    try {
      await UsersRepository.save(profile);
    } catch (err) {
      console.warn('[AuthContext] UsersRepository save fallback:', err);
    }
    return profile;
  };

  const syncUserFromAuthProvider = async (fbUser: FirebaseUser): Promise<UserProfile> => {
    let profile: UserProfile | null = null;

    try {
      profile =
        (await UsersRepository.getById(fbUser.uid)) ||
        (fbUser.email ? await UsersRepository.getByEmail(fbUser.email) : null);
    } catch (err) {
      console.warn('[AuthContext] DAL lookup fallback:', err);
    }

    if (!profile) {
      profile = {
        id: fbUser.uid,
        clientCode: `DEX-${Math.floor(100000 + Math.random() * 900000)}`,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Пользователь',
        email: fbUser.email || '',
        phone: fbUser.phoneNumber || '+7 (911) 000-00-00',
        telegram: '',
        photoURL: fbUser.photoURL || undefined,
        roles: ['buyer', 'seller'],
        activeRole: 'buyer',
        isPartnerApproved: false,
        isInvestorApproved: false,
        partnerRefCode: `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`,
        favorites: [],
        registeredAt: new Date().toISOString(),
      };
    } else if (!profile.clientCode) {
      profile.clientCode = `DEX-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const cleanEmail = (fbUser.email || '').trim().toLowerCase();
    const isMasterOwner = MASTER_OWNER_EMAILS.some((e) => e.toLowerCase() === cleanEmail);
    const isTestStaff = TEST_STAFF_EMAILS.some((e) => e.toLowerCase() === cleanEmail);

    if (isMasterOwner) {
      profile.role = 'admin';
      profile.roles = ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'];
      profile.activeRole = 'owner';
      profile.isPartnerApproved = true;
      profile.isInvestorApproved = true;
      profile.partnerRefCode = 'PARTNER-MASTER-OWNER';
      if (!profile.name || profile.name === 'Пользователь' || profile.name.includes('Виктор')) {
        profile.name = 'Ahmed Abdallah (Владелец / CEO)';
      }
      if (!profile.clientCode || profile.clientCode === 'DEX-000001') {
        profile.clientCode = 'DEX-104662';
      }
    } else if (isTestStaff) {
      if (!profile.roles || profile.roles.length <= 2) {
        profile.roles = ['employee', 'buyer', 'seller', 'partner', 'investor'];
        profile.activeRole = profile.activeRole || 'employee';
      }
      profile.assignedEmployeeId = profile.assignedEmployeeId || 'emp-1';
      if (!profile.name || profile.name === 'Пользователь') {
        profile.name = fbUser.displayName || 'Алексей Смирнов (Сотрудник / Тест)';
      }
    }

    return persistUserState(profile);
  };

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
    setSuccessCallback(null);
    setAuthError(null);
  };

  const loginWithGoogle = async (): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      if (!auth || typeof auth.name !== 'string') {
        throw new Error('Firebase Auth is not initialized');
      }
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await syncUserFromAuthProvider(result.user);

      if (successCallback) successCallback();
      closeAuthModal();

      // Role-Based Post-Login Redirect: Staff/Owner directly to /admin/dashboard
      const isStaffOrOwner =
        profile.role === 'owner' ||
        profile.role === 'admin' ||
        profile.role === 'employee' ||
        profile.activeRole === 'owner' ||
        profile.activeRole === 'employee';

      const targetPath = isStaffOrOwner
        ? '/admin/dashboard'
        : profile.role === 'bank' || profile.activeRole === 'bank'
        ? '/admin/bank-gateway'
        : '/portal';

      if (typeof window !== 'undefined') {
        if (window.location.pathname === '/' || window.location.pathname === '/portal') {
          window.location.href = targetPath;
        }
      }
      return profile;
    } catch (err: any) {
      const errorMsg =
        err?.code === 'auth/popup-closed-by-user'
          ? 'Окно входа было закрыто. Попробуйте снова.'
          : err?.code === 'auth/unauthorized-domain'
          ? 'Домен локального тестирования требует настройки в Firebase Console. Выполнен локальный вход.'
          : err?.message || 'Ошибка входа через Google';

      setAuthError(errorMsg);

      if (
        err?.code === 'auth/unauthorized-domain' ||
        err?.code === 'auth/configuration-not-found'
      ) {
        const fallbackProfile: UserProfile = {
          id: `google-user-${Date.now()}`,
          clientCode: `DEX-${Math.floor(100000 + Math.random() * 900000)}`,
          name: 'Google Пользователь',
          email: 'google.user@gmail.com',
          phone: '+7 (921) 555-44-33',
          roles: ['buyer', 'seller'],
          activeRole: 'buyer',
          isPartnerApproved: false,
          isInvestorApproved: false,
          partnerRefCode: 'PARTNER-GOOGLE',
          favorites: [],
          registeredAt: new Date().toISOString(),
        };
        await persistUserState(fallbackProfile);
        if (successCallback) successCallback();
        closeAuthModal();
        return fallbackProfile;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Firebase Auth first
    try {
      if (auth && typeof auth.name === 'string') {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        const profile = await syncUserFromAuthProvider(cred.user);
        if (successCallback) successCallback();
        closeAuthModal();
        return profile;
      }
    } catch (firebaseErr: any) {
      console.warn('[AuthContext] Firebase email login failed, trying YDB fallback:', firebaseErr?.code);
      // Fall through to YDB lookup below
    }

    // 2. Fallback: direct lookup in YDB users table via UsersRepository
    try {
      const ydbProfile = await UsersRepository.getByEmail(cleanEmail);
      if (ydbProfile) {
        // For YDB-only users, password is stored as a hash — for now accept DEMO_PASSWORD or stored match
        // In production this should use bcrypt; for MVP we compare plaintext fallback
        const storedPass = (ydbProfile as any).passwordHash || '';
        const isValidPass =
          (storedPass ? pass === storedPass : pass === DEMO_PASSWORD) ||
          (ydbProfile as any).authProvider === 'yandex';

        if (isValidPass) {
          const profile = await persistUserState(ydbProfile);
          if (successCallback) successCallback();
          closeAuthModal();
          return profile;
        }
      }
    } catch (ydbErr) {
      console.warn('[AuthContext] YDB email fallback lookup error:', ydbErr);
    }

    const msg = 'Неверный адрес электронной почты или пароль';
    setAuthError(msg);
    setLoading(false);
    throw new Error(msg);
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
      if (!auth || typeof auth.name !== 'string') {
        throw new Error('Firebase Auth is not initialized');
      }
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const clientCode = `DEX-${Math.floor(100000 + Math.random() * 900000)}`;
      const partnerRefCode = `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`;

      const newProfile: UserProfile = {
        id: cred.user.uid,
        clientCode,
        name: name.trim() || 'Новый Пользователь',
        email: email.trim(),
        phone: phone.trim() || '+7 (911) 000-00-00',
        telegram: '',
        roles: role === 'buyer' || role === 'seller' ? ['buyer', 'seller'] : ['buyer', 'seller', role],
        activeRole: role,
        isPartnerApproved: false,
        isInvestorApproved: false,
        partnerRefCode,
        favorites: [],
        registeredAt: new Date().toISOString(),
      };

      await persistUserState(newProfile);

      if (role === 'partner') {
        await PartnersRepository.add({
          uid: newProfile.id,
          userId: newProfile.id,
          clientCode: newProfile.clientCode,
          name: newProfile.name,
          phone: newProfile.phone,
          email: newProfile.email,
          referralCode: partnerRefCode,
          status: 'pending',
        });
      } else if (role === 'investor') {
        await InvestorClubRepository.submit({
          uid: newProfile.id,
          userId: newProfile.id,
          clientCode: newProfile.clientCode,
          fullName: newProfile.name,
          countryAndCity: 'Российская Федерация',
          contactTelegramOrPhone: newProfile.phone,
          entityType: 'individual',
          capitalVolume: '15-50m',
          strategy: 'flipping',
          targetRegions: ['Санкт-Петербург', 'Москва'],
          requestedServices: ['Ранний доступ 48 часов'],
          customProposal: 'Регистрация через портал инвестора',
          ndaAgreed: true,
          status: 'pending',
        });
      }

      if (successCallback) successCallback();
      closeAuthModal();

      const profile = newProfile;

      // Role-Based Post-Login Redirect: Staff/Owner directly to /admin/dashboard
      const isStaffOrOwner =
        profile.role === 'owner' ||
        profile.role === 'admin' ||
        profile.role === 'employee' ||
        profile.activeRole === 'owner' ||
        profile.activeRole === 'employee';

      const targetPath = isStaffOrOwner
        ? '/admin/dashboard'
        : profile.role === 'bank' || profile.activeRole === 'bank'
        ? '/admin/bank-gateway'
        : '/portal';

      if (typeof window !== 'undefined') {
        if (window.location.pathname === '/' || window.location.pathname === '/portal') {
          window.location.href = targetPath;
        }
      }
      return newProfile;
    } catch (err: any) {
      const msg =
        err?.code === 'auth/email-already-in-use'
          ? 'Этот email уже зарегистрирован. Пожалуйста, выполните вход.'
          : err?.code === 'auth/weak-password'
          ? 'Пароль должен содержать не менее 6 символов.'
          : err?.message || 'Ошибка регистрации';
      setAuthError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: Partial<UserProfile>): Promise<UserProfile> => {
    const updatedUser: UserProfile = {
      id: user?.id || `usr-${Date.now()}`,
      clientCode:
        data.clientCode ||
        user?.clientCode ||
        `DEX-${Math.floor(100000 + Math.random() * 900000)}`,
      name: data.name || user?.name || 'Александр В.',
      phone: data.phone || user?.phone || '+7 (911) 234-56-78',
      email: data.email || user?.email || 'alexander@domexit.ru',
      telegram: data.telegram || user?.telegram || '@alex_investor',
      photoURL: data.photoURL || user?.photoURL,
      roles: data.roles || user?.roles || ['buyer', 'seller'],
      activeRole: (data.activeRole as any) || user?.activeRole || 'buyer',
      isPartnerApproved: data.isPartnerApproved ?? user?.isPartnerApproved ?? false,
      isInvestorApproved: data.isInvestorApproved ?? user?.isInvestorApproved ?? false,
      partnerRefCode: data.partnerRefCode || user?.partnerRefCode || 'PARTNER-777',
      favorites: data.favorites || user?.favorites || [],
      registeredAt: user?.registeredAt || new Date().toISOString(),
      activeDealId: data.activeDealId || user?.activeDealId || 'DEAL-2025-10566',
      investorPackagePreference:
        data.investorPackagePreference || user?.investorPackagePreference,
    };

    await persistUserState(updatedUser);

    if (successCallback) {
      successCallback();
    }

    closeAuthModal();
    return updatedUser;
  };

  const quickDemoLogin = async (
    role: 'owner' | 'employee' | 'bank' | 'partner' | 'investor' | 'seller' | 'buyer'
  ): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);

    let demoEmail = 'client@domexit.ru';
    let profile: UserProfile;

    if (role === 'owner') {
      demoEmail = 'ceo@domexit.ru';
      profile = {
        id: 'usr-owner-001',
        clientCode: 'DEX-104662',
        name: 'Ahmed Abdallah (Владелец / CEO)',
        email: 'amaas9499@gmail.com',
        phone: '+7 (812) 900-00-01',
        telegram: '@domexit_owner',
        role: 'admin',
        roles: ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'],
        activeRole: 'owner',
        isPartnerApproved: true,
        isInvestorApproved: true,
        partnerRefCode: 'PARTNER-MASTER-OWNER',
        favorites: ['U-10566', 'U-14102'],
        registeredAt: '2025-01-01T00:00:00Z',
      };
    } else if (role === 'employee') {
      demoEmail = 'employee@domexit.ru';
      profile = {
        id: 'usr-staff-002',
        clientCode: 'DEX-000002',
        name: 'Алексей Смирнов',
        email: 'amaas9494@gmail.com',
        phone: '+7 (921) 888-11-22',
        telegram: '@domexit_smirnov',
        role: 'employee',
        roles: ['employee', 'buyer', 'seller'],
        activeRole: 'employee',
        assignedEmployeeId: 'emp-1',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: ['U-10566'],
        registeredAt: '2025-02-01T00:00:00Z',
      };
    } else if (role === 'bank') {
      demoEmail = 'bank@domexit.ru';
      profile = {
        id: 'usr-bank-001',
        clientCode: 'DEX-000004',
        name: 'Игорь Владимирович Соколов (Сбербанк)',
        email: 'bank@domexit.ru',
        phone: '+7 (812) 500-11-00',
        telegram: '@bank_sber_escrow',
        role: 'bank',
        roles: ['bank', 'employee', 'buyer'],
        activeRole: 'bank',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: [],
        registeredAt: '2025-02-15T00:00:00Z',
      };
    } else if (role === 'partner') {
      demoEmail = 'partner@domexit.ru';
      profile = {
        id: 'usr-partner-001',
        clientCode: 'DEX-110022',
        name: 'Елена Кузнецова (Партнер-брокер)',
        email: 'partner@domexit.ru',
        phone: '+7 (911) 456-78-90',
        telegram: '@elena_partner',
        role: 'partner',
        roles: ['partner', 'buyer'],
        activeRole: 'partner',
        isPartnerApproved: true,
        isInvestorApproved: false,
        partnerRefCode: 'PARTNER-SPB-12',
        favorites: [],
        registeredAt: '2025-03-05T00:00:00Z',
      };
    } else if (role === 'investor') {
      demoEmail = 'investor@domexit.ru';
      profile = {
        id: 'usr-investor-001',
        clientCode: 'DEX-990088',
        name: 'Сергей Николаевич (VIP Инвестор)',
        email: 'investor@domexit.ru',
        phone: '+7 (921) 777-99-00',
        telegram: '@sergey_capital',
        role: 'investor',
        roles: ['investor', 'buyer'],
        activeRole: 'investor',
        isPartnerApproved: false,
        isInvestorApproved: true,
        favorites: ['U-14102', 'U-10715'],
        investorPackagePreference: {
          budgetMillions: 35,
          selectedPackage: 'flipping',
          updatedAt: '2026-10-19T12:00:00Z',
        },
        registeredAt: '2025-03-10T00:00:00Z',
      };
    } else if (role === 'seller') {
      demoEmail = 'seller@domexit.ru';
      profile = {
        id: 'usr-seller-001',
        clientCode: 'DEX-784105',
        name: 'Александр Владимирович Б.',
        email: 'seller@domexit.ru',
        phone: '+7 (911) 234-56-78',
        telegram: '@alex_seller',
        role: 'seller',
        roles: ['seller', 'buyer'],
        activeRole: 'seller',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: ['U-10566'],
        activeDealId: 'DEAL-2025-10566',
        registeredAt: '2025-03-01T00:00:00Z',
      };
    } else {
      demoEmail = 'client@domexit.ru';
      profile = {
        id: 'usr-buyer-001',
        clientCode: 'DEX-409112',
        name: 'Иван Петрович',
        email: 'client@domexit.ru',
        phone: '+7 (921) 987-65-43',
        telegram: '@ivan_buyer',
        role: 'buyer',
        roles: ['buyer'],
        activeRole: 'buyer',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: ['U-10566'],
        registeredAt: '2025-03-15T00:00:00Z',
      };
    }

    try {
      if (auth && typeof auth.name === 'string') {
        try {
          const cred = await signInWithEmailAndPassword(auth, demoEmail, DEMO_PASSWORD);
          profile.id = cred.user.uid;
        } catch (authErr: any) {
          if (
            authErr?.code === 'auth/user-not-found' ||
            authErr?.code === 'auth/invalid-credential'
          ) {
            try {
              const cred = await createUserWithEmailAndPassword(auth, demoEmail, DEMO_PASSWORD);
              profile.id = cred.user.uid;
            } catch {
              // Keep deterministic local profile ID
            }
          }
        }
      }
    } catch {
      // Offline / local fallback
    }

    await persistUserState(profile);

    setLoading(false);
    if (successCallback) successCallback();
    closeAuthModal();
    return profile;
  };

  const logout = async () => {
    try {
      if (auth && typeof auth.signOut === 'function') {
        await signOut(auth);
      }
    } catch {
      // Ignore
    }
    setUser(null);
    setFirebaseUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('domexit_current_user_v3');
      localStorage.removeItem('domexit_current_user_v2');
      localStorage.removeItem('domexit_active_role');
      localStorage.removeItem('last_agreed_version');
      sessionStorage.clear();
    } catch {
      // Ignore
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const toggleFavorite = async (lotCode: string): Promise<void> => {
    if (!user) {
      openAuthModal('Войдите, чтобы сохранять объекты в избранное');
      return;
    }
    const currentFavs = user.favorites || [];
    const isRemoving = currentFavs.includes(lotCode);
    const newFavs = isRemoving
      ? currentFavs.filter((c) => c !== lotCode)
      : [...currentFavs, lotCode];

    const updatedUser = { ...user, favorites: newFavs };
    await persistUserState(updatedUser);
    await LotsRepository.adjustFavoritesCount(lotCode, isRemoving ? -1 : 1);
  };

  const isFavorite = (lotCode: string): boolean => {
    return !!(user?.favorites && user.favorites.includes(lotCode));
  };

  const switchRole = (
    role: 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner' | 'bank'
  ) => {
    // Switching persona via the top Role Switcher loads that distinct persona's canonical account
    quickDemoLogin(role);
  };

  const upgradeToPartner = async (details?: Partial<PartnerEntry>): Promise<void> => {
    if (!user) return;
    const refCode =
      details?.referralCode ||
      user.partnerRefCode ||
      `DOMEXIT-REF-${Math.floor(1000 + Math.random() * 9000)}`;

    const existing = await PartnersRepository.getById(user.id);
    if (!existing) {
      await PartnersRepository.add({
        uid: user.id,
        userId: user.id,
        clientCode: user.clientCode,
        name: details?.name || user.name,
        organization: details?.organization || 'Независимый брокер / агентство',
        role: details?.role || 'Ипотечный брокер',
        category: details?.category || 'mortgage_broker',
        phone: details?.phone || user.phone,
        email: details?.email || user.email,
        referralCode: refCode,
        status: user.activeRole === 'owner' ? 'approved' : 'pending',
      });
    }

    const currentRoles = user.roles || [];
    const updatedUser: UserProfile = {
      ...user,
      roles: currentRoles.includes('partner') ? currentRoles : [...currentRoles, 'partner'],
      isPartnerApproved: user.activeRole === 'owner' ? true : user.isPartnerApproved,
      partnerRefCode: refCode,
    };
    await persistUserState(updatedUser);
  };

  const upgradeToInvestor = async (details?: Partial<InvestorApplication>): Promise<void> => {
    if (!user) return;
    const existing = await InvestorClubRepository.getByUser(user.id, user.clientCode);
    if (!existing) {
      await InvestorClubRepository.submit({
        uid: user.id,
        userId: user.id,
        clientCode: user.clientCode,
        fullName: details?.fullName || user.name,
        companyOrFund: details?.companyOrFund || 'Частный капитал',
        countryAndCity: details?.countryAndCity || 'Российская Федерация',
        contactTelegramOrPhone: details?.contactTelegramOrPhone || user.phone,
        entityType: details?.entityType || 'individual',
        capitalVolume: details?.capitalVolume || '15-50m',
        strategy: details?.strategy || 'flipping',
        targetRegions: details?.targetRegions || ['Санкт-Петербург', 'Москва'],
        requestedServices: details?.requestedServices || ['Ранний доступ 48 часов'],
        customProposal: details?.customProposal || 'Заявка из личного кабинета клиента',
        ndaAgreed: true,
        status: user.activeRole === 'owner' ? 'approved' : 'pending',
      });
    }

    const currentRoles = user.roles || [];
    const updatedUser: UserProfile = {
      ...user,
      roles: currentRoles.includes('investor') ? currentRoles : [...currentRoles, 'investor'],
      isInvestorApproved: user.activeRole === 'owner' ? true : user.isInvestorApproved,
    };
    await persistUserState(updatedUser);
  };

  const activateVipSubscription = async (): Promise<void> => {
    if (!user) return;
    const updatedUser: UserProfile = {
      ...user,
      isVipSubscriber: true,
    };
    await persistUserState(updatedUser);
  };

  const updateUserProfile = async (
    data: Partial<Pick<UserProfile, 'name' | 'phone' | 'telegram' | 'photoURL'>>
  ): Promise<UserProfile> => {
    if (!user) throw new Error('Пользователь не авторизован');
    const updated: UserProfile = {
      ...user,
      ...data,
    };
    await persistUserState(updated);

    if (firebaseUser) {
      try {
        
        await updateProfile(firebaseUser, {
          displayName: data.name ?? user.name,
          photoURL: data.photoURL ?? user.photoURL,
        });
      } catch (err) {
        console.warn('Firebase profile sync fallback:', err);
      }
    }
    return updated;
  };

  const updateUserPassword = async (currentPass: string, newPass: string): Promise<void> => {
    if (!user) throw new Error('Пользователь не авторизован');
    if (!newPass || newPass.length < 8) {
      throw new Error('Пароль должен содержать не менее 8 символов');
    }

    // 1. Try Firebase Auth sync if available
    if (firebaseUser && firebaseUser.email) {
      try {
        if (currentPass) {
          const cred = EmailAuthProvider.credential(firebaseUser.email, currentPass);
          await reauthenticateWithCredential(firebaseUser, cred);
        }
        await updatePassword(firebaseUser, newPass);
      } catch (err: any) {
        if (err?.code === 'auth/wrong-password') {
          throw new Error('Неверно указан текущий пароль');
        } else if (err?.code === 'auth/requires-recent-login') {
          console.warn('[AuthContext] Firebase session expired, continuing with primary YDB update');
        } else {
          console.warn('[AuthContext] Firebase password sync notice:', err?.message);
        }
      }
    }

    // 2. Persist new password to Yandex YDB users table via UsersRepository
    const updatedUser: UserProfile = {
      ...user,
      passwordHash: newPass,
      updatedAt: new Date().toISOString(),
    } as any;

    await UsersRepository.save(updatedUser);
    setUser(updatedUser);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    }

    // 3. Audit trail in YDB audit_logs
    await AuditLogsRepository.addLog({
      operatorName: user.name || 'Пользователь',
      operatorRole: (user.activeRole as any) || (user.role as any) || 'owner',
      actionType: 'employee_created_modified',
      title: 'Пароль учетной записи успешно обновлен',
      description: `Пользователь ${user.name} (${user.email || user.clientCode}) обновил пароль в защищенной базе данных YDB (152-ФЗ).`,
    }).catch(() => {});
  };

  const refreshUserProfile = async (): Promise<void> => {
    if (!user) return;
    try {
      const live = await UsersRepository.getById(user.id);
      if (live) {
        setUser(live);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(live));
      }
    } catch (err) {
      console.warn('Refresh user notice:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isAuthenticated: !!user,
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
        upgradeToInvestor,
        activateVipSubscription,
        quickDemoLogin,
        refreshUserProfile,
        updateUserProfile,
        updateUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
