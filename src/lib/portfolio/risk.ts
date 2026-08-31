import {
  PaperPosition,
  PaperOrderSnapshot,
  PaperAccountSnapshot,
  PortfolioExposure,
  PortfolioRiskSummary,
  PortfolioLimits,
  PortfolioSnapshot,
  ProposedOrderAssessment
} from './types';
import { normalizeScanSymbol } from '../scanner/universe';

// ---------------------------------------------------------------------------
// Phase 6B: Deterministic Portfolio Risk Engine
// INVARIANT: Deterministic math only. Zero stochastic randomness.
// Centralized portfolio safety thresholds and risk assessments.
// ---------------------------------------------------------------------------

export const DEFAULT_PORTFOLIO_LIMITS: PortfolioLimits = {
  maxPositionAllocationPct: 25.0, // Max 25.0% of portfolio equity in a single asset
  maxGrossExposurePct: 100.0,     // Max 100.0% gross leverage
  maxCryptoExposurePct: 50.0,     // Max 50.0% aggregate crypto exposure
  minAvailableCashPct: 10.0       // Min 10.0% cash liquidity reserve
};

/**
 * Computes deterministic portfolio exposure metrics across all asset classes.
 */
export function calculatePortfolioExposure(
  equity: number,
  positions: PaperPosition[]
): PortfolioExposure {
  if (positions.length === 0 || equity <= 0) {
    return {
      grossExposureUsd: 0,
      netExposureUsd: 0,
      grossExposurePct: 0,
      netExposurePct: 0,
      cryptoExposureUsd: 0,
      cryptoExposurePct: 0,
      equityExposureUsd: 0,
      equityExposurePct: 0,
      largestPositionAllocationPct: 0
    };
  }

  let grossExposureUsd = 0;
  let netExposureUsd = 0;
  let cryptoExposureUsd = 0;
  let equityExposureUsd = 0;
  let largestPositionSymbol: string | undefined = undefined;
  let largestPositionValue = 0;

  for (const pos of positions) {
    const absVal = Math.abs(pos.marketValue);
    grossExposureUsd += absVal;
    
    if (pos.side === 'short') {
      netExposureUsd -= absVal;
    } else {
      netExposureUsd += absVal;
    }

    if (pos.assetClass === 'CRYPTO') {
      cryptoExposureUsd += absVal;
    } else {
      equityExposureUsd += absVal;
    }

    if (absVal > largestPositionValue) {
      largestPositionValue = absVal;
      largestPositionSymbol = pos.symbol;
    }
  }

  const grossExposurePct = Number(((grossExposureUsd / equity) * 100).toFixed(2));
  const netExposurePct = Number(((netExposureUsd / equity) * 100).toFixed(2));
  const cryptoExposurePct = Number(((cryptoExposureUsd / equity) * 100).toFixed(2));
  const equityExposurePct = Number(((equityExposureUsd / equity) * 100).toFixed(2));
  const largestPositionAllocationPct = Number(((largestPositionValue / equity) * 100).toFixed(2));

  return {
    grossExposureUsd: Number(grossExposureUsd.toFixed(2)),
    netExposureUsd: Number(netExposureUsd.toFixed(2)),
    grossExposurePct,
    netExposurePct,
    cryptoExposureUsd: Number(cryptoExposureUsd.toFixed(2)),
    cryptoExposurePct,
    equityExposureUsd: Number(equityExposureUsd.toFixed(2)),
    equityExposurePct,
    largestPositionSymbol,
    largestPositionAllocationPct
  };
}

/**
 * Evaluates portfolio risk, concentration thresholds, and liquidity constraints.
 */
