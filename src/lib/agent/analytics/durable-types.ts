import { AssetClass } from '../../types';
import { MarketRegimeType } from '../regime';
import { FactorBreakdown } from '../strategy';
import { WorkerLifecycleState, ExitReason, EvidenceQuality } from './types';

// ---------------------------------------------------------------------------
// Phase 8.12: Live Paper Trading Observation & Durable Evidence Types
// INVARIANT: All records derive strictly from confirmed broker outcomes.
// INVARIANT: Zero synthetic trade injection. Immutability enforced.
// ---------------------------------------------------------------------------

export type RuntimeEventType =
  | 'SESSION_STARTED'
  | 'SESSION_ENDED'
  | 'CYCLE_STARTED'
  | 'CYCLE_COMPLETED'
  | 'CYCLE_FAILED'
  | 'CANDIDATE_DISCOVERED'
  | 'CANDIDATE_REJECTED'
  | 'AI_DECISION'
  | 'RISK_APPROVED'
  | 'RISK_BLOCKED'
  | 'ORDER_INTENT_CREATED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_FILLED'
  | 'ORDER_PARTIALLY_FILLED'
  | 'ORDER_REJECTED'
  | 'POSITION_RECONCILED'
  | 'POSITION_UPDATED'
  | 'PROTECTIVE_EXIT_TRIGGERED'
  | 'PROTECTIVE_EXIT_SUBMITTED'
  | 'PROTECTIVE_EXIT_FILLED'
  | 'PROTECTIVE_EXIT_FAILED'
  | 'TRADE_OPENED'
  | 'TRADE_CLOSED'
  | 'CIRCUIT_BREAKER_TRIPPED'
  | 'CIRCUIT_BREAKER_RESET'
  | 'BROKER_SYNC'
  | 'EVIDENCE_INTEGRITY_FAILURE'
  | 'RUNTIME_ERROR';

export interface RuntimeJournalEvent {
  eventId: string;
  sessionId: string;
  timestamp: string;
  type: RuntimeEventType;
  cycleId?: string;
  tradeId?: string;
  orderId?: string;
  symbol?: string;
  payload: Record<string, any>;
}

export interface FrozenDecisionSnapshot {
  symbol: string;
  assetClass: AssetClass;
  strategy: string;
  regime: MarketRegimeType;
  opportunityScore: number;
  confidence: number;
  factorScores?: FactorBreakdown;
  estimatedRiskReward: number;
  invalidationPrice: number;
  targetPrice?: number;
  riskDecision: 'PASS' | 'BLOCKED';
  requestedQuantity: number;
  decisionTimestamp: string;
}

export interface PersistentTradeEvidence {
  tradeId: string;
  sessionId: string;
  symbol: string;
  assetClass: AssetClass;
  decision: FrozenDecisionSnapshot;
  execution: {
    orderId?: string;
    clientOrderId?: string;
    requestedQuantity: number;
    actualFilledQuantity: number;
    actualEntryPrice: number;
    actualExitPrice?: number;
    submittedAt: string;
    filledAt?: string;
    exitedAt?: string;
  };
  accounting: {
    direction: 'LONG';
    isGrossPnL: true;
    grossPnL?: number;
    initialRiskAmountUsd: number;
    actualR?: number;
  };
  lifecycle: {
    status: 'OPEN' | 'CLOSED' | 'INVALIDATED' | 'FAILED';
    entryReason?: string;
    exitReason?: ExitReason;
  };
  lineageValid: boolean;
  lineageErrors?: string[];
  recordedAt: string;
  updatedAt: string;
}

export interface WorkerHeartbeatTelemetry {
  workerStatus: WorkerLifecycleState;
  lastHeartbeat: string;
  lastCycleStarted: string | null;
  lastCycleCompleted: string | null;
  lastSuccessfulCycle: string | null;
  lastBrokerSync: string | null;
  lastMarketDataUpdate: string | null;
  lastOrderEvent: string | null;
  consecutiveFailures: number;
  circuitBreakerActive: boolean;
}

export interface RuntimeAnomalyReport {
  id: string;
  timestamp: string;
  anomalyType:
    | 'DUPLICATE_ORDER'
    | 'DUPLICATE_CYCLE'
    | 'FILL_WITHOUT_INTENT'
    | 'POSITION_WITHOUT_FILL'
    | 'IMPOSSIBLE_QUANTITY'
    | 'IMPOSSIBLE_PRICE'
    | 'MISSING_DECISION_EVIDENCE'
    | 'TIMESTAMP_VIOLATION'
    | 'BROKER_DIVERGENCE'
    | 'REPEATED_RUNTIME_FAILURES';
  severity: 'WARNING' | 'CRITICAL';
  details: string;
  metadata?: Record<string, any>;
}

export interface DurableSessionRecord {
  sessionId: string;
  environment: string;
  startedAt: string;
  endedAt?: string;
  startingEquity: number;
  endingEquity?: number;
  startingCash: number;
  endingCash?: number;
  cyclesRun: number;
  cyclesSucceeded: number;
  cyclesFailed: number;
  candidatesScanned: number;
  candidatesRejected: number;
  tradeIntents: number;
  ordersSubmitted: number;
  ordersFilled: number;
  ordersRejected: number;
  completedTrades: number;
  openTrades: number;
  grossPnL: number;
  totalR: number;
  maxDrawdownPct: number;
  consecutiveFailures: number;
  circuitBreakerTrips: number;
  evidenceIntegrityFailures: number;
  runtimeErrors: number;
  evidenceQuality: EvidenceQuality;
  status: 'ACTIVE' | 'CONCLUDED';
}
