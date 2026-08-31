import { NextResponse } from 'next/server';
import { positionMonitoringService } from '@/lib/monitoring';

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
      { error: err.message || 'Internal server error while retrieving monitoring state' },
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
    const body = await req.json().catch(() => ({}));
    const executeExits = body?.executeExits === true;

    const result = await positionMonitoringService.runMonitoringCycle({
      executeExits
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error while executing monitoring cycle' },
      { status: 500 }
    );
  }
}
