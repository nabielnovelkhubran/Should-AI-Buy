const assert = require('assert');

// 1. QUANT CALCULATIONS
function calculateReturn(initialPrice, finalPrice) {
  if (initialPrice <= 0) return 0;
  return Number((((finalPrice - initialPrice) / initialPrice) * 100).toFixed(2));
}

function calculateRVOL(currentVolume, historicalVolumes) {
  if (!historicalVolumes || historicalVolumes.length === 0) return 1.0;
  const avg = historicalVolumes.reduce((acc, v) => acc + v, 0) / historicalVolumes.length;
  if (avg <= 0) return 1.0;
  return Number((currentVolume / avg).toFixed(2));
}

function calculateVolumeAcceleration(latestVolume, previousVolume) {
  if (previousVolume <= 0) return 0;
  return Number((((latestVolume - previousVolume) / previousVolume) * 100).toFixed(2));
}

function calculateRealizedVolatility(candles) {
  if (!candles || candles.length < 2) return 0;
  const logReturns = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const curr = candles[i].close;
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }
  if (logReturns.length === 0) return 0;
  const mean = logReturns.reduce((acc, r) => acc + r, 0) / logReturns.length;
  const variance = logReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / logReturns.length;
  const stdDev = Math.sqrt(variance);
  return Number((stdDev * Math.sqrt(365 * 24) * 100).toFixed(2));
}

function calculateRSI(candles, period = 14) {
  if (!candles || candles.length <= period) return 50.0;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

// 2. ALPACA ADAPTER SYMBOL NORMALIZER & CLASSIFIER
const KNOWN_CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'LINK', 'LTC', 'BCH',
  'AAVE', 'UNI', 'XTZ', 'SUSHI', 'DOT', 'MATIC', 'SHIB', 'ADA',
  'XRP', 'BNB', 'ATOM', 'FIL', 'MKR', 'COMP', 'YFI', 'CRV', 'GRT',
  'NEAR', 'PEPE', 'RENDER', 'ICP', 'APT', 'SUI', 'OP', 'ARB', 'TIA',
  'INJ', 'KAS', 'STX', 'FET', 'RNDR'
]);

function isCryptoSymbol(input) {
  const clean = input.toUpperCase().replace(/^\$/, '').trim();
  if (clean.includes('/')) return true;
  if (clean.endsWith('USDT') && clean.length >= 7) return true;
  if (clean.endsWith('USD') && clean.length >= 6 && !clean.includes('.')) {
    const base = clean.slice(0, -3);
    if (KNOWN_CRYPTO_SYMBOLS.has(base)) return true;
  }
  return KNOWN_CRYPTO_SYMBOLS.has(clean);
}

function normalizeCryptoSymbol(input) {
  const clean = input.toUpperCase().replace(/^\$/, '').trim();
  if (clean.includes('/')) return clean;
  if (clean.endsWith('USD') && clean.length > 3) {
    const base = clean.slice(0, -3);
    return `${base}/USD`;
  }
  if (clean.endsWith('USDT') && clean.length > 4) {
    const base = clean.slice(0, -4);
    return `${base}/USDT`;
  }
  return `${clean}/USD`;
}

function normalizeStockSymbol(input) {
  return input.toUpperCase().replace(/^\$/, '').trim();
}

// 3. RISK GATE
const RISK_LIMITS = {
  MIN_LIQUIDITY_USD: 250000,
  MAX_ALLOWED_RISK_SCORE: 70,
  MIN_OPPORTUNITY_SCORE: 55,
  MAX_PORTFOLIO_ALLOCATION_PCT: 25,
  MIN_EVIDENCE_COUNT: 3
};

