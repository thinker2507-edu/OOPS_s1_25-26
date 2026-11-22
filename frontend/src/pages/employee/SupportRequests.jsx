import React from '../../lib/react.js';
import { Card, badge } from '../../components/ui.js';
import { Link } from '../../app/navigation.js';
import { date, incId } from '../../lib/format.js';
export function SupportRequests({ data }) {
  return <Card
    title="Support requests"
    subtitle="Questions from support about your incidents."
  >
    {!data.support_requests.length && <p className="help">
      You have no support requests.
    </p>}
    {data.support_requests.map(r => <article
      className="support-request"
      key={r.id}
    >
      <div className="request-heading">
        <Link to={'/incidents/' + r.incident_id + '/conversation'}>
          {incId(r.incident_id) + ' · ' + r.incident_title}
        </Link>
        {badge(r.status === 'pending' ? 'Pending' : 'Responded')}
      </div>
      <p className="description">
        {r.body}
      </p>
      <small>
        {r.requester + ' · ' + date(r.created_at)}
      </small>
      <p>
        <Link to={'/incidents/' + r.incident_id + '/conversation'}>
          {r.status === 'pending' && r.incident_status !== 'CLOSED' ? 'Respond to request' : 'View conversation'}
        </Link>
        {r.incident_status === 'CLOSED' && <small>

          · Incident closed
        </small>}
      </p>
    </article>)}
  </Card>;
}
