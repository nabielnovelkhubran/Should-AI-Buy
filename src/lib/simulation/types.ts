import { AssetClass, PaperOrderStatus } from '../types';
import { PaperPosition, PaperOrderSnapshot } from '../portfolio/types';
import { TradeRecord } from '../agent/analytics/types';

// ---------------------------------------------------------------------------
// Phase 8.16: Isolated Execution Lab & Simulation Types
// INVARIANT: Completely isolated from real Alpaca paper trading.
// INVARIANT: Zero network calls to Alpaca in simulation mode.
// ---------------------------------------------------------------------------

export type SimulationScenario =
  | 'SUCCESSFUL_BUY'
  | 'BUY_REJECTED'
  | 'PARTIAL_FILL'
  | 'TIMEOUT'
  | 'BROKER_ERROR'
  | 'CANCELLED'
  | 'PROFIT_EXIT'
  | 'PROTECTIVE_EXIT';

export interface ExecutionTraceStep {
  step: string;
  stage: 'DISCOVERY' | 'COUNCIL' | 'SIZING' | 'RISK_GATE' | 'ORDER_INTENT' | 'BROKER_SUBMISSION' | 'BROKER_FILL' | 'POSITION_RECONCILIATION' | 'MONITORING' | 'EXIT' | 'TRADE_LEDGER';
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'INFO';
  detail: string;
  timestamp: string;
  correlationIds?: {
    cycleId?: string;
    candidateId?: string;
    decisionId?: string;
    orderId?: string;
    brokerOrderId?: string;
    tradeId?: string;
  };
}

export interface SimulationPortfolioState {
  cash: number;
  equity: number;
  buyingPower: number;
  portfolioValue: number;
  realizedPnL: number;
  unrealizedPnL: number;
  openPositionCount: number;
  positions: PaperPosition[];
  orders: PaperOrderSnapshot[];
  trades: TradeRecord[];
  isSimulation: true;
  lastUpdated: string;
}

export interface SimulationRunResult {
  scenario: SimulationScenario;
  success: boolean;
  message: string;
  portfolio: SimulationPortfolioState;
  trace: ExecutionTraceStep[];
  executedAt: string;
}
