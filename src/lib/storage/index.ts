import { Investigation, TradeThesis, Position } from '../types';

class MemoryStorage {
  private investigations: Map<string, Investigation> = new Map();
  private theses: Map<string, TradeThesis> = new Map();
  private positions: Map<string, Position> = new Map();

  saveInvestigation(inv: Investigation): void {
    this.investigations.set(inv.id, inv);
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
  }

  getThesis(id: string): TradeThesis | undefined {
    return this.theses.get(id);
  }

  savePosition(pos: Position): void {
    this.positions.set(pos.id, pos);
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
