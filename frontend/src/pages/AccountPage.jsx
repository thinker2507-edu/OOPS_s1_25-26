import React, { useState } from "../lib/react.js";
import { api } from "../services/api.js";
import { Card, ErrorBox, Button, Field, Form } from "../components/ui.js";
import { pretty } from "../lib/format.js";
import { Link } from '../app/navigation.js';
function AccountPage({ data, signOut }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function link() {
    if (busy || data.google_linked) {
      return;
    }
    setError('');
    setBusy(true);
    try {
      const r = await api('auth/google/start', { mode: 'link' });
      location.assign(r.url);
    }
    catch (e) {
      setError(e.message);
    }
    finally {
      setBusy(false);
    }
  }
  return <><Card title="Your account">
    <dl className="account-details">
      {[['Name', data.user.name], ['Email', data.user.email], ['Role', pretty(data.user.role)], ['Sign-in', data.user.auth_method === 'google' ? 'Google' : 'Account password']].map(([label, value]) => <div key={label}>
        <dt>
          {label}
        </dt>
        <dd>
          {value}
        </dd>
      </div>)}
    </dl>
    <ErrorBox message={error} />
    {data.google_linked && <p
      role="status"
      className="google-connected"
    >
      Google account connected. You can use Google to sign in to this account.
    </p>}
    <div className="button-row">
      <Link
        className="btn"
        to="/notifications/inbox"
      >
        Notifications
      </Link>
      {data.google_linked ? <a
        className="btn"
        href="https://myaccount.google.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open Google account
      </a> : <Button
        onClick={link}
        disabled={busy || !data.google_enabled}
      >
        {busy ? 'Connecting…' : 'Link Google account'}
      </Button>}
      <Button onClick={signOut}>
        Switch accounts
      </Button>
    </div>
    <p className="help">
      Permissions are assigned to your account by an administrator.
    </p>
  </Card>
    <Card
      title="Change password"
      subtitle="Your current password is required. All existing Relay sessions will end."
    >
      <Form
        submit="Change password"
        onSubmit={async (values) => {
          await api('auth/change-password', values);
          location.assign('/login?password_changed=1');
        }}
      >
        <Field
          label="Current password"
          name="current_password"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
        />
        <Field
          label="New password"
          name="new_password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
        <Field
          label="Confirm new password"
          name="confirm_password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
      </Form>
      <p className="help">If you do not know your current password, <Link to="/forgot-password">
        request a password reset
      </Link>. This changes your Relay password, not your Google password.</p>
    </Card>
  </>;
}
export { AccountPage };
