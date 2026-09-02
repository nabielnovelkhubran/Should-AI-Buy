import { AssetClass } from '../types';

// ---------------------------------------------------------------------------
// Phase 8.5A: Alpaca Numeric & Monetary Precision Utility
// Reference: Official Alpaca Money & Numeric Precision Skill
// Rules:
// 1. Truncate (round down) for outgoing money / allocations so you never overspend.
// 2. Up to 2 decimal places for cash/prices, up to 9 decimal places for crypto/fractional qty.
// 3. String representation for wire payloads to avoid IEEE-754 precision loss.
// ---------------------------------------------------------------------------

/**
 * Truncates (rounds down) a monetary amount to a specified number of decimal places (default: 2).
 * Strictly avoids rounding up to prevent moving or allocating more funds than authorized.
 */
export function truncateMoney(amount: number, decimals: number = 2): number {
  if (!Number.isFinite(amount)) return 0;
  const factor = Math.pow(10, decimals);
  // Add small epsilon to handle floating point representation anomalies before flooring
  return Math.floor(amount * factor + 1e-12) / factor;
}

/**
 * Truncates an order quantity based on asset class precision rules:
 * - CRYPTO: up to 9 decimal places.
 * - EQUITY: up to 9 decimal places for fractional shares, or 4 decimal places standard.
 */
export function truncateQuantity(qty: number, assetClass: AssetClass = 'EQUITY', maxDecimals?: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const decimals = maxDecimals ?? (assetClass === 'CRYPTO' ? 9 : 4);
  const factor = Math.pow(10, decimals);
  return Math.floor(qty * factor + 1e-12) / factor;
}

/**
 * Formats a number cleanly into a wire string for Alpaca REST payloads without exponential notation.
 */
export function formatWireNumber(val: number, maxDecimals: number = 9): string {
  if (!Number.isFinite(val)) return '0';
  const truncated = truncateQuantity(val, 'CRYPTO', maxDecimals);
  // Convert to fixed string, then strip trailing zeros and trailing dot
  const str = truncated.toFixed(maxDecimals);
  return str.replace(/\.?0+$/, '') || '0';
}

/**
 * Computes a safe order quantity from available cash budget and unit price.
 * Enforces downward truncation so the total cost (qty * price) never exceeds the allocated budget.
 */
export function calculateSafeOrderQuantity(
  budgetUsd: number,
  unitPrice: number,
  assetClass: AssetClass = 'EQUITY'
): number {
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return 0;
  }
  const rawQty = budgetUsd / unitPrice;
  return truncateQuantity(rawQty, assetClass);
}
