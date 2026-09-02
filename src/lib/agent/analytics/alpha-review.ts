import {
  AlphaEvidenceRecord,
  AlphaVerdict,
  CalibrationBucketReview,
  RejectionFunnelAnalysis,
  RejectionFunnelStage,
  SessionAlphaSummary,
  AlphaReviewSnapshot,
  EvidenceQuality,
  TradeRecord,
  RejectedCandidateRecord,
  SessionEvidence
} from './types';
import { tradeLedger } from './trade-ledger';
import { computeFullAttribution } from './attribution';
import { sessionEvidenceManager } from './session-evidence';
import { calculateActualR } from './portfolio-analytics';

// ---------------------------------------------------------------------------
// Phase 8.11: Live Alpha Calibration & Evidence Review Subsystem
// INVARIANT: All metrics computed strictly from broker-confirmed outcomes.
// INVARIANT: Zero synthetic trade injection. No lookahead bias.
// INVARIANT: Calibration remains diagnostic and read-only.
// ---------------------------------------------------------------------------

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function round2(v: number): number {
  return Number(v.toFixed(2));
}

export function determineEvidenceQuality(sampleSize: number, expectancyUsd: number = 0, winRate: number = 0, profitFactor: number = 0): EvidenceQuality {
  if (sampleSize < 5) return 'INSUFFICIENT';
  if (sampleSize < 20) return 'PRELIMINARY';

  // Sample size >= 20 (Meaningful observations threshold)
  if (expectancyUsd <= 0) {
    return 'NO_DEMONSTRATED_ALPHA';
  }
  if (winRate >= 0.55 && profitFactor >= 1.5) {
    return 'PROMISING';
  }
  return 'MEANINGFUL';
}

export function normalizeAlphaEvidence(trades: TradeRecord[]): AlphaEvidenceRecord[] {
  return trades.map(t => {
    let evidenceStatus: 'OPEN' | 'COMPLETED' | 'INVALID' | 'INSUFFICIENT_DATA' = 'OPEN';
    if (t.outcome === 'OPEN') {
      evidenceStatus = 'OPEN';
    } else if (t.realizedPnL !== undefined && t.exitPrice !== undefined) {
      evidenceStatus = 'COMPLETED';
    } else if (t.entryPrice <= 0 || t.approvedQuantity <= 0) {
      evidenceStatus = 'INVALID';
    } else {
      evidenceStatus = 'INSUFFICIENT_DATA';
    }

    return {
      tradeId: t.tradeId,
      symbol: t.symbol,
      assetClass: t.assetClass,
      strategy: String(t.strategy),
      marketRegime: t.marketRegime,
      direction: 'LONG',
      opportunityScore: t.opportunityScore,
      aiConfidence: t.aiConfidence,
      estimatedRiskReward: t.estimatedRiskReward,
      factorScores: t.factorScores,
      entryPrice: t.entryPrice,
      actualFillPrice: t.actualFillPrice,
      exitPrice: t.exitPrice,
      requestedQuantity: t.requestedQuantity,
      actualFilledQuantity: t.actualFilledQuantity,
      exitFilledQuantity: t.exitFilledQuantity,
      realizedPnL: t.realizedPnL,
      realizedPnLPct: t.realizedPnLPct,
      actualR: t.actualR,
      holdingDurationMs: t.holdingDurationMs,
      exitReason: t.exitReason,
      spreadAtEntryBps: t.spreadAtEntryBps,
      spreadAtExitBps: t.spreadAtExitBps,
      portfolioEquityAtEntry: t.portfolioEquityAtEntry,
      portfolioEquityAtExit: t.portfolioEquityAtExit,
      entryTimestamp: t.entryTimestamp,
      exitTimestamp: t.exitTimestamp,
      outcome: t.outcome,
      isGrossPnL: true,
      evidenceStatus
    };
  });
}

