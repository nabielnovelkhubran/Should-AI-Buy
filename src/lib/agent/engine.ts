import {
  AutonomousCycleResult,
  CandidateEvaluationResult,
  ScoreBandTelemetry,
  RotationCandidateMetadata,
  AIDecision,
  AgentStrategyConfig
} from './types';
import { MarketStateBuilder, marketStateBuilder } from './state';
import { AIDecisionEngine, aiDecisionEngine } from './decision';
import { TelemetryJournal, telemetryJournal } from './journal';
import { getAgentConfig } from './config';
import { candidateDiscoveryPipeline } from './pipeline';
import { calculateStrategyPositionSize } from './sizing';
import { TradeLedger, tradeLedger } from './analytics/trade-ledger';
import { verifyAccountHealth } from './analytics/account-health';
import { PaperTradingService, paperTradingService } from '../trading';
import { PositionMonitoringService, positionMonitoringService } from '../monitoring';
import { PaperPortfolioService, paperPortfolioService } from '../portfolio';
import { evaluateRiskGate } from '../risk-gate';
import { getMarketEvidence } from '../market-data';
import { detectAssetClass } from '../scanner/universe';
import { PaperOrderResult } from '../types';
import { getTradingEnvironmentConfig } from '../environment';
import { durableSessionJournal } from './analytics/durable-journal';
import { sessionEvidenceManager } from './analytics/session-evidence';
import { FrozenDecisionSnapshot } from './analytics/durable-types';
import { RejectionStage } from './analytics/types';

// ---------------------------------------------------------------------------
// Phase 8.8: Autonomous Trading Engine & Alpha Validation Layer
// INVARIANT: 18-step autonomous trading cycle.
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// INVARIANT: The AI proposes decisions; deterministic risk controls approve.
// INVARIANT: All trades, rejections, and exits are recorded in TradeLedger.
// ---------------------------------------------------------------------------

export interface RunCycleOptions {
  universe?: string[];
  scanLimit?: number;
  executeOrders?: boolean;
  executeExits?: boolean;
}

export class AutonomousTradingEngine {
  private config: AgentStrategyConfig;
  private stateBuilder: MarketStateBuilder;
  private decisionEngine: AIDecisionEngine;
  private journal: TelemetryJournal;
  private tradeLedger: TradeLedger;
  private tradingService: PaperTradingService;
  private portfolioService: PaperPortfolioService;
  private monitoringService: PositionMonitoringService;

  private isRunning: boolean = false;
  private circuitBreakerTripped: boolean = false;
  private consecutiveFailures: number = 0;
    private circuitBreakerReason: string | null = null;
  private get cycleHistory(): AutonomousCycleResult[] {
    const g = globalThis as unknown as { __AUTONOMOUS_CYCLE_HISTORY__?: AutonomousCycleResult[] };
    if (!g.__AUTONOMOUS_CYCLE_HISTORY__) g.__AUTONOMOUS_CYCLE_HISTORY__ = [];
    return g.__AUTONOMOUS_CYCLE_HISTORY__;
  }
  private set cycleHistory(val: AutonomousCycleResult[]) {
    const g = globalThis as unknown as { __AUTONOMOUS_CYCLE_HISTORY__?: AutonomousCycleResult[] };
    g.__AUTONOMOUS_CYCLE_HISTORY__ = val;
  }

  private recordCycleResult(result: AutonomousCycleResult): AutonomousCycleResult {
    this.cycleHistory.push(result);
    if (this.cycleHistory.length > 100) {
      this.cycleHistory = this.cycleHistory.slice(-100);
    }
    return result;
  }

  public getCycleHistory(limit: number = 20): AutonomousCycleResult[] {
    return this.cycleHistory.slice(-limit);
  }

  public getLatestCycle(): AutonomousCycleResult | null {
    return this.cycleHistory.length > 0 ? this.cycleHistory[this.cycleHistory.length - 1] : null;
  }

  constructor(options?: {
    config?: AgentStrategyConfig;
    stateBuilder?: MarketStateBuilder;
    decisionEngine?: AIDecisionEngine;
    journal?: TelemetryJournal;
    tradeLedger?: TradeLedger;
    tradingService?: PaperTradingService;
    portfolioService?: PaperPortfolioService;
    monitoringService?: PositionMonitoringService;
  }) {
    this.config = options?.config ?? getAgentConfig();
    this.stateBuilder = options?.stateBuilder ?? marketStateBuilder;
    this.decisionEngine = options?.decisionEngine ?? aiDecisionEngine;
    this.journal = options?.journal ?? telemetryJournal;
    this.tradeLedger = options?.tradeLedger ?? tradeLedger;
    this.tradingService = options?.tradingService ?? paperTradingService;
    this.portfolioService = options?.portfolioService ?? paperPortfolioService;
    this.monitoringService = options?.monitoringService ?? positionMonitoringService;
  }

  public getTradeLedger(): TradeLedger {
    return this.tradeLedger;
  }

  public getJournal(): TelemetryJournal {
    return this.journal;
  }

