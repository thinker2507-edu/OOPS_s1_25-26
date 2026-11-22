'use strict';
const fs = require('node:fs');
const path = require('node:path');
function configureCloud(apiOrigin, root = path.resolve(__dirname, '..')) {
  const url = new URL(apiOrigin);
  if (url.protocol !== 'https:' || url.origin !== apiOrigin || url.username || url.password || !url.hostname.endsWith('.onrender.com')) {
    throw new Error('Provide the Render HTTPS service origin without a trailing slash.');
  }
  const filename = path.join(root, 'vercel.json');
  const config = JSON.parse(fs.readFileSync(filename, 'utf8'));
  for (const rewrite of config.rewrites) {
    if (rewrite.source === '/api/:path*') {
      rewrite.destination = apiOrigin + '/api/:path*';
    }
    if (rewrite.source === '/auth/google/callback') {
      rewrite.destination = apiOrigin + '/auth/google/callback';
    }
  }
  fs.writeFileSync(filename, JSON.stringify(config, null, 2) + '\n');
  return config;
}
if (require.main === module) {
  try {
    configureCloud(process.argv[2]);
    console.log('Vercel API and Google callback proxy configured. No credentials were read or written.');
  }
  catch {
    console.error('Usage: node scripts/configure-cloud.cjs https://YOUR-SERVICE.onrender.com');
    process.exitCode = 1;
  }
}
module.exports = { configureCloud };
