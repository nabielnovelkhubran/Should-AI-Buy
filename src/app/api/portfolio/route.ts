import { NextResponse } from 'next/server';
import { alpacaService } from '@/lib/alpaca';
import { storage } from '@/lib/storage';

export async function GET() {
  const account = await alpacaService.getAccount();
  const positions = storage.getPositions();
  const orders = await alpacaService.getOrders();
  return NextResponse.json({ account, positions, orders });
}
