import { MarketSnapshot } from '../types';
import { PaperPosition } from '../portfolio/types';
import {
  ThesisHealth,
  ThesisHealthState,
  ThesisProvenance,
  InvalidationFinding,
  MonitoringOptions,
  InvalidationRule
} from './types';
import { storage } from '../storage';
import { normalizeScanSymbol } from '../scanner/universe';
import { calculateRiskMetrics } from '../risk';

// ---------------------------------------------------------------------------
// Phase 6C: Deterministic Thesis Health & Invalidation Engine
// INVARIANT: Deterministic calculations only. Zero stochastic randomness.
// ---------------------------------------------------------------------------

const DEFAULT_DRAWDOWN_LIMIT_PCT = -5.0; // -5.0% maximum adverse price excursion
const DEFAULT_MOMENTUM_MIN = 40;         // Minimum momentum score to maintain thesis
const DEFAULT_LIQUIDITY_MIN_USD = 200000;// Minimum liquidity depth threshold ($200k)
const DEFAULT_RISK_SCORE_MAX = 75;       // Maximum allowable risk score

/**
 * Resolves original thesis provenance for a monitored paper position.
 */
export function resolveThesisProvenance(
  position: PaperPosition
): ThesisProvenance {
  const cleanSymbol = normalizeScanSymbol(position.symbol);
  const allInvestigations = storage.getAllInvestigations();

  // Find most recent completed investigation for this symbol
  const inv = allInvestigations.find(
    i => normalizeScanSymbol(i.asset) === cleanSymbol && i.status === 'COMPLETED'
  );

  const defaultRules: InvalidationRule[] = [
    { condition: 'Price drawdown reaches -5.0%', metricKey: 'price_drawdown', threshold: DEFAULT_DRAWDOWN_LIMIT_PCT, operator: '<=' },
    { condition: 'Momentum score falls below 40', metricKey: 'momentum', threshold: DEFAULT_MOMENTUM_MIN, operator: '<' },
    { condition: 'Liquidity pool drops below $200k', metricKey: 'liquidity', threshold: DEFAULT_LIQUIDITY_MIN_USD, operator: '<' },
    { condition: 'Composite risk score exceeds 75', metricKey: 'risk_score', threshold: DEFAULT_RISK_SCORE_MAX, operator: '>' }
  ];

  if (!inv) {
    return {
      entryPrice: position.avgEntryPrice || position.currentPrice || 100,
      entryTimestamp: position.retrievedAt || new Date().toISOString(),
      invalidationRules: defaultRules,
      status: 'UNAVAILABLE'
    };
  }

  const thesis = storage.getThesis(`THESIS-${inv.id}`);
  const customRules: InvalidationRule[] = thesis?.invalidationConditions?.map(c => ({
    condition: c.condition,
    metricKey: c.metricKey,
    threshold: c.threshold,
    operator: '<='
  })) || defaultRules;

  return {
    investigationId: inv.id,
    thesisId: thesis?.id || `THESIS-${inv.id}`,
    originalVerdict: inv.decision?.conclusion,
    originalOpportunityScore: inv.decision?.opportunityScore,
    originalRiskScore: inv.decision?.riskScore,
    entryPrice: position.avgEntryPrice || position.currentPrice || 100,
    entryTimestamp: position.retrievedAt || new Date().toISOString(),
    invalidationRules: customRules.length > 0 ? customRules : defaultRules,
    status: 'FOUND'
  };
}

/**
 * Evaluates thesis health, detects invalidation triggers, and computes
 * deterministic health score.
 */
