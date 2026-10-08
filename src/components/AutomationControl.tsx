'use client';
import React, { useState, useEffect } from 'react';
import {
  AutomationStatus,
  AutomationJobType,
  AutomationRun
} from '@/lib/automation/types';
import { useAuth } from '@/lib/auth/auth-context';

export const AutomationControl: React.FC = () => {
  const { isOperator } = useAuth();
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/automation');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch automation status', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Polling for operator dashboard
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: 'start' | 'stop' | 'runNow', jobType?: AutomationJobType) => {
    if (!isOperator) {
      setErrorMsg('Operator authorization required to control autonomous scheduler.');
      return;
    }
    setActionLoading(jobType ? `${action}-${jobType}` : action);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, jobType })
      });
      const ctype = res.headers.get('content-type') || '';
      if (!res.ok || !ctype.includes('application/json')) {
        let errMessage = `Automation startup failed: Server returned HTTP ${res.status}`;
        if (ctype.includes('application/json')) {
          try {
            const errData = await res.json();
            if (errData.error) errMessage = errData.error;
          } catch {}
        }
        throw new Error(errMessage);
      }
      const data = await res.json();
      if (data.status) {
        setStatus(data.status);
      } else {
        await fetchStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'API request failed');
    } finally {
      setActionLoading(null);
    }
  };

  const isRunning = status?.schedulerStatus === 'RUNNING';
  const discoveryLastRun = status?.lastRun?.DISCOVERY;
  const monitoringLastRun = status?.lastRun?.MONITORING;

  return (
    <div className="p-6 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-4">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white tracking-tight">
              Scheduled Automation &amp; Orchestration (Phase 6D)
            </h3>
            <span className={`text-[10px] font-bold ${
              isRunning
                ? 'text-[#00ff84]'
                : 'text-[#848388]'
            }`}>
              [{isRunning ? 'AUTOMATION RUNNING' : 'AUTOMATION STOPPED'}]
            </span>
          </div>
          <p className="text-xs text-[#848388] mt-1">
            Orchestrates autonomous opportunity scanning, candidate queue dispatching, thesis monitoring, and protective paper exits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={() => handleAction('stop')}
              disabled={actionLoading === 'stop' || !isOperator}
              title={!isOperator ? 'Operator authorization required' : undefined}
              className="px-3 py-1.5 rounded bg-[#ff3b5c] hover:bg-[#e03350] text-xs font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>■ Stop Scheduler</span>
            </button>
          ) : (
            <button
              onClick={() => handleAction('start')}
              disabled={actionLoading === 'start' || !isOperator}
              title={!isOperator ? 'Operator authorization required' : undefined}
              className="px-3 py-1.5 rounded bg-[#00ff84] hover:bg-[#00e576] text-xs font-bold text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>▶ Start Automation</span>
            </button>
          )}

          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded bg-[#17161b] border border-[#28272e] text-[#848388] hover:text-white transition text-xs"
            title="Refresh Status"
          >
            {isLoading ? <span className="inline-block animate-spin">↻</span> : '↻'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-[#ff3b5c]/8 border border-rose-500/30 flex items-center gap-2 text-[#ff3b5c] text-xs">
          <span>⚠</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-[#17161b] border border-[#28272e] space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#848388]">Total Cycles</span>
          <div className="text-lg tabular-nums font-bold text-white">{status?.metrics?.totalRuns || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#17161b] border border-[#28272e] space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#848388]">Successful</span>
          <div className="text-lg tabular-nums font-bold text-[#00ff84]">{status?.metrics?.successfulRuns || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#17161b] border border-[#28272e] space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#848388]">Skipped (Locked)</span>
          <div className="text-lg tabular-nums font-bold text-amber-400">{status?.metrics?.skippedRuns || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#17161b] border border-[#28272e] space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#848388]">Failed</span>
          <div className="text-lg tabular-nums font-bold text-[#ff3b5c]">{status?.metrics?.failedRuns || 0}</div>
        </div>
      </div>

      {/* Job Orchestration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Discovery Cycle Card */}
        <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Discovery Cycle (Phases 5A–5C)
            </h4>
            <span className={`text-[10px] font-bold uppercase ${
              status?.activeJobs?.DISCOVERY
                ? 'text-amber-400'
                : 'text-[#848388]'
            }`}>
              [{status?.activeJobs?.DISCOVERY ? 'ACTIVE' : 'IDLE'}]
            </span>
          </div>

          <div className="text-xs text-[#848388] space-y-1">
            <div className="flex justify-between">
              <span>Interval:</span>
              <span className="text-[#e2e8f0] tabular-nums">{(status?.config?.discovery?.intervalMs || 60000) / 1000}s</span>
            </div>
            <div className="flex justify-between">
              <span>Last Run:</span>
              <span className="text-[#e2e8f0]">
                {discoveryLastRun ? `${new Date(discoveryLastRun.startedAt).toLocaleTimeString()} (${discoveryLastRun.status})` : 'Never'}
              </span>
            </div>
            {discoveryLastRun?.discoveryResult && (
              <div className="flex justify-between text-[#848388]">
                <span>Outcome:</span>
                <span className="text-[#848388]">
                  {discoveryLastRun.discoveryResult.queuedCount} queued, {discoveryLastRun.discoveryResult.dispatchSummary?.totalDispatched || 0} dispatched
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Next Scheduled:</span>
              <span className="text-[#848388]">
                {status?.nextRun?.DISCOVERY ? new Date(status.nextRun.DISCOVERY).toLocaleTimeString() : 'Paused'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#28272e] flex items-center justify-end">
            <button
              onClick={() => handleAction('runNow', 'DISCOVERY')}
              disabled={actionLoading === 'runNow-DISCOVERY' || status?.activeJobs?.DISCOVERY || !isOperator}
              title={!isOperator ? 'Operator authorization required' : undefined}
              className="px-3 py-1 rounded bg-[#28272e] hover:bg-[#34333b] text-[#e2e8f0] text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'runNow-DISCOVERY' ? 'Running...' : 'Run Discovery Now'}
            </button>
          </div>
        </div>

        {/* 2. Monitoring Cycle Card */}
        <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Thesis Monitoring (Phases 6B–6C)
            </h4>
            <span className={`text-[10px] font-bold uppercase ${
              status?.activeJobs?.MONITORING
                ? 'text-[#00ff84]'
                : 'text-[#848388]'
            }`}>
              [{status?.activeJobs?.MONITORING ? 'ACTIVE' : 'IDLE'}]
            </span>
          </div>

          <div className="text-xs text-[#848388] space-y-1">
            <div className="flex justify-between">
              <span>Interval:</span>
              <span className="text-[#e2e8f0] tabular-nums">{(status?.config?.monitoring?.intervalMs || 30000) / 1000}s</span>
            </div>
            <div className="flex justify-between">
              <span>Last Run:</span>
              <span className="text-[#e2e8f0]">
                {monitoringLastRun ? `${new Date(monitoringLastRun.startedAt).toLocaleTimeString()} (${monitoringLastRun.status})` : 'Never'}
              </span>
            </div>
            {monitoringLastRun?.monitoringResult && (
              <div className="flex justify-between text-[#848388]">
                <span>Outcome:</span>
                <span className="text-[#00ff84] tabular-nums">
                  {monitoringLastRun.monitoringResult.totalMonitored} pos ({monitoringLastRun.monitoringResult.healthyCount}H / {monitoringLastRun.monitoringResult.invalidatedCount}Inv)
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Next Scheduled:</span>
              <span className="text-[#848388]">
                {status?.nextRun?.MONITORING ? new Date(status.nextRun.MONITORING).toLocaleTimeString() : 'Paused'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#28272e] flex items-center justify-end">
            <button
              onClick={() => handleAction('runNow', 'MONITORING')}
              disabled={actionLoading === 'runNow-MONITORING' || status?.activeJobs?.MONITORING || !isOperator}
              title={!isOperator ? 'Operator authorization required' : undefined}
              className="px-3 py-1 rounded bg-[#00ff84]/10 hover:bg-[#00ff84]/20 border border-[#00ff84]/20 text-[#00ff84] text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'runNow-MONITORING' ? 'Running...' : 'Run Monitoring Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Trail Section */}
      {status?.auditTrail && status.auditTrail.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="text-xs font-bold text-[#848388] uppercase tracking-wider">
            Automation Audit Events
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-[11px]">
            {status.auditTrail.slice(0, 8).map((evt, idx) => (
              <div key={idx} className="p-2 rounded bg-[#17161b] border border-[#28272e] flex items-center justify-between text-[#848388]">
                <div className="flex items-center gap-2">
                  <span className="text-[#848388] tabular-nums">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  <span className="text-[10px] text-[#e2e8f0]">[{evt.event?.replace(/_/g, ' ')}]</span>
                  <span>{evt.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
