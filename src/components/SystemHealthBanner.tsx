'use client';
import React from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { SystemHealthState } from '@/lib/types';

interface SystemHealthBannerProps {
  systemHealth: SystemHealthState;
  isStale: boolean;
  consecutiveFailures: number;
  lastSuccessfulSyncAt: string | null;
  onManualRefresh: () => void;
  isRefreshing: boolean;
}

export const SystemHealthBanner: React.FC<SystemHealthBannerProps> = ({
  systemHealth,
  isStale,
  consecutiveFailures,
  lastSuccessfulSyncAt,
  onManualRefresh,
  isRefreshing
}) => {
  if (systemHealth === 'ONLINE' && !isStale) return null;
  const isOffline = systemHealth === 'OFFLINE';

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 px-4 py-1.5 text-[11px] mono-num"
      style={{
        background: isOffline ? 'rgba(255,59,92,0.08)' : 'rgba(245,158,11,0.06)',
        borderBottom: `1px solid ${isOffline ? 'rgba(255,59,92,0.3)' : 'rgba(245,158,11,0.25)'}`,
        color: isOffline ? '#ff3b5c' : '#f59e0b',
      }}
    >
      <div className="flex items-center gap-2">
        {isOffline ? <WifiOff className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
        <span className="font-semibold tracking-wide uppercase text-[10px]">
          {isOffline ? 'OFFLINE' : isStale ? 'STALE DATA' : 'DEGRADED'}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>·</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>
          {isOffline ? 'Network or broker connection lost' : 'Displaying cached telemetry'}
        </span>
        {lastSuccessfulSyncAt && (
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>· Last sync {new Date(lastSuccessfulSyncAt).toLocaleTimeString()}</span>
        )}
        {consecutiveFailures > 0 && (
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>· {consecutiveFailures} {consecutiveFailures === 1 ? 'failure' : 'failures'}</span>
        )}
      </div>
      <button
        onClick={onManualRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded font-semibold transition disabled:opacity-40"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
      >
        <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Reconnecting...' : 'Retry'}
      </button>
    </div>
  );
};
