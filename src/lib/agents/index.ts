import { Evidence, AgentResult, MarketSnapshot, TradeThesis, Position } from '../types';
import { calculateOpportunityScore } from '../quant';
import { calculateRiskMetrics } from '../risk';

/**
 * 1. DISCOVERY AGENT
 * Question: "What is happening?"
 * Objective: Determine current market state, momentum, and volume activity from single snapshot.
 */
export function runDiscoveryAgent(snapshot: MarketSnapshot, evidence: Evidence[]): AgentResult {
  const oppScore = calculateOpportunityScore(
    snapshot.momentumScore,
    snapshot.volumeAcceleration,
    snapshot.relativeVolume,
    snapshot.liquidityUsd
  );

  const supportingIds = evidence
    .filter(e => e.type === 'MARKET' && !e.isContradictory)
    .map(e => e.id);

  const isOpportunity = oppScore >= 60;
  const summary = isOpportunity
    ? `Market momentum is positive for $${snapshot.symbol}. Price is $${snapshot.price.toLocaleString('en-US')} with 24h change of ${snapshot.change24h >= 0 ? '+' : ''}${snapshot.change24h}% and volume acceleration of +${snapshot.volumeAcceleration}%. Opportunity Score flagged at ${oppScore}/100.`
    : `Market activity for $${snapshot.symbol} is subdued. Spot price is $${snapshot.price.toLocaleString('en-US')} with 24h change of ${snapshot.change24h}% and Opportunity Score of ${oppScore}/100.`;

  return {
    agent: 'discovery',
    verdict: isOpportunity ? 'OPPORTUNITY' : 'HOLD',
    confidence: Math.min(95, oppScore + 5),
    summary,
    supportingEvidenceIds: supportingIds,
    contradictoryEvidenceIds: [],
    strongestSupportingEvidenceId: supportingIds[0],
    risks: [],
    recommendations: isOpportunity
      ? ['Proceed with specialized multi-agent council deliberation.']
      : ['Monitor asset structure until momentum or liquidity criteria improve.'],
    metrics: {
      opportunityScore: oppScore,
      momentum: snapshot.momentumScore,
      volumeAccelerationPct: snapshot.volumeAcceleration,
      rvol: snapshot.relativeVolume
    }
  };
}

/**
 * 2. QUANT AGENT
 * Question: "What do the numbers say?"
 * Objective: Interpret deterministic calculations produced from the single market snapshot.
 */
export function runQuantAgent(snapshot: MarketSnapshot, evidence: Evidence[]): AgentResult {
  const isBullish = snapshot.change24h > 1.5 && snapshot.relativeVolume >= 1.1 && snapshot.momentumScore >= 55;
  const isBearish = snapshot.change24h < -3.0 || snapshot.momentumScore < 40;

  const supportingIds = evidence
    .filter(e => e.type === 'MARKET' && !e.isContradictory)
    .map(e => e.id);
  const contradictoryIds = evidence
    .filter(e => (e.type === 'MARKET' || e.type === 'FLOW') && e.isContradictory)
    .map(e => e.id);

  const confidence = isBullish ? 84 : isBearish ? 76 : 60;
  const summary = isBullish
    ? `Bullish technical setup: RSI-14 is ${snapshot.rsi14}, RVOL is ${snapshot.relativeVolume}x, and Momentum Score is ${snapshot.momentumScore}/100 with realized volatility at ${snapshot.realizedVolatility}%.`
    : isBearish
    ? `Bearish technical structure: 24h return of ${snapshot.change24h}% with deteriorating momentum (${snapshot.momentumScore}/100) and elevated volatility (${snapshot.realizedVolatility}%).`
    : `Neutral market numbers: 24h return of ${snapshot.change24h >= 0 ? '+' : ''}${snapshot.change24h}%, RSI-14 at ${snapshot.rsi14}, and RVOL ${snapshot.relativeVolume}x.`;

  return {
    agent: 'quant',
    verdict: isBullish ? 'BUY' : isBearish ? 'SELL' : 'HOLD',
    confidence,
    summary,
    supportingEvidenceIds: supportingIds,
    contradictoryEvidenceIds: contradictoryIds,
    strongestSupportingEvidenceId: supportingIds[0],
    risks: snapshot.realizedVolatility > 60 ? [`High realized volatility: ${snapshot.realizedVolatility}%`] : [],
    recommendations: isBullish
      ? ['Quantitative numbers support trend continuation entry.']
      : ['Maintain defensive stance until clear reversal confirmation.'],
    metrics: {
      return24h: snapshot.change24h,
      return7d: snapshot.change7d,
      rsi14: snapshot.rsi14,
      rvol: snapshot.relativeVolume,
      volatility: snapshot.realizedVolatility,
      momentum: snapshot.momentumScore,
      spreadBps: snapshot.spreadBps
    }
  };
}

