import { RuntimeAnomalyReport } from './durable-types';
import { durableSessionJournal } from './durable-journal';

// ---------------------------------------------------------------------------
// Phase 8.12: Deterministic Runtime Anomaly Detector
// INVARIANT: Purely diagnostic and safety-oriented.
// INVARIANT: Never mutates strategy parameters or bypasses risk controls.
// ---------------------------------------------------------------------------

export interface AnomalyCheckContext {
  orderSubmissions?: Array<{ clientOrderId?: string; orderId?: string; symbol: string; qty: number; timestamp: string }>;
  activeCycles?: string[];
  positions?: Array<{ symbol: string; qty: number }>;
  fills?: Array<{ orderId: string; tradeId?: string; symbol: string; qty: number; price: number }>;
  decisions?: Array<{ tradeId: string; symbol: string; timestamp: string }>;
}

export function detectRuntimeAnomalies(ctx: AnomalyCheckContext): RuntimeAnomalyReport[] {
  const detected: RuntimeAnomalyReport[] = [];

  // 1. Duplicate Order Intent Detection
  if (ctx.orderSubmissions) {
    const seen = new Set<string>();
    for (const ord of ctx.orderSubmissions) {
      const key = `${ord.symbol}-${ord.qty}-${ord.clientOrderId || ''}`;
      if (seen.has(key)) {
        detected.push(durableSessionJournal.recordAnomaly({
          anomalyType: 'DUPLICATE_ORDER',
          severity: 'CRITICAL',
          details: `Duplicate order submission detected for ${ord.symbol} (qty: ${ord.qty}, clientOrderId: ${ord.clientOrderId}).`,
          metadata: ord
        }));
      }
      seen.add(key);
    }
  }

  // 2. Overlapping Cycles Detection
  if (ctx.activeCycles && ctx.activeCycles.length > 1) {
    detected.push(durableSessionJournal.recordAnomaly({
      anomalyType: 'DUPLICATE_CYCLE',
      severity: 'CRITICAL',
      details: `Multiple overlapping cycles active simultaneously: ${ctx.activeCycles.join(', ')}.`
    }));
  }

  // 3. Price & Quantity Validation on Fills
  if (ctx.fills) {
    for (const fill of ctx.fills) {
      if (fill.qty <= 0 || !Number.isFinite(fill.qty)) {
        detected.push(durableSessionJournal.recordAnomaly({
          anomalyType: 'IMPOSSIBLE_QUANTITY',
          severity: 'CRITICAL',
          details: `Fill with invalid quantity detected: ${fill.qty} for ${fill.symbol}.`,
          metadata: fill
        }));
      }
      if (fill.price <= 0 || !Number.isFinite(fill.price)) {
        detected.push(durableSessionJournal.recordAnomaly({
          anomalyType: 'IMPOSSIBLE_PRICE',
          severity: 'CRITICAL',
          details: `Fill with invalid price detected: $${fill.price} for ${fill.symbol}.`,
          metadata: fill
        }));
      }
      if (!fill.tradeId) {
        detected.push(durableSessionJournal.recordAnomaly({
          anomalyType: 'FILL_WITHOUT_INTENT',
          severity: 'WARNING',
          details: `Broker fill for ${fill.symbol} (order ${fill.orderId}) has no matching local trade intent.`,
          metadata: fill
        }));
      }
    }
  }

  return detected;
}
