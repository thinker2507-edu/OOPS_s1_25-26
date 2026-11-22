import React, { useState } from '../../lib/react.js';
import { Card, Field, Button, badge } from '../../components/ui.js';
import { Link } from '../../app/navigation.js';
import { date, incId, pretty } from '../../lib/format.js';
export function MyIncidents({ data, compact = false }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);
  const size = compact ? 5 : 10;
  const rows = data.incidents.filter(i => (!query || (incId(i.id) + ' ' + i.title).toLowerCase().includes(query.toLowerCase())) && (!status || i.status === status) && (!category || i.category === category)).sort((a, b) => sort === 'oldest' ? a.created_at - b.created_at || a.id - b.id : sort === 'newest' ? b.created_at - a.created_at || b.id - a.id : b.updated_at - a.updated_at || b.id - a.id);
  const total = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, total);
  const choose = setter => e => {
    setter(e.target.value);
    setPage(1);
  };
  return <Card
    title={compact ? 'Recent incidents' : 'My incidents'}
    action={compact ? <Link to="/incidents/mine">
      View all
    </Link> : undefined}
  >
    {!compact && <div className="incident-list-actions">
      <Link
        className="btn small"
        to="/support-requests"
      >
        {'Support requests' + (data.support_requests.some(r => r.status === 'pending' && r.incident_status !== 'CLOSED') ? ' · Response needed' : '')}
      </Link>
    </div>}
    {!compact && <div className="employee-filters">
      <Field
        label="Search ID or title"
        name="incident_search"
        value={query}
        onChange={choose(setQuery)}
        type="search"
      />
      <Field
        label="Status"
        name="incident_status"
        value={status}
        onChange={choose(setStatus)}
        options={[{
          value: '',
          label: 'All statuses'
        }, ...Object.keys(data.transitions).map(s => ({
          value: s,
          label: pretty(s)
        }))]}
      />
      <Field
        label="Category"
        name="incident_category"
        value={category}
        onChange={choose(setCategory)}
        options={[{
          value: '',
          label: 'All categories'
        }, ...data.categories]}
      />
      <Field
        label="Sort by"
        name="incident_sort"
        value={sort}
        onChange={choose(setSort)}
        options={[{
          value: 'updated',
          label: 'Recently updated'
        }, {
          value: 'newest',
          label: 'Newest submitted'
        }, {
          value: 'oldest',
          label: 'Oldest submitted'
        }]}
      />
    </div>}
    {!rows.length ? <p className="help">
      {query || status || category ? 'No incidents match your filters.' : 'You have not reported any incidents yet.'}
    </p> : <div className="table-scroll">
      <table className="employee-incidents">
        <caption className="visually-hidden">
          Your submitted incidents
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Incident
            </th>
            <th scope="col">
              Classification
            </th>
            <th scope="col">
              Submitted
            </th>
            <th scope="col">
              Status
            </th>
            <th scope="col">
              Updated
            </th>
            <th scope="col">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(compact ? 0 : (current - 1) * size, compact ? size : current * size).map(i => <tr key={i.id}>
            <td data-label="Incident">
              <Link to={'/incidents/' + i.id}>
                {incId(i.id)}
              </Link>
              <strong className="incident-list-title">
                {i.title}
              </strong>
            </td>
            <td data-label="Classification">
              <span>
                {i.category}
                <small className="incident-list-title">
                  {i.subcategory || 'Not recorded'}
                </small>
              </span>
            </td>
            <td data-label="Submitted">
              {date(i.created_at)}
            </td>
            <td data-label="Status">
              {badge(i.status)}
            </td>
            <td data-label="Updated">
              {date(i.updated_at)}
            </td>
            <td data-label="Action">
              <Link
                to={'/incidents/' + i.id}
                aria-label={'View ' + incId(i.id)}
              >
                View details
              </Link>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>}
    {!compact && rows.length > 0 && <div
      className="pagination"
      aria-label="Incident pages"
    >
      <Button
        disabled={current <= 1}
        onClick={() => setPage(current - 1)}
      >
        Previous
      </Button>
      <span role="status">
        {'Page ' + current + ' of ' + total + ' · ' + rows.length + ' incidents'}
      </span>
      <Button
        disabled={current >= total}
        onClick={() => setPage(current + 1)}
      >
        Next
      </Button>
    </div>}
  </Card>;
}
