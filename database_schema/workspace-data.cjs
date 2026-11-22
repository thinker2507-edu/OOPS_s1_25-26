"use strict";
const crypto = require("node:crypto");
const { DocumentStore, KEYS, clone } = require("../backend/src/repositories/document-store.cjs");
const { IncidentService, EMAIL } = require("../backend/src/services/incident-service.cjs");
const { ensureCatalog } = require("../backend/src/services/incident-catalog.cjs");
const { PriorityPolicy, FINISHED, passwordHash } = require("../backend/src/domain/index.cjs");
const { TEST_PASSWORD, TEST_ADMIN_EMAIL } = require('./test-accounts.cjs');
const DATASET = "relay-workspace-v1";
const CATEGORIES = [
  "Application",
  "Authentication",
  "Network",
  "Hardware",
  "Database",
  "Cloud",
  "Security",
  "Storage"
];
const CATALOG = [
  ["Payment Platform", 3, "Application"],
  ["Corporate Network", 3, "Network"],
  ["Employee Portal", 2, "Application"],
  ["Cloud Storage", 2, "Storage"],
  ["Office Devices", 1, "Hardware"],
  ["Identity and Access", 3, "Authentication"],
  ["Customer Database", 3, "Database"],
  ["Cloud Infrastructure", 2, "Cloud"],
  ["Security Monitoring", 3, "Security"],
  ["Developer Tools", 2, "Application"]
];
const SCENARIOS = {
  Application: ["Checkout requests return errors", "The application cannot complete the requested workflow.", "Restarted the affected application worker, corrected its configuration, and verified the workflow."],
  Network: ["Office VPN connection drops", "The network VPN disconnects repeatedly and interrupts access.", "Corrected the VPN gateway configuration and verified network connectivity."],
  Hardware: ["Laptop display stops responding", "The laptop screen becomes unresponsive during normal work.", "Replaced the faulty display adapter and verified the laptop hardware."],
  Database: ["Customer database query times out", "A database SQL query is timing out while retrieving customer records.", "Added the missing query index, refreshed database statistics, and verified response times."],
  Cloud: ["Cloud deployment health check fails", "The cloud deployment cannot pass its health check after a configuration change.", "Corrected the cloud health-check path and completed a verified deployment."],
  Security: ["Suspicious phishing message reported", "A suspicious phishing email requests account credentials.", "Blocked the phishing sender, revoked the affected session, and verified account security."],
  Authentication: ["Employee sign-in fails", "The login authentication flow fails after an MFA challenge.", "Corrected the authentication policy and verified sign-in with MFA."],
  Storage: ["Backup storage capacity reached", "The storage backup disk has insufficient capacity to complete the scheduled backup.", "Applied the approved retention policy, expanded storage, and verified the backup."]
};
const TECHNICIANS = [
  ["Sam Rivera", "Application,Authentication"],
  ["Priya Shah", "Network,Cloud"],
  ["Jordan Lee", "Database,Storage"],
  ["Morgan Patel", "Hardware,Application"],
  ["Avery Chen", "Security,Authentication"],
  ["Casey Williams", "Application,Database"],
  ["Taylor Brooks", "Network,Storage"],
  ["Riley Cooper", "Cloud,Hardware"]
];
const FIRST = [
  "Alex",
  "Jamie",
  "Robin",
  "Cameron",
  "Drew",
  "Harper",
  "Quinn",
  "Reese",
  "Skyler",
  "Emerson"
];
const LAST = [
  "Morgan",
  "Patel",
  "Chen",
  "Williams",
  "Brooks",
  "Singh",
  "Garcia",
  "Wilson",
  "Reed",
  "Shah"
];
const STATES = [
  "NEW",
  "CLASSIFIED",
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "VERIFIED",
  "CLOSED"
];
// Private dataset assembly adapter. The running application always uses MongoDB.
class DatasetWorkspace {
  constructor(state) {
    this.store = new DocumentStore(state);
  }
  transaction(operation) {
    const result = operation(this);
    if (result && typeof result.then === "function") {
      throw new Error("Dataset callbacks must be synchronous.");
    }
    return Promise.resolve(result);
  }
  read(operation) {
    return this.transaction(operation);
  }
  list(...args) {
    return this.store.list(...args);
  }
  one(...args) {
    return this.store.one(...args);
  }
  count(...args) {
    return this.store.count(...args);
  }
  insert(...args) {
    return this.store.insert(...args);
  }
  update(...args) {
    return this.store.update(...args);
  }
  remove(...args) {
    return this.store.remove(...args);
  }
  upsert(...args) {
    return this.store.upsert(...args);
  }
}
function preservedAccess(previous = {}) {
  const linked = new Set((previous.oauth_identities || []).map((row) => row.user_id));
  const users = (previous.users || []).filter((user) => user.seed_dataset !== DATASET || linked.has(user.id));
  const ids = new Set(users.map((user) => user.id));
  return {
    users: clone(users),
    oauth_identities: clone((previous.oauth_identities || []).filter((row) => ids.has(row.user_id)))
  };
}
function inputsFor(priority, criticality) {
  const policy = new PriorityPolicy();
  for (const affected of [1, 200]) {
    for (let impact = 1;impact <= 3;impact++) {
      for (let urgency = 1;urgency <= 3;urgency++) {
        if (policy.calculate(impact, urgency, criticality, affected).priority === priority) {
          return {
            impact,
            urgency,
            affected
          };
        }
      }
    }
  }
  return null;
}
function retimeIncident(workspace, service, incident, index, timestamp) {
  const policy = service.policy(incident.priority, incident.service_id);
  const response = policy.response_minutes * 60;
  const resolution = policy.resolution_minutes * 60;
  const completed = FINISHED.includes(incident.status);
  const late = Math.floor(index / 4) % 3 === 2;
  const ackOffset = late ? response * 1.2 : Math.min(120, response * 0.25);
  const resolveOffset = resolution * (late ? 1.15 : 0.6);
  let age;
  if (completed) {
    age = Math.max((1 + index % 28) * 86400, resolveOffset + 1800);
  }
  else {
    const hasAck = !["NEW", "CLASSIFIED", "ASSIGNED"].includes(incident.status);
    const target = hasAck ? resolution : response;
    const bucket = Math.floor(index / 4) % 3;
    age = target * [0.3, 0.9, 1.3][bucket];
    if (hasAck) {
      age = Math.max(age, ackOffset + 90);
    }
  }
  const created = timestamp - age;
  const ack = incident.acknowledged_at ? created + ackOffset : null;
  const resolved = incident.resolved_at ? created + resolveOffset : null;
  const closed = incident.closed_at ? resolved + 600 : null;
  const end = closed || (incident.status === "VERIFIED" ? resolved + 300 : resolved) || Math.max(created, timestamp - Math.min(120, age * 0.1));
  workspace.update("incidents", (row) => row.id === incident.id, {
    created_at: created,
    updated_at: end,
    response_due: created + response,
    resolution_due: created + resolution,
    acknowledged_at: ack,
    resolved_at: resolved,
    closed_at: closed
  });
  const entries = workspace.list("audit", (row) => row.incident_id === incident.id).sort((a, b) => a.id - b.id);
  const eventTimes = new Map();
  let lastTime = created;
  let comment = 0;
  entries.forEach((entry, position) => {
    let at = created + (end - created) * position / Math.max(1, entries.length - 1);
    if (entry.action === "Incident created" || entry.action === "Possible duplicate") {
      at = created;
    }
    else if (entry.action === "Comment added") {
      at = comment++ === 0 ? created + Math.min(30, ackOffset * 0.2, (end - created) / 3) : end;
    }
    else if (entry.action === "Feedback submitted") {
      at = end;
    }
    else if (entry.action === "Status changed") {
      if (entry.new_state === "ACKNOWLEDGED") {
        at = ack;
      }
      if (entry.new_state === "IN_PROGRESS") {
        at = created + ackOffset + 30;
      }
      if (entry.new_state === "WAITING") {
        at = Math.min(end, created + ackOffset + 60);
      }
      if (entry.new_state === "RESOLVED") {
        at = resolved;
      }
      if (entry.new_state === "VERIFIED") {
        at = resolved + 300;
      }
      if (entry.new_state === "CLOSED") {
        at = closed;
      }
    }
    at = Math.max(lastTime, Math.min(end, at === null ? end : at));
    lastTime = at;
    eventTimes.set(entry.action + ": " + entry.detail, at);
    workspace.update("audit", (row) => row.id === entry.id, { created_at: at });
  });
  const notes = workspace.list("notes", (row) => row.incident_id === incident.id);
  notes.forEach((note, position) => workspace.update("notes", (row) => row.id === note.id, {
    created_at: position === 0 ? created + Math.min(30, ackOffset * 0.2, (end - created) / 3) : end,
  }));
  const notices = workspace.list("notifications", (row) => row.incident_id === incident.id);
  notices.forEach((notice, position) => workspace.update("notifications", (row) => row.id === notice.id, {
    created_at: [...eventTimes].find(([message]) => notice.message.endsWith(message))?.[1] || created,
    is_read: index % 4 === 0 ? 1 : 0
  }));
}
async function buildSeedState(previous = {}, options = {}) {
  const timestamp = options.timestamp || Date.now() / 1000;
  const incidentCount = options.incidents === undefined ? 150 : Number(options.incidents);
  if (!Number.isInteger(incidentCount) || incidentCount < 32 || incidentCount > 500) {
    throw new Error("Choose 32-500 incidents.");
  }
  const password = options.testOnly ? TEST_PASSWORD : options.password || "Local-" + crypto.randomBytes(18).toString("base64url");
  const access = options.testOnly ? {
    users: [],
    oauth_identities: []
  } : preservedAccess(previous);
  const workspace = new DatasetWorkspace(access);
  let admin = workspace.one("users", (user) => user.role === "admin" && user.active);
  const generatedAccounts = [];
  const adminEmail = options.testOnly ? TEST_ADMIN_EMAIL : options.adminEmail;
  const adminPassword = options.testOnly ? TEST_PASSWORD : options.adminPassword;
  if (!admin) {
    if (access.users.length) {
      throw new Error("Keep an active administrator before resetting the workspace.");
    }
    if (typeof adminEmail !== "string" || !EMAIL.test(adminEmail.trim()) ||
      typeof adminPassword !== "string" || adminPassword.length < 10 || adminPassword.length > 128) {
      throw new Error("Configure APP_ADMIN_EMAIL and APP_ADMIN_PASSWORD before initializing an empty database.");
    }
    admin = workspace.insert("users", {
      name: "Administrator",
      email: adminEmail.trim().toLowerCase(),
      password: passwordHash(adminPassword),
      role: "admin",
      ...(options.testOnly ? { seed_dataset: DATASET } : {})
    });
    if (options.testOnly) {
      generatedAccounts.push({
        name: admin.name,
        email: admin.email,
        role: admin.role
      });
    }
  }
  for (const name of CATEGORIES)
    workspace.insert("categories", { name });
  const services = CATALOG.map(([name, criticality, category]) => ({
    ...workspace.insert("services", {
      name,
      criticality
    }),
    category
  }));
  for (const [priority, response_minutes, resolution_minutes] of [["P1", 5, 30], ["P2", 15, 120], ["P3", 60, 480], ["P4", 240, 1440]]) {
    workspace.insert("policies", {
      priority,
      response_minutes,
      resolution_minutes
    });
  }
  workspace.insert("settings", {
    key: "strategy",
    value: "skill"
  });
  workspace.insert("settings", {
    key: "dataset",
    value: DATASET
  });
  workspace.insert("category_aliases", {
    alias: "Software",
    category: "Application"
  });
  workspace.insert("service_policies", {
    service_id: services[0].id,
    priority: "P1",
    response_minutes: 3,
    resolution_minutes: 20
  });
  function addAccount(name, role, number, skills = "") {
    const email = (role === "technician" ? "tech" : "employee") + String(number).padStart(2, "0") + "@relay.test";
    const existing = workspace.one("users", (row) => row.email === email);
    if (existing) {
      return existing;
    }
    const user = workspace.insert("users", {
      name,
      email,
      role,
      skills,
      password: passwordHash(password),
      experience_years: role === "technician" ? 3 : 0,
      seed_dataset: DATASET
    });
    generatedAccounts.push({
      name,
      email,
      role
    });
    return user;
  }
  for (let index = 0;index < 30;index++)
    addAccount(FIRST[index % FIRST.length] + " " + LAST[Math.floor(index / FIRST.length) + index % 3], "employee", index + 1);
  TECHNICIANS.forEach(([name, skills], index) => addAccount(name, "technician", index + 1, skills));
  const reporters = workspace.list("users", (user) => user.active && user.role === "employee");
  if (!reporters.length) {
    throw new Error("At least one active employee is required for incident records.");
  }
  ensureCatalog(workspace);
  const service = new IncidentService(workspace);
  for (let index = 0;index < incidentCount;index++) {
    const rotation = index + (reporters.length % 2 === 0 ? 1 : 2) * Math.floor(index / reporters.length);
    const targetStatus = STATES[(rotation + 3) % STATES.length];
    const wantedPriority = ["P1", "P2", "P3", "P4"][rotation % 4];
    let affectedService = services[index % services.length];
    if (!inputsFor(wantedPriority, affectedService.criticality)) {
      affectedService = services.find((item) => inputsFor(wantedPriority, item.criticality));
    }
    const [title, description, resolution] = SCENARIOS[affectedService.category];
    const reporter = reporters[index % reporters.length];
    const availability = workspace.list("users", (user) => user.role === "technician").map((user) => [user.id, user.active]);
    if (["NEW", "CLASSIFIED"].includes(targetStatus)) {
      workspace.update("users", (user) => user.role === "technician", { active: 0 });
    }
    let incident;
    try {
      incident = await service.create(reporter, {
        title: title + " - " + [
          "Finance",
          "Operations",
          "Customer Support",
          "Engineering",
          "Sales"
        ][index % 5],
        description: description + " Reported from workstation " + String(101 + index) + ". The issue is reproducible and affects normal work.",
        service_id: affectedService.id,
        category: "auto",
        ...inputsFor(wantedPriority, affectedService.criticality)
      });
    }
    finally {
      if (["NEW", "CLASSIFIED"].includes(targetStatus)) {
        availability.forEach(([id, active]) => workspace.update("users", (user) => user.id === id, { active }));
      }
    }
    if (targetStatus === "NEW") {
      // Local historical fixture only: retain a pre-rollout NEW snapshot.
      workspace.update('incidents', row => row.id === incident.id, {
        status: 'NEW',
        assignment_problem: null
      });
      workspace.remove('audit', row => row.incident_id === incident.id && row.action === 'Incident classified');
      workspace.remove('notifications', row => row.incident_id === incident.id && row.message.includes('Incident classified'));
      incident.status = 'NEW';
    }
    if (!["NEW", "CLASSIFIED"].includes(targetStatus) && incident.status !== "ASSIGNED") {
      throw new Error("Generated dataset requires active technicians.");
    }
    await service.update(reporter, incident.id, {
      action: "note",
      body: "The issue was reproduced after signing in again. Please review the affected service and recent changes."
    });
    const technician = incident.technician_id ? workspace.one("users", (user) => user.id === incident.technician_id) : admin;
    const steps = {
      NEW: [],
      CLASSIFIED: [],
      ASSIGNED: [],
      ACKNOWLEDGED: ["ACKNOWLEDGED"],
      IN_PROGRESS: ["ACKNOWLEDGED", "IN_PROGRESS"],
      WAITING: ["ACKNOWLEDGED", "IN_PROGRESS", "WAITING"],
      RESOLVED: ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"],
      VERIFIED: ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "VERIFIED"],
      CLOSED: [
        "ACKNOWLEDGED",
        "IN_PROGRESS",
        "RESOLVED",
        "VERIFIED",
        "CLOSED"
      ]
    }[targetStatus];
    for (const status of steps) {
      await service.update(["VERIFIED", "CLOSED"].includes(status) ? reporter : technician, incident.id, {
        action: "status",
        status,
        resolution
      });
    }
    if (incident.technician_id && targetStatus !== "CLOSED") {
      await service.update(technician, incident.id, {
        action: "note",
        body: targetStatus === "WAITING" ? "Waiting for the requested diagnostic information before continuing investigation." : "Reviewed service health, recent changes and diagnostic logs. Investigation details have been recorded."
      });
    }
    if (FINISHED.includes(targetStatus)) {
      await service.update(reporter, incident.id, {
        action: "feedback",
        resolved: true,
        rating: 3 + index % 3,
        body: "The resolution was clear and the service is working as expected."
      });
    }
    retimeIncident(workspace, service, workspace.one("incidents", (row) => row.id === incident.id), index, timestamp);
  }
  // Historical local fixtures include pre-rollout unassigned states. SLA generation
  // must not run the live retry worker while assembling those snapshots.
  service.retryAssignments = () => {
  };
  await service.monitor();
  workspace.store.validate();
  return {
    state: clone(workspace.store.state),
    credentials: {
      password,
      accounts: generatedAccounts
    },
    preservedUsers: access.users.length,
    dataset: DATASET
  };
}
function summarize(state) {
  const incidents = state.incidents || [];
  const counts = (key) => incidents.reduce((result, row) => ({
    ...result,
    [row[key]]: (result[row[key]] || 0) + 1
  }), {});
  return {
    collections: Object.fromEntries(Object.keys(KEYS).map((name) => [name, (state[name] || []).length])),
    priorities: counts("priority"),
    statuses: counts("status"),
    duplicates: incidents.filter((row) => row.duplicate_of !== null).length
  };
}
module.exports = {
  DATASET,
  buildSeedState,
  preservedAccess,
  summarize
};
