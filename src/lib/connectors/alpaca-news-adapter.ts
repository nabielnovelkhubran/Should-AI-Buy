import { ReliabilityRating } from '../types';
import { EvidenceSourceAdapter, RawSourceArticle, SourceUnavailableError } from './types';
import { alpacaDataAdapter } from '../market-data/alpaca-adapter';

// ---------------------------------------------------------------------------
// Phase 4A: Alpaca News Intelligence Adapter
// Fetches live market news from Alpaca Market Data News REST API (v1beta1).
// Normalizes raw news payload into structured RawSourceArticle[] matching the
// repository's EvidenceSourceAdapter contract.
// ---------------------------------------------------------------------------

/**
 * Safely strips HTML tags and decodes common HTML entities from news summaries/content.
 * Does not introduce external dependencies.
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

export class AlpacaNewsAdapter implements EvidenceSourceAdapter {
  readonly adapterId = 'alpaca-news-v1';
  readonly adapterName = 'Alpaca Market Data News API (v1beta1)';
  readonly defaultReliability: ReliabilityRating = 'REPUTABLE';

  private dataBaseUrl: string;
  private defaultLimit: number;

  constructor(baseUrl?: string, limit: number = 5) {
    this.dataBaseUrl = (baseUrl || process.env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets').replace(/\/$/, '');
    this.defaultLimit = limit;
  }

  /**
   * Retrieves authentication headers for Alpaca API requests.
   * Credentials must come from environment variables.
   * Never exposed to frontend or evidence records.
   */
  private getAuthHeaders(): Record<string, string> {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    if (!apiKey || !secretKey || !apiKey.trim() || !secretKey.trim()) {
      throw new SourceUnavailableError(
        this.adapterId,
        'FETCH_ERROR',
        'Alpaca API credentials missing. Please define ALPACA_API_KEY and ALPACA_SECRET_KEY in your .env file.'
      );
    }

    return {
      'APCA-API-KEY-ID': apiKey.trim(),
      'APCA-API-SECRET-KEY': secretKey.trim(),
      'Accept': 'application/json'
    };
  }

  /**
   * Builds the comma-separated symbols query for Alpaca News API.
   * For crypto: includes base ticker (e.g. BTC) and pair formats (BTCUSD, BTC/USD).
   * For equities: sends the clean ticker (e.g. AAPL).
   */
  public formatSymbolsQuery(symbol: string): string {
    const clean = symbol.toUpperCase().replace(/^\$/, '').trim();
    if (alpacaDataAdapter.isCryptoSymbol(clean)) {
      let base = clean;
      if (clean.includes('/')) {
        base = clean.split('/')[0];
      } else if (clean.endsWith('USDT') && clean.length > 4) {
        base = clean.slice(0, -4);
      } else if (clean.endsWith('USD') && clean.length > 3) {
        base = clean.slice(0, -3);
      }
      return `${base},${base}/USD,${base}USD`;
    }
    return clean;
  }

  /**
   * Fetches raw news articles for a given symbol from Alpaca Market Data News REST API.
   * Endpoint: GET /v1beta1/news
   */
  async fetchForSymbol(
    symbol: string,
    options?: { limit?: number; fetchImpl?: typeof fetch }
  ): Promise<RawSourceArticle[]> {
    const limit = options?.limit ?? this.defaultLimit;
    const symbolsQuery = this.formatSymbolsQuery(symbol);
    const url = `${this.dataBaseUrl}/v1beta1/news?symbols=${encodeURIComponent(symbolsQuery)}&limit=${limit}&sort=desc&include_content=false`;

    const headers = this.getAuthHeaders();
    const fetchFn = options?.fetchImpl || fetch;

    let res: Response;
    try {
      res = await fetchFn(url, {
        headers,
        cache: 'no-store'
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.toLowerCase().includes('timeout')) {
        throw new SourceUnavailableError(
          this.adapterId,
          'TIMEOUT',
          `Alpaca News API request timed out for ${symbol}: ${err.message}`
        );
      }
      throw new SourceUnavailableError(
        this.adapterId,
        'FETCH_ERROR',
        `Failed to connect to Alpaca News API: ${err.message}`
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new SourceUnavailableError(
          this.adapterId,
          'FETCH_ERROR',
          `Alpaca News authentication failed (HTTP ${res.status}). Please check ALPACA_API_KEY and ALPACA_SECRET_KEY.`
        );
      }
      if (res.status === 429) {
        throw new SourceUnavailableError(
          this.adapterId,
          'RATE_LIMIT',
          `Alpaca News API rate limit exceeded (HTTP 429).`
        );
      }
      throw new SourceUnavailableError(
        this.adapterId,
        'FETCH_ERROR',
        `Alpaca News API returned HTTP ${res.status} ${res.statusText}`
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch (err: any) {
      throw new SourceUnavailableError(
        this.adapterId,
        'PARSE_ERROR',
        `Failed to parse Alpaca news JSON response: ${err.message}`
      );
    }

    if (!data || typeof data !== 'object' || !Array.isArray(data.news)) {
      throw new SourceUnavailableError(
        this.adapterId,
        'PARSE_ERROR',
        'Alpaca News API returned unexpected payload structure (missing news array).'
      );
    }

    if (data.news.length === 0) {
      return [];
    }

    return data.news.map((item: any, idx: number): RawSourceArticle => {
      const rawHeadline = item.headline || item.title || 'Untitled Market Update';
      const cleanHeadline = stripHtml(rawHeadline);
      const rawSummary = item.summary || item.content || item.headline || '';
      const cleanSummary = stripHtml(rawSummary);

      const publisher = item.source
        ? `Alpaca / ${item.source}`
        : item.author
        ? `Alpaca / ${item.author}`
        : 'Alpaca News Feed';

      const publishedAt = item.created_at || item.updated_at || new Date().toISOString();

      // Heuristic sentiment scoring from headline & summary
      const lowerText = (cleanHeadline + ' ' + cleanSummary).toLowerCase();
      let sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
      const positiveKeywords = ['surge', 'rally', 'record high', 'jump', 'gain', 'inflow', 'breakout', 'soar', 'bullish', 'expansion', 'adoption', 'outperform'];
      const negativeKeywords = ['crash', 'drop', 'slump', 'plunge', 'sell-off', 'hack', 'outflow', 'bearish', 'investigation', 'lawsuit', 'exploit', 'collapse', 'warning', 'risk', 'fraud'];

      const hasPos = positiveKeywords.some(kw => lowerText.includes(kw));
      const hasNeg = negativeKeywords.some(kw => lowerText.includes(kw));
      if (hasPos && !hasNeg) sentiment = 'POSITIVE';
      else if (hasNeg && !hasPos) sentiment = 'NEGATIVE';

      return {
        externalId: item.id ? String(item.id) : `alpaca-news-${idx + 1}`,
        title: cleanHeadline,
        summary: cleanSummary,
        url: item.url || '',
        publisher,
        publishedAt,
        sentiment,
        relevance: 'HIGH',
        isContradictory: sentiment === 'NEGATIVE'
      };
    });
  }
}

/** Singleton instance for use by news and council modules */
export const alpacaNewsAdapter = new AlpacaNewsAdapter();
