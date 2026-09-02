import {
  AlphaStrategyReviewSnapshot,
  AlphaStrategyReview,
  AlphaRegimeReview,
  AlphaAssetReview,
  AlphaFactorReview,
  CalibrationReview,
  CalibrationTierReview,
  RiskReview,
  RejectionFunnelReview,
  StrategyReviewRecommendation,
  AdvisoryActionStatus,
  MonotonicityStatus,
  FactorTierMetrics
} from './strategy-review-types';
import {
  TradeRecord,
  EvidenceQuality,
  AlphaVerdict,
  RejectedCandidateRecord,
  SessionEvidence
} from './types';
import { MarketRegimeType, StrategyType } from '../regime';
import { AssetClass } from '../../types';
import { tradeLedger } from './trade-ledger';
import { sessionEvidenceManager } from './session-evidence';

// ---------------------------------------------------------------------------
// Phase 8.13: Alpha Verdict & Strategy Review Engine
// INVARIANT: All realized metrics derive strictly from confirmed broker fills.
// INVARIANT: Zero synthetic trade injection. No lookahead bias.
// INVARIANT: Non-causal factor phrasing. Diagnostic-only recommendations.
// ---------------------------------------------------------------------------

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function round2(v: number): number {
  return Number(v.toFixed(2));
}

function round4(v: number): number {
  return Number(v.toFixed(4));
}

export function safeProfitFactor(grossWin: number, grossLoss: number): number {
  if (grossLoss <= 0) return grossWin > 0 ? 999.99 : 0;
  return round2(grossWin / grossLoss);
}

export function evaluateEvidenceQuality(sampleSize: number, expectancyUsd: number = 0, winRate: number = 0, profitFactor: number = 0): EvidenceQuality {
  if (sampleSize < 5) return 'INSUFFICIENT';
  if (sampleSize < 20) return 'PRELIMINARY';
  if (expectancyUsd <= 0) return 'NO_DEMONSTRATED_ALPHA';
  if (winRate >= 0.55 && profitFactor >= 1.5) return 'PROMISING';
  return 'MEANINGFUL';
}