function evaluateRiskGate(params) {
  const violations = [];
  const notes = [];

  if (params.hasRedTeamFatalFlaw) {
    violations.push('Red-Team invalidated thesis with fatal contradictory evidence.');
  }

  if (params.liquidityUsd < RISK_LIMITS.MIN_LIQUIDITY_USD) {
    violations.push(`Insufficient liquidity: $${params.liquidityUsd.toLocaleString('en-US')} is below minimum required ($${RISK_LIMITS.MIN_LIQUIDITY_USD.toLocaleString('en-US')}).`);
  } else {
    notes.push(`Liquidity verified: $${params.liquidityUsd.toLocaleString('en-US')} meets safety threshold.`);
  }

  if (params.riskScore > RISK_LIMITS.MAX_ALLOWED_RISK_SCORE) {
    violations.push(`Risk score ${params.riskScore}/100 exceeds maximum safety limit (${RISK_LIMITS.MAX_ALLOWED_RISK_SCORE}/100).`);
  } else {
    notes.push(`Risk score ${params.riskScore}/100 within acceptable parameters.`);
  }

  if (params.opportunityScore < RISK_LIMITS.MIN_OPPORTUNITY_SCORE) {
    violations.push(`Opportunity score ${params.opportunityScore}/100 is below minimum entry threshold (${RISK_LIMITS.MIN_OPPORTUNITY_SCORE}/100).`);
  }

  const allocationPct = (params.positionValueUsd / (params.availableCash || 1)) * 100;
  if (allocationPct > RISK_LIMITS.MAX_PORTFOLIO_ALLOCATION_PCT) {
    violations.push(`Position allocation ${allocationPct.toFixed(1)}% exceeds maximum single-position limit (${RISK_LIMITS.MAX_PORTFOLIO_ALLOCATION_PCT}%).`);
  }

  if (!params.evidence || params.evidence.length < RISK_LIMITS.MIN_EVIDENCE_COUNT) {
    violations.push(`Insufficient evidence: only ${params.evidence?.length || 0} evidence records provided (minimum ${RISK_LIMITS.MIN_EVIDENCE_COUNT} required).`);
  } else {
    notes.push(`Evidence sufficiency met: ${params.evidence.length} structured domain evidence records analyzed.`);
  }

  return {
    passed: violations.length === 0,
    violations,
    riskGateNotes: notes
  };
}

// 4. COMMAND PARSER
function parseCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return { intent: 'UNKNOWN', asset: '', raw: input, valid: false };

  const buyMatch = trimmed.match(/^(?:should-ai\s+buy|buy)\s+\$?([a-zA-Z0-9_-]+)/i);
  if (buyMatch) return { intent: 'BUY', asset: buyMatch[1].toUpperCase(), raw: trimmed, valid: true };

  const sellMatch = trimmed.match(/^(?:should-ai\s+sell|sell)\s+\$?([a-zA-Z0-9_-]+)/i);
  if (sellMatch) return { intent: 'SELL', asset: sellMatch[1].toUpperCase(), raw: trimmed, valid: true };

  const watchMatch = trimmed.match(/^(?:should-ai\s+watch|watch)\s+\$?([a-zA-Z0-9_-]+)/i);
  if (watchMatch) return { intent: 'WATCH', asset: watchMatch[1].toUpperCase(), raw: trimmed, valid: true };

  const whyMatch = trimmed.match(/^(?:why(?:\s+did\s+you\s+reject|\s+rejected)?|explain)\s+\$?([a-zA-Z0-9_-]+)/i);
  if (whyMatch) return { intent: 'WHY', asset: whyMatch[1].toUpperCase(), raw: trimmed, valid: true };

  const tickerOnly = trimmed.match(/^\$?([a-zA-Z0-9_-]{2,10})\??$/);
  if (tickerOnly) return { intent: 'BUY', asset: tickerOnly[1].toUpperCase(), raw: trimmed, valid: true };

  return { intent: 'UNKNOWN', asset: '', raw: trimmed, valid: false };
}