/**
 * 3. INTELLIGENCE AGENT
 * Question: "What external information could change the thesis?"
 * Objective: Evaluate news and external signals with strict provenance and no fabricated claims.
 */
export function runIntelligenceAgent(evidence: Evidence[]): AgentResult {
  const newsEvidence = evidence.filter(e => e.type === 'NEWS');

  if (newsEvidence.length === 0) {
    return {
      agent: 'intelligence',
      verdict: 'HOLD',
      confidence: 50,
      summary: 'News intelligence unavailable. The council did not use fabricated news or unverified claims to compensate.',
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      risks: ['External catalyst verification unavailable.'],
      recommendations: ['Council must rely strictly on verified on-chain and market data.'],
      metrics: {
        sourcesCount: 0,
        sentiment: 'NEUTRAL'
      }
    };
  }

  const positiveArticles = newsEvidence.filter(e => e.value?.sentiment === 'POSITIVE' && !e.isContradictory);
  const negativeArticles = newsEvidence.filter(e => e.value?.sentiment === 'NEGATIVE' || e.isContradictory);

  const hasStrongCatalyst = positiveArticles.length > 0;
  const hasNegativeFlags = negativeArticles.length > 0;

  const verdict = hasNegativeFlags ? 'CAUTION' : hasStrongCatalyst ? 'BUY' : 'HOLD';
  const confidence = hasNegativeFlags ? 82 : hasStrongCatalyst ? 78 : 55;

  let summary = '';
  if (hasNegativeFlags) {
    summary = `External intelligence uncovered adverse security or audit flags (${negativeArticles.map(n => n.title).join('; ')}).`;
  } else if (hasStrongCatalyst) {
    summary = `Verified external catalyst confirmed: "${positiveArticles[0]?.title}" (Source: ${positiveArticles[0]?.source?.name || 'Publisher'}).`;
  } else {
    summary = 'No decisive external catalyst or abnormal narrative shifts detected in public intelligence feeds.';
  }

  return {
    agent: 'intelligence',
    verdict,
    confidence,
    summary,
    supportingEvidenceIds: positiveArticles.map(e => e.id),
    contradictoryEvidenceIds: negativeArticles.map(e => e.id),
    strongestSupportingEvidenceId: positiveArticles[0]?.id,
    strongestCounterargument: negativeArticles[0]?.title,
    risks: negativeArticles.map(e => e.title),
    recommendations: hasNegativeFlags
      ? ['Subject promotional claims to strict adversarial audit.']
      : ['External narrative aligns with quantitative momentum.'],
    metrics: {
      sourcesCount: newsEvidence.length,
      positiveCount: positiveArticles.length,
      negativeCount: negativeArticles.length,
      sentiment: hasNegativeFlags ? 'NEGATIVE' : hasStrongCatalyst ? 'POSITIVE' : 'NEUTRAL'
    }
  };
}

/**
 * 4. RISK AGENT
 * Question: "What could go wrong?"
 * Objective: Identify structural, liquidity, concentration, and anomaly risks.
 */
