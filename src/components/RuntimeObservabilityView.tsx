'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  PieChart,
  BarChart2,
  Sliders,
  Layers,
  ChevronRight,
  Sparkles,
  Award,
  Lock,
  Target,
  FileText,
  Radio,
  Bookmark,
  Edit2,
  Trash2,
  Save,
  Plus,
  RotateCcw
} from 'lucide-react';
import { AgentRuntimeSnapshot, AlphaReviewSnapshot } from '@/lib/agent/analytics/types';
import { RuntimeJournalEvent, WorkerHeartbeatTelemetry } from '@/lib/agent/analytics/durable-types';
import { AlphaStrategyReviewSnapshot } from '@/lib/agent/analytics/strategy-review-types';
import { useCurrency } from './CurrencyProvider';
import { PortfolioGraphHistory } from './PortfolioGraphHistory';
import { useAuth } from '@/lib/auth/auth-context';

export interface RiskTierInfo {
  id: 'STANDARD' | 'RISKY' | 'HIGH_RISK' | 'ALL_IN';
  label: string;
  color: string;
  description: string;
  profile: 'STANDARD' | 'HIGH_RISK';
}

export function getRiskTierForPercentage(pct: number): RiskTierInfo {
  if (pct <= 25) {
    return {
      id: 'STANDARD',
      label: 'Standard',
      color: '#00ff84',
      description: 'Conservative capital preservation (Max 50% exposure, 5 positions)',
      profile: 'STANDARD',
    };
  }
  if (pct <= 55) {
    return {
      id: 'RISKY',
      label: 'Risky',
      color: '#eab308',
      description: 'Moderate alpha swing capture (Max 65% exposure, 6 positions)',
      profile: 'STANDARD',
    };
  }
  if (pct <= 85) {
    return {
      id: 'HIGH_RISK',
      label: 'High Risk',
      color: '#f97316',
      description: 'High-alpha momentum allocation (Max 80% exposure, 8 positions)',
      profile: 'HIGH_RISK',
    };
  }
  return {
    id: 'ALL_IN',
    label: 'All In',
    color: '#ff3b5c',
    description: 'Maximum capital deployment & lowest entry barriers (100% exposure cap)',
    profile: 'HIGH_RISK',
  };
}

export function getThresholdsForPercentage(pct: number) {
  const factor = Math.max(0, Math.min(100, pct)) / 100;
  return {
    minOpportunityScore: Math.round(60 - factor * 20),
    minConfidenceScore: Math.round(65 - factor * 20),
    minRiskRewardRatio: Number((2.0 - factor * 1.0).toFixed(2)),
    minLiquidityUsd: Math.round(500000 - factor * 400000),
    maxSpreadBps: Math.round(50 + factor * 50),
    maxOpenPositions: Math.round(5 + factor * 11), // Scales from 5 to 16 positions!
    maxPortfolioExposurePct: Math.round(50 + factor * 50), // Scales from 50% to 100%!
    maxPositionSizeUsd: Math.round(5000 + factor * 20000), // Scales from $5k to $25k!
  };
}

export interface FilterPreset {
  id: string;
  name: string;
  thresholds: {
    minLiquidityUsd: number;
    maxSpreadBps: number;
    minOpportunityScore: number;
    minConfidenceScore: number;
    minRiskRewardRatio: number;
  };
  isDefault?: boolean;
}

const DEFAULT_FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'preset-balanced',
    name: 'Balanced',
    thresholds: { minLiquidityUsd: 500000, maxSpreadBps: 50, minOpportunityScore: 60, minConfidenceScore: 65, minRiskRewardRatio: 2.0 },
    isDefault: true,
  },
  {
    id: 'preset-aggressive',
    name: 'Aggressive Alpha',
    thresholds: { minLiquidityUsd: 250000, maxSpreadBps: 75, minOpportunityScore: 50, minConfidenceScore: 55, minRiskRewardRatio: 1.8 },
    isDefault: true,
  },
  {
    id: 'preset-conservative',
    name: 'Conservative',
    thresholds: { minLiquidityUsd: 1000000, maxSpreadBps: 30, minOpportunityScore: 70, minConfidenceScore: 75, minRiskRewardRatio: 2.5 },
    isDefault: true,
  },
];

interface RuntimeObservabilityViewProps {
  snapshot?: AgentRuntimeSnapshot | null;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
  onRunCycleNow?: () => Promise<void>;
  onResetCircuitBreaker?: () => Promise<void>;
}

