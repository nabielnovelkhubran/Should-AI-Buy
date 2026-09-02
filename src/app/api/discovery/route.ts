import { NextRequest, NextResponse } from 'next/server';
import { scanOpportunities } from '@/lib/scanner';
import { candidateQueue } from '@/lib/queue';
import { councilDispatcher } from '@/lib/dispatcher';
import { ScanResult } from '@/lib/types';
import { sanitizeErrorMessage } from '@/lib/errors';

// In-memory cache of the latest scan result for dashboard observability
let latestScanResult: ScanResult | null = null;

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    scanResult: latestScanResult,
    queueItems: candidateQueue.getAllItems(),
    queueStats: candidateQueue.getStats()
  });
}

export async function POST(req: NextRequest) {
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

    const autoDispatch = body?.autoDispatch !== false; // Default true
    const dispatchLimit = typeof body?.dispatchLimit === 'number' ? Math.max(1, Math.min(5, Math.floor(body.dispatchLimit))) : 1;
    const limit = typeof body?.limit === 'number' ? Math.max(1, Math.min(20, Math.floor(body.limit))) : 20;
    const minScore = typeof body?.minScore === 'number' ? Math.max(0, Math.min(100, body.minScore)) : undefined;

    // 1. Execute Phase 5A Autonomous Opportunity Scanner
    const scanResult = await scanOpportunities({
      universe: Array.isArray(body?.universe) ? body.universe : undefined,
      limit,
      minScore
    });

    latestScanResult = scanResult;

    // 2. Enqueue discovered candidates into Phase 5B Candidate Queue
    candidateQueue.enqueueMany(scanResult.candidates);

    // 3. Sequentially dispatch top candidate(s) to Council investigation
    let dispatchSummary = null;
    if (autoDispatch && scanResult.candidates.length > 0) {
      dispatchSummary = await councilDispatcher.dispatchAll(dispatchLimit);
    }

    return NextResponse.json({
      scanResult,
      queueItems: candidateQueue.getAllItems(),
      queueStats: candidateQueue.getStats(),
      dispatchSummary
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error.message) || 'Discovery scan failed.' },
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
