import { WatchlistItem, AssetClass } from '../types';
import { detectAssetClass, normalizeScanSymbol } from '../scanner/universe';

// ---------------------------------------------------------------------------
// Phase 5C: In-Memory Watchlist Service
// Provides a deterministic watchlist foundation for monitoring scanned assets.
// Invariant: Watchlisted assets do NOT imply a BUY recommendation and NEVER
// trigger automated trading or broker order execution.
// ---------------------------------------------------------------------------

export interface AddWatchlistOptions {
  notes?: string;
  targetPrice?: number;
  addedFromScan?: boolean;
  lastOpportunityScore?: number;
  assetClass?: AssetClass;
}

export class WatchlistService {
  private items: Map<string, WatchlistItem> = new Map();

  /**
   * Adds an asset to the in-memory watchlist.
   * If already present, updates metadata idempotently without duplicating entries.
   */
  add(symbol: string, options?: AddWatchlistOptions): WatchlistItem {
    const clean = normalizeScanSymbol(symbol);
    const existing = this.items.get(clean);

    if (existing) {
      if (options?.notes !== undefined) existing.notes = options.notes;
      if (options?.targetPrice !== undefined) existing.targetPrice = options.targetPrice;
      if (options?.lastOpportunityScore !== undefined) existing.lastOpportunityScore = options.lastOpportunityScore;
      if (options?.addedFromScan !== undefined) existing.addedFromScan = options.addedFromScan;
      return existing;
    }

    const item: WatchlistItem = {
      symbol: clean,
      assetClass: options?.assetClass || detectAssetClass(clean),
      addedAt: new Date().toISOString(),
      notes: options?.notes,
      targetPrice: options?.targetPrice,
      addedFromScan: options?.addedFromScan ?? false,
      lastOpportunityScore: options?.lastOpportunityScore
    };

    this.items.set(clean, item);
    return item;
  }

  /**
   * Removes an asset from the watchlist.
   */
  remove(symbol: string): boolean {
    const clean = normalizeScanSymbol(symbol);
    return this.items.delete(clean);
  }

  /**
   * Checks if an asset is currently in the watchlist.
   */
  contains(symbol: string): boolean {
    const clean = normalizeScanSymbol(symbol);
    return this.items.has(clean);
  }

  /**
   * Retrieves a specific watchlisted item by symbol.
   */
  getItem(symbol: string): WatchlistItem | undefined {
    const clean = normalizeScanSymbol(symbol);
    return this.items.get(clean);
  }

  /**
   * Lists all watchlisted items in insertion/update order.
   */
  list(): WatchlistItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Clears all items (useful for test isolation).
   */
  clear(): void {
    this.items.clear();
  }
}

/** Singleton instance of WatchlistService */
export const watchlistService = new WatchlistService();