export function computeAlphaVerdict(evidence: AlphaEvidenceRecord[]): AlphaVerdict {
  const now = new Date().toISOString();
  const completed = evidence.filter(e => e.evidenceStatus === 'COMPLETED');
  const N = completed.length;

  if (N === 0) {
    return {
      quality: 'INSUFFICIENT',
      completedTrades: 0,
      expectancy: null,
      totalR: null,
      winRate: null,
      profitFactor: null,
      strengths: [
        'Strict paper-only broker boundary confirmed',
        'Zero synthetic or fabricated trades injected',
        'Deterministic risk controls active and operational'
      ],
      weaknesses: [
        'Zero completed paper trades recorded — no empirical alpha evidence available yet'
      ],
      recommendations: [
        'Execute autonomous discovery cycles during live market hours to accumulate empirical executions',
        'Maintain read-only strategy configuration until N ≥ 20 completed trades are observed'
      ],
      confidence: 'LOW',
      generatedAt: now
    };
  }

  const winners = completed.filter(e => (e.realizedPnL ?? 0) > 0);
  const losers = completed.filter(e => (e.realizedPnL ?? 0) < 0);
  const breakevens = completed.filter(e => (e.realizedPnL ?? 0) === 0);

  const winRate = safeDiv(winners.length, N);
  const lossRate = safeDiv(losers.length, N);

  const totalWin = winners.reduce((sum, e) => sum + (e.realizedPnL ?? 0), 0);
  const totalLoss = Math.abs(losers.reduce((sum, e) => sum + (e.realizedPnL ?? 0), 0));

  const avgWin = safeDiv(totalWin, Math.max(1, winners.length));
  const avgLoss = safeDiv(totalLoss, Math.max(1, losers.length));

  const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
  const profitFactor = totalLoss > 0 ? safeDiv(totalWin, totalLoss) : totalWin > 0 ? 999.99 : 0;

  const validRTrades = completed.filter(e => e.actualR !== undefined && Number.isFinite(e.actualR));
  const totalR = validRTrades.reduce((sum, e) => sum + (e.actualR ?? 0), 0);

  const quality = determineEvidenceQuality(N, expectancy, winRate, profitFactor);
  const confidence: 'LOW' | 'MEDIUM' | 'HIGH' = N >= 50 ? 'HIGH' : N >= 20 ? 'MEDIUM' : 'LOW';

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (winRate >= 0.5) {
    strengths.push(`Observed win rate is favorable at ${(winRate * 100).toFixed(1)}% across ${N} completed trades.`);
  } else {
    weaknesses.push(`Win rate is below 50% (${(winRate * 100).toFixed(1)}%).`);
  }

  if (expectancy > 0) {
    strengths.push(`Positive realized gross expectancy of +$${expectancy.toFixed(2)} per trade.`);
  } else {
    weaknesses.push(`Negative or neutral realized gross expectancy ($${expectancy.toFixed(2)} per trade).`);
  }

  if (totalR > 0) {
    strengths.push(`Cumulative return multiple is positive at +${totalR.toFixed(2)}R.`);
  } else if (totalR < 0) {
    weaknesses.push(`Cumulative return multiple is negative at ${totalR.toFixed(2)}R.`);
  }

  if (N < 20) {
    recommendations.push(`Sample size (${N} trades) is preliminary. Collect at least ${20 - N} more completed trades before evaluating parameter changes.`);
  } else if (expectancy <= 0) {
    recommendations.push('Review candidate selection criteria and risk-gate filters before considering strategy calibration.');
  } else {
    recommendations.push('Positive preliminary expectancy observed. Continue paper observation to test statistical resilience.');
  }

  return {
    quality,
    completedTrades: N,
    expectancy: round2(expectancy),
    totalR: round2(totalR),
    winRate: round2(winRate),
    profitFactor: round2(profitFactor),
    strengths,
    weaknesses,
    recommendations,
    confidence,
    generatedAt: now
  };
}

