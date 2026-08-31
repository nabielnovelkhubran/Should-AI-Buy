import { ScanResult, DispatchSummary } from '../types';
import { MonitoringCycleResult } from '../monitoring/types';

// ---------------------------------------------------------------------------
// Phase 6D: Scheduled Automation & Orchestration Domain Types
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// ---------------------------------------------------------------------------

export type AutomationJobType = 'DISCOVERY' | 'MONITORING';

export type AutomationJobStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'
  | 'SKIPPED';

export type AutomationSchedulerStatus = 'STOPPED' | 'IDLE' | 'RUNNING' | 'ERROR';

export interface DiscoveryCycleConfig {
  enabled: boolean;
  intervalMs: number; // e.g. 60000 (1 min default in dev)
  scanLimit?: number; // e.g. 5
  autoDispatch?: boolean; // default true
  executeTrades?: boolean; // default false (evaluates candidates without auto-buying)
}

export interface MonitoringCycleConfig {
  enabled: boolean;
  intervalMs: number; // e.g. 30000 (30 sec default in dev)
  executeExits?: boolean; // default true (submits paper exit when thesis is invalidated)
}

export interface AutomationConfig {
  enabled: boolean;
  discovery: DiscoveryCycleConfig;
  monitoring: MonitoringCycleConfig;
}

export interface DiscoveryCycleResult {
  scanResult: ScanResult;
  queuedCount: number;
  dispatchSummary?: DispatchSummary;
  durationMs: number;
  completedAt: string;
}

export interface AutomationRun {
  runId: string;
  jobType: AutomationJobType;
  trigger: 'SCHEDULED' | 'MANUAL';
  status: AutomationJobStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  discoveryResult?: DiscoveryCycleResult;
  monitoringResult?: MonitoringCycleResult;
  error?: string;
  skippedReason?: string;
}

export interface AutomationAuditEvent {
  timestamp: string;
  event: string;
  jobType?: AutomationJobType;
  runId?: string;
  message: string;
  details?: Record<string, any>;
}

export interface AutomationMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  skippedRuns: number;
  lastDiscoveryDurationMs?: number;
  lastMonitoringDurationMs?: number;
}

export interface AutomationStatus {
  schedulerStatus: AutomationSchedulerStatus;
  config: AutomationConfig;
  activeJobs: Record<AutomationJobType, boolean>;
  lastRun: Partial<Record<AutomationJobType, AutomationRun>>;
  nextRun: Partial<Record<AutomationJobType, string>>;
  recentRuns: AutomationRun[];
  metrics: AutomationMetrics;
  auditTrail: AutomationAuditEvent[];
  environment: 'PAPER';
}

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  enabled: true,
  discovery: {
    enabled: true,
    intervalMs: 60000, // 1 minute
    scanLimit: 5,
    autoDispatch: true,
    executeTrades: false
  },
  monitoring: {
    enabled: true,
    intervalMs: 30000, // 30 seconds
    executeExits: true
  }
};
