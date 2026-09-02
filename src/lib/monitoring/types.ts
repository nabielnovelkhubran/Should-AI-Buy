import { AssetClass, DecisionState, MarketSnapshot } from '../types';
import { PaperPosition, PortfolioSnapshot } from '../portfolio/types';
import { PaperOrderResult } from '../trading/types';

// ---------------------------------------------------------------------------
// Phase 6C: Position Monitoring & Protective Invalidation Domain Types
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// ---------------------------------------------------------------------------

export type PositionMonitoringStatus =
  | 'MONITORED'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'INVALIDATED'
  | 'ACTION_PROPOSED'
  | 'ACTION_BLOCKED'
  | 'ACTION_SUBMITTED'
  | 'ERROR';

export type ThesisHealthState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'INVALIDATED'
  | 'THESIS_UNAVAILABLE'
  | 'ERROR';

export type InvalidationCategory =
  | 'PRICE_DRAWDOWN'
  | 'MOMENTUM_REVERSAL'
  | 'PROFIT_TARGET_HIT'
  | 'TRAILING_STOP_TRIGGERED'
  | 'MOMENTUM_EXHAUSTION'
  | 'LIQUIDITY_DETERIORATION'
  | 'VOLATILITY_SURGE'
  | 'RISK_GATE_VIOLATION'
  | 'DATA_UNAVAILABLE'
  | 'BROKER_STATE_MISMATCH'
  | 'THESIS_EXPIRED';

export interface InvalidationFinding {
  category: InvalidationCategory;
  metricKey: string;
  currentValue: number | string;
  thresholdValue: number | string;
  message: string;
  severity: 'CRITICAL' | 'WARNING';
  detectedAt: string;
}

export interface InvalidationRule {
  condition: string;
  metricKey: string;
  threshold: number | string;
  operator: '<' | '<=' | '>' | '>=' | '==';
}

export interface ThesisProvenance {
  investigationId?: string;
  thesisId?: string;
  originalVerdict?: DecisionState;
  originalOpportunityScore?: number;
  originalRiskScore?: number;
  entryPrice: number;
  entryTimestamp: string;
  invalidationRules: InvalidationRule[];
  status: 'FOUND' | 'UNAVAILABLE' | 'MISMATCH';
}

export interface ThesisHealth {
  symbol: string;
  status: ThesisHealthState;
  score: number; // Deterministic 0 - 100 score
  provenance: ThesisProvenance;
  findings: InvalidationFinding[];
  currentSnapshot?: MarketSnapshot;
  pnlPercent: number;
  evaluatedAt: string;
  summary: string;
}

export interface ProtectiveActionProposal {
  actionId: string;
  positionId: string;
  symbol: string;
  assetClass: AssetClass;
  proposedSide: 'buy' | 'sell';
  quantity: number; // Derived from authoritative broker position
  invalidationReason: InvalidationFinding;
  thesisHealth: ThesisHealth;
  portfolioRiskAssessment: {
    allowed: boolean;
    reason?: string;
  };
  status: 'PROPOSED' | 'BLOCKED' | 'EXECUTED' | 'FAILED';
  cycleId: string;
  idempotencyKey: string;
  createdAt: string;
  executionResult?: PaperOrderResult;
  error?: string;
}

export interface MonitoredPositionRecord {
  position: PaperPosition;
  status: PositionMonitoringStatus;
  health: ThesisHealth;
  proposal?: ProtectiveActionProposal;
  lastEvaluatedAt: string;
  error?: string;
}

export interface AuditTrailEvent {
  timestamp: string;
  stage: string;
  symbol?: string;
  message: string;
  details?: Record<string, any>;
}

export interface MonitoringCycleResult {
  cycleId: string;
  timestamp: string;
  totalMonitored: number;
  healthyCount: number;
  degradedCount: number;
  invalidatedCount: number;
  errorCount: number;
  monitoredPositions: MonitoredPositionRecord[];
  proposedActions: ProtectiveActionProposal[];
  executedActions: ProtectiveActionProposal[];
  blockedActions: ProtectiveActionProposal[];
  auditTrail: AuditTrailEvent[];
  environment: 'PAPER';
}

export interface MonitoringOptions {
  executeExits?: boolean; // Default false
  invalidationPriceDrawdownPct?: number; // Default -5.0%
  invalidationMomentumThreshold?: number; // Default 40
  invalidationLiquidityThresholdUsd?: number; // Default $200,000
  invalidationRiskScoreThreshold?: number; // Default 75
  fetchSnapshotFn?: (symbol: string) => Promise<MarketSnapshot>;
}
