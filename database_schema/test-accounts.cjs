'use strict';
const TEST_PASSWORD = 'RelayTest!2026';
const TEST_ADMIN_EMAIL = 'admin@relay.test';
const TEST_ACCOUNTS = [
  {
    email: TEST_ADMIN_EMAIL,
    role: 'admin'
  },
  ...Array.from({ length: 8 }, (_, index) => ({
    email: 'tech' + String(index + 1).padStart(2, '0') + '@relay.test',
    role: 'technician'
  })),
  ...Array.from({ length: 30 }, (_, index) => ({
    email: 'employee' + String(index + 1).padStart(2, '0') + '@relay.test',
    role: 'employee'
  }))
];
function loginGuide() {
  return `# Local test logins

These accounts are installed by the **test-only reset command below**. This file does not describe or reset passwords for accounts currently in an older database. No Google identity is fabricated or linked by the reset.

If these logins fail, first start MongoDB and Relay. Verify the installed dataset with node database_schema/check.cjs --test-logins. ready=true means all 39 documented credentials match; false means this test-only dataset is missing or has different passwords. Do not reset incident data just to recover one account: use **Forgot password?** on the sign-in page, **Change password** in Profile, or ask an administrator to reset that user. In default local delivery mode, recovery emails are private .eml files in data/mailbox, not Internet email.

**Shared password for all 39 test accounts: \`${TEST_PASSWORD}\`**

| Role | Email / username |
| --- | --- |
${TEST_ACCOUNTS.map(account => '| ' + account.role + ' | ' + account.email + ' |').join('\n')}

## Clear application data and install only test data

Keep the local MongoDB replica set running and close the application terminal. In PowerShell, from the project folder:

\`\`\`powershell
node database_schema/reset-and-seed.cjs --test-only --preview
node database_schema/reset-and-seed.cjs --test-only --apply --confirm relay
.\\start.bat
\`\`\`

Use the database name reported by preview if yours is different. The apply command **replaces existing application users, Google links, sessions and incident/workflow data**. It first saves a backup under ignored data/backups, then creates these 39 accounts, 150 incidents, 10 services, the classification catalog, SLA policies, notes, support threads, resolutions, feedback and history. Every password is stored as an independently salted hash in MongoDB.

Retired local_personas/demo_personas collections are archived in the backup and removed after the reset when unchanged. Unknown collections are listed and left alone. The remaining collections are used by active features; _meta is required for transactions and concurrency. No other database is reset. Changing the private configuration does not override this test-only password.

The same commands without --test-only retain the older behavior of preserving existing accounts and Google links. Optional --incidents accepts 32..500; 150 is the default. A repeated test-only reset replaces the dataset rather than adding duplicates.

These published credentials are for local testing. Replace them before exposing the app publicly. Reset does not create a permissive authentication mode or bypass authorization. No npm command, API key or new package is required.

This guide is generated from database_schema/test-accounts.cjs. No existing private password or configuration is copied into it.
`;
}
module.exports = {
  TEST_PASSWORD,
  TEST_ADMIN_EMAIL,
  TEST_ACCOUNTS,
  loginGuide
};
