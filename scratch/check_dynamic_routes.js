const fs = require('fs');
const path = require('path');

function checkRoutes(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkRoutes(fullPath);
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      const content = fs.readFileSync(fullPath, 'utf8');
      const hasDynamic = content.includes("export const dynamic = 'force-dynamic'");
      console.log(`${fullPath.replace(/.*src\\app\\api\\/, 'api/')}: hasDynamic=${hasDynamic}`);
    }
  }
}

checkRoutes(path.resolve('src/app/api'));
