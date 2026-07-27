/**
 * Harness-drift guard.
 *
 * tests/ui/test-ae-mission-control.html is a hand-copied fork of the real Mission Control page,
 * and it has to be: the page is SAML-gated, so the harness cannot fetch it at run time.
 *
 * The cost of that fork is documented and real. On 2026-07-27 it silently kept the OLD bonus
 * hero, the OLD tab bar and the OLD Today panel across three separate changes. Each time the
 * harness rendered a page that no longer shipped and reported it as passing — a green test
 * asserting against markup nobody would ever see. It was re-synced by hand four times that day.
 *
 * This test makes the fork honest: the shared regions must be byte-identical, and the failure
 * message says exactly which block drifted and how to fix it.
 *
 * It deliberately does NOT compare the whole file. The harness legitimately has its own title,
 * its fetch stub, and its ?as=rep controls. The shared set is declared in one place —
 * SHARED_REGIONS in scripts/sync-test-harness.js — so adding a shared block means adding it
 * there, not here.
 */

const fs = require('fs');
const { SOURCE, HARNESS, SHARED_REGIONS, extractRegion, findDrift } = require('../../scripts/sync-test-harness');

describe('Mission Control test harness stays in sync with the page', () => {
    const source = fs.readFileSync(SOURCE, 'utf8');
    const harness = fs.readFileSync(HARNESS, 'utf8');

    test('every shared region is byte-identical', () => {
        const drift = findDrift(source, harness);
        const detail = drift.map((d) => `  • ${d.id} — ${d.reason}`).join('\n');
        expect(drift.length === 0 ? '' : detail).toBe('');
    });

    // Named cases so a failure points at the block, not just "something differs". These are the
    // three that actually drifted, which is why they get their own assertions.
    test.each([
        ['aemc-bonus-hero', 'section'],
        ['mc-tablist', 'div'],
        ['mc-panel-today', 'section'],
    ])('%s is present in both and matches', (id, tag) => {
        const a = extractRegion(source, tag, id);
        const b = extractRegion(harness, tag, id);
        expect(a).toBeTruthy();
        expect(b).toBeTruthy();
        expect(b).toBe(a);
    });

    test('the guard actually covers every panel on the page', () => {
        // A new tab whose panel nobody added to SHARED_REGIONS would be unguarded — exactly the
        // hole that let the Call List panel drift. Derive the truth from the page itself.
        const panelIds = [...source.matchAll(/<section class="mc-panel" id="([\w-]+)"/g)].map((m) => m[1]);
        const guarded = new Set(SHARED_REGIONS.map((r) => r.id));
        const unguarded = panelIds.filter((id) => !guarded.has(id));
        expect(unguarded).toEqual([]);
    });

    test('every tab button has a matching guarded panel', () => {
        // Catches the other half: a tab declared in the tablist with no panel section at all,
        // which renders an empty tab rather than an error.
        const tabIds = [...source.matchAll(/data-tab="([\w-]+)"/g)].map((m) => m[1]);
        const missing = tabIds.filter((t) => !source.includes(`id="mc-panel-${t}"`));
        expect(missing).toEqual([]);
    });
});
