import { TradeRecord, PortfolioMetrics, TradeMetrics } from './types';

// ---------------------------------------------------------------------------
// Phase 8.8 & 8.10: Deterministic Portfolio & Trade Analytics
// INVARIANT: All calculations use only recorded outcomes. No lookahead.
// INVARIANT: Empty trade sets return zero-initialized metrics, never errors.
// INVARIANT: Explicitly labeled as Gross P&L (fees are $0 in paper).
// ---------------------------------------------------------------------------

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function round2(v: number): number {
  return Number(v.toFixed(2));
}

export function calculatePortfolioMetrics(
  trades: TradeRecord[],
  currentEquityUsd: number = 100000,
  initialEquityUsd: number = 100000
): PortfolioMetrics {
  const now = new Date().toISOString();
  const completed = trades.filter(t => t.outcome !== 'OPEN');
  const openCount = trades.filter(t => t.outcome === 'OPEN').length;

  const realizedPnL = completed.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
  const unrealizedPnL = trades
    .filter(t => t.outcome === 'OPEN')
    .reduce((sum, _t) => sum, 0); // Open trades valuation

  const totalPnL = realizedPnL + unrealizedPnL;
  const totalPnLPct = safeDiv(totalPnL, initialEquityUsd) * 100;

  // Build equity curve from exit events to compute drawdown
  const equityPoints: number[] = [initialEquityUsd];
  let runningEquity = initialEquityUsd;
  for (const t of completed) {
    runningEquity += (t.realizedPnL ?? 0);
    equityPoints.push(runningEquity);
  }
  equityPoints.push(currentEquityUsd);

  let peakEquity = initialEquityUsd;
  let maxDrawdownUsd = 0;
  let maxDrawdownPct = 0;
  for (const eq of equityPoints) {
    if (eq > peakEquity) peakEquity = eq;
    const dd = peakEquity - eq;
    if (dd > maxDrawdownUsd) {
      maxDrawdownUsd = dd;
      maxDrawdownPct = safeDiv(dd, peakEquity) * 100;
    }
  }

  const currentDrawdownUsd = Math.max(0, peakEquity - currentEquityUsd);
  const currentDrawdownPct = safeDiv(currentDrawdownUsd, peakEquity) * 100;

  const grossExposureUsd = trades
    .filter(t => t.outcome === 'OPEN')
    .reduce((sum, t) => sum + (t.entryPrice * (t.actualFilledQuantity ?? t.approvedQuantity)), 0);
  const grossExposurePct = safeDiv(grossExposureUsd, currentEquityUsd) * 100;
  const cashUtilizationPct = Math.min(100, grossExposurePct);

  return {
    currentEquityUsd: round2(currentEquityUsd),
    peakEquityUsd: round2(peakEquity),
    totalPnLUsd: round2(totalPnL),
    totalPnLPct: round2(totalPnLPct),
    realizedPnLUsd: round2(realizedPnL),
    unrealizedPnLUsd: round2(unrealizedPnL),
    grossExposurePct: round2(grossExposurePct),
    cashUtilizationPct: round2(cashUtilizationPct),
    openPositionCount: openCount,
    currentDrawdownUsd: round2(currentDrawdownUsd),
    currentDrawdownPct: round2(currentDrawdownPct),
    maxDrawdownUsd: round2(maxDrawdownUsd),
    maxDrawdownPct: round2(maxDrawdownPct),
    isGrossPnL: true,
    computedAt: now
  };
}

export function calculateTradeMetrics(trades: TradeRecord[]): TradeMetrics {
  const now = new Date().toISOString();
  const openTrades = trades.filter(t => t.outcome === 'OPEN');
  const completed = trades.filter(t => t.outcome !== 'OPEN');
  const winners = completed.filter(t => t.outcome === 'WIN');
  const losers = completed.filter(t => t.outcome === 'LOSS');
  const breakevens = completed.filter(t => t.outcome === 'BREAKEVEN');

  const winRate = safeDiv(winners.length, completed.length);
  const avgWin = safeDiv(winners.reduce((s, t) => s + (t.realizedPnL ?? 0), 0), Math.max(1, winners.length));
  const avgLoss = safeDiv(Math.abs(losers.reduce((s, t) => s + (t.realizedPnL ?? 0), 0)), Math.max(1, losers.length));
  const lossRate = safeDiv(losers.length, completed.length);
  const expectancy = (winRate * avgWin) - (lossRate * avgLoss);

  const totalGross = winners.reduce((s, t) => s + (t.realizedPnL ?? 0), 0);
  const totalLoss = Math.abs(losers.reduce((s, t) => s + (t.realizedPnL ?? 0), 0));
  const profitFactor = totalLoss > 0 ? safeDiv(totalGross, totalLoss) : totalGross > 0 ? Infinity : 0;

  const durations = completed.filter(t => t.holdingDurationMs != null).map(t => t.holdingDurationMs!);
  const avgHoldingHours = safeDiv(durations.reduce((s, d) => s + d, 0), Math.max(1, durations.length)) / 3600000;

  const pnls = completed.map(t => t.realizedPnL ?? 0);
  const largestWin = pnls.length > 0 ? Math.max(0, ...pnls) : 0;
  const largestLoss = pnls.length > 0 ? Math.min(0, ...pnls) : 0;

  const tradesWithExpectedR = trades.filter(t => t.estimatedRiskReward != null);
  const avgExpectedR = safeDiv(tradesWithExpectedR.reduce((s, t) => s + t.estimatedRiskReward, 0), Math.max(1, tradesWithExpectedR.length));

  const completedWithActualR = completed.filter(t => t.actualR != null);
  const avgActualR = safeDiv(completedWithActualR.reduce((s, t) => s + (t.actualR ?? 0), 0), Math.max(1, completedWithActualR.length));
  const totalR = completedWithActualR.reduce((s, t) => s + (t.actualR ?? 0), 0);

  return {
    totalTrades: trades.length,
    openTrades: openTrades.length,
    completedTrades: completed.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    breakevenTrades: breakevens.length,
    winRate: round2(winRate),
    avgWinUsd: round2(avgWin),
    avgLossUsd: round2(avgLoss),
    expectancyUsd: round2(expectancy),
    profitFactor: round2(profitFactor),
    avgHoldingHours: round2(avgHoldingHours),
    largestWinUsd: round2(largestWin),
    largestLossUsd: round2(largestLoss),
    avgExpectedR: round2(avgExpectedR),
    avgActualR: round2(avgActualR),
    totalR: round2(totalR),
    isGrossPnL: true,
    computedAt: now
  };
}

/**
 * Calculates the actual realized R for a single completed trade.
 * actualR = realizedPnL / initialRiskAmountUsd
 * This uses ONLY data recorded at entry time — no lookahead.
 */
export function calculateActualR(trade: TradeRecord): number {
  const effectiveEntryPrice = trade.actualFillPrice ?? trade.entryPrice;
  const effectiveQty = trade.actualFilledQuantity ?? trade.approvedQuantity;
  const effectiveRisk = trade.initialRiskAmountUsd > 0
    ? trade.initialRiskAmountUsd
    : Math.abs(effectiveEntryPrice - trade.invalidationPrice) * effectiveQty;
  if (effectiveRisk <= 0 || trade.realizedPnL == null) return 0;
  return Number((trade.realizedPnL / effectiveRisk).toFixed(4));
}
