import { ReliabilityRating, SocialEvent } from '../types';
import { SocialSourceAdapter } from './types';

// ---------------------------------------------------------------------------
// Phase 4C: Mock Social Adapter (Demo)
// Curated deterministic social event datasets for development and hackathon demos.
// All events are explicitly marked verificationStatus: 'MOCK'.
// ---------------------------------------------------------------------------

const MOCK_SOCIAL_EVENTS: Record<string, SocialEvent[]> = {
  BTC: [
    {
      id: 'soc-btc-1',
      platform: 'X',
      author: {
        username: 'macro_analyst_dan',
        displayName: 'Dan | Macro Analyst',
        verified: true,
        followerCount: 142000,
        accountAgeDays: 1820
      },
      text: '$BTC spot ETF continuous accumulation absorbing 4x daily miner issuance. Macro tailwind accelerating ahead of quarterly options expiry.',
      createdAt: '2026-08-31T06:15:00Z',
      symbols: ['BTC'],
      engagement: {
        likes: 1840,
        reposts: 420,
        replies: 95,
        impressions: 48000
      },
      sourceUrl: 'https://x.example.com/macro_analyst_dan/status/1892839182',
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'BULLISH'
    },
    {
      id: 'soc-btc-2',
      platform: 'FARCASTER',
      author: {
        username: 'onchain_wizard',
        displayName: 'Wizard.eth',
        verified: true,
        followerCount: 28500,
        accountAgeDays: 940
      },
      text: 'Long-term holder dormancy metrics at 18-month high for $BTC. Distribution pressure remains minimal across major exchange deposit wallets.',
      createdAt: '2026-08-31T06:45:00Z',
      symbols: ['BTC'],
      engagement: {
        likes: 620,
        reposts: 110,
        replies: 42
      },
      sourceUrl: 'https://warpcast.example.com/onchain_wizard/0x88ab92c1',
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'BULLISH'
    },
    {
      id: 'soc-btc-3',
      platform: 'REDDIT',
      author: {
        username: 'SovereignHodler',
        followerCount: 450,
        accountAgeDays: 610
      },
      text: 'Treasury commentary regarding Bitcoin reserve integration is a massive psychological shift even if implementation takes years.',
      createdAt: '2026-08-31T07:10:00Z',
      symbols: ['BTC'],
      engagement: {
        likes: 310,
        replies: 88
      },
      sourceUrl: 'https://reddit.example.com/r/cryptocurrency/comments/btc_reserve_macro',
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'BULLISH'
    },
    {
      // Spam post to test filter rejection
      id: 'soc-btc-spam-1',
      platform: 'X',
      author: {
        username: 'crypto_airdrop_bot_99',
        followerCount: 0,
        verified: false
      },
      text: 'FREE AIRDROP for all $BTC holders!! Join telegram t.me/free_btc_airdrop_now guaranteed 100x gem whitelist giveaway!!!',
      createdAt: '2026-08-31T07:20:00Z',
      symbols: ['BTC'],
      engagement: { likes: 0, reposts: 0 },
      sourceUrl: 'https://x.example.com/crypto_airdrop_bot_99/status/9991',
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'NEUTRAL'
    }
  ],
  SOL: [
    {
      id: 'soc-sol-1',
      platform: 'X',
      author: {
        username: 'solana_builder',
        displayName: 'Alex | Solana Dev',
        verified: true,
        followerCount: 68000,
        accountAgeDays: 1400
      },
      text: 'Firedancer v0.8 testnet benchmarks showing 0.8ms average slot finality on $SOL. Transaction throughput and TPS hitting records.',
      createdAt: '2026-08-31T05:50:00Z',
      symbols: ['SOL'],
      engagement: {
        likes: 1250,
        reposts: 310,
        replies: 74,
        impressions: 32000
      },
      sourceUrl: 'https://x.example.com/solana_builder/status/192839182',
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'BULLISH'
    },
    {
      id: 'soc-sol-2',
      platform: 'FARCASTER',
      author: {
        username: 'defi_researcher',
        verified: true,
        followerCount: 19500
      },
      text: 'Solana money market TVL expansion is authentic, but keep an eye on validator stake concentration across top 5 pools ($SOL).',
      createdAt: '2026-08-31T06:30:00Z',
      symbols: ['SOL'],
      engagement: {
        likes: 480,
        reposts: 92,
        replies: 31
      },
      sourceUrl: 'https://warpcast.example.com/defi_researcher/0x99cc',
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'NEUTRAL'
    }
  ],
  NOVA: [
    {
      id: 'soc-nova-1',
      platform: 'X',
      author: {
        username: 'crypto_gem_hunter',
        verified: false,
        followerCount: 8200
      },
      text: '$NOVA bridge launch is huge! Zero gas fees is a game changer for Layer-2 scalability!',
      createdAt: '2026-08-31T04:30:00Z',
      symbols: ['NOVA'],
      engagement: { likes: 95, reposts: 22 },
      sourceUrl: 'https://x.example.com/crypto_gem_hunter/status/771',
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'BULLISH'
    },
    {
      id: 'soc-nova-2',
      platform: 'X',
      author: {
        username: 'chain_sentinel',
        displayName: 'ChainSentinel Security',
        verified: true,
        followerCount: 52000
      },
      text: 'CRITICAL AUDIT: 45% of $NOVA circulating supply controlled by 3 coordinated wallets. Extreme insider concentration and dump risk.',
      createdAt: '2026-08-31T05:15:00Z',
      symbols: ['NOVA'],
      engagement: { likes: 890, reposts: 340, replies: 65 },
      sourceUrl: 'https://x.example.com/chain_sentinel/status/772',
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'BEARISH'
    },
    {
      // Spam duplicate 1
      id: 'soc-nova-bot-1',
      platform: 'X',
      author: { username: 'bot_alpha_1', followerCount: 2 },
      text: 'BUY $NOVA NOW 1000x GEM ALERT PRESALE IS LIVE NOW JOIN TELEGRAM t.me/novaofficial',
      createdAt: '2026-08-31T05:20:00Z',
      symbols: ['NOVA'],
      engagement: { likes: 0, reposts: 0 },
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'BULLISH'
    },
    {
      // Spam duplicate 2
      id: 'soc-nova-bot-2',
      platform: 'X',
      author: { username: 'bot_alpha_2', followerCount: 1 },
      text: 'BUY $NOVA NOW 1000x GEM ALERT PRESALE IS LIVE NOW JOIN TELEGRAM t.me/novaofficial',
      createdAt: '2026-08-31T05:21:00Z',
      symbols: ['NOVA'],
      engagement: { likes: 0, reposts: 0 },
      verificationStatus: 'MOCK',
      adapterSource: 'social-demo-v1',
      sentiment: 'BULLISH'
    }
  ]
};

