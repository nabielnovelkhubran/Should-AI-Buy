'use client';
import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  Cpu,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import {
  AutomationStatus,
  AutomationJobType,
  AutomationRun
} from '@/lib/automation/types';

export const AutomationControl: React.FC = () => {
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
    <div className="p-6 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#848388]" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Scheduled Automation & Orchestration (Phase 6D)
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 border ${
              isRunning
                ? 'bg-[#00ff84]/8 text-[#00ff84] border-[#00ff84]/20'
                : 'bg-slate-800 text-[#848388] border-[#34333b]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {isRunning ? 'AUTOMATION RUNNING' : 'AUTOMATION STOPPED'}
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
              disabled={actionLoading === 'stop'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ff3b5c] hover:bg-[#e03350] text-xs font-bold text-white transition disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Scheduler</span>
            </button>
          ) : (
            <button
              onClick={() => handleAction('start')}
              disabled={actionLoading === 'start'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00ff84] hover:bg-[#00e576] text-xs font-bold text-black transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Automation</span>
            </button>
          )}

          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-800 border border-[#34333b] text-[#9ca3af] hover:text-white transition"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-[#ff3b5c]/8 border border-rose-500/30 flex items-center gap-2 text-[#ff3b5c] text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#ff3b5c]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#2d3748]">Total Cycles</span>
          <div className="text-lg font-mono font-bold text-white">{status?.metrics?.totalRuns || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#2d3748]">Successful</span>
          <div className="text-lg font-mono font-bold text-[#00ff84]">{status?.metrics?.successfulRuns || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#2d3748]">Skipped (Locked)</span>
          <div className="text-lg font-mono font-bold text-amber-400">{status?.metrics?.skippedRuns || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#2d3748]">Failed</span>
          <div className="text-lg font-mono font-bold text-[#ff3b5c]">{status?.metrics?.failedRuns || 0}</div>
        </div>
      </div>

      {/* Job Orchestration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* 1. Discovery Cycle Card */}
        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Discovery Cycle (Phases 5A–5C)
              </h4>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              status?.activeJobs?.DISCOVERY
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-800 text-[#848388]'
            }`}>
              {status?.activeJobs?.DISCOVERY ? 'ACTIVE RUNNING' : 'IDLE'}
            </span>
          </div>

          <div className="text-xs text-[#848388] space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Interval:</span>
              <span className="text-slate-200">{(status?.config?.discovery?.intervalMs || 60000) / 1000}s</span>
            </div>
            <div className="flex justify-between">
              <span>Last Run:</span>
              <span className="text-slate-200">
                {discoveryLastRun ? `${new Date(discoveryLastRun.startedAt).toLocaleTimeString()} (${discoveryLastRun.status})` : 'Never'}
              </span>
            </div>
            {discoveryLastRun?.discoveryResult && (
              <div className="flex justify-between text-[#9ca3af]">
                <span>Outcome:</span>
                <span className="text-[#848388]">
                  {discoveryLastRun.discoveryResult.queuedCount} queued, {discoveryLastRun.discoveryResult.dispatchSummary?.totalDispatched || 0} dispatched
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Next Scheduled:</span>
              <span className="text-[#9ca3af]">
                {status?.nextRun?.DISCOVERY ? new Date(status.nextRun.DISCOVERY).toLocaleTimeString() : 'Paused'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#28272e]/60 flex items-center justify-end">
            <button
              onClick={() => handleAction('runNow', 'DISCOVERY')}
              disabled={actionLoading === 'runNow-DISCOVERY' || status?.activeJobs?.DISCOVERY}
              className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-[#848388] text-xs font-semibold transition disabled:opacity-50"
            >
              {actionLoading === 'runNow-DISCOVERY' ? 'Running...' : 'Run Discovery Now'}
            </button>
          </div>
        </div>

        {/* 2. Monitoring Cycle Card */}
        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00ff84]" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Thesis Monitoring (Phases 6B–6C)
              </h4>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              status?.activeJobs?.MONITORING
                ? 'bg-[#00ff84]/10 text-[#00ff84]'
                : 'bg-slate-800 text-[#848388]'
            }`}>
              {status?.activeJobs?.MONITORING ? 'ACTIVE RUNNING' : 'IDLE'}
            </span>
          </div>

          <div className="text-xs text-[#848388] space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Interval:</span>
              <span className="text-slate-200">{(status?.config?.monitoring?.intervalMs || 30000) / 1000}s</span>
            </div>
            <div className="flex justify-between">
              <span>Last Run:</span>
              <span className="text-slate-200">
                {monitoringLastRun ? `${new Date(monitoringLastRun.startedAt).toLocaleTimeString()} (${monitoringLastRun.status})` : 'Never'}
              </span>
            </div>
            {monitoringLastRun?.monitoringResult && (
              <div className="flex justify-between text-[#9ca3af]">
                <span>Outcome:</span>
                <span className="text-[#00ff84]">
                  {monitoringLastRun.monitoringResult.totalMonitored} pos ({monitoringLastRun.monitoringResult.healthyCount}H / {monitoringLastRun.monitoringResult.invalidatedCount}Inv)
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Next Scheduled:</span>
              <span className="text-[#9ca3af]">
                {status?.nextRun?.MONITORING ? new Date(status.nextRun.MONITORING).toLocaleTimeString() : 'Paused'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#28272e]/60 flex items-center justify-end">
            <button
              onClick={() => handleAction('runNow', 'MONITORING')}
              disabled={actionLoading === 'runNow-MONITORING' || status?.activeJobs?.MONITORING}
              className="px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-[#00ff84]/20 text-[#00ff84] text-xs font-semibold transition disabled:opacity-50"
            >
              {actionLoading === 'runNow-MONITORING' ? 'Running...' : 'Run Monitoring Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Trail Section */}
      {status?.auditTrail && status.auditTrail.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#848388] uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            <span>Automation Audit Events</span>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
            {status.auditTrail.slice(0, 8).map((evt, idx) => (
              <div key={idx} className="p-2 rounded bg-[#1f1e23] border border-[#28272e]/60 flex items-center justify-between text-[#9ca3af]">
                <div className="flex items-center gap-2">
                  <span className="text-[#2d3748]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-[#9ca3af]">{evt.event}</span>
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
