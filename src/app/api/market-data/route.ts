import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketSnapshot, AlpacaDataError } from '@/lib/market-data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'BTC';
    const snapshot = await fetchMarketSnapshot(symbol);
    return NextResponse.json({ snapshot });
  } catch (err: any) {
    const status = err instanceof AlpacaDataError ? (err.statusCode || 500) : 500;
    return NextResponse.json({ error: err.message || 'Market data fetch failed' }, { status });
  }
}
