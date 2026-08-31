import {
  AutomationJobType,
  AutomationRun,
  DiscoveryCycleConfig,
  MonitoringCycleConfig,
  DiscoveryCycleResult
} from './types';
import { scanOpportunities } from '../scanner';
import { CandidateQueue, candidateQueue } from '../queue';
import { CouncilDispatcher, councilDispatcher } from '../dispatcher';
import { PositionMonitoringService, positionMonitoringService } from '../monitoring';
import { MonitoringCycleResult } from '../monitoring/types';

// ---------------------------------------------------------------------------
// Phase 6D: Automation Coordinator
// Orchestrates existing Discovery (5A-5C) and Monitoring (6B-6C) subsystems.
// INVARIANT: Concurrency locks prevent overlapping runs of the same job type.
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// ---------------------------------------------------------------------------

export class AutomationCoordinator {
  private queue: CandidateQueue;
  private dispatcher: CouncilDispatcher;
  private monitoringService: PositionMonitoringService;
  private activeRuns: Map<AutomationJobType, boolean> = new Map();

  constructor(
    queue: CandidateQueue = candidateQueue,
    dispatcher: CouncilDispatcher = councilDispatcher,
    monitoringService: PositionMonitoringService = positionMonitoringService
  ) {
    this.queue = queue;
    this.dispatcher = dispatcher;
    this.monitoringService = monitoringService;
    this.activeRuns.set('DISCOVERY', false);
    this.activeRuns.set('MONITORING', false);
  }

  isJobActive(jobType: AutomationJobType): boolean {
    return this.activeRuns.get(jobType) === true;
  }

  /**
   * Executes one complete discovery cycle (Scan -> Queue -> Dispatch).
   */
  async runDiscoveryCycle(
    config?: Partial<DiscoveryCycleConfig>,
    trigger: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'
  ): Promise<AutomationRun> {
    const startTime = Date.now();
    const isoStart = new Date(startTime).toISOString();
    const timeBucket = isoStart.replace(/[:.]/g, '-');
    const runId = `RUN-DISCOVERY-${timeBucket}`;

    // 1. Concurrency Protection (Prevent Overlapping Runs)
    if (this.isJobActive('DISCOVERY')) {
      return {
        runId,
        jobType: 'DISCOVERY',
        trigger,
        status: 'SKIPPED',
        startedAt: isoStart,
        completedAt: isoStart,
        durationMs: 0,
        skippedReason: 'JOB_ALREADY_RUNNING'
      };
    }

    this.activeRuns.set('DISCOVERY', true);

    try {
      const scanLimit = config?.scanLimit ?? 5;
      const autoDispatch = config?.autoDispatch ?? true;

      // 2. Scan Opportunities (Phase 5A)
      const scanResult = await scanOpportunities({ limit: scanLimit });

      // 3. Enqueue Discovered Candidates (Phase 5B)
      let queuedCount = 0;
      if (scanResult.candidates.length > 0) {
        const queueResult = this.queue.enqueueMany(scanResult.candidates);
        queuedCount = queueResult.enqueued.length;
      }

      // 4. Sequential Council Dispatching (Phase 5B)
      let dispatchSummary;
      if (autoDispatch) {
        dispatchSummary = await this.dispatcher.dispatchAll();
      }

      const endTime = Date.now();
      const isoEnd = new Date(endTime).toISOString();
      const durationMs = endTime - startTime;

      const discoveryResult: DiscoveryCycleResult = {
        scanResult,
        queuedCount,
        dispatchSummary,
        durationMs,
        completedAt: isoEnd
      };

      return {
        runId,
        jobType: 'DISCOVERY',
        trigger,
        status: 'COMPLETED',
        startedAt: isoStart,
        completedAt: isoEnd,
        durationMs,
        discoveryResult
      };
    } catch (err: any) {
      const endTime = Date.now();
      return {
        runId,
        jobType: 'DISCOVERY',
        trigger,
        status: 'FAILED',
        startedAt: isoStart,
        completedAt: new Date(endTime).toISOString(),
        durationMs: endTime - startTime,
        error: err.message || 'Discovery cycle failed'
      };
    } finally {
      this.activeRuns.set('DISCOVERY', false);
    }
  }

  /**
   * Executes one complete monitoring cycle (Portfolio -> Thesis Health -> Protective Exits).
   */
  async runMonitoringCycle(
    config?: Partial<MonitoringCycleConfig>,
    trigger: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'
  ): Promise<AutomationRun> {
    const startTime = Date.now();
    const isoStart = new Date(startTime).toISOString();
    const timeBucket = isoStart.replace(/[:.]/g, '-');
    const runId = `RUN-MONITORING-${timeBucket}`;

    // 1. Concurrency Protection (Prevent Overlapping Runs)
    if (this.isJobActive('MONITORING')) {
      return {
        runId,
        jobType: 'MONITORING',
        trigger,
        status: 'SKIPPED',
        startedAt: isoStart,
        completedAt: isoStart,
        durationMs: 0,
        skippedReason: 'JOB_ALREADY_RUNNING'
      };
    }

    this.activeRuns.set('MONITORING', true);

    try {
      const executeExits = config?.executeExits ?? true;

      // 2. Position Monitoring & Protective Invalidation (Phase 6C)
      const monitoringResult: MonitoringCycleResult = await this.monitoringService.runMonitoringCycle({
        executeExits
      });

      const endTime = Date.now();
      const isoEnd = new Date(endTime).toISOString();
      const durationMs = endTime - startTime;

      return {
        runId,
        jobType: 'MONITORING',
        trigger,
        status: 'COMPLETED',
        startedAt: isoStart,
        completedAt: isoEnd,
        durationMs,
        monitoringResult
      };
    } catch (err: any) {
      const endTime = Date.now();
      return {
        runId,
        jobType: 'MONITORING',
        trigger,
        status: 'FAILED',
        startedAt: isoStart,
        completedAt: new Date(endTime).toISOString(),
        durationMs: endTime - startTime,
        error: err.message || 'Monitoring cycle failed'
      };
    } finally {
      this.activeRuns.set('MONITORING', false);
    }
  }
}

/** Singleton instance of AutomationCoordinator */
export const automationCoordinator = new AutomationCoordinator();
