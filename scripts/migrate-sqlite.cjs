'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, configuration } = require('../backend/src/config/environment.cjs');
const { MongoRepository } = require('../backend/src/repositories/mongo-repository.cjs');
const { readSQLite } = require('../backend/src/repositories/sqlite-import.cjs');
async function main() {
  const index = process.argv.indexOf('--source');
  const source = path.resolve(index >= 0 ? process.argv[index + 1] : path.join(ROOT, 'data', 'itsm.sqlite3'));
  if (!fs.existsSync(source)) {
    throw new Error('SQLite source does not exist. Use --source <file>.');
  }
  const state = readSQLite(source);
  const repo = await MongoRepository.connect(configuration());
  try {
    await repo.importState(state);
    console.log('Imported into MongoDB:', state.users.length, 'users and', state.incidents.length, 'incidents.');
    console.log('SQLite source was opened read-only and remains unchanged. Sign in again; old sessions were not copied.');
  }
  finally {
    await repo.close();
  }
}
if (require.main === module) {
  main().catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
module.exports = { main };
