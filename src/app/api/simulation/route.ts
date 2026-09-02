import { NextResponse } from 'next/server';
import { simulationLabEngine } from '@/lib/simulation/lab-engine';
import { simulationPortfolioService } from '@/lib/simulation/portfolio';
import { simulationTradingAdapter } from '@/lib/simulation/adapter';
import { sanitizeErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/simulation
// Returns current sandboxed simulation state, portfolio, positions, and trace.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const portfolio = simulationPortfolioService.getState();
    const trace = simulationLabEngine.getTrace();
    const scenario = simulationTradingAdapter.getScenario();

    return NextResponse.json({
      success: true,
      scenario,
      portfolio,
      trace,
      generatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Failed to retrieve simulation state.' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/simulation
// Executes simulated scenarios, deterministic price bumps, sells, or resets.
// Supported actions: 'RUN_SCENARIO' | 'BUMP_PRICE' | 'SIMULATE_SELL' | 'RESET'
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'MALFORMED_JSON: Request body must be valid JSON.' }, { status: 400 });
    }

    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : '';

    if (action === 'RUN_SCENARIO') {
      const scenario = body?.scenario || 'SUCCESSFUL_BUY';
      const result = await simulationLabEngine.runScenario(scenario);
      return NextResponse.json({
        success: true,
        result,
        portfolio: result.portfolio,
        trace: result.trace,
        message: result.message
      });
    }

    if (action === 'BUMP_PRICE') {
      const percent = typeof body?.percent === 'number' ? body.percent : 5;
      const result = simulationLabEngine.bumpPrice(percent);
      return NextResponse.json({
        success: true,
        result,
        portfolio: result.portfolio,
        trace: result.trace
      });
    }

    if (action === 'SIMULATE_SELL') {
      const symbol = body?.symbol || 'BTC/USD';
      const result = simulationLabEngine.simulateSell(symbol);
      return NextResponse.json({
        success: true,
        result,
        portfolio: result.portfolio,
        trace: result.trace,
        message: result.message
      });
    }

    if (action === 'RESET') {
      simulationLabEngine.reset();
      const portfolio = simulationPortfolioService.getState();
      return NextResponse.json({
        success: true,
        message: 'Simulation portfolio reset to $100,000 cash, 0 positions.',
        portfolio,
        trace: []
      });
    }

    return NextResponse.json(
      { error: `INVALID_ACTION: Supported actions are RUN_SCENARIO, BUMP_PRICE, SIMULATE_SELL, RESET (received "${action}").` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) || 'Simulation execution failed.' },
      { status: 500 }
    );
  }
}
