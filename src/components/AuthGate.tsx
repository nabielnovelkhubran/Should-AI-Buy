'use client';
import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Eye, EyeOff, ShieldCheck, AlertCircle, RefreshCw, KeyRound, Sparkles, UserCheck, Shield } from 'lucide-react';
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
            // Invalid session
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
      <div className="min-h-screen bg-[#0b0a0e] flex flex-col items-center justify-center p-4 font-mono text-xs text-[#848388]">
        <div className="w-12 h-12 rounded-2xl bg-[#1f1e23] border border-[#28272e] flex items-center justify-center p-2 mb-4 shadow-2xl animate-pulse">
          <img src="/logo.png" alt="SAIB Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00ff84]" />
          <span>Verifying terminal credentials...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b0a0e] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient radial glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00ff84]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-[#3b82f6]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Card Container */}
          <div className="bg-[#121117] rounded-2xl border border-[#28272e] p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl relative">
            {/* Top Accent Pill */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#28272e]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00ff84] animate-ping" />
                <span className="text-[11px] font-mono text-[#00ff84] font-bold uppercase tracking-wider">
                  Terminal Gate Active
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#848388] px-2 py-0.5 rounded bg-[#1f1e23] border border-[#28272e]">
                Alpaca Paper v2
              </span>
            </div>

            {/* Header Brand */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#1f1e23] border border-[#28272e] p-3 flex items-center justify-center shadow-inner group hover:border-[#00ff84]/40 transition">
                <img src="/logo.png" alt="SAIB Logo" className="w-full h-full object-contain select-none" />
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                SHOULD <span className="text-[#00ff84]">AI</span> BUY ?
              </h1>
              <p className="text-xs text-[#848388] mt-1">
                Autonomous Multi-Agent Quant Trading Council
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-[#ff3b5c]/10 border border-[#ff3b5c]/30 flex items-start gap-2.5 text-xs text-[#ff3b5c]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-[#848388] uppercase tracking-wider mb-1.5">
                  Enter Passphrase
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#848388]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    autoFocus
                    disabled={loading}
                    className="w-full pl-10 pr-10 py-2.5 bg-[#1f1e23] border border-[#28272e] rounded-xl text-sm text-white placeholder-[#525158] focus:outline-none focus:border-[#00ff84] focus:ring-1 focus:ring-[#00ff84] font-mono transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#848388] hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-xs font-mono">
                <label className="flex items-center gap-2 cursor-pointer text-[#848388] hover:text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[#28272e] bg-[#1f1e23] text-[#00ff84] focus:ring-0 cursor-pointer accent-[#00ff84]"
                  />
                  <span>Remember session (Persistent Cookie)</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#00ff84] hover:bg-[#00e576] text-black font-bold text-sm tracking-wide transition shadow-lg shadow-[#00ff84]/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Unlock Terminal</span>
                  </>
                )}
              </button>
            </form>

            {/* Dual Access Role Helper Options */}
            <div className="mt-6 pt-4 border-t border-[#28272e] space-y-2 font-mono text-[11px]">
              <div className="text-[10px] text-[#848388] uppercase tracking-wider text-center mb-1">
                Select Quick Fill / Access Tier
              </div>

              {/* View Only (Judge Mode) */}
              <div
                onClick={() => {
                  setPassword('alpaca2026');
                  handleLogin(undefined, 'alpaca2026');
                }}
                className="p-2.5 rounded-xl bg-[#1f1e23] hover:bg-[#28272e] border border-[#28272e] hover:border-blue-500/40 cursor-pointer transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-white font-bold text-xs">View-Only Mode (Judge)</div>
                    <div className="text-[10px] text-[#848388]">Full inspection • Safe read-only telemetry</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 font-bold border border-blue-500/30">
                  alpaca2026
                </span>
              </div>

              {/* Full Operator Mode */}
              <div
                onClick={() => {
                  setPassword('operator2026');
                  handleLogin(undefined, 'operator2026');
                }}
                className="p-2.5 rounded-xl bg-[#1f1e23] hover:bg-[#28272e] border border-[#28272e] hover:border-[#00ff84]/40 cursor-pointer transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#00ff84]" />
                  <div>
                    <div className="text-white font-bold text-xs">Full Operation Mode</div>
                    <div className="text-[10px] text-[#848388]">Autonomous execution &amp; risk controls</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-[#00ff84]/10 text-[#00ff84] font-bold border border-[#00ff84]/30">
                  operator2026
                </span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-4 text-center font-mono text-[10px] text-[#525158]">
            SquadBlessingMiracle • 24/7 Autonomous Cloud Daemon Active
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated: Render children
  return <>{children}</>;
};
