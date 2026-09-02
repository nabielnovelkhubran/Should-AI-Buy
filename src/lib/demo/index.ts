// ---------------------------------------------------------------------------
// Phase 8G: Deterministic Hackathon Demo Support
// INVARIANT: Purely deterministic fixtures. Zero stochastic logic.
// Explicitly labeled as DEMO MODE and PAPER ONLY. No live trading paths.
// ---------------------------------------------------------------------------

import {
  Investigation,
  MarketSnapshot,
  OpportunityCandidate,
  Claim,
  Evidence,
  FinalDecision,
  Candle
} from '../types';

export interface DemoScenarioStep {
  stepNumber: number;
  stageName: string;
  description: string;
  symbol: string;
  data: any;
  invariants: string[];
}

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  environment: 'PAPER';
  mode: 'DEMO';
  steps: DemoScenarioStep[];
  isDeterministic: boolean;
  generatedAt: string;
}

/**
 * Returns a complete 10-step deterministic hackathon demonstration scenario.
 */
export function getDeterministicDemoScenario(): DemoScenario {
  const now = '2026-08-31T09:00:00.000Z';

  const mockCandle: Candle = {
    timestamp: 1725094800000,
    isoString: now,
    dateStr: '2026-08-31',
    open: 64100,
    high: 64300,
    low: 64050,
    close: 64250,
    volume: 120000
  };

  const demoSnapshot: MarketSnapshot = {
    symbol: 'BTC',
    price: 64250,
    change24h: 4.8,
    change7d: 8.2,
    volume24h: 1850000000,
    volumeAcceleration: 34.0,
    relativeVolume: 2.4,
    realizedVolatility: 38,
    momentumScore: 78,
    rsi14: 62,
    liquidityUsd: 1850000000,
    spreadBps: 2.1,
    candles: {
      '1H': [mockCandle],
      '4H': [mockCandle],
      '1D': [mockCandle],
      '7D': [mockCandle],
      '30D': [mockCandle]
    },
    provider: 'alpaca',
    timestamp: now
  };

  const demoCandidate: OpportunityCandidate = {
    symbol: 'BTC',
    assetClass: 'CRYPTO',
    score: 88,
    rank: 1,
    snapshot: demoSnapshot,
    signals: {
      momentum: 78,
      rsi: 62,
      rvol: 2.4,
      volumeAcceleration: 34.0,
      realizedVolatility: 38,
      liquidityUsd: 1850000000,
      opportunityScore: 88,
      riskScore: 28
    },
    discoveredAt: now
  };

  const demoEvidence: Evidence = {
    id: 'EVD-DEMO-01',
    investigationId: 'INV-BTC-DEMO-001',
    type: 'MARKET',
    title: 'Alpaca Market Bar Data',
    description: '24h trading volume $1.85B with price surge +4.8%',
    observedAt: now,
    source: {
      name: 'Alpaca Market Data Feed',
      url: 'https://data.alpaca.markets/v2',
      retrievedAt: now
    },
    value: { price: 64250, rvol: 2.4 },
    reliability: 'PRIMARY',
    verificationStatus: 'VERIFIED',
    adapterSource: 'alpaca-market-v2',
    freshness: 'LIVE'
  };

  const demoClaim: Claim = {
    id: 'CLM-DEMO-01',
    investigationId: 'INV-BTC-DEMO-001',
    agent: 'quant',
    stage: 'QUANT',
    type: 'BULLISH',
    statement: 'BTC exhibits bullish momentum breakout with RVOL > 2.0x',
    confidence: 85,
    status: 'SUPPORTED',
    supportingEvidenceIds: ['EVD-DEMO-01'],
    contradictoryEvidenceIds: [],
    createdAt: now
  };

  const demoDecision: FinalDecision = {
    conclusion: 'BUY',
    confidence: 85,
    rationale: 'Council synthesized multi-perspective consensus to BUY $BTC with verified claims.',
    opportunityScore: 88,
    riskScore: 28,
    supportingEvidenceIds: ['EVD-DEMO-01'],
    contradictoryEvidenceIds: [],
    relevantRisks: ['Near-term resistance at $66,000', 'Crypto market-wide beta'],
    riskGateApproved: true,
    riskGateNotes: ['Opportunity score 88 >= 55', 'Risk score 28 <= 70', 'Adequate liquidity depth']
  };

  const demoInvestigation: Investigation = {
    id: 'INV-BTC-DEMO-001',
    command: 'Should-AI buy $BTC?',
    asset: 'BTC',
    status: 'COMPLETED',
    createdAt: now,
    completedAt: now,
    snapshot: demoSnapshot,
    agentRuns: {
      discovery: {
        agent: 'discovery',
        verdict: 'OPPORTUNITY',
        confidence: 88,
        summary: 'Strong macro catalyst and breakout above 20-day SMA.',
        supportingEvidenceIds: ['EVD-DEMO-01'],
        contradictoryEvidenceIds: [],
        risks: ['Near-term resistance at $66,000'],
        recommendations: ['Consider entry with stop-loss at $61,000']
      },
      quant: {
        agent: 'quant',
        verdict: 'BUY',
        confidence: 84,
        summary: 'RSI-14 at 62 (neutral-bullish), positive volume delta +34%.',
        supportingEvidenceIds: ['EVD-DEMO-01'],
        contradictoryEvidenceIds: [],
        risks: ['Volatility expansion expected'],
        recommendations: ['Limit initial position to 15% equity']
      },
      intelligence: {
        agent: 'intelligence',
        verdict: 'BUY',
        confidence: 82,
        summary: 'Institutional ETF net inflows positive (+$280M).',
        supportingEvidenceIds: ['EVD-DEMO-01'],
        contradictoryEvidenceIds: [],
        risks: ['Options expiry this Friday'],
        recommendations: ['Monitor funding rates']
      },
      risk: {
        agent: 'risk',
        verdict: 'BUY',
        confidence: 86,
        summary: 'Ample order book depth ($14M within 1%), slippage minimal.',
        supportingEvidenceIds: ['EVD-DEMO-01'],
        contradictoryEvidenceIds: [],
        risks: ['Crypto market-wide beta'],
        recommendations: ['Max allocation: 20%']
      },
      red_team: {
        agent: 'red_team',
        verdict: 'CAUTION',
        confidence: 80,
        summary: 'Assumptions challenged: Evaluated distribution risk and verified thesis remains intact.',
        supportingEvidenceIds: [],
        contradictoryEvidenceIds: [],
        risks: ['Whale wallet transfer of 1,200 BTC to exchange'],
        recommendations: ['Maintain strict 5% thesis invalidation stop'],
        redTeamAttackDetails: {
          assumptionsChallenged: ['Unchecked institutional bull run'],
          vulnerabilitiesFound: ['Potential exchange inflow sell pressure'],
          thesisStatus: 'INTACT',
          counterEvidenceIds: []
        }
      },
      decision: {
        agent: 'decision',
        verdict: 'BUY',
        confidence: 85,
        summary: 'Council consensus recommends BUY with 85% confidence.',
        supportingEvidenceIds: ['EVD-DEMO-01'],
        contradictoryEvidenceIds: [],
        risks: ['Market volatility'],
        recommendations: ['Execute paper order; initiate continuous thesis monitoring']
      }
    },
    timeline: [
      { timestamp: now, agent: 'discovery', message: 'Identified $BTC opportunity', stage: 'DISCOVERING' },
      { timestamp: now, agent: 'decision', message: 'Consensus BUY generated', stage: 'COMPLETED' }
    ],
    claims: [demoClaim],
    evidence: [demoEvidence],
    decision: demoDecision
  };

  const steps: DemoScenarioStep[] = [
    {
      stepNumber: 1,
      stageName: 'Autonomous Opportunity Discovery',
      description: 'Bounded market universe scanner evaluates assets and scores $BTC as #1 ranked opportunity.',
      symbol: 'BTC',
      data: demoCandidate,
      invariants: ['Zero stochastic generation', 'Deterministic ranking', 'Bounded universe']
    },
    {
      stepNumber: 2,
      stageName: 'Candidate Queue & Validation',
      description: 'CandidateQueue validates candidate schema, deduplicates, and enqueues $BTC for deliberation.',
      symbol: 'BTC',
      data: { queueDepth: 1, topCandidate: demoCandidate },
      invariants: ['Strict schema validation', 'Deduplication by symbol']
    },
    {
      stepNumber: 3,
      stageName: '7-Stage Council Deliberation',
      description: 'Quant, Intelligence, and Risk agents deliberate concurrently over verifiable claims.',
      symbol: 'BTC',
      data: demoInvestigation.agentRuns,
      invariants: ['Immutable MarketSnapshot', 'Verifiable claim provenance']
    },
    {
      stepNumber: 4,
      stageName: 'Red Team Adversarial Challenge',
      description: 'Red Team attacks bull thesis with counter-evidence; verifies thesis remains INTACT.',
      symbol: 'BTC',
      data: demoInvestigation.agentRuns['red_team'],
      invariants: ['Adversarial attack required', 'Explicit thesisStatus evaluation']
    },
    {
      stepNumber: 5,
      stageName: 'Deterministic Risk Gate',
      description: 'Authoritative code safety boundary evaluates liquidity, allocation limits, and red-team findings.',
      symbol: 'BTC',
      data: demoInvestigation.decision,
      invariants: ['Non-bypassable server-side validation', 'Zero override flags']
    },
    {
      stepNumber: 6,
      stageName: 'Alpaca Paper Order Execution',
      description: 'PaperTradingService generates deterministic order intent and submits market order to Alpaca Paper v2.',
      symbol: 'BTC',
      data: { orderId: 'ORD-BTC-INV-BTC-DEMO-001', side: 'buy', qty: 0.15, status: 'SUBMITTED', isPaper: true },
      invariants: ['Paper endpoint only', 'Idempotency key EXEC-INV-BTC-DEMO-001-BTC-BUY']
    },
    {
      stepNumber: 7,
      stageName: 'Paper Portfolio Reconciliation',
      description: 'PaperPortfolioService reconciles broker fills into authoritative position holdings and exposure metrics.',
      symbol: 'BTC',
      data: { marketValue: 9637.5, unrealizedPnl: 0, allocationPct: 9.6, isExposureSafe: true },
      invariants: ['Broker-authoritative fills', 'Single-asset concentration limit <= 25%']
    },
    {
      stepNumber: 8,
      stageName: 'Thesis Provenance & Position Monitoring',
      description: 'PositionMonitoringService tracks position against original thesis parameters (entry: $64,250, score: 92/100 HEALTHY).',
      symbol: 'BTC',
      data: { status: 'HEALTHY', score: 92, pnlPercent: 0.0 },
      invariants: ['Deterministic health scoring', 'Authoritative position linkage']
    },
    {
      stepNumber: 9,
      stageName: 'Thesis Invalidation Detection',
      description: 'Simulated price drawdown breaches stop-loss threshold (-5.2%); thesis transitions to INVALIDATED (38/100).',
      symbol: 'BTC',
      data: { status: 'INVALIDATED', score: 38, invalidationCategory: 'PRICE_DRAWDOWN', drawdownPct: -5.2 },
      invariants: ['Fail-closed invalidation rules', 'Explicit threshold tracking']
    },
    {
      stepNumber: 10,
      stageName: 'Protective Exit Proposal & Automation Daemon',
      description: 'Generates protective exit proposal and executes paper exit order keyed by MONITOR-EXIT-BTC.',
      symbol: 'BTC',
      data: { proposalStatus: 'EXECUTED', exitSide: 'sell', exitQty: 0.15, automationStatus: 'RUNNING' },
      invariants: ['Broker-derived exit quantity', 'Idempotent protective paper exit', 'Zero credential leakage']
    }
  ];

  return {
    id: 'DEMO-HACKATHON-SCENARIO-01',
    title: 'Autonomous Opportunity Discovery to Protective Invalidation Paper Exit',
    description: '10-stage end-to-end autonomous trading research lifecycle demonstrating Alpaca paper trading integration.',
    environment: 'PAPER',
    mode: 'DEMO',
    steps,
    isDeterministic: true,
    generatedAt: now
  };
}
