'use client';
import React from 'react';
import { Scale } from 'lucide-react';

interface BullThesis {
  summary: string;
  targetPrice?: number;
  expectedR?: number;
  momentumScore: number;
  volumeSurge: string;
  catalysts: string[];
}

interface RedTeamAttack {
  summary: string;
  invalidationPrice?: number;
  vulnerabilities: string[];
  riskScore: number;
  vetoTriggered: boolean;
}

interface AdversarialBattleCardProps {
  symbol?: string;
  opportunityScore?: number;
  bullThesis?: BullThesis;
  redTeamAttack?: RedTeamAttack;
  consensusVerdict?: 'BUY' | 'HOLD' | 'VETO';
  confidenceScore?: number;
}

const DEFAULT_BULL: BullThesis = {
  summary: 'Strong quantitative breakout setup confirmed by multi-timeframe ROC-3 acceleration and clean orderbook depth.',
  targetPrice: 82500,
  expectedR: 2.85,
  momentumScore: 78,
  volumeSurge: '2.4x baseline RVOL',
  catalysts: ['Institutional orderbook accumulation', 'Ascending consolidation pattern', 'Wilder RSI in constructive band (54.2)'],
};

const DEFAULT_RED: RedTeamAttack = {
  summary: 'Elevated overhead supply zone at $78.2k presents rejection risk. Spread widening could induce entry slippage.',
  invalidationPrice: 74200,
  vulnerabilities: ['Overhead resistance liquidity sweep', 'Volatility cluster >60% annualized', 'Liquidity exhaustion on lower timeframe'],
  riskScore: 38,
  vetoTriggered: false,
};

export const AdversarialBattleCard: React.FC<AdversarialBattleCardProps> = ({
  symbol = 'BTC',
  opportunityScore = 72,
  bullThesis = DEFAULT_BULL,
  redTeamAttack = DEFAULT_RED,
  consensusVerdict = 'BUY',
  confidenceScore = 74,
}) => {
  const verdictColor = consensusVerdict === 'BUY' ? '#00ff84' : consensusVerdict === 'VETO' ? '#ff3b5c' : '#f59e0b';

  return (
    <div className="terminal-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-3.5 h-3.5" style={{ color: '#848388' }} />
          <span className="terminal-label">
            Adversarial Debate: <span className="mono-num" style={{ color: '#e2e8f0' }}>${symbol}</span>
          </span>
          <span
            className="mono-num text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: '#848388', background: '#121117', border: '1px solid #28272e' }}
          >
            Score {opportunityScore}/100
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="terminal-label">Verdict</span>
          <span
            className="mono-num text-xs font-bold px-2.5 py-1 rounded"
            style={{ color: verdictColor, background: `${verdictColor}12`, border: `1px solid ${verdictColor}30` }}
          >
            {consensusVerdict} · {confidenceScore}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Bull */}
        <div
          className="p-3 rounded space-y-2.5"
          style={{ background: 'rgba(0,255,132,0.03)', border: '1px solid #28272e', borderLeft: '2px solid #00ff84' }}
        >
          <div className="flex items-center justify-between">
            <span className="terminal-label" style={{ color: '#00ff84' }}>[BULL] Quant + Intel Thesis</span>
            <span className="mono-num text-[10px]" style={{ color: '#00ff84' }}>
              Target: ${bullThesis.targetPrice?.toLocaleString('en-US')} · +{bullThesis.expectedR}R
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(226,232,240,0.7)' }}>{bullThesis.summary}</p>
          <div className="space-y-1">
            {bullThesis.catalysts.map((cat, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: 'rgba(226,232,240,0.6)' }}>
                <span style={{ color: '#00ff84' }} className="mt-0.5 shrink-0">›</span>
                <span>{cat}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1.5" style={{ borderTop: '1px solid rgba(0,255,132,0.12)' }}>
            <span className="terminal-label">Momentum</span>
            <span className="mono-num text-[10px] font-bold" style={{ color: '#00ff84' }}>{bullThesis.momentumScore}/100</span>
            <span className="terminal-label">RVOL</span>
            <span className="mono-num text-[10px] font-bold" style={{ color: '#00ff84' }}>{bullThesis.volumeSurge}</span>
          </div>
        </div>

        {/* Red Team */}
        <div
          className="p-3 rounded space-y-2.5"
          style={{ background: 'rgba(255,59,92,0.03)', border: '1px solid #28272e', borderLeft: '2px solid #ff3b5c' }}
        >
          <div className="flex items-center justify-between">
            <span className="terminal-label" style={{ color: '#ff3b5c' }}>[RED TEAM] Adversarial Attack</span>
            <span className="mono-num text-[10px]" style={{ color: '#ff3b5c' }}>
              Stop: ${redTeamAttack.invalidationPrice?.toLocaleString('en-US')}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(226,232,240,0.7)' }}>{redTeamAttack.summary}</p>
          <div className="space-y-1">
            {redTeamAttack.vulnerabilities.map((v, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: 'rgba(226,232,240,0.6)' }}>
                <span style={{ color: '#ff3b5c' }} className="mt-0.5 shrink-0">⚠</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1.5" style={{ borderTop: '1px solid rgba(255,59,92,0.12)' }}>
            <span className="terminal-label">Risk Score</span>
            <span className="mono-num text-[10px] font-bold" style={{ color: '#ff3b5c' }}>{redTeamAttack.riskScore}/100</span>
            <span className="terminal-label">Veto</span>
            <span className="mono-num text-[10px] font-bold" style={{ color: redTeamAttack.vetoTriggered ? '#ff3b5c' : '#00ff84' }}>
              {redTeamAttack.vetoTriggered ? 'ACTIVE' : 'CLEARED'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
