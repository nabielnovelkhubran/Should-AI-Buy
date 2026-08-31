import {
  CandidateQueueItem,
  DispatchResult,
  DispatchSummary,
  Investigation
} from '../types';
import { CandidateQueue, candidateQueue } from '../queue';
import { orchestrateCouncilInvestigation, CouncilExecutionOptions } from '../council';

// ---------------------------------------------------------------------------
// Phase 5B: Sequential Council Dispatcher
// Consumes candidates from the CandidateQueue sequentially, executes the
// 7-stage Council with scanner provenance, and isolates execution errors.
// Invariant: MUST NOT execute live or paper trading orders.
// ---------------------------------------------------------------------------

export interface DispatcherOptions {
  queue?: CandidateQueue;
  skipOrderExecution?: boolean;
  councilRunner?: (
    command: string,
    assetSymbol: string,
    onTimelineUpdate?: (event: any) => void,
    options?: CouncilExecutionOptions
  ) => Promise<Investigation>;
}

export class CouncilDispatcher {
  private queue: CandidateQueue;
  private skipOrderExecution: boolean;
  private councilRunner: (
    command: string,
    assetSymbol: string,
    onTimelineUpdate?: (event: any) => void,
    options?: CouncilExecutionOptions
  ) => Promise<Investigation>;

  constructor(options?: DispatcherOptions) {
    this.queue = options?.queue || candidateQueue;
    this.skipOrderExecution = options?.skipOrderExecution !== undefined ? options.skipOrderExecution : true;
    this.councilRunner = options?.councilRunner || orchestrateCouncilInvestigation;
  }

  /**
   * Dispatches the next highest-priority eligible candidate from the queue.
   */
  async dispatchNext(): Promise<DispatchResult> {
    const item = this.queue.getNext();
    if (!item) {
      return { dispatched: false };
    }

    // 1. Mark DISPATCHING
    this.queue.updateStatus(item.id, 'DISPATCHING');

    // 2. Transition to INVESTIGATING
    this.queue.updateStatus(item.id, 'INVESTIGATING');

    // 3. Attach full scanner provenance
    const provenance = {
      source: 'autonomous-scanner',
      scannerVersion: 'v1.0.0',
      candidateRank: item.candidate.rank,
      opportunityScore: item.candidate.score,
      scanTimestamp: item.candidate.discoveredAt,
      queueItemId: item.id
    };

    const command = `Should-AI investigate $${item.symbol}? (Autonomous Scan Rank #${item.candidate.rank})`;

    try {
      // 4. Invoke the authoritative 7-stage Council sequentially
      const investigation = await this.councilRunner(
        command,
        item.symbol,
        undefined,
        {
          source: 'autonomous-scanner',
          metadata: provenance,
          initialSnapshot: item.candidate.snapshot,
          skipOrderExecution: this.skipOrderExecution
        }
      );

      // 5. Handle failure or completion
      if (investigation.status === 'FAILED') {
        const errMsg = investigation.error || 'Council investigation failed';
        this.queue.updateStatus(item.id, 'FAILED', {
          investigationId: investigation.id,
          error: errMsg
        });
        return { dispatched: true, item, investigation, error: errMsg };
      }

      this.queue.updateStatus(item.id, 'COMPLETED', {
        investigationId: investigation.id
      });

      return { dispatched: true, item, investigation };
    } catch (err: any) {
      const errMsg = err?.message || 'Unknown council dispatcher error';
      this.queue.updateStatus(item.id, 'FAILED', { error: errMsg });
      return { dispatched: true, item, error: errMsg };
    }
  }

  /**
   * Sequentially dispatches candidates up to an optional limit.
   * Invariant: A failure on one candidate does NOT abort subsequent candidates.
   */
  async dispatchAll(limit?: number): Promise<DispatchSummary> {
    const results: DispatchResult[] = [];
    let completedCount = 0;
    let failedCount = 0;
    let count = 0;
    const maxToDispatch = limit !== undefined ? Math.max(1, limit) : Infinity;

    while (this.queue.getNext() && count < maxToDispatch) {
      const res = await this.dispatchNext();
      if (!res.dispatched) break;

      results.push(res);
      count++;

      if (res.investigation && res.investigation.status === 'COMPLETED') {
        completedCount++;
      } else {
        failedCount++;
      }
    }

    return {
      totalDispatched: count,
      completedCount,
      failedCount,
      results
    };
  }

  /**
   * Returns the underlying CandidateQueue instance.
   */
  getQueue(): CandidateQueue {
    return this.queue;
  }
}

/** Singleton instance of CouncilDispatcher */
export const councilDispatcher = new CouncilDispatcher();
