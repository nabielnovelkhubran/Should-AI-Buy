'use client';
import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Zap,
  Activity,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Play,
  CheckCircle2,
  DollarSign,
  PieChart,
  Layers,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Flame
} from 'lucide-react';
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
    <div className="space-y-2">
      {/* 1. SYSTEM OVERVIEW HUD (High-Level Vitals) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Environment */}
        <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2d3748]">Trading Mode</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-mono font-bold text-[#00ff84]">PAPER ONLY</span>
          </div>
          <span className="text-[10px] text-[#2d3748] mt-1 truncate">Alpaca Paper v2</span>
        </div>

        {/* Automation Status */}
        <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2d3748]">Automation</span>
            <Cpu className="w-3.5 h-3.5 text-[#2d3748]" />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${isAutomationRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className={`text-sm font-mono font-bold ${isAutomationRunning ? 'text-[#00ff84]' : 'text-[#848388]'}`}>
              {isAutomationRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('automation')}
            className="text-[10px] text-[#848388] hover:underline mt-1 text-left"
          >
            Manage Daemon →
          </button>
        </div>

        {/* Discovery Vital */}
        <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2d3748]">Discovery Queue</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-mono font-bold text-white mt-1">
            {discoveryStats.queueStats?.queuedCount || 0} queued
          </div>
          <span className="text-[10px] text-[#2d3748] mt-1">
            {discoveryStats.scanResult?.candidates?.length || 0} candidates found
          </span>
        </div>

        {/* Thesis Health Vital */}
        <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2d3748]">Thesis Health</span>
            <Activity className="w-3.5 h-3.5 text-[#00ff84]" />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm font-mono font-bold text-[#00ff84]">{healthyCount}H</span>
            {degradedCount > 0 && <span className="text-sm font-mono font-bold text-amber-400">{degradedCount}D</span>}
            {invalidatedCount > 0 && <span className="text-sm font-mono font-bold text-[#ff3b5c]">{invalidatedCount}Inv</span>}
          </div>
          <span className="text-[10px] text-[#2d3748] mt-1">
            {totalPositionsCount} active holdings
          </span>
        </div>

        {/* Risk State Vital */}
        <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2d3748]">Risk Gate</span>
            <ShieldAlert className="w-3.5 h-3.5 text-[#848388]" />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
              riskStatus === 'SAFE'
                ? 'bg-[#00ff84]/8 text-[#00ff84] border border-[#00ff84]/20'
                : riskStatus === 'WARNING'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-[#ff3b5c]/8 text-[#ff3b5c] border border-rose-500/20'
            }`}>
              {riskStatus}
            </span>
          </div>
          <span className="text-[10px] text-[#2d3748] mt-1 truncate">
            {riskStatus === 'SAFE' ? 'Hard limits verified' : `${alerts.length} active alerts`}
          </span>
        </div>

        {/* Portfolio Equity Vital */}
        <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2d3748]">Total Equity</span>
            <DollarSign className="w-3.5 h-3.5 text-[#2d3748]" />
          </div>
          <div className="text-sm font-mono font-bold text-white mt-1">
            {formatCurrency(portfolio?.account?.equity || 100000)}
          </div>
          <span className="text-[10px] text-[#2d3748] mt-1">
            Cash: {formatCurrency(portfolio?.account?.cash || 100000)}
          </span>
        </div>
      </div>

      {/* 2. ATTENTION REQUIRED / ALERT CENTER (Prioritized Warnings & Invalidation Actions) */}
      {alerts.length > 0 && (
        <div className="p-4 rounded-lg bg-[#14121a] border border-rose-900/40 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#ff3b5c] animate-pulse" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Attention Required ({alerts.length})
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-[#ff3b5c] font-mono font-normal">
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
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                      alert.type === 'CRITICAL' ? 'bg-rose-600 text-white' :
                      alert.type === 'WARNING' ? 'bg-amber-600 text-white' :
                      'bg-[#00ff84] text-black font-bold'
                    }`}>
                      {alert.type}
                    </span>
                    <span>{alert.title}</span>
                    {alert.timestamp && (
                      <span className="text-[10px] text-[#2d3748] font-mono font-normal">
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
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{actionLoading === `exit-${alert.positionRecord.position?.symbol || alert.positionRecord.health?.symbol}` ? 'Submitting...' : 'Submit Exit'}</span>
                    </button>
                  )}
                  {alert.actionTab && (
                    <button
                      onClick={() => onNavigateTab(alert.actionTab!)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[#9ca3af] text-xs font-medium transition flex items-center gap-1"
                    >
                      <span>{alert.actionLabel || 'Inspect'}</span>
                      <ChevronRight className="w-3 h-3 text-[#2d3748]" />
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
            <Layers className="w-4 h-4 text-[#848388]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Autonomous Decision & Execution Lifecycle
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#2d3748]">
            {investigation?.asset ? `Active Target: $${investigation.asset}` : 'Continuous Pipeline'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
          {/* Step 1: Discovered */}
          <button
            onClick={() => onNavigateTab('discovery')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#2d3748] group-hover:text-[#848388]">1. DISCOVERY</span>
            <span className="text-xs font-bold text-white mt-1">#1 Scanner</span>
            <span className="text-[10px] text-[#00ff84] font-mono mt-0.5">Top Score</span>
          </button>

          {/* Step 2: Queued */}
          <button
            onClick={() => onNavigateTab('discovery')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#2d3748] group-hover:text-[#848388]">2. QUEUED</span>
            <span className="text-xs font-bold text-white mt-1">{discoveryStats.queueStats?.queuedCount || 0} In Queue</span>
            <span className="text-[10px] text-[#848388] font-mono mt-0.5">Prioritized</span>
          </button>

          {/* Step 3: Council */}
          <button
            onClick={() => onNavigateTab('council')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#2d3748] group-hover:text-[#848388]">3. COUNCIL</span>
            <span className="text-xs font-bold text-white mt-1">7-Stage Delib</span>
            <span className="text-[10px] text-[#848388] font-mono mt-0.5">Multi-Agent</span>
          </button>

          {/* Step 4: Red Team */}
          <button
            onClick={() => onNavigateTab('council')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#2d3748] group-hover:text-[#848388]">4. RED TEAM</span>
            <span className="text-xs font-bold text-[#ff3b5c] mt-1">
              {investigation?.agentRuns?.['red_team'] ? 'CHALLENGED' : 'ADVERSARIAL'}
            </span>
            <span className="text-[10px] text-[#ff3b5c] font-mono mt-0.5">Fatal Flaw</span>
          </button>

          {/* Step 5: Verdict */}
          <button
            onClick={() => onNavigateTab('council')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#2d3748] group-hover:text-[#848388]">5. VERDICT</span>
            <span className={`text-xs font-bold mt-1 ${
              investigation?.decision?.conclusion === 'BUY' ? 'text-[#00ff84]' :
              investigation?.decision?.conclusion === 'SELL' ? 'text-[#ff3b5c]' :
              investigation?.decision?.conclusion === 'HOLD' ? 'text-amber-400' : 'text-[#9ca3af]'
            }`}>
              {investigation?.decision?.conclusion || 'SYNTHESIS'}
            </span>
            <span className="text-[10px] text-[#848388] font-mono mt-0.5">
              {investigation?.decision?.confidence ? `${investigation.decision.confidence}% Conf` : 'Pending'}
            </span>
          </button>

          {/* Step 6: Risk Gate */}
          <button
            onClick={() => onNavigateTab('portfolio')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#2d3748] group-hover:text-[#848388]">6. RISK GATE</span>
            <span className={`text-xs font-bold mt-1 ${
              investigation?.decision?.riskGateApproved ? 'text-[#00ff84]' : 'text-[#9ca3af]'
            }`}>
              {investigation?.decision?.riskGateApproved ? 'APPROVED' : 'EVALUATED'}
            </span>
            <span className="text-[10px] text-[#848388] font-mono mt-0.5">Authoritative</span>
          </button>

          {/* Step 7: Paper Order */}
          <button
            onClick={() => onNavigateTab('portfolio')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#2d3748] group-hover:text-[#848388]">7. PAPER ORDER</span>
            <span className="text-xs font-bold text-white mt-1">
              {portfolio?.openOrders?.length ? `${portfolio.openOrders.length} Orders` : 'Paper Fill'}
            </span>
            <span className="text-[10px] text-[#00ff84] font-mono mt-0.5">Idempotent</span>
          </button>

          {/* Step 8: Thesis Monitor */}
          <button
            onClick={() => onNavigateTab('portfolio')}
            className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] hover:border-indigo-500/50 transition flex flex-col items-center justify-center group"
          >
            <span className="text-[9px] font-bold text-[#2d3748] group-hover:text-[#848388]">8. THESIS MONITOR</span>
            <span className="text-xs font-bold text-[#00ff84] mt-1">
              {healthyCount} Healthy
            </span>
            <span className="text-[10px] text-[#848388] font-mono mt-0.5">Auto-Protect</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN WORKSPACE SPLIT (Left: Opportunity & Deliberation; Right: Portfolio & Telemetry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* LEFT COLUMN: Manual Input Bar & Active Deliberation Spotlight (7 Cols) */}
        <div className="lg:col-span-7 space-y-2">
          {/* Quick Investigation Input Bar */}
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#848388] uppercase tracking-wider">
                Direct Council Query & Command Input
              </h3>
              <span className="text-[11px] text-[#848388] font-semibold">24/7 Deliberation</span>
            </div>
            <CommandCenter onExecuteCommand={onExecuteCommand} isLoading={isLoading} />
          </div>

          {/* Active Investigation Spotlight Card */}
          {investigation && investigation.status !== 'FAILED' ? (
            <div className="p-5 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#848388] uppercase tracking-wider">
                      Active Investigation Spotlight
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-[#9ca3af] font-mono">
                      {investigation.id}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    {investigation.command}
                  </h2>
                </div>

                <div className="flex flex-col items-end">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold font-mono ${
                    investigation.decision?.conclusion === 'BUY' ? 'bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20' :
                    investigation.decision?.conclusion === 'SELL' ? 'bg-rose-500/20 text-[#ff3b5c] border border-rose-500/30' :
                    investigation.decision?.conclusion === 'HOLD' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-slate-800 text-[#9ca3af]'
                  }`}>
                    VERDICT: {investigation.decision?.conclusion || 'PENDING'}
                  </span>
                  {investigation.decision?.confidence && (
                    <span className="text-[11px] text-[#848388] font-mono mt-1">
                      {investigation.decision.confidence}% Confidence
                    </span>
                  )}
                </div>
              </div>

              {/* Red Team Challenge Inline Summary */}
              {investigation.agentRuns?.['red_team'] && (
                <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[#ff3b5c] font-bold">
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-[#ff3b5c]" />
                      Red Team Adversarial Assessment
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-900/50">
                      THESIS {investigation.agentRuns['red_team'].verdict || 'CHALLENGED'}
                    </span>
                  </div>
                  <p className="text-[#9ca3af] text-[11px] leading-relaxed">
                    {investigation.agentRuns['red_team'].summary}
                  </p>
                </div>
              )}

              {/* Reasoning Metrics & Evidence Link */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
                  <span className="text-[10px] text-[#2d3748] block">Opportunity</span>
                  <span className="text-sm font-bold text-white">
                    {investigation.snapshot?.momentumScore || 75}/100
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
                  <span className="text-[10px] text-[#2d3748] block">Claims Evaluated</span>
                  <span className="text-sm font-bold text-[#848388]">
                    {investigation.claims?.length || 0} claims
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
                  <span className="text-[10px] text-[#2d3748] block">Evidence Items</span>
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
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onNavigateTab('council')}
                  className="text-xs font-semibold text-[#9ca3af] hover:text-white flex items-center gap-1"
                >
                  <span>Open Full Council Deliberation Feed</span>
                  <ChevronRight className="w-3.5 h-3.5" />
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

        {/* RIGHT COLUMN: Active Holdings & Thesis Health + Automation Quick-HUD (5 Cols) */}
        <div className="lg:col-span-5 space-y-2">
          {/* Active Positions & Live Thesis Health Card */}
          <div className="p-5 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00ff84]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Paper Holdings & Thesis Health
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('portfolio')}
                className="text-xs text-[#848388] hover:underline"
              >
                Portfolio →
              </button>
            </div>

            {portfolio?.positions && portfolio.positions.length > 0 ? (
              <div className="space-y-3">
                {portfolio.positions.map((pos) => {
                  const monitored = monitoringResult?.monitoredPositions?.find(
                    (m) => (m.position?.symbol || m.health?.symbol) === pos.symbol
                  );
                  const isInv = monitored?.health?.status === 'INVALIDATED';
                  const isDeg = monitored?.health?.status === 'DEGRADED';

                  return (
                    <div
                      key={pos.symbol}
                      className={`p-3.5 rounded-lg border space-y-2 transition ${
                        isInv
                          ? 'bg-rose-950/20 border-[#ff3b5c]/20/60'
                          : isDeg
                          ? 'bg-amber-950/20 border-amber-800/50'
                          : 'bg-[#1f1e23] border-[#28272e]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">${pos.symbol}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-[#9ca3af] uppercase">
                            {pos.side}
                          </span>
                          <span className="text-[11px] text-[#848388] font-mono">
                            {pos.quantity} units
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isInv
                              ? 'bg-rose-500/20 text-[#ff3b5c]'
                              : isDeg
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-[#00ff84]/10 text-[#00ff84]'
                          }`}>
                            {monitored?.health?.status || 'HEALTHY'} {monitored?.health?.score ? `(${monitored.health.score})` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#848388]">
                          Mkt Value: {formatCurrency(pos.marketValue)}
                        </span>
                        <span className={`font-bold ${pos.unrealizedPnl >= 0 ? 'text-[#00ff84]' : 'text-[#ff3b5c]'}`}>
                          {pos.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPnl)} ({pos.unrealizedPnlPercent.toFixed(2)}%)
                        </span>
                      </div>

                      {/* Health Progress Bar */}
                      {monitored?.health && (
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isInv ? 'bg-rose-500' : isDeg ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.max(5, monitored.health.score)}%` }}
                          />
                        </div>
                      )}

                      {/* Direct Invalidation Action affordance */}
                      {isInv && monitored && (
                        <div className="pt-1 flex items-center justify-between border-t border-rose-900/40">
                          <span className="text-[10px] text-[#ff3b5c]">Protective exit — generated from thesis invalidation</span>
                          <button
                            onClick={() => handleExitClick(monitored)}
                            disabled={actionLoading === `exit-${pos.symbol}`}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition disabled:opacity-50"
                          >
                            {actionLoading === `exit-${pos.symbol}` ? 'Executing...' : 'Submit Exit'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-lg bg-[#1f1e23] border border-[#28272e]/80 text-center space-y-1">
                <div className="text-xs font-bold text-[#9ca3af]">No Open Paper Positions</div>
                <p className="text-[11px] text-[#2d3748]">
                  Positions will appear here automatically when Council decisions pass the Risk Gate and execute.
                </p>
              </div>
            )}
          </div>

          {/* Automation Daemon Quick-HUD Card */}
          <div className="p-5 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#848388]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Automation Quick Telemetry
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isAutomationRunning ? 'bg-[#00ff84]/10 text-[#00ff84]' : 'bg-slate-800 text-[#848388]'
              }`}>
                {isAutomationRunning ? 'RUNNING' : 'PAUSED'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-1">
                <span className="text-[10px] text-[#2d3748] block">Discovery Next</span>
                <span className="text-xs text-slate-200">
                  {automationStatus?.nextRun?.DISCOVERY ? new Date(automationStatus.nextRun.DISCOVERY).toLocaleTimeString() : 'Manual Only'}
                </span>
                <button
                  onClick={() => onRunDiscoveryNow?.()}
                  className="text-[10px] text-[#848388] hover:underline block pt-0.5"
                >
                  Trigger Now →
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-1">
                <span className="text-[10px] text-[#2d3748] block">Monitoring Next</span>
                <span className="text-xs text-slate-200">
                  {automationStatus?.nextRun?.MONITORING ? new Date(automationStatus.nextRun.MONITORING).toLocaleTimeString() : 'Manual Only'}
                </span>
                <button
                  onClick={() => onRunMonitoringNow?.()}
                  className="text-[10px] text-[#00ff84] hover:underline block pt-0.5"
                >
                  Trigger Now →
                </button>
              </div>
            </div>

            {/* Recent Audit Event Pill */}
            {automationStatus?.auditTrail && automationStatus.auditTrail.length > 0 && (
              <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e] text-[11px] font-mono text-[#848388] flex items-center justify-between">
                <span className="truncate pr-2">
                  Last Event: {automationStatus.auditTrail[0].message}
                </span>
                <button
                  onClick={() => onNavigateTab('automation')}
                  className="text-[#848388] shrink-0 hover:underline"
                >
                  Audit Log →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
