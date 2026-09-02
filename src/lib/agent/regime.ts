import { MarketSnapshot } from '../types';

// ---------------------------------------------------------------------------
// Phase 8.7: Deterministic Market Regime Layer
// INVARIANT: Purely deterministic classification based on quantitative features.
// INVARIANT: Zero random numbers, zero stochastic modeling.
// ---------------------------------------------------------------------------

export type MarketRegimeType =
  | 'TRENDING_UP'
  | 'TRENDING_DOWN'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'RANGE_BOUND'
  | 'RISK_OFF'
  | 'RISK_ON'
  | 'UNKNOWN';

export type StrategyType =
  | 'MOMENTUM_BREAKOUT'
  | 'MEAN_REVERSION'
  | 'CATALYST_CONTINUATION'
  | 'VOLATILITY_EXPANSION';

export interface MarketRegimeState {
  regime: MarketRegimeType;
  confidence: number; // 0 - 100
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volatilityEnvironment: 'HIGH' | 'NORMAL' | 'LOW';
  liquidityEnvironment: 'DEEP' | 'ADEQUATE' | 'THIN';
  compatibleStrategies: StrategyType[];
  incompatibleStrategies: StrategyType[];
  characteristics: string[];
  assessedAt: string;
}

/**
 * Strategy compatibility matrix for each market regime.
 */
const REGIME_STRATEGY_MAP: Record<
  MarketRegimeType,
  { compatible: StrategyType[]; incompatible: StrategyType[] }
> = {
  TRENDING_UP: {
    compatible: ['MOMENTUM_BREAKOUT', 'CATALYST_CONTINUATION'],
    incompatible: ['MEAN_REVERSION']
  },
  TRENDING_DOWN: {
    compatible: ['VOLATILITY_EXPANSION'],
    incompatible: ['MOMENTUM_BREAKOUT', 'CATALYST_CONTINUATION']
  },
  HIGH_VOLATILITY: {
    compatible: ['VOLATILITY_EXPANSION'],
    incompatible: ['MEAN_REVERSION']
  },
  LOW_VOLATILITY: {
    compatible: ['RANGE_BOUND' as any, 'MEAN_REVERSION'],
    incompatible: ['VOLATILITY_EXPANSION']
  },
  RANGE_BOUND: {
    compatible: ['MEAN_REVERSION'],
    incompatible: ['MOMENTUM_BREAKOUT']
  },
  RISK_ON: {
    compatible: ['MOMENTUM_BREAKOUT', 'CATALYST_CONTINUATION', 'VOLATILITY_EXPANSION'],
    incompatible: ['MEAN_REVERSION']
  },
  RISK_OFF: {
    compatible: ['MEAN_REVERSION'],
    incompatible: ['MOMENTUM_BREAKOUT', 'CATALYST_CONTINUATION']
  },
  UNKNOWN: {
    compatible: ['MEAN_REVERSION'],
    incompatible: ['MOMENTUM_BREAKOUT']
  }
};

/**
 * Classifies market regime deterministically from market snapshot data.
 */
export function classifyMarketRegime(
  snapshot: MarketSnapshot,
  broadMarketSnapshot?: MarketSnapshot
): MarketRegimeState {
  const now = new Date().toISOString();
  const rsi = snapshot.rsi14;
  const momentum = snapshot.momentumScore;
  const vol = snapshot.realizedVolatility;
  const rvol = snapshot.relativeVolume;
  const volAccel = snapshot.volumeAcceleration;
  const liquidity = snapshot.liquidityUsd;
  const spreadBps = snapshot.spreadBps;

  // 1. Volatility Environment
  let volatilityEnv: 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL';
  if (vol > 45) {
    volatilityEnv = 'HIGH';
  } else if (vol < 15) {
    volatilityEnv = 'LOW';
  }

  // 2. Liquidity Environment
  let liquidityEnv: 'DEEP' | 'ADEQUATE' | 'THIN' = 'ADEQUATE';
  if (liquidity >= 5000000 && spreadBps <= 15) {
    liquidityEnv = 'DEEP';
  } else if (liquidity < 500000 || spreadBps > 50) {
    liquidityEnv = 'THIN';
  }

  // 3. Trend Direction
  let trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (rsi > 55 && momentum > 60) {
    trendDirection = 'BULLISH';
  } else if (rsi < 45 && momentum < 40) {
    trendDirection = 'BEARISH';
  }

  // 4. Primary Regime Classification
  let regime: MarketRegimeType = 'RANGE_BOUND';
  const characteristics: string[] = [];

  if (volatilityEnv === 'HIGH' && trendDirection === 'BEARISH') {
    regime = 'RISK_OFF';
    characteristics.push('Elevated realized volatility accompanied by declining price structure');
    characteristics.push('Broad market risk-off posture favors defensive sizing and protective stops');
  } else if (trendDirection === 'BULLISH' && rvol >= 1.2 && volAccel > 0) {
    regime = 'RISK_ON';
    characteristics.push('Bullish momentum confirmed by elevated relative volume and positive volume acceleration');
    characteristics.push('Risk-on environment favors momentum breakout and continuation strategies');
  } else if (trendDirection === 'BULLISH') {
    regime = 'TRENDING_UP';
    characteristics.push('Upward price trend supported by RSI > 55 and positive momentum score');
  } else if (trendDirection === 'BEARISH') {
    regime = 'TRENDING_DOWN';
    characteristics.push('Downward price trend with RSI < 45 and weakened momentum');
  } else if (volatilityEnv === 'HIGH') {
    regime = 'HIGH_VOLATILITY';
    characteristics.push(`High realized volatility (${vol.toFixed(1)}%) with indeterminate trend`);
  } else if (volatilityEnv === 'LOW' && rvol < 0.9) {
    regime = 'LOW_VOLATILITY';
    characteristics.push(`Subdued volatility (${vol.toFixed(1)}%) and low turnover`);
  } else {
    regime = 'RANGE_BOUND';
    characteristics.push('Price oscillating within bounded corridor without persistent directional trend');
  }

  const strategyMapping = REGIME_STRATEGY_MAP[regime] || REGIME_STRATEGY_MAP.UNKNOWN;

  return {
    regime,
    confidence: calculateRegimeConfidence(momentum, vol, rvol),
    trendDirection,
    volatilityEnvironment: volatilityEnv,
    liquidityEnvironment: liquidityEnv,
    compatibleStrategies: strategyMapping.compatible,
    incompatibleStrategies: strategyMapping.incompatible,
    characteristics,
    assessedAt: now
  };
}

/**
 * Checks whether a proposed strategy is compatible with the detected regime.
 */
export function isStrategyCompatibleWithRegime(
  strategy: StrategyType,
  regimeState: MarketRegimeState
): { compatible: boolean; reason?: string } {
  if (regimeState.incompatibleStrategies.includes(strategy)) {
    return {
      compatible: false,
      reason: `Strategy ${strategy} is explicitly incompatible with current regime ${regimeState.regime}.`
    };
  }

  if (regimeState.compatibleStrategies.includes(strategy)) {
    return { compatible: true };
  }

  return {
    compatible: true,
    reason: `Strategy ${strategy} has neutral compatibility with ${regimeState.regime}.`
  };
}

/**
 * Deterministic confidence score for regime detection (50 - 95).
 */
function calculateRegimeConfidence(momentum: number, volatility: number, rvol: number): number {
  let score = 70;
  if (momentum >= 75 || momentum <= 25) score += 10;
  if (rvol >= 1.5) score += 10;
  if (volatility > 50) score -= 5;
  return Math.min(95, Math.max(50, score));
}
