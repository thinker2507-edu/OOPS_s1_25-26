'use strict';
const { DatabaseSync } = require('node:sqlite');
const { DocumentStore, KEYS } = require("./document-store.cjs");
function readSQLite(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const available = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
    const state = {};
    for (const table of Object.keys(KEYS)) {
      const source = table;
      state[table] = available.has(source) ? db.prepare('SELECT * FROM ' + source).all().map(r => ({ ...r })) : [];
    }
    // Re-authenticate after changing database; do not import old bypass sessions.
    state.sessions = [];
    state.oauth_states = [];
    const personas = new Set(available.has('demo_personas') ? db.prepare('SELECT user_id FROM demo_personas').all().map(p => p.user_id) : []);
    state.users = state.users.map(u => personas.has(u.id) ? {
      ...u,
      active: 0
    } : u);
    const store = new DocumentStore(state);
    store.validate();
    return store.state;
  }
  finally {
    db.close();
  }
}
module.exports = { readSQLite };
