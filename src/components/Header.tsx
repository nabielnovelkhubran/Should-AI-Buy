'use client';
import React from 'react';
import { Award, Lock } from 'lucide-react';
import { AlpacaAccount } from '../lib/types';
import { useCurrency } from './CurrencyProvider';

export type DashboardTab = 'command' | 'council' | 'discovery' | 'portfolio' | 'evidence' | 'automation' | 'observability' | 'broker_diagnostics' | 'execution_lab' | 'workflow_auditor';

interface HeaderProps {
  account?: AlpacaAccount | null;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
}

const NAV_TABS: { id: DashboardTab; label: string }[] = [
  { id: 'observability', label: 'Live Alpha' },
  { id: 'command', label: 'Command Lab' },
  { id: 'council', label: 'Council' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'workflow_auditor', label: 'Strategy Audit' },
  { id: 'broker_diagnostics', label: 'Broker Diag' },
  { id: 'evidence', label: 'Evidence' },
];

export const Header: React.FC<HeaderProps> = ({ account, activeTab, setActiveTab }) => {
  const { currency, setCurrency, formatCurrency } = useCurrency();
  const isCompetition = process.env.NEXT_PUBLIC_TRADING_ENVIRONMENT === 'competition';
  const equity = (account as any)?.equity ?? (account as any)?.portfolioValue ?? null;

  return (
    <header
      style={{ background: '#121117', borderBottom: '1px solid #28272e' }}
      className="sticky top-0 z-40 px-4 lg:px-6"
    >
      <div className="flex items-center justify-between h-11 gap-2">
        {/* Left: Brand Logo + Nav Tabs in the same container */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/logo.png"
              alt="SAIB Logo"
              className="w-7 h-7 object-contain select-none"
            />
            <span
              className="text-sm font-bold tracking-tight font-phantom"
              style={{ color: '#00ff84', letterSpacing: '-0.03em' }}
            >
              SHOULD-AI BUY?
            </span>
          </div>

          {/* Nav Tabs — Sim Lab removed */}
          <nav className="flex items-center gap-0 overflow-x-auto no-scrollbar h-11">
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative shrink-0 px-3.5 h-11 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    color: isActive ? '#00ff84' : '#8b8a91',
                    borderBottom: isActive ? '2px solid #00ff84' : '2px solid transparent',
                    background: 'transparent',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Account Equity + Mode + Currency */}
        <div className="flex items-center gap-3 shrink-0">
          {isCompetition && (
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold mono-num px-2 py-1 rounded"
              style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <Award className="w-3 h-3" />
              <span>COMPETITION $100K</span>
            </div>
          )}

          {equity != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#8b8a91' }}>Equity</span>
              <span className="text-sm font-bold mono-num" style={{ color: '#00ff84' }}>
                {formatCurrency(Number(equity))}
              </span>
            </div>
          )}

          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="text-[11px] rounded px-1.5 py-1 focus:outline-none cursor-pointer mono-num"
            style={{
              background: '#1f1e23',
              border: '1px solid #28272e',
              color: '#8b8a91'
            }}
          >
            <option value="USD">USD</option>
            <option value="IDR">IDR</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="SGD">SGD</option>
            <option value="AUD">AUD</option>
          </select>

          <button
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.reload();
              } catch {}
            }}
            className="p-1.5 rounded hover:text-white transition flex items-center gap-1 text-[11px] font-mono cursor-pointer"
            style={{
              background: '#1f1e23',
              border: '1px solid #28272e',
              color: '#8b8a91'
            }}
            title="Lock Terminal Session"
          >
            <Lock className="w-3 h-3 text-[#00ff84]" />
            <span className="hidden sm:inline text-[10px]">LOCK</span>
          </button>
        </div>
      </div>
    </header>
  );
};
