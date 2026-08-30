import { AlpacaAccount, AlpacaOrder, Position } from '../types';

let mockAccount: AlpacaAccount = {
  id: 'alpaca-acc-paper-001',
  accountNumber: 'PA-294810239',
  status: 'ACTIVE',
  currency: 'USD',
  buyingPower: 98450.00,
  cash: 98450.00,
  portfolioValue: 100000.00,
  patternDayTrader: false,
  tradingBlocked: false
};

const mockOrders: AlpacaOrder[] = [];
const mockPositions: Position[] = [];

/**
 * Alpaca Paper Trading Service Adapter.
 * Encapsulates execution behind an audited trading interface.
 */
export class AlpacaTradingService {
  private apiKey: string;
  private secretKey: string;
  private isPaper: boolean;

  constructor() {
    this.apiKey = process.env.ALPACA_API_KEY || 'MOCK_ALPACA_KEY';
    this.secretKey = process.env.ALPACA_SECRET_KEY || 'MOCK_ALPACA_SECRET';
    this.isPaper = true;
  }

  async getAccount(): Promise<AlpacaAccount> {
    return { ...mockAccount };
  }

  async getPositions(): Promise<Position[]> {
    return [...mockPositions];
  }

  async getOrders(): Promise<AlpacaOrder[]> {
    return [...mockOrders];
  }

  async submitPaperOrder(
    symbol: string,
    qty: number,
    side: 'buy' | 'sell',
    price: number
  ): Promise<AlpacaOrder> {
    const orderId = `alp-ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const order: AlpacaOrder = {
      id: orderId,
      clientOrderId: `cl-${orderId}`,
      symbol: symbol.toUpperCase(),
      qty,
      side,
      type: 'market',
      status: 'filled',
      filledAvgPrice: price,
      submittedAt: new Date().toISOString()
    };

    mockOrders.unshift(order);

    if (side === 'buy') {
      const cost = qty * price;
      mockAccount.cash -= cost;
      mockAccount.buyingPower -= cost;

      const existingPos = mockPositions.find(p => p.symbol === symbol.toUpperCase() && p.status === 'OPEN');
      if (existingPos) {
        existingPos.quantity += qty;
        existingPos.currentPrice = price;
      }
    } else if (side === 'sell') {
      const revenue = qty * price;
      mockAccount.cash += revenue;
      mockAccount.buyingPower += revenue;

      const existingPosIndex = mockPositions.findIndex(p => p.symbol === symbol.toUpperCase() && p.status === 'OPEN');
      if (existingPosIndex !== -1) {
        mockPositions[existingPosIndex].status = 'CLOSED';
      }
    }

    return order;
  }
}

export const alpacaService = new AlpacaTradingService();
