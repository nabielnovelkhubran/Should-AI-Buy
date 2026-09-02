'use client';
import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Play,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import {
  SimulationScenario,
  SimulationPortfolioState,
  ExecutionTraceStep
} from '../lib/simulation/types';

export const ExecutionLabView: React.FC = () => {
  const [scenario, setScenario] = useState<SimulationScenario>('SUCCESSFUL_BUY');
  const [portfolio, setPortfolio] = useState<SimulationPortfolioState | null>(null);
  const [trace, setTrace] = useState<ExecutionTraceStep[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchSimulationState = async () => {
    try {
      const res = await fetch('/api/simulation');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPortfolio(data.portfolio);
          setTrace(data.trace || []);
        }
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchSimulationState();
  }, []);

  const handleRunScenario = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RUN_SCENARIO', scenario })
      });
      const data = await res.json();
      if (data.success) {
        const port = data.portfolio || data.result?.portfolio || null;
        const tr = data.trace || data.result?.trace || [];
        const msg = data.message || data.result?.message || 'Scenario executed.';
        if (port) setPortfolio(port);
        setTrace(tr);
        setMessage(msg);
      } else {
        setMessage(`Error: ${data.error || 'Execution failed'}`);
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBumpPrice = async (percent: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BUMP_PRICE', percent })
      });
      const data = await res.json();
      if (data.success) {
        const port = data.portfolio || data.result?.portfolio || null;
        const tr = data.trace || data.result?.trace || [];
        if (port) setPortfolio(port);
        setTrace(tr);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSell = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SIMULATE_SELL' })
      });
      const data = await res.json();
      if (data.success) {
        const port = data.portfolio || data.result?.portfolio || null;
        const tr = data.trace || data.result?.trace || [];
        const msg = data.message || data.result?.message || 'Position closed.';
        if (port) setPortfolio(port);
        setTrace(tr);
        setMessage(msg);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET' })
      });
      const data = await res.json();
      if (data.success) {
        const port = data.portfolio || data.result?.portfolio || null;
        if (port) setPortfolio(port);
        setTrace([]);
        setMessage('Simulation reset to initial state ($100,000 cash, 0 positions).');
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 className="w-4 h-4 text-[#00ff84] shrink-0" />;
      case 'BLOCKED':
      case 'FAIL':
        return <XCircle className="w-4 h-4 text-[#ff3b5c] shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-[#00ff84] shrink-0" />;
    }
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-300">
      {/* Header & Mode Badge */}
      <div className="bg-[#1f1e23] border border-[#28272e] rounded-lg p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[#848388]">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100">Execution Lab</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-[#848388] border border-purple-500/20">
                  ISOLATED SIMULATION RUNTIME
                </span>
              </div>
              <p className="text-sm text-[#848388] mt-0.5">
                Test the complete trade lifecycle (Discovery → Sizing → Risk Gate → Fill → Monitoring → Sell) deterministically without calling Alpaca.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-[#9ca3af] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#34333b]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Lab
            </button>
          </div>
        </div>

        {/* Isolation Invariant Banner */}
        <div className="mt-4 p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg flex items-center gap-2.5 text-xs text-purple-300">
          <ShieldCheck className="w-4 h-4 text-[#848388] shrink-0" />
          <span>
            <strong>Zero Alpaca Impact:</strong> Simulation runs have zero network calls to Alpaca. Real Paper account remains $100,000 cash with N=0 trades.
          </span>
        </div>

        {/* Simulation Portfolio Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="bg-[#1f1e23] border border-[#28272e]/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#848388] block uppercase tracking-wider">Simulated Equity</span>
            <span className="text-base font-bold text-slate-100 font-mono mt-1 block">
              ${portfolio ? portfolio.equity.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '100,000.00'}
            </span>
          </div>

          <div className="bg-[#1f1e23] border border-[#28272e]/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#848388] block uppercase tracking-wider">Simulated Cash</span>
            <span className="text-base font-bold text-[#00ff84] font-mono mt-1 block">
              ${portfolio ? portfolio.cash.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '100,000.00'}
            </span>
          </div>

          <div className="bg-[#1f1e23] border border-[#28272e]/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#848388] block uppercase tracking-wider">Open Positions</span>
            <span className="text-base font-bold text-[#00ff84] font-mono mt-1 block">
              {portfolio?.openPositionCount || 0}
            </span>
          </div>

          <div className="bg-[#1f1e23] border border-[#28272e]/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#848388] block uppercase tracking-wider">Unrealized P&L</span>
            <span className={`text-base font-bold font-mono mt-1 block ${(portfolio?.unrealizedPnL || 0) >= 0 ? 'text-[#00ff84]' : 'text-[#ff3b5c]'}`}>
              ${portfolio ? portfolio.unrealizedPnL.toFixed(2) : '0.00'}
            </span>
          </div>

          <div className="bg-[#1f1e23] border border-[#28272e]/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#848388] block uppercase tracking-wider">Realized P&L</span>
            <span className={`text-base font-bold font-mono mt-1 block ${(portfolio?.realizedPnL || 0) >= 0 ? 'text-[#00ff84]' : 'text-[#ff3b5c]'}`}>
              ${portfolio ? portfolio.realizedPnL.toFixed(2) : '0.00'}
            </span>
          </div>
        </div>
      </div>

      {/* Lab Controls & Scenario Runner */}
      <div className="bg-[#1f1e23] border border-[#28272e] rounded-lg p-5 backdrop-blur-sm">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#848388]" />
          Interactive Scenario Controls
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div>
            <label className="text-xs font-semibold text-[#848388] block mb-1.5 uppercase tracking-wider">
              Select Lifecycle Scenario
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as SimulationScenario)}
              disabled={loading}
              className="w-full bg-[#1f1e23] border border-[#34333b] text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-purple-500"
            >
              <option value="SUCCESSFUL_BUY">Successful BUY (Pass → Sizing → Risk → Fill)</option>
              <option value="PROFIT_EXIT">Profit Exit (Buy → +5% Gain → Sells at Target)</option>
              <option value="PROTECTIVE_EXIT">Protective Exit (Buy → -6% Drop → Invalidation Exit)</option>
              <option value="BUY_REJECTED">BUY Rejected (Broker Margin / Reject Error)</option>
              <option value="PARTIAL_FILL">Partial Fill (50% Quantity Executed)</option>
              <option value="TIMEOUT">Broker Gateway Timeout (HTTP 504)</option>
              <option value="BROKER_ERROR">Broker Internal Server Error (HTTP 500)</option>
              <option value="CANCELLED">Order Cancelled Before Fill</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRunScenario}
              disabled={loading}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Scenario
            </button>
          </div>

          {/* Interactive Price Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => handleBumpPrice(5)}
              disabled={loading || (portfolio?.openPositionCount || 0) === 0}
              className="flex-1 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-[#00ff84]/20 text-[#00ff84] disabled:opacity-40 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              +5% Price
            </button>
            <button
              onClick={() => handleBumpPrice(-5)}
              disabled={loading || (portfolio?.openPositionCount || 0) === 0}
              className="flex-1 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-[#ff3b5c] disabled:opacity-40 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              -5% Price
            </button>
            <button
              onClick={handleSimulateSell}
              disabled={loading || (portfolio?.openPositionCount || 0) === 0}
              className="flex-1 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 disabled:opacity-40 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Simulate SELL
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-4 p-3 bg-[#1f1e23] border border-[#28272e] rounded-lg text-xs font-mono text-[#9ca3af] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#848388] shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </div>

      {/* Execution Trace Lineage Feed */}
      <div className="bg-[#1f1e23] border border-[#28272e] rounded-lg p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#848388]" />
            End-to-End Execution Trace ({trace.length} Steps)
          </h3>
          <span className="text-xs text-[#2d3748] font-mono">Trace Lineage: Discovery → Council → Risk → Broker → Monitoring → Exit</span>
        </div>

        {trace.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#28272e] rounded-lg">
            <FlaskConical className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#848388]">Execution Lab is ready.</p>
            <p className="text-xs text-slate-600 mt-1">
              Select a scenario above and click &quot;Run Scenario&quot; to generate an execution trace.
            </p>
          </div>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {trace.map((step, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-[#1f1e23] rounded-lg border border-[#28272e]/80 flex items-start gap-3 transition-colors hover:border-[#34333b]"
              >
                {getStepIcon(step.status)}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-purple-300 border border-[#34333b] font-semibold">
                        {step.stage}
                      </span>
                      {step.step}
                    </span>
                    <span className="text-[11px] text-[#2d3748] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[#9ca3af] text-[11px] leading-relaxed">{step.detail}</p>
                  {step.correlationIds && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-[#2d3748] pt-1">
                      {step.correlationIds.cycleId && <span>Cycle: {step.correlationIds.cycleId}</span>}
                      {step.correlationIds.candidateId && <span>Candidate: {step.correlationIds.candidateId}</span>}
                      {step.correlationIds.orderId && <span className="text-amber-400">Order: {step.correlationIds.orderId}</span>}
                      {step.correlationIds.brokerOrderId && <span className="text-[#00ff84]">Broker: {step.correlationIds.brokerOrderId}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Simulated Positions Table */}
      {portfolio && portfolio.positions.length > 0 && (
        <div className="bg-[#1f1e23] border border-[#28272e] rounded-lg p-5 backdrop-blur-sm">
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#00ff84]" />
            Active Simulated Positions ({portfolio.positions.length})
          </h3>
          <div className="overflow-x-auto font-mono text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#28272e] text-[#848388] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Avg Entry Price</th>
                  <th className="py-2.5 px-3">Current Price</th>
                  <th className="py-2.5 px-3">Cost Basis</th>
                  <th className="py-2.5 px-3">Market Value</th>
                  <th className="py-2.5 px-3 text-right">Unrealized P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {portfolio.positions.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-bold text-slate-200">{p.symbol}</td>
                    <td className="py-2.5 px-3 text-[#9ca3af]">{p.quantity}</td>
                    <td className="py-2.5 px-3 text-[#848388]">${p.avgEntryPrice.toLocaleString('en-US')}</td>
                    <td className="py-2.5 px-3 text-slate-200 font-bold">${p.currentPrice.toLocaleString('en-US')}</td>
                    <td className="py-2.5 px-3 text-[#848388]">${p.costBasis.toLocaleString('en-US')}</td>
                    <td className="py-2.5 px-3 text-[#9ca3af]">${p.marketValue.toLocaleString('en-US')}</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${p.unrealizedPnl >= 0 ? 'text-[#00ff84]' : 'text-[#ff3b5c]'}`}>
                      ${p.unrealizedPnl.toFixed(2)} ({p.unrealizedPnlPercent}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
