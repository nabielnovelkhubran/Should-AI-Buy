import { AssetClass, MarketSnapshot } from '../types';
import { ExecutionTraceStep } from '../simulation/types';
import { AgentStrategyConfig, AIDecision } from '../agent/types';

// ---------------------------------------------------------------------------
// Phase 8.18: Independent AI Workflow Auditor Domain Types
// INVARIANT: Featherless AI is a read-only forensic reviewer with ZERO trading authority.
// INVARIANT: No order creation, modification, or cancellation capability.
// INVARIANT: Real-vs-simulation audit isolation strictly preserved.
// ---------------------------------------------------------------------------

export type WorkflowAuditVerdict = 'PASS' | 'WARN' | 'ANOMALY' | 'ERROR';

export type FindingSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FindingCategory =
  | 'DETERMINISTIC_RULE'
  | 'EVIDENCE_SUFFICIENCY'
  | 'RATIONALE_CONTRADICTION'
  | 'STAGE_TRANSITION'
  | 'BROKER_RECONCILIATION'
  | 'TIMEFRAME_BLINDSPOT'
  | 'MODEL_DISAGREEMENT'
  | 'EXECUTION_INTEGRITY';

export interface WorkflowAuditFinding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  stage: string;
  title: string;
  description: string;
  expected?: string | number | boolean;
  observed?: string | number | boolean;
  recommendation: string;
}

export interface WorkflowRuleCheck {
  rule: string;
  expected: string;
  observed: string | number | boolean;
  passed: boolean;
}

export interface WorkflowEvidenceCheck {
  requiredCount: number;
  observedCount: number;
  sufficient: boolean;
  details: string;
}

export interface WorkflowAuditStageCheck {
  stage:
    | 'DISCOVERY'
    | 'SCORING'
    | 'COUNCIL'
    | 'SIZING'
    | 'RISK_GATE'
    | 'ORDER_INTENT'
    | 'BROKER'
    | 'MONITORING'
    | 'LEDGER';
  status: 'PASS' | 'WARN' | 'ANOMALY' | 'ERROR' | 'NOT_REACHED';
  details?: string;
}

export interface WorkflowBrokerReconciliation {
  reconciled: boolean;
  orderIntentSymbol?: string;
  brokerRequestSymbol?: string;
  orderIntentQty?: number;
  brokerRequestQty?: number;
  brokerStatus?: string;
  classification: 'MATCHED' | 'BROKER_REJECTED' | 'SYSTEM_WORKFLOW_ERROR' | 'NOT_APPLICABLE';
  details?: string;
}

export interface WorkflowAuditResult {
  auditId: string;
  timestamp: string;
  cycleId: string;
  correlationId: string;
  mode: 'REAL_PAPER' | 'SIMULATION';
  symbol?: string;
  systemDecision: 'BUY' | 'HOLD' | 'REJECT' | 'PASS' | 'EXIT' | 'ERROR';
  systemDecisionStage: string;
  verdict: WorkflowAuditVerdict;
  confidence: number; // 0 - 100
  summary: string;
  findings: WorkflowAuditFinding[];
  checkedStages: WorkflowAuditStageCheck[];
  ruleChecks: WorkflowRuleCheck[];
  evidenceChecks: WorkflowEvidenceCheck[];
  brokerReconciliation: WorkflowBrokerReconciliation;
  modelMetadata: {
    provider: string;
    model: string;
  };
  latencyMs: number;
  errors: string[];
}

export interface AuditExecutionInput {
  mode: 'REAL_PAPER' | 'SIMULATION';
  cycleId: string;
  correlationId: string;
  symbol?: string;
  candidateSnapshot?: Partial<MarketSnapshot>;
  multiFactorScore?: number;
  decision?: AIDecision | { conclusion: string; confidence: number; reasoning?: string; [key: string]: any };
  evidence?: any[];
  riskGateResult?: { passed: boolean; violations: string[] };
  sizingResult?: { approvedQuantity: number; positionValueUsd: number; allowed: boolean; reason?: string };
  orderIntent?: any;
  brokerRequest?: any;
  brokerResponse?: any;
  monitoringState?: any;
  traceSteps?: ExecutionTraceStep[];
  strategyConfig?: AgentStrategyConfig;
}
