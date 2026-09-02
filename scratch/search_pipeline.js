const fs = require('fs');
const path = require('path');

function searchFiles(dir, query) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        searchFiles(fullPath, query);
      }
    } else if (entry.isFile()) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  }
}

searchFiles(path.resolve('src'), 'class CandidateDiscoveryPipeline');
searchFiles(path.resolve('src'), 'DEFAULT_UNIVERSE');
