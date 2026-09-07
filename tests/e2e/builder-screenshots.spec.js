/**
 * Page screenshots for a before/after visual comparison (2026-09-06: builder inline-style extraction, then the
 * <main> landmark pass across every served page). Not part of the regular suite: run explicitly with an output tag —
 *   SHOT_TAG=before npx playwright test --config tests/e2e/playwright.config.js builder-screenshots
 * Pages default to the three builders; SHOT_PAGES_FILE=<path> (one repo-relative .html per line) screenshots that
 * list instead. Writes tests/e2e/screenshots/<tag>-<page slug>.png (full page, fixed 1440×900 viewport, staff session).
 * SHOT_MEDIA=print emulates print media (suffix -print) — the fillable forms are printed, so verify both.
 */
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

if (!process.env.CI) test.use({ channel: 'chrome' });
test.use({ viewport: { width: 1440, height: 900 } });
test.skip(!process.env.SHOT_TAG, 'set SHOT_TAG to take page screenshots');

const OUT = path.join(__dirname, 'screenshots');
const PAGES = process.env.SHOT_PAGES_FILE
    ? fs.readFileSync(process.env.SHOT_PAGES_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((p) => '/' + p)
    : ['embroidery', 'screenprint', 'dtf'].map((b) => `/quote-builders/${b}-quote-builder.html`);
const slug = (p) => p.replace(/^\//, '').replace(/\.html$/, '').replace(/[^\w.-]+/g, '_');

test.describe('page screenshots', () => {
    test.setTimeout(240000);
    for (const p of PAGES) {
        test(p, async ({ page }) => {
            fs.mkdirSync(OUT, { recursive: true });
            await page.goto(p);
            // SHOT_MEDIA=print renders the page as it prints (the forms family is printed at the counter) — file gets a -print suffix
            if (process.env.SHOT_MEDIA) await page.emulateMedia({ media: process.env.SHOT_MEDIA });
            await page.waitForLoadState('networkidle').catch(() => {});
            await page.waitForTimeout(4000);
            // freeze motion so before/after diffs measure layout, not animation frames
            await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
            // open the collapsed/optional regions a reader would see so hidden-by-default blocks are exercised too
            await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
            await page.screenshot({ path: path.join(OUT, `${process.env.SHOT_TAG}-${slug(p)}${process.env.SHOT_MEDIA ? "-" + process.env.SHOT_MEDIA : ""}.png`), fullPage: true });
        });
    }
});