export function computePrimaryVerdict(completedTrades: TradeRecord[]): AlphaVerdict {
  const now = new Date().toISOString();
  const N = completedTrades.length;

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
        'Zero synthetic trades or fabricated fills injected',
        'Deterministic risk controls actively protecting capital'
      ],
      weaknesses: [
        'Zero completed paper trades recorded on competition baseline'
      ],
      recommendations: [
        'Maintain autonomous market observation to accumulate empirical paper executions',
        'Keep strategy parameters unchanged until N >= 20 trades are observed'
      ],
      confidence: 'LOW',
      generatedAt: now
    };
  }

  const winners = completedTrades.filter(t => (t.realizedPnL ?? 0) > 0.0001);
  const losers = completedTrades.filter(t => (t.realizedPnL ?? 0) < -0.0001);
  const winRate = safeDiv(winners.length, N);
  const lossRate = safeDiv(losers.length, N);

  const grossWin = winners.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0));

  const avgWin = safeDiv(grossWin, Math.max(1, winners.length));
  const avgLoss = safeDiv(grossLoss, Math.max(1, losers.length));
  const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
  const profitFactor = safeProfitFactor(grossWin, grossLoss);

  const validRTrades = completedTrades.filter(t => t.actualR !== undefined && Number.isFinite(t.actualR));
  const totalR = validRTrades.reduce((sum, t) => sum + (t.actualR ?? 0), 0);

  const quality = evaluateEvidenceQuality(N, expectancy, winRate, profitFactor);
  const confidence: 'LOW' | 'MEDIUM' | 'HIGH' = N >= 50 ? 'HIGH' : N >= 20 ? 'MEDIUM' : 'LOW';

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (winRate >= 0.5) strengths.push(`Realized win rate is ${(winRate * 100).toFixed(1)}% across ${N} completed trades.`);
  else weaknesses.push(`Realized win rate is below 50% (${(winRate * 100).toFixed(1)}%).`);

  if (expectancy > 0) strengths.push(`Positive realized gross expectancy of +$${expectancy.toFixed(2)} per trade.`);
  else weaknesses.push(`Negative or neutral realized gross expectancy ($${expectancy.toFixed(2)} per trade).`);

  if (totalR > 0) strengths.push(`Cumulative return multiple is positive at +${totalR.toFixed(2)}R.`);
  else if (totalR < 0) weaknesses.push(`Cumulative return multiple is negative at ${totalR.toFixed(2)}R.`);

  if (N < 20) {
    recommendations.push(`Sample size (${N} trades) is preliminary. Collect at least ${20 - N} more completed trades before evaluating parameter changes.`);
  } else if (expectancy <= 0) {
    recommendations.push('Review candidate selection criteria and risk-gate filters before considering strategy calibration.');
  } else {
    recommendations.push('Positive empirical expectancy observed. Continue observation across varying market regimes.');
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

const STRATEGIES: Array<StrategyType | string> = [
  'MOMENTUM_BREAKOUT',
  'MEAN_REVERSION',
  'VOLATILITY_EXPANSION',
  'TREND_CONTINUATION'
];

export function reviewStrategies(completedTrades: TradeRecord[]): AlphaStrategyReview[] {
  return STRATEGIES.map(strat => {
    const subset = completedTrades.filter(t => String(t.strategy) === String(strat));
    const n = subset.length;
    const winners = subset.filter(t => (t.realizedPnL ?? 0) > 0.0001);
    const losers = subset.filter(t => (t.realizedPnL ?? 0) < -0.0001);
    const breakevens = subset.filter(t => Math.abs(t.realizedPnL ?? 0) <= 0.0001);

    const winRate = safeDiv(winners.length, n);
    const lossRate = safeDiv(losers.length, n);

    const grossProfit = winners.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0));

    const avgWin = safeDiv(grossProfit, Math.max(1, winners.length));
    const avgLoss = safeDiv(grossLoss, Math.max(1, losers.length));
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
    const profitFactor = safeProfitFactor(grossProfit, grossLoss);

    const withR = subset.filter(t => t.actualR !== undefined && Number.isFinite(t.actualR));
    const totalR = withR.reduce((sum, t) => sum + (t.actualR ?? 0), 0);
    const avgR = safeDiv(totalR, Math.max(1, withR.length));

    // Calculate drawdown for strategy subset
    let peak = 0;
    let running = 0;
    let maxDd = 0;
    for (const t of subset) {
      running += (t.realizedPnL ?? 0);
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDd) maxDd = dd;
    }

    const quality = evaluateEvidenceQuality(n, expectancy, winRate, profitFactor);
    let advisoryStatus: AdvisoryActionStatus = 'INSUFFICIENT_EVIDENCE';
    if (n >= 20) {
      if (expectancy > 0 && winRate >= 0.55) advisoryStatus = 'CONSIDER';
      else if (expectancy > 0) advisoryStatus = 'WATCH';
      else advisoryStatus = 'DEPRIORITIZE';
    } else if (n >= 5) {
      advisoryStatus = 'WATCH';
    }

    return {
      strategy: String(strat),
      sampleSize: n,
      wins: winners.length,
      losses: losers.length,
      breakevens: breakevens.length,
      winRate: round2(winRate),
      expectancyUsd: round2(expectancy),
      grossProfitUsd: round2(grossProfit),
      grossLossUsd: round2(grossLoss),
      profitFactor: round2(profitFactor),
      avgActualR: round2(avgR),
      totalRealizedR: round2(totalR),
      maxDrawdownUsd: round2(maxDd),
      maxDrawdownPct: 0,
      evidenceQuality: quality,
      verdict: quality,
      advisoryStatus
    };
  });
}

const REGIMES: Array<MarketRegimeType | string> = [
  'BULL_TREND',
  'BEAR_TREND',
  'SIDEWAYS_RANGE',
  'HIGH_VOLATILITY',
  'LOW_LIQUIDITY'
];

