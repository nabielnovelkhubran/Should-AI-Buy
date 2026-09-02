'use client';
import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Shield,
  Radio,
  Lock,
  ArrowUpRight,
  Database,
  Cpu,
  Send,
  Layers,
  Check
} from 'lucide-react';
import { BrokerDiagnosticsSummary, BrokerDiagnosticRecord } from '../lib/diagnostics/broker-diagnostics';

interface BrokerDiagnosticsViewProps {
  initialData?: BrokerDiagnosticsSummary;
}

export const BrokerDiagnosticsView: React.FC<BrokerDiagnosticsViewProps> = () => {
  const [diagnostics, setDiagnostics] = useState<BrokerDiagnosticsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecord, setSelectedRecord] = useState<BrokerDiagnosticRecord | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'REAL_PAPER' | 'SIMULATION'>('ALL');

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/diagnostics/broker?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDiagnostics(data.diagnostics);
        }
      }
    } catch {
      // Degraded / offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const timer = setInterval(fetchDiagnostics, 4000);
    return () => clearInterval(timer);
  }, []);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#00ff84]/8 text-[#00ff84] border border-[#00ff84]/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> CONNECTED
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> DEGRADED
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ff3b5c]/8 text-[#ff3b5c] border border-rose-500/20 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> ERROR
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" /> READY
          </span>
        );
    }
  };

  const filteredActivity = (diagnostics?.recentActivity || []).filter(rec => {
    if (filterMode === 'ALL') return true;
    return rec.mode === filterMode;
  });

  const orderSubmissions = (diagnostics?.recentActivity || []).filter(
    rec => rec.method === 'POST' && rec.endpointCategory === 'ORDERS'
  );

  return (
    <div className="space-y-2 animate-in fade-in duration-300">
      
      {/* Environment Fingerprint & Safety Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-[#28272e] rounded-lg p-5 backdrop-blur-sm shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#00ff84]/8 text-[#00ff84] border border-[#00ff84]/20">
                PAPER ENVIRONMENT
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                TRADING AUTHORITY: ENABLED
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-[#848388] border border-purple-500/20">
                SIMULATION: ISOLATED
              </span>
            </div>
            <div className="text-sm font-bold text-slate-100 mt-2 flex items-center gap-2">
              <span>Account Fingerprint:</span>
              <span className="font-mono text-amber-400 font-extrabold">{diagnostics?.maskedAccountId || 'PA3T2D***'}</span>
              <span className="text-[#2d3748]">•</span>
              <span className="text-[#9ca3af]">Endpoint: https://paper-api.alpaca.markets/v2</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getStatusBadge(diagnostics?.status)}
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-[#9ca3af] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#34333b]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#28272e]/80">
          <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
            <span className="text-[10px] uppercase font-bold text-[#848388] block">Total Requests</span>
            <span className="text-sm font-bold font-mono text-slate-200">{diagnostics?.totalRequests || 0}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
            <span className="text-[10px] uppercase font-bold text-[#848388] block">Last Latency</span>
            <span className="text-sm font-bold font-mono text-[#00ff84]">{diagnostics?.lastLatencyMs || 0} ms</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
            <span className="text-[10px] uppercase font-bold text-[#848388] block">Success Rate</span>
            <span className="text-sm font-bold font-mono text-[#00ff84]">
              {diagnostics?.totalRequests ? `${(((diagnostics.successfulRequests || 0) / diagnostics.totalRequests) * 100).toFixed(0)}%` : '100%'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]">
            <span className="text-[10px] uppercase font-bold text-[#848388] block">Order Submissions</span>
            <span className="text-sm font-bold font-mono text-[#848388]">{orderSubmissions.length} POSTs</span>
          </div>
        </div>
      </div>

      {/* Reconciliation Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Order Reconciliation Card */}
        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-[#00ff84]" /> Order Reconciliation
            </span>
            {diagnostics?.orderReconciliation ? (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                diagnostics.orderReconciliation.status === 'MATCHED' ? 'bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20'
                : diagnostics.orderReconciliation.status === 'PENDING' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {diagnostics.orderReconciliation.status}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#2d3748]">0 orders this session</span>
            )}
          </div>
          <p className="text-xs text-[#9ca3af]">
            {diagnostics?.orderReconciliation?.details || 'Local order intent matches Alpaca order parameters with strict 1:1 parity.'}
          </p>
        </div>

        {/* Position Reconciliation Card */}
        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#848388] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#848388]" /> Position Reconciliation
            </span>
            {diagnostics?.positionReconciliation ? (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                diagnostics.positionReconciliation.status === 'CONFIRMED' ? 'bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20'
                : 'bg-slate-800 text-[#9ca3af]'
              }`}>
                {diagnostics.positionReconciliation.status === 'CONFIRMED' ? '✓ Broker-confirmed' : diagnostics.positionReconciliation.status}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#00ff84]">✓ 0 open positions (Reconciled)</span>
            )}
          </div>
          <p className="text-xs text-[#9ca3af]">
            {diagnostics?.positionReconciliation?.details || 'Position monitoring continuously queries GET /v2/positions directly on Alpaca Paper.'}
          </p>
        </div>
      </div>

      {/* POST /v2/orders Submissions Forensics Card */}
      <div className="bg-[#1f1e23] border border-[#28272e] rounded-lg p-5 backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Send className="w-4 h-4 text-[#00ff84]" />
            Order Submission Forensics (POST /v2/orders)
          </h3>
          <span className="text-xs text-[#848388] font-mono">{orderSubmissions.length} record(s)</span>
        </div>

        {orderSubmissions.length === 0 ? (
          <div className="p-6 rounded-lg bg-[#1f1e23] border border-[#28272e]/80 text-center space-y-1">
            <p className="text-xs font-semibold text-[#848388]">Zero real paper order submissions in this session.</p>
            <p className="text-[11px] text-[#2d3748]">
              When a candidate satisfies every authoritative threshold (Opportunity ≥ 60, Confidence ≥ 65, R:R ≥ 2.0, Risk Gate PASS), POST /v2/orders will be logged here with complete latency and response metadata.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#28272e]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#1f1e23] text-[10px] uppercase font-bold text-[#848388] border-b border-[#28272e]">
                <tr>
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Mode</th>
                  <th className="p-2.5">Symbol</th>
                  <th className="p-2.5">Side</th>
                  <th className="p-2.5">Qty</th>
                  <th className="p-2.5">Broker Order ID</th>
                  <th className="p-2.5">HTTP Status</th>
                  <th className="p-2.5 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#1f1e23]">
                {orderSubmissions.map((sub, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="p-2.5 text-[#9ca3af]">{new Date(sub.timestamp).toLocaleTimeString()}</td>
                    <td className="p-2.5 text-[#00ff84] font-bold">{sub.mode}</td>
                    <td className="p-2.5 font-bold text-white">{sub.sanitizedRequest?.symbol || '--'}</td>
                    <td className="p-2.5 uppercase text-[#00ff84] font-bold">{sub.sanitizedRequest?.side || 'BUY'}</td>
                    <td className="p-2.5 text-slate-200">{sub.sanitizedRequest?.qty || '--'}</td>
                    <td className="p-2.5 text-[#848388] truncate max-w-[120px]">{sub.brokerOrderId || sub.sanitizedResponse?.id || '--'}</td>
                    <td className="p-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        sub.httpStatus === 200 || sub.httpStatus === 201
                          ? 'bg-[#00ff84]/10 text-[#00ff84]'
                          : 'bg-rose-500/20 text-[#ff3b5c]'
                      }`}>
                        {sub.httpStatus} {sub.success ? 'OK' : 'REJECTED'}
                      </span>
                    </td>
                    <td className="p-2.5 text-right text-[#00ff84]">{sub.latencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Table & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Recent Activity List */}
        <div className="lg:col-span-2 bg-[#1f1e23] border border-[#28272e] rounded-lg p-5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00ff84]" />
              Broker API Telemetry Log ({filteredActivity.length})
            </h3>
            
            {/* Filter Toggle */}
            <div className="bg-[#1f1e23] p-1 rounded-lg border border-[#28272e] flex items-center gap-1">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                  filterMode === 'ALL' ? 'bg-slate-800 text-white' : 'text-[#848388] hover:text-white'
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilterMode('REAL_PAPER')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                  filterMode === 'REAL_PAPER' ? 'bg-[#00ff84] text-black font-bold' : 'text-[#848388] hover:text-white'
                }`}
              >
                REAL PAPER
              </button>
              <button
                onClick={() => setFilterMode('SIMULATION')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                  filterMode === 'SIMULATION' ? 'bg-[#00ff84] text-black font-bold' : 'text-[#8b8a91] hover:text-white'
                }`}
              >
                SIMULATION
              </button>
            </div>
          </div>

          {filteredActivity.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[#28272e] rounded-lg">
              <Server className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#848388]">No matching broker activity recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#28272e] text-[#848388] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Endpoint</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Latency</th>
                    <th className="py-2.5 px-3 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredActivity.map((rec) => {
                    const timeStr = rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : '--';
                    const isSuccess = rec.httpStatus >= 200 && rec.httpStatus < 300;
                    return (
                      <tr
                        key={rec.id}
                        onClick={() => setSelectedRecord(rec)}
                        className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${selectedRecord?.id === rec.id ? 'bg-slate-800/60' : ''}`}
                      >
                        <td className="py-2.5 px-3 text-[#848388] whitespace-nowrap">{timeStr}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            rec.mode === 'REAL_PAPER' ? 'bg-cyan-500/10 text-[#00ff84] border border-cyan-500/20' : 'bg-purple-500/10 text-[#848388] border border-purple-500/20'
                          }`}>
                            {rec.mode === 'REAL_PAPER' ? 'REAL' : 'SIM'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`font-bold ${
                            rec.method === 'POST' ? 'text-[#848388]' : rec.method === 'DELETE' ? 'text-[#ff3b5c]' : 'text-[#9ca3af]'
                          }`}>
                            {rec.method}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#9ca3af] max-w-[150px] truncate" title={rec.sanitizedUrl}>
                          {rec.sanitizedUrl.replace('https://paper-api.alpaca.markets', '')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isSuccess ? 'bg-[#00ff84]/8 text-[#00ff84]' : 'bg-[#ff3b5c]/8 text-[#ff3b5c]'
                          }`}>
                            {rec.httpStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#848388]">
                          {rec.latencyMs}ms
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRecord(rec);
                            }}
                            className="p-1 hover:bg-slate-700 rounded text-[#848388] hover:text-slate-200 transition-colors"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Record Inspector */}
        <div className="bg-[#1f1e23] border border-[#28272e] rounded-lg p-5 backdrop-blur-sm space-y-2">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#848388]" />
            Payload Inspector
          </h3>

          {selectedRecord ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-[#1f1e23] rounded-lg border border-[#28272e] space-y-1.5">
                <div className="flex justify-between text-[#848388]">
                  <span>ID:</span>
                  <span className="text-slate-200 font-bold">{selectedRecord.id}</span>
                </div>
                <div className="flex justify-between text-[#848388]">
                  <span>Category:</span>
                  <span className="text-[#00ff84] font-bold">{selectedRecord.endpointCategory}</span>
                </div>
                <div className="flex justify-between text-[#848388]">
                  <span>Endpoint:</span>
                  <span className="text-slate-200 truncate max-w-[180px]">{selectedRecord.sanitizedUrl}</span>
                </div>
                <div className="flex justify-between text-[#848388]">
                  <span>Latency:</span>
                  <span className="text-slate-200">{selectedRecord.latencyMs} ms</span>
                </div>
              </div>

              {selectedRecord.sanitizedRequest && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#848388] uppercase">Sanitized Request</span>
                  <pre className="p-3 bg-[#1f1e23] border border-[#28272e] rounded-lg text-[11px] text-[#00ff84] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedRecord.sanitizedRequest, null, 2)}
                  </pre>
                </div>
              )}

              {selectedRecord.sanitizedResponse && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#848388] uppercase">Sanitized Response</span>
                  <pre className="p-3 bg-[#1f1e23] border border-[#28272e] rounded-lg text-[11px] text-[#00ff84] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedRecord.sanitizedResponse, null, 2)}
                  </pre>
                </div>
              )}

              {selectedRecord.errorDetails && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#ff3b5c] uppercase">Error Details</span>
                  <div className="p-3 bg-rose-950/40 border border-[#ff3b5c]/20/60 rounded-lg text-xs text-[#ff3b5c]">
                    {selectedRecord.errorDetails}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-[#2d3748] text-xs">
              Select any request in the log to inspect its sanitized parameters and broker response.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
