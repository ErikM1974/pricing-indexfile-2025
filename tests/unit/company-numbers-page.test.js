/**
 * @jest-environment jsdom
 *
 * Company Numbers (dashboards/company-numbers.html) — locks from the 2026-09-04 review.
 *
 *   1. Nothing on the page is typed that the data owns: no "4,631", no "Q3" in the
 *      team-push title, no $3M goal constant in JS, no "46%" prose.
 *   2. Honest freshness: a per-card stamp on every live card, a header stamp, no
 *      fake refresh button on the static Production card, and a data-through line.
 *   3. Date math: "YYYY-MM-DD" is a calendar day (local), and "Last N days" is N days.
 *   4. The art-aging widget has no inline styles; DEAD folds into House; Money
 *      Collected is named for what it is; the entry is bundled with relative imports.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/company-numbers.html');
const doc = new DOMParser().parseFromString(html, 'text/html');
const entry = read('dashboards/js/company-numbers.js');
const css = read('dashboards/css/company-numbers.css');
const artWidget = read('staff-dashboard-v3/art-aging-widget.js');
const uiUtils = read('shared_components/js/staff-dashboard/core/dashboard-ui-utils.js');
const shopworks = read('shared_components/js/staff-dashboard/services/shopworks-service.js');
const team = read('shared_components/js/staff-dashboard/controllers/team-performance-controller.js');
const goalChip = read('shared_components/js/staff-dashboard/controllers/sales-goal-controller.js');
const goalService = read('shared_components/js/staff-dashboard/services/company-goal-service.js');
const bonus = read('shared_components/js/staff-dashboard/controllers/embroidery-bonus-controller.js');
const production = read('shared_components/js/staff-dashboard/controllers/production-controller.js');
const stats = read('shared_components/js/production-schedule-stats.js');
const serverSrc = read('server.js');

// Load an ESM file's pure functions into a sandbox (jest here is CommonJS).
function loadEsm(src) {
    const sandbox = { exports: {}, console, setTimeout };
    const names = [...src.matchAll(/^export (?:async )?(?:const|let|function) (\w+)/gm)].map((m) => m[1]);
    const code = src
        .replace(/^import[^;]*;\s*$/gm, '')
        .replace(/^export \{[^}]*\};?\s*$/gm, '')
        .replace(/^export /gm, '')
        + '\n' + names.map((n) => `exports.${n} = ${n};`).join('\n');
    vm.runInNewContext(code, sandbox);
    return sandbox.exports;
}

describe('nothing typed that the data owns', () => {
    test('the Production footer no longer carries a typed record count', () => {
        expect(html).not.toMatch(/4,631/);
        expect(doc.getElementById('production-record-count').textContent.trim()).toBe('—');
        expect(doc.getElementById('production-data-through')).not.toBeNull();
        expect(production).toMatch(/production-data-through/);
        expect(stats).toMatch(/"dataThrough":\s*"\d{4}-\d{2}"/);
    });
    test('the team-push title takes its quarter from the API', () => {
        const title = doc.getElementById('embroideryBonusTitle');
        expect(title).not.toBeNull();
        expect(title.textContent).not.toMatch(/Q[1-4]/);
        expect(bonus).toMatch(/getElementById\(TITLE_ID\)/);
        expect(bonus).toMatch(/\$\{escapeHtml\(data\.quarter\)\} Team Push/);
        expect(bonus).not.toMatch(/46%/);
        expect(bonus).not.toMatch(/\$3M/);
    });
    test('the $3M goal is no longer a JavaScript constant — it is the CO-ANNUAL-GOAL Caspio row', () => {
        expect(uiUtils).not.toMatch(/export const ANNUAL_GOAL/);
        expect(team).not.toMatch(/ANNUAL_GOAL/);
        expect(goalChip).not.toMatch(/ANNUAL_GOAL/);
        expect(goalService).toMatch(/CO-ANNUAL-GOAL/);
        expect(goalService).toMatch(/\/api\/staff\/service-codes/);
        expect(serverSrc).toMatch(/app\.get\('\/api\/staff\/service-codes', requireStaff/);
    });
    test('the built-in fallback goal is allowed ONLY with a visible warning', () => {
        // CLAUDE.md: a hardcoded number may be a fallback when the API is down, but it
        // MUST surface a visible warning. Both surfaces render fallbackWarning().
        expect(goalService).toMatch(/source: 'fallback'/);
        expect(goalService).toMatch(/export function fallbackWarning/);
        expect(team).toMatch(/fallbackWarning\(\)/);
        expect(goalChip).toMatch(/fallbackWarning\(\)/);
        expect(goalChip).toMatch(/is-goal-fallback/);
    });
});

describe('honest freshness', () => {
    test('every live card has a stamp and the header has the page stamp', () => {
        for (const key of ['inbox', 'payments', 'samples', 'revenue', 'team', 'art', 'bonus']) {
            expect(doc.querySelector(`.cn-stamp[data-stamp="${key}"]`)).not.toBeNull();
        }
        expect(doc.getElementById('cn-updated')).not.toBeNull();
        expect(html).not.toMatch(/refreshes every 5 minutes/); // the old blanket claim
    });
    test('the tick refreshes every live card, only while visible', () => {
        expect(entry).toMatch(/refreshOrdersInbox/);
        expect(entry).toMatch(/refreshMoneyCollected/);
        expect(entry).toMatch(/refreshSamplePipeline/);
        expect(entry).toMatch(/refreshMetrics/);
        expect(entry).toMatch(/refreshTeamPerformance/);
        expect(entry).toMatch(/loadEmbroideryBonus\(false\)/);
        expect(entry).toMatch(/ArtAgingWidget\.load\(\)/);
        expect(entry).toMatch(/document\.visibilityState === 'visible'/);
    });
    test('the static Production card has no refresh button and no range tooltips', () => {
        expect(doc.querySelector('[data-action="production:refresh"]')).toBeNull();
        expect(production).not.toMatch(/register\('production:refresh'/);
        expect(production).not.toMatch(/title="Typically/);
    });
    test('the art-aging widget announces each load for the stamp and exposes load()', () => {
        expect(artWidget).toMatch(/new CustomEvent\('art-aging:loaded'/);
        expect(artWidget).toMatch(/window\.ArtAgingWidget = \{ load: load, last: null \}/);
        // the module entry may register its listener AFTER the first load — it reads `last`
        expect(artWidget).toMatch(/window\.ArtAgingWidget\.last = detail/);
        expect(entry).toMatch(/window\.ArtAgingWidget\?\.last/);
    });
});

describe('date math', () => {
    const utils = loadEsm(uiUtils);
    test('"YYYY-MM-DD" is a calendar day, not UTC midnight', () => {
        const d = utils.toLocalDate('2026-09-04');
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(8);
        expect(d.getDate()).toBe(4);
        expect(utils.formatDateRange('2026-06-06', '2026-09-04')).toBe('Jun 6 - Sep 4, 2026');
        expect(utils.formatDateRange('2026-09-01', '2026-09-04')).toBe('Sep 1 - 4, 2026');
    });
    test('"Last N days" spans N calendar days inclusive', () => {
        expect(shopworks).toMatch(/start\.setDate\(start\.getDate\(\) - \(days - 1\)\)/);
        expect(shopworks).toMatch(/currentStart\.setDate\(currentStart\.getDate\(\) - \(days - 1\)\)/);
    });
});

describe('hygiene', () => {
    test('the art-aging widget builds no inline styles', () => {
        expect(artWidget).not.toMatch(/style="/);
        expect(artWidget).not.toMatch(/\.style\.cssText/);
        expect(artWidget).not.toMatch(/#ef4444|#f59e0b|#22c55e/);
        for (const cls of ['.aa-chips', '.aa-chip--red', '.aa-row--amber', '.aa-error', '.aa-retry']) {
            expect(css).toContain(cls);
        }
    });
    test('DEAD (the ShopWorks placeholder rep) folds into House', () => {
        expect(team).toMatch(/'dead',/);
    });
    test('one denominator per team row: share of team, goal share in the tooltip', () => {
        expect(team).toMatch(/% of team</);
        expect(team).not.toMatch(/% of goal</);
    });
    test('the payments card is named for what it shows', () => {
        expect(doc.getElementById('zonePaymentsTitle').textContent).toMatch(/Online Payments \(Stripe\)/);
        expect(html).not.toMatch(/>\s*Money Collected\s*</);
    });
    test('the accepted-quotes column says its window', () => {
        expect(doc.querySelector('#inboxAccepted .inbox-col-title').textContent).toMatch(/30 days/);
    });
    test('the sample call list renders tel:/mailto: actions', () => {
        const inbox = read('shared_components/js/staff-dashboard/controllers/orders-inbox-controller.js');
        expect(inbox).toMatch(/href="tel:/);
        expect(inbox).toMatch(/href="mailto:/);
        expect(css).toContain('.pipeline-act');
    });
    test('Rule 3 — no inline code in the page', () => {
        const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
        expect(stripped).not.toMatch(/<style[\s>]/i);
        expect(stripped).not.toMatch(/\sstyle="/);
        expect(stripped).not.toMatch(/\sonclick=/);
        const bodies = [...stripped.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
        expect(bodies).toEqual([]);
    });
});
