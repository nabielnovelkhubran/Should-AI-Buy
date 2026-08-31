import { NextResponse } from 'next/server';
import { paperPortfolioService } from '@/lib/portfolio';
import { storage } from '@/lib/storage';

export async function GET() {
  try {
    const portfolio = await paperPortfolioService.getPortfolioSnapshot();
    const legacyPositions = storage.getPositions();

    return NextResponse.json({
      account: portfolio.account,
      positions: portfolio.positions.length > 0 ? portfolio.positions : legacyPositions,
      orders: portfolio.openOrders,
      portfolio
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch portfolio data' },
      { status: 500 }
    );
  }
}
