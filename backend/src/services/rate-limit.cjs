'use strict';
const { createHash } = require('node:crypto');
const { AppError, now } = require('../domain/index.cjs');
async function rateLimit(repo, identity, maximum = 20, seconds = 60) {
  const key = createHash('sha256').update(identity).digest('hex');
  const accepted = await repo.transaction(r => {
    const time = now();
    r.remove('rate_limits', row => row.expires <= time);
    const row = r.one('rate_limits', row => row.key === key);
    if (row && row.count >= maximum) {
      return false;
    }
    r.upsert('rate_limits', row => row.key === key, {
      key,
      count: (row?.count || 0) + 1,
      expires: row?.expires || time + seconds
    });
    return true;
  });
  if (!accepted) {
    throw new AppError('Too many attempts. Try again in a minute.', 429);
  }
}
module.exports = { rateLimit };
