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

    // 1. Admin user: adminc / cadmin
    if (u === 'adminc' && p === 'cadmin') {
      const authUser: AuthUser = {
        username: 'adminc',
        name: 'Bosh Administrator',
        role: 'admin',
        token: 'auth_' + Date.now(),
      };
      setUser(authUser);
      setIsLoading(false);
      return true;
    }

    // 2. Agent user: agentp1 / 1pagent
    if (u === 'agentp1' && p === '1pagent') {
      const authUser: AuthUser = {
        username: 'agentp1',
        name: '1-Savdo Agenti',
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
