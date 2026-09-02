const http = require('http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(payload);
    const req = http.request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${responseData.substring(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

async function testDirectQueries() {
  console.log('=== DIRECT COUNCIL QUERIES VERIFICATION ===\n');

  const queries = [
    '$BTC',
    'BTC',
    '$ETH',
    'ETH',
    'SOL',
    'NVDA',
    'Should AI buy BTC?'
  ];

  for (const q of queries) {
    const start = Date.now();
    try {
      const res = await postJson('/api/investigations', { asset: q });
      const duration = Date.now() - start;
      const inv = res.investigation;
      console.log(`QUERY: "${q}" (${duration}ms)`);
      console.log(`  Resolved Asset: ${inv?.asset}`);
      console.log(`  Price: $${inv?.snapshot?.price}, 24h: ${inv?.snapshot?.change24h}%`);
      console.log(`  Decision: ${inv?.decision?.conclusion} (Confidence: ${inv?.decision?.confidence}%)`);
      console.log(`  Evidence Count: ${inv?.evidence?.length}`);
      console.log(`  Red Team Status: ${inv?.agentRuns?.red_team?.redTeamAttackDetails?.thesisStatus}`);
      console.log(`  Status: ${res.success ? 'PASS' : 'FAIL'}\n`);
    } catch (e) {
      console.log(`QUERY: "${q}" -> FAILED: ${e.message}\n`);
    }
  }
}

testDirectQueries();
