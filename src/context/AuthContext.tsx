import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../dal/firebase';
import { UserProfile, PartnerEntry, InvestorApplication } from '../types';
import { UsersRepository } from '../dal/repositories/UsersRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';

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
  quickDemoLogin: (
    role: 'owner' | 'employee' | 'bank' | 'partner' | 'investor' | 'seller' | 'buyer'
  ) => Promise<UserProfile>;
  refreshUserProfile: () => Promise<void>;
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
      profile.name = 'Ahmed Abdallah - Владелец / CEO';
    } else if (isTestStaff) {
      if (!profile.roles || profile.roles.length <= 2) {
        profile.roles = ['employee', 'buyer', 'seller', 'partner', 'investor'];
        profile.activeRole = profile.activeRole || 'employee';
      }
      profile.assignedEmployeeId = profile.assignedEmployeeId || 'emp-1';
      profile.name = 'Алексей Смирнов (Ведущий куратор)';
    } else if (cleanEmail === 'bank@domexit.ru') {
      profile.role = 'bank';
      profile.activeRole = 'bank';
      profile.roles = ['bank'];
      profile.name = 'Игорь Соколов (Банк-партнер Сбербанк)';
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
    try {
      if (!auth || typeof auth.name !== 'string') {
        throw new Error('Firebase Auth is not initialized');
      }
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await syncUserFromAuthProvider(cred.user);
      if (successCallback) successCallback();
      closeAuthModal();
      return profile;
    } catch (err: any) {
      const msg =
        err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential'
          ? 'Неверный адрес электронной почты или пароль'
          : err?.code === 'auth/invalid-email'
          ? 'Некорректный формат email'
          : err?.message || 'Ошибка входа по email';
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
      bankCreditLimit: data.bankCreditLimit || user?.bankCreditLimit,
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
      demoEmail = 'amaas9499@gmail.com';
      profile = {
        id: 'usr-owner-001',
        clientCode: 'DEX-000001',
        name: 'Ahmed Abdallah - Владелец / CEO',
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
      demoEmail = 'amaas9494@gmail.com';
      profile = {
        id: 'usr-staff-002',
        clientCode: 'DEX-000002',
        name: 'Алексей Смирнов (Ведущий куратор)',
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
        name: 'Игорь Соколов (Банк-партнер Сбербанк)',
        email: 'bank@domexit.ru',
        phone: '+7 (812) 500-11-00',
        telegram: '@bank_sber_escrow',
        role: 'bank',
        roles: ['bank'],
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
    localStorage.removeItem(STORAGE_KEY);
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
        quickDemoLogin,
        refreshUserProfile,
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
