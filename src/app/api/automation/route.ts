import { NextResponse } from 'next/server';
import { automationScheduler } from '@/lib/automation';
import { sanitizeErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/automation
// Returns the real-time status of the scheduled automation subsystem.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const status = automationScheduler.getStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Internal server error while retrieving automation status.' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/automation
// Operator control endpoint for scheduler lifecycle and manual job runs.
// Supported actions: 'start' | 'stop' | 'runNow' | 'updateConfig'
// INVARIANT: Server-side validation only. Live trading is strictly prohibited.
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

    const action = typeof body?.action === 'string' ? body.action.toLowerCase() : '';

    if (action === 'start') {
      automationScheduler.start();
      return NextResponse.json({
        success: true,
        message: 'Automation scheduler started in PAPER trading mode.',
        status: automationScheduler.getStatus()
      });
    }

    if (action === 'stop') {
      automationScheduler.stop();
      return NextResponse.json({
        success: true,
        message: 'Automation scheduler stopped.',
        status: automationScheduler.getStatus()
      });
    }

    if (action === 'runnow') {
      const rawJobType = typeof body?.jobType === 'string' ? body.jobType.toUpperCase() : '';
      if (rawJobType !== 'DISCOVERY' && rawJobType !== 'MONITORING') {
        return NextResponse.json(
          { error: 'INVALID_JOB_TYPE: Must specify jobType as DISCOVERY or MONITORING' },
          { status: 400 }
        );
      }

      const run = await automationScheduler.runNow(rawJobType as any);
      return NextResponse.json({
        success: true,
        run,
        status: automationScheduler.getStatus()
      });
    }

    if (action === 'updateconfig') {
      const newConfig = body?.config;
      if (!newConfig || typeof newConfig !== 'object' || Array.isArray(newConfig)) {
        return NextResponse.json(
          { error: 'INVALID_CONFIG: Missing or malformed config object' },
          { status: 400 }
        );
      }

      const updated = automationScheduler.updateConfig(newConfig);
      return NextResponse.json({
        success: true,
        config: updated,
        status: automationScheduler.getStatus()
      });
    }

    return NextResponse.json(
      { error: 'INVALID_ACTION: Supported actions are start, stop, runNow, updateConfig' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Internal server error executing automation command.' },
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
