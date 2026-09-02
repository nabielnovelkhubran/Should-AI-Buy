import { RotationCandidateMetadata } from './types';

// ---------------------------------------------------------------------------
// Phase 8.26: Fair Candidate Rotation & Starvation Elimination Manager
// INVARIANT: Deterministic aging bonus ensures every eligible candidate (>= 55)
// eventually receives AI Council deliberation without capacity exhaustion.
// INVARIANT: Underlying Opportunity Scores and Risk Gate thresholds are NEVER modified.
// ---------------------------------------------------------------------------

export interface CandidateRotationState {
  symbol: string;
  lastEvaluatedCycle: string | null;
  cyclesWaiting: number;
  totalEvaluations: number;
  lastOpportunityScore: number;
}

export class CandidateRotationManager {
  private get states(): Map<string, CandidateRotationState> {
    const g = globalThis as unknown as { __CANDIDATE_ROTATION_STATES__?: Map<string, CandidateRotationState> };
    if (!g.__CANDIDATE_ROTATION_STATES__) g.__CANDIDATE_ROTATION_STATES__ = new Map();
    return g.__CANDIDATE_ROTATION_STATES__;
  }

  /**
   * Computes deterministic rotation priority for an eligible candidate.
   * Priority = opportunityScore + min(25, cyclesWaiting * 5) - (cyclesWaiting === 0 && totalEvaluations > 0 ? 15 : 0)
   */
  public computePriority(
    symbol: string,
    opportunityScore: number
  ): {
    rotationPriority: number;
    cyclesWaiting: number;
    totalEvaluations: number;
    lastEvaluatedCycle: string | null;
  } {
    const sym = symbol.toUpperCase().trim();
    const existing = this.states.get(sym);
    const cyclesWaiting = existing?.cyclesWaiting ?? 0;
    const totalEvaluations = existing?.totalEvaluations ?? 0;
    const lastEvaluatedCycle = existing?.lastEvaluatedCycle ?? null;

    // Aging bonus: +5 per cycle waiting without evaluation (capped at +25)
    const agingBonus = Math.min(25, cyclesWaiting * 5);

    // Recency penalty: -15 if evaluated in the immediate previous cycle to yield to deferred candidates
    const recencyPenalty = (cyclesWaiting === 0 && totalEvaluations > 0) ? 15 : 0;

    const rotationPriority = Math.round(opportunityScore + agingBonus - recencyPenalty);

    return {
      rotationPriority,
      cyclesWaiting,
      totalEvaluations,
      lastEvaluatedCycle
    };
  }

  /**
   * Updates state after cycle dispatch and produces structured rotation telemetry.
   */
  public recordCycleSelections(
    selectedSymbols: string[],
    allEligibleSymbolsWithScores: Array<{ symbol: string; score: number }>,
    cycleId: string,
    scanLimit: number = 5
  ): RotationCandidateMetadata[] {
    const selectedSet = new Set(selectedSymbols.map(s => s.toUpperCase().trim()));
    const telemetry: RotationCandidateMetadata[] = [];

    allEligibleSymbolsWithScores.forEach(({ symbol, score }, idx) => {
      const sym = symbol.toUpperCase().trim();
      const isSelected = selectedSet.has(sym);
      let state = this.states.get(sym);

      if (!state) {
        state = {
          symbol: sym,
          lastEvaluatedCycle: null,
          cyclesWaiting: 0,
          totalEvaluations: 0,
          lastOpportunityScore: score
        };
        this.states.set(sym, state);
      }

      state.lastOpportunityScore = score;
      const priorityInfo = this.computePriority(sym, score);

      if (isSelected) {
        state.cyclesWaiting = 0;
        state.totalEvaluations += 1;
        state.lastEvaluatedCycle = cycleId;

        telemetry.push({
          symbol: sym,
          opportunityScore: score,
          rank: idx + 1,
          lastEvaluatedCycle: cycleId,
          cyclesWaiting: 0,
          evaluationCount: state.totalEvaluations,
          rotationPriority: priorityInfo.rotationPriority,
          selectedThisCycle: true
        });
      } else {
        state.cyclesWaiting += 1;

        telemetry.push({
          symbol: sym,
          opportunityScore: score,
          rank: idx + 1,
          lastEvaluatedCycle: state.lastEvaluatedCycle,
          cyclesWaiting: state.cyclesWaiting,
          evaluationCount: state.totalEvaluations,
          rotationPriority: priorityInfo.rotationPriority,
          selectedThisCycle: false,
          deferReason: `Deferred by capacity throttle (Limit: ${scanLimit} candidates/cycle)`
        });
      }
    });

    return telemetry;
  }

  public getRotationState(symbol: string): CandidateRotationState | undefined {
    return this.states.get(symbol.toUpperCase().trim());
  }

  public getAllStates(): CandidateRotationState[] {
    return Array.from(this.states.values());
  }

  public reset(): void {
    this.states.clear();
  }
}

// Attach to globalThis for persistence across Next.js route evaluations
const g = globalThis as unknown as { __CANDIDATE_ROTATION_MANAGER__?: CandidateRotationManager };
if (!g.__CANDIDATE_ROTATION_MANAGER__) {
  g.__CANDIDATE_ROTATION_MANAGER__ = new CandidateRotationManager();
}

export const candidateRotationManager = g.__CANDIDATE_ROTATION_MANAGER__;
