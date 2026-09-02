const http = require('http');

async function testEndpoint(path) {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - start;
        const ctype = res.headers['content-type'] || '';
        let parsed = null;
        let isJson = false;
        if (ctype.includes('application/json')) {
          try {
            parsed = JSON.parse(data);
            isJson = true;
          } catch (e) {
            isJson = false;
          }
        }
        resolve({
          path,
          status: res.statusCode,
          duration,
          ctype,
          isJson,
          keys: parsed ? Object.keys(parsed) : [],
          error: parsed?.error,
          success: parsed?.success
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        path,
        status: 0,
        duration: Date.now() - start,
        error: err.message
      });
    });
  });
}

async function run() {
  console.log('Testing endpoints...');
  const paths = [
    '/api/trading/paper/portfolio',
    '/api/monitoring',
    '/api/automation',
    '/api/discovery',
    '/api/agent/runtime',
    '/api/agent/alpha',
    '/api/agent/events',
    '/api/agent/alpha/review',
    '/api/agent/session'
  ];

  for (const p of paths) {
    const r = await testEndpoint(p);
    console.log(`\nEndpoint: ${r.path}`);
    console.log(`Status:   ${r.status} (${r.duration}ms)`);
    console.log(`Type:     ${r.ctype}`);
    console.log(`IsJSON:   ${r.isJson}`);
    console.log(`Keys:     ${r.keys.join(', ')}`);
    if (r.error) console.log(`Error:    ${r.error}`);
  }
}

run();