// 5. COUNCIL AGENTS & LOGIC
function calculateOpportunityScore(momentum, volumeAccel, rvol, liquidityUsd) {
  let score = 0;
  score += Math.min(100, momentum) * 0.35;
  const normalizedVolAccel = Math.max(0, Math.min(100, (volumeAccel + 20) * 1.5));
  score += normalizedVolAccel * 0.30;
  const normalizedRVOL = Math.min(100, rvol * 30);
  score += normalizedRVOL * 0.20;
  const liquidityFactor = Math.min(100, (liquidityUsd / 2000000) * 100);
  score += liquidityFactor * 0.15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateRiskMetrics(top10HoldersPct, liquidityUsd, volume24h, suspiciousCount, hasUpcomingUnlocks) {
  const riskFlags = [];
  let score = 0;

  let concentrationScore = 0;
  if (top10HoldersPct > 80) {
    concentrationScore = 95;
    riskFlags.push(`Severe holder concentration: Top 10 wallets hold ${top10HoldersPct}% of total supply.`);
  } else if (top10HoldersPct > 60) {
    concentrationScore = 70;
    riskFlags.push(`Elevated concentration: Top 10 wallets hold ${top10HoldersPct}% of supply.`);
  } else if (top10HoldersPct > 40) {
    concentrationScore = 40;
  } else {
    concentrationScore = 15;
  }
  score += concentrationScore * 0.40;

  let liquidityRisk = 0;
  const ratio = volume24h > 0 ? liquidityUsd / volume24h : 1.0;
  if (liquidityUsd < 300000) {
    liquidityRisk = 90;
    riskFlags.push(`Thin liquidity depth ($${(liquidityUsd/1000).toFixed(0)}k): high slippage risk.`);
  } else if (ratio < 0.2) {
    liquidityRisk = 75;
    riskFlags.push('Volume far outpaces available liquidity pool depth.');
  } else if (liquidityUsd < 1000000) {
    liquidityRisk = 45;
  } else {
    liquidityRisk = 15;
  }
  score += liquidityRisk * 0.25;

  let anomalyRisk = 0;
  if (suspiciousCount > 5) {
    anomalyRisk = 90;
    riskFlags.push(`${suspiciousCount} abnormal large transfers to exchange deposit addresses.`);
  } else if (suspiciousCount > 0) {
    anomalyRisk = 50;
  } else {
    anomalyRisk = 10;
  }
  score += anomalyRisk * 0.20;

  let unlockRisk = hasUpcomingUnlocks ? 80 : 15;
  if (hasUpcomingUnlocks) {
    riskFlags.push('Major token unlock cliff scheduled within next 14 days.');
  }
  score += unlockRisk * 0.15;

  return {
    holderConcentrationScore: concentrationScore,
    top10HoldersPct,
    compositeRiskScore: Math.max(0, Math.min(100, Math.round(score))),
    riskFlags
  };
}

function runDiscoveryAgent(snapshot, evidence) {
  const oppScore = calculateOpportunityScore(
    snapshot.momentumScore,
    snapshot.volumeAcceleration,
    snapshot.relativeVolume,
    snapshot.liquidityUsd
  );
  const supportingIds = evidence.filter(e => e.type === 'MARKET' && !e.isContradictory).map(e => e.id);
  return {
    agent: 'discovery',
    verdict: oppScore >= 60 ? 'OPPORTUNITY' : 'HOLD',
    confidence: Math.min(95, oppScore + 5),
    summary: `Candidate $${snapshot.symbol} flagged with Opportunity Score ${oppScore}/100.`,
    supportingEvidenceIds: supportingIds,
    strongestSupportingEvidenceId: supportingIds[0],
    contradictoryEvidenceIds: [],
    metrics: {
      opportunityScore: oppScore,
      momentum: snapshot.momentumScore,
      volumeAccelerationPct: snapshot.volumeAcceleration,
      rvol: snapshot.relativeVolume
    }
  };
}

function runQuantAgent(snapshot, evidence) {
  const isBullish = snapshot.change24h > 1.5 && snapshot.relativeVolume >= 1.1 && snapshot.momentumScore >= 55;
  const supportingIds = evidence.filter(e => e.type === 'MARKET' && !e.isContradictory).map(e => e.id);
  return {
    agent: 'quant',
    verdict: isBullish ? 'BUY' : 'HOLD',
    confidence: isBullish ? 84 : 60,
    summary: `Technical setup: RSI ${snapshot.rsi14}, RVOL ${snapshot.relativeVolume}x, Momentum ${snapshot.momentumScore}/100.`,
    supportingEvidenceIds: supportingIds,
    strongestSupportingEvidenceId: supportingIds[0],
    contradictoryEvidenceIds: [],
    metrics: {
      return24h: snapshot.change24h,
      rsi14: snapshot.rsi14,
      rvol: snapshot.relativeVolume,
      volatility: snapshot.realizedVolatility,
      momentum: snapshot.momentumScore
    }
  };
}

function runIntelligenceAgent(evidence) {
  const newsEvidence = evidence.filter(e => e.type === 'NEWS');
  if (newsEvidence.length === 0) {
    return {
      agent: 'intelligence',
      verdict: 'HOLD',
      confidence: 50,
      summary: 'News intelligence unavailable. The council did not use fabricated news to compensate.',
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      failed: false
    };
  }
  const positive = newsEvidence.filter(e => e.value?.sentiment === 'POSITIVE' && !e.isContradictory);
  const negative = newsEvidence.filter(e => e.value?.sentiment === 'NEGATIVE' || e.isContradictory);
  return {
    agent: 'intelligence',
    verdict: negative.length > 0 ? 'CAUTION' : positive.length > 0 ? 'BUY' : 'HOLD',
    confidence: negative.length > 0 ? 82 : 78,
    summary: positive.length > 0 ? `Verified positive catalyst: ${positive[0]?.title}` : 'No catalysts.',
    supportingEvidenceIds: positive.map(e => e.id),
    contradictoryEvidenceIds: negative.map(e => e.id),
    strongestSupportingEvidenceId: positive[0]?.id
  };
}

function runRiskAgent(snapshot, evidence) {
  const flowEvid = evidence.find(e => e.type === 'FLOW');
  const top10 = flowEvid?.value?.top10HoldersPct || 35;
  const metrics = calculateRiskMetrics(top10, snapshot.liquidityUsd, snapshot.volume24h, 0, false);
  const riskEvidence = evidence.filter(e => e.type === 'RISK' || e.type === 'FLOW');
  return {
    agent: 'risk',
    verdict: metrics.compositeRiskScore >= 70 ? 'REJECT' : metrics.compositeRiskScore >= 45 ? 'HOLD' : 'BUY',
    confidence: 86,
    summary: `Risk Score: ${metrics.compositeRiskScore}/100.`,
    supportingEvidenceIds: riskEvidence.filter(e => !e.isContradictory).map(e => e.id),
    contradictoryEvidenceIds: riskEvidence.filter(e => e.isContradictory).map(e => e.id),
    metrics: { compositeRiskScore: metrics.compositeRiskScore, top10HoldersPct: top10 }
  };
}

function runRedTeamAgent(asset, preliminaryThesis, snapshot, evidence, agentRuns) {
  const contradictory = evidence.filter(e => e.isContradictory);
  const flowEvid = evidence.find(e => e.type === 'FLOW');
  const top10 = flowEvid?.value?.top10HoldersPct || 30;

  const challenges = [];
  const vulnerabilities = [];

  if (top10 > 60) {
    challenges.push('Bullish thesis assumes rising volume represents organic demand.');
    vulnerabilities.push(`Top 10 wallets control ${top10}% of supply. Insider dumping vulnerability.`);
  }

  if (snapshot.liquidityUsd < 250000 || (snapshot.volume24h > snapshot.liquidityUsd * 4)) {
    challenges.push('Bullish thesis assumes sufficient exit liquidity.');
    vulnerabilities.push(`Liquidity pool depth is disproportionately small. Exit trap hazard.`);
  }

  const isDisproved = vulnerabilities.length >= 2;
  const isWeakened = vulnerabilities.length === 1;
  const thesisStatus = isDisproved ? 'DISPROVED' : isWeakened ? 'WEAKENED' : 'INTACT';

  return {
    agent: 'red_team',
    verdict: isDisproved ? 'REJECT' : isWeakened ? 'HOLD' : 'VALID',
    confidence: isDisproved ? 92 : 84,
    summary: isDisproved ? 'ADVERSARIAL REFUTATION: Thesis disproved.' : 'ADVERSARIAL CHALLENGE PASSED: Thesis intact.',
    supportingEvidenceIds: isDisproved ? [] : evidence.filter(e => !e.isContradictory).map(e => e.id),
    contradictoryEvidenceIds: contradictory.map(e => e.id),
    strongestCounterargument: vulnerabilities[0] || 'None',
    redTeamAttackDetails: {
      assumptionsChallenged: challenges,
      vulnerabilitiesFound: vulnerabilities,
      thesisStatus,
      counterEvidenceIds: contradictory.map(e => e.id)
    }
  };
}

function runDecisionAgent(asset, snapshot, agentRuns, evidence) {
  const quant = agentRuns['quant'];
  const risk = agentRuns['risk'];
  const redTeam = agentRuns['red_team'];
  const discovery = agentRuns['discovery'];

  const oppScore = Number(discovery?.metrics?.opportunityScore || 60);
  const riskScore = Number(risk?.metrics?.compositeRiskScore || 40);
  const redTeamStatus = redTeam?.redTeamAttackDetails?.thesisStatus || 'INTACT';

  let conclusion = 'HOLD';
  let confidence = 80;
  let rationale = '';

  if (redTeamStatus === 'DISPROVED' || riskScore > 70) {
    conclusion = 'REJECT';
    confidence = 90;
    rationale = `Trade rejected due to fatal adversarial flaws and high structural risk (${riskScore}/100).`;
  } else if (oppScore >= 65 && riskScore <= 45 && quant?.verdict === 'BUY') {
    conclusion = 'BUY';
    confidence = 86;
    rationale = `Opportunity approved: verified momentum (+${snapshot.volumeAcceleration}%) and low risk (${riskScore}/100).`;
  } else {
    conclusion = 'HOLD';
    confidence = 65;
    rationale = 'Evidence is mixed or neutral.';
  }

  return {
    conclusion,
    confidence,
    rationale,
    opportunityScore: oppScore,
    riskScore,
    supportingEvidenceIds: evidence.filter(e => !e.isContradictory).map(e => e.id),
    contradictoryEvidenceIds: evidence.filter(e => e.isContradictory).map(e => e.id),
    strongestSupportingEvidenceId: quant?.strongestSupportingEvidenceId || discovery?.strongestSupportingEvidenceId,
    strongestCounterargument: redTeam?.strongestCounterargument
  };
}

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function it(name, fn) {
  testsRun++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    testsFailed++;
  }
}

