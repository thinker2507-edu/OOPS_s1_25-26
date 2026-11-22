"use strict";
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { ROOT, configuration, dataDirectory } = require("../backend/src/config/environment.cjs");
const { MongoRepository } = require("../backend/src/repositories/mongo-repository.cjs");
const { KEYS } = require("../backend/src/repositories/document-store.cjs");
const { loopback } = require("../backend/src/integrations/google-auth.cjs");
const { buildSeedState, preservedAccess, summarize } = require("./workspace-data.cjs");
const { RETIRED, retiredSnapshot, removeRetired } = require('./retired-collections.cjs');
function validateTarget(config, confirmation = null) {
  const database = config.MONGODB_DATABASE || "relay";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(database) || ["admin", "config", "local"].includes(database.toLowerCase())) {
    throw new Error("Choose an application database; MongoDB system databases cannot be reset.");
  }
  let uri;
  try {
    uri = new URL(config.MONGODB_URI);
  }
  catch {
    throw new Error("Invalid local MongoDB connection configuration.");
  }
  if (uri.protocol !== "mongodb:" || !loopback(uri.hostname)) {
    throw new Error("This development reset only accepts a localhost MongoDB connection.");
  }
  if (confirmation !== null && confirmation !== database) {
    throw new Error("Confirmation must exactly match MONGODB_DATABASE. Nothing was reset.");
  }
  return database;
}
function fingerprint(state) {
  function stable(value) {
    if (Array.isArray(value)) {
      return value.map(stable);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    }
    return value;
  }
  const sorted = Object.fromEntries(Object.keys(KEYS).map((table) => [table,
    [...(state[table] || [])].map(stable).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]));
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}
function assertAppStopped(port) {
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Configure a fixed APP_PORT before applying a reset.");
  }
  return Promise.all(["127.0.0.1", "::1"].map((host) => new Promise((resolve, reject) => {
    const socket = net.connect({
      host,
      port: Number(port)
    });
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error("The app port is still in use. Close the app terminal before applying the reset."));
    });
    socket.once("error", (error) => error.code === "ECONNREFUSED" ? resolve() : reject(new Error("Could not verify that the app is stopped.")));
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("Could not verify that the app is stopped."));
    });
  }))).then(() => undefined);
}
async function connectForReset(config) {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
  try {
    await client.connect();
    const database = client.db(config.MONGODB_DATABASE || "relay");
    const hello = await database.admin().command({ hello: 1 });
    if (!hello.setName) {
      throw new Error("replica-set-required");
    }
    // Preview must not create collections or indexes.
    return new MongoRepository(client, database);
  }
  catch {
    await client.close();
    throw new Error("Cannot connect to the local MongoDB replica set. Start native MongoDB or the optional mongo/mongo-init containers and retry.");
  }
}
async function applyReset(repo, {
  databaseName,
  confirmation,
  assertStopped,
  writeBackup,
  writeCredentials,
  incidents = 150,
  adminEmail,
  adminPassword,
  testOnly = false,
}) {
  if (typeof databaseName !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(databaseName) ||
    confirmation !== databaseName || ["admin", "config", "local"].includes(databaseName.toLowerCase())) {
    throw new Error("Exact application database confirmation is required.");
  }
  if (repo.database && repo.database.databaseName !== databaseName) {
    throw new Error("Connected database does not match the reset target.");
  }
  if (!assertStopped || !writeBackup || !writeCredentials) {
    throw new Error("Shutdown verification, backup and local credential storage are required.");
  }
  await assertStopped();
  const previous = await repo.exportState();
  const retired = testOnly ? await retiredSnapshot(repo.database) : {};
  const before = fingerprint(previous);
  const prepared = await buildSeedState(previous, {
    incidents,
    adminEmail,
    adminPassword,
    testOnly
  });
  const backup = await writeBackup(previous, retired);
  if (!backup) {
    throw new Error("Backup did not complete. Nothing was reset.");
  }
  const credentialsFile = await writeCredentials(prepared.credentials);
  if (!credentialsFile) {
    throw new Error("Credential storage did not complete. Nothing was reset.");
  }
  await assertStopped();
  if (typeof repo.initialize === "function") {
    await repo.initialize();
  }
  await repo.replaceState(prepared.state, (current) => {
    if (fingerprint(current) !== before) {
      throw new Error("The workspace changed during preparation. Nothing was reset; stop other app instances and retry.");
    }
  });
  const collectionCleanup = testOnly ? await removeRetired(repo.database, retired) : {
    removed: [],
    retained: []
  };
  return {
    database: databaseName,
    dataset: prepared.dataset,
    backup,
    credentialsFile,
    preservedUsers: prepared.preservedUsers,
    testOnly,
    collectionCleanup,
    ...summarize(prepared.state)
  };
}
function parseArguments(args) {
  const options = {
    apply: false,
    incidents: 150,
    confirmation: null,
    help: false,
    testOnly: false
  };
  for (let index = 0;index < args.length;index++) {
    const argument = args[index];
    if (argument === "--help") {
      options.help = true;
    }
    else if (argument === '--test-only') {
      options.testOnly = true;
    }
    else if (argument === "--preview") {
      options.apply = false;
    }
    else if (argument === "--apply") {
      options.apply = true;
    }
    else if (argument === "--confirm") {
      options.confirmation = args[++index] || "";
    }
    else if (argument === "--incidents") {
      options.incidents = Number(args[++index]);
    }
    else {
      throw new Error("Unknown argument. Run node database_schema/reset-and-seed.cjs --help.");
    }
  }
  if (!Number.isInteger(options.incidents) || options.incidents < 32 || options.incidents > 500) {
    throw new Error("Choose 32-500 incidents.");
  }
  return options;
}
async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) {
    console.log("Preview: node database_schema/reset-and-seed.cjs --test-only --preview\nApply:   node database_schema/reset-and-seed.cjs --test-only --apply --confirm DATABASE_NAME\nOptional: --incidents 32..500\nTest-only mode replaces all application accounts/Google links and data with the documented local test dataset. Without --test-only, accounts/Google links are preserved. Close the app terminal first. Backup is mandatory. See login.md.");
    return;
  }
  if (options.apply && !options.confirmation) {
    throw new Error("Use --apply --confirm DATABASE_NAME after reviewing the preview.");
  }
  const config = configuration();
  const database = validateTarget(config, options.apply ? options.confirmation : null);
  const repo = await connectForReset(config);
  try {
    if (!options.apply) {
      const current = await repo.exportState();
      const existing = await repo.database.listCollections({}, { nameOnly: true }).toArray();
      console.log(JSON.stringify({
        mode: "preview",
        database,
        testOnly: options.testOnly,
        current: summarize(current),
        replaceCollections: Object.keys(KEYS).filter((name) => options.testOnly || !["users", "oauth_identities"].includes(name)),
        preserveAccounts: options.testOnly ? 0 : preservedAccess(current).users.length,
        preserveGoogleLinks: options.testOnly ? 0 : preservedAccess(current).oauth_identities.length,
        removeRetiredCollections: options.testOnly ? existing.map(entry => entry.name).filter(name => RETIRED.includes(name)) : [],
        leaveOtherCollections: existing.map((entry) => entry.name).filter((name) => !Object.hasOwn(KEYS, name) && name !== "_meta" && (!options.testOnly || !RETIRED.includes(name))),
        planned: {
          employees: 30,
          technicians: 8,
          services: 10,
          incidents: options.incidents,
          administrators: options.testOnly ? 1 : 'preserved'
        },
        next: "Close the app terminal, then run node database_schema/reset-and-seed.cjs " + (options.testOnly ? '--test-only ' : '') + "--apply --confirm " + database
      }, null, 2));
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomUUID().slice(0, 8);
    const folder = dataDirectory({ APP_DATA_DIR: "data" });
    const backups = path.join(folder, "backups");
    fs.mkdirSync(backups, { recursive: true });
    const result = await applyReset(repo, {
      databaseName: database,
      confirmation: options.confirmation,
      incidents: options.incidents,
      testOnly: options.testOnly,
      ...(options.testOnly ? {} : {
        adminEmail: config.APP_ADMIN_EMAIL,
        adminPassword: config.APP_ADMIN_PASSWORD
      }),
      assertStopped: () => assertAppStopped(config.APP_PORT || 3000),
      writeBackup: async (state, retiredCollections) => {
        const filename = path.join(backups, "relay-before-seed-" + stamp + ".json");
        fs.writeFileSync(filename, JSON.stringify({
          format: "relay-mongodb-v1",
          created: new Date().toISOString(),
          state,
          retiredCollections,
          retiredCollectionsFormat: 'MongoDB Extended JSON; includes original _id values'
        }, null, 2), {
          mode: 0o600,
          flag: "wx"
        });
        return path.relative(ROOT, filename);
      },
      writeCredentials: async (credentials) => {
        const filename = path.join(folder, "seed-access-" + stamp + ".json");
        fs.writeFileSync(filename, JSON.stringify(credentials, null, 2), {
          mode: 0o600,
          flag: "wx"
        });
        return path.relative(ROOT, filename);
      }
    });
    console.log(JSON.stringify({
      mode: "applied",
      ...result
    }, null, 2));
    console.log(options.testOnly ? "Start the app with start.bat and use the test logins in login.md. Previous application accounts and Google links were replaced." : "Start the app with start.bat and sign in again. Generated account access is stored only in the ignored local credentials file.");
  }
  finally {
    await repo.close();
  }
}
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = {
  main,
  parseArguments,
  validateTarget,
  fingerprint,
  assertAppStopped,
  connectForReset,
  applyReset
};
