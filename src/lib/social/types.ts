import { ReliabilityRating, SocialEvent, SocialFilterStats, SocialSignal } from '../types';

// ---------------------------------------------------------------------------
// Phase 4C: Social Source Adapter Interface
// Abstract contract for any social media provider (X, Reddit, Farcaster, etc.)
// ---------------------------------------------------------------------------

export interface SocialSourceAdapter {
  readonly adapterId: string;
  readonly adapterName: string;
  readonly defaultReliability: ReliabilityRating;
  
  /**
   * Fetches raw social events for the given symbol from the provider.
   * CONTRACT:
   * - Must NEVER fabricate live data.
   * - Demo/mock adapters must set verificationStatus = 'MOCK'.
   * - Must throw on critical failure or return [] for zero events.
   */
  fetchSocialEvents(symbol: string): Promise<SocialEvent[]>;
}

export interface SocialFilterResult {
  accepted: SocialEvent[];
  rejected: { event: SocialEvent; reason: string }[];
  stats: SocialFilterStats;
}
