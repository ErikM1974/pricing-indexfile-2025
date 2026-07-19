/**
 * @jest-environment jsdom
 *
 * Regression lock for the 2026-07-19 Leads → quote-builder prefill fix.
 *
 * The bug: the Leads workspace opened a builder in a NEW tab with
 * window.open(..., 'noopener'). A noopener tab starts a fresh browsing context
 * with an EMPTY sessionStorage, so the same-tab "Switch method" stash (which
 * lives in sessionStorage) never crossed over — every builder silently fell
 * through to a blank customer form.
 *
 * The fix: cross-tab callers stash into localStorage (shared across tabs, ts-
 * stamped); takeMethodSwitchPrefill() drains sessionStorage first (same-tab
 * switch) then localStorage (cross-tab), TTL-checking the localStorage path so
 * an abandoned stash can't prefill an unrelated later open.
 */
const { stashMethodSwitchPrefill, takeMethodSwitchPrefill } = require('../../shared_components/js/quote-builder-utils.js');

function setSearch(qs) {
    // jsdom: history.replaceState updates window.location.search in place.
    window.history.replaceState({}, '', qs);
}

const PAYLOAD = { from: 'lead', fromLabel: 'Leads CRM', customer: { name: 'Jane Roe', email: 'jane@acme.com' }, products: [] };

describe('takeMethodSwitchPrefill — cross-tab (localStorage) handoff', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
        setSearch('/');
    });

    test('returns null when the ?from=methodswitch param is absent (even with a stash present)', () => {
        stashMethodSwitchPrefill(PAYLOAD);
        setSearch('/quote-builders/dtg-quote-builder.html');
        expect(takeMethodSwitchPrefill()).toBeNull();
    });

    test('drains a localStorage stash on ?from=methodswitch (the noopener cross-tab case)', () => {
        expect(stashMethodSwitchPrefill(PAYLOAD)).toBe(true);
        setSearch('/quote-builders/dtg-quote-builder.html?from=methodswitch');
        const got = takeMethodSwitchPrefill();
        expect(got).not.toBeNull();
        expect(got.customer.name).toBe('Jane Roe');
        // Take-once: the stash is cleared so a refresh can't re-apply it.
        expect(localStorage.getItem('nwca-method-switch')).toBeNull();
        setSearch('/quote-builders/dtg-quote-builder.html?from=methodswitch');
        expect(takeMethodSwitchPrefill()).toBeNull();
    });

    test('sessionStorage (same-tab switch) takes priority over localStorage', () => {
        localStorage.setItem('nwca-method-switch', JSON.stringify({ customer: { name: 'STALE' }, products: [] }));
        sessionStorage.setItem('nwca-method-switch', JSON.stringify({ customer: { name: 'SAME TAB' }, products: [] }));
        setSearch('/quote-builders/emb-quote-builder.html?from=methodswitch');
        const got = takeMethodSwitchPrefill();
        expect(got.customer.name).toBe('SAME TAB');
        // Both stores are cleared regardless of which one was used.
        expect(sessionStorage.getItem('nwca-method-switch')).toBeNull();
        expect(localStorage.getItem('nwca-method-switch')).toBeNull();
    });

    test('a localStorage stash older than the TTL is ignored (abandoned-stash guard)', () => {
        const stale = Object.assign({ ts: Date.now() - (6 * 60 * 1000) }, PAYLOAD); // 6 min > 5 min TTL
        localStorage.setItem('nwca-method-switch', JSON.stringify(stale));
        setSearch('/quote-builders/dtg-quote-builder.html?from=methodswitch');
        expect(takeMethodSwitchPrefill()).toBeNull();
        // Still drained, so it can't leak into a later open either.
        expect(localStorage.getItem('nwca-method-switch')).toBeNull();
    });

    test('a fresh localStorage stash (within TTL) is honored', () => {
        const fresh = Object.assign({ ts: Date.now() - 1000 }, PAYLOAD);
        localStorage.setItem('nwca-method-switch', JSON.stringify(fresh));
        setSearch('/quote-builders/dtg-quote-builder.html?from=methodswitch');
        expect(takeMethodSwitchPrefill()).not.toBeNull();
    });

    test('malformed JSON in the stash returns null, never throws', () => {
        localStorage.setItem('nwca-method-switch', '{not valid json');
        setSearch('/quote-builders/dtg-quote-builder.html?from=methodswitch');
        expect(() => takeMethodSwitchPrefill()).not.toThrow();
        expect(takeMethodSwitchPrefill()).toBeNull();
    });
});
