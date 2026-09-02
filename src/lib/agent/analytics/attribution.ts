import { AssetClass } from '../../types';
import { MarketRegimeType } from '../regime';
import { TradeRecord, AttributionBucket, StrategyAttributionGroup, RegimeAttributionGroup, AssetClassAttributionGroup, ScoreBucketAttributionGroup, ConfidenceBucketAttributionGroup, RRBucketAttributionGroup, FactorAttributionGroup, FullAttribution } from './types';

// ---------------------------------------------------------------------------
// Phase 8.8C/D: Deterministic Strategy & Factor Attribution
// INVARIANT: Groups actual completed trade outcomes. No fabricated results.
// INVARIANT: Empty groups produce zero-initialized buckets, not errors.
// ---------------------------------------------------------------------------

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function round2(v: number): number {
  return Number(v.toFixed(2));
}

function computeBucket(label: string, trades: TradeRecord[]): AttributionBucket {
  const completed = trades.filter(t => t.outcome !== 'OPEN');
  const winners = completed.filter(t => t.outcome === 'WIN');
  const losers = completed.filter(t => t.outcome === 'LOSS');
  const winRate = safeDiv(winners.length, completed.length);
  const lossRate = safeDiv(losers.length, completed.length);
  const avgWin = safeDiv(winners.reduce((s, t) => s + (t.realizedPnL ?? 0), 0), Math.max(1, winners.length));
  const avgLoss = safeDiv(Math.abs(losers.reduce((s, t) => s + (t.realizedPnL ?? 0), 0)), Math.max(1, losers.length));
  const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
  const totalPnL = completed.reduce((s, t) => s + (t.realizedPnL ?? 0), 0);
  const withR = completed.filter(t => t.actualR != null);
  const avgActualR = safeDiv(withR.reduce((s, t) => s + (t.actualR ?? 0), 0), Math.max(1, withR.length));
  return { label, trades: trades.length, winRate: round2(winRate), expectancyUsd: round2(expectancy), totalPnLUsd: round2(totalPnL), avgActualR: round2(avgActualR) };
}

function groupBy<T extends TradeRecord>(trades: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of trades) {
    const k = key(t);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(t);
  }
  return m;
}

export function attributeByStrategy(trades: TradeRecord[]): StrategyAttributionGroup[] {
  const groups = groupBy(trades, t => String(t.strategy));
  return Array.from(groups.entries()).map(([strategy, ts]) => ({ strategy, metrics: computeBucket(strategy, ts) }));
}

export function attributeByRegime(trades: TradeRecord[]): RegimeAttributionGroup[] {
  const groups = groupBy(trades, t => t.marketRegime);
  return Array.from(groups.entries()).map(([regime, ts]) => ({ regime: regime as MarketRegimeType, metrics: computeBucket(regime, ts) }));
}

export function attributeByAssetClass(trades: TradeRecord[]): AssetClassAttributionGroup[] {
  const groups = groupBy(trades, t => String(t.assetClass));
  return Array.from(groups.entries()).map(([ac, ts]) => ({ assetClass: ac as AssetClass, metrics: computeBucket(ac, ts) }));
}

const CONFIDENCE_BUCKETS = [
  { label: '65-79', min: 65, max: 79 },
  { label: '80-89', min: 80, max: 89 },
  { label: '90-100', min: 90, max: 100 }
];

export function attributeByConfidenceBucket(trades: TradeRecord[]): ConfidenceBucketAttributionGroup[] {
  return CONFIDENCE_BUCKETS.map(b => {
    const ts = trades.filter(t => t.aiConfidence >= b.min && t.aiConfidence <= b.max);
    return { confidenceBucket: b.label, metrics: computeBucket(b.label, ts) };
  });
}

const SCORE_BUCKETS = [
  { label: '60-69', min: 60, max: 69 },
  { label: '70-79', min: 70, max: 79 },
  { label: '80-89', min: 80, max: 89 },
  { label: '90-100', min: 90, max: 100 }
];

export function attributeByScoreBucket(trades: TradeRecord[]): ScoreBucketAttributionGroup[] {
  return SCORE_BUCKETS.map(b => {
    const ts = trades.filter(t => t.opportunityScore >= b.min && t.opportunityScore <= b.max);
    return { scoreBucket: b.label, metrics: computeBucket(b.label, ts) };
  });
}

const RR_BUCKETS = [
  { label: '2.0-2.4R', min: 2.0, max: 2.49 },
  { label: '2.5-2.9R', min: 2.5, max: 2.99 },
  { label: '3.0R+', min: 3.0, max: Infinity }
];

export function attributeByRRBucket(trades: TradeRecord[]): RRBucketAttributionGroup[] {
  return RR_BUCKETS.map(b => {
    const ts = trades.filter(t => t.estimatedRiskReward >= b.min && t.estimatedRiskReward <= b.max);
    return { rrBucket: b.label, metrics: computeBucket(b.label, ts) };
  });
}

const FACTOR_NAMES = ['momentum', 'trend', 'volume', 'volatility', 'liquidity', 'catalyst', 'riskReward', 'regimeCompatibility'] as const;

export function attributeByFactor(trades: TradeRecord[]): FactorAttributionGroup[] {
  return FACTOR_NAMES.map(factor => {
    const withScores = trades.filter(t => t.factorScores && factor in t.factorScores);
    const high = withScores.filter(t => (t.factorScores as any)[factor] >= 70);
    const medium = withScores.filter(t => (t.factorScores as any)[factor] >= 40 && (t.factorScores as any)[factor] < 70);
    const low = withScores.filter(t => (t.factorScores as any)[factor] < 40);
    return {
      factor,
      highLevel: computeBucket(`${factor}>=70`, high),
      mediumLevel: computeBucket(`${factor} 40-69`, medium),
      lowLevel: computeBucket(`${factor}<40`, low)
    };
  });
}

export function computeFullAttribution(trades: TradeRecord[]): FullAttribution {
  return {
    byStrategy: attributeByStrategy(trades),
    byRegime: attributeByRegime(trades),
    byAssetClass: attributeByAssetClass(trades),
    byConfidenceBucket: attributeByConfidenceBucket(trades),
    byScoreBucket: attributeByScoreBucket(trades),
    byRRBucket: attributeByRRBucket(trades),
    byFactor: attributeByFactor(trades),
    computedAt: new Date().toISOString()
  };
}
