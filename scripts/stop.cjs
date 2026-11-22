'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { configuration, dataDirectory } = require('../backend/src/config/environment.cjs');
async function main() {
  const file = path.join(dataDirectory(configuration()), 'server-instance.json');
  if (!fs.existsSync(file)) {
    console.log('No managed Relay instance found. For Docker, run docker compose down.');
    return;
  }
  const instance = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Number.isInteger(instance.port) || instance.port < 1 || instance.port > 65535 || typeof instance.stopKey !== 'string') {
    throw new Error('Invalid instance record. No process was stopped.');
  }
  const base = 'http://127.0.0.1:' + instance.port;
  let health;
  try {
    health = await (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) })).json();
  }
  catch {
    console.log('Relay is not running. No process was killed.');
    return;
  }
  if (health.instanceId !== instance.instanceId) {
    throw new Error('The port belongs to another instance. Nothing was stopped.');
  }
  const response = await fetch(base + '/_local/stop', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Relay-Stop-Key': instance.stopKey
    },
    body: '{}',
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    throw new Error('The instance refused shutdown. No other process was killed.');
  }
  for (let attempt = 0;attempt < 40;attempt++) {
    await new Promise(r => setTimeout(r, 100));
    try {
      await fetch(base + '/api/health', { signal: AbortSignal.timeout(300) });
    }
    catch {
      console.log('Relay stopped. Port ' + instance.port + ' is released.');
      return;
    }
  }
  throw new Error('Shutdown was requested but the port still responds. Check the foreground terminal.');
}
if (require.main === module) {
  main().catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
module.exports = { main };
