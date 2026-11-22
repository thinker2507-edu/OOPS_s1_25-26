'use strict';
const crypto = require('node:crypto');
const {
  AppError,
  Forbidden,
  now,
  randomToken,
  passwordHash,
  passwordMatches,
  integer,
  text
} = require('../domain/index.cjs');
const { RecoveryMail } = require('../integrations/recovery-mail.cjs');
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GENERIC = 'If an active account matches this email, password reset instructions have been requested.';
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
function newPassword(data) {
  const password = data.new_password;
  if (typeof password !== 'string' || password.length < 10 || password.length > 128 || !password.trim()) {
    throw new AppError('Choose a password with 10-128 characters.');
  }
  if (password !== data.confirm_password) {
    throw new AppError('The new passwords do not match.');
  }
  return password;
}
function audit(repo, actor, action, detail) {
  repo.insert('audit', {
    incident_id: null,
    user_id: actor,
    action,
    detail,
    old_state: null,
    new_state: null,
    created_at: now()
  });
}
function replacePassword(repo, target, hash, actor, action) {
  const tokens = new Set(repo.list('sessions', s => s.user_id === target.id).map(s => s.token));
  repo.update('users', user => user.id === target.id, {
    password: hash,
    updated_at: now()
  });
  repo.remove('sessions', session => session.user_id === target.id);
  repo.remove('oauth_states', state => tokens.has(state.session_token));
  repo.update('password_resets', reset => reset.user_id === target.id && !reset.used_at, { revoked_at: now() });
  audit(repo, actor, action, 'Password updated for user ID ' + target.id + '; existing sessions revoked.');
  repo.insert('notifications', {
    user_id: target.id,
    incident_id: null,
    channel: 'in_app',
    is_read: 0,
    message: 'Your Relay account password was changed. Sign in again; contact your administrator if you did not request this.',
    created_at: now()
  });
}
class PasswordRecovery {
  constructor(repo, config, { mailer = new RecoveryMail(config), logger = () => {
  } } = {}) {
    this.repo = repo;
    this.mailer = mailer;
    this.logger = logger;
    this.pending = new Set();
  }
  info() {
    return this.mailer.info();
  }
  enqueue(operation) {
    const pending = Promise.resolve().then(operation).catch(() => this.logger('Password recovery delivery failed.')).finally(() => this.pending.delete(pending));
    this.pending.add(pending);
  }
  async drain() {
    await Promise.all([...this.pending]);
  }
  async request(data) {
    if (!this.info().enabled) {
      throw new AppError('Password recovery is currently unavailable. Please contact your administrator for assistance.', 503, 'RECOVERY_UNAVAILABLE');
    }
    const email = text(data, 'email', 200).toLowerCase();
    if (!EMAIL.test(email)) {
      throw new AppError('Enter a valid email address.');
    }
    const raw = randomToken();
    const hash = tokenHash(raw);
    const time = now();
    const user = await this.repo.transaction(repo => {
      repo.remove('password_resets', reset => reset.expires < time - 86400);
      const target = repo.one('users', user => user.email === email && user.active);
      if (!target) {
        return null;
      }
      const recent = repo.list('password_resets', reset => reset.user_id === target.id && reset.created_at > time - 900);
      if (recent.length >= 3 || recent.some(reset => reset.created_at > time - 60)) {
        return null;
      }
      repo.update('password_resets', reset => reset.user_id === target.id && !reset.used_at, { revoked_at: time });
      repo.insert('password_resets', {
        token_hash: hash,
        user_id: target.id,
        created_at: time,
        expires: time + 1800,
        used_at: null,
        revoked_at: null
      });
      audit(repo, target.id, 'Password reset requested', 'Recovery instructions requested; no password was changed.');
      return {
        id: target.id,
        email: target.email
      };
    });
    if (user) {
      this.enqueue(async () => {
        try {
          await this.mailer.send({
            to: user.email,
            subject: 'Reset your Relay password',
            text: 'A password reset was requested for your Relay account.\n\nOpen this link within 30 minutes:\n' + this.mailer.baseUrl() + '/reset-password#token=' + raw + '\n\nThe link can be used once. If you did not request it, ignore this email. Your password has not changed.'
          });
        }
        catch {
          await this.repo.transaction(repo => {
            repo.update('password_resets', reset => reset.token_hash === hash && !reset.used_at, { revoked_at: now() });
            audit(repo, user.id, 'Password recovery email delivery failed', 'No recovery link was delivered; retry later or contact an administrator.');
          });
          this.logger('Password recovery email delivery failed.');
        }
      });
    }
    return {
      ok: true,
      message: GENERIC
    };
  }
  changedNotice(target) {
    if (this.info().enabled) {
      this.enqueue(() => this.mailer.send({
        to: target.email,
        subject: 'Your Relay password changed',
        text: 'Your Relay account password was changed and previous sessions were ended. Your role and incident history were preserved. If you did not request this, contact your administrator.'
      }));
    }
  }
  async complete(data) {
    const password = newPassword(data);
    if (typeof data.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.token)) {
      throw new AppError('This reset link is invalid or expired. Request a new one.', 400, 'INVALID_RESET_TOKEN');
    }
    const hash = tokenHash(data.token);
    const newHash = passwordHash(password);
    const target = await this.repo.transaction(repo => {
      const reset = repo.one('password_resets', reset => reset.token_hash === hash && !reset.used_at && !reset.revoked_at && reset.expires > now());
      const user = reset && repo.one('users', user => user.id === reset.user_id && user.active);
      if (!user) {
        throw new AppError('This reset link is invalid or expired. Request a new one.', 400, 'INVALID_RESET_TOKEN');
      }
      replacePassword(repo, user, newHash, user.id, 'Password reset completed');
      repo.update('password_resets', reset => reset.token_hash === hash, { used_at: now() });
      return { email: user.email };
    });
    this.changedNotice(target);
    return {
      ok: true,
      message: 'Password reset. Sign in with your new password.'
    };
  }
  async change(user, data) {
    const password = newPassword(data);
    if (typeof data.current_password !== 'string' || data.current_password.length > 128) {
      throw new AppError('Enter your current password.');
    }
    const hash = passwordHash(password);
    const target = await this.repo.transaction(repo => {
      const target = repo.one('users', target => target.id === user.id && target.active);
      if (!target || !passwordMatches(data.current_password, target.password)) {
        throw new Forbidden('Your current password is incorrect.');
      }
      replacePassword(repo, target, hash, user.id, 'Account password changed');
      return { email: target.email };
    });
    this.changedNotice(target);
    return {
      ok: true,
      message: 'Password changed. Sign in again.'
    };
  }
  async adminReset(user, data) {
    if (user.role !== 'admin') {
      throw new Forbidden();
    }
    const id = integer(data, 'id', 1, 999999999);
    if (id === user.id) {
      throw new AppError('Use Change password in your own Profile, or Forgot password.');
    }
    const hash = passwordHash(newPassword(data));
    const target = await this.repo.transaction(repo => {
      const target = repo.one('users', target => target.id === id);
      if (!target) {
        throw new AppError('User not found.', 404);
      }
      replacePassword(repo, target, hash, user.id, 'Administrator password reset');
      return { email: target.email };
    });
    this.changedNotice(target);
    return { ok: true };
  }
}
module.exports = {
  PasswordRecovery,
  tokenHash,
  newPassword
};