const CALIBRATION_BUCKETS = [
  { bucketLabel: '0–49', min: 0, max: 49 },
  { bucketLabel: '50–59', min: 50, max: 59 },
  { bucketLabel: '60–69', min: 60, max: 69 },
  { bucketLabel: '70–79', min: 70, max: 79 },
  { bucketLabel: '80–89', min: 80, max: 89 },
  { bucketLabel: '90–100', min: 90, max: 100 }
];

export function reviewConfidenceCalibration(evidence: AlphaEvidenceRecord[]): CalibrationBucketReview[] {
  const completed = evidence.filter(e => e.evidenceStatus === 'COMPLETED');
  return CALIBRATION_BUCKETS.map(b => {
    const bucketTrades = completed.filter(e => e.aiConfidence >= b.min && e.aiConfidence <= b.max);
    const n = bucketTrades.length;
    const winners = bucketTrades.filter(e => (e.realizedPnL ?? 0) > 0);
    const losers = bucketTrades.filter(e => (e.realizedPnL ?? 0) < 0);
    const winRate = safeDiv(winners.length, n);
    const lossRate = safeDiv(losers.length, n);
    const totalWin = winners.reduce((sum, e) => sum + (e.realizedPnL ?? 0), 0);
    const totalLoss = Math.abs(losers.reduce((sum, e) => sum + (e.realizedPnL ?? 0), 0));
    const avgWin = safeDiv(totalWin, Math.max(1, winners.length));
    const avgLoss = safeDiv(totalLoss, Math.max(1, losers.length));
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
    const totalPnL = bucketTrades.reduce((sum, e) => sum + (e.realizedPnL ?? 0), 0);
    const withR = bucketTrades.filter(e => e.actualR !== undefined && Number.isFinite(e.actualR));
    const avgR = safeDiv(withR.reduce((sum, e) => sum + (e.actualR ?? 0), 0), Math.max(1, withR.length));

    return {
      bucketLabel: b.bucketLabel,
      min: b.min,
      max: b.max,
      sampleSize: n,
      winRate: round2(winRate),
      expectancyUsd: round2(expectancy),
      avgActualR: round2(avgR),
      totalPnLUsd: round2(totalPnL),
      quality: determineEvidenceQuality(n, expectancy, winRate)
    };
  });
}

export function reviewOpportunityCalibration(evidence: AlphaEvidenceRecord[]): CalibrationBucketReview[] {
  const completed = evidence.filter(e => e.evidenceStatus === 'COMPLETED');
  return CALIBRATION_BUCKETS.map(b => {
    const bucketTrades = completed.filter(e => e.opportunityScore >= b.min && e.opportunityScore <= b.max);
    const n = bucketTrades.length;
    const winners = bucketTrades.filter(e => (e.realizedPnL ?? 0) > 0);
    const losers = bucketTrades.filter(e => (e.realizedPnL ?? 0) < 0);
    const winRate = safeDiv(winners.length, n);
    const lossRate = safeDiv(losers.length, n);
    const totalWin = winners.reduce((sum, e) => sum + (e.realizedPnL ?? 0), 0);
    const totalLoss = Math.abs(losers.reduce((sum, e) => sum + (e.realizedPnL ?? 0), 0));
    const avgWin = safeDiv(totalWin, Math.max(1, winners.length));
    const avgLoss = safeDiv(totalLoss, Math.max(1, losers.length));
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
    const totalPnL = bucketTrades.reduce((sum, e) => sum + (e.realizedPnL ?? 0), 0);
    const withR = bucketTrades.filter(e => e.actualR !== undefined && Number.isFinite(e.actualR));
    const avgR = safeDiv(withR.reduce((sum, e) => sum + (e.actualR ?? 0), 0), Math.max(1, withR.length));

    return {
      bucketLabel: b.bucketLabel,
      min: b.min,
      max: b.max,
      sampleSize: n,
      winRate: round2(winRate),
      expectancyUsd: round2(expectancy),
      avgActualR: round2(avgR),
      totalPnLUsd: round2(totalPnL),
      quality: determineEvidenceQuality(n, expectancy, winRate)
    };
  });
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  SESSION_FILTER: 'Filtered by market hours / session eligibility',
  LIQUIDITY_FILTER: 'Insufficient 24h volume (< $500,000 threshold)',
  SPREAD_FILTER: 'Bid-ask spread exceeds 50 bps limit',
  REGIME_FILTER: 'Setup incompatible with detected market regime',
  SCORE_FILTER: 'Opportunity score below threshold (< 60)',
  AI_PASS: 'AI Adversarial Council consensus was PASS',
  AI_HOLD: 'AI Adversarial Council recommendation was HOLD',
  RISK_GATE: 'Deterministic risk gate blocked (allocation / loss limit)',
  POSITION_SIZING: 'Volatility-adjusted sizing returned 0 quantity',
  MAX_POSITIONS: 'Maximum concurrent open positions reached',
  ALREADY_HELD: 'Asset already held in active portfolio'
};

