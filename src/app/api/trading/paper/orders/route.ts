import { NextRequest, NextResponse } from 'next/server';
import { paperTradingService } from '@/lib/trading';
import { storage } from '@/lib/storage';
import { PaperPortfolioService } from '@/lib/portfolio';
import { sanitizeErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (orderId) {
      if (typeof orderId !== 'string' || orderId.length > 100 || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
        return NextResponse.json({ error: 'INVALID_ORDER_ID: Malformed order identifier.' }, { status: 400 });
      }

      const order = await paperTradingService.getOrder(orderId);
      if (!order) {
        return NextResponse.json({ error: 'ORDER_NOT_FOUND: Order not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, order });
    }

    const orders = await paperTradingService.getOrders();
    return NextResponse.json({ success: true, orders });
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Failed to fetch paper orders.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'MALFORMED_JSON: Request body must be valid JSON.' }, { status: 400 });
    }

    const investigationId = body?.investigationId;

    if (!investigationId || typeof investigationId !== 'string' || investigationId.length > 100 || !/^[A-Za-z0-9_-]+$/.test(investigationId)) {
      return NextResponse.json(
        { error: 'INVALID_INVESTIGATION_ID: Valid investigationId string is required.' },
        { status: 400 }
      );
    }

    const investigation = storage.getInvestigation(investigationId);
    if (!investigation) {
      return NextResponse.json(
        { error: `INVESTIGATION_NOT_FOUND: Investigation with ID "${investigationId}" not found.` },
        { status: 404 }
      );
    }

    // Authoritative Server-Side Position Sizing
    const portfolioSnapshot = await new PaperPortfolioService().getPortfolioSnapshot();
    const availableCash = portfolioSnapshot.account?.cash ?? 100000;
    const orderResult = await paperTradingService.executeInvestigation(investigation, {
      accountCash: availableCash
    });

    // Save updated investigation with execution record
    storage.saveInvestigation(investigation);

    return NextResponse.json({
      success: orderResult.status === 'SUBMITTED' || orderResult.status === 'FILLED',
      order: orderResult,
      investigation
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Paper order execution failed.' },
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
