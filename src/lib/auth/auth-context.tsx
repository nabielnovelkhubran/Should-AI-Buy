'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from './types';

interface AuthContextType {
  role: UserRole | null;
  isOperator: boolean;
  isViewer: boolean;
  logout: () => Promise<void>;
  setAuthSession: (role: UserRole, token: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  isOperator: false,
  isViewer: false,
  logout: async () => {},
  setAuthSession: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode; initialRole?: UserRole | null }> = ({
  children,
  initialRole = null
}) => {
  const [role, setRole] = useState<UserRole | null>(initialRole);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('saib_role') as UserRole | null;
      if (savedRole && (savedRole === 'OPERATOR' || savedRole === 'VIEWER')) {
        setRole(savedRole);
      }
    }
  }, []);

  const setAuthSession = (newRole: UserRole, token: string) => {
    setRole(newRole);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saib_role', newRole);
        localStorage.setItem('saib_session_token', token);
        // Also ensure cookie is set on document
        document.cookie = 'saib_session=' + token + '; path=/; max-age=2592000; SameSite=Lax';
        document.cookie = 'saib_role=' + newRole + '; path=/; max-age=2592000; SameSite=Lax';
      } catch {}
    }
  };

  const logout = async () => {
    setRole(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('saib_role');
        localStorage.removeItem('saib_session_token');
        document.cookie = 'saib_session=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'saib_role=; path=/; max-age=0; SameSite=Lax';
      } catch {}
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        isOperator: role === 'OPERATOR',
        isViewer: role === 'VIEWER',
        logout,
        setAuthSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
