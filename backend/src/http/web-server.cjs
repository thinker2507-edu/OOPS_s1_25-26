'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  AppError,
  InvalidLoginError,
  publicError,
  Forbidden,
  now,
  safeEqual,
  passwordMatchesAsync,
  integer
} = require("../domain/index.cjs");
const { Authentication, loopback } = require("../integrations/google-auth.cjs");
const { FrontendAssets } = require('./frontend-assets.cjs');
const { apiContract } = require('./api-contract.cjs');
const { listIncidents } = require('../services/incident-list.cjs');
const { PasswordRecovery } = require('../services/password-recovery.cjs');
const { rateLimit } = require('../services/rate-limit.cjs');
const { NotificationStream } = require('./notification-stream.cjs');
const PAGE = /^\/(?:login|register|forgot-password|reset-password|overview|support-requests|incidents(?:\/(?:new|mine|reported|\d+(?:\/(?:conversation|resolution|activity))?))?|reports(?:\/(?:overview|workload|services|audit|sla))?|notifications(?:\/(?:inbox|email))?|admin(?:\/(?:users|technicians|services|categories|policies|assignment))?|settings(?:\/(?:account|accessibility|system|api))?)\/?$/;
class WebServer {
  constructor(service, config, root, {
    auth = null,
    recovery = null,
    logger = () => {
    },
    onStop = null,
    stopKey = '',
    instanceId = ''
  } = {}) {
    this.service = service;
    this.config = config;
    this.root = root;
    this.auth = auth || new Authentication(service.repo, config);
    this.logger = logger;
    this.recovery = recovery || new PasswordRecovery(service.repo, config, { logger });
    this.onStop = config.APP_CLOUD === 'true' ? null : onStop;
    this.stopKey = stopKey;
    this.instanceId = instanceId;
    this.started = now();
    this.assets = new FrontendAssets(root);
    this.notificationStream = new NotificationStream(service, req => this.session(req, false));
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.requestTimeout = 15000;
    this.server.headersTimeout = 10000;
    this.server.maxHeadersCount = 100;
  }
  listen(port = Number(this.config.APP_PORT || 3000), host = this.config.APP_HOST || '127.0.0.1') {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, host, () => {
        this.server.off('error', reject);
        resolve(this.server.address().port);
      });
    });
  }
  async close() {
    this.notificationStream.close();
    if (!this.server.listening) {
      return;
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.server.closeAllConnections(), 1500);
      timer.unref();
      this.server.close(error => {
        clearTimeout(timer);
        error ? reject(error) : resolve();
      });
      this.server.closeIdleConnections();
    });
    await this.recovery.drain();
  }
  cookie(name, value, sameSite = 'Strict', maxAge = null) {
    return name + '=' + value + '; HttpOnly; SameSite=' + sameSite + '; Path=/' + (String(this.config.APP_COOKIE_SECURE).toLowerCase() === 'true' ? '; Secure' : '') + (maxAge === null ? '' : '; Max-Age=' + maxAge);
  }
  cookies(req) {
    const result = {};
    for (const item of (req.headers.cookie || '').split(';')) {
      const i = item.indexOf('=');
      if (i > 0) {
        result[item.slice(0, i).trim()] = item.slice(i + 1).trim();
      }
    }
    return result;
  }
  host(req) {
    try {
      return new URL('http://' + req.headers.host).hostname.replace(/^\[|\]$/g, '');
    }
    catch {
      throw new Forbidden('This address is not authorized. Please use your organization\'s Relay address.');
    }
  }
  checkHost(req) {
    if (this.config.APP_CLOUD === 'true') {
      const allowed = [this.config.APP_BASE_URL, this.config.APP_API_URL].map(origin => new URL(origin).hostname);
      if (!allowed.includes(this.host(req))) {
        throw new Forbidden('This address is not authorized. Please use your organization\'s Relay address.');
      }
      return;
    }
    const allowed = new Set([this.config.APP_HOST || '127.0.0.1', '127.0.0.1', 'localhost', '::1']);
    allowed.delete('0.0.0.0');
    if (!allowed.has(this.host(req))) {
      throw new Forbidden('This address is not authorized. Please use your organization\'s Relay address.');
    }
  }
  async session(req, required = true) {
    const token = this.cookies(req).itsm_session || '';
    if (!token) {
      if (required) throw new AppError('Please sign in.', 401);
      return null;
    }
    const session = await this.service.repo.read(repo => {
      const s = repo.one('sessions', s => s.token === token && s.expires > now() && ['password', 'google'].includes(s.auth_method));
      const u = s ? repo.one('users', u => u.id === s.user_id && u.active) : null;
      return u ? {
        ...s,
        name: u.name,
        email: u.email,
        role: u.role
      } : null;
    }, {
      collections: ['sessions', 'users'],
      queries: {
        sessions: { filter: { token } },
        users: { projection: { password: 0 } }
      }
    });
    if (!session && required) {
      throw new AppError('Please sign in.', 401);
    }
    return session;
  }
  user(s) {
    return {
      id: s.user_id,
      name: s.name,
      email: s.email,
      role: s.role,
      auth_method: s.auth_method
    };
  }
  csrf(req, s) {
    if (!safeEqual(req.headers['x-csrf-token'] || '', s.csrf)) {
      throw new Forbidden('Your request could not be verified. Please refresh the page and try again.');
    }
  }
  rateLimit(req) {
    // Only trust the provider-overwritten final hop when explicitly configured.
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();
    const ip = this.config.APP_TRUST_PROXY === 'true' && this.config.APP_CLOUD === 'true' && forwarded ? forwarded : req.socket.remoteAddress;
    return rateLimit(this.service.repo, 'auth:' + ip);
  }
  checkOrigin(req) {
    const allowed = this.config.APP_CLOUD === 'true' ? [this.config.APP_BASE_URL] : ['http://' + req.headers.host, 'https://' + req.headers.host];
    if (req.headers.origin && !allowed.includes(req.headers.origin)) {
      throw new Forbidden('This request is not authorized. Please return to Relay and try again.');
    }
  }
  respond(res, status, data, headers = {}) {
    const json = typeof data === 'object' && data !== null && !Buffer.isBuffer(data);
    const body = json ? Buffer.from(JSON.stringify(data)) : Buffer.from(data);
    res.writeHead(status, {
      'Content-Type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'Content-Length': body.length,
      'Server-Timing': 'app;dur=' + Math.max(0, performance.now() - (res.relayStarted || performance.now())).toFixed(1),
      ...headers
    });
    res.end(body);
  }
  async signIn(res, user, method) {
    const token = await this.auth.newSession(user, method);
    this.respond(res, 200, { ok: true }, { 'Set-Cookie': this.cookie('itsm_session', token, 'Strict', Number(this.config.APP_SESSION_HOURS || 12) * 3600) });
  }
  async body(req, maximum = 65536) {
    this.checkHost(req);
    this.checkOrigin(req);
    const length = Number(req.headers['content-length'] || 0);
    if (req.headers['content-length'] !== undefined && (!Number.isSafeInteger(length) || length < 1 || length > maximum)) {
      req.resume();
      throw new AppError('The request is empty or exceeds the allowed size. Please review your information and attachments.', 413);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maximum) {
        throw new AppError('The request is empty or exceeds the allowed size. Please review your information and attachments.', 413);
      }
      chunks.push(chunk);
    }
    if (!size) {
      throw new AppError('The request is empty or exceeds the allowed size. Please review your information and attachments.', 413);
    }
    if ((req.headers['content-type'] || '').split(';')[0] !== 'application/json') {
      throw new AppError('Use application/json.', 415);
    }
    this.checkHost(req);
    this.checkOrigin(req);
    let data;
    try {
      data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    }
    catch {
      throw new AppError('Invalid JSON.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError('JSON object required.');
    }
    return data;
  }
  async handle(req, res) {
    res.relayStarted = performance.now();
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
      this.checkHost(req);
      if (this.config.APP_CLOUD === 'true' && !['/api/health', '/api/ready'].includes(url.pathname)) {
        const initialized = await this.service.repo.read(repo => Boolean(repo.one('settings', s => s.key === 'cloud_initialized')), { collections: ['settings'] });
        if (!initialized) {
          throw new AppError('This workspace is not available yet. Please contact your administrator.', 503, 'CLOUD_NOT_INITIALIZED');
        }
      }
      if (req.method === 'GET') {
        if (url.pathname === '/api/health') {
          return this.respond(res, 200, {
            status: 'ok',
            backend: 'node',
            database: this.service.repo.provider,
            node: process.versions.node,
            instanceId: this.instanceId
          });
        }
        if (url.pathname === '/api/ready') {
          const ready = await this.service.repo.healthy();
          return this.respond(res, ready ? 200 : 503, {
            status: ready ? 'ready' : 'database unavailable',
            database: this.service.repo.provider
          });
        }
        if (url.pathname === '/api/auth/config') {
          return this.respond(res, 200, {
            google_enabled: this.auth.googleEnabled(),
            password_recovery: this.recovery.info()
          });
        }
        if (url.pathname === '/auth/google/callback') {
          return await this.googleCallback(req, res, url);
        }
        if (url.pathname.startsWith('/api/')) {
          const session = await this.session(req);
          const user = this.user(session);
          if (url.pathname === '/api/notifications/stream') {
            this.checkOrigin(req);
            return this.notificationStream.open(req, res, session);
          }
          if (url.pathname === '/api/notifications') {
            return this.respond(res, 200, await this.service.notificationFeed(user));
          }
          if (url.pathname === '/api/openapi.json') {
            if (user.role !== 'admin') {
              throw new Forbidden();
            }
            return this.respond(res, 200, apiContract(this.config.APP_BASE_URL || 'http://' + req.headers.host));
          }
          if (url.pathname === '/api/incidents') {
            return this.respond(res, 200, await listIncidents(this.service, user, Object.fromEntries(url.searchParams)));
          }
          if (url.pathname === '/api/bootstrap') {
            return this.respond(res, 200, {
              ...await this.service.snapshot(user),
              csrf: session.csrf,
              google_enabled: this.auth.googleEnabled(),
              email_delivery_enabled: this.config.APP_CLOUD === 'true' && this.recovery.info().enabled,
              database: this.service.repo.provider
            });
          }
          if (url.pathname === '/api/admin/audit') {
            return this.respond(res, 200, await this.service.audit(user, Object.fromEntries(url.searchParams)));
          }
          if (url.pathname === '/api/admin/sla') {
            return this.respond(res, 200, await this.service.slaViolations(user));
          }
          if (url.pathname === '/api/admin/storage') {
            return this.respond(res, 200, await this.service.storage(user));
          }
          if (/^\/api\/incidents\/\d+\/related$/.test(url.pathname)) {
            return this.respond(res, 200, await this.service.relatedFor(user, Number(url.pathname.split('/')[3])));
          }
          if (url.pathname === '/api/catalog') {
            return this.respond(res, 200, await this.service.catalog());
          }
          if (url.pathname === '/api/search/incidents') {
            return this.respond(res, 200, await this.service.search(user, Object.fromEntries(url.searchParams)));
          }
          if (url.pathname === '/api/support-requests') {
            return this.respond(res, 200, { requests: await this.service.supportRequests(user) });
          }
          if (/^\/api\/attachments\/\d+$/.test(url.pathname)) {
            const file = await this.service.attachment(user, integer({ id: url.pathname.split('/').pop() }, 'id', 1, 999999999));
            const preview = url.searchParams.get('preview') === '1';
            if (preview && !['image/png', 'image/jpeg'].includes(file.mime)) {
              throw new AppError('Browser preview is available for PNG and JPEG images. Please download this file to view it.', 415);
            }
            return this.respond(res, 200, Buffer.from(file.data, 'base64'), {
              'Content-Type': file.mime,
              'Content-Disposition': (preview ? 'inline' : 'attachment') + "; filename=\"attachment-" + file.id + "\"; filename*=UTF-8''" + encodeURIComponent(file.name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16)),
              'X-Content-Type-Options': 'nosniff'
            });
          }
          if (/^\/api\/incidents\/\d+$/.test(url.pathname)) {
            return this.respond(res, 200, await this.service.detail(user, integer({ id: url.pathname.split('/').pop() }, 'id', 1, 999999999)));
          }
          if (url.pathname === '/api/system') {
            if (user.role !== 'admin') {
              throw new Forbidden();
            }
            return this.respond(res, 200, {
              backend: 'Node.js',
              database: this.service.repo.provider,
              port: this.server.address().port,
              uptime: Math.round(now() - this.started),
              can_stop: Boolean(this.onStop)
            });
          }
          throw new AppError('Not found.', 404);
        }
        const asset = this.assets.find(url.pathname, PAGE.test(url.pathname));
        if (!asset) {
          throw new AppError('Not found.', 404);
        }
        return this.respond(res, 200, fs.readFileSync(asset.filename), { 'Content-Type': asset.contentType + '; charset=utf-8' });
      }
      if (req.method === 'DELETE' && /^\/api\/incidents\/\d+$/.test(url.pathname)) {
        const session = await this.session(req);
        this.csrf(req, session);
        const data = await this.body(req);
        return this.respond(res, 200, await this.service.deleteIncident(this.user(session), Number(url.pathname.split('/').pop()), data));
      }
      if (req.method !== 'POST') {
        return this.respond(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET, POST, DELETE' });
      }
      const acceptsFiles = /^\/api\/incidents(?:\/\d+)?$/.test(url.pathname);
      if (acceptsFiles) {
        this.checkHost(req);
        const uploadSession = await this.session(req);
        this.csrf(req, uploadSession);
      }
      const data = await this.body(req, acceptsFiles ? 6 * 1024 * 1024 : 65536);
      const route = url.pathname;
      const repo = this.service.repo;
      if (route === '/_local/stop') {
        if (!this.onStop || !loopback(req.socket.remoteAddress) || !this.stopKey || !safeEqual(req.headers['x-relay-stop-key'] || '', this.stopKey)) {
          throw new Forbidden();
        }
        this.respond(res, 200, {
          ok: true,
          message: 'Relay is stopping and releasing its port.'
        });
        setTimeout(() => this.onStop(), 30);
        return;
      }
      if (route === '/api/auth/google/start') {
        await this.rateLimit(req);
        let session = null;
        if (data.mode === 'link') {
          session = await this.session(req);
          this.csrf(req, session);
        }
        const { url: redirect, binding } = await this.auth.startGoogle(data.mode ?? 'login', session);
        if (this.config.APP_CLOUD !== 'true' && new URL(this.config.GOOGLE_REDIRECT_URI).host !== req.headers.host) {
          throw new AppError('Google sign-in is unavailable at this address. Please use your organization\'s Relay address or contact your administrator.');
        }
        return this.respond(res, 200, { url: redirect }, { 'Set-Cookie': this.cookie('relay_oauth', binding, 'Lax', 600) });
      }
      if (route === '/api/auth/forgot-password') {
        await this.rateLimit(req);
        return this.respond(res, 200, await this.recovery.request(data));
      }
      if (route === '/api/auth/reset-password') {
        await this.rateLimit(req);
        const result = await this.recovery.complete(data);
        return this.respond(res, 200, result, { 'Set-Cookie': this.cookie('itsm_session', '', 'Strict', 0) });
      }
      if (route === '/api/register' || route === '/api/login') {
        await this.rateLimit(req);
        if (route === '/api/register') {
          await repo.transaction(() => this.service.addUser(data));
          return this.respond(res, 201, { ok: true });
        }
        const { email, password } = data;
        if (typeof email !== 'string' || typeof password !== 'string' || password.length > 128) {
          throw new InvalidLoginError();
        }
        const normalizedEmail = email.toLowerCase().trim();
        const user = await repo.read(r => r.one('users', u => u.email === normalizedEmail && u.active), { collections: ['users'], queries: { users: { filter: { email: normalizedEmail, active: { $in: [1, true] } } } } });
        const matches = await passwordMatchesAsync(password, user?.password || '0'.repeat(32) + ':' + '0'.repeat(64));
        if (!user || !matches) {
          throw new InvalidLoginError();
        }
        // Request-supplied roles are ignored. Stored account role is authoritative.
        return await this.signIn(res, user, 'password');
      }
      const session = await this.session(req);
      const user = this.user(session);
      this.csrf(req, session);
      if (route === '/api/auth/change-password') {
        await this.rateLimit(req);
        const result = await this.recovery.change(user, data);
        return this.respond(res, 200, result, { 'Set-Cookie': this.cookie('itsm_session', '', 'Strict', 0) });
      }
      if (route === '/api/logout') {
        await repo.transaction(r => r.remove('sessions', s => s.token === session.token), { collections: ['users', 'sessions'], writeCollections: ['sessions'] });
        return this.respond(res, 200, { ok: true }, { 'Set-Cookie': this.cookie('itsm_session', '', 'Strict', 0) });
      }
      if (route === '/api/incidents') {
        const incident = await this.service.create(user, data);
        return this.respond(res, 201, incident, { Location: '/api/incidents/' + incident.id });
      }
      if (/^\/api\/incidents\/\d+$/.test(route)) {
        return this.respond(res, 200, await this.service.update(user, integer({ id: route.split('/').pop() }, 'id', 1, 999999999), data));
      }
      if (route === '/api/admin') {
        if (data.action === 'user_password_reset') {
          await this.rateLimit(req);
          return this.respond(res, 200, await this.recovery.adminReset(user, data));
        }
        return this.respond(res, 200, await this.service.admin(user, data));
      }
      if (route === '/api/notifications/read') {
        await this.service.markNotificationsRead(user);
        return this.respond(res, 200, { ok: true });
      }
      if (route === '/api/system/stop') {
        if (user.role !== 'admin' || !this.onStop) {
          throw new Forbidden();
        }
        this.respond(res, 200, {
          ok: true,
          message: 'Relay is shutting down. Your records have been saved.'
        });
        setTimeout(() => this.onStop(), 30);
        return;
      }
      throw new AppError('Not found.', 404);
    }
    catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const safe = publicError(error);
      if (safe.status >= 500) {
        this.logger('Request failed: ' + safe.code);
      }
      return this.respond(res, safe.status, {
        error: safe.message,
        code: safe.code
      });
    }
    finally {
      // A successful permanent deletion must leave no application deletion log.
      if (!(req.method === 'DELETE' && /^\/api\/incidents\/\d+$/.test(url?.pathname || ''))) {
        this.logger(req.method + ' ' + (url?.pathname || '/') + ' ' + res.statusCode);
      }
    }
  }
  async googleCallback(req, res, url) {
    try {
      const user = await this.auth.finishGoogle(url.searchParams.get('state') || '', this.cookies(req).relay_oauth || '', url.searchParams.has('error') ? '' : url.searchParams.get('code') || '');
      const token = await this.auth.newSession(user, 'google');
      this.respond(res, 303, '', {
        Location: user.oauth_mode === 'link' ? '/settings/account?google_linked=1' : user.role === 'employee' ? '/incidents/mine' : '/overview',
        'Set-Cookie': [this.cookie('itsm_session', token, 'Strict', Number(this.config.APP_SESSION_HOURS || 12) * 3600), this.cookie('relay_oauth', '', 'Lax', 0)]
      });
    }
    catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }
      this.respond(res, 303, '', {
        Location: '/login?' + new URLSearchParams({ auth_error: error.message }),
        'Set-Cookie': this.cookie('relay_oauth', '', 'Lax', 0)
      });
    }
  }
}
module.exports = {
  WebServer,
  PAGE
};
