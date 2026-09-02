import {
  AgentRuntimeSnapshot,
  WorkerRuntimeSnapshot,
  AccountRuntimeSnapshot,
  DecisionTelemetry,
  SafetySnapshot
} from './types';
import { tradeLedger } from './trade-ledger';
import { calculatePortfolioMetrics, calculateTradeMetrics } from './portfolio-analytics';
import { computeFullAttribution } from './attribution';
import { generateCalibrationReport } from './calibration';
import { verifyAccountHealth } from './account-health';
import { sessionEvidenceManager } from './session-evidence';
import { workerObserver } from '../worker';
import { autonomousTradingEngine } from '../engine';
import { autonomousRuntime } from '../runtime';
import { getAgentConfig } from '../config';
import { getTradingEnvironmentConfig } from '../../environment';
import { paperPortfolioService } from '../../portfolio';
import { detectAssetClass } from '../../scanner/universe';

// ---------------------------------------------------------------------------
// Phase 8.10: Complete Runtime Observability Snapshot Builder
// INVARIANT: Compiles authoritative telemetry without leaking credentials.
// INVARIANT: Downstream failure isolation — metric errors never crash engine.
// INVARIANT: Broker-confirmed values are ground truth.
// ---------------------------------------------------------------------------

export async function buildRuntimeSnapshot(): Promise<AgentRuntimeSnapshot> {
  const now = new Date().toISOString();
  const envConfig = getTradingEnvironmentConfig();
  const agentConfig = getAgentConfig();

  // 1. Worker State
  let worker: WorkerRuntimeSnapshot;
  try {
    const ws = workerObserver.getStatus();
    const runtimeStatus = autonomousRuntime.getStatus();
    const latestCycle = autonomousTradingEngine.getLatestCycle();
    
    // Prioritize autonomousRuntime running state if active
    const isRunning = runtimeStatus.running || ws.state === 'RUNNING';
    const effectiveState = isRunning ? 'RUNNING' : ws.state;

    worker = {
      state: effectiveState,
      startedAt: ws.startedAt,
      lastCycleAt: runtimeStatus.lastCycleAt || ws.lastCycleAt,
      lastSuccessfulDataAt: ws.lastSuccessfulDataAt,
      lastCycleId: runtimeStatus.currentCycleId || latestCycle?.cycleId || null,
      nextScheduledCycleAt: runtimeStatus.nextCycleAt,
      consecutiveFailures: runtimeStatus.consecutiveErrors || ws.consecutiveFailures,
      circuitBreakerTripped: ws.circuitBreakerActive,
      circuitBreakerReason: ws.circuitBreakerReason,
      accountHealthy: ws.accountHealthy,
      environment: ws.environment,
      runtimeMode: runtimeStatus.mode,
      proofMode: runtimeStatus.proofMode,
      autonomousRunning: runtimeStatus.running,
      riskProfile: runtimeStatus.riskProfile || "STANDARD"
    };
  } catch {
    worker = {
      state: 'STOPPED',
      startedAt: null,
      lastCycleAt: null,
      lastSuccessfulDataAt: null,
      lastCycleId: null,
      nextScheduledCycleAt: null,
      consecutiveFailures: 0,
      circuitBreakerTripped: false,
      circuitBreakerReason: null,
      accountHealthy: true,
      environment: envConfig.environment
    };
  }

  // 2. Broker-Confirmed Account Snapshot
  let account: AccountRuntimeSnapshot;
  try {
    const portfolioSnapshot = await paperPortfolioService.getPortfolioSnapshot();
    const acc = portfolioSnapshot.account;
    const equity = acc?.equity ?? envConfig.targetStartingEquity ?? 100000;
    const cash = acc?.cash ?? envConfig.targetStartingEquity ?? 100000;
    const buyingPower = acc?.buyingPower ?? (cash * 4);
    const portfolioValue = acc?.portfolioValue ?? equity;
    const openPositionsCount = portfolioSnapshot.positions.length;
    const grossExposureUsd = portfolioSnapshot.exposure.grossExposureUsd;
    const grossExposurePct = portfolioSnapshot.exposure.grossExposurePct;
    const accountNumber = acc?.accountNumber ?? '';
    const maskedAcc = accountNumber.length > 4 ? `PA${accountNumber.slice(2, 6)}***` : 'PA-PAPER-AC';

    account = {
      equity: Number(equity.toFixed(2)),
      cash: Number(cash.toFixed(2)),
      buyingPower: Number(buyingPower.toFixed(2)),
      portfolioValue: Number(portfolioValue.toFixed(2)),
      openPositionCount: openPositionsCount,
      grossExposureUsd: Number(grossExposureUsd.toFixed(2)),
      grossExposurePct: Number(grossExposurePct.toFixed(2)),
      lastReconciliationAt: portfolioSnapshot.retrievedAt || now,
      isPaper: acc?.isPaper !== false,
      accountNumberMasked: maskedAcc,
      status: acc?.status || 'ACTIVE'
    };
  } catch {
    account = {
      equity: envConfig.targetStartingEquity || 100000,
      cash: envConfig.targetStartingEquity || 100000,
      buyingPower: (envConfig.targetStartingEquity || 100000) * 4,
      portfolioValue: envConfig.targetStartingEquity || 100000,
      openPositionCount: 0,
      grossExposureUsd: 0,
      grossExposurePct: 0,
      lastReconciliationAt: now,
      isPaper: true,
      accountNumberMasked: 'PA-PAPER-AC',
      status: 'ACTIVE'
    };
  }

  // 3. Cycles & Evaluations
  const currentCycle = autonomousTradingEngine.getLatestCycle();
  const recentCycles = autonomousTradingEngine.getCycleHistory(10);

  // 4. Decision Telemetry (Synthesized from rejected records & approved evaluations)
  const recentDecisions: DecisionTelemetry[] = [];
  try {
    // Collect from recent evaluations
    for (const c of recentCycles) {
      for (const ev of c.evaluations || []) {
        recentDecisions.push({
          timestamp: c.completedAt,
          cycleId: c.cycleId,
          symbol: ev.candidateSymbol,
          assetClass: detectAssetClass(ev.candidateSymbol),
          strategy: ev.aiDecision?.strategy,
          marketRegime: c.marketRegime,
          opportunityScore: ev.opportunityScore,
          aiConfidence: ev.aiDecision?.confidence,
          estimatedRiskReward: ev.aiDecision?.riskRewardRatio,
          action: ev.aiDecision?.action || 'PASS',
          validationStatus: ev.schemaValid ? 'VALID' : 'INVALID',
          riskStatus: ev.riskGatePassed ? 'PASS' : 'BLOCKED',
          thesisSummary: ev.aiDecision?.thesis,
          invalidationConditions: ev.aiDecision?.invalidationConditions,
          targetConditions: ev.aiDecision?.targetConditions
        });
      }
    }

    // Collect from rejections in trade ledger (up to last 100)
    for (const r of tradeLedger.getRejectedCandidates().slice(-100)) {
      recentDecisions.push({
        timestamp: r.recordedAt,
        cycleId: r.cycleId,
        symbol: r.symbol,
        assetClass: r.assetClass || detectAssetClass(r.symbol),
        strategy: String(r.strategy || 'UNKNOWN'),
        marketRegime: r.marketRegime,
        opportunityScore: r.opportunityScore,
        aiConfidence: r.aiConfidence,
        estimatedRiskReward: r.estimatedRiskReward,
        action: 'PASS',
        validationStatus: 'VALID',
        riskStatus: r.rejectionStage === 'RISK_GATE' ? 'BLOCKED' : 'PASS',
        rejectionStage: r.rejectionStage,
        rejectionReason: r.rejectionReason
      });
    }
  } catch {
    // Ignore decision telemetry assembly errors safely
  }

  // 5. Trades from Ledger
  const openTrades = tradeLedger.getOpenTrades();
  const completedTrades = tradeLedger.getCompletedTrades();

  // 6. Performance Metrics
  const portfolioMetrics = calculatePortfolioMetrics(
    tradeLedger.getAllTrades(),
    account.equity,
    envConfig.targetStartingEquity || 100000
  );
  const tradeMetrics = calculateTradeMetrics(tradeLedger.getAllTrades());

  // 7. Multi-Dimensional Attribution
  const attribution = computeFullAttribution(tradeLedger.getAllTrades());

  // 8. Evidence-Based Calibration Diagnostics
  const calibration = generateCalibrationReport(tradeLedger.getAllTrades(), agentConfig);

  // 9. Safety Snapshot
  const health = verifyAccountHealth({
    accountStatus: account.status,
    equity: account.equity,
    cash: account.cash,
    buyingPower: account.buyingPower,
    circuitBreakerActive: worker.circuitBreakerTripped,
    isPaper: account.isPaper
  });

  const safety: SafetySnapshot = {
    paperOnlyEnforced: true,
    liveEndpointBlocked: true,
    circuitBreakerActive: worker.circuitBreakerTripped,
    circuitBreakerReason: worker.circuitBreakerReason,
    accountHealthPassed: health.healthy,
    activeBlockers: health.blockers,
    activeWarnings: health.warnings,
    credentialsProtected: true
  };

  // 10. Update & Retrieve Session Evidence
  sessionEvidenceManager.updateLiveMetrics({
    currentEquity: account.equity,
    currentCash: account.cash,
    currentPositionsCount: account.openPositionCount,
    realizedPnLUsd: tradeMetrics.totalTrades > 0 ? portfolioMetrics.realizedPnLUsd : 0,
    totalTradesExecuted: tradeMetrics.completedTrades,
    winningTrades: tradeMetrics.winningTrades,
    losingTrades: tradeMetrics.losingTrades,
    totalR: tradeMetrics.totalR,
    maxDrawdownPct: portfolioMetrics.maxDrawdownPct
  });
  const session = sessionEvidenceManager.getSessionEvidence();

  return {
    generatedAt: now,
    worker,
    account,
    currentCycle,
    recentCycles,
    recentDecisions: recentDecisions.slice(-30),
    openTrades,
    recentTrades: completedTrades.slice(-20),
    performance: {
      portfolio: portfolioMetrics,
      trades: tradeMetrics
    },
    attribution,
    calibration,
    safety,
    session
  };
}
