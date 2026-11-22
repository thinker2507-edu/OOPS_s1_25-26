'use strict';
const { initializeDatabase } = require('../../../database_schema/initialize.cjs');
const { AsyncLocalStorage } = require('node:async_hooks');
const { DocumentStore, KEYS, documentKey } = require("./document-store.cjs");
const { AppError, DatabaseFailureError } = require("../domain/index.cjs");
class MongoRepository {
  constructor(client, database) {
    this.client = client;
    this.database = database;
    this.context = new AsyncLocalStorage();
    this.queue = Promise.resolve();
    this.provider = 'mongodb';
  }
  static async connect(config) {
    let MongoClient;
    try {
      ({ MongoClient } = require('mongodb'));
    }
    catch {
      throw new Error('MongoDB driver is missing. Run npm install, or use docker compose up --build. See docs/DOCKER_MONGODB.md.');
    }
    const client = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    try {
      await client.connect();
      const db = client.db(config.MONGODB_DATABASE || 'relay');
      const hello = await db.admin().command({ hello: 1 });
      if (!hello.setName && !hello.msg?.includes('isdbgrid')) {
        throw new Error('A replica set is required for atomic multi-collection transactions.');
      }
      const repo = new MongoRepository(client, db);
      await repo.initialize();
      return repo;
    }
    catch (error) {
      await client.close();
      throw new DatabaseFailureError('Cannot connect to a MongoDB replica set. Start your local MongoDB replica set or optional Docker database and check MONGODB_URI. See docs/LOCAL_MONGODB.md. ' + (error.message.includes('replica set is required') ? 'A standalone MongoDB process must be configured as a replica set.' : ''));
    }
  }
  async initialize() {
    return initializeDatabase(this.database);
  }
  active() {
    const store = this.context.getStore();
    if (!store) {
      throw new Error('Document access requires a transaction/read callback.');
    }
    return store;
  }
  list(...args) {
    return this.active().list(...args);
  }
  one(...args) {
    return this.active().one(...args);
  }
  count(...args) {
    return this.active().count(...args);
  }
  insert(...args) {
    return this.active().insert(...args);
  }
  update(...args) {
    return this.active().update(...args);
  }
  remove(...args) {
    return this.active().remove(...args);
  }
  upsert(...args) {
    return this.active().upsert(...args);
  }
  transaction(operation) {
    return this.perform(operation, true);
  }
  read(operation) {
    return this.perform(operation, false);
  }
  perform(operation, write) {
    const task = this.queue.then(async () => {
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          // A write on one workspace lock document serializes mutations across app
          // instances, including workload decisions and numeric ID allocation.
          if (write) {
            await this.database.collection('_meta').updateOne({ _id: 'workspace' }, { $inc: { revision: 1 } }, { session });
          }
          const before = {};
          for (const table of Object.keys(KEYS))
            before[table] = (await this.database.collection(table).find({}, { session }).toArray()).map(({ _id, ...row }) => row);
          const store = new DocumentStore(before);
          const result = this.context.run(store, () => operation(this));
          if (result && typeof result.then === 'function') {
            throw new Error('Unit-of-work callbacks must be synchronous; await external I/O outside a transaction.');
          }
          if (!write && store.changed) {
            throw new Error('Cannot mutate a read-only unit of work.');
          }
          if (store.changed) {
            store.validate();
            await this.flush(before, store.state, session);
          }
          return result;
        }, {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary'
        });
      }
      catch (error) {
        if (error.code === 11000) {
          throw new AppError('This record already exists.', 409);
        }
        throw error;
      }
      finally {
        await session.endSession();
      }
    });
    this.queue = task.catch(() => {
    });
    return task;
  }
  async flush(before, after, session) {
    for (const table of Object.keys(KEYS)) {
      const old = new Map(before[table].map(r => [documentKey(table, r), r]));
      const next = new Map(after[table].map(r => [documentKey(table, r), r]));
      const operations = [];
      for (const [key, row] of next)
        if (!old.has(key) || JSON.stringify(old.get(key)) !== JSON.stringify(row)) {
          operations.push({
            replaceOne: {
              filter: { _id: key },
              replacement: {
                _id: key,
                ...row
              },
              upsert: true
            }
          });
        }
      for (const key of old.keys())
        if (!next.has(key)) {
          operations.push({ deleteOne: { filter: { _id: key } } });
        }
      if (operations.length) {
        await this.database.collection(table).bulkWrite(operations, {
          session,
          ordered: true
        });
      }
    }
  }
  exportState() {
    return this.read(repo => Object.fromEntries(Object.keys(KEYS).map(t => [t, repo.list(t)])));
  }
  replaceState(state, verifyCurrent) {
    const replacement = new DocumentStore(state);
    replacement.validate();
    const task = this.queue.then(async () => {
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          await this.database.collection("_meta").updateOne({ _id: "workspace" }, { $inc: { revision: 1 } }, { session });
          const current = {};
          for (const table of Object.keys(KEYS)) {
            current[table] = (await this.database.collection(table).find({}, { session }).toArray())
              .map(({ _id, ...row }) => row);
          }
          const verified = verifyCurrent(current);
          if (verified && typeof verified.then === "function") {
            throw new Error("Replacement verification must be synchronous.");
          }
          // Clear before inserting so reordered IDs cannot collide with old unique values.
          // The transaction keeps these intermediate deletions invisible to readers.
          for (const table of Object.keys(KEYS)) {
            await this.database.collection(table).deleteMany({}, { session });
          }
          for (const table of Object.keys(KEYS)) {
            const rows = replacement.state[table];
            if (rows.length) {
              await this.database.collection(table).insertMany(rows.map((row) => ({
                _id: documentKey(table, row),
                ...row
              })), {
                session,
                ordered: true
              });
            }
          }
          return { replaced: true };
        }, {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          readPreference: "primary"
        });
      }
      finally {
        await session.endSession();
      }
    });
    this.queue = task.catch(() => {
    });
    return task;
  }
  async importState(state) {
    return this.transaction(repo => {
      if (Object.keys(KEYS).some(t => repo.count(t) > 0)) {
        throw new AppError('Import requires an empty target database. Existing records were not changed.', 409);
      }
      for (const table of Object.keys(KEYS))
        for (const row of state[table] || [])
          repo.insert(table, row);
      return { imported: true };
    });
  }
  async healthy() {
    try {
      await this.database.command({ ping: 1 });
      return true;
    }
    catch {
      return false;
    }
  }
  async close() {
    await this.queue;
    await this.client.close();
  }
}
module.exports = { MongoRepository };
