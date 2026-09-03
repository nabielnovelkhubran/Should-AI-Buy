'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header, DashboardTab } from '@/components/Header';
import { SystemHealthBanner } from '@/components/SystemHealthBanner';
import { CommandCenterView } from '@/components/CommandCenterView';
import { DeliberationFeed } from '@/components/DeliberationFeed';
import { RedTeamSpotlight } from '@/components/RedTeamSpotlight';
import { EvidenceExplorer } from '@/components/EvidenceExplorer';
import { MarketChart } from '@/components/MarketChart';
import { PortfolioView } from '@/components/PortfolioView';
import { DiscoveryDashboard } from '@/components/DiscoveryDashboard';
import { AutomationControl } from '@/components/AutomationControl';
import { RuntimeObservabilityView } from '@/components/RuntimeObservabilityView';
import { BrokerDiagnosticsView } from '@/components/BrokerDiagnosticsView';
import { ExecutionLabView } from '@/components/ExecutionLabView';
import { WorkflowAuditorView } from '@/components/WorkflowAuditorView';
import {
  Investigation,
  MarketSnapshot,
  AlpacaAccount,
  Position,
  AlpacaOrder,
  CandidateQueueStats,
  ScanResult,
  SystemHealthState
} from '@/lib/types';
import { PortfolioSnapshot } from '@/lib/portfolio/types';
import { MonitoringCycleResult, MonitoredPositionRecord } from '@/lib/monitoring/types';
import { AutomationStatus } from '@/lib/automation/types';
import { AgentRuntimeSnapshot } from '@/lib/agent/analytics/types';
import { sanitizeErrorMessage } from '@/lib/errors';
import { AlertCircle } from 'lucide-react';
import { CurrencyProvider } from '@/components/CurrencyProvider';
import { QuantTickerRibbon } from '@/components/QuantTickerRibbon';
import { AuthGate } from '@/components/AuthGate';
import { AuthProvider } from '@/lib/auth/auth-context';