export function evaluatePortfolioRisk(
  account: PaperAccountSnapshot | null,
  positions: PaperPosition[],
  openOrders: PaperOrderSnapshot[],
  limits: PortfolioLimits = DEFAULT_PORTFOLIO_LIMITS
): PortfolioRiskSummary {
  const equity = account?.equity || 0;
  const buyingPower = account?.buyingPower || 0;
  const cash = account?.cash || 0;

  const exposure = calculatePortfolioExposure(equity, positions);
  const warnings: string[] = [];

  // 1. Single-Asset Concentration Check
  for (const pos of positions) {
    const alloc = equity > 0 ? (pos.marketValue / equity) * 100 : 0;
    if (alloc > limits.maxPositionAllocationPct) {
      warnings.push(
        `CONCENTRATION_WARNING: ${pos.symbol} represents ${alloc.toFixed(1)}% of portfolio equity (Limit: ${limits.maxPositionAllocationPct}%).`
      );
    }
  }

  // 2. Asset-Class Exposure Check (e.g. Crypto limit)
  if (exposure.cryptoExposurePct > limits.maxCryptoExposurePct) {
    warnings.push(
      `CRYPTO_EXPOSURE_WARNING: Crypto allocation is ${exposure.cryptoExposurePct.toFixed(1)}% of portfolio (Limit: ${limits.maxCryptoExposurePct}%).`
    );
  }

  // 3. Gross Exposure Check
  if (exposure.grossExposurePct > limits.maxGrossExposurePct) {
    warnings.push(
      `LEVERAGE_WARNING: Gross exposure is ${exposure.grossExposurePct.toFixed(1)}% (Limit: ${limits.maxGrossExposurePct}%).`
    );
  }

  // 4. Liquidity Reserve Check
  if (equity > 0 && (cash / equity) * 100 < limits.minAvailableCashPct) {
    const cashPct = ((cash / equity) * 100).toFixed(1);
    warnings.push(
      `LIQUIDITY_BUFFER_WARNING: Available cash is ${cashPct}% of equity (Minimum required: ${limits.minAvailableCashPct}%).`
    );
  }

  // 5. Calculate potential pending order exposure
  let pendingOrderExposureUsd = 0;
  for (const ord of openOrders) {
    if (ord.side === 'buy' && ord.remainingQty > 0) {
      const estPrice = ord.filledAvgPrice || 100;
      pendingOrderExposureUsd += ord.remainingQty * estPrice;
    }
  }

  return {
    totalExposureUsd: exposure.grossExposureUsd,
    availableBuyingPowerUsd: Number(buyingPower.toFixed(2)),
    openPositionCount: positions.length,
    openOrderCount: openOrders.length,
    pendingOrderExposureUsd: Number(pendingOrderExposureUsd.toFixed(2)),
    concentrationWarnings: warnings,
    maxAllowedPositionPct: limits.maxPositionAllocationPct,
    isExposureSafe: warnings.length === 0
  };
}

/**
 * Assesses whether a proposed new paper order would violate portfolio risk limits.
 */
export function assessProposedOrder(
  portfolio: PortfolioSnapshot,
  proposed: { symbol: string; qty: number; price: number; side: 'buy' | 'sell' },
  limits: PortfolioLimits = DEFAULT_PORTFOLIO_LIMITS
): ProposedOrderAssessment {
  const equity = portfolio.account?.equity || 100000;
  const cleanSymbol = normalizeScanSymbol(proposed.symbol);

  // Find existing position for this asset
  const existing = portfolio.positions.find(p => p.symbol === cleanSymbol);
  const currentPositionValue = existing ? existing.marketValue : 0;
  const orderValue = proposed.qty * proposed.price;

  let projectedPositionValue = currentPositionValue;
  if (proposed.side === 'buy') {
    projectedPositionValue += orderValue;
  } else {
    projectedPositionValue = Math.max(0, projectedPositionValue - orderValue);
  }

  const projectedAllocationPct = equity > 0
    ? Number(((projectedPositionValue / equity) * 100).toFixed(2))
    : 0;

  const currentGrossExposure = portfolio.exposure.grossExposureUsd;
  const projectedGrossExposure = proposed.side === 'buy'
    ? currentGrossExposure + orderValue
    : currentGrossExposure;

  const projectedGrossExposurePct = equity > 0
    ? Number(((projectedGrossExposure / equity) * 100).toFixed(2))
    : 0;

  // 1. Single Position Allocation Limit Breach
  if (projectedAllocationPct > limits.maxPositionAllocationPct) {
    return {
      allowed: false,
      reason: `EXCEEDS_POSITION_LIMIT: Projected ${cleanSymbol} allocation (${projectedAllocationPct}%) exceeds maximum allowed (${limits.maxPositionAllocationPct}%).`,
      currentExposureUsd: Number(currentPositionValue.toFixed(2)),
      projectedExposureUsd: Number(projectedPositionValue.toFixed(2)),
      projectedAllocationPct
    };
  }

  // 2. Gross Exposure Limit Breach
  if (projectedGrossExposurePct > limits.maxGrossExposurePct) {
    return {
      allowed: false,
      reason: `EXCEEDS_GROSS_EXPOSURE_LIMIT: Projected gross portfolio exposure (${projectedGrossExposurePct}%) exceeds maximum allowed (${limits.maxGrossExposurePct}%).`,
      currentExposureUsd: Number(currentPositionValue.toFixed(2)),
      projectedExposureUsd: Number(projectedPositionValue.toFixed(2)),
      projectedAllocationPct
    };
  }

  return {
    allowed: true,
    currentExposureUsd: Number(currentPositionValue.toFixed(2)),
    projectedExposureUsd: Number(projectedPositionValue.toFixed(2)),
    projectedAllocationPct
  };
}
