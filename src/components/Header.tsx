'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlpacaAccount } from '../lib/types';
import { useCurrency } from './CurrencyProvider';
import { useAuth } from '@/lib/auth/auth-context';
import { SettingsModal } from './SettingsModal';

export type DashboardTab = 'command' | 'council' | 'discovery' | 'portfolio' | 'evidence' | 'automation' | 'observability' | 'broker_diagnostics' | 'execution_lab' | 'workflow_auditor';

interface HeaderProps {
  account?: AlpacaAccount | null;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
}

const NAV_TABS: { id: DashboardTab; label: string; hasDropdown?: boolean }[] = [
  { id: 'observability', label: 'Dashboard' },
  { id: 'command', label: 'Command Lab' },
  { id: 'council', label: 'Council', hasDropdown: true },
  { id: 'discovery', label: 'Discovery' },
  { id: 'portfolio', label: 'Portfolio', hasDropdown: true },
];

export const Header: React.FC<HeaderProps> = ({ account, activeTab, setActiveTab }) => {
  const { currency, setCurrency, formatCurrency } = useCurrency();
  const { role, isOperator, logout } = useAuth();
  const isCompetition = process.env.NEXT_PUBLIC_TRADING_ENVIRONMENT === 'competition';
  const equity = (account as any)?.equity ?? (account as any)?.portfolioValue ?? null;

  // Phantom Terminal Animated Sliding Pill Indicator & Dropdowns
  const [hoveredTab, setHoveredTab] = useState<DashboardTab | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'council' | 'portfolio' | null>(null);
  const dropdownCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isClickOpenedRef = useRef<boolean>(false);

  // Lock Confirmation State (prevents accidental 1-click logout)
  const [confirmLock, setConfirmLock] = useState(false);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLockClick = () => {
    if (!confirmLock) {
      setConfirmLock(true);
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = setTimeout(() => setConfirmLock(false), 3000);
      return;
    }
    logout();
  };

  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const tabRefs = useRef<{ [key in DashboardTab]?: HTMLButtonElement | null }>({});
  const navContainerRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number }>({ left: 16 });

  const effectiveActiveTab: DashboardTab =
    activeTab === 'workflow_auditor' || activeTab === 'evidence'
      ? 'council'
      : activeTab === 'broker_diagnostics'
      ? 'portfolio'
      : activeTab;
  const currentHighlight = hoveredTab || effectiveActiveTab;

  const updateDropdownPos = useCallback((menu: 'council' | 'portfolio') => {
    const targetEl = tabRefs.current[menu];
    const headerEl = headerRef.current;
    if (targetEl && headerEl) {
      const headerRect = headerEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      let left = targetRect.left - headerRect.left;
      const panelWidth = 260;
      if (left + panelWidth > headerRect.width - 8) {
        left = Math.max(8, headerRect.width - panelWidth - 8);
      }
      setDropdownPos({ left: Math.max(8, left) });
    }
  }, []);

  const handleDropdownMouseEnter = (menu: 'council' | 'portfolio') => {
    if (dropdownCloseTimeoutRef.current) {
      clearTimeout(dropdownCloseTimeoutRef.current);
      dropdownCloseTimeoutRef.current = null;
    }
    isClickOpenedRef.current = false;
    updateDropdownPos(menu);
    setActiveDropdown(menu);
  };

  const handleDropdownMouseLeave = () => {
    if (isClickOpenedRef.current) return;
    dropdownCloseTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  useEffect(() => {
    if (activeDropdown) {
      updateDropdownPos(activeDropdown);
    }
  }, [activeDropdown, updateDropdownPos]);

  useEffect(() => {
    if (!activeDropdown) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
        isClickOpenedRef.current = false;
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        isClickOpenedRef.current = false;
      }
    };
    const handleReposition = () => {
      if (activeDropdown) updateDropdownPos(activeDropdown);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleReposition);
    const navEl = navContainerRef.current;
    if (navEl) {
      navEl.addEventListener('scroll', handleReposition, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleReposition);
      if (navEl) {
        navEl.removeEventListener('scroll', handleReposition);
      }
    };
  }, [activeDropdown, updateDropdownPos]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setActiveTab('command');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('saib:focus-command-input'));
          const input = document.querySelector<HTMLInputElement>('input[placeholder*="Ask"]');
          input?.focus();
        }, 40);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  useEffect(() => {
    const targetEl = tabRefs.current[currentHighlight];
    const container = navContainerRef.current;
    if (targetEl && container) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      setIndicatorStyle({
        left: targetRect.left - containerRect.left + container.scrollLeft,
        width: targetRect.width,
        opacity: 1,
      });
    }
  }, [currentHighlight, activeTab]);

  return (
    <header
      ref={headerRef}
      style={{ background: '#121117', borderBottom: '1px solid #28272e' }}
      className="sticky top-0 z-[100] px-4 lg:px-6 select-none"
    >
      <div className="flex items-center justify-between h-11 gap-3">
        {/* Left: Brand Logo + Phantom Animated Nav Tabs */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Brand Logo & Name */}
          <div
            onClick={() => setActiveTab('observability')}
            className="flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <img
              src="/logo.png"
              alt="SAIB Logo"
              className="w-7 h-7 object-contain select-none"
            ></img>
            <span
              className="hidden sm:inline text-sm font-bold tracking-tight font-phantom"
              style={{ color: '#00ff84', letterSpacing: '-0.03em' }}
            >
              SHOULD-AI BUY?
            </span>
          </div>

          {/* Phantom-Style Smooth Nav Tabs */}
          <nav
            ref={navContainerRef}
            onMouseLeave={() => setHoveredTab(null)}
            className="relative flex items-center h-11 overflow-x-auto no-scrollbar"
          >
            {/* Smooth Sliding Pill Indicator */}
            <div
              className="absolute top-1.5 bottom-1.5 rounded-lg transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
              style={{
                transform: `translateX(${indicatorStyle.left}px)`,
                width: `${indicatorStyle.width}px`,
                opacity: indicatorStyle.opacity,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #28272e',
              }}
            />

            {NAV_TABS.map((tab) => {
              const isCouncilTab = tab.id === 'council';
              const isPortfolioTab = tab.id === 'portfolio';

              const isTabActive = isCouncilTab
                ? activeTab === 'council' || activeTab === 'workflow_auditor' || activeTab === 'evidence'
                : isPortfolioTab
                ? activeTab === 'portfolio' || activeTab === 'broker_diagnostics'
                : activeTab === tab.id;

              if (tab.hasDropdown) {
                const isDropdownOpen =
                  (isCouncilTab && activeDropdown === 'council') ||
                  (isPortfolioTab && activeDropdown === 'portfolio');

                return (
                  <div
                    key={tab.id}
                    onMouseEnter={() => handleDropdownMouseEnter(isCouncilTab ? 'council' : 'portfolio')}
                    onMouseLeave={handleDropdownMouseLeave}
                    className="relative flex items-center h-11"
                  >
                    <button
                      ref={(el) => {
                        tabRefs.current[tab.id] = el;
                      }}
                      onClick={() => {
                        const nextMenu = isCouncilTab ? 'council' : 'portfolio';
                        if (dropdownCloseTimeoutRef.current) {
                          clearTimeout(dropdownCloseTimeoutRef.current);
                          dropdownCloseTimeoutRef.current = null;
                        }
                        if (isCouncilTab && !isTabActive) {
                          setActiveTab('council');
                        } else if (isPortfolioTab && !isTabActive) {
                          setActiveTab('portfolio');
                        }
                        if (activeDropdown === nextMenu) {
                          setActiveDropdown(null);
                          isClickOpenedRef.current = false;
                        } else {
                          updateDropdownPos(nextMenu);
                          setActiveDropdown(nextMenu);
                          isClickOpenedRef.current = true;
                        }
                      }}
                      onMouseEnter={() => setHoveredTab(tab.id)}
                      className="relative z-10 shrink-0 px-3.5 h-11 text-[11px] font-semibold uppercase tracking-wider transition-colors duration-200 flex items-center gap-1 cursor-pointer"
                      style={{
                        color: isTabActive ? '#00ff84' : '#8b8a91',
                        background: 'transparent',
                      }}
                    >
                      <span>{tab.label}</span>
                      <svg
                        className={`w-2.5 h-2.5 phantom-chevron ${
                          isDropdownOpen ? 'rotate-180 text-[#00ff84]' : 'text-[#8b8a91]'
                        }`}
                        viewBox="0 0 10 6"
                        fill="none"
                      >
                        <path
                          d="M1 1.5L5 4.5L9 1.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {isTabActive && (
                        <span
                          className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                          style={{ background: '#00ff84' }}
                        />
                      )}
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'command') {
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('saib:focus-command-input'));
                        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Ask"]');
                        input?.focus();
                      }, 40);
                    }
                  }}
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  className="relative z-10 shrink-0 px-3.5 h-11 text-[11px] font-semibold uppercase tracking-wider transition-colors duration-200 flex items-center cursor-pointer"
                  style={{
                    color: isTabActive ? '#00ff84' : '#8b8a91',
                    background: 'transparent',
                  }}
                >
                  <span>{tab.label}</span>
                  {isTabActive && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                      style={{ background: '#00ff84' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center: Search Bar Shortcut */}
        <div
          onClick={() => {
            setActiveTab('command');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('saib:focus-command-input'));
              const input = document.querySelector<HTMLInputElement>('input[placeholder*="Ask"]');
              input?.focus();
            }, 40);
          }}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors cursor-pointer select-none"
          style={{
            background: '#1f1e23',
            border: '1px solid #28272e',
            color: '#8b8a91',
          }}
        >
          <span>Ask council ($BTC, $NVDA...)</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-sans"
            style={{ background: '#121117', border: '1px solid #28272e', color: '#8b8a91' }}
          >
            /
          </span>
        </div>

        {/* Right: Account Equity + Mode + Currency + Session Lock */}
        <div className="flex items-center gap-3 shrink-0">
          {isCompetition && (
            <div
              className="hidden md:flex items-center gap-1.5 text-[10px] font-bold font-sans px-2 py-1 rounded"
              style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <span>COMPETITION $100K</span>
            </div>
          )}

          {equity != null && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="hidden sm:inline text-[10px] uppercase tracking-widest" style={{ color: '#8b8a91' }}>Equity</span>
              <span className="text-sm font-bold font-sans tabular-nums" style={{ color: '#00ff84' }}>
                {formatCurrency(Number(equity))}
              </span>
            </div>
          )}

          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="hidden sm:inline-block text-[11px] rounded px-2 py-1 focus:outline-none cursor-pointer font-sans tabular-nums transition-colors"
            style={{
              background: '#1f1e23',
              border: '1px solid #28272e',
              color: '#8b8a91',
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

          {/* Integrations & API Keys Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-2.5 py-1 rounded transition flex items-center text-[11px] font-sans cursor-pointer hover:border-[#3e3d48] hover:text-white"
            style={{
              background: '#1f1e23',
              border: '1px solid #28272e',
              color: '#8b8a91',
            }}
            title="Integrations & API Settings (Alpaca, Discord, Telegram)"
          >
            <span className="text-[10px] font-bold tracking-wider">KEYS</span>
          </button>

          {/* Session Lock & Role Dropdown */}
          <div className="relative group">
            <button
              onClick={handleLockClick}
              className="px-2.5 py-1 rounded transition flex items-center text-[11px] font-sans cursor-pointer"
              style={{
                background: confirmLock ? 'rgba(255, 59, 92, 0.15)' : '#1f1e23',
                border: confirmLock ? '1px solid rgba(255, 59, 92, 0.5)' : '1px solid #28272e',
                color: confirmLock ? '#ff3b5c' : '#8b8a91',
              }}
              title={confirmLock ? 'Click again to confirm lock' : 'Session Control (Click twice or hover for options)'}
            >
              <span className="text-[10px] font-bold tracking-wider">
                {confirmLock ? 'CONFIRM LOCK?' : 'LOCK'}
              </span>
            </button>

            {/* Hover Popover: Operator / Judges Preview Info */}
            <div
              className="absolute right-0 top-full mt-1.5 w-60 p-3 rounded-xl shadow-2xl opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50 font-sans"
              style={{
                background: '#1f1e23',
                border: '1px solid #28272e',
              }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#28272e] mb-2">
                <span className="text-[10px] text-[#8b8a91] uppercase tracking-wider">Session Authority</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                  style={{
                    background: isOperator ? 'rgba(0,255,132,0.1)' : 'rgba(56,189,248,0.1)',
                    color: isOperator ? '#00ff84' : '#38bdf8',
                    border: isOperator ? '1px solid rgba(0,255,132,0.3)' : '1px solid rgba(56,189,248,0.3)',
                  }}
                >
                  {isOperator ? 'OPERATOR' : 'JUDGES PREVIEW'}
                </span>
              </div>
              <p className="text-[11px] text-[#8b8a91] leading-relaxed mb-3">
                {isOperator
                  ? 'Full autonomous pipeline & paper execution authority active.'
                  : 'Read-only telemetry & live deliberation review mode.'}
              </p>
              <button
                onClick={logout}
                className="w-full py-1.5 rounded text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  background: 'rgba(255,59,92,0.1)',
                  border: '1px solid rgba(255,59,92,0.3)',
                  color: '#ff3b5c',
                }}
              >
                <span>Terminate Session</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown Submenu - Phantom Animation & Glassmorphism anchored to Header */}
      {activeDropdown && (
        <div
          onMouseEnter={() => {
            if (dropdownCloseTimeoutRef.current) {
              clearTimeout(dropdownCloseTimeoutRef.current);
              dropdownCloseTimeoutRef.current = null;
            }
          }}
          onMouseLeave={handleDropdownMouseLeave}
          className="absolute top-[42px] w-64 p-1.5 z-[120] phantom-dropdown-panel shadow-2xl"
          style={{ left: `${dropdownPos.left}px` }}
        >
          {activeDropdown === 'council' && (
            <>
              <button
                onClick={() => {
                  setActiveTab('council');
                  setActiveDropdown(null);
                  isClickOpenedRef.current = false;
                }}
                className="w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 cursor-pointer phantom-dropdown-item phantom-dropdown-item-stagger-1"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold ${
                      activeTab === 'council' ? 'text-[#00ff84]' : 'text-white'
                    }`}
                  >
                    Live Deliberation
                  </span>
                  {activeTab === 'council' && (
                    <span className="text-[10px] text-[#00ff84] font-sans font-bold">ACTIVE</span>
                  )}
                </div>
                <span className="text-[10px] text-[#848388]">
                  7-stage multi-agent debate &amp; consensus
                </span>
              </button>

              <div className="my-1 mx-2 border-t border-white/[0.06]" />

              <button
                onClick={() => {
                  setActiveTab('workflow_auditor');
                  setActiveDropdown(null);
                  isClickOpenedRef.current = false;
                }}
                className="w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 cursor-pointer phantom-dropdown-item phantom-dropdown-item-stagger-2"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold ${
                      activeTab === 'workflow_auditor' ? 'text-[#00ff84]' : 'text-white'
                    }`}
                  >
                    Strategy Audit
                  </span>
                  {activeTab === 'workflow_auditor' && (
                    <span className="text-[10px] text-[#00ff84] font-sans font-bold">ACTIVE</span>
                  )}
                </div>
                <span className="text-[10px] text-[#848388]">
                  Deterministic rules &amp; trade expectancy
                </span>
              </button>

              <div className="my-1 mx-2 border-t border-white/[0.06]" />

              <button
                onClick={() => {
                  setActiveTab('evidence');
                  setActiveDropdown(null);
                  isClickOpenedRef.current = false;
                }}
                className="w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 cursor-pointer phantom-dropdown-item phantom-dropdown-item-stagger-3"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold ${
                      activeTab === 'evidence' ? 'text-[#00ff84]' : 'text-white'
                    }`}
                  >
                    Evidence Library
                  </span>
                  {activeTab === 'evidence' && (
                    <span className="text-[10px] text-[#00ff84] font-sans font-bold">ACTIVE</span>
                  )}
                </div>
                <span className="text-[10px] text-[#848388]">
                  Autonomous data lake &amp; citation index
                </span>
              </button>
            </>
          )}

          {activeDropdown === 'portfolio' && (
            <>
              <button
                onClick={() => {
                  setActiveTab('portfolio');
                  setActiveDropdown(null);
                  isClickOpenedRef.current = false;
                }}
                className="w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 cursor-pointer phantom-dropdown-item phantom-dropdown-item-stagger-1"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold ${
                      activeTab === 'portfolio' ? 'text-[#00ff84]' : 'text-white'
                    }`}
                  >
                    Positions &amp; Ledger
                  </span>
                  {activeTab === 'portfolio' && (
                    <span className="text-[10px] text-[#00ff84] font-sans font-bold">ACTIVE</span>
                  )}
                </div>
                <span className="text-[10px] text-[#848388]">
                  Real-time holdings, PnL &amp; order history
                </span>
              </button>

              <div className="my-1 mx-2 border-t border-white/[0.06]" />

              <button
                onClick={() => {
                  setActiveTab('broker_diagnostics');
                  setActiveDropdown(null);
                  isClickOpenedRef.current = false;
                }}
                className="w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 cursor-pointer phantom-dropdown-item phantom-dropdown-item-stagger-2"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold ${
                      activeTab === 'broker_diagnostics' ? 'text-[#00ff84]' : 'text-white'
                    }`}
                  >
                    Broker Diagnostics
                  </span>
                  {activeTab === 'broker_diagnostics' && (
                    <span className="text-[10px] text-[#00ff84] font-sans font-bold">ACTIVE</span>
                  )}
                </div>
                <span className="text-[10px] text-[#848388]">
                  Alpaca API latency, rate limits &amp; health
                </span>
              </button>
            </>
          )}
        </div>
      )}
      {/* Settings & Integrations Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
};
