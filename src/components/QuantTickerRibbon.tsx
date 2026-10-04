'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface TickerItem {
  symbol: string;
  price: number;
  change24h: number;
  score: number;
  assetClass: 'CRYPTO' | 'EQUITY';
  isCustom?: boolean;
}

const LOCAL_STORAGE_KEY = 'saib_custom_tickers_v1';

const INITIAL_TICKERS: TickerItem[] = [
  // Crypto (10)
  { symbol: 'BTC', price: 68420.50, change24h: 3.42, score: 78, assetClass: 'CRYPTO' },
  { symbol: 'ETH', price: 3540.20, change24h: -1.15, score: 62, assetClass: 'CRYPTO' },
  { symbol: 'SOL', price: 184.75, change24h: 8.92, score: 85, assetClass: 'CRYPTO' },
  { symbol: 'POL', price: 0.54, change24h: -0.45, score: 45, assetClass: 'CRYPTO' },
  { symbol: 'WIF', price: 2.85, change24h: 14.20, score: 71, assetClass: 'CRYPTO' },
  { symbol: 'ONDO', price: 1.05, change24h: 4.10, score: 68, assetClass: 'CRYPTO' },
  { symbol: 'LTC', price: 82.30, change24h: 0.85, score: 55, assetClass: 'CRYPTO' },
  { symbol: 'AAVE', price: 165.40, change24h: -2.30, score: 59, assetClass: 'CRYPTO' },
  { symbol: 'RENDER', price: 6.20, change24h: 5.75, score: 74, assetClass: 'CRYPTO' },
  { symbol: 'BONK', price: 0.000024, change24h: -4.10, score: 42, assetClass: 'CRYPTO' },
  { symbol: 'DOGE', price: 0.162, change24h: 2.15, score: 58, assetClass: 'CRYPTO' },
  { symbol: 'PEPE', price: 0.0000098, change24h: -3.20, score: 46, assetClass: 'CRYPTO' },
  { symbol: 'HYPE', price: 24.80, change24h: 6.40, score: 69, assetClass: 'CRYPTO' },
  { symbol: 'ARB', price: 0.82, change24h: -1.80, score: 52, assetClass: 'CRYPTO' },
  { symbol: 'LINK', price: 14.50, change24h: 1.95, score: 64, assetClass: 'CRYPTO' },
  { symbol: 'AVAX', price: 28.30, change24h: -0.75, score: 57, assetClass: 'CRYPTO' },
  { symbol: 'XRP', price: 0.58, change24h: 0.40, score: 51, assetClass: 'CRYPTO' },
  { symbol: 'UNI', price: 9.40, change24h: 3.10, score: 63, assetClass: 'CRYPTO' },
  // Equities (10)
  { symbol: 'NVDA', price: 128.50, change24h: 2.80, score: 81, assetClass: 'EQUITY' },
  { symbol: 'AAPL', price: 224.20, change24h: 0.45, score: 67, assetClass: 'EQUITY' },
  { symbol: 'MSFT', price: 448.90, change24h: -0.65, score: 72, assetClass: 'EQUITY' },
  { symbol: 'AMZN', price: 186.40, change24h: 1.20, score: 70, assetClass: 'EQUITY' },
  { symbol: 'GOOGL', price: 178.30, change24h: -1.10, score: 65, assetClass: 'EQUITY' },
  { symbol: 'META', price: 504.60, change24h: 3.15, score: 79, assetClass: 'EQUITY' },
  { symbol: 'TSLA', price: 254.80, change24h: -4.20, score: 53, assetClass: 'EQUITY' },
  { symbol: 'AMD', price: 156.20, change24h: 4.80, score: 76, assetClass: 'EQUITY' },
  { symbol: 'COIN', price: 218.40, change24h: 5.60, score: 73, assetClass: 'EQUITY' },
  { symbol: 'PLTR', price: 28.90, change24h: 1.85, score: 66, assetClass: 'EQUITY' },
];

function formatPrice(price: number): string {
  if (price === 0) return '$--';
  if (price < 0.0001) return `$${price.toFixed(8)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  const parts = price.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${parts.join('.')}`;
}

