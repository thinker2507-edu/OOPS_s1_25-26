import React, { useState, useEffect } from "../lib/react.js";
import { api } from "../services/api.js";
import { Field, ErrorBox, Button } from "../components/ui.js";
import { Link } from "../app/navigation.js";
import { ThemeSwitcher } from "../components/ThemeSwitcher.js";
function Login({
  onLogin,
  register,
  access,
  theme,
  onThemeChange
}) {
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(() => new URLSearchParams(location.search).get('auth_error') || '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    api('auth/config').then(setConfig).catch(e => setError(e.message));
  }, []);
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('auth_error')) {
      setError('');
    }
    setNotice(!register && (new URLSearchParams(location.search).has('password_reset') || new URLSearchParams(location.search).has('password_changed')) ? 'Your password was updated. Sign in with your new password.' : '');
  }, [register]);
  async function submit(e) {
    e.preventDefault();
    // Read the submitted DOM fields: browser/password-manager autofill may not
    // dispatch change events and therefore may not update React state.
    const fields = new FormData(e.currentTarget);
    const enteredEmail = String(fields.get('email') || '');
    const enteredPassword = String(fields.get('password') || '');
    setEmail(enteredEmail);
    setBusy(true);
    setError('');
    try {
      if (register) {
        await api('register', {
          name: fields.get('name'),
          email: enteredEmail,
          password: enteredPassword
        });
        setNotice('Account created. Use Sign in below to enter.');
      }
      else {
        await api('login', {
          email: enteredEmail,
          password: enteredPassword
        });
        await onLogin();
      }
    }
    catch (e) {
      setError(e.message);
    }
    finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError('');
    try {
      const r = await api('auth/google/start', { mode: 'login' });
      location.assign(r.url);
    }
    catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
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
        <span>
          relay
          <small>
            IT SERVICE WORKSPACE
          </small>
        </span>
      </div>
      <div>
        <div className="eyebrow">
          A CLEAR WAY FORWARD
        </div>
        <h1 tabIndex={-1}>
          Every incident.
          <br />
          A better next step.
        </h1>
        <p>
          Report a problem, connect with support, and follow the work from first response to resolution.
        </p>
      </div>
      <footer>
        One workspace for people, services and solutions.
      </footer>
    </section>
    <section className="login-panel">
      <div className="login-box">
        <div className="login-appearance">
          <ThemeSwitcher
            theme={theme}
            onChange={onThemeChange}
          />
        </div>
        <div className="eyebrow">
          YOUR SERVICE DESK
        </div>
        <h2>
          {register ? 'Create an account' : 'Sign in to Relay'}
        </h2>
        <p>
          {register ? 'Employees can register to report and track incidents.' : 'Use your account to open your workspace.'}
        </p>
        <form onSubmit={submit}>
          {register && <Field
            label="Full name"
            name="name"
            required
            maxLength={100}
          />}
          <Field
            label="Email address"
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="username"
            defaultValue={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={register ? 10 : 1}
            maxLength={128}
            autoComplete={register ? 'new-password' : 'current-password'}
          />
          <Button
            className="btn small"
            aria-pressed={showPassword}
            onClick={() => setShowPassword(value => !value)}
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </Button>
          <ErrorBox message={error} />
          {notice && <p role="status">
            {notice}
          </p>}
          <button
            type="submit"
            className="btn primary"
            disabled={busy || !config}
          >
            {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {!register && <p>
          <Link to="/forgot-password">
            Forgot password?
          </Link>
        </p>}
        <p>
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Link>
        </p>
        <div className="google-login">
          <Button
            onClick={google}
            disabled={busy || !config?.google_enabled}
          >
            Continue with Google
          </Button>
          <p className="help">
            {config?.google_enabled ? 'Authenticate directly with Google.' : 'Google sign-in is unavailable. Contact your administrator.'}
          </p>
        </div>
        <p>
          <Button onClick={access}>
            Accessibility options
          </Button>
        </p>
      </div>
    </section>
  </main>;
}
export { Login };
