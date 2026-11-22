import React from "../lib/react.js";
import { Card, badge } from "../components/ui.js";
import { Link } from "../app/navigation.js";
import { incId } from "../lib/format.js";
import { Workload, ServiceHealth } from "../components/dashboard/Widgets.js";
function OverviewPage({ data, active }) {
  return <React.Fragment>
    <div className="metrics">
      {[['Active incidents', active.length], ['Critical priority', active.filter(i => i.priority === 'P1').length], ['SLA attention', active.filter(i => ['Breached', 'At risk'].includes(i.sla_status)).length], ['Resolved incidents', data.incidents.filter(i => i.resolved_at).length]].map(([label, value]) => <section
        className="metric"
        key={label}
      >
        <small>
          {label}
        </small>
        <strong>
          {value}
        </strong>
      </section>)}
    </div>
    <div className="dashboard-grid">
      <Card
        title="Recent incidents"
        action={<Link to="/incidents">
          View all
        </Link>}
      >
        {data.incidents.slice(0, 6).map(i => <Link
          key={i.id}
          to={'/incidents/' + i.id}
          className="incident-preview"
        >
          <span>
            <small>
              {incId(i.id)}
            </small>
            <strong>
              {i.title}
            </strong>
          </span>
          {badge(i.priority)}
          {badge(i.status)}
        </Link>)}
      </Card>
      <aside
        className="right-column"
        aria-label="Operational insights"
      >
        <Workload data={data} />
        <ServiceHealth data={data} />
      </aside>
    </div>
  </React.Fragment>;
}
export { OverviewPage };
