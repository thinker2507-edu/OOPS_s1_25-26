'use strict';
const crypto = require('node:crypto');
const net = require('node:net');
const {
  AppError,
  Forbidden,
  now,
  randomToken,
  safeEqual,
  passwordHash
} = require("../domain/index.cjs");
const { EMAIL } = require("../services/incident-service.cjs");
const enabled = (config, key) => String(config[key] || 'false').toLowerCase() === 'true';
function loopback(host) {
  if (typeof host !== 'string') {
    return false;
  }
  host = host.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || net.isIP(host) === 4 && host.split('.')[0] === '127' || host === '::1' || net.isIP(host) === 6 && host.startsWith('::ffff:127.');
}
class Authentication {
  constructor(repo, config, { fetcher = globalThis.fetch } = {}) {
    this.repo = repo;
    this.config = config;
    this.fetcher = fetcher;
    this.keyCache = null;
  }
  googleEnabled() {
    return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'].every(k => Boolean(this.config[k]));
  }
  newSession(user, method) {
    const token = randomToken();
    const csrf = randomToken();
    const time = now();
    return this.repo.transaction(repo => {
      repo.remove('sessions', s => s.expires < time);
      repo.insert('sessions', {
        token,
        user_id: user.id,
        csrf,
        expires: time + Number(this.config.APP_SESSION_HOURS || 12) * 3600,
        auth_method: method
      });
      return token;
    });
  }
  async startGoogle(mode = 'login', session = null) {
    if (mode === 'link' && session && await this.repo.read(repo => Boolean(repo.one('oauth_identities', identity => identity.provider === 'google' && identity.user_id === session.user_id)))) {
      throw new AppError('A Google account is already connected.', 409);
    }
    if (!this.googleEnabled()) {
      throw new AppError('Google sign-in is currently unavailable. Please use your email and password or contact your administrator.', 503);
    }
    let redirect;
    try {
      redirect = new URL(this.config.GOOGLE_REDIRECT_URI);
    }
    catch {
      throw new AppError('Google sign-in is currently unavailable. Please use your email and password or contact your administrator.', 503);
    }
    const validOrigin = this.config.APP_CLOUD === 'true' ? redirect.protocol === 'https:' && redirect.origin === this.config.APP_BASE_URL : redirect.protocol === 'http:' && loopback(redirect.hostname);
    if (!validOrigin || redirect.pathname !== '/auth/google/callback' || redirect.search || redirect.hash || redirect.username || redirect.password) {
      throw new AppError('Google sign-in is currently unavailable. Please use your email and password or contact your administrator.', 503);
    }
    if (!['login', 'link'].includes(mode)) {
      throw new AppError('This Google sign-in request is invalid. Please start again.');
    }
    if (mode === 'link' && (!session || !['password', 'google'].includes(session.auth_method))) {
      throw new Forbidden('Sign in before linking Google.');
    }
    const state = randomToken();
    const binding = randomToken();
    const verifier = randomToken();
    await this.repo.transaction(repo => {
      repo.remove('oauth_states', s => s.expires < now());
      repo.insert('oauth_states', {
        state,
        binding: crypto.createHash('sha256').update(binding).digest('hex'),
        verifier,
        session_token: mode === 'link' ? session.token : null,
        expires: now() + 600,
        mode
      });
    });
    const query = new URLSearchParams({
      client_id: this.config.GOOGLE_CLIENT_ID,
      redirect_uri: this.config.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce: state,
      code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });
    return {
      url: 'https://accounts.google.com/o/oauth2/v2/auth?' + query,
      binding
    };
  }
  async finishGoogle(state, binding, code) {
    if (!this.googleEnabled()) {
      throw new AppError('Google sign-in is currently unavailable. Please use your email and password or contact your administrator.', 503);
    }
    const flow = await this.repo.transaction(repo => {
      const row = repo.one('oauth_states', s => s.state === state);
      if (!row || row.expires <= now() || typeof binding !== 'string' || !binding || !safeEqual(row.binding, crypto.createHash('sha256').update(binding).digest('hex'))) {
        throw new AppError('Your Google sign-in request has expired or could not be verified. Please start again in this browser.', 401);
      }
      repo.remove('oauth_states', s => s.state === state);
      return row;
    });
    if (!code) {
      throw new AppError('Google sign-in was cancelled.', 401);
    }
    const profile = await this.googleProfile(code, flow.verifier, state);
    if (!profile || typeof profile.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(profile.sub) || typeof profile.email !== 'string' || profile.email.length > 200 || !EMAIL.test(profile.email) || profile.email_verified !== true) {
      throw new AppError('Please use a Google account with a verified email address.', 401);
    }
    const email = profile.email.toLowerCase();
    return this.repo.transaction(repo => {
      const identity = repo.one('oauth_identities', o => o.provider === 'google' && o.subject === profile.sub);
      let user = identity ? repo.one('users', u => u.id === identity.user_id) : null;
      if (flow.mode === 'link') {
        const live = repo.one('sessions', s => s.token === flow.session_token && s.expires > now() && ['password', 'google'].includes(s.auth_method));
        const original = live ? repo.one('users', u => u.id === live.user_id) : null;
        if (!original || !original.active) {
          throw new Forbidden('Your session expired. Sign in again before linking Google.');
        }
        if (identity && identity.user_id !== original.id) {
          throw new AppError('This Google account is already linked to another Relay account.', 409);
        }
        user = original;
      }
      else if (!identity) {
        if (repo.one('users', u => u.email === email)) {
          throw new AppError('An account already uses this email. Sign in with your password, then link Google from your profile.', 409);
        }
        const name = typeof profile.name === 'string' ? profile.name.slice(0, 100) : email.split('@')[0];
        user = repo.insert('users', {
          name: name || 'Google user',
          email,
          password: passwordHash(randomToken()),
          role: 'employee'
        });
      }
      if (!user?.active) {
        throw new Forbidden('This account is inactive. Please contact your administrator for assistance.');
      }
      if (!identity) {
        repo.insert('oauth_identities', {
          provider: 'google',
          subject: profile.sub,
          user_id: user.id
        });
      }
      return {
        ...user,
        oauth_mode: flow.mode
      };
    });
  }
  decodeToken(encoded) {
    try {
      if (typeof encoded !== 'string' || encoded.length > 20000) {
        throw new Error();
      }
      const parts = encoded.split('.');
      if (parts.length !== 3 || parts.some(p => !p || !/^[A-Za-z0-9_-]+$/.test(p))) {
        throw new Error();
      }
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (!header || typeof header !== 'object' || !claims || typeof claims !== 'object' || Array.isArray(claims)) {
        throw new Error();
      }
      return {
        parts,
        header,
        claims
      };
    }
    catch {
      throw new AppError('Your Google account could not be verified. Please try signing in again.', 401);
    }
  }
  validateClaims(encoded, nonce) {
    const { claims } = this.decodeToken(encoded);
    const audience = claims.aud;
    const audienceOK = audience === this.config.GOOGLE_CLIENT_ID || Array.isArray(audience) && audience.includes(this.config.GOOGLE_CLIENT_ID);
    if (!audienceOK || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || typeof claims.exp !== 'number' || claims.exp <= now() ||
      !safeEqual(claims.nonce, nonce) || (claims.azp ?? (Array.isArray(audience) ? null : this.config.GOOGLE_CLIENT_ID)) !== this.config.GOOGLE_CLIENT_ID) {
      throw new AppError('Your Google account could not be verified. Please try signing in again.', 401);
    }
    return claims;
  }
  async fetchJSON(url, options = {}) {
    const response = await this.fetcher(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
      redirect: 'error'
    });
    if (!response.ok) {
      throw new AppError('We could not connect to Google sign-in. Please try again shortly.', 401);
    }
    return {
      data: await response.json(),
      headers: response.headers
    };
  }
  async verifyIdToken(encoded, nonce) {
    const { parts, header } = this.decodeToken(encoded);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 255) {
      throw new AppError('Your Google account could not be verified. Please try signing in again.', 401);
    }
    if (!this.keyCache || this.keyCache.expires <= now() || !this.keyCache.keys.some(k => k.kid === header.kid)) {
      const { data, headers } = await this.fetchJSON('https://www.googleapis.com/oauth2/v3/certs');
      if (!Array.isArray(data?.keys)) {
        throw new AppError('We could not verify Google sign-in right now. Please try again shortly.', 401);
      }
      const age = Number((headers?.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 300);
      this.keyCache = {
        keys: data.keys,
        expires: now() + Math.min(age, 3600)
      };
    }
    const jwk = this.keyCache.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256'));
    if (!jwk) {
      throw new AppError('Your Google account could not be verified. Please try signing in again.', 401);
    }
    let verified = false;
    try {
      verified = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({
        key: jwk,
        format: 'jwk'
      }), Buffer.from(parts[2], 'base64url'));
    }
    catch {
    }
    if (!verified) {
      throw new AppError('Your Google account could not be verified. Please try signing in again.', 401);
    }
    return this.validateClaims(encoded, nonce);
  }
  async googleProfile(code, verifier, nonce) {
    try {
      const { data: token } = await this.fetchJSON('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.config.GOOGLE_CLIENT_ID,
          client_secret: this.config.GOOGLE_CLIENT_SECRET,
          redirect_uri: this.config.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
          code_verifier: verifier
        }).toString()
      });
      if (typeof token?.access_token !== 'string' || String(token.token_type).toLowerCase() !== 'bearer') {
        throw new AppError('Google sign-in could not be completed. Please start again.', 401);
      }
      const claims = await this.verifyIdToken(token.id_token, nonce);
      const { data: profile } = await this.fetchJSON('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + token.access_token } });
      if (profile?.sub !== claims.sub) {
        throw new AppError('Your Google account could not be verified. Please try signing in again.', 401);
      }
      return profile;
    }
    catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Google sign-in could not be completed. Please try again shortly or use your email and password.', 401);
    }
  }
}
module.exports = {
  Authentication,
  enabled,
  loopback
};
