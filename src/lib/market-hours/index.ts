/**
 * Market Hours Utility
 *
 * Crypto assets (BTC, ETH, SOL, etc.) trade 24/7 — no restriction applied.
 * Traditional US equities trade Mon–Fri, 9:30 AM – 4:00 PM Eastern Time.
 * This module checks market availability before any data fetch is attempted.
 */

/** Known crypto asset symbols that trade 24/7 on Alpaca. */
const CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'LINK', 'LTC', 'BCH',
  'AAVE', 'UNI', 'XTZ', 'SUSHI', 'DOT', 'MATIC', 'SHIB', 'ADA',
  'XRP', 'BNB', 'ATOM', 'FIL', 'MKR', 'COMP', 'YFI', 'CRV', 'GRT'
]);

export interface MarketHoursResult {
  isOpen: boolean;
  assetType: 'crypto' | 'equity';
  reason?: string;
}

/**
 * Returns the current time in US Eastern Time (handles DST automatically).
 */
function getNowInET(): Date {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

/**
 * Determines whether the market for the given asset is open right now.
 *
 * @param symbol  Raw asset ticker, e.g. "BTC", "$ETH", "AAPL"
 */
export function checkMarketHours(symbol: string): MarketHoursResult {
  const clean = symbol.toUpperCase().replace(/^\$/, '').replace(/\/.*$/, '').trim();

  // Crypto is always open
  if (CRYPTO_SYMBOLS.has(clean)) {
    return { isOpen: true, assetType: 'crypto' };
  }

  // US equity market hours check
  const etNow = getNowInET();
  const dayOfWeek = etNow.getDay(); // 0 = Sunday, 6 = Saturday
  const hour   = etNow.getHours();
  const minute = etNow.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  const MARKET_OPEN  = 9 * 60 + 30;  // 9:30 AM ET
  const MARKET_CLOSE = 16 * 60;       // 4:00 PM ET

  if (dayOfWeek === 0 /* Sunday */ || dayOfWeek === 6 /* Saturday */) {
    const dayName = dayOfWeek === 6 ? 'Saturday' : 'Sunday';
    const nextOpenDay = dayOfWeek === 6 ? 'Monday' : 'Monday'; // both lead to Monday
    return {
      isOpen: false,
      assetType: 'equity',
      reason:
        `The US stock market is closed for the weekend (today is ${dayName} ET). ` +
        `${clean} trades on US exchanges which are open Mon–Fri, 9:30 AM – 4:00 PM Eastern Time. ` +
        `Market reopens ${nextOpenDay} at 9:30 AM ET.`
    };
  }

  if (timeInMinutes < MARKET_OPEN) {
    const openHour = Math.floor(MARKET_OPEN / 60);
    const openMin  = String(MARKET_OPEN % 60).padStart(2, '0');
    return {
      isOpen: false,
      assetType: 'equity',
      reason:
        `The US stock market has not yet opened. ` +
        `${clean} trades on US exchanges which open at ${openHour}:${openMin} AM ET. ` +
        `Current time: ${etNow.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })} ET.`
    };
  }

  if (timeInMinutes >= MARKET_CLOSE) {
    return {
      isOpen: false,
      assetType: 'equity',
      reason:
        `The US stock market is closed for today. ` +
        `${clean} trades on US exchanges which close at 4:00 PM ET. ` +
        `Current time: ${etNow.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })} ET. ` +
        `Market reopens tomorrow at 9:30 AM ET (or Monday if today is Friday).`
    };
  }

  return { isOpen: true, assetType: 'equity' };
}
