import { SocialEvent, SocialFilterStats, SocialSignal } from '../types';

// ---------------------------------------------------------------------------
// Phase 4C: Deterministic Sentiment Signal Extraction
// Evaluates social events and extracts directional signal strength, sentiment
// balance, and prominent discussion narratives.
// ---------------------------------------------------------------------------

const BULLISH_KEYWORDS = [
  'surge', 'rally', 'breakout', 'bullish', 'moon', 'pump', 'accumulate',
  'accumulation', 'etf', 'inflow', 'massive', 'outperform', 'partnership',
  'ath', 'all-time high', 'gem', 'undervalued', 'expansion', 'adoption',
  'milestone', 'upward', 'reversal'
];

const BEARISH_KEYWORDS = [
  'dump', 'crash', 'bearish', 'rug', 'rugpull', 'scam', 'exploit', 'hack',
  'selloff', 'sell-off', 'outflow', 'fraud', 'lawsuit', 'sec', 'investigation',
  'liquidation', 'drawdown', 'plunge', 'overvalued', 'warning', 'danger',
  'collapse', 'slump', 'insider'
];

/**
 * Classifies an individual social event's sentiment deterministically.
 */
export function classifyEventSentiment(text: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  const lower = text.toLowerCase();
  
  let bullScore = 0;
  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) bullScore++;
  }

  let bearScore = 0;
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) bearScore++;
  }

  if (bullScore > bearScore) return 'BULLISH';
  if (bearScore > bullScore) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Extracts key discussion narratives from accepted social text.
 */
export function extractTopNarratives(events: SocialEvent[], limit: number = 3): string[] {
  const narrativeKeywords: Record<string, string> = {
    'etf': 'ETF & Institutional Inflows',
    'reserve': 'Sovereign Reserve Integration',
    'validator': 'Validator Infrastructure & Throughput',
    'firedancer': 'Firedancer Client Upgrade',
    'layer2': 'Layer-2 Scalability & Bridges',
    'liquidity': 'Decentralized Liquidity Growth',
    'concentration': 'Wallet Concentration Risk',
    'whales': 'Whale Wallet Flow Dynamics'
  };

  const counts: Record<string, number> = {};
  for (const event of events) {
    const lower = event.text.toLowerCase();
    for (const [key, label] of Object.entries(narrativeKeywords)) {
      if (lower.includes(key)) {
        counts[label] = (counts[label] || 0) + 1;
      }
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

/**
 * Computes the aggregate SocialSignal from filtered social events.
 */
export function extractSocialSignal(
  symbol: string,
  acceptedEvents: SocialEvent[],
  filterStats: SocialFilterStats
): SocialSignal {
  const now = new Date().toISOString();

  if (acceptedEvents.length === 0) {
    return {
      symbol: symbol.toUpperCase(),
      totalEvents: filterStats.totalReceived,
      acceptedEvents: 0,
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      overallSentiment: 'NEUTRAL',
      confidence: 40,
      signalStrength: 0,
      botSpamFilteredCount: filterStats.spamFilteredCount + filterStats.duplicateCount,
      topNarratives: [],
      generatedAt: now
    };
  }

  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const event of acceptedEvents) {
    const sentiment = event.sentiment || classifyEventSentiment(event.text);
    if (sentiment === 'BULLISH') bullishCount++;
    else if (sentiment === 'BEARISH') bearishCount++;
    else neutralCount++;
  }

  let overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (bullishCount > bearishCount && bullishCount >= acceptedEvents.length * 0.4) {
    overallSentiment = 'BULLISH';
  } else if (bearishCount > bullishCount && bearishCount >= acceptedEvents.length * 0.35) {
    overallSentiment = 'BEARISH';
  }

  // Signal strength: volume + consensus ratio
  const total = acceptedEvents.length;
  const dominance = Math.max(bullishCount, bearishCount, neutralCount) / total;
  const signalStrength = Math.min(100, Math.round(dominance * 70 + Math.min(30, total * 6)));

  // Confidence based on sample size and spam rejection ratio
  const spamRatio = filterStats.totalReceived > 0
    ? (filterStats.spamFilteredCount + filterStats.duplicateCount) / filterStats.totalReceived
    : 0;
  const penalty = spamRatio > 0.5 ? 20 : 0;
  const confidence = Math.max(30, Math.min(95, Math.round(50 + total * 5 - penalty)));

  const topNarratives = extractTopNarratives(acceptedEvents);

  return {
    symbol: symbol.toUpperCase(),
    totalEvents: filterStats.totalReceived,
    acceptedEvents: total,
    bullishCount,
    bearishCount,
    neutralCount,
    overallSentiment,
    confidence,
    signalStrength,
    botSpamFilteredCount: filterStats.spamFilteredCount + filterStats.duplicateCount,
    topNarratives,
    generatedAt: now
  };
}
