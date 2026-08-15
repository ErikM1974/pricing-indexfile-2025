/**
 * Manual (unpriced) vendor item — jsdom behaviour lock (2026-08-15, Erik).
 *
 * Reps quote garments from vendors whose pricing we don't carry (S&S Activewear,
 * Alphabroder, one-off suppliers). They type the style, colour, description and the
 * unit cost we pay; the line prices through the SAME engine a SanMar garment uses.
 *
 * THE defining property: **nothing is written to Caspio.** The first cut of this
 * feature required registering the product in Non_SanMar_Products before it could be
 * quoted, which is friction for an item we will never quote again. If a future change
 * reintroduces a persist-on-add, the "no network" test below fails.
 *
 * The second property: a manual row must be INDISTINGUISHABLE downstream from a
 * catalogued vendor row — same dataset contract — so pricing, save, print, ShopWorks
 * push and reload all treat them identically with no special-casing.
 */
const path = require('path');

// product-rows.js declares its page collaborators as /* global */s, and applyManualItem
// ends by calling the REAL bundled recalculatePricing (which pulls in pricing-sync's own
// globals). Stub them all as no-ops BEFORE requiring the bundle — an undefined one throws
// asynchronously inside the recalc and takes the worker down rather than failing a test.
[
    'renderOrderRecap', 'productThumbnailModal', 'cleanProductTitle', 'getSwatchStyle', 'formatPrice',
    'parseRatePercent', 'getLtmControlState', 'setLtmControlState',
    'updateQuantityNudge', 'renderLtmControlPanel', 'initLtmControlListeners',
    'renderShipToCard', 'updatePerUnitPrice', 'updateNotesBadge',
].forEach((name) => { if (typeof globalThis[name] === 'undefined') globalThis[name] = () => {}; });
// These are OBJECTS, not functions — the code feature-detects with `typeof !== "undefined"`
// and then calls a method, so a bare no-op function throws.
globalThis.QuoteOrderSummary = { configure: () => {}, render: () => {}, renderShipTo: () => {} };
// isFlatHeadwear false → cap detection falls back to the style/title keyword rules,
// which is the behaviour we actually want to assert.
globalThis.ProductCategoryFilter = { isFlatHeadwear: () => false, isCap: () => false };
globalThis.SKUValidationService = { validate: () => ({ valid: true }) };
// A DECORATOR, not a hook: pricing-sync rebinds `recalculatePricing` to whatever this
// returns. A no-op returning undefined wipes the function entirely.
globalThis.wrapWithRepricingIndicator = (fn) => fn;
globalThis.SIZE_TO_SUFFIX = globalThis.SIZE_TO_SUFFIX || {};
globalThis.EXTENDED_SIZE_ORDER = globalThis.EXTENDED_SIZE_ORDER || [];
globalThis.escapeHtml = (s) => String(s == null ? '' : s);
globalThis.showToast = () => {};
globalThis.markAsUnsaved = () => {};

const { stampManualItem } = require(path.join(__dirname, '.bundles', 'emb-product-rows.cjs'));

/** Minimal product row matching the builder's real markup contract. */
function mountRow() {
    document.body.innerHTML = `
        <table><tbody id="product-tbody">
          <tr id="row-1" data-row-id="1">
            <td><input class="style-input" value="SS-ZZ9910">
                <span id="cap-badge-1" style="display:none"></span></td>
            <td><input data-field="description" value="">
                <div class="btn-add-nonsanmar-block"><button class="btn-add-nonsanmar">Enter manually</button></div>
            </td>
            <td><div class="color-picker-wrapper">
                  <div class="color-picker-selected disabled">
                    <span class="color-swatch empty"></span><span class="color-name placeholder">Choose</span>
                  </div>
                  <div class="color-picker-dropdown"></div>
                </div></td>
            <td><button class="btn-duplicate-row" disabled></button></td>
          </tr>
        </tbody></table>`;
    window.showToast = () => {};
    window.markAsUnsaved = () => {};
    window.recalculatePricing = () => {};
    return document.getElementById('row-1');
}

/** stampManualItem is the pure DOM half — no recalc, no toast, no page needed. */
const apply = (row, rowId, data) => stampManualItem(row, rowId, data);

