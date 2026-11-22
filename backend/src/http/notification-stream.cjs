'use strict';
const { AppError } = require('../domain/index.cjs');
class NotificationStream {
  constructor(service, authenticate, { heartbeatMs = 15000, lifetimeMs = 90000 } = {}) {
    this.service = service;
    this.authenticate = authenticate;
    this.clients = new Set();
    this.heartbeatMs = heartbeatMs;
    this.lifetimeMs = lifetimeMs;
    this.unsubscribe = service.repo.onCommit?.(collections => {
      if (!collections.some(table => ['notifications', 'sessions', 'users'].includes(table))) {
        return;
      }
      for (const client of this.clients)
        this.schedule(client);
    });
  }
  open(req, res, session) {
    if ([...this.clients].filter(client => client.session.user_id === session.user_id).length >= 5) {
      throw new AppError('Too many live connections. Close an unused Relay tab and try again.', 429);
    }
    const client = {
      req,
      res,
      session,
      closed: false,
      busy: false,
      pending: false,
      last: '',
      expires: Date.now() + this.lifetimeMs
    };
    this.clients.add(client);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write('retry: 2000\n\n');
    const close = () => this.disconnect(client);
    res.on('close', close);
    client.timer = setInterval(() => {
      if (Date.now() >= client.expires) {
        return this.disconnect(client);
      }
      res.write(': heartbeat\n\n');
      this.refresh(client);
    }, this.heartbeatMs);
    client.timer.unref();
    this.refresh(client);
  }
  schedule(client) {
    if (client.closed || client.scheduled) {
      return;
    }
    client.scheduled = setTimeout(() => {
      client.scheduled = null;
      this.refresh(client);
    }, 30);
    client.scheduled.unref();
  }
  async refresh(client) {
    if (client.closed) {
      return;
    }
    if (client.busy) {
      client.pending = true;
      return;
    }
    client.busy = true;
    try {
      const session = await this.authenticate(client.req);
      if (!session || session.user_id !== client.session.user_id || session.role !== client.session.role) {
        if (!client.closed) {
          client.res.write('event: session-ended\ndata: {}\n\n');
        }
        return this.disconnect(client);
      }
      const feed = await this.service.notificationFeed({
        id: session.user_id,
        role: session.role
      });
      const serialized = JSON.stringify(feed);
      if (!client.closed && serialized !== client.last) {
        client.res.write('event: notifications\ndata: ' + serialized + '\n\n');
        client.last = serialized;
      }
    }
    catch {
      // Reconnect/fallback can recover; never disclose database or session details.
      this.disconnect(client);
    }
    finally {
      client.busy = false;
      if (client.pending && !client.closed) {
        client.pending = false;
        this.schedule(client);
      }
    }
  }
  disconnect(client) {
    if (client.closed) {
      return;
    }
    client.closed = true;
    clearInterval(client.timer);
    clearTimeout(client.scheduled);
    this.clients.delete(client);
    client.res.end();
  }
  close() {
    this.unsubscribe?.();
    for (const client of [...this.clients])
      this.disconnect(client);
  }
}
module.exports = { NotificationStream };