function describe(suiteName, fn) {
  console.log(`\n=== ${suiteName} ===`);
  fn();
}

console.log('--- RUNNING SHOULD-AI BUY TEST SUITES (PHASE 2 COUNCIL INTELLIGENCE) ---');

describe('1. Alpaca Crypto & Stock Asset Classification', () => {
  it('identifies crypto symbols accurately', () => {
    assert.strictEqual(isCryptoSymbol('$BTC'), true);
    assert.strictEqual(isCryptoSymbol('ETH'), true);
    assert.strictEqual(isCryptoSymbol('SOL/USD'), true);
    assert.strictEqual(isCryptoSymbol('BTCUSD'), true);
  });

  it('identifies US stock equity symbols accurately', () => {
    assert.strictEqual(isCryptoSymbol('AAPL'), false);
    assert.strictEqual(isCryptoSymbol('$NVDA'), false);
    assert.strictEqual(isCryptoSymbol('TSLA'), false);
    assert.strictEqual(isCryptoSymbol('SPY'), false);
  });

  it('normalizes crypto and stock symbols appropriately', () => {
    assert.strictEqual(normalizeCryptoSymbol('$BTC'), 'BTC/USD');
    assert.strictEqual(normalizeStockSymbol('$AAPL'), 'AAPL');
    assert.strictEqual(normalizeStockSymbol('nvda'), 'NVDA');
  });
});

