const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
envContent.split('\n').forEach(line => {
  const [k] = line.split('=');
  if (k) console.log('Env key: ' + k.trim());
});
