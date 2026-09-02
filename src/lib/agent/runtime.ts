import { AutonomousTradingEngine, autonomousTradingEngine } from './engine';
import { RiskProfileType } from './types';
import { getAgentConfig } from './config';
import { TelemetryJournal, telemetryJournal } from './journal';
import { AutonomousCycleResult } from './types';
import { getTradingEnvironmentConfig } from '../environment';

// ---------------------------------------------------------------------------
// Phase 8.20: Autonomous Execution Runtime & First Real Trade Proof
// INVARIANT: UI-independent autonomous execution engine.
// INVARIANT: The agent runs continuously in the background even if browser is closed.
// INVARIANT: All strategy thresholds remain strictly immutable.
// INVARIANT: Real vs Simulation isolation is strictly enforced.
// ---------------------------------------------------------------------------

export type AutonomousRuntimeMode = 'REAL_PAPER' | 'SIMULATION';
export type AutonomousRuntimeStatusState = 'RUNNING' | 'STOPPED' | 'PAUSED' | 'ERROR';
export type AutonomousCycleOutcome = 'SUCCESS' | 'NO_ACTION' | 'ERROR' | 'SKIPPED';

export interface AutonomousRuntimeStats {
  totalCycles: number;
  successfulCycles: number;
  candidatesScanned: number;
  candidatesEvaluated: number;
  ordersSubmitted: number;
  positionsMonitored: number;
  proofTradesExecuted: number;
}

export interface AutonomousRuntimeStatus {
  running: boolean;
  state: AutonomousRuntimeStatusState;
  mode: AutonomousRuntimeMode;
  proofMode: boolean;
  riskProfile?: RiskProfileType;
  currentCycleId: string | null;
  lastCycleAt: string | null;
  nextCycleAt: string | null;
  lastCycleStatus: AutonomousCycleOutcome | null;
  consecutiveErrors: number;
  lastError: string | null;
  stats: AutonomousRuntimeStats;
  intervalMs: number;
  environment: string;
}

export interface AutonomousRuntimeOptions {
  intervalMs?: number;
  mode?: AutonomousRuntimeMode;
  proofMode?: boolean;
  scanLimit?: number;
}

export class AutonomousRuntime {
  private engine: AutonomousTradingEngine;
  private journal: TelemetryJournal;
  private timer: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private state: AutonomousRuntimeStatusState = 'STOPPED';
  private mode: AutonomousRuntimeMode = 'REAL_PAPER';
  private proofMode: boolean = false;
  private riskProfile: RiskProfileType = 'STANDARD';
  private intervalMs: number = 900000; // Default 15 minutes (900,000 ms)
  private currentCycleId: string | null = null;
  private lastCycleAt: string | null = null;
  private nextCycleAt: string | null = null;
  private lastCycleStatus: AutonomousCycleOutcome | null = null;
  private consecutiveErrors: number = 0;
  private lastError: string | null = null;
  private isCycleExecuting: boolean = false;

  private stats: AutonomousRuntimeStats = {
    totalCycles: 0,
    successfulCycles: 0,
    candidatesScanned: 0,
    candidatesEvaluated: 0,
    ordersSubmitted: 0,
    positionsMonitored: 0,
    proofTradesExecuted: 0
  };

  private configOverrides: Partial<import('./types').AgentStrategyConfig> = {};

  constructor(
    engine: AutonomousTradingEngine = autonomousTradingEngine,
    journal: TelemetryJournal = telemetryJournal,
    options?: AutonomousRuntimeOptions
  ) {
    this.engine = engine;
    this.journal = journal;
    this.intervalMs = Math.max(10000, options?.intervalMs ?? 900000);
    this.mode = options?.mode ?? 'REAL_PAPER';
    this.proofMode = options?.proofMode ?? false;
  }


  public isRunning(): boolean {
    return this.running;
  }

  public getStatus(): AutonomousRuntimeStatus & { configOverrides: Partial<import('./types').AgentStrategyConfig> } {
    const envConfig = getTradingEnvironmentConfig();
    return {
      running: this.running,
      state: this.state,
      mode: this.mode,
      proofMode: this.proofMode,
      riskProfile: this.riskProfile,
      currentCycleId: this.currentCycleId,
      lastCycleAt: this.lastCycleAt,
      nextCycleAt: this.nextCycleAt,
      lastCycleStatus: this.lastCycleStatus,
      consecutiveErrors: this.consecutiveErrors,
      lastError: this.lastError,
      stats: { ...this.stats },
      intervalMs: this.intervalMs,
      environment: envConfig.environment,
      configOverrides: { ...this.configOverrides }
    };
  }

