import { AssetClass } from '../../types';
import { MarketRegimeType } from '../regime';
import { EvidenceQuality, AlphaVerdict } from './types';

// ---------------------------------------------------------------------------
// Phase 8.13: Alpha Verdict & Strategy Review Domain Models
// INVARIANT: Purely analytical and read-only. Zero strategy mutation.
// INVARIANT: All realized outcomes derive strictly from confirmed broker fills.
// ---------------------------------------------------------------------------

export type AdvisoryActionStatus =
  | 'INVESTIGATE'
  | 'WATCH'
  | 'CONSIDER'
  | 'DEPRIORITIZE'
  | 'INSUFFICIENT_EVIDENCE';

export interface AlphaStrategyReview {
  strategy: string;
  sampleSize: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  expectancyUsd: number;
  grossProfitUsd: number;
  grossLossUsd: number;
  profitFactor: number;
  avgActualR: number;
  totalRealizedR: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  evidenceQuality: EvidenceQuality;
  verdict: EvidenceQuality;
  advisoryStatus: AdvisoryActionStatus;
}

export interface AlphaRegimeReview {
  regime: MarketRegimeType | string;
  sampleSize: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  expectancyUsd: number;
  grossProfitUsd: number;
  grossLossUsd: number;
  profitFactor: number;
  avgActualR: number;
  totalRealizedR: number;
  evidenceQuality: EvidenceQuality;
  advisoryStatus: AdvisoryActionStatus;
}

export interface AlphaAssetReview {
  assetClass: AssetClass;
  sampleSize: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  expectancyUsd: number;
  totalPnLUsd: number;
  profitFactor: number;
  evidenceQuality: EvidenceQuality;
}

export interface FactorTierMetrics {
  sampleSize: number;
  wins: number;
  losses: number;
  winRate: number;
  expectancyUsd: number;
  avgActualR: number;
  evidenceQuality: EvidenceQuality;
}

export interface AlphaFactorReview {
  factor: string;
  highTier: FactorTierMetrics;   // Score >= 70
  mediumTier: FactorTierMetrics; // 40 <= Score < 70
  lowTier: FactorTierMetrics;    // Score < 40
  observationalNote: string;     // Strictly non-causal language
}

export interface CalibrationTierReview {
  bucketLabel: string;
  min: number;
  max: number;
  sampleSize: number;
  wins: number;
  losses: number;
  winRate: number;
  expectancyUsd: number;
  avgActualR: number;
  profitFactor: number;
  evidenceQuality: EvidenceQuality;
}

export type MonotonicityStatus =
  | 'UNCALIBRATED'
  | 'PRELIMINARY'
  | 'EVIDENCE_OF_MONOTONICITY'
  | 'INSUFFICIENT_SAMPLE';

export interface CalibrationReview {
  confidenceBuckets: CalibrationTierReview[];
  opportunityBuckets: CalibrationTierReview[];
  confidenceMonotonicity: MonotonicityStatus;
  opportunityMonotonicity: MonotonicityStatus;
  sampleThresholdRequired: number;
}

export interface RiskReview {
  startingEquityUsd: number;
  currentEquityUsd: number;
  peakEquityUsd: number;
  totalRealizedPnLUsd: number;
  totalRealizedPnLPct: number;
  currentDrawdownUsd: number;
  currentDrawdownPct: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  largestWinUsd: number;
  largestLossUsd: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  direction: 'LONG';
  isGrossPnL: true;
}

export interface RejectionStageDetail {
  stage: string;
  rejectedCount: number;
  rejectionPercentage: number;
  diagnosticNote: string;
}

export interface RejectionFunnelReview {
  totalCandidatesScanned: number;
  totalCandidatesRejected: number;
  totalCandidatesTraded: number;
  passThroughPercentage: number;
  stages: RejectionStageDetail[];
  methodologyNote: string;
}

export interface StrategyReviewRecommendation {
  category: 'STRATEGY' | 'REGIME' | 'CALIBRATION' | 'RISK';
  target: string;
  status: AdvisoryActionStatus;
  sampleSize: number;
  evidenceSummary: string;
  advisoryRationale: string;
}

export interface AlphaStrategyReviewSnapshot {
  generatedAt: string;
  completedTradesCount: number;
  openTradesCount: number;
  primaryVerdict: AlphaVerdict;
  strategyReviews: AlphaStrategyReview[];
  regimeReviews: AlphaRegimeReview[];
  assetReviews: AlphaAssetReview[];
  factorReviews: AlphaFactorReview[];
  calibrationReview: CalibrationReview;
  riskReview: RiskReview;
  rejectionFunnelReview: RejectionFunnelReview;
  recommendations: StrategyReviewRecommendation[];
}