  public getCircuitBreakerStatus(): { tripped: boolean; reason: string | null } {
    return {
      tripped: this.circuitBreakerTripped,
      reason: this.circuitBreakerReason
    };
  }

  public tripCircuitBreaker(reason: string): void {
    this.circuitBreakerTripped = true;
    this.circuitBreakerReason = reason;
    this.journal.record('SYSTEM', 'CIRCUIT_BREAKER_TRIPPED', `Emergency Circuit Breaker TRIPPED: ${reason}`);
  }

  public resetCircuitBreaker(): void {
    this.circuitBreakerTripped = false;
    this.circuitBreakerReason = null;
    this.consecutiveFailures = 0;
    this.journal.record('SYSTEM', 'CIRCUIT_BREAKER_TRIPPED', 'Circuit Breaker RESET by operator.');
  }

  /**
   * Executes the full 18-step autonomous trading cycle.
   */
  async runCycle(options?: RunCycleOptions): Promise<AutonomousCycleResult> {
    const cycleId = `CYCLE-${Date.now().toString(36).toUpperCase()}`;
    const startTime = Date.now();
    const isoStart = new Date(startTime).toISOString();

    // 1. Concurrency Protection Lock
    if (this.isRunning) {
      return {
        cycleId,
        startedAt: isoStart,
        completedAt: isoStart,
        durationMs: 0,
        environment: getTradingEnvironmentConfig().environment,
        isMarketOpen: true,
        candidatesScanned: 0,
        candidatesEvaluated: 0,
        evaluations: [],
        ordersSubmitted: [],
        positionsMonitoredCount: 0,
        protectiveExitsExecutedCount: 0,
        circuitBreakerActive: this.circuitBreakerTripped,
        eventsCount: 0,
        status: 'SKIPPED',
        error: 'AUTONOMOUS_CYCLE_ALREADY_RUNNING'
      };
    }

    // 2. Circuit Breaker Emergency Check
    if (this.circuitBreakerTripped) {
      this.journal.record(
        cycleId,
        'CIRCUIT_BREAKER_TRIPPED',
        `Autonomous cycle skipped: Circuit breaker is active (${this.circuitBreakerReason}).`
      );

      return {
        cycleId,
        startedAt: isoStart,
        completedAt: isoStart,
        durationMs: 0,
        environment: getTradingEnvironmentConfig().environment,
        isMarketOpen: true,
        candidatesScanned: 0,
        candidatesEvaluated: 0,
        evaluations: [],
        ordersSubmitted: [],
        positionsMonitoredCount: 0,
        protectiveExitsExecutedCount: 0,
        circuitBreakerActive: true,
        eventsCount: 1,
        status: 'SKIPPED',
        error: `CIRCUIT_BREAKER_ACTIVE: ${this.circuitBreakerReason}`
      };
    }

    this.isRunning = true;
    const scanLimit = options?.scanLimit ?? 5;
    const executeOrders = options?.executeOrders ?? true;
    const executeExits = options?.executeExits ?? true;

    const evaluations: CandidateEvaluationResult[] = [];
    const ordersSubmitted: PaperOrderResult[] = [];
    let positionsMonitoredCount = 0;
    let protectiveExitsExecutedCount = 0;

    try {
      this.journal.record(cycleId, 'CYCLE_STARTED', `Autonomous trading cycle ${cycleId} started.`);
      durableSessionJournal.recordEvent('CYCLE_STARTED', { cycleId }, { cycleId });
      durableSessionJournal.updateHeartbeat({ workerStatus: 'RUNNING', lastCycleStarted: isoStart, lastHeartbeat: isoStart });

      // 3. Verify Paper Trading Environment
      const envConfig = getTradingEnvironmentConfig();
      this.journal.record(
        cycleId,
        'ENVIRONMENT_VERIFIED',
        `Environment confirmed: ${envConfig.environment.toUpperCase()} (Paper trading only).`,
        { details: { isCompetition: envConfig.isCompetition, baseUrl: envConfig.baseUrl } }
      );

      // 4. Build Market State & Check Data Freshness
      const marketState = await this.stateBuilder.buildMarketState(cycleId);
      this.journal.record(
        cycleId,
        'MARKET_STATE_REFRESHED',
        `Market state refreshed. Available cash: $${marketState.availableCashUsd.toFixed(2)}, Active positions: ${marketState.activePositions.length}.`,
        { details: { equity: marketState.totalEquityUsd, cash: marketState.availableCashUsd, isMarketOpen: marketState.isMarketOpen } }
      );

      // 4b. Account Health Verification (Phase 8.8H)
      const healthReport = verifyAccountHealth({
        accountStatus: marketState.account?.status,
        equity: marketState.totalEquityUsd,
        cash: marketState.availableCashUsd,
        buyingPower: marketState.account?.buyingPower,
        openPositionCount: marketState.activePositions.length,
        circuitBreakerActive: this.circuitBreakerTripped,
        isPaper: marketState.account?.isPaper !== false
      });

      this.journal.record(
        cycleId,
        'ACCOUNT_HEALTH_CHECKED',
        healthReport.healthy
          ? 'Account health check passed.'
          : `Account health warnings/blockers: ${[...healthReport.blockers, ...healthReport.warnings].join('; ')}`,
        { details: healthReport }
      );

      if (!healthReport.healthy) {
        // Safe fail-closed: block new orders, but allow protective exits to reduce risk
        let monitoredCount = 0;
        let exitsCount = 0;
        if (executeExits && !this.circuitBreakerTripped) {
          try {
            const monitoringResult = await this.monitoringService.runMonitoringCycle({
              executeExits: true
            });
            monitoredCount = monitoringResult.monitoredPositions.length;
            exitsCount = monitoringResult.executedActions.length;
          } catch {
            // Isolation: monitoring failure does not throw
          }
        }

        return {
          cycleId,
          startedAt: isoStart,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          environment: envConfig.environment,
          isMarketOpen: marketState.isMarketOpen,
          candidatesScanned: 0,
          candidatesEvaluated: 0,
          evaluations: [],
          ordersSubmitted: [],
          positionsMonitoredCount: monitoredCount,
          protectiveExitsExecutedCount: exitsCount,
          circuitBreakerActive: this.circuitBreakerTripped,
          eventsCount: this.journal.getEventsByCycle(cycleId).length,
          rejectedCandidatesCount: 0,
          accountHealthy: false,
          status: 'SKIPPED',
          error: `ACCOUNT_HEALTH_BLOCKED: ${healthReport.blockers.join('; ')}`
        };
      }

      // 5. Multi-Stage Pipeline: Discovery, Regime & Multi-Factor Scoring
      const pipelineResult = await candidateDiscoveryPipeline.runPipeline({
        universe: options?.universe ? [...options.universe] : undefined,
        isMarketOpen: marketState.isMarketOpen,
        limit: scanLimit,
        config: this.config
      });

      this.journal.record(
        cycleId,
        'REGIME_CLASSIFIED',
        `Market regime classified: ${pipelineResult.marketRegime.regime} (${pipelineResult.marketRegime.confidence}% confidence, Trend: ${pipelineResult.marketRegime.trendDirection}).`,
        { details: pipelineResult.marketRegime }
      );

      this.journal.record(
        cycleId,
        'CANDIDATE_DISCOVERED',
        `Pipeline filtered universe: ${pipelineResult.eligibleCandidates.length} eligible target(s) passed quantitative screening.`,
        { details: { eligible: pipelineResult.eligibleCandidates.map(c => c.symbol), filteredCount: pipelineResult.filteredOutCandidates.length } }
      );

      // Record filtered-out pipeline candidates in trade ledger (Phase 8.8F)
      for (const filtered of pipelineResult.filteredOutCandidates) {
        let stage: RejectionStage = 'SCORE_FILTER';
        if (filtered.stage === 1) {
          stage = 'SESSION_FILTER';
        } else if (filtered.stage === 2) {
          stage = (filtered.reason && filtered.reason.toLowerCase().includes('spread')) ? 'SPREAD_FILTER' : 'LIQUIDITY_FILTER';
        } else if (filtered.stage === 3) {
          stage = 'REGIME_FILTER';
        } else if (filtered.stage === 4) {
          stage = 'SCORE_FILTER';
        }

        this.tradeLedger.recordRejection({
          candidateId: `CAND-${cycleId}-${filtered.symbol}`,
          cycleId,
          symbol: filtered.symbol,
          assetClass: detectAssetClass(filtered.symbol),
          marketRegime: pipelineResult.marketRegime.regime,
          rejectionStage: stage,
          rejectionReason: filtered.reason
        });
      }

      // 6. Candidate Evaluation Loop (AI Decision -> Sizing -> Risk Gate -> Paper Execution)
      this.decisionEngine.updateConfig(this.config);
      for (const candidate of pipelineResult.eligibleCandidates) {
        const symbol = candidate.symbol;

        this.journal.record(
          cycleId,
          'FACTORS_SCORED',
          `Candidate ${symbol} scored at ${candidate.multiFactorEvaluation.opportunityScore}/100 with ${candidate.multiFactorEvaluation.estimatedRiskRewardRatio}R risk/reward.`,
          { symbol, details: candidate.multiFactorEvaluation.factors }
        );

        // Check if we already hold max positions
        if (marketState.activePositions.length >= this.config.maxOpenPositions) {
          this.tradeLedger.recordRejection({
            candidateId: `CAND-${cycleId}-${symbol}`,
            cycleId,
            symbol,
            assetClass: candidate.assetClass,
            strategy: candidate.multiFactorEvaluation.recommendedStrategy,
            marketRegime: pipelineResult.marketRegime.regime,
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            rejectionStage: 'MAX_POSITIONS',
            rejectionReason: `Max open positions reached (${this.config.maxOpenPositions})`
          });
          this.journal.record(cycleId, 'RISK_REJECTED', `Skipping candidate ${symbol}: Max open positions reached (${this.config.maxOpenPositions}).`, { symbol });
          this.journal.record(cycleId, 'CANDIDATE_REJECTED', `Candidate ${symbol} rejected at MAX_POSITIONS.`, { symbol });
          break;
        }

        // Check if we already hold this exact symbol
        const alreadyHeld = marketState.activePositions.some(p => p.symbol === symbol);
        if (alreadyHeld) {
          this.tradeLedger.recordRejection({
            candidateId: `CAND-${cycleId}-${symbol}`,
            cycleId,
            symbol,
            assetClass: candidate.assetClass,
            strategy: candidate.multiFactorEvaluation.recommendedStrategy,
            marketRegime: pipelineResult.marketRegime.regime,
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            rejectionStage: 'ALREADY_HELD',
            rejectionReason: 'Position already open in paper portfolio'
          });
          this.journal.record(cycleId, 'RISK_REJECTED', `Skipping candidate ${symbol}: Position already open in paper portfolio.`, { symbol });
          this.journal.record(cycleId, 'CANDIDATE_REJECTED', `Candidate ${symbol} rejected at ALREADY_HELD.`, { symbol });
          continue;
        }

        // AI Decision Engine Evaluation
        this.journal.record(cycleId, 'AI_ANALYSIS_STARTED', `Evaluating candidate ${symbol} with multi-agent Council...`, { symbol });
        const decision: AIDecision = await this.decisionEngine.evaluateCandidate(
          {
            symbol: candidate.symbol,
            assetClass: candidate.assetClass,
            score: candidate.multiFactorEvaluation.opportunityScore,
            rank: candidate.rank,
            snapshot: candidate.snapshot,
            signals: {
              momentum: candidate.snapshot.momentumScore,
              rsi: candidate.snapshot.rsi14,
              rvol: candidate.snapshot.relativeVolume,
              volumeAcceleration: candidate.snapshot.volumeAcceleration,
              realizedVolatility: candidate.snapshot.realizedVolatility,
              liquidityUsd: candidate.snapshot.liquidityUsd,
              opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
              riskScore: 30
            },
            discoveredAt: candidate.multiFactorEvaluation.evaluatedAt
          },
          marketState
        );

        this.journal.record(
          cycleId,
          'AI_DECISION_PRODUCED',
          `AI decision for ${symbol}: ${decision.action} (Confidence: ${decision.confidence}%, R:R: ${decision.riskRewardRatio}R).`,
          { symbol, details: { action: decision.action, confidence: decision.confidence, thesis: decision.thesis } }
        );

        if (decision.action !== 'BUY') {
          this.tradeLedger.recordRejection({
            candidateId: `CAND-${cycleId}-${symbol}`,
            cycleId,
            symbol,
            assetClass: candidate.assetClass,
            strategy: decision.strategy,
            marketRegime: pipelineResult.marketRegime.regime,
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            aiConfidence: decision.confidence,
            estimatedRiskReward: decision.riskRewardRatio,
            rejectionStage: decision.action === 'HOLD' ? 'AI_HOLD' : 'AI_PASS',
            rejectionReason: decision.reasoningSummary || `AI produced non-buy action: ${decision.action}`
          });
          this.journal.record(cycleId, 'CANDIDATE_REJECTED', `Candidate ${symbol} rejected at AI stage (${decision.action}).`, { symbol });

          evaluations.push({
            candidateSymbol: symbol,
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            rank: candidate.rank,
            aiDecision: decision,
            schemaValid: true,
            riskGatePassed: false,
            riskGateViolations: [`AI produced non-buy action: ${decision.action}`]
          });
          continue;
        }

        this.journal.record(
          cycleId,
          'THESIS_FORMULATED',
          `Trade thesis formulated for ${symbol}: ${decision.thesis} (Invalidation: ${decision.invalidationConditions[0]}).`,
          { symbol, details: { entry: decision.entryConditions, invalidation: decision.invalidationConditions, targets: decision.targetConditions } }
        );

        // 7. Strategy-Aware Deterministic Position Sizing
        const sizingResult = calculateStrategyPositionSize({
          symbol,
          assetClass: candidate.assetClass,
          currentPrice: candidate.snapshot.price,
          confidenceScore: decision.confidence,
          opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
          accountEquityUsd: marketState.totalEquityUsd,
          availableCashUsd: marketState.availableCashUsd,
          currentGrossExposureUsd: marketState.grossExposureUsd,
          snapshot: candidate.snapshot,
          config: this.config
        });

        this.journal.record(
          cycleId,
          'POSITION_SIZED',
          `Position sized for ${symbol}: ${sizingResult.calculatedQuantity} units ($${sizingResult.recommendedPositionSizeUsd.toFixed(2)} / ${sizingResult.effectiveAllocationPct}% equity).`,
          { symbol, details: sizingResult }
        );

        if (!sizingResult.allowed || sizingResult.calculatedQuantity <= 0) {
          this.tradeLedger.recordRejection({
            candidateId: `CAND-${cycleId}-${symbol}`,
            cycleId,
            symbol,
            assetClass: candidate.assetClass,
            strategy: decision.strategy,
            marketRegime: pipelineResult.marketRegime.regime,
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            aiConfidence: decision.confidence,
            estimatedRiskReward: decision.riskRewardRatio,
            rejectionStage: 'POSITION_SIZING',
            rejectionReason: sizingResult.violations.join('; ')
          });
          this.journal.record(
            cycleId,
            'RISK_REJECTED',
            `Position sizing rejected ${symbol}: ${sizingResult.violations.join('; ')}`,
            { symbol, details: { violations: sizingResult.violations } }
          );
          this.journal.record(cycleId, 'CANDIDATE_REJECTED', `Candidate ${symbol} rejected at POSITION_SIZING.`, { symbol });

          evaluations.push({
            candidateSymbol: symbol,
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            rank: candidate.rank,
            aiDecision: decision,
            schemaValid: true,
            riskGatePassed: false,
            riskGateViolations: sizingResult.violations
          });
          continue;
        }

        // 8. Authoritative Deterministic Risk Gate Check
        const evidence = getMarketEvidence(`EVT-CYCLE-${symbol}`, candidate.snapshot);
        const riskGateResult = evaluateRiskGate({
          symbol,
          opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
          riskScore: 30,
          liquidityUsd: candidate.snapshot.liquidityUsd,
          positionValueUsd: sizingResult.recommendedPositionSizeUsd,
          availableCash: marketState.availableCashUsd,
          hasRedTeamFatalFlaw: false,
          evidence,
          riskProfile: this.config.riskProfile,
          minOpportunityScoreOverride: this.config.minOpportunityScore,
          minLiquidityUsdOverride: this.config.minLiquidityUsd
        });

        if (!riskGateResult.passed) {
          this.tradeLedger.recordRejection({
            candidateId: `CAND-${cycleId}-${symbol}`,
            cycleId,
            symbol,
            assetClass: candidate.assetClass,
            strategy: decision.strategy,
            marketRegime: pipelineResult.marketRegime.regime,
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            aiConfidence: decision.confidence,
            estimatedRiskReward: decision.riskRewardRatio,
            rejectionStage: 'RISK_GATE',
            rejectionReason: riskGateResult.violations.join('; ')
          });
          this.journal.record(
            cycleId,
            'RISK_REJECTED',
            `Risk Gate REJECTED candidate ${symbol}: ${riskGateResult.violations.join('; ')}`,
            { symbol, details: { violations: riskGateResult.violations } }
          );
          this.journal.record(cycleId, 'CANDIDATE_REJECTED', `Candidate ${symbol} rejected at RISK_GATE.`, { symbol });

          evaluations.push({
            candidateSymbol: symbol,
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            rank: candidate.rank,
            aiDecision: decision,
            schemaValid: true,
            riskGatePassed: false,
            riskGateViolations: riskGateResult.violations
          });
          continue;
        }

        this.journal.record(
          cycleId,
          'RISK_APPROVED',
          `Risk Gate APPROVED candidate ${symbol}. Authorized for paper execution.`,
          { symbol }
        );

        // 9. Submit Paper Order through Alpaca Adapter
        let orderResult: PaperOrderResult | undefined;
        if (executeOrders && !this.circuitBreakerTripped) {
          orderResult = await this.tradingService.submitPaperOrder({
            investigationId: `AUTO-${symbol}-${Date.now().toString(36).toUpperCase()}`,
            symbol,
            assetClass: candidate.assetClass,
            side: 'buy',
            qty: sizingResult.calculatedQuantity,
            price: candidate.snapshot.price,
            orderType: 'market',
            timeInForce: candidate.assetClass === 'CRYPTO' ? 'gtc' : 'day',
            riskGatePassed: true,
            recommendation: 'BUY',
            opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
            candidateRank: candidate.rank
          });

          if (orderResult.status === 'SUBMITTED' || orderResult.status === 'FILLED') {
            ordersSubmitted.push(orderResult);
            this.journal.record(
              cycleId,
              'ORDER_SUBMITTED',
              `Paper order submitted for ${symbol}: ${orderResult.side} ${orderResult.qty} @ ~$${candidate.snapshot.price}.`,
              { symbol, details: { orderId: orderResult.orderId, status: orderResult.status } }
            );

            // Record trade entry in ledger (Phase 8.8A)
            const tradeId = `TRADE-${Date.now().toString(36).toUpperCase()}-${symbol}`;
            const frozenSnapshot: FrozenDecisionSnapshot = {
              symbol,
              assetClass: candidate.assetClass,
              strategy: decision.strategy,
              regime: pipelineResult.marketRegime.regime,
              opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
              confidence: decision.confidence,
              factorScores: candidate.multiFactorEvaluation.factors,
              estimatedRiskReward: decision.riskRewardRatio,
              invalidationPrice: decision.invalidationPrice ?? Number((candidate.snapshot.price * 0.95).toFixed(2)),
              targetPrice: decision.targetPrice ?? Number((candidate.snapshot.price * 1.1).toFixed(2)),
              riskDecision: 'PASS',
              requestedQuantity: sizingResult.calculatedQuantity,
              decisionTimestamp: isoStart
            };
            durableSessionJournal.recordFrozenDecision(tradeId, frozenSnapshot);
            durableSessionJournal.recordEvent('ORDER_INTENT_CREATED', { tradeId, symbol, qty: sizingResult.calculatedQuantity, price: candidate.snapshot.price }, { cycleId, tradeId, symbol });
            durableSessionJournal.recordEvent('ORDER_SUBMITTED', { tradeId, orderId: orderResult.orderId, status: orderResult.status }, { cycleId, tradeId, orderId: orderResult.orderId, symbol });
            const tradeRecord = this.tradeLedger.recordEntryIntent({
              tradeId,
              candidateId: `CAND-${cycleId}-${symbol}`,
              decisionId: `DEC-${cycleId}-${symbol}`,
              symbol,
              assetClass: candidate.assetClass,
              instrumentType: candidate.assetClass === 'CRYPTO' ? 'CRYPTO' : 'EQUITY',
              strategy: decision.strategy,
              marketRegime: pipelineResult.marketRegime.regime,
              opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
              aiConfidence: decision.confidence,
              estimatedRiskReward: decision.riskRewardRatio,
              factorScores: candidate.multiFactorEvaluation.factors,
              requestedQuantity: sizingResult.calculatedQuantity,
              approvedQuantity: sizingResult.calculatedQuantity,
              entryPrice: candidate.snapshot.price,
              invalidationPrice: decision.invalidationPrice ?? Number((candidate.snapshot.price * 0.95).toFixed(2)),
              targetPrice: decision.targetPrice ?? Number((candidate.snapshot.price * 1.1).toFixed(2)),
              portfolioEquityAtEntry: marketState.totalEquityUsd,
              grossExposureAtEntry: marketState.grossExposureUsd,
              orderId: orderResult.orderId,
              clientOrderId: `CLIENT-${cycleId}-${symbol}`
            });

            this.journal.record(
              cycleId,
              'TRADE_ENTRY_RECORDED',
              `Trade entry recorded in ledger for ${symbol}: ${tradeId} ($${sizingResult.recommendedPositionSizeUsd.toFixed(2)}).`,
              { symbol, details: tradeRecord }
            );

            if (orderResult.status === 'FILLED' && orderResult.filledAvgPrice) {
              durableSessionJournal.recordEvent('ORDER_FILLED', { tradeId, orderId: orderResult.orderId, filledAvgPrice: orderResult.filledAvgPrice, filledQty: orderResult.qty || sizingResult.calculatedQuantity }, { cycleId, tradeId, orderId: orderResult.orderId, symbol });
              this.tradeLedger.recordFill({
                tradeId,
                orderId: orderResult.orderId,
                actualFillPrice: orderResult.filledAvgPrice,
                actualFilledQuantity: orderResult.qty || sizingResult.calculatedQuantity
              });
            }
          } else {
            this.journal.record(
              cycleId,
              'ORDER_REJECTED',
              `Paper order rejected by broker for ${symbol}: ${orderResult.error}`,
              { symbol, details: { error: orderResult.error } }
            );
          }
        }

        evaluations.push({
          candidateSymbol: symbol,
          opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
          rank: candidate.rank,
          aiDecision: decision,
          schemaValid: true,
          riskGatePassed: true,
          riskGateViolations: [],
          orderResult
        });
      }

      // 10. Position Monitoring & Protective Invalidation Exits
      const monitoringResult = await this.monitoringService.runMonitoringCycle({
        executeExits: executeExits && !this.circuitBreakerTripped
      });

      positionsMonitoredCount = monitoringResult.monitoredPositions.length;
      protectiveExitsExecutedCount = monitoringResult.executedActions.length;

      for (const exit of monitoringResult.executedActions) {
        this.journal.record(
          cycleId,
          'PROTECTIVE_EXIT_EXECUTED',
          `Protective exit executed for ${exit.symbol}: ${exit.proposedSide} ${exit.quantity} (${exit.invalidationReason?.message || exit.status}).`,
          { symbol: exit.symbol, details: exit }
        );

        // Record exit in trade ledger (Phase 8.8A)
        const openTrade = this.tradeLedger.getOpenTrades().find(t => t.symbol === exit.symbol.toUpperCase());
        if (openTrade) {
          const exitRecord = this.tradeLedger.recordExit({
            tradeId: openTrade.tradeId,
            exitPrice: exit.executionResult?.filledAvgPrice || openTrade.entryPrice,
            exitFilledQuantity: exit.quantity,
            exitReason: exit.invalidationReason?.category === 'PRICE_DRAWDOWN' ? 'DRAWDOWN_LIMIT' : 'THESIS_INVALIDATED',
            portfolioEquityAtExit: marketState.totalEquityUsd,
            grossExposureAtExit: marketState.grossExposureUsd
          });
          durableSessionJournal.recordEvent('PROTECTIVE_EXIT_FILLED', { symbol: exit.symbol, quantity: exit.quantity, exitPrice: exit.executionResult?.filledAvgPrice || openTrade?.entryPrice, reason: exit.invalidationReason?.category }, { cycleId, symbol: exit.symbol });
          this.journal.record(
            cycleId,
            'TRADE_EXIT_RECORDED',
            `Trade exit recorded in ledger for ${exit.symbol}: PnL: $${exitRecord?.realizedPnL?.toFixed(2) ?? '0.00'} (${exitRecord?.outcome}).`,
            { symbol: exit.symbol, details: exitRecord ?? undefined }
          );
        }
      }

      this.consecutiveFailures = 0; // Reset consecutive failures on successful cycle
      const durationMs = Date.now() - startTime;
      const isoEnd = new Date().toISOString();

      durableSessionJournal.recordEvent('CYCLE_COMPLETED', { cycleId, durationMs, candidatesScanned: pipelineResult.totalScanned, ordersSubmittedCount: ordersSubmitted.length, positionsMonitoredCount }, { cycleId });
      durableSessionJournal.updateHeartbeat({ lastCycleCompleted: isoEnd, lastSuccessfulCycle: isoEnd, consecutiveFailures: 0 });
      sessionEvidenceManager.recordCycle(pipelineResult.totalScanned, ordersSubmitted.length);
      this.journal.record(
        cycleId,
        'CYCLE_COMPLETED',
        `Autonomous cycle ${cycleId} completed successfully in ${durationMs}ms.`
      );

      const cycleRejections = this.tradeLedger.getRejectedCandidates().filter(r => r.cycleId === cycleId);
      const rejectionDistribution = {
        liquidity: cycleRejections.filter(r => r.rejectionStage === 'LIQUIDITY_FILTER').length,
        spread: cycleRejections.filter(r => r.rejectionStage === 'SPREAD_FILTER').length,
        opportunityScore: cycleRejections.filter(r => r.rejectionStage === 'SCORE_FILTER').length,
        riskReward: 0,
        quantHold: cycleRejections.filter(r => r.rejectionStage === 'AI_HOLD').length,
        redTeamBlock: cycleRejections.filter(r => r.rejectionStage === 'AI_PASS').length,
        riskGate: cycleRejections.filter(r => r.rejectionStage === 'RISK_GATE').length,
        positionSizing: cycleRejections.filter(r => r.rejectionStage === 'POSITION_SIZING').length,
        maxPositions: cycleRejections.filter(r => r.rejectionStage === 'MAX_POSITIONS').length,
        alreadyHeld: cycleRejections.filter(r => r.rejectionStage === 'ALREADY_HELD').length,
        other: cycleRejections.filter(r => r.rejectionStage === 'SESSION_FILTER' || r.rejectionStage === 'REGIME_FILTER').length
      };

      const councilBuyCount = evaluations.filter(e => e.aiDecision?.action === 'BUY').length;
      const riskGatePassedCount = evaluations.filter(e => e.riskGatePassed).length;
      const filledOrdersCount = ordersSubmitted.filter(o => o.status === 'FILLED').length;

      const executionFunnel = {
        candidatesScanned: pipelineResult.totalScanned,
        passedLiquidity: Math.max(0, pipelineResult.totalScanned - rejectionDistribution.liquidity),
        passedSpread: Math.max(0, pipelineResult.totalScanned - rejectionDistribution.liquidity - rejectionDistribution.spread),
        scoredAboveThreshold: pipelineResult.eligibleCandidates.length,
        councilEvaluated: evaluations.length,
        councilBuy: councilBuyCount,
        riskGatePassed: riskGatePassedCount,
        orderIntentsCreated: ordersSubmitted.length,
        brokerSubmitted: ordersSubmitted.length,
        brokerFilled: filledOrdersCount,
        positionsMonitored: positionsMonitoredCount
      };

      // Score-Band Distribution Telemetry (Phase 8.22)
      const allFiltered = pipelineResult.filteredOutCandidates;
      const below50Count = allFiltered.filter(f => typeof f.opportunityScore === 'number' && f.opportunityScore < 50).length;
      const watch50to54Count = allFiltered.filter(f => typeof f.opportunityScore === 'number' && f.opportunityScore >= 50 && f.opportunityScore < 55).length;
      const evaluated55to59Count = pipelineResult.eligibleCandidates.filter(c => c.multiFactorEvaluation.opportunityScore >= 55 && c.multiFactorEvaluation.opportunityScore < 60).length;
      const highConviction60PlusCount = pipelineResult.eligibleCandidates.filter(c => c.multiFactorEvaluation.opportunityScore >= 60).length;

      // Calculate Average Opportunity Score across all scored candidates in the universe
      const allScoredValues = [
        ...pipelineResult.eligibleCandidates.map(c => c.multiFactorEvaluation.opportunityScore),
        ...allFiltered.filter(f => typeof f.opportunityScore === 'number').map(f => f.opportunityScore as number)
      ];
      const avgOppScore = allScoredValues.length > 0
        ? Number((allScoredValues.reduce((a, b) => a + b, 0) / allScoredValues.length).toFixed(1))
        : 0;

      const eligibleValues = pipelineResult.eligibleCandidates.map(c => c.multiFactorEvaluation.opportunityScore);
      const avgEligibleScore = eligibleValues.length > 0
        ? Number((eligibleValues.reduce((a, b) => a + b, 0) / eligibleValues.length).toFixed(1))
        : 0;

      const scoreBands: ScoreBandTelemetry = {
        candidatesScanned: pipelineResult.totalScanned,
        below50: below50Count,
        watch50to54: watch50to54Count,
        evaluated55to59: evaluated55to59Count,
        highConviction60Plus: highConviction60PlusCount,
        candidatesSentToAI: evaluations.length,
        riskGatePassed: riskGatePassedCount,
        riskGateBlocked: Math.max(0, evaluations.length - riskGatePassedCount),
        ordersSubmitted: ordersSubmitted.length,
        averageOpportunityScore: avgOppScore,
        averageEligibleScore: avgEligibleScore
      };

      this.journal.record(
        cycleId,
        'SCORE_BAND_ANALYZED',
        `Score band distribution: <50: ${below50Count}, 50-54: ${watch50to54Count}, 55-59: ${evaluated55to59Count}, >=60: ${highConviction60PlusCount}. Avg Score: ${avgOppScore}/100, Sent to AI: ${evaluations.length}, Risk Gate Passed: ${riskGatePassedCount}, Blocked: ${Math.max(0, evaluations.length - riskGatePassedCount)}.`,
        { details: scoreBands }
      );

      const finalResult: AutonomousCycleResult = {
        cycleId,
        startedAt: isoStart,
        completedAt: isoEnd,
        durationMs,
        environment: envConfig.environment,
        isMarketOpen: marketState.isMarketOpen,
        marketRegime: pipelineResult.marketRegime.regime,
        candidatesScanned: pipelineResult.totalScanned,
        candidatesEvaluated: evaluations.length,
        evaluations,
        ordersSubmitted,
        positionsMonitoredCount,
        protectiveExitsExecutedCount,
        circuitBreakerActive: false,
        eventsCount: this.journal.getEventsByCycle(cycleId).length,
        rejectedCandidatesCount: cycleRejections.length,
        accountHealthy: true,
        executionFunnel,
        rejectionDistribution,
        scoreBands,
        rotationTelemetry: pipelineResult.rotationTelemetry,
        status: 'SUCCESS'
      };

      return this.recordCycleResult(finalResult);
    } catch (err: any) {
      this.consecutiveFailures++;
      const durationMs = Date.now() - startTime;
      const isoEnd = new Date().toISOString();

      durableSessionJournal.recordEvent('CYCLE_FAILED', { cycleId, error: err.message }, { cycleId });
      durableSessionJournal.updateHeartbeat({ lastCycleCompleted: isoEnd, consecutiveFailures: this.consecutiveFailures });
      this.journal.record(
        cycleId,
        'CYCLE_FAILED',
        `Autonomous cycle ${cycleId} failed: ${err.message}`
      );

      // Auto-trip circuit breaker if consecutive failures exceed threshold
      if (this.consecutiveFailures >= this.config.circuitBreakerMaxConsecutiveFailures) {
        this.tripCircuitBreaker(
          `Exceeded maximum consecutive cycle failures (${this.consecutiveFailures}/${this.config.circuitBreakerMaxConsecutiveFailures}): ${err.message}`
        );
      }

      return {
        cycleId,
        startedAt: isoStart,
        completedAt: isoEnd,
        durationMs,
        environment: getTradingEnvironmentConfig().environment,
        isMarketOpen: true,
        candidatesScanned: 0,
        candidatesEvaluated: evaluations.length,
        evaluations,
        ordersSubmitted,
        positionsMonitoredCount,
        protectiveExitsExecutedCount,
        circuitBreakerActive: this.circuitBreakerTripped,
        eventsCount: this.journal.getEventsByCycle(cycleId).length,
        rejectedCandidatesCount: 0,
        accountHealthy: false,
        status: 'FAILED',
        error: err.message
      };
    } finally {
      this.isRunning = false;
    }
  }

  public updateStrategyConfig(config: AgentStrategyConfig): void {
    this.config = config;
    candidateDiscoveryPipeline.updateConfig(config);
    this.decisionEngine.updateConfig(config);
    aiDecisionEngine.updateConfig(config);
  }
}

// Canonical process-local singleton attached to globalThis
const gEngine = globalThis as unknown as { __AUTONOMOUS_TRADING_ENGINE__?: AutonomousTradingEngine };
if (!gEngine.__AUTONOMOUS_TRADING_ENGINE__) {
  gEngine.__AUTONOMOUS_TRADING_ENGINE__ = new AutonomousTradingEngine();
}

export const autonomousTradingEngine = gEngine.__AUTONOMOUS_TRADING_ENGINE__;



