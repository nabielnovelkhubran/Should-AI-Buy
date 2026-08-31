import { Evidence, VerificationStatus } from '../types';
import { EvidenceSourceAdapter, RawSourceArticle, SourceUnavailableError } from './types';
import { alpacaNewsAdapter } from './alpaca-news-adapter';
import { hackathonDemoNewsAdapter } from './hackathon-demo-news-adapter';
import { deriveFreshness, normalizeToEvidence } from './normalizer';

// ---------------------------------------------------------------------------
// Phase 4B: Hybrid News Router
// Routes news requests to live Alpaca News API first. If live news is
// unavailable, empty, or all articles are stale, it deterministically activates
// the Hackathon Demo Fallback with explicit 'MOCK' verification status.
//
// Invariants:
// - Live news is primary.
// - Fallback is transparently labeled as demo data (verificationStatus: 'MOCK').
// - No fabricated live news.
// - Deterministic routing: identical inputs yield identical routes.
// ---------------------------------------------------------------------------

export type NewsRoute = 'ALPACA' | 'ALPACA_EMPTY' | 'ALPACA_STALE' | 'ALPACA_FAILED';

export interface HybridRouteResult {
  route: NewsRoute;
  evidence: Evidence[];
  fallbackReason?: string;
}

export class HybridNewsRouter {
  constructor(
    private alpacaAdapter: EvidenceSourceAdapter = alpacaNewsAdapter,
    private fallbackAdapter: EvidenceSourceAdapter = hackathonDemoNewsAdapter
  ) {}

  /**
   * Evaluates live Alpaca news and routes to fallback if live news is
   * empty, stale, or unavailable.
   */
  async fetchNewsContext(investigationId: string, symbol: string): Promise<HybridRouteResult> {
    const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '').trim();
    const now = new Date().toISOString();

    try {
      const articles = await this.alpacaAdapter.fetchForSymbol(cleanSymbol);

      // Condition 1: Empty result from live feed
      if (!articles || articles.length === 0) {
        const fallbackArticles = await this.fallbackAdapter.fetchForSymbol(cleanSymbol);
        const evidence = normalizeToEvidence(fallbackArticles, investigationId, this.fallbackAdapter, 'MOCK');
        
        // Stamp route provenance on metadata
        evidence.forEach(e => {
          e.metadata = {
            ...e.metadata,
            route: 'ALPACA_EMPTY',
            fallbackReason: 'Empty news response from live Alpaca feed'
          };
        });

        return {
          route: 'ALPACA_EMPTY',
          evidence,
          fallbackReason: 'Empty news response from live Alpaca feed'
        };
      }

      // Condition 2: All articles are stale (>24 hours old)
      const allStale = articles.every(article => deriveFreshness(article.publishedAt, now) === 'STALE');
      if (allStale) {
        const fallbackArticles = await this.fallbackAdapter.fetchForSymbol(cleanSymbol);
        const evidence = normalizeToEvidence(fallbackArticles, investigationId, this.fallbackAdapter, 'MOCK');

        evidence.forEach(e => {
          e.metadata = {
            ...e.metadata,
            route: 'ALPACA_STALE',
            fallbackReason: 'Live articles exceeded 24-hour freshness threshold'
          };
        });

        return {
          route: 'ALPACA_STALE',
          evidence,
          fallbackReason: 'Live articles exceeded 24-hour freshness threshold'
        };
      }

      // Live fresh news available
      const evidence = normalizeToEvidence(articles, investigationId, this.alpacaAdapter, 'VERIFIED');
      evidence.forEach(e => {
        e.metadata = {
          ...e.metadata,
          route: 'ALPACA'
        };
      });

      return {
        route: 'ALPACA',
        evidence
      };

    } catch (err: any) {
      // Condition 3: Source failure (auth, rate-limit, network, timeout, parse)
      const fallbackReason = err instanceof SourceUnavailableError 
        ? `Live Alpaca feed failed (${err.reason}): ${err.message}`
        : `Live Alpaca feed connection error: ${err.message || 'Unknown error'}`;

      const fallbackArticles = await this.fallbackAdapter.fetchForSymbol(cleanSymbol);
      const evidence = normalizeToEvidence(fallbackArticles, investigationId, this.fallbackAdapter, 'MOCK');

      evidence.forEach(e => {
        e.metadata = {
          ...e.metadata,
          route: 'ALPACA_FAILED',
          fallbackReason
        };
      });

      return {
        route: 'ALPACA_FAILED',
        evidence,
        fallbackReason
      };
    }
  }
}

/** Singleton instance for use across the application */
export const hybridNewsRouter = new HybridNewsRouter();

/**
 * Top-level news evidence retriever called by council orchestrator.
 */
export async function fetchHybridNewsEvidence(investigationId: string, symbol: string): Promise<Evidence[]> {
  const result = await hybridNewsRouter.fetchNewsContext(investigationId, symbol);
  return result.evidence;
}
