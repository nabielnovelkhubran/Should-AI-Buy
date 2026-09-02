'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface TickerItem {
  symbol: string;
  price: number;
  change24h: number;
  score: number;
  assetClass: 'CRYPTO' | 'EQUITY';
  isCustom?: boolean;
}

const LOCAL_STORAGE_KEY = 'should_ai_buy_custom_tickers';

const INITIAL_TICKERS: TickerItem[] = [
  { symbol: 'BTC', price: 77295.84, change24h: 1.84, score: 47, assetClass: 'CRYPTO' },
  { symbol: 'ETH', price: 2381.28, change24h: 2.15, score: 55, assetClass: 'CRYPTO' },
  { symbol: 'SOL', price: 98.40, change24h: 3.42, score: 72, assetClass: 'CRYPTO' },
  { symbol: 'POL', price: 0.0906, change24h: 6.80, score: 68, assetClass: 'CRYPTO' },
  { symbol: 'WIF', price: 0.194, change24h: 4.90, score: 63, assetClass: 'CRYPTO' },
  { symbol: 'ONDO', price: 0.342, change24h: 5.10, score: 63, assetClass: 'CRYPTO' },
  { symbol: 'LTC', price: 49.41, change24h: 3.20, score: 58, assetClass: 'CRYPTO' },
  { symbol: 'AAVE', price: 126.30, change24h: -0.45, score: 52, assetClass: 'CRYPTO' },
  { symbol: 'RENDER', price: 1.405, change24h: 1.90, score: 54, assetClass: 'CRYPTO' },
  { symbol: 'BONK', price: 0.0000182, change24h: 3.10, score: 48, assetClass: 'CRYPTO' },
  { symbol: 'DOGE', price: 0.084, change24h: 0.95, score: 48, assetClass: 'CRYPTO' },
  { symbol: 'PEPE', price: 0.0000094, change24h: -1.2, score: 42, assetClass: 'CRYPTO' },
  { symbol: 'HYPE', price: 14.82, change24h: 2.40, score: 56, assetClass: 'CRYPTO' },
  { symbol: 'ARB', price: 0.312, change24h: 1.15, score: 50, assetClass: 'CRYPTO' },
  { symbol: 'LINK', price: 10.84, change24h: 0.72, score: 51, assetClass: 'CRYPTO' },
  { symbol: 'AVAX', price: 18.92, change24h: 2.10, score: 57, assetClass: 'CRYPTO' },
  { symbol: 'XRP', price: 0.494, change24h: -0.30, score: 44, assetClass: 'CRYPTO' },
  { symbol: 'ADA', price: 0.278, change24h: -0.85, score: 40, assetClass: 'CRYPTO' },
  { symbol: 'NVDA', price: 128.50, change24h: 2.80, score: 74, assetClass: 'EQUITY' },
  { symbol: 'GOOGL', price: 339.23, change24h: 1.25, score: 65, assetClass: 'EQUITY' },
  { symbol: 'META', price: 595.10, change24h: 1.90, score: 68, assetClass: 'EQUITY' },
  { symbol: 'MSFT', price: 498.23, change24h: 0.65, score: 60, assetClass: 'EQUITY' },
  { symbol: 'AAPL', price: 324.02, change24h: -0.15, score: 50, assetClass: 'EQUITY' },
  { symbol: 'AMZN', price: 195.40, change24h: 1.05, score: 62, assetClass: 'EQUITY' },
  { symbol: 'TSLA', price: 248.60, change24h: 3.45, score: 58, assetClass: 'EQUITY' },
  { symbol: 'AMD', price: 87.30, change24h: -0.60, score: 48, assetClass: 'EQUITY' },
  { symbol: 'RL', price: 342.84, change24h: 0.48, score: 62, assetClass: 'EQUITY' },
  { symbol: 'COIN', price: 178.50, change24h: 2.10, score: 59, assetClass: 'EQUITY' },
];

