import {
  Investigation,
  TradeThesis,
  Position,
  MarketSnapshot,
  CouncilStage,
  CouncilEvent,
  CouncilStageState,
  AgentResult,
  Claim
} from '../types';
import { fetchMarketSnapshot, getMarketEvidence } from '../market-data';
import { getNewsEvidence } from '../news';
import { getSocialEvidence } from '../social';
import { calculatePositionSize } from '../quant';
import { evaluateRiskGate } from '../risk-gate';
import { PaperPortfolioService } from '../portfolio';
import { paperTradingService } from '../trading';
import { storage } from '../storage';
import {
  runDiscoveryAgent,
  runQuantAgent,
  runIntelligenceAgent,
  runRiskAgent,
  runRedTeamAgent,
  runDecisionAgent
} from '../agents';
import {
  extractDiscoveryClaims,
  extractQuantClaims,
  extractIntelligenceClaims,
  extractRiskClaims,
  extractRedTeamClaims,
  linkRefutations,
  linkEvidenceToClaims
} from '../claims';


export interface CouncilExecutionOptions {
  investigationId?: string;
  source?: 'user' | 'autonomous-scanner' | string;
  metadata?: Record<string, any>;
  initialSnapshot?: MarketSnapshot;
  skipOrderExecution?: boolean;
  executionMode?: 'analysis-only' | 'paper-execution';
}