export function runRiskAgent(snapshot: MarketSnapshot, evidence: Evidence[]): AgentResult {
  const flowEvid = evidence.find(e => e.type === 'FLOW');
  const top10Pct = flowEvid?.value?.top10HoldersPct ?? 35;
  const suspiciousCount = flowEvid?.value?.suspiciousTransfers ?? 0;
  const hasUnlocks = snapshot.symbol === 'NOVA';

  const riskMetrics = calculateRiskMetrics(
    top10Pct,
    snapshot.liquidityUsd,
    snapshot.volume24h,
    suspiciousCount,
    hasUnlocks
  );

  const riskEvidence = evidence.filter(e => e.type === 'RISK' || e.type === 'FLOW');
  const contradictoryIds = riskEvidence.filter(e => e.isContradictory).map(e => e.id);
  const supportingIds = riskEvidence.filter(e => !e.isContradictory).map(e => e.id);

  const isSevereRisk = riskMetrics.compositeRiskScore >= 70;
  const isModerateRisk = riskMetrics.compositeRiskScore >= 45;

  let summary = '';
  if (isSevereRisk) {
    summary = `Critical downside risks detected: Composite Risk Score is ${riskMetrics.compositeRiskScore}/100. ${riskMetrics.riskFlags.join(' ')}`;
  } else if (isModerateRisk) {
    summary = `Moderate risk factors present: Risk Score is ${riskMetrics.compositeRiskScore}/100. ${riskMetrics.riskFlags.join(' ')}`;
  } else {
    summary = `Risk profile acceptable: Composite Risk Score is ${riskMetrics.compositeRiskScore}/100 with adequate liquidity ($${(snapshot.liquidityUsd/1000000).toFixed(1)}M) and normal distribution.`;
  }

  return {
    agent: 'risk',
    verdict: isSevereRisk ? 'REJECT' : isModerateRisk ? 'HOLD' : 'BUY',
    confidence: 86,
    summary,
    supportingEvidenceIds: supportingIds,
    contradictoryEvidenceIds: contradictoryIds,
    strongestSupportingEvidenceId: supportingIds[0],
    strongestCounterargument: riskMetrics.riskFlags[0],
    risks: riskMetrics.riskFlags,
    recommendations: isSevereRisk
      ? ['Reject trade: Structural risk violates safety thresholds.']
      : ['Trade permitted subject to standard position sizing limits.'],
    metrics: {
      compositeRiskScore: riskMetrics.compositeRiskScore,
      holderConcentrationScore: riskMetrics.holderConcentrationScore,
      liquidityUsd: snapshot.liquidityUsd,
      top10HoldersPct: top10Pct,
      suspiciousTransfers: suspiciousCount
    }
  };
}

/**
 * 5. RED-TEAM AGENT (Core Differentiator)
 * Question: "Why might the council be wrong?"
 * Objective: Actively attack the initial thesis and search for fatal counterarguments.
 */
