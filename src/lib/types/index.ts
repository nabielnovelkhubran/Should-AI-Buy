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

// ---------------------------------------------------------------------------
// Phase 3: Verification Status
// Separates source *quality* (reliability) from *retrieval outcome* for this
// specific fetch. All adapters must set this — never leave it undefined.
// ---------------------------------------------------------------------------
export type VerificationStatus =
  | 'VERIFIED'    // Source returned valid, parseable, structurally complete data
  | 'UNVERIFIED'  // Data returned but not independently corroborated
  | 'FAILED'      // Adapter threw SourceUnavailableError — failure recorded, nothing fabricated
  | 'STALE'       // Retrieved successfully but beyond acceptable freshness window (>24h)
  | 'MOCK';       // Explicitly labeled demo/development data (not production intelligence)

// ---------------------------------------------------------------------------
// Phase 3: Claim Domain Types
// ---------------------------------------------------------------------------
export type ClaimType =
  | 'BULLISH'     // Assertion supporting the investment thesis
  | 'BEARISH'     // Assertion opposing the investment thesis
  | 'RISK'        // Risk-specific assertion
  | 'REFUTATION'  // Red Team counterclaim explicitly attacking an existing Claim
  | 'NEUTRAL';    // Contextual observation without directional bias

export type ClaimStatus =
  | 'SUPPORTED'    // Has at least one supporting evidence item, no fatal contradiction
  | 'CONTESTED'    // Has contradictory evidence challenging the assertion
  | 'REFUTED'      // A Red Team REFUTATION claim explicitly targets this claim
  | 'UNSUPPORTED'; // No evidence ID references this claim

/**
 * A Claim is a structured, inspectable assertion made by a council agent.
 * It connects agent reasoning (AgentResult.summary) to the underlying Evidence
 * objects. Claims are IMMUTABLE once produced. Red Team creates REFUTATION
 * claims that reference original Claim IDs — it does not modify existing claims.
 */
export interface Claim {
  id: string;                          // Deterministic: CLAIM-{invId}-{agentPrefix}-{seq}
  investigationId: string;
  agent: 'discovery' | 'quant' | 'intelligence' | 'risk' | 'red_team' | 'decision';
  stage: CouncilStage;
  type: ClaimType;
  statement: string;                   // Specific, falsifiable factual assertion
  confidence: number;                  // 0–100, agent-declared
  status: ClaimStatus;                 // Derived deterministically from evidence relationships
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  refutedByClaimId?: string;           // Set if a REFUTATION claim targets this claim
  refutationOf?: string;               // If type=REFUTATION: the Claim.id being refuted
  createdAt: string;
}


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
  // Phase 3: stable adapter identifier for full provenance tracing
  adapterVersion?: string;
}

export interface Evidence {
  id: string;
  investigationId: string;
  type: EvidenceType;
  title: string;
  description: string;
  /** When the underlying fact was observed/published (NOT when the system retrieved it) */
  observedAt: string;
  source: SourceProvenance;
  value: any;
  metadata?: Record<string, any>;
  /** Describes the source tier: PRIMARY = authoritative data feed, REPUTABLE = major publisher, etc. */
  reliability: ReliabilityRating;
  isContradictory?: boolean;

  // Phase 3 additions -------------------------------------------------------
  /** Outcome of the retrieval attempt for THIS specific fetch — separate from source tier */
  verificationStatus?: VerificationStatus;
  /** Stable adapter ID that produced this evidence item, e.g. 'alpaca-market-v2' */
  adapterSource?: string;
  /** Derived from observedAt vs source.retrievedAt delta */
  freshness?: 'LIVE' | 'RECENT' | 'STALE';
  /** Claim IDs this evidence item participates in (supporting or contradicting) */
  claimIds?: string[];
  /** Evidence IDs that this item directly contradicts (bidirectional graph edge) */
  contradicts?: string[];
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
  /** Phase 3: IDs of Claim objects this agent produced for this investigation */
  claimIds?: string[];
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
  /** Phase 3: All Claim objects produced during council deliberation */
  claims?: Claim[];
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
