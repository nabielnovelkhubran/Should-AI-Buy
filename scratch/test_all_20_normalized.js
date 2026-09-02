const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const apiKey = env.ALPACA_API_KEY;
const apiSecret = env.ALPACA_SECRET_KEY || env.ALPACA_API_SECRET;
const dataBaseUrl = env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets';

function fetchAlpacaData(path) {
  return new Promise((resolve) => {
    const url = new URL(path, dataBaseUrl);
    const req = https.get(url, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
  });
}

const DEFAULT_SCAN_UNIVERSE = [
  'BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'DOGE', 'UNI', 'DOT', 'NEAR', 'LTC',
  'AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'COIN', 'PLTR'
];

async function testAll20() {
  console.log('=== TEST ALL 20 ASSETS WITH NORMALIZED LIQUIDITY ===\n');

  for (const sym of DEFAULT_SCAN_UNIVERSE) {
    const isCrypto = ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'DOGE', 'UNI', 'DOT', 'NEAR', 'LTC'].includes(sym);
    let snapRes, barsRes;
    if (isCrypto) {
      const pair = `${sym}/USD`;
      [snapRes, barsRes] = await Promise.all([
        fetchAlpacaData(`/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(pair)}`),
        fetchAlpacaData(`/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}&timeframe=1Hour&limit=48`)
      ]);
      const snap = snapRes.data?.snapshots?.[pair];
      const bars = barsRes.data?.bars?.[pair] || [];
      if (!snap && !bars.length) {
        console.log(`[${sym}] DATA UNAVAILABLE (No bars or snapshot)`);
        continue;
      }
      const price = snap?.latestTrade?.p || snap?.dailyBar?.c || (bars.length ? bars[bars.length - 1].c : 0);
      const last24 = bars.slice(-24);
      const hourly24hVol = last24.length >= 24 ? last24.reduce((s, b) => s + (b.v || 0), 0) : (last24.length ? last24.reduce((s, b) => s + (b.v || 0), 0) * (24 / last24.length) : 0);
      const effectiveVol = Math.max(snap?.dailyBar?.v || 0, snap?.prevDailyBar?.v || 0, hourly24hVol);
      const vwap = snap?.dailyBar?.vw || snap?.prevDailyBar?.vw || price;
      const normalizedLiquidityUsd = Math.round(effectiveVol * vwap);

      console.log(`[CRYPTO: ${sym}] Price: $${price} | Vol: ${effectiveVol.toFixed(2)} tokens | Liq: $${normalizedLiquidityUsd.toLocaleString()} | Meets $500k: ${normalizedLiquidityUsd >= 500000 ? 'YES' : 'NO'}`);
    } else {
      [snapRes, barsRes] = await Promise.all([
        fetchAlpacaData(`/v2/stocks/snapshots?symbols=${sym}&feed=iex`),
        fetchAlpacaData(`/v2/stocks/bars?symbols=${sym}&timeframe=1Hour&limit=48&feed=iex`)
      ]);
      const snap = snapRes.data?.[sym] || snapRes.data?.snapshots?.[sym];
      const bars = barsRes.data?.bars?.[sym] || [];
      const price = snap?.latestTrade?.p || snap?.dailyBar?.c || (bars.length ? bars[bars.length - 1].c : 0);
      const effectiveVol = snap?.dailyBar?.v || snap?.prevDailyBar?.v || (bars.length ? bars.slice(-24).reduce((s, b) => s + (b.v || 0), 0) : 0);
      const normalizedLiquidityUsd = Math.round(effectiveVol * (snap?.dailyBar?.vw || price));

      console.log(`[EQUITY: ${sym}] Price: $${price} | Vol: ${effectiveVol.toLocaleString()} shares | Liq: $${normalizedLiquidityUsd.toLocaleString()} | Meets $500k: ${normalizedLiquidityUsd >= 500000 ? 'YES' : 'NO'}`);
    }
  }
}

testAll20();
