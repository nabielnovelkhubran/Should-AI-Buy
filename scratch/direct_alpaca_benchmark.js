const fs = require('fs');
const https = require('https');

// Read .env
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const apiKey = env.ALPACA_API_KEY;
const apiSecret = env.ALPACA_SECRET_KEY || env.ALPACA_API_SECRET;
const baseUrl = env.APCA_API_BASE_URL || env.ALPACA_PAPER_BASE_URL || 'https://paper-api.alpaca.markets';

async function fetchAlpaca(endpoint) {
  const start = Date.now();
  return new Promise((resolve) => {
    const url = new URL(endpoint, baseUrl);
    const req = https.get(url, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(data); } catch(e) {}
        resolve({
          endpoint,
          status: res.statusCode,
          duration,
          data: parsed
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        endpoint,
        status: 0,
        duration: Date.now() - start,
        error: err.message
      });
    });
  });
}

async function run() {
  console.log('=== DIRECT ALPACA PAPER API LATENCY BENCHMARK ===\n');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`API Key:  ${apiKey ? apiKey.substring(0, 6) + '...' : 'MISSING'}\n`);

  const endpoints = [
    '/v2/account',
    '/v2/positions',
    '/v2/clock',
    '/v2/orders?status=open',
    '/v2/orders?status=closed&limit=5'
  ];

  for (const ep of endpoints) {
    const r = await fetchAlpaca(ep);
    console.log(`[${r.status === 200 ? 'SUCCESS' : 'FAILURE'}] ${ep}: ${r.duration}ms (HTTP ${r.status})`);
    if (r.status === 200) {
      if (ep === '/v2/account') console.log(`   Equity: $${r.data?.equity}, Cash: $${r.data?.cash}, Status: ${r.data?.status}`);
      if (ep === '/v2/positions') console.log(`   Positions: ${Array.isArray(r.data) ? r.data.length : 0}`);
      if (ep === '/v2/clock') console.log(`   Clock is_open: ${r.data?.is_open}, Timestamp: ${r.data?.timestamp}`);
      if (ep.startsWith('/v2/orders')) console.log(`   Orders: ${Array.isArray(r.data) ? r.data.length : 0}`);
    } else {
      console.log(`   Error: ${JSON.stringify(r.data || r.error)}`);
    }
  }
}

run();
