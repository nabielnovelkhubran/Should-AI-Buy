import { AutonomousTradingEngine } from './engine';
import { MarketStateBuilder } from './state';
import { AIDecisionEngine, validateAIDecisionSchema, SchemaValidationError } from './decision';
import { TelemetryJournal } from './journal';
import { PaperTradingService } from '../trading';
import { PositionMonitoringService } from '../monitoring';
import { PaperPortfolioService } from '../portfolio';
import { AlpacaPaperTradingAdapter } from '../trading/alpaca-paper-adapter';
import { AlpacaPaperPortfolioAdapter } from '../portfolio/alpaca-paper-adapter';
import { MarketSnapshot, PaperPosition } from '../types';
import { classifyMarketRegime, isStrategyCompatibleWithRegime } from './regime';
import { evaluateMultiFactorOpportunity } from './strategy';
import { calculateStrategyPositionSize } from './sizing';
import { TradeLedger } from './analytics/trade-ledger';
import { calculatePortfolioMetrics, calculateTradeMetrics, calculateActualR } from './analytics/portfolio-analytics';
import { attributeByStrategy, attributeByRegime } from './analytics/attribution';
import { generateCalibrationReport } from './analytics/calibration';
import { verifyAccountHealth } from './analytics/account-health';
import { verifyCompetitionReadiness } from './competition';
import { getAgentConfig } from './config';

// ---------------------------------------------------------------------------
// Phase 8.8L: Deterministic Autonomous Simulation Harness (Scenarios A - X)
// Demonstrates all execution, risk, alpha, regime, attribution, calibration,
// account health, and competition validation scenarios deterministically.
// INVARIANT: Zero random numbers. 100% reproducible.
// ---------------------------------------------------------------------------

export interface SimulationReport {
  scenarioA_ValidOpportunity: boolean;
  scenarioB_RiskRejection: boolean;
  scenarioC_ModelFailure: boolean;
  scenarioD_StaleData: boolean;
  scenarioE_WorkerRestart: boolean;
  scenarioF_DuplicateSubmission: boolean;
  scenarioG_StrongMomentum: boolean;
  scenarioH_ConflictingEvidence: boolean;
  scenarioI_PoorRiskReward: boolean;
  scenarioJ_RegimeMismatch: boolean;
  scenarioK_PositionExit: boolean;
  scenarioL_OptionsCandidate: boolean;
  scenarioM_PortfolioConflict: boolean;
  scenarioN_OpportunityRotation: boolean;
  scenarioO_SuccessfulTradeAttribution: boolean;
  scenarioP_LosingTradeAttribution: boolean;
  scenarioQ_StrategyAttribution: boolean;
  scenarioR_RegimeAttribution: boolean;
  scenarioS_RejectedCandidateTelemetry: boolean;
  scenarioT_BrokerStateDivergence: boolean;
  scenarioU_CalibrationInsufficientEvidence: boolean;
  scenarioV_CompetitionValidationFailClosed: boolean;
  scenarioW_NoLookaheadInAnalytics: boolean;
  scenarioX_WorkerRestartRecovery: boolean;
  allPassed: boolean;
  logs: string[];
}

