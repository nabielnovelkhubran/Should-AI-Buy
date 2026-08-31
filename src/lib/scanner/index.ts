import {
  OpportunityCandidate,
  CandidateSignals,
  FailedScanTarget,
  ScanOptions,
  ScanResult,
  MarketSnapshot
} from '../types';
import { DEFAULT_SCAN_UNIVERSE, detectAssetClass, normalizeScanSymbol } from './universe';
import { fetchMarketSnapshot } from '../market-data';
import { calculateOpportunityScore } from '../quant';
import { calculateRiskMetrics } from '../risk';

export * from './universe';

// ---------------------------------------------------------------------------
// Phase 5A: Autonomous Opportunity Scanner
// Discovers, evaluates, and deterministically ranks candidate assets across
// a bounded market universe using the existing quantitative infrastructure.
// ---------------------------------------------------------------------------

/**
 * Scans a bounded universe of market assets and returns ranked opportunity candidates.
 * 
 * INVARIANTS:
 * - Deterministic: same market inputs produce the exact same scores and ranking.
 * - Zero random numbers or stochastic methods.
 * - Reuses existing MarketSnapshot, calculateOpportunityScore, and calculateRiskMetrics.
 * - Strict failure isolation: failure on one asset does NOT abort the scan.
 * - Does NOT fetch news, invoke LLM, run Council, or place orders.
 */
export async function scanOpportunities(options?: ScanOptions): Promise<ScanResult> {
  const universe = options?.universe ?? DEFAULT_SCAN_UNIVERSE;
  const limit = Math.max(1, options?.limit ?? 5);
  const minScore = options?.minScore ?? 0;
  const fetchFn = options?.fetchSnapshotFn ?? fetchMarketSnapshot;

  const now = new Date().toISOString();
  const unrankedCandidates: OpportunityCandidate[] = [];
  const failedTargets: FailedScanTarget[] = [];

  for (const rawSymbol of universe) {
    const symbol = normalizeScanSymbol(rawSymbol);
    if (!symbol) continue;

    try {
      const snapshot = await fetchFn(symbol);

      // Deterministic reuse of existing quantitative calculations
      const opportunityScore = calculateOpportunityScore(
        snapshot.momentumScore,
        snapshot.volumeAcceleration,
        snapshot.relativeVolume,
        snapshot.liquidityUsd
      );

      const riskMetrics = calculateRiskMetrics(
        35, // Baseline top 10 holders ratio (standard quantitative baseline)
        snapshot.liquidityUsd,
        snapshot.volume24h,
        0,
        false
      );

      const signals: CandidateSignals = {
        momentum: snapshot.momentumScore,
        rsi: snapshot.rsi14,
        rvol: snapshot.relativeVolume,
        volumeAcceleration: snapshot.volumeAcceleration,
        realizedVolatility: snapshot.realizedVolatility,
        liquidityUsd: snapshot.liquidityUsd,
        opportunityScore,
        riskScore: riskMetrics.compositeRiskScore
      };

      unrankedCandidates.push({
        symbol,
        assetClass: detectAssetClass(symbol),
        score: opportunityScore,
        rank: 0, // Assigned after sorting
        snapshot,
        signals,
        discoveredAt: now
      });
    } catch (err: any) {
      // Strict failure isolation — record diagnostic failure and continue scan
      failedTargets.push({
        symbol,
        error: err?.message || 'Unknown market data fetch error',
        statusCode: err?.statusCode
      });
    }
  }

  // Deterministic sorting: Primary = score DESC, Secondary (tie-breaker) = symbol ASC
  unrankedCandidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.symbol.localeCompare(b.symbol);
  });

  // Filter by minScore if provided
  const eligibleCandidates = minScore > 0
    ? unrankedCandidates.filter(c => c.score >= minScore)
    : unrankedCandidates;

  // Assign 1-based ranks and slice top N
  const rankedCandidates: OpportunityCandidate[] = eligibleCandidates
    .slice(0, limit)
    .map((candidate, idx) => ({
      ...candidate,
      rank: idx + 1
    }));

  return {
    candidates: rankedCandidates,
    scannedCount: universe.length,
    successfulCount: unrankedCandidates.length,
    failedCount: failedTargets.length,
    failedTargets,
    timestamp: now
  };
}

/**
 * Convenience helper returning just the ranked array of OpportunityCandidate objects.
 */
export async function scanOpportunityCandidates(options?: ScanOptions): Promise<OpportunityCandidate[]> {
  const result = await scanOpportunities(options);
  return result.candidates;
}
