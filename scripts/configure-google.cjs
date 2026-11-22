'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, configuration } = require('../backend/src/config/environment.cjs');
const { loopback } = require('../backend/src/integrations/google-auth.cjs');
function googleSettings(document, callback, port) {
  const web = document?.web;
  if (!web || typeof web !== 'object' || Array.isArray(web)) {
    throw Error('Download credentials for a Web application OAuth client, not a Desktop client.');
  }
  if (typeof web.client_id !== 'string' || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(web.client_id)) {
    throw Error('The file does not contain a valid Google web client ID.');
  }
  if (typeof web.client_secret !== 'string' || !web.client_secret || web.client_secret.length > 512 || /[\s\x00-\x1f\x7f]/.test(web.client_secret)) {
    throw Error('The file does not contain a valid Google client secret.');
  }
  let redirect;
  try {
    redirect = new URL(callback);
  }
  catch {
    throw Error('Set GOOGLE_REDIRECT_URI to the localhost callback in .env.');
  }
  if (redirect.protocol !== 'http:' || !loopback(redirect.hostname) || redirect.pathname !== '/auth/google/callback' || redirect.search || redirect.hash || redirect.username || redirect.password || Number(redirect.port || 80) !== Number(port)) {
    throw Error('The Google callback must use HTTP localhost, the configured APP_PORT, and /auth/google/callback.');
  }
  if (!Array.isArray(web.redirect_uris) || !web.redirect_uris.includes(callback)) {
    throw Error('Add the exact GOOGLE_REDIRECT_URI from .env to Authorized redirect URIs in Google Cloud, then download the client JSON again.');
  }
  return {
    GOOGLE_CLIENT_ID: web.client_id,
    GOOGLE_CLIENT_SECRET: web.client_secret,
    GOOGLE_REDIRECT_URI: callback
  };
}
function replaceSettings(original, settings) {
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  const seen = new Set();
  const lines = original.replace(/^\uFEFF/, '').split(/\r?\n/).flatMap(line => {
    const key = line.match(/^\s*([A-Z_]+)\s*=/)?.[1];
    if (!Object.hasOwn(settings, key)) {
      return [line];
    }
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [key + '=' + settings[key]];
  });
  while (lines.at(-1) === '')
    lines.pop();
  for (const [key, value] of Object.entries(settings))
    if (!seen.has(key)) {
      lines.push(key + '=' + value);
    }
  return lines.join(newline) + newline;
}
function configureGoogle(filename, { root = ROOT } = {}) {
  let document;
  try {
    document = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  }
  catch {
    throw Error('Could not read the Google credentials JSON. Save the downloaded Web application client JSON in .secrets/google-oauth.json.');
  }
  const local = path.join(root, '.env');
  if (fs.existsSync(local) && fs.lstatSync(local).isSymbolicLink()) {
    throw Error('Refusing to overwrite a linked .env file. Use a regular project-local file.');
  }
  const config = configuration(root, {});
  const settings = googleSettings(document, config.GOOGLE_REDIRECT_URI, config.APP_PORT);
  const original = fs.readFileSync(local, 'utf8');
  const updated = replaceSettings(original, settings);
  const temporary = path.join(root, '.env.google-tmp');
  try {
    fs.writeFileSync(temporary, updated, {
      mode: 0o600,
      flag: 'wx'
    });
    fs.renameSync(temporary, local);
  }
  catch {
    // Never include parser input or credential values in command output.
    throw Error('Could not update .env. Close editors holding the file and check for a leftover .env.google-tmp.');
  }
  return { callback: settings.GOOGLE_REDIRECT_URI };
}
function main(args = process.argv.slice(2)) {
  if (args.length && !(args.length === 2 && args[0] === '--file')) {
    throw Error('Usage: npm run google:configure -- --file ".secrets/google-oauth.json"');
  }
  const filename = args[1] ? path.resolve(args[1]) : path.join(ROOT, '.secrets', 'google-oauth.json');
  const result = configureGoogle(filename);
  console.log('Google sign-in configuration saved to the ignored project-local .env. No credentials were printed.');
  console.log('Callback: ' + result.callback + '\nClose the app terminal and run start.bat again. Then choose Continue with Google.');
}
if (require.main === module) {
  try {
    main();
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = {
  googleSettings,
  replaceSettings,
  configureGoogle,
  main
};
