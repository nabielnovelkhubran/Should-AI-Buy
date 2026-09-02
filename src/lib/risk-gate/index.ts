import { Evidence } from '../types';
import { detectAssetClass } from '../scanner/universe';

export type RiskProfileMode = 'STANDARD' | 'HIGH_RISK';

export interface RiskGateParams {
  symbol: string;
  opportunityScore: number;
  riskScore: number;
  liquidityUsd: number;
  positionValueUsd: number;
  availableCash: number;
  hasRedTeamFatalFlaw: boolean;
  evidence: Evidence[];
  riskProfile?: RiskProfileMode;
  minOpportunityScoreOverride?: number;
  minLiquidityUsdOverride?: number;
  maxPortfolioAllocationPctOverride?: number;
}

export interface RiskGateResult {
  passed: boolean;
  violations: string[];
  riskGateNotes: string[];
}

export const RISK_LIMITS = {
  MIN_LIQUIDITY_USD: 250000,          // $250k min liquidity (hard code constraint)
  MAX_ALLOWED_RISK_SCORE: 70,         // Risk score > 70 blocked
  MIN_OPPORTUNITY_SCORE: 60,          // Standard Opp score threshold (60)
  HIGH_RISK_MIN_OPPORTUNITY_SCORE: 50,// High Risk Opp score threshold (55)
  MAX_PORTFOLIO_ALLOCATION_PCT: 25,   // Standard max 25% single trade
  HIGH_RISK_MAX_ALLOCATION_PCT: 35,   // High risk max 35% single trade
  MIN_EVIDENCE_COUNT: 3               // Requires at least 3 structured evidence items
};

/**
 * Deterministic Risk Gate: Code-enforced final check before ANY trade can reach Alpaca.
 * Evaluates execution rules based on active risk profile.
 */
export function evaluateRiskGate(params: RiskGateParams): RiskGateResult {
  const violations: string[] = [];
  const notes: string[] = [];

  const isHighRisk = params.riskProfile === 'HIGH_RISK';
  const isCrypto = params.symbol.includes('/') || detectAssetClass(params.symbol) === 'CRYPTO';
  const minOppScore = params.minOpportunityScoreOverride ?? (isHighRisk ? RISK_LIMITS.HIGH_RISK_MIN_OPPORTUNITY_SCORE : RISK_LIMITS.MIN_OPPORTUNITY_SCORE);
  const maxAllocationPct = params.maxPortfolioAllocationPctOverride ?? (isHighRisk ? RISK_LIMITS.HIGH_RISK_MAX_ALLOCATION_PCT : RISK_LIMITS.MAX_PORTFOLIO_ALLOCATION_PCT);
  const maxAllowedRisk = isHighRisk ? 75 : RISK_LIMITS.MAX_ALLOWED_RISK_SCORE;

  // 1. Fatal Red Team Refutation check (Hard constraint in all modes)
  if (params.hasRedTeamFatalFlaw) {
    violations.push('Red-Team invalidated thesis with fatal contradictory evidence.');
  }

  // 2. Minimum Liquidity Check (Asset-Aware & Configurable)
  const defaultMinLiq = isCrypto ? 100 : RISK_LIMITS.MIN_LIQUIDITY_USD;
  const effectiveMinLiquidity = params.minLiquidityUsdOverride != null
    ? (isCrypto ? Math.min(params.minLiquidityUsdOverride, 100) : params.minLiquidityUsdOverride)
    : defaultMinLiq;

  if (params.liquidityUsd < effectiveMinLiquidity) {
    violations.push(`Insufficient liquidity: $${params.liquidityUsd.toLocaleString('en-US')} is below minimum required ($${effectiveMinLiquidity.toLocaleString('en-US')}).`);
  } else {
    notes.push(`Liquidity verified: $${params.liquidityUsd.toLocaleString('en-US')} meets safety threshold.`);
  }

  // 3. Max Risk Score Cutoff
  if (params.riskScore > maxAllowedRisk) {
    violations.push(`Risk score ${params.riskScore}/100 exceeds maximum safety limit (${maxAllowedRisk}/100).`);
  } else {
    notes.push(`Risk score ${params.riskScore}/100 within acceptable parameters.`);
  }

  // 4. Minimum Opportunity Score
  if (params.opportunityScore < minOppScore) {
    violations.push(`Opportunity score ${params.opportunityScore}/100 is below minimum entry threshold (${minOppScore}/100).`);
  }

  // 5. Portfolio Exposure / Position Sizing Guard
  const allocationPct = (params.positionValueUsd / (params.availableCash || 1)) * 100;
  if (allocationPct > maxAllocationPct) {
    violations.push(`Position allocation ${allocationPct.toFixed(1)}% exceeds maximum single-position limit (${maxAllocationPct}%).`);
  }

  // 6. Evidence Sufficiency Guard
  if (!params.evidence || params.evidence.length < RISK_LIMITS.MIN_EVIDENCE_COUNT) {
    violations.push(`Insufficient evidence: only ${params.evidence?.length || 0} evidence records provided (minimum ${RISK_LIMITS.MIN_EVIDENCE_COUNT} required).`);
  } else {
    notes.push(`Evidence sufficiency met: ${params.evidence.length} structured domain evidence records analyzed.`);
  }

  return {
    passed: violations.length === 0,
    violations,
    riskGateNotes: notes
  };
}
