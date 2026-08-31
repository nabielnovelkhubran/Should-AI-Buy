import { SocialEvent, SocialFilterStats } from '../types';
import { SocialFilterResult } from './types';

// ---------------------------------------------------------------------------
// Phase 4C: Deterministic Social Quality & Spam Filter
// Identifies and filters out obvious noise, promotional bots, duplicates,
// and spam without introducing external heavy dependencies or random heuristics.
// ---------------------------------------------------------------------------

const SPAM_PATTERNS = [
  /free\s+airdrop/i,
  /send\s+\w+\s+to\s+(?:double|receive)/i,
  /guaranteed\s+(?:100x|1000x|profit)/i,
  /join\s+(?:my\s+)?telegram/i,
  /t\.me\/[a-zA-Z0-9_-]+/i,
  /dm\s+(?:me\s+)?for\s+(?:signals|vip|leaks)/i,
  /pump\s+(?:group|channel|community)/i,
  /presale\s+(?:is\s+)?live\s+now/i,
  /whitelist\s+(?:giveaway|spots|sale)/i,
  /claim\s+(?:your\s+)?reward\s+here/i,
  /1000x\s+gem\s+alert/i
];

/**
 * Normalizes text for duplicate detection (lowercased, alphanumeric only).
 */
function normalizeForDuplicateCheck(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks for excessive repeated characters or emojis (5 or more identical consecutive characters).
 */
function hasExcessiveRepeatedCharacters(text: string): boolean {
  return /(.)\1{4,}/.test(text);
}

/**
 * Checks if hashtags or links comprise an excessive proportion of the post.
 */
function hasExcessiveHashtagOrUrlDensity(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const urlCount = (text.match(/https?:\/\/[^\s]+/gi) || []).length;
  if (urlCount > 3) return true;

  const hashtags = words.filter(w => w.startsWith('#') || w.startsWith('$'));
  if (hashtags.length >= 5 && hashtags.length / words.length > 0.5) {
    return true;
  }

  return false;
}

/**
 * Detects obvious engagement metric manipulation.
 */
function hasSuspiciousEngagement(event: SocialEvent): boolean {
  const eng = event.engagement;
  if (!eng) return false;

  const followers = event.author.followerCount ?? 0;
  const isVerified = Boolean(event.author.verified);

  // If unverified account with 0 followers reports > 10,000 likes or reposts
  if (!isVerified && followers === 0 && ((eng.likes ?? 0) > 10000 || (eng.reposts ?? 0) > 5000)) {
    return true;
  }

  return false;
}

/**
 * Evaluates a single SocialEvent against deterministic quality criteria.
 * Returns null if accepted, or a descriptive rejection reason.
 */
export function evaluateSocialEventQuality(
  event: SocialEvent,
  seenHashes: Set<string>
): string | null {
  // Rule 1: Min text length
  const trimmed = event.text.trim();
  if (trimmed.length < 10) {
    return 'POST_TOO_SHORT';
  }

  // Rule 2: Duplicate detection
  const normalized = normalizeForDuplicateCheck(trimmed);
  if (seenHashes.has(normalized)) {
    return 'DUPLICATE_TEXT';
  }

  // Rule 3: Excessive repeated characters
  if (hasExcessiveRepeatedCharacters(trimmed)) {
    return 'EXCESSIVE_REPEATED_CHARS';
  }

  // Rule 4: Obvious promotional/spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'PROMOTIONAL_SPAM_PATTERN';
    }
  }

  // Rule 5: Excessive hashtag or link density
  if (hasExcessiveHashtagOrUrlDensity(trimmed)) {
    return 'EXCESSIVE_LINK_OR_HASHTAG_DENSITY';
  }

  // Rule 6: Suspicious engagement anomalies
  if (hasSuspiciousEngagement(event)) {
    return 'ENGAGEMENT_ANOMALY';
  }

  return null;
}

/**
 * Filters an array of SocialEvent objects deterministically.
 */
export function filterSocialEvents(events: SocialEvent[]): SocialFilterResult {
  const accepted: SocialEvent[] = [];
  const rejected: { event: SocialEvent; reason: string }[] = [];
  const seenHashes = new Set<string>();
  const rejectionReasons: Record<string, number> = {};

  let duplicateCount = 0;
  let spamCount = 0;

  for (const event of events) {
    const reason = evaluateSocialEventQuality(event, seenHashes);
    if (!reason) {
      const normalized = normalizeForDuplicateCheck(event.text);
      seenHashes.add(normalized);
      accepted.push(event);
    } else {
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      if (reason === 'DUPLICATE_TEXT') {
        duplicateCount++;
      } else {
        spamCount++;
      }
      rejected.push({ event, reason });
    }
  }

  const stats: SocialFilterStats = {
    totalReceived: events.length,
    acceptedCount: accepted.length,
    spamFilteredCount: spamCount,
    duplicateCount,
    rejectionReasons
  };

  return { accepted, rejected, stats };
}
