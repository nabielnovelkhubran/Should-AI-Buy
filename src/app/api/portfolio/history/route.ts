import { NextResponse } from 'next/server';
import { getTradingEnvironmentConfig, validatePaperTradingEndpoint } from '@/lib/environment';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '1D';
    const timeframe = searchParams.get('timeframe') || (period === '1D' ? '15Min' : period === '1W' ? '1H' : '1D');

    const env = getTradingEnvironmentConfig();
    validatePaperTradingEndpoint(env.baseUrl);

    if (!env.apiKey || !env.secretKey || env.apiKey.startsWith('MOCK')) {
      const baseValue = 100000;
      const now = Math.floor(Date.now() / 1000);
      const points = 24;
      const timestamps: number[] = [];
      const equities: number[] = [];
      const pnl: number[] = [];

      for (let i = 0; i < points; i++) {
        timestamps.push(now - (points - i) * 900);
        const eq = baseValue + (i * 32.5) + (Math.sin(i / 2) * 45);
        equities.push(Number(eq.toFixed(2)));
        pnl.push(Number((eq - baseValue).toFixed(2)));
      }

      return NextResponse.json({
        base_value: baseValue,
        timeframe,
        timestamp: timestamps,
        equity: equities,
        profit_loss: pnl,
        profit_loss_pct: pnl.map(p => Number((p / baseValue).toFixed(4))),
        isFallback: true
      });
    }

    const targetUrl = new URL(env.baseUrl + '/account/portfolio/history');
    targetUrl.searchParams.set('period', period);
    targetUrl.searchParams.set('timeframe', timeframe);

    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': env.apiKey,
        'APCA-API-SECRET-KEY': env.secretKey,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: 'Alpaca history error: ' + res.status + ' ' + errText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache'
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch portfolio history' },
      { status: 500 }
    );
  }
}
