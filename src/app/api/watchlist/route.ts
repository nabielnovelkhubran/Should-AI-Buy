import { NextRequest, NextResponse } from 'next/server';
import { watchlistService } from '@/lib/watchlist';
import { sanitizeErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    items: watchlistService.list()
  });
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'MALFORMED_JSON: Request body must be valid JSON.' }, { status: 400 });
    }

    const action = body?.action || 'add';
    const rawSymbol = body?.symbol;

    if (!rawSymbol || typeof rawSymbol !== 'string' || rawSymbol.length > 15 || !/^[A-Za-z0-9_$-]+$/.test(rawSymbol)) {
      return NextResponse.json({ error: 'INVALID_SYMBOL: Valid symbol identifier is required.' }, { status: 400 });
    }

    const symbol = rawSymbol.toUpperCase().replace(/^\$/, '').trim();

    if (action === 'remove') {
      watchlistService.remove(symbol);
    } else if (action === 'add') {
      watchlistService.add(symbol, {
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : undefined,
        targetPrice: typeof body.targetPrice === 'number' ? body.targetPrice : undefined,
        addedFromScan: Boolean(body.addedFromScan),
        lastOpportunityScore: typeof body.lastOpportunityScore === 'number' ? body.lastOpportunityScore : undefined,
        assetClass: body.assetClass === 'crypto' || body.assetClass === 'us_equity' ? body.assetClass : undefined
      });
    } else {
      return NextResponse.json({ error: 'INVALID_ACTION: Supported actions are add or remove.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      items: watchlistService.list()
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error.message) || 'Watchlist action failed.' },
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
