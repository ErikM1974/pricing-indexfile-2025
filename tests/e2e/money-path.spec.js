/**
 * Money-path E2E (roadmap 1.13) — the revenue flow reps live in, end to end
 * in a real browser: search → row → quantities → live reprice → SAVE.
 *
 * Writes are mocked at the network layer (no real quotes, no real email):
 *   /api/quote-sequence/* → deterministic id (EMB-2026-777)
 *   POST /api/quote_sessions|quote_items → captured + stubbed
 *   api.emailjs.com → stubbed
 * Pricing reads hit the live proxy — asserts are STRUCTURAL (totals > 0,
 * LTM presence); exact dollars stay locked by the capture baselines.
 */

const { test, expect } = require('@playwright/test');

/** Wire the write mocks; returns capture arrays you can assert on. */
async function mockWrites(page, prefix) {
    const captured = { sessions: [], items: [], emails: 0 };
    await page.route('**/api/quote-sequence/**', (route) =>
        route.fulfill({ json: { prefix, year: 2026, sequence: 777 } })
    );
    await page.route('**/api/quote_sessions**', (route) => {
        if (route.request().method() === 'POST') {
            captured.sessions.push(route.request().postDataJSON());
            return route.fulfill({ status: 201, json: { PK_ID: 99001, QuoteID: `${prefix}-2026-777` } });
        }
        return route.fulfill({ json: [] }); // duplicate-check reads → none found
    });
    await page.route('**/api/quote_items**', (route) => {
        if (route.request().method() === 'POST') {
            captured.items.push(route.request().postDataJSON());
            return route.fulfill({ status: 201, json: { PK_ID: 88001 } });
        }
        return route.fulfill({ json: [] });
    });
    await page.route('**/api.emailjs.com/**', (route) => {
        captured.emails++;
        return route.fulfill({ status: 200, body: 'OK' });
    });
    return captured;
}

/** Open a builder page. */
async function openBuilder(page, path) {
    await page.goto(path);
    await page.waitForSelector('#product-search', { timeout: 30000 });
}

/** Set an input that may be HIDDEN behind the guided step rail (customer
 *  panel = step 3). The money asserts are on network payloads, so DOM-level
 *  set + input event is the stable choice here. */
async function setHiddenInput(page, sel, val) {
    await page.evaluate(({ sel, val }) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('missing ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, { sel, val });
}

/** Click a control that may sit in a rail-hidden panel. */
async function clickAction(page, sel) {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('missing ' + sel);
        el.click();
    }, sel);
}

/** Search a style and get its row added. Real keystrokes (builders wire
 *  input vs keyup differently), and BOTH selection flows: exact-match
 *  auto-add (DTF) or a suggestion dropdown to click (EMB/SCP). */
async function addProduct(page, style) {
    const search = page.locator('#product-search');
    await search.click();
    await search.pressSequentially(style, { delay: 60 });
    const row = page.locator('tr[data-style]').first();
    const suggestion = page.locator('.suggestion-item').first();
    await Promise.race([
        row.waitFor({ state: 'visible', timeout: 20000 }),
        suggestion.waitFor({ state: 'visible', timeout: 30000 }),
    ]);
    if (!(await row.isVisible().catch(() => false))) {
        await suggestion.click();
    }
    await expect(row).toBeVisible({ timeout: 20000 });

    // Size inputs stay DISABLED until a color is picked (real rep flow).
    const sizeInput = row.locator('input[data-size="M"]');
    if (await sizeInput.isDisabled().catch(() => false)) {
        await row.locator('.color-picker-selected').first().click();
        await row.locator('.color-picker-option').first().click();
        await expect(sizeInput).toBeEnabled({ timeout: 15000 });
    }
}

/** Set a size qty on the first product row and fire the builder's change handler. */
async function setQty(page, size, qty) {
    const input = page.locator(`tr[data-style] input[data-size="${size}"]`).first();
    await input.fill(String(qty));
    await input.dispatchEvent('change');
}

test.describe('EMB money path', () => {
    test('build → reprice → save mints EMB id and posts REAL money', async ({ page }) => {
        const captured = await mockWrites(page, 'EMB');
        await openBuilder(page, '/quote-builders/embroidery-quote-builder.html');

        await addProduct(page, 'PC54');
        await setQty(page, 'M', 24); // 24-47 tier
        await page.waitForTimeout(6000); // live reprice (proxy round trip + debounce)

        await setHiddenInput(page, '#customer-name', 'E2E Test');
        await setHiddenInput(page, '#customer-email', 'e2e@test.invalid');

        await clickAction(page, '.btn-share-link');
        await expect
            .poll(() => captured.sessions.length, { timeout: 30000, message: 'quote_sessions POST never fired' })
            .toBeGreaterThan(0);

        const session = captured.sessions[0];
        expect(session.QuoteID).toBe('EMB-2026-777');
        expect(parseFloat(session.SubtotalAmount)).toBeGreaterThan(0);
        expect(parseFloat(session.TotalAmount)).toBeGreaterThan(0);
        expect(captured.items.length).toBeGreaterThan(0); // line items followed the session
    });

    test('LTM guard: qty ≤ 7 carries the small-order fee into the quote', async ({ page }) => {
        await mockWrites(page, 'EMB');
        await openBuilder(page, '/quote-builders/embroidery-quote-builder.html');

        await addProduct(page, 'PC54');
        await setQty(page, 'M', 5); // 1-7 tier → LTM applies
        await page.waitForTimeout(6000);

        // The garment LTM line must be visible AND non-zero (Erik's tier rule:
        // EMB LTM at qty ≤ 7 — NOT <24 like DTG/DTF).
        const ltm = page.locator('#garment-ltm-table-total');
        await expect(ltm).not.toHaveText(/^\s*(\$0\.00)?\s*$/, { timeout: 10000 });
    });
});

