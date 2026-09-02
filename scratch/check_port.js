const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    }).on('error', reject);
  });
}

async function check() {
  const p = await get('/api/portfolio');
  console.log('Portfolio API:', p.status, p.data.substring(0, 100));
}

check();
