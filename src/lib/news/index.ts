import { Evidence, ReliabilityRating } from '../types';

export interface RawNewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  publisher: string;
  publishedAt: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  reliability: ReliabilityRating;
  isContradictory?: boolean;
}

export const MOCK_NEWS_DATABASE: Record<string, RawNewsArticle[]> = {
  NOVA: [
    {
      id: 'news-nova-1',
      title: 'NOVA Network Announces Layer-2 Bridge Launch with Zero-Gas Protocol',
      summary: 'Promotional press release detailing high-throughput bridge capabilities and partnership claims.',
      url: 'https://cryptonews.example.com/nova-layer2-bridge-launch',
      publisher: 'CryptoNews Daily',
      publishedAt: '2026-08-29T14:15:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      reliability: 'REPUTABLE'
    },
    {
      id: 'news-nova-2',
      title: 'Unusual Whale Wallet Activity Detected: 45% Supply Clustered Across 3 Entities',
      summary: 'On-chain security audit notes insider wallet cluster created 48 hours before marketing push.',
      url: 'https://chainsecurity.example.com/audits/nova-concentration-risk',
      publisher: 'ChainAudit Intelligence',
      publishedAt: '2026-08-29T15:30:00Z',
      sentiment: 'NEGATIVE',
      relevance: 'HIGH',
      reliability: 'PRIMARY',
      isContradictory: true
    },
    {
      id: 'news-nova-3',
      title: 'Community Buzz Surges Across Social Channels for $NOVA',
      summary: 'Social sentiment scores show 400% surge in mention volume, but bot detection flags 62% bot activity.',
      url: 'https://sentimentlens.example.com/reports/nova-social-spike',
      publisher: 'SentimentLens',
      publishedAt: '2026-08-29T16:00:00Z',
      sentiment: 'NEUTRAL',
      relevance: 'MEDIUM',
      reliability: 'SECONDARY',
      isContradictory: true
    }
  ],
  SOL: [
    {
      id: 'news-sol-1',
      title: 'Solana DEX Volume Flips Major Rivals as Firedancer Validator Rollout Accelerates',
      summary: 'Institutional validator adoption reaches all-time high with sub-millisecond execution benchmarks.',
      url: 'https://bloomberg.example.com/crypto/solana-dex-volume-surge',
      publisher: 'Bloomberg Financial',
      publishedAt: '2026-08-29T12:00:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      reliability: 'PRIMARY'
    },
    {
      id: 'news-sol-2',
      title: 'Solana Ecosystem TVL Expands by $1.2B Across Decentralized Credit Markets',
      summary: 'Lending protocols report organic inflow without excessive token emission incentives.',
      url: 'https://defipulse.example.com/solana-tvl-record',
      publisher: 'DeFi Pulse Daily',
      publishedAt: '2026-08-29T13:45:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      reliability: 'PRIMARY'
    }
  ],
  BTC: [
    {
      id: 'news-btc-1',
      title: 'Bitcoin Spot ETF Inflows Reach $650M Single-Day Record',
      summary: 'Institutional asset managers absorb miners sell-pressure following difficulty adjustment.',
      url: 'https://reuters.example.com/markets/bitcoin-etf-inflows-record',
      publisher: 'Reuters Markets',
      publishedAt: '2026-08-29T11:00:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      reliability: 'PRIMARY'
    }
  ]
};

/**
 * Normalizes raw news articles into first-class structured Evidence domain objects.
 */
export function getNewsEvidence(investigationId: string, symbol: string): Evidence[] {
  const cleanSymbol = symbol.toUpperCase().replace('$', '');
  const articles = MOCK_NEWS_DATABASE[cleanSymbol] || [
    {
      id: `news-${cleanSymbol.toLowerCase()}-generic`,
      title: `${cleanSymbol} Market Summary & Industry Developments`,
      summary: `General trading developments and liquidity flows observed for ${cleanSymbol}.`,
      url: `https://marketwatch.example.com/crypto/${cleanSymbol.toLowerCase()}`,
      publisher: 'MarketWatch Crypto',
      publishedAt: new Date().toISOString(),
      sentiment: 'NEUTRAL' as const,
      relevance: 'MEDIUM' as const,
      reliability: 'REPUTABLE' as const
    }
  ];

  return articles.map((article, idx) => ({
    id: `EVID-NEWS-${investigationId}-${idx + 1}`,
    investigationId,
    type: 'NEWS',
    title: article.title,
    description: article.summary,
    observedAt: article.publishedAt,
    source: {
      name: article.publisher,
      url: article.url,
      publisher: article.publisher,
      publishedAt: article.publishedAt,
      retrievedAt: new Date().toISOString()
    },
    value: {
      sentiment: article.sentiment,
      relevance: article.relevance
    },
    metadata: {
      isContradictory: Boolean(article.isContradictory)
    },
    reliability: article.reliability,
    isContradictory: Boolean(article.isContradictory)
  }));
}
