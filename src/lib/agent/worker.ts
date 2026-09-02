import { autonomousTradingEngine } from './engine';
import { adaptiveMarketScheduler } from './scheduler';
import { telemetryJournal } from './journal';
import { getTradingEnvironmentConfig } from '../environment';
import { WorkerLifecycleState } from './analytics/types';

// ---------------------------------------------------------------------------
// Phase 8.8I: Standalone Autonomous Worker & Observability Observer
// Run independently from Next.js server (e.g. `node src/lib/agent/worker.js`)
// INVARIANT: Worker owns trading loop. UI is pure observability interface.
// ---------------------------------------------------------------------------

export interface WorkerStatus {
  state: WorkerLifecycleState;
  startedAt: string | null;
  lastCycleAt: string | null;
  lastSuccessfulDataAt: string | null;
  consecutiveFailures: number;
  circuitBreakerActive: boolean;
  circuitBreakerReason: string | null;
  accountHealthy: boolean;
  environment: string;
}

export class WorkerObserver {
  private currentState: WorkerLifecycleState = 'STOPPED';
  private startedAt: string | null = null;
  private lastCycleAt: string | null = null;
  private lastSuccessfulDataAt: string | null = null;
  private accountHealthy: boolean = true;

  public getState(): WorkerLifecycleState {
    return this.currentState;
  }

  public transitionTo(newState: WorkerLifecycleState, reason?: string): void {
    const oldState = this.currentState;
    this.currentState = newState;

    telemetryJournal.record(
      'WORKER',
      'WORKER_STATE_CHANGED',
      `Worker lifecycle transition: ${oldState} -> ${newState}${reason ? ` (${reason})` : ''}`,
      { details: { from: oldState, to: newState, reason } }
    );
  }

  public recordCycleCompletion(success: boolean, timestamp: string = new Date().toISOString()): void {
    this.lastCycleAt = timestamp;
    if (success) {
      this.lastSuccessfulDataAt = timestamp;
    }
  }

  public setAccountHealth(healthy: boolean): void {
    this.accountHealthy = healthy;
  }

  public setStarted(started: boolean): void {
    this.startedAt = started ? new Date().toISOString() : null;
    this.currentState = started ? 'RUNNING' : 'STOPPED';
  }

  public getStatus(): WorkerStatus {
    const envConfig = getTradingEnvironmentConfig();
    const cb = autonomousTradingEngine.getCircuitBreakerStatus();

    return {
      state: this.currentState,
      startedAt: this.startedAt,
      lastCycleAt: this.lastCycleAt,
      lastSuccessfulDataAt: this.lastSuccessfulDataAt,
      consecutiveFailures: 0,
      circuitBreakerActive: cb.tripped,
      circuitBreakerReason: cb.reason,
      accountHealthy: this.accountHealthy,
      environment: envConfig.environment
    };
  }
}

export const workerObserver = new WorkerObserver();

export function getWorkerStatus(): WorkerStatus {
  return workerObserver.getStatus();
}

export async function startAutonomousWorker(): Promise<void> {
  const envConfig = getTradingEnvironmentConfig();
  workerObserver.transitionTo('INITIALIZING', 'Starting autonomous trading worker');

  console.log(`[AUTONOMOUS WORKER] Starting Should-AI Buy? Autonomous Trading Agent...`);
  console.log(`[AUTONOMOUS WORKER] Runtime Environment: ${envConfig.accountLabel}`);
  console.log(`[AUTONOMOUS WORKER] Paper Endpoint: ${envConfig.baseUrl}`);

  // Record initialization
  telemetryJournal.record('WORKER', 'CYCLE_STARTED', `Worker started in ${envConfig.environment.toUpperCase()} mode.`);

  // Start market-aware adaptive scheduler
  adaptiveMarketScheduler.start();
  workerObserver.setStarted(true);
  workerObserver.transitionTo('RUNNING', 'Scheduler active');

  console.log(`[AUTONOMOUS WORKER] Autonomous Engine active and running.`);
}

export function stopAutonomousWorker(): void {
  console.log(`[AUTONOMOUS WORKER] Stopping Autonomous Engine...`);
  workerObserver.transitionTo('STOPPED', 'Worker stopped cleanly');
  adaptiveMarketScheduler.stop();
  workerObserver.setStarted(false);
  telemetryJournal.record('WORKER', 'CYCLE_COMPLETED', 'Worker stopped cleanly.');
  console.log(`[AUTONOMOUS WORKER] Engine stopped.`);
}

// Auto-start if executed directly via Node
if (typeof require !== 'undefined' && require.main === module) {
  startAutonomousWorker().catch(err => {
    workerObserver.transitionTo('ERROR', err.message);
    console.error('[AUTONOMOUS WORKER] Fatal Error:', err);
    process.exit(1);
  });
}