export function reviewRegimes(completedTrades: TradeRecord[]): AlphaRegimeReview[] {
  return REGIMES.map(regime => {
    const subset = completedTrades.filter(t => String(t.marketRegime) === String(regime));
    const n = subset.length;
    const winners = subset.filter(t => (t.realizedPnL ?? 0) > 0.0001);
    const losers = subset.filter(t => (t.realizedPnL ?? 0) < -0.0001);
    const breakevens = subset.filter(t => Math.abs(t.realizedPnL ?? 0) <= 0.0001);

    const winRate = safeDiv(winners.length, n);
    const lossRate = safeDiv(losers.length, n);
    const grossProfit = winners.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0));
    const avgWin = safeDiv(grossProfit, Math.max(1, winners.length));
    const avgLoss = safeDiv(grossLoss, Math.max(1, losers.length));
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
    const profitFactor = safeProfitFactor(grossProfit, grossLoss);

    const withR = subset.filter(t => t.actualR !== undefined && Number.isFinite(t.actualR));
    const totalR = withR.reduce((sum, t) => sum + (t.actualR ?? 0), 0);
    const avgR = safeDiv(totalR, Math.max(1, withR.length));
    const quality = evaluateEvidenceQuality(n, expectancy, winRate, profitFactor);

    let advisoryStatus: AdvisoryActionStatus = 'INSUFFICIENT_EVIDENCE';
    if (n >= 20) {
      advisoryStatus = expectancy > 0 ? 'WATCH' : 'INVESTIGATE';
    } else if (n >= 5) {
      advisoryStatus = 'WATCH';
    }

    return {
      regime,
      sampleSize: n,
      wins: winners.length,
      losses: losers.length,
      breakevens: breakevens.length,
      winRate: round2(winRate),
      expectancyUsd: round2(expectancy),
      grossProfitUsd: round2(grossProfit),
      grossLossUsd: round2(grossLoss),
      profitFactor: round2(profitFactor),
      avgActualR: round2(avgR),
      totalRealizedR: round2(totalR),
      evidenceQuality: quality,
      advisoryStatus
    };
  });
}

const ASSET_CLASSES: AssetClass[] = ['EQUITY', 'CRYPTO'];

export function reviewAssets(completedTrades: TradeRecord[]): AlphaAssetReview[] {
  return ASSET_CLASSES.map(ac => {
    const subset = completedTrades.filter(t => t.assetClass === ac);
    const n = subset.length;
    const winners = subset.filter(t => (t.realizedPnL ?? 0) > 0.0001);
    const losers = subset.filter(t => (t.realizedPnL ?? 0) < -0.0001);
    const breakevens = subset.filter(t => Math.abs(t.realizedPnL ?? 0) <= 0.0001);

    const winRate = safeDiv(winners.length, n);
    const lossRate = safeDiv(losers.length, n);
    const grossProfit = winners.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0));
    const avgWin = safeDiv(grossProfit, Math.max(1, winners.length));
    const avgLoss = safeDiv(grossLoss, Math.max(1, losers.length));
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
    const profitFactor = safeProfitFactor(grossProfit, grossLoss);
    const totalPnL = subset.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
    const quality = evaluateEvidenceQuality(n, expectancy, winRate, profitFactor);

    return {
      assetClass: ac,
      sampleSize: n,
      wins: winners.length,
      losses: losers.length,
      breakevens: breakevens.length,
      winRate: round2(winRate),
      expectancyUsd: round2(expectancy),
      totalPnLUsd: round2(totalPnL),
      profitFactor: round2(profitFactor),
      evidenceQuality: quality
    };
  });
}

const FACTOR_NAMES = [
  'momentum',
  'trend',
  'volume',
  'volatility',
  'liquidity',
  'catalyst',
  'riskReward',
  'regimeCompatibility'
] as const;

function computeFactorTier(trades: TradeRecord[]): FactorTierMetrics {
  const n = trades.length;
  const winners = trades.filter(t => (t.realizedPnL ?? 0) > 0.0001);
  const losers = trades.filter(t => (t.realizedPnL ?? 0) < -0.0001);
  const winRate = safeDiv(winners.length, n);
  const lossRate = safeDiv(losers.length, n);
  const grossProfit = winners.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0));
  const avgWin = safeDiv(grossProfit, Math.max(1, winners.length));
  const avgLoss = safeDiv(grossLoss, Math.max(1, losers.length));
  const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
  const withR = trades.filter(t => t.actualR !== undefined && Number.isFinite(t.actualR));
  const avgR = safeDiv(withR.reduce((sum, t) => sum + (t.actualR ?? 0), 0), Math.max(1, withR.length));

  return {
    sampleSize: n,
    wins: winners.length,
    losses: losers.length,
    winRate: round2(winRate),
    expectancyUsd: round2(expectancy),
    avgActualR: round2(avgR),
    evidenceQuality: evaluateEvidenceQuality(n, expectancy, winRate)
  };
}

