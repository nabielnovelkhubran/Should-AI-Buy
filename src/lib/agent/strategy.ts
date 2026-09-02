import { MarketSnapshot } from '../types';
import { MarketRegimeState, StrategyType, isStrategyCompatibleWithRegime } from './regime';
import { detectAssetClass } from '../scanner/universe';

// ---------------------------------------------------------------------------
// Phase 8.7: Multi-Factor Opportunity Scoring Engine
// INVARIANT: Purely deterministic multi-factor decomposition (0 - 100).
// INVARIANT: Transparent weights, zero random numbers.
// ---------------------------------------------------------------------------

export interface FactorBreakdown {
  momentum: number;           // 0 - 100
  trend: number;              // 0 - 100
  volume: number;             // 0 - 100
  volatility: number;         // 0 - 100
  liquidity: number;          // 0 - 100
  catalyst: number;           // 0 - 100
  riskReward: number;         // 0 - 100
  regimeCompatibility: number;// 0 - 100
}

export interface FactorWeights {
  momentum: number;
  trend: number;
  volume: number;
  volatility: number;
  liquidity: number;
  catalyst: number;
  riskReward: number;
  regimeCompatibility: number;
}

export const DEFAULT_FACTOR_WEIGHTS: FactorWeights = {
  momentum: 0.20,
  trend: 0.15,
  volume: 0.15,
  volatility: 0.10,
  liquidity: 0.10,
  catalyst: 0.10,
  riskReward: 0.10,
  regimeCompatibility: 0.10
};

export interface MultiFactorEvaluation {
  symbol: string;
  opportunityScore: number;   // Composite 0 - 100
  factors: FactorBreakdown;
  weights: FactorWeights;
  recommendedStrategy: StrategyType;
  estimatedRiskRewardRatio: number; // e.g. 2.8 (2.8R)
  reasons: string[];
  warnings: string[];
  isEligibleForCouncil: boolean;
  evaluatedAt: string;
}

/**
 * Computes multi-factor opportunity score with full factor decomposition.
 */
