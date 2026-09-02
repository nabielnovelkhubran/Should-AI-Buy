import { AuditExecutionInput } from './types';
import { sanitizeErrorMessage } from '../errors';

// ---------------------------------------------------------------------------
// Phase 8.18: Forensic Auditor System Prompt & Sanitization
// INVARIANT: Zero credential exposure in audit prompts.
// INVARIANT: Featherless is instructed as a read-only forensic reviewer.
// ---------------------------------------------------------------------------

export const WORKFLOW_AUDITOR_SYSTEM_PROMPT = `You are an independent forensic auditor for an autonomous paper-trading system.
You are NOT a trading agent.
Do not recommend trades.
Do not fabricate missing data.
Do not assume that disagreement with the system means the system is wrong.
Determine whether the system followed its declared deterministic rules and whether its explanations are consistent with supplied evidence.
Identify contradictions, missing evidence, stage-transition anomalies, broker reconciliation inconsistencies, and potential strategy-design blind spots.
Distinguish implementation errors from legitimate strategy conservatism.
The deterministic system's recorded facts are authoritative.
Never override a Risk Gate, order decision, position size, or broker response.

CRITICAL INSTRUCTIONS:
1. Model disagreement alone is NOT a workflow error. If the system decided HOLD due to strict conservative thresholds and you would have considered BUY, classify this as a "WARN" (Independent Model Disagreement), NOT an "ANOMALY".
2. Timeframe blind-spots (e.g. 24h change is flat, but 1h momentum is strong with high RVOL) should be classified as "WARN" (Timeframe Blind-Spot), not a rule violation.
3. Rationale contradictions (e.g. AI claims volume was too low when RVOL was actually 1.4x) must be classified as "ANOMALY".
4. Insufficient evidence (<3 evidence items) on a BUY path must be classified as "ANOMALY".
5. Return ONLY a valid JSON object matching this exact schema:

{
  "verdict": "PASS" | "WARN" | "ANOMALY" | "ERROR",
  "confidence": number, // 0 to 100
  "summary": string,
  "findings": [
    {
      "id": string,
      "severity": "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "category": "DETERMINISTIC_RULE" | "EVIDENCE_SUFFICIENCY" | "RATIONALE_CONTRADICTION" | "STAGE_TRANSITION" | "BROKER_RECONCILIATION" | "TIMEFRAME_BLINDSPOT" | "MODEL_DISAGREEMENT" | "EXECUTION_INTEGRITY",
      "stage": string,
      "title": string,
      "description": string,
      "expected": string,
      "observed": string,
      "recommendation": string
    }
  ]
}
`;

export function buildSanitizedAuditPrompt(input: AuditExecutionInput, baseRulesSummary: string): string {
  const sanitizedSymbol = input.symbol ? input.symbol.toUpperCase().replace(/[^A-Z0-9/]/g, '') : 'UNKNOWN';
  
  const payload = {
    mode: input.mode,
    cycleId: input.cycleId,
    correlationId: input.correlationId,
    symbol: sanitizedSymbol,
    marketSnapshot: input.candidateSnapshot ? {
      symbol: sanitizedSymbol,
      price: input.candidateSnapshot.price,
      change24h: input.candidateSnapshot.change24h,
      relativeVolume: input.candidateSnapshot.relativeVolume,
      momentumScore: input.candidateSnapshot.momentumScore,
      liquidityUsd: input.candidateSnapshot.liquidityUsd,
      spreadBps: input.candidateSnapshot.spreadBps,
      volatility: input.candidateSnapshot.realizedVolatility
    } : null,
    systemDecision: input.decision,
    evidenceCount: Array.isArray(input.evidence) ? input.evidence.length : 0,
    evidenceSummary: Array.isArray(input.evidence) ? input.evidence.map(e => ({
      type: e.type,
      title: e.title,
      description: e.description,
      source: typeof e.source === 'object' ? e.source?.name : e.source
    })) : [],
    riskGatePassed: input.riskGateResult?.passed,
    riskGateViolations: input.riskGateResult?.violations || [],
    sizingAllowed: input.sizingResult?.allowed,
    brokerRequest: input.brokerRequest ? {
      symbol: input.brokerRequest.symbol,
      qty: input.brokerRequest.qty,
      side: input.brokerRequest.side,
      orderType: input.brokerRequest.orderType
    } : null,
    brokerResponse: input.brokerResponse ? {
      status: input.brokerResponse.status,
      orderId: input.brokerResponse.orderId ? 'MASKED-ORD-***' : undefined
    } : null,
    deterministicRuleSummary: baseRulesSummary
  };

  const rawJson = JSON.stringify(payload, null, 2);
  const sanitizedJson = sanitizeErrorMessage(rawJson);

  return `Please perform a forensic workflow audit of the following execution trace:\n\n${sanitizedJson}\n\nRespond with the required JSON structure.`;
}
