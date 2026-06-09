/**
 * 3dt-fire-test-webhook.js — fires a SIGNED synthetic checkout.session.completed
 * at the LOCAL dev server to exercise the full post-payment pipeline
 * (signature verify → idempotency → Caspio status flips → internal-key
 * self-call → ManageOrders push) without a real card.
 *
 * Usage: node tests/3dt-fire-test-webhook.js <QuoteID> <amountCents> [sessionId]
 * Reads STRIPE_WEBHOOK_SECRET_TEST from .env (local only; never logs it).
 * Pushes a REAL test order into ManageOrders — void it in ShopWorks after.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const [quoteID, amountCents, sessionId] = process.argv.slice(2);
if (!quoteID || !amountCents) {
  console.error('usage: node tests/3dt-fire-test-webhook.js <QuoteID> <amountCents> [sessionId]');
  process.exit(1);
}

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const m = env.match(/^STRIPE_WEBHOOK_SECRET_TEST=(.+)$/m);
if (!m) { console.error('STRIPE_WEBHOOK_SECRET_TEST not in .env'); process.exit(1); }
const secret = m[1].trim();

const event = {
  id: 'evt_test_' + crypto.randomBytes(8).toString('hex'),
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: sessionId || ('cs_test_synthetic_' + quoteID),
      object: 'checkout.session',
      payment_status: 'paid',
      amount_total: parseInt(amountCents, 10),
      payment_intent: 'pi_test_synthetic_' + quoteID,
      customer_email: 'erik@nwcustomapparel.com',
      metadata: { quoteID, source: '3day-tees' },
    },
  },
};

const payload = JSON.stringify(event);
const t = Math.floor(Date.now() / 1000);
const v1 = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');

fetch('http://localhost:3000/api/stripe/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'stripe-signature': `t=${t},v1=${v1}`,
  },
  body: payload,
}).then(async (r) => {
  console.log('HTTP', r.status, await r.text());
}).catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
