import fs from 'fs';
import path from 'path';
import { Investigation, TradeThesis, Position } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const JOURNAL_FILE = path.join(DATA_DIR, 'journal.json');

class MemoryStorage {
  private investigations: Map<string, Investigation> = new Map();
  private theses: Map<string, TradeThesis> = new Map();
  private positions: Map<string, Position> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (typeof window === 'undefined' && fs.existsSync(JOURNAL_FILE)) {
        const raw = fs.readFileSync(JOURNAL_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data.investigations && Array.isArray(data.investigations)) {
          data.investigations.forEach((inv: Investigation) => this.investigations.set(inv.id, inv));
        }
        if (data.theses && Array.isArray(data.theses)) {
          data.theses.forEach((th: TradeThesis) => this.theses.set(th.id, th));
        }
        if (data.positions && Array.isArray(data.positions)) {
          data.positions.forEach((pos: Position) => this.positions.set(pos.id, pos));
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }

  private persistToDisk(): void {
    try {
      if (typeof window === 'undefined') {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const payload = {
          investigations: Array.from(this.investigations.values()),
          theses: Array.from(this.theses.values()),
          positions: Array.from(this.positions.values()),
          updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(payload, null, 2), 'utf-8');
      }
    } catch {
      // Non-blocking fallback
    }
  }

  saveInvestigation(inv: Investigation): void {
    this.investigations.set(inv.id, inv);
    this.persistToDisk();
  }

  getInvestigation(id: string): Investigation | undefined {
    return this.investigations.get(id);
  }

  getAllInvestigations(): Investigation[] {
    return Array.from(this.investigations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  saveThesis(thesis: TradeThesis): void {
    this.theses.set(thesis.id, thesis);
    this.persistToDisk();
  }

  getThesis(id: string): TradeThesis | undefined {
    return this.theses.get(id);
  }

  savePosition(pos: Position): void {
    this.positions.set(pos.id, pos);
    this.persistToDisk();
  }

  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getPositionByAsset(symbol: string): Position | undefined {
    const clean = symbol.toUpperCase().replace('$', '');
    return Array.from(this.positions.values()).find(
      p => p.symbol === clean && p.status === 'OPEN'
    );
  }
}

export const storage = new MemoryStorage();
