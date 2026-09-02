'use client';
import React, { useState } from 'react';
import {
  Activity,
  BarChart2,
  Globe,
  Shield,
  Scale,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Flame,
  Search,
  Lock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageSquare
} from 'lucide-react';
import { Investigation, CouncilStage, CouncilStageStatus, AgentResult, Claim } from '../lib/types';
import { ClaimInspector } from './ClaimInspector';
import { ContradictionMatrix } from './ContradictionMatrix';

interface DeliberationFeedProps {
  investigation: Investigation;
  onViewEvidence?: (category?: string) => void;
}

const STAGE_CONFIG: {
  stage: CouncilStage;
  label: string;
  question: string;
  fullDescription: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    stage: 'DISCOVERY',
    label: 'Discovery',
    question: 'What is happening?',
    fullDescription: 'Scans real-time Alpaca market feeds to measure price velocity, volume acceleration, and baseline opportunity threshold.',
    icon: Search
  },
  {
    stage: 'QUANT',
    label: 'Quant',
    question: 'What do numbers say?',
    fullDescription: 'Computes deterministic mathematical indicators including RSI-14, Relative Volume (RVOL), realized volatility, and return windows.',
    icon: BarChart2
  },
  {
    stage: 'INTELLIGENCE',
    label: 'Intelligence',
    question: 'What news/catalysts exist?',
    fullDescription: 'Audits public disclosures, news releases, and external sentiment without fabricating unverified claims.',
    icon: Globe
  },
  {
    stage: 'RISK',
    label: 'Risk',
    question: 'What could go wrong?',
    fullDescription: 'Analyzes liquidity pool depth, top holder wallet concentration, on-chain anomalies, and token unlock hazards.',
    icon: AlertTriangle
  },
  {
    stage: 'RED_TEAM',
    label: 'Red Team',
    question: 'Why might we be wrong?',
    fullDescription: 'Mounts an adversarial challenge to refute the bullish thesis, identifying structural vulnerabilities and exit traps.',
    icon: Flame
  },
  {
    stage: 'DECISION',
    label: 'Decision',
    question: 'What is the verdict?',
    fullDescription: 'Synthesizes all council perspectives into an actionable consensus verdict (BUY, HOLD, SELL, REJECT) with grounded rationale.',
    icon: Scale
  },
  {
    stage: 'RISK_GATE',
    label: 'Risk Gate',
    question: 'Deterministic safety check',
    fullDescription: 'Hard code-enforced safety boundary evaluating liquidity ($250k min), allocation (25% max), and fatal flaw refutations.',
    icon: Lock
  }
];

