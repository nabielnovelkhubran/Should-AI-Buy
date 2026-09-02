import { RiskProfileType } from '../types';
import { AssetClass } from '../../types';
import { MarketRegimeType, StrategyType } from '../regime';
import { FactorBreakdown } from '../strategy';

// ---------------------------------------------------------------------------
// Phase 8.8, 8.10 & 8.11: Live Paper Alpha Validation & Evidence Review Types
// INVARIANT: All analytics computed from recorded outcomes only. No lookahead.
// INVARIANT: No credential storage. No production config mutation.
// ---------------------------------------------------------------------------

export type WorkerLifecycleState =
  | 'INITIALIZING'
  | 'RUNNING'
  | 'WAITING_FOR_MARKET'
  | 'SCANNING'
  | 'EVALUATING'
  | 'RISK_CHECK'
  | 'EXECUTING'
  | 'RECONCILING'
  | 'MONITORING'
  | 'BACKING_OFF'
  | 'CIRCUIT_BREAKER'
  | 'ERROR'
  | 'STOPPED';

export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';

export type TradeDirection = 'LONG' | 'SHORT';

export type ExitReason =
  | 'THESIS_INVALIDATED'
  | 'PROFIT_TARGET_HIT'
  | 'DRAWDOWN_LIMIT'
  | 'HOLDING_PERIOD_EXPIRED'
  | 'OPERATOR_MANUAL'
  | 'CIRCUIT_BREAKER'
  | 'UNKNOWN';

export interface TradeRecord {
  tradeId: string;
  candidateId: string;
  decisionId: string;
  orderId?: string;
  clientOrderId?: string;
  symbol: string;
  assetClass: AssetClass;
  instrumentType: 'EQUITY' | 'CRYPTO' | 'OPTION';
  direction: TradeDirection; // Explicitly 'LONG' in current Spot domain
  strategy: StrategyType | string;
  marketRegime: MarketRegimeType;
  opportunityScore: number;
  aiConfidence: number;
  factorScores?: FactorBreakdown;
  estimatedRiskReward: number;
  requestedQuantity: number;
  approvedQuantity: number;
  entryPrice: number;
  actualFillPrice?: number;
  actualFilledQuantity?: number;
  entryTimestamp: string;
  invalidationPrice: number;
  targetPrice: number;
  initialRiskAmountUsd: number;
  spreadAtEntryBps?: number;
  portfolioEquityAtEntry: number;
  grossExposureAtEntry: number;
  exitPrice?: number;
  exitFilledQuantity?: number;
  exitTimestamp?: string;
  exitReason?: ExitReason;
  spreadAtExitBps?: number;
  portfolioEquityAtExit?: number;
  grossExposureAtExit?: number;
  realizedPnL?: number;
  realizedPnLPct?: number;
  actualR?: number;
  holdingDurationMs?: number;
  isGrossPnL: boolean; // Explicit gross P&L label
  outcome: TradeOutcome;
  recordedAt: string;
  updatedAt: string;
}

export type RejectionStage =
  | 'SESSION_FILTER'
  | 'LIQUIDITY_FILTER'
  | 'SPREAD_FILTER'
  | 'REGIME_FILTER'
  | 'SCORE_FILTER'
  | 'AI_PASS'
  | 'AI_HOLD'
  | 'RISK_GATE'
  | 'POSITION_SIZING'
  | 'MAX_POSITIONS'
  | 'ALREADY_HELD';

export interface RejectedCandidateRecord {
  id: string;
  candidateId: string;
  cycleId: string;
  symbol: string;
  assetClass: AssetClass;
  strategy?: StrategyType | string;
  marketRegime?: MarketRegimeType;
  opportunityScore?: number;
  aiConfidence?: number;
  estimatedRiskReward?: number;
  rejectionStage: RejectionStage;
  rejectionReason: string;
  recordedAt: string;
}

export interface PortfolioMetrics {
  currentEquityUsd: number;
  peakEquityUsd: number;
  totalPnLUsd: number;
  totalPnLPct: number;
  realizedPnLUsd: number;
  unrealizedPnLUsd: number;
  grossExposurePct: number;
  cashUtilizationPct: number;
  openPositionCount: number;
  currentDrawdownUsd: number;
  currentDrawdownPct: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  isGrossPnL: boolean;
  computedAt: string;
}

export interface TradeMetrics {
  totalTrades: number;
  openTrades: number;
  completedTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  avgWinUsd: number;
  avgLossUsd: number;
  expectancyUsd: number;
  profitFactor: number;
  avgHoldingHours: number;
  largestWinUsd: number;
  largestLossUsd: number;
  avgExpectedR: number;
  avgActualR: number;
  totalR: number;
  isGrossPnL: boolean;
  computedAt: string;
}

