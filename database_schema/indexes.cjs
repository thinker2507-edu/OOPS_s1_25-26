'use strict';
const { KEYS } = require('./collections.cjs');
const INDEXES = [
  {
    collection: 'notifications',
    key: { user_id: 1, id: -1 },
    options: {}
  },
  {
    collection: 'password_resets',
    key: {
      user_id: 1,
      created_at: -1
    },
    options: {}
  },
  ...Object.entries(KEYS).map(([collection, keys]) => ({
    collection,
    key: Object.fromEntries(keys.map(key => [key, 1])),
    options: { unique: true }
  })),
  {
    collection: 'users',
    key: { email: 1 },
    options: { unique: true }
  },
  {
    collection: 'services',
    key: { name: 1 },
    options: { unique: true }
  },
  {
    collection: 'incidents',
    key: {
      reporter_id: 1,
      created_at: -1
    },
    options: {}
  },
  {
    collection: 'incidents',
    key: {
      technician_id: 1,
      status: 1
    },
    options: {}
  },
  {
    collection: 'audit',
    key: {
      incident_id: 1,
      id: -1
    },
    options: {}
  },
  {
    collection: 'sessions',
    key: { expires: 1 },
    options: {}
  },
  {
    collection: 'subcategories',
    key: {
      category: 1,
      name: 1
    },
    options: { unique: true }
  },
  {
    collection: 'incident_types',
    key: {
      subcategory_id: 1,
      name: 1
    },
    options: { unique: true }
  },
  {
    collection: 'incidents',
    key: {
      reporter_id: 1,
      updated_at: -1
    },
    options: {}
  },
  {
    collection: 'incidents',
    key: {
      reporter_id: 1,
      request_key: 1
    },
    options: {
      unique: true,
      partialFilterExpression: { request_key: { $type: 'string' } }
    }
  },
  {
    collection: 'attachments',
    key: {
      incident_id: 1,
      created_at: 1
    },
    options: {}
  },
  {
    collection: 'support_requests',
    key: {
      incident_id: 1,
      status: 1
    },
    options: {}
  },
  {
    collection: 'notes',
    key: { support_request_id: 1 },
    options: {
      unique: true,
      partialFilterExpression: { support_request_id: { $type: 'number' } }
    }
  },
  {
    collection: 'audit',
    key: {
      created_at: -1,
      id: -1
    },
    options: {}
  },
  {
    collection: 'audit',
    key: {
      user_id: 1,
      created_at: -1
    },
    options: {}
  },
  {
    collection: 'sla_events',
    key: { created_at: -1 },
    options: {}
  },
  {
    collection: 'notes',
    key: {
      incident_id: 1,
      created_at: -1
    },
    options: {}
  }
];
module.exports = { INDEXES };
