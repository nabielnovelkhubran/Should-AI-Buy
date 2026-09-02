import { NextRequest, NextResponse } from 'next/server';
import { buildRuntimeSnapshot } from '@/lib/agent/analytics/runtime-snapshot';
import { autonomousTradingEngine } from '@/lib/agent/engine';
import { autonomousRuntime } from '@/lib/agent/runtime';
import { sessionEvidenceManager } from '@/lib/agent/analytics/session-evidence';
import { sanitizeErrorMessage } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Phase 8.20: Runtime Observability & Autonomous Control API Endpoint
// INVARIANT: Pure observability and controlled lifecycle actions.
// INVARIANT: Never leaks API keys, secrets, or headers.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await buildRuntimeSnapshot();
    const runtimeStatus = autonomousRuntime.getStatus();
    return NextResponse.json({
      success: true,
      snapshot,
      runtime: runtimeStatus
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(err.message) || 'Failed to generate runtime snapshot.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json({ error: 'MALFORMED_JSON: Request body must be valid JSON.' }, { status: 400 });
    }

    const action = body?.action?.toUpperCase()?.trim();

    if (action === 'START_AUTONOMOUS' || action === 'START') {
      const intervalMs = typeof body?.intervalMs === 'number' ? body.intervalMs : undefined;
      const mode = body?.mode === 'SIMULATION' ? 'SIMULATION' : 'REAL_PAPER';
      const proofMode = body?.proofMode === true;
      const status = autonomousRuntime.start({ intervalMs, mode, proofMode });
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'START',
        message: `Autonomous Trading Runtime started in ${mode} mode (Interval: ${Math.round(status.intervalMs / 1000)}s, ProofMode: ${proofMode ? 'ON' : 'OFF'}).`,
        runtime: status,
        snapshot
      });
    }

    if (action === 'STOP_AUTONOMOUS' || action === 'STOP') {
      const status = autonomousRuntime.stop();
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'STOP',
        message: 'Autonomous Trading Runtime stopped cleanly.',
        runtime: status,
        snapshot
      });
    }

    
    if (action === 'SET_RISK_PROFILE') {
      const profile = body?.riskProfile === 'HIGH_RISK' ? 'HIGH_RISK' : 'STANDARD';
      autonomousRuntime.setRiskProfile(profile);
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'SET_RISK_PROFILE',
        message: `Risk profile set to ${profile}.`,
        runtime: autonomousRuntime.getStatus(),
        snapshot
      });
    }

    if (action === 'SET_PROOF_MODE') {
      const enabled = body?.enabled !== false;
      autonomousRuntime.setProofMode(enabled);
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'SET_PROOF_MODE',
        message: `Proof mode set to ${enabled ? 'ENABLED' : 'DISABLED'}.`,
        runtime: autonomousRuntime.getStatus(),
        snapshot
      });
    }

    if (action === 'SET_FILTER_THRESHOLDS') {
      // Validate and sanitise each allowed threshold key
      const overrides: Record<string, number> = {};
      const allowedKeys: Record<string, [number, number]> = {
        minLiquidityUsd:       [0, 10_000_000],
        maxSpreadBps:          [1, 500],
        minOpportunityScore:   [30, 100],
        minConfidenceScore:    [30, 100],
        minRiskRewardRatio:    [0.5, 10],
        maxOptionSpreadDollars:[0.05, 5],
        candidateEvaluationFloor: [30, 100],
        highConvictionScore:   [30, 100],
        maxOpenPositions:      [1, 30],
        maxPositionSizeUsd:    [1000, 100_000],
        maxPortfolioExposurePct: [10, 100],
      };
      for (const [key, [min, max]] of Object.entries(allowedKeys)) {
        if (typeof body?.[key] === 'number') {
          overrides[key] = Math.min(max, Math.max(min, body[key]));
        }
      }
      autonomousRuntime.setConfigOverrides(overrides);
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'SET_FILTER_THRESHOLDS',
        message: `Filter thresholds updated: ${JSON.stringify(overrides)}`,
        runtime: autonomousRuntime.getStatus(),
        snapshot
      });
    }

    if (action === 'SET_MODE') {
      const mode = body?.mode === 'SIMULATION' ? 'SIMULATION' : 'REAL_PAPER';
      autonomousRuntime.setMode(mode);
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'SET_MODE',
        message: `Execution mode set to ${mode}.`,
        runtime: autonomousRuntime.getStatus(),
        snapshot
      });
    }

    if (action === 'RUN_CYCLE') {
      const scanLimit = typeof body?.scanLimit === 'number' ? Math.max(1, Math.min(10, Math.floor(body.scanLimit))) : 5;
      const cycleResult = await autonomousRuntime.runCycle({ scanLimit });
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'RUN_CYCLE',
        cycleResult,
        runtime: autonomousRuntime.getStatus(),
        snapshot
      });
    }

    if (action === 'RESET_CIRCUIT_BREAKER') {
      autonomousTradingEngine.resetCircuitBreaker();
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'RESET_CIRCUIT_BREAKER',
        message: 'Circuit breaker reset successfully by operator.',
        runtime: autonomousRuntime.getStatus(),
        snapshot
      });
    }

    if (action === 'START_SESSION') {
      const session = sessionEvidenceManager.startNewSession({
        startingEquity: body?.startingEquity,
        startingCash: body?.startingCash
      });
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'START_SESSION',
        session,
        snapshot
      });
    }

    if (action === 'END_SESSION') {
      const session = sessionEvidenceManager.endSession();
      const snapshot = await buildRuntimeSnapshot();
      return NextResponse.json({
        success: true,
        action: 'END_SESSION',
        session,
        snapshot
      });
    }

    return NextResponse.json(
      { error: `UNKNOWN_ACTION: Action "${action}" is not supported. Valid actions: START, STOP, RUN_CYCLE, SET_PROOF_MODE, SET_MODE, RESET_CIRCUIT_BREAKER, START_SESSION, END_SESSION.` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(err.message) || 'Action failed.' },
      { status: 500 }
    );
  }
}
