import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { firebaseService, getStoredUser, setStoredUser, removeStoredToken, setStoredToken } from "../services/firebaseService";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: { username?: string; email?: string; phone?: string; password: string }) => Promise<void>;
  register: (userData: { username?: string; phone?: string; email?: string; password: string; name: string; company_name: string }) => Promise<{ user: User; message: string }>;
  updateProfile: (data: Partial<User>) => Promise<User>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize and verify stored user session on mount
  useEffect(() => {
    const initSession = async () => {
      const stored = getStoredUser();
      if (stored && stored.id) {
        try {
          const fresh = await firebaseService.getUserProfile(String(stored.id));
          if (fresh) {
            setUser(fresh);
            setStoredUser(fresh);
          } else {
            setUser(stored);
          }
        } catch {
          setUser(stored);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initSession();
  }, []);

  const login = async (credentials: { username?: string; email?: string; phone?: string; password: string }) => {
    const res = await firebaseService.loginUser(credentials);
    setUser(res.user);
    setStoredUser(res.user);
    setStoredToken(res.token);
  };

  const register = async (userData: { username?: string; phone?: string; email?: string; password: string; name: string; company_name: string }) => {
    const res = await firebaseService.registerUser(userData);
    setUser(res.user);
    setStoredUser(res.user);
    setStoredToken(res.token);
    return res;
  };

  const updateProfile = async (data: Partial<User>) => {
    const updated = await firebaseService.updateUserProfile(data);
    setUser(updated);
    setStoredUser(updated);
    return updated;
  };

  const deleteAccount = async () => {
    try {
      await firebaseService.deleteAccount();
    } finally {
      removeStoredToken();
      setUser(null);
    }
  };

  const logout = async () => {
    try {
      await firebaseService.logoutUser();
    } finally {
      removeStoredToken();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const stored = getStoredUser();
    if (stored && stored.id) {
      const fresh = await firebaseService.getUserProfile(String(stored.id));
      if (fresh) {
        setUser(fresh);
        setStoredUser(fresh);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loading,
        login,
        register,
        updateProfile,
        deleteAccount,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
