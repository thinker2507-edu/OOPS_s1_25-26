import React, { useEffect, useState } from "../../lib/react.js";
import { api } from '../../services/api.js';
import { pretty, incId, date } from "../../lib/format.js";
import { Button, badge } from "../ui.js";
function IncidentTable({
  rows,
  data,
  open,
  filters,
  setFilters,
  exportCsv
}) {
  const query = (filters.q || '').trim();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([query, page]);
  useEffect(() => setPage(1), [query]);
  useEffect(() => {
    setError('');
    setSearch(null);
    if (!query) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await api('search/incidents?q=' + encodeURIComponent(query) + '&page=' + page, undefined, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setSearch({
            ...result,
            key
          });
        }
      }
      catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, page, retry, data.incidents]);
  const ready = search?.key === key;
  const matches = new Map((ready ? search.results : []).map(result => [result.id, result]));
  const displayed = query ? rows.filter(row => matches.has(row.id)).sort((a, b) => matches.get(b.id).score - matches.get(a.id).score) : rows;
  function filter(label, key, options) {
    return <label key={key}>
      {label}
      <select
        value={filters[key] || ''}
        onChange={e => setFilters({
          ...filters,
          [key]: e.target.value
        })}
      >
        <option value="">
          All
        </option>
        {options.map(o => <option
          key={o.value || o}
          value={o.value || o}
        >
          {o.label || pretty(o)}
        </option>)}
      </select>
    </label>;
  }
  return <section className="card">
    <div className="card-header">
      <div>
        <h2>
          Incident queue
        </h2>
        <p>
          Ordered by overdue status, next SLA deadline, severity and submission time.
        </p>
      </div>
      <Button
        className="btn small"
        disabled={Boolean(query && !ready)}
        onClick={() => exportCsv(displayed)}
      >
        ↓ Export CSV
      </Button>
    </div>
    <div className="filters">
      <label className="search">
        Smart search
        <input
          type="search"
          aria-describedby="smart-search-help"
          maxLength={200}
          placeholder="ID, problem, notes or resolution"
          value={filters.q || ''}
          onChange={e => setFilters({
            ...filters,
            q: e.target.value
          })}
        />
      </label>
      {filter('Status', 'status', Object.keys(data.transitions))}
      {filter('Priority', 'priority', ['P1', 'P2', 'P3', 'P4'])}
      {filter('Service', 'service_id', data.services.map(s => ({
        value: String(s.id),
        label: s.name
      })))}
      {filter('Category', 'category', data.categories)}
      {filter('SLA', 'sla_status', ['On track', 'At risk', 'Breached', 'Completed'])}
      {data.technicians.length > 0 && filter('Technician', 'technician_id', data.technicians.map(t => ({
        value: String(t.id),
        label: t.name
      })))}
      <label>
        From date
        <input
          type="date"
          value={filters.from || ''}
          onChange={e => setFilters({
            ...filters,
            from: e.target.value
          })}
        />
      </label>
      <Button
        className="btn small"
        onClick={() => setFilters({})}
      >
        Reset
      </Button>
    </div>
    <p
      id="smart-search-help"
      className="muted"
    >
      Search your accessible incidents with common IT terms, synonyms or spelling mistakes. Results are ranked by relevance.
    </p>
    {error && <p role="alert">{error} <Button onClick={() => setRetry(value => value + 1)}>
      Retry search
    </Button></p>}
    {query && !ready && !error && <p role="status">
      Searching incidents…
    </p>}
    {displayed.length ? <div className="table-wrap">
      <table>
        <caption className="sr-only">
          Incidents matching your filters
        </caption>
        <thead>
          <tr>
            {[
              'Incident',
              'Priority',
              'Status',
              'Assignee',
              'SLA'
            ].map(c => <th
              key={c}
              scope="col"
            >
              {c}
            </th>)}
          </tr>
        </thead>
        <tbody>
          {displayed.map(i => <tr key={i.id}>
            <td>
              <span className="id-link">
                {incId(i.id)}
              </span>
              <br />
              <button
                className="title-button"
                onClick={() => open(i.id)}
              >
                {i.title}
              </button>
              <small>
                {i.service + ' · ' + date(i.created_at)}
              </small>
              {query && <small>
                {'Matched: ' + matches.get(i.id).reasons.join(', ')}
              </small>}
            </td>
            <td>
              {badge(i.priority)}
            </td>
            <td>
              {badge(i.status)}
            </td>
            <td>
              {i.technician || 'Unassigned'}
            </td>
            <td>
              {badge(i.sla_status)}
              <small className="help">{i.urgency_reason}</small>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div> : (!query || ready) && <div className="empty">
      No incidents match these filters.
    </div>}
    <div className="table-footer">
      <span>
        {displayed.length + ' incident' + (displayed.length === 1 ? '' : 's')}
      </span>
      <span>
        Live SLA queue · automatic assignment
      </span>
    </div>
    {query && ready && search.pages > 1 && <nav
      aria-label="Smart search pages"
      className="table-footer"
    >
      <Button
        disabled={page <= 1}
        onClick={() => setPage(value => value - 1)}
      >
        Previous matches
      </Button>
      <span role="status">
        {'Page ' + page + ' of ' + search.pages + ' · ' + search.total + ' matches before other filters'}
      </span>
      <Button
        disabled={page >= search.pages}
        onClick={() => setPage(value => value + 1)}
      >
        Next matches
      </Button>
    </nav>}
  </section>;
}
export { IncidentTable };
