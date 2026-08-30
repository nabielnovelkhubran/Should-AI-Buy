import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { fetchMarketSnapshot, getMarketEvidence } from '@/lib/market-data';
import { runMonitoringAgent } from '@/lib/agents';
import { alpacaService } from '@/lib/alpaca';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symbol = (body.symbol || 'BTC').toUpperCase().replace('$', '');
    const position = storage.getPositionByAsset(symbol);

    if (!position) {
      return NextResponse.json({ error: `No active open position found for $${symbol}` }, { status: 404 });
    }

    const currentSnapshot = await fetchMarketSnapshot(symbol);
    const currentEvidence = getMarketEvidence('re-eval', currentSnapshot);
    const monitoringResult = runMonitoringAgent(position, currentSnapshot, currentEvidence);

    let sellOrder = null;
    if (monitoringResult.recommendation === 'SELL' && body.executeSell) {
      sellOrder = await alpacaService.submitPaperOrder(symbol, position.quantity, 'sell', currentSnapshot.price);
      position.status = 'CLOSED';
    }

    return NextResponse.json({
      position,
      currentSnapshot,
      monitoringResult,
      sellOrder
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Re-evaluation error' }, { status: 500 });
  }
}
