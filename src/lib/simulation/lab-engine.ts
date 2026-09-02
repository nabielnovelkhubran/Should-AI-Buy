import {
  SimulationScenario,
  SimulationRunResult,
  ExecutionTraceStep,
  SimulationPortfolioState
} from './types';
import { simulationPortfolioService, SimulationPortfolioService } from './portfolio';
import { simulationTradingAdapter, SimulationTradingAdapter } from './adapter';
import { calculateStrategyPositionSize } from '../agent/sizing';
import { evaluateRiskGate } from '../risk-gate';
import { AssetClass, MarketSnapshot, Evidence } from '../types';
import { TradeRecord } from '../agent/analytics/types';

// ---------------------------------------------------------------------------
// Phase 8.16: Isolated Simulation Lab Engine
// Orchestrates end-to-end execution lifecycle testing in a sandboxed runtime.
// INVARIANT: Zero calls to Alpaca. Zero contamination of real paper alpha.
// ---------------------------------------------------------------------------

export class SimulationLabEngine {
  private portfolioService: SimulationPortfolioService;
  private tradingAdapter: SimulationTradingAdapter;
  private lastTrace: ExecutionTraceStep[] = [];

  constructor(
    portfolioService: SimulationPortfolioService = simulationPortfolioService,
    tradingAdapter: SimulationTradingAdapter = simulationTradingAdapter
  ) {
    this.portfolioService = portfolioService;
    this.tradingAdapter = tradingAdapter;
  }

