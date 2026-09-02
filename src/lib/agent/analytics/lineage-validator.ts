import { PersistentTradeEvidence } from './durable-types';

// ---------------------------------------------------------------------------
// Phase 8.12: Evidence Lineage & Accounting Integrity Validator
// INVARIANT: Every executed trade must have unbroken causal lineage.
// INVARIANT: Mathematical derivation must be exact without lookahead.
// ---------------------------------------------------------------------------

export interface LineageValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTradeLineage(evidence: PersistentTradeEvidence): LineageValidationResult {
  const errors: string[] = [];

  const { decision, execution, accounting, lifecycle } = evidence;

  // 1. Validate Decision Snapshot Existence & Fields
  if (!decision) {
    errors.push('MISSING_DECISION: Trade has no frozen decision snapshot.');
  } else {
    if (!decision.decisionTimestamp) errors.push('MISSING_DECISION_TIMESTAMP: Frozen decision has no timestamp.');
    if (decision.opportunityScore < 0 || decision.opportunityScore > 100 || !Number.isFinite(decision.opportunityScore)) {
      errors.push(`INVALID_OPPORTUNITY_SCORE: Opportunity score ${decision.opportunityScore} out of bounds.`);
    }
    if (decision.confidence < 0 || decision.confidence > 100 || !Number.isFinite(decision.confidence)) {
      errors.push(`INVALID_CONFIDENCE_SCORE: AI confidence ${decision.confidence} out of bounds.`);
    }
    if (decision.invalidationPrice <= 0 || !Number.isFinite(decision.invalidationPrice)) {
      errors.push(`INVALID_INVALIDATION_PRICE: Invalidation price ${decision.invalidationPrice} must be positive.`);
    }
  }

  // 2. Validate Execution Quantities
  if (execution.requestedQuantity <= 0 || !Number.isFinite(execution.requestedQuantity)) {
    errors.push(`INVALID_REQUESTED_QTY: Requested quantity ${execution.requestedQuantity} must be positive.`);
  }
  if (execution.actualFilledQuantity <= 0 || !Number.isFinite(execution.actualFilledQuantity)) {
    errors.push(`INVALID_FILLED_QTY: Filled quantity ${execution.actualFilledQuantity} must be positive.`);
  }
  if (execution.actualFilledQuantity > execution.requestedQuantity + 0.0001) {
    errors.push(`QTY_OVERFLOW: Filled quantity (${execution.actualFilledQuantity}) exceeds requested quantity (${execution.requestedQuantity}).`);
  }

  // 3. Validate Execution Prices
  if (execution.actualEntryPrice <= 0 || !Number.isFinite(execution.actualEntryPrice)) {
    errors.push(`INVALID_ENTRY_PRICE: Actual entry price ${execution.actualEntryPrice} must be positive.`);
  }
  if (lifecycle.status === 'CLOSED') {
    if (execution.actualExitPrice === undefined || execution.actualExitPrice <= 0 || !Number.isFinite(execution.actualExitPrice)) {
      errors.push(`INVALID_EXIT_PRICE: Closed trade exit price ${execution.actualExitPrice} must be positive.`);
    }
  }

  // 4. Validate Timestamp Causal Progression
  if (decision && decision.decisionTimestamp && execution.submittedAt) {
    const decisionMs = new Date(decision.decisionTimestamp).getTime();
    const submittedMs = new Date(execution.submittedAt).getTime();
    if (submittedMs < decisionMs - 1000) {
      errors.push(`TIMESTAMP_VIOLATION: Order submission (${execution.submittedAt}) precedes decision (${decision.decisionTimestamp}).`);
    }

    if (execution.filledAt) {
      const filledMs = new Date(execution.filledAt).getTime();
      if (filledMs < submittedMs - 1000) {
        errors.push(`TIMESTAMP_VIOLATION: Fill (${execution.filledAt}) precedes submission (${execution.submittedAt}).`);
      }

      if (execution.exitedAt) {
        const exitedMs = new Date(execution.exitedAt).getTime();
        if (exitedMs < filledMs) {
          errors.push(`TIMESTAMP_VIOLATION: Exit (${execution.exitedAt}) precedes fill (${execution.filledAt}).`);
        }
      }
    }
  }

  // 5. Validate Accounting Derivation (Direction: LONG)
  if (lifecycle.status === 'CLOSED' && execution.actualExitPrice !== undefined) {
    const expectedPnL = Number(((execution.actualExitPrice - execution.actualEntryPrice) * execution.actualFilledQuantity).toFixed(4));
    if (accounting.grossPnL !== undefined) {
      const diff = Math.abs(accounting.grossPnL - expectedPnL);
      if (diff > 0.05) {
        errors.push(`PNL_DISCREPANCY: Recorded PnL ($${accounting.grossPnL}) differs from formula ($${expectedPnL}).`);
      }
    }

    const expectedInitialRisk = Math.abs(execution.actualEntryPrice - decision.invalidationPrice) * execution.actualFilledQuantity;
    if (expectedInitialRisk > 0 && accounting.grossPnL !== undefined && accounting.actualR !== undefined) {
      const expectedR = Number((accounting.grossPnL / expectedInitialRisk).toFixed(4));
      const rDiff = Math.abs(accounting.actualR - expectedR);
      if (rDiff > 0.05) {
        errors.push(`R_DISCREPANCY: Recorded actualR (${accounting.actualR}) differs from formula (${expectedR}).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