export interface QuantTickerRibbonProps {
  onSelectSymbol?: (symbol: string) => void;
}

export const QuantTickerRibbon: React.FC<QuantTickerRibbonProps> = ({ onSelectSymbol }) => {
  const [activeSymbol, setActiveSymbol] = useState('BTC');
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'CRYPTO' | 'EQUITY'>('CRYPTO');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Dynamic tickers state + search/add bar state
  const [tickers, setTickers] = useState<TickerItem[]>(INITIAL_TICKERS);
  const [inputBar, setInputBar] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Phantom Animated Sliding Highlight Indicator for Asset Items
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number; opacity: number }>({
    top: 0,
    height: 0,
    opacity: 0,
  });

  const assetListRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<{ [symbol: string]: HTMLDivElement | null }>({});

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

    // Fetch live market data asynchronously
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
  const tabTickers = useMemo(() => tickers.filter((t) => t.assetClass === activeTab), [tickers, activeTab]);
  const filteredTickers = useMemo(() => query
    ? tabTickers.filter((t) => t.symbol.toUpperCase().includes(query))
    : tabTickers, [query, tabTickers]);

  const cryptoCount = useMemo(() => tickers.filter((t) => t.assetClass === 'CRYPTO').length, [tickers]);
  const equityCount = useMemo(() => tickers.filter((t) => t.assetClass === 'EQUITY').length, [tickers]);
  const exactMatchExists = useMemo(() => tabTickers.some((t) => t.symbol.toUpperCase() === query), [tabTickers, query]);

  // Highlight recalculation
  const currentHighlight = hoveredSymbol || activeSymbol;

  const updateIndicator = useCallback(() => {
    const targetEl = rowRefs.current[currentHighlight];
    const container = assetListRef.current;
    if (targetEl && container) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const newTop = targetRect.top - containerRect.top + container.scrollTop;
      const newHeight = targetRect.height;
      setIndicatorStyle((prev) => {
        if (prev.top === newTop && prev.height === newHeight && prev.opacity === 1) return prev;
        return { top: newTop, height: newHeight, opacity: 1 };
      });
    } else {
      setIndicatorStyle((prev) => {
        if (prev.opacity === 0) return prev;
        return { ...prev, opacity: 0 };
      });
    }
  }, [currentHighlight]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator, activeTab]);

  return (
    <aside
      ref={sidebarRef}
      className="hidden lg:flex shrink-0 flex-col relative select-none my-2 ml-2 rounded-2xl overflow-hidden shadow-2xl transition-[width] duration-75"
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
        <span className="text-xs font-sans font-medium text-[#848388]">
          {tabTickers.length} Pairs
        </span>
      </div>

      {/* Tabs: Crypto vs Equities with Phantom Sliding Pill */}
      <div className="p-2 shrink-0">
        <div
          className="relative grid grid-cols-2 gap-1 p-1 rounded-xl"
          style={{ background: '#17161b', border: '1px solid #28272e' }}
        >
          {/* Sliding Pill Indicator for Top Tab Switcher */}
          <div
            className="absolute top-1 bottom-1 rounded-lg transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
            style={{
              left: activeTab === 'CRYPTO' ? '4px' : 'calc(50% + 2px)',
              width: 'calc(50% - 6px)',
              background: '#28272f',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              border: '1px solid #34333b',
            }}
          />

          <button
            onClick={() => setActiveTab('CRYPTO')}
            className="relative z-10 py-2 px-3 text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <span style={{ color: activeTab === 'CRYPTO' ? '#ffffff' : '#8b8a91' }}>Crypto</span>
            <span
              className="text-xs font-sans font-medium"
              style={{ color: activeTab === 'CRYPTO' ? '#00ff84' : '#848388' }}
            >
              ({cryptoCount})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('EQUITY')}
            className="relative z-10 py-2 px-3 text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <span style={{ color: activeTab === 'EQUITY' ? '#ffffff' : '#8b8a91' }}>Equities</span>
            <span
              className="text-xs font-sans font-medium"
              style={{ color: activeTab === 'EQUITY' ? '#00ff84' : '#848388' }}
            >
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

      {/* Asset List — Scrollable with Phantom Sliding Highlight Indicator */}
      <div
        ref={assetListRef}
        onScroll={updateIndicator}
        onMouseLeave={() => setHoveredSymbol(null)}
        className="relative flex-1 overflow-y-auto no-scrollbar py-1 space-y-0.5"
      >
        {/* Phantom Smooth Sliding Highlight Indicator */}
        <div
          className="absolute top-0 left-1 right-1 rounded-xl pointer-events-none transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            transform: `translateY(${indicatorStyle.top}px)`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.opacity,
            background: 'rgba(0, 255, 132, 0.08)',
            border: '1px solid rgba(0, 255, 132, 0.25)',
          }}
        />

        {filteredTickers.length === 0 ? (
          <div className="text-center py-6 px-4 text-xs text-[#848388]">
            <p className="font-semibold text-white mb-1">No &quot;{query}&quot; found</p>
            <p>Press Enter or click &quot;+ ADD&quot; above to add it to {activeTab}.</p>
          </div>
        ) : (
          filteredTickers.map((t) => {
            const isPos = t.change24h >= 0;
            const isHighlighted = currentHighlight === t.symbol;

            return (
              <div
                key={t.symbol}
                ref={(el) => {
                  rowRefs.current[t.symbol] = el;
                }}
                onClick={() => {
                  setActiveSymbol(t.symbol);
                  onSelectSymbol?.(t.symbol);
                }}
                onMouseEnter={() => setHoveredSymbol(t.symbol)}
                className="relative z-10 w-full text-left px-3 h-10 flex items-center transition-colors rounded-xl mx-auto group cursor-pointer"
                style={{
                  width: 'calc(100% - 8px)',
                  background: 'transparent',
                }}
              >
                <div className="flex items-center justify-between w-full">
                  {/* Left: Symbol Name (Smooth Highlight Physics) */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`text-[13.5px] font-bold font-phantom tracking-tight shrink-0 transition-colors duration-200 leading-none ${
                        isHighlighted ? 'text-[#00ff84]' : 'text-white'
                      }`}
                    >
                      ${t.symbol}
                    </span>
                    {t.isCustom && (
                      <span className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded bg-[#28272f] text-[#00ff84] shrink-0 leading-none">
                        custom
                      </span>
                    )}
                  </div>

                  {/* Right Group: Price (aligned right) + Gap + % Change + Score */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Price: cleanly aligned to the right, separated from % increase */}
                    <span className="text-[13px] mono-num text-white font-medium text-right tabular-nums leading-none" suppressHydrationWarning>
                      {formatPrice(t.price)}
                    </span>

                    {/* 24h Change % (fixed min-width for clean columnar alignment) */}
                    <span
                      className="text-[12px] font-semibold mono-num text-right min-w-[54px] tabular-nums leading-none"
                      style={{ color: isPos ? '#00ff84' : '#ff3b5c' }}
                    >
                      {isPos ? '+' : ''}{t.change24h.toFixed(2)}%
                    </span>

                    {/* Score badge */}
                    <span
                      className="text-[11px] mono-num font-semibold px-1.5 py-0.5 rounded min-w-[24px] text-center leading-none"
                      style={{
                        color: t.score >= 65 ? '#00ff84' : t.score >= 50 ? '#848388' : '#ff3b5c',
                        background: t.score >= 65 ? 'rgba(0,255,132,0.12)' : t.score < 50 ? 'rgba(255,59,92,0.12)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      {t.score}
                    </span>

                    {/* Delete button for custom assets */}
                    {t.isCustom && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAsset(t.symbol);
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
          })
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 shrink-0 flex items-center justify-between"
        style={{ borderTop: '1px solid #28272e', background: '#17161b' }}
      >
        <span className="terminal-label text-[11px] text-[#848388]">Alpaca Paper</span>
        <span className="text-xs font-sans font-medium text-[#848388]">v2.4</span>
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
