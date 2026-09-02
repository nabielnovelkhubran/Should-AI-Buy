import { AssetClass, MarketSnapshot } from '../types';
import { truncateMoney, truncateQuantity } from '../trading/precision';
import { AgentStrategyConfig, DEFAULT_AGENT_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Phase 8.7: Strategy-Aware Deterministic Position Sizing Engine
// INVARIANT: Deterministic calculation of permitted quantity & dollar allocation.
// INVARIANT: Code-enforced hard limits. The AI cannot exceed risk parameters.
// ---------------------------------------------------------------------------

export interface SizingInput {
  symbol: string;
  assetClass: AssetClass;
  currentPrice: number;
  confidenceScore: number;       // 0 - 100 (from AI / Council)
  opportunityScore: number;      // 0 - 100 (from Multi-Factor Engine)
  accountEquityUsd: number;
  availableCashUsd: number;
  currentGrossExposureUsd: number;
  snapshot: MarketSnapshot;
  config?: AgentStrategyConfig;
}

export interface SizingResult {
  symbol: string;
  allowed: boolean;
  recommendedPositionSizeUsd: number;
  calculatedQuantity: number;
  effectiveAllocationPct: number;
  reasons: string[];
  violations: string[];
}

/**
 * Calculates deterministic position sizing based on risk parity, conviction, and hard limits.
 */
export function calculateStrategyPositionSize(input: SizingInput): SizingResult {
  const config = input.config ?? DEFAULT_AGENT_CONFIG;
  const reasons: string[] = [];
  const violations: string[] = [];

  if (input.currentPrice <= 0) {
    return {
      symbol: input.symbol,
      allowed: false,
      recommendedPositionSizeUsd: 0,
      calculatedQuantity: 0,
      effectiveAllocationPct: 0,
      reasons: [],
      violations: ['Invalid current asset price (<= 0).']
    };
  }

  // 1. Check Hard Exposure Limits
  const maxGrossAllowedUsd = (input.accountEquityUsd * config.maxPortfolioExposurePct) / 100;
  const remainingExposureCapacityUsd = Math.max(0, maxGrossAllowedUsd - input.currentGrossExposureUsd);

  if (remainingExposureCapacityUsd <= 0) {
    violations.push(`Total portfolio gross exposure would exceed limit of ${config.maxPortfolioExposurePct}%.`);
  }

  const maxSinglePositionCapUsd = Math.min(
    config.maxPositionSizeUsd,
    (input.accountEquityUsd * config.maxConcentrationPct) / 100,
    input.availableCashUsd,
    remainingExposureCapacityUsd
  );

  if (maxSinglePositionCapUsd <= 0) {
    return {
      symbol: input.symbol,
      allowed: false,
      recommendedPositionSizeUsd: 0,
      calculatedQuantity: 0,
      effectiveAllocationPct: 0,
      reasons,
      violations: violations.length > 0 ? violations : ['Insufficient available cash or buying power.']
    };
  }

  // 2. Volatility and Conviction Scaling
  // Higher volatility -> smaller base allocation
  // Higher conviction & opportunity score -> higher scaling factor (0.5x to 1.0x)
  const vol = Math.max(10, input.snapshot.realizedVolatility);
  const volPenalty = Math.max(0.5, Math.min(1.0, 30 / vol));

  const convictionFactor = Math.max(0.5, Math.min(1.0, (input.confidenceScore / 100) * 0.6 + (input.opportunityScore / 100) * 0.4));

  // Base raw dollar allocation
  const rawSizeUsd = maxSinglePositionCapUsd * volPenalty * convictionFactor;
  const boundedSizeUsd = Math.min(rawSizeUsd, maxSinglePositionCapUsd);
  const finalSizeUsd = truncateMoney(boundedSizeUsd);

  // 3. Precise Quantity Derivation with Downward Truncation
  const rawQty = finalSizeUsd / input.currentPrice;
  const finalQty = truncateQuantity(rawQty, input.assetClass);

  const effectiveAllocationPct = Number(((finalSizeUsd / input.accountEquityUsd) * 100).toFixed(2));

  reasons.push(`Base size scaled by conviction (${(convictionFactor * 100).toFixed(0)}%) and volatility penalty (${volPenalty.toFixed(2)}x).`);
  reasons.push(`Final position sized at $${finalSizeUsd.toFixed(2)} (${effectiveAllocationPct}% of equity).`);

  return {
    symbol: input.symbol,
    allowed: violations.length === 0 && finalQty > 0,
    recommendedPositionSizeUsd: finalSizeUsd,
    calculatedQuantity: finalQty,
    effectiveAllocationPct,
    reasons,
    violations
  };
}
