'use strict';
const CATEGORIES = [
  'Application',
  'Authentication',
  'Network',
  'Hardware',
  'Database',
  'Cloud',
  'Security',
  'Storage'
];
const SERVICES = [
  ['Payment Platform', 3],
  ['Corporate Network', 3],
  ['Employee Portal', 2],
  ['Cloud Storage', 2],
  ['Office Devices', 1]
];
const POLICIES = [['P1', 5, 30], ['P2', 15, 120], ['P3', 60, 480], ['P4', 240, 1440]];
function ensureBaseline(repo) {
  if (repo.one('settings', row => row.key === 'baseline_v1')) {
    return;
  }
  for (const name of CATEGORIES)
    if (!repo.one('categories', row => row.name === name) && !repo.one('category_aliases', row => row.alias === name)) {
      repo.insert('categories', { name });
    }
  if (!repo.count('services')) {
    for (const [name, criticality] of SERVICES)
      repo.insert('services', {
        name,
        criticality
      });
  }
  for (const [priority, response_minutes, resolution_minutes] of POLICIES)
    if (!repo.one('policies', row => row.priority === priority)) {
      repo.insert('policies', {
        priority,
        response_minutes,
        resolution_minutes
      });
    }
  if (!repo.one('settings', row => row.key === 'strategy')) {
    repo.insert('settings', {
      key: 'strategy',
      value: 'skill'
    });
  }
  repo.insert('settings', {
    key: 'baseline_v1',
    value: '1'
  });
}
module.exports = {
  CATEGORIES,
  SERVICES,
  POLICIES,
  ensureBaseline
};
