import {
  Claim,
  ClaimType,
  ClaimStatus,
  CouncilStage,
  Evidence,
  AgentResult,
  MarketSnapshot
} from '../types';

// ---------------------------------------------------------------------------
// Phase 3: Claims System — Claim Extraction & ID Generation
//
// Claim extraction functions are DETERMINISTIC CODE. They produce Claim objects
// from the MarketSnapshot and AgentResult already bound to a single investigation.
// No additional data fetches are made. No LLM generates the ID or status fields.
//
// The `statement` field is the only field that contains agent-declared natural
// language. All other fields (IDs, status, evidence links) are code-computed.
// ---------------------------------------------------------------------------

/** Generates a deterministic Claim ID */
export function makeClaimId(investigationId: string, agentPrefix: string, seq: number): string {
  return `CLAIM-${investigationId}-${agentPrefix.toUpperCase()}-${seq}`;
}

/**
 * Derives ClaimStatus deterministically from the evidence relationship graph.
 * Called after all claims are assembled to update statuses in-place.
 */
export function deriveClaimStatus(claim: Claim, allClaims: Claim[]): ClaimStatus {
  // A REFUTATION claim targets this claim
  const isRefuted = allClaims.some(c => c.type === 'REFUTATION' && c.refutationOf === claim.id);
  if (isRefuted) return 'REFUTED';
  // This claim has contradictory evidence linked
  if (claim.contradictoryEvidenceIds.length > 0) return 'CONTESTED';
  // No evidence at all (excluding REFUTATION type which by definition is evidence-backed)
  if (claim.supportingEvidenceIds.length === 0 && claim.type !== 'REFUTATION') return 'UNSUPPORTED';
  return 'SUPPORTED';
}

/**
 * After all claims are assembled, resolves cross-claim refutations and updates
 * refutedByClaimId on the targeted claims.
 */
export function linkRefutations(claims: Claim[]): Claim[] {
  const claimMap = new Map<string, Claim>(claims.map(c => [c.id, c]));

  for (const claim of claims) {
    if (claim.type === 'REFUTATION' && claim.refutationOf) {
      const target = claimMap.get(claim.refutationOf);
      if (target) {
        target.refutedByClaimId = claim.id;
        target.status = 'REFUTED';
      }
    }
  }

  // Recompute all statuses after linking
  for (const claim of claims) {
    if (claim.type !== 'REFUTATION') {
      claim.status = deriveClaimStatus(claim, claims);
    }
  }

  return claims;
}

// ---------------------------------------------------------------------------
// 1. DISCOVERY — Claims
// ---------------------------------------------------------------------------
export function extractDiscoveryClaims(
  investigationId: string,
  snapshot: MarketSnapshot,
  agentResult: AgentResult
): Claim[] {
  const now = new Date().toISOString();
  const oppScore = Number(agentResult.metrics?.opportunityScore ?? 0);
  const isOpportunity = agentResult.verdict === 'OPPORTUNITY';

  const claim: Claim = {
    id: makeClaimId(investigationId, 'DSC', 1),
    investigationId,
    agent: 'discovery',
    stage: 'DISCOVERY',
    type: isOpportunity ? 'BULLISH' : 'NEUTRAL',
    statement: `$${snapshot.symbol} has an Opportunity Score of ${oppScore}/100 at price $${snapshot.price.toLocaleString('en-US', { maximumFractionDigits: 4 })} with 24h change ${snapshot.change24h >= 0 ? '+' : ''}${snapshot.change24h}% (as of ${snapshot.timestamp}).`,
    confidence: agentResult.confidence,
    status: 'SUPPORTED',
    supportingEvidenceIds: agentResult.supportingEvidenceIds.slice(0, 2),
    contradictoryEvidenceIds: [],
    createdAt: now
  };

  return [claim];
}