export const DeliberationFeed: React.FC<DeliberationFeedProps> = ({
  investigation,
  onViewEvidence
}) => {
  const { agentRuns, decision, timeline, stages } = investigation;
  const [selectedStage, setSelectedStage] = useState<CouncilStage | null>(null);
  const [showFullQuestions, setShowFullQuestions] = useState<boolean>(false);
  const [isExecutingPaperOrder, setIsExecutingPaperOrder] = useState(false);
  const [executionState, setExecutionState] = useState<any>(investigation.execution);

  const handleExecutePaperOrder = async () => {
    setIsExecutingPaperOrder(true);
    try {
      const res = await fetch('/api/trading/paper/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investigationId: investigation.id })
      });
      const data = await res.json();
      if (data.order) {
        setExecutionState({
          mode: 'PAPER',
          adapterSource: data.order.adapterSource,
          orderId: data.order.orderId,
          brokerOrderId: data.order.brokerOrderId,
          submittedAt: data.order.submittedAt,
          status: data.order.status,
          error: data.order.error
        });
      }
    } catch (err) {
      console.error('Failed to submit paper order', err);
    } finally {
      setIsExecutingPaperOrder(false);
    }
  };

  const getStageStatus = (stage: CouncilStage): CouncilStageStatus => {
    if (stages && stages[stage]) {
      return stages[stage].status;
    }
    // Fallback based on available outputs
    if (stage === 'DISCOVERY' && agentRuns['discovery']) return 'COMPLETED';
    if (stage === 'QUANT' && agentRuns['quant']) return agentRuns['quant'].failed ? 'FAILED' : 'COMPLETED';
    if (stage === 'INTELLIGENCE' && agentRuns['intelligence']) return agentRuns['intelligence'].failed ? 'FAILED' : 'COMPLETED';
    if (stage === 'RISK' && agentRuns['risk']) return agentRuns['risk'].failed ? 'FAILED' : 'COMPLETED';
    if (stage === 'RED_TEAM' && agentRuns['red_team']) return 'COMPLETED';
    if (stage === 'DECISION' && decision) return 'COMPLETED';
    if (stage === 'RISK_GATE' && decision) return decision.riskGateApproved ? 'COMPLETED' : 'FAILED';
    return 'PENDING';
  };

  const getVerdictBadge = (verdict: string, failed?: boolean) => {
    if (failed) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-[#ff3b5c] border border-rose-500/30">FAILED</span>;
    }
    if (verdict === 'BUY' || verdict === 'VALID' || verdict === 'OPPORTUNITY') {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20">{verdict}</span>;
    }
    if (verdict === 'REJECT' || verdict === 'DISPROVED') {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-[#ff3b5c] border border-rose-500/30">{verdict}</span>;
    }
    if (verdict === 'CAUTION' || verdict === 'WEAKENED') {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">{verdict}</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-[#9ca3af] border border-[#34333b]">{verdict}</span>;
  };

  const isRiskGateBlocked = decision && decision.conclusion === 'BUY' && !decision.riskGateApproved;

  const activeStageConfig = selectedStage ? STAGE_CONFIG.find(c => c.stage === selectedStage) : null;
  const activeStageState = selectedStage && stages ? stages[selectedStage] : null;

  return (
    <div className="space-y-2">

      {/* 1. Visible Deliberation Stage Stepper Pipeline */}
      <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#848388]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Visible Council Deliberation Pipeline
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFullQuestions(prev => !prev)}
              className="text-[11px] text-[#848388] hover:text-[#848388] font-semibold transition"
            >
              {showFullQuestions ? 'Compact View' : 'Show Full Prompts'}
            </button>
            <span className="text-[11px] font-mono text-[#2d3748]">
              {investigation.id} • {investigation.asset}
            </span>
          </div>
        </div>

        {/* 7-Stage Interactive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {STAGE_CONFIG.map(({ stage, label, question, icon: IconComponent }) => {
            const status = getStageStatus(stage);
            const isCompleted = status === 'COMPLETED';
            const isFailed = status === 'FAILED';
            const isRunning = status === 'RUNNING';
            const isSelected = selectedStage === stage;

            return (
              <button
                key={stage}
                type="button"
                onClick={() => setSelectedStage(prev => prev === stage ? null : stage)}
                title={`Click to inspect ${label} stage details: ${question}`}
                className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer group ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/50 shadow-md shadow-indigo-500/10'
                    : isCompleted
                    ? 'bg-emerald-950/20 border-[#00ff84]/20 hover:border-emerald-500/50'
                    : isFailed
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : isRunning
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                    : 'bg-[#1f1e23] border-[#28272e]/80 hover:border-[#34333b] opacity-70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <IconComponent className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-[#848388]' : isCompleted ? 'text-[#00ff84]' : isFailed ? 'text-[#ff3b5c]' : isRunning ? 'text-[#848388]' : 'text-[#2d3748]'
                      }`} />
                      <span className="text-xs font-bold text-white tracking-tight truncate">{label}</span>
                    </div>

                    {isCompleted ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[#00ff84] shrink-0" />
                    ) : isFailed ? (
                      <XCircle className="w-3.5 h-3.5 text-[#ff3b5c] shrink-0" />
                    ) : isRunning ? (
                      <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                    )}
                  </div>

                  <div className={`text-[11px] text-[#9ca3af] leading-snug transition-all ${
                    showFullQuestions ? 'line-clamp-none' : 'line-clamp-2'
                  }`}>
                    {question}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-[#28272e]/50 flex items-center justify-between text-[10px] text-[#2d3748]">
                  <span className="uppercase font-mono font-bold tracking-wider text-[9px]">
                    {status}
                  </span>
                  <span className="text-[#848388] group-hover:text-[#848388] font-medium">
                    {isSelected ? 'Hide ▲' : 'Details ▼'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Expanded Details Drawer */}
        {activeStageConfig && (
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-indigo-500/30 space-y-3 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#28272e]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-[#848388]">
                  <activeStageConfig.icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    {activeStageConfig.label} Stage Details
                    {getVerdictBadge(getStageStatus(activeStageConfig.stage))}
                  </h4>
                  <p className="text-xs text-[#848388] font-medium">
                    "{activeStageConfig.question}" — {activeStageConfig.fullDescription}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeStageState?.timestamp && (
                  <span className="text-[11px] font-mono text-[#848388]">
                    Logged: {new Date(activeStageState.timestamp).toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => setSelectedStage(null)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[#9ca3af] transition"
                >
                  Close ✕
                </button>
              </div>
            </div>

            {/* Stage Findings and Metrics */}
            <div className="text-xs text-slate-200 leading-relaxed">
              <strong className="text-[#848388] uppercase font-mono text-[10px] block mb-1">Stage Deliberation Output:</strong>
              <div className="p-3 rounded-lg bg-[#1f1e23] border border-[#28272e] text-slate-200">
                {activeStageState?.summary || activeStageConfig.fullDescription}
              </div>
            </div>

            {/* Direct Contextual Links */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="text-[11px] text-[#848388]">
                Status: <strong className="text-white font-mono">{getStageStatus(activeStageConfig.stage)}</strong>
              </div>

              {onViewEvidence && (
                <button
                  onClick={() => {
                    const cat = activeStageConfig.stage === 'INTELLIGENCE' ? 'NEWS' : activeStageConfig.stage === 'RISK' ? 'RISK' : 'MARKET';
                    onViewEvidence(cat);
                  }}
                  className="text-xs text-[#848388] hover:text-[#848388] font-semibold flex items-center gap-1"
                >
                  Inspect Related Evidence Records <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Phase 3: Claims for this stage */}
            {(() => {
              const stageClaims = (investigation.claims ?? []).filter(
                c => c.stage === activeStageConfig.stage
              );
              if (stageClaims.length === 0) return null;
              return (
                <div className="space-y-2 pt-2 border-t border-[#28272e]/50">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-[#848388] uppercase tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5 text-[#848388]" />
                    <span>Claims ({stageClaims.length}) — Verifiable Assertions from this Stage</span>
                  </div>
                  <div className="space-y-1.5">
                    {stageClaims.map(claim => (
                      <ClaimInspector
                        key={claim.id}
                        claim={claim}
                        evidence={investigation.evidence}
                        allClaims={investigation.claims ?? []}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Phase 3: Contradiction Matrix — shown when investigation has claims and is complete */}
        {(investigation.claims ?? []).length > 0 && investigation.status === 'COMPLETED' && (
          <ContradictionMatrix claims={investigation.claims ?? []} />
        )}

      </div>


      {/* 2. Council Final Verdict Banner */}
      {decision && (
        <div className={`p-6 rounded-lg border ${
          isRiskGateBlocked
            ? 'bg-gradient-to-r from-amber-950/40 via-[#1f1e23] to-[#1f1e23] border-amber-500/40 glow-redteam'
            : decision.conclusion === 'BUY'
            ? 'bg-gradient-to-r from-emerald-950/40 via-[#1f1e23] to-[#1f1e23] border-emerald-500/40 glow-bullish'
            : decision.conclusion === 'REJECT'
            ? 'bg-gradient-to-r from-rose-950/40 via-[#1f1e23] to-[#1f1e23] border-rose-500/40 glow-redteam'
            : 'bg-[#1f1e23] border-[#28272e]'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-mono text-[#848388] uppercase tracking-wider flex items-center gap-2">
                <span>Council Synthesis • ${investigation.asset}</span>
                {isRiskGateBlocked && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                    Safety Override
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <span className={`text-3xl font-extrabold tracking-tight ${
                  decision.conclusion === 'BUY' ? 'text-[#00ff84]' :
                  decision.conclusion === 'REJECT' ? 'text-[#ff3b5c]' :
                  'text-amber-400'
                }`}>
                  {decision.conclusion === 'BUY' ? '🟢 BUY' : decision.conclusion === 'REJECT' ? '🚫 REJECT' : '🟡 HOLD'}
                </span>

                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-[#9ca3af] font-medium">
                  Council Confidence: {decision.confidence}%
                </span>

                {executionState ? (
                  <span className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 font-medium ${
                    executionState.status === 'SUBMITTED' || executionState.status === 'FILLED'
                      ? 'bg-[#00ff84]/10 text-[#00ff84] border-[#00ff84]/20'
                      : executionState.status === 'BLOCKED'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-[#ff3b5c] border-rose-500/30'
                  }`}>
                    {executionState.status === 'SUBMITTED' || executionState.status === 'FILLED' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : executionState.status === 'BLOCKED' ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    Paper Order: {executionState.status}
                  </span>
                ) : decision.conclusion === 'BUY' && decision.riskGateApproved ? (
                  <button
                    onClick={handleExecutePaperOrder}
                    disabled={isExecutingPaperOrder}
                    className="text-xs px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1 shadow-md shadow-indigo-600/20 active:scale-95"
                  >
                    {isExecutingPaperOrder ? 'Submitting Order...' : 'Authorize Paper Order →'}
                  </button>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800/80 text-[#848388] border border-[#34333b] font-medium">
                    Paper Execution: NOT SUBMITTED
                  </span>
                )}
              </div>
            </div>

            {/* Opportunity vs Risk Score Meter */}
            <div className="flex items-center gap-2 bg-[#1f1e23] p-3.5 rounded-lg border border-[#28272e]">
              <div className="text-center">
                <div className="text-[10px] text-[#848388] uppercase font-semibold">Opportunity</div>
                <div className="text-lg font-bold text-[#848388]">{decision.opportunityScore}/100</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center">
                <div className="text-[10px] text-[#848388] uppercase font-semibold">Risk Score</div>
                <div className={`text-lg font-bold ${decision.riskScore > 70 ? 'text-[#ff3b5c]' : 'text-[#9ca3af]'}`}>
                  {decision.riskScore}/100
                </div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center">
                <div className="text-[10px] text-[#848388] uppercase font-semibold">Risk Gate</div>
                <div className={`text-xs font-bold mt-1 px-2.5 py-0.5 rounded ${
                  decision.riskGateApproved ? 'bg-[#00ff84]/10 text-[#00ff84]' : 'bg-rose-500/20 text-[#ff3b5c]'
                }`}>
                  {decision.riskGateApproved ? 'ALLOW' : 'BLOCKED'}
                </div>
              </div>
            </div>
          </div>

          {/* Prompt Rationale */}
          <div className="mt-4 pt-4 border-t border-[#28272e]/80 text-xs text-[#9ca3af] leading-relaxed">
            <strong className="text-white font-semibold">Council Rationale: </strong>
            {decision.rationale}
          </div>

          {/* Strongest Counterargument if present */}
          {decision.strongestCounterargument && (
            <div className="mt-2.5 text-xs text-amber-300 flex items-start gap-2 bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-200">Strongest Counterargument: </strong>
                <span>{decision.strongestCounterargument}</span>
              </div>
            </div>
          )}

          {/* Risk Gate Warning Banner if trade blocked */}
          {isRiskGateBlocked && (
            <div className="mt-3.5 p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-[#ff3b5c] space-y-1">
              <div className="font-bold text-[#ff3b5c] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#ff3b5c]" />
                Deterministic Risk Gate Blocked Execution:
              </div>
              <div className="pl-5 text-[#9ca3af]">
                Council reached a BUY verdict, but trade execution was halted because risk safety parameters were violated:
              </div>
              {decision.riskGateNotes?.map((note, i) => (
                <div key={i} className="pl-5 text-[#ff3b5c] font-semibold">• {note}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Structured Council Perspective Cards (Discovery, Quant, Intelligence, Risk, Red Team) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">

        {/* Discovery Agent Card */}
        {agentRuns['discovery'] && (
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <Search className="w-4 h-4 text-[#848388]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Discovery</h4>
                    <span className="text-[10px] text-[#2d3748]">What is happening?</span>
                  </div>
                </div>
                {getVerdictBadge(agentRuns['discovery'].verdict)}
              </div>

              <p className="text-xs text-[#9ca3af] leading-relaxed mt-2">
                {agentRuns['discovery'].summary}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-[#28272e]/60 flex items-center justify-between text-[11px] text-[#848388]">
              <span>Opp Score: <strong className="text-[#848388]">{agentRuns['discovery'].metrics?.opportunityScore}/100</strong></span>
              {onViewEvidence && (
                <button
                  onClick={() => onViewEvidence('MARKET')}
                  className="text-xs text-[#848388] hover:text-[#848388] flex items-center gap-1 font-semibold"
                >
                  View Market Data <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quant Agent Card */}
        {agentRuns['quant'] && (
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#00ff84]/8 border border-[#00ff84]/20">
                    <BarChart2 className="w-4 h-4 text-[#00ff84]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Quant Agent</h4>
                    <span className="text-[10px] text-[#2d3748]">What do numbers say?</span>
                  </div>
                </div>
                {getVerdictBadge(agentRuns['quant'].verdict, agentRuns['quant'].failed)}
              </div>

              <div className="grid grid-cols-3 gap-1.5 my-2.5 p-2 rounded-lg bg-[#1f1e23] border border-[#28272e] text-center text-[11px]">
                <div>
                  <span className="text-[10px] text-[#2d3748] block">Momentum</span>
                  <strong className="text-white font-mono">{agentRuns['quant'].metrics?.momentum ?? 50}/100</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#2d3748] block">RSI-14</span>
                  <strong className="text-white font-mono">{agentRuns['quant'].metrics?.rsi14 ?? 50}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#2d3748] block">RVOL</span>
                  <strong className="text-white font-mono">{agentRuns['quant'].metrics?.rvol ?? 1.0}x</strong>
                </div>
              </div>

              <p className="text-xs text-[#9ca3af] leading-relaxed">
                {agentRuns['quant'].summary}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-[#28272e]/60 flex items-center justify-between text-[11px] text-[#848388]">
              <span>Confidence: {agentRuns['quant'].confidence}%</span>
              {onViewEvidence && (
                <button
                  onClick={() => onViewEvidence('MARKET')}
                  className="text-xs text-[#00ff84] hover:text-[#00ff84] flex items-center gap-1 font-semibold"
                >
                  Inspect Math <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Intelligence Agent Card */}
        {agentRuns['intelligence'] && (
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <Globe className="w-4 h-4 text-[#00ff84]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Intelligence</h4>
                    <span className="text-[10px] text-[#2d3748]">What external news exists?</span>
                  </div>
                </div>
                {getVerdictBadge(agentRuns['intelligence'].verdict, agentRuns['intelligence'].failed)}
              </div>

              <p className="text-xs text-[#9ca3af] leading-relaxed mt-2">
                {agentRuns['intelligence'].summary}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-[#28272e]/60 flex items-center justify-between text-[11px] text-[#848388]">
              <span>Sources: {agentRuns['intelligence'].supportingEvidenceIds.length + agentRuns['intelligence'].contradictoryEvidenceIds.length}</span>
              {onViewEvidence && (
                <button
                  onClick={() => onViewEvidence('NEWS')}
                  className="text-xs text-[#00ff84] hover:text-[#00ff84] flex items-center gap-1 font-semibold"
                >
                  View News <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Risk Agent Card */}
        {agentRuns['risk'] && (
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Risk Agent</h4>
                    <span className="text-[10px] text-[#2d3748]">What could go wrong?</span>
                  </div>
                </div>
                {getVerdictBadge(agentRuns['risk'].verdict, agentRuns['risk'].failed)}
              </div>

              <div className="grid grid-cols-2 gap-2 my-2.5 p-2 rounded-lg bg-[#1f1e23] border border-[#28272e] text-center text-[11px]">
                <div>
                  <span className="text-[10px] text-[#2d3748] block">Risk Score</span>
                  <strong className={`font-mono ${Number(agentRuns['risk'].metrics?.compositeRiskScore) > 60 ? 'text-[#ff3b5c]' : 'text-white'}`}>
                    {agentRuns['risk'].metrics?.compositeRiskScore ?? 40}/100
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#2d3748] block">Top 10 Supply</span>
                  <strong className="text-white font-mono">{agentRuns['risk'].metrics?.top10HoldersPct ?? 35}%</strong>
                </div>
              </div>

              <p className="text-xs text-[#9ca3af] leading-relaxed">
                {agentRuns['risk'].summary}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-[#28272e]/60 flex items-center justify-between text-[11px] text-[#848388]">
              <span>Risks Flagged: {agentRuns['risk'].risks.length}</span>
              {onViewEvidence && (
                <button
                  onClick={() => onViewEvidence('RISK')}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                >
                  View Risks <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Red Team Agent Card */}
        {agentRuns['red_team'] && (
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#ff3b5c]/8 border border-rose-500/20">
                    <Flame className="w-4 h-4 text-[#ff3b5c]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Red Team</h4>
                    <span className="text-[10px] text-[#2d3748]">Why might we be wrong?</span>
                  </div>
                </div>
                {getVerdictBadge(agentRuns['red_team'].verdict)}
              </div>

              <p className="text-xs text-[#9ca3af] leading-relaxed mt-2">
                {agentRuns['red_team'].summary}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-[#28272e]/60 flex items-center justify-between text-[11px] text-[#848388]">
              <span>Thesis: <strong className="font-mono text-[#ff3b5c]">{agentRuns['red_team'].redTeamAttackDetails?.thesisStatus}</strong></span>
              {onViewEvidence && (
                <button
                  onClick={() => onViewEvidence('RISK')}
                  className="text-xs text-[#ff3b5c] hover:text-[#ff3b5c] flex items-center gap-1 font-semibold"
                >
                  Counter-Evidence <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* 4. Chronological Council Audit Trail */}
      <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e]">
        <h4 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#848388]" />
          Chronological Council Audit Trail ({investigation.id})
        </h4>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-slate-800/40">
          {timeline.map((event, idx) => (
            <div key={idx} className="pt-2 first:pt-0 flex items-start gap-3 text-xs">
              <span className="font-mono text-[#2d3748] shrink-0 text-[11px]">{event.timestamp}</span>
              <span className="font-mono text-[#848388] uppercase font-semibold shrink-0">[{event.agent}]</span>
              <span className="text-[#9ca3af] leading-relaxed">{event.message}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

