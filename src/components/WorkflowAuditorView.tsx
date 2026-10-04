'use client';
import React, { useState, useEffect } from 'react';
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
    totalPnL: 0,
    totalR: 0,
    winRate: 0,
    completedTrades: 0,
    currentEquity: 100000
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
        return <span className="text-[#00ff84] text-xs font-bold font-sans">✓ PASS</span>;
      case 'WARN':
        return <span className="text-amber-400 text-xs font-bold font-sans">▲ WARN</span>;
      case 'ANOMALY':
        return <span className="text-orange-400 text-xs font-bold font-sans">⚠ ANOMALY</span>;
      case 'ERROR':
        return <span className="text-[#ff3b5c] text-xs font-bold font-sans">✕ ERROR</span>;
      default:
        return <span className="text-[#848388] text-xs font-bold font-sans">{verdict}</span>;
    }
  };

  const getStageStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <span className="text-[#00ff84] font-bold text-xs font-sans">✓ PASS</span>;
      case 'WARN':
        return <span className="text-amber-400 font-bold text-xs font-sans">▲ WARN</span>;
      case 'ANOMALY':
        return <span className="text-orange-400 font-bold text-xs font-sans">⚠ ANOMALY</span>;
      case 'ERROR':
        return <span className="text-[#ff3b5c] font-bold text-xs font-sans">✕ ERROR</span>;
      case 'NOT_REACHED':
      default:
        return <span className="text-[#848388] font-semibold text-xs font-sans">— NOT REACHED</span>;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="text-[#ff3b5c] text-[10px] font-bold font-sans uppercase">[CRITICAL]</span>;
      case 'HIGH':
        return <span className="text-orange-400 text-[10px] font-bold font-sans uppercase">[HIGH]</span>;
      case 'MEDIUM':
        return <span className="text-amber-400 text-[10px] font-bold font-sans uppercase">[MEDIUM]</span>;
      case 'LOW':
        return <span className="text-[#848388] text-[10px] font-bold font-sans uppercase">[LOW]</span>;
      default:
        return <span className="text-[#848388] text-[10px] font-semibold font-sans uppercase">[INFO]</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-4">
      
      {/* Header & Consolidated Action Ribbon */}
      <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e] space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-phantom">
                Strategy Forensic Auditor
              </h2>
              <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-[#17161b] border border-[#28272e] text-[#00ff84]">
                Deterministic &amp; LLM Strategy Auditor
              </span>
            </div>
            <p className="text-[11px] text-[#848388] mt-1">
              Deterministic rule evaluation, evidence sufficiency audit, and mark-to-market trade reconciliation.
            </p>
          </div>

          {/* Mode Switcher + Refresh */}
          <div className="flex items-center gap-2">
            <div className="bg-[#17161b] p-0.5 rounded-lg border border-[#28272e] flex items-center">
              <button
                onClick={() => setSelectedMode('REAL_PAPER')}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  selectedMode === 'REAL_PAPER'
                    ? 'bg-[#00ff84] text-black shadow-sm'
                    : 'text-[#848388] hover:text-white'
                }`}
              >
                Real Paper Cycle
              </button>
              <button
                onClick={() => setSelectedMode('SIMULATION')}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  selectedMode === 'SIMULATION'
                    ? 'bg-[#00ff84] text-black shadow-sm'
                    : 'text-[#848388] hover:text-white'
                }`}
              >
                Simulation Lab
              </button>
            </div>

            <button
              onClick={() => fetchAudits(false)}
              disabled={isLoading}
              className="px-2.5 py-1.5 bg-[#17161b] hover:bg-[#28272e] text-[#848388] hover:text-white rounded-lg text-xs transition border border-[#28272e] cursor-pointer"
              title="Refresh Audits"
            >
              {isLoading ? <span className="inline-block animate-spin">↻</span> : '↻'}
            </button>
          </div>
        </div>

        {/* Action Trigger Strip */}
        <div className="pt-2 border-t border-[#28272e] flex flex-wrap items-center justify-between gap-3">
          {selectedMode === 'REAL_PAPER' ? (
            <div className="flex items-center gap-2 text-xs text-[#848388]">
              <span>Audit Target:</span>
              <span className="font-sans text-white font-semibold">Latest Autonomous Cycle Execution</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#848388]">Scenario:</span>
              {[
                { id: 'SUCCESSFUL_BUY', label: 'BUY (+2.5R)' },
                { id: 'BUY_REJECTED', label: 'REJECTED (Risk Gate)' },
                { id: 'PROFIT_EXIT', label: 'PROFIT EXIT (+5%)' },
                { id: 'PROTECTIVE_EXIT', label: 'PROTECTIVE EXIT (-6%)' },
              ].map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-sans font-semibold transition cursor-pointer ${
                    selectedScenario === sc.id
                      ? 'bg-[#121117] text-[#00ff84] border border-[#00ff84]/40'
                      : 'bg-[#17161b] text-[#848388] border border-[#28272e] hover:text-white'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          )}

          <div>
            {selectedMode === 'REAL_PAPER' ? (
              <button
                onClick={handleAuditRealCycle}
                disabled={isAuditing}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                style={{ background: '#00ff84', color: '#121117' }}
              >
                {isAuditing && <span className="inline-block animate-spin">↻</span>}
                Audit Latest Cycle →
              </button>
            ) : (
              <button
                onClick={handleAuditSimulation}
                disabled={isAuditing}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                style={{ background: '#00ff84', color: '#121117' }}
              >
                {isAuditing && <span className="inline-block animate-spin">↻</span>}
                Run Simulation Audit →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-[#ff3b5c]/8 border border-[#ff3b5c]/20 text-[#ff3b5c] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-[#ff3b5c] hover:text-white font-bold cursor-pointer">✕</button>
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

      {/* Latest Audit Overview Card */}
      {latestAudit ? (
        <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-6 space-y-4">
          
          {/* Top Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#28272e]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#848388]">Latest Forensic Audit</span>
                <span className="text-[#848388]">•</span>
                <span className="text-xs font-sans text-[#00ff84] font-semibold">{latestAudit.auditId}</span>
              </div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Decision:</span>
                <span className={`text-xs font-extrabold uppercase ${
                  latestAudit.systemDecision === 'BUY' ? 'text-[#00ff84]'
                  : latestAudit.systemDecision === 'HOLD' ? 'text-amber-400'
                  : 'text-[#848388]'
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
                <div className="text-sm font-extrabold text-white font-sans tabular-nums">{latestAudit.confidence}%</div>
              </div>
              <div className="text-right pl-3 border-l border-[#28272e]">
                <div className="text-[10px] uppercase font-bold text-[#848388]">Latency</div>
                <div className="text-sm font-sans tabular-nums text-[#848388]">{latestAudit.latencyMs}ms</div>
              </div>
            </div>
          </div>

          {/* Model & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#848388]">
                Reviewer Model
              </span>
              <div className="text-xs font-semibold text-white">
                {latestAudit.modelMetadata.provider} ({latestAudit.modelMetadata.model})
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#848388]">
                Correlation ID
              </span>
              <div className="text-xs font-sans text-white truncate" title={latestAudit.correlationId}>
                {latestAudit.correlationId}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#848388]">
                Audit Timestamp
              </span>
              <div className="text-xs font-sans tabular-nums text-[#848388]">
                {new Date(latestAudit.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] text-xs text-white leading-relaxed">
            <span className="font-bold text-[#00ff84] mr-2">Audit Rationale:</span>
            {latestAudit.summary}
          </div>

          {/* 9-Stage Pipeline Audit Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388]">
              9-Stage Pipeline Verification
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {latestAudit.checkedStages.map((stageItem, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#17161b] border border-[#28272e] flex flex-col justify-between gap-2"
                >
                  <span className="text-[11px] font-bold text-white">{stageItem.stage}</span>
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

          {/* Broker Fill Reconciliation Panel [P0] */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388]">
                Broker Execution &amp; Fill Reconciliation
              </h4>
              {latestAudit.brokerReconciliation ? (
                <span
                  className="text-xs font-bold font-sans px-2 py-0.5 rounded"
                  style={{
                    color: latestAudit.brokerReconciliation.reconciled ? '#00ff84' : '#ff3b5c',
                    background: latestAudit.brokerReconciliation.reconciled ? 'rgba(0, 255, 132, 0.1)' : 'rgba(255, 59, 92, 0.1)',
                    border: `1px solid ${latestAudit.brokerReconciliation.reconciled ? 'rgba(0, 255, 132, 0.25)' : 'rgba(255, 59, 92, 0.25)'}`,
                  }}
                >
                  {latestAudit.brokerReconciliation.reconciled ? '✓ RECONCILED' : '✕ DISCREPANCY'}
                </span>
              ) : (
                <span className="text-xs font-sans text-[#848388]">N/A</span>
              )}
            </div>

            {latestAudit.brokerReconciliation ? (
              <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded bg-[#121117] border border-[#28272e] space-y-1">
                    <span className="terminal-label">Reconciliation Class</span>
                    <div className="mono-num text-xs font-bold text-white">
                      {latestAudit.brokerReconciliation.classification}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-[#121117] border border-[#28272e] space-y-1">
                    <span className="terminal-label">Council Intent</span>
                    <div className="mono-num text-xs font-bold text-[#00ff84]">
                      {latestAudit.brokerReconciliation.orderIntentSymbol || latestAudit.symbol || '—'}{' '}
                      <span className="text-[#848388] text-[10px]">
                        ({latestAudit.brokerReconciliation.orderIntentQty != null ? `${latestAudit.brokerReconciliation.orderIntentQty} qty` : '—'})
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-[#121117] border border-[#28272e] space-y-1">
                    <span className="terminal-label">Broker Request</span>
                    <div className="mono-num text-xs font-bold text-white">
                      {latestAudit.brokerReconciliation.brokerRequestSymbol || latestAudit.symbol || '—'}{' '}
                      <span className="text-[#848388] text-[10px]">
                        ({latestAudit.brokerReconciliation.brokerRequestQty != null ? `${latestAudit.brokerReconciliation.brokerRequestQty} qty` : '—'})
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-[#121117] border border-[#28272e] space-y-1">
                    <span className="terminal-label">Broker API Status</span>
                    <div className="mono-num text-xs font-bold text-amber-400 uppercase">
                      {latestAudit.brokerReconciliation.brokerStatus || 'NONE'}
                    </div>
                  </div>
                </div>

                {latestAudit.brokerReconciliation.details && (
                  <div className="p-2.5 rounded bg-[#121117] border border-[#28272e] text-[11px] font-sans text-[#848388] leading-relaxed">
                    <span className="text-[#00ff84] font-bold mr-1.5">› Audit Detail:</span>
                    {latestAudit.brokerReconciliation.details}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] text-xs text-[#848388] flex items-center gap-2">
                <span className="text-[#848388]">•</span>
                <span>No broker transmission in this cycle (cycle concluded prior to broker execution or held in queue).</span>
              </div>
            )}
          </div>

          {/* Rule Checks Table */}
          {latestAudit.ruleChecks && latestAudit.ruleChecks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388]">
                Deterministic Rule Evaluation
              </h4>
              <div className="overflow-x-auto rounded-lg border border-[#28272e]">
                <table className="w-full text-left text-xs text-[#848388]">
                  <thead className="bg-[#17161b] text-[10px] uppercase font-bold text-[#848388] border-b border-[#28272e]">
                    <tr>
                      <th className="p-3">Rule Name</th>
                      <th className="p-3">Expected Constraint</th>
                      <th className="p-3">Observed Value</th>
                      <th className="p-3">Compliance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#28272e]/60 bg-[#1f1e23]">
                    {latestAudit.ruleChecks.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-[#28272e]/20 transition">
                        <td className="p-3 font-semibold text-white">{rule.rule}</td>
                        <td className="p-3 font-sans tabular-nums text-[#848388]">{rule.expected}</td>
                        <td className="p-3 font-sans tabular-nums text-[#848388]">{String(rule.observed)}</td>
                        <td className="p-3">
                          {rule.passed ? (
                            <span className="text-[#00ff84] font-bold font-sans">✓ PASS</span>
                          ) : (
                            <span className="text-[#ff3b5c] font-bold font-sans">✕ FAIL</span>
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388]">
              Findings &amp; Forensic Observations ({latestAudit.findings.length})
            </h4>

            {latestAudit.findings.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] text-[#848388] text-xs flex items-center gap-2">
                <span className="text-[#00ff84] font-bold">✓</span>
                <span>Zero anomalies or rule violations detected. Workflow adheres to all constraints.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {latestAudit.findings.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] space-y-2 hover:border-[#34333b] transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(f.severity)}
                        <span className="text-xs font-bold text-white">{f.title}</span>
                        <span className="text-[#848388]">•</span>
                        <span className="text-[10px] font-sans text-[#848388] uppercase">{f.category.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-[#848388] font-sans">
                        Stage: {f.stage}
                      </span>
                    </div>

                    <p className="text-xs text-[#848388] leading-relaxed">{f.description}</p>

                    {(f.expected !== undefined || f.observed !== undefined) && (
                      <div className="flex items-center gap-3 text-[11px] font-sans tabular-nums p-2 rounded bg-[#1f1e23] border border-[#28272e]">
                        {f.expected !== undefined && <div><span className="text-[#848388]">Expected:</span> <span className="text-[#00ff84]">{String(f.expected)}</span></div>}
                        {f.observed !== undefined && <div><span className="text-[#848388]">Observed:</span> <span className="text-orange-400">{String(f.observed)}</span></div>}
                      </div>
                    )}

                    <div className="text-[11px] text-[#00ff84] bg-[#00ff84]/5 p-2 rounded border border-[#00ff84]/20 flex items-start gap-1.5">
                      <span className="text-[#00ff84] font-bold">→</span>
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
          <h4 className="text-sm font-bold text-[#848388]">No Workflow Audits Recorded Yet</h4>
          <p className="text-xs text-[#848388] max-w-md mx-auto">
            Click "Audit Latest Real Cycle" or select a simulation scenario to run a forensic workflow audit against declared quantitative constraints.
          </p>
        </div>
      )}

      {/* Historical Audits Feed */}
      {audits.length > 1 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#848388]">
            Recent Audit Records ({audits.length})
          </h4>
          <div className="space-y-2">
            {audits.map((a, idx) => (
              <div
                key={idx}
                onClick={() => setLatestAudit(a)}
                className={`p-3.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 ${
                  latestAudit?.auditId === a.auditId
                    ? 'bg-[#17161b] border-[#00ff84]/50 shadow-md'
                    : 'bg-[#1f1e23] border-[#28272e] hover:border-[#34333b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getVerdictBadge(a.verdict)}
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{a.auditId}</span>
                      <span className="text-[#848388]">•</span>
                      <span className="text-[#848388]">{a.systemDecision} ({a.symbol || 'CYCLE'})</span>
                    </div>
                    <div className="text-[10px] text-[#848388] flex items-center gap-2 font-sans">
                      <span>{new Date(a.timestamp).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span>{a.findings.length} findings</span>
                      <span>•</span>
                      <span className="font-sans tabular-nums">{a.latencyMs}ms</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-sans tabular-nums font-bold text-[#848388]">{a.confidence}%</span>
                  <span className="text-xs text-[#848388]">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
