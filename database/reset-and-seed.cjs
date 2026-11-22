'use strict';
// Compatibility path for existing commands.
const implementation = require('../database_schema/reset-and-seed.cjs');
if (require.main === module) {
  implementation.main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = implementation;
