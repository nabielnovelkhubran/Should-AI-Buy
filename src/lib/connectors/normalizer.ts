import { Evidence, EvidenceType, ReliabilityRating, VerificationStatus } from '../types';
import { RawSourceArticle, EvidenceSourceAdapter, SourceUnavailableError } from './types';

// ---------------------------------------------------------------------------
// Phase 3: Evidence Normalizer
// Converts RawSourceArticle[] from any adapter into first-class Evidence[]
// domain objects. The normalizer enforces timestamp separation (observedAt ≠
// retrievedAt), sets verificationStatus, and records the adapterSource.
// ---------------------------------------------------------------------------

/**
 * Derives freshness from the gap between observedAt and retrievedAt.
 */
export function deriveFreshness(observedAt: string, retrievedAt: string): 'LIVE' | 'RECENT' | 'STALE' {
  const ageMs = new Date(retrievedAt).getTime() - new Date(observedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) return 'LIVE';
  if (ageHours < 24) return 'RECENT';
  return 'STALE';
}

/**
 * Normalizes raw articles from an adapter into structured Evidence domain objects.
 *
 * Key invariants:
 * - observedAt = article.publishedAt (when the fact happened)
 * - source.retrievedAt = now (when the system fetched it) — always distinct
 * - verificationStatus is set based on adapter type (MOCK adapters → 'MOCK')
 * - LLMs do NOT call this function — it is pure deterministic code
 */
export function normalizeToEvidence(
  articles: RawSourceArticle[],
  investigationId: string,
  adapter: EvidenceSourceAdapter,
  verificationOverride?: VerificationStatus,
  seqOffset: number = 0
): Evidence[] {
  const retrievedAt = new Date().toISOString();

  return articles.map((article, idx) => {
    const observedAt = article.publishedAt;
    const freshness = deriveFreshness(observedAt, retrievedAt);
    const verificationStatus: VerificationStatus = verificationOverride ?? 'UNVERIFIED';

    return {
      id: `EVID-NEWS-${investigationId}-${seqOffset + idx + 1}`,
      investigationId,
      type: 'NEWS' as EvidenceType,
      title: article.title,
      description: article.summary,
      observedAt,                // When article was published — NOT when fetched
      source: {
        name: article.publisher,
        url: article.url,
        publisher: article.publisher,
        publishedAt: article.publishedAt,
        retrievedAt,             // When the system's adapter fetched it
        adapterVersion: adapter.adapterId,
      },
      value: {
        sentiment: article.sentiment,
        relevance: article.relevance,
      },
      metadata: {
        isContradictory: Boolean(article.isContradictory),
        externalId: article.externalId,
      },
      reliability: adapter.defaultReliability,
      isContradictory: Boolean(article.isContradictory),
      verificationStatus,
      adapterSource: adapter.adapterId,
      freshness,
      claimIds: [],
      contradicts: [],
    };
  });
}

/**
 * Called when an adapter throws SourceUnavailableError.
 * Records the failure as a FAILED Evidence item — never substitutes fabricated data.
 * This preserves Invariant 3: No fabricated external intelligence.
 */
export function createFailureEvidence(
  investigationId: string,
  adapter: EvidenceSourceAdapter,
  error: SourceUnavailableError,
  seq: number = 1
): Evidence {
  const now = new Date().toISOString();
  return {
    id: `EVID-NEWS-${investigationId}-FAIL-${adapter.adapterId}-${seq}`,
    investigationId,
    type: 'NEWS' as EvidenceType,
    title: `[Source Unavailable] ${adapter.adapterName}`,
    description: `${adapter.adapterName} could not be reached (reason: ${error.reason}). No fabricated or synthetic data was substituted. The council must rely strictly on verified on-chain and market data.`,
    observedAt: now,
    source: {
      name: adapter.adapterName,
      retrievedAt: now,
      adapterVersion: adapter.adapterId,
    },
    value: null,
    reliability: 'UNKNOWN',
    isContradictory: false,
    verificationStatus: 'FAILED',
    adapterSource: adapter.adapterId,
    freshness: 'LIVE',
    claimIds: [],
    contradicts: [],
  };
}

/**
 * High-level helper: runs an adapter, normalizes results, handles failure.
 * Council orchestrator calls this instead of calling adapters directly.
 */
export async function fetchAndNormalize(
  adapter: EvidenceSourceAdapter,
  symbol: string,
  investigationId: string,
  verificationOverride?: VerificationStatus,
  seqOffset: number = 0
): Promise<Evidence[]> {
  try {
    const articles = await adapter.fetchForSymbol(symbol);

    if (!articles) {
      throw new SourceUnavailableError(adapter.adapterId, 'EMPTY_RESPONSE', `${adapter.adapterName} returned no response for ${symbol}`);
    }

    if (articles.length === 0) {
      return [];
    }

    return normalizeToEvidence(articles, investigationId, adapter, verificationOverride, seqOffset);
  } catch (err) {
    if (err instanceof SourceUnavailableError) {
      return [createFailureEvidence(investigationId, adapter, err, seqOffset + 1)];
    }
    // Unexpected error — wrap and record as failure rather than crashing
    const wrapped = new SourceUnavailableError(adapter.adapterId, 'FETCH_ERROR', String(err));
    return [createFailureEvidence(investigationId, adapter, wrapped, seqOffset + 1)];
  }
}
