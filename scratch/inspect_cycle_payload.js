const http = require('http');

function postJson(path, payload = {}) {
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
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: responseData });
        }
      });
    });
    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

async function inspectCycle() {
  const res = await postJson('/api/agent/runtime', { action: 'RUN_CYCLE' });
  console.log('Result Keys:', Object.keys(res.data || {}));
  console.log('Cycle Result:', JSON.stringify(res.data?.result || res.data?.cycleResult || res.data, null, 2));
}

inspectCycle();
