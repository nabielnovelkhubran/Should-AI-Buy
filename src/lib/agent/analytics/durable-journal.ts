import fs from 'fs';
import path from 'path';
import {
  RuntimeEventType,
  RuntimeJournalEvent,
  FrozenDecisionSnapshot,
  PersistentTradeEvidence,
  WorkerHeartbeatTelemetry,
  RuntimeAnomalyReport,
  DurableSessionRecord
} from './durable-types';
import { validateTradeLineage } from './lineage-validator';
import { getTradingEnvironmentConfig } from '../../environment';

// ---------------------------------------------------------------------------
// Phase 8.12: Durable Session Journal & Audit Storage
// INVARIANT: All broker executions and cycle events are immutably recorded.
// INVARIANT: Zero credential or private key storage. Scrubbed at boundary.
// INVARIANT: Failure isolation — file write error never crashes trading engine.
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve('data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const EVENTS_DIR = path.join(DATA_DIR, 'events');
const TRADES_DIR = path.join(DATA_DIR, 'trades');

function ensureDirectories(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    if (!fs.existsSync(EVENTS_DIR)) fs.mkdirSync(EVENTS_DIR, { recursive: true });
    if (!fs.existsSync(TRADES_DIR)) fs.mkdirSync(TRADES_DIR, { recursive: true });
  } catch {
    // Failure isolated
  }
}

function sanitizePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  const sanitized: Record<string, any> = Array.isArray(payload) ? [] : {};
  for (const [k, v] of Object.entries(payload)) {
    const lk = k.toLowerCase();
    if (lk.includes('key') || lk.includes('secret') || lk.includes('token') || lk.includes('auth') || lk.includes('password')) {
      sanitized[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitizePayload(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export class DurableSessionJournal {
  private activeSession: DurableSessionRecord;
  private inMemoryEvents: RuntimeJournalEvent[] = [];
  private frozenDecisions: Map<string, FrozenDecisionSnapshot> = new Map();
  private persistentTrades: Map<string, PersistentTradeEvidence> = new Map();
  private anomalies: RuntimeAnomalyReport[] = [];
  private heartbeat: WorkerHeartbeatTelemetry;
  private seqCounter: number = 0;
  private readonly maxInMemoryEvents: number = 1000;

  constructor() {
    ensureDirectories();
    const now = new Date().toISOString();
    const envConfig = getTradingEnvironmentConfig();

    const sessionId = `SESSION-${Date.now().toString(36).toUpperCase()}`;

    this.activeSession = {
      sessionId,
      environment: envConfig.environment,
      startedAt: now,
      startingEquity: envConfig.targetStartingEquity || 100000,
      startingCash: envConfig.targetStartingEquity || 100000,
      cyclesRun: 0,
      cyclesSucceeded: 0,
      cyclesFailed: 0,
      candidatesScanned: 0,
      candidatesRejected: 0,
      tradeIntents: 0,
      ordersSubmitted: 0,
      ordersFilled: 0,
      ordersRejected: 0,
      completedTrades: 0,
      openTrades: 0,
      grossPnL: 0,
      totalR: 0,
      maxDrawdownPct: 0,
      consecutiveFailures: 0,
      circuitBreakerTrips: 0,
      evidenceIntegrityFailures: 0,
      runtimeErrors: 0,
      evidenceQuality: 'INSUFFICIENT',
      status: 'ACTIVE'
    };

    this.heartbeat = {
      workerStatus: 'STOPPED',
      lastHeartbeat: now,
      lastCycleStarted: null,
      lastCycleCompleted: null,
      lastSuccessfulCycle: null,
      lastBrokerSync: null,
      lastMarketDataUpdate: null,
      lastOrderEvent: null,
      consecutiveFailures: 0,
      circuitBreakerActive: false
    };

    this.recordEvent('SESSION_STARTED', {
      startingEquity: this.activeSession.startingEquity,
      environment: this.activeSession.environment
    });
  }

  public getSessionId(): string {
    return this.activeSession.sessionId;
  }

  public getSessionRecord(): DurableSessionRecord {
    return { ...this.activeSession };
  }

  public recordEvent(
    type: RuntimeEventType,
    payload: Record<string, any> = {},
    context?: { cycleId?: string; tradeId?: string; orderId?: string; symbol?: string }
  ): RuntimeJournalEvent {
    this.seqCounter++;
    const now = new Date().toISOString();
    const cleanPayload = sanitizePayload(payload);

    const event: RuntimeJournalEvent = {
      eventId: `EVT-${Date.now().toString(36).toUpperCase()}-${this.seqCounter}`,
      sessionId: this.activeSession.sessionId,
      timestamp: now,
      type,
      cycleId: context?.cycleId,
      tradeId: context?.tradeId,
      orderId: context?.orderId,
      symbol: context?.symbol?.toUpperCase(),
      payload: cleanPayload
    };

    this.inMemoryEvents.push(event);
    if (this.inMemoryEvents.length > this.maxInMemoryEvents) {
      this.inMemoryEvents.shift();
    }

    // Update Session Metrics Counters
    if (type === 'CYCLE_COMPLETED') this.activeSession.cyclesSucceeded++;
    if (type === 'CYCLE_FAILED') this.activeSession.cyclesFailed++;
    if (type === 'CANDIDATE_REJECTED') this.activeSession.candidatesRejected++;
    if (type === 'ORDER_INTENT_CREATED') this.activeSession.tradeIntents++;
    if (type === 'ORDER_SUBMITTED') this.activeSession.ordersSubmitted++;
    if (type === 'ORDER_FILLED') this.activeSession.ordersFilled++;
    if (type === 'ORDER_REJECTED') this.activeSession.ordersRejected++;
    if (type === 'TRADE_CLOSED') this.activeSession.completedTrades++;
    if (type === 'CIRCUIT_BREAKER_TRIPPED') this.activeSession.circuitBreakerTrips++;
    if (type === 'EVIDENCE_INTEGRITY_FAILURE') this.activeSession.evidenceIntegrityFailures++;
    if (type === 'RUNTIME_ERROR') this.activeSession.runtimeErrors++;

    // Async append to JSONL event file
    this.persistEventToFile(event);
    return event;
  }

  public recordFrozenDecision(tradeId: string, snapshot: FrozenDecisionSnapshot): void {
    if (this.frozenDecisions.has(tradeId)) return; // Strictly frozen — immutable
    this.frozenDecisions.set(tradeId, Object.freeze({ ...snapshot }));
  }

  public getFrozenDecision(tradeId: string): FrozenDecisionSnapshot | undefined {
    return this.frozenDecisions.get(tradeId);
  }

  public recordTradeEvidence(evidence: PersistentTradeEvidence): PersistentTradeEvidence {
    const validation = validateTradeLineage(evidence);
    evidence.lineageValid = validation.valid;
    evidence.lineageErrors = validation.errors;

    if (!validation.valid) {
      this.recordEvent('EVIDENCE_INTEGRITY_FAILURE', {
        tradeId: evidence.tradeId,
        errors: validation.errors
      }, { tradeId: evidence.tradeId, symbol: evidence.symbol });
    }

    this.persistentTrades.set(evidence.tradeId, evidence);
    this.persistTradeToFile(evidence);
    return evidence;
  }

  public getTradeEvidence(tradeId: string): PersistentTradeEvidence | undefined {
    return this.persistentTrades.get(tradeId);
  }

  public getAllTradeEvidence(): PersistentTradeEvidence[] {
    return Array.from(this.persistentTrades.values());
  }

  public getRecentEvents(limit: number = 50): RuntimeJournalEvent[] {
    return this.inMemoryEvents.slice(-limit);
  }

  public updateHeartbeat(patch: Partial<WorkerHeartbeatTelemetry>): WorkerHeartbeatTelemetry {
    this.heartbeat = {
      ...this.heartbeat,
      ...patch,
      lastHeartbeat: new Date().toISOString()
    };
    return { ...this.heartbeat };
  }

  public getHeartbeat(): WorkerHeartbeatTelemetry {
    return { ...this.heartbeat };
  }

  public recordAnomaly(anomaly: Omit<RuntimeAnomalyReport, 'id' | 'timestamp'>): RuntimeAnomalyReport {
    const report: RuntimeAnomalyReport = {
      id: `ANOMALY-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      ...anomaly
    };
    this.anomalies.push(report);
    if (this.anomalies.length > 200) this.anomalies.shift();

    this.recordEvent('EVIDENCE_INTEGRITY_FAILURE', {
      anomalyType: report.anomalyType,
      details: report.details
    });

    return report;
  }

  public getAnomalies(limit: number = 30): RuntimeAnomalyReport[] {
    return this.anomalies.slice(-limit);
  }

  public endSession(finalValues?: { endingEquity?: number; endingCash?: number }): DurableSessionRecord {
    const now = new Date().toISOString();
    this.activeSession.endedAt = now;
    this.activeSession.status = 'CONCLUDED';
    if (finalValues?.endingEquity !== undefined) this.activeSession.endingEquity = finalValues.endingEquity;
    if (finalValues?.endingCash !== undefined) this.activeSession.endingCash = finalValues.endingCash;

    this.recordEvent('SESSION_ENDED', {
      endingEquity: this.activeSession.endingEquity,
      cyclesRun: this.activeSession.cyclesRun,
      completedTrades: this.activeSession.completedTrades
    });

    this.saveSessionToFile();
    return { ...this.activeSession };
  }

  private persistEventToFile(event: RuntimeJournalEvent): void {
    try {
      const eventFile = path.join(EVENTS_DIR, `${this.activeSession.sessionId}.jsonl`);
      fs.appendFileSync(eventFile, JSON.stringify(event) + '\n', 'utf8');
    } catch {
      // Failure isolated
    }
  }

  private persistTradeToFile(trade: PersistentTradeEvidence): void {
    try {
      const tradeFile = path.join(TRADES_DIR, `${trade.tradeId}.json`);
      fs.writeFileSync(tradeFile, JSON.stringify(trade, null, 2), 'utf8');
    } catch {
      // Failure isolated
    }
  }

  private saveSessionToFile(): void {
    try {
      const sessionFile = path.join(SESSIONS_DIR, `${this.activeSession.sessionId}.json`);
      fs.writeFileSync(sessionFile, JSON.stringify(this.activeSession, null, 2), 'utf8');
    } catch {
      // Failure isolated
    }
  }
}

export const durableSessionJournal = new DurableSessionJournal();
