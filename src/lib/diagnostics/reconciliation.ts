// ---------------------------------------------------------------------------
// Phase 8.19: Order & Position Reconciliation Subsystem
// INVARIANT: Compares local system intents against authoritative Alpaca ground truth.
// INVARIANT: Never assumes ORDER_FILLED == POSITION_EXISTS without independent query.
// ---------------------------------------------------------------------------

export type OrderReconciliationStatus =
  | 'MATCHED'
  | 'PENDING'
  | 'PARTIALLY_MATCHED'
  | 'REJECTED'
  | 'MISMATCH'
  | 'UNKNOWN';

export type PositionReconciliationStatus =
  | 'CONFIRMED'
  | 'MISMATCH'
  | 'NOT_FOUND'
  | 'PENDING';

export interface OrderReconciliationReport {
  reconciled: boolean;
  status: OrderReconciliationStatus;
  localIntent: {
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    orderType?: string;
    orderId?: string;
    clientOrderId?: string;
  };
  brokerRecord?: {
    brokerOrderId: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    status: string;
    filledQty?: number;
    filledAvgPrice?: number;
    submittedAt?: string;
  };
  timestamp: string;
  details: string;
}

export interface PositionReconciliationReport {
  reconciled: boolean;
  status: PositionReconciliationStatus;
  expectedPosition: {
    symbol: string;
    side: 'long' | 'short';
    qty: number;
  };
  brokerPosition?: {
    symbol: string;
    qty: number;
    currentPrice: number;
    avgEntryPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    side: 'long' | 'short';
  };
  timestamp: string;
  details: string;
}

export class BrokerReconciliationEngine {
  private latestOrderRecon: OrderReconciliationReport | null = null;
  private latestPositionRecon: PositionReconciliationReport | null = null;

  public reconcileOrder(
    localIntent: { symbol: string; side: 'buy' | 'sell'; qty: number; orderType?: string; orderId?: string; clientOrderId?: string },
    brokerOrder?: { id: string; symbol: string; side: 'buy' | 'sell'; qty: string | number; status: string; filled_qty?: string | number; filled_avg_price?: string | number; submitted_at?: string }
  ): OrderReconciliationReport {
    const now = new Date().toISOString();

    if (!brokerOrder) {
      const report: OrderReconciliationReport = {
        reconciled: false,
        status: 'UNKNOWN',
        localIntent,
        timestamp: now,
        details: 'No broker order response received to reconcile.'
      };
      this.latestOrderRecon = report;
      return report;
    }

    const brokerQty = Number(brokerOrder.qty || 0);
    const brokerFilledQty = brokerOrder.filled_qty ? Number(brokerOrder.filled_qty) : 0;
    const cleanIntentSym = localIntent.symbol.toUpperCase().replace(/[^A-Z0-9/]/g, '');
    const cleanBrokerSym = brokerOrder.symbol.toUpperCase().replace(/[^A-Z0-9/]/g, '');

    const symMatch = cleanIntentSym === cleanBrokerSym || cleanIntentSym.replace('/', '') === cleanBrokerSym.replace('/', '');
    const sideMatch = localIntent.side.toLowerCase() === brokerOrder.side.toLowerCase();
    const qtyMatch = Math.abs(localIntent.qty - brokerQty) < 0.0001;

    let status: OrderReconciliationStatus = 'MATCHED';
    let details = `Order matched broker state exactly: ${cleanIntentSym} ${localIntent.side.toUpperCase()} ${localIntent.qty} (Status: ${brokerOrder.status.toUpperCase()}).`;

    if (!symMatch || !sideMatch || !qtyMatch) {
      status = 'MISMATCH';
      details = `Discrepancy detected: Local [${cleanIntentSym} ${localIntent.side} ${localIntent.qty}] vs Broker [${cleanBrokerSym} ${brokerOrder.side} ${brokerQty}].`;
    } else if (brokerOrder.status === 'rejected' || brokerOrder.status === 'canceled') {
      status = 'REJECTED';
      details = `Broker order rejected/canceled with status: ${brokerOrder.status}.`;
    } else if (brokerOrder.status === 'partially_filled') {
      status = 'PARTIALLY_MATCHED';
      details = `Order partially filled: ${brokerFilledQty} of ${brokerQty} units.`;
    } else if (brokerOrder.status === 'new' || brokerOrder.status === 'accepted' || brokerOrder.status === 'pending_new') {
      status = 'PENDING';
      details = `Order accepted by broker and awaiting fill (Status: ${brokerOrder.status}).`;
    }

    const report: OrderReconciliationReport = {
      reconciled: status === 'MATCHED' || status === 'PENDING' || status === 'PARTIALLY_MATCHED',
      status,
      localIntent,
      brokerRecord: {
        brokerOrderId: brokerOrder.id,
        symbol: cleanBrokerSym,
        side: brokerOrder.side,
        qty: brokerQty,
        status: brokerOrder.status,
        filledQty: brokerFilledQty,
        filledAvgPrice: brokerOrder.filled_avg_price ? Number(brokerOrder.filled_avg_price) : undefined,
        submittedAt: brokerOrder.submitted_at
      },
      timestamp: now,
      details
    };

    this.latestOrderRecon = report;
    return report;
  }

