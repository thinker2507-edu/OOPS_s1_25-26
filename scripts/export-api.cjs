'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { apiContract } = require('../backend/src/http/api-contract.cjs');
function exportApi(filename = path.resolve(__dirname, '../docs/openapi.json')) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(apiContract(), null, 2) + '\n');
  return filename;
}
if (require.main === module) {
  exportApi();
  console.log('Updated docs/openapi.json; no credentials or database access required.');
}
module.exports = { exportApi };
