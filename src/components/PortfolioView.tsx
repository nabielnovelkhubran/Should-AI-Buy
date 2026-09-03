'use client';
import React, { useState, useEffect } from 'react';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
  DollarSign,
  PieChart,
  Layers,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Check,
  XCircle
} from 'lucide-react';
import {
  PortfolioSnapshot,
  PaperPosition,
  PaperOrderSnapshot,
  PaperAccountSnapshot
} from '@/lib/portfolio/types';
import {
  MonitoringCycleResult,
  MonitoredPositionRecord
} from '@/lib/monitoring/types';
import { useCurrency } from './CurrencyProvider';

interface PortfolioViewProps {
  account?: PaperAccountSnapshot | any | null;
  positions?: PaperPosition[] | any[];
  orders?: PaperOrderSnapshot[] | any[];
  onReevaluate?: (symbol: string, executeSell: boolean) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  account: initialAccount,
  positions: initialPositions = [],
  orders: initialOrders = [],
  onReevaluate
}) => {
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [monitoringResult, setMonitoringResult] = useState<MonitoringCycleResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMonitoringLoading, setIsMonitoringLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reEvalLoading, setReEvalLoading] = useState<string | null>(null);
  const [exitActionLoading, setExitActionLoading] = useState<string | null>(null);
  const { formatCurrency } = useCurrency();

  const fetchFullPortfolio = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/trading/paper/portfolio?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || 'Failed to fetch paper portfolio snapshot.');
      }
    } catch (err: any) {
      console.error('Portfolio fetch error', err);
      setErrorMsg(err.message || 'Failed to reach portfolio API.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonitoringState = async () => {
    try {
      const res = await fetch('/api/monitoring');
      if (res.ok) {
        const data = await res.json();
        setMonitoringResult(data);
      }
    } catch (err) {
      console.error('Monitoring fetch error', err);
    }
  };

  const runMonitoringCycle = async (executeExits: boolean = false) => {
    setIsMonitoringLoading(true);
    try {
      const res = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executeExits })
      });
      if (res.ok) {
        const data = await res.json();
        setMonitoringResult(data);
        await fetchFullPortfolio();
      }
    } catch (err: any) {
      console.error('Run monitoring cycle error', err);
    } finally {
      setIsMonitoringLoading(false);
    }
  };

  useEffect(() => {
    fetchFullPortfolio();
    fetchMonitoringState();
  }, []);

  const handleReeval = async (symbol: string, executeSell: boolean) => {
    if (!onReevaluate) return;
    setReEvalLoading(symbol);
    await onReevaluate(symbol, executeSell);
    await fetchFullPortfolio();
    await fetchMonitoringState();
    setReEvalLoading(null);
  };

  const handleExecuteExit = async (symbol: string) => {
    setExitActionLoading(symbol);
    await runMonitoringCycle(true);
    setExitActionLoading(null);
  };

  // Derive display values from snapshot or fallback props
  const acc = portfolio?.account || initialAccount;
  const posList: PaperPosition[] = portfolio?.positions || (initialPositions as any[]) || [];
  const ordList: PaperOrderSnapshot[] = portfolio?.openOrders || (initialOrders as any[]) || [];
  const exposure = portfolio?.exposure;
  const risk = portfolio?.risk;

  // Calculate total unrealized P&L
  const totalUnrealizedPnl = posList.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
  const totalCostBasis = posList.reduce((sum, p) => sum + (p.costBasis || 0), 0);
  const totalPnlPct = totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Header Controls & Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#848388]" />
              Paper Portfolio & Position Monitoring
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              PAPER TRADING ONLY
            </span>
          </div>
          <p className="text-xs text-[#848388] mt-1">
            Real-time broker reconciliation, autonomous thesis health monitoring, and protective invalidation daemon.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => runMonitoringCycle(false)}
            disabled={isMonitoringLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-xs font-semibold text-[#848388] hover:bg-indigo-600/30 transition disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${isMonitoringLoading ? 'animate-spin' : ''}`} />
            <span>Check Thesis Health</span>
          </button>

          <button
            onClick={() => {
              fetchFullPortfolio();
              fetchMonitoringState();
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-[#34333b] text-xs font-semibold text-[#9ca3af] hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-[#ff3b5c]/8 border border-rose-500/30 flex items-center gap-3 text-[#ff3b5c] text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#ff3b5c]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Account Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-1">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider">Portfolio Equity</span>
          <div className="text-xl font-bold font-mono text-white">
            {formatCurrency(acc?.equity || 100000)}
          </div>
          <div className="text-[10px] text-[#2d3748] flex items-center gap-1">
            <span>Buying Power:</span>
            <span className="font-mono text-[#9ca3af]">{formatCurrency(acc?.buyingPower || 200000)}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-1">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider">Cash Balance</span>
          <div className="text-xl font-bold font-mono text-white">
            {formatCurrency(acc?.cash || 100000)}
          </div>
          <div className="text-[10px] text-[#2d3748] flex items-center gap-1">
            <span>Currency:</span>
            <span className="font-mono text-[#9ca3af]">{acc?.currency || 'USD'}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-1">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider">Unrealized P&L</span>
          <div className={`text-xl font-bold font-mono flex items-center gap-1 ${
            totalUnrealizedPnl >= 0 ? 'text-[#00ff84]' : 'text-[#ff3b5c]'
          }`}>
            {totalUnrealizedPnl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)}
          </div>
          <div className={`text-[10px] font-mono ${totalPnlPct >= 0 ? 'text-[#00ff84]/80' : 'text-[#ff3b5c]/80'}`}>
            {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}% total return
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-1">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider">Gross Exposure</span>
          <div className="text-xl font-bold font-mono text-white">
            {exposure ? `${exposure.grossExposurePct.toFixed(1)}%` : '0.0%'}
          </div>
          <div className="text-[10px] text-[#2d3748] flex items-center gap-1">
            <span>Net Exposure:</span>
            <span className="font-mono text-[#9ca3af]">
              {exposure ? `${exposure.netExposurePct >= 0 ? '+' : ''}${exposure.netExposurePct.toFixed(1)}%` : '0.0%'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Concentration Warnings Alert */}
      {risk?.concentrationWarnings && risk.concentrationWarnings.length > 0 && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Portfolio Concentration Warnings Detected</span>
          </div>
          <ul className="space-y-1 text-xs text-amber-200/90 pl-6 list-disc">
            {risk.concentrationWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Autonomous Position Monitoring & Thesis Health Section (Phase 6C) */}
      <div className="p-6 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00ff84]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Autonomous Position Monitoring & Thesis Health
            </h3>
            {monitoringResult && (
              <span className="text-[10px] font-mono text-[#848388]">
                ({monitoringResult.monitoredPositions?.length || 0} monitored)
              </span>
            )}
          </div>
          {monitoringResult && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-[#00ff84] font-semibold">{monitoringResult.healthyCount} Healthy</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-semibold">{monitoringResult.degradedCount} Degraded</span>
              <span className="text-slate-600">•</span>
              <span className="text-[#ff3b5c] font-semibold">{monitoringResult.invalidatedCount} Invalidated</span>
            </div>
          )}
        </div>

        {(!monitoringResult || monitoringResult.monitoredPositions?.length === 0) ? (
          <div className="text-center py-6 text-[#2d3748] text-xs">
            No active positions currently monitored. Run a council investigation and place a paper order to start monitoring.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {monitoringResult.monitoredPositions.map((rec, idx) => {
              const h = rec.health;
              const isInvalid = h.status === 'INVALIDATED';
              const isDegraded = h.status === 'DEGRADED';
              const isHealthy = h.status === 'HEALTHY';

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border transition ${
                    isInvalid
                      ? 'bg-rose-500/5 border-rose-500/30'
                      : isDegraded
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-[#1f1e23] border-[#28272e]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">${rec.position.symbol}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.position.side === 'short' ? 'bg-rose-500/20 text-[#ff3b5c]' : 'bg-[#00ff84]/10 text-[#00ff84]'
                      }`}>
                        {rec.position.side ? rec.position.side.toUpperCase() : 'LONG'}
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isInvalid
                        ? 'bg-rose-500/20 text-[#ff3b5c] border border-rose-500/40'
                        : isDegraded
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : isHealthy
                        ? 'bg-[#00ff84]/10 text-[#00ff84] border border-emerald-500/40'
                        : 'bg-slate-800 text-[#848388]'
                    }`}>
                      {h.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] font-mono">
                    <div className="p-2 rounded bg-[#1f1e23] border border-[#28272e]/80">
                      <span className="text-[#2d3748] block text-[10px]">Health Score</span>
                      <span className={`font-bold ${h.score >= 70 ? 'text-[#00ff84]' : h.score >= 40 ? 'text-amber-400' : 'text-[#ff3b5c]'}`}>
                        {h.score}/100
                      </span>
                    </div>
                    <div className="p-2 rounded bg-[#1f1e23] border border-[#28272e]/80">
                      <span className="text-[#2d3748] block text-[10px]">Position P&L</span>
                      <span className={`font-bold ${(rec.position.unrealizedPnl || 0) >= 0 ? 'text-[#00ff84]' : 'text-[#ff3b5c]'}`}>
                        {(rec.position.unrealizedPnlPercent || 0) >= 0 ? '+' : ''}{(rec.position.unrealizedPnlPercent || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="p-2 rounded bg-[#1f1e23] border border-[#28272e]/80">
                      <span className="text-[#2d3748] block text-[10px]">Entry Price</span>
                      <span className="text-[#9ca3af] font-bold">
                        ${rec.position.avgEntryPrice?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>

                  {/* Findings / Triggers */}
                  {h.findings && h.findings.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <span className="text-[10px] font-bold text-[#848388] uppercase tracking-wider">Evaluation Findings</span>
                      <ul className="space-y-1 text-[11px] text-[#9ca3af]">
                        {h.findings.map((f, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-1.5">
                            {f.severity === 'CRITICAL' ? (
                              <XCircle className="w-3.5 h-3.5 text-[#ff3b5c] shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            )}
                            <span className={f.severity === 'CRITICAL' ? 'text-[#ff3b5c]' : 'text-amber-300'}>
                              {f.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Protective Exit Proposal Action */}
                  {rec.proposal && (
                    <div className="mt-3 pt-3 border-t border-[#28272e]/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#848388] block font-semibold uppercase">Protective Action</span>
                        <span className="text-xs font-mono font-bold text-[#ff3b5c]">
                          {rec.proposal.proposedSide.toUpperCase()} {rec.proposal.quantity} units ({rec.proposal.status})
                        </span>
                      </div>

                      {rec.proposal.status === 'PROPOSED' && (
                        <button
                          onClick={() => handleExecuteExit(rec.position.symbol)}
                          disabled={exitActionLoading === rec.position.symbol}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition disabled:opacity-50"
                        >
                          {exitActionLoading === rec.position.symbol ? 'Submitting...' : 'Submit Exit'}
                        </button>
                      )}

                      {rec.proposal.status === 'EXECUTED' && (
                        <span className="px-2 py-0.5 rounded bg-[#00ff84]/10 text-[#00ff84] text-[10px] font-bold">
                          Exit Order Submitted
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Broker-Confirmed Positions Table */}
      <div className="p-6 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00ff84]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Broker-Confirmed Open Positions ({posList.length})
            </h3>
          </div>
          <span className="text-xs text-[#2d3748]">Authoritative Broker Fills</span>
        </div>

        {posList.length === 0 ? (
          <div className="text-center py-8 text-[#2d3748] text-xs">
            No open paper positions confirmed by Alpaca Paper Trading broker.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#28272e] text-[#848388] text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3">Asset</th>
                  <th className="py-3 px-3">Side</th>
                  <th className="py-3 px-3">Quantity</th>
                  <th className="py-3 px-3">Entry Price</th>
                  <th className="py-3 px-3">Current Price</th>
                  <th className="py-3 px-3">Market Value</th>
                  <th className="py-3 px-3">Unrealized P&L</th>
                  <th className="py-3 px-3">Allocation</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {posList.map((pos, i) => (
                  <tr key={i} className="hover:bg-[#1f1e23] transition">
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-1.5">
                      <span>${pos.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-[#848388] font-normal">
                        {pos.assetClass}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pos.side === 'short'
                          ? 'bg-rose-500/20 text-[#ff3b5c]'
                          : 'bg-[#00ff84]/10 text-[#00ff84]'
                      }`}>
                        {pos.side ? pos.side.toUpperCase() : 'LONG'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-200">{pos.quantity}</td>
                    <td className="py-3 px-3 font-mono text-[#9ca3af]">${pos.avgEntryPrice?.toFixed(2) || '0.00'}</td>
                    <td className="py-3 px-3 font-mono text-white font-semibold">${pos.currentPrice?.toFixed(2) || '0.00'}</td>
                    <td className="py-3 px-3 font-mono font-bold text-white">{formatCurrency(pos.marketValue || 0)}</td>
                    <td className="py-3 px-3">
                      <div className={`font-mono font-bold flex items-center gap-1 ${
                        (pos.unrealizedPnl || 0) >= 0 ? 'text-[#00ff84]' : 'text-[#ff3b5c]'
                      }`}>
                        {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPnl || 0)}
                        <span className="text-[10px] opacity-80">
                          ({(pos.unrealizedPnlPercent || 0) >= 0 ? '+' : ''}{(pos.unrealizedPnlPercent || 0).toFixed(2)}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${Math.min(100, pos.allocationPct || 0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[#848388]">
                          {(pos.allocationPct || 0).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {onReevaluate && (
                        <button
                          onClick={() => handleReeval(pos.symbol, false)}
                          disabled={reEvalLoading === pos.symbol}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition"
                        >
                          {reEvalLoading === pos.symbol ? 'Evaluating...' : 'Re-Evaluate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Open & Pending Orders Table */}
      <div className="p-6 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#848388]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Pending & Active Paper Orders ({ordList.length})
            </h3>
          </div>
          <span className="text-xs text-[#2d3748]">Order Reconciliation Queue</span>
        </div>

        {ordList.length === 0 ? (
          <div className="text-center py-8 text-[#2d3748] text-xs">
            No pending or open paper orders in broker queue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#28272e] text-[#848388] text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Filled</th>
                  <th className="py-2.5 px-3">Remaining</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ordList.map((ord, i) => (
                  <tr key={i} className="hover:bg-[#1f1e23] transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#848388]">
                      {ord.orderId?.substring(0, 16)}...
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">${ord.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.side === 'sell'
                          ? 'bg-rose-500/20 text-[#ff3b5c]'
                          : 'bg-[#00ff84]/8 text-[#848388]'
                      }`}>
                        {ord.side?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-200">{ord.qty}</td>
                    <td className="py-2.5 px-3 font-mono text-[#00ff84]">{ord.filledQty || 0}</td>
                    <td className="py-2.5 px-3 font-mono text-[#848388]">{ord.remainingQty || ord.qty}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.status === 'FILLED'
                          ? 'bg-[#00ff84]/10 text-[#00ff84]'
                          : ord.status === 'PARTIALLY_FILLED'
                          ? 'bg-cyan-500/20 text-[#00ff84]'
                          : ord.status === 'SUBMITTED'
                          ? 'bg-amber-500/20 text-amber-300'
                          : ord.status === 'CANCELED'
                          ? 'bg-slate-800 text-[#848388]'
                          : 'bg-rose-500/20 text-[#ff3b5c]'
                      }`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[11px] text-[#848388] font-mono">
                      {new Date(ord.submittedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
