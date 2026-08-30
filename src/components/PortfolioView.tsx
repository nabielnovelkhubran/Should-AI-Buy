'use client';
import React, { useState } from 'react';
import { Shield, TrendingUp, AlertCircle, Play, CheckCircle2, RefreshCw } from 'lucide-react';
import { Position, AlpacaAccount, AlpacaOrder } from '../lib/types';
import { useCurrency } from './CurrencyProvider';

interface PortfolioViewProps {
  account?: AlpacaAccount | null;
  positions: Position[];
  orders: AlpacaOrder[];
  onReevaluate: (symbol: string, executeSell: boolean) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  account,
  positions,
  orders,
  onReevaluate
}) => {
  const [reEvalLoading, setReEvalLoading] = useState<string | null>(null);
  const { formatCurrency } = useCurrency();

  const handleReeval = async (symbol: string, executeSell: boolean) => {
    setReEvalLoading(symbol);
    await onReevaluate(symbol, executeSell);
    setReEvalLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#11141d] border border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-semibold">Portfolio Value</div>
          <div className="text-xl font-bold text-white mt-1">
            {formatCurrency(account?.portfolioValue || 100000)}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-0.5">Alpaca Paper Account</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#11141d] border border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-semibold">Buying Power</div>
          <div className="text-xl font-bold text-indigo-400 mt-1">
            {formatCurrency(account?.buyingPower || 98450)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Available for deployment</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#11141d] border border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-semibold">Active Positions</div>
          <div className="text-xl font-bold text-white mt-1">{positions.filter(p => p.status === 'OPEN').length}</div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Continuous Monitoring</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#11141d] border border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-semibold">Risk Engine Status</div>
          <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Deterministic Safety Gate</div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-[#11141d] border border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          Active Holdings & Invalidation Monitoring
        </h3>
        {positions.filter(p => p.status === 'OPEN').length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No active positions open. Ask the council (e.g. <span className="text-indigo-400">"Should-AI buy $SOL?"</span>) to execute an approved paper trade.
          </div>
        ) : (
          <div className="space-y-4">
            {positions.filter(p => p.status === 'OPEN').map((pos) => (
              <div key={pos.id} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-white">${pos.symbol}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                      Qty: {pos.quantity}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Entry: ${pos.entryPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Thesis: <span className="text-slate-300">{pos.thesis?.bullCase?.substring(0, 90)}...</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReeval(pos.symbol, false)}
                    disabled={reEvalLoading === pos.symbol}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reEvalLoading === pos.symbol ? 'animate-spin' : ''}`} />
                    Re-Evaluate Thesis
                  </button>
                  <button
                    onClick={() => handleReeval(pos.symbol, true)}
                    disabled={reEvalLoading === pos.symbol}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    Close Position (Sell)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-[#11141d] border border-slate-800">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Alpaca Paper Orders History
        </h4>
        <div className="divide-y divide-slate-800/60 text-xs">
          {orders.map((ord) => (
            <div key={ord.id} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`font-bold uppercase ${ord.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>{ord.side}</span>
                <span className="font-semibold text-white">${ord.symbol}</span>
                <span className="text-slate-500 font-mono">({ord.qty} units @ ${ord.filledAvgPrice?.toFixed(2)})</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-slate-400 text-[11px]">
                <span>{new Date(ord.submittedAt).toLocaleTimeString()}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase text-[10px]">{ord.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
