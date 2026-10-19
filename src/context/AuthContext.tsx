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
  switchRole: (role: 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner') => void;
  upgradeToPartner: (details?: Partial<PartnerEntry>) => Promise<void>;
  upgradeToInvestor: (details?: Partial<InvestorApplication>) => Promise<void>;
  quickDemoLogin: (role: 'owner' | 'employee' | 'seller' | 'buyer' | 'partner' | 'investor') => Promise<UserProfile>;
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
          profile = userSnap.data() as UserProfile;
        } else {
          // Initialize fresh profile
          profile = {
            id: fbUser.uid,
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
   * 1-Click Quick Demo Login for testing all platform personas
   */
  const quickDemoLogin = async (role: 'owner' | 'employee' | 'seller' | 'buyer' | 'partner' | 'investor'): Promise<UserProfile> => {
    setLoading(true);
    let profile: UserProfile;

    if (role === 'owner') {
      profile = {
        id: 'usr-owner-001',
        name: 'Виктор Сергеевич (Генеральный директор)',
        email: 'ceo@domexit.ru',
        phone: '+7 (812) 900-00-01',
        telegram: '@domexit_ceo',
        roles: ['owner', 'employee', 'buyer', 'seller', 'partner', 'investor'],
        activeRole: 'owner',
        isPartnerApproved: true,
        isInvestorApproved: true,
        partnerRefCode: 'PARTNER-OWNER',
        favorites: ['U-10566', 'U-14102'],
        registeredAt: '2025-01-01T00:00:00Z',
      };
    } else if (role === 'employee') {
      profile = {
        id: 'emp-1',
        name: 'Алексей Морозов (Ведущий куратор)',
        email: 'morozov@domexit.ru',
        phone: '+7 (921) 888-11-22',
        telegram: '@alexey_morozov',
        roles: ['employee', 'buyer'],
        activeRole: 'employee',
        assignedEmployeeId: 'emp-1',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: ['U-10566'],
        registeredAt: '2025-02-01T00:00:00Z',
      };
    } else if (role === 'seller') {
      profile = {
        id: 'usr-seller-alex',
        name: 'Александр Владимирович Б.',
        email: 'alexander.b@mail.ru',
        phone: '+7 (911) 234-56-78',
        telegram: '@alex_seller',
        roles: ['seller', 'buyer'],
        activeRole: 'seller',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: ['U-10566'],
        activeDealId: 'DEAL-2025-10566',
        registeredAt: '2025-03-01T00:00:00Z',
      };
    } else if (role === 'partner') {
      profile = {
        id: 'usr-partner-elena',
        name: 'Елена Смирнова (Агентство Недвижимости)',
        email: 'elena.realty@mail.ru',
        phone: '+7 (911) 456-78-90',
        telegram: '@elena_partner',
        roles: ['partner', 'buyer'],
        activeRole: 'partner',
        isPartnerApproved: true,
        isInvestorApproved: false,
        partnerRefCode: 'PARTNER-SPB-12',
        favorites: [],
        registeredAt: '2025-03-05T00:00:00Z',
      };
    } else if (role === 'investor') {
      profile = {
        id: 'usr-investor-sergey',
        name: 'Сергей Николаевич К. (VIP Инвестор)',
        email: 'sergey.invest@familyoffice.ru',
        phone: '+7 (921) 777-99-00',
        telegram: '@sergey_capital',
        roles: ['investor', 'buyer'],
        activeRole: 'investor',
        isPartnerApproved: false,
        isInvestorApproved: true,
        favorites: ['U-14102', 'U-18290'],
        registeredAt: '2025-03-10T00:00:00Z',
      };
    } else {
      profile = {
        id: 'usr-buyer-ivan',
        name: 'Иван Петрович К.',
        email: 'ivan.buyer@yandex.ru',
        phone: '+7 (921) 987-65-43',
        telegram: '@ivan_buyer',
        roles: ['buyer'],
        activeRole: 'buyer',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: ['U-10566'],
        registeredAt: '2025-03-15T00:00:00Z',
      };
    }

    setUser(profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    
    try {
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

  const switchRole = (role: 'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner') => {
    if (!user) return;
    const currentRoles = user.roles || [];
    const newRoles = currentRoles.includes(role) ? currentRoles : [...currentRoles, role];
    const updatedUser = { ...user, activeRole: role, roles: newRoles };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));

    try {
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

