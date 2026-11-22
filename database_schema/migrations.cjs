'use strict';
const { DEFAULTS } = require('./collections.cjs');
const { now, AppError } = require('../backend/src/domain/index.cjs');
const VERSION = 'cloud-incident-intelligence-v1';
const ROLE_ALIASES = {
  employee: 'employee',
  technician: 'technician',
  support_engineer: 'technician',
  admin: 'admin',
  administrator: 'admin',
  it_manager: 'admin'
};
function applyMigrations(repo) {
  if (repo.one('settings', row => row.key === 'schema_version' && row.value === VERSION)) {
    return;
  }
  for (const [table, defaults] of Object.entries(DEFAULTS)) {
    repo.update(table, () => true, row => Object.fromEntries(Object.entries(defaults).filter(([key]) => row[key] === undefined)));
  }
  repo.update('users', () => true, user => {
    const role = ROLE_ALIASES[String(user.role).trim().toLowerCase().replace(/[\s/-]+/g, '_')];
    if (!role) {
      throw new AppError('Unknown stored account role. Review users.role in Compass; existing accounts were not changed.');
    }
    return {
      role,
      skills: Array.isArray(user.skills) ? user.skills.join(',') : user.skills,
      active: typeof user.active === 'boolean' ? Number(user.active) : user.active,
      available: typeof user.available === 'boolean' ? Number(user.available) : user.available
    };
  });
  for (const table of ['subcategories', 'incident_types'])
    repo.update(table, row => [0, 1].includes(row.active), row => ({ active: Boolean(row.active) }));
  repo.update('notifications', row => typeof row.is_read === 'boolean', row => ({ is_read: Number(row.is_read) }));
  repo.upsert('settings', row => row.key === 'schema_version', {
    key: 'schema_version',
    value: VERSION,
    applied_at: now()
  });
}
module.exports = {
  VERSION,
  ROLE_ALIASES,
  applyMigrations
};
