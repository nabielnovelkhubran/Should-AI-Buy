'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { UserRole } from '@/lib/auth/types';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const auth = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Bulletproof instant client-side check via localStorage + cookie
  useEffect(() => {
    const checkAuth = async () => {
      let savedToken: string | null = null;
      let savedRole: UserRole | null = null;

      if (typeof window !== 'undefined') {
        try {
          savedToken = localStorage.getItem('saib_session_token');
          savedRole = localStorage.getItem('saib_role') as UserRole | null;
        } catch {}
      }

      // Check document cookie as well
      if (!savedToken && typeof document !== 'undefined') {
        const tokenMatch = document.cookie.match(/saib_session=([^;]+)/);
        const roleMatch = document.cookie.match(/saib_role=([^;]+)/);
        if (tokenMatch) savedToken = tokenMatch[1];
        if (roleMatch) savedRole = roleMatch[1] as UserRole;
      }

      if (savedToken && savedRole) {
        auth.setAuthSession(savedRole, savedToken);
        setIsAuthenticated(true);

        // Background verification
        try {
          const res = await fetch('/api/auth/verify', { cache: 'no-store' });
          if (!res.ok) {
            auth.logout();
            setIsAuthenticated(false);
          }
        } catch {
          // If offline or network glitch, preserve local session
        }
        return;
      }

      setIsAuthenticated(false);
    };

    checkAuth();
  }, []);

  const handleLogin = async (e?: React.FormEvent, customPass?: string) => {
    if (e) e.preventDefault();
    const passToUse = (customPass || password).trim();

    if (!passToUse) {
      setError('Please enter a passphrase.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passToUse, rememberMe })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        auth.setAuthSession(data.role, data.token);
        setIsAuthenticated(true);
      } else {
        setError(data.error || 'Invalid passphrase. Access denied.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Initial Checking State
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#121117] flex flex-col items-center justify-center p-4 font-sans text-xs text-[#848388]">
        <div className="w-12 h-12 rounded-lg bg-[#1f1e23] border border-[#28272e] flex items-center justify-center p-2 mb-4 shadow-2xl">
          <img src="/logo.png" alt="SAIB Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-[#00ff84] border-t-transparent rounded-full animate-spin" />
          <span>Verifying terminal credentials...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#121117] flex flex-col items-center justify-center p-4 relative">
        <div className="w-full max-w-sm relative z-10">
          {/* Card Container */}
          <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-6 shadow-2xl relative">
            {/* Top Status Bar */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#28272e]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#00ff84] font-bold uppercase tracking-wider font-sans">
                  Terminal Gate Active
                </span>
              </div>
              <span className="text-[10px] text-[#848388] font-sans">
                Alpaca Paper v2
              </span>
            </div>

            {/* Header Brand */}
            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-2.5 rounded-lg bg-[#17161b] border border-[#28272e] p-2 flex items-center justify-center">
                <img src="/logo.png" alt="SAIB Logo" className="w-full h-full object-contain select-none" />
              </div>
              <h1 className="text-lg font-bold text-[#00ff84] tracking-tight font-phantom">
                SHOULD-AI BUY?
              </h1>
              <p className="text-[11px] text-[#848388] mt-0.5 font-sans">
                Autonomous Multi-Agent Trading Council
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-4 p-2.5 rounded bg-[#ff3b5c]/10 border border-[#ff3b5c]/30 flex items-start gap-2 text-xs text-[#ff3b5c]">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={(e) => handleLogin(e)} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-sans font-bold text-[#848388] uppercase tracking-wider mb-1">
                  Terminal Passphrase
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter passphrase..."
                    autoFocus
                    disabled={loading}
                    className="w-full px-3 py-2 pr-12 bg-[#17161b] border border-[#28272e] rounded text-xs text-white placeholder-[#848388] focus:outline-none focus:border-[#00ff84] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[11px] text-[#848388] hover:text-white transition font-sans"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-[11px] font-sans">
                <label className="flex items-center gap-1.5 cursor-pointer text-[#848388] hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[#28272e] bg-[#17161b] text-[#00ff84] focus:ring-0 cursor-pointer accent-[#00ff84]"
                  />
                  <span>Remember session token</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded bg-[#00ff84] hover:bg-[#00e576] text-[#121117] font-bold text-xs tracking-wide transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer font-sans active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Unlock Terminal</span>
                )}
              </button>
            </form>

            {/* View-Only Evaluation Access */}
            <div className="mt-5 pt-3.5 border-t border-[#28272e] space-y-2 text-[11px] font-sans">
              <div className="text-[10px] text-[#848388] uppercase tracking-wider text-center">
                Demo &amp; Evaluation Access
              </div>

              <button
                type="button"
                onClick={() => {
                  setPassword('alpaca2026');
                  handleLogin(undefined, 'alpaca2026');
                }}
                className="w-full p-2.5 rounded bg-[#17161b] hover:bg-[#28272f] border border-[#28272e] hover:border-[#34333b] cursor-pointer transition flex items-center justify-between group text-left"
              >
                <div>
                  <div className="text-white font-bold text-[11px] group-hover:text-[#38bdf8] transition font-sans">
                    1-Click Viewer Mode
                  </div>
                  <div className="text-[10px] text-[#848388]">
                    Full quant telemetry &amp; live council feed
                  </div>
                </div>
                <span className="text-[10px] text-[#38bdf8] font-bold tabular-nums group-hover:underline">
                  alpaca2026 →
                </span>
              </button>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-3 text-center font-sans text-[10px] text-[#848388]">
            Should-AI Buy? Autonomous Trading Terminal • Alpaca Paper v2
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated: Render children
  return <>{children}</>;
};
