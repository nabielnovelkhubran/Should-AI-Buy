import { NextRequest, NextResponse } from 'next/server';
import { parseCommand } from '@/lib/command';
import { orchestrateCouncilInvestigation } from '@/lib/council';
import { storage } from '@/lib/storage';
import { sanitizeErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'MALFORMED_JSON: Request body must be valid JSON.' }, { status: 400 });
    }

    const rawCommand = typeof body?.command === 'string' && body.command.trim()
      ? body.command
      : typeof body?.query === 'string' && body.query.trim()
      ? body.query
      : typeof body?.asset === 'string' && body.asset.trim()
      ? (body.asset.trim().includes(' ') || body.asset.trim().startsWith('Should') || body.asset.trim().startsWith('Why')
          ? body.asset.trim()
          : `Should AI buy ${body.asset.trim()}?`)
      : '';

    const commandText = rawCommand.trim();

    if (!commandText || commandText.length > 250) {
      return NextResponse.json({
        error: 'INVALID_COMMAND: Command string must be between 1 and 250 characters.'
      }, { status: 400 });
    }

    const parsed = parseCommand(commandText);

    if (!parsed.valid || !parsed.asset) {
      return NextResponse.json({
        error: parsed.explanation || 'Invalid command format. Please specify an asset ticker (e.g. Should-AI buy $BTC?).'
      }, { status: 400 });
    }

    const investigation = await orchestrateCouncilInvestigation(commandText, parsed.asset);
    return NextResponse.json({ success: true, investigation });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error.message) || 'Council investigation failed.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const list = storage.getAllInvestigations();
  return NextResponse.json({ success: true, investigations: list });
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
