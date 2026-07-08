/**
 * lib/sentry-scrub.js — roadmap 1.10 lock.
 *
 * Error events must never leak customer PII: emails and phone numbers are
 * masked ANYWHERE in the event tree (messages, breadcrumbs, request bodies,
 * nested extras) before leaving for Sentry.
 */

const { scrubPII, scrubString } = require('../../lib/sentry-scrub');

describe('scrubString', () => {
    test('masks emails', () => {
        expect(scrubString('save failed for erik@nwcustomapparel.com today')).toBe('save failed for [email] today');
        expect(scrubString('a.b+tag@sub.domain.co')).toBe('[email]');
    });

    test('masks phone formats', () => {
        expect(scrubString('call (253) 922-5793 now')).toBe('call [phone] now');
        expect(scrubString('ph: 253.922.5793')).toBe('ph: [phone]');
        expect(scrubString('+1 253 922 5793')).toBe('[phone]');
    });

    test('leaves prices, quantities, and short numbers alone', () => {
        expect(scrubString('total $842.50 for 72 pieces tier 48-71')).toBe('total $842.50 for 72 pieces tier 48-71');
        expect(scrubString('PC54 qty 144')).toBe('PC54 qty 144');
    });
});

describe('scrubPII (event trees)', () => {
    test('walks nested objects, arrays, breadcrumbs', () => {
        const event = {
            message: 'quote save failed for taneisha@nwca.com',
            breadcrumbs: [{ message: 'POST body: {"customerEmail":"bob@x.com","phone":"253-922-5793"}' }],
            extra: { payload: { emails: ['a@b.co', 'c@d.io'], qty: 48 } },
        };
        const out = scrubPII(event);
        expect(out.message).toBe('quote save failed for [email]');
        expect(out.breadcrumbs[0].message).toContain('[email]');
        expect(out.breadcrumbs[0].message).toContain('[phone]');
        expect(out.extra.payload.emails).toEqual(['[email]', '[email]']);
        expect(out.extra.payload.qty).toBe(48); // non-strings untouched
    });

    test('does not mutate the input; survives cycles', () => {
        const inner = { email: 'x@y.com' };
        inner.self = inner; // cycle
        const out = scrubPII({ inner });
        expect(inner.email).toBe('x@y.com'); // original untouched
        expect(out.inner.email).toBe('[email]');
    });
});
