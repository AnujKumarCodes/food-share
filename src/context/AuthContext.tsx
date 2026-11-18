import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { apiFetch, setMemoryToken } from '../lib/api';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'donor' | 'ngo' | 'volunteer' | 'admin';
  isEmailVerified: boolean;
  isVerified: boolean;
  isSuspended: boolean;
  donorProfile?: {
    organizationName: string;
    donorType: string;
    fssaiNumber: string;
    address: string;
    city: string;
    pinCode: string;
    verifiedByAdmin: boolean;
  } | null;
  ngoProfile?: {
    organizationName: string;
    registrationNumber: string;
    darpanId: string;
    address: string;
    city: string;
    pinCode: string;
    dailyCapacityMeals: number;
    verificationStatus: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string | null;
  } | null;
  volunteerProfile?: {
    vehicleType: string;
    licenseNumber: string;
    city: string;
    pinCode: string;
    availabilityStatus: string;
    completedPickupsCount: number;
  } | null;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: Record<string, unknown>) => Promise<{ user: UserProfile; emailVerificationTokenPreview?: string }>;
  loginWithGoogle: (role?: 'donor' | 'ngo' | 'volunteer') => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: AppNotification[]; unreadCount: number }>(
        '/api/notifications'
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: UserProfile | null }>('/api/auth/me');
      setUser(data.user);
      if (data.user) {
        await refreshNotifications();
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setMemoryToken(data.token);
    setUser(data.user);
    await refreshNotifications();
    return data.user;
  };

  const register = async (payload: Record<string, unknown>) => {
    const data = await apiFetch<{
      token: string;
      user: UserProfile;
      emailVerificationTokenPreview?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMemoryToken(data.token);
    setUser(data.user);
    await refreshNotifications();
    return {
      user: data.user,
      emailVerificationTokenPreview: data.emailVerificationTokenPreview,
    };
  };

  const loginWithGoogle = async (role?: 'donor' | 'ngo' | 'volunteer') => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setMemoryToken(idToken);
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/firebase-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ role }),
    });
    setMemoryToken(data.token);
    setUser(data.user);
    await refreshNotifications();
    return data.user;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await signOut(auth).catch(() => {});
    setMemoryToken(null);
    setUser(null);
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        notifications,
        unreadCount,
        refreshUser,
        refreshNotifications,
        login,
        register,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function getDashboardPath(role?: string) {
  switch (role) {
    case 'donor':
      return '/dashboard/donor';
    case 'ngo':
      return '/dashboard/ngo';
    case 'volunteer':
      return '/dashboard/volunteer';
    case 'admin':
      return '/dashboard/admin';
    default:
      return '/find-food';
  }
}
