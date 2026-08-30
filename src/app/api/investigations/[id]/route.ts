import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const investigation = storage.getInvestigation(params.id);
  if (!investigation) {
    return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
  }
  return NextResponse.json({ investigation });
}
