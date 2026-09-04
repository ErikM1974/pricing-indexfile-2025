/**
 * @jest-environment jsdom
 *
 * AE Dashboard (dashboards/ae-dashboard.html) — locks from the 2026-09-04 review.
 *
 *   1. Rule 3: no <style>, no inline <script> body, no style= or onclick= attributes.
 *   2. Art fees are never typed into the page or the garment form — they come from
 *      Caspio Service_Codes (data-fee-* hooks / loadArtFeeOptions).
 *   3. One "needs your review" number: the galleries publish `ae:counts`, the page
 *      listens; the old badge fetch is gone.
 *   4. Every form pairs labels with controls, has a keyboard drop zone and a
 *      leave-page guard. The garment form also drafts and shows progress.
 *   5. Page hygiene: one name, JDS Mockup listed once, SVG item-type icons, dead
 *      note modals gone, bootstrap in its own file.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/ae-dashboard.html');
const doc = new DOMParser().parseFromString(html, 'text/html');
const pageJs = read('shared_components/js/ae-dashboard.js');
const initJs = read('dashboards/js/ae-dashboard-init.js');
const artAe = read('shared_components/js/art-ae.js');
const mockupAe = read('shared_components/js/mockup-ae.js');
const FORMS = {
    garment: read('shared_components/js/garment-submit-form.js'),
    sticker: read('shared_components/js/sticker-banner-submit-form.js'),
    jds: read('shared_components/js/jds-submit-form.js'),
    mockup: read('shared_components/js/mockup-submit-form.js'),
};

describe('Rule 3 — no inline code on the AE dashboard', () => {
    const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
    test('no <style> block', () => expect(stripped).not.toMatch(/<style[\s>]/i));
    test('no inline <script> body', () => {
        const bodies = [...stripped.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
        expect(bodies).toEqual([]);
    });
    test('no style= attributes (the Requirements tab had 159)', () => expect(stripped).not.toMatch(/\sstyle="/));
    test('no onclick= attributes — everything is data-action', () => expect(stripped).not.toMatch(/\sonclick=/));
    test('the bootstrap lives in dashboards/js/ae-dashboard-init.js and the page loads it', () => {
        expect(fs.existsSync(path.join(ROOT, 'dashboards/js/ae-dashboard-init.js'))).toBe(true);
        expect(doc.querySelector('script[src^="/dashboards/js/ae-dashboard-init.js"]')).not.toBeNull();
    });
});

describe('pricing = API, never hardcoded', () => {
    test('the Requirements tab states no dollar figure of its own', () => {
        const req = doc.getElementById('requirements-tab');
        expect(req).not.toBeNull();
        expect(req.textContent).not.toMatch(/\$\s?\d/);
        expect(req.querySelectorAll('[data-fee-price], [data-fee-rate], [data-fee-frac]').length).toBeGreaterThan(5);
        expect(req.querySelector('#req-fees-warning')).not.toBeNull();
    });
    test('the init script fills the fees from /api/service-codes and warns on failure', () => {
        expect(initJs).toMatch(/\/api\/service-codes/);
        expect(initJs).toMatch(/req-fees-warning/);
    });
    test('the garment form no longer offers GRT parts that do not exist in Caspio', () => {
        // the old typed <option>s — a comment may still mention them as history
        expect(FORMS.garment).not.toMatch(/<option value="(25|100|150)">/);
        expect(FORMS.garment).not.toMatch(/GRT-(25|100|150)\s+[A-Z]/);
        expect(FORMS.garment).toMatch(/function loadArtFeeOptions/);
        expect(FORMS.garment).toMatch(/\/api\/service-codes/);
    });
});

describe('one "needs your review" number', () => {
    test('both galleries publish ae:counts after every render', () => {
        expect(artAe).toMatch(/new CustomEvent\('ae:counts'/);
        expect(mockupAe).toMatch(/new CustomEvent\('ae:counts'/);
        expect(artAe).toMatch(/getNeedsReview/);
    });
    test('the page listens for ae:counts and the old status=Awaiting Approval badge fetch is gone', () => {
        expect(pageJs).toMatch(/addEventListener\('ae:counts'/);
        expect(pageJs).not.toMatch(/select=ID_Design&limit=100/);
        expect(pageJs).not.toMatch(/function updateTabBadges/);
    });
    test('the department badges exist in the markup for Steve and Ruth', () => {
        expect(doc.querySelector('.ae-nav__section[data-section="steve"] [data-count="steve"]')).not.toBeNull();
        expect(doc.querySelector('.ae-nav__section[data-section="ruth"] [data-count="ruth"]')).not.toBeNull();
    });
});

describe('forms: labels, keyboard drop zone, leave-page guard', () => {
    test.each(Object.entries(FORMS))('%s form', (_name, src) => {
        expect(src).toMatch(/htmlFor = ctrl\.id/);
        expect(src).toMatch(/role="button" tabindex="0" aria-label="Upload/);
        expect(src).toMatch(/beforeunload/);
    });
    test('the garment form drafts per rep, restores on init, and shows the progress bar', () => {
        expect(FORMS.garment).toMatch(/nwca-gsf-draft:/);
        expect(FORMS.garment).toMatch(/function restoreDraft/);
        expect(FORMS.garment).toMatch(/function countMissing/);
        expect(FORMS.garment).toMatch(/gsf-progress-submit/);
        // a successful submit clears the draft and stands the guard down
        expect(FORMS.garment).toMatch(/function showSuccess[\s\S]{0,200}submitted = true;[\s\S]{0,120}clearDraft\(\);/);
    });
});

describe('page hygiene', () => {
    test('one name: the page calls itself AE Dashboard everywhere', () => {
        expect(doc.title).toMatch(/^AE Dashboard/);
        expect(doc.querySelector('.ae-page-title').textContent.trim()).toBe('AE Dashboard');
        expect(doc.querySelector('.bt-breadcrumb-current').textContent.trim()).toBe('AE Dashboard');
    });
    test('JDS Mockup is listed exactly once', () => {
        expect(doc.querySelectorAll('a[href="/pages/jds-mockup-creator.html"]').length).toBe(1);
    });
    test('the item-type pills use SVG icons, not emoji', () => {
        const icons = [...doc.querySelectorAll('.ae-item-pill-icon')];
        expect(icons.length).toBe(4);
        for (const i of icons) expect(i.querySelector('svg')).not.toBeNull();
    });
    test('the dead note modals and their functions are gone', () => {
        expect(doc.getElementById('viewNotesModal')).toBeNull();
        expect(doc.getElementById('noteModal')).toBeNull();
        expect(pageJs).not.toMatch(/window\.viewNotesModal =/);
    });
    test('display toggles use the hidden attribute (lightbox, review states)', () => {
        expect(doc.getElementById('ae-lightbox').hasAttribute('hidden')).toBe(true);
        expect(doc.getElementById('review-loading').hasAttribute('hidden')).toBe(true);
        expect(doc.getElementById('review-empty-state').hasAttribute('hidden')).toBe(true);
    });
    test('department tabs get arrow-key handling', () => {
        expect(pageJs).toMatch(/function rovingTabs/);
        expect(pageJs).toMatch(/ArrowRight/);
    });
});
