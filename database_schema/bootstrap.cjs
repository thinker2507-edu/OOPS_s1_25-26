'use strict';
const { passwordHash } = require('../backend/src/domain/index.cjs');
const { ensureBaseline } = require('./baseline.cjs');
const { applyMigrations } = require('./migrations.cjs');
const { ensureCatalog } = require('./catalog.cjs');
async function seedWorkspace(service, config) {
  if (config.APP_CLOUD === 'true') {
    // Cloud initialization is explicit. No users, catalogue or samples on restart.
    return;
  }
  const fresh = await service.repo.transaction(repo => {
    ensureBaseline(repo);
    applyMigrations(repo);
    if (repo.count('users')) {
      return false;
    }
    repo.insert('users', {
      name: 'Admin',
      email: config.APP_ADMIN_EMAIL.toLowerCase().trim(),
      password: passwordHash(config.APP_ADMIN_PASSWORD),
      role: 'admin'
    });
    if (config.APP_SEED_SAMPLES !== 'true') {
      return false;
    }
    for (const [name, email, role, skills] of [['Alex Morgan', 'employee@local.test', 'employee', ''], ['Sam Rivera', 'tech@local.test', 'technician', 'Application,Authentication,Database'], ['Priya Shah', 'priya@local.test', 'technician', 'Network,Cloud,Security'], ['Jordan Lee', 'jordan@local.test', 'technician', 'Hardware,Storage']])
      repo.insert('users', {
        name,
        email,
        role,
        skills,
        password: passwordHash(config.APP_ADMIN_PASSWORD)
      });
    return true;
  });
  await service.repo.transaction(ensureCatalog);
  if (!fresh) {
    return;
  }
  const employee = {
    id: 2,
    role: 'employee'
  };
  for (const [title, description, service_id, impact, urgency, affected] of [
    [
      'Payment checkout unavailable',
      'Payment transactions failing for customers since the morning.',
      1,
      3,
      3,
      250
    ],
    [
      'VPN connection drops repeatedly',
      'Network VPN disconnects every few minutes.',
      2,
      2,
      2,
      24
    ],
    [
      'Unable to sign in to portal',
      'Login password reset link is not arriving.',
      3,
      1,
      2,
      1
    ],
    [
      'Cloud backup storage full',
      'Storage backup disk has reached capacity.',
      4,
      2,
      2,
      30
    ],
    [
      'Printer queue stuck on floor 2',
      'Office printer queue is stuck.',
      5,
      1,
      1,
      3
    ],
    [
      'Slow SQL query on checkout',
      'Database SQL query times out during checkout.',
      1,
      2,
      2,
      50
    ]
  ]) {
    const incident = await service.create(employee, {
      title,
      description,
      service_id,
      impact,
      urgency,
      affected,
      category: 'auto'
    });
    await service.update({
      id: 1,
      role: 'admin'
    }, incident.id, { action: 'auto_assign' });
  }
  for (const status of [
    'ACKNOWLEDGED',
    'IN_PROGRESS',
    'RESOLVED',
    'VERIFIED',
    'CLOSED'
  ])
    await service.update({
      id: 1,
      role: 'admin'
    }, 5, {
      action: 'status',
      status,
      resolution: 'Cleared the print spooler and restarted the printer service.'
    });
}
module.exports = { seedWorkspace };