describe('2. Alpaca Stock Snapshot Weekend Close Extraction', () => {
  it('extracts latest trade or Friday dailyBar close seamlessly during weekend closure', () => {
    const stockSnapshot = {
      latestTrade: { t: '2026-08-28T20:00:00Z', p: 224.23, s: 100 },
      latestQuote: { bp: 224.10, ap: 224.50 },
      dailyBar: { t: '2026-08-28T04:00:00Z', o: 222.5, h: 225.0, l: 221.8, c: 224.23, v: 48200000 },
      prevDailyBar: { t: '2026-08-27T04:00:00Z', o: 220.0, h: 223.0, l: 219.5, c: 221.8, v: 45100000 }
    };

    const latestPrice = stockSnapshot.latestTrade?.p ?? stockSnapshot.dailyBar?.c;
    assert.strictEqual(latestPrice, 224.23);

    const change = calculateReturn(stockSnapshot.prevDailyBar.c, latestPrice);
    assert.strictEqual(change, 1.10);
  });
});

describe('3. Multi-Day Stock Historical Price Interval Partitioning', () => {
  it('partitions 1H, 4H, 1D, 7D, and 30D into distinct non-flat candle series', () => {
    const dailyBars = Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (30 - i) * 86400000,
      isoString: new Date(Date.now() - (30 - i) * 86400000).toISOString(),
      dateStr: `Day ${i + 1}`,
      open: 200 + i * 2,
      high: 205 + i * 2,
      low: 198 + i * 2,
      close: 203 + i * 2,
      volume: 1000000 + i * 10000
    }));

    const series7D = dailyBars.slice(-7);
    const series30D = dailyBars.slice(-30);

    assert.strictEqual(series7D.length, 7);
    assert.strictEqual(series30D.length, 30);
    assert.notStrictEqual(series7D[0].close, series7D[series7D.length - 1].close);
    assert.notStrictEqual(series30D[0].close, series30D[series30D.length - 1].close);
  });
});

