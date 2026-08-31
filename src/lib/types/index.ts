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

// ---------------------------------------------------------------------------
// Phase 4C: Social Intelligence Domain Types
// Provider-agnostic domain models for social media events, sentiment & filters.
// ---------------------------------------------------------------------------

export type SocialPlatform = 'X' | 'REDDIT' | 'FARCASTER' | 'TELEGRAM' | 'DISCORD' | 'GENERIC';

export interface SocialAuthor {
  username: string;
  displayName?: string;
  verified?: boolean;
  followerCount?: number;
  accountAgeDays?: number;
}

export interface SocialEngagement {
  likes?: number;
  reposts?: number;
  replies?: number;
  impressions?: number;
}

export interface SocialEvent {
  id: string;
  platform: SocialPlatform;
  author: SocialAuthor;
  text: string;
  createdAt: string; // ISO 8601
  symbols: string[];
  engagement?: SocialEngagement;
  sourceUrl?: string;
  verificationStatus: VerificationStatus;
  adapterSource: string;
  sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  metadata?: Record<string, any>;
}

export interface SocialFilterStats {
  totalReceived: number;
  acceptedCount: number;
  spamFilteredCount: number;
  duplicateCount: number;
  rejectionReasons: Record<string, number>;
}

export interface SocialSignal {
  symbol: string;
  totalEvents: number;
  acceptedEvents: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;       // 0 - 100
  signalStrength: number;   // 0 - 100
  botSpamFilteredCount: number;
  topNarratives: string[];
  generatedAt: string;
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
  /** Phase 5B: Source of the investigation (e.g. 'user' or 'autonomous-scanner') */
  source?: 'user' | 'autonomous-scanner' | string;
  /** Phase 5B: Arbitrary provenance and runtime metadata */
  metadata?: Record<string, any>;
  /** Phase 6A: Traceable paper execution record */
  execution?: PaperExecutionRecord;
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

// ---------------------------------------------------------------------------
// Phase 5A: Autonomous Opportunity Scanner & Candidate Discovery Types
// ---------------------------------------------------------------------------

export type AssetClass = 'CRYPTO' | 'EQUITY';

export interface CandidateSignals {
  momentum: number;
  rsi: number;
  rvol: number;
  volumeAcceleration: number;
  realizedVolatility: number;
  liquidityUsd: number;
  opportunityScore: number;
  riskScore: number;
}

export interface OpportunityCandidate {
  symbol: string;
  assetClass: AssetClass;
  score: number;       // Deterministic opportunityScore (0 - 100)
  rank: number;        // 1-based rank within scan
  snapshot: MarketSnapshot;
  signals: CandidateSignals;
  discoveredAt: string; // ISO 8601
}

export interface FailedScanTarget {
  symbol: string;
  error: string;
  statusCode?: number;
}

export interface ScanOptions {
  universe?: string[];
  limit?: number;      // Maximum number of top candidates to return (default: 5)
  minScore?: number;   // Optional minimum opportunity score threshold
  fetchSnapshotFn?: (symbol: string) => Promise<MarketSnapshot>; // Dependency injection for test isolation
}

export interface ScanResult {
  candidates: OpportunityCandidate[];
  scannedCount: number;
  successfulCount: number;
  failedCount: number;
  failedTargets: FailedScanTarget[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Phase 5B: Candidate Queue & Council Dispatcher Domain Types
// ---------------------------------------------------------------------------

export type CandidateQueueStatus =
  | 'QUEUED'
  | 'DISPATCHING'
  | 'INVESTIGATING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED';

export interface CandidateQueueItem {
  id: string;                    // Deterministic: QITEM-{symbol}-{rank}-{discoveredAt}
  symbol: string;
  candidate: OpportunityCandidate;
  status: CandidateQueueStatus;
  enqueuedAt: string;
  startedAt?: string;
  completedAt?: string;
  investigationId?: string;
  error?: string;
  priority: number;              // Opportunity score (0 - 100)
}

export interface CandidateQueueStats {
  totalEnqueued: number;
  queuedCount: number;
  dispatchingCount: number;
  investigatingCount: number;
  completedCount: number;
  rejectedCount: number;
  failedCount: number;
}

export interface DispatchResult {
  dispatched: boolean;
  item?: CandidateQueueItem;
  investigation?: Investigation;
  error?: string;
}

export interface DispatchSummary {
  totalDispatched: number;
  completedCount: number;
  failedCount: number;
  results: DispatchResult[];
}

// ---------------------------------------------------------------------------
// Phase 5C: Watchlist & Discovery Dashboard Domain Types
// ---------------------------------------------------------------------------

export interface WatchlistItem {
  symbol: string;
  assetClass: AssetClass;
  addedAt: string;               // ISO 8601 timestamp
  notes?: string;
  targetPrice?: number;
  addedFromScan?: boolean;
  lastOpportunityScore?: number;
}

// ---------------------------------------------------------------------------
// Phase 6A: Paper Trading Execution Layer Domain Types
// ---------------------------------------------------------------------------

export type PaperOrderStatus =
  | 'INTENT_CREATED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED'
  | 'FAILED'
  | 'BLOCKED';

export interface PaperOrderIntent {
  orderId: string;               // Deterministic: ORD-{symbol}-{investigationId}
  investigationId: string;
  symbol: string;
  assetClass: AssetClass;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  notional?: number;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  status: PaperOrderStatus;
  riskGateStatus: 'PASS' | 'BLOCKED';
  recommendation: DecisionState;
  candidateRank?: number;
  opportunityScore?: number;
  createdAt: string;             // ISO 8601
  submittedAt?: string;          // ISO 8601
  brokerOrderId?: string;
  adapterSource: string;
  error?: string;
}

export interface PaperExecutionRecord {
  mode: 'PAPER';
  adapterSource: string;
  orderId: string;
  brokerOrderId?: string;
  submittedAt: string;
  status: PaperOrderStatus;
  error?: string;
}

export interface PaperOrderRequest {
  investigationId: string;
  symbol: string;
  assetClass: AssetClass;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  orderType?: 'market' | 'limit';
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
  recommendation: DecisionState;
  riskGatePassed: boolean;
  opportunityScore?: number;
  candidateRank?: number;
}

export interface PaperOrderResult {
  orderId: string;
  brokerOrderId?: string;
  clientOrderId: string;
  investigationId: string;
  symbol: string;
  assetClass: AssetClass;
  side: 'buy' | 'sell';
  qty: number;
  orderType: 'market' | 'limit';
  timeInForce: string;
  status: PaperOrderStatus;
  riskGateStatus: 'PASS' | 'BLOCKED';
  recommendation: DecisionState;
  candidateRank?: number;
  opportunityScore?: number;
  createdAt: string;
  submittedAt?: string;
  filledAvgPrice?: number;
  adapterSource: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Phase 6B: Paper Portfolio & Position Lifecycle Domain Types
// ---------------------------------------------------------------------------

export interface PaperAccountSnapshot {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  isPaper: boolean;
  retrievedAt: string;
}

export interface PaperPosition {
  symbol: string;
  assetClass: AssetClass;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  side: 'long' | 'short';
  allocationPct: number;
  retrievedAt: string;
}

export interface PaperOrderSnapshot {
  orderId: string;
  brokerOrderId?: string;
  clientOrderId?: string;
  investigationId?: string;
  symbol: string;
  assetClass: AssetClass;
  side: 'buy' | 'sell';
  qty: number;
  filledQty: number;
  remainingQty: number;
  status: PaperOrderStatus;
  orderType: string;
  timeInForce: string;
  filledAvgPrice?: number;
  submittedAt: string;
  updatedAt?: string;
}

export interface PortfolioExposure {
  grossExposureUsd: number;
  netExposureUsd: number;
  grossExposurePct: number;
  netExposurePct: number;
  cryptoExposureUsd: number;
  cryptoExposurePct: number;
  equityExposureUsd: number;
  equityExposurePct: number;
  largestPositionSymbol?: string;
  largestPositionAllocationPct: number;
}

export interface PortfolioRiskSummary {
  totalExposureUsd: number;
  availableBuyingPowerUsd: number;
  openPositionCount: number;
  openOrderCount: number;
  pendingOrderExposureUsd: number;
  concentrationWarnings: string[];
  maxAllowedPositionPct: number;
  isExposureSafe: boolean;
}

export interface PortfolioError {
  source: 'account' | 'positions' | 'orders';
  reason: string;
}

export interface PortfolioSnapshot {
  account: PaperAccountSnapshot | null;
  positions: PaperPosition[];
  openOrders: PaperOrderSnapshot[];
  exposure: PortfolioExposure;
  risk: PortfolioRiskSummary;
  errors?: PortfolioError[];
  provider: string;
  environment: 'PAPER';
  retrievedAt: string;
}

export interface PortfolioLimits {
  maxPositionAllocationPct: number;
  maxGrossExposurePct: number;
  maxCryptoExposurePct: number;
  minAvailableCashPct: number;
}

export interface ProposedOrderAssessment {
  allowed: boolean;
  reason?: string;
  currentExposureUsd: number;
  projectedExposureUsd: number;
  projectedAllocationPct: number;
}

// ---------------------------------------------------------------------------
// Phase 6C: Position Monitoring & Protective Invalidation Domain Types
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
  score: number;
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
  quantity: number;
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
  executeExits?: boolean;
  invalidationPriceDrawdownPct?: number;
  invalidationMomentumThreshold?: number;
  invalidationLiquidityThresholdUsd?: number;
  invalidationRiskScoreThreshold?: number;
  fetchSnapshotFn?: (symbol: string) => Promise<MarketSnapshot>;
}

// ---------------------------------------------------------------------------
// Phase 6D: Scheduled Automation & Orchestration Domain Types
// ---------------------------------------------------------------------------

export type AutomationJobType = 'DISCOVERY' | 'MONITORING';

export type AutomationJobStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'
  | 'SKIPPED';

export type AutomationSchedulerStatus = 'STOPPED' | 'IDLE' | 'RUNNING' | 'ERROR';

export interface DiscoveryCycleConfig {
  enabled: boolean;
  intervalMs: number;
  scanLimit?: number;
  autoDispatch?: boolean;
  executeTrades?: boolean;
}

export interface MonitoringCycleConfig {
  enabled: boolean;
  intervalMs: number;
  executeExits?: boolean;
}

export interface AutomationConfig {
  enabled: boolean;
  discovery: DiscoveryCycleConfig;
  monitoring: MonitoringCycleConfig;
}

export interface DiscoveryCycleResult {
  scanResult: ScanResult;
  queuedCount: number;
  dispatchSummary?: DispatchSummary;
  durationMs: number;
  completedAt: string;
}

export interface AutomationRun {
  runId: string;
  jobType: AutomationJobType;
  trigger: 'SCHEDULED' | 'MANUAL';
  status: AutomationJobStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  discoveryResult?: DiscoveryCycleResult;
  monitoringResult?: MonitoringCycleResult;
  error?: string;
  skippedReason?: string;
}

export interface AutomationAuditEvent {
  timestamp: string;
  event: string;
  jobType?: AutomationJobType;
  runId?: string;
  message: string;
  details?: Record<string, any>;
}

export interface AutomationMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  skippedRuns: number;
  lastDiscoveryDurationMs?: number;
  lastMonitoringDurationMs?: number;
}

export interface AutomationStatus {
  schedulerStatus: AutomationSchedulerStatus;
  config: AutomationConfig;
  activeJobs: Record<AutomationJobType, boolean>;
  lastRun: Partial<Record<AutomationJobType, AutomationRun>>;
  nextRun: Partial<Record<AutomationJobType, string>>;
  recentRuns: AutomationRun[];
  metrics: AutomationMetrics;
  auditTrail: AutomationAuditEvent[];
  environment: 'PAPER';
}


