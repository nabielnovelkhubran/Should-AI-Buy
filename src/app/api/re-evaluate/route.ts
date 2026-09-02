import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { fetchMarketSnapshot, getMarketEvidence } from '@/lib/market-data';
import { runMonitoringAgent } from '@/lib/agents';
import { paperTradingService } from '@/lib/trading';
import { truncateQuantity } from '@/lib/trading/precision';
import { sanitizeErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'MALFORMED_JSON: Request body must be valid JSON.' }, { status: 400 });
    }

    const symbol = (body?.symbol || 'BTC').toUpperCase().replace('$', '').trim();
    const position = storage.getPositionByAsset(symbol);

    if (!position) {
      return NextResponse.json({ error: `No active open position found for $${symbol}` }, { status: 404 });
    }

    const currentSnapshot = await fetchMarketSnapshot(symbol);
    const currentEvidence = getMarketEvidence('re-eval', currentSnapshot);
    const monitoringResult = runMonitoringAgent(position, currentSnapshot, currentEvidence);

    let sellOrder = null;
    if (monitoringResult.recommendation === 'SELL' && body?.executeSell) {
      const assetClass = (['BTC', 'ETH', 'SOL'].includes(symbol) ? 'CRYPTO' : 'EQUITY');
      const safeQty = truncateQuantity(position.quantity, assetClass);
      
      sellOrder = await paperTradingService.submitPaperOrder({
        investigationId: `RE-EVAL-${symbol}-${Date.now()}`,
        symbol,
        assetClass,
        side: 'sell',
        qty: safeQty,
        price: currentSnapshot.price,
        orderType: 'market',
        timeInForce: assetClass === 'CRYPTO' ? 'gtc' : 'day',
        riskGatePassed: true,
        recommendation: 'SELL',
        opportunityScore: 50
      });
      position.status = 'CLOSED';
    }

    return NextResponse.json({
      position,
      currentSnapshot,
      monitoringResult,
      sellOrder
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) || 'Re-evaluation error' }, { status: 500 });
  }
}
