/**
 * Vendor (subcontractor) job portal — structural locks from the 2026-09-05 review.
 *   1. Rule 3 + no third-party CDN on a vendor-facing page (Font Awesome is the vendored copy).
 *   2. Every API failure is visible AND retryable (role=alert banner + Retry re-runs the load);
 *      loading/empty states are status regions; decorative icons are aria-hidden.
 *   3. Search + message fields have labels; filter chips are pressed-state buttons with counts.
 *   4. Job cards open on Enter AND Space; opening a job pushes history so browser Back returns
 *      to the list; focus moves to the job heading and back to the card.
 *   5. Broken images degrade through data-onerror + ONE capture-phase listener; past-due
 *      needed-by dates are flagged; document.title tracks the view.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('pages/vendor-portal.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('pages/js/vendor-portal.js');
const css = read('pages/css/vendor-portal.css');
const components = read('shared_components/css/components.css');
const doc = new JSDOM(html).window.document;

describe('vendor portal — Rule 3 and dependencies', () => {
    test('no inline handlers/styles/scripts, no CDN', () => {
        expect(html).not.toMatch(/\son(click|change|keydown|submit|load|error)=/);
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/<script>[\s\S]*?\S[\s\S]*?<\/script>/);
        expect(html).not.toMatch(/cdnjs\.cloudflare\.com|cdn\.jsdelivr|unpkg\.com/);
        expect(html).toMatch(/\/shared_components\/vendor\/fontawesome\/css\/all\.min\.css/);
        expect(js.replace(/\/\/[^\n]*/g, '')).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/onclick="/);
        expect(js).not.toMatch(/\.style\.display/);
    });
    test('every icon in the markup and templates is decorative', () => {
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
    });
});

describe('vendor portal — failure and status surfaces', () => {
    test('the shared visibility layer owns hidden banners and controls', () => {
        expect(doc.body.dataset.ui).toBe('unified');
        expect(doc.querySelector('link[href^="/shared_components/css/components.css"]')).not.toBeNull();
        expect(components).toMatch(/\[hidden\]\s*\{\s*display:\s*none;/);
        expect(doc.getElementById('vp-error').hidden).toBe(true);
        expect(doc.getElementById('vp-error-retry').hidden).toBe(true);
    });
    test('error banner is an alert with a Retry the controller drives', () => {
        expect(html).toMatch(/id="vp-error" class="vp-error" role="alert" hidden/);
        expect(html).toMatch(/id="vp-error-retry" hidden/);
        expect(js).toMatch(/function showError\(msg, retry\)/);
        expect(js).toMatch(/showError\(e\.serverMessage \|\| 'Unable to load jobs[^']*', loadJobs\)/);
        expect(js).toMatch(/\$\('vp-error-retry'\)\.addEventListener\('click'/);
        expect(js).toMatch(/err\.serverMessage = \(j && typeof j\.error === 'string'\) \? j\.error : ''/);
        expect(js).toMatch(/r\.status === 429/);
    });
    test('loading and empty are status regions; empty text names the filter or search', () => {
        expect(html).toMatch(/id="vp-loading" class="vp-loading" role="status"/);
        expect(html).toMatch(/id="vp-detail-loading" class="vp-loading" role="status"/);
        expect(html).toMatch(/id="vp-empty" class="vp-empty" role="status" hidden/);
        expect(html).toMatch(/<p id="vp-empty-text">/);
        expect(js).toMatch(/function emptyText\(\)[\s\S]*No jobs match “' \+ state\.search \+ '”\./);
    });
});

describe('vendor portal — form and filter a11y', () => {
    test('search and message have labels; Post is disabled until there is text', () => {
        expect(html).toMatch(/<label for="vp-search" class="vp-sr">Search jobs<\/label>/);
        expect(html).toMatch(/<label for="vp-comment-input" class="vp-sr">Message for NWCA<\/label>/);
        expect(html).toMatch(/id="vp-comment-btn" disabled/);
        expect(js).toMatch(/\$\('vp-comment-btn'\)\.disabled = state\.posting \|\| !\(e\.target\.value \|\| ''\)\.trim\(\)/);
        expect(js).toMatch(/e\.key === 'Enter' && \(e\.ctrlKey \|\| e\.metaKey\)/);
    });
    test('filter chips are pressed-state buttons with counts', () => {
        expect(html).toMatch(/id="vp-filters" role="group" aria-label="Filter jobs"/);
        const filters = [...doc.querySelectorAll('#vp-filters button.vp-chip')];
        expect(filters.map(button => ({ type: button.type, filter: button.dataset.filter, pressed: button.getAttribute('aria-pressed') }))).toEqual([
            { type: 'button', filter: 'active', pressed: 'true' },
            { type: 'button', filter: 'completed', pressed: 'false' },
            { type: 'button', filter: 'all', pressed: 'false' },
        ]);
        expect(html).toMatch(/<span class="vp-chip-count" data-count="active"><\/span>/);
        expect(js).toMatch(/c\.setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
        expect(js).toMatch(/\.vp-chip-count\[data-count="' \+ f \+ '"\]/);
    });
});

describe('vendor portal — navigation', () => {
    test('native job buttons provide keyboard activation; history is pushed; popstate walks back', () => {
        expect(js).toContain('<button type="button" class="vp-job-card');
        // A second key handler would also synthesize a click on native buttons.
        expect(js).not.toContain("if (e.key !== 'Enter' && e.key !== ' ') return;");
        expect(js).toMatch(/if \(!fromHistory && location\.hash !== hash\) history\.pushState\(null, '', hash\);/);
        expect(js).toMatch(/window\.addEventListener\('popstate'/);
        expect(js).not.toMatch(/history\.replaceState/);
    });
    test('focus moves to the job heading and returns to the card; Esc goes back', () => {
        expect(html).toMatch(/id="vp-d-company" tabindex="-1"/);
        expect(js).toMatch(/\$\('vp-d-company'\)\.focus\(\)/);
        expect(js).toMatch(/if \(card\) card\.focus\(\);/);
        expect(js).toMatch(/e\.key !== 'Escape'/);
    });
    test('document.title tracks the view', () => {
        expect(js).toMatch(/function setTitle\(prefix\)/);
        expect(js).toMatch(/setTitle\(job\.id \+ ' · ' \+ \(job\.companyName \|\| 'Unknown company'\)\)/);
    });
});

describe('vendor portal — rendering', () => {
    test('images degrade through data-onerror + one capture listener', () => {
        expect(js).toMatch(/document\.addEventListener\('error', function \(e\)[\s\S]*?\}, true\);/);
        for (const mode of ['job-thumb', 'file-thumb', 'mockup']) expect(js).toMatch(new RegExp(`data-onerror="${mode}"`));
    });
    test('past-due needed-by is flagged on cards and in the work order', () => {
        expect(js).toMatch(/function isPastDue\(job\)/);
        expect(js).toMatch(/vp-job-card--pastdue/);
        expect(js).toMatch(/pastDue \? 'vp-overdue' : ''/);
        expect(css).toMatch(/\.vp-overdue\s*\{\s*color:\s*var\(--red-800\)/);
    });
    test('shared keyboard focus, screen-reader labels and a fluid phone grid', () => {
        expect(css).toMatch(/\.vp-sr\s*\{\s*position:\s*absolute;\s*width:\s*1px/);
        expect(components).toMatch(/:where\(\[data-ui="unified"\]\) :focus-visible\s*\{/);
        // Cards become one column without imposing a minimum wider than the phone.
        expect(css).toMatch(/\.vp-job-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(320px,\s*100%\),\s*1fr\)\)/);
    });
});
