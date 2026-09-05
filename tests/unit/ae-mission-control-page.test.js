/**
 * @jest-environment jsdom
 *
 * AE Mission Control (dashboards/ae-mission-control.html) — locks from the 2026-09-05 review.
 * The page already had a UI harness (tests/ui/test-ae-mission-control.html, kept in sync by
 * scripts/sync-test-harness.js); this is the cheap structural lock that runs in the unit gate.
 *
 *   1. Rule 3: no onclick=, no static style= (the only style= left are data-driven widths /
 *      positions — bar fills and pace markers — which carry a computed number).
 *   2. No browser alert/confirm/prompt; failures go through DashPage.showError.
 *   3. Copy: "1 day", not "1 days" (plural helper).
 *   4. Freshness: a 5-minute visible-tab re-read of the summary + inbound.
 *   5. The harness mirrors the page's shared regions (sync script reports no drift).
 *   6. Volume Quote attributes quotes to the rep's real email (Pipeline tab reads SalesRepEmail).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/ae-mission-control.html');
const js = read('dashboards/js/ae-mission-control.js');
const css = read('dashboards/css/ae-mission-control.css');
const vq = read('dashboards/js/volume-quote.js');
const vqHtml = read('dashboards/volume-quote.html');
const code = js.replace(/\/\/[^\n]*/g, '');

describe('Rule 3', () => {
    test('page: no onclick=, no style=, no inline script', () => {
        const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
        expect(stripped).not.toMatch(/\sonclick=/);
        expect(stripped).not.toMatch(/\sstyle="/);
        const bodies = [...stripped.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
        expect(bodies).toEqual([]);
    });
    test('templates: no onclick=; every remaining style= is a computed width/left', () => {
        expect(code).not.toMatch(/onclick="/);
        const styles = [...code.matchAll(/style="([^"]*)/g)].map((m) => m[1]);
        for (const s of styles) expect(s).toMatch(/^(width|left):' \+ /);
        expect(css).toContain('.mc-sw--late');
        expect(css).toContain('.mc-chip.is-fire .mc-chip-dot');
    });
    test('no browser dialogs', () => {
        expect(code).not.toMatch(/\balert\(/);
        expect(code).not.toMatch(/\bconfirm\(/);
        expect(code).not.toMatch(/\bprompt\(/);
    });
});

describe('copy + freshness', () => {
    test('"1 day", never "1 days"', () => {
        expect(js).toMatch(/function plural\(n, word/);
        expect(js).toMatch(/plural\(Math\.abs\(o\.daysUntilDue\), 'day'\) \+ ' past its ship date'/);
    });
    test('5-minute visible-tab re-read of summary + inbound, catch-up on return', () => {
        expect(js).toMatch(/SUMMARY_REFRESH_MS = 5 \* 60 \* 1000/);
        expect(js).toMatch(/document\.visibilityState === 'visible'\) \{ loadSummary\(false\); loadInbound\(\); \}/);
        expect(js).toMatch(/state\.summaryLoadedAt = Date\.now\(\)/);
    });
});

describe('harness + attribution', () => {
    test('the UI harness mirrors the page (sync script reports no drift)', () => {
        const out = execFileSync('node', [path.join(ROOT, 'scripts', 'sync-test-harness.js'), '--check'], { encoding: 'utf8' });
        expect(out).toMatch(/in sync/);
    });
    test('Volume Quote writes the rep’s real email so Mission Control attributes the quote', () => {
        expect(vq).toMatch(/SalesRepEmail: repEmailFor\(/);
        expect(vq).toMatch(/function repEmailFor/);
        expect(vq).toMatch(/STAFF_EMAIL_MAP/);
        expect(vqHtml).toMatch(/staff-auth-helper\.js/);
    });
});