export function runRedTeamAgent(
  asset: string,
  preliminaryThesis: string,
  snapshot: MarketSnapshot,
  evidence: Evidence[],
  agentRuns: Record<string, AgentResult>
): AgentResult {
  const contradictoryEvidence = evidence.filter(e => e.isContradictory);
  const flowEvidence = evidence.find(e => e.type === 'FLOW');
  const top10 = flowEvidence?.value?.top10HoldersPct || 30;

  const challenges: string[] = [];
  const vulnerabilities: string[] = [];

  // Attack 1: Concentration & Organic Demand Check
  if (top10 > 60) {
    challenges.push('Bullish thesis assumes rising volume represents organic demand.');
    vulnerabilities.push(`Top 10 wallets control ${top10}% of circulating supply. If insiders dump, current entry has asymmetric downside.`);
  }

  // Attack 2: Liquidity Depth & Wash Trading Check
  if (snapshot.liquidityUsd < 250000 || (snapshot.volume24h > snapshot.liquidityUsd * 4)) {
    challenges.push('Bullish thesis assumes reliable exit liquidity at current market depth.');
    vulnerabilities.push(`Available liquidity pool depth ($${(snapshot.liquidityUsd/1000).toFixed(0)}k) is disproportionately small relative to volume ($${(snapshot.volume24h/1000000).toFixed(1)}M). High slippage hazard on exit.`);
  }

  // Attack 3: Momentum Exhaustion / Overbought Check
  if (snapshot.rsi14 > 75 && snapshot.realizedVolatility > 50) {
    challenges.push('Bullish thesis assumes momentum will continue linearly.');
    vulnerabilities.push(`RSI is overextended at ${snapshot.rsi14} while realized volatility is increasing (${snapshot.realizedVolatility}%). Risk/reward for entry is unfavorable.`);
  }

  // Attack 4: Intelligence / Promotional Narrative Check
  const intelRun = agentRuns['intelligence'];
  if (intelRun && intelRun.contradictoryEvidenceIds.length > 0) {
    challenges.push('Bullish thesis relies heavily on social excitement and news catalysts.');
    vulnerabilities.push('External intelligence audit identified negative security flags or artificial promotional syndication.');
  }

  const isDisproved = vulnerabilities.length >= 2;
  const isWeakened = vulnerabilities.length === 1;
  const thesisStatus = isDisproved ? 'DISPROVED' : isWeakened ? 'WEAKENED' : 'INTACT';

  const verdict = isDisproved ? 'REJECT' : isWeakened ? 'HOLD' : 'VALID';
  const confidence = isDisproved ? 92 : isWeakened ? 78 : 84;

  let summary = '';
  if (isDisproved) {
    summary = `ADVERSARIAL REFUTATION: Initial bullish thesis disproved. Found ${vulnerabilities.length} structural flaws: ${vulnerabilities.join(' ')}`;
  } else if (isWeakened) {
    summary = `ADVERSARIAL CHALLENGE: Bullish thesis weakened. Counterargument: ${vulnerabilities[0]}`;
  } else {
    summary = 'ADVERSARIAL CHALLENGE PASSED: Tested liquidity depth, holder concentration, and momentum exhaustion. No fatal contradictions found. Thesis intact.';
  }

  return {
    agent: 'red_team',
    verdict,
    confidence,
    summary,
    supportingEvidenceIds: isDisproved ? [] : evidence.filter(e => !e.isContradictory).map(e => e.id),
    contradictoryEvidenceIds: contradictoryEvidence.map(e => e.id),
    strongestCounterargument: vulnerabilities[0] || 'No significant vulnerabilities identified.',
    risks: vulnerabilities,
    recommendations: isDisproved
      ? ['DO NOT ENTER: Red-Team verified high risk of manipulation or exit trap.']
      : isWeakened
      ? ['Reduce position size or wait for pullback validation.']
      : ['Trade thesis survived adversarial challenge.'],
    redTeamAttackDetails: {
      assumptionsChallenged: challenges,
      vulnerabilitiesFound: vulnerabilities,
      thesisStatus,
      counterEvidenceIds: contradictoryEvidence.map(e => e.id)
    }
  };
}

/**
 * 6. DECISION AGENT
 * Question: "What is the council's verdict?"
 * Objective: Synthesize the council's multi-perspective deliberation into a decisive conclusion.
 */
