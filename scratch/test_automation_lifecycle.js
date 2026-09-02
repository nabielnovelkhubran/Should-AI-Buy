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

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: responseData });
        }
      });
    }).on('error', reject);
  });
}

async function testAutomationLifecycle() {
  console.log('=== AUTOMATION SCHEDULER LIFECYCLE TEST ===\n');

  // 1. Initial Status
  const s1 = await getJson('/api/automation');
  console.log('Initial Status:', s1.data?.status || s1.data);

  // 2. Start Automation
  const startRes = await postJson('/api/automation', { action: 'START' });
  console.log('Start Action Response:', startRes.data?.status || startRes.data);

  // 3. Verify Running
  const s2 = await getJson('/api/automation');
  console.log('Running Status:', s2.data?.status?.schedulerStatus || s2.data?.schedulerStatus || s2.data?.status);

  // 4. Stop Automation
  const stopRes = await postJson('/api/automation', { action: 'STOP' });
  console.log('Stop Action Response:', stopRes.data?.status || stopRes.data);

  // 5. Verify Stopped
  const s3 = await getJson('/api/automation');
  console.log('Final Status:', s3.data?.status?.schedulerStatus || s3.data?.schedulerStatus || s3.data?.status);
}

testAutomationLifecycle();
