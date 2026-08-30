'use client';
import React from 'react';
import { ShieldAlert, Cpu, Sparkles, TrendingUp, CheckCircle2 } from 'lucide-react';
import { AlpacaAccount } from '../lib/types';
import { useCurrency } from './CurrencyProvider';

interface HeaderProps {
  account?: AlpacaAccount | null;
  activeTab: 'council' | 'portfolio' | 'evidence' | 'thesis';
  setActiveTab: (tab: 'council' | 'portfolio' | 'evidence' | 'thesis') => void;
}

export const Header: React.FC<HeaderProps> = ({ account, activeTab, setActiveTab }) => {
  const { currency, setCurrency, formatCurrency } = useCurrency();

  return (
    <header className="border-b border-slate-800 bg-[#0d111a]/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-rose-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Should-AI Buy?
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                  Adversarial Council
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Discover. <span className="text-rose-400 font-semibold">Challenge.</span> Decide.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('council')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'council'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Council Deliberation
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'evidence'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Evidence Explorer
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'portfolio'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Alpaca Portfolio & Thesis
          </button>
        </nav>

        {/* Alpaca Paper Status Badge & Currency */}
        <div className="flex items-center gap-3">
          <select 
            value={currency} 
            onChange={(e) => setCurrency(e.target.value as any)}
            className="bg-slate-800 text-slate-300 text-xs px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="IDR">IDR</option>
          </select>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">Alpaca Paper Trading</span>
            <span className="text-emerald-500 font-bold ml-1">
              {formatCurrency(account?.cash || 98450)}
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
