// ---------------------------------------------------------------------------
// Phase 8.16: Broker API Diagnostics Subsystem
// Bounded in-memory telemetry buffer tracking broker API interactions.
// INVARIANT: All credentials and account numbers are strictly sanitized/masked.
// INVARIANT: Real Paper and Simulation modes are distinctly tagged.
// ---------------------------------------------------------------------------

import { OrderReconciliationReport, PositionReconciliationReport, brokerReconciliationEngine } from './reconciliation';

export type DiagnosticMode = 'REAL_PAPER' | 'SIMULATION';
export type EndpointCategory = 'ACCOUNT' | 'POSITIONS' | 'ORDERS' | 'CLOCK' | 'MARKET_DATA' | 'OTHER';

export interface BrokerDiagnosticRecord {
  id: string;
  correlationId?: string;
  cycleId?: string;
  timestamp: string;
  mode: DiagnosticMode;
  provider: 'Alpaca' | 'SimulationLab';
  endpointCategory: EndpointCategory;
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  sanitizedUrl: string;
  latencyMs: number;
  httpStatus: number;
  success: boolean;
  sanitizedRequest?: any;
  sanitizedResponse?: any;
  brokerOrderId?: string;
  reconciliationStatus?: 'MATCHED' | 'DISCREPANCY' | 'PENDING' | 'N/A';
  errorDetails?: string;
}

export interface BrokerDiagnosticsSummary {
  provider: 'Alpaca' | 'SimulationLab';
  environment: 'PAPER' | 'SIMULATION';
  status: 'CONNECTED' | 'DEGRADED' | 'ERROR' | 'SIMULATION';
  maskedAccountId?: string;
  lastLatencyMs: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  recentActivity: BrokerDiagnosticRecord[];
  orderReconciliation?: OrderReconciliationReport | null;
  positionReconciliation?: PositionReconciliationReport | null;
  generatedAt: string;
}

export class BrokerDiagnosticsBuffer {
  private buffer: BrokerDiagnosticRecord[] = [];
  private readonly maxCapacity: number;
  private maskedAccount: string = 'PA3T2D***';
  private lastLatency: number = 0;
  private totalReqs: number = 0;
  private successReqs: number = 0;
  private failReqs: number = 0;

  constructor(maxCapacity: number = 200) {
    this.maxCapacity = maxCapacity;
  }

  public setMaskedAccount(accountId?: string): void {
    if (!accountId) return;
    if (accountId.length > 6) {
      this.maskedAccount = `${accountId.substring(0, 6)}***`;
    } else {
      this.maskedAccount = 'PA3T2D***';
    }
  }

  public record(record: Omit<BrokerDiagnosticRecord, 'id' | 'timestamp'>): BrokerDiagnosticRecord {
    this.totalReqs++;
    if (record.success) {
      this.successReqs++;
    } else {
      this.failReqs++;
    }
    this.lastLatency = record.latencyMs;

    const fullRecord: BrokerDiagnosticRecord = {
      id: `DIAG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      ...record,
      sanitizedRequest: this.sanitizePayload(record.sanitizedRequest),
      sanitizedResponse: this.sanitizePayload(record.sanitizedResponse)
    };

    this.buffer.unshift(fullRecord);
    if (this.buffer.length > this.maxCapacity) {
      this.buffer = this.buffer.slice(0, this.maxCapacity);
    }

    return fullRecord;
  }

  public getSummary(limit: number = 50): BrokerDiagnosticsSummary {
    let status: 'CONNECTED' | 'DEGRADED' | 'ERROR' | 'SIMULATION' = 'CONNECTED';
    if (this.failReqs > 0 && this.successReqs === 0) {
      status = 'ERROR';
    } else if (this.failReqs > 0 && this.successReqs > 0 && (this.failReqs / this.totalReqs) > 0.2) {
      status = 'DEGRADED';
    }

    return {
      provider: 'Alpaca',
      environment: 'PAPER',
      status,
      maskedAccountId: this.maskedAccount,
      lastLatencyMs: this.lastLatency,
      totalRequests: this.totalReqs,
      successfulRequests: this.successReqs,
      failedRequests: this.failReqs,
      recentActivity: this.buffer.slice(0, limit),
      orderReconciliation: brokerReconciliationEngine.getLatestOrderReconciliation(),
      positionReconciliation: brokerReconciliationEngine.getLatestPositionReconciliation(),
      generatedAt: new Date().toISOString()
    };
  }

  public clear(): void {
    this.buffer = [];
    this.totalReqs = 0;
    this.successReqs = 0;
    this.failReqs = 0;
    this.lastLatency = 0;
  }

  private sanitizePayload(payload: any): any {
    if (!payload) return payload;
    if (typeof payload !== 'object') return payload;

    if (Array.isArray(payload)) {
      return payload.map(item => this.sanitizePayload(item));
    }

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = new Set([
      'apikey', 'api_key', 'secret', 'secret_key', 'authorization', 'token',
      'apca-api-key-id', 'apca-api-secret-key', 'password', 'private_key'
    ]);

    for (const [k, v] of Object.entries(payload)) {
      const lowerK = k.toLowerCase();
      if (sensitiveKeys.has(lowerK)) {
        sanitized[k] = '***REDACTED***';
      } else if (lowerK === 'account_number' || lowerK === 'accountid' || lowerK === 'id' && typeof v === 'string' && v.startsWith('PA')) {
        sanitized[k] = typeof v === 'string' && v.length > 6 ? `${v.substring(0, 6)}***` : '***MASKED***';
      } else if (typeof v === 'object' && v !== null) {
        sanitized[k] = this.sanitizePayload(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }
}

const g = globalThis as any;
if (!g.__BROKER_DIAGNOSTICS__) {
  g.__BROKER_DIAGNOSTICS__ = new BrokerDiagnosticsBuffer(200);
}

export const brokerDiagnostics: BrokerDiagnosticsBuffer = g.__BROKER_DIAGNOSTICS__;

