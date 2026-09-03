import { NextResponse } from 'next/server';
import { paperPortfolioService } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Phase 6B: Paper Portfolio API Route
// GET /api/trading/paper/portfolio
// INVARIANT: Server-side only. Zero credential leakage. Paper environment only.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const portfolio = await paperPortfolioService.getPortfolioSnapshot();
    return NextResponse.json(
      {
        success: true,
        portfolio
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error while fetching paper portfolio.'
      },
      { status: 500 }
    );
  }
}
