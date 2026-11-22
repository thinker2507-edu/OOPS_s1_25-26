'use strict';
const {
  Forbidden,
  integer,
  text,
  now,
  FINISHED
} = require('../domain/index.cjs');
function requireAdmin(user) {
  if (user.role !== 'admin') {
    throw new Forbidden('Administrator access is required.');
  }
}
function auditPage(repo, user, query) {
  requireAdmin(user);
  const page = integer({ page: query.page ?? 1 }, 'page', 1, 1000000);
  const pageSize = 25;
  const q = text({ q: query.q ?? '' }, 'q', 200, 0).toLowerCase();
  const rows = repo.list('audit').map(event => ({
    ...event,
    actor: repo.one('users', person => person.id === event.user_id)?.name || 'System',
    incident_title: event.incident_id ? repo.one('incidents', incident => incident.id === event.incident_id)?.title || 'Incident' : null
  })).filter(event => !q || [event.action, event.detail, event.actor, event.incident_id ? 'INC-' + String(event.incident_id).padStart(4, '0') : 'Configuration'].join(' ').toLowerCase().includes(q)).sort((a, b) => b.created_at - a.created_at || b.id - a.id);
  return {
    events: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize
  };
}
function slaPage(repo, user) {
  requireAdmin(user);
  const time = now();
  const events = repo.list('sla_events', event => event.kind.includes('breached')).map(event => {
    const incident = repo.one('incidents', row => row.id === event.incident_id);
    const response = event.kind.startsWith('Response');
    const completed = response ? incident.acknowledged_at || incident.resolved_at : incident.resolved_at;
    const currentDeadline = response ? incident.response_due : incident.resolution_due;
    return {
      ...event,
      title: incident.title,
      priority: incident.priority,
      status: incident.status,
      technician: repo.one('users', person => person.id === incident.technician_id)?.name || 'Unassigned',
      deadline: event.deadline ?? null,
      current_deadline: currentDeadline,
      active: !completed && !FINISHED.includes(incident.status) && time > currentDeadline
    };
  }).sort((a, b) => b.created_at - a.created_at || b.incident_id - a.incident_id);
  const atRisk = repo.list('incidents', incident => !FINISHED.includes(incident.status) && [[incident.response_due, incident.acknowledged_at || incident.resolved_at], [incident.resolution_due, incident.resolved_at]].some(([due, done]) => !done && time < due && due - time < Math.max(60, (due - incident.created_at) * .2)));
  return {
    events,
    summary: {
      activeIncidents: new Set(events.filter(event => event.active).map(event => event.incident_id)).size,
      responseBreaches: events.filter(event => event.kind.startsWith('Response')).length,
      resolutionBreaches: events.filter(event => event.kind.startsWith('Resolution')).length,
      atRisk: atRisk.length
    }
  };
}
function recordConfiguration(repo, user, data) {
  const labels = {
    user: 'User created',
    user_update: 'User access updated',
    technician: 'Technician configuration updated',
    service: 'IT service created',
    service_update: 'IT service updated',
    category: 'Category created',
    category_rename: 'Category renamed',
    subcategory: 'Subcategory configured',
    incident_type: 'Incident type configured',
    policy: 'SLA policy updated',
    strategy: 'Assignment strategy updated'
  };
  // Only explicitly safe fields are logged. Passwords and OAuth secrets never enter the audit.
  const safe = [
    'id',
    'name',
    'old',
    'role',
    'active',
    'available',
    'experience_years',
    'skills',
    'service_id',
    'priority',
    'response_minutes',
    'resolution_minutes',
    'value',
    'category',
    'subcategory_id'
  ].filter(key => data[key] !== undefined).map(key => key + '=' + String(data[key])).join('; ');
  repo.insert('audit', {
    incident_id: null,
    user_id: user.id,
    action: labels[data.action] || 'Configuration updated',
    old_state: null,
    new_state: null,
    detail: safe,
    created_at: now()
  });
}
module.exports = {
  requireAdmin,
  auditPage,
  slaPage,
  recordConfiguration
};
