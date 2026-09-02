export type RiskProfileType = 'STANDARD' | 'HIGH_RISK';
import {
  AssetClass,
  MarketSnapshot,
  PaperOrderResult,
  PaperPosition,
  PaperAccountSnapshot,
  PortfolioSnapshot,
  TradeThesis
} from '../types';
import { MarketRegimeType, StrategyType, MarketRegimeState } from './regime';
import { FactorBreakdown, MultiFactorEvaluation } from './strategy';
import { WorkerLifecycleState } from './analytics/types';

// ---------------------------------------------------------------------------
// Phase 8.8: Autonomous Trading Engine Domain Types
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// ---------------------------------------------------------------------------

export type { WorkerLifecycleState };

export type AIDecisionAction = 'BUY' | 'SELL' | 'HOLD' | 'PASS';

export type InstrumentType = 'EQUITY' | 'CRYPTO' | 'OPTION';

export interface OptionDetails {
  underlyingSymbol: string;
  contractSymbol?: string;
  contractType: 'call' | 'put';
  strikePrice: number;
  expirationDate: string; // YYYY-MM-DD
  dte?: number;
  impliedVolatility?: number;
  delta?: number;
  bid?: number;
  ask?: number;
  midPrice?: number;
  openInterest?: number;
  spread?: number;
  rationale?: string;
}

export interface StructuredEvidenceItem {
  source: string;
  timestamp: string;
  claim: string;
  confidence?: number;
}

/**
 * Structured AI Trade Decision Interface.
 * Free-form text from LLMs is strictly forbidden from reaching the broker.
 */
export interface AIDecision {
  action: AIDecisionAction;
  instrument: string;
  assetClass: AssetClass;
  instrumentType?: InstrumentType;
  strategy: StrategyType | string;
  confidence: number; // 0 to 100
  opportunityScore: number; // 0 to 100
  marketRegime?: MarketRegimeType;
  factorBreakdown?: FactorBreakdown;
  riskRewardRatio: number; // e.g. 2.5 (2.5R)
  thesis: string;
  catalyst: string;
  expectedHorizon: string;
  expectedMove?: string;
  entryConditions: string[];
  invalidationConditions: string[];
  targetConditions: string[];
  riskAssessment: string;
  reasoningSummary: string;
  targetPrice?: number;
  invalidationPrice?: number;
  evidence: StructuredEvidenceItem[];
  optionDetails?: OptionDetails;
  suggestedPositionSizeUsd?: number;
  generatedAt: string;
}

export type AutonomousCycleStage =
  | 'INIT'
  | 'ENVIRONMENT_CHECK'
  | 'MARKET_STATE_BUILD'
  | 'DISCOVERY'
  | 'REGIME_DETECTION'
  | 'MULTI_FACTOR_SCORING'
  | 'AI_DECISION'
  | 'RISK_GATE'
  | 'POSITION_SIZING'
  | 'EXECUTION'
  | 'RECONCILIATION'
  | 'POSITION_MONITOR'
  | 'PROTECTIVE_EXIT'
  | 'TELEMETRY'
  | 'COMPLETED'
  | 'FAILED';

export type TelemetryEventType =
  | 'CYCLE_STARTED'
  | 'ENVIRONMENT_VERIFIED'
  | 'MARKET_STATE_REFRESHED'
  | 'REGIME_CLASSIFIED'
  | 'FACTORS_SCORED'
  | 'STALE_DATA_REJECTED'
  | 'CANDIDATE_DISCOVERED'
  | 'CANDIDATE_RANKED'
  | 'AI_ANALYSIS_STARTED'
  | 'AI_DECISION_PRODUCED'
  | 'AI_DECISION_VALIDATED'
  | 'AI_FAILURE_FALLBACK'
  | 'THESIS_FORMULATED'
  | 'RISK_GATE_EVALUATED'
  | 'POSITION_SIZED'
  | 'RISK_APPROVED'
  | 'RISK_REJECTED'
  | 'ORDER_INTENT_CREATED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_FILLED'
  | 'ORDER_REJECTED'
  | 'TRADE_ENTRY_RECORDED'
  | 'TRADE_EXIT_RECORDED'
  | 'CANDIDATE_REJECTED'
  | 'ACCOUNT_HEALTH_CHECKED'
  | 'WORKER_STATE_CHANGED'
  | 'COMPETITION_READINESS_VERIFIED'
  | 'CALIBRATION_REPORT_GENERATED'
  | 'RECONCILIATION_COMPLETED'
  | 'POSITION_MONITORED'
  | 'THESIS_INVALIDATED'
  | 'PROTECTIVE_EXIT_PROPOSED'
  | 'PROTECTIVE_EXIT_EXECUTED'
  | 'CIRCUIT_BREAKER_TRIPPED'
  | 'RATE_LIMIT_BACKOFF'
  | 'CYCLE_COMPLETED'
  | 'CYCLE_FAILED'
  | 'RUNTIME_MODE_CHANGED'
  | 'PROOF_MODE_TOGGLED'
  | 'AUTONOMOUS_RUNTIME_STARTED'
  | 'AUTONOMOUS_RUNTIME_STOPPED'
  | 'AUTONOMOUS_CYCLE_STARTED'
  | 'AUTONOMOUS_CYCLE_COMPLETED'
  | 'AUTONOMOUS_CYCLE_FAILED'
  | 'SCORE_BAND_ANALYZED'
  | 'OPPORTUNITY_FUNNEL_UPDATED'
  | 'CANDIDATE_ROTATION_APPLIED'
  | 'RISK_PROFILE_CHANGED';