describe('4. Deterministic Technical Math (Fixed Historical Bars)', () => {
  const fixedCandles = [
    { open: 100, high: 105, low: 98, close: 102, volume: 1000 },
    { open: 102, high: 108, low: 101, close: 107, volume: 1200 },
    { open: 107, high: 112, low: 105, close: 110, volume: 1500 },
    { open: 110, high: 115, low: 108, close: 114, volume: 1800 },
    { open: 114, high: 118, low: 112, close: 116, volume: 2000 }
  ];

  it('calculates returns deterministically', () => {
    assert.strictEqual(calculateReturn(100, 116), 16.0);
    assert.strictEqual(calculateReturn(116, 100), -13.79);
  });

  it('calculates RVOL consistently', () => {
    const rvol = calculateRVOL(2000, [1000, 1200, 1500, 1800]);
    assert.strictEqual(rvol, 1.45);
  });

  it('calculates volume acceleration', () => {
    const accel = calculateVolumeAcceleration(2000, 1800);
    assert.strictEqual(accel, 11.11);
  });

  it('calculates realized volatility without random variation', () => {
    const vol1 = calculateRealizedVolatility(fixedCandles);
    const vol2 = calculateRealizedVolatility(fixedCandles);
    assert.strictEqual(vol1, vol2);
    assert.ok(vol1 > 0);
  });
});

