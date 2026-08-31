import { Evidence } from '../types';
import { alpacaNewsAdapter } from '../connectors/alpaca-news-adapter';
import { mockNewsAdapter } from '../connectors/mock-news-adapter';
import { fetchAndNormalize, normalizeToEvidence } from '../connectors/normalizer';

// ---------------------------------------------------------------------------
// Phase 4A: Alpaca News Intelligence Integration
// getNewsEvidence delegates to AlpacaNewsAdapter via the EvidenceSourceAdapter
// contract.
//
// Invariants:
// - Primary external news source is Alpaca Market Data News REST API (v1beta1).
// - Verification status for live Alpaca news is 'VERIFIED'.
// - Timestamp separation: observedAt = article.publishedAt, retrievedAt = fetch time.
// - No fabricated external data: network, auth, or API failures produce explicit
//   'FAILED' evidence items rather than fabricated news.
// - Empty news response ({ news: [] }) returns empty array [] without fabrication.
// - MockNewsAdapter is retained for tests and fallback scenarios.
// ---------------------------------------------------------------------------

/**
 * Fetches and normalizes live market news for an investigation.
 */
export async function getNewsEvidence(investigationId: string, symbol: string): Promise<Evidence[]> {
  const cleanSymbol = symbol.toUpperCase().replace('$', '').trim();
  return fetchAndNormalize(alpacaNewsAdapter, cleanSymbol, investigationId, 'VERIFIED');
}

/**
 * Synchronous/mock helper retained for mock-testing and baseline reference.
 */
export function getMockNewsEvidence(investigationId: string, symbol: string): Evidence[] {
  const cleanSymbol = symbol.toUpperCase().replace('$', '').trim();
  const articles = _getMockArticlesSync(cleanSymbol);
  return normalizeToEvidence(articles, investigationId, mockNewsAdapter, 'MOCK', 0);
}

function _getMockArticlesSync(cleanSymbol: string) {
  const MOCK_DATABASE: Record<string, Parameters<typeof normalizeToEvidence>[0]> = {
    NOVA: [
      {
        externalId: 'news-nova-1',
        title: 'NOVA Network Announces Layer-2 Bridge Launch with Zero-Gas Protocol',
        summary: 'Promotional press release detailing high-throughput bridge capabilities and partnership claims.',
        url: 'https://cryptonews.example.com/nova-layer2-bridge-launch',
        publisher: 'CryptoNews Daily',
        publishedAt: '2026-08-29T14:15:00Z',
        sentiment: 'POSITIVE' as const,
        relevance: 'HIGH' as const,
        isContradictory: false
      },
      {
        externalId: 'news-nova-2',
        title: 'Unusual Whale Wallet Activity Detected: 45% Supply Clustered Across 3 Entities',
        summary: 'On-chain security audit notes insider wallet cluster created 48 hours before marketing push.',
        url: 'https://chainsecurity.example.com/audits/nova-concentration-risk',
        publisher: 'ChainAudit Intelligence',
        publishedAt: '2026-08-29T15:30:00Z',
        sentiment: 'NEGATIVE' as const,
        relevance: 'HIGH' as const,
        isContradictory: true
      },
      {
        externalId: 'news-nova-3',
        title: 'Community Buzz Surges Across Social Channels for $NOVA',
        summary: 'Social sentiment scores show 400% surge in mention volume, but bot detection flags 62% bot activity.',
        url: 'https://sentimentlens.example.com/reports/nova-social-spike',
        publisher: 'SentimentLens',
        publishedAt: '2026-08-29T16:00:00Z',
        sentiment: 'NEUTRAL' as const,
        relevance: 'MEDIUM' as const,
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
        sentiment: 'POSITIVE' as const,
        relevance: 'HIGH' as const,
        isContradictory: false
      },
      {
        externalId: 'news-sol-2',
        title: 'Solana Ecosystem TVL Expands by $1.2B Across Decentralized Credit Markets',
        summary: 'Lending protocols report organic inflow without excessive token emission incentives.',
        url: 'https://defipulse.example.com/solana-tvl-record',
        publisher: 'DeFi Pulse Daily',
        publishedAt: '2026-08-29T13:45:00Z',
        sentiment: 'POSITIVE' as const,
        relevance: 'HIGH' as const,
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
        sentiment: 'POSITIVE' as const,
        relevance: 'HIGH' as const,
        isContradictory: false
      }
    ]
  };

  return MOCK_DATABASE[cleanSymbol] ?? [
    {
      externalId: `news-${cleanSymbol.toLowerCase()}-generic`,
      title: `${cleanSymbol} Market Summary & Industry Developments`,
      summary: `General trading developments and liquidity flows observed for ${cleanSymbol}. No specific catalyst articles found in the demo dataset.`,
      url: `https://marketwatch.example.com/crypto/${cleanSymbol.toLowerCase()}`,
      publisher: 'MarketWatch Crypto (Demo)',
      publishedAt: new Date().toISOString(),
      sentiment: 'NEUTRAL' as const,
      relevance: 'MEDIUM' as const,
      isContradictory: false
    }
  ];
}
