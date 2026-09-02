import { NextResponse } from 'next/server';
import { buildAlphaStrategyReviewSnapshot } from '@/lib/agent/analytics/strategy-review-engine';
import { sanitizeErrorMessage } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Phase 8.13: Alpha Verdict & Strategy Review API
// INVARIANT: Read-only, deterministic, zero credential leakage.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await buildAlphaStrategyReviewSnapshot();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...snapshot
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(err.message) || 'Failed to generate strategy review snapshot.' },
      { status: 500 }
    );
  }
}