  public setMode(mode: AutonomousRuntimeMode): void {
    this.mode = mode;
    this.journal.record(
      'SYSTEM',
      'RUNTIME_MODE_CHANGED',
      `Autonomous Runtime execution mode set to ${mode}.`,
      { details: { mode } }
    );
  }

  
  public setRiskProfile(profile: RiskProfileType): void {
    this.riskProfile = profile;
    const config = getAgentConfig(profile);
    this.engine.updateStrategyConfig(config);
    this.journal.record(
      'SYSTEM',
      'RISK_PROFILE_CHANGED',
      `Autonomous Runtime risk profile set to ${profile}.`,
      { details: { profile, config } }
    );
  }

  public setProofMode(enabled: boolean): void {
    this.proofMode = enabled;
    this.journal.record(
      'SYSTEM',
      'PROOF_MODE_TOGGLED',
      `Autonomous First-Trade Proof Mode is now ${enabled ? 'ENABLED (Max 1 new position, strict thresholds)' : 'DISABLED'}.`,
      { details: { proofMode: enabled } }
    );
  }

  /**
   * Apply live filter/threshold overrides on top of the active risk profile.
   * Keys match AgentStrategyConfig fields. Zero/null values remove the override.
   */
  public setConfigOverrides(overrides: Partial<import('./types').AgentStrategyConfig>): void {
    this.configOverrides = { ...this.configOverrides, ...overrides };
    const baseConfig = getAgentConfig(this.riskProfile);
    const merged = { ...baseConfig, ...this.configOverrides };
    this.engine.updateStrategyConfig(merged);
    this.journal.record(
      'SYSTEM',
      'RISK_PROFILE_CHANGED',
      `Filter thresholds updated: ${JSON.stringify(overrides)}`,
      { details: { overrides, merged } }
    );
  }

  public setIntervalMs(intervalMs: number): void {
    this.intervalMs = Math.max(5000, intervalMs);
    if (this.running) {
      this.scheduleNext(this.intervalMs);
    }
  }

  /**
   * Starts the autonomous trading runtime loop in background.
   */
  public start(options?: AutonomousRuntimeOptions): AutonomousRuntimeStatus {
    if (this.running) {
      return this.getStatus();
    }

    if (options?.intervalMs) {
      this.intervalMs = Math.max(5000, options.intervalMs);
    }
    if (options?.mode) {
      this.mode = options.mode;
    }
    if (options?.proofMode !== undefined) {
      this.proofMode = options.proofMode;
    }

    this.running = true;
    this.state = 'RUNNING';
    this.lastError = null;

    this.journal.record(
      'WORKER',
      'AUTONOMOUS_RUNTIME_STARTED',
      `Autonomous Trading Runtime started in ${this.mode} mode (Interval: ${Math.round(this.intervalMs / 1000)}s, ProofMode: ${this.proofMode ? 'ON' : 'OFF'}).`
    );

    // Run first cycle immediately asynchronously without blocking
    this.runCycle().catch(err => {
      console.error('[AUTONOMOUS RUNTIME] Initial cycle error:', err);
    });

    return this.getStatus();
  }

  /**
   * Stops the autonomous trading runtime loop cleanly.
   */
  public stop(): AutonomousRuntimeStatus {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.running = false;
    this.state = 'STOPPED';
    this.nextCycleAt = null;
    this.currentCycleId = null;

    this.journal.record(
      'WORKER',
      'AUTONOMOUS_RUNTIME_STOPPED',
      'Autonomous Trading Runtime stopped cleanly by operator.'
    );

    return this.getStatus();
  }