export interface TelemetryEvent {
  id: string;
  cycleId: string;
  timestamp: string;
  type: TelemetryEventType;
  symbol?: string;
  message: string;
  details?: Record<string, any>;
}

export interface MarketStateContext {
  cycleId: string;
  timestamp: string;
  environment: 'test' | 'competition';
  account: PaperAccountSnapshot;
  portfolio: PortfolioSnapshot;
  isMarketOpen: boolean;
  marketSession: string;
  activePositions: PaperPosition[];
  totalEquityUsd: number;
  availableCashUsd: number;
  grossExposureUsd: number;
  netExposureUsd: number;
  candidateSnapshots: Record<string, MarketSnapshot>;
  marketRegime?: MarketRegimeState;
}

export interface RotationCandidateMetadata {
  symbol: string;
  opportunityScore: number;
  rank: number;
  lastEvaluatedCycle: string | null;
  cyclesWaiting: number;
  evaluationCount: number;
  rotationPriority: number;
  selectedThisCycle: boolean;
  deferReason?: string;
}

export interface ScoreBandTelemetry {
  candidatesScanned: number;
  below50: number;
  watch50to54: number;
  evaluated55to59: number;
  highConviction60Plus: number;
  candidatesSentToAI: number;
  riskGatePassed: number;
  riskGateBlocked: number;
  ordersSubmitted: number;
  averageOpportunityScore?: number;
  averageEligibleScore?: number;
}

export interface CandidateEvaluationResult {
  candidateSymbol: string;
  opportunityScore: number;
  rank: number;
  aiDecision: AIDecision;
  schemaValid: boolean;
  riskGatePassed: boolean;
  riskGateViolations: string[];
  orderResult?: PaperOrderResult;
}

export interface CycleExecutionFunnel {
  candidatesScanned: number;
  passedLiquidity: number;
  passedSpread: number;
  scoredAboveThreshold: number;
  councilEvaluated: number;
  councilBuy: number;
  riskGatePassed: number;
  orderIntentsCreated: number;
  brokerSubmitted: number;
  brokerFilled: number;
  positionsMonitored: number;
}

export interface RejectionReasonDistribution {
  liquidity: number;
  spread: number;
  opportunityScore: number;
  riskReward: number;
  quantHold: number;
  redTeamBlock: number;
  riskGate: number;
  positionSizing: number;
  maxPositions: number;
  alreadyHeld: number;
  other: number;
}

export interface AutonomousCycleResult {
  cycleId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  environment: 'test' | 'competition';
  isMarketOpen: boolean;
  marketRegime?: MarketRegimeType;
  candidatesScanned: number;
  candidatesEvaluated: number;
  evaluations: CandidateEvaluationResult[];
  ordersSubmitted: PaperOrderResult[];
  positionsMonitoredCount: number;
  protectiveExitsExecutedCount: number;
  circuitBreakerActive: boolean;
  eventsCount: number;
  rejectedCandidatesCount?: number;
  accountHealthy?: boolean;
  workerState?: WorkerLifecycleState;
  executionFunnel?: CycleExecutionFunnel;
  scoreBands?: ScoreBandTelemetry;
  rotationTelemetry?: RotationCandidateMetadata[];
  rejectionDistribution?: RejectionReasonDistribution;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'SKIPPED' | 'FAILED';
  error?: string;
}

export interface AgentStrategyConfig {
  riskProfile?: RiskProfileType;
  maxPositionSizeUsd: number;
  maxPortfolioExposurePct: number;
  maxConcentrationPct: number;
  minConfidenceScore: number;
  minOpportunityScore: number;
  candidateEvaluationFloor?: number;
  highConvictionScore?: number;
  minLiquidityUsd: number;
  maxSpreadBps: number;
  staleDataThresholdMs: number;
  minRiskRewardRatio?: number;
  maxOptionSpreadDollars?: number;
  maxOpenPositions: number;
  reconciliationWindowDays: number;
  circuitBreakerMaxConsecutiveFailures: number;
}
