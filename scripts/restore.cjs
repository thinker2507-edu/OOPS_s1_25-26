'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { configuration } = require('../backend/src/config/environment.cjs');
const { MongoRepository } = require('../backend/src/repositories/mongo-repository.cjs');
async function main() {
  const index = process.argv.indexOf('--source');
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error('Use node scripts/restore.cjs --source <backup.json>. The target must be empty.');
  }
  const file = path.resolve(process.argv[index + 1]);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.format !== 'relay-mongodb-v1' || !data.state) {
    throw new Error('This is not a Relay MongoDB export.');
  }
  const repo = await MongoRepository.connect(configuration());
  try {
    await repo.importState(data.state);
    console.log('Restored the empty MongoDB database.');
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
