'use strict';
// Local, deterministic search: no external API, model, credentials or network calls.
const STOP = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'to',
  'and',
  'of',
  'in',
  'for',
  'my',
  'with',
  'please'
]);
const GROUPS = [
  ['wifi', 'wireless', 'wlan'],
  [
    'login',
    'signin',
    'authentication',
    'authenticate',
    'logon'
  ],
  ['password', 'passcode', 'credential', 'credentials'],
  ['laptop', 'notebook'],
  ['email', 'mail', 'outlook'],
  ['slow', 'sluggish', 'latency', 'performance'],
  [
    'crash',
    'crashes',
    'freeze',
    'frozen',
    'hang'
  ],
  ['outage', 'unavailable', 'offline', 'downtime'],
  ['printer', 'printing', 'print'],
  ['disk', 'storage', 'drive'],
  ['resolved', 'fixed', 'solved'],
  ['acknowledged', 'accepted'],
  ['waiting', 'paused']
];
const ALIASES = new Map(GROUPS.flatMap(group => group.map(word => [word, group[0]])));
function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/wi[\s-]+fi/g, 'wifi').replace(/sign[\s-]+in|log[\s-]+in/g, 'signin')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function tokens(value) {
  return [...new Set(normalize(value).split(' ').filter(word => word && !STOP.has(word)))];
}
function canonical(word) {
  return ALIASES.get(word) || word;
}
function near(a, b) {
  if (a === b) {
    return 1;
  }
  if (canonical(a) === canonical(b)) {
    return .9;
  }
  // Numeric identifiers stay exact; prefixes and typo matching are separate rules.
  if (/\d/.test(a + b)) {
    return 0;
  }
  if (b.startsWith(a) && a.length >= 3) {
    return .8;
  }
  // Short words may prefix-match, but never fuzzy-match.
  if (Math.min(a.length, b.length) < 4) {
    return 0;
  }
  const limit = Math.min(a.length, b.length) >= 8 ? 2 : 1;
  if (Math.abs(a.length - b.length) > limit) {
    return 0;
  }
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1;i <= a.length;i++) {
    const next = [i];
    for (let j = 1;j <= b.length;j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length] <= limit ? .65 : 0;
}
function rankIncident(query, incident, fields) {
  const reference = query.trim().match(/^(?:inc[\s-]*)?0*(\d+)$/i);
  if (reference) {
    return Number(reference[1]) === incident.id ? {
      score: 100,
      reasons: ['Reference']
    } : null;
  }
  const terms = tokens(query);
  if (!terms.length) {
    return null;
  }
  const indexed = fields.map(([label, value, weight]) => ({
    label,
    words: tokens(value),
    weight
  }));
  const reasons = new Set();
  let total = 0;
  let matched = 0;
  for (const term of terms) {
    let best = 0;
    for (const field of indexed) {
      let similarity = 0;
      for (const word of field.words)
        similarity = Math.max(similarity, near(term, word));
      if (similarity) {
        reasons.add(field.label);
        best = Math.max(best, similarity * field.weight);
      }
    }
    if (best) {
      matched++;
    }
    total += best;
  }
  if (matched < Math.ceil(terms.length * .8)) {
    return null;
  }
  return {
    score: Math.round(total / terms.length * 20),
    reasons: [...reasons]
  };
}
function sameReport(previous, proposed) {
  if (previous.reporter_id !== proposed.reporter_id || previous.service_id !== proposed.service_id) {
    return false;
  }
  const catalog = previous.incident_type_id && proposed.incident_type_id;
  if (catalog && previous.incident_type_id !== proposed.incident_type_id) {
    return false;
  }
  const content = incident => catalog ? incident.additional_details || '' : incident.title + ' ' + incident.description;
  const a = normalize(content(previous));
  const b = normalize(content(proposed));
  if (a === b) {
    return true;
  }
  // For rejection, be stricter than search: no synonyms, fuzzy spelling or lost negation/numbers.
  const words = value => [...new Set(value.split(' '))].sort();
  return a.length > 0 && b.length > 0 && JSON.stringify(words(a)) === JSON.stringify(words(b));
}
module.exports = {
  normalize,
  tokens,
  rankIncident,
  sameReport
};