// ---------------------------------------------------------------------------
// 2. QUANT — Claims
// ---------------------------------------------------------------------------
export function extractQuantClaims(
  investigationId: string,
  snapshot: MarketSnapshot,
  agentResult: AgentResult
): Claim[] {
  const now = new Date().toISOString();
  const claims: Claim[] = [];

  // Claim 1: Momentum / trend
  const momentumType: ClaimType = agentResult.verdict === 'BUY' ? 'BULLISH' : agentResult.verdict === 'SELL' ? 'BEARISH' : 'NEUTRAL';
  claims.push({
    id: makeClaimId(investigationId, 'QNT', 1),
    investigationId,
    agent: 'quant',
    stage: 'QUANT',
    type: momentumType,
    statement: `Momentum score is ${snapshot.momentumScore}/100 with RSI-14 at ${snapshot.rsi14}, RVOL ${snapshot.relativeVolume}x, and realized volatility ${snapshot.realizedVolatility}% (as of ${snapshot.timestamp}).`,
    confidence: agentResult.confidence,
    status: 'SUPPORTED',
    supportingEvidenceIds: agentResult.supportingEvidenceIds.slice(0, 2),
    contradictoryEvidenceIds: agentResult.contradictoryEvidenceIds.slice(0, 1),
    createdAt: now
  });

  // Claim 2: Volume interpretation (if volume acceleration is notable)
  if (Math.abs(snapshot.volumeAcceleration) >= 10) {
    const isPositiveVolume = snapshot.volumeAcceleration > 0;
    claims.push({
      id: makeClaimId(investigationId, 'QNT', 2),
      investigationId,
      agent: 'quant',
      stage: 'QUANT',
      type: isPositiveVolume ? 'BULLISH' : 'BEARISH',
      statement: `Volume acceleration of ${snapshot.volumeAcceleration > 0 ? '+' : ''}${snapshot.volumeAcceleration}% suggests ${isPositiveVolume ? 'increasing buying interest' : 'declining participation'} relative to prior period.`,
      confidence: agentResult.confidence,
      status: 'SUPPORTED',
      supportingEvidenceIds: agentResult.supportingEvidenceIds.filter(id => id.includes('MKT')).slice(0, 1),
      contradictoryEvidenceIds: [],
      createdAt: now
    });
  }

  return claims;
}

// ---------------------------------------------------------------------------
// 3. INTELLIGENCE — Claims
// ---------------------------------------------------------------------------
export function extractIntelligenceClaims(
  investigationId: string,
  evidence: Evidence[],
  agentResult: AgentResult
): Claim[] {
  const now = new Date().toISOString();
  const newsEvidence = evidence.filter(e => e.type === 'NEWS');

  if (newsEvidence.length === 0 || agentResult.failed) {
    return [{
      id: makeClaimId(investigationId, 'INT', 1),
      investigationId,
      agent: 'intelligence',
      stage: 'INTELLIGENCE',
      type: 'NEUTRAL',
      statement: 'No external intelligence was available. The council made no unsupported news-based claims.',
      confidence: 50,
      status: 'SUPPORTED',
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      createdAt: now
    }];
  }

  const claims: Claim[] = [];
  const positiveArticles = newsEvidence.filter(e => e.value?.sentiment === 'POSITIVE' && !e.isContradictory);
  const negativeArticles = newsEvidence.filter(e => e.isContradictory);

  if (positiveArticles.length > 0) {
    claims.push({
      id: makeClaimId(investigationId, 'INT', 1),
      investigationId,
      agent: 'intelligence',
      stage: 'INTELLIGENCE',
      type: 'BULLISH',
      statement: `External catalyst verified: "${positiveArticles[0].title}" (Source: ${positiveArticles[0].source.publisher ?? positiveArticles[0].source.name}, published ${positiveArticles[0].observedAt}).`,
      confidence: agentResult.confidence,
      status: negativeArticles.length > 0 ? 'CONTESTED' : 'SUPPORTED',
      supportingEvidenceIds: positiveArticles.map(e => e.id),
      contradictoryEvidenceIds: negativeArticles.map(e => e.id),
      createdAt: now
    });
  }

  if (negativeArticles.length > 0) {
    claims.push({
      id: makeClaimId(investigationId, 'INT', claims.length + 1),
      investigationId,
      agent: 'intelligence',
      stage: 'INTELLIGENCE',
      type: 'BEARISH',
      statement: `Adverse intelligence flag: "${negativeArticles[0].title}" — contradicts bullish narrative (Source: ${negativeArticles[0].source.publisher ?? negativeArticles[0].source.name}).`,
      confidence: agentResult.confidence,
      status: 'SUPPORTED',
      supportingEvidenceIds: negativeArticles.map(e => e.id),
      contradictoryEvidenceIds: positiveArticles.map(e => e.id),
      createdAt: now
    });
  }

  if (claims.length === 0) {
    claims.push({
      id: makeClaimId(investigationId, 'INT', 1),
      investigationId,
      agent: 'intelligence',
      stage: 'INTELLIGENCE',
      type: 'NEUTRAL',
      statement: 'No decisive external catalyst or abnormal narrative shifts detected in intelligence feeds.',
      confidence: agentResult.confidence,
      status: 'SUPPORTED',
      supportingEvidenceIds: newsEvidence.map(e => e.id),
      contradictoryEvidenceIds: [],
      createdAt: now
    });
  }

  return claims;
}

