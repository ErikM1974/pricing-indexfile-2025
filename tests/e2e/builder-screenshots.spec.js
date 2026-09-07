/**
 * Builder screenshots for a before/after visual comparison (2026-09-06, inline-style extraction).
 * Not part of the regular suite: run explicitly with an output tag —
 *   SHOT_TAG=before npx playwright test --config tests/e2e/playwright.config.js builder-screenshots
 * Writes tests/e2e/screenshots/<tag>-<builder>.png (full page, fixed 1440×900 viewport, staff session).
 */
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

if (!process.env.CI) test.use({ channel: 'chrome' });
test.use({ viewport: { width: 1440, height: 900 } });
test.skip(!process.env.SHOT_TAG, 'set SHOT_TAG to take builder screenshots');

const OUT = path.join(__dirname, 'screenshots');
const BUILDERS = ['embroidery', 'screenprint', 'dtf'];

test.describe('builder screenshots', () => {
    test.setTimeout(240000);
    for (const b of BUILDERS) {
        test(b, async ({ page }) => {
            fs.mkdirSync(OUT, { recursive: true });
            await page.goto(`/quote-builders/${b}-quote-builder.html`);
            await page.waitForLoadState('networkidle').catch(() => {});
            await page.waitForTimeout(4000);
            // open the collapsed/optional regions a customer would see so hidden-by-default blocks are exercised too
            await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
            await page.screenshot({ path: path.join(OUT, `${process.env.SHOT_TAG}-${b}.png`), fullPage: true });
        });
    }
});
