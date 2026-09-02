import { NextRequest, NextResponse } from 'next/server';
import {
  isFeatherlessConfigured,
  getFeatherlessModel,
  getFeatherlessBaseUrl,
  testFeatherlessConnection,
  generateFeatherlessCompletion,
  generateFeatherlessChat
} from '@/lib/ai';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/featherless
 * Returns the status, configuration metadata, and connectivity state of Featherless AI.
 */
export async function GET(req: NextRequest) {
  const configured = isFeatherlessConfigured();
  const model = getFeatherlessModel();
  const baseURL = getFeatherlessBaseUrl();
  const searchParams = req.nextUrl.searchParams;
  const testConn = searchParams.get('test') === 'true';

  let testResult = null;
  if (testConn && configured) {
    testResult = await testFeatherlessConnection();
  }

  return NextResponse.json({
    success: true,
    provider: 'featherless',
    configured,
    model,
    baseURL,
    test: testResult,
    timestamp: new Date().toISOString()
  });
}

/**
 * POST /api/ai/featherless
 * Runs a completion or chat request using the Featherless AI endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, prompt, systemPrompt, messages, model, temperature, maxTokens } = body;

    if (mode === 'chat' && Array.isArray(messages)) {
      const result = await generateFeatherlessChat({
        messages,
        model,
        temperature,
        maxTokens
      });
      return NextResponse.json({ success: true, result });
    }

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "prompt" parameter.' },
        { status: 400 }
      );
    }

    const result = await generateFeatherlessCompletion({
      prompt,
      systemPrompt,
      model,
      temperature,
      maxTokens
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Featherless request failed.' },
      { status: 500 }
    );
  }
}
