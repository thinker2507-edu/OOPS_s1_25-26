'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, dataDirectory } = require('../config/environment.cjs');
const { loopback } = require('./google-auth.cjs');
class RecoveryMail {
  constructor(config, { root = ROOT, fetcher = globalThis.fetch } = {}) {
    this.config = config;
    this.root = root;
    this.fetcher = fetcher;
  }
  baseUrl() {
    const url = new URL(this.config.APP_BASE_URL || 'http://127.0.0.1:' + (this.config.APP_PORT || 3000));
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['http:', 'https:'].includes(url.protocol) || url.protocol === 'http:' && !loopback(url.hostname)) {
      throw new Error('Invalid recovery origin.');
    }
    return url.origin;
  }
  info() {
    try {
      const base = new URL(this.baseUrl());
      const mode = this.config.EMAIL_DELIVERY_MODE || 'local';
      const from = this.config.EMAIL_FROM || 'Relay <no-reply@relay.test>';
      if (/[\r\n]/.test(from)) {
        throw new Error('Invalid sender.');
      }
      if (mode === 'local' && loopback(base.hostname)) {
        return {
          enabled: true,
          delivery: 'local'
        };
      }
      if (mode === 'resend' && this.config.RESEND_API_KEY && this.config.EMAIL_FROM) {
        return {
          enabled: true,
          delivery: 'email'
        };
      }
    }
    catch {
    }
    return {
      enabled: false,
      delivery: 'unavailable'
    };
  }
  async send({ to, subject, text }) {
    const info = this.info();
    if (!info.enabled || /[\r\n]/.test(to + subject)) {
      throw new Error('Recovery delivery unavailable.');
    }
    const from = this.config.EMAIL_FROM || 'Relay <no-reply@relay.test>';
    if (info.delivery === 'local') {
      const directory = dataDirectory({ APP_DATA_DIR: path.join(this.config.APP_DATA_DIR || 'data', 'mailbox') }, this.root);
      const message = [
        'From: ' + from,
        'To: ' + to,
        'Subject: ' + subject,
        'Date: ' + new Date().toUTCString(),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        text,
        ''
      ].join('\r\n');
      await fs.writeFile(path.join(directory, Date.now() + '-' + crypto.randomUUID() + '.eml'), message, {
        mode: 0o600,
        flag: 'wx'
      });
      return;
    }
    const response = await this.fetcher('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: 'Bearer ' + this.config.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text
      })
    });
    if (!response.ok) {
      throw new Error('Recovery email delivery failed.');
    }
  }
}
module.exports = { RecoveryMail };
