import { Evidence } from '../types';

export interface RiskGateParams {
  symbol: string;
  opportunityScore: number;
  riskScore: number;
  liquidityUsd: number;
  positionValueUsd: number;
  availableCash: number;
  hasRedTeamFatalFlaw: boolean;
  evidence: Evidence[];
}

export interface RiskGateResult {
  passed: boolean;
  violations: string[];
  riskGateNotes: string[];
}

export const RISK_LIMITS = {
  MIN_LIQUIDITY_USD: 250000,          // $250k min liquidity
  MAX_ALLOWED_RISK_SCORE: 70,         // Risk score > 70 blocked
  MIN_OPPORTUNITY_SCORE: 55,         // Opp score < 55 blocked
  MAX_PORTFOLIO_ALLOCATION_PCT: 25,   // Max 25% single trade
  MIN_EVIDENCE_COUNT: 3               // Requires at least 3 structured evidence items
};

/**
 * Deterministic Risk Gate: Code-enforced final check before ANY trade can reach Alpaca.
 * LLMs cannot bypass these constraints.
 */
export function evaluateRiskGate(params: RiskGateParams): RiskGateResult {
  const violations: string[] = [];
  const notes: string[] = [];

  // 1. Fatal Red Team Refutation check
  if (params.hasRedTeamFatalFlaw) {
    violations.push('Red-Team invalidated thesis with fatal contradictory evidence.');
  }

  // 2. Minimum Liquidity Check
  if (params.liquidityUsd < RISK_LIMITS.MIN_LIQUIDITY_USD) {
    violations.push(`Insufficient liquidity: $${params.liquidityUsd.toLocaleString('en-US')} is below minimum required ($${RISK_LIMITS.MIN_LIQUIDITY_USD.toLocaleString('en-US')}).`);
  } else {
    notes.push(`Liquidity verified: $${params.liquidityUsd.toLocaleString('en-US')} meets safety threshold.`);
  }

  // 3. Max Risk Score Cutoff
  if (params.riskScore > RISK_LIMITS.MAX_ALLOWED_RISK_SCORE) {
    violations.push(`Risk score ${params.riskScore}/100 exceeds maximum safety limit (${RISK_LIMITS.MAX_ALLOWED_RISK_SCORE}/100).`);
  } else {
    notes.push(`Risk score ${params.riskScore}/100 within acceptable parameters.`);
  }

  // 4. Minimum Opportunity Score
  if (params.opportunityScore < RISK_LIMITS.MIN_OPPORTUNITY_SCORE) {
    violations.push(`Opportunity score ${params.opportunityScore}/100 is below minimum entry threshold (${RISK_LIMITS.MIN_OPPORTUNITY_SCORE}/100).`);
  }

  // 5. Portfolio Exposure / Position Sizing Guard
  const allocationPct = (params.positionValueUsd / (params.availableCash || 1)) * 100;
  if (allocationPct > RISK_LIMITS.MAX_PORTFOLIO_ALLOCATION_PCT) {
    violations.push(`Position allocation ${allocationPct.toFixed(1)}% exceeds maximum single-position limit (${RISK_LIMITS.MAX_PORTFOLIO_ALLOCATION_PCT}%).`);
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
