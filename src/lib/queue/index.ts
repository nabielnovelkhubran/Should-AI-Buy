import {
  OpportunityCandidate,
  CandidateQueueItem,
  CandidateQueueStatus,
  CandidateQueueStats
} from '../types';

// ---------------------------------------------------------------------------
// Phase 5B: Deterministic Candidate Queue
// Validates, deduplicates, prioritizes, and manages candidate assets
// nominated by the Autonomous Opportunity Scanner for Council investigation.
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = new Set<CandidateQueueStatus>(['QUEUED', 'DISPATCHING', 'INVESTIGATING']);

/**
 * Deterministically constructs a unique Queue Item ID from symbol and scan metadata.
 */
export function makeQueueItemId(symbol: string, rank: number, discoveredAt: string): string {
  const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '').trim();
  const cleanTimestamp = discoveredAt.replace(/[:.-]/g, '');
  return `QITEM-${cleanSymbol}-R${rank}-${cleanTimestamp}`;
}

/**
 * Validates an OpportunityCandidate prior to queue admission.
 * Invariant: Never silently repair malformed candidates; reject explicitly.
 */
export function validateCandidate(candidate: any): { valid: boolean; reason?: string } {
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, reason: 'CANDIDATE_NULL_OR_INVALID_OBJECT' };
  }

  // 1. Symbol check
  if (!candidate.symbol || typeof candidate.symbol !== 'string' || candidate.symbol.trim().length === 0) {
    return { valid: false, reason: 'MISSING_OR_EMPTY_SYMBOL' };
  }

  // 2. Asset Class check
  if (candidate.assetClass !== 'CRYPTO' && candidate.assetClass !== 'EQUITY') {
    return { valid: false, reason: 'INVALID_ASSET_CLASS' };
  }

  // 3. Opportunity Score check
  if (typeof candidate.score !== 'number' || !Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 100) {
    return { valid: false, reason: 'INVALID_OPPORTUNITY_SCORE' };
  }

  // 4. Rank check
  if (typeof candidate.rank !== 'number' || !Number.isFinite(candidate.rank) || candidate.rank < 1) {
    return { valid: false, reason: 'INVALID_CANDIDATE_RANK' };
  }

  // 5. Signals check
  const sig = candidate.signals;
  if (!sig || typeof sig !== 'object') {
    return { valid: false, reason: 'MISSING_CANDIDATE_SIGNALS' };
  }
  if (
    !Number.isFinite(sig.momentum) ||
    !Number.isFinite(sig.rsi) ||
    !Number.isFinite(sig.rvol) ||
    !Number.isFinite(sig.volumeAcceleration) ||
    !Number.isFinite(sig.realizedVolatility) ||
    !Number.isFinite(sig.liquidityUsd) ||
    !Number.isFinite(sig.opportunityScore) ||
    !Number.isFinite(sig.riskScore)
  ) {
    return { valid: false, reason: 'MALFORMED_CANDIDATE_SIGNAL_METRICS' };
  }

  // 6. Snapshot check
  const snap = candidate.snapshot;
  if (!snap || typeof snap !== 'object' || typeof snap.price !== 'number' || snap.price <= 0) {
    return { valid: false, reason: 'MISSING_OR_INVALID_MARKET_SNAPSHOT' };
  }

  return { valid: true };
}

export class CandidateQueue {
  private items: Map<string, CandidateQueueItem> = new Map();

  /**
   * Enqueues a single validated OpportunityCandidate.
   * Enforces deduplication: rejects if an active item for the same symbol already exists.
   */
  enqueue(candidate: OpportunityCandidate): { success: boolean; item?: CandidateQueueItem; reason?: string } {
    const validation = validateCandidate(candidate);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const cleanSymbol = candidate.symbol.toUpperCase().replace(/^\$/, '').trim();

    // Deduplication check: cannot enqueue if currently active (QUEUED, DISPATCHING, INVESTIGATING)
    for (const existing of Array.from(this.items.values())) {
      if (existing.symbol === cleanSymbol && ACTIVE_STATUSES.has(existing.status)) {
        return { success: false, reason: 'DUPLICATE_ACTIVE_ITEM' };
      }
    }

    const enqueuedAt = new Date().toISOString();
    const id = makeQueueItemId(cleanSymbol, candidate.rank, candidate.discoveredAt || enqueuedAt);

    const item: CandidateQueueItem = {
      id,
      symbol: cleanSymbol,
      candidate,
      status: 'QUEUED',
      enqueuedAt,
      priority: candidate.score
    };

    this.items.set(id, item);
    return { success: true, item };
  }

