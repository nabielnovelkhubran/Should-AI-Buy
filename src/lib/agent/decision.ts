import { optionContractSelector } from './options/contract-selector';
import {
  AIDecision,
  AIDecisionAction,
  MarketStateContext,
  AgentStrategyConfig,
  InstrumentType,
  OptionDetails
} from './types';
import { OpportunityCandidate } from '../types';
import { getAgentConfig } from './config';
import { getMarketEvidence } from '../market-data';
import { runQuantAgent, runIntelligenceAgent, runDecisionAgent, runRedTeamAgent } from '../agents';
import { classifyMarketRegime, isStrategyCompatibleWithRegime } from './regime';
import { evaluateMultiFactorOpportunity } from './strategy';
import {
  isFeatherlessConfigured,
  getFeatherlessModel,
  generateFeatherlessCompletion
} from '../ai/featherless';
import { detectAssetClass } from '../scanner/universe';

// ---------------------------------------------------------------------------
// Phase 8.21: AI Decision Engine & Structured Multi-Agent Synthesis
// INVARIANT: Every AI decision must satisfy the strict AIDecision schema.
// INVARIANT: Missing invalidation conditions or R:R < 2.0R safely default to 'PASS'.
// INVARIANT: The AI cannot bypass the Risk Gate or execute orders directly.
// INVARIANT: Any malformed LLM response or timeout FAILS CLOSED to 'PASS'.
// ---------------------------------------------------------------------------

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(`SCHEMA_VALIDATION_ERROR: ${message}`);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Validates that an arbitrary payload strictly conforms to the AIDecision schema.
 */
export function validateAIDecisionSchema(data: any, options?: { minRiskRewardRatio?: number }): AIDecision {
  if (!data || typeof data !== 'object') {
    throw new SchemaValidationError('Decision payload must be a non-null object.');
  }

  const validActions: AIDecisionAction[] = ['BUY', 'SELL', 'HOLD', 'PASS'];
  if (!validActions.includes(data.action)) {
    throw new SchemaValidationError(`Invalid decision action "${data.action}". Must be one of: ${validActions.join(', ')}.`);
  }

  if (typeof data.instrument !== 'string' || !data.instrument.trim()) {
    throw new SchemaValidationError('Decision instrument must be a non-empty string ticker symbol.');
  }

  if (typeof data.confidence !== 'number' || isNaN(data.confidence) || data.confidence < 0 || data.confidence > 100) {
    throw new SchemaValidationError('Decision confidence must be a finite number between 0 and 100.');
  }

  if (typeof data.opportunityScore !== 'number' || isNaN(data.opportunityScore) || data.opportunityScore < 0 || data.opportunityScore > 100) {
    throw new SchemaValidationError('Decision opportunityScore must be a finite number between 0 and 100.');
  }

  if (typeof data.thesis !== 'string' || !data.thesis.trim()) {
    throw new SchemaValidationError('Decision thesis must be a non-empty string explaining the investment hypothesis.');
  }

  if (typeof data.reasoningSummary !== 'string' || !data.reasoningSummary.trim()) {
    throw new SchemaValidationError('Decision reasoningSummary must be a non-empty string.');
  }

  if (!Array.isArray(data.entryConditions)) {
    throw new SchemaValidationError('Decision entryConditions must be an array.');
  }

  if (!Array.isArray(data.invalidationConditions)) {
    throw new SchemaValidationError('Decision invalidationConditions must be an array.');
  }

  // Mandatory Invariant: Every BUY or SELL must have at least one explicit invalidation condition
  if ((data.action === 'BUY' || data.action === 'SELL') && data.invalidationConditions.length === 0) {
    throw new SchemaValidationError('Active trade decision (BUY/SELL) requires at least one explicit invalidation condition.');
  }

  if (!Array.isArray(data.targetConditions)) {
    throw new SchemaValidationError('Decision targetConditions must be an array.');
  }

  if (!Array.isArray(data.evidence)) {
    throw new SchemaValidationError('Decision evidence must be an array of structured evidence items.');
  }

  const riskRewardRatio = typeof data.riskRewardRatio === 'number' ? data.riskRewardRatio : 1.0;
  const minRR = typeof options?.minRiskRewardRatio === 'number' ? options.minRiskRewardRatio : 1.0;
  if ((data.action === 'BUY' || data.action === 'SELL') && riskRewardRatio < minRR) {
    throw new SchemaValidationError(`Trade requires minimum ${minRR}R risk/reward ratio (received ${riskRewardRatio}R).`);
  }

  return {
    action: data.action,
    instrument: data.instrument.toUpperCase().replace(/^$/, '').trim(),
    assetClass: data.assetClass === 'CRYPTO' ? 'CRYPTO' : 'EQUITY',
    instrumentType: data.instrumentType || (data.assetClass === 'CRYPTO' ? 'CRYPTO' : 'EQUITY'),
    strategy: typeof data.strategy === 'string' ? data.strategy : 'MOMENTUM_BREAKOUT',
    confidence: Number(data.confidence.toFixed(1)),
    opportunityScore: Number(data.opportunityScore.toFixed(1)),
    marketRegime: data.marketRegime,
    factorBreakdown: data.factorBreakdown,
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
    thesis: data.thesis.trim(),
    catalyst: typeof data.catalyst === 'string' ? data.catalyst : 'Quantitative momentum divergence',
    expectedHorizon: typeof data.expectedHorizon === 'string' ? data.expectedHorizon : '1-3 days',
    expectedMove: data.expectedMove,
    entryConditions: data.entryConditions.map(String),
    invalidationConditions: data.invalidationConditions.map(String),
    targetConditions: data.targetConditions.map(String),
    riskAssessment: typeof data.riskAssessment === 'string' ? data.riskAssessment : 'Standard market volatility risk',
    reasoningSummary: data.reasoningSummary.trim(),
    targetPrice: typeof data.targetPrice === 'number' ? data.targetPrice : undefined,
    invalidationPrice: typeof data.invalidationPrice === 'number' ? data.invalidationPrice : undefined,
    evidence: data.evidence.map((e: any) => ({
      source: String(e.source || 'market-data'),
      timestamp: String(e.timestamp || new Date().toISOString()),
      claim: String(e.claim || ''),
      confidence: typeof e.confidence === 'number' ? e.confidence : undefined
    })),
    optionDetails: data.optionDetails,
    suggestedPositionSizeUsd: typeof data.suggestedPositionSizeUsd === 'number' ? data.suggestedPositionSizeUsd : undefined,
    generatedAt: data.generatedAt || new Date().toISOString()
  };
}

