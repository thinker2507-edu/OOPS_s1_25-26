'use strict';
const { AppError, TRANSITIONS } = require("../domain/index.cjs");
const { KEYS, DEFAULTS, ROLES } = require('../../../database_schema/collections.cjs');
const clone = value => structuredClone(value);
const documentKey = (table, row) => KEYS[table].length === 1 ? row[KEYS[table][0]] : JSON.stringify(KEYS[table].map(key => row[key]));
class DocumentStore {
  constructor(state = {}) {
    this.state = Object.fromEntries(Object.keys(KEYS).map(table => [table, clone(state[table] || [])]));
    this.changed = false;
  }
  list(table, predicate = () => true) {
    this.check(table);
    return this.state[table].filter(predicate).map(clone);
  }
  one(table, predicate = () => true) {
    this.check(table);
    const row = this.state[table].find(predicate);
    return row ? clone(row) : null;
  }
  count(table, predicate = () => true) {
    return this.list(table, predicate).length;
  }
  check(table) {
    if (!Object.hasOwn(KEYS, table)) {
      throw new Error('Unknown collection: ' + table);
    }
  }
  insert(table, values) {
    this.check(table);
    const row = {
      ...clone(DEFAULTS[table] || {}),
      ...clone(values)
    };
    if (KEYS[table].length === 1 && KEYS[table][0] === 'id' && row.id === undefined) {
      row.id = this.state[table].reduce((max, r) => Math.max(max, r.id), 0) + 1;
    }
    if (KEYS[table].some(key => row[key] === undefined || row[key] === null)) {
      throw new AppError('Missing record identifier.');
    }
    const key = documentKey(table, row);
    if (this.state[table].some(r => documentKey(table, r) === key)) {
      throw new AppError('This record already exists.', 409);
    }
    this.state[table].push(row);
    this.changed = true;
    return clone(row);
  }
  update(table, predicate, patch) {
    this.check(table);
    let count = 0;
    this.state[table] = this.state[table].map(row => {
      if (!predicate(row)) {
        return row;
      }
      count++;
      const next = typeof patch === 'function' ? patch(clone(row)) : patch;
      return {
        ...row,
        ...clone(next)
      };
    });
    if (count) {
      this.changed = true;
    }
    return count;
  }
  remove(table, predicate) {
    this.check(table);
    const count = this.state[table].length;
    this.state[table] = this.state[table].filter(r => !predicate(r));
    const removed = count - this.state[table].length;
    if (removed) {
      this.changed = true;
    }
    return removed;
  }
  upsert(table, predicate, row) {
    return this.one(table, predicate) ? (this.update(table, predicate, row), this.one(table, predicate)) : this.insert(table, row);
  }
  validate() {
    for (const [table, rows] of Object.entries(this.state)) {
      const keys = new Set();
      for (const row of rows) {
        const key = documentKey(table, row);
        if (key === undefined || keys.has(key)) {
          throw new AppError('Duplicate or missing record identifier.', 409);
        }
        keys.add(key);
      }
    }
    const serviceNames = new Set();
    for (const service of this.state.services) {
      if (serviceNames.has(service.name)) {
        throw new AppError('This service already exists.', 409);
      }
      serviceNames.add(service.name);
    }
    const ids = table => new Set(this.state[table].map(r => r.id));
    const users = ids('users');
    const services = ids('services');
    const incidents = ids('incidents');
    const categories = new Set(this.state.categories.map(r => r.name));
    const subcategories = ids('subcategories');
    const types = ids('incident_types');
    const emails = new Set();
    for (const u of this.state.users) {
      if (emails.has(u.email)) {
        throw new AppError('This email already has an account.', 409);
      }
      emails.add(u.email);
      if (!ROLES.includes(u.role)) {
        throw new AppError('Invalid role.');
      }
    }
    const ref = (valid, message) => {
      if (!valid) {
        throw new AppError(message || 'Referenced record does not exist.');
      }
    };
    const unique = (table, key) => {
      const seen = new Set();
      for (const row of this.state[table]) {
        const value = key(row);
        if (value === null) {
          continue;
        }
        if (seen.has(value)) {
          throw new AppError('Duplicate ' + table + ' record.', 409);
        }
        seen.add(value);
      }
    };
    unique('subcategories', s => JSON.stringify([s.category, s.name]));
    unique('incident_types', t => JSON.stringify([t.subcategory_id, t.name]));
    unique('incidents', i => i.request_key ? JSON.stringify([i.reporter_id, i.request_key]) : null);
    unique('notes', n => n.support_request_id ?? null);
    for (const row of this.state.subcategories)
      ref(categories.has(row.category));
    for (const row of this.state.incident_types) {
      ref(subcategories.has(row.subcategory_id));
      ref(services.has(row.service_id));
    }
    for (const i of this.state.incidents) {
      ref(Object.hasOwn(TRANSITIONS, i.status), 'Invalid incident status.');
      ref(users.has(i.reporter_id));
      ref(services.has(i.service_id));
      ref(categories.has(i.category));
      ref(i.technician_id === null || users.has(i.technician_id));
      ref(i.duplicate_of === null || incidents.has(i.duplicate_of));
      if (i.incident_type_id != null) {
        ref(types.has(i.incident_type_id));
      }
    }
    const requests = ids('support_requests');
    for (const table of [
      'notes',
      'audit',
      'notifications',
      'sla_events',
      'attachments',
      'support_requests'
    ])
      for (const row of this.state[table]) {
        ref(row.incident_id === null || incidents.has(row.incident_id));
        if ('user_id' in row) {
          ref(row.user_id === null || users.has(row.user_id));
        }
        if (row.support_request_id != null) {
          ref(requests.has(row.support_request_id));
        }
        if (row.support_request_id != null) {
          ref(this.state.support_requests.some(r => r.id === row.support_request_id && r.incident_id === row.incident_id));
        }
      }
    for (const table of ['sessions', 'oauth_identities', 'password_resets'])
      for (const row of this.state[table])
        ref(users.has(row.user_id));
    for (const row of this.state.service_policies)
      ref(services.has(row.service_id));
    const components = ids('components');
    for (const row of this.state.service_components) {
      ref(services.has(row.service_id));
      ref(components.has(row.component_id));
    }
    for (const row of this.state.category_aliases)
      ref(categories.has(row.category));
  }
}
module.exports = {
  DocumentStore,
  KEYS,
  DEFAULTS,
  documentKey,
  clone
};
