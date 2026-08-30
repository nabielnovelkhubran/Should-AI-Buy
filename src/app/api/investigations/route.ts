import { NextRequest, NextResponse } from 'next/server';
import { parseCommand } from '@/lib/command';
import { orchestrateCouncilInvestigation } from '@/lib/council';
import { storage } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const commandText = body.command || '';
    const parsed = parseCommand(commandText);

    if (!parsed.valid || !parsed.asset) {
      return NextResponse.json({
        error: parsed.explanation || 'Invalid command format. Please specify an asset ticker (e.g. Should-AI buy $NOVA?).'
      }, { status: 400 });
    }

    const investigation = await orchestrateCouncilInvestigation(commandText, parsed.asset);
    return NextResponse.json({ investigation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  const list = storage.getAllInvestigations();
  return NextResponse.json({ investigations: list });
}
