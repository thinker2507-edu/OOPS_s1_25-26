'use strict';
const { passwordHash, now, AppError } = require('../backend/src/domain/index.cjs');
const { ensureBaseline } = require('./baseline.cjs');
const { ensureCatalog } = require('./catalog.cjs');
const { applyMigrations } = require('./migrations.cjs');
const { KEYS } = require('./collections.cjs');
const { DEFAULT_WEIGHTS } = require('../backend/src/domain/assignment-strategies.cjs');
function validateCloudInitialization(config) {
  if (config.APP_CLOUD !== 'true') {
    throw new AppError('Cloud initialization requires APP_CLOUD=true. Local data was not changed.', 400, 'CLOUD_MODE_REQUIRED');
  }
  for (const key of ['APP_ADMIN_PASSWORD', 'APP_CLOUD_ACCOUNT_PASSWORD']) {
    const value = config[key];
    if (typeof value !== 'string' || value.length < 16 || /local|demo|relay|test/i.test(value)) {
      throw new AppError('Set a private password of at least 16 characters in provider settings: ' + key, 400, key === 'APP_ADMIN_PASSWORD' ? 'CLOUD_ADMIN_PASSWORD_INVALID' : 'CLOUD_ACCOUNT_PASSWORD_INVALID');
    }
  }
  if (config.APP_ADMIN_PASSWORD === config.APP_CLOUD_ACCOUNT_PASSWORD) {
    throw new AppError('Choose different administrator and sample-account passwords.', 400, 'CLOUD_PASSWORDS_IDENTICAL');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.APP_ADMIN_EMAIL || '') || /@local\.test$/i.test(config.APP_ADMIN_EMAIL)) {
    throw new AppError('Set a private APP_ADMIN_EMAIL in provider settings.', 400, 'CLOUD_ADMIN_EMAIL_INVALID');
  }
}
// One transaction: an occupied target or any failed insert leaves every collection intact.
function initializeCloud(service, config) {
  validateCloudInitialization(config);
  const adminHash = passwordHash(config.APP_ADMIN_PASSWORD);
  return service.repo.transaction(repo => {
    if (Object.keys(KEYS).some(table => repo.count(table))) {
      throw new AppError('Cloud initialization requires an empty database. Existing records were not changed.', 409, 'CLOUD_DATABASE_NOT_EMPTY');
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
// These CLI diagnostics are intentionally fixed text: never print raw driver errors,
// connection strings, passwords, provider responses or stack traces.
function initializationFailure(error, stage) {
  const passwordRequirements = 'Enter at least 16 characters, without the words local, demo, relay or test. No password value was printed.';
  const known = {
    CLOUD_MODE_REQUIRED: 'Set APP_CLOUD=true in this PowerShell session before running the initializer. Render settings do not automatically reach your laptop.',
    CLOUD_ADMIN_PASSWORD_INVALID: 'APP_ADMIN_PASSWORD is missing or does not meet the requirements. ' + passwordRequirements,
    CLOUD_ACCOUNT_PASSWORD_INVALID: 'APP_CLOUD_ACCOUNT_PASSWORD is missing or does not meet the requirements. ' + passwordRequirements,
    CLOUD_PASSWORDS_IDENTICAL: 'APP_ADMIN_PASSWORD and APP_CLOUD_ACCOUNT_PASSWORD must be different.',
    CLOUD_ADMIN_EMAIL_INVALID: 'APP_ADMIN_EMAIL must be a valid email address, not a localhost initialization address.',
    CLOUD_DATABASE_NAME_INVALID: 'MONGODB_DATABASE must be a database name such as relay_cloud, not a connection string or website address. Use letters, numbers, underscores or hyphens; admin, local and config are reserved.',
    CLOUD_EMAIL_MODE_INVALID: 'EMAIL_DELIVERY_MODE must be resend in this cloud PowerShell session. Set it to resend; this selects the adapter and does not send email during initialization.',
    CLOUD_GOOGLE_CALLBACK_INVALID: 'GOOGLE_REDIRECT_URI must equal APP_BASE_URL followed by /auth/google/callback. Use the Vercel HTTPS address, not localhost or the Render address.',
    CLOUD_DATABASE_NOT_EMPTY: 'The target database already contains application records. Nothing was overwritten. Do not clear it; check whether it was already initialized.'
  };
  if (Object.hasOwn(known, error?.code)) {
    return { code: error.code, message: known[error.code] };
  }
  if (stage === 'configuration') {
    if (error?.code === 'ENOENT') {
      return { code: 'CLOUD_TEMPLATE_MISSING', message: 'The .env.example configuration template is missing. Restore the template from the project source; do not copy private credentials into it.' };
    }
    if (['EACCES', 'EPERM'].includes(error?.code)) {
      return { code: 'CLOUD_TEMPLATE_ACCESS', message: 'The configuration template could not be read. Check project-folder permissions and try again.' };
    }
    if (error?.message === 'Invalid configuration line in .env.example') {
      return { code: 'CLOUD_TEMPLATE_INVALID', message: 'The .env.example template contains an invalid line. Restore the original template; provide private values through process settings.' };
    }
    const required = /^Cloud setting required: (MONGODB_URI|MONGODB_DATABASE|APP_BASE_URL|APP_API_URL)$/.exec(error?.message || '');
    if (required) {
      return { code: 'CLOUD_SETTING_MISSING', message: required[1] + ' is missing from this PowerShell session. Render settings do not automatically reach your laptop.' };
    }
    if (/^APP_(?:BASE|API)_URL must be /.test(error?.message || '')) {
      const key = error.message.startsWith('APP_BASE_URL') ? 'APP_BASE_URL' : 'APP_API_URL';
      return { code: 'CLOUD_ORIGIN_INVALID', message: key + ' must be a complete HTTPS origin without quotes, paths or a trailing slash.' };
    }
    return { code: 'CLOUD_CONFIGURATION_INVALID', message: 'Cloud settings could not be validated. Check APP_CLOUD, the dedicated database name, HTTPS origins and the Google callback if enabled.' };
  }
  if (stage === 'connection') {
    const codes = [];
    let cause = error;
    for (let depth = 0; cause && depth < 5; depth++, cause = cause.cause) codes.push(cause.code, cause.name);
    if (codes.includes(18)) return { code: 'CLOUD_DATABASE_AUTHENTICATION', message: 'Atlas rejected the database credentials. Use the Atlas database user, not your website account, and URL-encode the password in the URI.' };
    if (codes.includes(13)) return { code: 'CLOUD_DATABASE_PERMISSION', message: 'The Atlas database user needs read/write access to the target database, including collection and index creation.' };
    if (codes.includes('MongoParseError') || codes.includes('ERR_INVALID_URL')) return { code: 'CLOUD_DATABASE_URI_INVALID', message: 'MONGODB_URI is not a valid MongoDB connection string. Copy the Atlas Drivers URI and replace its username/password placeholders privately.' };
    return { code: 'CLOUD_DATABASE_CONNECTION', message: 'Could not connect to Atlas. Add this laptop\'s current public IP in Atlas Network Access; Render\'s outbound IP ranges alone do not allow this laptop. Also verify the database credentials, URI and cluster availability.' };
  }
  return { code: 'CLOUD_INITIALIZATION_TRANSACTION', message: 'The initialization transaction did not report success. Check Atlas database permissions and workspace status before retrying; do not clear existing records.' };
}
async function main() {
  let stage = 'configuration';
  let repo;
  try {
    if (process.env.APP_CLOUD !== 'true') {
      throw new AppError('Cloud mode is required.', 400, 'CLOUD_MODE_REQUIRED');
    }
    const { configuration } = require('../backend/src/config/environment.cjs');
    const { MongoRepository } = require('../backend/src/repositories/mongo-repository.cjs');
    const { IncidentService } = require('../backend/src/services/incident-service.cjs');
    const config = configuration();
    validateCloudInitialization(config);
    stage = 'connection';
    repo = await MongoRepository.connect(config);
    stage = 'initialization';
    console.log(JSON.stringify(await initializeCloud(new IncidentService(repo), config)));
  }
  catch (error) {
    const failure = initializationFailure(error, stage);
    console.error('Cloud initialization failed [' + failure.code + ']: ' + failure.message);
    process.exitCode = 1;
  }
  finally {
    if (repo) await repo.close();
  }
}
if (require.main === module) {
  main().catch(() => {
    console.error('Cloud initialization could not finish. Check Atlas connectivity and retry; no credentials were printed.');
    process.exitCode = 1;
  });
}
module.exports = { initializeCloud, validateCloudInitialization, initializationFailure };
