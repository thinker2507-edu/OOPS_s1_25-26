'use strict';
const RETIRED = Object.freeze(['local_personas', 'demo_personas']);
function signature(rows) {
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  return JSON.stringify(rows.map(row => JSON.stringify(stable(row))).sort());
}
async function retiredSnapshot(database) {
  if (!database) {
    return {};
  }
  const { BSON } = require('mongodb');
  const existing = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map(row => row.name));
  const result = {};
  for (const name of RETIRED)
    if (existing.has(name)) {
      result[name] = BSON.EJSON.serialize(await database.collection(name).find({}).toArray(), { relaxed: false });
    }
  return result;
}
async function removeRetired(database, archived) {
  const result = {
    removed: [],
    retained: []
  };
  if (!database) {
    return result;
  }
  for (const [name, rows] of Object.entries(archived)) {
    if (!RETIRED.includes(name)) {
      throw new Error('Refusing to remove an unrecognized collection.');
    }
    try {
      const current = await retiredSnapshot(database);
      if (!Object.hasOwn(current, name)) {
        continue;
      }
      if (signature(rows) !== signature(current[name])) {
        result.retained.push({
          name,
          reason: 'Changed after backup; retained for review.'
        });
        continue;
      }
      await database.collection(name).drop();
      result.removed.push(name);
    }
    catch {
      result.retained.push({
        name,
        reason: 'Cleanup could not complete; application reset has already committed.'
      });
    }
  }
  return result;
}
module.exports = {
  RETIRED,
  retiredSnapshot,
  removeRetired
};
