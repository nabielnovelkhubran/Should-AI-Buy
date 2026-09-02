export interface ParsedCommand {
  intent: 'BUY' | 'SELL' | 'WATCH' | 'WHY' | 'UNKNOWN';
  asset: string;
  raw: string;
  valid: boolean;
  explanation?: string;
}

export interface AutocompleteSuggestion {
  command: string;
  title: string;
  category: 'BUY' | 'SELL' | 'WATCH' | 'WHY';
  description: string;
}

export const AUTOCOMPLETE_SUGGESTIONS: AutocompleteSuggestion[] = [
  {
    command: 'Should-AI buy $BTC?',
    title: 'Should-AI buy $BTC?',
    category: 'BUY',
    description: 'Investigate Bitcoin 24/7 crypto spot price, volume acceleration, and council thesis'
  },
  {
    command: 'Should-AI buy $AAPL?',
    title: 'Should-AI buy $AAPL?',
    category: 'BUY',
    description: 'Investigate Apple Inc. stock snapshot, Friday close over weekend, and council thesis'
  },
  {
    command: 'Should-AI buy $NVDA?',
    title: 'Should-AI buy $NVDA?',
    category: 'BUY',
    description: 'Investigate NVIDIA stock snapshot, latest trading session state, and valuation risk'
  },
  {
    command: 'Should-AI buy $ETH?',
    title: 'Should-AI buy $ETH?',
    category: 'BUY',
    description: 'Analyze Ethereum market structure, 1H/1D candles, and volatility'
  },
  {
    command: 'Should-AI buy $SOL?',
    title: 'Should-AI buy $SOL?',
    category: 'BUY',
    description: 'Evaluate Solana liquidity depth, breakout momentum, and Red-Team refutation'
  },
  {
    command: 'Should-AI sell $BTC?',
    title: 'Should-AI sell $BTC?',
    category: 'SELL',
    description: 'Evaluate open Bitcoin position against trade thesis invalidation conditions'
  },
  {
    command: 'Should-AI watch $NVDA?',
    title: 'Should-AI watch $NVDA?',
    category: 'WATCH',
    description: 'Monitor NVIDIA stock price and trigger council alert when volume accelerates'
  },
  {
    command: 'Why did you reject $BTC?',
    title: 'Why did you reject $BTC?',
    category: 'WHY',
    description: 'Inspect full Red-Team adversarial findings and contradictory evidence'
  }
];

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return { intent: 'UNKNOWN', asset: '', raw: input, valid: false, explanation: 'Empty command.' };
  }

  const buyMatch = trimmed.match(/^(?:should[\s-]ai\s+buy|buy)\s+\$?([a-zA-Z0-9_-]+)\??$/i);
  if (buyMatch) {
    return { intent: 'BUY', asset: buyMatch[1].toUpperCase(), raw: trimmed, valid: true };
  }

  const sellMatch = trimmed.match(/^(?:should[\s-]ai\s+sell|sell)\s+\$?([a-zA-Z0-9_-]+)\??$/i);
  if (sellMatch) {
    return { intent: 'SELL', asset: sellMatch[1].toUpperCase(), raw: trimmed, valid: true };
  }

  const watchMatch = trimmed.match(/^(?:should[\s-]ai\s+watch|watch)\s+\$?([a-zA-Z0-9_-]+)\??$/i);
  if (watchMatch) {
    return { intent: 'WATCH', asset: watchMatch[1].toUpperCase(), raw: trimmed, valid: true };
  }

  const whyMatch = trimmed.match(/^(?:why(?:\s+did\s+you\s+reject|\s+rejected)?|explain)\s+\$?([a-zA-Z0-9_-]+)\??$/i);
  if (whyMatch) {
    return { intent: 'WHY', asset: whyMatch[1].toUpperCase(), raw: trimmed, valid: true };
  }

  const tickerOnly = trimmed.match(/^\$?([a-zA-Z0-9_-]{2,10})\??$/);
  if (tickerOnly) {
    return { intent: 'BUY', asset: tickerOnly[1].toUpperCase(), raw: trimmed, valid: true };
  }

  return {
    intent: 'UNKNOWN',
    asset: '',
    raw: trimmed,
    valid: false,
    explanation: 'Unrecognized format. Try "Should-AI buy $BTC?" or select an option below.'
  };
}
