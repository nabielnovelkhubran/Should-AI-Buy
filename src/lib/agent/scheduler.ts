import { AutonomousTradingEngine, autonomousTradingEngine } from './engine';
import { TelemetryJournal, telemetryJournal } from './journal';
import { alpacaDataAdapter } from '../market-data/alpaca-adapter';

// ---------------------------------------------------------------------------
// Phase 8.6: Adaptive Market-Aware Scheduler
// INVARIANT: Adapts polling cadence based on market sessions and rate limits.
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// ---------------------------------------------------------------------------

export type SchedulerMode = 'RUNNING' | 'PAUSED' | 'RATE_LIMITED' | 'MARKET_CLOSED' | 'STOPPED';

export interface SchedulerOptions {
  normalIntervalMs?: number;    // Standard discovery & monitoring interval (e.g. 60,000ms)
  fastIntervalMs?: number;      // High-volatility / active position interval (e.g. 20,000ms)
  closedMarketIntervalMs?: number; // Idle polling interval when equity markets are closed (e.g. 300,000ms)
}

export class AdaptiveMarketScheduler {
  private engine: AutonomousTradingEngine;
  private journal: TelemetryJournal;
  private timer: any = null;
  private mode: SchedulerMode = 'STOPPED';
  private normalIntervalMs: number;
  private fastIntervalMs: number;
  private closedMarketIntervalMs: number;
  private nextRunTimestamp: string | null = null;

  constructor(
    engine: AutonomousTradingEngine = autonomousTradingEngine,
    journal: TelemetryJournal = telemetryJournal,
    options?: SchedulerOptions
  ) {
    this.engine = engine;
    this.journal = journal;
    this.normalIntervalMs = Math.max(5000, options?.normalIntervalMs ?? 60000);
    this.fastIntervalMs = Math.max(5000, options?.fastIntervalMs ?? 20000);
    this.closedMarketIntervalMs = Math.max(10000, options?.closedMarketIntervalMs ?? 300000);
  }

  getMode(): SchedulerMode {
    return this.mode;
  }

  getNextRunTimestamp(): string | null {
    return this.nextRunTimestamp;
  }

  /**
   * Starts the adaptive market-aware scheduler.
   */
  start(): void {
    if (this.mode === 'RUNNING') return; // Idempotent

    this.mode = 'RUNNING';
    this.journal.record('SCHEDULER', 'CYCLE_STARTED', 'Adaptive market scheduler started.');
    this.scheduleNext(0); // Trigger immediately
  }

  /**
   * Stops the adaptive scheduler.
   */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.mode = 'STOPPED';
    this.nextRunTimestamp = null;
    this.journal.record('SCHEDULER', 'CYCLE_COMPLETED', 'Adaptive market scheduler stopped.');
  }

  /**
   * Pauses the scheduler (e.g. during manual operator interventions).
   */
  pause(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.mode = 'PAUSED';
  }

  /**
   * Resumes the scheduler.
   */
  resume(): void {
    if (this.mode === 'PAUSED') {
      this.mode = 'RUNNING';
      this.scheduleNext(0);
    }
  }

  /**
   * Schedules the next cycle dynamically based on market state & rate limits.
   */
  private scheduleNext(delayMs: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.mode === 'STOPPED' || this.mode === 'PAUSED') return;

    this.nextRunTimestamp = new Date(Date.now() + delayMs).toISOString();

    this.timer = setTimeout(async () => {
      await this.runScheduledCycle();
    }, delayMs);
  }

  /**
   * Executes a scheduled cycle and calculates the next delay.
   */
  private async runScheduledCycle(): Promise<void> {
    if (this.mode === 'STOPPED' || this.mode === 'PAUSED') return;

    try {
      // 1. Check Market Clock
      let isMarketOpen = true;
      try {
        const clock = await alpacaDataAdapter.getMarketClock();
        isMarketOpen = clock.isOpen;
      } catch {
        // Fallback
      }

      // 2. Execute Autonomous Engine Cycle
      const result = await this.engine.runCycle();

      // 3. Compute Adaptive Delay for Next Cycle
      let nextDelayMs = this.normalIntervalMs;

      if (result.status === 'SKIPPED' && result.circuitBreakerActive) {
        // Circuit breaker tripped: slow down polling to 5 mins
        nextDelayMs = this.closedMarketIntervalMs;
      } else if (!isMarketOpen) {
        // Equity market closed: crypto continues at normal, equities throttled
        nextDelayMs = this.closedMarketIntervalMs;
      } else if (result.positionsMonitoredCount > 0) {
        // Active positions present: run fast monitoring
        nextDelayMs = this.fastIntervalMs;
      }

      this.scheduleNext(nextDelayMs);
    } catch (err: any) {
      // Rate limit backoff (429) or error backoff
      const isRateLimit = err?.message?.includes('429') || err?.statusCode === 429;
      const backoffMs = isRateLimit ? 60000 : 30000;
      this.journal.record(
        'SCHEDULER',
        'RATE_LIMIT_BACKOFF',
        `Scheduler error encountered. Backing off for ${Math.round(backoffMs / 1000)}s: ${err.message}`
      );
      this.scheduleNext(backoffMs);
    }
  }
}

export const adaptiveMarketScheduler = new AdaptiveMarketScheduler();
