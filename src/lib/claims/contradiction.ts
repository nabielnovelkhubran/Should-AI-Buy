import { Claim } from '../types';

// ---------------------------------------------------------------------------
// Phase 3: Contradiction Matrix Computation
// Produces a deterministic, tabular view of which topics have both supporting
// and contradicting claims — used by ContradictionMatrix.tsx.
// ---------------------------------------------------------------------------

export interface ContradictionRow {
  topic: string;
  bullishClaims: Claim[];
  bearishClaims: Claim[];
  refutations: Claim[];
  isContested: boolean;
}

export interface ContradictionMatrix {
  rows: ContradictionRow[];
  totalContestedTopics: number;
  totalRefutations: number;
}

const TOPICS: { label: string; keywords: string[] }[] = [
  { label: 'Momentum', keywords: ['momentum', 'rsi', 'trend', 'acceleration'] },
  { label: 'Liquidity', keywords: ['liquidity', 'spread', 'depth', 'slippage', 'exit'] },
  { label: 'Catalyst', keywords: ['catalyst', 'news', 'etf', 'tvl', 'bridge', 'launch', 'announcement'] },
  { label: 'Concentration', keywords: ['concentration', 'holder', 'wallet', 'whale', 'insider', 'supply'] },
  { label: 'Volume', keywords: ['volume', 'rvol', 'wash', 'organic'] },
  { label: 'Risk', keywords: ['risk', 'unlock', 'suspicious', 'transfer', 'anomaly'] },
  { label: 'Volatility', keywords: ['volatility', 'overbought', 'overextended', 'exhaustion'] },
];

function matchesTopic(claim: Claim, keywords: string[]): boolean {
  const text = claim.statement.toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

/**
 * Builds the contradiction matrix by categorizing claims into topic buckets
 * and checking whether each topic has both supporting and opposing claims.
 * This is entirely deterministic — no LLM involvement.
 */
export function buildContradictionMatrix(claims: Claim[]): ContradictionMatrix {
  const rows: ContradictionRow[] = [];

  for (const { label, keywords } of TOPICS) {
    const matching = claims.filter(c => matchesTopic(c, keywords));
    if (matching.length === 0) continue;

    const bullishClaims = matching.filter(c => c.type === 'BULLISH');
    const bearishClaims = matching.filter(c => c.type === 'BEARISH');
    const refutations = matching.filter(c => c.type === 'REFUTATION');

    const hasSupport = bullishClaims.length > 0;
    const hasOpposition = bearishClaims.length > 0 || refutations.length > 0;
    const isContested = hasSupport && hasOpposition;

    rows.push({
      topic: label,
      bullishClaims,
      bearishClaims,
      refutations,
      isContested
    });
  }

  return {
    rows,
    totalContestedTopics: rows.filter(r => r.isContested).length,
    totalRefutations: claims.filter(c => c.type === 'REFUTATION').length,
  };
}