export const RuntimeObservabilityView: React.FC<RuntimeObservabilityViewProps> = ({
  snapshot = null,
  isLoading = false,
  onRefresh,
  onRunCycleNow,
  onResetCircuitBreaker
}) => {
  const { formatCurrency } = useCurrency();
  const { role, isOperator, isViewer } = useAuth();
  const [localSnapshot, setLocalSnapshot] = useState<AgentRuntimeSnapshot | null>(null);
  const [activeAttributionTab, setActiveAttributionTab] = useState<'strategy' | 'regime' | 'asset' | 'confidence' | 'factors'>('strategy');
  const [alphaSnapshot, setAlphaSnapshot] = useState<AlphaReviewSnapshot | null>(null);
  const [strategyReview, setStrategyReview] = useState<AlphaStrategyReviewSnapshot | null>(null);
  const [events, setEvents] = useState<RuntimeJournalEvent[]>([]);
  const [heartbeat, setHeartbeat] = useState<WorkerHeartbeatTelemetry | null>(null);
  const [telemetryStatus, setTelemetryStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'ERROR'>('CONNECTING');
  const [degradedWarnings, setDegradedWarnings] = useState<string[]>([]);
  const [alphaLoading, setAlphaLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showSliders, setShowSliders] = useState<boolean>(false);
  const [rejectionFilter, setRejectionFilter] = useState<'ALL' | 'CRYPTO' | 'AI_DECISIONS' | 'SCORE_FILTER' | 'EQUITY'>('ALL');

  // Funnel filter sliders – local UI state initialized from localStorage and synchronized with runtime
  const [funnelThresholds, setFunnelThresholds] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('SHOULD_AI_BUY_FUNNEL_THRESHOLDS');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            minLiquidityUsd: typeof parsed.minLiquidityUsd === 'number' ? parsed.minLiquidityUsd : 500000,
            maxSpreadBps: typeof parsed.maxSpreadBps === 'number' ? parsed.maxSpreadBps : 50,
            minOpportunityScore: typeof parsed.minOpportunityScore === 'number' ? parsed.minOpportunityScore : 60,
            minConfidenceScore: typeof parsed.minConfidenceScore === 'number' ? parsed.minConfidenceScore : 65,
            minRiskRewardRatio: typeof parsed.minRiskRewardRatio === 'number' ? parsed.minRiskRewardRatio : 2.0,
          };
        }
      } catch { /* ignore */ }
    }
    return {
      minLiquidityUsd: 500000,
      maxSpreadBps: 50,
      minOpportunityScore: 60,
      minConfidenceScore: 65,
      minRiskRewardRatio: 2.0,
    };
  });
  const sliderDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Filter Presets State (Local Storage backed)
    // Percentage Slider State (0% - 100%)
  const [riskPercentage, setRiskPercentage] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('SHOULD_AI_BUY_RISK_PERCENTAGE');
        if (saved !== null) {
          const val = parseInt(saved, 10);
          if (!isNaN(val)) return Math.max(0, Math.min(100, val));
        }
      } catch {}
    }
    return 20; // Default Standard
  });

  const riskDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleRiskPercentageChange = (pct: number) => {
    if (isViewer) {
      alert('Action restricted: View-Only (Judge) Mode cannot modify risk or capital allocation. Log in with the Operator passphrase.');
      return;
    }
    const clamped = Math.max(0, Math.min(100, pct));
    setRiskPercentage(clamped);
    try {
      localStorage.setItem('SHOULD_AI_BUY_RISK_PERCENTAGE', String(clamped));
    } catch {}

    const tier = getRiskTierForPercentage(clamped);
    const thresholds = getThresholdsForPercentage(clamped);

    // Synchronize local funnel thresholds immediately for responsive UI
    setFunnelThresholds(prev => ({ ...prev, ...thresholds }));

    // Debounce runtime API push to avoid network flooding on continuous drag
    if (riskDebounceRef.current) clearTimeout(riskDebounceRef.current);
    riskDebounceRef.current = setTimeout(async () => {
      try {
        await Promise.allSettled([
          fetch('/api/agent/runtime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SET_RISK_PROFILE', riskProfile: tier.profile })
          }),
          fetch('/api/agent/runtime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SET_FILTER_THRESHOLDS', ...thresholds })
          })
        ]);
        await fetchTelemetry();
      } catch (err) {
        console.error('Failed to sync risk percentage to runtime:', err);
      }
    }, 250);
  };

  const [presets, setPresets] = useState<FilterPreset[]>(DEFAULT_FILTER_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string | null>('preset-balanced');
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Hydration-safe loading of presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('SHOULD_AI_BUY_FILTER_PRESETS');
      if (saved) {
        const parsed: FilterPreset[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const customOnly = parsed.filter(p => !p.isDefault);
          setPresets([...DEFAULT_FILTER_PRESETS, ...customOnly]);
        }
      }
      const savedActive = localStorage.getItem('SHOULD_AI_BUY_ACTIVE_PRESET_ID');
      if (savedActive) {
        setActivePresetId(savedActive);
      }
    } catch (err) {
      console.warn('Failed to load filter presets from localStorage:', err);
    }
  }, []);

  const persistPresets = (allPresets: FilterPreset[], activeId?: string) => {
    try {
      const customOnly = allPresets.filter(p => !p.isDefault);
      localStorage.setItem('SHOULD_AI_BUY_FILTER_PRESETS', JSON.stringify(customOnly));
      if (activeId !== undefined) {
        localStorage.setItem('SHOULD_AI_BUY_ACTIVE_PRESET_ID', activeId || '');
      }
    } catch (err) {
      console.warn('Failed to persist filter presets:', err);
    }
  };

  const handleSelectPreset = (preset: FilterPreset) => {
    setActivePresetId(preset.id);
    setFunnelThresholds(preset.thresholds);
    pushThresholds(preset.thresholds);
    persistPresets(presets, preset.id);
  };

  const handleSaveNewPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPresetName.trim();
    if (!name) return;
    const newPreset: FilterPreset = {
      id: `custom-preset-${Date.now()}`,
      name,
      thresholds: { ...funnelThresholds },
      isDefault: false,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    setActivePresetId(newPreset.id);
    persistPresets(updated, newPreset.id);
    setIsCreatingPreset(false);
    setNewPresetName('');
  };

  const handleSaveEditName = (presetId: string, e: React.FormEvent) => {
    e.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    const updated = presets.map(p => (p.id === presetId ? { ...p, name } : p));
    setPresets(updated);
    persistPresets(updated);
    setEditingPresetId(null);
    setEditingName('');
  };

  const handleUpdatePresetValues = (presetId: string) => {
    const updated = presets.map(p =>
      p.id === presetId ? { ...p, thresholds: { ...funnelThresholds } } : p
    );
    setPresets(updated);
    persistPresets(updated);
  };

  const handleDeletePreset = (presetId: string) => {
    const updated = presets.filter(p => p.id !== presetId);
    setPresets(updated);
    if (activePresetId === presetId) {
      const fallback = updated[0];
      setActivePresetId(fallback ? fallback.id : null);
      if (fallback) {
        setFunnelThresholds(fallback.thresholds);
        pushThresholds(fallback.thresholds);
      }
    }
    persistPresets(updated);
  };


  const effectiveSnapshot = snapshot || localSnapshot;

  // Fetch Phase 8.10 Runtime, Phase 8.11 Alpha, Phase 8.12 Events & Phase 8.13 Strategy Review
  const fetchTelemetry = async () => {
    try {
      setAlphaLoading(true);
      const results = await Promise.allSettled([
        fetch('/api/agent/runtime'),
        fetch('/api/agent/alpha'),
        fetch('/api/agent/events'),
        fetch('/api/agent/alpha/review')
      ]);

      const warnings: string[] = [];
      let runtimeOk = false;

      // 1. Authoritative Runtime Snapshot
      if (results[0].status === 'fulfilled') {
        const res = results[0].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const rData = await res.json();
            if (rData.snapshot) {
              setLocalSnapshot(rData.snapshot);
              runtimeOk = true;
            }
          } catch {
            warnings.push('Runtime snapshot parse failed');
          }
        } else {
          warnings.push(`Runtime endpoint returned HTTP ${res.status}`);
        }
      } else {
        warnings.push('Runtime endpoint network failure');
      }

      // 2. Alpha Review Snapshot (Auxiliary)
      if (results[1].status === 'fulfilled') {
        const res = results[1].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const data = await res.json();
            if (data.success) setAlphaSnapshot(data);
          } catch {}
        }
      } else {
        warnings.push('Alpha review auxiliary stream unavailable');
      }

      // 3. Live Events & Heartbeat Stream (Auxiliary)
      if (results[2].status === 'fulfilled') {
        const res = results[2].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const data = await res.json();
            if (data.success) {
              setEvents(data.events || []);
              setHeartbeat(data.heartbeat || null);
            }
          } catch {}
        }
      } else {
        warnings.push('Event journal stream unavailable');
      }

      // 4. Strategy Review Engine (Auxiliary)
      if (results[3].status === 'fulfilled') {
        const res = results[3].value;
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          try {
            const data = await res.json();
            if (data.success) setStrategyReview(data);
          } catch {}
        }
      } else {
        warnings.push('Strategy review engine unavailable');
      }

      setDegradedWarnings(warnings);
      if (runtimeOk || effectiveSnapshot) {
        const hasCircuitBreaker = effectiveSnapshot?.safety?.circuitBreakerActive || effectiveSnapshot?.worker?.circuitBreakerTripped;
        const isBrokerUnhealthy = effectiveSnapshot?.worker && !effectiveSnapshot.worker.accountHealthy;
        if (hasCircuitBreaker || isBrokerUnhealthy) {
          setTelemetryStatus('DEGRADED');
        } else {
          setTelemetryStatus('CONNECTED');
        }
      } else {
        setTelemetryStatus('ERROR');
      }
    } catch {
      if (effectiveSnapshot) setTelemetryStatus('CONNECTED');
      else setTelemetryStatus('ERROR');
    } finally {
      setAlphaLoading(false);
    }
  };

  // Debounced push of slider values to the runtime and localStorage
  const pushThresholds = useCallback((thresholds: typeof funnelThresholds) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('SHOULD_AI_BUY_FUNNEL_THRESHOLDS', JSON.stringify(thresholds));
      } catch { /* ignore */ }
    }
    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    sliderDebounceRef.current = setTimeout(async () => {
      try {
        await fetch('/api/agent/runtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SET_FILTER_THRESHOLDS', ...thresholds })
        });
        await fetchTelemetry();
      } catch { /* silent */ }
    }, 600);
  }, []);

  useEffect(() => {
    fetchTelemetry();
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('SHOULD_AI_BUY_FUNNEL_THRESHOLDS');
        if (saved) {
          const parsed = JSON.parse(saved);
          fetch('/api/agent/runtime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SET_FILTER_THRESHOLDS', ...parsed })
          }).catch(() => {});
        }
      } catch { /* ignore */ }
    }
    const interval = setInterval(fetchTelemetry, 3000); // Live real-time polling every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (!effectiveSnapshot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-[#1f1e23] rounded-lg border border-[#28272e]">
        <Activity className="w-10 h-10 text-[#848388] animate-spin mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Connecting to Autonomous Agent Telemetry...</h3>
        <p className="text-sm text-[#848388] max-w-md mb-6">
          Initializing broker-confirmed paper snapshot, trade ledger, and alpha attribution diagnostics.
        </p>
        <button
          onClick={() => {
            fetchTelemetry();
            if (onRefresh) onRefresh();
          }}
          className="px-4 py-2 bg-[#00ff84] hover:bg-[#00e576] text-black font-bold text-xs font-semibold rounded-lg transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { worker, account, performance, attribution, calibration, safety, session, recentDecisions, recentTrades, openTrades, currentCycle } = effectiveSnapshot;

  const avgOppScore: number | null = currentCycle?.scoreBands?.averageOpportunityScore ?? 
    (currentCycle?.rotationTelemetry && currentCycle.rotationTelemetry.length > 0
      ? Number((currentCycle.rotationTelemetry.reduce((sum: number, c: any) => sum + (c.opportunityScore || 0), 0) / currentCycle.rotationTelemetry.length).toFixed(1))
      : (currentCycle?.evaluations && currentCycle.evaluations.length > 0
          ? Number((currentCycle.evaluations.reduce((sum: number, e: any) => sum + (e.opportunityScore || 0), 0) / currentCycle.evaluations.length).toFixed(1))
          : null));

  const isWorkerRunning = worker.state === 'RUNNING' || worker.state === 'SCANNING' || worker.state === 'EVALUATING';
  const isCircuitBreakerTripped = worker.circuitBreakerTripped || safety.circuitBreakerActive;

  const handleRunCycle = async () => {
    if (isViewer) {
      alert('Action restricted: View-Only (Judge) Mode does not permit executing cycles. Log in with the Operator passphrase.');
      return;
    }
    try {
      setActionLoading('cycle');
      if (onRunCycleNow) {
        await onRunCycleNow();
      } else {
        await fetch('/api/agent/runtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'RUN_CYCLE' })
        });
      }
      await fetchTelemetry();
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartRuntime = async () => {
    if (isViewer) {
      alert('Action restricted: View-Only (Judge) Mode does not permit starting the autonomous agent. Log in with the Operator passphrase.');
      return;
    }
    try {
      setActionLoading('start_agent');
      await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START', proofMode: worker.proofMode ?? false })
      });
      await fetchTelemetry();
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopRuntime = async () => {
    if (isViewer) {
      alert('Action restricted: View-Only (Judge) Mode does not permit stopping the autonomous agent. Log in with the Operator passphrase.');
      return;
    }
    try {
      setActionLoading('stop_agent');
      await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'STOP' })
      });
      await fetchTelemetry();
    } finally {
      setActionLoading(null);
    }
  };

  
  const handleToggleRiskProfile = async (profile: 'STANDARD' | 'HIGH_RISK') => {
    setActionLoading('risk_profile');
    try {
      const res = await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_RISK_PROFILE', riskProfile: profile })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTelemetry();
      }
    } catch (err) {
      console.error('Failed to update risk profile:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleProofMode = async () => {
    if (isViewer) {
      alert('Action restricted: View-Only (Judge) Mode does not permit toggling Proof Mode. Log in with the Operator passphrase.');
      return;
    }
    try {
      setActionLoading('proof_mode');
      const nextProof = !(worker.proofMode ?? false);
      await fetch('/api/agent/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_PROOF_MODE', enabled: nextProof })
      });
      await fetchTelemetry();
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetCB = async () => {
    if (isViewer) {
      alert('Action restricted: View-Only (Judge) Mode does not permit resetting circuit breakers. Log in with the Operator passphrase.');
      return;
    }
    try {
      setActionLoading('cb');
      if (onResetCircuitBreaker) {
        await onResetCircuitBreaker();
      } else {
        await fetch('/api/agent/runtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'RESET_CIRCUIT_BREAKER' })
        });
      }
      await fetchTelemetry();
    } finally {
      setActionLoading(null);
    }
  };

  const verdict = alphaSnapshot?.verdict;

  return (
    <div className="space-y-2">
      
      {/* 1. Header Banner & Operator Controls */}
      <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5 shadow-xl">
        {isViewer && (
          <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span><strong>View-Only (Judge) Mode Active:</strong> Real-time quant telemetry, live deliberation journals, and equity curves are live. Operator controls (Start/Stop, Risk Slider, Manual Cycles) are disabled to protect live broker capital.</span>
            </div>
            <span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-200 border border-blue-500/40 shrink-0">
              Passphrase: alpaca2026
            </span>
          </div>
        )}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2">
          
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">Autonomous Agent Runtime</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  PAPER TRADING ONLY ($100K)
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isWorkerRunning
                    ? 'bg-[#00ff84]/8 text-[#00ff84] border-[#00ff84]/20'
                    : 'bg-slate-800 text-[#848388] border-[#34333b]'
                }`}>
                  {isWorkerRunning ? '● RUNNING' : '○ STOPPED'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  MODE: {worker.runtimeMode || 'REAL_PAPER'}
                </span>
                {worker.proofMode && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    ⚡ PROOF MODE (MAX 1 POS)
                  </span>
                )}
                {worker.nextScheduledCycleAt && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono text-[#848388] border border-[#28272e] bg-[#1f1e23]">
                    Next: {new Date(worker.nextScheduledCycleAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#848388] mt-0.5">
                Live broker ground truth: <span className="text-[#9ca3af] font-mono">{account.accountNumberMasked}</span> • Session ID: <span className="text-[#9ca3af] font-mono">{session.sessionId}</span> • Evidence: <span className="text-amber-400 font-semibold">{session.evidenceQuality}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap">
            {isCircuitBreakerTripped && (
              <button
                onClick={handleResetCB}
                disabled={actionLoading === 'cb' || isViewer}
                title={isViewer ? 'Operator passphrase required to reset CB' : undefined}
                className="px-3.5 py-2 bg-[#ff3b5c] hover:bg-[#e03350] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Reset Circuit Breaker
              </button>
            )}

            {isWorkerRunning ? (
              <button
                onClick={handleStopRuntime}
                disabled={actionLoading === 'stop_agent' || isViewer}
                title={isViewer ? 'Operator passphrase required to stop agent' : undefined}
                className="px-3.5 py-2 bg-[#ff3b5c] hover:bg-[#e03350] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                {actionLoading === 'stop_agent' ? 'Stopping...' : 'Stop Autonomous Agent'}
              </button>
            ) : (
              <button
                onClick={handleStartRuntime}
                disabled={actionLoading === 'start_agent' || isCircuitBreakerTripped || isViewer}
                title={isViewer ? 'Operator passphrase required to start agent' : undefined}
                className="px-3.5 py-2 bg-[#00ff84] hover:bg-[#00e576] text-black text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                {actionLoading === 'start_agent' ? 'Starting...' : 'Start Autonomous Agent'}
              </button>
            )}

            {/* Risk & Capital Percentage Slider */}
            {(() => {
              const currentTier = getRiskTierForPercentage(riskPercentage);
              return (
                <div className="flex flex-col justify-center px-3 py-2 rounded-xl bg-[#1f1e23] border border-[#28272e] min-w-[270px] sm:min-w-[310px] shadow-sm">
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#848388]">
                      Risk & Capital
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-mono font-bold"
                        style={{ color: currentTier.color }}
                      >
                        {riskPercentage}%
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider"
                        style={{
                          color: currentTier.color,
                          borderColor: `${currentTier.color}40`,
                          background: `${currentTier.color}15`,
                        }}
                      >
                        {currentTier.label}
                      </span>
                    </div>
                  </div>

                  {/* 0% - 100% Continuous Percentage Slider */}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={riskPercentage}
                    onChange={(e) => handleRiskPercentageChange(+e.target.value)}
                    disabled={actionLoading !== null || isViewer}
                    className={`w-full h-1.5 rounded-full appearance-none bg-[#28272e] transition my-1 ${
                      isViewer ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    style={{
                      accentColor: currentTier.color,
                    }}
                  />

                  {/* Faint text showing: standard, risky, high risk, all in */}
                  <div className="flex justify-between items-center text-[9px] font-mono pt-0.5 select-none">
                    <span
                      onClick={() => handleRiskPercentageChange(12)}
                      className={`cursor-pointer transition ${
                        currentTier.id === 'STANDARD'
                          ? 'font-bold opacity-100'
                          : 'text-[#848388] opacity-50 hover:opacity-80'
                      }`}
                      style={{
                        color: currentTier.id === 'STANDARD' ? currentTier.color : undefined,
                      }}
                    >
                      standard
                    </span>
                    <span
                      onClick={() => handleRiskPercentageChange(38)}
                      className={`cursor-pointer transition ${
                        currentTier.id === 'RISKY'
                          ? 'font-bold opacity-100'
                          : 'text-[#848388] opacity-50 hover:opacity-80'
                      }`}
                      style={{
                        color: currentTier.id === 'RISKY' ? currentTier.color : undefined,
                      }}
                    >
                      risky
                    </span>
                    <span
                      onClick={() => handleRiskPercentageChange(70)}
                      className={`cursor-pointer transition ${
                        currentTier.id === 'HIGH_RISK'
                          ? 'font-bold opacity-100'
                          : 'text-[#848388] opacity-50 hover:opacity-80'
                      }`}
                      style={{
                        color: currentTier.id === 'HIGH_RISK' ? currentTier.color : undefined,
                      }}
                    >
                      high risk
                    </span>
                    <span
                      onClick={() => handleRiskPercentageChange(95)}
                      className={`cursor-pointer transition ${
                        currentTier.id === 'ALL_IN'
                          ? 'font-bold opacity-100'
                          : 'text-[#848388] opacity-50 hover:opacity-80'
                      }`}
                      style={{
                        color: currentTier.id === 'ALL_IN' ? currentTier.color : undefined,
                      }}
                    >
                      all in
                    </span>
                  </div>

                  {/* Tiny description at the bottom of the slider with faint text */}
                  <div className="text-[9px] text-[#848388]/60 pt-0.5 truncate select-none text-center">
                    {currentTier.description}
                  </div>
                </div>
              );
            })()}

            <button
              onClick={handleToggleProofMode}
              disabled={actionLoading === 'proof_mode' || isViewer}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition border ${
                worker.proofMode
                  ? 'bg-[#00ff84] text-black border-[#00ff84] font-bold'
                  : 'bg-slate-800 text-[#9ca3af] border-[#34333b] hover:bg-slate-700'
              } ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isViewer ? 'Operator passphrase required to toggle Proof Mode' : 'Toggle First-Trade Proof Mode'}
            >
              {worker.proofMode ? 'Proof Mode ON' : 'Proof Mode OFF'}
            </button>

            <button
              onClick={handleRunCycle}
              disabled={actionLoading === 'cycle' || isCircuitBreakerTripped || isViewer}
              className="px-4 py-2 bg-[#00ff84] hover:bg-[#00e576] text-black text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
              title={isViewer ? 'Operator passphrase required to execute cycles' : undefined}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {actionLoading === 'cycle' ? 'Executing Cycle...' : 'Run Cycle Now'}
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-[#9ca3af] hover:text-white rounded-lg border border-[#34333b] transition"
              title="Refresh Observability Snapshot"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Graph History (TradingView / Phantom Style with ON/OFF Toggle) */}
      <PortfolioGraphHistory
        currentEquity={account.equity}
        accountNumber={account.accountNumberMasked}
        onRefreshParent={fetchTelemetry}
      />

      {/* Auxiliary Telemetry Degradation Banner */}
      {telemetryStatus === 'DEGRADED' && degradedWarnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>System Degraded: Partial auxiliary telemetry latency ({degradedWarnings.join(' • ')})</span>
          </div>
        </div>
      )}

      {/* 2. Key Account & Portfolio Metrics (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e]">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider block">Broker Equity</span>
          <span className="text-lg font-bold text-white mt-1 block">
            {formatCurrency(account.equity)}
          </span>
          <span className="text-[10px] text-[#00ff84] flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" /> Confirmed Ground Truth
          </span>
        </div>

        <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e]">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider block">Available Cash</span>
          <span className="text-lg font-bold text-slate-200 mt-1 block">
            {formatCurrency(account.cash)}
          </span>
          <span className="text-[10px] text-[#2d3748] block mt-0.5">
            Buying Power: {formatCurrency(account.buyingPower)}
          </span>
        </div>

        <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e]">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider block">Gross Exposure</span>
          <span className="text-lg font-bold text-slate-200 mt-1 block">
            {account.grossExposurePct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-[#848388] block mt-0.5">
            {formatCurrency(account.grossExposureUsd)} / 50% max
          </span>
        </div>

        <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e]">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider block">Realized P&L (Gross)</span>
          <span className={`text-lg font-bold mt-1 block ${
            performance.portfolio.realizedPnLUsd > 0
              ? 'text-[#00ff84]'
              : performance.portfolio.realizedPnLUsd < 0
              ? 'text-[#ff3b5c]'
              : 'text-[#9ca3af]'
          }`}>
            {performance.portfolio.realizedPnLUsd >= 0 ? '+' : ''}{formatCurrency(performance.portfolio.realizedPnLUsd)}
          </span>
          <span className="text-[10px] text-[#2d3748] block mt-0.5">
            {performance.portfolio.totalPnLPct >= 0 ? '+' : ''}{performance.portfolio.totalPnLPct.toFixed(2)}% return
          </span>
        </div>

        <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e]">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider block">Total Realized R</span>
          <span className={`text-lg font-bold mt-1 block ${
            performance.trades.totalR > 0
              ? 'text-[#00ff84]'
              : performance.trades.totalR < 0
              ? 'text-[#ff3b5c]'
              : 'text-[#9ca3af]'
          }`}>
            {performance.trades.totalR >= 0 ? '+' : ''}{performance.trades.totalR.toFixed(2)}R
          </span>
          <span className="text-[10px] text-[#2d3748] block mt-0.5">
            Avg: {performance.trades.avgActualR >= 0 ? '+' : ''}{performance.trades.avgActualR.toFixed(2)}R / trade
          </span>
        </div>

        <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e]">
          <span className="text-[11px] font-semibold text-[#848388] uppercase tracking-wider block">Max Drawdown</span>
          <span className="text-lg font-bold text-amber-400 mt-1 block">
            {performance.portfolio.maxDrawdownPct.toFixed(2)}%
          </span>
          <span className="text-[10px] text-[#2d3748] block mt-0.5">
            Peak: {formatCurrency(performance.portfolio.peakEquityUsd)}
          </span>
        </div>
      </div>

      {/* 3. Phase 8.11: Live Alpha Calibration & Evidence Review Banner */}
      <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5 space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#28272e] pb-3">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Live Alpha Evidence & Diagnostic Review</h3>
              <p className="text-xs text-[#848388]">Statistical evaluation across live paper executions without synthetic data</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              verdict?.quality === 'PROMISING'
                ? 'bg-[#00ff84]/10 text-[#00ff84] border-[#00ff84]/20'
                : verdict?.quality === 'MEANINGFUL'
                ? 'bg-[#00ff84]/8 text-[#848388] border-indigo-500/30'
                : verdict?.quality === 'PRELIMINARY'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : verdict?.quality === 'NO_DEMONSTRATED_ALPHA'
                ? 'bg-rose-500/20 text-[#ff3b5c] border-rose-500/30'
                : 'bg-slate-800 text-[#848388] border-[#34333b]'
            }`}>
              VERDICT: {verdict?.quality || 'INSUFFICIENT'}
            </span>
          </div>
        </div>

        {verdict?.completedTrades === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Panel 1: Alpha Evidence (N=0) */}
            <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e] text-xs text-[#848388] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Clock className="w-4 h-4" />
                  <span>Realized Alpha Evidence (N = 0)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  INSUFFICIENT SAMPLE
                </span>
              </div>
              <p>
                The system is <strong className="text-slate-200">intentionally not fabricating performance evidence</strong>. Realized expectancy, win rate, and profit factor require broker-confirmed trade fills.
              </p>
              <div className="pt-2 border-t border-[#28272e]/80 flex items-center justify-between text-[11px] text-[#848388]">
                <span>Completed Trades: <strong className="text-white">0</strong></span>
                <span>Realized P&L: <strong className="text-white">$0.00</strong></span>
                <span>Total Realized R: <strong className="text-white">0.00R</strong></span>
              </div>
            </div>

            {/* Panel 2: Live Runtime Activity (Telemetry) */}
            <div className="bg-[#1f1e23] p-4 rounded-lg border border-[#28272e] text-xs text-[#848388] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#848388] font-bold text-sm">
                  <Activity className="w-4 h-4 text-[#848388]" />
                  <span>Live Runtime Activity</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00ff84]/8 text-[#00ff84] border border-[#00ff84]/20">
                  {worker.state}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-[#1f1e23] p-2 rounded-lg border border-[#28272e] text-center">
                  <span className="text-[10px] text-[#848388] block">Cycles Run</span>
                  <strong className="text-sm text-white font-mono">{session.totalCyclesExecuted}</strong>
                </div>
                <div className="bg-[#1f1e23] p-2 rounded-lg border border-[#28272e] text-center">
                  <span className="text-[10px] text-[#848388] block">Scanned</span>
                  <strong className="text-sm text-white font-mono">{currentCycle?.executionFunnel?.candidatesScanned ?? session.totalCandidatesScanned}</strong>
                </div>
                <div className="bg-[#1f1e23] p-2 rounded-lg border border-[#28272e] text-center">
                  <span className="text-[10px] text-[#848388] block">Filtered / Rej</span>
                  <strong className="text-sm text-amber-400 font-mono">
                    {(() => {
                      const scanned = currentCycle?.executionFunnel?.candidatesScanned ?? session.totalCandidatesScanned ?? 0;
                      const passed = currentCycle?.executionFunnel?.scoredAboveThreshold ?? 0;
                      return scanned - passed;
                    })()}
                  </strong>
                </div>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] text-[#2d3748] border-t border-[#28272e]/60">
                <span>Avg Opp Score: <strong className={`font-mono font-bold ${
                  avgOppScore == null ? 'text-[#848388]' :
                  avgOppScore >= funnelThresholds.minOpportunityScore ? 'text-[#00ff84]' :
                  avgOppScore >= 40 ? 'text-amber-400' : 'text-[#ff3b5c]'
                }`}>{avgOppScore != null ? `${avgOppScore}/100` : '--/100'}</strong></span>
                <span>Council Evals: <strong className="text-[#9ca3af]">{currentCycle?.executionFunnel?.councilEvaluated ?? recentDecisions.length}</strong></span>
                <span>Submitted: <strong className="text-[#9ca3af]">{currentCycle?.executionFunnel?.brokerSubmitted ?? session.totalOrdersSubmitted}</strong></span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#2d3748]">
                <span>Last Cycle: <strong className="text-[#848388]">{worker.lastCycleAt ? new Date(worker.lastCycleAt).toLocaleTimeString() : 'Active'}</strong></span>
                <span className="text-[10px] text-[#2d3748] font-mono">Cutoff: ≥{funnelThresholds.minOpportunityScore}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#1f1e23] p-3 rounded-lg border border-[#28272e] space-y-1">
              <span className="text-[10px] text-[#00ff84] font-bold uppercase tracking-wider block">Observed Strengths</span>
              <ul className="space-y-1 text-[#9ca3af]">
                {verdict?.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff84] shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#1f1e23] p-3 rounded-lg border border-[#28272e] space-y-1">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Observed Weaknesses</span>
              <ul className="space-y-1 text-[#9ca3af]">
                {verdict?.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#1f1e23] p-3 rounded-lg border border-[#28272e] space-y-1">
              <span className="text-[10px] text-[#848388] font-bold uppercase tracking-wider block">Advisory Recommendations</span>
              <ul className="space-y-1 text-[#9ca3af]">
                {verdict?.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-[#848388] shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 3c. Phase 8.26: Fair Candidate Rotation & Starvation Prevention */}
      <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#848388]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Candidate Rotation & Starvation Elimination</h3>
          </div>
          <span className="text-xs text-[#848388] font-mono">scanLimit = 5 • Deterministic Aging Active</span>
        </div>

        {currentCycle?.rotationTelemetry && currentCycle.rotationTelemetry.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#28272e] text-[#848388]">
                  <th className="pb-2 font-semibold">Priority Rank</th>
                  <th className="pb-2 font-semibold">Symbol</th>
                  <th className="pb-2 font-semibold">Opp Score</th>
                  <th className="pb-2 font-semibold">Cycles Waiting</th>
                  <th className="pb-2 font-semibold">Total Evals</th>
                  <th className="pb-2 font-semibold">Rotation Priority</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Deferral Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {currentCycle.rotationTelemetry.map((cand: any, idx: number) => (
                  <tr key={cand.symbol} className="hover:bg-slate-800/30">
                    <td className="py-2 text-[#848388] font-bold">#{cand.rank || idx + 1}</td>
                    <td className="py-2 font-bold text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      {cand.symbol}
                    </td>
                    <td className="py-2 text-[#9ca3af]">{cand.opportunityScore}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        cand.cyclesWaiting > 1 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-[#848388]'
                      }`}>
                        {cand.cyclesWaiting} cycles
                      </span>
                    </td>
                    <td className="py-2 text-[#848388]">{cand.evaluationCount}x</td>
                    <td className="py-2 text-purple-300 font-bold">{cand.rotationPriority}</td>
                    <td className="py-2">
                      {cand.selectedThisCycle ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20">
                          SELECTED (COUNCIL)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-[#848388]">
                          DEFERRED
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-[#848388] text-[11px] truncate max-w-xs">
                      {cand.selectedThisCycle ? 'Dispatched to AI Council' : (cand.deferReason || 'Awaiting priority window')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e]/60 text-xs text-[#848388] flex items-center justify-between">
            <span>Candidate rotation telemetry will populate during next autonomous cycle execution.</span>
            <span className="text-[#848388] font-mono font-bold">20-Universe Bounded</span>
          </div>
        )}
      </div>

      {/* 3b. Phase 8.19: Execution Funnel & Rejection Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Execution Funnel with Sliders */}
        <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00ff84]" /> Candidate Execution Funnel
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1f1e23] border border-[#28272e] text-xs font-mono">
                <span className="text-[#848388] text-[11px]">Avg Score:</span>
                <strong className={`font-bold ${
                  avgOppScore == null ? 'text-[#848388]' :
                  avgOppScore >= funnelThresholds.minOpportunityScore ? 'text-[#00ff84]' :
                  avgOppScore >= 40 ? 'text-amber-400' : 'text-[#ff3b5c]'
                }`}>
                  {avgOppScore != null ? `${avgOppScore}/100` : '--/100'}
                </strong>
              </div>
              <span className="text-xs text-[#848388] font-mono hidden sm:inline">Current / Last Cycle</span>
              <button
                onClick={() => setShowSliders(s => !s)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition ${
                  showSliders
                    ? 'bg-cyan-500/20 text-[#00ff84] border-cyan-500/40'
                    : 'bg-slate-800 text-[#848388] border-[#34333b] hover:border-slate-600'
                }`}
                title="Adjust filter thresholds"
              >
                <Sliders className="w-3 h-3" /> Adjust
              </button>
            </div>
          </div>

          {/* Threshold Sliders with Saved Presets (collapsible) */}
          {showSliders && (
            <div className="bg-[#1f1e23] border border-[#28272e] rounded-lg p-3 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#28272e]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#00ff84] font-semibold uppercase tracking-wider">
                    Live Filter Thresholds
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#848388] text-[11px]">Universe Avg Score:</span>
                  <strong className={`font-bold ${
                    avgOppScore == null ? 'text-[#848388]' :
                    avgOppScore >= funnelThresholds.minOpportunityScore ? 'text-[#00ff84]' :
                    avgOppScore >= 40 ? 'text-amber-400' : 'text-[#ff3b5c]'
                  }`}>
                    {avgOppScore != null ? `${avgOppScore}/100` : 'N/A'}
                  </strong>
                  <span className="text-[10px] text-[#2d3748]">vs Cutoff {funnelThresholds.minOpportunityScore}</span>
                </div>
              </div>

              {/* Presets Management Strip */}
              <div className="p-2.5 rounded-lg bg-[#17161b] border border-[#28272e] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-[#00ff84]" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                      Filter Presets
                    </span>
                    <span className="text-[10px] text-[#848388] font-mono">({presets.length})</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isCreatingPreset && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingPreset(true);
                          setNewPresetName('');
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#00ff84] text-black hover:bg-[#00e576] transition flex items-center gap-1 cursor-pointer"
                        title="Save current slider values as a new preset"
                      >
                        <Plus className="w-3 h-3" /> Save Preset
                      </button>
                    )}
                  </div>
                </div>

                {/* Create New Preset Form */}
                {isCreatingPreset && (
                  <form
                    onSubmit={handleSaveNewPreset}
                    className="flex items-center gap-1.5 pt-1 border-t border-[#28272e]"
                  >
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="Preset name (e.g. Weekend Volatility)..."
                      className="flex-1 bg-[#1f1e23] border border-[#28272e] focus:border-[#00ff84] rounded-lg px-2.5 py-1 text-xs text-white placeholder-[#848388] outline-none transition font-phantom"
                      autoFocus
                      maxLength={30}
                    />
                    <button
                      type="submit"
                      disabled={!newPresetName.trim()}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#00ff84] text-black hover:bg-[#00e576] disabled:opacity-40 transition flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingPreset(false)}
                      className="px-2 py-1 rounded-lg text-xs text-[#848388] hover:text-white transition"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {/* Presets List */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {presets.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    const isEditing = editingPresetId === preset.id;

                    if (isEditing) {
                      return (
                        <form
                          key={preset.id}
                          onSubmit={(e) => handleSaveEditName(preset.id, e)}
                          className="flex items-center gap-1 bg-[#1f1e23] border border-[#00ff84] rounded-lg px-2 py-0.5"
                        >
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-transparent text-xs text-white outline-none w-28 font-phantom"
                            autoFocus
                            maxLength={30}
                          />
                          <button
                            type="submit"
                            className="text-[#00ff84] text-xs font-bold hover:underline px-1"
                            title="Save name"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPresetId(null)}
                            className="text-[#848388] hover:text-white text-xs px-1"
                            title="Cancel"
                          >
                            ×
                          </button>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={preset.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition border group ${
                          isActive
                            ? 'bg-[#00ff84] text-black font-bold border-[#00ff84]'
                            : 'bg-[#1f1e23] text-[#848388] border-[#28272e] hover:text-white hover:border-[#34333b]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className="cursor-pointer text-left font-phantom"
                          title={`Apply "${preset.name}" preset`}
                        >
                          {preset.name}
                        </button>

                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                          {/* Rename button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPresetId(preset.id);
                              setEditingName(preset.name);
                            }}
                            className={`p-0.5 hover:scale-110 transition ${
                              isActive ? 'text-black hover:text-black/70' : 'text-[#848388] hover:text-white'
                            }`}
                            title="Rename this preset"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>

                          {/* Overwrite with current values */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdatePresetValues(preset.id);
                            }}
                            className={`p-0.5 hover:scale-110 transition ${
                              isActive ? 'text-black hover:text-black/70' : 'text-[#848388] hover:text-[#00ff84]'
                            }`}
                            title="Update preset with current slider numbers"
                          >
                            <Save className="w-2.5 h-2.5" />
                          </button>

                          {/* Delete custom preset */}
                          {!preset.isDefault && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePreset(preset.id);
                              }}
                              className={`p-0.5 hover:scale-110 transition ${
                                isActive ? 'text-black hover:text-[#ff3b5c]' : 'text-[#848388] hover:text-[#ff3b5c]'
                              }`}
                              title="Delete preset"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Liquidity Floor */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9ca3af]">Min Liquidity</span>
                  <span className="text-[#00ff84] font-mono font-bold">${(funnelThresholds.minLiquidityUsd / 1000).toFixed(0)}k</span>
                </div>
                <input
                  type="range"
                  min={0} max={2000000} step={50000}
                  value={funnelThresholds.minLiquidityUsd}
                  onChange={e => {
                    const next = { ...funnelThresholds, minLiquidityUsd: +e.target.value };
                    setFunnelThresholds(next);
                    pushThresholds(next);
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-slate-700"
                />
                <div className="flex justify-between text-[10px] text-slate-600"><span>$0</span><span>$2M</span></div>
              </div>

              {/* Max Spread */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9ca3af]">Max Spot Spread</span>
                  <span className="text-[#00ff84] font-mono font-bold">{funnelThresholds.maxSpreadBps} bps</span>
                </div>
                <input
                  type="range"
                  min={1} max={200} step={1}
                  value={funnelThresholds.maxSpreadBps}
                  onChange={e => {
                    const next = { ...funnelThresholds, maxSpreadBps: +e.target.value };
                    setFunnelThresholds(next);
                    pushThresholds(next);
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-slate-700"
                />
                <div className="flex justify-between text-[10px] text-slate-600"><span>1 bps</span><span>200 bps</span></div>
              </div>

              {/* Min Opportunity Score */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9ca3af]">Min Opportunity Score</span>
                  <span className="text-[#00ff84] font-mono font-bold">{funnelThresholds.minOpportunityScore}</span>
                </div>
                <input
                  type="range"
                  min={30} max={100} step={1}
                  value={funnelThresholds.minOpportunityScore}
                  onChange={e => {
                    const next = { ...funnelThresholds, minOpportunityScore: +e.target.value };
                    setFunnelThresholds(next);
                    pushThresholds(next);
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-slate-700"
                />
                <div className="flex justify-between text-[10px] text-slate-600"><span>30</span><span>100</span></div>
              </div>

              {/* Min AI Confidence */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9ca3af]">Min AI Confidence</span>
                  <span className="text-[#00ff84] font-mono font-bold">{funnelThresholds.minConfidenceScore}%</span>
                </div>
                <input
                  type="range"
                  min={30} max={100} step={1}
                  value={funnelThresholds.minConfidenceScore}
                  onChange={e => {
                    const next = { ...funnelThresholds, minConfidenceScore: +e.target.value };
                    setFunnelThresholds(next);
                    pushThresholds(next);
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-slate-700"
                />
                <div className="flex justify-between text-[10px] text-slate-600"><span>30%</span><span>100%</span></div>
              </div>

              {/* Min Risk/Reward */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9ca3af]">Min Risk / Reward Ratio</span>
                  <span className="text-[#00ff84] font-mono font-bold">{funnelThresholds.minRiskRewardRatio.toFixed(2)}R</span>
                </div>
                <input
                  type="range"
                  min={0.5} max={5} step={0.05}
                  value={funnelThresholds.minRiskRewardRatio}
                  onChange={e => {
                    const next = { ...funnelThresholds, minRiskRewardRatio: +parseFloat(e.target.value).toFixed(2) };
                    setFunnelThresholds(next);
                    pushThresholds(next);
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-slate-700"
                />
                <div className="flex justify-between text-[10px] text-slate-600"><span>0.50R</span><span>5.00R</span></div>
              </div>

              <button
                onClick={() => {
                  const defaults = { minLiquidityUsd: 500000, maxSpreadBps: 50, minOpportunityScore: 60, minConfidenceScore: 65, minRiskRewardRatio: 2.0 };
                  setFunnelThresholds(defaults);
                  pushThresholds(defaults);
                }}
                className="text-[10px] text-[#2d3748] hover:text-[#9ca3af] transition underline"
              >
                Reset to defaults
              </button>
            </div>
          )}

          {/* Funnel steps */}
          <div className="space-y-1.5">
            {[
              {
                label: '1. Discovery Scanned',
                count: currentCycle?.executionFunnel?.candidatesScanned ?? session?.totalCandidatesScanned ?? 20,
                threshold: null, color: 'bg-indigo-500'
              },
              {
                label: `2. Passed Liquidity (≥ $${(funnelThresholds.minLiquidityUsd / 1000).toFixed(0)}k)`,
                count: currentCycle?.executionFunnel?.passedLiquidity ?? session?.totalCandidatesScanned ?? 20,
                threshold: null, color: 'bg-blue-500'
              },
              {
                label: `3. Passed Spread (≤ ${funnelThresholds.maxSpreadBps} bps)`,
                count: currentCycle?.executionFunnel?.passedSpread ?? session?.totalCandidatesScanned ?? 20,
                threshold: null, color: 'bg-cyan-500'
              },
              {
                label: `4. Scored Above Threshold (≥ ${funnelThresholds.minOpportunityScore})`,
                count: currentCycle?.executionFunnel?.scoredAboveThreshold ?? (currentCycle?.candidatesEvaluated || 0),
                threshold: null, color: 'bg-emerald-500'
              },
              {
                label: '5. Council Evaluated',
                count: currentCycle?.executionFunnel?.councilEvaluated ?? (currentCycle?.candidatesEvaluated || 0),
                threshold: null, color: 'bg-yellow-500'
              },
              {
                label: '6. Council BUY Decision',
                count: currentCycle?.executionFunnel?.councilBuy ?? (recentDecisions?.filter((d: any) => d.action === 'BUY').length || 0),
                threshold: null, color: 'bg-amber-500'
              },
              {
                label: '7. Risk Gate Approved',
                count: currentCycle?.executionFunnel?.riskGatePassed ?? (recentDecisions?.filter((d: any) => d.riskStatus === 'PASS').length || 0),
                threshold: null, color: 'bg-orange-500'
              },
              {
                label: '8. Paper Order Submitted',
                count: currentCycle?.executionFunnel?.brokerSubmitted ?? session?.totalOrdersSubmitted ?? 0,
                threshold: null, color: 'bg-rose-500'
              },
              {
                label: '9. Position Monitored',
                count: currentCycle?.executionFunnel?.positionsMonitored ?? account?.openPositionCount ?? 0,
                threshold: null, color: 'bg-pink-500'
              }
            ].map((step, idx, arr) => {
              const maxCount = arr[0].count || 1;
              const barWidth = maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0;
              return (
                <div key={idx} className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9ca3af] font-medium">{step.label}</span>
                    <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-800 min-w-[2.5rem] text-center">{step.count}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${step.color}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rejection Distribution */}
        <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Rejection Reasons Distribution
            </h3>
            <span className="text-xs text-[#848388] font-mono">Why isn't the agent trading?</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Quant HOLD (Market Flat)', count: currentCycle?.rejectionDistribution?.quantHold ?? (recentDecisions?.filter((d: any) => d.rejectionStage === 'AI_HOLD').length ?? 0), color: 'text-amber-400' },
              { label: 'Score Below Threshold', count: currentCycle?.rejectionDistribution?.opportunityScore ?? (recentDecisions?.filter((d: any) => d.rejectionStage === 'SCORE_FILTER').length ?? 0), color: 'text-[#9ca3af]' },
              { label: 'Liquidity Filter (< $500k)', count: currentCycle?.rejectionDistribution?.liquidity ?? (recentDecisions?.filter((d: any) => d.rejectionStage === 'LIQUIDITY_FILTER').length ?? 0), color: 'text-blue-400' },
              { label: 'Spread Filter (> 50 bps)', count: currentCycle?.rejectionDistribution?.spread ?? (recentDecisions?.filter((d: any) => d.rejectionStage === 'SPREAD_FILTER').length ?? 0), color: 'text-[#ff3b5c]' },
              { label: 'Red Team PASS / Veto', count: currentCycle?.rejectionDistribution?.redTeamBlock ?? (recentDecisions?.filter((d: any) => d.rejectionStage === 'AI_PASS').length ?? 0), color: 'text-[#ff3b5c]' },
              { label: 'Risk Gate Block', count: currentCycle?.rejectionDistribution?.riskGate ?? (recentDecisions?.filter((d: any) => d.rejectionStage === 'RISK_GATE').length ?? 0), color: 'text-amber-400' },
              { label: 'Position Sizing Cap', count: currentCycle?.rejectionDistribution?.positionSizing ?? (recentDecisions?.filter((d: any) => d.rejectionStage === 'POSITION_SIZING').length ?? 0), color: 'text-[#848388]' },
              { label: 'Max Positions Reached', count: currentCycle?.rejectionDistribution?.maxPositions ?? (recentDecisions?.filter((d: any) => d.rejectionStage === 'MAX_POSITIONS').length ?? 0), color: 'text-[#848388]' }
            ].map((reason, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-[#1f1e23] border border-[#28272e]/60 flex flex-col justify-between gap-1">
                <span className="text-[11px] text-[#848388]">{reason.label}</span>
                <span className={`text-base font-bold font-mono ${reason.color}`}>{reason.count}</span>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-[#17161b] border border-[#28272e] text-[11px] text-[#8b8a91]">
            <strong className="text-white">Capital Preservation:</strong> The autonomous engine only deploys capital when all quantitative and qualitative gates confirm positive expectancy.
          </div>
        </div>
      </div>

      {/* 4. Phase 8.12: Live Journal Event Stream */}
      <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#00ff84] animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Paper Event Journal Stream</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#848388]">
            <span>Heartbeat: <strong className="text-[#00ff84]">{heartbeat?.workerStatus || worker.state}</strong></span>
            <span>Recorded Events: <strong className="text-white">{events.length}</strong></span>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-6 text-[#2d3748] text-xs bg-[#1f1e23] rounded-lg border border-[#28272e]/60">
            No events recorded yet in current paper session.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {events.slice(-15).reverse().map(evt => (
              <div key={evt.eventId} className="flex items-center justify-between p-2 bg-[#1f1e23] rounded-lg border border-[#28272e]/80 text-xs font-mono">
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-[#2d3748] text-[11px]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    evt.type.includes('COMPLETED') || evt.type.includes('FILLED')
                      ? 'bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20'
                      : evt.type.includes('FAILED') || evt.type.includes('REJECTED') || evt.type.includes('BLOCKED')
                      ? 'bg-rose-500/20 text-[#ff3b5c] border border-rose-500/30'
                      : evt.type.includes('STARTED') || evt.type.includes('SUBMITTED')
                      ? 'bg-[#00ff84]/8 text-[#848388] border border-indigo-500/30'
                      : 'bg-slate-800 text-[#9ca3af]'
                  }`}>
                    {evt.type}
                  </span>
                  {evt.symbol && <span className="text-white font-bold">{evt.symbol}</span>}
                </div>
                <span className="text-[#848388] text-[11px] truncate max-w-xs ml-2">
                  {evt.payload?.durationMs ? `${evt.payload.durationMs}ms • ${evt.payload.candidatesScanned || 0} scanned` : evt.payload?.status || evt.payload?.error || evt.payload?.environment || ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Active Positions & Invalidation Stops */}
      <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#00ff84]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Open Positions ({openTrades.length})</h3>
          </div>
          <span className="text-xs text-[#848388]">Enforced 25% single-asset risk cap</span>
        </div>

        {openTrades.length === 0 ? (
          <div className="text-center py-6 text-[#2d3748] text-xs bg-[#1f1e23] rounded-lg border border-[#28272e]/60">
            Zero open positions. Autonomous engine is in cash preservation mode.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#28272e] text-[#848388]">
                  <th className="pb-2 font-semibold">Symbol</th>
                  <th className="pb-2 font-semibold">Asset Class</th>
                  <th className="pb-2 font-semibold">Strategy</th>
                  <th className="pb-2 font-semibold text-right">Quantity</th>
                  <th className="pb-2 font-semibold text-right">Entry Price</th>
                  <th className="pb-2 font-semibold text-right">Target Price</th>
                  <th className="pb-2 font-semibold text-right">Invalidation Stop</th>
                  <th className="pb-2 font-semibold text-right">Initial Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {openTrades.map(trade => (
                  <tr key={trade.tradeId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-bold text-white">{trade.symbol}</td>
                    <td className="py-2.5 text-[#848388]">{trade.assetClass}</td>
                    <td className="py-2.5 text-[#848388] font-mono text-[11px]">{trade.strategy}</td>
                    <td className="py-2.5 text-right text-[#9ca3af]">{trade.actualFilledQuantity ?? trade.approvedQuantity}</td>
                    <td className="py-2.5 text-right text-[#9ca3af]">{formatCurrency(trade.actualFillPrice ?? trade.entryPrice)}</td>
                    <td className="py-2.5 text-right text-[#00ff84] font-semibold">{formatCurrency(trade.targetPrice)}</td>
                    <td className="py-2.5 text-right text-[#ff3b5c] font-semibold">{formatCurrency(trade.invalidationPrice)}</td>
                    <td className="py-2.5 text-right text-[#848388]">{formatCurrency(trade.initialRiskAmountUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Rejection Funnel & Candidate Filter Diagnostics */}
      <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#848388]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Session Rejection Funnel Analysis (Observed Candidate Screenings)</h3>
          </div>
          <span className="text-xs text-[#848388]">Total Scanned: <strong className="text-white">{alphaSnapshot?.rejectionAnalysis.totalScanned || session.totalCandidatesScanned}</strong></span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs mb-4">
          {alphaSnapshot?.rejectionAnalysis.stages.map(s => (
            <div key={s.stage} className="bg-[#1f1e23] p-2.5 rounded-lg border border-[#28272e] text-center">
              <span className="text-[10px] text-[#848388] font-mono block truncate" title={s.stage}>{s.stage}</span>
              <span className="text-sm font-bold text-white mt-0.5 block">{s.count}</span>
              <span className="text-[10px] text-[#2d3748]">{s.percentageOfScanned.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        {/* Interactive Filter Pills */}
        {(() => {
          const isCryptoDec = (d: { symbol: string; assetClass?: string }) => {
            if (d.assetClass === 'CRYPTO') return true;
            if (d.assetClass === 'EQUITY' || d.symbol.includes('EQUITIES')) return false;
            const sym = d.symbol.toUpperCase().replace(/^\$/, '').trim();
            return sym.includes('/') || [
              'BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'DOGE', 'UNI', 'DOT', 'NEAR', 'LTC',
              'XRP', 'AAVE', 'HYPE', 'RENDER', 'SUI', 'BNB', 'FET', 'TAO', 'ZEC', 'TXL',
              'ADA', 'PEPE', 'BONK', 'WIF', 'ONDO', 'BCH', 'BAT', 'SHIB', 'CRV', 'SUSHI',
              'FIL', 'MKR', 'ATOM', 'GRT', 'LDO', 'SKY', 'TRX', 'USDT', 'ARB', 'POL'
            ].includes(sym);
          };

          const isAIDec = (d: any) => {
            return d.action === 'BUY' || d.action === 'HOLD' || d.rejectionStage === 'AI_PASS' || d.rejectionStage === 'AI_HOLD' || d.rejectionStage === 'RISK_GATE' || (d.aiConfidence != null && d.aiConfidence > 0);
          };

          const cryptoCount = recentDecisions.filter(isCryptoDec).length;
          const aiCount = recentDecisions.filter(isAIDec).length;
          const scoreFilterCount = recentDecisions.filter(d => d.rejectionStage === 'SCORE_FILTER').length;
          const equityCount = recentDecisions.filter(d => !isCryptoDec(d)).length;

          const filteredDecisions = recentDecisions.filter(d => {
            if (rejectionFilter === 'CRYPTO') return isCryptoDec(d);
            if (rejectionFilter === 'EQUITY') return !isCryptoDec(d);
            if (rejectionFilter === 'AI_DECISIONS') return isAIDec(d);
            if (rejectionFilter === 'SCORE_FILTER') return d.rejectionStage === 'SCORE_FILTER';
            return true;
          });

          return (
            <>
              <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 text-xs">
                <span className="text-[#2d3748] text-[11px] font-semibold">Filter View:</span>
                {[
                  { id: 'ALL', label: `All (${recentDecisions.length})` },
                  { id: 'CRYPTO', label: `Crypto (${cryptoCount})` },
                  { id: 'AI_DECISIONS', label: `AI / Risk Gate (${aiCount})` },
                  { id: 'SCORE_FILTER', label: `Score Filter (${scoreFilterCount})` },
                  { id: 'EQUITY', label: `Equities (${equityCount})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRejectionFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 ${
                      rejectionFilter === tab.id
                        ? 'bg-[#00ff84] text-black font-bold'
                        : 'bg-[#17161b] text-[#848388] border border-[#28272e] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredDecisions.length === 0 ? (
                <div className="text-center py-4 text-[#2d3748] text-xs bg-[#1f1e23] rounded-lg border border-[#28272e]/60">
                  No matching candidate decisions recorded for this filter view.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#28272e] text-[#848388]">
                        <th className="pb-2 font-semibold">Timestamp</th>
                        <th className="pb-2 font-semibold">Symbol</th>
                        <th className="pb-2 font-semibold">Action</th>
                        <th className="pb-2 font-semibold text-center">Score</th>
                        <th className="pb-2 font-semibold text-center">Confidence</th>
                        <th className="pb-2 font-semibold text-center">R:R</th>
                        <th className="pb-2 font-semibold">Diagnostic Reason / AI Thesis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredDecisions.slice(-50).reverse().map((dec, idx) => (
                    <tr key={`${dec.cycleId}-${dec.symbol}-${idx}`} className="hover:bg-slate-800/40">
                      <td className="py-2 text-[11px] text-[#2d3748] font-mono">{new Date(dec.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 font-bold text-white flex items-center gap-1.5">
                        <span>{dec.symbol}</span>
                        {dec.action === 'BUY' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          dec.action === 'BUY'
                            ? 'bg-[#00ff84]/10 text-[#00ff84] border border-[#00ff84]/20'
                            : dec.action === 'HOLD'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-[#848388]'
                        }`}>
                          {dec.action}
                        </span>
                      </td>
                      <td className="py-2 text-center text-[#9ca3af] font-mono">{dec.opportunityScore ?? '—'}/100</td>
                      <td className="py-2 text-center text-[#9ca3af] font-mono">{dec.aiConfidence ? `${dec.aiConfidence}%` : '—'}</td>
                      <td className="py-2 text-center text-[#9ca3af] font-mono">{dec.estimatedRiskReward ? `${dec.estimatedRiskReward.toFixed(1)}R` : '—'}</td>
                      <td className="py-2 text-[#848388] max-w-md">
                        {dec.thesisSummary ? (
                          <div className="space-y-0.5">
                            <span className="text-[#00ff84] text-[11px] block font-medium">
                              🎯 AI Thesis: {dec.thesisSummary}
                            </span>
                          </div>
                        ) : dec.rejectionReason ? (
                          <span className="text-amber-400/90 text-[11px] block">
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 mr-1 text-[10px] font-mono">
                              {dec.rejectionStage}
                            </span>
                            {dec.rejectionReason}
                          </span>
                        ) : (
                          <span className="text-[#00ff84] text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Approved by Risk Gate
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      );
    })()}
      </div>

      {/* 6. Multi-Factor Attribution & Calibration Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        
        {/* Attribution Breakdown */}
        <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00ff84]" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Multi-Dimensional Attribution</h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-4 border-b border-[#28272e] pb-2">
            {(['strategy', 'regime', 'asset', 'confidence', 'factors'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveAttributionTab(tab)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  activeAttributionTab === tab
                    ? 'bg-[#00ff84] text-black font-bold'
                    : 'text-[#8b8a91] hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {activeAttributionTab === 'strategy' && (strategyReview?.strategyReviews || attribution.byStrategy).map((g: any) => {
              const stratName = g.strategy;
              const n = g.sampleSize ?? g.metrics?.trades ?? 0;
              const winRate = g.winRate ?? g.metrics?.winRate ?? 0;
              const pnl = g.expectancyUsd ?? g.metrics?.totalPnLUsd ?? 0;
              const pf = g.profitFactor ?? 0;
              const avgR = g.avgActualR ?? g.metrics?.avgActualR ?? 0;
              const status = g.advisoryStatus ?? 'INSUFFICIENT_EVIDENCE';

              return (
                <div key={stratName} className="flex items-center justify-between p-2.5 bg-[#1f1e23] rounded-lg border border-[#28272e]/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-mono">{stratName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-[#848388] font-mono">
                      {status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#9ca3af]">
                    <span>{n} trades</span>
                    <span>Win: {(winRate * 100).toFixed(0)}%</span>
                    <span className={pnl >= 0 ? 'text-[#00ff84] font-semibold' : 'text-[#ff3b5c] font-semibold'}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                    <span>PF: {pf > 0 ? pf.toFixed(2) : '—'}</span>
                    <span className="text-[#848388]">{avgR.toFixed(1)}R</span>
                  </div>
                </div>
              );
            })}

            {activeAttributionTab === 'regime' && attribution.byRegime.map(g => (
              <div key={g.regime} className="flex items-center justify-between p-2.5 bg-[#1f1e23] rounded-lg border border-[#28272e]/80 text-xs">
                <span className="font-bold text-white">{g.regime}</span>
                <div className="flex items-center gap-2 text-[#9ca3af]">
                  <span>{g.metrics.trades} trades</span>
                  <span>Win: {(g.metrics.winRate * 100).toFixed(0)}%</span>
                  <span className={g.metrics.totalPnLUsd >= 0 ? 'text-[#00ff84] font-semibold' : 'text-[#ff3b5c] font-semibold'}>
                    {g.metrics.totalPnLUsd >= 0 ? '+' : ''}{formatCurrency(g.metrics.totalPnLUsd)}
                  </span>
                </div>
              </div>
            ))}

            {activeAttributionTab === 'asset' && attribution.byAssetClass.map(g => (
              <div key={g.assetClass} className="flex items-center justify-between p-2.5 bg-[#1f1e23] rounded-lg border border-[#28272e]/80 text-xs">
                <span className="font-bold text-white">{g.assetClass}</span>
                <div className="flex items-center gap-2 text-[#9ca3af]">
                  <span>{g.metrics.trades} trades</span>
                  <span>Win: {(g.metrics.winRate * 100).toFixed(0)}%</span>
                  <span className={g.metrics.totalPnLUsd >= 0 ? 'text-[#00ff84] font-semibold' : 'text-[#ff3b5c] font-semibold'}>
                    {g.metrics.totalPnLUsd >= 0 ? '+' : ''}{formatCurrency(g.metrics.totalPnLUsd)}
                  </span>
                </div>
              </div>
            ))}

            {activeAttributionTab === 'confidence' && attribution.byConfidenceBucket.map(g => (
              <div key={g.confidenceBucket} className="flex items-center justify-between p-2.5 bg-[#1f1e23] rounded-lg border border-[#28272e]/80 text-xs">
                <span className="font-bold text-white">Confidence {g.confidenceBucket}%</span>
                <div className="flex items-center gap-2 text-[#9ca3af]">
                  <span>{g.metrics.trades} trades</span>
                  <span>Win: {(g.metrics.winRate * 100).toFixed(0)}%</span>
                  <span className={g.metrics.totalPnLUsd >= 0 ? 'text-[#00ff84] font-semibold' : 'text-[#ff3b5c] font-semibold'}>
                    {g.metrics.totalPnLUsd >= 0 ? '+' : ''}{formatCurrency(g.metrics.totalPnLUsd)}
                  </span>
                </div>
              </div>
            ))}

            {activeAttributionTab === 'factors' && attribution.byFactor.slice(0, 4).map(f => (
              <div key={f.factor} className="p-2.5 bg-[#1f1e23] rounded-lg border border-[#28272e]/80 text-xs space-y-1.5">
                <span className="font-bold text-[#848388] capitalize">{f.factor} Factor</span>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-[#848388] pt-1">
                  <div>High (≥70): <strong className="text-white">{f.highLevel.trades}</strong> trd ({f.highLevel.winRate * 100}%)</div>
                  <div>Med (40-69): <strong className="text-white">{f.mediumLevel.trades}</strong> trd ({f.mediumLevel.winRate * 100}%)</div>
                  <div>Low (&lt;40): <strong className="text-white">{f.lowLevel.trades}</strong> trd ({f.lowLevel.winRate * 100}%)</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence & Opportunity Calibration Diagnostics */}
        <div className="bg-[#1f1e23] rounded-lg border border-[#28272e] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Calibration Diagnostics</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-[#848388] rounded-full border border-indigo-500/20 font-mono">
                {strategyReview?.calibrationReview.confidenceMonotonicity || 'INSUFFICIENT_SAMPLE'}
              </span>
              <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded-full border border-amber-500/20 font-bold">
                READ-ONLY ADVISORY
              </span>
            </div>
          </div>

          <p className="text-xs text-[#848388] mb-4">
            Calibration diagnostic rules enforce sample size <strong className="text-white">N ≥ 20</strong> before generating actionable threshold recommendations. Production configuration is strictly immutable.
          </p>

          <div className="space-y-3">
            {calibration.recommendations.map(rec => (
              <div key={rec.parameter} className="p-3 bg-[#1f1e23] rounded-lg border border-[#28272e] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono">{rec.parameter}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    rec.state === 'INSUFFICIENT_EVIDENCE'
                      ? 'bg-slate-800 text-[#848388]'
                      : rec.state === 'KEEP'
                      ? 'bg-[#00ff84]/8 text-[#00ff84] border border-[#00ff84]/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {rec.state}
                  </span>
                </div>
                <p className="text-[11px] text-[#848388]">{rec.evidence}</p>
                <div className="text-[10px] text-[#2d3748]">Current parameter value: <strong className="text-[#9ca3af]">{rec.currentValue}</strong> (Sample: {rec.sampleSize} trades)</div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
