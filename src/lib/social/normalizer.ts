import { Evidence, EvidenceType, ReliabilityRating, SocialEvent, VerificationStatus } from '../types';
import { SocialSourceAdapter } from './types';
import { deriveFreshness } from '../connectors/normalizer';
import { stripHtml } from '../connectors/alpaca-news-adapter';

// ---------------------------------------------------------------------------
// Phase 4C: Social Evidence Normalizer
// Normalizes filtered SocialEvent domain objects into first-class Evidence[]
// records that plug seamlessly into the Council, ClaimInspector, and
// ContradictionMatrix.
// ---------------------------------------------------------------------------

export function normalizeSocialToEvidence(
  events: SocialEvent[],
  investigationId: string,
  adapter: SocialSourceAdapter,
  seqOffset: number = 0
): Evidence[] {
  const retrievedAt = new Date().toISOString();

  return events.map((event, idx) => {
    const observedAt = event.createdAt;
    const freshness = deriveFreshness(observedAt, retrievedAt);
    const cleanText = stripHtml(event.text);
    const shortHeadline = cleanText.length > 75 ? `${cleanText.slice(0, 72)}...` : cleanText;
    const authorTag = event.author.displayName
      ? `${event.author.displayName} (@${event.author.username})`
      : `@${event.author.username}`;

    return {
      id: `EVID-SOC-${investigationId}-${seqOffset + idx + 1}`,
      investigationId,
      type: 'NEWS' as EvidenceType,
      title: `[${event.platform}] ${authorTag}: "${shortHeadline}"`,
      description: cleanText,
      observedAt,
      source: {
        name: `${event.platform} / @${event.author.username}`,
        url: event.sourceUrl,
        publisher: `${event.platform} Community`,
        publishedAt: observedAt,
        retrievedAt,
        adapterVersion: adapter.adapterId
      },
      value: {
        platform: event.platform,
        author: event.author.username,
        verified: Boolean(event.author.verified),
        followerCount: event.author.followerCount,
        engagement: event.engagement,
        sentiment: event.sentiment === 'BULLISH' ? 'POSITIVE' : event.sentiment === 'BEARISH' ? 'NEGATIVE' : 'NEUTRAL',
        rawSentiment: event.sentiment
      },
      metadata: {
        isSocial: true,
        platform: event.platform,
        author: event.author,
        engagement: event.engagement,
        sentiment: event.sentiment
      },
      reliability: adapter.defaultReliability,
      isContradictory: event.sentiment === 'BEARISH',
      verificationStatus: event.verificationStatus,
      adapterSource: adapter.adapterId,
      freshness,
      claimIds: [],
      contradicts: []
    };
  });
}