function formatPrice(price: number): string {
  if (!price || price === 0) return '$0.00';
  if (price < 0.001) return `$${price.toFixed(7)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  const parts = price.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${parts.join('.')}`;
}

function AssetRow({
  t,
  isActive,
  onClick,
  onRemove
}: {
  t: TickerItem;
  isActive: boolean;
  onClick: () => void;
  onRemove?: (symbol: string) => void;
}) {
  const isPos = t.change24h >= 0;
  return (
    <div
      onClick={onClick}
      className="w-full text-left px-3 py-2 transition-all rounded-xl mx-auto block group cursor-pointer"
      style={{
        width: 'calc(100% - 8px)',
        background: isActive ? 'rgba(0,255,132,0.1)' : 'transparent',
        borderLeft: isActive ? '3px solid #00ff84' : '3px solid transparent',
      }}
    >
      {/* 
        Horizontal Plane:
        - Symbol aligned left
        - Price aligned right, but separated with pr-3 / gap-3 from the % increase column
        - 24h Change% in dedicated tabular column
        - Score pill on the far right
        - Optional remove button on custom assets
      */}
      <div className="flex items-center justify-between w-full">
        {/* Left: Symbol */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[14px] font-bold font-phantom text-white tracking-tight shrink-0">
            ${t.symbol}
          </span>
          {t.isCustom && (
            <span className="text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-[#28272f] text-[#00ff84] shrink-0">
              custom
            </span>
          )}
        </div>

        {/* Right Group: Price (aligned right) + Gap + % Change + Score */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Price: cleanly aligned to the right, separated from % increase */}
          <span className="text-[13px] mono-num text-white font-medium text-right" suppressHydrationWarning>
            {formatPrice(t.price)}
          </span>

          {/* 24h Change % (fixed min-width for clean columnar alignment) */}
          <span
            className="text-[12px] font-semibold mono-num text-right min-w-[54px]"
            style={{ color: isPos ? '#00ff84' : '#ff3b5c' }}
          >
            {isPos ? '+' : ''}{t.change24h.toFixed(2)}%
          </span>

          {/* Score badge */}
          <span
            className="text-[11px] mono-num font-semibold px-1.5 py-0.5 rounded min-w-[24px] text-center"
            style={{
              color: t.score >= 65 ? '#00ff84' : t.score >= 50 ? '#848388' : '#ff3b5c',
              background: t.score >= 65 ? 'rgba(0,255,132,0.12)' : t.score < 50 ? 'rgba(255,59,92,0.12)' : 'rgba(255,255,255,0.06)',
            }}
          >
            {t.score}
          </span>

          {/* Delete button for custom assets */}
          {t.isCustom && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(t.symbol);
              }}
              className="text-[#848388] hover:text-[#ff3b5c] transition px-1 text-xs opacity-0 group-hover:opacity-100"
              title={`Remove ${t.symbol}`}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const QuantTickerRibbon: React.FC = () => {
  const [activeSymbol, setActiveSymbol] = useState('BTC');
  const [activeTab, setActiveTab] = useState<'CRYPTO' | 'EQUITY'>('CRYPTO');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Dynamic tickers state + search/add bar state
  const [tickers, setTickers] = useState<TickerItem[]>(INITIAL_TICKERS);
  const [inputBar, setInputBar] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // 1. Hydration-safe localStorage loading
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const customItems: TickerItem[] = JSON.parse(saved);
        if (Array.isArray(customItems) && customItems.length > 0) {
          const initialSymbols = new Set(INITIAL_TICKERS.map((t) => t.symbol.toUpperCase()));
          const dedupedCustom = customItems
            .filter((c) => !initialSymbols.has(c.symbol.toUpperCase()))
            .map((c) => ({ ...c, isCustom: true }));
          setTickers([...INITIAL_TICKERS, ...dedupedCustom]);
        }
      }
    } catch (err) {
      console.warn('Failed to load custom tickers from localStorage:', err);
    }
  }, []);

  // 2. Helper to persist custom tickers to localStorage
  const persistCustomTickers = (all: TickerItem[]) => {
    try {
      const initialSymbols = new Set(INITIAL_TICKERS.map((t) => t.symbol.toUpperCase()));
      const customOnly = all.filter((t) => !initialSymbols.has(t.symbol.toUpperCase()));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customOnly));
    } catch (err) {
      console.warn('Failed to save custom tickers to localStorage:', err);
    }
  };

  // 3. Add asset handler
  const handleAddAsset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanSym = inputBar.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
    if (!cleanSym) return;

    // Check if already in list
    const existing = tickers.find((t) => t.symbol.toUpperCase() === cleanSym);
    if (existing) {
      setActiveTab(existing.assetClass);
      setActiveSymbol(existing.symbol);
      setInputBar('');
      return;
    }

    setIsAdding(true);
    // Create new ticker with activeTab assetClass
    const newTicker: TickerItem = {
      symbol: cleanSym,
      price: 0,
      change24h: 0,
      score: 55,
      assetClass: activeTab,
      isCustom: true,
    };

    const updated = [newTicker, ...tickers];
    setTickers(updated);
    persistCustomTickers(updated);
    setActiveSymbol(cleanSym);
    setInputBar('');

    // Fetch live market data asynchronously from our existing endpoint
    try {
      const res = await fetch(`/api/market-data?symbol=${encodeURIComponent(cleanSym)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.snapshot?.currentPrice) {
          setTickers((prev) => {
            const next = prev.map((item) =>
              item.symbol.toUpperCase() === cleanSym
                ? {
                    ...item,
                    price: data.snapshot.currentPrice,
                    change24h: data.snapshot.change24h ?? 0,
                  }
                : item
            );
            persistCustomTickers(next);
            return next;
          });
        }
      }
    } catch {
      // Offline fallback: retains initial default price
    } finally {
      setIsAdding(false);
    }
  };

  // 4. Remove custom asset handler
  const handleRemoveAsset = (symbolToRemove: string) => {
    const updated = tickers.filter(
      (t) => !(t.isCustom && t.symbol.toUpperCase() === symbolToRemove.toUpperCase())
    );
    setTickers(updated);
    persistCustomTickers(updated);
    if (activeSymbol.toUpperCase() === symbolToRemove.toUpperCase()) {
      const fallback = updated.find((t) => t.assetClass === activeTab) || updated[0];
      if (fallback) setActiveSymbol(fallback.symbol);
    }
  };

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(220, Math.min(480, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Filtered by tab and optional search query
  const query = inputBar.trim().toUpperCase();
  const tabTickers = tickers.filter((t) => t.assetClass === activeTab);
  const filteredTickers = query
    ? tabTickers.filter((t) => t.symbol.toUpperCase().includes(query))
    : tabTickers;

  const cryptoCount = tickers.filter((t) => t.assetClass === 'CRYPTO').length;
  const equityCount = tickers.filter((t) => t.assetClass === 'EQUITY').length;
  const exactMatchExists = tabTickers.some((t) => t.symbol.toUpperCase() === query);

  return (
    <aside
      ref={sidebarRef}
      className="shrink-0 flex flex-col relative select-none my-2 ml-2 rounded-2xl overflow-hidden shadow-2xl transition-[width] duration-75"
      style={{
        width: `${sidebarWidth}px`,
        background: '#1f1e23',
        border: '1px solid #28272e',
        minHeight: 0,
        height: 'calc(100% - 16px)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid #28272e' }}
      >
        <span className="terminal-label text-[13px] font-bold uppercase tracking-wider text-white">
          Markets
        </span>
        <span className="text-[11px] mono-num px-2 py-0.5 rounded text-[#848388] bg-[#17161b] border border-[#28272e]">
          {tabTickers.length} Pairs
        </span>
      </div>

      {/* Tabs: Crypto vs Equities */}
      <div className="p-2 shrink-0">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#17161b] border border-[#28272e]">
          <button
            onClick={() => setActiveTab('CRYPTO')}
            className="py-2 px-3 text-[13px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
            style={{
              background: activeTab === 'CRYPTO' ? '#28272f' : 'transparent',
              color: '#ffffff',
              boxShadow: activeTab === 'CRYPTO' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            <span style={{ color: '#ffffff' }}>Crypto</span>
            <span className="text-[11px] mono-num" style={{ color: activeTab === 'CRYPTO' ? '#00ff84' : '#848388' }}>
              ({cryptoCount})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('EQUITY')}
            className="py-2 px-3 text-[13px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
            style={{
              background: activeTab === 'EQUITY' ? '#28272f' : 'transparent',
              color: '#ffffff',
              boxShadow: activeTab === 'EQUITY' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            <span style={{ color: '#ffffff' }}>Equities</span>
            <span className="text-[11px] mono-num" style={{ color: activeTab === 'EQUITY' ? '#00ff84' : '#848388' }}>
              ({equityCount})
            </span>
          </button>
        </div>
      </div>

      {/* Type Bar: Add / Filter Asset Input */}
      <div className="px-2.5 pb-2 shrink-0" style={{ borderBottom: '1px solid #28272e' }}>
        <form onSubmit={handleAddAsset} className="relative flex items-center">
          <input
            type="text"
            value={inputBar}
            onChange={(e) => setInputBar(e.target.value.toUpperCase())}
            placeholder={`+ Type ${activeTab === 'CRYPTO' ? 'crypto' : 'stock'} (e.g. ${activeTab === 'CRYPTO' ? 'SUI' : 'TSLA'})...`}
            className="w-full bg-[#17161b] border border-[#28272e] focus:border-[#00ff84] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#848388] outline-none transition font-phantom pr-14"
            maxLength={12}
          />
          {query && !exactMatchExists && (
            <button
              type="submit"
              disabled={isAdding}
              className="absolute right-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#00ff84] text-black hover:bg-[#00e576] transition disabled:opacity-50"
              title={`Add ${query} to ${activeTab}`}
            >
              {isAdding ? '...' : '+ ADD'}
            </button>
          )}
          {query && exactMatchExists && (
            <button
              type="button"
              onClick={() => setInputBar('')}
              className="absolute right-2 text-[#848388] hover:text-white text-xs px-1"
              title="Clear input"
            >
              ×
            </button>
          )}
        </form>
      </div>

      {/* Asset List — Scrollable */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-1 space-y-0.5">
        {filteredTickers.length === 0 ? (
          <div className="text-center py-6 px-4 text-xs text-[#848388]">
            <p className="font-semibold text-white mb-1">No &quot;{query}&quot; found</p>
            <p>Press Enter or click &quot;+ ADD&quot; above to add it to {activeTab}.</p>
          </div>
        ) : (
          filteredTickers.map((t) => (
            <AssetRow
              key={t.symbol}
              t={t}
              isActive={t.symbol === activeSymbol}
              onClick={() => setActiveSymbol(t.symbol)}
              onRemove={t.isCustom ? handleRemoveAsset : undefined}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 shrink-0 flex items-center justify-between"
        style={{ borderTop: '1px solid #28272e', background: '#17161b' }}
      >
        <span className="terminal-label text-[11px] text-[#848388]">Alpaca Paper</span>
        <span className="text-[11px] mono-num text-[#848388]">v2.4</span>
      </div>

      {/* Drag Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute top-0 right-0 w-2.5 h-full cursor-col-resize hover:bg-[#00ff84]/30 active:bg-[#00ff84]/50 transition-colors z-20 group flex items-center justify-center"
        title="Drag to resize sidebar"
      >
        <div className="w-[2px] h-8 rounded-full bg-[#28272e] group-hover:bg-[#00ff84] transition-colors" />
      </div>
    </aside>
  );
};
