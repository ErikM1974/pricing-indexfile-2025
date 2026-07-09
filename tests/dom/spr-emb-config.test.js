/**
 * renderSprEmbConfigSection — jsdom behavior lock (T3, 2026-07-09).
 *
 * THE precondition for splitting the 412-line deferred-closure machine (B3
 * flagged it "needs jsdom coverage before splitting"): these tests pin the
 * observable contract BEFORE the split so the split must preserve it —
 *   1. multi-design assignment path: banner rows + per-design selects,
 *      smart defaults (highest stitches → garment, next → cap), and the
 *      DEFERRED recalc (setTimeout 0) that auto-sets garment/cap tier
 *      dropdowns + Full Back position + fbPriceTiers from the assigned design;
 *   2. reassignment via the select's change listener re-derives everything;
 *   3. single-design path: synchronous tier auto-set + both assignments;
 *   4. designInfo fallback banner + hidden section when options are falsy;
 *   5. LTM row smart default (qty ≤ 7 + allProductsHaveSwPrice → unchecked).
 */
const path = require('path');

const BUNDLES = path.join(__dirname, '.bundles');
const { renderSprEmbConfigSection } = require(path.join(BUNDLES, 'emb-spr-modal.cjs'));

function mountSprDom() {
    document.body.innerHTML = `
        <div id="spr-embconfig-section" style="display:none">
            <div id="spr-design-info-banner" style="display:none"></div>
            <div id="spr-garment-config">
                <select id="spr-garment-position">
                    <option value="Left Chest">Left Chest</option>
                    <option value="Full Back">Full Back</option>
                </select>
                <select id="spr-garment-stitch-tier">
                    <option value="8000">8000</option>
                    <option value="12000">12000</option>
                    <option value="18000">18000</option>
                    <option value="25000">25000</option>
                </select>
                <input type="checkbox" id="spr-garment-digitizing">
            </div>
            <div id="spr-cap-config">
                <select id="spr-cap-embellishment"><option value="embroidery">embroidery</option></select>
                <div id="spr-cap-stitch-tier-wrapper">
                    <select id="spr-cap-stitch-tier">
                        <option value="8000">8000</option>
                        <option value="12000">12000</option>
                        <option value="18000">18000</option>
                        <option value="25000">25000</option>
                    </select>
                </div>
                <input type="checkbox" id="spr-cap-digitizing">
            </div>
            <div id="spr-ltm-row" style="display:none">
                <input type="checkbox" id="spr-ltm-enabled">
                <span id="spr-ltm-hint"></span>
            </div>
        </div>`;
}

// escapeHtml is a bare-global contract in the module (quote-builder-utils on the page)
beforeAll(() => {
    window.escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
});

const flushTimers = () => new Promise((r) => setTimeout(r, 1));

function makeTwoDesignOptions() {
    return {
        hasGarments: true,
        hasCaps: true,
        digitizing: false,
        totalQty: 24,
        designNumbersRaw: ['111', '222'],
        designNumbers: ['Design #111 — Big Jacket Back', 'Design #222 — Small Cap Logo'],
        designLookup: {
            designs: {
                111: {
                    company: 'ACME', designName: 'Big Jacket Back',
                    maxStitchCount: 30000, maxStitchTier: 'Full Back', maxAsSurcharge: 0,
                    hasFBPricing: true,
                    variants: [{ stitchCount: 30000, stitchTier: 'Full Back', asSurcharge: 0, fbPrice1_7: 25, fbPrice8_23: 20, fbPrice24_47: 16, fbPrice48_71: 14, fbPrice72plus: 12 }],
                },
                222: {
                    company: 'ACME', designName: 'Small Cap Logo',
                    maxStitchCount: 5000, maxStitchTier: 'Standard', maxAsSurcharge: 0,
                    hasFBPricing: false,
                    variants: [{ stitchCount: 5000, stitchTier: 'Standard', asSurcharge: 0 }],
                },
            },
        },
    };
}

