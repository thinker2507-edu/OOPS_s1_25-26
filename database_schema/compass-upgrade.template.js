/* Generated from the canonical schema. Paste this entire file into Compass mongosh,
   then call relaySchema.preview("relay") and relaySchema.apply("relay").
   Defining these helpers does not access the database. Compass may not support load(). */
globalThis.relaySchema = (() => {
  const schema = __RELAY_SCHEMA_JSON__;
  function target(name) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(name) || ['admin', 'local', 'config'].includes(name.toLowerCase())) {
      throw new Error('Choose an application database, not a MongoDB system database.');
    }
    return db.getSiblingDB(name);
  }
  async function preview(name = 'relay') {
    const database = target(name);
    const names = await database.getCollectionNames();
    const counts = {};
    for (const table of Object.keys(schema.collections))
      counts[table] = names.includes(table) ? await database.getCollection(table).countDocuments({}) : 0;
    const result = {
      database: name,
      version: schema.version,
      missingCollections: Object.keys(schema.collections).filter(table => !names.includes(table)),
      counts,
      readOnly: true
    };
    print(JSON.stringify(result, null, 2));
    return result;
  }
  async function upgradeData(database) {
    const state = {};
    const inserted = new Set();
    const changed = new Map();
    for (const table of Object.keys(schema.collections))
      state[table] = await database.getCollection(table).find({}).toArray();
    const value = (row, field) => row[field] && typeof row[field] === 'object' && ['Int32', 'Long', 'Double'].includes(row[field]._bsontype) ? Number(row[field]) : row[field];
    const key = (table, row) => schema.collections[table].keys.length === 1 ? value(row, schema.collections[table].keys[0]) : JSON.stringify(schema.collections[table].keys.map(field => value(row, field)));
    function patch(table, row, values) {
      const patchKey = table + '|' + String(key(table, row));
      const entry = changed.get(patchKey) || {
        table,
        row,
        values: {}
      };
      for (const [field, value] of Object.entries(values))
        if (JSON.stringify(row[field]) !== JSON.stringify(value)) {
          row[field] = value;
          entry.values[field] = value;
        }
      if (Object.keys(entry.values).length) {
        changed.set(patchKey, entry);
      }
    }
    function insert(table, values) {
      const row = {
        ...schema.collections[table].defaults,
        ...values
      };
      if (schema.collections[table].keys.length === 1 && schema.collections[table].keys[0] === 'id') {
        row.id = state[table].reduce((max, item) => Math.max(max, item.id), 0) + 1;
      }
      row._id = key(table, row);
      state[table].push(row);
      inserted.add(row);
      return row;
    }
    if (!state.settings.some(row => row.key === 'baseline_v1')) {
      for (const name of schema.baseline.categories)
        if (!state.categories.some(row => row.name === name) && !state.category_aliases.some(row => row.alias === name)) {
          insert('categories', { name });
        }
      if (!state.services.length) {
        for (const [name, criticality] of schema.baseline.services)
          insert('services', {
            name,
            criticality
          });
      }
      for (const [priority, response_minutes, resolution_minutes] of schema.baseline.policies)
        if (!state.policies.some(row => row.priority === priority)) {
          insert('policies', {
            priority,
            response_minutes,
            resolution_minutes
          });
        }
      if (!state.settings.some(row => row.key === 'strategy')) {
        insert('settings', {
          key: 'strategy',
          value: 'skill'
        });
      }
      insert('settings', {
        key: 'baseline_v1',
        value: '1'
      });
    }
    if (!state.settings.some(row => row.key === 'schema_version' && row.value === schema.version)) {
      for (const [table, definition] of Object.entries(schema.collections))
        for (const row of state[table])
          patch(table, row, Object.fromEntries(Object.entries(definition.defaults).filter(([field]) => row[field] === undefined)));
      for (const user of state.users) {
        const role = schema.roleAliases[String(user.role).trim().toLowerCase().replace(/[\s/-]+/g, '_')];
        if (!role) {
          throw new Error('Unknown users.role; review the role field before applying. Existing records are preserved.');
        }
        patch('users', user, {
          role,
          skills: Array.isArray(user.skills) ? user.skills.join(',') : user.skills,
          active: typeof user.active === 'boolean' ? Number(user.active) : user.active,
          available: typeof user.available === 'boolean' ? Number(user.available) : user.available
        });
      }
      for (const table of ['subcategories', 'incident_types'])
        for (const row of state[table])
          if ([0, 1].includes(row.active)) {
            patch(table, row, { active: Boolean(row.active) });
          }
      for (const row of state.notifications)
        if (typeof row.is_read === 'boolean') {
          patch('notifications', row, { is_read: Number(row.is_read) });
        }
      const version = state.settings.find(row => row.key === 'schema_version');
      const values = {
        key: 'schema_version',
        value: schema.version,
        applied_at: Date.now() / 1000
      };
      if (version) {
        patch('settings', version, values);
      }
      else {
        insert('settings', values);
      }
    }
    if (!state.settings.some(row => row.key === 'employee_catalog_v1')) {
      for (const [category, subcategory, name, objective_description, serviceName] of schema.catalog) {
        const current = state.categories.find(row => row.name === category)?.name || state.category_aliases.find(row => row.alias === category)?.category;
        if (!current || !state.services.length) {
          continue;
        }
        const timestamp = Date.now() / 1000;
        const sub = state.subcategories.find(row => row.category === current && row.name === subcategory) || insert('subcategories', {
          category: current,
          name: subcategory,
          active: true,
          created_at: timestamp,
          updated_at: timestamp
        });
        if (!state.incident_types.some(row => row.subcategory_id === sub.id && row.name === name)) {
          const service = state.services.find(row => row.name === serviceName) || state.services[0];
          insert('incident_types', {
            subcategory_id: sub.id,
            name,
            objective_description,
            service_id: service.id,
            active: true,
            created_at: timestamp,
            updated_at: timestamp
          });
        }
      }
      if (state.services.length) {
        insert('settings', {
          key: 'employee_catalog_v1',
          value: '1'
        });
      }
    }
    // References and existing storage IDs are checked before any data changes.
    for (const [table, rows] of Object.entries(state))
      for (const row of rows) {
        if (schema.collections[table].keys.includes('id') && (typeof value(row, 'id') !== 'number' || !Number.isSafeInteger(value(row, 'id')) || value(row, 'id') < 1)) {
          throw new Error('A positive numeric id is required in ' + table + '; no identifiers were guessed.');
        }
        if (key(table, row) === undefined || String(row._id) !== String(key(table, row))) {
          throw new Error('Legacy identifier layout in ' + table + ' needs an explicit import; no identifiers were rewritten.');
        }
        if (table === 'incidents' && !schema.statuses.includes(row.status)) {
          throw new Error('Unknown incident status; review it before upgrading.');
        }
      }
    for (const [table, field, parent, parentField, nullable] of schema.references)
      for (const row of state[table]) {
        if (nullable && row[field] == null) {
          continue;
        }
        const equals = (a, b) => typeof a === 'string' || typeof b === 'string' ? a === b : String(a) === String(b);
        if (!state[parent].some(record => equals(record[parentField], row[field]))) {
          throw new Error('Missing reference ' + table + '.' + field + '; existing data was not replaced.');
        }
      }
    for (const [table, rows] of Object.entries(state))
      for (const row of rows)
        if (inserted.has(row)) {
          await database.getCollection(table).insertOne(row);
        }
    for (const { table, row, values } of changed.values())
      if (!inserted.has(row)) {
        await database.getCollection(table).updateOne({ _id: row._id }, { $set: values });
      }
    return {
      createdRecords: inserted.size,
      updatedRecords: [...changed.values()].filter(entry => !inserted.has(entry.row)).length
    };
  }
  async function apply(name = 'relay') {
    const database = target(name);
    const hello = await database.runCommand({ hello: 1 });
    if (!hello.setName && !hello.msg?.includes('isdbgrid')) {
      throw new Error('A replica set is required. Existing data was not changed.');
    }
    const names = await database.getCollectionNames();
    for (const table of [...Object.keys(schema.collections), '_meta'])
      if (!names.includes(table)) {
        await database.createCollection(table);
      }
    // DDL is additive and occurs outside the data transaction.
    for (const { collection, key, options } of schema.indexes)
      await database.getCollection(collection).createIndex(key, options);
    await database.getCollection('_meta').updateOne({ _id: 'workspace' }, { $setOnInsert: { revision: 0 } }, { upsert: true });
    const session = database.getMongo().startSession({ readPreference: { mode: 'primary' } });
    let counts;
    try {
      await session.withTransaction(async () => {
        const transaction = session.getDatabase(name);
        await transaction.getCollection('_meta').updateOne({ _id: 'workspace' }, { $inc: { revision: 1 } });
        counts = await upgradeData(transaction);
      }, {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      });
    }
    finally {
      await session.endSession();
    }
    const result = {
      database: name,
      version: schema.version,
      ...counts,
      preservedAccounts: true,
      deletedRecords: 0
    };
    print(JSON.stringify(result, null, 2));
    return result;
  }
  return {
    version: schema.version,
    preview,
    apply
  };
})();
print('Relay schema loaded. Run relaySchema.preview("relay"), then relaySchema.apply("relay").');