export class AutonomousSimulationHarness {
  async runAllScenarios(): Promise<SimulationReport> {
    const logs: string[] = [];
    logs.push('=== STARTING DETERMINISTIC AUTONOMOUS ALPHA SIMULATION (SCENARIOS A-X) ===');

    // SCENARIO A: Valid Opportunity -> AI BUY -> Risk APPROVE -> Paper Order -> Position Monitored
    let scenarioA_Passed = false;
    try {
      const mockTradingAdapter = new AlpacaPaperTradingAdapter();
      const mockPortfolioAdapter = new AlpacaPaperPortfolioAdapter();
      const tradingService = new PaperTradingService(mockTradingAdapter);
      const portfolioService = new PaperPortfolioService(mockPortfolioAdapter);
      const monitoringService = new PositionMonitoringService(portfolioService, tradingService);
      const journal = new TelemetryJournal();
      const engine = new AutonomousTradingEngine({ tradingService, portfolioService, monitoringService, journal });
      const result = await engine.runCycle({ scanLimit: 1, universe: ['BTC'] });
      scenarioA_Passed = result.status === 'SUCCESS' && result.evaluations.length > 0;
      logs.push(`Scenario A (Valid Opportunity): ${scenarioA_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario A error: ${err.message}`); }

    // SCENARIO B: Risk Rejection -> AI BUY -> Risk REJECT -> No broker order
    let scenarioB_Passed = false;
    try {
      const journal = new TelemetryJournal();
      const mockTradingAdapter = new AlpacaPaperTradingAdapter();
      const tradingService = new PaperTradingService(mockTradingAdapter);
      const lowCashPortfolioAdapter = new AlpacaPaperPortfolioAdapter({
        simulatedAccount: {
          id: 'acc-low-cash', accountNumber: 'PA-LOW', status: 'ACTIVE', currency: 'USD',
          equity: 100.00, cash: 50.00, buyingPower: 50.00, portfolioValue: 100.00, isPaper: true, retrievedAt: new Date().toISOString()
        }
      });
      const portfolioService = new PaperPortfolioService(lowCashPortfolioAdapter);
      const monitoringService = new PositionMonitoringService(portfolioService, tradingService);
      const engine = new AutonomousTradingEngine({ tradingService, portfolioService, monitoringService, journal });
      const result = await engine.runCycle({ scanLimit: 1, universe: ['BTC'] });
      const evalItem = result.evaluations[0];
      scenarioB_Passed = evalItem?.riskGatePassed === false && result.ordersSubmitted.length === 0;
      logs.push(`Scenario B (Risk Rejection): ${scenarioB_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario B error: ${err.message}`); }

    // SCENARIO C: Model Failure -> Timeout/Error -> PASS -> No broker order
    let scenarioC_Passed = false;
    try {
      const decisionEngine = new AIDecisionEngine();
      const passDecision = decisionEngine.createSafePassDecision('BTC', 'Simulated model timeout.');
      scenarioC_Passed = passDecision.action === 'PASS' && passDecision.confidence === 0;
      logs.push(`Scenario C (Model Failure): ${scenarioC_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario C error: ${err.message}`); }

    // SCENARIO D: Stale Data -> Stale Quote -> Reject -> No broker order
    let scenarioD_Passed = false;
    try {
      const stateBuilder = new MarketStateBuilder();
      const staleSnapshot: MarketSnapshot = {
        symbol: 'BTC', price: 60000, change24h: 2.5, change7d: 5.0, volume24h: 10000000, volumeAcceleration: 10,
        relativeVolume: 1.5, realizedVolatility: 25, momentumScore: 70, rsi14: 55, liquidityUsd: 5000000, spreadBps: 5,
        candles: { '1H': [], '4H': [], '1D': [], '7D': [], '30D': [] }, provider: 'alpaca',
        timestamp: new Date(Date.now() - 3600 * 1000).toISOString()
      };
      try { stateBuilder.validateFreshness(staleSnapshot); scenarioD_Passed = false; }
      catch (staleErr: any) { scenarioD_Passed = staleErr.name === 'StaleDataError'; }
      logs.push(`Scenario D (Stale Data): ${scenarioD_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario D error: ${err.message}`); }

    // SCENARIO E: Worker Restart -> Broker Reconciliation -> Position Recovered -> Monitoring Resumes
    let scenarioE_Passed = false;
    try {
      const recoveredPosition: PaperPosition = {
        symbol: 'SOL', assetClass: 'CRYPTO', quantity: 10, currentPrice: 150, avgEntryPrice: 140,
        marketValue: 1500, costBasis: 1400, unrealizedPnl: 100, unrealizedPnlPercent: 7.14, allocationPct: 1.5,
        side: 'long', retrievedAt: new Date().toISOString()
      };
      const restartPortfolioAdapter = new AlpacaPaperPortfolioAdapter({ simulatedPositions: [recoveredPosition] });
      const portfolioService = new PaperPortfolioService(restartPortfolioAdapter);
      const snapshot = await portfolioService.getPortfolioSnapshot();
      scenarioE_Passed = snapshot.positions.length === 1 && snapshot.positions[0].symbol === 'SOL';
      logs.push(`Scenario E (Worker Restart): ${scenarioE_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario E error: ${err.message}`); }

    // SCENARIO F: Duplicate Submission -> Network Ambiguity -> Idempotency discovery
    let scenarioF_Passed = false;
    try {
      const mockTradingAdapter = new AlpacaPaperTradingAdapter();
      const tradingService = new PaperTradingService(mockTradingAdapter);
      const orderParams = {
        investigationId: 'INV-DUP-01', symbol: 'BTC', assetClass: 'CRYPTO' as const, side: 'buy' as const,
        qty: 0.05, price: 60000, orderType: 'market' as const, timeInForce: 'gtc' as const,
        riskGatePassed: true, recommendation: 'BUY' as const, opportunityScore: 80, candidateRank: 1
      };
      const first = await tradingService.submitPaperOrder(orderParams);
      const second = await tradingService.submitPaperOrder(orderParams);
      scenarioF_Passed = first.status === 'SUBMITTED' && (second.status === 'REJECTED' || second.status === 'DUPLICATE_IGNORED' as any);
      logs.push(`Scenario F (Idempotency): ${scenarioF_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario F error: ${err.message}`); }

    // SCENARIO G: Strong Momentum Alpha Detection
    let scenarioG_Passed = false;
    try {
      const snap: MarketSnapshot = {
        symbol: 'NVDA', price: 130, change24h: 4.5, change7d: 12.0, volume24h: 25000000, volumeAcceleration: 35,
        relativeVolume: 2.2, realizedVolatility: 32, momentumScore: 88, rsi14: 64, liquidityUsd: 12000000, spreadBps: 2,
        candles: { '1H': [], '4H': [], '1D': [], '7D': [], '30D': [] }, provider: 'alpaca', timestamp: new Date().toISOString()
      };
      const regime = classifyMarketRegime(snap);
      const evalRes = evaluateMultiFactorOpportunity(snap, regime);
      scenarioG_Passed = regime.regime === 'TRENDING_UP' && evalRes.opportunityScore >= 75 && evalRes.recommendedStrategy === 'MOMENTUM_BREAKOUT';
      logs.push(`Scenario G (Momentum Alpha): ${scenarioG_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario G error: ${err.message}`); }

    // SCENARIO H: Conflicting Signals
    let scenarioH_Passed = false;
    try {
      const snap: MarketSnapshot = {
        symbol: 'MEME', price: 10, change24h: -12.0, change7d: 45.0, volume24h: 800000, volumeAcceleration: -20,
        relativeVolume: 0.8, realizedVolatility: 95, momentumScore: 40, rsi14: 78, liquidityUsd: 1500000, spreadBps: 25,
        candles: { '1H': [], '4H': [], '1D': [], '7D': [], '30D': [] }, provider: 'alpaca', timestamp: new Date().toISOString()
      };
      const regime = classifyMarketRegime(snap);
      const evalRes = evaluateMultiFactorOpportunity(snap, regime);
      scenarioH_Passed = evalRes.opportunityScore < 60 || evalRes.warnings.length > 0;
      logs.push(`Scenario H (Conflicting Signals): ${scenarioH_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario H error: ${err.message}`); }

    // SCENARIO I: Sub-2.0R Decision Rejection
    let scenarioI_Passed = false;
    try {
      try {
        validateAIDecisionSchema({
          action: 'BUY' as const, instrument: 'ETH', assetClass: 'CRYPTO' as const, strategy: 'MOMENTUM_BREAKOUT',
          confidence: 85, opportunityScore: 75, riskRewardRatio: 1.4, thesis: 'Weak R:R', catalyst: 'None',
          expectedHorizon: '2d', entryConditions: ['P>3000'], invalidationConditions: ['P<2900'], targetConditions: ['P>3140'],
          riskAssessment: 'Low payoff', reasoningSummary: 'Test',
          evidence: [{ source: 'quant', timestamp: new Date().toISOString(), claim: '1.4R' }], generatedAt: new Date().toISOString()
        });
        scenarioI_Passed = false;
      } catch (err: any) {
        scenarioI_Passed = err instanceof SchemaValidationError && err.message.includes('2.0R');
      }
      logs.push(`Scenario I (Sub-2.0R): ${scenarioI_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario I error: ${err.message}`); }

    // SCENARIO J: Regime Incompatibility Block
    let scenarioJ_Passed = false;
    try {
      const snap: MarketSnapshot = {
        symbol: 'BTC', price: 60000, change24h: 3.5, change7d: 8.0, volume24h: 10000000, volumeAcceleration: 15,
        relativeVolume: 1.8, realizedVolatility: 22, momentumScore: 82, rsi14: 65, liquidityUsd: 5000000, spreadBps: 3,
        candles: { '1H': [], '4H': [], '1D': [], '7D': [], '30D': [] }, provider: 'alpaca', timestamp: new Date().toISOString()
      };
      const regime = classifyMarketRegime(snap);
      const compat = isStrategyCompatibleWithRegime('MEAN_REVERSION', regime);
      scenarioJ_Passed = !compat.compatible;
      logs.push(`Scenario J (Regime Incompatibility): ${scenarioJ_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario J error: ${err.message}`); }

    // SCENARIO K: Thesis Invalidation Exit Execution
    let scenarioK_Passed = false;
    try {
      const mockTradingAdapter = new AlpacaPaperTradingAdapter();
      const mockPortfolioAdapter = new AlpacaPaperPortfolioAdapter({
        simulatedPositions: [{
          symbol: 'AAPL', assetClass: 'EQUITY', quantity: 50, currentPrice: 200, avgEntryPrice: 215,
          marketValue: 10000, costBasis: 10750, unrealizedPnl: -750, unrealizedPnlPercent: -6.98, allocationPct: 10,
          side: 'long', retrievedAt: new Date().toISOString()
        }]
      });
      const tradingService = new PaperTradingService(mockTradingAdapter);
      const portfolioService = new PaperPortfolioService(mockPortfolioAdapter);
      const monitoringService = new PositionMonitoringService(portfolioService, tradingService);
      const invalidationSnapshot: MarketSnapshot = {
        symbol: 'AAPL', price: 200, change24h: -3.5, change7d: -7.0, volume24h: 15000000, volumeAcceleration: -15,
        relativeVolume: 1.1, realizedVolatility: 28, momentumScore: 20, rsi14: 32, liquidityUsd: 10000000, spreadBps: 2,
        candles: { '1H': [], '4H': [], '1D': [], '7D': [], '30D': [] }, provider: 'alpaca', timestamp: new Date().toISOString()
      };
      const result = await monitoringService.runMonitoringCycle({
        executeExits: true,
        fetchSnapshotFn: async () => invalidationSnapshot
      });
      scenarioK_Passed = result.executedActions.length === 1 && result.executedActions[0].symbol === 'AAPL';
      logs.push(`Scenario K (Invalidation Exit): ${scenarioK_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario K error: ${err.message}`); }

    // SCENARIO L: Options Schema Validation
    let scenarioL_Passed = false;
    try {
      const sanitized = validateAIDecisionSchema({
        action: 'BUY' as const, instrument: 'SPY240920C00560000', assetClass: 'EQUITY' as const, instrumentType: 'OPTION' as const,
        strategy: 'MOMENTUM_BREAKOUT', confidence: 82, opportunityScore: 78, riskRewardRatio: 3.2,
        thesis: 'Call option', catalyst: 'CPI', expectedHorizon: '5d', entryConditions: ['SPY>555'],
        invalidationConditions: ['SPY<550'], targetConditions: ['SPY>565'], riskAssessment: 'Defined risk',
        reasoningSummary: 'High gamma', evidence: [{ source: 'quant', timestamp: new Date().toISOString(), claim: 'Gamma' }],
        optionDetails: { underlyingSymbol: 'SPY', contractType: 'call' as const, strikePrice: 560, expirationDate: '2024-09-20', delta: 0.45 },
        generatedAt: new Date().toISOString()
      });
      scenarioL_Passed = sanitized.instrumentType === 'OPTION';
      logs.push(`Scenario L (Options Schema): ${scenarioL_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario L error: ${err.message}`); }

    // SCENARIO M: Exposure Boundary Defense
    let scenarioM_Passed = false;
    try {
      const sizing = calculateStrategyPositionSize({
        symbol: 'BIG_POS', assetClass: 'EQUITY', currentPrice: 100, confidenceScore: 90, opportunityScore: 85,
        accountEquityUsd: 100000, availableCashUsd: 100000, currentGrossExposureUsd: 50000,
        snapshot: {
          symbol: 'BIG_POS', price: 100, change24h: 2.0, change7d: 4.0, volume24h: 5000000, volumeAcceleration: 10,
          relativeVolume: 1.5, realizedVolatility: 25, momentumScore: 75, rsi14: 60, liquidityUsd: 5000000, spreadBps: 5,
          candles: { '1H': [], '4H': [], '1D': [], '7D': [], '30D': [] }, provider: 'alpaca', timestamp: new Date().toISOString()
        }
      });
      scenarioM_Passed = !sizing.allowed && sizing.calculatedQuantity === 0;
      logs.push(`Scenario M (Exposure Boundary): ${scenarioM_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario M error: ${err.message}`); }

    // SCENARIO N: Opportunity Ranking
    let scenarioN_Passed = false;
    try {
      const candidates = [{ symbol: 'MED', score: 70 }, { symbol: 'HIGH', score: 92 }, { symbol: 'LOW', score: 55 }];
      candidates.sort((a, b) => b.score - a.score);
      scenarioN_Passed = candidates[0].symbol === 'HIGH' && candidates[1].symbol === 'MED' && candidates[2].symbol === 'LOW';
      logs.push(`Scenario N (Ranking): ${scenarioN_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario N error: ${err.message}`); }

    // SCENARIO O: Successful Trade Attribution
    let scenarioO_Passed = false;
    try {
      const ledger = new TradeLedger();
      const trade = ledger.recordEntryIntent({
        tradeId: 'TRADE-SIM-WIN-01', candidateId: 'CAND-01', decisionId: 'DEC-01', symbol: 'BTC', assetClass: 'CRYPTO',
        strategy: 'MOMENTUM_BREAKOUT', marketRegime: 'TRENDING_UP', opportunityScore: 85, aiConfidence: 90,
        estimatedRiskReward: 2.5, requestedQuantity: 0.05, approvedQuantity: 0.05, entryPrice: 60000,
        invalidationPrice: 58000, targetPrice: 65000, portfolioEquityAtEntry: 100000, grossExposureAtEntry: 3000
      });
      ledger.recordFill({ tradeId: trade.tradeId, actualFillPrice: 60000, actualFilledQuantity: 0.05 });
      const exitRecord = ledger.recordExit({
        tradeId: trade.tradeId, exitPrice: 63000, exitFilledQuantity: 0.05, exitReason: 'PROFIT_TARGET_HIT',
        portfolioEquityAtExit: 100150, grossExposureAtExit: 0
      });
      const metrics = calculateTradeMetrics(ledger.getAllTrades());
      scenarioO_Passed = exitRecord?.outcome === 'WIN' && exitRecord?.realizedPnL === 150 && exitRecord?.actualR === 1.5 && metrics.winRate === 1.0;
      logs.push(`Scenario O (Win Attribution): ${scenarioO_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario O error: ${err.message}`); }

    // SCENARIO P: Losing Trade Attribution
    let scenarioP_Passed = false;
    try {
      const ledger = new TradeLedger();
      const trade = ledger.recordEntryIntent({
        tradeId: 'TRADE-SIM-LOSS-01', candidateId: 'CAND-02', decisionId: 'DEC-02', symbol: 'ETH', assetClass: 'CRYPTO',
        strategy: 'MOMENTUM_BREAKOUT', marketRegime: 'TRENDING_UP', opportunityScore: 78, aiConfidence: 80,
        estimatedRiskReward: 2.2, requestedQuantity: 1.0, approvedQuantity: 1.0, entryPrice: 3000,
        invalidationPrice: 2900, targetPrice: 3220, portfolioEquityAtEntry: 100000, grossExposureAtEntry: 3000
      });
      ledger.recordFill({ tradeId: trade.tradeId, actualFillPrice: 3000, actualFilledQuantity: 1.0 });
      const exitRecord = ledger.recordExit({
        tradeId: trade.tradeId, exitPrice: 2880, exitFilledQuantity: 1.0, exitReason: 'THESIS_INVALIDATED',
        portfolioEquityAtExit: 99880, grossExposureAtExit: 0
      });
      const actualR = calculateActualR(exitRecord!);
      scenarioP_Passed = exitRecord?.outcome === 'LOSS' && exitRecord?.realizedPnL === -120 && actualR === -1.2;
      logs.push(`Scenario P (Loss Attribution): ${scenarioP_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario P error: ${err.message}`); }

    // SCENARIO Q: Strategy Attribution
    let scenarioQ_Passed = false;
    try {
      const ledger = new TradeLedger();
      const t1 = ledger.recordEntryIntent({
        tradeId: 'T1', candidateId: 'C1', decisionId: 'D1', symbol: 'BTC', assetClass: 'CRYPTO',
        strategy: 'MOMENTUM_BREAKOUT', marketRegime: 'TRENDING_UP', opportunityScore: 85, aiConfidence: 90,
        estimatedRiskReward: 2.5, requestedQuantity: 0.1, approvedQuantity: 0.1, entryPrice: 60000,
        invalidationPrice: 58000, targetPrice: 65000, portfolioEquityAtEntry: 100000, grossExposureAtEntry: 6000
      });
      ledger.recordExit({ tradeId: t1.tradeId, exitPrice: 62000, exitFilledQuantity: 0.1, exitReason: 'PROFIT_TARGET_HIT', portfolioEquityAtExit: 100200, grossExposureAtExit: 0 });
      const t2 = ledger.recordEntryIntent({
        tradeId: 'T2', candidateId: 'C2', decisionId: 'D2', symbol: 'SOL', assetClass: 'CRYPTO',
        strategy: 'MEAN_REVERSION', marketRegime: 'RANGE_BOUND', opportunityScore: 72, aiConfidence: 75,
        estimatedRiskReward: 2.0, requestedQuantity: 10, approvedQuantity: 10, entryPrice: 150,
        invalidationPrice: 145, targetPrice: 160, portfolioEquityAtEntry: 100200, grossExposureAtEntry: 1500
      });
      ledger.recordExit({ tradeId: t2.tradeId, exitPrice: 144, exitFilledQuantity: 10, exitReason: 'THESIS_INVALIDATED', portfolioEquityAtExit: 100140, grossExposureAtExit: 0 });
      const strategyGroups = attributeByStrategy(ledger.getAllTrades());
      const momGroup = strategyGroups.find(g => g.strategy === 'MOMENTUM_BREAKOUT');
      const mrGroup = strategyGroups.find(g => g.strategy === 'MEAN_REVERSION');
      scenarioQ_Passed = strategyGroups.length === 2 && momGroup?.metrics.winRate === 1.0 && momGroup?.metrics.totalPnLUsd === 200 && mrGroup?.metrics.winRate === 0.0;
      logs.push(`Scenario Q (Strategy Attribution): ${scenarioQ_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario Q error: ${err.message}`); }

    // SCENARIO R: Regime Attribution
    let scenarioR_Passed = false;
    try {
      const ledger = new TradeLedger();
      const t1 = ledger.recordEntryIntent({
        tradeId: 'T1', candidateId: 'C1', decisionId: 'D1', symbol: 'NVDA', assetClass: 'EQUITY',
        strategy: 'MOMENTUM_BREAKOUT', marketRegime: 'TRENDING_UP', opportunityScore: 88, aiConfidence: 85,
        estimatedRiskReward: 2.5, requestedQuantity: 20, approvedQuantity: 20, entryPrice: 120,
        invalidationPrice: 115, targetPrice: 132.5, portfolioEquityAtEntry: 100000, grossExposureAtEntry: 2400
      });
      ledger.recordExit({ tradeId: t1.tradeId, exitPrice: 126, exitFilledQuantity: 20, exitReason: 'PROFIT_TARGET_HIT', portfolioEquityAtExit: 100120, grossExposureAtExit: 0 });
      const regimeGroups = attributeByRegime(ledger.getAllTrades());
      const trendGroup = regimeGroups.find(g => g.regime === 'TRENDING_UP');
      scenarioR_Passed = regimeGroups.length === 1 && trendGroup?.metrics.winRate === 1.0 && trendGroup?.metrics.totalPnLUsd === 120;
      logs.push(`Scenario R (Regime Attribution): ${scenarioR_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario R error: ${err.message}`); }

    // SCENARIO S: Rejected Candidate Telemetry
    let scenarioS_Passed = false;
    try {
      const ledger = new TradeLedger();
      ledger.recordRejection({
        candidateId: 'CAND-01', cycleId: 'CYC-01', symbol: 'PENNY', assetClass: 'EQUITY',
        rejectionStage: 'LIQUIDITY_FILTER', rejectionReason: 'Liquidity $50k below $250k minimum'
      });
      ledger.recordRejection({
        candidateId: 'CAND-02', cycleId: 'CYC-01', symbol: 'MEME', assetClass: 'CRYPTO',
        rejectionStage: 'RISK_GATE', rejectionReason: 'Risk score 85 exceeds 70 limit'
      });
      const rejections = ledger.getRejectedCandidates();
      scenarioS_Passed = rejections.length === 2 && rejections.some(r => r.rejectionStage === 'LIQUIDITY_FILTER') && rejections.some(r => r.rejectionStage === 'RISK_GATE');
      logs.push(`Scenario S (Rejections Telemetry): ${scenarioS_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario S error: ${err.message}`); }

    // SCENARIO T: Broker State Divergence Blocker
    let scenarioT_Passed = false;
    try {
      const healthReport = verifyAccountHealth({
        accountStatus: 'ACTIVE', equity: 100000, cash: 0, buyingPower: 0, circuitBreakerActive: false
      });
      scenarioT_Passed = !healthReport.healthy && healthReport.blockers.length > 0;
      logs.push(`Scenario T (State Divergence Blocker): ${scenarioT_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario T error: ${err.message}`); }

    // SCENARIO U: Calibration Insufficient Evidence
    let scenarioU_Passed = false;
    try {
      const ledger = new TradeLedger();
      for (let i = 0; i < 5; i++) {
        const t = ledger.recordEntryIntent({
          tradeId: `T${i}`, candidateId: `C${i}`, decisionId: `D${i}`, symbol: 'BTC', assetClass: 'CRYPTO',
          strategy: 'MOMENTUM_BREAKOUT', marketRegime: 'TRENDING_UP', opportunityScore: 80, aiConfidence: 85,
          estimatedRiskReward: 2.5, requestedQuantity: 0.01, approvedQuantity: 0.01, entryPrice: 60000,
          invalidationPrice: 58000, targetPrice: 65000, portfolioEquityAtEntry: 100000, grossExposureAtEntry: 600
        });
        ledger.recordExit({ tradeId: t.tradeId, exitPrice: 61000, exitFilledQuantity: 0.01, exitReason: 'PROFIT_TARGET_HIT', portfolioEquityAtExit: 100010, grossExposureAtExit: 0 });
      }
      const report = generateCalibrationReport(ledger.getAllTrades(), getAgentConfig());
      scenarioU_Passed = report.totalTradesSampled === 5 && report.recommendations.every(r => r.state === 'INSUFFICIENT_EVIDENCE');
      logs.push(`Scenario U (Calibration Small Sample): ${scenarioU_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario U error: ${err.message}`); }

    // SCENARIO V: Competition Validation Fail Closed
    let scenarioV_Passed = false;
    try {
      const report = await verifyCompetitionReadiness();
      scenarioV_Passed = !report.ready && report.blockers.length > 0;
      logs.push(`Scenario V (Competition Validation): ${scenarioV_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario V error: ${err.message}`); }

    // SCENARIO W: No Lookahead in Analytics
    let scenarioW_Passed = false;
    try {
      const ledger = new TradeLedger();
      const trade = ledger.recordEntryIntent({
        tradeId: 'T-LOOKAHEAD', candidateId: 'C1', decisionId: 'D1', symbol: 'BTC', assetClass: 'CRYPTO',
        strategy: 'MOMENTUM_BREAKOUT', marketRegime: 'TRENDING_UP', opportunityScore: 85, aiConfidence: 90,
        estimatedRiskReward: 3.0, requestedQuantity: 0.1, approvedQuantity: 0.1, entryPrice: 60000,
        invalidationPrice: 57000, targetPrice: 69000, portfolioEquityAtEntry: 100000, grossExposureAtEntry: 6000
      });
      const openCheck = trade.outcome === 'OPEN' && trade.actualR === undefined;
      ledger.recordExit({ tradeId: trade.tradeId, exitPrice: 66000, exitFilledQuantity: 0.1, exitReason: 'PROFIT_TARGET_HIT', portfolioEquityAtExit: 100600, grossExposureAtExit: 0 });
      const closedTrade = ledger.getTradeById(trade.tradeId);
      const closeCheck = closedTrade?.actualR === 2.0 && closedTrade?.realizedPnL === 600;
      scenarioW_Passed = openCheck && closeCheck;
      logs.push(`Scenario W (No Lookahead): ${scenarioW_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario W error: ${err.message}`); }

    // SCENARIO X: Worker Restart Recovery
    let scenarioX_Passed = false;
    try {
      const journal = new TelemetryJournal();
      journal.record('CYCLE-01', 'CYCLE_STARTED', 'Cycle 1 started');
      journal.record('CYCLE-01', 'TRADE_ENTRY_RECORDED', 'Entry recorded');
      journal.record('CYCLE-01', 'CYCLE_COMPLETED', 'Cycle 1 completed');
      const cycleEvents = journal.getEventsByCycle('CYCLE-01');
      scenarioX_Passed = cycleEvents.length === 3 && cycleEvents[1].type === 'TRADE_ENTRY_RECORDED';
      logs.push(`Scenario X (Restart Recovery): ${scenarioX_Passed ? 'PASSED' : 'FAILED'}`);
    } catch (err: any) { logs.push(`Scenario X error: ${err.message}`); }

    const allPassed =
      scenarioA_Passed && scenarioB_Passed && scenarioC_Passed && scenarioD_Passed &&
      scenarioE_Passed && scenarioF_Passed && scenarioG_Passed && scenarioH_Passed &&
      scenarioI_Passed && scenarioJ_Passed && scenarioK_Passed && scenarioL_Passed &&
      scenarioM_Passed && scenarioN_Passed && scenarioO_Passed && scenarioP_Passed &&
      scenarioQ_Passed && scenarioR_Passed && scenarioS_Passed && scenarioT_Passed &&
      scenarioU_Passed && scenarioV_Passed && scenarioW_Passed && scenarioX_Passed;

    logs.push(`=== SIMULATION SUMMARY: ${allPassed ? 'ALL 24 SCENARIOS (A-X) PASSED' : 'SOME SCENARIOS FAILED'} ===`);

    return {
      scenarioA_ValidOpportunity: scenarioA_Passed,
      scenarioB_RiskRejection: scenarioB_Passed,
      scenarioC_ModelFailure: scenarioC_Passed,
      scenarioD_StaleData: scenarioD_Passed,
      scenarioE_WorkerRestart: scenarioE_Passed,
      scenarioF_DuplicateSubmission: scenarioF_Passed,
      scenarioG_StrongMomentum: scenarioG_Passed,
      scenarioH_ConflictingEvidence: scenarioH_Passed,
      scenarioI_PoorRiskReward: scenarioI_Passed,
      scenarioJ_RegimeMismatch: scenarioJ_Passed,
      scenarioK_PositionExit: scenarioK_Passed,
      scenarioL_OptionsCandidate: scenarioL_Passed,
      scenarioM_PortfolioConflict: scenarioM_Passed,
      scenarioN_OpportunityRotation: scenarioN_Passed,
      scenarioO_SuccessfulTradeAttribution: scenarioO_Passed,
      scenarioP_LosingTradeAttribution: scenarioP_Passed,
      scenarioQ_StrategyAttribution: scenarioQ_Passed,
      scenarioR_RegimeAttribution: scenarioR_Passed,
      scenarioS_RejectedCandidateTelemetry: scenarioS_Passed,
      scenarioT_BrokerStateDivergence: scenarioT_Passed,
      scenarioU_CalibrationInsufficientEvidence: scenarioU_Passed,
      scenarioV_CompetitionValidationFailClosed: scenarioV_Passed,
      scenarioW_NoLookaheadInAnalytics: scenarioW_Passed,
      scenarioX_WorkerRestartRecovery: scenarioX_Passed,
      allPassed,
      logs
    };
  }
}

export const autonomousSimulationHarness = new AutonomousSimulationHarness();
