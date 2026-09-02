const http = require('http');

async function testParallel() {
  const start = Date.now();
  const paths = [
    '/api/trading/paper/portfolio',
    '/api/portfolio',
    '/api/monitoring',
    '/api/automation',
    '/api/discovery',
    '/api/agent/runtime',
    '/api/agent/alpha',
    '/api/agent/events',
    '/api/agent/alpha/review',
    '/api/agent/session'
  ];

  const fetchPath = (path) => new Promise((resolve) => {
    const t0 = Date.now();
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        resolve({ path, status: res.statusCode, duration: Date.now() - t0 });
      });
    });
    req.on('error', (err) => resolve({ path, status: 0, error: err.message }));
  });

  const results = await Promise.allSettled(paths.map(p => fetchPath(p)));
  const totalDuration = Date.now() - start;
  console.log(`Total parallel duration: ${totalDuration}ms`);
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      console.log(`  ${r.value.path}: HTTP ${r.value.status} (${r.value.duration}ms)`);
    } else {
      console.log(`  Rejected: ${r.reason}`);
    }
  });
}

testParallel();
