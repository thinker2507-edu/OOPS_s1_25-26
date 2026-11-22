import React, { useEffect, useState } from '../lib/react.js';
import { api } from '../services/api.js';
import { Field, ErrorBox, Button } from '../components/ui.js';
import { Link } from '../app/navigation.js';
import { ThemeSwitcher } from '../components/ThemeSwitcher.js';
export function PasswordRecoveryPage({ reset, theme, onThemeChange }) {
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '');
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (reset) {
      history.replaceState(null, '', '/reset-password');
    }
    const controller = new AbortController();
    api('auth/config', undefined, { signal: controller.signal }).then(setConfig).catch(error => {
      if (!controller.signal.aborted) {
        setError(error.message);
      }
    });
    return () => controller.abort();
  }, [reset]);
  return <main
    id="main"
    className="login-layout"
    tabIndex={-1}
  >
    <section className="login-brand">
      <div className="brand">
        <span className="brand-mark">
          r
        </span>
        <span>relay<small>
          IT SERVICE WORKSPACE
        </small></span>
      </div>
      <div>
        <h1 tabIndex={-1}>
          Recover your account
        </h1>
        <p>
          Reset your password while keeping your incidents and account permissions.
        </p>
      </div>
    </section>
    <section className="login-panel">
      <div className="login-box">
        <div className="login-appearance">
          <ThemeSwitcher
            theme={theme}
            onThemeChange={onThemeChange}
          />
        </div>
        <h2>
          {reset ? 'Choose a new password' : 'Forgot password'}
        </h2>
        {!reset && <p>
          Enter the email saved on your existing Relay account.
        </p>}
        {!reset && config?.password_recovery?.delivery === 'local' && <p className="callout">
          Local delivery: recovery instructions are available through your administrator. This installation does not send recovery emails to your inbox.
        </p>}
        {!reset && config?.password_recovery?.delivery === 'email' && <p className="help">
          If your email matches an active account, check your inbox and spam folder for reset instructions.
        </p>}
        {reset && !token && <p role="alert">
          Open the full reset link from your recovery email. If it has expired or was already used, request a new link.
        </p>}
        {notice ? <>
          <p role="status">
            {notice}
          </p>
          {reset && <a
            className="btn primary"
            href="/login?password_reset=1"
          >
            Sign in with new password
          </a>}
        </> : <form
          aria-busy={busy}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) {
              return;
            }
            setBusy(true);
            setError('');
            const values = Object.fromEntries(new FormData(event.currentTarget));
            try {
              const result = await api(reset ? 'auth/reset-password' : 'auth/forgot-password', reset ? {
                ...values,
                token
              } : values);
              setNotice(result.message);
            }
            catch (error) {
              setError(error.message);
            }
            finally {
              setBusy(false);
            }
          }}
        >
          {reset ? <>
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
          </> : <Field
            label="Account email address"
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="username"
          />}
          <button
            className="btn primary"
            type="submit"
            disabled={busy || !config || reset && !token || !reset && !config.password_recovery?.enabled}
          >
            {busy ? 'Please wait…' : reset ? 'Reset password' : 'Send reset instructions'}
          </button>
        </form>}
        <ErrorBox message={error} />
        {!reset && config && !config.password_recovery?.enabled && <p role="alert">
          Password recovery is currently unavailable. Please contact your administrator for assistance.
        </p>}
        <p>
          <Link to="/login">
            Back to sign in
          </Link>
        </p>
        {reset && <p>
          <Link to="/forgot-password">
            Request a new reset link
          </Link>
        </p>}
        <p>
          <Link to="/settings/accessibility">
            Accessibility options
          </Link>
        </p>
      </div>
    </section>
  </main>;
}
