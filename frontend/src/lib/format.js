const date = v => v ? new Date(v * 1000).toLocaleString(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}) : '—';
const incId = id => 'INC-' + String(id).padStart(4, '0');
const pretty = s => s.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const initials = s => s.split(' ').map(v => v[0]).slice(0, 2).join('');
export { date, incId, pretty, initials };
