/**
 * Cross-surface pricing parity (2026-09-06) — what a CUSTOMER CALCULATOR displays must equal what the
 * shared engine (Quick Quote + the quote builders) prices for the same style, location and quantity.
 *
 * Why this exists: the jest parity suites hold Quick Quote ↔ builders ↔ engine together, but nothing
 * compared a calculator PAGE (its own DOM, adapters, sessionStorage, typed tier strip) with the engine.
 * On 2026-09-06 a manual run found DTG under 24 pieces off by $1–$2.33, screen-print buttons promising
 * a fee Caspio no longer charged, and DTF showing $0.00 on every load after the first in a tab.
 *
 * How: on the Quick Quote page (staff session from playwright.config) run QuoteCartEngine.singleItemPreview
 * for a fixed scenario table; then open each calculator, drive its tier strip exactly as a customer would,
 * and read the price it shows. Reads hit the live proxy (~100 calls per run — run it after a deploy that
 * touches a calculator, an adapter or a Caspio tier; never in a loop).
 *
 *   npx playwright test --config tests/e2e/playwright.config.js calculator-parity
 */
const { test, expect } = require('@playwright/test');

const STYLE = { styleNumber: 'PC54', colorName: 'Jet Black', catalogColor: 'JetBlack' };
const CAP = { styleNumber: 'C112', colorName: 'Black', catalogColor: 'Black' };
const TOL = 0.011;

// Quantities the calculators can express: the tier minimum for a plain tier, an in-range exact quantity for an
// LTM tier (the pages expose an exact-quantity input only there). Read tiers from the LIVE API so a Caspio
// tier change re-shapes the table instead of breaking it.
async function fetchTiers(request, method) {
    const base = process.env.CASPIO_PROXY_BASE || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const res = await readLivePricing(request, `${base}/api/pricing-bundle?method=${method}&styleNumber=PC54`);
    expect(res.ok(), `pricing-bundle ${method}`).toBeTruthy();
    const d = await res.json();
    const raw = d.tiersR || d.tierData || d.tiers || [];
    return (Array.isArray(raw) ? raw : Object.values(raw))
        .map((t) => ({ label: t.TierLabel, min: Number(t.MinQuantity), max: Number(t.MaxQuantity), ltm: parseFloat(t.LTM_Fee) || 0 }))
        .sort((a, b) => a.min - b.min);
}
function qtyFor(tier) {
    // an LTM tier gets a quantity strictly inside the range (so the per-piece fee is exercised), others their minimum
    return tier.ltm > 0 ? Math.min(tier.max, Math.max(tier.min, Math.round((tier.min + tier.max) / 2))) : tier.min;
}
const money = (text) => { const m = String(text || '').replace(/\s+/g, ' ').match(/\$\s?(\d+(?:\.\d{2})?)/); return m ? parseFloat(m[1]) : NaN; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The live pricing router permits 100 reads/minute. CI is fast enough to fill that
// window; retrying after 8s/12s simply re-enters the same exhausted bucket.
async function readLivePricing(request, url) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await request.get(url);
        if (res.status() !== 429 || attempt === 3) return res;
        await sleep(61000); // allow the actual 60-second pricing window to reset
    }
}

async function engine(page, item, groups) {
    // paced: every preview re-reads the pricing bundle through the live proxy, and a tight loop trips its 429 limiter
    for (let attempt = 1; attempt <= 3; attempt++) {
        await sleep(attempt === 1 ? 2500 : 61000);
        const r = await page.evaluate(async ({ item, groups }) => {
            let shared = null;
            const deps = { EmbroideryPricingCalculator: function (opts) { if (!shared) shared = new window.EmbroideryPricingCalculator(opts || { skipInit: true }); return shared; } };
            const res = await window.QuoteCartEngine.singleItemPreview(Object.assign({ id: '__parity__' }, item), { groups, deps, nudge: false });
            return res.ok
                ? { perPiece: res.effectivePerPiece, tier: res.tierLabel, serviceLines: (res.serviceLines || []).map((s) => ({ code: s.code, label: s.label, unitPrice: s.unitPrice, total: s.total })) }
                : { error: res.error && res.error.message };
        }, { item, groups });
        if (!r.error || !/429|Too Many|unavailable/i.test(r.error)) return r;
        if (attempt === 3) return r;
    }
    return { error: 'unreachable' };
}
// the additional-logo cost is a SERVICE LINE (code AL for a garment logo, CB for a cap back), not part of the unit price
const serviceUnit = (r, codes) => { const s = (r.serviceLines || []).find((x) => codes.includes(x.code)); return s ? Number(s.unitPrice) : NaN; };

