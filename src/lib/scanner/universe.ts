import { AssetClass } from '../types';
import { alpacaDataAdapter } from '../market-data/alpaca-adapter';

// ---------------------------------------------------------------------------
// Phase 5A: Bounded Scanner Universe Configuration
// Defines the explicit, deterministic universe of assets for discovery scans.
// ---------------------------------------------------------------------------

/**
 * Bounded scan universe covering major crypto assets and liquid US equities.
 */
export const BENCHMARK_SCAN_UNIVERSE: readonly string[] = [
  'BTC',
  'ETH',
  'SOL',
  'AAPL',
  'NVDA',
  'MSFT'
];

export const DEFAULT_CRYPTO_UNIVERSE: readonly string[] = [
  // Core Large-Caps
  'BTC',
  'ETH',
  'SOL',
  'AVAX',
  'LINK',
  'XRP',
  'ADA',
  'LTC',
  'DOT',
  'BCH',
  // High-Growth DeFi & Layer-2
  'UNI',
  'AAVE',
  'ARB',
  'LDO',
  'POL',
  'CRV',
  'SUSHI',
  // AI, Compute, RWA & Infrastructure
  'RENDER',
  'HYPE',
  'ONDO',
  'GRT',
  'FIL',
  'BAT',
  // Meme & High-Vol Volatility
  'DOGE',
  'SHIB',
  'PEPE',
  'BONK',
  'WIF',
  'TRUMP'
];

export const DEFAULT_EQUITY_UNIVERSE: readonly string[] = [
  'AAPL',
  'NVDA',
  'MSFT',
  'AMZN',
  'GOOGL',
  'META',
  'TSLA',
  'AMD',
  'COIN',
  'RL'
];

export const DEFAULT_SCAN_UNIVERSE: readonly string[] = [
  ...DEFAULT_CRYPTO_UNIVERSE,
  ...DEFAULT_EQUITY_UNIVERSE
];

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