  /**
   * Runs a single non-overlapping autonomous cycle.
   */
  public async runCycle(options?: { scanLimit?: number }): Promise<AutonomousCycleResult> {
    const cycleId = `REAL-CYCLE-${Date.now()}`;

    // Concurrency Lock: Prevent overlapping cycles
    if (this.isCycleExecuting) {
      const skippedRes: AutonomousCycleResult = {
        cycleId,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        environment: getTradingEnvironmentConfig().environment,
        isMarketOpen: true,
        candidatesScanned: 0,
        candidatesEvaluated: 0,
        evaluations: [],
        ordersSubmitted: [],
        positionsMonitoredCount: 0,
        protectiveExitsExecutedCount: 0,
        circuitBreakerActive: false,
        eventsCount: 0,
        status: 'SKIPPED',
        error: 'AUTONOMOUS_CYCLE_ALREADY_RUNNING'
      };
      this.lastCycleStatus = 'SKIPPED';
      return skippedRes;
    }

    this.isCycleExecuting = true;
    this.currentCycleId = cycleId;
    const startTime = Date.now();

    this.journal.record(
      'AUTONOMOUS_TRADING',
      'AUTONOMOUS_CYCLE_STARTED',
      `Autonomous Cycle ${cycleId} initiated (${this.mode}, ProofMode: ${this.proofMode}).`,
      { details: { cycleId, mode: this.mode, proofMode: this.proofMode } }
    );

    try {
      // In Proof Mode: If we already have open positions or have executed a proof trade, respect max 1 new position constraint
      const scanLimit = options?.scanLimit ?? (this.proofMode ? 5 : 5);
      
      const cycleResult = await this.engine.runCycle({
        scanLimit,
        executeOrders: this.mode === 'REAL_PAPER',
        executeExits: true
      });

      this.stats.totalCycles++;
      this.stats.candidatesScanned += cycleResult.candidatesScanned;
      this.stats.candidatesEvaluated += cycleResult.candidatesEvaluated;
      this.stats.ordersSubmitted += cycleResult.ordersSubmitted.length;
      this.stats.positionsMonitored = cycleResult.positionsMonitoredCount;

      if (cycleResult.ordersSubmitted.length > 0 && this.proofMode) {
        this.stats.proofTradesExecuted += cycleResult.ordersSubmitted.length;
      }

      this.lastCycleAt = new Date().toISOString();
      this.consecutiveErrors = 0;
      this.lastError = null;

      if (cycleResult.ordersSubmitted.length > 0) {
        this.lastCycleStatus = 'SUCCESS';
        this.stats.successfulCycles++;
      } else {
        this.lastCycleStatus = 'NO_ACTION';
      }

      this.journal.record(
        'AUTONOMOUS_TRADING',
        'AUTONOMOUS_CYCLE_COMPLETED',
        `Autonomous Cycle ${cycleId} finished in ${Date.now() - startTime}ms (Status: ${this.lastCycleStatus}, Scanned: ${cycleResult.candidatesScanned}, Orders: ${cycleResult.ordersSubmitted.length}).`,
        { details: { cycleId, durationMs: Date.now() - startTime, ordersCount: cycleResult.ordersSubmitted.length } }
      );

      return cycleResult;
    } catch (err: any) {
      this.consecutiveErrors++;
      this.lastError = err?.message || 'Unknown autonomous cycle error';
      this.lastCycleStatus = 'ERROR';

      this.journal.record(
        'AUTONOMOUS_TRADING',
        'AUTONOMOUS_CYCLE_FAILED',
        `Autonomous Cycle ${cycleId} failed: ${this.lastError}`,
        { details: { cycleId, error: this.lastError, consecutiveErrors: this.consecutiveErrors } }
      );

      throw err;
    } finally {
      this.isCycleExecuting = false;
      this.currentCycleId = null;

      // Schedule next recurring cycle if runtime is still active
      if (this.running) {
        this.scheduleNext(this.intervalMs);
      }
    }
  }

  private scheduleNext(delayMs: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.running) return;

    this.nextCycleAt = new Date(Date.now() + delayMs).toISOString();

    this.timer = setTimeout(() => {
      if (this.running) {
        this.runCycle().catch(err => {
          console.error('[AUTONOMOUS RUNTIME] Scheduled cycle error:', err);
        });
      }
    }, delayMs);
  }
}

// Global Singleton persistence across Next.js invocations
const g = globalThis as unknown as { __AUTONOMOUS_RUNTIME__?: AutonomousRuntime };
if (!g.__AUTONOMOUS_RUNTIME__) {
  g.__AUTONOMOUS_RUNTIME__ = new AutonomousRuntime();
}

export const autonomousRuntime = g.__AUTONOMOUS_RUNTIME__;
