'use strict';
const { AppError, integer, TRANSITIONS } = require('../domain/index.cjs');
const { compareSla, urgency } = require('../domain/sla-queue.cjs');
const ALLOWED = new Set([
  'page',
  'per_page',
  'q',
  'status',
  'category',
  'service_id',
  'technician_id',
  'sort'
]);
async function listIncidents(service, user, query = {}) {
  for (const key of Object.keys(query))
    if (!ALLOWED.has(key)) {
      throw new AppError('Unknown incident filter: ' + key + '.');
    }
  const page = integer({ page: query.page ?? 1 }, 'page', 1, 1000000);
  const perPage = integer({ per_page: query.per_page ?? 25 }, 'per_page', 1, 100);
  const q = String(query.q || '').trim().toLowerCase();
  if (q.length > 200) {
    throw new AppError('Search must contain at most 200 characters.');
  }
  if (query.status && !Object.hasOwn(TRANSITIONS, query.status)) {
    throw new AppError('Choose an existing incident status.');
  }
  const sort = query.sort || 'sla';
  if (!['sla', 'updated', 'newest', 'oldest'].includes(sort)) {
    throw new AppError('Please select a valid incident sort order.');
  }
  const filters = {};
  for (const key of ['service_id', 'technician_id'])
    if (query[key] !== undefined && query[key] !== '') {
      filters[key] = integer(query, key, 1, 999999999);
    }
  if (String(query.category || '').length > 120) {
    throw new AppError('Category filter is too long.');
  }
  return service.repo.read(repo => {
    const rows = repo.list('incidents', i => service.canView(i, user))
      .filter(i => !query.status || i.status === query.status)
      .filter(i => !query.category || i.category === query.category)
      .filter(i => Object.entries(filters).every(([key, value]) => i[key] === value))
      .filter(i => !q || ('INC-' + String(i.id).padStart(4, '0') + ' ' + i.title + ' ' + i.description).toLowerCase().includes(q))
      .sort((a, b) => sort === 'sla' ? compareSla(a, b) : sort === 'oldest' ? a.created_at - b.created_at || a.id - b.id : sort === 'newest' ? b.created_at - a.created_at || b.id - a.id : b.updated_at - a.updated_at || b.id - a.id);
    return {
      incidents: rows.slice((page - 1) * perPage, page * perPage).map(({ request_key, request_fingerprint, ...incident }) => ({
        ...incident,
        ...urgency(incident)
      })),
      total: rows.length,
      page,
      per_page: perPage,
      pages: Math.ceil(rows.length / perPage)
    };
  });
}
module.exports = { listIncidents };
