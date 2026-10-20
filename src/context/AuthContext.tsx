import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../dal/firebase';
import { UserProfile, PartnerEntry, InvestorApplication } from '../types';
import { FirebaseAdapter } from '../dal/adapters/FirebaseAdapter';

export const MASTER_OWNER_EMAILS = [
  'amaas9499@gmail.com',
  'ceo@domexit.ru',
];

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
  registerWithEmail: (email: string, pass: string, name: string, phone: string, role?: 'buyer' | 'seller' | 'partner' | 'investor') => Promise<UserProfile>;
  login: (data: Partial<UserProfile>) => Promise<UserProfile>;
  logout: () => Promise<void>;
  toggleFavorite: (lotCode: string) => Promise<void>;
  isFavorite: (lotCode: string) => boolean;
  switchRole: (role: 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner' | 'bank') => void;
  upgradeToPartner: (details?: Partial<PartnerEntry>) => Promise<void>;
  upgradeToInvestor: (details?: Partial<InvestorApplication>) => Promise<void>;
  quickDemoLogin: (role: 'owner' | 'employee' | 'bank' | 'partner' | 'investor' | 'seller' | 'buyer') => Promise<UserProfile>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'domexit_current_user_v3';
const COLLECTION = 'users';

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

  // Sync with Firebase Auth state changes
  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncUserFromFirebase(fbUser);
      }
    });

    return () => unsubscribe();
  }, []);

  const syncUserFromFirebase = async (fbUser: FirebaseUser): Promise<UserProfile> => {
    let profile: UserProfile | null = null;

    try {
      if (db && typeof db.type === 'string') {
        const userDocRef = doc(db, COLLECTION, fbUser.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const loaded = userSnap.data() as UserProfile;
          if (!loaded.clientCode) {
            loaded.clientCode = `DEX-${Math.floor(100000 + Math.random() * 900000)}`;
          }
          profile = loaded;
        } else {
          // Initialize fresh profile
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
          await setDoc(userDocRef, profile);
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Firestore sync fallback:', err);
    }

    if (!profile) {
      // Fallback local profile
      profile = {
        id: fbUser.uid,
        clientCode: `DEX-${Math.floor(100000 + Math.random() * 900000)}`,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Пользователь',
        email: fbUser.email || '',
        phone: '+7 (911) 234-56-78',
        roles: ['buyer', 'seller'],
        activeRole: 'buyer',
        isPartnerApproved: false,
        isInvestorApproved: false,
        partnerRefCode: `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`,
        favorites: [],
        registeredAt: new Date().toISOString(),
      };
    }

    // Auto-provision Master Owner & Test Staff roles (Mission 1)
    const cleanEmail = (fbUser.email || '').trim().toLowerCase();
    const isMasterOwner = MASTER_OWNER_EMAILS.some(e => e.toLowerCase() === cleanEmail);
    const isTestStaff = TEST_STAFF_EMAILS.some(e => e.toLowerCase() === cleanEmail);

    if (isMasterOwner) {
      profile.role = 'admin';
      profile.roles = ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'] as any;
      profile.activeRole = 'owner';
      profile.isPartnerApproved = true;
      profile.isInvestorApproved = true;
      profile.partnerRefCode = 'PARTNER-MASTER-OWNER';
      if (!profile.name || profile.name === 'Пользователь') {
        profile.name = fbUser.displayName || 'Виктор Сергеевич (Владелец / CEO)';
      }
    } else if (isTestStaff) {
      if (!profile.roles || profile.roles.length <= 2) {
        profile.roles = ['employee', 'buyer', 'seller', 'partner', 'investor'] as any;
        profile.activeRole = profile.activeRole || 'employee';
      }
      profile.assignedEmployeeId = profile.assignedEmployeeId || 'emp-1';
      if (!profile.name || profile.name === 'Пользователь') {
        profile.name = fbUser.displayName || 'Алексей Смирнов (Сотрудник / Тест)';
      }
    }

    try {
      if (db && typeof db.type === 'string') {
        const userDocRef = doc(db, COLLECTION, fbUser.uid);
        await setDoc(userDocRef, profile, { merge: true });
      }
      await FirebaseAdapter.saveEntity(COLLECTION, profile);
    } catch (saveErr) {
      console.warn('[AuthContext] Profile persistence fallback:', saveErr);
    }

    setUser(profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return profile;
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

  /**
   * Real Google Sign-In with Firebase Auth
   */
  const loginWithGoogle = async (): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      if (!auth || typeof auth.name !== 'string') {
        throw new Error('Firebase Auth is not initialized');
      }
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await syncUserFromFirebase(result.user);
      
      if (successCallback) successCallback();
      closeAuthModal();
      return profile;
    } catch (err: any) {
      console.error('[AuthContext] Google Sign-In Error:', err);
      // If popup is closed or blocked or has domain config issue, provide graceful error with fallback option
      const errorMsg = err?.code === 'auth/popup-closed-by-user'
        ? 'Окно входа было закрыто. Попробуйте снова.'
        : err?.code === 'auth/unauthorized-domain'
        ? 'Домен локального тестирования требует настройки в Firebase Console. Выполнен локальный вход.'
        : (err?.message || 'Ошибка входа через Google');
      
      setAuthError(errorMsg);

      // In case of localhost domain authorization restriction, provide auto-fallback profile
      if (err?.code === 'auth/unauthorized-domain' || err?.code === 'auth/configuration-not-found') {
        const fallbackProfile: UserProfile = {
          id: `google-user-${Date.now()}`,
          clientCode: `DEX-${Math.floor(100000 + Math.random() * 900000)}`,
          name: 'Google Пользователь (Демо)',
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
        setUser(fallbackProfile);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackProfile));
        if (successCallback) successCallback();
        closeAuthModal();
        return fallbackProfile;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Real Email/Password Login
   */
  const loginWithEmail = async (email: string, pass: string): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      if (!auth || typeof auth.name !== 'string') {
        throw new Error('Firebase Auth is not initialized');
      }
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await syncUserFromFirebase(cred.user);
      if (successCallback) successCallback();
      closeAuthModal();
      return profile;
    } catch (err: any) {
      console.error('[AuthContext] Email login error:', err);
      const msg = err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential'
        ? 'Неверный адрес электронной почты или пароль'
        : err?.code === 'auth/invalid-email'
        ? 'Некорректный формат email'
        : (err?.message || 'Ошибка входа по email');
      setAuthError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Real Email/Password Registration
   */
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
      
      const newProfile: UserProfile = {
        id: cred.user.uid,
        clientCode: `DEX-${Math.floor(100000 + Math.random() * 900000)}`,
        name: name.trim() || 'Новый Пользователь',
        email: email.trim(),
        phone: phone.trim() || '+7 (911) 000-00-00',
        telegram: '',
        roles: [role],
        activeRole: role,
        isPartnerApproved: role === 'partner',
        isInvestorApproved: role === 'investor',
        partnerRefCode: `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`,
        favorites: [],
        registeredAt: new Date().toISOString(),
      };

      if (db && typeof db.type === 'string') {
        await setDoc(doc(db, COLLECTION, cred.user.uid), newProfile);
      }

      setUser(newProfile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));

      if (successCallback) successCallback();
      closeAuthModal();
      return newProfile;
    } catch (err: any) {
      console.error('[AuthContext] Registration error:', err);
      const msg = err?.code === 'auth/email-already-in-use'
        ? 'Этот email уже зарегистрирован. Пожалуйста, выполните вход.'
        : err?.code === 'auth/weak-password'
        ? 'Пароль должен содержать не менее 6 символов.'
        : (err?.message || 'Ошибка регистрации');
      setAuthError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generic login / update profile
   */
  const login = async (data: Partial<UserProfile>): Promise<UserProfile> => {
    const updatedUser: UserProfile = {
      id: user?.id || `usr-${Date.now()}`,
      clientCode: data.clientCode || user?.clientCode || `DEX-${Math.floor(100000 + Math.random() * 900000)}`,
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
    };

    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));

    try {
      await FirebaseAdapter.saveEntity(COLLECTION, updatedUser);
    } catch (e) {
      console.warn('Firebase user sync fallback:', e);
    }

    if (successCallback) {
      successCallback();
    }

    closeAuthModal();
    return updatedUser;
  };

  /**
   * 1-Click Quick Demo Login for testing all 7 platform personas (Mission 2.2)
   * Integrates Firebase Auth with uniform password (DomExit2026!) and Firestore profile sync
   */
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
        clientCode: 'DEX-000001',
        name: 'Виктор Сергеевич (Владелец / CEO)',
        email: 'amaas9499@gmail.com', // linked to real owner
        phone: '+7 (812) 900-00-01',
        telegram: '@domexit_owner',
        role: 'admin',
        roles: ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'] as any,
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
        name: 'Алексей Смирнов (Куратор / Тест)',
        email: 'amaas9494@gmail.com', // linked to real test staff
        phone: '+7 (921) 888-11-22',
        telegram: '@domexit_smirnov',
        role: 'employee',
        roles: ['employee', 'buyer', 'seller', 'partner', 'investor'] as any,
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
        name: 'Игорь Соколов (Сбербанк Эскроу)',
        email: 'bank@domexit.ru',
        phone: '+7 (812) 500-11-00',
        telegram: '@bank_sber_escrow',
        role: 'bank',
        roles: ['bank', 'employee', 'buyer'] as any,
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
        roles: ['partner', 'buyer'] as any,
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
        roles: ['investor', 'buyer'] as any,
        activeRole: 'investor',
        isPartnerApproved: false,
        isInvestorApproved: true,
        favorites: ['U-14102', 'U-18290'],
        registeredAt: '2025-03-10T00:00:00Z',
      };
    } else if (role === 'seller') {
      demoEmail = 'seller@domexit.ru';
      profile = {
        id: 'usr-seller-001',
        clientCode: 'DEX-784105',
        name: 'Александр Владимирович (Продавец ДДУ)',
        email: 'seller@domexit.ru',
        phone: '+7 (911) 234-56-78',
        telegram: '@alex_seller',
        role: 'seller',
        roles: ['seller', 'buyer'] as any,
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
        name: 'Иван Петрович (Покупатель 100% Кэш)',
        email: 'client@domexit.ru',
        phone: '+7 (921) 987-65-43',
        telegram: '@ivan_buyer',
        role: 'buyer',
        roles: ['buyer'] as any,
        activeRole: 'buyer',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: ['U-10566'],
        registeredAt: '2025-03-15T00:00:00Z',
      };
    }

    // Try authenticating / registering in Firebase Auth with uniform password DomExit2026!
    try {
      if (auth && typeof auth.name === 'string') {
        try {
          const cred = await signInWithEmailAndPassword(auth, demoEmail, DEMO_PASSWORD);
          profile.id = cred.user.uid;
        } catch (authErr: any) {
          if (authErr?.code === 'auth/user-not-found' || authErr?.code === 'auth/invalid-credential') {
            try {
              const cred = await createUserWithEmailAndPassword(auth, demoEmail, DEMO_PASSWORD);
              profile.id = cred.user.uid;
            } catch (createErr) {
              console.warn('[AuthContext] Demo user auto-creation notice:', createErr);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[AuthContext] Demo auth notice:', e);
    }

    setUser(profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    
    try {
      if (db && typeof db.type === 'string') {
        const userDocRef = doc(db, COLLECTION, profile.id);
        await setDoc(userDocRef, profile, { merge: true });
      }
      await FirebaseAdapter.saveEntity(COLLECTION, profile);
    } catch (e) {
      console.warn('Demo login save fallback:', e);
    }

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
    } catch (err) {
      console.warn('Firebase logout notice:', err);
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
    const newFavs = currentFavs.includes(lotCode)
      ? currentFavs.filter(c => c !== lotCode)
      : [...currentFavs, lotCode];

    const updatedUser = { ...user, favorites: newFavs };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));

    try {
      await FirebaseAdapter.saveEntity(COLLECTION, updatedUser);
    } catch (e) {
      console.warn('Favorite update fallback:', e);
    }
  };

  const isFavorite = (lotCode: string): boolean => {
    return !!(user?.favorites && user.favorites.includes(lotCode));
  };

  const switchRole = (role: 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner' | 'bank') => {
    if (!user) {
      quickDemoLogin(role);
      return;
    }
    const currentRoles = user.roles || [];
    const newRoles = currentRoles.includes(role as any) ? currentRoles : [...currentRoles, role as any];
    const updatedUser: UserProfile = { 
      ...user, 
      activeRole: role, 
      roles: newRoles,
      role: role === 'owner' ? 'admin' : role,
      isPartnerApproved: role === 'partner' || role === 'owner' ? true : user.isPartnerApproved,
      isInvestorApproved: role === 'investor' || role === 'owner' ? true : user.isInvestorApproved,
    };

    if (role === 'owner') {
      updatedUser.roles = ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'] as any;
    }

    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));

    try {
      if (db && typeof db.type === 'string') {
        const userDocRef = doc(db, COLLECTION, updatedUser.id);
        setDoc(userDocRef, updatedUser, { merge: true });
      }
      FirebaseAdapter.saveEntity(COLLECTION, updatedUser);
    } catch (e) {
      console.warn('Role switch sync:', e);
    }
  };

  const upgradeToPartner = async (details?: Partial<PartnerEntry>): Promise<void> => {
    if (!user) return;
    const currentRoles = user.roles || [];
    const updatedUser: UserProfile = {
      ...user,
      roles: currentRoles.includes('partner') ? currentRoles : [...currentRoles, 'partner'],
      isPartnerApproved: true,
      partnerRefCode: user.partnerRefCode || `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`
    };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    await FirebaseAdapter.saveEntity(COLLECTION, updatedUser);
  };

  const upgradeToInvestor = async (details?: Partial<InvestorApplication>): Promise<void> => {
    if (!user) return;
    const currentRoles = user.roles || [];
    const updatedUser: UserProfile = {
      ...user,
      roles: currentRoles.includes('investor') ? currentRoles : [...currentRoles, 'investor'],
      isInvestorApproved: true
    };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    await FirebaseAdapter.saveEntity(COLLECTION, updatedUser);
  };

  const refreshUserProfile = async (): Promise<void> => {
    if (!user) return;
    try {
      const live = await FirebaseAdapter.getEntity<UserProfile>(COLLECTION, user.id);
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

