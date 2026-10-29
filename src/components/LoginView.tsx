import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface Props {
  onLogin: (username: string, pass: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export const LoginView: React.FC<Props> = ({ onLogin, isLoading, error }) => {
  const [username, setUsername] = useState('adminc');
  const [password, setPassword] = useState('cadmin');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(username, password);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FAF7F7] selection:bg-rose-200">
      {/* Top bar with install button */}
      <div className="max-w-7xl w-full mx-auto px-4 py-4 flex items-center justify-end">
        <PWAInstallButton />
      </div>

      {/* Main Login Card - Clean and minimal */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-rose-100/90 overflow-hidden p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium leading-tight">{error}</span>
              </div>
            )}

            {/* Login input */}
            <div>
              <label
                htmlFor="usernameInput"
                className="block text-xs font-bold text-neutral-800 mb-1.5 uppercase tracking-wide"
              >
                Login
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="usernameInput"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Login"
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-sm text-neutral-900 font-medium placeholder:text-neutral-400 outline-none transition bg-neutral-50/40 focus:bg-white"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <label
                htmlFor="passwordInput"
                className="block text-xs font-bold text-neutral-800 mb-1.5 uppercase tracking-wide"
              >
                Parol
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="passwordInput"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parol"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-neutral-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-sm text-neutral-900 font-medium placeholder:text-neutral-400 outline-none transition bg-neutral-50/40 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 min-h-[44px] min-w-[44px] justify-center"
                  aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-sm font-bold shadow-md shadow-rose-900/15 transition disabled:opacity-60 min-h-[48px] flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? <span>Tekshirilmoqda...</span> : <span>Kirish</span>}
            </button>
          </form>
        </div>
      </div>

      <div className="h-6"></div>
    </div>
  );
};
