// routes/stripe-webhook.js — Stripe raw-body payment webhook
// Raw-body signature verification and dispatch. Payment stages own the work after verification.
module.exports = function register(app, ctx) {
const { express, stripe, handleQuotePayment, handleStorefrontOrderPaid } = ctx;

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const mode = process.env.STRIPE_MODE || 'development';
    const endpointSecret = mode === 'production'
      ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
      : process.env.STRIPE_WEBHOOK_SECRET_TEST;

    if (!endpointSecret) {
      console.error('[Webhook] Secret not configured for mode:', mode);
      return res.status(500).send('Webhook secret not configured');
    }

    const sig = req.headers['stripe-signature'];
    const stripeInstance = stripe(
      mode === 'production'
        ? process.env.STRIPE_LIVE_SECRET_KEY
        : process.env.STRIPE_TEST_SECRET_KEY
    );

    // Verify webhook signature (prevents fake webhooks)
    let event;
    try {
      event = stripeInstance.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('[Webhook] Event received:', event.type, event.id);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const quoteID = metadata.quoteID;

      if (!quoteID) {
        console.warn('[Webhook] No quoteID in metadata');
        return res.json({ received: true });
      }

      // ── Quote deposit/balance payments (Storefront Checkout Phase 1) ──────
      // Sessions carrying metadata.kind are PAYMENTS AGAINST AN EXISTING QUOTE.
      // They must never fall through to the express-order path below (which
      // would try to push a whole order to ShopWorks). Express sessions carry
      // no `kind`, so the legacy path is untouched by construction.
      if (metadata.kind) return await handleQuotePayment(session, quoteID, metadata, res);
      return await handleStorefrontOrderPaid(session, quoteID, res);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).send('Webhook processing failed');
  }
});
};
