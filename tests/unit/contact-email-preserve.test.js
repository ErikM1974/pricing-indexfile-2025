/**
 * The customer lookup must never blank an email the rep already has.
 *
 * All 4 builders used to do `emailEl.value = contact.ContactNumbersEmail || ''`,
 * so choosing a ShopWorks customer with no email on file silently WIPED the
 * address in the field — including one prefilled from a Leads handoff, which then
 * saved the quote under a different email and hid it from that lead's "Recent
 * quotes for this email" panel. EMB also refuses to save without an email, so it
 * additionally just blocked reps. (Taneisha, 2026-09-17.)
 *
 * Keeping the prior address silently is not safe either — it may belong to the
 * PREVIOUS customer — so a kept address must come back flagged for the rep.
 *
 * @jest-environment jsdom
 */
const fs = require('node:fs');
const path = require('node:path');

// quote-builder-utils.js is a bare-global page script (like applyMethodSwitchCustomer,
// it is deliberately not in module.exports), so load it the way a page does.
beforeAll(() => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../shared_components/js/quote-builder-utils.js'),
        'utf8'
    );
    const el = document.createElement('script');
    el.textContent = src;
    document.body.appendChild(el);
});

const resolve = (prior, incoming) => window.resolveContactEmail(prior, incoming);

describe('resolveContactEmail', () => {
    test('a contact WITH an email replaces whatever was there', () => {
        const r = resolve('lead@example.com', 'onfile@example.com');
        expect(r.value).toBe('onfile@example.com');
        expect(r.kept).toBe('');
        expect(r.type).toBe('success');
    });

    test('a contact with NO email keeps the address already present', () => {
        const r = resolve('velasco.d26@gmail.com', '');
        expect(r.value).toBe('velasco.d26@gmail.com');
        expect(r.kept).toBe('velasco.d26@gmail.com');
    });

    test('a kept address is never silent — it is flagged for the rep', () => {
        const r = resolve('velasco.d26@gmail.com', '');
        expect(r.type).toBe('warning');
        expect(r.message).toContain('velasco.d26@gmail.com');
        expect(r.message).toMatch(/verify/i);
        expect(r.duration).toBeGreaterThan(3000);
    });

    test('nothing on either side stays empty, and says nothing alarming', () => {
        const r = resolve('', '');
        expect(r.value).toBe('');
        expect(r.kept).toBe('');
        expect(r.type).toBe('success');
    });

    test('whitespace-only values count as absent (never "kept")', () => {
        expect(resolve('   ', '  ').value).toBe('');
        expect(resolve('   ', 'onfile@example.com').value).toBe('onfile@example.com');
        expect(resolve('lead@example.com', '   ').kept).toBe('lead@example.com');
    });

    test('null/undefined are tolerated — the lookup often omits the field', () => {
        expect(resolve(undefined, undefined).value).toBe('');
        expect(resolve(null, 'onfile@example.com').value).toBe('onfile@example.com');
        expect(resolve('lead@example.com', null).kept).toBe('lead@example.com');
    });
});

describe('applyContactEmail (DOM wrapper the 3 non-DTG builders call)', () => {
    let input;
    beforeEach(() => {
        input = document.createElement('input');
        input.id = 'customer-email';
        document.body.appendChild(input);
    });
    afterEach(() => input.remove());

    test('writes a real contact email into the field', () => {
        input.value = 'lead@example.com';
        const r = window.applyContactEmail(input, 'onfile@example.com');
        expect(input.value).toBe('onfile@example.com');
        expect(r.kept).toBe('');
    });

    test('THE REGRESSION: an emailless contact does not empty the field', () => {
        input.value = 'velasco.d26@gmail.com';
        const r = window.applyContactEmail(input, '');
        expect(input.value).toBe('velasco.d26@gmail.com');
        expect(r.kept).toBe('velasco.d26@gmail.com');
        expect(r.type).toBe('warning');
    });

    test('a missing input never throws (builders call this during init)', () => {
        expect(() => window.applyContactEmail(null, 'onfile@example.com')).not.toThrow();
    });
});
