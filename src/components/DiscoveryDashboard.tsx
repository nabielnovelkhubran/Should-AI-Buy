'use client';
import React, { useState, useEffect } from 'react';
import {
  ScanResult,
  OpportunityCandidate,
  CandidateQueueItem,
  CandidateQueueStats,
  WatchlistItem,
  Investigation
} from '@/lib/types';
import { useCurrency } from './CurrencyProvider';
import { useAuth } from '@/lib/auth/auth-context';

interface DiscoveryDashboardProps {
  onSelectInvestigation?: (investigation: Investigation) => void;
}

export const DiscoveryDashboard: React.FC<DiscoveryDashboardProps> = ({ onSelectInvestigation }) => {
  const { formatCurrency } = useCurrency();
  const { isOperator } = useAuth();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [queueItems, setQueueItems] = useState<CandidateQueueItem[]>([]);
  const [queueStats, setQueueStats] = useState<CandidateQueueStats | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [investigations, setInvestigations] = useState<Record<string, Investigation>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchDiscoveryState();
    fetchWatchlist();
  }, []);

  const fetchDiscoveryState = async () => {
    try {
      const res = await fetch('/api/discovery');
      if (res.ok) {
        const data = await res.json();
        if (data.scanResult) setScanResult(data.scanResult);
        if (data.queueItems) setQueueItems(data.queueItems);
        if (data.queueStats) setQueueStats(data.queueStats);
      }
    } catch (err) {
      console.error('Failed to load discovery state', err);
    }
  };

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        if (data.items) setWatchlist(data.items);
      }
    } catch (err) {
      console.error('Failed to load watchlist', err);
    }
  };

  const handleRunScan = async () => {
    if (!isOperator) {
      setErrorMsg('Operator authorization required to trigger universe discovery scans.');
      return;
    }
    setIsScanning(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoDispatch: true, dispatchLimit: 1, limit: 20 })
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult(data.scanResult);
        setQueueItems(data.queueItems || []);
        setQueueStats(data.queueStats || null);

        // Fetch investigations if any were dispatched
        if (data.dispatchSummary?.results) {
          const invMap: Record<string, Investigation> = { ...investigations };
          for (const r of data.dispatchSummary.results) {
            if (r.investigation) {
              invMap[r.investigation.asset] = r.investigation;
            }
          }
          setInvestigations(invMap);
        }
      } else {
        setErrorMsg(data.error || 'Scan execution failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Discovery request failed');
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleWatchlist = async (candidate: OpportunityCandidate) => {
    if (!isOperator) {
      setErrorMsg('Operator authorization required to modify watchlist.');
      return;
    }
    const isWatchlisted = watchlist.some(w => w.symbol === candidate.symbol);
    const action = isWatchlisted ? 'remove' : 'add';

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          symbol: candidate.symbol,
          assetClass: candidate.assetClass,
          lastOpportunityScore: candidate.score,
          addedFromScan: true,
          notes: `Nominated by Autonomous Scanner (Rank #${candidate.rank})`
        })
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.items || []);
      }
    } catch (err) {
      console.error('Watchlist toggle error', err);
    }
  };

  const handleRemoveFromWatchlist = async (symbol: string) => {
    if (!isOperator) {
      setErrorMsg('Operator authorization required to modify watchlist.');
      return;
    }
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', symbol })
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.items || []);
      }
    } catch (err) {
      console.error('Watchlist remove error', err);
    }
  };

  // Helper to generate deterministic selection explanation
  const renderSelectionWhy = (candidate: OpportunityCandidate) => {
    const reasons: string[] = [];
    const sig = candidate.signals;

    if (candidate.score >= 70) {
      reasons.push(`High aggregate Opportunity Score (${candidate.score.toFixed(1)}/100) indicates strong setup`);
    } else if (candidate.score >= 55) {
      reasons.push(`Opportunity Score (${candidate.score.toFixed(1)}/100) satisfies minimum Council threshold (55)`);
    }

    if (sig.momentum > 0) {
      reasons.push(`Positive price momentum (+${sig.momentum.toFixed(1)}%) confirms directional strength`);
    } else {
      reasons.push(`Price momentum (${sig.momentum.toFixed(1)}%) evaluated with historical stability`);
    }

    if (sig.rvol >= 1.5) {
      reasons.push(`Elevated Relative Volume (${sig.rvol.toFixed(1)}x) signals abnormal institutional interest`);
    } else {
      reasons.push(`Relative Volume (${sig.rvol.toFixed(1)}x) confirms active market participation`);
    }

    if (sig.liquidityUsd >= 250000) {
      reasons.push(`Deep liquidity pool ($${(sig.liquidityUsd / 1000000).toFixed(2)}M) exceeds Risk Gate minimum ($250k)`);
    }

    if (sig.riskScore <= 70) {
      reasons.push(`Composite risk score (${sig.riskScore.toFixed(0)}/100) remains safely under cutoff (70)`);
    }

    return reasons;
  };

  const getQueueStatusBadge = (symbol: string) => {
    const item = queueItems.find(q => q.symbol === symbol);
    if (!item) return null;

    switch (item.status) {
      case 'QUEUED':
        return <span className="text-[10px] font-bold tracking-wider text-amber-400">QUEUED</span>;
      case 'DISPATCHING':
        return <span className="text-[10px] font-bold tracking-wider text-sky-400">DISPATCHING</span>;
      case 'INVESTIGATING':
        return <span className="text-[10px] font-bold tracking-wider text-[#848388]">INVESTIGATING</span>;
      case 'COMPLETED':
        return <span className="text-[10px] font-bold tracking-wider text-[#00ff84]">COMPLETED</span>;
      case 'FAILED':
        return <span className="text-[10px] font-bold tracking-wider text-[#ff3b5c]">FAILED</span>;
      case 'REJECTED':
        return <span className="text-[10px] font-bold tracking-wider text-[#848388]">REJECTED</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="p-5 rounded-xl bg-[#1f1e23] border border-[#28272e] relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold tracking-tight text-white font-phantom">Autonomous Opportunity Discovery</h2>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/25 uppercase tracking-wider">
                Phase 5 Active
              </span>
            </div>
            <p className="text-xs text-[#8b8a91] max-w-2xl leading-relaxed">
              Continuously scans the bounded market universe, extracts deterministic quantitative signals, prioritizes candidates in the queue, and feeds them into the 7-stage Council.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunScan}
              disabled={isScanning || !isOperator}
              title={!isOperator ? 'Operator authorization required to trigger universe scans' : undefined}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm ${
                isScanning || !isOperator
                  ? 'bg-[#17161b] text-[#8b8a91] opacity-40 cursor-not-allowed border border-[#28272e]'
                  : 'bg-[#00ff84] hover:bg-[#00e576] text-[#121117] active:scale-[0.98]'
              }`}
            >
              {isScanning && <span className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin" />}
              {isScanning ? 'Scanning Universe...' : 'Run Discovery Scan'}
            </button>
          </div>
        </div>

        {/* Overview Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-[#28272e]/80">
          <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e]/60">
            <div className="text-[10px] font-semibold text-[#848388] uppercase tracking-wider">Scan Universe</div>
            <div className="text-lg font-black text-white mt-1">{scanResult ? `${scanResult.scannedCount} Assets` : '20 Assets'}</div>
            <div className="text-[10px] text-[#848388] mt-0.5">10 Crypto (24/7) + 10 Liquid Equities</div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e]/60">
            <div className="text-[10px] font-semibold text-[#848388] uppercase tracking-wider">Total Scanned</div>
            <div className="text-lg font-black text-white mt-1">{scanResult ? scanResult.scannedCount : 0}</div>
            <div className="text-[10px] text-[#848388] mt-0.5">{scanResult ? 'Latest cycle complete' : 'Awaiting first scan'}</div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e]/60">
            <div className="text-[10px] font-semibold text-[#00ff84] uppercase tracking-wider">Successful</div>
            <div className="text-lg font-black text-[#00ff84] mt-1">{scanResult ? scanResult.successfulCount : 0}</div>
            <div className="text-[10px] text-[#00ff84]/70 mt-0.5">Authoritative data feeds</div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e]/60">
            <div className="text-[10px] font-semibold text-[#ff3b5c] uppercase tracking-wider">Failed Feeds</div>
            <div className="text-lg font-black text-[#ff3b5c] mt-1">{scanResult ? scanResult.failedCount : 0}</div>
            <div className="text-[10px] text-rose-500/70 mt-0.5">Isolated explicitly</div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e]/60">
            <div className="text-[10px] font-semibold text-[#848388] uppercase tracking-wider">Candidates Found</div>
            <div className="text-lg font-black text-[#848388] mt-1">{scanResult ? scanResult.candidates.length : 0}</div>
            <div className="text-[10px] text-[#848388]/70 mt-0.5">Top-N score ranked</div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e]/60">
            <div className="text-[10px] font-semibold text-[#848388] uppercase tracking-wider">Last Scan</div>
            <div className="text-sm font-bold text-white mt-1.5 truncate">
              {scanResult ? new Date(scanResult.timestamp).toLocaleTimeString() : '—'}
            </div>
            <div className="text-[10px] text-[#848388] mt-0.5">Deterministic snapshot</div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-[#ff3b5c] shadow-lg">
          <div>
            <strong className="text-[#ff3b5c] block mb-0.5">Scanner Error:</strong>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* 2. Empty State */}
      {!scanResult && !isScanning && (
        <div className="p-8 rounded-xl bg-[#1f1e23] border border-[#28272e] text-center space-y-3">
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-white font-phantom">No Autonomous Scan Performed Yet</h3>
            <p className="text-xs text-[#8b8a91]">
              Run a discovery scan to inspect crypto and US equity pairs, compute deterministic opportunity scores, and populate the candidate queue.
            </p>
          </div>
          <button
            onClick={handleRunScan}
            disabled={!isOperator}
            title={!isOperator ? 'Operator authorization required' : undefined}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm ${
              !isOperator
                ? 'bg-[#17161b] text-[#8b8a91] opacity-40 cursor-not-allowed border border-[#28272e]'
                : 'bg-[#00ff84] hover:bg-[#00e576] text-[#121117] active:scale-[0.98]'
            }`}
          >
            Launch Initial Scan →
          </button>
        </div>
      )}

      {/* 3. Ranked Candidate Cards */}
      {scanResult && scanResult.candidates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Ranked Candidates ({scanResult.candidates.length})
            </h3>
            <span className="text-[11px] text-[#8b8a91]">
              Sorted by Opportunity Score DESC with deterministic symbol tie-break
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scanResult.candidates.map((cand) => {
              const isWatchlisted = watchlist.some(w => w.symbol === cand.symbol);
              const inv = investigations[cand.symbol];

              return (
                <div
                  key={cand.symbol}
                  className="p-4 rounded-xl bg-[#1f1e23] border border-[#28272e] hover:border-[#34333b] transition space-y-3 relative shadow-sm"
                >
                  {/* Top Bar: Rank, Symbol, AssetClass, Queue Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[#00ff84] tabular-nums font-bold text-sm shrink-0 select-none">
                        #{cand.rank}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white font-phantom">${cand.symbol}</h4>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#17161b] text-[#8b8a91] border border-[#28272e] font-semibold">
                            {cand.assetClass}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#8b8a91]">
                          Price: <span className="text-white font-medium tabular-nums">${cand.snapshot.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getQueueStatusBadge(cand.symbol)}
                      <button
                        onClick={() => handleToggleWatchlist(cand)}
                        title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        className={`p-1.5 rounded-lg border text-xs font-semibold transition flex items-center justify-center min-w-[28px] ${
                          isWatchlisted
                            ? 'bg-[#ffb800]/10 text-[#ffb800] border-[#ffb800]/30'
                            : 'bg-[#17161b] text-[#8b8a91] border-[#28272e] hover:text-white hover:border-[#34333b]'
                        }`}
                      >
                        <span className="text-sm leading-none">{isWatchlisted ? '★' : '☆'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Core Scores Strip */}
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#17161b] border border-[#28272e]">
                    <div>
                      <div className="text-[10px] font-bold text-[#8b8a91] uppercase tracking-wider">Opportunity Score</div>
                      <div className="text-base font-bold text-[#00ff84] mt-0.5 tabular-nums">
                        {cand.score.toFixed(1)} <span className="text-xs text-[#8b8a91] font-normal">/ 100</span>
                      </div>
                      <div className="w-full bg-[#121117] h-1.5 rounded-sm mt-1.5 overflow-hidden border border-[#28272e]">
                        <div
                          className="bg-[#00ff84] h-full rounded-sm"
                          style={{ width: `${Math.min(100, Math.max(0, cand.score))}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-[#8b8a91] uppercase tracking-wider">Composite Risk</div>
                      <div className="text-base font-bold text-[#ff3b5c] mt-0.5 tabular-nums">
                        {cand.signals.riskScore.toFixed(0)} <span className="text-xs text-[#8b8a91] font-normal">/ 100</span>
                      </div>
                      <div className="w-full bg-[#121117] h-1.5 rounded-sm mt-1.5 overflow-hidden border border-[#28272e]">
                        <div
                          className="bg-[#ff3b5c] h-full rounded-sm"
                          style={{ width: `${Math.min(100, Math.max(0, cand.signals.riskScore))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quantitative Signals Matrix */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-[#17161b] border border-[#28272e]">
                      <div className="text-[9px] text-[#8b8a91]">Momentum</div>
                      <div className={`font-bold text-xs mt-0.5 tabular-nums ${cand.signals.momentum >= 0 ? 'text-[#00ff84]' : 'text-[#ff3b5c]'}`}>
                        {cand.signals.momentum >= 0 ? `+${cand.signals.momentum.toFixed(1)}%` : `${cand.signals.momentum.toFixed(1)}%`}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#17161b] border border-[#28272e]">
                      <div className="text-[9px] text-[#8b8a91]">RVOL</div>
                      <div className="font-bold text-white text-xs mt-0.5 tabular-nums">
                        {cand.signals.rvol.toFixed(1)}x
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#17161b] border border-[#28272e]">
                      <div className="text-[9px] text-[#8b8a91]">RSI (14)</div>
                      <div className="font-bold text-white text-xs mt-0.5 tabular-nums">
                        {cand.signals.rsi.toFixed(1)}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#17161b] border border-[#28272e]">
                      <div className="text-[9px] text-[#8b8a91]">Vol Accel</div>
                      <div className="font-bold text-white text-xs mt-0.5 tabular-nums">
                        {cand.signals.volumeAcceleration >= 0 ? `+${cand.signals.volumeAcceleration.toFixed(1)}%` : `${cand.signals.volumeAcceleration.toFixed(1)}%`}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#17161b] border border-[#28272e]">
                      <div className="text-[9px] text-[#8b8a91]">Volatility</div>
                      <div className="font-bold text-white text-xs mt-0.5 tabular-nums">
                        {cand.signals.realizedVolatility.toFixed(1)}%
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#17161b] border border-[#28272e]">
                      <div className="text-[9px] text-[#8b8a91]">Liquidity</div>
                      <div className="font-bold text-white text-xs mt-0.5 tabular-nums">
                        ${(cand.signals.liquidityUsd / 1000000).toFixed(1)}M
                      </div>
                    </div>
                  </div>

                  {/* Why Nominated Explanation */}
                  <div className="p-3 rounded-lg bg-[#17161b] border border-[#28272e] text-xs space-y-1.5">
                    <div className="font-bold text-white text-[11px]">
                      Candidate Rationale
                    </div>
                    <ul className="space-y-1 text-[#8b8a91] text-[11px] list-disc list-inside">
                      {renderSelectionWhy(cand).slice(0, 3).map((r, i) => (
                        <li key={i} className="leading-snug">{r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Investigation Summary & Action */}
                  {inv && (
                    <div className="pt-3 border-t border-[#28272e] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#848388]">Council Verdict:</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                          inv.decision?.conclusion === 'BUY'
                            ? 'bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20'
                            : inv.decision?.conclusion === 'SELL'
                            ? 'bg-rose-500/20 text-[#ff3b5c] border border-rose-500/30'
                            : 'bg-slate-800 text-[#9ca3af]'
                        }`}>
                          {inv.decision?.conclusion || inv.status}
                        </span>
                        {inv.decision?.riskGateApproved ? (
                          <span className="text-[10px] text-[#00ff84] font-bold">Risk Gate: PASS</span>
                        ) : (
                          <span className="text-[10px] text-[#ff3b5c] font-bold">Risk Gate: BLOCKED</span>
                        )}
                        {inv.execution && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            inv.execution.status === 'SUBMITTED' || inv.execution.status === 'FILLED'
                              ? 'bg-[#00ff84]/10 text-[#00ff84]'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            Paper: {inv.execution.status}
                          </span>
                        )}
                      </div>

                      {onSelectInvestigation && (
                        <button
                          onClick={() => onSelectInvestigation(inv)}
                          className="text-xs font-bold text-[#848388] hover:text-[#848388] transition flex items-center gap-1"
                        >
                          Inspect Deliberation →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Failed Scan Targets */}
      {scanResult && scanResult.failedTargets && scanResult.failedTargets.length > 0 && (
        <div className="p-6 rounded-3xl bg-rose-950/20 border border-rose-500/30 space-y-3">
          <div className="flex items-center gap-2 text-[#ff3b5c] text-xs font-bold uppercase tracking-wider">
            Scanner Feed Issues ({scanResult.failedTargets.length})
          </div>
          <p className="text-xs text-[#848388]">
            The following assets encountered feed errors and were isolated without halting the scan. No fake candidates were generated.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {scanResult.failedTargets.map((ft, i) => (
              <div key={i} className="p-3 rounded-lg bg-[#1f1e23] border border-rose-500/20 text-xs">
                <div className="font-bold text-white">${ft.symbol}</div>
                <div className="text-[#ff3b5c] text-[11px] mt-0.5">{ft.error}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Watchlist Section */}
      <div className="p-6 rounded-3xl bg-[#1f1e23] border border-[#28272e] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Monitored Watchlist ({watchlist.length})
            </h3>
          </div>
          <span className="text-[11px] text-[#848388]">
            In-memory watchlist • Independent from trade decisions
          </span>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-300/80">
          <span>
            <strong>Watchlist Invariant:</strong> Watchlisted assets represent monitored candidates and do <em>NOT</em> imply a BUY recommendation or trigger automated order execution.
          </span>
        </div>

        {watchlist.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#848388]">
            No assets currently on the watchlist. Click the bookmark icon on any candidate card to add it.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {watchlist.map((item) => (
              <div
                key={item.symbol}
                className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white">${item.symbol}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-[#848388]">
                      {item.assetClass}
                    </span>
                    {item.lastOpportunityScore !== undefined && (
                      <span className="text-[10px] text-[#848388] font-bold">
                        Score: {item.lastOpportunityScore.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#848388] mt-1">
                    Added: {new Date(item.addedAt).toLocaleTimeString()}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveFromWatchlist(item.symbol)}
                  className="text-xs text-[#848388] hover:text-[#ff3b5c] p-1.5 rounded-lg hover:bg-slate-800 transition"
                  title="Remove from Watchlist"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