// ---------------------------------------------------------------------------
// 4. RISK — Claims
// ---------------------------------------------------------------------------
export function extractRiskClaims(
  investigationId: string,
  evidence: Evidence[],
  agentResult: AgentResult
): Claim[] {
  const now = new Date().toISOString();
  const riskScore = Number(agentResult.metrics?.compositeRiskScore ?? 0);
  const claimType: ClaimType = riskScore >= 70 ? 'BEARISH' : riskScore >= 45 ? 'RISK' : 'NEUTRAL';

  const claim: Claim = {
    id: makeClaimId(investigationId, 'RSK', 1),
    investigationId,
    agent: 'risk',
    stage: 'RISK',
    type: claimType,
    statement: `Composite Risk Score is ${riskScore}/100. Top-10 holder concentration: ${agentResult.metrics?.top10HoldersPct ?? 'N/A'}%. Suspicious transfers: ${agentResult.metrics?.suspiciousTransfers ?? 0}.${agentResult.risks.length > 0 ? ` Risk flags: ${agentResult.risks.slice(0, 1).join('; ')}.` : ''}`,
    confidence: agentResult.confidence,
    status: agentResult.contradictoryEvidenceIds.length > 0 ? 'CONTESTED' : 'SUPPORTED',
    supportingEvidenceIds: agentResult.supportingEvidenceIds,
    contradictoryEvidenceIds: agentResult.contradictoryEvidenceIds,
    createdAt: now
  };

  return [claim];
}

// ---------------------------------------------------------------------------
// 5. RED TEAM — Claims (REFUTATION type)
// ---------------------------------------------------------------------------
export function extractRedTeamClaims(
  investigationId: string,
  evidence: Evidence[],
  agentResult: AgentResult,
  priorClaims: Claim[]
): Claim[] {
  const now = new Date().toISOString();
  const details = agentResult.redTeamAttackDetails;
  const vulnerabilities = details?.vulnerabilitiesFound ?? [];
  const thesisStatus = details?.thesisStatus ?? 'INTACT';
  const claims: Claim[] = [];

  if (thesisStatus === 'INTACT') {
    // No refutations — confirm thesis survived
    claims.push({
      id: makeClaimId(investigationId, 'RT', 1),
      investigationId,
      agent: 'red_team',
      stage: 'RED_TEAM',
      type: 'NEUTRAL',
      statement: 'Adversarial challenge passed: No fatal vulnerabilities found in liquidity depth, holder concentration, momentum exhaustion, or intelligence flags.',
      confidence: agentResult.confidence,
      status: 'SUPPORTED',
      supportingEvidenceIds: agentResult.supportingEvidenceIds.slice(0, 2),
      contradictoryEvidenceIds: [],
      createdAt: now
    });
    return claims;
  }

  // Find the primary bullish claims to refute (Quant + Discovery momentum)
  const quantClaim = priorClaims.find(c => c.agent === 'quant' && c.type === 'BULLISH');
  const discoveryClaim = priorClaims.find(c => c.agent === 'discovery' && c.type === 'BULLISH');
  const primaryTargetId = quantClaim?.id ?? discoveryClaim?.id;

  vulnerabilities.forEach((vuln, idx) => {
    const seq = idx + 1;
    const targetId = seq === 1 ? primaryTargetId : undefined;

    claims.push({
      id: makeClaimId(investigationId, 'RT', seq),
      investigationId,
      agent: 'red_team',
      stage: 'RED_TEAM',
      type: 'REFUTATION',
      statement: vuln,
      confidence: agentResult.confidence,
      status: 'SUPPORTED',
      supportingEvidenceIds: agentResult.contradictoryEvidenceIds,
      contradictoryEvidenceIds: agentResult.supportingEvidenceIds.slice(0, 2),
      refutationOf: targetId,
      createdAt: now
    });
  });

  return claims;
}

// ---------------------------------------------------------------------------
// Backfill: after all claims are created, stamp claimIds onto evidence objects
// ---------------------------------------------------------------------------
export function linkEvidenceToClaims(evidence: Evidence[], claims: Claim[]): void {
  const evidenceMap = new Map<string, Evidence>(evidence.map(e => [e.id, e]));

  for (const claim of claims) {
    for (const eid of claim.supportingEvidenceIds) {
      const ev = evidenceMap.get(eid);
      if (ev && ev.claimIds && !ev.claimIds.includes(claim.id)) {
        ev.claimIds.push(claim.id);
      }
    }
    for (const eid of claim.contradictoryEvidenceIds) {
      const ev = evidenceMap.get(eid);
      if (ev && ev.claimIds && !ev.claimIds.includes(claim.id)) {
        ev.claimIds.push(claim.id);
      }
    }
  }
}
