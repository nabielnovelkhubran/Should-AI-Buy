import { NextResponse } from 'next/server';
import { brokerDiagnostics } from '@/lib/diagnostics/broker-diagnostics';
import { sanitizeErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/diagnostics/broker
// Returns sanitized real-time telemetry on broker API communication.
// INVARIANT: Zero credential exposure. Account numbers are masked.
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const summary = brokerDiagnostics.getSummary(limit);
    return NextResponse.json({ success: true, diagnostics: summary });
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Failed to retrieve broker diagnostics.' },
      { status: 500 }
    );
  }
}
