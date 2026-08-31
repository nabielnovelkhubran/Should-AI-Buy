import { Claim, Evidence } from '../types';

// ---------------------------------------------------------------------------
// Phase 3: Claim ↔ Evidence Graph Traversal Utilities
// All functions are pure, deterministic, and receive no LLM input.
// ---------------------------------------------------------------------------

/**
 * Returns all Evidence items that support a given Claim.
 */
export function getClaimSupportingEvidence(claim: Claim, evidence: Evidence[]): Evidence[] {
  const ids = new Set(claim.supportingEvidenceIds);
  return evidence.filter(e => ids.has(e.id));
}

/**
 * Returns all Evidence items that contradict a given Claim.
 */
export function getClaimContradictingEvidence(claim: Claim, evidence: Evidence[]): Evidence[] {
  const ids = new Set(claim.contradictoryEvidenceIds);
  return evidence.filter(e => ids.has(e.id));
}

/**
 * Returns all REFUTATION claims that explicitly refute a given claim.
 */
export function getRefutationsOf(claim: Claim, allClaims: Claim[]): Claim[] {
  return allClaims.filter(c => c.type === 'REFUTATION' && c.refutationOf === claim.id);
}

/**
 * Returns all claims that are currently REFUTED.
 */
export function getRefutedClaims(claims: Claim[]): Claim[] {
  return claims.filter(c => c.status === 'REFUTED');
}

/**
 * Returns all claims that have contradictory evidence (CONTESTED status).
 */
export function getContestedClaims(claims: Claim[]): Claim[] {
  return claims.filter(c => c.status === 'CONTESTED');
}

/**
 * Returns all claims from a specific agent.
 */
export function getClaimsByAgent(
  claims: Claim[],
  agent: Claim['agent']
): Claim[] {
  return claims.filter(c => c.agent === agent);
}

/**
 * Returns all BULLISH claims (used by Decision stage for synthesis).
 */
export function getBullishClaims(claims: Claim[]): Claim[] {
  return claims.filter(c => c.type === 'BULLISH');
}

/**
 * Returns all BEARISH + REFUTATION claims (counter-thesis evidence).
 */
export function getCounterClaims(claims: Claim[]): Claim[] {
  return claims.filter(c => c.type === 'BEARISH' || c.type === 'REFUTATION' || c.type === 'RISK');
}

/**
 * Returns all Evidence items referenced (supporting or contradicting) by a given set of claims.
 * Useful for the Decision stage to surface the most important evidence.
 */
export function getAllReferencedEvidence(claims: Claim[], evidence: Evidence[]): Evidence[] {
  const allIds = new Set<string>();
  for (const claim of claims) {
    claim.supportingEvidenceIds.forEach(id => allIds.add(id));
    claim.contradictoryEvidenceIds.forEach(id => allIds.add(id));
  }
  return evidence.filter(e => allIds.has(e.id));
}

/**
 * Builds a summary of the claim graph for display — how many claims of each type exist.
 */
export function buildClaimSummary(claims: Claim[]): {
  total: number;
  bullish: number;
  bearish: number;
  refutations: number;
  risk: number;
  neutral: number;
  refuted: number;
  contested: number;
  supported: number;
} {
  return {
    total: claims.length,
    bullish: claims.filter(c => c.type === 'BULLISH').length,
    bearish: claims.filter(c => c.type === 'BEARISH').length,
    refutations: claims.filter(c => c.type === 'REFUTATION').length,
    risk: claims.filter(c => c.type === 'RISK').length,
    neutral: claims.filter(c => c.type === 'NEUTRAL').length,
    refuted: claims.filter(c => c.status === 'REFUTED').length,
    contested: claims.filter(c => c.status === 'CONTESTED').length,
    supported: claims.filter(c => c.status === 'SUPPORTED').length,
  };
}
