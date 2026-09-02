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

async function testCryptoRolling() {
  console.log('=== ROLLING 24-HOUR CRYPTO VOLUME & LIQUIDITY AUDIT ===\n');

  const cryptoSymbols = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'AVAX/USD', 'LINK/USD', 'DOGE/USD', 'UNI/USD', 'DOT/USD', 'LTC/USD'];

  for (const pair of cryptoSymbols) {
    const barsRes = await fetchAlpacaData(`/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}&timeframe=1Hour&limit=48`);
    const snapRes = await fetchAlpacaData(`/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(pair)}`);

    const bars = barsRes.data?.bars?.[pair] || [];
    const snap = snapRes.data?.snapshots?.[pair] || {};

    const latestPrice = snap.latestTrade?.p || snap.dailyBar?.c || (bars.length ? bars[bars.length - 1].c : 0);
    
    // Last 24 hourly bars
    const last24Bars = bars.slice(-24);
    const rollingTokenVol = last24Bars.reduce((sum, b) => sum + (b.v || 0), 0);
    const rollingDollarVol = last24Bars.reduce((sum, b) => sum + ((b.v || 0) * (b.vw || b.c || latestPrice)), 0);
    
    const dailyTokenVol = snap.dailyBar?.v || 0;
    const dailyDollarVol = dailyTokenVol * (snap.dailyBar?.vw || latestPrice);

    console.log(`ASSET: ${pair}`);
    console.log(`  Price: $${latestPrice}`);
    console.log(`  Hourly Bars Available: ${bars.length} (using last ${last24Bars.length})`);
    console.log(`  Rolling 24h Base Volume:   ${rollingTokenVol.toFixed(4)} tokens`);
    console.log(`  Rolling 24h Dollar Volume: $${Math.round(rollingDollarVol).toLocaleString('en-US')}`);
    console.log(`  Daily Bar Dollar Volume:   $${Math.round(dailyDollarVol).toLocaleString('en-US')}`);
    console.log(`  Passes $500k Floor (Rolling): ${rollingDollarVol >= 500000 ? 'YES' : 'NO'}`);
    console.log(`  Passes $500k Floor (Daily):   ${dailyDollarVol >= 500000 ? 'YES' : 'NO'}\n`);
  }
}

testCryptoRolling();