export function evaluateMultiFactorOpportunity(
  snapshot: MarketSnapshot,
  regimeState: MarketRegimeState,
  options?: {
    catalystEvidenceScore?: number;
    weights?: Partial<FactorWeights>;
    minOpportunityThreshold?: number;
    minRiskRewardRatio?: number;
  }
): MultiFactorEvaluation {
  const now = new Date().toISOString();
  const weights: FactorWeights = { ...DEFAULT_FACTOR_WEIGHTS, ...options?.weights };
  const minThreshold = options?.minOpportunityThreshold ?? 50;
  const minRR = options?.minRiskRewardRatio ?? 1.25;

  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Momentum Factor (0 - 100)
  const momentumScore = Math.min(100, Math.max(0, snapshot.momentumScore));
  if (momentumScore >= 70) {
    reasons.push(`Strong quantitative momentum (${momentumScore}/100) with bullish MACD/RSI.`);
  } else if (momentumScore < 40) {
    warnings.push(`Weak momentum score (${momentumScore}/100).`);
  }

  // 2. Trend Factor (0 - 100)
  let trendScore = 50;
  if (snapshot.rsi14 >= 50 && snapshot.rsi14 <= 70) {
    trendScore = 80;
    reasons.push(`Healthy bullish RSI (${snapshot.rsi14.toFixed(1)}) in constructive trend band.`);
  } else if (snapshot.rsi14 > 70) {
    trendScore = 65;
    warnings.push(`RSI (${snapshot.rsi14.toFixed(1)}) is extended into overbought territory.`);
  } else if (snapshot.rsi14 < 40) {
    trendScore = 30;
    warnings.push(`RSI (${snapshot.rsi14.toFixed(1)}) is in bearish territory.`);
  }

  // 3. Volume Factor (0 - 100)
  const rvolScore = Math.min(100, snapshot.relativeVolume * 40);
  const volAccelScore = Math.max(0, Math.min(100, (snapshot.volumeAcceleration + 30) * 1.5));
  const volumeScore = Math.round(rvolScore * 0.6 + volAccelScore * 0.4);
  if (snapshot.relativeVolume >= 1.5) {
    reasons.push(`Significant volume expansion with RVOL at ${snapshot.relativeVolume.toFixed(2)}x.`);
  }

  // 4. Volatility Factor (0 - 100)
  // Optimal corridor is 15% - 40%
  let volatilityScore = 50;
  const vol = snapshot.realizedVolatility;
  if (vol >= 15 && vol <= 35) {
    volatilityScore = 90;
    reasons.push(`Realized volatility (${vol.toFixed(1)}%) is inside optimal breakout corridor.`);
  } else if (vol > 35 && vol <= 50) {
    volatilityScore = 70;
  } else if (vol > 50) {
    volatilityScore = 40;
    warnings.push(`Elevated volatility (${vol.toFixed(1)}%) increases tail-risk and requires tight sizing.`);
  } else {
    volatilityScore = 40;
    warnings.push(`Subdued volatility (${vol.toFixed(1)}%) offers limited short-term upside expansion.`);
  }

  // 5. Liquidity Factor (0 - 100)
  const isCryptoSymbol = snapshot.symbol.includes('/') || detectAssetClass(snapshot.symbol) === 'CRYPTO';
  let liquidityScore = 50;
  if (snapshot.liquidityUsd >= 5000000 && snapshot.spreadBps <= 10) {
    liquidityScore = 95;
    reasons.push(`Deep institutional liquidity ($${(snapshot.liquidityUsd/1000000).toFixed(1)}M) and ultra-tight spread (${snapshot.spreadBps} bps).`);
  } else if (snapshot.liquidityUsd >= 1000000 && snapshot.spreadBps <= 25) {
    liquidityScore = 80;
  } else if (isCryptoSymbol && snapshot.liquidityUsd >= 500 && snapshot.spreadBps <= 60) {
    liquidityScore = 75; // Healthy 24/7 crypto liquidity on Alpaca paper feed
    reasons.push(`Active crypto market liquidity ($${(snapshot.liquidityUsd/1000).toFixed(1)}k).`);
  } else if (snapshot.liquidityUsd >= 100000 && snapshot.spreadBps <= 50) {
    liquidityScore = 65;
  } else if (snapshot.liquidityUsd < 500000 || snapshot.spreadBps > 50) {
    liquidityScore = 30;
    warnings.push(`Thin liquidity ($${(snapshot.liquidityUsd/1000).toFixed(1)}k) or wide spread (${snapshot.spreadBps} bps) increases slippage risk.`);
  }

  // 6. Catalyst Factor (0 - 100)
  const catalystScore = options?.catalystEvidenceScore ?? 70;

  // 7. Estimated Risk / Reward Ratio (e.g. 2.5R)
  // Estimated upside to resistance (e.g. 7.5%) vs downside invalidation (e.g. 2.5%)
  const estimatedDownsideRiskPct = Math.max(1.5, Math.min(6.0, vol * 0.12));
  const estimatedUpsideTargetPct = Math.max(3.0, (momentumScore / 10) * 0.9);
  const rawRiskRewardRatio = Number((estimatedUpsideTargetPct / estimatedDownsideRiskPct).toFixed(2));
  const estimatedRiskRewardRatio = Math.max(1.0, rawRiskRewardRatio);

  let riskRewardScore = 50;
  if (estimatedRiskRewardRatio >= 3.0) {
    riskRewardScore = 95;
    reasons.push(`Asymmetric risk/reward ratio (${estimatedRiskRewardRatio}R) with strong reward expectancy.`);
  } else if (estimatedRiskRewardRatio >= 2.0) {
    riskRewardScore = 75;
    reasons.push(`Acceptable risk/reward ratio (${estimatedRiskRewardRatio}R).`);
  } else {
    riskRewardScore = 30;
    warnings.push(`Unfavorable risk/reward ratio (${estimatedRiskRewardRatio}R < 2.0R threshold).`);
  }

  // 8. Regime Compatibility Factor
  let recommendedStrategy: StrategyType = 'MOMENTUM_BREAKOUT';
  if (regimeState.regime === 'RANGE_BOUND' || regimeState.regime === 'LOW_VOLATILITY') {
    recommendedStrategy = 'MEAN_REVERSION';
  } else if (regimeState.regime === 'HIGH_VOLATILITY' || regimeState.regime === 'RISK_OFF') {
    recommendedStrategy = 'VOLATILITY_EXPANSION';
  } else if (catalystScore >= 80) {
    recommendedStrategy = 'CATALYST_CONTINUATION';
  }

  const compatResult = isStrategyCompatibleWithRegime(recommendedStrategy, regimeState);
  let regimeCompatScore = 50;
  if (compatResult.compatible) {
    regimeCompatScore = 90;
    reasons.push(`Strategy ${recommendedStrategy} is well-aligned with ${regimeState.regime} market regime.`);
  } else {
    regimeCompatScore = 20;
    warnings.push(compatResult.reason || 'Strategy is mismatched with current market regime.');
  }

  const factors: FactorBreakdown = {
    momentum: momentumScore,
    trend: trendScore,
    volume: volumeScore,
    volatility: volatilityScore,
    liquidity: liquidityScore,
    catalyst: catalystScore,
    riskReward: riskRewardScore,
    regimeCompatibility: regimeCompatScore
  };

  // Weighted Composite Calculation
  const compositeScore = Math.round(
    factors.momentum * weights.momentum +
    factors.trend * weights.trend +
    factors.volume * weights.volume +
    factors.volatility * weights.volatility +
    factors.liquidity * weights.liquidity +
    factors.catalyst * weights.catalyst +
    factors.riskReward * weights.riskReward +
    factors.regimeCompatibility * weights.regimeCompatibility
  );

  const opportunityScore = Math.min(100, Math.max(0, compositeScore));
  const isEligible = opportunityScore >= minThreshold && estimatedRiskRewardRatio >= minRR;

  return {
    symbol: snapshot.symbol,
    opportunityScore,
    factors,
    weights,
    recommendedStrategy,
    estimatedRiskRewardRatio,
    reasons,
    warnings,
    isEligibleForCouncil: isEligible,
    evaluatedAt: now
  };
}
