'use strict';
const { configuration } = require('../backend/src/config/environment.cjs');
const { MongoRepository } = require('../backend/src/repositories/mongo-repository.cjs');
const { IncidentService } = require('../backend/src/services/incident-service.cjs');
async function setup(configOverride = null) {
  const config = configOverride || configuration();
  const repo = await MongoRepository.connect(config);
  try {
    await new IncidentService(repo).seed({
      ...config,
      APP_SEED_SAMPLES: 'false'
    });
    return {
      ok: true,
      message: 'Database collections, indexes and incident catalog are ready. Existing users and incidents were preserved.'
    };
  }
  finally {
    await repo.close();
  }
}
if (require.main === module) {
  setup().then(result => console.log(result.message)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { setup };
