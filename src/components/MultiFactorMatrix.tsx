'use client';
import React from 'react';

interface MultiFactorMatrixProps {
  symbol?: string;
  momentumScore?: number;
  rsi?: number;
  rvol?: number;
  volatility?: number;
  spreadBps?: number;
  liquidityUsd?: number;
  regime?: string;
  opportunityScore?: number;
}

const FactorBar = ({ label, value, sublabel, pct, color }: {
  label: string; value: string; sublabel: string; pct: number; color: string;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="terminal-label">{label}</span>
      <span className="mono-num text-[11px] font-bold" style={{ color }}>{value}</span>
    </div>
    <div className="w-full rounded-full overflow-hidden" style={{ height: '2px', background: '#28272e' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }}
      />
    </div>
    <span className="terminal-label block" style={{ color: '#2d3748' }}>{sublabel}</span>
  </div>
);

export const MultiFactorMatrix: React.FC<MultiFactorMatrixProps> = ({
  symbol = 'BTC',
  momentumScore = 72,
  rsi = 54.2,
  rvol = 2.4,
  volatility = 48.5,
  spreadBps = 18.4,
  regime = 'BULLISH_MOMENTUM',
  opportunityScore = 74,
}) => (
  <div className="terminal-card p-4 space-y-2">
    <div className="flex items-center justify-between">
      <span className="terminal-label">
        Multi-Factor Decomposition · <span className="mono-num" style={{ color: '#e2e8f0' }}>${symbol}</span>
      </span>
      <div className="flex items-center gap-2">
        <span className="terminal-label">Composite</span>
        <span
          className="mono-num text-xs font-bold px-2 py-0.5 rounded"
          style={{ color: '#00ff84', background: 'rgba(0,255,132,0.08)', border: '1px solid rgba(0,255,132,0.2)' }}
        >
          {opportunityScore}/100
        </span>
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
      <FactorBar
        label="Momentum (ROC-3)"
        value={`${momentumScore}/100`}
        sublabel={`RSI-14: ${rsi.toFixed(1)}`}
        pct={momentumScore}
        color={momentumScore >= 60 ? '#00ff84' : momentumScore >= 45 ? '#f59e0b' : '#ff3b5c'}
      />
      <FactorBar label="Rel. Volume" value={`${rvol.toFixed(2)}x`} sublabel="vs 24h Baseline" pct={Math.min(100, rvol * 33)} color="#00ff84" />
      <FactorBar
        label="Realized Vol"
        value={`${volatility.toFixed(1)}%`}
        sublabel="Annualized Risk"
        pct={volatility}
        color={volatility < 40 ? '#00ff84' : volatility < 65 ? '#f59e0b' : '#ff3b5c'}
      />
      <FactorBar
        label="Spread"
        value={`${spreadBps.toFixed(1)} bps`}
        sublabel="Ceiling 100 bps"
        pct={Math.max(5, 100 - spreadBps)}
        color={spreadBps < 30 ? '#00ff84' : spreadBps < 70 ? '#f59e0b' : '#ff3b5c'}
      />
      <FactorBar label="Regime" value="Aligned" sublabel={regime.replace(/_/g, ' ')} pct={82} color="#00ff84" />
    </div>
  </div>
);
