import { NextResponse } from 'next/server';
import { durableSessionJournal } from '@/lib/agent/analytics/durable-journal';
import { sanitizeErrorMessage } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Phase 8.12: Live Paper Event Stream API
// INVARIANT: Read-only, deterministic, zero credential leakage.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = durableSessionJournal.getRecentEvents(50);
    const heartbeat = durableSessionJournal.getHeartbeat();
    const anomalies = durableSessionJournal.getAnomalies(20);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      heartbeat,
      events,
      anomalies
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(err.message) || 'Failed to fetch runtime events.' },
      { status: 500 }
    );
  }
}
