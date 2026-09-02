import { TelemetryEvent, TelemetryEventType } from './types';
import { sanitizeErrorMessage } from '../errors';

// ---------------------------------------------------------------------------
// Phase 8.6: Durable Telemetry & Decision Journal
// INVARIANT: Machine-readable event ledger for full decision explainability.
// INVARIANT: Zero credential/secret storage. All data is sanitized before saving.
// ---------------------------------------------------------------------------

export class TelemetryJournal {
  private events: TelemetryEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 2000) {
    this.maxHistory = maxHistory;
  }

  /**
   * Sanitizes payload objects to ensure no API keys or secrets are logged.
   */
  private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) return undefined;
    try {
      const copy: Record<string, any> = {};
      for (const [key, value] of Object.entries(details)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('key') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('auth') ||
          lowerKey.includes('password')
        ) {
          copy[key] = '[REDACTED_SECRET]';
        } else if (typeof value === 'string') {
          copy[key] = sanitizeErrorMessage(value);
        } else if (typeof value === 'object' && value !== null) {
          copy[key] = this.sanitizeDetails(value);
        } else {
          copy[key] = value;
        }
      }
      return copy;
    } catch {
      return { sanitized: true };
    }
  }

  /**
   * Records a new telemetry event.
   */
  record(
    cycleId: string,
    type: TelemetryEventType,
    message: string,
    options?: { symbol?: string; details?: Record<string, any> }
  ): TelemetryEvent {
    const timestamp = new Date().toISOString();
    const event: TelemetryEvent = {
      id: `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(this.events.length + 1)}`,
      cycleId,
      timestamp,
      type,
      symbol: options?.symbol,
      message: sanitizeErrorMessage(message),
      details: this.sanitizeDetails(options?.details)
    };

    this.events.push(event);

    // Keep memory bounded
    if (this.events.length > this.maxHistory) {
      this.events = this.events.slice(-this.maxHistory);
    }

    return event;
  }

  /**
   * Retrieves all events for a given cycle.
   */
  getEventsByCycle(cycleId: string): TelemetryEvent[] {
    return this.events.filter(e => e.cycleId === cycleId);
  }

  /**
   * Retrieves all events related to a specific symbol.
   */
  getEventsBySymbol(symbol: string): TelemetryEvent[] {
    const clean = symbol.toUpperCase().replace(/^\$/, '').trim();
    return this.events.filter(e => e.symbol === clean);
  }

  /**
   * Retrieves recent events.
   */
  getRecentEvents(limit: number = 100): TelemetryEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clears in-memory journal events (for tests / restart).
   */
  clear(): void {
    this.events = [];
  }
}

export const telemetryJournal = new TelemetryJournal();
