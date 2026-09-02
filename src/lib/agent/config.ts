import { AgentStrategyConfig, RiskProfileType } from './types';
export type { AgentStrategyConfig, RiskProfileType };

// ---------------------------------------------------------------------------
// Phase 8.26B: Multi-Profile Strategy & Risk Configuration
// Supports STANDARD (Institutional / Capital-Preservation) and
// HIGH_RISK (Aggressive / Maximum Alpha Capture) execution modes.
// ---------------------------------------------------------------------------

export const STANDARD_AGENT_CONFIG: AgentStrategyConfig = {
  riskProfile: 'STANDARD',
  maxPositionSizeUsd: 5000.00,         // $5k max per position (5% on $100k)
  maxPortfolioExposurePct: 50.0,       // 50% max gross exposure
  maxConcentrationPct: 25.0,           // 25% single-asset cap
  minConfidenceScore: 65,              // 65% minimum AI confidence
  minOpportunityScore: 60,             // 60 execution threshold
  candidateEvaluationFloor: 55,        // 55 investigation floor
  highConvictionScore: 60,             // 60 high-conviction cutoff
  minRiskRewardRatio: 2.0,             // 2.0R min R:R
  minLiquidityUsd: 500000.00,          // $500k liquidity floor
  maxSpreadBps: 50,                    // 50 bps max spread for spot
  maxOptionSpreadDollars: 0.20,        // $0.20 max spread for options
  staleDataThresholdMs: 15 * 60 * 1000,
  maxOpenPositions: 5,
  reconciliationWindowDays: 3,
  circuitBreakerMaxConsecutiveFailures: 3
};

export const HIGH_RISK_AGENT_CONFIG: AgentStrategyConfig = {
  riskProfile: 'HIGH_RISK',
  maxPositionSizeUsd: 25000.00,        // $25k max per position (25% on $100k)
  maxPortfolioExposurePct: 100.0,      // 100% max gross exposure (Full deployment)
  maxConcentrationPct: 40.0,           // 40% single-asset cap
  minConfidenceScore: 45,              // 45% minimum AI confidence
  minOpportunityScore: 40,             // 40 execution threshold
  candidateEvaluationFloor: 40,        // 40 investigation floor
  highConvictionScore: 50,             // 50 high-conviction cutoff
  minRiskRewardRatio: 1.0,             // 1.0R min R:R
  minLiquidityUsd: 100000.00,          // $100k liquidity floor
  maxSpreadBps: 100,                   // 100 bps max spread for spot
  maxOptionSpreadDollars: 0.50,        // $0.50 max spread for options
  staleDataThresholdMs: 15 * 60 * 1000,
  maxOpenPositions: 16,                // Up to 16 concurrent positions
  reconciliationWindowDays: 3,
  circuitBreakerMaxConsecutiveFailures: 3
};

export const DEFAULT_AGENT_CONFIG: AgentStrategyConfig = STANDARD_AGENT_CONFIG;

export function getAgentConfig(
  profileOrOverrides?: RiskProfileType | Partial<AgentStrategyConfig>,
  overrides?: Partial<AgentStrategyConfig>
): Readonly<AgentStrategyConfig> {
  let baseConfig = STANDARD_AGENT_CONFIG;
  let customOverrides: Partial<AgentStrategyConfig> | undefined;

  if (profileOrOverrides === 'HIGH_RISK') {
    baseConfig = HIGH_RISK_AGENT_CONFIG;
    customOverrides = overrides;
  } else if (profileOrOverrides === 'STANDARD') {
    baseConfig = STANDARD_AGENT_CONFIG;
    customOverrides = overrides;
  } else if (typeof profileOrOverrides === 'object') {
    customOverrides = profileOrOverrides;
  }

  return Object.freeze({
    ...baseConfig,
    ...customOverrides
  });
}