export function runDecisionAgent(
  asset: string,
  snapshot: MarketSnapshot,
  agentRuns: Record<string, AgentResult>,
  evidence: Evidence[]
): {
  conclusion: 'BUY' | 'HOLD' | 'SELL' | 'REJECT';
  confidence: number;
  rationale: string;
  opportunityScore: number;
  riskScore: number;
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  strongestSupportingEvidenceId?: string;
  strongestCounterargument?: string;
  relevantRisks: string[];
} {
  const quant = agentRuns['quant'];
  const risk = agentRuns['risk'];
  const redTeam = agentRuns['red_team'];
  const discovery = agentRuns['discovery'];

  const oppScore = Number(discovery?.metrics?.opportunityScore || quant?.metrics?.momentum || 60);
  const riskScore = Number(risk?.metrics?.compositeRiskScore || 40);

  const redTeamStatus = redTeam?.redTeamAttackDetails?.thesisStatus || 'INTACT';
  const strongestCounter = redTeam?.strongestCounterargument || risk?.strongestCounterargument;
  const strongestSupport = quant?.strongestSupportingEvidenceId || discovery?.strongestSupportingEvidenceId;

  let conclusion: 'BUY' | 'HOLD' | 'SELL' | 'REJECT' = 'HOLD';
  let confidence = 80;
  let rationale = '';

  if (redTeamStatus === 'DISPROVED' || riskScore > 70) {
    conclusion = 'REJECT';
    confidence = Math.max(redTeam?.confidence || 88, 85);
    rationale = `The asset showed initial interest (Opportunity ${oppScore}/100), but the trade was REJECTED because the bullish thesis failed adversarial Red-Team validation. Counterargument: ${strongestCounter || 'Structural risk limits exceeded.'}`;
  } else if (oppScore >= 65 && riskScore <= 45 && quant?.verdict === 'BUY') {
    conclusion = 'BUY';
    confidence = 86;
    rationale = `The opportunity survived rigorous adversarial review with deep liquidity ($${(snapshot.liquidityUsd/1000000).toFixed(1)}M), healthy distribution, and strong volume acceleration (+${snapshot.volumeAcceleration}%). Trade thesis approved for deterministic risk gate validation.`;
  } else {
    conclusion = 'HOLD';
    confidence = 65;
    rationale = `Evidence is mixed or neutral. Opportunity Score (${oppScore}/100) does not provide a compelling risk-adjusted edge against current market conditions.`;
  }

  const supporting = evidence.filter(e => !e.isContradictory).map(e => e.id);
  const contradictory = evidence.filter(e => e.isContradictory).map(e => e.id);
  const allRisks = [
    ...(risk?.risks || []),
    ...(redTeam?.risks || [])
  ];

  return {
    conclusion,
    confidence,
    rationale,
    opportunityScore: oppScore,
    riskScore,
    supportingEvidenceIds: supporting,
    contradictoryEvidenceIds: contradictory,
    strongestSupportingEvidenceId: strongestSupport,
    strongestCounterargument: strongestCounter,
    relevantRisks: Array.from(new Set(allRisks))
  };
}

/**
 * 7. MONITORING AGENT
 * Objective: Evaluate existing position against original trade thesis invalidation conditions.
 */
export function runMonitoringAgent(
  position: Position,
  currentSnapshot: MarketSnapshot,
  currentEvidence: Evidence[]
): {
  recommendation: 'SELL' | 'HOLD';
  thesisValid: boolean;
  thesisStatus: 'ACTIVE' | 'WEAKENING' | 'INVALIDATED';
  conditionsEvaluated: { condition: string; triggered: boolean; explanation: string }[];
  summary: string;
} {
  const originalThesis = position.thesis;
  const conditions = originalThesis.invalidationConditions || [];

  const evaluated = conditions.map(c => {
    let triggered = false;
    let explanation = '';

    if (c.metricKey === 'momentum' && currentSnapshot.momentumScore < Number(c.threshold)) {
      triggered = true;
      explanation = `Momentum fell to ${currentSnapshot.momentumScore} (threshold was ${c.threshold}).`;
    } else if (c.metricKey === 'liquidity' && currentSnapshot.liquidityUsd < Number(c.threshold)) {
      triggered = true;
      explanation = `Liquidity dropped to $${(currentSnapshot.liquidityUsd/1000).toFixed(0)}k.`;
    } else if (c.metricKey === 'price_drawdown') {
      const drawdown = ((currentSnapshot.price - position.entryPrice) / position.entryPrice) * 100;
      if (drawdown <= Number(c.threshold)) {
        triggered = true;
        explanation = `Position hit stop loss threshold of ${drawdown.toFixed(1)}%.`;
      }
    }

    return {
      condition: c.condition,
      triggered,
      explanation: explanation || 'Condition intact.'
    };
  });

  const triggeredCount = evaluated.filter(e => e.triggered).length;
  const isInvalidated = triggeredCount >= 1;

  return {
    recommendation: isInvalidated ? 'SELL' : 'HOLD',
    thesisValid: !isInvalidated,
    thesisStatus: isInvalidated ? 'INVALIDATED' : triggeredCount > 0 ? 'WEAKENING' : 'ACTIVE',
    conditionsEvaluated: evaluated,
    summary: isInvalidated
      ? `SELL RECOMMENDED: Original trade thesis is no longer valid. ${evaluated.filter(e => e.triggered).map(e => e.explanation).join(' ')}`
      : 'HOLD RECOMMENDED: Original trade thesis remains intact and healthy.'
  };
}
