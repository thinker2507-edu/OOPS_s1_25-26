const GROUPS = [
  {
    label: 'Overview',
    to: '/overview',
    icon: '◈'
  },
  {
    label: 'Incidents',
    to: '/incidents',
    icon: '▤',
    children: [['All incidents', '/incidents'], ['My incidents', '/incidents/mine'], ['Report incident', '/incidents/new']]
  },
  {
    label: 'Reports',
    to: '/reports/overview',
    icon: '▥',
    children: [
      ['Summary', '/reports/overview'],
      ['Technician workload', '/reports/workload'],
      ['Service health', '/reports/services'],
      ['Audit logs', '/reports/audit', true],
      ['SLA violations', '/reports/sla', true]
    ]
  },
  {
    label: 'Notifications',
    to: '/notifications/inbox',
    icon: '◉',
    children: [['Inbox', '/notifications/inbox'], ['Email outbox', '/notifications/email']]
  },
  {
    label: 'Administration',
    to: '/admin/users',
    icon: '⚙',
    admin: true,
    children: [
      ['Users', '/admin/users'],
      ['Technicians', '/admin/technicians'],
      ['Services', '/admin/services'],
      ['Categories', '/admin/categories'],
      ['SLA policies', '/admin/policies'],
      ['Assignment', '/admin/assignment']
    ]
  },
  {
    label: 'Settings',
    to: '/settings/account',
    icon: '☷',
    children: [['My account', '/settings/account'], ['Accessibility', '/settings/accessibility'], ['System', '/settings/system', true]]
  }
];
const EMPLOYEE_GROUPS = [
  {
    label: 'View Incidents',
    to: '/incidents/mine',
    icon: '▤'
  },
  {
    label: 'Register Incident',
    to: '/incidents/new',
    icon: '+'
  }
];
const TITLES = {
  '/reports/audit': 'Audit logs',
  '/reports/sla': 'SLA violations',
  '/support-requests': 'Support requests',
  '/overview': 'Operations overview',
  '/incidents': 'All incidents',
  '/incidents/mine': 'My incidents',
  '/incidents/new': 'Report an incident',
  '/incidents/reported': 'My reports',
  '/reports/overview': 'Reports overview',
  '/reports/workload': 'Technician workload',
  '/reports/services': 'Service health',
  '/notifications/inbox': 'Notification inbox',
  '/notifications/email': 'Email outbox',
  '/admin/users': 'User management',
  '/admin/technicians': 'Technicians',
  '/admin/services': 'IT services',
  '/admin/categories': 'Incident categories',
  '/admin/policies': 'SLA policies',
  '/admin/assignment': 'Automatic assignment',
  '/settings/account': 'My account',
  '/settings/accessibility': 'Accessibility',
  '/settings/system': 'System controls',
  '/settings/api': 'REST API explorer'
};
const TECHNICIAN_GROUPS = [
  { label: 'Report incident', to: '/incidents/new', icon: '+' },
  { label: 'My reports', to: '/incidents/reported', icon: '▤' },
  {
    label: 'Support desk',
    to: '/overview',
    icon: '⌂'
  },
  {
    label: 'Assigned incidents',
    to: '/incidents/mine',
    icon: '▤'
  },
  {
    label: 'My workload',
    to: '/reports/workload',
    icon: '◷'
  }
];
export { GROUPS, EMPLOYEE_GROUPS, TECHNICIAN_GROUPS, TITLES };
