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
  maxPositionSizeUsd: 15000.00,        // $15k max per position (15% on $100k)
  maxPortfolioExposurePct: 80.0,       // 80% max gross exposure
  maxConcentrationPct: 35.0,           // 35% single-asset cap
  minConfidenceScore: 55,              // 55% minimum AI confidence
  minOpportunityScore: 50,             // 50 execution threshold (The Hackathon Mapping)
  candidateEvaluationFloor: 50,        // 50 investigation floor
  highConvictionScore: 55,             // 55 high-conviction cutoff
  minRiskRewardRatio: 1.25,            // 1.25R min R:R (Captures 1.35R - 1.79R day/swing setups)
  minLiquidityUsd: 250000.00,          // $250k liquidity floor
  maxSpreadBps: 50,                    // 50 bps max spread for spot
  maxOptionSpreadDollars: 0.20,        // $0.20 max spread for options
  staleDataThresholdMs: 15 * 60 * 1000,
  maxOpenPositions: 8,
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
