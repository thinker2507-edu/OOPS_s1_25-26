'use strict';
const { randomUUID } = require('node:crypto');
const { now } = require('../domain/index.cjs');
const NOTIFICATION_SCOPE = {
  collections: ['notifications', 'users', 'incidents', 'services', 'categories', 'subcategories', 'incident_types'],
  writeCollections: ['notifications']
};
// Claim in MongoDB, send outside the transaction, then acknowledge. Delivery is at least once.
async function dispatchEmail(repo, mailer, logger = () => {
}) {
  if (!mailer.info().enabled) {
    return;
  }
  for (let count = 0;count < 20;count++) {
    const claim = randomUUID();
    const item = await repo.transaction(r => {
      const row = r.list('notifications', n => n.channel === 'email_outbox' && !n.sent_at && (!n.retry_at || n.retry_at <= now())).sort((a, b) => a.id - b.id)[0];
      if (!row) {
        return null;
      }
      const user = r.one('users', u => u.id === row.user_id && u.active);
      r.update('notifications', n => n.id === row.id, {
        delivery_claim: claim,
        retry_at: now() + 120
      });
      if (!user || /@example\.invalid$/.test(user.email)) {
        r.update('notifications', n => n.id === row.id, {
          sent_at: now(),
          delivery_status: 'skipped'
        });
        return { skip: true };
      }
      return {
        ...row,
        email: user.email
      };
    }, NOTIFICATION_SCOPE);
    if (!item) {
      break;
    }
    if (item.skip) {
      continue;
    }
    try {
      await mailer.send({
        to: item.email,
        subject: 'Relay incident update',
        text: item.message
      });
      await repo.transaction(r => r.update('notifications', n => n.id === item.id && n.delivery_claim === claim, {
        sent_at: now(),
        delivery_status: 'sent'
      }), NOTIFICATION_SCOPE);
    }
    catch {
      logger('Incident email delivery failed; queued for retry.');
      await repo.transaction(r => r.update('notifications', n => n.id === item.id && n.delivery_claim === claim, {
        delivery_status: 'retry',
        retry_at: now() + 300
      }), NOTIFICATION_SCOPE);
    }
  }
}
module.exports = { dispatchEmail };
