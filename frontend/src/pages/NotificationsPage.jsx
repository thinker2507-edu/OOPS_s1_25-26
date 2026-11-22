import React from "../lib/react.js";
import { api } from "../services/api.js";
import { Card, Button } from "../components/ui.js";
import { date } from "../lib/format.js";
import { Link } from "../app/navigation.js";
function NotificationsPage({ data, refresh, path, browserNotifications }) {
  const email = path.endsWith('/email');
  const rows = data.notifications.filter(n => email ? ['email_outbox', 'email_simulated'].includes(n.channel) : n.channel === 'in_app');
  return <Card
    title={email ? 'Email outbox' : 'Your notifications'}
    subtitle={email ? data.email_delivery_enabled ? 'Queued email resumes when the cloud service is awake. Delivery status is recorded below.' : 'Email delivery is not configured. Messages are retained in this outbox.' : 'Updates about your incidents and assignments.'}
    action={<Button onClick={async () => {
      await api('notifications/read', {});
      await refresh(true);
    }}>
      Mark all read
    </Button>}
  >
    <nav
      className="page-tabs"
      aria-label="Notification channels"
    >
      <Link
        to="/notifications/inbox"
        aria-current={!email ? 'page' : undefined}
      >
        Inbox
      </Link>
      <Link
        to="/notifications/email"
        aria-current={email ? 'page' : undefined}
      >
        Email outbox
      </Link>
    </nav>
    {browserNotifications && <section className="browser-notification-settings" aria-label="Browser notification settings">
      <p className="help">In-app updates arrive live. Browser alerts can also appear while this workspace is open.</p>
      {browserNotifications.permission === 'default' && <Button onClick={browserNotifications.enable}>Enable browser notifications</Button>}
      {browserNotifications.permission === 'granted' && <p role="status">Browser notifications are enabled.</p>}
      {browserNotifications.permission === 'denied' && <p>Browser notifications are blocked. Allow notifications in your browser's site settings to enable them.</p>}
      {browserNotifications.permission === 'unsupported' && <p>This browser does not support browser alerts here. Live in-app notifications remain available.</p>}
    </section>}
    {rows.length ? rows.map(n => <article
      key={n.id}
      className={'notification' + (n.is_read ? '' : ' unread')}
    >
      <strong>
        {email ? n.delivery_status === 'sent' ? 'Email - sent' : n.delivery_status === 'skipped' ? 'Email - skipped (no deliverable recipient)' : n.delivery_status === 'retry' ? 'Email - retry pending' : 'Email - awaiting delivery' : 'In-app'}
      </strong>
      <p>
        {n.message}
      </p>
      <small>
        {date(n.created_at)}
      </small>
      {n.incident_id && <Link to={'/incidents/' + n.incident_id}>
        Open incident
      </Link>}
    </article>) : <p className="help">
      No messages yet.
    </p>}
  </Card>;
}
export { NotificationsPage };
