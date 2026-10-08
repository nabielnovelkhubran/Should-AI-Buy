import { NextRequest, NextResponse } from 'next/server';
import { webhookDispatcher, WebhookAlertEvent } from '@/lib/notifications/webhook-dispatcher';
import { sanitizeErrorMessage } from '@/lib/errors';
import { isOperator } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/webhook
 * Returns configuration status (booleans only; zero credential leakage).
 */
export async function GET() {
  return NextResponse.json(webhookDispatcher.getStatus());
}

/**
 * POST /api/notifications/webhook
 * Dispatches a test alert or custom alert to configured channels.
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const hasCustomOverrides = Boolean(body?.overrides?.discordUrl || body?.overrides?.telegramToken);
    if (!hasCustomOverrides && !isOperator(req)) {
      return NextResponse.json(
        { error: 'FORBIDDEN: Operator authority required to dispatch alerts to production channels.' },
        { status: 403 }
      );
    }

    const testEvent: WebhookAlertEvent = {
      type: body.type || 'TEST_ALERT',
      asset: body.asset || 'BTC',
      title: body.title || 'Webhook Alert System Online',
      description: body.description || 'Test notification from Should-AI Buy? Autonomous Council alert pipeline.',
      severity: body.severity || 'SUCCESS',
      metrics: {
        score: body.metrics?.score ?? 88,
        confidence: body.metrics?.confidence ?? 0.85,
        targetPrice: body.metrics?.targetPrice ?? 82500,
        stopPrice: body.metrics?.stopPrice ?? 74200,
      },
      timestamp: new Date().toISOString(),
    };

    const result = await webhookDispatcher.dispatch(testEvent, body.overrides);
    return NextResponse.json({
      success: true,
      delivered: result,
      status: webhookDispatcher.getStatus(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Failed to dispatch webhook alert.' },
      { status: 500 }
    );
  }
}
