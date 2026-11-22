'use strict';
const { configuration } = require('../backend/src/config/environment.cjs');
const { passwordMatches } = require('../backend/src/domain/index.cjs');
const { TEST_ACCOUNTS, TEST_PASSWORD } = require('./test-accounts.cjs');
function testLoginStatus(users) {
  const matching = TEST_ACCOUNTS.filter(account => users.some(user => user.email === account.email && user.role === account.role && user.active && passwordMatches(TEST_PASSWORD, user.password)));
  return {
    expectedAccounts: TEST_ACCOUNTS.length,
    presentAccounts: users.length,
    matchingLogins: matching.length,
    ready: matching.length === TEST_ACCOUNTS.length
  };
}
async function check(configOverride = null, { testLogins = false } = {}) {
  const config = configOverride || configuration();
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
  try {
    await client.connect();
    const database = client.db(config.MONGODB_DATABASE || 'relay');
    const hello = await database.admin().command({ hello: 1 });
    const collections = (await database.listCollections({}, { nameOnly: true }).toArray()).map(row => row.name).sort();
    const roles = collections.includes('users') ? await database.collection('users').aggregate([{
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }]).toArray() : [];
    const testAccounts = testLogins && collections.includes('users') ? await database.collection('users').find({ email: { $in: TEST_ACCOUNTS.map(account => account.email) } }, {
      projection: {
        email: 1,
        password: 1,
        role: 1,
        active: 1
      }
    }).toArray() : [];
    return {
      reachable: true,
      replicaSet: hello.setName || null,
      writablePrimary: Boolean(hello.isWritablePrimary),
      database: database.databaseName,
      collections,
      ...(testLogins ? { testLogins: testLoginStatus(testAccounts) } : {}),
      roles: roles.map(row => ({
        role: row._id ?? 'missing',
        count: row.count
      }))
    };
  }
  finally {
    await client.close();
  }
}
if (require.main === module) {
  check(null, { testLogins: process.argv.includes('--test-logins') }).then(result => console.log(JSON.stringify(result, null, 2))).catch(() => {
    console.error('Cannot inspect MongoDB. Start the replica set and verify the local connection settings.');
    process.exitCode = 1;
  });
}
module.exports = {
  check,
  testLoginStatus
};