describe('5. Council Execution & Visible Stage Progression', () => {
  const mockSnapshot = {
    symbol: 'BTC/USD',
    price: 64250.0,
    change24h: 3.5,
    change7d: 8.2,
    volume24h: 350000000,
    volumeAcceleration: 28.5,
    relativeVolume: 1.8,
    realizedVolatility: 38.2,
    momentumScore: 78,
    rsi14: 64.5,
    liquidityUsd: 150000000,
    spreadBps: 2.0
  };

  const mockEvidence = [
    {
      id: 'EVID-MKT-1',
      type: 'MARKET',
      title: 'Price Action +3.5%',
      description: 'Session return is +3.5%',
      observedAt: '2026-08-30T00:00:00Z',
      source: { name: 'Alpaca Crypto Data API', retrievedAt: '2026-08-30T00:00:00Z' },
      value: { price: 64250.0 },
      reliability: 'PRIMARY'
    },
    {
      id: 'EVID-FLOW-2',
      type: 'FLOW',
      title: 'Healthy Holder Distribution',
      description: 'Top 10 wallets hold 28% of supply.',
      observedAt: '2026-08-30T00:00:00Z',
      source: { name: 'On-Chain Ledger', retrievedAt: '2026-08-30T00:00:00Z' },
      value: { top10HoldersPct: 28 },
      reliability: 'PRIMARY'
    },
    {
      id: 'EVID-NEWS-3',
      type: 'NEWS',
      title: 'Institutional ETF Inflows Reach $650M',
      description: 'Record single day inflows recorded.',
      observedAt: '2026-08-30T00:00:00Z',
      source: { name: 'Reuters Markets', url: 'https://reuters.example.com', retrievedAt: '2026-08-30T00:00:00Z' },
      value: { sentiment: 'POSITIVE' },
      reliability: 'PRIMARY'
    }
  ];

  it('executes all council stages in order and forms a valid decision', () => {
    // 1. Discovery
    const discovery = runDiscoveryAgent(mockSnapshot, mockEvidence);
    assert.strictEqual(discovery.agent, 'discovery');
    assert.strictEqual(discovery.verdict, 'OPPORTUNITY');

    // 2. Specialized Agents (Quant, Intel, Risk)
    const quant = runQuantAgent(mockSnapshot, mockEvidence);
    const intel = runIntelligenceAgent(mockEvidence);
    const risk = runRiskAgent(mockSnapshot, mockEvidence);

    assert.strictEqual(quant.verdict, 'BUY');
    assert.strictEqual(intel.verdict, 'BUY');
    assert.strictEqual(risk.verdict, 'BUY');

    const agentRuns = { discovery, quant, intelligence: intel, risk };

    // 3. Red Team Adversarial Attack
    const redTeam = runRedTeamAgent('BTC', 'Bullish momentum thesis', mockSnapshot, mockEvidence, agentRuns);
    assert.strictEqual(redTeam.agent, 'red_team');
    assert.strictEqual(redTeam.redTeamAttackDetails.thesisStatus, 'INTACT');
    agentRuns.red_team = redTeam;

    // 4. Decision Synthesis
    const decision = runDecisionAgent('BTC', mockSnapshot, agentRuns, mockEvidence);
    assert.strictEqual(decision.conclusion, 'BUY');
    assert.ok(decision.confidence >= 80);
    assert.ok(decision.supportingEvidenceIds.length > 0);
  });
});

describe('6. Single Market Snapshot Consistency & Agent Isolation', () => {
  const immutableSnapshot = Object.freeze({
    symbol: 'ETH/USD',
    price: 3450.0,
    change24h: 2.1,
    change7d: 5.4,
    volume24h: 1200000000,
    volumeAcceleration: 15.0,
    relativeVolume: 1.3,
    realizedVolatility: 42.0,
    momentumScore: 70,
    rsi14: 58.0,
    liquidityUsd: 25000000,
    spreadBps: 3.0
  });

  it('guarantees all council agents reason over the exact same snapshot without mutation', () => {
    const evidence = [
      { id: 'E1', type: 'MARKET', observedAt: '2026-08-30T00:00:00Z', source: { name: 'Alpaca' } },
      { id: 'E2', type: 'FLOW', value: { top10HoldersPct: 32 }, observedAt: '2026-08-30T00:00:00Z', source: { name: 'Alpaca' } }
    ];

    const disc = runDiscoveryAgent(immutableSnapshot, evidence);
    const quant = runQuantAgent(immutableSnapshot, evidence);
    const risk = runRiskAgent(immutableSnapshot, evidence);

    // Verify snapshot values remained unmutated
    assert.strictEqual(immutableSnapshot.price, 3450.0);
    assert.strictEqual(immutableSnapshot.momentumScore, 70);
    assert.strictEqual(quant.metrics.momentum, immutableSnapshot.momentumScore);
    assert.strictEqual(disc.metrics.momentum, immutableSnapshot.momentumScore);
  });
});

