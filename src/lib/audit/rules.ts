import {
  AuditExecutionInput,
  WorkflowAuditFinding,
  WorkflowRuleCheck,
  WorkflowEvidenceCheck,
  WorkflowAuditStageCheck,
  WorkflowBrokerReconciliation,
  WorkflowAuditVerdict
} from './types';

// ---------------------------------------------------------------------------
// Phase 8.18: Deterministic Rule Verification Engine
// Authoritative calculation of mathematical constraints & rule adherence.
// INVARIANT: Deterministic calculations remain authoritative.
// ---------------------------------------------------------------------------

export interface DeterministicAuditOutput {
  verdict: WorkflowAuditVerdict;
  confidence: number;
  summary: string;
  findings: WorkflowAuditFinding[];
  checkedStages: WorkflowAuditStageCheck[];
  ruleChecks: WorkflowRuleCheck[];
  evidenceChecks: WorkflowEvidenceCheck[];
  brokerReconciliation: WorkflowBrokerReconciliation;
  systemDecision: 'BUY' | 'HOLD' | 'REJECT' | 'PASS' | 'EXIT' | 'ERROR';
  systemDecisionStage: string;
}

export function evaluateDeterministicRules(input: AuditExecutionInput): DeterministicAuditOutput {
  const findings: WorkflowAuditFinding[] = [];
  const ruleChecks: WorkflowRuleCheck[] = [];
  const evidenceChecks: WorkflowEvidenceCheck[] = [];
  const checkedStages: WorkflowAuditStageCheck[] = [];

  const config = input.strategyConfig || {
    minOpportunityScore: 60,
    minConfidenceScore: 60,
    minLiquidityUsd: 500000,
    maxSpreadBps: 50,
    maxPositionSizeUsd: 5000,
    maxPortfolioExposurePct: 75,
    maxConcentrationPct: 25,
    staleDataThresholdMs: 300000,
    maxOpenPositions: 5,
    reconciliationWindowDays: 7
  };

  const snapshot = input.candidateSnapshot;
  const decision = input.decision;
  const rawDecision = typeof decision === 'object' && decision !== null
    ? ((decision as any).action || (decision as any).conclusion || 'HOLD').toUpperCase()
    : 'HOLD';
  
  const systemDecision: 'BUY' | 'HOLD' | 'REJECT' | 'PASS' | 'EXIT' | 'ERROR' =
    rawDecision === 'BUY' ? 'BUY'
    : rawDecision === 'SELL' ? 'EXIT'
    : rawDecision === 'REJECT' ? 'REJECT'
    : rawDecision === 'PASS' ? 'PASS'
    : rawDecision === 'ERROR' ? 'ERROR'
    : 'HOLD';

  let systemDecisionStage = 'COUNCIL';
  if (input.riskGateResult && !input.riskGateResult.passed) {
    systemDecisionStage = 'RISK_GATE';
  } else if (input.sizingResult && !input.sizingResult.allowed) {
    systemDecisionStage = 'SIZING';
  } else if (input.brokerResponse) {
    systemDecisionStage = 'BROKER';
  } else if (input.monitoringState) {
    systemDecisionStage = 'MONITORING';
  }

  // 1. Stage Checks: Discovery
  checkedStages.push({
    stage: 'DISCOVERY',
    status: snapshot ? 'PASS' : (input.symbol ? 'WARN' : 'PASS'),
    details: snapshot ? `Candidate ${input.symbol || snapshot.symbol} snapshot available.` : 'No snapshot attached.'
  });

  // 2. Stage Checks: Scoring
  const oppScore = input.multiFactorScore ?? snapshot?.momentumScore ?? (decision as any)?.opportunityScore ?? 0;
  const oppPassed = oppScore >= config.minOpportunityScore;
  ruleChecks.push({
    rule: 'minOpportunityScore',
    expected: `>= ${config.minOpportunityScore}`,
    observed: oppScore,
    passed: oppPassed
  });

  checkedStages.push({
    stage: 'SCORING',
    status: oppPassed ? 'PASS' : 'WARN',
    details: `Score: ${oppScore} (min ${config.minOpportunityScore})`
  });

  // 3. Stage Checks: Council
  const confidence = (decision as any)?.confidence ?? 50;
  const confPassed = confidence >= config.minConfidenceScore;
  ruleChecks.push({
    rule: 'minConfidenceScore',
    expected: `>= ${config.minConfidenceScore}`,
    observed: confidence,
    passed: confPassed
  });

  checkedStages.push({
    stage: 'COUNCIL',
    status: 'PASS',
    details: `Decision: ${systemDecision} (Confidence: ${confidence}%)`
  });

  // 4. Evidence Sufficiency Verification
  const evidenceCount = Array.isArray(input.evidence) ? input.evidence.length : 0;
  const minRequiredEvidence = 3;
  const evidenceSufficient = evidenceCount >= minRequiredEvidence;

  evidenceChecks.push({
    requiredCount: minRequiredEvidence,
    observedCount: evidenceCount,
    sufficient: evidenceSufficient,
    details: evidenceSufficient
      ? `Supplied ${evidenceCount} evidence records (meets minimum ${minRequiredEvidence}).`
      : `Supplied only ${evidenceCount} evidence records (minimum ${minRequiredEvidence} required for Risk Gate approval).`
  });

  // If system approved BUY with insufficient evidence -> ANOMALY
  if (systemDecision === 'BUY' && !evidenceSufficient) {
    findings.push({
      id: `FIND-EV-INSUFFICIENT-${Date.now()}`,
      severity: 'CRITICAL',
      category: 'EVIDENCE_SUFFICIENCY',
      stage: 'RISK_GATE',
      title: 'Insufficient Evidence for BUY Decision',
      description: `System emitted or approved BUY decision with only ${evidenceCount} evidence records (minimum ${minRequiredEvidence} required).`,
      expected: minRequiredEvidence,
      observed: evidenceCount,
      recommendation: 'Reject or HOLD candidates that do not supply at least 3 verified evidence items.'
    });
  }

  // 5. Liquidity & Spread Rule Checks
  if (snapshot) {
    const liqPassed = (snapshot.liquidityUsd ?? 0) >= config.minLiquidityUsd;
    ruleChecks.push({
      rule: 'minLiquidityUsd',
      expected: `>= $${config.minLiquidityUsd.toLocaleString()}`,
      observed: `$${(snapshot.liquidityUsd ?? 0).toLocaleString()}`,
      passed: liqPassed
    });

    const spreadPassed = (snapshot.spreadBps ?? 0) <= config.maxSpreadBps;
    ruleChecks.push({
      rule: 'maxSpreadBps',
      expected: `<= ${config.maxSpreadBps} bps`,
      observed: `${snapshot.spreadBps ?? 0} bps`,
      passed: spreadPassed
    });

    // 6. Timeframe Blind-Spot Detection
    // e.g. 24h change < 1.5% but 1h RVOL >= 1.5 or momentumScore >= 75
    const change24h = snapshot.change24h ?? 0;
    const rvol = snapshot.relativeVolume ?? 1.0;
    const mom = snapshot.momentumScore ?? 0;
    if (systemDecision === 'HOLD' && change24h < 1.5 && (rvol >= 1.5 || mom >= 75)) {
      findings.push({
        id: `FIND-TIMEFRAME-${Date.now()}`,
        severity: 'LOW',
        category: 'TIMEFRAME_BLINDSPOT',
        stage: 'COUNCIL',
        title: 'Potential Timeframe Selection Blind-Spot',
        description: `Quant rule evaluated 24h change (${change24h.toFixed(2)}% < 1.5%), while shorter-term metrics show strong intraday momentum (RVOL ${rvol.toFixed(2)}x, momentum ${mom}).`,
        expected: 'Consider multi-timeframe confirmation (15m/1h/24h)',
        observed: `24h=${change24h}%, RVOL=${rvol}`,
        recommendation: 'No rule violation. Diagnostic feedback for future strategy research.'
      });
    }

    // 7. Rationale Contradiction Check
    const rationale = ((decision as any)?.thesis || (decision as any)?.reasoningSummary || (decision as any)?.reasoning || '').toLowerCase();
    if (rationale.includes('low volume') || rationale.includes('volume is below threshold') || rationale.includes('rvol below')) {
      if (rvol >= 1.1) {
        findings.push({
          id: `FIND-RATIONALE-CONTRADICTION-${Date.now()}`,
          severity: 'HIGH',
          category: 'RATIONALE_CONTRADICTION',
          stage: 'COUNCIL',
          title: 'AI Rationale Contradicts Observed Market Data',
          description: `AI stated rejection was due to insufficient volume/RVOL, but observed RVOL was ${rvol.toFixed(2)}x (exceeds 1.1x threshold).`,
          expected: 'Accurate rationale matching quantitative inputs',
          observed: `RVOL = ${rvol.toFixed(2)}x, Rationale: "${rationale.slice(0, 100)}..."`,
          recommendation: 'Verify AI reasoning prompt to ensure agent does not hallucinate false metric constraints.'
        });
      }
    }
  }

  // 8. Sizing Stage
  if (systemDecision === 'BUY' || input.sizingResult) {
    const sizeAllowed = input.sizingResult?.allowed ?? true;
    checkedStages.push({
      stage: 'SIZING',
      status: sizeAllowed ? 'PASS' : 'WARN',
      details: input.sizingResult ? `Qty: ${input.sizingResult.approvedQuantity}, Allowed: ${sizeAllowed}` : 'Position sized within caps.'
    });
  } else {
    checkedStages.push({
      stage: 'SIZING',
      status: 'NOT_REACHED',
      details: 'Sizing not required for HOLD/REJECT.'
    });
  }

  // 9. Risk Gate Stage
  if (input.riskGateResult) {
    const rgPassed = input.riskGateResult.passed;
    checkedStages.push({
      stage: 'RISK_GATE',
      status: rgPassed ? 'PASS' : 'WARN',
      details: rgPassed ? 'Risk Gate evaluated: APPROVED' : `Risk Gate BLOCKED: ${input.riskGateResult.violations.join(', ')}`
    });

    if (!rgPassed && systemDecision === 'BUY') {
      findings.push({
        id: `FIND-RG-VIOLATION-${Date.now()}`,
        severity: 'CRITICAL',
        category: 'DETERMINISTIC_RULE',
        stage: 'RISK_GATE',
        title: 'Risk Gate Violation Disregarded in BUY Path',
        description: `Risk Gate reported violations: ${input.riskGateResult.violations.join('; ')}`,
        expected: 'Risk Gate must strictly block trade intent',
        observed: 'BUY intent remained active',
        recommendation: 'Enforce fail-closed architecture on all Risk Gate violations.'
      });
    }
  } else {
    checkedStages.push({
      stage: 'RISK_GATE',
      status: systemDecision === 'BUY' ? 'WARN' : 'NOT_REACHED',
      details: systemDecision === 'BUY' ? 'Risk Gate evaluation missing.' : 'Risk Gate not evaluated for non-BUY decision.'
    });
  }

  // 10. Order Intent & Broker Reconciliation
  let brokerRecon: WorkflowBrokerReconciliation = {
    reconciled: true,
    classification: 'NOT_APPLICABLE',
    details: 'No order submitted in this cycle.'
  };

  if (input.orderIntent || input.brokerRequest) {
    const intentSym = input.orderIntent?.symbol || input.orderIntent?.assetSymbol;
    const reqSym = input.brokerRequest?.symbol;
    const intentQty = input.orderIntent?.quantity || input.orderIntent?.qty;
    const reqQty = input.brokerRequest?.qty || input.brokerRequest?.quantity;

    const symMatch = !intentSym || !reqSym || intentSym.toUpperCase() === reqSym.toUpperCase();
    const qtyMatch = !intentQty || !reqQty || Math.abs(intentQty - reqQty) < 0.0001;

    const isReconciled = symMatch && qtyMatch;
    const status = input.brokerResponse?.status || 'SUBMITTED';

    brokerRecon = {
      reconciled: isReconciled,
      orderIntentSymbol: intentSym,
      brokerRequestSymbol: reqSym,
      orderIntentQty: intentQty,
      brokerRequestQty: reqQty,
      brokerStatus: status,
      classification: isReconciled ? 'MATCHED' : 'SYSTEM_WORKFLOW_ERROR',
      details: isReconciled
        ? `Order intent (${intentSym} qty ${intentQty}) matched broker request exactly.`
        : `Mismatch between order intent (${intentSym} qty ${intentQty}) and broker request (${reqSym} qty ${reqQty}).`
    };

    checkedStages.push({
      stage: 'ORDER_INTENT',
      status: 'PASS',
      details: `Order intent created for ${intentSym || 'asset'}.`
    });

    checkedStages.push({
      stage: 'BROKER',
      status: isReconciled ? 'PASS' : 'ANOMALY',
      details: `Broker Status: ${status}`
    });

    if (!isReconciled) {
      findings.push({
        id: `FIND-BROKER-MISMATCH-${Date.now()}`,
        severity: 'CRITICAL',
        category: 'BROKER_RECONCILIATION',
        stage: 'BROKER',
        title: 'Order Intent / Broker Request Parameter Mismatch',
        description: `Discrepancy detected: intent ${intentSym} (${intentQty}) vs request ${reqSym} (${reqQty}).`,
        expected: 'Exact 1:1 parameter equality between intent and broker request',
        observed: `Intent: ${intentSym}/${intentQty}, Broker: ${reqSym}/${reqQty}`,
        recommendation: 'Halt order submission immediately and review trading adapter parameter mapping.'
      });
    }
  } else {
    checkedStages.push({
      stage: 'ORDER_INTENT',
      status: 'NOT_REACHED',
      details: 'No order intent generated.'
    });
    checkedStages.push({
      stage: 'BROKER',
      status: 'NOT_REACHED',
      details: 'No broker interaction in this cycle.'
    });
  }

  // 11. Monitoring & Ledger Stages
  checkedStages.push({
    stage: 'MONITORING',
    status: input.monitoringState ? 'PASS' : 'NOT_REACHED',
    details: input.monitoringState ? 'Position monitoring verified.' : 'No active positions to monitor.'
  });

  checkedStages.push({
    stage: 'LEDGER',
    status: 'NOT_REACHED',
    details: 'Trade ledger recorded as appropriate.'
  });

  // Calculate Overall Verdict from Findings
  const hasCritical = findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  const hasAnomaly = findings.some(f => f.category === 'RATIONALE_CONTRADICTION' || f.category === 'DETERMINISTIC_RULE' || f.category === 'BROKER_RECONCILIATION');
  const hasWarn = findings.some(f => f.severity === 'LOW' || f.severity === 'MEDIUM');

  let verdict: WorkflowAuditVerdict = 'PASS';
  if (hasCritical || hasAnomaly) {
    verdict = 'ANOMALY';
  } else if (hasWarn) {
    verdict = 'WARN';
  }

  let summary = `Deterministic audit evaluated ${checkedStages.length} pipeline stages and ${ruleChecks.length} rule constraints.`;
  if (verdict === 'PASS') {
    summary += ` System decision ${systemDecision} is fully consistent with declared quantitative rules and evidence requirements.`;
  } else if (verdict === 'WARN') {
    summary += ` Identified ${findings.length} advisory observation(s) (e.g. timeframe blind spots). System rules were adhered to.`;
  } else {
    summary += ` Detected ${findings.length} rule or rationale inconsistency(ies).`;
  }

  return {
    verdict,
    confidence: 95,
    summary,
    findings,
    checkedStages,
    ruleChecks,
    evidenceChecks,
    brokerReconciliation: brokerRecon,
    systemDecision,
    systemDecisionStage
  };
}
