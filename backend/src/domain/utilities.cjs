"use strict";
const crypto = require("node:crypto");
const { InvalidUserInputError } = require("./errors.cjs");
const now = () => Date.now() / 1000;
const randomToken = () => crypto.randomBytes(32).toString('base64url');
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  // Preserve the original Python format: the hex salt is used as UTF-8 text.
  return salt + ':' + crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
}
function passwordMatches(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string' || !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(stored)) {
    return false;
  }
  const [salt, digest] = stored.split(':');
  return safeEqual(digest, crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex'));
}
async function passwordMatchesAsync(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string' || !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(stored)) return false;
  const [salt, digest] = stored.split(':');
  const derived = await new Promise((resolve, reject) => crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (error, result) => error ? reject(error) : resolve(result)));
  return safeEqual(digest, derived.toString('hex'));
}
function fieldLabel(key) {
  const labels = {
    name: 'Name',
    body: 'Message',
    id: 'Reference number',
    request_id: 'Support request',
    request_key: 'Submission reference',
    incident_type_id: 'Incident type',
    service_id: 'IT service',
    technician_id: 'Technician',
    tech_id: 'Technician',
    affected: 'Number of affected users',
    response_minutes: 'Response target',
    resolution_minutes: 'Resolution target'
  };
  const label = labels[key] || key.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function text(data, key, maximum = 2000, minimum = 1) {
  const value = data[key];
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) {
    if (value === undefined && minimum === 0) {
      return '';
    }
    throw new InvalidUserInputError(fieldLabel(key) + ' must contain ' + (minimum === 0 ? 'no more than ' + maximum : 'between ' + minimum + ' and ' + maximum) + ' characters.');
  }
  return value.trim();
}
function integer(data, key, low, high) {
  const raw = data[key];
  if (!['number', 'string'].includes(typeof raw) || typeof raw === 'string' && !/^[+-]?\d+$/.test(raw.trim())) {
    throw new InvalidUserInputError(fieldLabel(key) + ' must be a whole number.');
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < low || value > high) {
    throw new InvalidUserInputError(fieldLabel(key) + ' must be between ' + low + ' and ' + high + '.');
  }
  return value;
}
module.exports = {
  now,
  randomToken,
  safeEqual,
  passwordHash,
  passwordMatches,
  passwordMatchesAsync,
  text,
  integer
};
