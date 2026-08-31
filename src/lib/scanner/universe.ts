import { AssetClass } from '../types';
import { alpacaDataAdapter } from '../market-data/alpaca-adapter';

// ---------------------------------------------------------------------------
// Phase 5A: Bounded Scanner Universe Configuration
// Defines the explicit, deterministic universe of assets for discovery scans.
// ---------------------------------------------------------------------------

/**
 * Default bounded scan universe covering major crypto assets and liquid US equities.
 */
export const DEFAULT_SCAN_UNIVERSE: readonly string[] = [
  'BTC',
  'ETH',
  'SOL',
  'AAPL',
  'NVDA',
  'MSFT'
];

export const DEFAULT_CRYPTO_UNIVERSE: readonly string[] = ['BTC', 'ETH', 'SOL'];
export const DEFAULT_EQUITY_UNIVERSE: readonly string[] = ['AAPL', 'NVDA', 'MSFT'];

/**
 * Normalizes a scan target symbol (removes $, uppercase, trims whitespace).
 */
export function normalizeScanSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/^\$/, '').trim();
}

/**
 * Deterministically determines the AssetClass (CRYPTO vs EQUITY) for a symbol.
 */
export function detectAssetClass(symbol: string): AssetClass {
  const clean = normalizeScanSymbol(symbol);
  return alpacaDataAdapter.isCryptoSymbol(clean) ? 'CRYPTO' : 'EQUITY';
}
