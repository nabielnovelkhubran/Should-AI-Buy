// ---------------------------------------------------------------------------
// Phase 8B: System Health & Degraded State Domain Models
// INVARIANT: Stale data must always be explicitly labeled. Stale broker
// state can never authorize an order. Never present stale state as current.
// ---------------------------------------------------------------------------

export type SystemHealthState = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

export interface SubsystemHealth {
  broker: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  marketData: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  automation: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  lastCheckedAt: string;
  degradedReason?: string;
}

export interface StaleStateWrapper<T> {
  data: T;
  isStale: boolean;
  staleReason?: string;
  retrievedAt: string;
  expiresAt?: string;
}

export interface SystemStatusSummary {
  overall: SystemHealthState;
  environment: 'PAPER';
  isOnline: boolean;
  subsystems: SubsystemHealth;
  activeAlertsCount: number;
  lastSuccessfulSyncAt: string;
  consecutiveFailures: number;
}

/**
 * Checks if a cached timestamp is considered stale based on max age in milliseconds.
 */
export function isDataStale(retrievedAtIso: string, maxAgeMs = 60000): boolean {
  if (!retrievedAtIso) return true;
  const retrievedTime = new Date(retrievedAtIso).getTime();
  if (isNaN(retrievedTime)) return true;
  return Date.now() - retrievedTime > maxAgeMs;
}

/**
 * Wraps arbitrary domain data in a StaleStateWrapper with deterministic timestamping.
 */
export function wrapWithStaleCheck<T>(data: T, retrievedAtIso: string, maxAgeMs = 60000, reason = 'Data exceeded freshness threshold.'): StaleStateWrapper<T> {
  const stale = isDataStale(retrievedAtIso, maxAgeMs);
  return {
    data,
    isStale: stale,
    staleReason: stale ? reason : undefined,
    retrievedAt: retrievedAtIso
  };
}
