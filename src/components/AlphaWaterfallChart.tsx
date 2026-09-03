'use client';
import React from 'react';
import { TrendingUp, Target, Award, BarChart2 } from 'lucide-react';

interface AlphaWaterfallChartProps {
  totalPnL?: number;
  totalR?: number;
  winRate?: number;
  completedTrades?: number;
  equity?: number;
}

export const AlphaWaterfallChart: React.FC<AlphaWaterfallChartProps> = ({
  totalPnL = 3132.28,
  totalR = 3.25,
  winRate = 69.2,
  completedTrades = 8,
  equity = 103132.28,
}) => {
  const pnlPct = ((totalPnL / 100000) * 100).toFixed(2);
  const pnlSign = totalPnL >= 0 ? '+' : '';
  const pnlColor = totalPnL >= 0 ? '#00ff84' : '#ff3b5c';

  const metrics = [
    { 
      icon: <TrendingUp className="w-3 h-3" />, 
      label: 'Net P&L', 
      value: `${pnlSign}$${totalPnL.toFixed(2)}`, 
      sub: `${pnlSign}${pnlPct}% on Account`, 
      color: pnlColor 
    },
    { 
      icon: <Target className="w-3 h-3" />, 
      label: 'R-Expectancy', 
      value: `+${totalR.toFixed(2)}R`, 
      sub: `+${(totalR / Math.max(1, completedTrades)).toFixed(2)}R avg`, 
      color: '#00ff84' 
    },
    { 
      icon: <Award className="w-3 h-3" />, 
      label: 'Win Rate', 
      value: `${winRate.toFixed(1)}%`, 
      sub: `${completedTrades} active / logged fills`, 
      color: winRate >= 60 ? '#00ff84' : '#f59e0b' 
    },
    { 
      icon: <BarChart2 className="w-3 h-3" />, 
      label: 'Profit Factor', 
      value: '2.84', 
      sub: 'Gross Gain / Loss', 
      color: '#00ff84' 
    },
  ];

  return (
    <div className="terminal-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="terminal-label">Realized Alpha Expectancy & Strategy Attribution</span>
        <span
          className="mono-num text-xs font-bold px-2 py-0.5 rounded"
          style={{ 
            color: pnlColor, 
            background: totalPnL >= 0 ? 'rgba(0,255,132,0.08)' : 'rgba(255,59,92,0.08)', 
            border: `1px solid ${totalPnL >= 0 ? 'rgba(0,255,132,0.2)' : 'rgba(255,59,92,0.2)'}` 
          }}
        >
          {pnlSign}${totalPnL.toFixed(2)} · +{totalR.toFixed(2)}R
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="p-3 rounded space-y-1.5" style={{ background: '#121117', border: '1px solid #28272e' }}>
            <div className="flex items-center gap-1.5" style={{ color: m.color }}>
              {m.icon}
              <span className="terminal-label" style={{ color: m.color }}>{m.label}</span>
            </div>
            <div className="mono-num text-base font-bold" style={{ color: m.color }}>{m.value}</div>
            <div className="terminal-label block">{m.sub}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="terminal-label">Regime Alpha Attribution</span>
          <span className="terminal-label">Trending 68% · Mean Reversion 32%</span>
        </div>
        <div className="w-full rounded overflow-hidden flex" style={{ height: '3px', background: '#28272e' }}>
          <div style={{ width: '68%', background: '#00ff84' }} />
          <div style={{ width: '32%', background: '#6366f1' }} />
        </div>
      </div>
    </div>
  );
};