export function evaluateThesisHealth(
  position: PaperPosition,
  currentSnapshot?: MarketSnapshot,
  provenance?: ThesisProvenance,
  options?: MonitoringOptions
): ThesisHealth {
  const now = new Date().toISOString();
  const cleanSymbol = normalizeScanSymbol(position.symbol);
  const prov = provenance || resolveThesisProvenance(position);
  const findings: InvalidationFinding[] = [];

  const entryPrice = position.avgEntryPrice || position.currentPrice || prov.entryPrice || 100;
  const currentPrice = currentSnapshot?.price || position.currentPrice || entryPrice;

  // Compute Position P&L %
  let pnlPercent = 0;
  if (entryPrice > 0) {
    if (position.side === 'short') {
      pnlPercent = Number((((entryPrice - currentPrice) / entryPrice) * 100).toFixed(2));
    } else {
      pnlPercent = Number((((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2));
    }
  }

  // 1. Data Availability Validation (Fail-Closed Check)
  if (!currentSnapshot) {
    findings.push({
      category: 'DATA_UNAVAILABLE',
      metricKey: 'snapshot',
      currentValue: 'NULL',
      thresholdValue: 'EXISTS',
      message: `Market data snapshot unavailable for ${cleanSymbol}. Monitoring halted safely.`,
      severity: 'CRITICAL',
      detectedAt: now
    });

    return {
      symbol: cleanSymbol,
      status: 'ERROR',
      score: 0,
      provenance: prov,
      findings,
      currentSnapshot,
      pnlPercent,
      evaluatedAt: now,
      summary: `MONITORING_ERROR: Market data unavailable for ${cleanSymbol}. Cannot verify thesis health.`
    };
  }

  // 2. Broker State Integrity Check
  if (position.quantity <= 0 || !Number.isFinite(position.quantity)) {
    findings.push({
      category: 'BROKER_STATE_MISMATCH',
      metricKey: 'quantity',
      currentValue: position.quantity,
      thresholdValue: '> 0',
      message: `Broker reported invalid position quantity (${position.quantity}) for ${cleanSymbol}.`,
      severity: 'CRITICAL',
      detectedAt: now
    });
  }

  // 3. Price Drawdown Invalidation (Stop Loss Barrier)
  const drawdownLimit = options?.invalidationPriceDrawdownPct ?? DEFAULT_DRAWDOWN_LIMIT_PCT;
  if (pnlPercent <= drawdownLimit) {
    findings.push({
      category: 'PRICE_DRAWDOWN',
      metricKey: 'price_drawdown',
      currentValue: pnlPercent,
      thresholdValue: drawdownLimit,
      message: `Price drawdown of ${pnlPercent}% breached protective threshold (${drawdownLimit}%).`,
      severity: 'CRITICAL',
      detectedAt: now
    });
  }

  // 4. Momentum Reversal Invalidation
  const momentumLimit = options?.invalidationMomentumThreshold ?? DEFAULT_MOMENTUM_MIN;
  const momScore = currentSnapshot.momentumScore;
  if (momScore < momentumLimit) {
    findings.push({
      category: 'MOMENTUM_REVERSAL',
      metricKey: 'momentumScore',
      currentValue: momScore,
      thresholdValue: momentumLimit,
      message: `Momentum collapsed to ${momScore}/100 (Minimum required: ${momentumLimit}).`,
      severity: 'CRITICAL',
      detectedAt: now
    });
  }

  // 5. Liquidity Deterioration Invalidation
  const liquidityLimit = options?.invalidationLiquidityThresholdUsd ?? DEFAULT_LIQUIDITY_MIN_USD;
  const liqUsd = currentSnapshot.liquidityUsd;
  if (liqUsd < liquidityLimit) {
    findings.push({
      category: 'LIQUIDITY_DETERIORATION',
      metricKey: 'liquidityUsd',
      currentValue: liqUsd,
      thresholdValue: liquidityLimit,
      message: `Liquidity pool depth dropped to $${(liqUsd / 1000).toFixed(0)}k (Minimum required: $${(liquidityLimit / 1000).toFixed(0)}k).`,
      severity: 'CRITICAL',
      detectedAt: now
    });
  }

  // 6. Risk Score Deterioration
  const riskLimit = options?.invalidationRiskScoreThreshold ?? DEFAULT_RISK_SCORE_MAX;
  const riskScore = (currentSnapshot as any).riskScore ?? calculateRiskMetrics(35, currentSnapshot.liquidityUsd, currentSnapshot.volume24h, 0, false).compositeRiskScore;
  if (riskScore > riskLimit) {
    findings.push({
      category: 'RISK_GATE_VIOLATION',
      metricKey: 'riskScore',
      currentValue: riskScore,
      thresholdValue: riskLimit,
      message: `Composite risk score surged to ${riskScore}/100 (Maximum allowed: ${riskLimit}).`,
      severity: 'CRITICAL',
      detectedAt: now
    });
  }

  // 7. Volatility Surge (Warning Finding)
  if (currentSnapshot.realizedVolatility > 55) {
    findings.push({
      category: 'VOLATILITY_SURGE',
      metricKey: 'realizedVolatility',
      currentValue: currentSnapshot.realizedVolatility,
      thresholdValue: 55,
      message: `Elevated market volatility (${currentSnapshot.realizedVolatility}%). Position thesis under stress.`,
      severity: 'WARNING',
      detectedAt: now
    });
  }

  // Deterministic Health Score Calculation (0 - 100)
  let score = 100;
  for (const f of findings) {
    if (f.severity === 'CRITICAL') {
      score -= 35;
    } else {
      score -= 15;
    }
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  // State Evaluation
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const warningCount = findings.filter(f => f.severity === 'WARNING').length;

  let status: ThesisHealthState = 'HEALTHY';
  if (criticalCount > 0) {
    status = 'INVALIDATED';
  } else if (warningCount > 0 || score < 70) {
    status = 'DEGRADED';
  } else {
    status = 'HEALTHY';
  }

  // Construct Summary
  let summary = '';
  if (status === 'INVALIDATED') {
    const reasons = findings.filter(f => f.severity === 'CRITICAL').map(f => f.message).join(' ');
    summary = `THESIS_INVALIDATED: Original entry thesis is broken (${criticalCount} critical violation(s)). ${reasons}`;
  } else if (status === 'DEGRADED') {
    const warnings = findings.map(f => f.message).join(' ');
    summary = `THESIS_DEGRADED: Thesis health degraded to ${score}/100. ${warnings}`;
  } else {
    summary = `THESIS_HEALTHY: Position remains well-supported by original quantitative thesis (Health: ${score}/100, P&L: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent}%).`;
  }

  return {
    symbol: cleanSymbol,
    status,
    score,
    provenance: prov,
    findings,
    currentSnapshot,
    pnlPercent,
    evaluatedAt: now,
    summary
  };
}
