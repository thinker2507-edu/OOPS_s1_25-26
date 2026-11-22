'use strict';
const { now } = require('../backend/src/domain/index.cjs');
// Initial database content. Clients always fetch the catalog from the API.
const CATALOG = [
  [
    'Hardware',
    'Laptop',
    'Battery issue',
    'The laptop battery is not charging or is discharging abnormally.',
    'Office Devices'
  ],
  [
    'Hardware',
    'Laptop',
    'Device will not start',
    'The laptop does not start or complete its startup sequence.',
    'Office Devices'
  ],
  [
    'Hardware',
    'Printer',
    'Printing failure',
    'The printer is unable to complete a submitted print job.',
    'Office Devices'
  ],
  [
    'Hardware',
    'Display',
    'Display malfunction',
    'The monitor displays no image or an incorrect image.',
    'Office Devices'
  ],
  [
    'Network',
    'Connectivity',
    'Connection unavailable',
    'The device cannot connect to the corporate network.',
    'Corporate Network'
  ],
  [
    'Network',
    'Remote access',
    'VPN disconnects',
    'The VPN connection cannot be established or disconnects unexpectedly.',
    'Corporate Network'
  ],
  [
    'Network',
    'Connectivity',
    'Slow network',
    'Network communication is slower than expected.',
    'Corporate Network'
  ],
  [
    'Application',
    'Employee applications',
    'Application error',
    'The application displays an error or stops responding during use.',
    'Employee Portal'
  ],
  [
    'Application',
    'Employee applications',
    'Missing functionality',
    'An expected application function cannot be accessed or completed.',
    'Employee Portal'
  ],
  [
    'Application',
    'Payments',
    'Transaction failure',
    'A payment transaction cannot be completed successfully.',
    'Payment Platform'
  ],
  [
    'Authentication',
    'Account access',
    'Sign-in failure',
    'A valid user account cannot sign in to the service.',
    'Employee Portal'
  ],
  [
    'Authentication',
    'Account access',
    'Password recovery failure',
    'The account password cannot be recovered through the recovery process.',
    'Employee Portal'
  ],
  [
    'Database',
    'Data access',
    'Data unavailable',
    'Expected records cannot be retrieved from the database service.',
    'Payment Platform'
  ],
  [
    'Database',
    'Data access',
    'Slow data retrieval',
    'Database requests take an unusually long time to complete.',
    'Payment Platform'
  ],
  [
    'Cloud',
    'Cloud services',
    'Service unavailable',
    'The hosted cloud service cannot be accessed.',
    'Cloud Storage'
  ],
  [
    'Storage',
    'Files and backup',
    'Storage capacity reached',
    'The available storage capacity is insufficient to save new data.',
    'Cloud Storage'
  ],
  [
    'Storage',
    'Files and backup',
    'File synchronization failure',
    'Files are not synchronizing successfully between supported devices.',
    'Cloud Storage'
  ],
  [
    'Security',
    'Suspicious activity',
    'Suspicious message or activity',
    'A suspicious message or unexpected account activity requires investigation.',
    'Employee Portal'
  ]
];
function ensureCatalog(repo) {
  const timestamp = now();
  // Additive migration: preserve existing categories, catalog edits and history.
  if (repo.one('settings', s => s.key === 'employee_catalog_v1')) {
    return;
  }
  const fallbackService = repo.list('services')[0];
  if (!fallbackService) {
    return;
  }
  for (const [category, subcategory, name, objective_description, serviceName] of CATALOG) {
    const currentCategory = repo.one('categories', c => c.name === category)?.name || repo.one('category_aliases', a => a.alias === category)?.category;
    if (!currentCategory) {
      continue;
    }
    let sub = repo.one('subcategories', s => s.category === currentCategory && s.name === subcategory);
    if (!sub) {
      sub = repo.insert('subcategories', {
        category: currentCategory,
        name: subcategory,
        active: true,
        created_at: timestamp,
        updated_at: timestamp
      });
    }
    if (!repo.one('incident_types', t => t.subcategory_id === sub.id && t.name === name)) {
      const service = repo.one('services', s => s.name === serviceName) || fallbackService;
      repo.insert('incident_types', {
        subcategory_id: sub.id,
        name,
        objective_description,
        service_id: service.id,
        active: true,
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }
  repo.insert('settings', {
    key: 'employee_catalog_v1',
    value: '1'
  });
}
function catalog(repo) {
  return {
    categories: repo.list('categories').sort((a, b) => a.name.localeCompare(b.name)),
    subcategories: repo.list('subcategories', s => s.active !== false),
    incident_types: repo.list('incident_types', t => t.active !== false)
  };
}
module.exports = {
  CATALOG,
  ensureCatalog,
  catalog
};