export function reviewFactors(completedTrades: TradeRecord[]): AlphaFactorReview[] {
  return FACTOR_NAMES.map(factor => {
    const withScore = completedTrades.filter(t => t.factorScores && factor in t.factorScores);
    const high = withScore.filter(t => (t.factorScores as any)[factor] >= 70);
    const med = withScore.filter(t => (t.factorScores as any)[factor] >= 40 && (t.factorScores as any)[factor] < 70);
    const low = withScore.filter(t => (t.factorScores as any)[factor] < 40);

    const highTier = computeFactorTier(high);
    const mediumTier = computeFactorTier(med);
    const lowTier = computeFactorTier(low);

    let note = `Observational data for ${factor} factor. High-tier (score >= 70) sample N=${highTier.sampleSize}.`;
    if (highTier.sampleSize >= 5 && highTier.winRate > mediumTier.winRate) {
      note = `Higher ${factor} scores are empirically observed alongside higher win rates in the sample (${(highTier.winRate * 100).toFixed(0)}% vs ${(mediumTier.winRate * 100).toFixed(0)}%), without establishing a causal link.`;
    }

    return {
      factor,
      highTier,
      mediumTier,
      lowTier,
      observationalNote: note
    };
  });
}

const CALIBRATION_BUCKET_DEFS = [
  { label: '0–49', min: 0, max: 49 },
  { label: '50–59', min: 50, max: 59 },
  { label: '60–69', min: 60, max: 69 },
  { label: '70–79', min: 70, max: 79 },
  { label: '80–89', min: 80, max: 89 },
  { label: '90–100', min: 90, max: 100 }
];

function computeCalibrationTier(bucketDef: { label: string; min: number; max: number }, trades: TradeRecord[]): CalibrationTierReview {
  const n = trades.length;
  const winners = trades.filter(t => (t.realizedPnL ?? 0) > 0.0001);
  const losers = trades.filter(t => (t.realizedPnL ?? 0) < -0.0001);
  const winRate = safeDiv(winners.length, n);
  const lossRate = safeDiv(losers.length, n);
  const grossProfit = winners.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0));
  const avgWin = safeDiv(grossProfit, Math.max(1, winners.length));
  const avgLoss = safeDiv(grossLoss, Math.max(1, losers.length));
  const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
  const pf = safeProfitFactor(grossProfit, grossLoss);
  const withR = trades.filter(t => t.actualR !== undefined && Number.isFinite(t.actualR));
  const avgR = safeDiv(withR.reduce((sum, t) => sum + (t.actualR ?? 0), 0), Math.max(1, withR.length));

  return {
    bucketLabel: bucketDef.label,
    min: bucketDef.min,
    max: bucketDef.max,
    sampleSize: n,
    wins: winners.length,
    losses: losers.length,
    winRate: round2(winRate),
    expectancyUsd: round2(expectancy),
    avgActualR: round2(avgR),
    profitFactor: round2(pf),
    evidenceQuality: evaluateEvidenceQuality(n, expectancy, winRate, pf)
  };
}

