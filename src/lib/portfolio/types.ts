import { PaperOrderStatus, AssetClass } from '../types';

// ---------------------------------------------------------------------------
// Phase 6B: Provider-Agnostic Paper Portfolio Domain Models
// INVARIANT: Paper trading only. Live broker access is strictly prohibited.
// ---------------------------------------------------------------------------

export interface PaperAccountSnapshot {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  isPaper: boolean; // Must always be true
  retrievedAt: string;
}

export interface PaperPosition {
  symbol: string;
  assetClass: AssetClass;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  side: 'long' | 'short';
  allocationPct: number;
  retrievedAt: string;
}

export interface PaperOrderSnapshot {
  orderId: string;
  brokerOrderId?: string;
  clientOrderId?: string;
  investigationId?: string;
  symbol: string;
  assetClass: AssetClass;
  side: 'buy' | 'sell';
  qty: number;
  filledQty: number;
  remainingQty: number;
  status: PaperOrderStatus;
  orderType: string;
  timeInForce: string;
  filledAvgPrice?: number;
  submittedAt: string;
  updatedAt?: string;
}

export interface PortfolioExposure {
  grossExposureUsd: number;
  netExposureUsd: number;
  grossExposurePct: number;
  netExposurePct: number;
  cryptoExposureUsd: number;
  cryptoExposurePct: number;
  equityExposureUsd: number;
  equityExposurePct: number;
  largestPositionSymbol?: string;
  largestPositionAllocationPct: number;
}

export interface PortfolioRiskSummary {
  totalExposureUsd: number;
  availableBuyingPowerUsd: number;
  openPositionCount: number;
  openOrderCount: number;
  pendingOrderExposureUsd: number;
  concentrationWarnings: string[];
  maxAllowedPositionPct: number;
  isExposureSafe: boolean;
}

export interface PortfolioError {
  source: 'account' | 'positions' | 'orders';
  reason: string;
}

export interface PortfolioSnapshot {
  account: PaperAccountSnapshot | null;
  positions: PaperPosition[];
  openOrders: PaperOrderSnapshot[];
  exposure: PortfolioExposure;
  risk: PortfolioRiskSummary;
  errors?: PortfolioError[];
  provider: string;
  environment: 'PAPER';
  retrievedAt: string;
}

export interface PortfolioLimits {
  maxPositionAllocationPct: number; // e.g. 25.0%
  maxGrossExposurePct: number; // e.g. 100.0%
  maxCryptoExposurePct: number; // e.g. 50.0%
  minAvailableCashPct: number; // e.g. 10.0%
}

export interface ProposedOrderAssessment {
  allowed: boolean;
  reason?: string;
  currentExposureUsd: number;
  projectedExposureUsd: number;
  projectedAllocationPct: number;
}

export interface PaperPortfolioAdapter {
  getAccount(): Promise<PaperAccountSnapshot>;
  getPositions(): Promise<PaperPosition[]>;
  getOpenOrders(): Promise<PaperOrderSnapshot[]>;
}
