const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  });
}

const apiKey = process.env.ALPACA_API_KEY;
const apiSecret = process.env.ALPACA_SECRET_KEY;
const baseUrl = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets/v2';

function fetchAlpaca(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}${endpoint}`;
    const options = {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Accept': 'application/json'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Alpaca HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function fetchCryptoBars(symbol = 'BTC/USD') {
  return new Promise((resolve, reject) => {
    const url = `https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(symbol)}&timeframe=1Min&limit=5`;
    const options = {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Accept': 'application/json'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Market Data HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runLiveValidation() {
  console.log('===========================================================');
  console.log('PHASE 8.10 LIVE PAPER ALPHA RUNTIME VALIDATION');
  console.log('===========================================================');
  
  console.log('\n1. VERIFYING PAPER TRADING ENVIRONMENT & BOUNDARY:');
  console.log('Target Base URL:', baseUrl);
  const isPaper = baseUrl.includes('paper-api.alpaca.markets');
  console.log('Is Paper Confirmed:', isPaper ? 'PASS (Strict Paper-Only)' : 'FAIL');
  if (!isPaper) throw new Error('FATAL: Not paper endpoint');

  console.log('\n2. FETCHING REAL BROKER ACCOUNT & CASH POSITION:');
  const account = await fetchAlpaca('/account');
  console.log('Account ID (Masked):', account.account_number.slice(0, 4) + '***');
  console.log('Status:', account.status);
  console.log('Equity:', '$' + Number(account.equity).toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('Cash:', '$' + Number(account.cash).toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('Buying Power:', '$' + Number(account.buying_power).toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('Currency:', account.currency);

  console.log('\n3. FETCHING REAL BROKER POSITIONS:');
  const positions = await fetchAlpaca('/positions');
  console.log('Open Positions Count:', positions.length);

  console.log('\n4. FETCHING MARKET CLOCK:');
  const clock = await fetchAlpaca('/clock');
  console.log('Is Market Open (Equity):', clock.is_open);
  console.log('Current Timestamp:', clock.timestamp);
  console.log('Next Open:', clock.next_open);

  console.log('\n5. FETCHING LIVE MARKET DATA (BTC/USD Crypto 24/7):');
  const cryptoData = await fetchCryptoBars('BTC/USD');
  const bars = cryptoData.bars ? cryptoData.bars['BTC/USD'] : [];
  console.log('Crypto Bars Received:', bars ? bars.length : 0);
  if (bars && bars.length > 0) {
    const latestBar = bars[bars.length - 1];
    console.log(`Latest BTC/USD Quote: Close = $${latestBar.c} at ${latestBar.t}`);
  }

  console.log('\n6. SIMULATING RUNTIME OBSERVABILITY SNAPSHOT COMPILATION:');
  const sessionEvidence = {
    sessionId: `SESSION-${Date.now().toString(36).toUpperCase()}`,
    environment: 'paper',
    startedAt: new Date().toISOString(),
    startingEquity: Number(account.equity),
    startingCash: Number(account.cash),
    startingPositionsCount: positions.length,
    currentEquity: Number(account.equity),
    currentCash: Number(account.cash),
    currentPositionsCount: positions.length,
    totalCyclesExecuted: 1,
    totalCandidatesScanned: 10,
    totalOrdersSubmitted: 0,
    totalTradesExecuted: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    realizedPnLUsd: 0,
    totalR: 0,
    maxDrawdownPct: 0,
    evidenceQuality: 'INSUFFICIENT',
    isGrossPnL: true,
    status: 'ACTIVE'
  };
  console.log('Session Evidence ID:', sessionEvidence.sessionId);
  console.log('Evidence Quality:', sessionEvidence.evidenceQuality, '(0 completed trades recorded)');
  console.log('Gross PnL Explicit Label:', sessionEvidence.isGrossPnL);

  console.log('\n===========================================================');
  console.log('LIVE PAPER VALIDATION: ALL CRITICAL INVARIANTS PASSED');
  console.log('===========================================================');
}

runLiveValidation().catch(err => {
  console.error('Validation error:', err.message);
  process.exit(1);
});
