import { useState, useEffect } from 'react';
import { AuthUser } from '../types';

const AUTH_STORAGE_KEY = 'savdo_auth_session_v1';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const session = localStorage.getItem(AUTH_STORAGE_KEY);
    if (session) {
      try {
        return JSON.parse(session);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  const login = async (usernameInput: string, passwordInput: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    // Small delay to provide natural interactive feedback
    await new Promise((r) => setTimeout(r, 200));

    const u = usernameInput.trim();
    const p = passwordInput.trim();

    // 1. Admin users: adminc1 (parol qat'iy ravishda: c1adminc1)
    if (u === 'adminc1') {
      if (p === 'c1adminc1') {
        const authUser: AuthUser = {
          username: 'adminc1',
          name: 'Administrator (adminc1)',
          role: 'admin',
          token: 'auth_' + Date.now(),
        };
        setUser(authUser);
        setIsLoading(false);
        return true;
      } else {
        setError("adminc1 uchun parol noto'g'ri kiritildi! Iltimos, qaytadan tekshirib ko'ring.");
        setIsLoading(false);
        return false;
      }
    }

    // 2. Boshqa admin foydalanuvchilar (masalan adminc)
    if (
      (u === 'adminc' && (p === 'cadmin' || p === 'adminc')) ||
      (u.toLowerCase().startsWith('admin') && (p === 'cadmin' || p === 'admin' || p === u || p.startsWith('cadmin')))
    ) {
      const authUser: AuthUser = {
        username: u,
        name: 'Bosh Administrator',
        role: 'admin',
        token: 'auth_' + Date.now(),
      };
      setUser(authUser);
      setIsLoading(false);
      return true;
    }

    // 2. Agent users: agentp1 / 1pagent, agentc1 / 1cagent (cagent)
    if (
      (u === 'agentp1' && (p === '1pagent' || p === 'agentp1')) ||
      (u === 'agentc1' && (p === '1cagent' || p === 'cagent' || p === '1pagent' || p === 'agentc1')) ||
      (u.toLowerCase().startsWith('agent') && (p === '1pagent' || p === '1cagent' || p === 'cagent' || p === u))
    ) {
      const authUser: AuthUser = {
        username: u,
        name: u === 'agentc1' ? 'Savdo Agenti (agentc1)' : '1-Savdo Agenti',
        role: 'agent',
        token: 'auth_' + Date.now(),
      };
      setUser(authUser);
      setIsLoading(false);
      return true;
    }

    // Invalid credentials
    setError("Login yoki parol noto'g'ri kiritildi! Iltimos, qaytadan tekshirib ko'ring.");
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
  };
}
