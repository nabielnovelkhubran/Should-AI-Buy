import { SessionEvidence } from './types';
import { getTradingEnvironmentConfig } from '../../environment';

// ---------------------------------------------------------------------------
// Phase 8.10: Session-Level Evidence Tracker & Lightweight Logging
// INVARIANT: Tracks objective competition session outcomes.
// INVARIANT: Zero credential or private key storage.
// INVARIANT: Corruption-safe, bounded in-memory with structured export.
// ---------------------------------------------------------------------------

export class SessionEvidenceManager {
  private activeSession: SessionEvidence;
  private readonly maxEvents: number;

  constructor(maxEvents: number = 500) {
    this.maxEvents = maxEvents;
    const now = new Date().toISOString();
    const envConfig = getTradingEnvironmentConfig();

    this.activeSession = {
      sessionId: `SESSION-${Date.now().toString(36).toUpperCase()}`,
      environment: envConfig.environment,
      startedAt: now,
      startingEquity: envConfig.targetStartingEquity || 100000,
      startingCash: envConfig.targetStartingEquity || 100000,
      startingPositionsCount: 0,
      currentEquity: envConfig.targetStartingEquity || 100000,
      currentCash: envConfig.targetStartingEquity || 100000,
      currentPositionsCount: 0,
      totalCyclesExecuted: 0,
      totalCandidatesScanned: 0,
      totalOrdersSubmitted: 0,
      totalTradesExecuted: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      realizedPnLUsd: 0,
      totalR: 0,
      maxDrawdownPct: 0,
      evidenceQuality: 'INSUFFICIENT',
      isGrossPnL: true,
      status: 'ACTIVE'
    };
  }

  public startNewSession(initialData?: {
    startingEquity?: number;
    startingCash?: number;
    startingPositionsCount?: number;
    environment?: string;
  }): SessionEvidence {
    const now = new Date().toISOString();
    const envConfig = getTradingEnvironmentConfig();

    const startingEquity = initialData?.startingEquity ?? envConfig.targetStartingEquity ?? 100000;
    const startingCash = initialData?.startingCash ?? envConfig.targetStartingEquity ?? 100000;
    const startingPositionsCount = initialData?.startingPositionsCount ?? 0;
    const environment = initialData?.environment ?? envConfig.environment;

    this.activeSession = {
      sessionId: `SESSION-${Date.now().toString(36).toUpperCase()}`,
      environment,
      startedAt: now,
      startingEquity,
      startingCash,
      startingPositionsCount,
      currentEquity: startingEquity,
      currentCash: startingCash,
      currentPositionsCount: startingPositionsCount,
      totalCyclesExecuted: 0,
      totalCandidatesScanned: 0,
      totalOrdersSubmitted: 0,
      totalTradesExecuted: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      realizedPnLUsd: 0,
      totalR: 0,
      maxDrawdownPct: 0,
      evidenceQuality: 'INSUFFICIENT',
      isGrossPnL: true,
      status: 'ACTIVE'
    };

    return this.activeSession;
  }

  public recordCycle(scanned: number, orders: number): void {
    this.activeSession.totalCyclesExecuted++;
    this.activeSession.totalCandidatesScanned += Math.max(0, scanned);
    this.activeSession.totalOrdersSubmitted += Math.max(0, orders);
  }

  public updateLiveMetrics(metrics: {
    currentEquity: number;
    currentCash: number;
    currentPositionsCount: number;
    realizedPnLUsd: number;
    totalTradesExecuted: number;
    winningTrades: number;
    losingTrades: number;
    totalR: number;
    maxDrawdownPct: number;
  }): void {
    this.activeSession.currentEquity = Number(metrics.currentEquity.toFixed(2));
    this.activeSession.currentCash = Number(metrics.currentCash.toFixed(2));
    this.activeSession.currentPositionsCount = metrics.currentPositionsCount;
    this.activeSession.realizedPnLUsd = Number(metrics.realizedPnLUsd.toFixed(2));
    this.activeSession.totalTradesExecuted = metrics.totalTradesExecuted;
    this.activeSession.winningTrades = metrics.winningTrades;
    this.activeSession.losingTrades = metrics.losingTrades;
    this.activeSession.winRate = metrics.totalTradesExecuted > 0
      ? Number((metrics.winningTrades / metrics.totalTradesExecuted).toFixed(2))
      : 0;
    this.activeSession.totalR = Number(metrics.totalR.toFixed(2));
    this.activeSession.maxDrawdownPct = Number(metrics.maxDrawdownPct.toFixed(2));

    // Determine evidence quality rigorously based on sample size
    if (metrics.totalTradesExecuted >= 20) {
      this.activeSession.evidenceQuality = 'MEANINGFUL';
    } else if (metrics.totalTradesExecuted >= 5) {
      this.activeSession.evidenceQuality = 'PRELIMINARY';
    } else {
      this.activeSession.evidenceQuality = 'INSUFFICIENT';
    }
  }

  public endSession(finalData?: {
    endingEquity?: number;
    endingCash?: number;
    endingPositionsCount?: number;
  }): SessionEvidence {
    const now = new Date().toISOString();
    this.activeSession.endedAt = now;
    this.activeSession.status = 'CONCLUDED';
    this.activeSession.endingEquity = finalData?.endingEquity ?? this.activeSession.currentEquity;
    this.activeSession.endingCash = finalData?.endingCash ?? this.activeSession.currentCash;
    this.activeSession.endingPositionsCount = finalData?.endingPositionsCount ?? this.activeSession.currentPositionsCount;

    return this.activeSession;
  }

  public getSessionEvidence(): SessionEvidence {
    return { ...this.activeSession };
  }

  public exportSessionJson(): string {
    return JSON.stringify(this.activeSession, null, 2);
  }
}

// Canonical process-local SessionEvidenceManager singleton attached to globalThis
const gSession = globalThis as unknown as { __SESSION_EVIDENCE_MANAGER__?: SessionEvidenceManager };
if (!gSession.__SESSION_EVIDENCE_MANAGER__) {
  gSession.__SESSION_EVIDENCE_MANAGER__ = new SessionEvidenceManager();
}
export const sessionEvidenceManager = gSession.__SESSION_EVIDENCE_MANAGER__;
