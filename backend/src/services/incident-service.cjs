'use strict';
const {
  AppError,
  Forbidden,
  now,
  passwordHash,
  text,
  integer,
  PriorityPolicy,
  IncidentLifecycle,
  IncidentIntelligence,
  STRATEGIES,
  TRANSITIONS,
  FINISHED
} = require("../domain/index.cjs");
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const { createHash } = require('node:crypto');
const { catalog } = require('./incident-catalog.cjs');
const { seedWorkspace } = require('../../../database_schema/bootstrap.cjs');
const { validateAttachments, saveAttachments, attachmentMetadata } = require('./incident-attachments.cjs');
const { requireAdmin, auditPage, slaPage, recordConfiguration } = require('./operations-monitor.cjs');
const { rankIncident, sameReport, tokens } = require('./incident-search.cjs');
const { DEFAULT_WEIGHTS } = require('../domain/assignment-strategies.cjs');
const { compareSla, urgency: queueUrgency } = require('../domain/sla-queue.cjs');
const { relatedIncidents } = require('./related-incidents.cjs');
const {
  InvalidIncidentError,
  TechnicianUnavailableError,
  ServiceNotFoundError,
  MissingSLAConfigurationError,
  DuplicateIncidentError
} = require('../domain/errors.cjs');
function submittedIncident({ request_key, request_fingerprint, ...incident }) {
  return incident;
}
class Notifier {
  notify() {
    throw new Error('Notifier.notify must be implemented.');
  }
}
class RecordNotifier extends Notifier {
  constructor(channel) {
    super();
    this.channel = channel;
  }
  notify(repo, userId, incidentId, message) {
    repo.insert('notifications', {
      user_id: userId,
      incident_id: incidentId,
      message,
      channel: this.channel,
      created_at: now()
    });
  }
}
class InAppNotifier extends RecordNotifier {
  constructor() {
    super('in_app');
  }
}
class EmailOutboxNotifier extends RecordNotifier {
  constructor() {
    super('email_outbox');
  }
}
class EventBus {
  constructor() {
    this.observers = [new InAppNotifier(), new EmailOutboxNotifier()];
  }
  publish(repo, incident, actor, action, detail = '', old = null) {
    repo.insert('audit', {
      incident_id: incident.id,
      user_id: actor,
      action,
      old_state: old,
      new_state: incident.status,
      detail,
      created_at: now()
    });
    const recipients = new Set([incident.reporter_id, incident.technician_id, ...repo.list('users', u => u.role === 'admin' && u.active).map(u => u.id)]);
    for (const id of recipients)
      if (id !== null && id !== undefined) {
        for (const observer of this.observers)
          observer.notify(repo, id, incident.id, 'INC-' + String(incident.id).padStart(4, '0') + ' · ' + action + ': ' + detail);
      }
  }
}
class IncidentService {
  constructor(repo) {
    this.repo = repo;
    this.priority = new PriorityPolicy();
    this.intelligence = new IncidentIntelligence();
    this.events = new EventBus();
  }
  seed(config) {
    return seedWorkspace(this, config);
  }
  technicians() {
    return this.repo.list('users', u => u.role === 'technician' && u.active).map(({ password, active, ...u }) => ({
      ...u,
      workload: this.repo.count('incidents', i => i.technician_id === u.id && !FINISHED.includes(i.status))
    }));
  }
  policy(priority, serviceId) {
    return this.repo.one('service_policies', p => p.priority === priority && p.service_id === serviceId) || this.repo.one('policies', p => p.priority === priority);
  }
  assignmentCandidate(i) {
    const weights = this.repo.one('settings', s => s.key === 'assignment_weights')?.value || DEFAULT_WEIGHTS;
    const candidates = this.technicians().map(t => ({
      ...t,
      completed: this.repo.count('incidents', row => row.technician_id === t.id && row.service_id === i.service_id && FINISHED.includes(row.status))
    }));
    return STRATEGIES.skill.choose(candidates, i.category, {
      weights,
      reporterId: i.reporter_id
    });
  }
  assignAutomatically(repo, i) {
    if (i.status === 'NEW') {
      i.status = 'CLASSIFIED';
      this.events.publish(repo, i, null, 'Incident classified', i.category + '; automatic classification', 'NEW');
    }
    const tech = this.assignmentCandidate(i);
    if (!tech) {
      repo.update('incidents', row => row.id === i.id, {
        status: i.status,
        assignment_problem: 'No active technician is available for assignment. Please activate a technician or try again later. Assignment will retry automatically.'
      });
      i.assignment_problem = 'No active technician is available for assignment. Please activate a technician or try again later. Assignment will retry automatically.';
      return i;
    }
    const old = i.status;
    Object.assign(i, {
      status: 'ASSIGNED',
      technician_id: tech.id,
      assignment_problem: null,
      updated_at: now()
    });
    repo.update('incidents', row => row.id === i.id, i);
    repo.update('users', u => u.id === tech.id, { last_assigned_at: now() });
    this.events.publish(repo, i, null, 'Technician assigned', tech.name + '; automatic weighted assignment', old);
    return i;
  }
  retryAssignments(repo) {
    for (const i of repo.list('incidents', row => row.status === 'CLASSIFIED' && !row.technician_id).sort((a, b) => a.created_at - b.created_at || a.id - b.id))
      this.assignAutomatically(repo, i);
  }
  relatedFor(user, id) {
    return this.repo.read(repo => relatedIncidents(this, repo, user, id));
  }
  deleteIncident(user, id, data) {
    requireAdmin(user);
    return this.repo.transaction(repo => {
      this.get(id, user);
      if (data.confirmation !== 'INC-' + String(id).padStart(4, '0')) {
        throw new AppError('Enter the exact incident reference to confirm permanent deletion.');
      }
      const sequence = Math.max(Number(repo.one('settings', s => s.key === 'incident_sequence')?.value || 0), repo.list('incidents').reduce((max, i) => Math.max(max, i.id), 0));
      repo.upsert('settings', s => s.key === 'incident_sequence', {
        key: 'incident_sequence',
        value: sequence
      });
      for (const table of [
        'attachments',
        'notes',
        'support_requests',
        'audit',
        'notifications',
        'sla_events'
      ])
        repo.remove(table, row => row.incident_id === id);
      repo.update('incidents', row => row.duplicate_of === id, { duplicate_of: null });
      repo.remove('incidents', row => row.id === id);
      return { ok: true };
    });
  }
  storage(user) {
    requireAdmin(user);
    return this.repo.read(repo => {
      const attachments = repo.list('attachments');
      return {
        attachments: attachments.length,
        attachment_bytes: attachments.reduce((n, row) => n + Buffer.byteLength(row.data || '', 'base64'), 0),
        record_bytes: Object.keys(require('../../../database_schema/collections.cjs').KEYS).reduce((n, table) => n + Buffer.byteLength(JSON.stringify(repo.list(table))), 0),
        incidents: repo.count('incidents'),
        measurement: 'Logical application bytes; includes base64 overhead in record bytes. Check Atlas for indexes and physical quota usage.'
      };
    });
  }
  get(id, user) {
    const i = this.repo.one('incidents', i => i.id === id);
    if (!i) {
      throw new InvalidIncidentError();
    }
    if (!this.canView(i, user)) {
      throw new Forbidden();
    }
    return i;
  }
  canView(incident, user) {
    return user.role === 'admin' || incident.reporter_id === user.id || user.role === 'technician' && incident.technician_id === user.id;
  }
  requireOperator(i, user) {
    if (user.role !== 'admin' && !(user.role === 'technician' && i.technician_id === user.id)) {
      throw new Forbidden('Only the assigned technician or administrator can do this.');
    }
  }
  async search(user, query = {}) {
    if (!['admin', 'technician'].includes(user.role)) {
      throw new Forbidden('Smart search is available to managers and technicians.');
    }
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (q.length > 200 || tokens(q).length > 20) {
      throw new AppError('Use up to 200 characters and 20 search terms.');
    }
    const page = integer({ page: query.page ?? 1 }, 'page', 1, 1000000);
    return this.repo.read(repo => {
      if (!q) {
        return {
          results: [],
          total: 0,
          page,
          pages: 0
        };
      }
      const visible = repo.list('incidents', i => this.canView(i, user));
      const visibleIds = new Set(visible.map(i => i.id));
      const conversations = new Map();
      for (const collection of ['notes', 'support_requests']) {
        for (const entry of repo.list(collection, entry => visibleIds.has(entry.incident_id))) {
          conversations.set(entry.incident_id, (conversations.get(entry.incident_id) || '') + ' ' + entry.body);
        }
      }
      const results = visible.flatMap(i => {
        const service = repo.one('services', s => s.id === i.service_id)?.name || '';
        const match = rankIncident(q, i, [
          ['Title', i.title, 5],
          ['Details', i.description + ' ' + (i.additional_details || ''), 3],
          ['Classification', [i.category, i.subcategory, i.incident_type].join(' '), 3],
          ['Service', service, 2],
          ['Status', i.status + ' ' + i.priority, 2],
          ['Resolution', [i.resolution, i.resolution_actions, i.resolution_remarks].join(' '), 3],
          ['Conversation', conversations.get(i.id), 2]
        ]);
        return match ? [{
          id: i.id,
          title: i.title,
          status: i.status,
          updated_at: i.updated_at,
          ...match
        }] : [];
      }).sort((a, b) => b.score - a.score || b.updated_at - a.updated_at || b.id - a.id);
      return {
        results: results.slice((page - 1) * 50, page * 50),
        total: results.length,
        page,
        pages: Math.ceil(results.length / 50)
      };
    });
  }
  create(user, data) {
    const files = validateAttachments(data.attachments);
    const modern = data.incident_type_id !== undefined;
    const requestKey = modern ? text(data, 'request_key', 100, 16) : null;
    const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return this.repo.transaction(repo => {
      if (requestKey) {
        const previous = repo.one('incidents', i => i.reporter_id === user.id && i.request_key === requestKey);
        if (previous) {
          if (previous.request_fingerprint !== fingerprint) {
            throw new AppError('This submission has already been processed with different details. Refresh the page before submitting a new report.', 409);
          }
          return submittedIncident(previous);
        }
      }
      let values = data;
      let classification = {};
      if (modern) {
        const type = repo.one('incident_types', t => t.id === integer(data, 'incident_type_id', 1, 999999) && t.active !== false);
        const sub = type && repo.one('subcategories', s => s.id === type.subcategory_id && s.active !== false);
        if (!type || !sub) {
          throw new AppError('Select an available incident type.');
        }
        const additional_details = text(data, 'additional_details', 10000, 0);
        classification = {
          incident_type_id: type.id,
          incident_type: type.name,
          subcategory_id: sub.id,
          subcategory: sub.name,
          objective_description: type.objective_description,
          additional_details
        };
        values = {
          ...data,
          title: type.name,
          description: type.objective_description + (additional_details ? '\n\n' + additional_details : ''),
          category: sub.category,
          service_id: type.service_id
        };
      }
      const title = text(values, 'title', 160, 5);
      const description = text(values, 'description', 12000, 10);
      const impact = integer({
        ...values,
        impact: values.impact ?? 1
      }, 'impact', 1, 3);
      const urgency = integer({
        ...values,
        urgency: values.urgency ?? 2
      }, 'urgency', 1, 3);
      const affected = integer({
        ...values,
        affected: values.affected ?? 1
      }, 'affected', 1, 1000000);
      const sid = integer(values, 'service_id', 1, 999999);
      const service = repo.one('services', s => s.id === sid);
      if (!service) {
        throw new ServiceNotFoundError();
      }
      let category = values.category ?? 'auto';
      if (typeof category !== 'string') {
        throw new AppError('Please select a valid incident category.');
      }
      if (category === 'auto') {
        category = this.intelligence.categorize(title + ' ' + description);
        if (!repo.one('categories', c => c.name === category)) {
          category = repo.one('category_aliases', a => a.alias === category)?.category || category;
        }
      }
      if (!repo.one('categories', c => c.name === category)) {
        throw new AppError('Category not found.');
      }
      const repeat = repo.one('incidents', i => !FINISHED.includes(i.status) && sameReport(i, {
        ...classification,
        reporter_id: user.id,
        service_id: sid,
        title,
        description
      }));
      if (repeat) {
        throw new DuplicateIncidentError('You already reported this active issue as INC-' + String(repeat.id).padStart(4, '0') + '. Open that incident and add information instead of submitting it again.');
      }
      const { priority, score } = this.priority.calculate(impact, urgency, service.criticality, affected);
      const policy = this.policy(priority, sid);
      if (!policy) {
        throw new MissingSLAConfigurationError();
      }
      const time = now();
      const incidentId = Math.max(Number(repo.one('settings', s => s.key === 'incident_sequence')?.value || 0), repo.list('incidents').reduce((max, i) => Math.max(max, i.id), 0)) + 1;
      repo.upsert('settings', s => s.key === 'incident_sequence', {
        key: 'incident_sequence',
        value: incidentId
      });
      const i = repo.insert('incidents', {
        id: incidentId,
        ...classification,
        request_key: requestKey,
        request_fingerprint: fingerprint,
        title,
        description,
        reporter_id: user.id,
        service_id: sid,
        category,
        impact,
        urgency,
        affected,
        priority,
        score,
        status: 'NEW',
        technician_id: null,
        created_at: time,
        updated_at: time,
        response_due: time + policy.response_minutes * 60,
        resolution_due: time + policy.resolution_minutes * 60,
        duplicate_of: null
      });
      saveAttachments(repo, files, i, user, 'report');
      this.events.publish(repo, i, user.id, 'Incident created', category + '; ' + priority + ' (score ' + score + ')');
      this.assignAutomatically(repo, i);
      return submittedIncident(i);
    });
  }
  detail(user, id) {
    return this.repo.read(repo => {
      const i = this.get(id, user);
      const suggestions = user.role === 'employee' ? {
        duplicates: [],
        correlations: []
      } : relatedIncidents(this, repo, user, id);
      const name = uid => repo.one('users', u => u.id === uid)?.name || 'System';
      return {
        ...i,
        request_fingerprint: undefined,
        request_key: undefined,
        technician: i.technician_id ? name(i.technician_id) : null,
        attachments: repo.list('attachments', a => a.incident_id === id).map(attachmentMetadata),
        support_requests: this.requestsFor(user, id),
        notes: repo.list('notes', n => n.incident_id === id).sort((a, b) => a.id - b.id).map(n => ({
          ...n,
          name: name(n.user_id)
        })),
        audit: repo.list('audit', a => a.incident_id === id).sort((a, b) => b.id - a.id).map(a => ({
          ...a,
          actor: name(a.user_id)
        })),
        ...queueUrgency(i),
        related: suggestions.duplicates,
        correlations: suggestions.correlations
      };
    });
  }
  async update(user, id, data) {
    const files = validateAttachments(data.attachments);
    await this.repo.transaction(repo => {
      const i = this.get(id, user);
      const old = i.status;
      const time = now();
      switch (data.action) {
        case 'investigation':
        case 'information':
        case 'note': {
          if (data.action === 'investigation') {
            this.requireOperator(i, user);
          }
          if (old === 'CLOSED') {
            throw new AppError('Closed incidents cannot receive additional information.');
          }
          const body = text(data, 'body', 5000, files.length ? 0 : 1);
          const note = repo.insert('notes', {
            incident_id: id,
            user_id: user.id,
            body,
            kind: user.role === 'employee' ? 'information' : user.role === 'technician' || data.action === 'investigation' ? 'investigation' : 'note',
            created_at: time
          });
          saveAttachments(repo, files, i, user, 'note', note.id);
          this.events.publish(repo, i, user.id, user.role === 'employee' ? 'Additional information submitted' : note.kind === 'investigation' ? 'Investigation note added' : 'Comment added', body || 'Supporting attachments added');
          break;
        }
        case 'support_request': {
          this.requireOperator(i, user);
          if (old === 'CLOSED') {
            throw new AppError('Closed incidents cannot receive requests.');
          }
          const body = text(data, 'body', 5000);
          const request = repo.insert('support_requests', {
            incident_id: id,
            user_id: user.id,
            body,
            created_at: time,
            status: 'pending'
          });
          saveAttachments(repo, files, i, user, 'request', request.id);
          this.events.publish(repo, i, user.id, 'Support requested information', body);
          break;
        }
        case 'support_response': {
          if (user.id !== i.reporter_id) {
            throw new Forbidden();
          }
          if (old === 'CLOSED') {
            throw new AppError('Closed incidents cannot receive responses.');
          }
          const requestId = integer(data, 'request_id', 1, 999999999);
          const request = repo.one('support_requests', r => r.id === requestId && r.incident_id === id);
          if (!request) {
            throw new AppError('Support request not found.', 404);
          }
          if (request.status === 'responded') {
            throw new AppError('This request has already been answered.', 409);
          }
          const body = text(data, 'body', 5000, files.length ? 0 : 1);
          const note = repo.insert('notes', {
            incident_id: id,
            user_id: user.id,
            body,
            kind: 'support_response',
            support_request_id: requestId,
            created_at: time
          });
          repo.update('support_requests', r => r.id === requestId, {
            status: 'responded',
            responded_at: time
          });
          saveAttachments(repo, files, i, user, 'note', note.id);
          this.events.publish(repo, i, user.id, 'Employee responded to support request', body || 'Supporting attachments provided');
          break;
        }
        case 'status': {
          const status = text(data, 'status', 30);
          const remarks = text(data, 'remarks', 5000, 0);
          IncidentLifecycle.validate(old, status);
          if (status === 'ASSIGNED') {
            throw new AppError('Use technician assignment after classification.');
          }
          if (files.length && status !== 'RESOLVED') {
            throw new AppError('Resolution attachments can only be saved when resolving. Add investigation files with a note.');
          }
          if (['VERIFIED', 'CLOSED'].includes(status)) {
            if (user.role !== 'admin' && i.reporter_id !== user.id) {
              throw new Forbidden('The reporter or administrator must verify and close.');
            }
          }
          else if (!(old === 'RESOLVED' && status === 'IN_PROGRESS' && i.reporter_id === user.id)) {
            this.requireOperator(i, user);
          }
          if (old === 'RESOLVED' && status === 'IN_PROGRESS') {
            const tech = this.technicians().find(t => t.id === i.technician_id);
            if (!tech) {
              throw new TechnicianUnavailableError('The previous technician is unavailable. Ask an administrator to choose an available technician before reopening.');
            }
          }
          if (status === 'RESOLVED') {
            i.resolution = text(data, 'resolution', 10000, 10);
            i.resolution_actions = text(data, 'resolution_actions', 10000, 0);
            i.resolution_remarks = text(data, 'resolution_remarks', 5000, 0);
            saveAttachments(repo, files, i, user, 'resolution');
          }
          i.status = status;
          if (status === 'ACKNOWLEDGED') {
            i.acknowledged_at = time;
          }
          if (status === 'RESOLVED') {
            i.resolved_at = time;
          }
          if (status === 'IN_PROGRESS') {
            i.resolved_at = null;
          }
          if (status === 'CLOSED') {
            i.closed_at = time;
          }
          repo.update('incidents', r => r.id === id, {
            status,
            resolution: i.resolution,
            resolution_actions: i.resolution_actions || '',
            resolution_remarks: i.resolution_remarks || '',
            acknowledged_at: i.acknowledged_at,
            resolved_at: i.resolved_at,
            closed_at: i.closed_at,
            updated_at: time
          });
          this.events.publish(repo, i, user.id, 'Status changed', (status === 'RESOLVED' ? i.resolution : status) + (remarks ? '; ' + remarks : ''), old);
          break;
        }
        case 'auto_assign':
        case 'assign': {
          if (user.role !== 'admin') {
            throw new Forbidden();
          }
          if (FINISHED.includes(old)) {
            throw new AppError('Reopen the incident before assigning.');
          }
          const candidate = data.action === 'auto_assign' ? this.assignmentCandidate(i) : null;
          if (data.action === 'auto_assign' && !candidate) {
            throw new TechnicianUnavailableError('No active technician is available for assignment. Please activate a technician or try again later.');
          }
          const tid = candidate?.id ?? integer(data, 'technician_id', 1, 999999);
          const tech = this.technicians().find(t => t.id === tid);
          if (!tech) {
            throw new TechnicianUnavailableError();
          }
          i.technician_id = tid;
          if (old === 'NEW') {
            i.status = 'CLASSIFIED';
            this.events.publish(repo, i, user.id, 'Incident classified', i.category + '; reviewed for assignment', 'NEW');
          }
          if (['NEW', 'CLASSIFIED'].includes(old)) {
            i.status = 'ASSIGNED';
          }
          repo.update('incidents', r => r.id === id, {
            technician_id: tid,
            status: i.status,
            updated_at: time
          });
          this.events.publish(repo, i, user.id, 'Technician assigned', tech.name, old === 'NEW' ? 'CLASSIFIED' : old);
          repo.update('users', u => u.id === tid, { last_assigned_at: time });
          break;
        }
        case 'edit': {
          this.requireOperator(i, user);
          if (FINISHED.includes(old)) {
            throw new AppError('Reopen before editing impact.');
          }
          const impact = integer(data, 'impact', 1, 3);
          const urgency = integer(data, 'urgency', 1, 3);
          const criticality = repo.one('services', s => s.id === i.service_id).criticality;
          const { priority, score } = this.priority.calculate(impact, urgency, criticality, i.affected);
          const policy = this.policy(priority, i.service_id);
          if (!policy) {
            throw new MissingSLAConfigurationError();
          }
          repo.update('incidents', r => r.id === id, {
            impact,
            urgency,
            priority,
            score,
            response_due: i.acknowledged_at || i.resolved_at ? i.response_due : i.created_at + policy.response_minutes * 60,
            resolution_due: i.resolved_at ? i.resolution_due : i.created_at + policy.resolution_minutes * 60,
            updated_at: time
          });
          this.events.publish(repo, i, user.id, 'Priority recalculated', i.priority + ' → ' + priority + '; score ' + score + '; deadlines from creation');
          break;
        }
        case 'category': {
          this.requireOperator(i, user);
          const category = text(data, 'category', 60);
          if (i.incident_type_id) {
            throw new AppError('Catalog incidents retain their submitted classification. Review the catalog separately.');
          }
          if (!repo.one('categories', c => c.name === category)) {
            throw new AppError('Category not found.');
          }
          repo.update('incidents', r => r.id === id, {
            category,
            updated_at: time
          });
          this.events.publish(repo, i, user.id, 'Category corrected', i.category + ' → ' + category);
          break;
        }
        case 'feedback': {
          if (i.reporter_id !== user.id) {
            throw new Forbidden();
          }
          if (!FINISHED.includes(old)) {
            throw new AppError('Feedback is available after resolution.');
          }
          const rating = integer(data, 'rating', 1, 5);
          const body = text(data, 'body', 2000, 0);
          if (typeof data.resolved !== 'boolean') {
            throw new AppError('Choose whether your problem was resolved.');
          }
          if (i.feedback != null) {
            throw new AppError('Feedback has already been submitted.', 409);
          }
          repo.update('incidents', r => r.id === id, {
            feedback: rating,
            feedback_text: body,
            feedback_resolved: data.resolved,
            feedback_at: time,
            feedback_by: user.id
          });
          this.events.publish(repo, i, user.id, 'Feedback submitted', rating + '/5 ' + body);
          break;
        }
        default: throw new AppError('This incident action is not supported. Please refresh the page and try again.');
      }
      repo.update('incidents', r => r.id === id, { updated_at: time });
    });
    return this.detail(user, id);
  }
  catalog() {
    return this.repo.read(repo => catalog(repo));
  }
  requestsFor(user, incidentId = null) {
    const owned = new Set(this.repo.list('incidents', i => this.canView(i, user) && (incidentId === null || i.id === incidentId)).map(i => i.id));
    return this.repo.list('support_requests', r => owned.has(r.incident_id)).sort((a, b) => b.id - a.id).map(r => ({
      ...r,
      requester: this.repo.one('users', u => u.id === r.user_id)?.name || 'Support',
      incident_title: this.repo.one('incidents', i => i.id === r.incident_id)?.title,
      incident_status: this.repo.one('incidents', i => i.id === r.incident_id)?.status,
      responses: this.repo.list('notes', n => n.support_request_id === r.id)
    }));
  }
  supportRequests(user) {
    return this.repo.read(() => this.requestsFor(user));
  }
  audit(user, query = {}) {
    requireAdmin(user);
    return this.repo.read(repo => auditPage(repo, user, query));
  }
  async slaViolations(user) {
    requireAdmin(user);
    await this.monitor();
    return this.repo.read(repo => slaPage(repo, user));
  }
  attachment(user, id) {
    return this.repo.read(repo => {
      const row = repo.one('attachments', a => a.id === id);
      if (!row) {
        throw new AppError('Attachment not found.', 404);
      }
      this.get(row.incident_id, user);
      return row;
    });
  }
  monitor() {
    const time = now();
    return this.repo.transaction(repo => {
      this.retryAssignments(repo);
      for (const i of repo.list('incidents')) {
        const events = [];
        if ((i.acknowledged_at || i.resolved_at || time) > i.response_due) {
          events.push('Response breached');
        }
        if ((i.resolved_at || time) > i.resolution_due) {
          events.push('Resolution breached');
        }
        for (const [label, due, done] of [['Response', i.response_due, i.acknowledged_at || i.resolved_at], ['Resolution', i.resolution_due, i.resolved_at]])
          if (!done && time < due && due - time < Math.max(60, (due - i.created_at) * .2)) {
            events.push(label + ' at risk');
          }
        for (const kind of events)
          if (!repo.one('sla_events', e => e.incident_id === i.id && e.kind === kind)) {
            repo.insert('sla_events', {
              incident_id: i.id,
              kind,
              deadline: kind.startsWith('Response') ? i.response_due : i.resolution_due,
              priority: i.priority,
              created_at: time
            });
            this.events.publish(repo, i, null, kind, kind.includes('breached') ? 'Detected at ' + new Date(time * 1000).toISOString() + '; deadline was ' + new Date((kind.startsWith('Response') ? i.response_due : i.resolution_due) * 1000).toISOString() + '. Detection may be delayed while hosting sleeps.' : 'Deadline approaching');
          }
      }
    });
  }
  async snapshot(user) {
    await this.monitor();
    return this.repo.read(repo => {
      const users = repo.list('users');
      const services = repo.list('services');
      const incidents = repo.list('incidents', i => this.canView(i, user)).sort(compareSla);
      for (const i of incidents) {
        Object.assign(i, queueUrgency(i));
        delete i.request_key;
        delete i.request_fingerprint;
        const time = now();
        const breach = (i.acknowledged_at || i.resolved_at || time) > i.response_due || (i.resolved_at || time) > i.resolution_due;
        const historical = repo.one('sla_events', e => e.incident_id === i.id && e.kind.includes('breached'));
        const risk = [[i.response_due, i.acknowledged_at || i.resolved_at], [i.resolution_due, i.resolved_at]].some(([due, done]) => !done && due - time < Math.max(60, (due - i.created_at) * .2));
        i.sla_status = breach || historical ? 'Breached' : i.resolved_at ? 'Completed' : risk ? 'At risk' : 'On track';
        i.service = services.find(s => s.id === i.service_id)?.name;
        i.reporter = users.find(u => u.id === i.reporter_id)?.name;
        i.technician = users.find(u => u.id === i.technician_id)?.name || null;
      }
      const result = {
        user,
        google_linked: Boolean(repo.one('oauth_identities', identity => identity.provider === 'google' && identity.user_id === user.id)),
        support_requests: this.requestsFor(user),
        incidents,
        services,
        categories: repo.list('categories').map(c => c.name).sort(),
        technicians: user.role === 'employee' ? [] : this.technicians().filter(technician => user.role === 'admin' || technician.id === user.id),
        policies: repo.list('policies').sort((a, b) => a.priority.localeCompare(b.priority)),
        strategy: repo.one('settings', s => s.key === 'strategy').value,
        notifications: repo.list('notifications', n => n.user_id === user.id).sort((a, b) => b.id - a.id).slice(0, 200),
        transitions: TRANSITIONS
      };
      if (user.role === 'admin') {
        result.catalog = {
          subcategories: repo.list('subcategories'),
          incident_types: repo.list('incident_types')
        };
        result.users = users.map(({ password, ...u }) => u);
        result.service_policies = repo.list('service_policies');
        result.assignment_weights = repo.one('settings', s => s.key === 'assignment_weights')?.value || DEFAULT_WEIGHTS;
        result.components = repo.list('components');
        result.service_components = repo.list('service_components');
        result.correlation_minutes = Number(repo.one('settings', s => s.key === 'correlation_minutes')?.value || 60);
      }
      return result;
    });
  }
  addUser(data, role = 'employee') {
    const name = text(data, 'name', 100);
    const email = text(data, 'email', 200).toLowerCase();
    const password = data.password;
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      throw new AppError('Password must contain between 10 and 128 characters.');
    }
    if (!EMAIL.test(email)) {
      throw new AppError('Enter a valid email.');
    }
    if (this.repo.one('users', u => u.email === email)) {
      throw new AppError('This email already has an account.', 409);
    }
    const u = this.repo.insert('users', {
      name,
      email,
      password: passwordHash(password),
      role,
      created_at: now(),
      updated_at: now()
    });
    return {
      id: u.id,
      name,
      email,
      role
    };
  }
  admin(user, data) {
    if (user.role !== 'admin') {
      throw new Forbidden();
    }
    return this.repo.transaction(repo => {
      let auditData = data;
      switch (data.action) {
        case 'assignment_weights': {
          const weights = Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map(key => [key, Number(data[key])]));
          if (Object.values(weights).some(v => !Number.isFinite(v) || v < 0 || v > 1) || Math.abs(Object.values(weights).reduce((n, v) => n + v, 0) - 1) > .000001) {
            throw new AppError('Assignment weights must be between 0 and 1 and total 1.');
          }
          repo.upsert('settings', s => s.key === 'assignment_weights', {
            key: 'assignment_weights',
            value: weights
          });
          break;
        }
        case 'component': {
          const values = {
            name: text(data, 'name', 100),
            description: text({ description: data.description || '' }, 'description', 1000, 0)
          };
          if (data.id) {
            if (!repo.update('components', c => c.id === integer(data, 'id', 1, 999999), values)) {
              throw new AppError('Component not found.', 404);
            }
          }
          else {
            repo.insert('components', values);
          }
          break;
        }
        case 'service_components': {
          const sid = integer(data, 'service_id', 1, 999999);
          if (!repo.one('services', s => s.id === sid)) {
            throw new ServiceNotFoundError();
          }
          if (!Array.isArray(data.component_ids) || data.component_ids.some(id => !Number.isInteger(id) || !repo.one('components', c => c.id === id))) {
            throw new AppError('Choose existing components.');
          }
          repo.remove('service_components', row => row.service_id === sid);
          for (const component_id of new Set(data.component_ids))
            repo.insert('service_components', {
              service_id: sid,
              component_id
            });
          break;
        }
        case 'correlation_window':
          repo.upsert('settings', s => s.key === 'correlation_minutes', {
            key: 'correlation_minutes',
            value: integer(data, 'minutes', 1, 10080)
          });
          break;
        case 'strategy':
          if (typeof data.value !== 'string' || !Object.hasOwn(STRATEGIES, data.value)) {
            throw new AppError('Please select an available assignment strategy.');
          }
          repo.update('settings', s => s.key === 'strategy', { value: data.value });
          break;
        case 'service': {
          const created = repo.insert('services', {
            name: text(data, 'name', 100),
            criticality: integer(data, 'criticality', 1, 3)
          });
          auditData = {
            ...data,
            id: created.id
          };
          break;
        }
        case 'service_update':
          if (!repo.update('services', s => s.id === integer(data, 'id', 1, 999999), {
            name: text(data, 'name', 100),
            criticality: integer(data, 'criticality', 1, 3)
          })) {
            throw new ServiceNotFoundError();
          }
          break;
        case 'category':
          repo.insert('categories', { name: text(data, 'name', 60) });
          break;
        case 'category_rename': {
          const old = text(data, 'old', 60);
          const name = text(data, 'name', 60);
          if (!repo.one('categories', c => c.name === old)) {
            throw new AppError('Category not found.');
          }
          if (old !== name) {
            repo.insert('categories', { name });
            repo.update('incidents', i => i.category === old, { category: name });
            repo.update('subcategories', s => s.category === old, { category: name });
            repo.update('users', u => u.role === 'technician', u => ({ skills: u.skills.split(',').map(s => s.trim() === old ? name : s.trim()).join(',') }));
            repo.update('category_aliases', a => a.category === old, { category: name });
            repo.upsert('category_aliases', a => a.alias === old, {
              alias: old,
              category: name
            });
            repo.remove('categories', c => c.name === old);
          }
          break;
        }
        case 'subcategory': {
          const category = text(data, 'category', 60);
          if (!repo.one('categories', row => row.name === category)) {
            throw new AppError('Category not found.');
          }
          const values = {
            category,
            name: text(data, 'name', 100),
            active: Boolean(integer(data, 'active', 0, 1)),
            updated_at: now()
          };
          if (data.id) {
            const id = integer(data, 'id', 1, 999999);
            if (!repo.update('subcategories', row => row.id === id, values)) {
              throw new AppError('Subcategory not found.', 404);
            }
          }
          else {
            const created = repo.insert('subcategories', {
              ...values,
              created_at: now()
            });
            auditData = {
              ...data,
              id: created.id
            };
          }
          break;
        }
        case 'incident_type': {
          const subcategory_id = integer(data, 'subcategory_id', 1, 999999);
          const service_id = integer(data, 'service_id', 1, 999999);
          if (!repo.one('subcategories', row => row.id === subcategory_id) || !repo.one('services', row => row.id === service_id)) {
            throw new AppError('Choose an existing subcategory and service.');
          }
          const values = {
            subcategory_id,
            service_id,
            name: text(data, 'name', 160, 5),
            objective_description: text(data, 'objective_description', 10000, 10),
            active: Boolean(integer(data, 'active', 0, 1)),
            updated_at: now()
          };
          if (data.id) {
            const id = integer(data, 'id', 1, 999999);
            if (!repo.update('incident_types', row => row.id === id, values)) {
              throw new AppError('Incident type not found.', 404);
            }
          }
          else {
            const created = repo.insert('incident_types', {
              ...values,
              created_at: now()
            });
            auditData = {
              ...data,
              id: created.id
            };
          }
          break;
        }
        case 'policy': {
          const priority = text(data, 'priority', 2);
          if (!['P1', 'P2', 'P3', 'P4'].includes(priority)) {
            throw new AppError('Please select a valid priority.');
          }
          const response_minutes = integer(data, 'response_minutes', 1, 100000);
          const resolution_minutes = integer(data, 'resolution_minutes', response_minutes, 100000);
          const sid = data.service_id ? integer(data, 'service_id', 0, 999999) : 0;
          if (sid) {
            if (!repo.one('services', s => s.id === sid)) {
              throw new ServiceNotFoundError();
            }
            repo.upsert('service_policies', p => p.service_id === sid && p.priority === priority, {
              service_id: sid,
              priority,
              response_minutes,
              resolution_minutes
            });
          }
          else {
            repo.update('policies', p => p.priority === priority, {
              response_minutes,
              resolution_minutes
            });
          }
          for (const i of repo.list('incidents', i => i.status !== 'CLOSED' && i.priority === priority && (!sid || i.service_id === sid))) {
            const effective = this.policy(priority, i.service_id);
            const patch = { updated_at: now() };
            if (!i.acknowledged_at && !i.resolved_at) {
              patch.response_due = i.created_at + effective.response_minutes * 60;
            }
            if (!i.resolved_at) {
              patch.resolution_due = i.created_at + effective.resolution_minutes * 60;
            }
            repo.update('incidents', row => row.id === i.id, patch);
          }
          break;
        }
        case 'technician': {
          const id = integer(data, 'id', 1, 999999);
          const available = integer(data, 'available', 0, 1);
          const experience_years = Number(data.experience_years ?? 0);
          if (!Number.isFinite(experience_years) || experience_years < 0 || experience_years > 80) {
            throw new AppError('Experience must be between 0 and 80 years.');
          }
          const skills = text(data, 'skills', 500, 0).split(',').map(s => s.trim()).filter(Boolean);
          if (skills.some(s => !repo.one('categories', c => c.name === s))) {
            throw new AppError('Skills must match category names.');
          }
          if (!repo.update('users', u => u.id === id && u.role === 'technician', {
            available,
            experience_years,
            skills: skills.join(',')
          })) {
            throw new AppError('Technician not found.');
          }
          break;
        }
        case 'user': {
          if (!['employee', 'technician', 'admin'].includes(data.role)) {
            throw new AppError('Please select a valid account role.');
          }
          const created = this.addUser(data, data.role);
          auditData = {
            ...data,
            id: created.id
          };
          break;
        }
        case 'user_update': {
          const id = integer(data, 'id', 1, 999999);
          const active = integer(data, 'active', 0, 1);
          const role = data.role;
          const target = repo.one('users', u => u.id === id);
          if (!target) {
            throw new AppError('User not found.');
          }
          if (!['employee', 'technician', 'admin'].includes(role)) {
            throw new AppError('Please select a valid account role.');
          }
          if (id === user.id && (!active || role !== 'admin')) {
            throw new AppError('You cannot disable or demote your own administrator account.');
          }
          if (target.role === 'admin' && (!active || role !== 'admin') && repo.count('users', u => u.role === 'admin' && u.active) <= 1) {
            throw new AppError('Keep at least one active administrator.');
          }
          if ((!active || role !== 'technician') && repo.count('incidents', i => i.technician_id === id && !FINISHED.includes(i.status))) {
            throw new AppError('Reassign active incidents before disabling or changing this technician.');
          }
          repo.update('users', u => u.id === id, {
            name: text(data, 'name', 100),
            role,
            active,
            updated_at: now()
          });
          if (!active || role !== target.role) {
            repo.remove('sessions', s => s.user_id === id);
          }
          break;
        }
        default: throw new AppError('This administrative action is not supported. Please refresh the page and try again.');
      }
      recordConfiguration(repo, user, auditData);
      this.retryAssignments(repo);
      return { ok: true };
    });
  }
}
module.exports = {
  IncidentService,
  EventBus,
  Notifier,
  RecordNotifier,
  InAppNotifier,
  EmailOutboxNotifier,
  EMAIL
};
