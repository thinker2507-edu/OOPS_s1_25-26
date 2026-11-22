import React, { useState } from "../lib/react.js";
import { pretty } from "../lib/format.js";
const badge = s => <span className={'badge ' + s.toLowerCase().replaceAll(' ', '-')}>
  {pretty(s)}
</span>;
function Button({ children, onClick, primary = false, ...props }) {
  return <button
    type="button"
    className={'btn' + (primary ? ' primary' : '')}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>;
}
function Field({
  label,
  name,
  type = 'text',
  value,
  onChange,
  options,
  help,
  ...rest
}) {
  return <label className="field">
    {label}

    {options ? <select
      name={name}
      value={value}
      onChange={onChange}
      {...rest}
    >
      {options.map(o => <option
        key={typeof o === 'object' ? o.value : o}
        value={typeof o === 'object' ? o.value : o}
      >
        {typeof o === 'object' ? o.label : o}
      </option>)}
    </select> : type === 'textarea' ? <textarea
      name={name}
      value={value}
      onChange={onChange}
      {...rest}
    /> : <input
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      {...rest}
    />}

    {help && <span className="help">
      {help}
    </span>}
  </label>;
}
function Card({ title, subtitle, action, children }) {
  return <section className="card">
    {title && <div className="card-header">
      <div>
        <h2>
          {title}
        </h2>

        {subtitle && <p>
          {subtitle}
        </p>}
      </div>

      {action}
    </div>}

    <div className="card-body">
      {children}
    </div>
  </section>;
}
function ErrorBox({ message }) {
  return <div
    className="error"
    role="alert"
  >
    {message}
  </div>;
}
function Form({ onSubmit, children, submit = 'Save changes' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <form onSubmit={async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
    }
    catch (e) {
      setError(e.message);
    }
    finally {
      setBusy(false);
    }
  }}>
    {children}

    <ErrorBox message={error} />

    <div className="modal-actions">
      <button
        className="btn primary"
        disabled={busy}
        type="submit"
      >
        {busy ? 'Saving…' : submit}
      </button>
    </div>
  </form>;
}
export { Button, Field, Card, ErrorBox, Form, badge };
