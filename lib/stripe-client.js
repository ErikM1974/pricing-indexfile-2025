const Stripe = require('stripe');

// Keep the API contract used by stripe-node 19.3 when upgrading the SDK.
// Change this deliberately only after validating checkout and webhook payloads.
const API_VERSION = '2025-10-29.clover';

module.exports = function createStripeClient(secretKey, options = {}) {
    // Stripe documents this exception: SDK types describe only the newest API.
    // @ts-expect-error stripe-version-2025-10-29.clover; wire contract tested before/after SDK upgrade.
    return new Stripe(secretKey, { ...options, apiVersion: API_VERSION });
};
