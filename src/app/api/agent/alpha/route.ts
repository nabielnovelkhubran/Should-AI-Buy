import { NextResponse } from 'next/server';
import { buildAlphaReviewSnapshot } from '@/lib/agent/analytics/alpha-review';
import { sanitizeErrorMessage } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Phase 8.11: Live Alpha Calibration & Evidence Review API
// INVARIANT: Read-only, deterministic, zero credential leakage.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const alphaSnapshot = await buildAlphaReviewSnapshot();
    return NextResponse.json({
      success: true,
      ...alphaSnapshot
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(err.message) || 'Failed to generate alpha review snapshot.' },
      { status: 500 }
    );
  }
}