const item = (over = {}) => ({
    style: 'SS-ZZ9910',
    description: 'Bella+Canvas Unisex Jersey Tee',
    color: 'Navy',
    cost: 8.42,
    sizes: '',
    ...over,
});

beforeEach(mountRow);

describe('the row is stamped for cost-plus pricing', () => {
    test('blankCost carries the typed cost — that is what the engine prices from', () => {
        const row = document.getElementById('row-1');
        apply(row, 1, item());
        expect(row.dataset.blankCost).toBe('8.42');
        expect(row.dataset.nsPricingMode).toBe('costPlus');
        expect(row.dataset.nonSanmar).toBe('true');
    });

    test('NO sellPrice is stamped — a cost-plus row is engine-priced, never typed', () => {
        // The bug this guards: writing a phantom sellPrice made Margin-mode products
        // show a $0.00 cell and blocked the save gate.
        const row = document.getElementById('row-1');
        apply(row, 1, item());
        expect(row.dataset.sellPrice).toBeUndefined();
    });

    test('manualItem marks it as typed-once, distinct from a catalogued vendor row', () => {
        const row = document.getElementById('row-1');
        apply(row, 1, item());
        expect(row.dataset.manualItem).toBe('true');
    });

    test('description and colour land where the rest of the app reads them', () => {
        const row = document.getElementById('row-1');
        apply(row, 1, item());
        expect(row.querySelector('[data-field="description"]').value).toBe('Bella+Canvas Unisex Jersey Tee');
        expect(row.dataset.productName).toBe('Bella+Canvas Unisex Jersey Tee');
        expect(row.dataset.color).toBe('Navy');
        // CATALOG_COLOR drives inventory + the ShopWorks line; for a manual item the
        // typed value IS the catalog colour — there is no SanMar colour list to map to.
        expect(row.dataset.catalogColor).toBe('Navy');
    });

    test('a description-less item still labels itself with the style', () => {
        const row = document.getElementById('row-1');
        apply(row, 1, item({ description: '' }));
        expect(row.dataset.productName).toBe('SS-ZZ9910');
    });

    test('the not-found affordance is cleared once the item is entered', () => {
        const row = document.getElementById('row-1');
        row.dataset.notFound = 'true';
        apply(row, 1, item());
        expect(row.dataset.notFound).toBeUndefined();
        expect(row.querySelector('.btn-add-nonsanmar-block')).toBeNull();
        expect(row.querySelector('.btn-duplicate-row').disabled).toBe(false);
    });

    test('the badge says Manual and names the cost, so a rep can explain the price', () => {
        const row = document.getElementById('row-1');
        apply(row, 1, item());
        const badge = row.querySelector('.non-sanmar-badge');
        expect(badge.textContent).toBe('Manual');
        expect(badge.title).toContain('8.42');
    });

    test('size upcharges fall back to the shared Caspio ladder', () => {
        // A one-off item has no per-style upcharge columns, so 2XL/3XL must pick up
        // the standard ladder rather than silently pricing with no upcharge.
        const row = document.getElementById('row-1');
        apply(row, 1, item());
        expect(JSON.parse(row.dataset.sizeUpchargeOverrides)).toEqual({});
    });
});

describe('nothing is persisted', () => {
    test('applying a manual item makes NO network call', async () => {
        // The property that defines this feature. If someone reintroduces a
        // persist-on-add, this fails.
        const spy = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
        const real = window.fetch;
        window.fetch = spy;
        try {
            apply(document.getElementById('row-1'), 1, item());
            await new Promise(r => setTimeout(r, 50));
            expect(spy).not.toHaveBeenCalled();
        } finally {
            window.fetch = real;
        }
    });
});

describe('cap vs garment', () => {
    test('a cap style is detected and gets cap sizing', () => {
        const row = document.getElementById('row-1');
        apply(row, 1, item({ style: 'RICH-112', description: 'Richardson Trucker Cap' }));
        expect(row.dataset.isCap).toBe('true');
    });

    test('a tee is treated as a garment', () => {
        const row = document.getElementById('row-1');
        apply(row, 1, item());
        expect(row.dataset.isCap).toBe('false');
    });
});
