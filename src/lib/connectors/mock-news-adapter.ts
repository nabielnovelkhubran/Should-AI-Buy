import { ReliabilityRating } from '../types';
import { EvidenceSourceAdapter, RawSourceArticle } from './types';

// ---------------------------------------------------------------------------
// Phase 3: Mock News Adapter
// Wraps the existing MOCK_NEWS_DATABASE in the EvidenceSourceAdapter contract.
// All evidence from this adapter is labeled verificationStatus: 'MOCK' — which
// is honest: this is demo data, not live intelligence.
// ---------------------------------------------------------------------------

/**
 * Static demo news dataset.
 * Previously lived directly in src/lib/news/index.ts as a raw object.
 * Now wrapped behind the adapter contract so verificationStatus = 'MOCK' is
 * correctly propagated through the normalizer.
 */
const MOCK_NEWS_DATABASE: Record<string, RawSourceArticle[]> = {
  NOVA: [
    {
      externalId: 'news-nova-1',
      title: 'NOVA Network Announces Layer-2 Bridge Launch with Zero-Gas Protocol',
      summary: 'Promotional press release detailing high-throughput bridge capabilities and partnership claims.',
      url: 'https://cryptonews.example.com/nova-layer2-bridge-launch',
      publisher: 'CryptoNews Daily',
      publishedAt: '2026-08-29T14:15:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    },
    {
      externalId: 'news-nova-2',
      title: 'Unusual Whale Wallet Activity Detected: 45% Supply Clustered Across 3 Entities',
      summary: 'On-chain security audit notes insider wallet cluster created 48 hours before marketing push.',
      url: 'https://chainsecurity.example.com/audits/nova-concentration-risk',
      publisher: 'ChainAudit Intelligence',
      publishedAt: '2026-08-29T15:30:00Z',
      sentiment: 'NEGATIVE',
      relevance: 'HIGH',
      isContradictory: true
    },
    {
      externalId: 'news-nova-3',
      title: 'Community Buzz Surges Across Social Channels for $NOVA',
      summary: 'Social sentiment scores show 400% surge in mention volume, but bot detection flags 62% bot activity.',
      url: 'https://sentimentlens.example.com/reports/nova-social-spike',
      publisher: 'SentimentLens',
      publishedAt: '2026-08-29T16:00:00Z',
      sentiment: 'NEUTRAL',
      relevance: 'MEDIUM',
      isContradictory: true
    }
  ],
  SOL: [
    {
      externalId: 'news-sol-1',
      title: 'Solana DEX Volume Flips Major Rivals as Firedancer Validator Rollout Accelerates',
      summary: 'Institutional validator adoption reaches all-time high with sub-millisecond execution benchmarks.',
      url: 'https://bloomberg.example.com/crypto/solana-dex-volume-surge',
      publisher: 'Bloomberg Financial',
      publishedAt: '2026-08-29T12:00:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    },
    {
      externalId: 'news-sol-2',
      title: 'Solana Ecosystem TVL Expands by $1.2B Across Decentralized Credit Markets',
      summary: 'Lending protocols report organic inflow without excessive token emission incentives.',
      url: 'https://defipulse.example.com/solana-tvl-record',
      publisher: 'DeFi Pulse Daily',
      publishedAt: '2026-08-29T13:45:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    }
  ],
  BTC: [
    {
      externalId: 'news-btc-1',
      title: 'Bitcoin Spot ETF Inflows Reach $650M Single-Day Record',
      summary: 'Institutional asset managers absorb miners sell-pressure following difficulty adjustment.',
      url: 'https://reuters.example.com/markets/bitcoin-etf-inflows-record',
      publisher: 'Reuters Markets',
      publishedAt: '2026-08-29T11:00:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    }
  ]
};

/**
 * MockNewsAdapter implements EvidenceSourceAdapter.
 * Used during development/demo. The normalizer will set verificationStatus: 'MOCK'
 * on all evidence produced by this adapter — an honest label.
 */
export class MockNewsAdapter implements EvidenceSourceAdapter {
  readonly adapterId = 'mock-news-v1';
  readonly adapterName = 'Mock News Database (Demo)';
  readonly defaultReliability: ReliabilityRating = 'REPUTABLE';

  async fetchForSymbol(symbol: string): Promise<RawSourceArticle[]> {
    const cleanSymbol = symbol.toUpperCase().replace('$', '');
    const articles = MOCK_NEWS_DATABASE[cleanSymbol];

    if (articles && articles.length > 0) {
      return articles;
    }

    // Return a generic entry for unknown symbols rather than throwing —
    // absence of specific news is valid information.
    return [
      {
        externalId: `news-${cleanSymbol.toLowerCase()}-generic`,
        title: `${cleanSymbol} Market Summary & Industry Developments`,
        summary: `General trading developments and liquidity flows observed for ${cleanSymbol}. No specific catalyst articles found in the demo dataset.`,
        url: `https://marketwatch.example.com/crypto/${cleanSymbol.toLowerCase()}`,
        publisher: 'MarketWatch Crypto (Demo)',
        publishedAt: new Date().toISOString(),
        sentiment: 'NEUTRAL',
        relevance: 'MEDIUM',
        isContradictory: false
      }
    ];
  }
}

/** Singleton instance for use by the council */
export const mockNewsAdapter = new MockNewsAdapter();
