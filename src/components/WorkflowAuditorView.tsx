'use client';
import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Cpu,
  RefreshCw,
  Search,
  Activity,
  Layers,
  FileText,
  Sliders,
  ExternalLink,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { WorkflowAuditResult, WorkflowAuditFinding, WorkflowAuditStageCheck } from '../lib/audit/types';
import { AlphaWaterfallChart } from './AlphaWaterfallChart';

export const WorkflowAuditorView: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<'REAL_PAPER' | 'SIMULATION'>('REAL_PAPER');
  const [audits, setAudits] = useState<WorkflowAuditResult[]>([]);
  const [latestAudit, setLatestAudit] = useState<WorkflowAuditResult | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<{
    totalPnL: number;
    totalR: number;
    winRate: number;
    completedTrades: number;
    currentEquity: number;
  }>({
    totalPnL: 3132.28,
    totalR: 3.25,
    winRate: 69.2,
    completedTrades: 8,
    currentEquity: 103132.28
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('SUCCESSFUL_BUY');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAudits = async (isBackground: boolean = false) => {
    if (!isBackground) setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/diagnostics/workflow?mode=${selectedMode}&limit=20&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAudits(data.audits || []);
          setLatestAudit(data.latest || (data.audits && data.audits[0]) || null);
          if (data.metrics) {
            setLiveMetrics(data.metrics);
          }
        }
      }
    } catch (err: any) {
      if (!isBackground) setErrorMessage(err?.message || 'Failed to fetch audit history.');
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits(false);
    const interval = setInterval(() => {
      fetchAudits(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedMode]);

  const handleAuditRealCycle = async () => {
    setIsAuditing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/diagnostics/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'AUDIT_REAL_CYCLE' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audit) {
          setLatestAudit(data.audit);
          setAudits(prev => [data.audit, ...prev.filter(a => a.auditId !== data.audit.auditId)]);
        }
      }
      await fetchAudits(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Real cycle audit failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleAuditSimulation = async () => {
    setIsAuditing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/diagnostics/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'AUDIT_SIMULATION', scenario: selectedScenario })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audit) {
          setLatestAudit(data.audit);
          setAudits(prev => [data.audit, ...prev.filter(a => a.auditId !== data.audit.auditId)]);
        }
      }
      await fetchAudits(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Simulation audit failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'PASS':
        return <span className="px-3 py-1 rounded-full bg-[#00ff84]/8 text-[#00ff84] border border-[#00ff84]/20 text-xs font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> PASS</span>;
      case 'WARN':
        return <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> WARN</span>;
      case 'ANOMALY':
        return <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> ANOMALY</span>;
      case 'ERROR':
        return <span className="px-3 py-1 rounded-full bg-[#ff3b5c]/8 text-[#ff3b5c] border border-rose-500/30 text-xs font-bold flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> ERROR</span>;
      default:
        return <span className="px-3 py-1 rounded-full bg-slate-800 text-[#848388] border border-[#34333b] text-xs font-bold">{verdict}</span>;
    }
  };

  const getStageStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <span className="text-[#00ff84] font-bold text-xs">✓ PASS</span>;
      case 'WARN':
        return <span className="text-amber-400 font-bold text-xs">▲ WARN</span>;
      case 'ANOMALY':
        return <span className="text-orange-400 font-bold text-xs">⚠ ANOMALY</span>;
      case 'ERROR':
        return <span className="text-[#ff3b5c] font-bold text-xs">✕ ERROR</span>;
      case 'NOT_REACHED':
      default:
        return <span className="text-[#2d3748] font-semibold text-xs">— NOT REACHED</span>;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded bg-rose-500/20 text-[#ff3b5c] border border-rose-500/40 text-[10px] font-bold">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[10px] font-bold">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-700 text-[#9ca3af] text-[10px] font-semibold">INFO</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-2">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 bg-[#1f1e23] p-5 rounded-lg border border-[#28272e] backdrop-blur">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Independent AI Workflow Auditor
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-[#00ff84] border border-cyan-500/30 font-semibold">
                  Featherless Forensic Layer
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/30 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff84] animate-pulse" />
                  LIVE RUNTIME SYNCED
                </span>
              </h2>
              <p className="text-xs text-[#848388]">
                Read-only forensic verification of deterministic rules, evidence sufficiency, and broker reconciliation.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Toggle & Refresh */}
        <div className="flex items-center gap-2">
          <div className="bg-[#1f1e23] p-1 rounded-lg border border-[#28272e] flex items-center gap-1">
            <button
              onClick={() => setSelectedMode('REAL_PAPER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedMode === 'REAL_PAPER'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-[#848388] hover:text-white'
              }`}
            >
              REAL PAPER AUDIT
            </button>
            <button
              onClick={() => setSelectedMode('SIMULATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedMode === 'SIMULATION'
                  ? 'bg-[#00ff84] text-black font-bold shadow-sm'
                  : 'text-[#848388] hover:text-white'
              }`}
            >
              SIMULATION AUDIT
            </button>
          </div>

          <button
            onClick={() => fetchAudits(false)}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-[#9ca3af] rounded-lg transition border border-[#34333b]"
            title="Refresh Audits"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00ff84]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-[#ff3b5c]/8 border border-[#ff3b5c]/20 text-[#ff3b5c] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#ff3b5c] shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-[#ff3b5c] hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Realized Alpha Expectancy Waterfall */}
      <AlphaWaterfallChart
        totalPnL={liveMetrics.totalPnL}
        totalR={liveMetrics.totalR}
        winRate={liveMetrics.winRate}
        completedTrades={liveMetrics.completedTrades}
        equity={liveMetrics.currentEquity}
      />

      {/* Quick Action Bar */}
      <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#848388]">
          <Activity className="w-4 h-4 text-[#00ff84]" />
          <span>Audit Trigger:</span>
          <span className="text-slate-200 font-semibold">{selectedMode === 'REAL_PAPER' ? 'Real Autonomous Cycle' : 'Simulation Lab Scenario'}</span>
        </div>

        <div className="flex items-center gap-2">
          {selectedMode === 'REAL_PAPER' ? (
            <button
              onClick={handleAuditRealCycle}
              disabled={isAuditing}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {isAuditing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Audit Latest Real Cycle
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedScenario}
                onChange={e => setSelectedScenario(e.target.value)}
                className="bg-[#1f1e23] border border-[#28272e] text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
              >
                <option value="SUCCESSFUL_BUY">Scenario: SUCCESSFUL_BUY</option>
                <option value="BUY_REJECTED">Scenario: BUY_REJECTED</option>
                <option value="PROFIT_EXIT">Scenario: PROFIT_EXIT (+5%)</option>
                <option value="PROTECTIVE_EXIT">Scenario: PROTECTIVE_EXIT (-6%)</option>
              </select>
              <button
                onClick={handleAuditSimulation}
                disabled={isAuditing}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isAuditing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Audit Simulation Run
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Latest Audit Overview Card */}
      {latestAudit ? (
        <div className="bg-[#0b0f19] rounded-lg border border-[#28272e] p-6 space-y-2 shadow-xl">
          
          {/* Top Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 pb-5 border-b border-[#28272e]/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#848388]">Latest Forensic Audit</span>
                <span className="text-slate-600">•</span>
                <span className="text-xs font-mono text-[#00ff84] font-semibold">{latestAudit.auditId}</span>
              </div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Decision:</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                  latestAudit.systemDecision === 'BUY' ? 'bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20'
                  : latestAudit.systemDecision === 'HOLD' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-[#9ca3af]'
                }`}>
                  {latestAudit.systemDecision}
                </span>
                {latestAudit.symbol && <span className="text-[#848388] text-xs">({latestAudit.symbol})</span>}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-[#848388]">Audit Verdict</div>
                <div className="mt-0.5">{getVerdictBadge(latestAudit.verdict)}</div>
              </div>
              <div className="text-right pl-3 border-l border-[#28272e]">
                <div className="text-[10px] uppercase font-bold text-[#848388]">Confidence</div>
                <div className="text-sm font-extrabold text-white">{latestAudit.confidence}%</div>
              </div>
              <div className="text-right pl-3 border-l border-[#28272e]">
                <div className="text-[10px] uppercase font-bold text-[#848388]">Latency</div>
                <div className="text-sm font-mono text-[#9ca3af]">{latestAudit.latencyMs}ms</div>
              </div>
            </div>
          </div>

          {/* Model & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e]/80 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1">
                <Cpu className="w-3 h-3 text-[#00ff84]" /> Reviewer Model
              </span>
              <div className="text-xs font-semibold text-slate-200">
                {latestAudit.modelMetadata.provider} ({latestAudit.modelMetadata.model})
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e]/80 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#848388]" /> Correlation ID
              </span>
              <div className="text-xs font-mono text-slate-200 truncate" title={latestAudit.correlationId}>
                {latestAudit.correlationId}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e]/80 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> Audit Timestamp
              </span>
              <div className="text-xs font-mono text-[#9ca3af]">
                {new Date(latestAudit.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-4 rounded-lg bg-cyan-950/20 border border-cyan-800/40 text-xs text-cyan-200 leading-relaxed">
            <span className="font-bold text-[#00ff84] mr-2">Audit Rationale:</span>
            {latestAudit.summary}
          </div>

          {/* 9-Stage Pipeline Audit Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#00ff84]" /> 9-Stage Pipeline Verification
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {latestAudit.checkedStages.map((stageItem, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#1f1e23] border border-[#28272e] flex flex-col justify-between gap-2"
                >
                  <span className="text-[11px] font-bold text-[#9ca3af]">{stageItem.stage}</span>
                  <div>{getStageStatusIcon(stageItem.status)}</div>
                  {stageItem.details && (
                    <span className="text-[10px] text-[#848388] truncate" title={stageItem.details}>
                      {stageItem.details}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rule Checks Table */}
          {latestAudit.ruleChecks && latestAudit.ruleChecks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" /> Deterministic Rule Evaluation
              </h4>
              <div className="overflow-x-auto rounded-lg border border-[#28272e]">
                <table className="w-full text-left text-xs text-[#9ca3af]">
                  <thead className="bg-[#1f1e23] text-[10px] uppercase font-bold text-[#848388] border-b border-[#28272e]">
                    <tr>
                      <th className="p-3">Rule Name</th>
                      <th className="p-3">Expected Constraint</th>
                      <th className="p-3">Observed Value</th>
                      <th className="p-3">Compliance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#1f1e23]">
                    {latestAudit.ruleChecks.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition">
                        <td className="p-3 font-semibold text-slate-200">{rule.rule}</td>
                        <td className="p-3 font-mono text-[#848388]">{rule.expected}</td>
                        <td className="p-3 font-mono text-[#9ca3af]">{String(rule.observed)}</td>
                        <td className="p-3">
                          {rule.passed ? (
                            <span className="text-[#00ff84] font-bold flex items-center gap-1">✓ PASS</span>
                          ) : (
                            <span className="text-[#ff3b5c] font-bold flex items-center gap-1">✕ FAIL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Findings List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-orange-400" /> Findings & Forensic Observations ({latestAudit.findings.length})
            </h4>

            {latestAudit.findings.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] text-[#848388] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00ff84]" />
                <span>Zero anomalies or rule violations detected. Workflow adheres to all constraints.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {latestAudit.findings.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2 hover:border-[#34333b] transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(f.severity)}
                        <span className="text-xs font-bold text-white">{f.title}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[10px] font-mono text-[#848388] uppercase">{f.category}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-[#848388] bg-slate-800 px-2 py-0.5 rounded">
                        Stage: {f.stage}
                      </span>
                    </div>

                    <p className="text-xs text-[#9ca3af] leading-relaxed">{f.description}</p>

                    {(f.expected !== undefined || f.observed !== undefined) && (
                      <div className="flex items-center gap-2 text-[11px] font-mono p-2 rounded bg-[#1f1e23] border border-[#28272e]/80">
                        {f.expected !== undefined && <div><span className="text-[#2d3748]">Expected:</span> <span className="text-[#00ff84]">{String(f.expected)}</span></div>}
                        {f.observed !== undefined && <div><span className="text-[#2d3748]">Observed:</span> <span className="text-orange-400">{String(f.observed)}</span></div>}
                      </div>
                    )}

                    <div className="text-[11px] text-[#00ff84] bg-cyan-950/30 p-2 rounded border border-cyan-900/30 flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-[#00ff84] shrink-0 mt-0.5" />
                      <span>{f.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className="p-12 rounded-lg bg-[#1f1e23] border border-[#28272e] text-center space-y-3">
          <Search className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-[#9ca3af]">No Workflow Audits Recorded Yet</h4>
          <p className="text-xs text-[#2d3748] max-w-md mx-auto">
            Click "Audit Latest Real Cycle" or select a simulation scenario to run a forensic workflow audit using Featherless AI.
          </p>
        </div>
      )}

      {/* Historical Audits Feed */}
      {audits.length > 1 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#848388]" /> Recent Audit Records ({audits.length})
          </h4>
          <div className="space-y-2">
            {audits.map((a, idx) => (
              <div
                key={idx}
                onClick={() => setLatestAudit(a)}
                className={`p-3.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 ${
                  latestAudit?.auditId === a.auditId
                    ? 'bg-slate-800/80 border-cyan-500/50 shadow-md'
                    : 'bg-[#1f1e23] border-[#28272e]/80 hover:bg-[#1f1e23] hover:border-[#34333b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getVerdictBadge(a.verdict)}
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{a.auditId}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[#9ca3af]">{a.systemDecision} ({a.symbol || 'CYCLE'})</span>
                    </div>
                    <div className="text-[10px] text-[#848388] flex items-center gap-2">
                      <span>{new Date(a.timestamp).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span>{a.findings.length} findings</span>
                      <span>•</span>
                      <span>{a.latencyMs}ms</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#9ca3af]">{a.confidence}%</span>
                  <ChevronRight className="w-4 h-4 text-[#2d3748]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