export class AIDecisionEngine {
  private config: AgentStrategyConfig;

  constructor(config: AgentStrategyConfig = getAgentConfig()) {
    this.config = config;
  }

  public updateConfig(config: AgentStrategyConfig): void {
    this.config = config;
  }

  /**
   * Generates a safe fallback 'PASS' decision on model timeout or error.
   */
  public createSafePassDecision(symbol: string, reason: string): AIDecision {
    const clean = symbol.toUpperCase().replace(/^$/, '').trim();
    const isCrypto = clean.includes('/') || detectAssetClass(clean) === 'CRYPTO';
    return {
      action: 'PASS',
      instrument: clean,
      assetClass: isCrypto ? 'CRYPTO' : 'EQUITY',
      instrumentType: isCrypto ? 'CRYPTO' : 'EQUITY',
      strategy: 'defensive-pass',
      confidence: 0,
      opportunityScore: 0,
      riskRewardRatio: 1.0,
      thesis: `Autonomous decision defaulted to PASS: ${reason}`,
      catalyst: 'None',
      expectedHorizon: 'N/A',
      entryConditions: [],
      invalidationConditions: [],
      targetConditions: [],
      riskAssessment: 'Model error, regime mismatch, or condition unsatisfied — capital preserved.',
      reasoningSummary: `Autonomous fallback executed: ${reason}`,
      evidence: [],
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Evaluates an opportunity candidate against market state and structured intelligence.
   */
  async evaluateCandidate(
    candidate: OpportunityCandidate,
    context: MarketStateContext
  ): Promise<AIDecision> {
    const symbol = candidate.symbol;
    const now = new Date().toISOString();

    try {
      // 1. Minimum Threshold Filter (Deterministic pre-check, Asset-Aware)
      const isCrypto = symbol.includes('/') || detectAssetClass(symbol) === 'CRYPTO';
      const minOppThreshold = this.config.minOpportunityScore ?? 50;
      const evalFloor = Math.min(this.config.candidateEvaluationFloor ?? 50, minOppThreshold);
      if (candidate.score < evalFloor) {
        return this.createSafePassDecision(
          symbol,
          `Opportunity score (${candidate.score}) is below evaluation floor (${evalFloor}).`
        );
      }

      const minLiq = isCrypto ? Math.min(this.config.minLiquidityUsd, 100) : this.config.minLiquidityUsd;
      if (candidate.snapshot.liquidityUsd < minLiq) {
        return this.createSafePassDecision(
          symbol,
          `Liquidity ($${(candidate.snapshot.liquidityUsd/1000).toFixed(0)}k) is below minimum threshold ($${(minLiq/1000).toFixed(0)}k).`
        );
      }

      if (candidate.snapshot.spreadBps > this.config.maxSpreadBps) {
        return this.createSafePassDecision(
          symbol,
          `Spread (${candidate.snapshot.spreadBps} bps) exceeds maximum allowed spread (${this.config.maxSpreadBps} bps).`
        );
      }

      // 2. Market Regime & Multi-Factor Scoring
      const assetRegime = classifyMarketRegime(candidate.snapshot);
      const multiFactor = evaluateMultiFactorOpportunity(candidate.snapshot, assetRegime, {
        minOpportunityThreshold: evalFloor,
        minRiskRewardRatio: this.config.minRiskRewardRatio ?? 1.25
      });

      // 3. Strategy Compatibility Check
      const compat = isStrategyCompatibleWithRegime(multiFactor.recommendedStrategy, assetRegime);
      if (!compat.compatible) {
        return this.createSafePassDecision(
          symbol,
          compat.reason || `Strategy ${multiFactor.recommendedStrategy} is incompatible with ${assetRegime.regime} market regime.`
        );
      }

      // 4. Multi-Agent Reasoning Synthesis
      const evidence = getMarketEvidence(`EVAL-${symbol}`, candidate.snapshot);
      const quantResult = runQuantAgent(candidate.snapshot, evidence);
      const intelResult = runIntelligenceAgent(evidence);
      
      const agentRuns: Record<string, any> = {
        quant: quantResult,
        intelligence: intelResult
      };

      const redTeamResult = runRedTeamAgent(
        symbol,
        quantResult.summary,
        candidate.snapshot,
        evidence,
        agentRuns
      );
      agentRuns['red_team'] = redTeamResult;

      const decisionResult = runDecisionAgent(
        symbol,
        candidate.snapshot,
        agentRuns,
        evidence
      );

      const hasFatalFlaw = redTeamResult.redTeamAttackDetails?.thesisStatus === 'DISPROVED';
      if (hasFatalFlaw) {
        return this.createSafePassDecision(symbol, 'Red Team identified fatal contradictory flaw in trade thesis.');
      }

      // 5. Direction & Action Resolution
      let action: AIDecisionAction = 'PASS';
      let confidence = Math.min(100, Math.max(0, decisionResult.confidence));
      let thesisText = decisionResult.rationale;
      let reasoningSummary = decisionResult.rationale;
      let riskAssessmentText = `Risk score ${decisionResult.riskScore}/100 with realized volatility at ${candidate.snapshot.realizedVolatility}% and ${multiFactor.estimatedRiskRewardRatio}R risk/reward ratio.`;

      const isHighRisk = this.config.riskProfile === 'HIGH_RISK';
      const minOpp = this.config.minOpportunityScore ?? (isHighRisk ? 50 : 60);
      const minConf = this.config.minConfidenceScore ?? (isHighRisk ? 55 : 65);
      const minRR = this.config.minRiskRewardRatio ?? (isHighRisk ? 1.25 : 2.0);

      if (
        (decisionResult.conclusion === 'BUY' || (decisionResult.conclusion === 'HOLD' && multiFactor.opportunityScore >= minOpp)) &&
        multiFactor.opportunityScore >= minOpp &&
        confidence >= minConf &&
        multiFactor.estimatedRiskRewardRatio >= minRR
      ) {
        action = 'BUY';
        thesisText = `Opportunity confirmed across quantitative momentum (${multiFactor.opportunityScore}/100) and multi-agent synthesis (${confidence}% confidence, ${multiFactor.estimatedRiskRewardRatio}R R:R).`;
        reasoningSummary = thesisText;
      } else if (decisionResult.conclusion === 'SELL') {
        action = 'SELL';
      } else if (decisionResult.conclusion === 'HOLD') {
        action = 'HOLD';
      }

      // 6. Optional Controlled LLM Synthesis Stage (if Featherless configured & candidate qualifies)
      if (action === 'BUY' && isFeatherlessConfigured()) {
        try {
          const llmSystemPrompt = `You are an institutional trading council synthesis model. Analyze the provided market evidence and quantitative scores.
Respond ONLY with a valid JSON object matching this schema:
{
  "decision": "BUY" | "HOLD" | "PASS",
  "confidence": number (0-100),
  "thesis": string,
  "invalidation": string,
  "risks": string[],
  "reasoningSummary": string
}`;

          const llmUserPrompt = JSON.stringify({
            symbol,
            price: candidate.snapshot.price,
            change24h: candidate.snapshot.change24h,
            rsi14: candidate.snapshot.rsi14,
            rvol: candidate.snapshot.relativeVolume,
            regime: assetRegime.regime,
            multiFactorScore: multiFactor.opportunityScore,
            estimatedRR: multiFactor.estimatedRiskRewardRatio,
            quantSummary: quantResult.summary,
            redTeamFindings: redTeamResult.redTeamAttackDetails?.vulnerabilitiesFound || []
          }, null, 2);

          const llmRes = await generateFeatherlessCompletion({
            prompt: llmUserPrompt,
            systemPrompt: llmSystemPrompt,
            model: getFeatherlessModel(),
            temperature: 0.2,
            maxTokens: 512
          });

          const rawLlm = llmRes.content.trim();
          let parsedLlm: any = null;
          try {
            parsedLlm = JSON.parse(rawLlm);
          } catch {
            const match = rawLlm.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) parsedLlm = JSON.parse(match[1]);
          }

          if (parsedLlm && typeof parsedLlm === 'object') {
            if (parsedLlm.decision === 'HOLD' || parsedLlm.decision === 'PASS') {
              action = parsedLlm.decision;
            }
            if (typeof parsedLlm.confidence === 'number' && parsedLlm.confidence >= 0 && parsedLlm.confidence <= 100) {
              confidence = Math.round((confidence + parsedLlm.confidence) / 2);
            }
            if (typeof parsedLlm.thesis === 'string' && parsedLlm.thesis.length > 10) {
              thesisText = parsedLlm.thesis;
            }
            if (typeof parsedLlm.reasoningSummary === 'string' && parsedLlm.reasoningSummary.length > 10) {
              reasoningSummary = parsedLlm.reasoningSummary;
            }
          }
        } catch (llmErr) {
          // Fail-closed: LLM failure never elevates a decision or creates an unvalidated trade
          console.warn(`[AI DECISION] LLM synthesis skipped due to error: ${llmErr}`);
        }
      }

      const price = candidate.snapshot.price;
      const stopPct = Math.max(0.015, Math.min(0.08, (multiFactor.factors.volatility * 0.12) / 100));
      const targetPct = stopPct * Math.max(1.0, multiFactor.estimatedRiskRewardRatio);
      const isLong = action === 'BUY';
      const invalidationPrice = Number((isLong ? price * (1 - stopPct) : price * (1 + stopPct)).toFixed(price < 1 ? 6 : 2));
      const targetPrice = Number((isLong ? price * (1 + targetPct) : price * (1 - targetPct)).toFixed(price < 1 ? 6 : 2));

      // 7. Mandatory Invalidation Conditions Generation
      const invalidationConditions = [
        `Spot price reaches invalidation stop at $${invalidationPrice} (-${(stopPct * 100).toFixed(1)}%)`,
        `Relative volume collapses below 0.8x historical average`,
        `Market regime shifts to RISK_OFF or persistent TRENDING_DOWN`,
        `Red Team discovers new contradictory thesis flaw`
      ];

      const targetConditions = [
        `Primary target price reached at $${targetPrice} (+${(targetPct * 100).toFixed(1)}%)`,
        `RSI-14 reaches extreme overbought condition (> 78)`
      ];

      const entryConditions = [
        `Spot price at $${candidate.snapshot.price}`,
        `Multi-factor opportunity score >= ${this.config.minOpportunityScore} (Assessed: ${multiFactor.opportunityScore})`,
        `Risk/reward ratio >= ${minRR}R (Assessed: ${multiFactor.estimatedRiskRewardRatio}R)`,
        `Market regime compatibility verified (${assetRegime.regime})`
      ];

      // 8. Quantitative OCC Option Contract Selection (Phase 8.27)
      let optionDetails: OptionDetails | undefined;
      if (candidate.assetClass === 'EQUITY' && (action === 'BUY' || action === 'SELL')) {
        try {
          const selection = await optionContractSelector.selectContract({
            underlyingSymbol: symbol,
            underlyingPrice: candidate.snapshot.price,
            directionalBias: action === 'BUY' ? 'BUY' : 'SELL',
            strategyName: multiFactor.recommendedStrategy,
            opportunityScore: multiFactor.opportunityScore,
            realizedVolatility: candidate.snapshot.realizedVolatility
          });

          if (selection) {
            optionDetails = {
              underlyingSymbol: symbol,
              contractSymbol: selection.selectedContract.symbol,
              contractType: selection.selectedContract.type,
              strikePrice: selection.selectedContract.strikePrice,
              expirationDate: selection.selectedContract.expirationDate,
              dte: selection.selectedContract.dte,
              impliedVolatility: selection.selectedContract.impliedVolatility,
              delta: selection.selectedContract.delta,
              bid: selection.selectedContract.bid,
              ask: selection.selectedContract.ask,
              midPrice: selection.selectedContract.mid,
              openInterest: selection.selectedContract.openInterest,
              spread: selection.selectedContract.spread,
              rationale: selection.selectionRationale
            };
          }
        } catch {
          // Gracefully continue without breaking equity evaluation loop
        }
      }

      const rawDecision = {
        action,
        instrument: symbol,
        assetClass: candidate.assetClass,
        instrumentType: candidate.assetClass === 'CRYPTO' ? 'CRYPTO' : 'EQUITY',
        strategy: multiFactor.recommendedStrategy,
        confidence,
        opportunityScore: multiFactor.opportunityScore,
        marketRegime: assetRegime.regime,
        factorBreakdown: multiFactor.factors,
        riskRewardRatio: multiFactor.estimatedRiskRewardRatio,
        targetPrice,
        invalidationPrice,
        thesis: thesisText,
        catalyst: 'Quantitative momentum breakout and volume acceleration',
        expectedHorizon: '1-3 trading sessions',
        expectedMove: `+${(multiFactor.estimatedRiskRewardRatio * 2.5).toFixed(1)}% expected move within horizon`,
        entryConditions,
        invalidationConditions,
        targetConditions,
        riskAssessment: riskAssessmentText,
        reasoningSummary,
        evidence: evidence.map(e => ({
          source: e.source?.name || e.adapterSource || 'alpaca-data',
          timestamp: e.observedAt || new Date().toISOString(),
          claim: e.title || e.description || '',
          confidence: e.reliability === 'PRIMARY' ? 95 : 80
        })),
        optionDetails,
        suggestedPositionSizeUsd: this.config.maxPositionSizeUsd,
        generatedAt: now
      };

      // 9. Strict Schema Validation
      return validateAIDecisionSchema(rawDecision, { minRiskRewardRatio: minRR });
    } catch (err: any) {
      // Model/Processing Failure: Fail-safe to PASS
      return this.createSafePassDecision(symbol, `Error during AI evaluation: ${err.message}`);
    }
  }
}

export const aiDecisionEngine = new AIDecisionEngine();