export interface AttributionBucket {
  label: string;
  trades: number;
  winRate: number;
  expectancyUsd: number;
  totalPnLUsd: number;
  avgActualR: number;
}

export interface StrategyAttributionGroup {
  strategy: string;
  metrics: AttributionBucket;
}

export interface RegimeAttributionGroup {
  regime: MarketRegimeType;
  metrics: AttributionBucket;
}

export interface AssetClassAttributionGroup {
  assetClass: AssetClass;
  metrics: AttributionBucket;
}

export interface ScoreBucketAttributionGroup {
  scoreBucket: string;
  metrics: AttributionBucket;
}

export interface ConfidenceBucketAttributionGroup {
  confidenceBucket: string;
  metrics: AttributionBucket;
}

export interface RRBucketAttributionGroup {
  rrBucket: string;
  metrics: AttributionBucket;
}

export interface FactorAttributionGroup {
  factor: string;
  highLevel: AttributionBucket;
  mediumLevel: AttributionBucket;
  lowLevel: AttributionBucket;
}

export interface FullAttribution {
  byStrategy: StrategyAttributionGroup[];
  byRegime: RegimeAttributionGroup[];
  byAssetClass: AssetClassAttributionGroup[];
  byConfidenceBucket: ConfidenceBucketAttributionGroup[];
  byScoreBucket: ScoreBucketAttributionGroup[];
  byRRBucket: RRBucketAttributionGroup[];
  byFactor: FactorAttributionGroup[];
  computedAt: string;
}

export type CalibrationState =
  | 'INSUFFICIENT_EVIDENCE'
  | 'KEEP'
  | 'INVESTIGATE'
  | 'CONSIDER_CHANGE';

export interface CalibrationRecommendation {
  parameter: string;
  currentValue: number | string;
  sampleSize: number;
  state: CalibrationState;
  evidence: string;
  bucketSummary: AttributionBucket[];
}

export interface CalibrationReport {
  recommendations: CalibrationRecommendation[];
  generatedAt: string;
  totalTradesSampled: number;
  note: string;
}

export interface AccountHealthCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface AccountHealthReport {
  healthy: boolean;
  warnings: string[];
  blockers: string[];
  checks: AccountHealthCheck[];
  checkedAt: string;
}

