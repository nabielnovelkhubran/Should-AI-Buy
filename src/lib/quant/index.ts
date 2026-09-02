import { Candle } from '../types';

/**
 * Calculates percentage return between two prices.
 */
export function calculateReturn(initialPrice: number, finalPrice: number): number {
  if (initialPrice <= 0) return 0;
  return Number((((finalPrice - initialPrice) / initialPrice) * 100).toFixed(2));
}

/**
 * Calculates Relative Volume (RVOL) = Current Volume / Average Historical Volume.
 */
export function calculateRVOL(currentVolume: number, historicalVolumes: number[]): number {
  if (!historicalVolumes || historicalVolumes.length === 0) return 1.0;
  const avg = historicalVolumes.reduce((acc, v) => acc + v, 0) / historicalVolumes.length;
  if (avg <= 0) return 1.0;
  return Number((currentVolume / avg).toFixed(2));
}

/**
 * Calculates Volume Acceleration = % difference between latest period volume and previous period volume.
 */
export function calculateVolumeAcceleration(latestVolume: number, previousVolume: number): number {
  if (previousVolume <= 0) return 0;
  return Number((((latestVolume - previousVolume) / previousVolume) * 100).toFixed(2));
}

/**
 * Calculates Realized Volatility (standard deviation of logarithmic candle returns).
 */
export function calculateRealizedVolatility(candles: Candle[]): number {
  if (!candles || candles.length < 2) return 0;
  const logReturns: number[] = [];
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
  // Annualized roughly for crypto (365 days / 24 periods)
  return Number((stdDev * Math.sqrt(365 * 24) * 100).toFixed(2));
}

/**
 * Calculates 14-period RSI (Relative Strength Index).
 */
export function calculateRSI(candles: Candle[], period: number = 14): number {
  if (!candles || candles.length < 4) return 50.0;
  const p = Math.min(period, Math.max(3, Math.floor(candles.length / 2)));
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= p && i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / p;
  let avgLoss = losses / p;

  for (let i = p + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) {
      avgGain = (avgGain * (p - 1) + change) / p;
      avgLoss = (avgLoss * (p - 1)) / p;
    } else {
      avgGain = (avgGain * (p - 1)) / p;
      avgLoss = (avgLoss * (p - 1) + Math.abs(change)) / p;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Calculates Momentum Score based on multi-timeframe SMA ratio, Rate-of-Change, and RSI.
 */
export function calculateMomentumScore(candles: Candle[]): number {
  if (!candles || candles.length < 4) return 50;
  const rsi = calculateRSI(candles, 14);
  const closes = candles.map(c => c.close);
  const n = closes.length;
  const smaShort = closes.slice(-Math.min(5, n)).reduce((a, b) => a + b, 0) / Math.min(5, n);
  const smaLong = closes.slice(-Math.min(15, n)).reduce((a, b) => a + b, 0) / Math.min(15, n);

  // 1. Multi-Timeframe Trend component
  const smaPctDiff = smaLong > 0 ? ((smaShort - smaLong) / smaLong) * 100 : 0;

  // 2. Short-term Rate of Change (ROC-3)
  const roc3 = n >= 4 ? ((closes[n - 1] - closes[n - 4]) / closes[n - 4]) * 100 : 0;

  // 3. Composite score synthesis
  let score = 50;
  score += Math.max(-25, Math.min(25, smaPctDiff * 8));
  score += Math.max(-20, Math.min(20, roc3 * 6));

  // RSI Factor: Reward bullish continuation (50-70) or oversold bounce (RSI < 40 and ROC >= -0.2%)
  if (rsi >= 50 && rsi <= 70) {
    score += 15;
  } else if (rsi < 40 && roc3 > -0.2) {
    score += 10; // Mean-reversion dip-buy setup
  } else if (rsi > 75) {
    score -= 10; // Overbought exhaustion risk
  }

  return Math.max(10, Math.min(95, Math.round(score)));
}

/**
 * Deterministic Opportunity Score (0 - 100).
 */
export function calculateOpportunityScore(
  momentum: number,
  volumeAccel: number,
  rvol: number,
  liquidityUsd: number
): number {
  let score = 0;
  // 35% Momentum
  score += Math.min(100, momentum) * 0.35;
  // 30% Volume Acceleration
  const normalizedVolAccel = Math.max(0, Math.min(100, (volumeAccel + 20) * 1.5));
  score += normalizedVolAccel * 0.30;
  // 20% RVOL
  const normalizedRVOL = Math.min(100, rvol * 30);
  score += normalizedRVOL * 0.20;
  // 15% Liquidity threshold
  const liquidityFactor = Math.min(100, (liquidityUsd / 2000000) * 100);
  score += liquidityFactor * 0.15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculates Position Sizing given portfolio capital and volatility risk factor.
 */
export function calculatePositionSize(
  portfolioCash: number,
  maxPortfolioRiskPct: number = 2.5, // 2.5% max risk
  assetPrice: number,
  stopLossDistancePct: number = 5.0
): { qty: number; positionValueUsd: number; portfolioRiskUsd: number } {
  const maxRiskUsd = (portfolioCash * maxPortfolioRiskPct) / 100;
  const stopLossFraction = stopLossDistancePct / 100;
  const maxPositionValue = maxRiskUsd / stopLossFraction;
  const clampedPositionValue = Math.min(maxPositionValue, portfolioCash * 0.25); // cap at 25% max position
  const qty = Number((clampedPositionValue / assetPrice).toFixed(4));
  return {
    qty,
    positionValueUsd: Number((qty * assetPrice).toFixed(2)),
    portfolioRiskUsd: Number(maxRiskUsd.toFixed(2))
  };
}