export function reviewCalibration(completedTrades: TradeRecord[]): CalibrationReview {
  const confidenceBuckets = CALIBRATION_BUCKET_DEFS.map(b => {
    const subset = completedTrades.filter(t => t.aiConfidence >= b.min && t.aiConfidence <= b.max);
    return computeCalibrationTier(b, subset);
  });

  const opportunityBuckets = CALIBRATION_BUCKET_DEFS.map(b => {
    const subset = completedTrades.filter(t => t.opportunityScore >= b.min && t.opportunityScore <= b.max);
    return computeCalibrationTier(b, subset);
  });

  const totalN = completedTrades.length;
  let confStatus: MonotonicityStatus = 'INSUFFICIENT_SAMPLE';
  let oppStatus: MonotonicityStatus = 'INSUFFICIENT_SAMPLE';

  if (totalN >= 20) {
    const populatedConf = confidenceBuckets.filter(b => b.sampleSize >= 3);
    if (populatedConf.length >= 3) {
      let isMonotonic = true;
      for (let i = 1; i < populatedConf.length; i++) {
        if (populatedConf[i].expectancyUsd < populatedConf[i - 1].expectancyUsd) isMonotonic = false;
      }
      confStatus = isMonotonic ? 'EVIDENCE_OF_MONOTONICITY' : 'UNCALIBRATED';
    } else {
      confStatus = 'PRELIMINARY';
    }

    const populatedOpp = opportunityBuckets.filter(b => b.sampleSize >= 3);
    if (populatedOpp.length >= 3) {
      let isMonotonic = true;
      for (let i = 1; i < populatedOpp.length; i++) {
        if (populatedOpp[i].expectancyUsd < populatedOpp[i - 1].expectancyUsd) isMonotonic = false;
      }
      oppStatus = isMonotonic ? 'EVIDENCE_OF_MONOTONICITY' : 'UNCALIBRATED';
    } else {
      oppStatus = 'PRELIMINARY';
    }
  }

  return {
    confidenceBuckets,
    opportunityBuckets,
    confidenceMonotonicity: confStatus,
    opportunityMonotonicity: oppStatus,
    sampleThresholdRequired: 20
  };
}

export function reviewRisk(completedTrades: TradeRecord[], startingEquity: number = 100000): RiskReview {
  let runningEquity = startingEquity;
  let peakEquity = startingEquity;
  let maxDrawdownUsd = 0;
  let largestWinUsd = 0;
  let largestLossUsd = 0;

  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;

  for (const t of completedTrades) {
    const pnl = t.realizedPnL ?? 0;
    runningEquity += pnl;
    if (runningEquity > peakEquity) peakEquity = runningEquity;
    const dd = peakEquity - runningEquity;
    if (dd > maxDrawdownUsd) maxDrawdownUsd = dd;

    if (pnl > largestWinUsd) largestWinUsd = pnl;
    if (pnl < largestLossUsd) largestLossUsd = pnl;

    if (pnl > 0.0001) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (pnl < -0.0001) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  }

  const totalRealizedPnL = runningEquity - startingEquity;
  const totalRealizedPnLPct = safeDiv(totalRealizedPnL, startingEquity) * 100;
  const currentDrawdownUsd = Math.max(0, peakEquity - runningEquity);
  const currentDrawdownPct = safeDiv(currentDrawdownUsd, peakEquity) * 100;
  const maxDrawdownPct = safeDiv(maxDrawdownUsd, peakEquity) * 100;

  return {
    startingEquityUsd: round2(startingEquity),
    currentEquityUsd: round2(runningEquity),
    peakEquityUsd: round2(peakEquity),
    totalRealizedPnLUsd: round2(totalRealizedPnL),
    totalRealizedPnLPct: round2(totalRealizedPnLPct),
    currentDrawdownUsd: round2(currentDrawdownUsd),
    currentDrawdownPct: round2(currentDrawdownPct),
    maxDrawdownUsd: round2(maxDrawdownUsd),
    maxDrawdownPct: round2(maxDrawdownPct),
    largestWinUsd: round2(largestWinUsd),
    largestLossUsd: round2(largestLossUsd),
    maxConsecutiveWins: maxWinStreak,
    maxConsecutiveLosses: maxLossStreak,
    direction: 'LONG',
    isGrossPnL: true
  };
}

