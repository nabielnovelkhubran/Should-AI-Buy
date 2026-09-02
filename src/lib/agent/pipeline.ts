import { candidateRotationManager } from './rotation';
import { RotationCandidateMetadata } from './types';
import { AssetClass, MarketSnapshot, OpportunityCandidate } from '../types';
import { DEFAULT_SCAN_UNIVERSE, detectAssetClass, normalizeScanSymbol } from '../scanner/universe';
import { fetchMarketSnapshot } from '../market-data';
import { MarketRegimeState, classifyMarketRegime } from './regime';
import { MultiFactorEvaluation, evaluateMultiFactorOpportunity } from './strategy';
import { AgentStrategyConfig, DEFAULT_AGENT_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Phase 8.7: Multi-Stage Candidate Discovery Pipeline
// INVARIANT: Progressively filters candidates to prevent wasteful AI invocations.
// INVARIANT: Deterministic ranking and strict failure isolation.
// ---------------------------------------------------------------------------

export interface PipelineCandidate {
  symbol: string;
  assetClass: AssetClass;
  rank: number;
  snapshot: MarketSnapshot;
  regimeState: MarketRegimeState;
  multiFactorEvaluation: MultiFactorEvaluation;
  isEligibleForCouncil: boolean;
  filterStagePassed: number; // 1 to 5
  rejectionReason?: string;
}

export interface FilteredOutCandidateRecord {
  symbol: string;
  assetClass: AssetClass;
  stage: number;
  stageName: 'SESSION_FILTER' | 'LIQUIDITY_FILTER' | 'SPREAD_FILTER' | 'SCORE_FILTER';
  rawVolume?: number;
  priceUsed?: number;
  calculatedLiquidityUsd?: number;
  minimumLiquidityUsd?: number;
  spreadBps?: number;
  maxSpreadBps?: number;
  opportunityScore?: number;
  reason: string;
}

export interface PipelineExecutionResult {
  totalScanned: number;
  eligibleCandidates: PipelineCandidate[];
  filteredOutCandidates: FilteredOutCandidateRecord[];
  marketRegime: MarketRegimeState;
  rotationTelemetry?: RotationCandidateMetadata[];
  executedAt: string;
}

export class CandidateDiscoveryPipeline {
  private config: AgentStrategyConfig;

  constructor(config: AgentStrategyConfig = DEFAULT_AGENT_CONFIG) {
    this.config = config;
  }

  public updateConfig(config: AgentStrategyConfig): void {
    this.config = config;
  }

  /**
   * Executes the multi-stage discovery funnel across the candidate universe.
   */
  async runPipeline(options?: {
    universe?: string[];
    isMarketOpen?: boolean;
    limit?: number;
    fetchFn?: (symbol: string) => Promise<MarketSnapshot>;
    config?: AgentStrategyConfig;
  }): Promise<PipelineExecutionResult> {
    const activeConfig = options?.config ?? this.config;
    const universe = options?.universe ?? DEFAULT_SCAN_UNIVERSE;
    const isMarketOpen = options?.isMarketOpen ?? true;
    const limit = Math.max(1, options?.limit ?? 5);
    const fetchFn = options?.fetchFn ?? fetchMarketSnapshot;
    const now = new Date().toISOString();

    const eligibleCandidates: PipelineCandidate[] = [];
    const filteredOut: FilteredOutCandidateRecord[] = [];

    // Stage 0: Sample a broad market index (e.g. BTC or SPY) to establish regime
    let primaryRegimeSnapshot: MarketSnapshot | undefined;
    try {
      primaryRegimeSnapshot = await fetchFn('BTC');
    } catch {
      // Fallback
    }

    const marketRegime = primaryRegimeSnapshot
      ? classifyMarketRegime(primaryRegimeSnapshot)
      : {
          regime: 'RANGE_BOUND' as const,
          confidence: 70,
          trendDirection: 'NEUTRAL' as const,
          volatilityEnvironment: 'NORMAL' as const,
          liquidityEnvironment: 'ADEQUATE' as const,
          compatibleStrategies: ['MOMENTUM_BREAKOUT' as const, 'MEAN_REVERSION' as const],
          incompatibleStrategies: [],
          characteristics: ['Standard baseline range-bound regime.'],
          assessedAt: now
        };

    let equityClosedRecorded = false;

    for (const rawSymbol of universe) {
      const symbol = normalizeScanSymbol(rawSymbol);
      if (!symbol) continue;

      const assetClass = detectAssetClass(symbol);

      // Stage 1: Universe & Session Filter
      if (assetClass === 'EQUITY' && !isMarketOpen) {
        if (!equityClosedRecorded) {
          filteredOut.push({
            symbol: 'EQUITIES (CLOSED)',
            assetClass,
            stage: 1,
            stageName: 'SESSION_FILTER',
            reason: 'US Equity session is closed (verified via broker clock). Continuous 24/7 crypto universe prioritized.'
          });
          equityClosedRecorded = true;
        }
        continue;
      }

      let snapshot: MarketSnapshot;
      try {
        snapshot = await fetchFn(symbol);
      } catch (err: any) {
        filteredOut.push({
          symbol,
          assetClass,
          stage: 1,
          stageName: 'SESSION_FILTER',
          reason: `Market data unavailable: ${err.message}`
        });
        continue;
      }

      // Stage 2: Liquidity & Spread Filter (Asset-Aware: 24/7 Crypto paper venue vs US Equities)
      const minLiquidity = (assetClass === 'CRYPTO' || snapshot.symbol.includes('/'))
        ? Math.min(activeConfig.minLiquidityUsd, 100)
        : activeConfig.minLiquidityUsd;

      if (snapshot.liquidityUsd < minLiquidity) {
        filteredOut.push({
          symbol,
          assetClass,
          stage: 2,
          stageName: 'LIQUIDITY_FILTER',
          rawVolume: snapshot.volume24h,
          priceUsed: snapshot.price,
          calculatedLiquidityUsd: snapshot.liquidityUsd,
          minimumLiquidityUsd: minLiquidity,
          reason: `Insufficient dollar liquidity ($${(snapshot.liquidityUsd/1000).toFixed(0)}k < $${(minLiquidity/1000).toFixed(0)}k min).`
        });
        continue;
      }

      // Bifurcated Spread Filter: 50 bps for Spot Equities/Crypto vs $0.20 absolute width for Options
      const isOptionSymbol = assetClass === 'OPTION' || /^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(symbol);
      if (isOptionSymbol) {
        const optionSpreadDollars = (snapshot.ask != null && snapshot.bid != null)
          ? Math.max(0, snapshot.ask - snapshot.bid)
          : (snapshot.spreadBps / 10000) * snapshot.price;
        const maxOptionSpread = activeConfig.maxOptionSpreadDollars ?? 0.20;

        if (optionSpreadDollars > maxOptionSpread) {
          filteredOut.push({
            symbol,
            assetClass,
            stage: 2,
            stageName: 'SPREAD_FILTER',
            spreadBps: snapshot.spreadBps,
            maxSpreadBps: activeConfig.maxSpreadBps,
            reason: `Option bid-ask spread ($${optionSpreadDollars.toFixed(2)}) exceeds maximum allowed threshold ($${maxOptionSpread.toFixed(2)}).`
          });
          continue;
        }
      } else {
        if (snapshot.spreadBps > activeConfig.maxSpreadBps) {
          filteredOut.push({
            symbol,
            assetClass,
            stage: 2,
            stageName: 'SPREAD_FILTER',
            spreadBps: snapshot.spreadBps,
            maxSpreadBps: activeConfig.maxSpreadBps,
            reason: `Bid-ask spread (${snapshot.spreadBps} bps) exceeds maximum allowed threshold (${activeConfig.maxSpreadBps} bps).`
          });
          continue;
        }
      }

      // Stage 3: Market Regime Classification for Specific Asset
      const assetRegime = classifyMarketRegime(snapshot, primaryRegimeSnapshot);

      // Stage 4: Quantitative Multi-Factor Opportunity Scoring (Synchronized with Active Thresholds)
      const minOppThreshold = activeConfig.minOpportunityScore ?? 50;
      const evalFloor = Math.min(activeConfig.candidateEvaluationFloor ?? 50, minOppThreshold);
      const minRR = activeConfig.minRiskRewardRatio ?? 1.25;

      const multiFactor = evaluateMultiFactorOpportunity(snapshot, assetRegime, {
        minOpportunityThreshold: evalFloor,
        minRiskRewardRatio: minRR
      });

      const score = multiFactor.opportunityScore;
      if (score < evalFloor) {
        filteredOut.push({
          symbol,
          assetClass,
          stage: 4,
          stageName: 'SCORE_FILTER',
          opportunityScore: score,
          reason: `Opportunity score (${score}) is below evaluation threshold (${evalFloor}).`
        });
        continue;
      }

      if (!multiFactor.isEligibleForCouncil) {
        filteredOut.push({
          symbol,
          assetClass,
          stage: 4,
          stageName: 'SCORE_FILTER',
          opportunityScore: score,
          reason: multiFactor.warnings.join(' ') || `Estimated R:R (${multiFactor.estimatedRiskRewardRatio}R) below ${minRR}R cutoff.`
        });
        continue;
      }

      // Candidate passed Stages 1 through 4
      eligibleCandidates.push({
        symbol,
        assetClass,
        rank: 0,
        snapshot,
        regimeState: assetRegime,
        multiFactorEvaluation: multiFactor,
        isEligibleForCouncil: true,
        filterStagePassed: 4
      });
    }

    // Stage 5: Fair Candidate Rotation & Priority Ranking (Phase 8.26)
    // Computes effective rotation priority incorporating bounded aging bonus to prevent starvation
    const candidatePriorities = new Map<string, number>();
    eligibleCandidates.forEach(c => {
      const priorityInfo = candidateRotationManager.computePriority(
        c.symbol,
        c.multiFactorEvaluation.opportunityScore
      );
      candidatePriorities.set(c.symbol, priorityInfo.rotationPriority);
    });

    // Primary sort: rotationPriority DESC; Secondary: opportunityScore DESC; Tertiary: symbol ASC
    eligibleCandidates.sort((a, b) => {
      const pA = candidatePriorities.get(a.symbol) ?? a.multiFactorEvaluation.opportunityScore;
      const pB = candidatePriorities.get(b.symbol) ?? b.multiFactorEvaluation.opportunityScore;
      if (pB !== pA) return pB - pA;
      if (b.multiFactorEvaluation.opportunityScore !== a.multiFactorEvaluation.opportunityScore) {
        return b.multiFactorEvaluation.opportunityScore - a.multiFactorEvaluation.opportunityScore;
      }
      return a.symbol.localeCompare(b.symbol);
    });

    // Assign rank based on priority ordering
    eligibleCandidates.forEach((c, idx) => {
      c.rank = idx + 1;
    });

    // Cap at scanLimit (e.g. 5)
    const topCandidates = eligibleCandidates.slice(0, limit);
    const selectedSymbols = topCandidates.map(c => c.symbol);
    const allEligibleWithScores = eligibleCandidates.map(c => ({
      symbol: c.symbol,
      score: c.multiFactorEvaluation.opportunityScore
    }));

    // Record rotation state & produce structured rotation telemetry
    const rotationTelemetry = candidateRotationManager.recordCycleSelections(
      selectedSymbols,
      allEligibleWithScores,
      `CYCLE-${Date.now().toString(36).toUpperCase()}`,
      limit
    );

    return {
      totalScanned: universe.length,
      eligibleCandidates: topCandidates,
      filteredOutCandidates: filteredOut,
      marketRegime,
      rotationTelemetry,
      executedAt: now
    };
  }
}

export const candidateDiscoveryPipeline = new CandidateDiscoveryPipeline();
