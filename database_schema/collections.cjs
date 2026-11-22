'use strict';
const KEYS = Object.freeze({
  users: ['id'],
  components: ['id'],
  service_components: ['service_id', 'component_id'],
  rate_limits: ['key'],
  services: ['id'],
  categories: ['name'],
  subcategories: ['id'],
  incident_types: ['id'],
  attachments: ['id'],
  support_requests: ['id'],
  policies: ['priority'],
  settings: ['key'],
  incidents: ['id'],
  notes: ['id'],
  audit: ['id'],
  notifications: ['id'],
  sessions: ['token'],
  password_resets: ['token_hash'],
  oauth_states: ['state'],
  oauth_identities: ['provider', 'subject'],
  service_policies: ['service_id', 'priority'],
  category_aliases: ['alias'],
  sla_events: ['incident_id', 'kind']
});
const DEFAULTS = {
  password_resets: {
    used_at: null,
    revoked_at: null
  },
  users: {
    role: 'employee',
    skills: '',
    available: 1,
    experience_years: 0,
    last_assigned_at: 0,
    active: 1
  },
  incidents: {
    status: 'NEW',
    technician_id: null,
    acknowledged_at: null,
    resolved_at: null,
    closed_at: null,
    resolution: '',
    feedback: null,
    feedback_text: '',
    duplicate_of: null
  },
  notifications: { is_read: 0 },
  notes: { kind: 'note' },
  support_requests: { status: 'pending' },
  subcategories: { active: true },
  incident_types: { active: true },
  audit: {
    incident_id: null,
    user_id: null,
    old_state: null,
    new_state: null
  }
};
const ROLES = Object.freeze(['employee', 'technician', 'admin']);
module.exports = {
  KEYS,
  DEFAULTS,
  ROLES
};