const REJECTION_DESCRIPTIONS: Record<string, string> = {
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

export function reviewRejectionFunnel(
  rejections: RejectedCandidateRecord[],
  totalScanned: number = 0,
  totalTraded: number = 0
): RejectionFunnelReview {
  const counts: Record<string, number> = {};
  for (const r of rejections) {
    counts[r.rejectionStage] = (counts[r.rejectionStage] || 0) + 1;
  }

  const effectiveScanned = Math.max(totalScanned, rejections.length + totalTraded);
  const passThrough = effectiveScanned > 0 ? (totalTraded / effectiveScanned) * 100 : 0;

  const stages = Object.keys(REJECTION_DESCRIPTIONS).map(stage => {
    const c = counts[stage] || 0;
    const pct = effectiveScanned > 0 ? (c / effectiveScanned) * 100 : 0;
    return {
      stage,
      rejectedCount: c,
      rejectionPercentage: round2(pct),
      diagnosticNote: REJECTION_DESCRIPTIONS[stage]
    };
  });

  return {
    totalCandidatesScanned: effectiveScanned,
    totalCandidatesRejected: rejections.length,
    totalCandidatesTraded: totalTraded,
    passThroughPercentage: round2(passThrough),
    stages,
    methodologyNote: 'Purely diagnostic filter analysis. No hypothetical winner P&L estimation.'
  };
}

export function generateRecommendations(
  verdict: AlphaVerdict,
  strategies: AlphaStrategyReview[],
  calibration: CalibrationReview
): StrategyReviewRecommendation[] {
  const recs: StrategyReviewRecommendation[] = [];

  if (verdict.completedTrades === 0) {
    recs.push({
      category: 'STRATEGY',
      target: 'ALL_STRATEGIES',
      status: 'INSUFFICIENT_EVIDENCE',
      sampleSize: 0,
      evidenceSummary: '0 completed paper trades recorded.',
      advisoryRationale: 'Keep strategy configuration strictly immutable and observe paper market execution.'
    });
    return recs;
  }

  for (const s of strategies) {
    if (s.sampleSize >= 20) {
      if (s.expectancyUsd <= 0) {
        recs.push({
          category: 'STRATEGY',
          target: s.strategy,
          status: 'DEPRIORITIZE',
          sampleSize: s.sampleSize,
          evidenceSummary: `${s.sampleSize} trades with negative expectancy ($${s.expectancyUsd}).`,
          advisoryRationale: 'Empirical paper results suggest poor fit in current market conditions. Review entry criteria.'
        });
      } else if (s.winRate >= 0.55 && s.profitFactor >= 1.5) {
        recs.push({
          category: 'STRATEGY',
          target: s.strategy,
          status: 'CONSIDER',
          sampleSize: s.sampleSize,
          evidenceSummary: `${s.sampleSize} trades with win rate ${(s.winRate * 100).toFixed(0)}% and PF ${s.profitFactor}.`,
          advisoryRationale: 'Strategy exhibits robust empirical expectancy across meaningful sample.'
        });
      }
    } else {
      recs.push({
        category: 'STRATEGY',
        target: s.strategy,
        status: s.sampleSize >= 5 ? 'WATCH' : 'INSUFFICIENT_EVIDENCE',
        sampleSize: s.sampleSize,
        evidenceSummary: `${s.sampleSize} trades recorded.`,
        advisoryRationale: 'Sample size below statistical significance threshold (N < 20). No parameter adjustments advised.'
      });
    }
  }

  return recs;
}

export async function buildAlphaStrategyReviewSnapshot(): Promise<AlphaStrategyReviewSnapshot> {
  const now = new Date().toISOString();
  const allTrades = tradeLedger.getAllTrades();
  const completed = tradeLedger.getCompletedTrades();
  const openTrades = tradeLedger.getOpenTrades();
  const rejections = tradeLedger.getRejectedCandidates();
  const session = sessionEvidenceManager.getSessionEvidence();

  const primaryVerdict = computePrimaryVerdict(completed);
  const strategyReviews = reviewStrategies(completed);
  const regimeReviews = reviewRegimes(completed);
  const assetReviews = reviewAssets(completed);
  const factorReviews = reviewFactors(completed);
  const calibrationReview = reviewCalibration(completed);
  const riskReview = reviewRisk(completed, session.startingEquity || 100000);
  const rejectionFunnelReview = reviewRejectionFunnel(rejections, session.totalCandidatesScanned, allTrades.length);
  const recommendations = generateRecommendations(primaryVerdict, strategyReviews, calibrationReview);

  return {
    generatedAt: now,
    completedTradesCount: completed.length,
    openTradesCount: openTrades.length,
    primaryVerdict,
    strategyReviews,
    regimeReviews,
    assetReviews,
    factorReviews,
    calibrationReview,
    riskReview,
    rejectionFunnelReview,
    recommendations
  };
}
