import React from "../lib/react.js";
import { Card } from "../components/ui.js";
import { CreateIncident } from "../components/incidents/CreateIncident.js";
import { Link } from "../app/navigation.js";
export function NewIncidentPage({ data, onCreate }) {
  return <><Card title="Tell us what happened">
    <CreateIncident
      data={data}
      onCreate={onCreate}
    />
  </Card><Link
    to="/incidents"
    className="back-link"
  >
      Cancel and return to incidents
    </Link></>;
}
