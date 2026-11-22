import React from "../lib/react.js";
import { Workload, ServiceHealth } from "../components/dashboard/Widgets.js";
import { Card } from "../components/ui.js";
import { pretty } from "../lib/format.js";
function ReportsPage({ data, section }) {
  if (section === 'workload') {
    return <Workload data={data} />;
  }
  if (section === 'services') {
    return <ServiceHealth data={data} />;
  }
  const rows = data.incidents;
  const resolved = rows.filter(i => i.resolved_at);
  const average = resolved.length ? Math.round(resolved.reduce((sum, i) => sum + (i.resolved_at - i.created_at) / 60, 0) / resolved.length) : 0;
  return <div className="reports-grid">
    {[['By priority', ['P1', 'P2', 'P3', 'P4'], 'priority'], ['By status', Object.keys(data.transitions), 'status'], ['SLA compliance', ['On track', 'At risk', 'Breached', 'Completed'], 'sla_status']].map(([title, values, key]) => <Card
      title={title}
      key={key}
    >
      {values.map(value => <div
        className="service-row"
        key={value}
      >
        <span>
          {pretty(value)}
        </span>
        <strong>
          {rows.filter(i => i[key] === value).length}
        </strong>
      </div>)}
    </Card>)}
    <Card title="Resolution performance">
      <p>
        {'Average resolution: ' + average + ' minutes'}
      </p>
      <p className="help">
        {resolved.length + ' resolved incidents; 24/7 wall-clock SLA.'}
      </p>
    </Card>
  </div>;
}
export { ReportsPage };
