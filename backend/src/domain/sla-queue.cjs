'use strict';
function urgency(incident, time = Date.now() / 1000) {
  const deadlines = [];
  if (incident.status !== 'CLOSED') {
    if (!incident.acknowledged_at && !incident.resolved_at) {
      deadlines.push(['Response', incident.response_due]);
    }
    if (!incident.resolved_at) {
      deadlines.push(['Resolution', incident.resolution_due]);
    }
  }
  deadlines.sort((a, b) => a[1] - b[1]);
  const [milestone, deadline] = deadlines[0] || [];
  return {
    overdue: deadline !== undefined && deadline < time,
    next_deadline: deadline ?? null,
    urgency_reason: deadline === undefined ? 'SLA milestones completed' : milestone + (deadline < time ? ' overdue since ' : ' due ') + new Date(deadline * 1000).toISOString()
  };
}
function compareSla(a, b) {
  const x = urgency(a);
  const y = urgency(b);
  return Number(y.overdue) - Number(x.overdue) || (x.next_deadline ?? Infinity) - (y.next_deadline ?? Infinity)
    || a.priority.localeCompare(b.priority) || a.created_at - b.created_at || a.id - b.id;
}
module.exports = {
  urgency,
  compareSla
};
