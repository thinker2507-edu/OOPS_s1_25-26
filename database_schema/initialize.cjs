'use strict';
const { INDEXES } = require('./indexes.cjs');
const { KEYS } = require('./collections.cjs');
async function initializeDatabase(database) {
  const existing = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map(r => r.name));
  for (const table of [...Object.keys(KEYS), '_meta'])
    if (!existing.has(table)) {
      await database.createCollection(table);
    }
  for (const { collection, key, options } of INDEXES)
    await database.collection(collection).createIndex(key, options);
  await database.collection('_meta').updateOne({ _id: 'workspace' }, { $setOnInsert: { revision: 0 } }, { upsert: true });
}
module.exports = { initializeDatabase };
