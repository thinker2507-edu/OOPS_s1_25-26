import React, { useEffect, useState } from '../lib/react.js';
import { api } from '../services/api.js';
import { Card, Field, Button, ErrorBox, badge } from '../components/ui.js';
import { Link } from '../app/navigation.js';
import { date, incId, pretty } from '../lib/format.js';
export function AdminMonitorPage({ kind }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [activeOnly, setActiveOnly] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    let pending = false;
    setResult(null);
    async function load() {
      if (pending) {
        return;
      }
      pending = true;
      try {
        const next = await api(kind === 'audit' ? 'admin/audit?' + new URLSearchParams({
          page,
          q: query
        }) : 'admin/sla', undefined, { signal: controller.signal });
        if (alive) {
          setResult(next);
          setError('');
        }
      }
      catch (error) {
        if (alive && !controller.signal.aborted) {
          setError(error.message);
        }
      }
      finally {
        pending = false;
      }
    }
    const visible = () => {
      if (!document.hidden) {
        load();
      }
    };
    load();
    const timer = setInterval(visible, 15000);
    window.addEventListener('focus', visible);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', visible);
    };
  }, [kind, query, page, retry]);
  const rows = result?.events.filter(event => kind === 'audit' || !activeOnly || event.active) || [];
  return <Card
    title={kind === 'audit' ? 'Audit logs' : 'SLA violations'}
    subtitle={kind === 'audit' ? 'Recorded incident activity and administrator configuration changes.' : 'Recorded response and resolution breaches, including historical violations.'}
  >
    {kind === 'audit' ? <Field
      label="Search audit logs"
      name="audit_search"
      type="search"
      value={query}
      onChange={event => {
        setQuery(event.target.value);
        setPage(1);
      }}
    /> : <label className="check"><input
      name="active_breaches"
      type="checkbox"
      checked={activeOnly}
      onChange={event => setActiveOnly(event.target.checked)}
    />Active violations only</label>}
    {error && <><ErrorBox message={error} /><Button onClick={() => setRetry(retry + 1)}>
      Retry
    </Button></>}
    {!result && !error && <p role="status">
      Loading recorded events…
    </p>}
    {result && kind === 'sla' && <p role="status">
      {result.summary.activeIncidents + ' incidents with active breaches · ' + result.summary.atRisk + ' incidents approaching a deadline'}
    </p>}
    {result && (rows.length ? <div className="table-wrap">
      <table>
        <caption className="visually-hidden">
          {kind === 'audit' ? 'Audit events' : 'SLA breaches'}
        </caption>
        <thead>
          <tr>
            {(kind === 'audit' ? [
              'Time',
              'Actor',
              'Incident',
              'Action',
              'Details'
            ] : [
              'Recorded',
              'Incident',
              'Violation',
              'Priority',
              'Technician',
              'Deadline',
              'State'
            ]).map(label => <th
              scope="col"
              key={label}
            >
              {label}
            </th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(event => <tr key={kind === 'audit' ? event.id : event.incident_id + '-' + event.kind}>
            <td>
              {date(event.created_at)}
            </td>
            {kind === 'audit' && <td>
              {event.actor}
            </td>}
            <td>
              {event.incident_id ? <Link to={'/incidents/' + event.incident_id}>
                {incId(event.incident_id)}
              </Link> : 'Configuration'}
            </td>
            {kind === 'audit' ? <><td>
              {event.action}
            </td><td className="audit-detail">
                {event.detail}
                {event.old_state && <small>
                  {pretty(event.old_state) + ' → ' + pretty(event.new_state)}
                </small>}
              </td></> : <><td>
                {event.kind}
              </td><td>
                {badge(event.priority)}
              </td><td>
                {event.technician}
              </td><td>
                {date(event.deadline)}
              </td><td>
                {event.active ? 'Active' : 'Historical'}
              </td></>}
          </tr>)}
        </tbody>
      </table>
    </div> : <p className="help">
      {kind === 'audit' ? 'No audit events match this search.' : 'No SLA violations match this view.'}
    </p>)}
    {result && kind === 'audit' && <div className="pagination">
      <Button
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span role="status">
        {'Page ' + page + ' of ' + Math.max(1, Math.ceil(result.total / result.pageSize)) + ' · ' + result.total + ' events'}
      </span>
      <Button
        disabled={page * result.pageSize >= result.total}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>}
  </Card>;
}
