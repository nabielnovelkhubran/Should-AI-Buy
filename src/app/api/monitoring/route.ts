import { NextResponse } from 'next/server';
import { positionMonitoringService } from '@/lib/monitoring';
import { sanitizeErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/monitoring
// Returns the latest portfolio monitoring and thesis health state.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    let result = positionMonitoringService.getLatestResult();
    if (!result) {
      result = await positionMonitoringService.runMonitoringCycle();
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Internal server error while retrieving monitoring state.' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/monitoring
// Manually triggers a new deterministic position monitoring cycle.
// Supports options: { executeExits?: boolean }
// INVARIANT: Server-side validation only. Client cannot override quantities or bypass safety.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json({ error: 'MALFORMED_JSON: Request body must be valid JSON.' }, { status: 400 });
    }

    const executeExits = body?.executeExits === true;

    const result = await positionMonitoringService.runMonitoringCycle({
      executeExits
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Internal server error while executing monitoring cycle.' },
      { status: 500 }
    );
  }
}

export async function PUT() {
  return NextResponse.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
}
