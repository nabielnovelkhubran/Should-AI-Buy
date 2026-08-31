import { Evidence, ReliabilityRating } from '../types';

// ---------------------------------------------------------------------------
// Phase 3: Evidence Source Adapter Contract
// All evidence adapters must implement this interface. The adapter returns raw
// articles/data — the Normalizer converts them into first-class Evidence objects.
// ---------------------------------------------------------------------------

export interface RawSourceArticle {
  externalId: string;
  title: string;
  summary: string;
  url: string;
  publisher: string;
  /** ISO 8601: when the source published this information (observedAt in Evidence) */
  publishedAt: string;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  relevance?: 'HIGH' | 'MEDIUM' | 'LOW';
  isContradictory?: boolean;
}

export interface EvidenceSourceAdapter {
  /** Unique stable identifier for this provider — never changes between versions */
  readonly adapterId: string;

  /** Human-readable name for display in provenance UI */
  readonly adapterName: string;

  /** Default reliability tier for all evidence from this adapter */
  readonly defaultReliability: ReliabilityRating;

  /**
   * Fetches raw articles/data for the given symbol.
   *
   * CONTRACT:
   * - Must NEVER fabricate data if the source is unavailable.
   * - Must throw SourceUnavailableError on any failure.
   * - Callers (not this method) decide how to handle the failure.
   */
  fetchForSymbol(symbol: string): Promise<RawSourceArticle[]>;
}

// ---------------------------------------------------------------------------
// SourceUnavailableError
// Thrown by any adapter when the data source cannot be reached or returns
// an unusable response. The caller records this as a FAILED Evidence item —
// no fabricated data is substituted.
// ---------------------------------------------------------------------------

export class SourceUnavailableError extends Error {
  constructor(
    public readonly adapterId: string,
    public readonly reason: 'TIMEOUT' | 'RATE_LIMIT' | 'FETCH_ERROR' | 'EMPTY_RESPONSE' | 'PARSE_ERROR',
    message: string
  ) {
    super(message);
    this.name = 'SourceUnavailableError';
  }
}
