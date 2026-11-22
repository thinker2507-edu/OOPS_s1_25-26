import React from '../../lib/react.js';
import { Card, badge } from '../../components/ui.js';
import { Link } from '../../app/navigation.js';
import { incId, date } from '../../lib/format.js';
import { FINISHED_UI } from '../../lib/incidents.js';
export function TechnicianWorkload({ data }) {
  const person = data.technicians.find(tech => tech.id === data.user.id);
  const assigned = data.incidents.filter(incident => incident.technician_id === data.user.id);
  const active = assigned.filter(incident => !FINISHED_UI.includes(incident.status));
  return <Card
    title="My workload"
    subtitle="Current assigned work"
  >
    {person ? <>
      <p className="workload-count">
        <strong>
          {active.length}
        </strong>
        {' unresolved incidents'}
      </p>
      <dl className="employee-metadata">
        {[
          ['Availability', person.available ? 'Available' : 'Away'],
          ['Awaiting acknowledgment', assigned.filter(i => i.status === 'ASSIGNED').length],
          ['In progress', assigned.filter(i => ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status)).length],
          ['Waiting', assigned.filter(i => i.status === 'WAITING').length],
          ['Resolved or completed', assigned.filter(i => FINISHED_UI.includes(i.status)).length],
          ['Skills', person.skills || 'General support']
        ].map(([label, value]) => <div key={label}>
          <dt>
            {label}
          </dt>
          <dd>
            {value}
          </dd>
        </div>)}
      </dl>
      <p className="help">
        Workload has no cap. Availability is informational; active accounts receive assignments.
      </p>
    </> : <p className="help">
      No active technician configuration is available. Contact an administrator.
    </p>}
  </Card>;
}
export function TechnicianDashboard({ data }) {
  const assigned = data.incidents.filter(incident => incident.technician_id === data.user.id);
  const active = assigned.filter(incident => !FINISHED_UI.includes(incident.status));
  return <div className="technician-workspace">
    <TechnicianWorkload data={data} />
    <Card
      title="Assigned work"
      action={<Link to="/incidents/mine">
        View all assignments
      </Link>}
    >
      {active.length ? active.slice(0, 8).map(incident => <article
        className="support-request"
        key={incident.id}
      >
        <div className="request-heading">
          <Link to={'/incidents/' + incident.id}>
            {incId(incident.id) + ' · ' + incident.title}
          </Link>
          <span>
            {badge(incident.priority)}
            {' '}
            {badge(incident.status)}
          </span>
        </div>
        <p className="help">
          {incident.urgency_reason || 'Response due ' + date(incident.response_due) + ' · Resolution due ' + date(incident.resolution_due)}
        </p>
        <Link
          className="btn small"
          to={'/incidents/' + incident.id}
        >
          {incident.status === 'ASSIGNED' ? 'Review assignment' : 'Continue investigation'}
        </Link>
      </article>) : <p className="help">
        No active incidents are assigned to you.
      </p>}
    </Card>
  </div>;
}
