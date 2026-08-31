import {
  AutomationConfig,
  AutomationStatus,
  AutomationSchedulerStatus,
  AutomationJobType,
  AutomationRun,
  AutomationAuditEvent,
  AutomationMetrics,
  DEFAULT_AUTOMATION_CONFIG
} from './types';
import { AutomationCoordinator, automationCoordinator } from './coordinator';

// ---------------------------------------------------------------------------
// Phase 6D: Automation Scheduler
// Manages automated cycle intervals, state machine, idempotency, and audit trails.
// INVARIANT: Concurrency protection prevents duplicate timer loops or overlapping jobs.
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// ---------------------------------------------------------------------------

export class AutomationScheduler {
  private coordinator: AutomationCoordinator;
  private config: AutomationConfig;
  private status: AutomationSchedulerStatus = 'STOPPED';
  private discoveryTimer: any = null;
  private monitoringTimer: any = null;

  private lastRun: Partial<Record<AutomationJobType, AutomationRun>> = {};
  private nextRun: Partial<Record<AutomationJobType, string>> = {};
  private recentRuns: AutomationRun[] = [];
  private auditTrail: AutomationAuditEvent[] = [];
  private metrics: AutomationMetrics = {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    skippedRuns: 0
  };

  constructor(
    coordinator: AutomationCoordinator = automationCoordinator,
    config: AutomationConfig = DEFAULT_AUTOMATION_CONFIG
  ) {
    this.coordinator = coordinator;
    this.config = { ...DEFAULT_AUTOMATION_CONFIG, ...config };
  }

  /**
   * Starts the automation scheduler (Idempotent).
   */
  start(): void {
    if (this.status === 'RUNNING') {
      return; // Idempotent: already running, do not spawn duplicate timer loops
    }

    this.status = 'RUNNING';
    const now = Date.now();

    this.recordAudit({
      timestamp: new Date(now).toISOString(),
      event: 'SCHEDULER_STARTED',
      message: 'Automation scheduler started in PAPER trading mode.'
    });

    // Schedule Discovery Job
    if (this.config.discovery.enabled) {
      const interval = Math.max(5000, this.config.discovery.intervalMs);
      this.nextRun.DISCOVERY = new Date(now + interval).toISOString();

      this.discoveryTimer = setInterval(async () => {
        await this.executeJob('DISCOVERY', 'SCHEDULED');
        if (this.status === 'RUNNING') {
          this.nextRun.DISCOVERY = new Date(Date.now() + interval).toISOString();
        }
      }, interval);
    }

    // Schedule Monitoring Job
    if (this.config.monitoring.enabled) {
      const interval = Math.max(5000, this.config.monitoring.intervalMs);
      this.nextRun.MONITORING = new Date(now + interval).toISOString();

      this.monitoringTimer = setInterval(async () => {
        await this.executeJob('MONITORING', 'SCHEDULED');
        if (this.status === 'RUNNING') {
          this.nextRun.MONITORING = new Date(Date.now() + interval).toISOString();
        }
      }, interval);
    }
  }

  /**
   * Stops the automation scheduler (Idempotent).
   */
  stop(): void {
    if (this.status === 'STOPPED') {
      return; // Idempotent
    }

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.status = 'STOPPED';
    this.nextRun = {};

    this.recordAudit({
      timestamp: new Date().toISOString(),
      event: 'SCHEDULER_STOPPED',
      message: 'Automation scheduler stopped.'
    });
  }

  /**
   * Immediately executes a job manually using the exact same coordinator execution path.
   */
  async runNow(jobType: AutomationJobType): Promise<AutomationRun> {
    this.recordAudit({
      timestamp: new Date().toISOString(),
      event: 'MANUAL_TRIGGER',
      jobType,
      message: `Manual execution triggered for ${jobType}.`
    });

    return await this.executeJob(jobType, 'MANUAL');
  }

  /**
   * Internal job execution handler.
   */
  private async executeJob(
    jobType: AutomationJobType,
    trigger: 'SCHEDULED' | 'MANUAL'
  ): Promise<AutomationRun> {
    let run: AutomationRun;

    if (jobType === 'DISCOVERY') {
      run = await this.coordinator.runDiscoveryCycle(this.config.discovery, trigger);
    } else {
      run = await this.coordinator.runMonitoringCycle(this.config.monitoring, trigger);
    }

    // Update Metrics & History
    this.metrics.totalRuns++;
    if (run.status === 'COMPLETED') {
      this.metrics.successfulRuns++;
      if (jobType === 'DISCOVERY') {
        this.metrics.lastDiscoveryDurationMs = run.durationMs;
      } else {
        this.metrics.lastMonitoringDurationMs = run.durationMs;
      }
    } else if (run.status === 'FAILED') {
      this.metrics.failedRuns++;
    } else if (run.status === 'SKIPPED') {
      this.metrics.skippedRuns++;
    }

    this.lastRun[jobType] = run;
    this.recentRuns.unshift(run);
    if (this.recentRuns.length > 50) {
      this.recentRuns.pop();
    }

    this.recordAudit({
      timestamp: run.completedAt || run.startedAt,
      event: `JOB_${run.status}`,
      jobType,
      runId: run.runId,
      message: `${jobType} run (${trigger}) finished with status ${run.status} in ${run.durationMs}ms.`
    });

    return run;
  }

  /**
   * Updates configuration and safely restarts timers if currently active.
   */
  updateConfig(newConfig: Partial<AutomationConfig>): AutomationConfig {
    const wasRunning = this.status === 'RUNNING';
    if (wasRunning) {
      this.stop();
    }

    this.config = {
      ...this.config,
      ...newConfig,
      discovery: { ...this.config.discovery, ...(newConfig.discovery || {}) },
      monitoring: { ...this.config.monitoring, ...(newConfig.monitoring || {}) }
    };

    this.recordAudit({
      timestamp: new Date().toISOString(),
      event: 'CONFIG_UPDATED',
      message: 'Automation configuration updated.',
      details: { config: this.config }
    });

    if (wasRunning) {
      this.start();
    }

    return this.config;
  }

  /**
   * Returns a complete real-time status snapshot.
   */
  getStatus(): AutomationStatus {
    return {
      schedulerStatus: this.status,
      config: { ...this.config },
      activeJobs: {
        DISCOVERY: this.coordinator.isJobActive('DISCOVERY'),
        MONITORING: this.coordinator.isJobActive('MONITORING')
      },
      lastRun: { ...this.lastRun },
      nextRun: { ...this.nextRun },
      recentRuns: [...this.recentRuns],
      metrics: { ...this.metrics },
      auditTrail: [...this.auditTrail],
      environment: 'PAPER'
    };
  }

  private recordAudit(event: AutomationAuditEvent): void {
    this.auditTrail.unshift(event);
    if (this.auditTrail.length > 100) {
      this.auditTrail.pop();
    }
  }

  clear(): void {
    this.stop();
    this.lastRun = {};
    this.nextRun = {};
    this.recentRuns = [];
    this.auditTrail = [];
    this.metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0
    };
  }
}

/** Singleton instance of AutomationScheduler */
export const automationScheduler = new AutomationScheduler();