test.describe('SCP money path (Batch 2.1)', () => {
    test('build → reprice → save mints SPC id and posts REAL money', async ({ page }) => {
        const captured = await mockWrites(page, 'SPC');
        await openBuilder(page, '/quote-builders/screenprint-quote-builder.html');

        // Print config defaults are live (front LC, 1 color — checked in the HTML),
        // so the lane exercises the same out-of-the-box flow a rep starts with.
        await addProduct(page, 'PC54');
        await setQty(page, 'M', 48); // 48-71 tier — clear of SCP's LTM-through-24-47 rule
        await page.waitForTimeout(6000); // live reprice (proxy round trip + debounce)

        await setHiddenInput(page, '#customer-name', 'E2E Test');
        await setHiddenInput(page, '#customer-email', 'e2e@test.invalid');

        await clickAction(page, '.btn-share-link');
        await expect
            .poll(() => captured.sessions.length, { timeout: 30000, message: 'quote_sessions POST never fired' })
            .toBeGreaterThan(0);

        const session = captured.sessions[0];
        expect(session.QuoteID).toBe('SPC-2026-777');
        expect(parseFloat(session.SubtotalAmount)).toBeGreaterThan(0);
        expect(parseFloat(session.TotalAmount)).toBeGreaterThan(0);
        expect(captured.items.length).toBeGreaterThan(0);
    });
});

test.describe('DTG money path (Batch 2.1)', () => {
    test('catalog previewStyle → size grid → live prices → save posts REAL money', async ({ page }) => {
        const captured = await mockWrites(page, 'DTG');
        await page.goto('/quote-builders/dtg-quote-builder.html');
        // The inline form renders into its mount; previewStyle is the exact entry
        // the catalog cards call (real rep path: click a top-seller card).
        await page.waitForFunction(() => window.DTGInlineForm && typeof window.DTGInlineForm.previewStyle === 'function', null, { timeout: 30000 });
        await page.evaluate(() => {
            window.DTGInlineForm.previewStyle({ style: 'PC54', desc: 'Core Cotton Tee', color: 'Athletic Heather' });
        });

        // Size grid renders once the live bundle lands; type a real quantity.
        const qtyInput = page.locator('input[type="number"][data-row-id][data-size="M"]').first();
        await qtyInput.waitFor({ state: 'visible', timeout: 30000 });
        await qtyInput.fill('24');
        await qtyInput.dispatchEvent('change');
        await page.waitForTimeout(6000); // live pricing (bundle + updateLivePrices)

        // Save straight off the form (the #dtgSaveBtn/aiSaveQuoteBtn path).
        await page.evaluate(() => window.dtgSaveQuote());
        await expect
            .poll(() => captured.sessions.length, { timeout: 30000, message: 'quote_sessions POST never fired' })
            .toBeGreaterThan(0);

        const session = captured.sessions[0];
        expect(String(session.QuoteID)).toMatch(/^DTG/);
        expect(parseFloat(session.TotalAmount)).toBeGreaterThan(0); // DTG TotalAmount is PRE-tax by contract
        expect(captured.items.length).toBeGreaterThan(0);
    });
});

test.describe('DTF money guard + path', () => {
    test('zero transfer locations BLOCKS save (garment-only ≈ half price must never persist)', async ({ page }) => {
        const captured = await mockWrites(page, 'DTF');
        await openBuilder(page, '/quote-builders/dtf-quote-builder.html');

        await addProduct(page, 'PC54');
        await setQty(page, 'M', 24); // above DTF's 10-pc minimum so ONLY the location gate can block
        await page.waitForTimeout(4000);

        await setHiddenInput(page, '#customer-name', 'E2E Test');
        await setHiddenInput(page, '#customer-email', 'e2e@test.invalid'); // email gate fires before the location gate
        await clickAction(page, '.btn-share-link');

        // Blocked: the location error surfaces and NO session write happens.
        await expect(page.locator('body')).toContainText(/select at least one transfer location/i, { timeout: 15000 });
        await page.waitForTimeout(3000); // grace window — a late POST would betray a bypass
        expect(captured.sessions.length).toBe(0);
    });

    test('with a location selected, save posts REAL money (Batch 2.1 positive lane)', async ({ page }) => {
        const captured = await mockWrites(page, 'DTF');
        await openBuilder(page, '/quote-builders/dtf-quote-builder.html');

        await addProduct(page, 'PC54');
        await setQty(page, 'M', 24);
        await page.waitForTimeout(6000); // row priced ⇒ async init (and its location listeners) is done

        // Location listeners bind during the builder's async init — a click before that
        // leaves the radio checked but selectedLocations EMPTY (window.dtfQuoteBuilder is
        // assigned before init() settles, so waiting on the handle is not enough). Click
        // after pricing proves init finished, and require the summary to acknowledge it.
        await clickAction(page, 'input[name="front-location"][value="left-chest"]');
        await expect(page.locator('#location-summary')).toContainText(/left chest/i, { timeout: 10000 });
        await page.waitForTimeout(4000); // location reprice

        await setHiddenInput(page, '#customer-name', 'E2E Test');
        await setHiddenInput(page, '#customer-email', 'e2e@test.invalid');

        await clickAction(page, '.btn-share-link');
        await expect
            .poll(() => captured.sessions.length, { timeout: 30000, message: 'quote_sessions POST never fired' })
            .toBeGreaterThan(0);

        const session = captured.sessions[0];
        expect(String(session.QuoteID)).toMatch(/^DTF/);
        expect(parseFloat(session.TotalAmount)).toBeGreaterThan(0);
        expect(captured.items.length).toBeGreaterThan(0);
    });
});
