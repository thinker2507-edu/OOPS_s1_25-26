'use strict';
const { passwordHash, now, AppError } = require('../backend/src/domain/index.cjs');
const { ensureBaseline } = require('./baseline.cjs');
const { ensureCatalog } = require('./catalog.cjs');
const { applyMigrations } = require('./migrations.cjs');
const { KEYS } = require('./collections.cjs');
const { DEFAULT_WEIGHTS } = require('../backend/src/domain/assignment-strategies.cjs');
// One transaction: an occupied target or any failed insert leaves every collection intact.
function initializeCloud(service, config) {
  if (config.APP_CLOUD !== 'true') {
    throw new AppError('Cloud initialization requires APP_CLOUD=true. Local data was not changed.');
  }
  for (const key of ['APP_ADMIN_PASSWORD', 'APP_CLOUD_ACCOUNT_PASSWORD']) {
    const value = config[key];
    if (typeof value !== 'string' || value.length < 16 || /local|demo|relay|test/i.test(value)) {
      throw new AppError('Set a private password of at least 16 characters in provider settings: ' + key);
    }
  }
  if (config.APP_ADMIN_PASSWORD === config.APP_CLOUD_ACCOUNT_PASSWORD) {
    throw new AppError('Choose different administrator and sample-account passwords.');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.APP_ADMIN_EMAIL || '') || /@local\.test$/i.test(config.APP_ADMIN_EMAIL)) {
    throw new AppError('Set a private APP_ADMIN_EMAIL in provider settings.');
  }
  const adminHash = passwordHash(config.APP_ADMIN_PASSWORD);
  return service.repo.transaction(repo => {
    if (Object.keys(KEYS).some(table => repo.count(table))) {
      throw new AppError('Cloud initialization requires an empty database. Existing records were not changed.', 409);
    }
    // Exactly four services; the device catalogue falls back to Employee Portal.
    for (const [name, criticality] of [['Payment Platform', 3], ['Corporate Network', 3], ['Employee Portal', 2], ['Cloud Storage', 2]])
      repo.insert('services', {
        name,
        criticality
      });
    ensureBaseline(repo);
    applyMigrations(repo);
    ensureCatalog(repo);
    repo.insert('settings', {
      key: 'assignment_weights',
      value: DEFAULT_WEIGHTS
    });
    repo.insert('settings', {
      key: 'correlation_minutes',
      value: 60
    });
    const time = now();
    repo.insert('users', {
      name: 'Administrator',
      email: config.APP_ADMIN_EMAIL.trim().toLowerCase(),
      role: 'admin',
      password: adminHash,
      created_at: time
    });
    for (const [index, name, skills, experience_years] of [[1, 'Sam Rivera', 'Application,Authentication,Database', 6], [2, 'Priya Shah', 'Network,Cloud,Security', 8], [3, 'Jordan Lee', 'Hardware,Storage', 3]])
      repo.insert('users', {
        name,
        email: 'technician' + index + '@example.invalid',
        role: 'technician',
        skills,
        experience_years,
        password: passwordHash(config.APP_CLOUD_ACCOUNT_PASSWORD),
        created_at: time
      });
    for (let index = 1;index <= 5;index++)
      repo.insert('users', {
        name: 'Employee ' + index,
        email: 'employee' + index + '@example.invalid',
        role: 'employee',
        password: passwordHash(config.APP_CLOUD_ACCOUNT_PASSWORD),
        created_at: time
      });
    for (const [name, description] of [['Identity gateway', 'Authentication shared by payments and employee portal'], ['Core router', 'Connectivity shared by corporate network and storage'], ['Payment database', 'Payment records and transactions']])
      repo.insert('components', {
        name,
        description
      });
    for (const [service_id, component_id] of [
      [1, 1],
      [3, 1],
      [2, 2],
      [4, 2],
      [1, 3]
    ])
      repo.insert('service_components', {
        service_id,
        component_id
      });
    const examples = [
      [
        'Payment failure',
        'Payment transactions failed at checkout.',
        1,
        'Application',
        'ASSIGNED'
      ],
      [
        'Unable to pay',
        'Credit card payments are not working at checkout.',
        1,
        'Application',
        'ACKNOWLEDGED'
      ],
      [
        'Portal sign-in failure',
        'Staff cannot login through the identity gateway.',
        3,
        'Authentication',
        'IN_PROGRESS'
      ],
      [
        'VPN disconnect',
        'VPN connection drops every five minutes.',
        2,
        'Network',
        'WAITING'
      ],
      [
        'Cloud backup unavailable',
        'Cloud storage cannot connect through the core router.',
        4,
        'Cloud',
        'RESOLVED'
      ],
      [
        'Payment database slow',
        'SQL retrieval is slow for payment records.',
        1,
        'Database',
        'VERIFIED'
      ],
      [
        'File synchronization failed',
        'Storage files stopped synchronizing between devices.',
        4,
        'Storage',
        'CLOSED'
      ],
      [
        'Authentication gateway error',
        'Identity gateway rejected valid portal credentials.',
        3,
        'Authentication',
        'ASSIGNED'
      ],
      [
        'Office display failure',
        'Laptop monitor has no image on the third floor.',
        3,
        'Hardware',
        'IN_PROGRESS'
      ],
      [
        'Network connection drops',
        'VPN disconnects every five minutes.',
        2,
        'Network',
        'ASSIGNED'
      ],
      [
        'Suspicious email attachment',
        'Security team received a suspicious attachment.',
        3,
        'Security',
        'RESOLVED'
      ],
      [
        'Payment failure on checkout',
        'Debit card transactions are failing at checkout.',
        1,
        'Application',
        'ASSIGNED'
      ]
    ];
    for (let index = 0;index < examples.length;index++) {
      const [title, description, service_id, category, target] = examples[index];
      const created_at = time - index * 120;
      const { priority, score } = service.priority.calculate(2, 2, repo.one('services', s => s.id === service_id).criticality, 10);
      const policy = service.policy(priority, service_id);
      const i = repo.insert('incidents', {
        title,
        description,
        service_id,
        category,
        reporter_id: 5 + index % 5,
        impact: 2,
        urgency: 2,
        affected: 10,
        priority,
        score,
        status: 'NEW',
        created_at,
        updated_at: time,
        response_due: created_at + policy.response_minutes * 60,
        resolution_due: created_at + policy.resolution_minutes * 60
      });
      service.events.publish(repo, i, null, 'Incident created', 'Cloud demonstration dataset');
      service.assignAutomatically(repo, i);
      const path = target === 'WAITING' ? ['ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] : [
        'ACKNOWLEDGED',
        'IN_PROGRESS',
        'RESOLVED',
        'VERIFIED',
        'CLOSED'
      ];
      if (target !== 'ASSIGNED') {
        for (const status of path) {
          const old = i.status;
          i.status = status;
          if (status === 'ACKNOWLEDGED') {
            i.acknowledged_at = time;
          }
          if (status === 'RESOLVED') {
            i.resolved_at = time;
            i.resolution = 'Restored service configuration and verified normal operation.';
          }
          if (status === 'CLOSED') {
            i.closed_at = time;
          }
          repo.update('incidents', row => row.id === i.id, i);
          service.events.publish(repo, i, null, 'Status changed', 'Cloud demonstration lifecycle', old);
          if (status === target) {
            break;
          }
        }
      }
    }
    repo.insert('settings', {
      key: 'cloud_initialized',
      value: '1',
      applied_at: time
    });
    return {
      users: 9,
      incidents: 12,
      services: 4,
      components: 3,
      attachments: 0
    };
  });
}
async function main() {
  if (process.env.APP_CLOUD !== 'true') {
    throw new Error('Run this command only with provider cloud settings.');
  }
  const { configuration } = require('../backend/src/config/environment.cjs');
  const { MongoRepository } = require('../backend/src/repositories/mongo-repository.cjs');
  const { IncidentService } = require('../backend/src/services/incident-service.cjs');
  const config = configuration();
  if (config.APP_CLOUD !== 'true') {
    throw new Error('Run this command with provider cloud settings.');
  }
  const repo = await MongoRepository.connect(config);
  try {
    console.log(JSON.stringify(await initializeCloud(new IncidentService(repo), config)));
  }
  finally {
    await repo.close();
  }
}
if (require.main === module) {
  main().catch(() => {
    console.error('Cloud initialization failed. Check private provider settings and use a new, empty database; no existing records were overwritten.');
    process.exitCode = 1;
  });
}
module.exports = { initializeCloud };