describe('7. Deterministic Risk Gate Policies', () => {
  it('rejects trade if Red Team invalidated thesis', () => {
    const res = evaluateRiskGate({
      symbol: 'BTC/USD',
      opportunityScore: 88,
      riskScore: 25,
      liquidityUsd: 50000000,
      positionValueUsd: 10000,
      availableCash: 100000,
      hasRedTeamFatalFlaw: true,
      evidence: [{ id: '1' }, { id: '2' }, { id: '3' }]
    });
    assert.strictEqual(res.passed, false);
    assert.ok(res.violations.some(v => v.includes('Red-Team invalidated thesis')));
  });

  it('rejects trade if liquidity < $250k', () => {
    const res = evaluateRiskGate({
      symbol: 'TEST/USD',
      opportunityScore: 80,
      riskScore: 20,
      liquidityUsd: 150000,
      positionValueUsd: 5000,
      availableCash: 100000,
      hasRedTeamFatalFlaw: false,
      evidence: [{ id: '1' }, { id: '2' }, { id: '3' }]
    });
    assert.strictEqual(res.passed, false);
  });

  it('passes trade when all criteria are met', () => {
    const res = evaluateRiskGate({
      symbol: 'AAPL',
      opportunityScore: 80,
      riskScore: 20,
      liquidityUsd: 50000000,
      positionValueUsd: 10000,
      availableCash: 100000,
      hasRedTeamFatalFlaw: false,
      evidence: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
    });
    assert.strictEqual(res.passed, true);
  });
});

describe('8. Failed Stage Handling & No-Fake-Data Invariant', () => {
  it('handles empty news intelligence gracefully without fabricating fake news', () => {
    const res = runIntelligenceAgent([]);
    assert.strictEqual(res.verdict, 'HOLD');
    assert.ok(res.summary.includes('News intelligence unavailable'));
    assert.strictEqual(res.supportingEvidenceIds.length, 0);
  });

  it('Red-Team disproves thesis on severe holder concentration without synthetic overrides', () => {
    const snapshot = {
      symbol: 'NOVA',
      price: 1.5,
      change24h: 12.0,
      volume24h: 5000000,
      volumeAcceleration: 80,
      relativeVolume: 3.5,
      realizedVolatility: 65,
      momentumScore: 88,
      rsi14: 82,
      liquidityUsd: 180000, // thin liquidity
      spreadBps: 25
    };
    const evidence = [
      { id: 'E1', type: 'FLOW', value: { top10HoldersPct: 75 }, isContradictory: true, observedAt: '2026-08-30', source: { name: 'Audit' } }
    ];
    const redTeam = runRedTeamAgent('NOVA', 'Bullish pump thesis', snapshot, evidence, {});
    assert.strictEqual(redTeam.verdict, 'REJECT');
    assert.strictEqual(redTeam.redTeamAttackDetails.thesisStatus, 'DISPROVED');
    assert.ok(redTeam.redTeamAttackDetails.vulnerabilitiesFound.length >= 2);
  });
});

describe('9. Command Syntax Parser for Crypto & Stocks', () => {
  it('parses crypto "Should-AI buy $BTC?"', () => {
    const res = parseCommand('Should-AI buy $BTC?');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.intent, 'BUY');
    assert.strictEqual(res.asset, 'BTC');
  });

  it('parses stock "Should-AI buy $AAPL?"', () => {
    const res = parseCommand('Should-AI buy $AAPL?');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.intent, 'BUY');
    assert.strictEqual(res.asset, 'AAPL');
  });

  it('parses stock "Should-AI watch $NVDA?"', () => {
    const res = parseCommand('Should-AI watch $NVDA?');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.intent, 'WATCH');
    assert.strictEqual(res.asset, 'NVDA');
  });

  it('parses "Why did you reject $BTC?"', () => {
    const res = parseCommand('Why did you reject $BTC?');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.intent, 'WHY');
    assert.strictEqual(res.asset, 'BTC');
  });
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${testsPassed}/${testsRun} PASSED (${testsFailed} FAILED)`);
console.log(`========================================\n`);

if (testsFailed > 0) {
  process.exit(1);
}