  public async runScenario(scenario: SimulationScenario): Promise<SimulationRunResult> {
    const executedAt = new Date().toISOString();

    // If scenario is PROFIT_EXIT or PROTECTIVE_EXIT, execute price bump and sell
    if (scenario === 'PROFIT_EXIT' || scenario === 'PROTECTIVE_EXIT') {
      const currentPositions = this.portfolioService.getState().positions;
      if (currentPositions.length === 0) {
        // First acquire a simulated position
        await this.runScenario('SUCCESSFUL_BUY');
      }
      const bumpPct = scenario === 'PROFIT_EXIT' ? 5.0 : -6.0;
      this.bumpPrice(bumpPct);
      return this.simulateSell('BTC/USD');
    }

    const cycleId = `SIM-CYCLE-${Date.now().toString(36).toUpperCase()}`;
    const candidateId = `SIM-CAND-BTC-${Date.now().toString(36).toUpperCase()}`;
    const decisionId = `SIM-DEC-BTC-${Date.now().toString(36).toUpperCase()}`;
    const trace: ExecutionTraceStep[] = [];

    this.tradingAdapter.setScenario(scenario);

    // Step 1: Candidate Discovery Simulation
    const symbol = 'BTC/USD';
    const assetClass: AssetClass = 'CRYPTO';
    const simulatedPrice = 78500.00;
    const opportunityScore = 78;
    const estimatedRiskReward = 2.40;

    trace.push({
      step: 'Candidate Discovery Pass',
      stage: 'DISCOVERY',
      status: 'PASS',
      detail: `Discovered simulated ${symbol} breakout candidate with Opportunity Score ${opportunityScore}/100 and ${estimatedRiskReward}R estimated risk/reward.`,
      timestamp: new Date().toISOString(),
      correlationIds: { cycleId, candidateId }
    });

    // Step 2: AI Council Deliberation
    const confidence = 88;

    trace.push({
      step: 'AI Council Deliberation',
      stage: 'COUNCIL',
      status: 'PASS',
      detail: `AI Council deliberated on ${symbol}: Consensus BUY approved with ${confidence}% confidence. Quant, Intelligence, and Red Team aligned.`,
      timestamp: new Date().toISOString(),
      correlationIds: { cycleId, candidateId, decisionId }
    });

    // Step 3: Deterministic Position Sizing Pass
    const currentPortfolio = this.portfolioService.getState();
    const mockSnapshot: MarketSnapshot = {
      symbol,
      price: simulatedPrice,
      change24h: 3.4,
      change7d: 8.2,
      rsi14: 62.4,
      volume24h: 15.0,
      liquidityUsd: 1177500,
      relativeVolume: 1.85,
      volumeAcceleration: 42.0,
      realizedVolatility: 28.5,
      momentumScore: 82,
      spreadBps: 6.5,
      candles: { '1H': [], '4H': [], '1D': [], '7D': [], '30D': [] },
      provider: 'alpaca',
      timestamp: new Date().toISOString()
    };

    const sizingResult = calculateStrategyPositionSize({
      symbol,
      assetClass,
      currentPrice: simulatedPrice,
      confidenceScore: confidence,
      opportunityScore,
      accountEquityUsd: currentPortfolio.equity,
      availableCashUsd: currentPortfolio.cash,
      currentGrossExposureUsd: 0,
      snapshot: mockSnapshot
    });

    trace.push({
      step: 'Position Sizing Pass',
      stage: 'SIZING',
      status: 'PASS',
      detail: `Sizing approved: ${sizingResult.calculatedQuantity} ${symbol} (~$${sizingResult.recommendedPositionSizeUsd.toFixed(2)} notional, ${(sizingResult.effectiveAllocationPct * 100).toFixed(1)}% of equity).`,
      timestamp: new Date().toISOString(),
      correlationIds: { cycleId, candidateId, decisionId }
    });

    // Step 4: Deterministic Risk Gate Evaluation
    const nowIso = new Date().toISOString();
    const mockEvidence: Evidence[] = [
      {
        id: `EV-TECH-${symbol}`,
        investigationId: decisionId,
        type: 'TECHNICAL',
        title: '1H Momentum Breakout',
        description: `${symbol} displayed clean 1H breakout with RVOL 1.85x.`,
        observedAt: nowIso,
        source: {
          name: 'Alpaca Market Data',
          retrievedAt: nowIso,
          adapterVersion: 'v2'
        },
        value: { rvol: 1.85, momentum: 82 },
        reliability: 'PRIMARY',
        isContradictory: false
      },
      {
        id: `EV-MOM-${symbol}`,
        investigationId: decisionId,
        type: 'FLOW',
        title: 'Volume Acceleration Surge',
        description: `Volume acceleration expanded +42.0% above 20-period moving average.`,
        observedAt: nowIso,
        source: {
          name: 'Alpaca Market Data',
          retrievedAt: nowIso,
          adapterVersion: 'v2'
        },
        value: { volumeAcceleration: 42.0 },
        reliability: 'PRIMARY',
        isContradictory: false
      },
      {
        id: `EV-LIQ-${symbol}`,
        investigationId: decisionId,
        type: 'MARKET',
        title: 'Deep Market Liquidity',
        description: `Depth liquidity verified at $1,177,500 with tight 6.5 bps spread.`,
        observedAt: nowIso,
        source: {
          name: 'Alpaca Market Data',
          retrievedAt: nowIso,
          adapterVersion: 'v2'
        },
        value: { liquidityUsd: 1177500, spreadBps: 6.5 },
        reliability: 'PRIMARY',
        isContradictory: false
      }
    ];

    const riskGateResult = evaluateRiskGate({
      symbol,
      opportunityScore,
      riskScore: 28,
      liquidityUsd: mockSnapshot.liquidityUsd,
      positionValueUsd: sizingResult.recommendedPositionSizeUsd,
      availableCash: currentPortfolio.cash,
      hasRedTeamFatalFlaw: false,
      evidence: mockEvidence
    });

    if (!riskGateResult.passed) {
      trace.push({
        step: 'Risk Gate Blocked',
        stage: 'RISK_GATE',
        status: 'BLOCKED',
        detail: `Risk Gate rejected order: ${riskGateResult.violations.join(', ')}`,
        timestamp: new Date().toISOString(),
        correlationIds: { cycleId, candidateId, decisionId }
      });

      this.lastTrace = trace;
      return {
        scenario,
        success: false,
        message: `Risk Gate blocked order intent: ${riskGateResult.violations[0]}`,
        portfolio: this.portfolioService.getState(),
        trace,
        executedAt
      };
    }

    trace.push({
      step: 'Risk Gate Pass',
      stage: 'RISK_GATE',
      status: 'PASS',
      detail: `Risk Gate approved: All hard safety constraints satisfied (0 violations).`,
      timestamp: new Date().toISOString(),
      correlationIds: { cycleId, candidateId, decisionId }
    });

    // Step 5: Order Intent Creation & Broker Submission
    const orderReq = {
      investigationId: decisionId,
      symbol,
      assetClass,
      side: 'buy' as const,
      qty: sizingResult.calculatedQuantity,
      price: simulatedPrice,
      orderType: 'market' as const,
      timeInForce: 'gtc' as const,
      riskGatePassed: true,
      recommendation: 'BUY' as const,
      opportunityScore
    };

    trace.push({
      step: 'Order Intent Created',
      stage: 'ORDER_INTENT',
      status: 'PASS',
      detail: `Created paper order intent for ${sizingResult.calculatedQuantity} ${symbol} @ market.`,
      timestamp: new Date().toISOString(),
      correlationIds: { cycleId, candidateId, decisionId }
    });

    const orderResult = await this.tradingAdapter.submitOrder(orderReq);
    const orderId = orderResult.orderId;
    const brokerOrderId = orderResult.brokerOrderId;

    if (orderResult.status === 'BLOCKED' || orderResult.status === 'FAILED' || orderResult.status === 'REJECTED') {
      trace.push({
        step: `Broker Submission: ${orderResult.status}`,
        stage: 'BROKER_SUBMISSION',
        status: 'FAIL',
        detail: orderResult.error || `Broker returned status ${orderResult.status}.`,
        timestamp: new Date().toISOString(),
        correlationIds: { cycleId, candidateId, decisionId, orderId }
      });

      this.lastTrace = trace;
      return {
        scenario,
        success: false,
        message: orderResult.error || `Simulation scenario "${scenario}" completed with failure state.`,
        portfolio: this.portfolioService.getState(),
        trace,
        executedAt
      };
    }

    trace.push({
      step: `Broker Submission: HTTP 200 (${orderResult.status})`,
      stage: 'BROKER_SUBMISSION',
      status: 'PASS',
      detail: `Simulated broker accepted order (Broker Order ID: ${brokerOrderId || 'SIM-BROKER'}).`,
      timestamp: new Date().toISOString(),
      correlationIds: { cycleId, candidateId, decisionId, orderId, brokerOrderId }
    });

    // Step 6: Broker Fill & Position Reconciliation
    const fillQty = orderResult.status === 'PARTIALLY_FILLED' ? sizingResult.calculatedQuantity * 0.5 : sizingResult.calculatedQuantity;
    const { position } = this.portfolioService.buyPosition({
      symbol,
      assetClass,
      quantity: fillQty,
      price: simulatedPrice
    });

    const tradeId = `SIM-TRADE-${Date.now().toString(36).toUpperCase()}`;

    trace.push({
      step: `Broker Fill & Position Reconciliation`,
      stage: 'BROKER_FILL',
      status: 'PASS',
      detail: `Order FILLED: Acquired ${position.quantity} ${symbol} @ $${simulatedPrice.toLocaleString()}. Position reconciled. Cash updated to $${this.portfolioService.getState().cash.toLocaleString()}.`,
      timestamp: new Date().toISOString(),
      correlationIds: { cycleId, candidateId, decisionId, orderId, brokerOrderId, tradeId }
    });

    // Step 7: Monitoring Activation
    trace.push({
      step: 'Position Monitoring Active',
      stage: 'MONITORING',
      status: 'INFO',
      detail: `Position ${symbol} registered in active monitoring. Thesis health: HEALTHY (Target: +5.0%, Invalidation: -6.0%).`,
      timestamp: new Date().toISOString(),
      correlationIds: { cycleId, candidateId, decisionId, orderId, brokerOrderId, tradeId }
    });

    this.lastTrace = trace;
    return {
      scenario,
      success: true,
      message: `Simulation scenario "${scenario}" executed successfully. Position opened and monitored.`,
      portfolio: this.portfolioService.getState(),
      trace,
      executedAt
    };
  }

