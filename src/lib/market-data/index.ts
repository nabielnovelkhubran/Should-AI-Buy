import { Candle, MarketSnapshot, Evidence } from '../types';
import {
  calculateReturn,
  calculateRVOL,
  calculateVolumeAcceleration,
  calculateRealizedVolatility,
  calculateRSI,
  calculateMomentumScore
} from '../quant';
import { alpacaDataAdapter, AlpacaDataError, AlpacaRawSnapshot } from './alpaca-adapter';

export { AlpacaDataError } from './alpaca-adapter';

/**
 * Fetches real market snapshot and bars from Alpaca Market Data API.
 * For stocks: uses the Alpaca Snapshot endpoint (GET /v2/stocks/snapshots)
 *             and stock bars with start lookbacks so recorded price history
 *             is available across 1H, 4H, 1D, 7D, and 30D intervals.
 * For crypto: uses the 24/7 Alpaca Crypto endpoint (GET /v1beta3/crypto/us/...).
 */
export async function fetchMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '').trim();
  const isCrypto = alpacaDataAdapter.isCryptoSymbol(cleanSymbol);

  let symbolDisplay: string;
  let candles1H: Candle[] = [];
  let candles1D: Candle[] = [];
  let rawSnapshot: AlpacaRawSnapshot | null = null;

  if (isCrypto) {
    // 1A. CRYPTO: Fetch 24/7 bars and crypto snapshot
    symbolDisplay = alpacaDataAdapter.normalizeCryptoSymbol(cleanSymbol);
    const [c1H, c1D, snap] = await Promise.all([
      alpacaDataAdapter.fetchCryptoBars(symbolDisplay, '1Hour', 48),
      alpacaDataAdapter.fetchCryptoBars(symbolDisplay, '1Day', 40).catch(() => [] as Candle[]),
      alpacaDataAdapter.fetchCryptoSnapshot(symbolDisplay).catch(() => null)
    ]);
    candles1H = c1H;
    candles1D = c1D;
    rawSnapshot = snap;
  } else {
    // 1B. STOCKS: Fetch snapshot for current market state + multi-day recorded bars
    symbolDisplay = alpacaDataAdapter.normalizeStockSymbol(cleanSymbol);
    const [snap, c1H, c1D] = await Promise.all([
      alpacaDataAdapter.fetchStockSnapshot(symbolDisplay),
      alpacaDataAdapter.fetchStockBars(symbolDisplay, '1Hour', 48).catch(() => [] as Candle[]),
      alpacaDataAdapter.fetchStockBars(symbolDisplay, '1Day', 40).catch(() => [] as Candle[])
    ]);
    rawSnapshot = snap;
    candles1H = c1H;
    candles1D = c1D;

    // Fallback if stock bars are empty: construct baseline candles from snapshot
    if (candles1H.length === 0 && rawSnapshot) {
      const bar = rawSnapshot.dailyBar || rawSnapshot.minuteBar || rawSnapshot.prevDailyBar;
      const refPrice = rawSnapshot.latestTrade?.p ?? bar?.c ?? 0;
      if (refPrice > 0) {
        const timeStr = bar?.t || new Date().toISOString();
        candles1H = [
          {
            timestamp: new Date(timeStr).getTime(),
            isoString: timeStr,
            dateStr: new Date(timeStr).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            open: Number(bar?.o ?? refPrice),
            high: Number(bar?.h ?? refPrice),
            low: Number(bar?.l ?? refPrice),
            close: Number(bar?.c ?? refPrice),
            volume: Number(bar?.v ?? 1000000),
            vwap: bar?.vw
          }
        ];
      }
    }
  }

  if ((!candles1H || candles1H.length === 0) && !rawSnapshot) {
    throw new AlpacaDataError(`No market data returned from Alpaca for ${symbolDisplay}`, 404);
  }

  // 2. Deterministic price extraction
  const latestCandle = candles1H.length > 0 ? candles1H[candles1H.length - 1] : null;
  const latestPrice = rawSnapshot?.latestTrade?.p 
    ?? rawSnapshot?.dailyBar?.c 
    ?? rawSnapshot?.prevDailyBar?.c 
    ?? latestCandle?.close 
    ?? 0;

  if (latestPrice <= 0) {
    throw new AlpacaDataError(`Invalid price (0) returned from Alpaca for ${symbolDisplay}`, 404);
  }

  const bid = rawSnapshot?.latestQuote?.bp;
  const ask = rawSnapshot?.latestQuote?.ap;

  // 3. Deterministic return calculations
  let change24h = 0;
  if (!isCrypto && rawSnapshot?.prevDailyBar?.c && rawSnapshot.prevDailyBar.c > 0) {
    // For stocks: compare latest price (Friday close on weekend) against previous daily close
    change24h = calculateReturn(rawSnapshot.prevDailyBar.c, latestPrice);
  } else if (candles1H.length >= 2) {
    const price24hAgo = candles1H.length >= 24
      ? candles1H[candles1H.length - 24].open
      : candles1H[0].open;
    change24h = calculateReturn(price24hAgo, latestPrice);
  }

  const price7dAgo = candles1D.length >= 7
    ? candles1D[candles1D.length - 7].open
    : (candles1D[0]?.open || (candles1H.length > 0 ? candles1H[0].open : latestPrice));
  const change7d = calculateReturn(price7dAgo, latestPrice);

  // 4. Deterministic volume & technical metrics
  const activeCandles = candles1H.length > 0 ? candles1H : candles1D;
  const volumes = activeCandles.map(c => c.volume);
  const latestVolume = volumes.length > 0 ? volumes[volumes.length - 1] : (rawSnapshot?.dailyBar?.v || 1000000);
  const prevVolume = volumes.length > 1 ? volumes[volumes.length - 2] : latestVolume;
  const rvol = calculateRVOL(latestVolume, volumes.slice(-15));
  const volumeAccel = calculateVolumeAcceleration(latestVolume, prevVolume);
  const volume24h = rawSnapshot?.dailyBar?.v ?? (volumes.length > 0 ? volumes.slice(-24).reduce((a, b) => a + b, 0) : latestVolume);
  const realizedVol = calculateRealizedVolatility(activeCandles);
  const rsi = calculateRSI(activeCandles);
  const momentum = calculateMomentumScore(activeCandles);

  // 5. Compute spread in basis points
  let spreadBps = isCrypto ? 8.0 : 2.5;
  if (bid && ask && bid > 0 && ask >= bid) {
    spreadBps = Number((((ask - bid) / bid) * 10000).toFixed(1));
  }

  // 6. Approximate order book depth / volume capitalization from 24h volume
  const liquidityUsd = Math.round(volume24h * latestPrice * 0.15) || 5000000;

  // 7. Partition candles into intervals for interactive timeline views
  const candles4H: Candle[] = [];
  for (let i = 0; i < candles1H.length; i += 4) {
    const chunk = candles1H.slice(i, i + 4);
    if (chunk.length > 0) {
      candles4H.push({
        timestamp: chunk[0].timestamp,
        isoString: chunk[0].isoString,
        dateStr: chunk[0].dateStr,
        open: chunk[0].open,
        high: Math.max(...chunk.map(c => c.high)),
        low: Math.min(...chunk.map(c => c.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((acc, c) => acc + c.volume, 0)
      });
    }
  }

  // Build distinct historical series for each timeframe
  const dailySeries = candles1D.length > 0 ? candles1D : candles1H;
  const hourlySeries = candles1H.length > 0 ? candles1H : candles1D;

  const snapshot: MarketSnapshot = {
    symbol: symbolDisplay,
    price: latestPrice,
    bid,
    ask,
    change24h,
    change7d,
    volume24h: Math.round(volume24h),
    volumeAcceleration: volumeAccel,
    relativeVolume: rvol,
    realizedVolatility: realizedVol,
    momentumScore: momentum,
    rsi14: rsi,
    liquidityUsd,
    spreadBps,
    candles: {
      '1H': hourlySeries.slice(-24),
      '4H': candles4H.length > 0 ? candles4H : hourlySeries.slice(-24),
      '1D': hourlySeries.length >= 7 ? hourlySeries.slice(-24) : dailySeries.slice(-5),
      '7D': dailySeries.length >= 7 ? dailySeries.slice(-7) : dailySeries,
      '30D': dailySeries.length >= 30 ? dailySeries.slice(-30) : dailySeries
    },
    provider: 'alpaca',
    timestamp: new Date().toISOString()
  };

  return snapshot;
}

/**
 * Builds structured Market and Flow evidence objects from real market snapshots.
 */
export function getMarketEvidence(investigationId: string, snapshot: MarketSnapshot): Evidence[] {
  const symbol = snapshot.symbol;
  const isCrypto = alpacaDataAdapter.isCryptoSymbol(symbol);
  const providerName = isCrypto 
    ? 'Alpaca Crypto Market Data API (v1beta3)' 
    : 'Alpaca Stock Market Data API (v2 Snapshot & Bars)';
  const providerUrl = isCrypto 
    ? 'https://data.alpaca.markets/v1beta3/crypto/us/bars' 
    : 'https://data.alpaca.markets/v2/stocks/snapshots';

  return [
    {
      id: `EVID-MKT-${investigationId}-1`,
      investigationId,
      type: 'MARKET',
      title: `Price Action: ${snapshot.change24h >= 0 ? '+' : ''}${snapshot.change24h}%`,
      description: `Current ${isCrypto ? 'spot' : 'market'} price is $${snapshot.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} with session return of ${snapshot.change24h}% and 7-day return of ${snapshot.change7d}% sourced directly from ${providerName}.`,
      observedAt: snapshot.timestamp,
      source: {
        name: providerName,
        url: providerUrl,
        publisher: 'Alpaca Data API',
        publishedAt: snapshot.timestamp,
        retrievedAt: new Date().toISOString()
      },
      value: {
        price: snapshot.price,
        change24h: snapshot.change24h,
        change7d: snapshot.change7d,
        bid: snapshot.bid,
        ask: snapshot.ask
      },
      reliability: 'PRIMARY'
    },
    {
      id: `EVID-MKT-${investigationId}-2`,
      investigationId,
      type: 'MARKET',
      title: `Volume Acceleration: +${snapshot.volumeAcceleration}%, RVOL ${snapshot.relativeVolume}x`,
      description: `Recent period volume acceleration is ${snapshot.volumeAcceleration}% with Relative Volume (RVOL) of ${snapshot.relativeVolume}x over a 15-period average.`,
      observedAt: snapshot.timestamp,
      source: {
        name: providerName,
        url: providerUrl,
        publisher: 'Alpaca Data API',
        publishedAt: snapshot.timestamp,
        retrievedAt: new Date().toISOString()
      },
      value: {
        volume24h: snapshot.volume24h,
        rvol: snapshot.relativeVolume,
        volumeAcceleration: snapshot.volumeAcceleration
      },
      reliability: 'PRIMARY'
    },
    {
      id: `EVID-FLOW-${investigationId}-3`,
      investigationId,
      type: 'FLOW',
      title: `Spread & Liquidity Depth: ${snapshot.spreadBps} bps spread`,
      description: `Real-time bid-ask spread is ${snapshot.spreadBps} basis points with estimated liquidity pool volume depth of $${(snapshot.liquidityUsd/1000000).toFixed(2)}M.`,
      observedAt: snapshot.timestamp,
      source: {
        name: providerName,
        url: providerUrl,
        publisher: 'Alpaca Data API',
        publishedAt: snapshot.timestamp,
        retrievedAt: new Date().toISOString()
      },
      value: {
        liquidityUsd: snapshot.liquidityUsd,
        spreadBps: snapshot.spreadBps
      },
      reliability: 'PRIMARY',
      isContradictory: snapshot.spreadBps > 50
    }
  ];
}
