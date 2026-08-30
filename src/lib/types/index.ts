export type DecisionState = 'BUY' | 'HOLD' | 'SELL' | 'REJECT';

export type InvestigationStatus = 
  | 'QUEUED' 
  | 'DISCOVERING' 
  | 'ANALYZING' 
  | 'RED_TEAM' 
  | 'DECIDING' 
  | 'EXECUTING' 
  | 'COMPLETED' 
  | 'FAILED';

export type CouncilStage =
  | 'DISCOVERY'
  | 'QUANT'
  | 'INTELLIGENCE'
  | 'RISK'
  | 'RED_TEAM'
  | 'DECISION'
  | 'RISK_GATE';

export type CouncilStageStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface CouncilEvent {
  id: string;
  stage: CouncilStage;
  status: CouncilStageStatus;
  summary?: string;
  details?: Record<string, any>;
  timestamp: string;
  error?: string;
}

export interface CouncilStageState {
  stage: CouncilStage;
  status: CouncilStageStatus;
  summary?: string;
  error?: string;
  timestamp?: string;
}

export type EvidenceType = 
  | 'MARKET' 
  | 'NEWS' 
  | 'FLOW' 
  | 'RISK' 
  | 'TECHNICAL' 
  | 'EXTERNAL';

export type ReliabilityRating = 'PRIMARY' | 'REPUTABLE' | 'SECONDARY' | 'UNKNOWN';

export interface SourceProvenance {
  name: string;
  url?: string;
  publisher?: string;
  publishedAt?: string;
  retrievedAt: string;
}

export interface Evidence {
  id: string;
  investigationId: string;
  type: EvidenceType;
  title: string;
  description: string;
  observedAt: string;
  source: SourceProvenance;
  value: any;
  metadata?: Record<string, any>;
  reliability: ReliabilityRating;
  isContradictory?: boolean;
}

export interface AgentResult {
  agent: 'discovery' | 'quant' | 'intelligence' | 'risk' | 'red_team' | 'decision' | 'monitoring';
  verdict: DecisionState | 'CAUTION' | 'OPPORTUNITY' | 'VALID' | 'INVALIDATED';
  confidence: number; // 0 - 100
  summary: string;
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  strongestSupportingEvidenceId?: string;
  strongestCounterargument?: string;
  risks: string[];
  recommendations: string[];
  metrics?: Record<string, number | string>;
  failed?: boolean;
  error?: string;
  redTeamAttackDetails?: {
    assumptionsChallenged: string[];
    vulnerabilitiesFound: string[];
    thesisStatus: 'INTACT' | 'WEAKENED' | 'DISPROVED';
    counterEvidenceIds: string[];
  };
}

export interface InvalidationCondition {
  id: string;
  condition: string;
  metricKey: string;
  threshold: number | string;
  comparison: '<' | '>' | '<=' | '>=' | '==' | '!=' | 'contains';
  triggered: boolean;
  explanation: string;
}

export interface TradeThesis {
  id: string;
  investigationId: string;
  asset: string;
  direction: 'LONG' | 'SHORT';
  createdAt: string;
  entryPrice: number;
  expectedHorizon: string;
  bullCase: string;
  supportingEvidenceIds: string[];
  riskFactors: string[];
  invalidationConditions: InvalidationCondition[];
  councilConfidence: number;
  status: 'ACTIVE' | 'WEAKENING' | 'INVALIDATED' | 'COMPLETED';
}

export interface FinalDecision {
  conclusion: DecisionState;
  confidence: number;
  rationale: string;
  opportunityScore: number;
  riskScore: number;
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  strongestSupportingEvidenceId?: string;
  strongestCounterargument?: string;
  relevantRisks: string[];
  riskGateApproved: boolean;
  riskGateNotes?: string[];
  tradeExecuted?: boolean;
  orderId?: string;
  thesis?: TradeThesis;
}

export interface Candle {
  timestamp: number;
  isoString: string;
  dateStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradesCount?: number;
  vwap?: number;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  volumeAcceleration: number;
  relativeVolume: number;
  realizedVolatility: number;
  momentumScore: number;
  rsi14: number;
  liquidityUsd: number;
  spreadBps: number;
  candles: {
    '1H': Candle[];
    '4H': Candle[];
    '1D': Candle[];
    '7D': Candle[];
    '30D': Candle[];
  };
  provider: 'alpaca';
  timestamp: string;
}

export interface Investigation {
  id: string;
  command: string;
  asset: string;
  status: InvestigationStatus;
  createdAt: string;
  completedAt?: string;
  agentRuns: Record<string, AgentResult>;
  evidence: Evidence[];
  timeline: { timestamp: string; agent: string; message: string; stage: InvestigationStatus }[];
  events?: CouncilEvent[];
  stages?: Record<CouncilStage, CouncilStageState>;
  snapshot?: MarketSnapshot;
  decision?: FinalDecision;
  thesis?: TradeThesis;
  error?: string;
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
  openedAt: string;
  thesisId: string;
  thesis: TradeThesis;
  status: 'OPEN' | 'CLOSED';
}

export interface AlpacaAccount {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
}

export interface AlpacaOrder {
  id: string;
  clientOrderId: string;
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  status: 'new' | 'filled' | 'rejected' | 'canceled';
  filledAvgPrice?: number;
  submittedAt: string;
}
