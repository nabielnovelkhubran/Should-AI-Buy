import { TradeRecord, CalibrationState, CalibrationRecommendation, CalibrationReport, AttributionBucket } from './types';
import { AgentStrategyConfig } from '../types';
import { attributeByScoreBucket, attributeByConfidenceBucket, attributeByRRBucket } from './attribution';

// ---------------------------------------------------------------------------
// Phase 8.8G: Evidence-Based Strategy Calibration Framework
// INVARIANT: Sample < 20 ALWAYS produces INSUFFICIENT_EVIDENCE.
// INVARIANT: NEVER mutates production AgentStrategyConfig.
// INVARIANT: Recommendations are diagnostic only — operator must act.
// ---------------------------------------------------------------------------

const MIN_SAMPLE_SIZE = 20;
const EXPECTANCY_SPREAD_INVESTIGATE = 50;  // $50 spread between buckets
const EXPECTANCY_SPREAD_CONSIDER = 150;    // $150 spread — consider changing

function computeCalibrationState(
  sampleSize: number,
  buckets: AttributionBucket[]
): CalibrationState {
  if (sampleSize < MIN_SAMPLE_SIZE) return 'INSUFFICIENT_EVIDENCE';

  const bucketsWithTrades = buckets.filter(b => b.trades > 0);
  if (bucketsWithTrades.length < 2) return 'KEEP';

  const expectancies = bucketsWithTrades.map(b => b.expectancyUsd);
  const spread = Math.max(...expectancies) - Math.min(...expectancies);

  if (spread >= EXPECTANCY_SPREAD_CONSIDER) return 'CONSIDER_CHANGE';
  if (spread >= EXPECTANCY_SPREAD_INVESTIGATE) return 'INVESTIGATE';
  return 'KEEP';
}

function describeBuckets(buckets: AttributionBucket[]): string {
  return buckets.map(b =>
    `${b.label}: ${b.trades} trades, win_rate=${(b.winRate * 100).toFixed(0)}%, expectancy=$${b.expectancyUsd.toFixed(0)}`
  ).join(' | ');
}

export function generateCalibrationReport(
  trades: TradeRecord[],
  config: Readonly<AgentStrategyConfig>
): CalibrationReport {
  const completed = trades.filter(t => t.outcome !== 'OPEN');
  const sampleSize = completed.length;
  const now = new Date().toISOString();

  const recommendations: CalibrationRecommendation[] = [];

  // 1. Opportunity Score threshold
  {
    const buckets = attributeByScoreBucket(completed).map(g => g.metrics);
    const state = computeCalibrationState(sampleSize, buckets);
    recommendations.push({
      parameter: 'minOpportunityScore',
      currentValue: config.minOpportunityScore,
      sampleSize,
      state,
      evidence: sampleSize < MIN_SAMPLE_SIZE
        ? `Only ${sampleSize} completed trades recorded. Need ${MIN_SAMPLE_SIZE} for meaningful calibration.`
        : describeBuckets(buckets),
      bucketSummary: buckets
    });
  }

  // 2. AI Confidence threshold
  {
    const buckets = attributeByConfidenceBucket(completed).map(g => g.metrics);
    const state = computeCalibrationState(sampleSize, buckets);
    recommendations.push({
      parameter: 'minConfidenceScore',
      currentValue: config.minConfidenceScore,
      sampleSize,
      state,
      evidence: sampleSize < MIN_SAMPLE_SIZE
        ? `Only ${sampleSize} completed trades recorded. Need ${MIN_SAMPLE_SIZE} for meaningful calibration.`
        : describeBuckets(buckets),
      bucketSummary: buckets
    });
  }

  // 3. Risk/Reward threshold
  {
    const buckets = attributeByRRBucket(completed).map(g => g.metrics);
    const state = computeCalibrationState(sampleSize, buckets);
    recommendations.push({
      parameter: 'minRiskRewardRatio',
      currentValue: 2.0,
      sampleSize,
      state,
      evidence: sampleSize < MIN_SAMPLE_SIZE
        ? `Only ${sampleSize} completed trades recorded. Need ${MIN_SAMPLE_SIZE} for meaningful calibration.`
        : describeBuckets(buckets),
      bucketSummary: buckets
    });
  }

  return {
    recommendations,
    generatedAt: now,
    totalTradesSampled: sampleSize,
    note: 'Production config is immutable. These are diagnostic recommendations only. An explicit engineering decision is required to change any parameter.'
  };
}
