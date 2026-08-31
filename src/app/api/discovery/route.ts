import { NextRequest, NextResponse } from 'next/server';
import { scanOpportunities } from '@/lib/scanner';
import { candidateQueue } from '@/lib/queue';
import { councilDispatcher } from '@/lib/dispatcher';
import { ScanResult } from '@/lib/types';

// In-memory cache of the latest scan result for dashboard observability
let latestScanResult: ScanResult | null = null;

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
      body = await req.json();
    } catch {
      // Empty body is allowed, uses default scan options
    }

    const autoDispatch = body.autoDispatch !== false; // Default true
    const dispatchLimit = typeof body.dispatchLimit === 'number' ? body.dispatchLimit : 1;

    // 1. Execute Phase 5A Autonomous Opportunity Scanner
    const scanResult = await scanOpportunities({
      universe: body.universe,
      limit: body.limit || 5,
      minScore: body.minScore
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
      { error: error.message || 'Discovery scan failed' },
      { status: 500 }
    );
  }
}
