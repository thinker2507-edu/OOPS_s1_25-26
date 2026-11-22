// A connection-local cursor prevents reconnects from replaying old desktop alerts.
export class LiveNotifications {
  constructor({
    source = url => new EventSource(url),
    load,
    onUpdate,
    onAlert,
    onExpired,
    onConnection = () => {
    },
    initial = []
  }) {
    this.source = source;
    this.load = load;
    this.onUpdate = onUpdate;
    this.onAlert = onAlert;
    this.onExpired = onExpired;
    this.onConnection = onConnection;
    this.seen = new Set(initial.map(row => row.id));
    this.first = true;
    this.closed = false;
    this.version = 0;
  }
  accept(feed) {
    if (this.closed || !Array.isArray(feed?.notifications)) {
      return;
    }
    const rows = feed.notifications;
    this.version++;
    const fresh = rows.filter(row => row.channel === 'in_app' && !row.is_read && !this.seen.has(row.id));
    for (const row of rows)
      this.seen.add(row.id);
    this.onUpdate(rows);
    if (this.first) {
      this.first = false;
      const unread = rows.filter(row => row.channel === 'in_app' && !row.is_read).length;
      if (unread) {
        this.onAlert({
          message: 'You have ' + unread + ' unread notification' + (unread === 1 ? '.' : 's.'),
          path: '/notifications/inbox',
          initial: true
        });
      }
    }
    else if (fresh.length) {
      const newest = fresh.sort((a, b) => b.id - a.id)[0];
      this.onAlert({
        message: fresh.length === 1 ? newest.message : fresh.length + ' new incident updates.',
        path: newest.incident_id ? '/incidents/' + newest.incident_id : '/notifications/inbox',
        incidentId: newest.incident_id,
        initial: false
      });
    }
  }
  start() {
    try {
      this.events = this.source('/api/notifications/stream');
      this.events.onopen = () => {
        if (this.closed) {
          return;
        }
        this.onConnection('live');
        clearInterval(this.poll);
        this.poll = null;
        this.pollController?.abort();
      };
      this.events.addEventListener('notifications', event => {
        try {
          this.accept(JSON.parse(event.data));
        }
        catch {
        }
      });
      this.events.addEventListener('session-ended', () => {
        this.close();
        this.onExpired();
      });
      this.events.onerror = () => this.fallback();
    }
    catch {
      this.fallback();
    }
    return this;
  }
  fallback() {
    if (this.closed || this.poll) {
      return;
    }
    this.onConnection('reconnecting');
    const refresh = async () => {
      if (this.pending || this.closed) {
        return;
      }
      this.pending = true;
      const version = this.version;
      this.pollController = new AbortController();
      try {
        const feed = await this.load(this.pollController.signal);
        if (version === this.version) {
          this.accept(feed);
        }
      }
      catch (error) {
        if (error.status === 401) {
          this.close();
          this.onExpired();
        }
      }
      finally {
        this.pending = false;
      }
    };
    refresh();
    this.poll = setInterval(refresh, 15000);
  }
  close() {
    this.closed = true;
    this.events?.close();
    this.pollController?.abort();
    clearInterval(this.poll);
    this.onConnection('offline');
  }
}