export class MockSocialAdapter implements SocialSourceAdapter {
  readonly adapterId = 'social-demo-v1';
  readonly adapterName = 'Mock Social Intelligence Adapter (Demo)';
  readonly defaultReliability: ReliabilityRating = 'SECONDARY';

  async fetchSocialEvents(symbol: string): Promise<SocialEvent[]> {
    const clean = symbol.toUpperCase().replace(/^\$/, '').trim();
    const events = MOCK_SOCIAL_EVENTS[clean];

    if (events && events.length > 0) {
      return [...events];
    }

    const now = new Date().toISOString();
    return [
      {
        id: `soc-${clean.toLowerCase()}-generic-1`,
        platform: 'X',
        author: {
          username: 'market_pulse',
          displayName: 'Market Pulse Intelligence',
          verified: true,
          followerCount: 35000
        },
        text: `Community discussion and volume flow activity monitored for $${clean}. Market participants observing liquidity depth and order books.`,
        createdAt: now,
        symbols: [clean],
        engagement: { likes: 120, reposts: 25 },
        sourceUrl: `https://x.example.com/market_pulse/status/${clean.toLowerCase()}`,
        verificationStatus: 'MOCK',
        adapterSource: 'social-demo-v1',
        sentiment: 'NEUTRAL'
      }
    ];
  }
}

/** Singleton instance for development and demonstration */
export const mockSocialAdapter = new MockSocialAdapter();
