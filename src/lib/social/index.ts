import { Evidence, SocialFilterStats, SocialSignal } from '../types';
import { SocialSourceAdapter } from './types';
import { mockSocialAdapter } from './mock-social-adapter';
import { filterSocialEvents } from './filter';
import { extractSocialSignal } from './sentiment';
import { normalizeSocialToEvidence } from './normalizer';

// ---------------------------------------------------------------------------
// Phase 4C: Social Intelligence Service Layer
// Orchestrates social event ingestion, deterministic quality filtering,
// sentiment signal extraction, and evidence normalization.
// ---------------------------------------------------------------------------

export * from './types';
export * from './filter';
export * from './sentiment';
export * from './mock-social-adapter';
export * from './normalizer';

/**
 * Ingests, filters, and normalizes social events into inspectable Evidence[] records.
 */
export async function getSocialEvidence(
  investigationId: string,
  symbol: string,
  adapter: SocialSourceAdapter = mockSocialAdapter
): Promise<Evidence[]> {
  const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '').trim();
  const rawEvents = await adapter.fetchSocialEvents(cleanSymbol);

  // Deterministic spam and quality filter
  const { accepted } = filterSocialEvents(rawEvents);

  if (accepted.length === 0) {
    return [];
  }

  return normalizeSocialToEvidence(accepted, investigationId, adapter, 0);
}

/**
 * Computes aggregate social sentiment and filter metrics for a given asset.
 */
export async function getSocialSignalSummary(
  symbol: string,
  adapter: SocialSourceAdapter = mockSocialAdapter
): Promise<{ signal: SocialSignal; stats: SocialFilterStats }> {
  const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '').trim();
  const rawEvents = await adapter.fetchSocialEvents(cleanSymbol);

  const { accepted, stats } = filterSocialEvents(rawEvents);
  const signal = extractSocialSignal(cleanSymbol, accepted, stats);

  return { signal, stats };
}
