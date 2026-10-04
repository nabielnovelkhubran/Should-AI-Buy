'use client';
import React, { useState } from 'react';
import {
  Investigation,
  MarketSnapshot,
  AlpacaAccount,
  CandidateQueueStats,
  ScanResult
} from '@/lib/types';
import { PortfolioSnapshot, PaperPosition } from '@/lib/portfolio/types';
import { MonitoringCycleResult, MonitoredPositionRecord } from '@/lib/monitoring/types';
import { AutomationStatus } from '@/lib/automation/types';
import { CommandCenter } from './CommandCenter';
import { RedTeamSpotlight } from './RedTeamSpotlight';
import { useCurrency } from './CurrencyProvider';
import { AdversarialBattleCard } from './AdversarialBattleCard';
import { MultiFactorMatrix } from './MultiFactorMatrix';

interface CommandCenterViewProps {
  investigation: Investigation | null;
  snapshot: MarketSnapshot | null;
  portfolio: PortfolioSnapshot | null;
  monitoringResult: MonitoringCycleResult | null;
  automationStatus: AutomationStatus | null;
  discoveryStats: {
    scanResult?: ScanResult | null;
    queueStats?: CandidateQueueStats | null;
  };
  isLoading: boolean;
  onExecuteCommand: (command: string) => void;
  onNavigateTab: (tab: 'command' | 'discovery' | 'council' | 'evidence' | 'portfolio' | 'automation') => void;
  onRunMonitoringNow?: () => Promise<void>;
  onRunDiscoveryNow?: () => Promise<void>;
  onExecuteProtectiveExit?: (position: MonitoredPositionRecord) => Promise<void>;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  investigation,
  snapshot,
  portfolio,
  monitoringResult,
  automationStatus,
  discoveryStats,
  isLoading,
  onExecuteCommand,
  onNavigateTab,
  onRunMonitoringNow,
  onRunDiscoveryNow,
  onExecuteProtectiveExit
}) => {
  const { formatCurrency } = useCurrency();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<any>(null);
  const [runtimeLoading, setRuntimeLoading] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(() => Boolean(investigation));

  React.useEffect(() => {
    if (investigation || isLoading) {
      setShowDetails(true);
    }
  }, [investigation, isLoading]);

  const fetchRuntimeStatus = async () => {
    try {
      const res = await fetch('/api/agent/runtime');
      if (res.ok) {
        const data = await res.json();
        setRuntimeStatus(data.runtime);
      }
    } catch {}
  };

  React.useEffect(() => {
    fetchRuntimeStatus();
    const interval = setInterval(fetchRuntimeStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleRiskProfile = async (profile: 'STANDARD' | 'HIGH_RISK') => {
    setRuntimeLoading(true);
    try {
      const res = await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_RISK_PROFILE', riskProfile: profile })
      });
      if (res.ok) {
        const data = await res.json();
        setRuntimeStatus(data.runtime);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRuntimeLoading(false);
    }
  };

  const handleStartRuntime = async () => {
    setRuntimeLoading(true);
    try {
      const res = await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' })
      });
      if (res.ok) {
        const data = await res.json();
        setRuntimeStatus(data.runtime);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRuntimeLoading(false);
    }
  };

  const handleStopRuntime = async () => {
    setRuntimeLoading(true);
    try {
      const res = await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'STOP' })
      });
      if (res.ok) {
        const data = await res.json();
        setRuntimeStatus(data.runtime);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRuntimeLoading(false);
    }
  };

  const handleRunCycleNow = async () => {
    setRuntimeLoading(true);
    try {
      await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RUN_CYCLE' })
      });
      await fetchRuntimeStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setRuntimeLoading(false);
    }
  };


  // Derive Alerts / Attention Items
  const alerts: Array<{
    id: string;
    type: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    description: string;
    timestamp?: string;
    actionLabel?: string;
    actionTab?: 'command' | 'discovery' | 'council' | 'evidence' | 'portfolio' | 'automation';
    positionRecord?: MonitoredPositionRecord;
  }> = [];

  // 1. Check for Invalidated Positions (CRITICAL)
  if (monitoringResult?.monitoredPositions) {
    monitoringResult.monitoredPositions.forEach((pos) => {
      const sym = pos.position?.symbol || pos.health?.symbol || 'UNKNOWN';
      if (pos.health.status === 'INVALIDATED') {
        const topFinding = pos.health.findings[0]?.message || 'Thesis invalidation threshold breached.';
        alerts.push({
          id: `ALERT-INV-${sym}`,
          type: 'CRITICAL',
          title: `Thesis Invalidated: $${sym} (${pos.health.score}/100)`,
          description: `Protective exit — generated from thesis invalidation: ${topFinding}`,
          timestamp: pos.health.evaluatedAt,
          actionLabel: 'Execute Protective Exit',
          actionTab: 'portfolio',
          positionRecord: pos
        });
      } else if (pos.health.status === 'DEGRADED') {
        const topWarning = pos.health.findings[0]?.message || 'Thesis health degraded with warnings.';
        alerts.push({
          id: `ALERT-DEG-${sym}`,
          type: 'WARNING',
          title: `Thesis Degraded: $${sym} (${pos.health.score}/100)`,
          description: topWarning,
          timestamp: pos.health.evaluatedAt,
          actionLabel: 'Review Position',
          actionTab: 'portfolio'
        });
      }
    });
  }

  // 2. Check Portfolio Risk Warnings (WARNING)
  if (portfolio?.risk?.concentrationWarnings) {
    portfolio.risk.concentrationWarnings.forEach((warn: string, idx: number) => {
      alerts.push({
        id: `ALERT-PORT-${idx}`,
        type: 'WARNING',
        title: `Portfolio Risk Warning`,
        description: warn,
        actionLabel: 'View Portfolio',
        actionTab: 'portfolio'
      });
    });
  }

  // 3. Check Automation Failures (WARNING)
  if (automationStatus?.lastRun) {
    if (automationStatus.lastRun.DISCOVERY?.status === 'FAILED') {
      alerts.push({
        id: 'ALERT-AUTO-DISC-FAIL',
        type: 'WARNING',
        title: 'Automation Discovery Cycle Failed',
        description: automationStatus.lastRun.DISCOVERY.error || 'Discovery cycle encountered an error.',
        timestamp: automationStatus.lastRun.DISCOVERY.completedAt,
        actionLabel: 'Inspect Daemon',
        actionTab: 'automation'
      });
    }
    if (automationStatus.lastRun.MONITORING?.status === 'FAILED') {
      alerts.push({
        id: 'ALERT-AUTO-MON-FAIL',
        type: 'WARNING',
        title: 'Automation Thesis Monitoring Failed',
        description: automationStatus.lastRun.MONITORING.error || 'Monitoring cycle encountered an error.',
        timestamp: automationStatus.lastRun.MONITORING.completedAt,
        actionLabel: 'Inspect Daemon',
        actionTab: 'automation'
      });
    }
  }

  // 4. Check for High-Score Opportunity (INFO)
  if (discoveryStats.scanResult?.candidates && discoveryStats.scanResult.candidates.length > 0) {
    const topCand = discoveryStats.scanResult.candidates[0];
    if (topCand.score >= 80) {
      alerts.push({
        id: `ALERT-OPP-${topCand.symbol}`,
        type: 'INFO',
        title: `Top Opportunity Discovered: $${topCand.symbol} (Score: ${topCand.score}/100)`,
        description: `Nominated by scanner with momentum ${topCand.signals.momentum} and RVOL ${topCand.signals.rvol}x.`,
        actionLabel: 'Investigate Candidate',
        actionTab: 'discovery'
      });
    }
  }

  const isAutomationRunning = automationStatus?.schedulerStatus === 'RUNNING';
  const totalPositionsCount = portfolio?.positions?.length || 0;
  const healthyCount = monitoringResult?.healthyCount || 0;
  const invalidatedCount = monitoringResult?.invalidatedCount || 0;
  const degradedCount = monitoringResult?.degradedCount || 0;

  // Derive System Status Vitals
  const riskStatus: 'SAFE' | 'WARNING' | 'BLOCKED' =
    invalidatedCount > 0 || (portfolio?.risk?.concentrationWarnings?.length ?? 0) > 0
      ? (invalidatedCount > 0 ? 'BLOCKED' : 'WARNING')
      : 'SAFE';

  const handleExitClick = async (pos: MonitoredPositionRecord) => {
    if (!onExecuteProtectiveExit) return;
    const sym = pos.position?.symbol || pos.health?.symbol || 'UNKNOWN';
    setActionLoading(`exit-${sym}`);
    try {
      await onExecuteProtectiveExit(pos);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pt-2 sm:pt-4">
      {/* 1. HERO AUTONOMOUS COUNCIL COMMAND BAR */}
      <div>
        <CommandCenter onExecuteCommand={onExecuteCommand} isLoading={isLoading} />
      </div>

      {/* 2. PROGRESSIVE DISCLOSURE DRAWER: Live Engine Telemetry & Pipeline */}
      <div className="rounded-xl bg-[#17161d] border border-[#28272e] p-3.5 sm:p-4 transition-all duration-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left: Live Vitals Strip */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-sans tabular-nums">
            <span className="text-[11px] text-[#00ff84] font-semibold">PAPER ONLY</span>
            <span className="text-[#848388]">•</span>
            <span className={`text-[11px] font-semibold ${isAutomationRunning ? 'text-[#00ff84]' : 'text-[#848388]'}`}>
              AUTO: {isAutomationRunning ? 'RUNNING' : 'STOPPED'}
            </span>
            <span className="text-[#848388]">•</span>
            <span className={`text-[11px] font-semibold ${
              riskStatus === 'SAFE' ? 'text-[#00ff84]' : riskStatus === 'WARNING' ? 'text-amber-400' : 'text-[#ff3b5c]'
            }`}>
              RISK: {riskStatus}
            </span>
            <span className="text-[#848388]">•</span>
            <span className="text-[11px] text-[#d1d5db]">
              {totalPositionsCount} HOLDINGS
            </span>
            <span className="text-[#848388]">•</span>
            <span className="text-[11px] text-[#00ff84] font-bold">
              EQUITY: {formatCurrency(portfolio?.account?.equity || 100000)}
            </span>
            {alerts.length > 0 && (
              <>
                <span className="text-[#848388]">•</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-[#ff3b5c] border border-rose-500/30">
                  {alerts.length} ALERTS
                </span>
              </>
            )}
          </div>

          {/* Right: Toggle Button */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-sans font-medium transition cursor-pointer self-end sm:self-center ${
              showDetails
                ? 'bg-[#282733] text-white'
                : 'bg-[#1e1d26] text-[#848388] hover:bg-[#282733] hover:text-white'
            }`}
          >
            <span>{showDetails ? 'Hide Engine Details & Lifecycle' : 'Inspect Engine Details & Lifecycle'}</span>
            <svg
              className={`w-2.5 h-2.5 transition-transform duration-200 ${showDetails ? 'rotate-180 text-white' : 'text-[#848388]'}`}
              viewBox="0 0 10 6"
              fill="none"
            >
              <path d="M1 1.5L5 4.5L9 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Expanded Content */}
        {showDetails && (
          <div className="mt-5 pt-5 border-t border-[#23222a] space-y-6">
            {/* 2. ATTENTION REQUIRED / ALERT CENTER (Prioritized Warnings & Invalidation Actions) */}
      {alerts.length > 0 && (
        <div className="p-4 rounded-lg bg-[#14121a] border border-rose-900/40 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Attention Required ({alerts.length})
                <span className="text-[10px] text-[#ff3b5c] font-sans">
                  Action Recommended
                </span>
              </h3>
            </div>
            <span className="text-[11px] text-[#848388]">Prioritized by Severity</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition ${
                  alert.type === 'CRITICAL'
                    ? 'bg-rose-950/30 border-[#ff3b5c]/20/60 text-[#ff3b5c]'
                    : alert.type === 'WARNING'
                    ? 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                    : 'bg-indigo-950/20 border-indigo-800/50 text-indigo-200'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-sans font-bold uppercase ${
                      alert.type === 'CRITICAL' ? 'bg-rose-600 text-white' :
                      alert.type === 'WARNING' ? 'bg-amber-600 text-white' :
                      'bg-[#00ff84] text-black font-bold'
                    }`}>
                      {alert.type}
                    </span>
                    <span>{alert.title}</span>
                    {alert.timestamp && (
                      <span className="text-[10px] text-[#848388] font-sans tabular-nums font-normal">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#848388]">{alert.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {alert.positionRecord && alert.type === 'CRITICAL' && (
                    <button
                      onClick={() => handleExitClick(alert.positionRecord!)}
                      disabled={actionLoading === `exit-${alert.positionRecord.position?.symbol || alert.positionRecord.health?.symbol}`}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                    >
                      <span>{actionLoading === `exit-${alert.positionRecord.position?.symbol || alert.positionRecord.health?.symbol}` ? 'Submitting...' : 'Submit Exit'}</span>
                    </button>
                  )}
                  {alert.actionTab && (
                    <button
                      onClick={() => onNavigateTab(alert.actionTab!)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[#9ca3af] text-xs font-medium transition flex items-center gap-1"
                    >
                      <span>{alert.actionLabel || 'Inspect'}</span>
                      <span className="text-[#848388]">→</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. REASONING & EXECUTION LIFECYCLE PIPELINE VISUALIZER */}
      <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Autonomous Decision &amp; Execution Lifecycle
            </h3>
          </div>
          <span className="text-[11px] font-sans text-[#848388]">
            {investigation?.asset ? `Active Target: $${investigation.asset}` : 'Continuous Pipeline'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
          {/* Step 1: Discovered */}
          <button
            onClick={() => onNavigateTab('discovery')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#848388] group-hover:text-[#848388]">1. DISCOVERY</span>
            <span className="text-xs font-bold text-white mt-1">#1 Scanner</span>
            <span className="text-[10px] text-[#00ff84] font-sans font-medium mt-0.5">Top Score</span>
          </button>

          {/* Step 2: Queued */}
          <button
            onClick={() => onNavigateTab('discovery')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#848388] group-hover:text-[#848388]">2. QUEUED</span>
            <span className="text-xs font-bold text-white mt-1">{discoveryStats.queueStats?.queuedCount || 0} In Queue</span>
            <span className="text-[10px] text-[#848388] font-sans font-medium mt-0.5">Prioritized</span>
          </button>

          {/* Step 3: Council */}
          <button
            onClick={() => onNavigateTab('council')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#848388] group-hover:text-[#848388]">3. COUNCIL</span>
            <span className="text-xs font-bold text-white mt-1">7-Stage Delib</span>
            <span className="text-[10px] text-[#848388] font-sans font-medium mt-0.5">Multi-Agent</span>
          </button>

          {/* Step 4: Red Team */}
          <button
            onClick={() => onNavigateTab('council')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#848388] group-hover:text-[#848388]">4. RED TEAM</span>
            <span className="text-xs font-bold text-[#ff3b5c] mt-1">
              {investigation?.agentRuns?.['red_team'] ? 'CHALLENGED' : 'ADVERSARIAL'}
            </span>
            <span className="text-[10px] text-[#ff3b5c] font-sans font-medium mt-0.5">Fatal Flaw</span>
          </button>

          {/* Step 5: Verdict */}
          <button
            onClick={() => onNavigateTab('council')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#848388] group-hover:text-[#848388]">5. VERDICT</span>
            <span className={`text-xs font-bold mt-1 ${
              investigation?.decision?.conclusion === 'BUY' ? 'text-[#00ff84]' :
              investigation?.decision?.conclusion === 'SELL' ? 'text-[#ff3b5c]' :
              investigation?.decision?.conclusion === 'HOLD' ? 'text-amber-400' : 'text-[#9ca3af]'
            }`}>
              {investigation?.decision?.conclusion || 'SYNTHESIS'}
            </span>
            <span className="text-[10px] text-[#848388] font-sans font-medium mt-0.5">
              {investigation?.decision?.confidence ? `${investigation.decision.confidence}% Conf` : 'Pending'}
            </span>
          </button>

          {/* Step 6: Risk Gate */}
          <button
            onClick={() => onNavigateTab('portfolio')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#848388] group-hover:text-[#848388]">6. RISK GATE</span>
            <span className={`text-xs font-bold mt-1 ${
              investigation?.decision?.riskGateApproved ? 'text-[#00ff84]' : 'text-[#9ca3af]'
            }`}>
              {investigation?.decision?.riskGateApproved ? 'APPROVED' : 'EVALUATED'}
            </span>
            <span className="text-[10px] text-[#848388] font-sans font-medium mt-0.5">Authoritative</span>
          </button>

          {/* Step 7: Paper Order */}
          <button
            onClick={() => onNavigateTab('portfolio')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#848388] group-hover:text-[#848388]">7. PAPER ORDER</span>
            <span className="text-xs font-bold text-white mt-1">
              {portfolio?.openOrders?.length ? `${portfolio.openOrders.length} Orders` : 'Paper Fill'}
            </span>
            <span className="text-[10px] text-[#00ff84] font-sans font-medium mt-0.5">Idempotent</span>
          </button>

          {/* Step 8: Thesis Monitor */}
          <button
            onClick={() => onNavigateTab('portfolio')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#848388] group-hover:text-[#848388]">8. THESIS MONITOR</span>
            <span className="text-xs font-bold text-[#00ff84] mt-1">
              {healthyCount} Healthy
            </span>
            <span className="text-[10px] text-[#848388] font-sans font-medium mt-0.5">Auto-Protect</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN WORKSPACE SPLIT (Left: Opportunity & Deliberation; Right: Portfolio & Telemetry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* LEFT COLUMN: Active Investigation Spotlight & Adversarial Debate (7 Cols) */}
        <div className="lg:col-span-7 space-y-2">
          {/* Active Investigation Spotlight Card */}
          {investigation && investigation.status !== 'FAILED' ? (
            <div className="p-5 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#848388] uppercase tracking-wider">
                      Active Investigation Spotlight
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-[#9ca3af] font-sans">
                      {investigation.id}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    {investigation.command}
                  </h2>
                </div>

                <div className="flex flex-col items-end">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold font-sans ${
                    investigation.decision?.conclusion === 'BUY' ? 'bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20' :
                    investigation.decision?.conclusion === 'SELL' ? 'bg-rose-500/20 text-[#ff3b5c] border border-rose-500/30' :
                    investigation.decision?.conclusion === 'HOLD' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-slate-800 text-[#9ca3af]'
                  }`}>
                    VERDICT: {investigation.decision?.conclusion || 'PENDING'}
                  </span>
                  {investigation.decision?.confidence && (
                    <span className="text-[11px] text-[#848388] font-sans tabular-nums mt-1">
                      {investigation.decision.confidence}% Confidence
                    </span>
                  )}
                </div>
              </div>

              {/* Red Team Challenge Inline Summary */}
              {investigation.agentRuns?.['red_team'] && (
                <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[#ff3b5c] font-bold">
                    <span>
                      Red Team Adversarial Assessment
                    </span>
                    <span className="font-sans font-bold text-[10px] text-[#ff3b5c]">
                      THESIS {investigation.agentRuns['red_team'].verdict || 'CHALLENGED'}
                    </span>
                  </div>
                  <p className="text-[#9ca3af] text-[11px] leading-relaxed">
                    {investigation.agentRuns['red_team'].summary}
                  </p>
                </div>
              )}

              {/* Reasoning Metrics & Evidence Link */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-sans tabular-nums">
                <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
                  <span className="text-[10px] text-[#848388] block">Opportunity</span>
                  <span className="text-sm font-bold text-white">
                    {investigation.snapshot?.momentumScore || 75}/100
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
                  <span className="text-[10px] text-[#848388] block">Claims Evaluated</span>
                  <span className="text-sm font-bold text-[#848388]">
                    {investigation.claims?.length || 0} claims
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
                  <span className="text-[10px] text-[#848388] block">Evidence Items</span>
                  <span className="text-sm font-bold text-[#00ff84]">
                    {investigation.evidence?.length || 0} items
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#28272e]">
                <button
                  onClick={() => onNavigateTab('evidence')}
                  className="text-xs font-semibold text-[#848388] hover:underline flex items-center gap-1"
                >
                  <span>Explore Claims & Provenance Graph</span>
                  <span className="text-xs">→</span>
                </button>
                <button
                  onClick={() => onNavigateTab('council')}
                  className="text-xs font-semibold text-[#9ca3af] hover:text-white flex items-center gap-1"
                >
                  <span>Open Full Council Deliberation Feed</span>
                  <span className="text-xs">→</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AdversarialBattleCard
                symbol="BTC"
                opportunityScore={74}
                consensusVerdict="BUY"
                confidenceScore={76}
                bullThesis={{
                  summary: 'Quantitative trend acceleration supported by multi-timeframe ROC-3 expansion and steady institutional orderbook accumulation.',
                  targetPrice: 82500,
                  expectedR: 2.85,
                  momentumScore: 78,
                  volumeSurge: '2.4x baseline RVOL',
                  catalysts: ['Institutional orderbook accumulation', 'Ascending consolidation structure', 'Wilder RSI in constructive band (54.2)']
                }}
                redTeamAttack={{
                  summary: 'Elevated overhead supply cluster near $78.2k presents rejection risk. Spread widening could induce slippage.',
                  invalidationPrice: 74200,
                  vulnerabilities: ['Overhead supply liquidity sweep', 'Volatility cluster above 60% annualized', 'Potential liquidity exhaustion on lower timeframe'],
                  riskScore: 38,
                  vetoTriggered: false
                }}
              />
              <MultiFactorMatrix
                symbol="BTC"
                momentumScore={78}
                rsi={54.2}
                rvol={2.4}
                volatility={48.5}
                spreadBps={18.4}
                opportunityScore={74}
              />
            </div>
          )}
        </div>

                {/* RIGHT COLUMN: Quick Domain Status & Shortcuts (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Quick Portfolio Status */}
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#848388] uppercase tracking-wider">
                Portfolio Status
              </span>
              <button
                onClick={() => onNavigateTab('portfolio')}
                className="text-xs text-[#00ff84] hover:underline font-semibold cursor-pointer"
              >
                Full Ledger →
              </button>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-white tabular-nums">
                {totalPositionsCount} Open {totalPositionsCount === 1 ? 'Holding' : 'Holdings'}
              </span>
              <span className="text-xs text-[#848388] tabular-nums">
                Equity: <strong className="text-white">{formatCurrency(portfolio?.account?.equity || 100000)}</strong>
              </span>
            </div>
            {invalidatedCount > 0 ? (
              <div className="p-2 rounded bg-rose-950/30 border border-rose-900/40 text-[11px] text-[#ff3b5c] font-medium flex items-center justify-between">
                <span>{invalidatedCount} position requires protective exit</span>
                <button
                  onClick={() => onNavigateTab('portfolio')}
                  className="text-white underline text-[10px] font-bold cursor-pointer"
                >
                  Review
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-[#848388]">
                {healthyCount} healthy holdings monitored in continuous thesis loop.
              </div>
            )}
          </div>

          {/* Quick Automation Daemon Status */}
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#848388] uppercase tracking-wider">
                Automation Daemon
              </span>
              <button
                onClick={() => onNavigateTab('automation')}
                className="text-xs text-[#00ff84] hover:underline font-semibold cursor-pointer"
              >
                Daemon Controls →
              </button>
            </div>
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className={`font-bold ${isAutomationRunning ? 'text-[#00ff84]' : 'text-[#848388]'}`}>
                {isAutomationRunning ? '● SCHEDULER ACTIVE' : '○ SCHEDULER PAUSED'}
              </span>
              <span className="text-[#848388]">
                {discoveryStats.queueStats?.queuedCount || 0} candidates in queue
              </span>
            </div>
            {automationStatus?.nextRun?.DISCOVERY && (
              <div className="text-[10px] text-[#848388] tabular-nums">
                Next Discovery Cycle: {new Date(automationStatus.nextRun.DISCOVERY).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>
          </div>
        )}
      </div>
    </div>
  );
};
