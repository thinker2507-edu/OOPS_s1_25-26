"use strict";
class IncidentIntelligence {
  constructor() {
    this.keywords = {
      Network: [
        'wifi',
        'network',
        'vpn',
        'internet',
        'router'
      ],
      Authentication: [
        'login',
        'password',
        'authentication',
        'mfa',
        'sign in'
      ],
      Database: ['database', 'sql', 'query'],
      Hardware: ['laptop', 'screen', 'keyboard', 'printer'],
      Security: ['phishing', 'malware', 'breach', 'suspicious'],
      Cloud: ['cloud', 'bucket', 'aws', 'azure'],
      Storage: ['disk', 'storage', 'backup']
    };
  }
  categorize(input) {
    let best = 'Application';
    let score = 0;
    for (const [category, words] of Object.entries(this.keywords)) {
      const count = words.filter(w => input.toLowerCase().includes(w)).length;
      if (count > score) {
        best = category;
        score = count;
      }
    }
    return best;
  }
  similarity(a, b) {
    const stop = new Set([
      'the',
      'is',
      'a',
      'an',
      'to',
      'and',
      'of',
      'in',
      'for',
      'my',
      'with',
      'not',
      'can'
    ]);
    const tokens = value => new Set((value.toLowerCase().match(/[a-z0-9]+/g) || []).filter(x => !stop.has(x)));
    const x = tokens(a);
    const y = tokens(b);
    const union = new Set([...x, ...y]);
    return union.size ? [...x].filter(t => y.has(t)).length / union.size : 0;
  }
}
module.exports = { IncidentIntelligence };
