'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { configuration, dataDirectory } = require('../backend/src/config/environment.cjs');
const { MongoRepository } = require('../backend/src/repositories/mongo-repository.cjs');
async function main() {
  const config = configuration();
  const repo = await MongoRepository.connect(config);
  try {
    const folder = path.join(dataDirectory(config), 'backups');
    fs.mkdirSync(folder, { recursive: true });
    const filename = path.join(folder, 'relay-mongodb-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    const snapshot = await repo.exportState();
    fs.writeFileSync(filename, JSON.stringify({
      format: 'relay-mongodb-v1',
      created: new Date().toISOString(),
      state: snapshot
    }, null, 2), { mode: 0o600 });
    console.log('Consistent MongoDB export saved:', filename);
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
