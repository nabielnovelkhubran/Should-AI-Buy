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

async function testOne() {
  const r1 = await postJson('/api/investigations', { command: 'Should AI buy $BTC?' });
  console.log('Response with command:', r1);
  const r2 = await postJson('/api/investigations', { asset: 'BTC' });
  console.log('Response with asset:', r2);
}

testOne();