// Locally this drives the installed Google Chrome (no Playwright browser download needed on Erik's machine);
// CI keeps the project's chromium.
if (!process.env.CI) test.use({ channel: 'chrome' });

test.describe('customer calculators price like the engine', () => {
    test.setTimeout(300000);
    let qq; // the Quick Quote page — holds the engine + every pricing service, staff session from config
    test.beforeAll(async ({ browser }) => {
        qq = await browser.newPage();
        await qq.goto('/calculators/quick-quote/');
        await qq.waitForFunction(() => window.QuoteCartEngine && window.EmbroideryPricingCalculator && window.DTFPricingService, null, { timeout: 60000 });
    });
    test.afterAll(async () => { if (qq) await qq.close(); });

    test('screen print — 1 colour, left chest', async ({ page, request }) => {
        const tiers = await fetchTiers(request, 'ScreenPrint');
        await page.goto(`/calculators/screen-print-pricing.html?StyleNumber=${STYLE.styleNumber}&COLOR=${encodeURIComponent(STYLE.colorName)}`);
        await page.waitForFunction(() => document.querySelectorAll('.sp-tier-button').length >= 3, null, { timeout: 60000 });
        const rows = [];
        for (const t of tiers) {
            const qty = qtyFor(t);
            const eng = await engine(qq, Object.assign({ method: 'SCP', sizes: { M: qty } }, STYLE),
                { 'scp:design-1': { frontColors: 1, backColors: 0, sleeveColorsList: [], darkGarment: false, safetyStripes: false } });
            const shown = await page.evaluate(async ({ label, qty }) => {
                document.getElementById(`sp-tier-${label}`).click();
                await new Promise((r) => setTimeout(r, 400));
                const input = document.getElementById(`sp-qty-${label}`);
                if (input) { input.value = qty; input.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 600)); }
                const text = document.querySelector('.sp-live-price-display').innerText;
                return (text.match(/Price per shirt\s*\$\s?(\d+\.\d{2})/) || [])[1];
            }, { label: t.label, qty });
            rows.push({ tier: t.label, qty, engine: eng.perPiece, calculator: parseFloat(shown), error: eng.error });
        }
        report('SCP', rows);
    });

    test('DTG — left chest', async ({ page, request }) => {
        const tiers = await fetchTiers(request, 'DTG');
        await page.goto(`/calculators/dtg-pricing.html?StyleNumber=${STYLE.styleNumber}&COLOR=${encodeURIComponent(STYLE.colorName)}`);
        await page.waitForFunction(() => document.querySelectorAll('.tier-button[data-tier]').length >= 3, null, { timeout: 60000 });
        await page.evaluate(async () => { document.querySelector('.toggle-item[data-location="LC"]').click(); await new Promise((r) => setTimeout(r, 600)); });
        const rows = [];
        for (const t of tiers) {
            const qty = qtyFor(t);
            const eng = await engine(qq, Object.assign({ method: 'DTG', sizes: { M: qty } }, STYLE), { 'dtg:main': { locationCode: 'LC' } });
            const shown = await page.evaluate(async ({ label, qty, ltm }) => {
                document.getElementById(`tier-${label}`).click();
                await new Promise((r) => setTimeout(r, 400));
                if (ltm) { const i = document.getElementById('dtg-ltm-quantity-input'); i.value = qty; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 600)); }
                return document.querySelector('.live-price-amount, [class*=price-amount]').textContent;
            }, { label: t.label, qty, ltm: t.ltm > 0 });
            rows.push({ tier: t.label, qty, engine: eng.perPiece, calculator: money(shown), error: eng.error });
        }
        report('DTG', rows);
    });

    test('DTF — left chest', async ({ page, request }) => {
        const tiers = await fetchTiers(request, 'DTF');
        await page.goto(`/calculators/dtf-pricing.html?StyleNumber=${STYLE.styleNumber}&COLOR=${encodeURIComponent(STYLE.colorName)}`);
        await page.waitForFunction(() => window.dtfCalculator && window.dtfCalculator.currentData && window.dtfCalculator.currentData.garmentCost > 0
            && document.querySelectorAll('#dtf-tier-buttons button').length >= 3, null, { timeout: 60000 });
        await page.evaluate(async () => { document.querySelector('[data-location="left-chest"]').click(); await new Promise((r) => setTimeout(r, 700)); });
        const rows = [];
        for (const t of tiers) {
            const qty = qtyFor(t);
            const eng = await engine(qq, Object.assign({ method: 'DTF', sizes: { M: qty } }, STYLE), { 'dtf:main': { locations: ['left-chest'] } });
            const shown = await page.evaluate(async ({ label, qty, ltm }) => {
                [...document.querySelectorAll('#dtf-tier-buttons button')].find((b) => b.dataset.tier === label).click();
                await new Promise((r) => setTimeout(r, 500));
                if (ltm) { const i = document.getElementById('dtf-exact-quantity'); if (i) { i.value = qty; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 700)); } }
                return document.querySelector('[class*=live-price]').innerText;
            }, { label: t.label, qty, ltm: t.ltm > 0 });
            rows.push({ tier: t.label, qty, engine: eng.perPiece, calculator: money(shown), error: eng.error });
        }
        report('DTF', rows);
    });

    test('embroidery — left chest, 8,000 stitches (S–XL row)', async ({ page, request }) => {
        const tiers = await fetchTiers(request, 'EMB'); // the bundle route wants EMB (pricing-tiers is the one that takes EmbroideryShirts)
        await page.goto(`/calculators/embroidery-pricing.html?StyleNumber=${STYLE.styleNumber}&COLOR=${encodeURIComponent(STYLE.colorName)}`);
        await page.waitForFunction(() => [...document.querySelectorAll('table tr')].some((r) => /S, M, L, XL/.test(r.textContent) && /\$\d/.test(r.textContent)), null, { timeout: 60000 });
        const rows = [];
        for (const t of tiers) {
            const qty = qtyFor(t);
            const eng = await engine(qq, Object.assign({ method: 'EMB', sizes: { M: qty } }, STYLE),
                { 'emb:garment': { logos: { primary: { position: 'Left Chest', stitchCount: 8000, needsDigitizing: false }, additional: [] } } });
            const shown = await page.evaluate(async ({ label, qty, ltm }) => {
                if (ltm) { const sel = document.getElementById('ltmQuantity'); if (sel) { sel.value = String(qty); sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 600)); } }
                const header = [...document.querySelectorAll('table th')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
                const col = header.findIndex((h) => h.startsWith(label.replace('+', '+')) || h.startsWith(label.split('-')[0] + '-') || (label.endsWith('+') && h.startsWith(label)));
                const row = [...document.querySelectorAll('table tr')].find((r) => /S, M, L, XL/.test(r.textContent));
                return row && col >= 0 ? row.children[col].textContent : null;
            }, { label: t.label, qty, ltm: t.ltm > 0 });
            rows.push({ tier: t.label, qty, engine: eng.perPiece, calculator: money(shown), error: eng.error });
        }
        report('EMB', rows);

        // Additional-logo table: the engine prices a second 8,000-stitch logo as the AL service line (per piece)
        const al = [];
        for (const t of tiers) {
            const qty = qtyFor(t);
            const primary = { position: 'Left Chest', stitchCount: 8000, needsDigitizing: false };
            const withAl = await engine(qq, Object.assign({ method: 'EMB', sizes: { M: qty } }, STYLE),
                { 'emb:garment': { logos: { primary, additional: [{ position: 'Additional Logo', stitchCount: 8000, needsDigitizing: false }] } } });
            const shown = await page.evaluate((label) => (document.getElementById(`emb-al-${label}`) || {}).textContent, t.label);
            al.push({ tier: t.label, qty, engine: serviceUnit(withAl, ['AL']), calculator: money(shown), error: withAl.error });
        }
        report('EMB additional logo', al);
    });

    test('cap embroidery — C112 front, 8,000 stitches (OSFA row)', async ({ page, request }) => {
        const base = process.env.CASPIO_PROXY_BASE || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        const res = await readLivePricing(request, `${base}/api/pricing-bundle?method=CAP&styleNumber=C112`);
        expect(res.ok()).toBeTruthy();
        const d = await res.json(); const raw = d.tiersR || d.tierData || d.tiers || [];
        const tiers = (Array.isArray(raw) ? raw : Object.values(raw)).map((t) => ({ label: t.TierLabel, min: Number(t.MinQuantity), max: Number(t.MaxQuantity), ltm: parseFloat(t.LTM_Fee) || 0 })).sort((a, b) => a.min - b.min);
        await page.goto(`/calculators/cap-embroidery-pricing-integrated.html?StyleNumber=${CAP.styleNumber}&COLOR=${encodeURIComponent(CAP.colorName)}`);
        await page.waitForFunction(() => [...document.querySelectorAll('table tr')].some((r) => /^OSFA/.test(r.textContent.trim()) && /\$\d/.test(r.textContent)), null, { timeout: 60000 });
        const rows = [];
        for (const t of tiers) {
            const qty = qtyFor(t);
            const eng = await engine(qq, Object.assign({ method: 'CAP', isCap: true, sizes: { OSFA: qty } }, CAP),
                { 'emb:cap': { logos: { primary: { position: 'Cap Front', stitchCount: 8000, needsDigitizing: false }, additional: [] } } });
            const shown = await page.evaluate(async ({ label, qty, ltm }) => {
                if (ltm) { const sel = document.getElementById('ltmQuantity'); if (sel) { sel.value = String(qty); sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 600)); } }
                const table = [...document.querySelectorAll('table')].find((tb) => /OSFA/.test(tb.textContent));
                const header = [...table.querySelectorAll('th')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
                const col = header.findIndex((h) => h.startsWith(label.split('-')[0] + '-') || (label.endsWith('+') && h.startsWith(label)));
                const row = [...table.querySelectorAll('tr')].find((r) => /^OSFA/.test(r.textContent.trim()));
                return row && col >= 0 ? row.children[col].textContent : null;
            }, { label: t.label, qty, ltm: t.ltm > 0 });
            rows.push({ tier: t.label, qty, engine: eng.perPiece, calculator: money(shown), error: eng.error });
        }
        report('CAP', rows);

        // Additional-logo table (cap back, 5,000 stitches) = the engine's CB service line per piece
        const al = [];
        for (const t of tiers) {
            const qty = qtyFor(t);
            const primary = { position: 'Cap Front', stitchCount: 8000, needsDigitizing: false };
            const withAl = await engine(qq, Object.assign({ method: 'CAP', isCap: true, sizes: { OSFA: qty } }, CAP),
                { 'emb:cap': { logos: { primary, additional: [{ position: 'Cap Back', stitchCount: 5000, needsDigitizing: false }] } } });
            const shown = await page.evaluate((label) => (document.getElementById(`cap-al-${label}`) || {}).textContent, t.label);
            al.push({ tier: t.label, qty, engine: serviceUnit(withAl, ['CB', 'AL']), calculator: money(shown), error: withAl.error });
        }
        report('CAP additional logo', al);
    });
});

function report(method, rows) {
    const lines = rows.map((r) => `${method} ${r.tier.padEnd(8)} qty ${String(r.qty).padStart(3)}  engine ${fmt(r.engine)}  calculator ${fmt(r.calculator)}  ${r.error ? 'ENGINE ERROR: ' + r.error : Math.abs(r.engine - r.calculator) <= TOL ? 'ok' : 'MISMATCH'}`);
    console.log('\n' + lines.join('\n'));
    for (const r of rows) {
        expect(r.error, `${method} ${r.tier}: engine error`).toBeUndefined();
        expect(Number.isFinite(r.calculator), `${method} ${r.tier}: calculator showed no price`).toBeTruthy();
        expect(Math.abs(r.engine - r.calculator), `${method} ${r.tier} qty ${r.qty}: engine $${fmt(r.engine)} vs calculator $${fmt(r.calculator)}`).toBeLessThanOrEqual(TOL);
    }
}
function fmt(n) { return Number.isFinite(n) ? n.toFixed(2) : String(n); }