export async function orchestrateCouncilInvestigation(
  command: string,
  assetSymbol: string,
  onTimelineUpdate?: (event: any) => void,
  options?: CouncilExecutionOptions
): Promise<Investigation> {
  const cleanAsset = assetSymbol.toUpperCase().replace('$', '').trim();
  const id = options?.investigationId || `INV-${cleanAsset}-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  // Initial stage states for all 7 council stages
  const initialStages: Record<CouncilStage, CouncilStageState> = {
    DISCOVERY: { stage: 'DISCOVERY', status: 'PENDING' },
    QUANT: { stage: 'QUANT', status: 'PENDING' },
    INTELLIGENCE: { stage: 'INTELLIGENCE', status: 'PENDING' },
    RISK: { stage: 'RISK', status: 'PENDING' },
    RED_TEAM: { stage: 'RED_TEAM', status: 'PENDING' },
    DECISION: { stage: 'DECISION', status: 'PENDING' },
    RISK_GATE: { stage: 'RISK_GATE', status: 'PENDING' }
  };

  const investigation: Investigation = {
    id,
    command,
    asset: cleanAsset,
    status: 'DISCOVERING',
    createdAt: now,
    agentRuns: {},
    evidence: [],
    timeline: [],
    events: [],
    stages: initialStages,
    claims: [],   // Phase 3: populated as each agent runs
    source: options?.source || 'user',
    metadata: options?.metadata || {}
  };


  let eventCounter = 0;
  const emitCouncilEvent = (
    stage: CouncilStage,
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
    summary?: string,
    details?: Record<string, any>,
    error?: string
  ) => {
    eventCounter++;
    const eventTime = new Date().toISOString();
    const event: CouncilEvent = {
      id: `evt-${id}-${eventCounter}`,
      stage,
      status,
      summary,
      details,
      timestamp: eventTime,
      error
    };
    investigation.events?.push(event);

    if (investigation.stages) {
      investigation.stages[stage] = {
        stage,
        status,
        summary: summary || investigation.stages[stage]?.summary,
        error,
        timestamp: eventTime
      };
    }

    // Map stage to legacy InvestigationStatus for backward compatibility
    let mappedStatus: Investigation['status'] = 'ANALYZING';
    if (stage === 'DISCOVERY') mappedStatus = status === 'FAILED' ? 'FAILED' : 'DISCOVERING';
    else if (stage === 'RED_TEAM') mappedStatus = 'RED_TEAM';
    else if (stage === 'DECISION') mappedStatus = 'DECIDING';
    else if (stage === 'RISK_GATE') mappedStatus = status === 'COMPLETED' ? 'COMPLETED' : 'EXECUTING';

    const timelineItem = {
      timestamp: new Date().toLocaleTimeString(),
      agent: stage.toLowerCase(),
      message: summary || `${stage} status: ${status}`,
      stage: mappedStatus
    };
    investigation.timeline.push(timelineItem);
    investigation.status = mappedStatus;

    if (onTimelineUpdate) onTimelineUpdate(timelineItem);
  };

  try {
    // =========================================================================
    // 1. DISCOVERY STAGE
    // Single, authoritative market snapshot fetch from Alpaca
    // =========================================================================
    emitCouncilEvent('DISCOVERY', 'RUNNING', `Connecting to Alpaca Market Data API for $${cleanAsset}...`);

    let snapshot: MarketSnapshot;
    if (options?.initialSnapshot) {
      snapshot = options.initialSnapshot;
      emitCouncilEvent('DISCOVERY', 'RUNNING', `Using candidate market snapshot for $${cleanAsset}...`);
    } else {
      try {
        snapshot = await fetchMarketSnapshot(cleanAsset);
      } catch (err: any) {
        const errMsg = err.message || 'Market data unavailable';
        emitCouncilEvent('DISCOVERY', 'FAILED', `Market data fetch failed: ${errMsg}`, undefined, errMsg);
        investigation.status = 'FAILED';
        investigation.error = errMsg;
        investigation.completedAt = new Date().toISOString();
        storage.saveInvestigation(investigation);
        return investigation;
      }
    }

    // Single immutable snapshot embedded for all subsequent council agents
    investigation.snapshot = snapshot;

    const marketEvid = getMarketEvidence(id, snapshot);
    const newsEvid = await getNewsEvidence(id, cleanAsset);
    const socialEvid = await getSocialEvidence(id, cleanAsset);
    investigation.evidence = [...marketEvid, ...newsEvid, ...socialEvid];

    const discoveryResult = runDiscoveryAgent(snapshot, investigation.evidence);
    investigation.agentRuns['discovery'] = discoveryResult;

    // Phase 3: Extract Discovery claims
    const discoveryClaims = extractDiscoveryClaims(id, snapshot, discoveryResult);
    investigation.claims = [...(investigation.claims ?? []), ...discoveryClaims];

    emitCouncilEvent(
      'DISCOVERY',
      'COMPLETED',
      discoveryResult.summary,
      { opportunityScore: discoveryResult.metrics?.opportunityScore, price: snapshot.price }
    );


    // =========================================================================
    // 2. PARALLEL MULTI-PERSPECTIVE AGENT DELIBERATION (QUANT, INTEL, RISK)
    // Run concurrently over the EXACT same snapshot with individual error handling
    // =========================================================================
    emitCouncilEvent('QUANT', 'RUNNING', 'Calculating deterministic technical metrics and returns...');
    emitCouncilEvent('INTELLIGENCE', 'RUNNING', 'Evaluating external news, catalysts, and public disclosures...');
    emitCouncilEvent('RISK', 'RUNNING', 'Analyzing structural, liquidity, and concentration risk metrics...');

    const [quantOutcome, intelOutcome, riskOutcome] = await Promise.all([
      // Quant Agent
      (async (): Promise<AgentResult> => {
        try {
          const res = runQuantAgent(snapshot, investigation.evidence);
          investigation.agentRuns['quant'] = res;
          // Phase 3: extract Quant claims
          const claims = extractQuantClaims(id, snapshot, res);
          investigation.claims = [...(investigation.claims ?? []), ...claims];
          emitCouncilEvent('QUANT', 'COMPLETED', res.summary, res.metrics);
          return res;
        } catch (err: any) {
          const errRes: AgentResult = {
            agent: 'quant',
            verdict: 'HOLD',
            confidence: 0,
            summary: `Quant analysis failed: ${err.message}`,
            supportingEvidenceIds: [],
            contradictoryEvidenceIds: [],
            risks: ['Quantitative analysis execution failure'],
            recommendations: ['Rely on defensive parameters'],
            failed: true,
            error: err.message
          };
          investigation.agentRuns['quant'] = errRes;
          emitCouncilEvent('QUANT', 'FAILED', `Quant analysis failed: ${err.message}`, undefined, err.message);
          return errRes;
        }
      })(),

      // Intelligence Agent
      (async (): Promise<AgentResult> => {
        try {
          const res = runIntelligenceAgent(investigation.evidence);
          investigation.agentRuns['intelligence'] = res;
          // Phase 3: extract Intelligence claims
          const claims = extractIntelligenceClaims(id, investigation.evidence, res);
          investigation.claims = [...(investigation.claims ?? []), ...claims];
          emitCouncilEvent('INTELLIGENCE', 'COMPLETED', res.summary, res.metrics);
          return res;
        } catch (err: any) {
          const errRes: AgentResult = {
            agent: 'intelligence',
            verdict: 'HOLD',
            confidence: 50,
            summary: 'News intelligence unavailable. The council did not use fabricated news to compensate.',
            supportingEvidenceIds: [],
            contradictoryEvidenceIds: [],
            risks: ['News intelligence feed failure'],
            recommendations: ['Base trade thesis solely on verified on-chain data'],
            failed: true,
            error: err.message
          };
          investigation.agentRuns['intelligence'] = errRes;
          emitCouncilEvent('INTELLIGENCE', 'FAILED', `Intelligence feed unavailable: ${err.message}`, undefined, err.message);
          return errRes;
        }
      })(),

      // Risk Agent
      (async (): Promise<AgentResult> => {
        try {
          const res = runRiskAgent(snapshot, investigation.evidence);
          investigation.agentRuns['risk'] = res;
          // Phase 3: extract Risk claims
          const claims = extractRiskClaims(id, investigation.evidence, res);
          investigation.claims = [...(investigation.claims ?? []), ...claims];
          emitCouncilEvent('RISK', 'COMPLETED', res.summary, res.metrics);
          return res;
        } catch (err: any) {
          const errRes: AgentResult = {
            agent: 'risk',
            verdict: 'REJECT',
            confidence: 90,
            summary: `Risk evaluation encounter: ${err.message}`,
            supportingEvidenceIds: [],
            contradictoryEvidenceIds: [],
            risks: ['Risk analysis execution error'],
            recommendations: ['Block trade on safety uncertainty'],
            failed: true,
            error: err.message
          };
          investigation.agentRuns['risk'] = errRes;
          emitCouncilEvent('RISK', 'FAILED', `Risk analysis error: ${err.message}`, undefined, err.message);
          return errRes;
        }
      })()
    ]);



    // =========================================================================
    // 3. RED-TEAM ADVERSARIAL CHALLENGE STAGE
    // Core Differentiator: Actively attacks the bullish thesis
    // =========================================================================
    emitCouncilEvent('RED_TEAM', 'RUNNING', 'Formulating initial thesis and unleashing Red-Team adversarial attack...');

    const prelimThesis = `Bullish thesis: $${cleanAsset} has momentum (${snapshot.momentumScore}) and volume acceleration (+${snapshot.volumeAcceleration}%).`;
    const redTeamResult = runRedTeamAgent(
      cleanAsset,
      prelimThesis,
      snapshot,
      investigation.evidence,
      investigation.agentRuns
    );
    investigation.agentRuns['red_team'] = redTeamResult;

    // Phase 3: Extract Red Team REFUTATION claims and link them to prior claims
    const redTeamClaims = extractRedTeamClaims(id, investigation.evidence, redTeamResult, investigation.claims ?? []);
    investigation.claims = [...(investigation.claims ?? []), ...redTeamClaims];
    // Resolve refutations and recompute claim statuses across all claims
    investigation.claims = linkRefutations(investigation.claims);
    // Backfill evidence → claim references
    linkEvidenceToClaims(investigation.evidence, investigation.claims);

    emitCouncilEvent(
      'RED_TEAM',
      'COMPLETED',
      redTeamResult.summary,
      {
        thesisStatus: redTeamResult.redTeamAttackDetails?.thesisStatus,
        vulnerabilitiesCount: redTeamResult.redTeamAttackDetails?.vulnerabilitiesFound.length,
        strongestCounterargument: redTeamResult.strongestCounterargument
      }
    );

    // =========================================================================
    // 4. DECISION SYNTHESIS STAGE
    // Synthesizes council findings into a final verdict
    // =========================================================================
    emitCouncilEvent('DECISION', 'RUNNING', 'Synthesizing council deliberations into final verdict...');

    const decisionResult = runDecisionAgent(cleanAsset, snapshot, investigation.agentRuns, investigation.evidence);
    emitCouncilEvent(
      'DECISION',
      'COMPLETED',
      `Council Verdict: ${decisionResult.conclusion} (${decisionResult.confidence}% confidence). ${decisionResult.rationale}`,
      { conclusion: decisionResult.conclusion, confidence: decisionResult.confidence }
    );

    // =========================================================================
    // 5. DETERMINISTIC RISK GATE STAGE
    // Final code-enforced safety check before ANY trade can reach Alpaca
    // =========================================================================
    emitCouncilEvent('RISK_GATE', 'RUNNING', 'Evaluating deterministic risk limits and portfolio exposure...');

    const portfolioSnapshot = await new PaperPortfolioService().getPortfolioSnapshot();
    const availableCash = portfolioSnapshot.account?.cash ?? 100000;
    const positionSizing = calculatePositionSize(availableCash, 2.5, snapshot.price, 5.0);

    const hasRedTeamFatal = redTeamResult.redTeamAttackDetails?.thesisStatus === 'DISPROVED';
    const riskGateEval = evaluateRiskGate({
      symbol: cleanAsset,
      opportunityScore: decisionResult.opportunityScore,
      riskScore: decisionResult.riskScore,
      liquidityUsd: snapshot.liquidityUsd,
      positionValueUsd: positionSizing.positionValueUsd,
      availableCash,
      hasRedTeamFatalFlaw: hasRedTeamFatal,
      evidence: investigation.evidence
    });

    let tradeExecuted = false;
    let orderId: string | undefined;
    let thesis: TradeThesis | undefined;

    if (decisionResult.conclusion === 'BUY' && riskGateEval.passed) {
      if (options?.skipOrderExecution || options?.executionMode === 'analysis-only') {
        emitCouncilEvent(
          'RISK_GATE',
          'COMPLETED',
          'Deterministic Risk Gate: ALL SAFETY CHECKS PASSED. (Analysis-only mode — order execution skipped).',
          { riskGateApproved: true, skipOrderExecution: true }
        );
        tradeExecuted = false;
      } else {
        emitCouncilEvent(
          'RISK_GATE',
          'COMPLETED',
          'Deterministic Risk Gate: ALL SAFETY CHECKS PASSED. Order authorized for Alpaca paper execution.',
          { riskGateApproved: true }
        );

        const assetClass = (['BTC', 'ETH', 'SOL'].includes(cleanAsset) ? 'CRYPTO' : 'EQUITY');
        const orderResult = await paperTradingService.submitPaperOrder({
          investigationId: id,
          symbol: cleanAsset,
          assetClass,
          side: 'buy',
          qty: positionSizing.qty,
          price: snapshot.price,
          orderType: 'market',
          timeInForce: assetClass === 'CRYPTO' ? 'gtc' : 'day',
          recommendation: 'BUY',
          riskGatePassed: true,
          opportunityScore: decisionResult.opportunityScore,
          candidateRank: options?.metadata?.candidateRank
        });

        if (orderResult.status === 'SUBMITTED' || orderResult.status === 'FILLED') {
          tradeExecuted = true;
          orderId = orderResult.orderId;
        }

        investigation.execution = {
          mode: 'PAPER',
          adapterSource: orderResult.adapterSource,
          orderId: orderResult.orderId,
          brokerOrderId: orderResult.brokerOrderId,
          submittedAt: orderResult.submittedAt || now,
          status: orderResult.status,
          error: orderResult.error
        };
      }

      // Create Persistent Trade Thesis
      thesis = {
        id: `THESIS-${id}`,
        investigationId: id,
        asset: cleanAsset,
        direction: 'LONG',
        createdAt: now,
        entryPrice: snapshot.price,
        expectedHorizon: '1-3 Days',
        bullCase: decisionResult.rationale,
        supportingEvidenceIds: decisionResult.supportingEvidenceIds,
        riskFactors: decisionResult.relevantRisks,
        invalidationConditions: [
          {
            id: 'inv-1',
            condition: 'Momentum drops below 45',
            metricKey: 'momentum',
            threshold: 45,
            comparison: '<',
            triggered: false,
            explanation: 'Momentum deterioration breaks trend continuation'
          },
          {
            id: 'inv-2',
            condition: 'Liquidity pool drops below $1M',
            metricKey: 'liquidity',
            threshold: 1000000,
            comparison: '<',
            triggered: false,
            explanation: 'Liquidity outflow increases exit slippage risk'
          },
          {
            id: 'inv-3',
            condition: 'Stop loss drawdown >= 5%',
            metricKey: 'price_drawdown',
            threshold: -5.0,
            comparison: '<=',
            triggered: false,
            explanation: 'Predetermined capital protection loss limit'
          }
        ],
        councilConfidence: decisionResult.confidence,
        status: 'ACTIVE'
      };

      storage.saveThesis(thesis);

      const newPosition: Position = {
        id: `pos-${cleanAsset.toLowerCase()}-${Date.now()}`,
        symbol: cleanAsset,
        quantity: positionSizing.qty,
        entryPrice: snapshot.price,
        currentPrice: snapshot.price,
        unrealizedPl: 0,
        unrealizedPlPct: 0,
        openedAt: now,
        thesisId: thesis.id,
        thesis,
        status: 'OPEN'
      };

      storage.savePosition(newPosition);
    } else {
      if (decisionResult.conclusion === 'BUY' && !riskGateEval.passed) {
        emitCouncilEvent(
          'RISK_GATE',
          'FAILED',
          `Deterministic Risk Gate BLOCKED trade: ${riskGateEval.violations.join(' ')}`,
          { riskGateApproved: false, violations: riskGateEval.violations },
          riskGateEval.violations.join(' ')
        );
      } else {
        emitCouncilEvent(
          'RISK_GATE',
          'COMPLETED',
          'Risk Gate: No trade authorization requested (verdict was ' + decisionResult.conclusion + ').',
          { riskGateApproved: riskGateEval.passed }
        );
      }
    }

    investigation.decision = {
      ...decisionResult,
      riskGateApproved: riskGateEval.passed,
      riskGateNotes: riskGateEval.violations.length > 0 ? riskGateEval.violations : riskGateEval.riskGateNotes,
      tradeExecuted,
      orderId,
      thesis
    };

    investigation.thesis = thesis;
    investigation.status = 'COMPLETED';
    investigation.completedAt = new Date().toISOString();

    storage.saveInvestigation(investigation);
    return investigation;
  } catch (err: any) {
    investigation.status = 'FAILED';
    investigation.error = err?.message || 'Unknown council error';
    investigation.completedAt = new Date().toISOString();
    storage.saveInvestigation(investigation);
    return investigation;
  }
}
