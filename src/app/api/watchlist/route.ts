import { NextRequest, NextResponse } from 'next/server';
import { watchlistService } from '@/lib/watchlist';

export async function GET() {
  return NextResponse.json({
    items: watchlistService.list()
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'add';
    const symbol = body.symbol;

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json({ error: 'Valid symbol is required' }, { status: 400 });
    }

    if (action === 'remove') {
      watchlistService.remove(symbol);
    } else {
      watchlistService.add(symbol, {
        notes: body.notes,
        targetPrice: body.targetPrice,
        addedFromScan: body.addedFromScan,
        lastOpportunityScore: body.lastOpportunityScore,
        assetClass: body.assetClass
      });
    }

    return NextResponse.json({
      items: watchlistService.list()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Watchlist action failed' }, { status: 500 });
  }
}
