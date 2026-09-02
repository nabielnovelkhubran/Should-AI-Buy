import { NextRequest, NextResponse } from 'next/server';
import { workflowAuditor } from '@/lib/audit';
import { autonomousTradingEngine } from '@/lib/agent/engine';
import { simulationLabEngine } from '@/lib/simulation/lab-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/diagnostics/workflow
 * Retrieves recent audit records or the latest audit.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const mode = (searchParams.get('mode') as 'REAL_PAPER' | 'SIMULATION') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
    const cycleId = searchParams.get('cycleId') || undefined;
    const symbol = searchParams.get('symbol') || undefined;

    const audits = workflowAuditor.getAuditHistory({ mode, limit, cycleId, symbol });
    const latest = workflowAuditor.getLatestAudit(mode);

    return NextResponse.json({
      success: true,
      count: audits.length,
      audits,
      latest,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to retrieve workflow audits.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/diagnostics/workflow
 * Triggers an on-demand audit for the latest real cycle or a simulated scenario.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, scenario, candidateSymbol } = body;

    // Action 1: Audit Simulation Run
    if (action === 'AUDIT_SIMULATION' || scenario) {
      const targetScenario = scenario || 'SUCCESSFUL_BUY';
      const simResult = await simulationLabEngine.runScenario(targetScenario);
      const audit = await workflowAuditor.auditSimulationTrace(simResult);

      return NextResponse.json({
        success: true,
        action: 'AUDIT_SIMULATION',
        scenario: targetScenario,
        audit,
        simulationResult: simResult
      });
    }

    // Action 2: Audit Latest Real Autonomous Cycle
    const latestCycle = autonomousTradingEngine.getLatestCycle();
    if (!latestCycle) {
      // Create a baseline diagnostic audit for current market state
      const sampleSymbol = (candidateSymbol || 'BTC/USD').toUpperCase();
      const audit = await workflowAuditor.auditCycle({
        mode: 'REAL_PAPER',
        cycleId: `CYCLE-REAL-${Date.now().toString(36).toUpperCase()}`,
        correlationId: `CORR-REAL-${sampleSymbol}`,
        symbol: sampleSymbol,
        candidateSnapshot: {
          symbol: sampleSymbol,
          price: 85000,
          change24h: 0.8, // Flat 24h return -> triggers Quant HOLD
          relativeVolume: 1.6, // Strong 1h RVOL -> triggers Timeframe Blind-Spot advisory
          momentumScore: 78,
          realizedVolatility: 26.0,
          rsi14: 58.0,
          liquidityUsd: 1500000,
          spreadBps: 8.0,
          timestamp: new Date().toISOString()
        },
        multiFactorScore: 68,
        decision: {
          action: 'HOLD',
          conclusion: 'HOLD',
          confidence: 55,
          opportunityScore: 68,
          thesis: 'Subdued 24h change (+0.8%) below 1.5% minimum threshold for momentum breakout entry.',
          reasoningSummary: 'Capital preservation active during neutral momentum session.'
        },
        evidence: [
          { id: 'E1', type: 'MARKET', title: 'Market Snapshot', description: 'Deep liquidity $1.5M verified' },
          { id: 'E2', type: 'FLOW', title: 'Intraday Volume', description: 'RVOL 1.6x observed' }
        ],
        riskGateResult: {
          passed: false,
          violations: ['Non-BUY decision (HOLD)']
        }
      });

      return NextResponse.json({
        success: true,
        action: 'AUDIT_REAL_CYCLE',
        message: 'No completed real cycle found in memory; audited baseline market session candidate.',
        audit
      });
    }

    // Evaluate first evaluation in latest real cycle
    const evalItem = latestCycle.evaluations?.[0];
    const audit = await workflowAuditor.auditCycle({
      mode: 'REAL_PAPER',
      cycleId: latestCycle.cycleId,
      correlationId: `CORR-${latestCycle.cycleId}-${evalItem?.candidateSymbol || 'CYCLE'}`,
      symbol: evalItem?.candidateSymbol,
      multiFactorScore: evalItem?.opportunityScore,
      decision: evalItem?.aiDecision,
      evidence: evalItem?.aiDecision?.evidence,
      riskGateResult: {
        passed: evalItem?.riskGatePassed ?? false,
        violations: evalItem?.riskGateViolations || []
      },
      orderIntent: evalItem?.orderResult
    });

    return NextResponse.json({
      success: true,
      action: 'AUDIT_REAL_CYCLE',
      cycleId: latestCycle.cycleId,
      audit
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Workflow audit execution failed.' },
      { status: 500 }
    );
  }
}