const BASE_POLL_INTERVAL_MS = 8000;
const MAX_BACKOFF_INTERVAL_MS = 30000;

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('observability');
  const [selectedEvidenceCategory, setSelectedEvidenceCategory] = useState<string>('ALL');
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  
  // Real-time Centralized State
  const [account, setAccount] = useState<AlpacaAccount | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [monitoringResult, setMonitoringResult] = useState<MonitoringCycleResult | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [discoveryStats, setDiscoveryStats] = useState<{ scanResult?: ScanResult | null; queueStats?: CandidateQueueStats | null }>({});
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<AgentRuntimeSnapshot | null>(null);
  
  // Phase 8 Resilience & Health State
  const [systemHealth, setSystemHealth] = useState<SystemHealthState>('ONLINE');
  const [isStale, setIsStale] = useState<boolean>(false);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // In-flight request lock & AbortController refs to prevent overlapping ticks
  const isFetchingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveFailuresRef = useRef<number>(0);

  // Centralized System State Refresh with Concurrent Promise.allSettled & Bounded Backoff
  const fetchSystemState = useCallback(async () => {
    // 1. Concurrency Lock: Prevent overlapping requests
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);

    try {
      const results = await Promise.allSettled([
        fetch('/api/trading/paper/portfolio'),
        fetch('/api/monitoring'),
        fetch('/api/automation'),
        fetch('/api/discovery'),
        fetch('/api/agent/runtime')
      ]);

      let corePortfolioOk = false;
      let coreRuntimeOk = false;

      // 1. Portfolio Snapshot (/api/trading/paper/portfolio)
      if (results[0].status === 'fulfilled') {
        const res = results[0].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const pData = await res.json();
            if (pData.portfolio) {
              setPortfolio(pData.portfolio);
              if (pData.portfolio.account) {
                setAccount(pData.portfolio.account);
              }
              corePortfolioOk = true;
            }
          } catch {}
        }
      }

      // Fallback for Portfolio if /api/trading/paper/portfolio failed
      if (!corePortfolioOk) {
        try {
          const altRes = await fetch('/api/portfolio');
          if (altRes.ok && (altRes.headers.get('content-type') || '').includes('application/json')) {
            const altData = await altRes.json();
            if (altData.portfolio) {
              setPortfolio(altData.portfolio);
              if (altData.account) setAccount(altData.account);
              corePortfolioOk = true;
            }
          }
        } catch {}
      }

      // 2. Monitoring State (/api/monitoring)
      if (results[1].status === 'fulfilled') {
        const res = results[1].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const mData = await res.json();
            if (mData.monitoringResult) {
              setMonitoringResult(mData.monitoringResult);
            }
          } catch {}
        }
      }

      // 3. Automation State (/api/automation)
      if (results[2].status === 'fulfilled') {
        const res = results[2].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const aData = await res.json();
            setAutomationStatus(aData);
          } catch {}
        }
      }

      // 4. Discovery State (/api/discovery)
      if (results[3].status === 'fulfilled') {
        const res = results[3].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const dData = await res.json();
            setDiscoveryStats({
              scanResult: dData.scanResult,
              queueStats: dData.queueStats
            });
          } catch {}
        }
      }

      // 5. Runtime Observability Snapshot (/api/agent/runtime)
      if (results[4].status === 'fulfilled') {
        const res = results[4].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const rData = await res.json();
            if (rData.snapshot) {
              setRuntimeSnapshot(rData.snapshot);
              coreRuntimeOk = true;
            }
          } catch {}
        }
      }

      // Update System Health: Core Broker + Runtime determines Online vs Degraded
      if (corePortfolioOk || coreRuntimeOk) {
        setSystemHealth('ONLINE');
        setIsStale(false);
        setLastSuccessfulSyncAt(new Date().toISOString());
        consecutiveFailuresRef.current = 0;
        setConsecutiveFailures(0);
      } else {
        consecutiveFailuresRef.current += 1;
        setConsecutiveFailures(consecutiveFailuresRef.current);
        if (consecutiveFailuresRef.current >= 3) {
          setSystemHealth('OFFLINE');
          setIsStale(true);
        } else {
          setSystemHealth('DEGRADED');
        }
      }
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  // Adaptive Polling Scheduler with Exponential Backoff
  useEffect(() => {
    let isActive = true;

    const scheduleNextPoll = () => {
      if (!isActive) return;
      const backoffMultiplier = Math.min(Math.pow(1.5, consecutiveFailuresRef.current), MAX_BACKOFF_INTERVAL_MS / BASE_POLL_INTERVAL_MS);
      const delay = Math.min(BASE_POLL_INTERVAL_MS * backoffMultiplier, MAX_BACKOFF_INTERVAL_MS);

      pollTimerRef.current = setTimeout(async () => {
        if (isActive) {
          await fetchSystemState();
          scheduleNextPoll();
        }
      }, delay);
    };

    fetchSystemState().then(scheduleNextPoll);

    return () => {
      isActive = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchSystemState]);

  const handleRunCommand = async (command: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const match = command.match(/^(\$?[A-Z0-9.\-_]+)\s*(.*)$/i);
      let assetInput = command.trim();
      let queryText = command.trim();
      if (match) {
        assetInput = match[1].toUpperCase().replace('$', '');
        queryText = match[2].trim() || `Should AI buy ${assetInput}?`;
      }

      const invRes = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: command.trim(),
          asset: assetInput,
          query: queryText,
          timeframe: 'SWING',
          marketSession: 'REGULAR'
        })
      });

      const ctype = invRes.headers.get('content-type') || '';
      if (!invRes.ok || !ctype.includes('application/json')) {
        let errMessage = `Council investigation failed: Server returned HTTP ${invRes.status}`;
        if (ctype.includes('application/json')) {
          try {
            const errData = await invRes.json();
            if (errData.error) errMessage = errData.error;
          } catch {}
        }
        throw new Error(errMessage);
      }

      const invData = await invRes.json();
      const actualInvestigation = invData?.investigation || invData;
      setInvestigation(actualInvestigation);

      // Restore Market Context: First use embedded snapshot from investigation, then fetch fresh snapshot
      if (actualInvestigation?.snapshot) {
        setSnapshot(actualInvestigation.snapshot);
      } else {
        const targetSymbol = actualInvestigation?.asset || assetInput;
        try {
          const snapRes = await fetch(`/api/market-data?symbol=${encodeURIComponent(targetSymbol)}`);
          if (snapRes.ok && snapRes.headers.get('content-type')?.includes('application/json')) {
            const snapData = await snapRes.json();
            if (snapData.snapshot) setSnapshot(snapData.snapshot);
          }
        } catch {
          // Market data failure non-fatal
        }
      }

      setActiveTab('council');
    } catch (err: any) {
      setErrorMessage(sanitizeErrorMessage(err.message) || 'Failed to execute command.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunDiscoveryNow = async () => {
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SCAN_NOW', limit: 20 })
      });
      if (!res.ok) {
        const ctype = res.headers.get('content-type') || '';
        if (ctype.includes('application/json')) {
          const data = await res.json();
          if (data.error) throw new Error(data.error);
        }
        throw new Error(`Discovery scan failed: Server returned HTTP ${res.status}`);
      }
      await fetchSystemState();
    } catch (err: any) {
      setErrorMessage(sanitizeErrorMessage(err.message));
    }
  };

  const handleRunMonitoringNow = async () => {
    try {
      const res = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RUN_CYCLE' })
      });
      if (!res.ok) {
        const ctype = res.headers.get('content-type') || '';
        if (ctype.includes('application/json')) {
          const data = await res.json();
          if (data.error) throw new Error(data.error);
        }
        throw new Error(`Monitoring cycle failed: Server returned HTTP ${res.status}`);
      }
      await fetchSystemState();
    } catch (err: any) {
      setErrorMessage(sanitizeErrorMessage(err.message));
    }
  };

  const handleRunCycleNow = async () => {
    try {
      const res = await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RUN_CYCLE', scanLimit: 5 })
      });
      const ctype = res.headers.get('content-type') || '';
      if (!res.ok || !ctype.includes('application/json')) {
        let errMessage = `Autonomous cycle failed: Server returned HTTP ${res.status}`;
        if (ctype.includes('application/json')) {
          try {
            const errData = await res.json();
            if (errData.error) errMessage = errData.error;
          } catch {
            // Ignore
          }
        }
        throw new Error(errMessage);
      }
      const data = await res.json();
      if (data.snapshot) setRuntimeSnapshot(data.snapshot);
      await fetchSystemState();
    } catch (err: any) {
      setErrorMessage(sanitizeErrorMessage(err.message));
    }
  };

  const handleResetCircuitBreaker = async () => {
    try {
      const res = await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_CIRCUIT_BREAKER' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.snapshot) setRuntimeSnapshot(data.snapshot);
      }
      await fetchSystemState();
    } catch (err: any) {
      setErrorMessage(sanitizeErrorMessage(err.message));
    }
  };

  const handleExecuteProtectiveExit = async (pos: MonitoredPositionRecord) => {
    try {
      await fetch('/api/trading/paper/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: pos.position?.symbol || pos.health?.symbol,
          assetClass: pos.position?.assetClass || 'EQUITY',
          side: pos.position?.side === 'short' ? 'buy' : 'sell',
          qty: pos.position?.quantity || 1,
          orderType: 'market',
          timeInForce: 'day'
        })
      });
      await fetchSystemState();
    } catch (err: any) {
      setErrorMessage(sanitizeErrorMessage(err.message));
    }
  };

  const handleSelectDiscoveredInvestigation = async (inv: Investigation) => {
    setInvestigation(inv);
    try {
      const snapRes = await fetch(`/api/market-data?symbol=${encodeURIComponent(inv.asset)}`);
      if (snapRes.ok) {
        const snapData = await snapRes.json();
        setSnapshot(snapData.snapshot || null);
      }
    } catch {
      // Ignore
    }
    setActiveTab('council');
  };

  const handleReevaluate = (symbol: string) => {
    handleRunCommand(symbol);
  };

  const handleViewEvidence = (category?: string) => {
    setSelectedEvidenceCategory(category || 'ALL');
    setActiveTab('evidence');
  };


  const handleTabChange = (tab: DashboardTab) => {
    if (tab === 'evidence') {
      setSelectedEvidenceCategory('ALL');
    }
    setActiveTab(tab);
  };

  return (
    <AuthProvider>
      <CurrencyProvider>
        <AuthGate>
          <main className="min-h-screen flex flex-col" style={{ background: '#121117', color: '#e2e8f0' }}>

        {/* Top Nav */}
        <Header account={account} activeTab={activeTab} setActiveTab={handleTabChange} />

        {/* System Health Strip */}
        <SystemHealthBanner
          systemHealth={systemHealth}
          isStale={isStale}
          lastSuccessfulSyncAt={lastSuccessfulSyncAt}
          consecutiveFailures={consecutiveFailures}
          onManualRefresh={fetchSystemState}
          isRefreshing={isRefreshing}
        />

        {/* Global Error Strip */}
        {errorMessage && (
          <div
            className="flex items-center justify-between px-4 py-1.5 text-[11px] mono-num"
            style={{ background: 'rgba(255,59,92,0.08)', borderBottom: '1px solid rgba(255,59,92,0.25)', color: '#ff3b5c' }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="font-bold px-2 hover:opacity-70">✕</button>
          </div>
        )}

        {/* Main Body: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Left Asset Sidebar */}
          <QuantTickerRibbon />

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto" style={{ minWidth: 0 }}>
            <div className="p-2 space-y-2 max-w-[1400px]">

              {/* TAB: Command Lab */}
              {activeTab === 'command' && (
                <CommandCenterView
                  investigation={investigation}
                  snapshot={snapshot}
                  portfolio={portfolio}
                  monitoringResult={monitoringResult}
                  automationStatus={automationStatus}
                  discoveryStats={discoveryStats}
                  isLoading={isLoading}
                  onExecuteCommand={handleRunCommand}
                  onNavigateTab={(tab) => setActiveTab(tab as DashboardTab)}
                  onRunDiscoveryNow={handleRunDiscoveryNow}
                  onRunMonitoringNow={handleRunMonitoringNow}
                  onExecuteProtectiveExit={handleExecuteProtectiveExit}
                />
              )}

              {/* TAB: Live Alpha Observability */}
              {activeTab === 'observability' && (
                <RuntimeObservabilityView
                  snapshot={runtimeSnapshot}
                  isLoading={isRefreshing}
                  onRefresh={fetchSystemState}
                  onRunCycleNow={handleRunCycleNow}
                  onResetCircuitBreaker={handleResetCircuitBreaker}
                />
              )}

              {/* TAB: Discovery */}
              {activeTab === 'discovery' && (
                <DiscoveryDashboard onSelectInvestigation={handleSelectDiscoveredInvestigation} />
              )}

              {/* TAB: Council Deliberation */}
              {activeTab === 'council' && (
                <div className="space-y-5">
                  {investigation && investigation.status !== 'FAILED' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      <div className="lg:col-span-2 space-y-5">
                        <RedTeamSpotlight
                          redTeamResult={investigation.agentRuns['red_team']}
                          asset={investigation.asset}
                          claims={investigation.claims ?? []}
                          evidence={investigation.evidence}
                        />
                        <DeliberationFeed
                          investigation={investigation}
                          onViewEvidence={handleViewEvidence}
                        />
                      </div>
                      <div className="space-y-5">
                        <MarketChart snapshot={snapshot || investigation?.snapshot || undefined} />
                        <div className="terminal-card p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="terminal-label">Key Evidence ({investigation.evidence.length} items)</span>
                            <button
                              onClick={() => handleViewEvidence('ALL')}
                              className="text-[10px] font-semibold mono-num transition"
                              style={{ color: '#00ff84' }}
                            >
                              View All →
                            </button>
                          </div>
                          <div className="space-y-2">
                            {investigation.evidence.slice(0, 3).map((e) => (
                              <div key={e.id} className="p-2.5 rounded text-[11px]" style={{ background: '#121117', border: '1px solid #1c2030' }}>
                                <div className="font-bold" style={{ color: '#e2e8f0' }}>{e.title}</div>
                                <div className="mt-0.5 line-clamp-1" style={{ color: '#848388' }}>{e.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="terminal-card p-12 text-center space-y-2">
                      <div className="text-sm font-bold" style={{ color: '#e2e8f0' }}>No Active Deliberation</div>
                      <p className="text-xs max-w-md mx-auto" style={{ color: '#848388' }}>
                        Submit a query from Command Lab or select an asset from the Discovery Queue.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Portfolio */}
              {activeTab === 'portfolio' && (
                <PortfolioView
                  account={portfolio?.account || account}
                  positions={portfolio?.positions || []}
                  orders={portfolio?.openOrders || []}
                  onReevaluate={handleReevaluate}
                />
              )}

              {/* TAB: Evidence */}
              {activeTab === 'evidence' && (
                <div className="space-y-5">
                  {investigation ? (
                    <EvidenceExplorer
                      evidence={investigation.evidence}
                      initialCategory={selectedEvidenceCategory}
                    />
                  ) : (
                    <div className="terminal-card p-12 text-center space-y-2">
                      <div className="text-sm font-bold" style={{ color: '#e2e8f0' }}>No Evidence Loaded</div>
                      <p className="text-xs" style={{ color: '#848388' }}>
                        Investigate an asset first to inspect supporting and contradictory evidence.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Automation */}
              {activeTab === 'automation' && <AutomationControl />}

              {/* TAB: Strategy Audit */}
              {activeTab === 'workflow_auditor' && <WorkflowAuditorView />}

              {/* TAB: Broker Diagnostics */}
              {activeTab === 'broker_diagnostics' && <BrokerDiagnosticsView />}

              {/* TAB: Simulation Lab */}
              {activeTab === 'execution_lab' && <ExecutionLabView />}

            </div>
          </div>
        </div>

        {/* Footer */}
        <footer
          className="shrink-0 flex items-center justify-between px-5 py-2 text-[10px] mono-num"
          style={{ background: '#121117', borderTop: '1px solid #28272e', color: '#2d3748' }}
        >
          <span>Should-AI Buy? · Alpaca AI Trading Hackathon</span>
          <span>Discover · Challenge · Decide</span>
        </footer>

      </main>
        </AuthGate>
      </CurrencyProvider>
    </AuthProvider>
  );
}
