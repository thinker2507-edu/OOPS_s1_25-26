'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../../..');
function configuration(root = ROOT, environment = process.env) {
  const cloud = environment.APP_CLOUD === 'true';
  const local = path.join(root, '.env');
  if (!cloud && !fs.existsSync(local)) {
    fs.copyFileSync(path.join(root, '.env.example'), local);
  }
  const config = {};
  for (const name of cloud ? ['.env.example'] : ['.env.example', '.env']) {
    for (const line of fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
      if (!line.trim() || line.trimStart().startsWith('#')) {
        continue;
      }
      const index = line.indexOf('=');
      if (index < 1) {
        throw new Error('Invalid configuration line in ' + name);
      }
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
        value = value.slice(1, -1);
      }
      config[key] = value;
    }
  }
  for (const key of Object.keys(config))
    if (environment[key] !== undefined) {
      config[key] = environment[key];
    }
  if (!cloud && config.APP_CLOUD === 'true') {
    throw new Error('Set APP_CLOUD=true through process environment settings.');
  }
  if (cloud) {
    for (const key of ['MONGODB_URI', 'MONGODB_DATABASE', 'APP_BASE_URL', 'APP_API_URL']) {
      if (!environment[key]) {
        throw new Error('Cloud setting required: ' + key);
      }
    }
    for (const key of ['APP_BASE_URL', 'APP_API_URL']) {
      const url = new URL(config[key]);
      if (url.protocol !== 'https:' || url.origin !== config[key] || url.username || url.password) {
        throw new Error(key + ' must be an HTTPS origin without a trailing slash.');
      }
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(config.MONGODB_DATABASE) || ['admin', 'local', 'config'].includes(config.MONGODB_DATABASE)) {
      throw new Error('Choose a dedicated application database.');
    }
    config.APP_COOKIE_SECURE = 'true';
    config.APP_HOST = '0.0.0.0';
    config.APP_PORT = environment.PORT || environment.APP_PORT || '10000';
    config.APP_ADMIN_EMAIL = environment.APP_ADMIN_EMAIL || '';
    config.APP_ADMIN_PASSWORD = environment.APP_ADMIN_PASSWORD || '';
    config.APP_SEED_SAMPLES = 'false';
    config.EMAIL_DELIVERY_MODE = environment.EMAIL_DELIVERY_MODE || 'resend';
    if (config.EMAIL_DELIVERY_MODE !== 'resend') {
      throw new Error('Cloud email delivery must use resend.');
    }
    if (config.GOOGLE_CLIENT_ID && config.GOOGLE_REDIRECT_URI !== config.APP_BASE_URL + '/auth/google/callback') {
      throw new Error('Google callback must use APP_BASE_URL/auth/google/callback.');
    }
  }
  return config;
}
function dataDirectory(config, root = ROOT) {
  const candidate = path.resolve(root, config.APP_DATA_DIR || 'data');
  const relative = path.relative(root, candidate);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('APP_DATA_DIR must be a subdirectory inside the project.');
  }
  // Check symlinks/junctions before creating any directory outside the project.
  let existing = candidate;
  while (!fs.existsSync(existing))
    existing = path.dirname(existing);
  const realRoot = fs.realpathSync(root);
  const realExisting = fs.realpathSync(existing);
  const realRelative = path.relative(realRoot, realExisting);
  if (realRelative === '..' || realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) {
    throw new Error('APP_DATA_DIR resolves outside the project.');
  }
  fs.mkdirSync(candidate, { recursive: true });
  return candidate;
}
module.exports = {
  ROOT,
  configuration,
  dataDirectory
};
