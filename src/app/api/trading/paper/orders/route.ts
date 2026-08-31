import { NextRequest, NextResponse } from 'next/server';
import { paperTradingService } from '@/lib/trading';
import { storage } from '@/lib/storage';
import { alpacaService } from '@/lib/alpaca';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (orderId) {
      const order = await paperTradingService.getOrder(orderId);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json({ order });
    }

    const orders = await paperTradingService.getOrders();
    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch paper orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const investigationId = body.investigationId;

    if (!investigationId || typeof investigationId !== 'string') {
      return NextResponse.json(
        { error: 'Valid investigationId is required to execute a paper order' },
        { status: 400 }
      );
    }

    const investigation = storage.getInvestigation(investigationId);
    if (!investigation) {
      return NextResponse.json(
        { error: `Investigation with ID "${investigationId}" not found in storage` },
        { status: 404 }
      );
    }

    // Get current account cash for position sizing
    const account = await alpacaService.getAccount();
    const orderResult = await paperTradingService.executeInvestigation(investigation, {
      accountCash: account.cash
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
      { error: err.message || 'Paper order execution failed' },
      { status: 500 }
    );
  }
}