  /**
   * Enqueues an array of candidates (e.g. from ScanResult.candidates).
   */
  enqueueMany(candidates: OpportunityCandidate[]): {
    enqueued: CandidateQueueItem[];
    rejected: { candidate: OpportunityCandidate; reason: string }[];
  } {
    const enqueued: CandidateQueueItem[] = [];
    const rejected: { candidate: OpportunityCandidate; reason: string }[] = [];

    for (const candidate of candidates) {
      const res = this.enqueue(candidate);
      if (res.success && res.item) {
        enqueued.push(res.item);
      } else {
        rejected.push({ candidate, reason: res.reason || 'UNKNOWN_REJECTION' });
      }
    }

    return { enqueued, rejected };
  }

  /**
   * Returns the next eligible candidate item in deterministic priority order:
   * 1. Priority (opportunityScore) DESC
   * 2. Candidate rank ASC
   * 3. Symbol ASC (tie-breaker)
   */
  getNext(): CandidateQueueItem | undefined {
    const queuedItems = Array.from(this.items.values()).filter(item => item.status === 'QUEUED');
    if (queuedItems.length === 0) return undefined;

    queuedItems.sort((a, b) => {
      // 1. Primary: Priority (Score) DESC
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // 2. Secondary: Rank ASC
      if (a.candidate.rank !== b.candidate.rank) {
        return a.candidate.rank - b.candidate.rank;
      }
      // 3. Tertiary: Symbol ASC
      return a.symbol.localeCompare(b.symbol);
    });

    return queuedItems[0];
  }

  /**
   * Retrieves a queue item by ID.
   */
  getItem(id: string): CandidateQueueItem | undefined {
    return this.items.get(id);
  }

  /**
   * Retrieves an item by symbol (most recently enqueued or active).
   */
  getItemBySymbol(symbol: string): CandidateQueueItem | undefined {
    const clean = symbol.toUpperCase().replace(/^\$/, '').trim();
    const matching = Array.from(this.items.values()).filter(item => item.symbol === clean);
    if (matching.length === 0) return undefined;
    // Prefer active item if one exists
    const active = matching.find(item => ACTIVE_STATUSES.has(item.status));
    return active || matching[matching.length - 1];
  }

  /**
   * Updates the status and runtime metadata of a queue item.
   */
  updateStatus(
    id: string,
    status: CandidateQueueStatus,
    details?: { investigationId?: string; error?: string }
  ): CandidateQueueItem | undefined {
    const item = this.items.get(id);
    if (!item) return undefined;

    const now = new Date().toISOString();
    item.status = status;

    if (status === 'DISPATCHING' || status === 'INVESTIGATING') {
      if (!item.startedAt) item.startedAt = now;
    }

    if (status === 'COMPLETED' || status === 'FAILED' || status === 'REJECTED') {
      item.completedAt = now;
    }

    if (details?.investigationId) {
      item.investigationId = details.investigationId;
    }

    if (details?.error) {
      item.error = details.error;
    }

    return item;
  }

  /**
   * Returns all items currently stored in the queue.
   */
  getAllItems(): CandidateQueueItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Returns aggregated queue statistics.
   */
  getStats(): CandidateQueueStats {
    let queuedCount = 0;
    let dispatchingCount = 0;
    let investigatingCount = 0;
    let completedCount = 0;
    let rejectedCount = 0;
    let failedCount = 0;

    for (const item of Array.from(this.items.values())) {
      switch (item.status) {
        case 'QUEUED': queuedCount++; break;
        case 'DISPATCHING': dispatchingCount++; break;
        case 'INVESTIGATING': investigatingCount++; break;
        case 'COMPLETED': completedCount++; break;
        case 'REJECTED': rejectedCount++; break;
        case 'FAILED': failedCount++; break;
      }
    }

    return {
      totalEnqueued: this.items.size,
      queuedCount,
      dispatchingCount,
      investigatingCount,
      completedCount,
      rejectedCount,
      failedCount
    };
  }

  /**
   * Clears the in-memory queue state (useful for test isolation).
   */
  clear(): void {
    this.items.clear();
  }
}

/** Singleton instance of candidate queue */
export const candidateQueue = new CandidateQueue();
