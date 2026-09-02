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

async function auditRawAlpaca() {
  console.log('=== RAW ALPACA DATA AUDIT ===\n');

  // 1. Crypto Snapshot
  console.log('--- 1. CRYPTO SNAPSHOTS ---');
  const cryptoSnaps = await fetchAlpacaData('/v1beta3/crypto/us/snapshots?symbols=BTC%2FUSD,ETH%2FUSD,SOL%2FUSD,DOGE%2FUSD');
  console.log('Crypto Snapshots Status:', cryptoSnaps.status);
  console.log('Crypto Snapshots Keys:', Object.keys(cryptoSnaps.data?.snapshots || {}));
  for (const [sym, snap] of Object.entries(cryptoSnaps.data?.snapshots || {})) {
    console.log(`\nSymbol: ${sym}`);
    console.log(`  latestTrade: price = $${snap.latestTrade?.p}, size = ${snap.latestTrade?.s}`);
    console.log(`  dailyBar:    open = $${snap.dailyBar?.o}, close = $${snap.dailyBar?.c}, vol = ${snap.dailyBar?.v}, vwap = $${snap.dailyBar?.vw}, numTrades = ${snap.dailyBar?.n}`);
    console.log(`  prevDailyBar: close = $${snap.prevDailyBar?.c}, vol = ${snap.prevDailyBar?.v}, vwap = $${snap.prevDailyBar?.vw}`);
    console.log(`  minuteBar:   close = $${snap.minuteBar?.c}, vol = ${snap.minuteBar?.v}`);
    const tokenVol = snap.dailyBar?.v || 0;
    const price = snap.latestTrade?.p || snap.dailyBar?.c || 0;
    const vwap = snap.dailyBar?.vw || price;
    const notionalDollar24h = tokenVol * (vwap || price);
    console.log(`  >> 24h Base-Token Volume: ${tokenVol} tokens`);
    console.log(`  >> 24h Dollar Notional Volume (vol * price): $${notionalDollar24h.toLocaleString('en-US')}`);
  }

  // 2. Crypto Bars (1Hour)
  console.log('\n--- 2. CRYPTO 1-HOUR BARS ---');
  const cryptoBars = await fetchAlpacaData('/v1beta3/crypto/us/bars?symbols=BTC%2FUSD,SOL%2FUSD&timeframe=1Hour&limit=5');
  console.log('Crypto Bars Status:', cryptoBars.status);
  for (const [sym, bars] of Object.entries(cryptoBars.data?.bars || {})) {
    console.log(`\nSymbol: ${sym} (Last ${bars.length} 1H bars):`);
    bars.forEach(b => {
      console.log(`  [${b.t}] O: $${b.o}, H: $${b.h}, L: $${b.l}, C: $${b.c}, Vol(base): ${b.v}, VWAP: $${b.vw}, Notional($): $${(b.v * b.vw).toFixed(2)}`);
    });
  }

  // 3. Stock Snapshot
  console.log('\n--- 3. STOCK SNAPSHOTS ---');
  const stockSnaps = await fetchAlpacaData('/v2/stocks/snapshots?symbols=AAPL,MSFT,NVDA&feed=iex');
  console.log('Stock Snapshots Status:', stockSnaps.status);
  for (const [sym, snap] of Object.entries(stockSnaps.data || {})) {
    console.log(`\nSymbol: ${sym}`);
    console.log(`  latestTrade: price = $${snap.latestTrade?.p}, size = ${snap.latestTrade?.s}`);
    console.log(`  dailyBar:    open = $${snap.dailyBar?.o}, close = $${snap.dailyBar?.c}, vol = ${snap.dailyBar?.v} shares, vwap = $${snap.dailyBar?.vw}`);
    const shareVol = snap.dailyBar?.v || 0;
    const price = snap.latestTrade?.p || snap.dailyBar?.c || 0;
    const notionalDollar = shareVol * price;
    console.log(`  >> 24h Share Volume: ${shareVol.toLocaleString()} shares`);
    console.log(`  >> 24h Dollar Notional Volume: $${notionalDollar.toLocaleString('en-US')}`);
  }
}

auditRawAlpaca();