  public reconcilePosition(
    expected: { symbol: string; side: 'long' | 'short'; qty: number },
    brokerPositions: any[] = []
  ): PositionReconciliationReport {
    const now = new Date().toISOString();
    const cleanExpectedSym = expected.symbol.toUpperCase().replace(/[^A-Z0-9/]/g, '');

    const found = brokerPositions.find(p => {
      const pSym = (p.symbol || '').toUpperCase().replace(/[^A-Z0-9/]/g, '');
      return pSym === cleanExpectedSym || pSym.replace('/', '') === cleanExpectedSym.replace('/', '');
    });

    if (!found) {
      const report: PositionReconciliationReport = {
        reconciled: false,
        status: 'NOT_FOUND',
        expectedPosition: expected,
        timestamp: now,
        details: `Expected position ${cleanExpectedSym} was not found in broker positions list (0 open positions on broker).`
      };
      this.latestPositionRecon = report;
      return report;
    }

    const brokerQty = Math.abs(Number(found.qty || 0));
    const brokerSide: 'long' | 'short' = (found.side || (Number(found.qty) >= 0 ? 'long' : 'short')).toLowerCase() as any;
    const qtyDiff = Math.abs(expected.qty - brokerQty);
    const qtyMatch = qtyDiff < 0.0001 || (qtyDiff / Math.max(expected.qty, 1) < 0.05);

    let status: PositionReconciliationStatus = 'CONFIRMED';
    let details = `Position confirmed by Alpaca broker: ${cleanExpectedSym} ${brokerSide.toUpperCase()} ${brokerQty} units.`;

    if (!qtyMatch || expected.side !== brokerSide) {
      status = 'MISMATCH';
      details = `Position mismatch: Expected [${cleanExpectedSym} ${expected.side} ${expected.qty}] vs Broker [${cleanExpectedSym} ${brokerSide} ${brokerQty}].`;
    }

    const report: PositionReconciliationReport = {
      reconciled: status === 'CONFIRMED',
      status,
      expectedPosition: expected,
      brokerPosition: {
        symbol: cleanExpectedSym,
        qty: brokerQty,
        currentPrice: Number(found.current_price || found.price || 0),
        avgEntryPrice: Number(found.avg_entry_price || found.entryPrice || 0),
        marketValue: Number(found.market_value || 0),
        unrealizedPnL: Number(found.unrealized_pl || found.unrealizedPnL || 0),
        side: brokerSide
      },
      timestamp: now,
      details
    };

    this.latestPositionRecon = report;
    return report;
  }

  public getLatestOrderReconciliation(): OrderReconciliationReport | null {
    return this.latestOrderRecon;
  }

  public getLatestPositionReconciliation(): PositionReconciliationReport | null {
    return this.latestPositionRecon;
  }
}

export const brokerReconciliationEngine = new BrokerReconciliationEngine();
