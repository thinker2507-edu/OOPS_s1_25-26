import React from '../../lib/react.js';
import { Card } from '../../components/ui.js';
import { Link } from '../../app/navigation.js';
import { MyIncidents } from './MyIncidents.js';
export function EmployeeDashboard({ data }) {
  const pending = data.support_requests.filter(r => r.status === 'pending' && r.incident_status !== 'CLOSED');
  const resolved = data.incidents.filter(i => i.status === 'RESOLVED');
  return <div className="employee-dashboard">
    <Link
      className="btn primary report-cta"
      to="/incidents/new"
    >
      Report New Incident
    </Link>
    {(pending.length > 0 || resolved.length > 0) && <Card title="Needs your attention">
      {pending.length > 0 && <p>
        <Link to="/support-requests">
          {pending.length + ' support request' + (pending.length === 1 ? '' : 's') + ' awaiting your response'}
        </Link>
      </p>}
      {resolved.length > 0 && <p>
        {resolved.length + ' resolved incident' + (resolved.length === 1 ? '' : 's') + ' ready for your review.'}
      </p>}
    </Card>}
    <MyIncidents
      data={data}
      compact
    />
  </div>;
}
