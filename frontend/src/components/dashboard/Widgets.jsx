import React from "../../lib/react.js";
import { Card } from "../ui.js";
import { initials } from "../../lib/format.js";
function Workload({ data }) {
  return <Card
    title="Team workload"
    subtitle="Unresolved incidents"
  >
    {data.technicians.length ? data.technicians.map(t => <div
      className="workload"
      key={t.id}
    >
      <span
        className="avatar"
        aria-hidden
      >
        {initials(t.name)}
      </span>
      <div className="info">
        <strong>
          {t.name}
        </strong>
      </div>
      <small>
        {`${t.workload} unresolved${t.available ? '' : ' · Away'}`}
      </small>
    </div>) : <p className="help">
      Your reports are automatically routed to the support team.
    </p>}
  </Card>;
}
function ServiceHealth({ data }) {
  return <Card
    title="Service pulse"
    subtitle="Open incidents by service"
  >
    {data.services.map(s => {
      let n = data.incidents.filter(i => i.service_id === s.id && !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(i.status)).length;
      return <div
        className="service-row"
        key={s.id}
      >
        <span>
          {s.name}
        </span>
        <small>
          {n ? n + ' open' : 'Clear'}
        </small>
      </div>;
    })}
  </Card>;
}
export { Workload, ServiceHealth };
