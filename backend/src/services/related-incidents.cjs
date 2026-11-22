'use strict';
const { Forbidden } = require('../domain/index.cjs');
const STOP = new Set('a an the is are was were be been to and or of in for my with it i we our this that on at as from since please help issue problem customer customers users user today yesterday morning getting when during'.split(' '));
function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/(?:can't|cannot|unable to)\s+(?:make\s+)?(?:a\s+)?(?:payment|pay)(?:\b)|not going through/g, ' payment failure ')
    .replace(/\b(?:(?:credit|debit)\s+card|transactions?|checkout|payments?|billing|paying|purchases?|pay)\b/g, ' payment ')
    .replace(/(?:does|do|is|are)\s+not\s+(?:working|work|complete|process)|(?:can't|cannot|unable to)\s+(?:complete|process)(?:\s+payment)?|not\s+(?:working|processing)|fail(?:ed|ing|ure|ures|s)?|declin(?:ed|ing)|unavailable|unsuccessful|broken|errors?/g, ' failure ')
    .replace(/\b(?:wi[ -]?fi|wireless|wlan|internet|connectivity)\b/g, ' network ')
    .replace(/\b(?:passcodes?|credentials?)\b/g, ' password ')
    .replace(/\bnotebook\b/g, ' laptop ')
    .replace(/\b(?:crash(?:es|ed|ing)?|freez(?:e|es|ing)|frozen|hang(?:s|ing)?|unresponsive)\b/g, ' crash ')
    .replace(/\b(?:printing|prints?)\b/g, ' printer ')
    .replace(/\b(?:sluggish|performance)\b/g, ' slow ')
    .replace(/\b(?:outages?|offline|downtime)\b/g, ' failure ')
    .replace(/sign[ -]?in|log[ -]?in/g, ' authentication ')
    .replace(/disconnect(?:ed|ing|s)?|drops?|dropping/g, ' disconnect ')
    .replace(/slow(?:ly|ness)?|latency/g, ' slow ')
    .match(/[a-z0-9]+/g)?.filter(t => !STOP.has(t)) || [];
}
function incidentText(i) {
  // Catalogue labels/objective text repeat for everyone and cannot prove a duplicate.
  return i.incident_type_id != null ? i.additional_details || '' : i.title + ' ' + i.description;
}
function matches(source, candidates, threshold = .65) {
  const documents = [source, ...candidates.map(incidentText)].map(normalize).map(words => [...new Set(words)]);
  const frequency = new Map();
  for (const words of documents)
    for (const word of words)
      frequency.set(word, (frequency.get(word) || 0) + 1);
  const vector = words => new Map(words.map(word => [word, Math.log((documents.length + 1) / (frequency.get(word) + 1)) + 1]));
  const a = vector(documents[0]);
  const norm = v => Math.sqrt([...v.values()].reduce((n, x) => n + x * x, 0));
  return candidates.flatMap((i, index) => {
    const b = vector(documents[index + 1]);
    const shared = [...a.keys()].filter(word => b.has(word));
    const cosine = shared.reduce((sum, word) => sum + a.get(word) * b.get(word), 0) / (norm(a) * norm(b) || 1);
    return cosine >= threshold ? [{
      id: i.id,
      title: i.title,
      status: i.status,
      resolution: i.resolution || '',
      similarity: Math.round(cosine * 100),
      score: cosine,
      reasons: ['Shared problem concepts: ' + shared.join(', ')]
    }] : [];
  }).sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 5);
}
function relatedIncidents(service, repo, user, id) {
  if (!['admin', 'technician'].includes(user.role)) {
    throw new Forbidden('Staff access is required.');
  }
  const incident = service.get(id, user);
  const windowMinutes = Number(repo.one('settings', s => s.key === 'correlation_minutes')?.value || 60);
  const candidates = repo.list('incidents', row => row.id !== id && service.canView(row, user));
  const components = sid => repo.list('service_components', row => row.service_id === sid).map(row => row.component_id);
  const own = components(incident.service_id);
  const correlations = candidates.flatMap(row => {
    if (Math.abs(row.created_at - incident.created_at) > windowMinutes * 60) {
      return [];
    }
    const shared = components(row.service_id).filter(cid => own.includes(cid));
    const reasons = [];
    if (row.service_id === incident.service_id) {
      reasons.push('Same service');
    }
    for (const cid of shared)
      reasons.push('Shared component: ' + repo.one('components', c => c.id === cid)?.name);
    return reasons.length ? [{
      id: row.id,
      title: row.title,
      status: row.status,
      reasons,
      minutes_apart: Math.round(Math.abs(row.created_at - incident.created_at) / 60)
    }] : [];
  }).sort((a, b) => a.minutes_apart - b.minutes_apart || a.id - b.id);
  return {
    duplicates: matches(incidentText(incident), candidates),
    correlations,
    window_minutes: windowMinutes
  };
}
module.exports = {
  normalize,
  incidentText,
  matches,
  relatedIncidents
};