export function analyzeRejections(
  rejected: RejectedCandidateRecord[],
  totalScanned: number = 0,
  totalTraded: number = 0
): RejectionFunnelAnalysis {
  const distribution: Record<string, number> = {};
  for (const r of rejected) {
    distribution[r.rejectionStage] = (distribution[r.rejectionStage] || 0) + 1;
  }

  const effectiveTotal = Math.max(totalScanned, rejected.length + totalTraded);

  const stages: RejectionFunnelStage[] = Object.keys(STAGE_DESCRIPTIONS).map(stage => {
    const count = distribution[stage] || 0;
    const percentage = effectiveTotal > 0 ? (count / effectiveTotal) * 100 : 0;
    return {
      stage,
      count,
      percentageOfScanned: round2(percentage),
      description: STAGE_DESCRIPTIONS[stage]
    };
  });

  return {
    totalScanned: effectiveTotal,
    totalRejected: rejected.length,
    totalEvaluated: effectiveTotal - (distribution['SESSION_FILTER'] || 0) - (distribution['LIQUIDITY_FILTER'] || 0),
    totalTraded,
    stages,
    rejectionDistribution: distribution
  };
}

export function buildSessionAlphaSummary(
  session: SessionEvidence,
  rejectedCount: number,
  approvedCount: number
): SessionAlphaSummary {
  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    cycles: session.totalCyclesExecuted,
    candidatesScanned: session.totalCandidatesScanned,
    candidatesRejected: rejectedCount,
    candidatesApproved: approvedCount,
    ordersSubmitted: session.totalOrdersSubmitted,
    ordersFilled: session.totalTradesExecuted,
    completedTrades: session.totalTradesExecuted,
    openTrades: session.currentPositionsCount,
    realizedGrossPnL: session.realizedPnLUsd,
    totalR: session.totalR,
    evidenceQuality: session.evidenceQuality
  };
}

export async function buildAlphaReviewSnapshot(): Promise<AlphaReviewSnapshot> {
  const now = new Date().toISOString();
  const allTrades = tradeLedger.getAllTrades();
  const rejected = tradeLedger.getRejectedCandidates();
  const session = sessionEvidenceManager.getSessionEvidence();

  const evidence = normalizeAlphaEvidence(allTrades);
  const verdict = computeAlphaVerdict(evidence);
  const confidenceCalibration = reviewConfidenceCalibration(evidence);
  const opportunityCalibration = reviewOpportunityCalibration(evidence);
  const fullAttribution = computeFullAttribution(allTrades);
  const rejectionAnalysis = analyzeRejections(rejected, session.totalCandidatesScanned, allTrades.length);
  const sessionSummary = buildSessionAlphaSummary(session, rejected.length, allTrades.length);

  return {
    generatedAt: now,
    evidence,
    verdict,
    confidenceCalibration,
    opportunityCalibration,
    strategyAttribution: fullAttribution.byStrategy,
    regimeAttribution: fullAttribution.byRegime,
    assetClassAttribution: fullAttribution.byAssetClass,
    factorAttribution: fullAttribution.byFactor,
    rejectionAnalysis,
    sessionSummary
  };
}