export interface CompetitionReadinessReport {
  ready: boolean;
  checks: AccountHealthCheck[];
  blockers: string[];
  warnings: string[];
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 8.10: Runtime Observability Domain Types
// ---------------------------------------------------------------------------

export interface WorkerRuntimeSnapshot {
  state: WorkerLifecycleState;
  startedAt: string | null;
  lastCycleAt: string | null;
  lastSuccessfulDataAt: string | null;
  lastCycleId: string | null;
  nextScheduledCycleAt: string | null;
  consecutiveFailures: number;
  circuitBreakerTripped: boolean;
  circuitBreakerReason: string | null;
  accountHealthy: boolean;
  environment: string;
  runtimeMode?: 'REAL_PAPER' | 'SIMULATION';
  proofMode?: boolean;
  autonomousRunning?: boolean;
  riskProfile?: RiskProfileType;
}

export interface AccountRuntimeSnapshot {
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  dailyPnL?: number;
  openPositionCount: number;
  grossExposureUsd: number;
  grossExposurePct: number;
  lastReconciliationAt: string;
  isPaper: boolean;
  accountNumberMasked: string;
  status: string;
}

export interface DecisionTelemetry {
  timestamp: string;
  cycleId: string;
  symbol: string;
  assetClass: AssetClass;
  strategy?: string;
  marketRegime?: string;
  opportunityScore?: number;
  aiConfidence?: number;
  estimatedRiskReward?: number;
  action: 'BUY' | 'SELL' | 'HOLD' | 'PASS';
  validationStatus: 'VALID' | 'INVALID';
  riskStatus: 'PASS' | 'BLOCKED';
  rejectionStage?: RejectionStage;
  rejectionReason?: string;
  thesisSummary?: string;
  invalidationConditions?: string[];
  targetConditions?: string[];
}

export interface OrderLifecycleTelemetry {
  orderId: string;
  clientOrderId: string;
  cycleId: string;
  symbol: string;
  assetClass: AssetClass;
  side: 'buy' | 'sell';
  requestedQty: number;
  approvedQty: number;
  submittedQty: number;
  confirmedFilledQty: number;
  actualFillPrice?: number;
  orderType: string;
  timeInForce: string;
  status: 'INTENT' | 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'REJECTED' | 'FAILED' | 'CANCELLED' | 'BLOCKED';
  submissionTimestamp: string;
  fillTimestamp?: string;
  error?: string;
}

export type EvidenceQuality =
  | 'INSUFFICIENT'
  | 'PRELIMINARY'
  | 'MEANINGFUL'
  | 'PROMISING'
  | 'CALIBRATION_REQUIRED'
  | 'NO_DEMONSTRATED_ALPHA';

export interface SessionEvidence {
  sessionId: string;
  environment: string;
  startedAt: string;
  endedAt?: string;
  startingEquity: number;
  startingCash: number;
  startingPositionsCount: number;
  currentEquity: number;
  currentCash: number;
  currentPositionsCount: number;
  endingEquity?: number;
  endingCash?: number;
  endingPositionsCount?: number;
  totalCyclesExecuted: number;
  totalCandidatesScanned: number;
  totalOrdersSubmitted: number;
  totalTradesExecuted: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  realizedPnLUsd: number;
  totalR: number;
  maxDrawdownPct: number;
  evidenceQuality: EvidenceQuality;
  isGrossPnL: boolean;
  status: 'ACTIVE' | 'CONCLUDED';
}

export interface SafetySnapshot {
  paperOnlyEnforced: boolean;
  liveEndpointBlocked: boolean;
  circuitBreakerActive: boolean;
  circuitBreakerReason: string | null;
  accountHealthPassed: boolean;
  activeBlockers: string[];
  activeWarnings: string[];
  credentialsProtected: boolean;
}

export interface AgentRuntimeSnapshot {
  generatedAt: string;
  worker: WorkerRuntimeSnapshot;
  account: AccountRuntimeSnapshot;
  currentCycle: any | null;
  recentCycles: any[];
  recentDecisions: DecisionTelemetry[];
  openTrades: TradeRecord[];
  recentTrades: TradeRecord[];
  performance: {
    portfolio: PortfolioMetrics;
    trades: TradeMetrics;
  };
  attribution: FullAttribution;
  calibration: CalibrationReport;
  safety: SafetySnapshot;
  session: SessionEvidence;
}

// ---------------------------------------------------------------------------
// Phase 8.11: Live Alpha Calibration & Evidence Review Domain Types
// ---------------------------------------------------------------------------

export interface AlphaEvidenceRecord {
  tradeId: string;
  symbol: string;
  assetClass: AssetClass;
  strategy: string;
  marketRegime: MarketRegimeType;
  direction: 'LONG';
  opportunityScore: number;
  aiConfidence: number;
  estimatedRiskReward: number;
  factorScores?: FactorBreakdown;
  entryPrice: number;
  actualFillPrice?: number;
  exitPrice?: number;
  requestedQuantity: number;
  actualFilledQuantity?: number;
  exitFilledQuantity?: number;
  realizedPnL?: number;
  realizedPnLPct?: number;
  actualR?: number;
  holdingDurationMs?: number;
  exitReason?: ExitReason;
  spreadAtEntryBps?: number;
  spreadAtExitBps?: number;
  portfolioEquityAtEntry: number;
  portfolioEquityAtExit?: number;
  entryTimestamp: string;
  exitTimestamp?: string;
  outcome: TradeOutcome;
  isGrossPnL: true;
  evidenceStatus: 'OPEN' | 'COMPLETED' | 'INVALID' | 'INSUFFICIENT_DATA';
}

export interface AlphaVerdict {
  quality: EvidenceQuality;
  completedTrades: number;
  expectancy: number | null;
  totalR: number | null;
  winRate: number | null;
  profitFactor: number | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  generatedAt: string;
}

export interface CalibrationBucketReview {
  bucketLabel: string;
  min: number;
  max: number;
  sampleSize: number;
  winRate: number;
  expectancyUsd: number;
  avgActualR: number;
  totalPnLUsd: number;
  quality: EvidenceQuality;
}

export interface RejectionFunnelStage {
  stage: string;
  count: number;
  percentageOfScanned: number;
  description: string;
}

export interface RejectionFunnelAnalysis {
  totalScanned: number;
  totalRejected: number;
  totalEvaluated: number;
  totalTraded: number;
  stages: RejectionFunnelStage[];
  rejectionDistribution: Record<string, number>;
}

export interface SessionAlphaSummary {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  cycles: number;
  candidatesScanned: number;
  candidatesRejected: number;
  candidatesApproved: number;
  ordersSubmitted: number;
  ordersFilled: number;
  completedTrades: number;
  openTrades: number;
  realizedGrossPnL: number;
  totalR: number;
  evidenceQuality: EvidenceQuality;
}

export interface AlphaReviewSnapshot {
  generatedAt: string;
  evidence: AlphaEvidenceRecord[];
  verdict: AlphaVerdict;
  confidenceCalibration: CalibrationBucketReview[];
  opportunityCalibration: CalibrationBucketReview[];
  strategyAttribution: StrategyAttributionGroup[];
  regimeAttribution: RegimeAttributionGroup[];
  assetClassAttribution: AssetClassAttributionGroup[];
  factorAttribution: FactorAttributionGroup[];
  rejectionAnalysis: RejectionFunnelAnalysis;
  sessionSummary: SessionAlphaSummary;
}
