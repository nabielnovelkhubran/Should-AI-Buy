import { ReliabilityRating } from '../types';
import { EvidenceSourceAdapter, RawSourceArticle } from './types';
import { stripHtml } from './alpaca-news-adapter';

// ---------------------------------------------------------------------------
// Phase 4B: Hackathon Demo News Fallback Adapter
// Provides a deterministic, curated set of demonstration scenarios when live
// Alpaca news is unavailable, empty, or stale.
//
// Invariants:
// - Never masquerades as real-world news: verificationStatus is always 'MOCK'.
// - adapterSource is always 'hackathon-demo-fallback'.
// - 100% Deterministic: NO Math.random() in article selection or fields.
// - All HTML content is safely stripped.
// ---------------------------------------------------------------------------

const HACKATHON_SCENARIOS: Record<string, RawSourceArticle[]> = {
  BTC: [
    {
      externalId: 'demo-btc-1',
      title: 'Breaking: US Federal Reserve Evaluates Strategic Bitcoin Reserve Integration Framework',
      summary: 'Special working group issues preliminary briefing exploring sovereign digital asset reserve custody guidelines and settlement mechanics.',
      url: 'https://demo-briefing.example.com/macro/fed-strategic-bitcoin-reserve',
      publisher: 'MacroReserve Intelligence (Hackathon Demo)',
      publishedAt: '2026-08-31T06:00:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    },
    {
      externalId: 'demo-btc-2',
      title: 'Treasury Advisory Committee Raises Sovereign Volatility and Custody Risk Flags',
      summary: 'Advisory members caution against near-term treasury reserve allocation citing historical 30-day drawdown amplitude and validator dependency.',
      url: 'https://demo-briefing.example.com/gov/treasury-crypto-risk-memo',
      publisher: 'PolicyLens Audit (Hackathon Demo)',
      publishedAt: '2026-08-31T06:30:00Z',
      sentiment: 'NEGATIVE',
      relevance: 'HIGH',
      isContradictory: true
    },
    {
      externalId: 'demo-btc-3',
      title: 'Institutional Spot ETF Net Inflows Exceed $650M for Third Consecutive Trading Session',
      summary: 'Registered investment advisors allocate secondary liquidity as ETF custody holdings absorb post-halving miner treasury flow.',
      url: 'https://demo-briefing.example.com/etf/institutional-inflows-record',
      publisher: 'ETF Monitor (Hackathon Demo)',
      publishedAt: '2026-08-31T07:00:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    }
  ],
  SOL: [
    {
      externalId: 'demo-sol-1',
      title: 'Solana Ecosystem DEX Volume Outpaces Major L1 Rivals as Firedancer Enters Final Testnet Phase',
      summary: 'Validator client benchmark records sub-millisecond execution latency with multi-thread parallel transaction processing.',
      url: 'https://demo-briefing.example.com/defi/solana-firedancer-benchmarks',
      publisher: 'Solana Ecosystem Daily (Hackathon Demo)',
      publishedAt: '2026-08-31T05:30:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    },
    {
      externalId: 'demo-sol-2',
      title: 'Decentralized Credit Markets on Solana Expand Total Value Locked by $1.2B',
      summary: 'Institutional credit lines report sustained organic collateralization without excessive emission subsidy incentives.',
      url: 'https://demo-briefing.example.com/tvl/solana-credit-expansion',
      publisher: 'DeFi Pulse (Hackathon Demo)',
      publishedAt: '2026-08-31T06:15:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    },
    {
      externalId: 'demo-sol-3',
      title: 'Concentration Warning: Top 5 Stake Pools Control 41% of Active Validator Stake',
      summary: 'Security review highlights stake clustering across top node operators, advising continuous monitoring of validator voting distribution.',
      url: 'https://demo-briefing.example.com/sec/solana-stake-concentration',
      publisher: 'ValidatorWatch (Hackathon Demo)',
      publishedAt: '2026-08-31T06:45:00Z',
      sentiment: 'NEGATIVE',
      relevance: 'MEDIUM',
      isContradictory: true
    }
  ],
  NOVA: [
    {
      externalId: 'demo-nova-1',
      title: 'NOVA Network Announces Layer-2 Bridge Launch with Zero-Gas Protocol Claim',
      summary: 'Promotional press release detailing high-throughput bridge capabilities and partnership claims.',
      url: 'https://demo-briefing.example.com/nova/layer2-bridge-launch',
      publisher: 'CryptoPulse Daily (Hackathon Demo)',
      publishedAt: '2026-08-31T04:15:00Z',
      sentiment: 'POSITIVE',
      relevance: 'HIGH',
      isContradictory: false
    },
    {
      externalId: 'demo-nova-2',
      title: 'On-Chain Security Audit: 45% of Circulating Supply Clustered Across 3 Connected Wallets',
      summary: 'Forensic cluster analysis detects insider wallet accumulation 48 hours prior to marketing announcement.',
      url: 'https://demo-briefing.example.com/audits/nova-holder-concentration',
      publisher: 'ChainAudit Intelligence (Hackathon Demo)',
      publishedAt: '2026-08-31T05:00:00Z',
      sentiment: 'NEGATIVE',
      relevance: 'HIGH',
      isContradictory: true
    },
    {
      externalId: 'demo-nova-3',
      title: 'Social Sentiment Surge Detected: 62% Bot Activity Flagged by Narrative Scanner',
      summary: 'Mention volume spiked 400% across social channels; coordinated account creation signatures detected.',
      url: 'https://demo-briefing.example.com/sentiment/nova-bot-cluster',
      publisher: 'SentimentLens (Hackathon Demo)',
      publishedAt: '2026-08-31T05:30:00Z',
      sentiment: 'NEUTRAL',
      relevance: 'MEDIUM',
      isContradictory: true
    }
  ]
};

export class HackathonDemoNewsAdapter implements EvidenceSourceAdapter {
  readonly adapterId = 'hackathon-demo-fallback';
  readonly adapterName = 'Hackathon Demo News Fallback';
  readonly defaultReliability: ReliabilityRating = 'REPUTABLE';

  async fetchForSymbol(symbol: string): Promise<RawSourceArticle[]> {
    const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '').trim();
    const scenario = HACKATHON_SCENARIOS[cleanSymbol];

    if (scenario && scenario.length > 0) {
      return scenario.map(item => ({
        ...item,
        title: stripHtml(item.title),
        summary: stripHtml(item.summary)
      }));
    }

    // Deterministic fallback for any other ticker
    const now = new Date().toISOString();
    return [
      {
        externalId: `demo-${cleanSymbol.toLowerCase()}-catalyst`,
        title: `${cleanSymbol} Ecosystem Update: Protocol Volume and Liquidity Trajectory (Demo Scenario)`,
        summary: `Simulated demonstration disclosure for ${cleanSymbol}. Institutional market participation and volume acceleration under active council review.`,
        url: `https://demo-briefing.example.com/assets/${cleanSymbol.toLowerCase()}`,
        publisher: 'MarketLens Intelligence (Hackathon Demo)',
        publishedAt: now,
        sentiment: 'NEUTRAL',
        relevance: 'MEDIUM',
        isContradictory: false
      }
    ];
  }
}

/** Singleton instance for use by the hybrid news router */
export const hackathonDemoNewsAdapter = new HackathonDemoNewsAdapter();