  public bumpPrice(percentChange: number): { position: any; portfolio: SimulationPortfolioState; trace: ExecutionTraceStep[] } {
    this.portfolioService.bumpAllPrices(percentChange);
    const portfolio = this.portfolioService.getState();
    const position = portfolio.positions[0] || null;

    const step: ExecutionTraceStep = {
      step: `Simulated Price Movement (${percentChange >= 0 ? '+' : ''}${percentChange}%)`,
      stage: 'MONITORING',
      status: 'INFO',
      detail: position
        ? `Asset price updated to $${position.currentPrice.toLocaleString()} (Unrealized P&L: $${position.unrealizedPnl.toFixed(2)} / ${position.unrealizedPnlPercent}%). Portfolio equity: $${portfolio.equity.toLocaleString()}.`
        : `Simulated price shifted by ${percentChange}%. No open positions active.`,
      timestamp: new Date().toISOString()
    };

    this.lastTrace.push(step);

    return {
      position,
      portfolio,
      trace: [...this.lastTrace]
    };
  }

  public simulateSell(symbol: string = 'BTC/USD'): SimulationRunResult {
    const executedAt = new Date().toISOString();
    const portfolioBefore = this.portfolioService.getState();
    const pos = portfolioBefore.positions.find(p => p.symbol === symbol) || portfolioBefore.positions[0];

    if (!pos) {
      return {
        scenario: 'PROFIT_EXIT',
        success: false,
        message: 'No open simulated position available to sell.',
        portfolio: portfolioBefore,
        trace: [...this.lastTrace],
        executedAt
      };
    }

    const sellResult = this.portfolioService.sellPosition({
      symbol: pos.symbol,
      quantity: pos.quantity,
      exitPrice: pos.currentPrice,
      exitReason: 'PROFIT_TARGET_HIT'
    });

    if (!sellResult) {
      return {
        scenario: 'PROFIT_EXIT',
        success: false,
        message: 'Failed to close simulated position.',
        portfolio: this.portfolioService.getState(),
        trace: [...this.lastTrace],
        executedAt
      };
    }

    const tradeRecord: TradeRecord = {
      tradeId: `SIM-TRADE-${Date.now().toString(36).toUpperCase()}`,
      candidateId: `SIM-CAND-${pos.symbol}`,
      decisionId: `SIM-DEC-${pos.symbol}`,
      symbol: pos.symbol,
      assetClass: pos.assetClass,
      instrumentType: pos.assetClass === 'CRYPTO' ? 'CRYPTO' : 'EQUITY',
      direction: 'LONG',
      strategy: 'MOMENTUM_BREAKOUT',
      marketRegime: 'TRENDING_UP',
      opportunityScore: 78,
      aiConfidence: 88,
      estimatedRiskReward: 2.4,
      requestedQuantity: pos.quantity,
      approvedQuantity: pos.quantity,
      entryPrice: pos.avgEntryPrice,
      actualFillPrice: pos.avgEntryPrice,
      actualFilledQuantity: pos.quantity,
      entryTimestamp: pos.retrievedAt,
      invalidationPrice: pos.avgEntryPrice * 0.94,
      targetPrice: pos.avgEntryPrice * 1.05,
      initialRiskAmountUsd: Math.abs(pos.avgEntryPrice * 0.06) * pos.quantity,
      portfolioEquityAtEntry: 100000,
      grossExposureAtEntry: pos.costBasis,
      exitPrice: pos.currentPrice,
      exitFilledQuantity: pos.quantity,
      exitTimestamp: executedAt,
      exitReason: sellResult.realizedPnL >= 0 ? 'PROFIT_TARGET_HIT' : 'THESIS_INVALIDATED',
      portfolioEquityAtExit: this.portfolioService.getState().equity,
      grossExposureAtExit: 0,
      realizedPnL: sellResult.realizedPnL,
      realizedPnLPct: pos.costBasis > 0 ? (sellResult.realizedPnL / pos.costBasis) * 100 : 0,
      isGrossPnL: true,
      outcome: sellResult.realizedPnL > 0.01 ? 'WIN' : (sellResult.realizedPnL < -0.01 ? 'LOSS' : 'BREAKEVEN'),
      recordedAt: executedAt,
      updatedAt: executedAt
    };

    this.portfolioService.recordTrade(tradeRecord);

    const step: ExecutionTraceStep = {
      step: 'Simulated SELL & Trade Completion',
      stage: 'EXIT',
      status: 'PASS',
      detail: `Sold ${pos.quantity} ${pos.symbol} @ $${pos.currentPrice.toLocaleString()}. Realized P&L: $${sellResult.realizedPnL.toFixed(2)}. Trade logged in Simulation Evidence (N=${this.portfolioService.getState().trades.length}). Real Paper Evidence remains N=0.`,
      timestamp: executedAt
    };

    this.lastTrace.push(step);

    return {
      scenario: 'PROFIT_EXIT',
      success: true,
      message: `Position closed successfully. Realized P&L: $${sellResult.realizedPnL.toFixed(2)}.`,
      portfolio: this.portfolioService.getState(),
      trace: [...this.lastTrace],
      executedAt
    };
  }

  public getTrace(): ExecutionTraceStep[] {
    return [...this.lastTrace];
  }

  public reset(): void {
    this.portfolioService.reset();
    this.tradingAdapter.clear();
    this.lastTrace = [];
  }
}

const g = globalThis as any;
if (!g.__SIMULATION_LAB_ENGINE__) {
  g.__SIMULATION_LAB_ENGINE__ = new SimulationLabEngine();
}

export const simulationLabEngine: SimulationLabEngine = g.__SIMULATION_LAB_ENGINE__;


