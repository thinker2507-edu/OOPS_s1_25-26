'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { KEYS, DEFAULTS, ROLES } = require('./collections.cjs');
const { INDEXES } = require('./indexes.cjs');
const { VERSION, ROLE_ALIASES } = require('./migrations.cjs');
const { TRANSITIONS } = require('../backend/src/domain/index.cjs');
const { CATEGORIES, SERVICES, POLICIES } = require('./baseline.cjs');
const { CATALOG } = require('./catalog.cjs');
const FIELDS = {
  users: 'id name email password role skills available experience_years last_assigned_at active created_at updated_at',
  components: 'id name description',
  service_components: 'service_id component_id',
  rate_limits: 'key count expires',
  services: 'id name criticality',
  categories: 'name',
  subcategories: 'id category name active created_at updated_at',
  incident_types: 'id subcategory_id name objective_description service_id active created_at updated_at',
  incidents: 'id title description reporter_id service_id category subcategory_id subcategory incident_type_id incident_type objective_description additional_details impact urgency affected priority score status technician_id created_at updated_at response_due resolution_due acknowledged_at resolved_at closed_at resolution resolution_actions resolution_remarks feedback feedback_text feedback_resolved feedback_at feedback_by duplicate_of request_key request_fingerprint assignment_problem',
  notes: 'id incident_id user_id body kind support_request_id created_at',
  audit: 'id incident_id user_id action old_state new_state detail created_at',
  support_requests: 'id incident_id user_id body status created_at responded_at',
  attachments: 'id incident_id user_id context entry_id name mime size data sha256 created_at',
  policies: 'priority response_minutes resolution_minutes',
  service_policies: 'service_id priority response_minutes resolution_minutes',
  sla_events: 'incident_id kind created_at deadline priority',
  settings: 'key value applied_at',
  notifications: 'id user_id incident_id message channel is_read created_at sent_at retry_at delivery_claim delivery_status',
  sessions: 'token user_id csrf expires auth_method',
  password_resets: 'token_hash user_id created_at expires used_at revoked_at',
  oauth_states: 'state binding verifier session_token expires mode',
  oauth_identities: 'provider subject user_id',
  category_aliases: 'alias category'
};
const REFERENCES = [
  [
    'service_components',
    'service_id',
    'services',
    'id',
    false
  ],
  [
    'service_components',
    'component_id',
    'components',
    'id',
    false
  ],
  [
    'password_resets',
    'user_id',
    'users',
    'id',
    false
  ],
  [
    'incidents',
    'reporter_id',
    'users',
    'id',
    false
  ],
  [
    'incidents',
    'technician_id',
    'users',
    'id',
    true
  ],
  [
    'incidents',
    'service_id',
    'services',
    'id',
    false
  ],
  [
    'incidents',
    'category',
    'categories',
    'name',
    false
  ],
  [
    'incidents',
    'duplicate_of',
    'incidents',
    'id',
    true
  ],
  [
    'incidents',
    'incident_type_id',
    'incident_types',
    'id',
    true
  ],
  [
    'subcategories',
    'category',
    'categories',
    'name',
    false
  ],
  [
    'incident_types',
    'subcategory_id',
    'subcategories',
    'id',
    false
  ],
  [
    'incident_types',
    'service_id',
    'services',
    'id',
    false
  ],
  [
    'notes',
    'incident_id',
    'incidents',
    'id',
    false
  ],
  [
    'notes',
    'user_id',
    'users',
    'id',
    false
  ],
  [
    'notes',
    'support_request_id',
    'support_requests',
    'id',
    true
  ],
  [
    'support_requests',
    'incident_id',
    'incidents',
    'id',
    false
  ],
  [
    'support_requests',
    'user_id',
    'users',
    'id',
    false
  ],
  [
    'attachments',
    'incident_id',
    'incidents',
    'id',
    false
  ],
  [
    'attachments',
    'user_id',
    'users',
    'id',
    false
  ],
  [
    'audit',
    'incident_id',
    'incidents',
    'id',
    true
  ],
  [
    'audit',
    'user_id',
    'users',
    'id',
    true
  ],
  [
    'notifications',
    'incident_id',
    'incidents',
    'id',
    true
  ],
  [
    'notifications',
    'user_id',
    'users',
    'id',
    false
  ],
  [
    'sla_events',
    'incident_id',
    'incidents',
    'id',
    false
  ],
  [
    'sessions',
    'user_id',
    'users',
    'id',
    false
  ],
  [
    'oauth_identities',
    'user_id',
    'users',
    'id',
    false
  ],
  [
    'service_policies',
    'service_id',
    'services',
    'id',
    false
  ],
  [
    'category_aliases',
    'category',
    'categories',
    'name',
    false
  ]
];
const NUMBERS = new Set('id user_id reporter_id service_id component_id technician_id incident_id subcategory_id incident_type_id support_request_id entry_id feedback_by duplicate_of criticality count impact urgency affected score response_minutes resolution_minutes size feedback'.split(' '));
const TIMES = new Set('deadline sent_at retry_at last_assigned_at created_at updated_at applied_at responded_at response_due resolution_due acknowledged_at resolved_at closed_at feedback_at expires used_at revoked_at'.split(' '));
function fieldType(collection, field) {
  if (field === 'experience_years') {
    return 'number: years, 0..80';
  }
  if (collection === 'settings' && field === 'value') {
    return 'string | number | object (assignment weights)';
  }
  if (TIMES.has(field)) {
    return 'number: Unix seconds (nullable when not reached)';
  }
  if (NUMBERS.has(field)) {
    return 'number: integer ID/value; optional references may be null';
  }
  if (field === 'role') {
    return 'enum: employee | technician | admin';
  }
  if (field === 'status') {
    return collection === 'incidents' ? 'enum: ' + Object.keys(TRANSITIONS).join(' | ') : 'enum: pending | responded';
  }
  if (field === 'active') {
    return ['subcategories', 'incident_types'].includes(collection) ? 'boolean' : 'integer: 0 | 1';
  }
  if (['available', 'is_read'].includes(field)) {
    return 'integer: 0 | 1';
  }
  if (field === 'feedback_resolved') {
    return 'boolean (optional)';
  }
  if (field === 'password') {
    return 'string: PBKDF2 hash; never plaintext';
  }
  if (field === 'kind' && collection === 'notes') {
    return 'enum: note | information | investigation | support_response';
  }
  if (field === 'priority') {
    return 'enum: P1 | P2 | P3 | P4';
  }
  if (['old_state', 'new_state'].includes(field)) {
    return 'incident status or null (configuration audit)';
  }
  return 'string';
}
function schemaDefinition() {
  return {
    version: VERSION,
    roles: ROLES,
    statuses: Object.keys(TRANSITIONS),
    transitions: TRANSITIONS,
    collections: Object.fromEntries(Object.entries(KEYS).map(([name, keys]) => [name, {
      keys,
      defaults: DEFAULTS[name] || {},
      fields: FIELDS[name].split(' '),
      types: Object.fromEntries(FIELDS[name].split(' ').map(field => [field, fieldType(name, field)]))
    }])),
    indexes: INDEXES,
    roleAliases: ROLE_ALIASES,
    references: REFERENCES,
    baseline: {
      categories: CATEGORIES,
      services: SERVICES,
      policies: POLICIES
    },
    catalog: CATALOG,
    timestamps: 'Unix seconds',
    storageIds: 'Numeric id or declared primary/compound key; references use numeric id, not ObjectId.',
    internalCollections: {
      _meta: {
        keys: ['_id'],
        fields: ['_id', 'revision'],
        workspaceLockId: 'workspace'
      }
    },
    credentials: 'Existing password hashes/OAuth links are preserved; no account passwords or secrets are seeded by this export.'
  };
}
function exportSchema() {
  const schema = schemaDefinition();
  fs.writeFileSync(path.join(__dirname, 'latest-schema.json'), JSON.stringify(schema, null, 2) + '\n');
  const template = fs.readFileSync(path.join(__dirname, 'compass-upgrade.template.js'), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'compass-upgrade.js'), template.replace('__RELAY_SCHEMA_JSON__', JSON.stringify(schema, null, 2)));
  return schema;
}
if (require.main === module) {
  exportSchema();
  console.log('Updated latest-schema.json and standalone compass-upgrade.js.');
}
module.exports = {
  schemaDefinition,
  exportSchema
};