describe('renderSprEmbConfigSection (pre-split behavior lock)', () => {
    test('multi-design: banner rows + selects, smart defaults, deferred auto-tier + FB pricing', async () => {
        mountSprDom();
        const opts = makeTwoDesignOptions();
        renderSprEmbConfigSection(opts);

        // banner rendered with one assignment select per design
        const banner = document.getElementById('spr-design-info-banner');
        expect(banner.style.display).toBe('');
        const selects = banner.querySelectorAll('.spr-design-assign');
        expect(selects.length).toBe(2);
        // smart defaults: highest stitches → garment, next → cap
        expect(document.getElementById('spr-design-assign-111').value).toBe('garment');
        expect(document.getElementById('spr-design-assign-222').value).toBe('cap');
        // stitch badges rendered
        expect(banner.innerHTML).toContain('30,000 stitches');
        expect(banner.innerHTML).toContain('Full Back');

        // the recalc is DEFERRED (setTimeout 0) — before it, apply used defaults
        await flushTimers();
        expect(document.getElementById('spr-garment-stitch-tier').value).toBe('25000');
        expect(document.getElementById('spr-garment-position').value).toBe('Full Back');
        expect(document.getElementById('spr-cap-stitch-tier').value).toBe('8000');
        // FB price tiers pulled from the ASSIGNED design's variants
        expect(opts.fbPriceTiers).toEqual({
            fbPrice1_7: 25, fbPrice8_23: 20, fbPrice24_47: 16, fbPrice48_71: 14, fbPrice72plus: 12,
        });
        expect(opts._garmentDesignNum).toBe('111');
        expect(opts._capDesignNum).toBe('222');
    });

    test('reassignment via change listener re-derives tiers + assignments', async () => {
        mountSprDom();
        const opts = makeTwoDesignOptions();
        renderSprEmbConfigSection(opts);
        await flushTimers();

        // swap: small design → garment, big design → cap
        const sel111 = document.getElementById('spr-design-assign-111');
        const sel222 = document.getElementById('spr-design-assign-222');
        sel111.value = 'cap';
        sel111.dispatchEvent(new Event('change', { bubbles: true }));
        sel222.value = 'garment';
        sel222.dispatchEvent(new Event('change', { bubbles: true }));

        expect(opts._garmentDesignNum).toBe('222');
        expect(opts._capDesignNum).toBe('111');
        // garment now from the 5,000-stitch design → base tier + Left Chest, FB cleared
        expect(document.getElementById('spr-garment-stitch-tier').value).toBe('8000');
        expect(document.getElementById('spr-garment-position').value).toBe('Left Chest');
        expect(opts.fbPriceTiers).toBeNull();
        // cap now from the 30,000-stitch design (min variant 30000 → '25000')
        expect(document.getElementById('spr-cap-stitch-tier').value).toBe('25000');
    });

    test('single design: synchronous auto-tier, both assignments point at it', () => {
        mountSprDom();
        const opts = makeTwoDesignOptions();
        opts.designNumbersRaw = ['111'];
        opts.designNumbers = ['Design #111 — Big Jacket Back'];
        delete opts.designLookup.designs[222];
        renderSprEmbConfigSection(opts);

        // no assignment selects for a single design
        expect(document.querySelectorAll('.spr-design-assign').length).toBe(0);
        // synchronous path: tier + FB position set immediately, FB tiers from lookup
        expect(document.getElementById('spr-garment-stitch-tier').value).toBe('25000');
        expect(document.getElementById('spr-garment-position').value).toBe('Full Back');
        expect(opts.fbPriceTiers).toEqual(expect.objectContaining({ fbPrice1_7: 25 }));
        expect(opts._garmentDesignNum).toBe('111');
        expect(opts._capDesignNum).toBe('111');
    });

    test('designInfo fallback banner; falsy options hide the section', () => {
        mountSprDom();
        renderSprEmbConfigSection({
            hasGarments: true, hasCaps: false, totalQty: 24,
            designNumbersRaw: [], designNumbers: [], designLookup: null,
            designInfo: 'Design 999 — from paste text',
        });
        const banner = document.getElementById('spr-design-info-banner');
        expect(banner.style.display).toBe('');
        expect(banner.textContent).toContain('Design 999');

        renderSprEmbConfigSection(null);
        expect(document.getElementById('spr-embconfig-section').style.display).toBe('none');
    });

    test('LTM row: qty ≤ 7 shows it; allProductsHaveSwPrice unchecks with hint', () => {
        mountSprDom();
        const opts = makeTwoDesignOptions();
        opts.totalQty = 5;
        opts.allProductsHaveSwPrice = true;
        renderSprEmbConfigSection(opts);
        expect(document.getElementById('spr-ltm-row').style.display).toBe('');
        expect(document.getElementById('spr-ltm-enabled').checked).toBe(false);
        expect(document.getElementById('spr-ltm-hint').textContent).toContain('ShopWorks');

        mountSprDom();
        const opts2 = makeTwoDesignOptions();
        opts2.totalQty = 24;
        renderSprEmbConfigSection(opts2);
        expect(document.getElementById('spr-ltm-row').style.display).toBe('none');
    });
});
