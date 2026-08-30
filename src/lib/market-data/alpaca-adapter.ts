import { Candle } from '../types';

export class AlpacaDataError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'AlpacaDataError';
  }
}

export interface AlpacaRawBar {
  t: string;  // RFC3339 timestamp
  o: number;  // Open
  h: number;  // High
  l: number;  // Low
  c: number;  // Close
  v: number;  // Volume
  n?: number; // Number of trades
  vw?: number;// Volume-weighted average price
}

export interface AlpacaRawSnapshot {
  latestTrade?: { t: string; p: number; s?: number };
  latestQuote?: { t: string; bp: number; bs?: number; ap: number; as?: number };
  minuteBar?: AlpacaRawBar;
  dailyBar?: AlpacaRawBar;
  prevDailyBar?: AlpacaRawBar;
}

const KNOWN_CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'LINK', 'LTC', 'BCH',
  'AAVE', 'UNI', 'XTZ', 'SUSHI', 'DOT', 'MATIC', 'SHIB', 'ADA',
  'XRP', 'BNB', 'ATOM', 'FIL', 'MKR', 'COMP', 'YFI', 'CRV', 'GRT',
  'NEAR', 'PEPE', 'RENDER', 'ICP', 'APT', 'SUI', 'OP', 'ARB', 'TIA',
  'INJ', 'KAS', 'STX', 'FET', 'RNDR'
]);

export class AlpacaDataAdapter {
  private dataBaseUrl: string;

