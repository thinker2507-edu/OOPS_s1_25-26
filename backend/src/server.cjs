'use strict';
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Relay requires Node.js 24 or newer.');
  process.exit(1);
}
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, configuration, dataDirectory } = require('./config/environment.cjs');
const { MongoRepository } = require('./repositories/mongo-repository.cjs');
const { IncidentService } = require('./services/incident-service.cjs');
const { WebServer } = require('./http/web-server.cjs');
const { RecoveryMail } = require('./integrations/recovery-mail.cjs');
const { dispatchEmail } = require('./services/email-dispatch.cjs');
async function main() {
  const config = configuration();
  const cloud = config.APP_CLOUD === 'true';
  const directory = cloud ? null : dataDirectory(config);
  const manifest = cloud ? null : path.join(directory, 'server-instance.json');
  if (manifest && fs.existsSync(manifest)) {
    try {
      const running = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      const health = await (await fetch('http://127.0.0.1:' + running.port + '/api/health', { signal: AbortSignal.timeout(600) })).json();
      if (health.instanceId === running.instanceId) {
        throw Object.assign(new Error('Relay is already running on port ' + running.port + '. Close its launcher terminal before starting another instance.'), { alreadyRunning: true });
      }
    }
    catch (e) {
      if (e.alreadyRunning) {
        throw e;
      }
    }
  }
  const repo = await MongoRepository.connect(config);
  const service = new IncidentService(repo);
  const log = cloud ? message => console.log(new Date().toISOString() + ' ' + message) : message => fs.appendFileSync(path.join(directory, 'server.log'), new Date().toISOString() + ' ' + message + '\n');
  const instanceId = crypto.randomUUID();
  const stopKey = crypto.randomBytes(32).toString('base64url');
  let monitor;
  let monitoring = false;
  let background = Promise.resolve();
  const mailer = new RecoveryMail(config);
  function tick() {
    if (monitoring || stopping) {
      return background;
    }
    monitoring = true;
    background = service.monitor().then(() => cloud ? dispatchEmail(repo, mailer, log) : null).catch(() => log('Background monitoring failed; will retry.')).finally(() => {
      monitoring = false;
    });
    return background;
  }
  let stopping = false;
  const web = new WebServer(service, config, ROOT, {
    logger: log,
    instanceId,
    stopKey,
    onStop: () => stop().catch(console.error)
  });
  async function stop() {
    if (stopping) {
      return;
    }
    stopping = true;
    clearInterval(monitor);
    await background;
    await web.close();
    await repo.close();
    try {
      const recorded = manifest && JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (recorded?.instanceId === instanceId) {
        fs.unlinkSync(manifest);
      }
    }
    catch {
    }
    console.log('Relay stopped. Its HTTP port is now released.');
  }
  try {
    await service.seed(config);
    const port = await web.listen();
    if (manifest) {
      fs.writeFileSync(manifest, JSON.stringify({
        pid: process.pid,
        port,
        instanceId,
        stopKey,
        started: new Date().toISOString()
      }, null, 2), { mode: 0o600 });
    }
    await service.monitor();
    monitor = setInterval(tick, Math.max(1, Number(config.APP_MONITOR_SECONDS || 15)) * 1000);
    monitor.unref();
    process.on('SIGINT', () => stop().catch(console.error));
    process.on('SIGTERM', () => stop().catch(console.error));
    process.on('SIGHUP', () => stop().catch(console.error));
    console.log(cloud ? 'Relay cloud API listening on port ' + port : '\nRelay - React / Node.js / MongoDB\nhttp://127.0.0.1:' + port + '\nForeground server. Close the start.bat terminal or press Ctrl+C to stop.\n');
    return {
      web,
      repo,
      service,
      stop
    };
  }
  catch (error) {
    await repo.close();
    throw error;
  }
}
if (require.main === module) {
  main().catch(error => {
    console.error(error.code === 'EADDRINUSE' ? 'Port is already in use. Close the previous Relay launcher, or change APP_PORT in .env.' : error.message);
    process.exitCode = 1;
  });
}
module.exports = { main };
