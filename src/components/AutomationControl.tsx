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
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to execute automation command');
      } else {
        if (data.status) {
          setStatus(data.status);
        } else {
          await fetchStatus();
        }
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
    <div className="p-6 rounded-2xl bg-[#11141d] border border-slate-800 space-y-6">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Scheduled Automation & Orchestration (Phase 6D)
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 border ${
              isRunning
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {isRunning ? 'AUTOMATION RUNNING' : 'AUTOMATION STOPPED'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Orchestrates autonomous opportunity scanning, candidate queue dispatching, thesis monitoring, and protective paper exits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={() => handleAction('stop')}
              disabled={actionLoading === 'stop'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 transition disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Scheduler</span>
            </button>
          ) : (
            <button
              onClick={() => handleAction('start')}
              disabled={actionLoading === 'start'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Automation</span>
            </button>
          )}

          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Cycles</span>
          <div className="text-lg font-mono font-bold text-white">{status?.metrics?.totalRuns || 0}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-500">Successful</span>
          <div className="text-lg font-mono font-bold text-emerald-400">{status?.metrics?.successfulRuns || 0}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-500">Skipped (Locked)</span>
          <div className="text-lg font-mono font-bold text-amber-400">{status?.metrics?.skippedRuns || 0}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-500">Failed</span>
          <div className="text-lg font-mono font-bold text-rose-400">{status?.metrics?.failedRuns || 0}</div>
        </div>
      </div>

      {/* Job Orchestration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Discovery Cycle Card */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
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
                : 'bg-slate-800 text-slate-400'
            }`}>
              {status?.activeJobs?.DISCOVERY ? 'ACTIVE RUNNING' : 'IDLE'}
            </span>
          </div>

          <div className="text-xs text-slate-400 space-y-1 font-mono">
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
              <div className="flex justify-between text-slate-300">
                <span>Outcome:</span>
                <span className="text-indigo-300">
                  {discoveryLastRun.discoveryResult.queuedCount} queued, {discoveryLastRun.discoveryResult.dispatchSummary?.totalDispatched || 0} dispatched
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Next Scheduled:</span>
              <span className="text-slate-300">
                {status?.nextRun?.DISCOVERY ? new Date(status.nextRun.DISCOVERY).toLocaleTimeString() : 'Paused'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-end">
            <button
              onClick={() => handleAction('runNow', 'DISCOVERY')}
              disabled={actionLoading === 'runNow-DISCOVERY' || status?.activeJobs?.DISCOVERY}
              className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition disabled:opacity-50"
            >
              {actionLoading === 'runNow-DISCOVERY' ? 'Running...' : 'Run Discovery Now'}
            </button>
          </div>
        </div>

        {/* 2. Monitoring Cycle Card */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Thesis Monitoring (Phases 6B–6C)
              </h4>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              status?.activeJobs?.MONITORING
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {status?.activeJobs?.MONITORING ? 'ACTIVE RUNNING' : 'IDLE'}
            </span>
          </div>

          <div className="text-xs text-slate-400 space-y-1 font-mono">
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
              <div className="flex justify-between text-slate-300">
                <span>Outcome:</span>
                <span className="text-emerald-300">
                  {monitoringLastRun.monitoringResult.totalMonitored} pos ({monitoringLastRun.monitoringResult.healthyCount}H / {monitoringLastRun.monitoringResult.invalidatedCount}Inv)
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Next Scheduled:</span>
              <span className="text-slate-300">
                {status?.nextRun?.MONITORING ? new Date(status.nextRun.MONITORING).toLocaleTimeString() : 'Paused'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-end">
            <button
              onClick={() => handleAction('runNow', 'MONITORING')}
              disabled={actionLoading === 'runNow-MONITORING' || status?.activeJobs?.MONITORING}
              className="px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition disabled:opacity-50"
            >
              {actionLoading === 'runNow-MONITORING' ? 'Running...' : 'Run Monitoring Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Trail Section */}
      {status?.auditTrail && status.auditTrail.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            <span>Automation Audit Events</span>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
            {status.auditTrail.slice(0, 8).map((evt, idx) => (
              <div key={idx} className="p-2 rounded bg-slate-900/60 border border-slate-800/60 flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">{evt.event}</span>
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