  constructor() {
    this.dataBaseUrl = (process.env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets').replace(/\/$/, '');
  }

  private getAuthHeaders(): HeadersInit {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    if (!apiKey || !secretKey) {
      throw new AlpacaDataError(
        'Alpaca API credentials missing. Please define ALPACA_API_KEY and ALPACA_SECRET_KEY in your .env file.',
        401
      );
    }

    return {
      'APCA-API-KEY-ID': apiKey.trim(),
      'APCA-API-SECRET-KEY': secretKey.trim(),
      'Accept': 'application/json'
    };
  }

  /**
   * Checks whether a symbol represents cryptocurrency or a stock/equity.
   */
  public isCryptoSymbol(input: string): boolean {
    const clean = input.toUpperCase().replace(/^\$/, '').trim();
    if (clean.includes('/')) return true;
    if (clean.endsWith('USDT') && clean.length >= 7) return true;
    if (clean.endsWith('USD') && clean.length >= 6 && !clean.includes('.')) {
      const base = clean.slice(0, -3);
      if (KNOWN_CRYPTO_SYMBOLS.has(base)) return true;
    }
    return KNOWN_CRYPTO_SYMBOLS.has(clean);
  }

  /**
   * Normalizes symbol into Alpaca Crypto format (e.g. BTC -> BTC/USD).
   */
  public normalizeCryptoSymbol(input: string): string {
    const clean = input.toUpperCase().replace(/^\$/, '').trim();
    if (clean.includes('/')) return clean;
    if (clean.endsWith('USD') && clean.length > 3) {
      const base = clean.slice(0, -3);
      return `${base}/USD`;
    }
    if (clean.endsWith('USDT') && clean.length > 4) {
      const base = clean.slice(0, -4);
      return `${base}/USDT`;
    }
    return `${clean}/USD`;
  }

  /**
   * Normalizes stock ticker symbol (e.g. $AAPL -> AAPL).
   */
  public normalizeStockSymbol(input: string): string {
    return input.toUpperCase().replace(/^\$/, '').trim();
  }

  // ==========================================
  // CRYPTOCURRENCY DATA ENDPOINTS (v1beta3)
  // ==========================================

  /**
   * Fetches historical crypto bars from Alpaca Crypto v1beta3 API.
   * Endpoint: GET /v1beta3/crypto/us/bars
   */
  async fetchCryptoBars(symbol: string, timeframe: string = '1Hour', limit: number = 30): Promise<Candle[]> {
    const pair = this.normalizeCryptoSymbol(symbol);
    const url = `${this.dataBaseUrl}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}&sort=asc`;

    const headers = this.getAuthHeaders();
    let res: Response;
    try {
      res = await fetch(url, { headers, cache: 'no-store' });
    } catch (err: any) {
      throw new AlpacaDataError(`Failed to connect to Alpaca Market Data API: ${err.message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401) {
        throw new AlpacaDataError(
          `Alpaca Market Data authentication failed (HTTP 401 Unauthorized). Please verify that ALPACA_API_KEY and ALPACA_SECRET_KEY in .env are valid.`,
          401
        );
      }
      if (res.status === 404) {
        throw new AlpacaDataError(
          `Asset ${pair} not found on Alpaca Crypto Market Data API (HTTP 404).`,
          404
        );
      }
      throw new AlpacaDataError(
        `Alpaca Data API returned HTTP ${res.status} ${res.statusText}: ${text.substring(0, 200)}`,
        res.status
      );
    }

    const data = await res.json();
    const rawBars: AlpacaRawBar[] = data.bars?.[pair] || [];
    if (rawBars.length === 0) {
      throw new AlpacaDataError(`No historical bars returned from Alpaca for ${pair}.`, 404);
    }

    return rawBars.map((b) => this.mapRawBarToCandle(b));
  }

  /**
   * Fetches latest crypto snapshot from Alpaca Crypto v1beta3 API.
   * Endpoint: GET /v1beta3/crypto/us/snapshots
   */
  async fetchCryptoSnapshot(symbol: string): Promise<AlpacaRawSnapshot | null> {
    const pair = this.normalizeCryptoSymbol(symbol);
    const url = `${this.dataBaseUrl}/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(pair)}`;

    const headers = this.getAuthHeaders();
    let res: Response;
    try {
      res = await fetch(url, { headers, cache: 'no-store' });
    } catch (err: any) {
      throw new AlpacaDataError(`Failed to connect to Alpaca Snapshot API: ${err.message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401) {
        throw new AlpacaDataError(
          `Alpaca Market Data authentication failed (HTTP 401 Unauthorized).`,
          401
        );
      }
      throw new AlpacaDataError(
        `Alpaca Snapshot API returned HTTP ${res.status}: ${text.substring(0, 200)}`,
        res.status
      );
    }

    const data = await res.json();
    return data.snapshots?.[pair] || null;
  }

  // ==========================================
  // STOCK / EQUITY DATA ENDPOINTS (v2)
  // ==========================================

  /**
   * Fetches latest stock snapshot from Alpaca Stock v2 API.
   * Endpoint: GET /v2/stocks/snapshots?symbols=... or GET /v2/stocks/{symbol}/snapshot
   * Returns current price, quotes, minuteBar, dailyBar (Friday's close on weekends), prevDailyBar.
   */
  async fetchStockSnapshot(symbol: string): Promise<AlpacaRawSnapshot | null> {
    const ticker = this.normalizeStockSymbol(symbol);
    const headers = this.getAuthHeaders();
    
    // Multi-symbol snapshot endpoint with feed=iex
    const url = `${this.dataBaseUrl}/v2/stocks/snapshots?symbols=${encodeURIComponent(ticker)}&feed=iex`;
    let res: Response;
    try {
      res = await fetch(url, { headers, cache: 'no-store' });
    } catch (err: any) {
      throw new AlpacaDataError(`Failed to connect to Alpaca Stock Snapshot API: ${err.message}`);
    }

    if (!res.ok) {
      // If 404 or other non-auth failure, try single-symbol endpoint: GET /v2/stocks/{symbol}/snapshot
      if (res.status === 404) {
        const singleUrl = `${this.dataBaseUrl}/v2/stocks/${encodeURIComponent(ticker)}/snapshot?feed=iex`;
        try {
          const singleRes = await fetch(singleUrl, { headers, cache: 'no-store' });
          if (singleRes.ok) {
            const singleData = await singleRes.json();
            return singleData as AlpacaRawSnapshot;
          }
        } catch {
          // Fall through
        }
      }

      if (res.status === 401) {
        throw new AlpacaDataError(
          `Alpaca Market Data authentication failed (HTTP 401 Unauthorized). Please verify that ALPACA_API_KEY and ALPACA_SECRET_KEY in .env are valid.`,
          401
        );
      }
      if (res.status === 404) {
        throw new AlpacaDataError(
          `Stock ticker "${ticker}" not found on Alpaca Stock Market Data API (HTTP 404).`,
          404
        );
      }
      const text = await res.text().catch(() => '');
      throw new AlpacaDataError(
        `Alpaca Stock Snapshot API returned HTTP ${res.status}: ${text.substring(0, 200)}`,
        res.status
      );
    }

    const data = await res.json();
    return data[ticker] || data.snapshots?.[ticker] || data || null;
  }

  /**
   * Fetches historical stock bars from Alpaca Stock v2 API.
   * Uses start timestamp lookback so full historical bar records (1D, 7D, 30D) are retrieved.
   * Endpoint: GET /v2/stocks/bars?symbols=...&timeframe=...&start=...&feed=iex
   */
  async fetchStockBars(symbol: string, timeframe: string = '1Hour', limit: number = 30): Promise<Candle[]> {
    const ticker = this.normalizeStockSymbol(symbol);
    const isDaily = timeframe.toLowerCase().includes('day') || timeframe.toLowerCase() === '1d';
    
    // Set appropriate start date so Alpaca retrieves recorded historical data
    let startParam = '';
    if (isDaily) {
      const daysLookback = Math.max(limit * 2, 60);
      const startStr = new Date(Date.now() - daysLookback * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      startParam = `&start=${encodeURIComponent(startStr)}`;
    } else {
      const startStr = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      startParam = `&start=${encodeURIComponent(startStr)}`;
    }

    const url = `${this.dataBaseUrl}/v2/stocks/bars?symbols=${encodeURIComponent(ticker)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}&sort=asc&feed=iex${startParam}`;

    const headers = this.getAuthHeaders();
    let res: Response;
    try {
      res = await fetch(url, { headers, cache: 'no-store' });
    } catch (err: any) {
      throw new AlpacaDataError(`Failed to connect to Alpaca Stock Bars API: ${err.message}`);
    }

    if (!res.ok) {
      // If multi-symbol bars fails, try single-symbol format: GET /v2/stocks/{symbol}/bars
      if (res.status === 404) {
        const singleUrl = `${this.dataBaseUrl}/v2/stocks/${encodeURIComponent(ticker)}/bars?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}&sort=asc&feed=iex${startParam}`;
        try {
          const singleRes = await fetch(singleUrl, { headers, cache: 'no-store' });
          if (singleRes.ok) {
            const singleData = await singleRes.json();
            const rawBars: AlpacaRawBar[] = singleData.bars || [];
            return rawBars.map((b) => this.mapRawBarToCandle(b));
          }
        } catch {
          // Fall through
        }
      }

      if (res.status === 401) {
        throw new AlpacaDataError(
          `Alpaca Market Data authentication failed (HTTP 401 Unauthorized).`,
          401
        );
      }
      return [];
    }

    const data = await res.json();
    const rawBars: AlpacaRawBar[] = data.bars?.[ticker] || (Array.isArray(data.bars) ? data.bars : []);
    return rawBars.map((b) => this.mapRawBarToCandle(b));
  }

  // ==========================================
  // UNIFIED ADAPTER INTERFACE
  // ==========================================

  async fetchBars(symbol: string, timeframe: string = '1Hour', limit: number = 30): Promise<Candle[]> {
    if (this.isCryptoSymbol(symbol)) {
      return this.fetchCryptoBars(symbol, timeframe, limit);
    }
    return this.fetchStockBars(symbol, timeframe, limit);
  }

  async fetchSnapshot(symbol: string): Promise<AlpacaRawSnapshot | null> {
    if (this.isCryptoSymbol(symbol)) {
      return this.fetchCryptoSnapshot(symbol);
    }
    return this.fetchStockSnapshot(symbol);
  }

  private mapRawBarToCandle(b: AlpacaRawBar): Candle {
    const epoch = new Date(b.t).getTime();
    return {
      timestamp: epoch,
      isoString: b.t,
      dateStr: new Date(b.t).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      open: Number(b.o),
      high: Number(b.h),
      low: Number(b.l),
      close: Number(b.c),
      volume: Number(b.v),
      tradesCount: b.n,
      vwap: b.vw
    };
  }
}

export const alpacaDataAdapter = new AlpacaDataAdapter();
export const alpacaCryptoDataAdapter = alpacaDataAdapter;
