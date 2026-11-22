import React, { useEffect, useRef, useState } from '../lib/react.js';
import { api } from '../services/api.js';
import { Button, Card, ErrorBox, Field } from '../components/ui.js';
export function ApiExplorerPage() {
  const [contract, setContract] = useState(null);
  const [selected, setSelected] = useState('0');
  const [values, setValues] = useState({});
  const [body, setBody] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const active = useRef(null);
  const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api('openapi.json', undefined, { signal: controller.signal }).then(setContract).catch(error => {
      if (!controller.signal.aborted) {
        setError(error.message);
      }
    });
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, [retry]);
  const operations = contract?.['x-relay-explorer'] || [];
  const operation = operations[Number(selected)];
  function choose(value) {
    active.current?.abort();
    setSelected(value);
    setValues({});
    setResult(null);
    setError('');
    const request = operations[Number(value)];
    setBody(request.body ? JSON.stringify({
      ...request.body,
      ...(request.path === '/api/incidents' ? { request_key: crypto.randomUUID() } : {})
    }, null, 2) : '');
  }
  async function send(event) {
    event.preventDefault();
    if (locked.current || !operation) {
      return;
    }
    setError('');
    setResult(null);
    let path = operation.path;
    if (operation.id) {
      if (!/^[1-9]\d*$/.test(values.id || '')) {
        setError('Enter a positive incident ID.');
        return;
      }
      path = path.replace('{id}', values.id);
    }
    const query = new URLSearchParams();
    for (const key of operation.query || [])
      if (values[key]) {
        query.set(key, values[key]);
      }
    if (query.size) {
      path += '?' + query;
    }
    let payload;
    if (operation.method === 'POST') {
      try {
        payload = JSON.parse(body);
      }
      catch {
        setError('Enter valid JSON in the request body.');
        return;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        setError('The request body must be a JSON object.');
        return;
      }
    }
    locked.current = true;
    setBusy(true);
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await api(path.slice('/api/'.length), payload, {
        signal: controller.signal,
        includeStatus: true
      });
      setResult({
        ...response,
        method: operation.method,
        path
      });
    }
    catch (error) {
      if (!controller.signal.aborted) {
        setResult({
          status: error.status,
          data: {
            error: error.message,
            code: error.code
          },
          method: operation.method,
          path
        });
      }
    }
    finally {
      locked.current = false;
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }
  if (!contract) {
    return <Card title="REST API explorer">
      <ErrorBox message={error} />
      {error ? <Button onClick={() => setRetry(value => value + 1)}>
        Retry API documentation
      </Button> : <p role="status">
        Loading API documentation…
      </p>}
    </Card>;
  }
  return <>
    <Card
      title="Try Relay REST APIs"
      subtitle="Send requests using your current administrator session."
    >
      <p>
        Requests go to this Relay server. POST requests save real incidents or information using the normal validation, audit and duplicate checks.
      </p>
      <p><a
        href="/api/openapi.json"
        download="relay-openapi.json"
      >
        Download OpenAPI JSON
      </a> for Postman or another API client.</p>
      <form
        onSubmit={send}
        aria-busy={busy}
      >
        <Field
          label="API operation"
          name="api_operation"
          value={selected}
          disabled={busy}
          options={operations.map((request, index) => ({
            value: String(index),
            label: request.method + ' ' + request.path + ' — ' + request.label
          }))}
          onChange={event => choose(event.target.value)}
        />
        {operation?.id && <Field
          label="Incident ID (numeric)"
          name="api_incident_id"
          type="number"
          min="1"
          required
          value={values.id || ''}
          onChange={event => setValues({
            ...values,
            id: event.target.value
          })}
        />}
        {(operation?.query || []).map(key => <Field
          key={key}
          label={{
            q: 'Search text',
            status: 'Status (for example NEW)',
            page: 'Page',
            per_page: 'Results per page'
          }[key] || key}
          name={'api_query_' + key}
          value={values[key] || ''}
          onChange={event => setValues({
            ...values,
            [key]: event.target.value
          })}
        />)}
        {operation?.method === 'POST' && <Field
          label="JSON request body"
          name="api_request_body"
          type="textarea"
          value={body}
          required
          rows="9"
          maxLength={50000}
          help="For creation, obtain an available incident_type_id from GET /api/catalog. Keep the same request_key when retrying identical information."
          onChange={event => setBody(event.target.value)}
        />}
        <ErrorBox message={error} />
        <Button
          primary
          type="submit"
          disabled={busy}
        >
          {busy ? 'Sending request…' : 'Send ' + (operation?.method || 'GET') + ' request'}
        </Button>
      </form>
    </Card>
    {result && <Card title="API response">
      <p role="status">
        {result.method + ' ' + result.path + ' · ' + (result.status ? 'HTTP ' + result.status : 'Connection failed')}
      </p>
      <pre
        className="api-response"
        tabIndex={0}
        aria-label="API JSON response"
      >
        {JSON.stringify(result.data, null, 2)}
      </pre>
    </Card>}
  </>;
}
