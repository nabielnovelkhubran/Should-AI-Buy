import { NextResponse } from 'next/server';
import { durableSessionJournal } from '@/lib/agent/analytics/durable-journal';
import { sanitizeErrorMessage } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Phase 8.12: Durable Session Record API
// INVARIANT: Read-only, deterministic, zero credential leakage.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = durableSessionJournal.getSessionRecord();
    const heartbeat = durableSessionJournal.getHeartbeat();

    return NextResponse.json({
      success: true,
      session,
      heartbeat
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(err.message) || 'Failed to fetch session record.' },
      { status: 500 }
    );
  }
}
