/**
 * Cap vs garment in the builders' DOM paths — jsdom behaviour lock (Erik 2026-09-16).
 *
 *   • EMB + SCP onStyleChange classify with everything /api/product-colors carries
 *     (SUBCATEGORY_NAME, PRODUCT_DESCRIPTION, productTitle) through the shared rule.
 *   • The ShopWorks import maps cap sizes from the ROW's cap flag only — no second guess.
 *   • DTF search hides caps by the shared rule on the suggestion label.
 *   • A reopened EMB quote whose prices moved shows a visible notice, and says
 *     "now priced as a garment/cap" only when the saved quote proves the old side.
 */
const fs = require('fs');
const path = require('path');

// Page collaborators the bundles read as bare globals (same stubs as emb-manual-item).
[
    'renderOrderRecap', 'productThumbnailModal', 'formatPrice',
    'parseRatePercent', 'getLtmControlState', 'setLtmControlState',
    'updateQuantityNudge', 'renderLtmControlPanel', 'initLtmControlListeners',
    'renderShipToCard', 'updatePerUnitPrice', 'updateNotesBadge', 'markScreenPrintDirty',
    'reorderRowByProductType', 'updateArtworkCharges',
].forEach((name) => { if (typeof globalThis[name] === 'undefined') globalThis[name] = () => {}; });
globalThis.QuoteOrderSummary = { configure: () => {}, render: () => {}, renderShipTo: () => {} };
globalThis.SKUValidationService = { validate: () => ({ valid: true }) };
globalThis.wrapWithRepricingIndicator = (fn) => fn;
globalThis.SIZE_TO_SUFFIX = globalThis.SIZE_TO_SUFFIX || {};
globalThis.EXTENDED_SIZE_ORDER = globalThis.EXTENDED_SIZE_ORDER || [];
globalThis.escapeHtml = (s) => String(s == null ? '' : s);
globalThis.cleanProductTitle = (title, style) => String(title || '').replace(new RegExp(`^${style}\\s*-\\s*`), '');
globalThis.getSwatchStyle = () => '';
globalThis.markAsUnsaved = () => {};
globalThis.recalculatePricing = () => {};
const toasts = [];
const recordToast = (message, type) => toasts.push({ message, type });
globalThis.showToast = recordToast;
// Extended/cap sizes land in child rows — record where the import sends each size.
const childRows = [];
globalThis.createOrUpdateExtendedChildRow = (rowId, size, qty) => childRows.push([size, qty]);

// The real shared rule, loaded before the bundles exactly like the pages do.
require('../../shared_components/js/headwear-classifier.js');
const { rows } = require('../fixtures/headwear-classifier-rows.json');

const bundle = (name) => require(path.join(__dirname, '.bundles', name));
const emb = bundle('emb-product-rows.cjs');
const scp = bundle('scp-product-rows.cjs');
const embImport = bundle('emb-shopworks-import.cjs');
const embPersistence = bundle('emb-persistence.cjs');

const fixtureRow = (style) => rows.find(r => r.row.STYLE === style).row;

/** Stub /api/stylesearch + /api/product-colors with the live shapes for one catalog row. */
function mockCatalog(row) {
    const calls = [];
    window.fetch = global.fetch = jest.fn((url) => {
        calls.push(String(url));
        const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
        if (String(url).includes('/api/stylesearch')) {
            return ok([{ value: row.STYLE, label: `${row.STYLE} - ${row.PRODUCT_TITLE}` }]);
        }
        if (String(url).includes('/api/product-colors')) {
            return ok({
                styleNumber: row.STYLE,
                productTitle: row.PRODUCT_TITLE,
                PRODUCT_TITLE: row.PRODUCT_TITLE,
                CATEGORY_NAME: row.CATEGORY_NAME,
                SUBCATEGORY_NAME: row.SUBCATEGORY_NAME,
                PRODUCT_DESCRIPTION: row.PRODUCT_DESCRIPTION,
                colors: [{ COLOR_NAME: 'Black', CATALOG_COLOR: 'Black', HEX_CODE: '#000000' }],
            });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    });
    return calls;
}

function mountRow() {
    document.body.innerHTML = `
        <table id="product-table"><tbody id="product-tbody">
          <tr id="row-1" data-row-id="1">
            <td><input class="style-input" value=""><span id="cap-badge-1" style="display:none"></span></td>
            <td><input data-field="description" value=""></td>
            <td><div class="color-picker-wrapper">
                  <div class="color-picker-selected disabled"><span class="color-swatch empty"></span><span class="color-name placeholder">Choose</span></div>
                  <div class="color-picker-dropdown"></div>
                </div></td>
            <td><button class="btn-duplicate-row" disabled></button></td>
          </tr>
        </tbody></table>`;
    return document.getElementById('row-1');
}

beforeEach(() => { toasts.length = 0; childRows.length = 0; });

describe.each([
    ['EMB', emb],
    ['SCP', scp],
])('%s onStyleChange uses the shared rule with the product-colors details', (_name, mod) => {
    // productCache is per module; unique style numbers per test keep the lookups fresh.
    test.each([
        ['112WH', 'true'],    // blank category — only the description says cap
        ['CP90', 'false'],    // Caps / Fleece/Beanies — flat, garment pricing
        ['C916', 'false'],    // Caps headband — flat
        ['CT102368', 'false'], // Caps-category duck hood — flat
        ['NEA100', 'false'],  // New Era tee — garment
        ['STC57', 'true'],    // visor — cap
        ['173', 'true'],      // Richardson with no signal but the style + description
    ])('%s → data-is-cap=%s', async (style, isCap) => {
        const row = mountRow();
        const input = row.querySelector('.style-input');
        input.value = style;
        const calls = mockCatalog(fixtureRow(style) || { STYLE: style, PRODUCT_TITLE: 'Richardson Hood River 173', CATEGORY_NAME: '', SUBCATEGORY_NAME: '', PRODUCT_DESCRIPTION: 'Pre-curved visor.' });
        await mod.onStyleChange(input, 1);
        expect(calls.some(u => u.includes('/api/product-colors'))).toBe(true);
        expect(row.dataset.isCap).toBe(isCap);
        expect(toasts.filter(t => t.type === 'error')).toEqual([]);
    });
});

describe('ShopWorks import: cap size mapping trusts the row flag only', () => {
    function mountImportRow(isCap) {
        document.body.innerHTML = `
            <table><tbody id="product-tbody">
              <tr id="row-7" data-row-id="7" ${isCap === null ? '' : `data-is-cap="${isCap}"`}>
                <td><span id="row-qty-7"></span></td>
                ${['S', 'M', 'L', 'XL', 'S/M', 'M/L', 'L/XL'].map(s => `<td><input class="size-input" data-size="${s}" value=""></td>`).join('')}
              </tr>
            </tbody></table>`;
        return document.getElementById('row-7');
    }
    // Where each imported size went: a parent input or a child row.
    const sizes = (row) => ({
        inputs: Object.fromEntries([...row.querySelectorAll('.size-input')].filter(i => i.value).map(i => [i.dataset.size, i.value])),
        children: Object.fromEntries(childRows),
    });

    test('a garment row keeps S/M/L even when the ShopWorks text says "Cap"', () => {
        const row = mountImportRow('false');
        embImport.applyImportedSizes(row, 7, { partNumber: 'C112', description: 'Port Authority Snapback Trucker Cap', sizes: { S: 2, M: 3 } }, 0, null);
        expect(sizes(row)).toEqual({ inputs: { S: '2', M: '3' }, children: {} });
    });

    test('a row with no cap flag is not re-guessed from the text', () => {
        const row = mountImportRow(null);
        embImport.applyImportedSizes(row, 7, { partNumber: '112', description: 'Richardson Trucker Cap', sizes: { L: 4 } }, 0, null);
        expect(sizes(row)).toEqual({ inputs: { L: '4' }, children: {} });
    });

    test('a cap row maps S/M/L onto the cap sizes, whatever the text says', () => {
        const row = mountImportRow('true');
        embImport.applyImportedSizes(row, 7, { partNumber: 'X1', description: 'Plain text', sizes: { S: 1, L: 5 } }, 0, null);
        const placed = sizes(row);
        expect({ ...placed.inputs, ...placed.children }).toEqual({ 'S/M': expect.anything(), 'L/XL': expect.anything() });
        expect(Number(placed.inputs['S/M'] || placed.children['S/M'])).toBe(1);
        expect(Number(placed.inputs['L/XL'] || placed.children['L/XL'])).toBe(5);
    });

    test('a vendor product filed from a ShopWorks description gets a headwear category only for headwear', () => {
        expect(emb.parseShopWorksDescription('Richardson Trucker Cap 112, Black', '112').category).toBe('Caps');
        expect(emb.parseShopWorksDescription('Port Authority Knit Beanie, Navy', 'CP90').category).toBe('Caps');
        expect(emb.parseShopWorksDescription('Duck Trucker Jacket, Brown', 'J1').category).toBe('Outerwear');
        expect(emb.parseShopWorksDescription("Women's Cap Sleeve Tee, White", 'LT1').category).toBe('T-Shirts');
    });
});

describe('DTF search hides caps by the shared rule', () => {
    let DTFQuoteProducts;
    beforeAll(() => {
        const src = fs.readFileSync(path.join(__dirname, '../../shared_components/js/dtf-quote-products.js'), 'utf8');
        window.APP_CONFIG = window.APP_CONFIG || { API: { BASE_URL: 'http://test.invalid/api-base' } };
        window.DTFQuotePricing = function DTFQuotePricing() {};
        DTFQuoteProducts = new Function(`${src}\nreturn DTFQuoteProducts;`)();
    });
    const label = (style) => { const r = fixtureRow(style); return { value: r.STYLE, label: `${r.STYLE} - ${r.PRODUCT_TITLE}` }; };

    test('the ExactMatchSearch filter drops caps and keeps garments and flat headwear', () => {
        let config;
        window.ExactMatchSearch = function ExactMatchSearch(c) { config = c; };
        const manager = new DTFQuoteProducts();
        expect(manager.initializeExactMatchSearch(() => {}, () => {})).toBe(true);
        const keep = (style) => config.filterFunction(label(style));
        expect(keep('C112')).toBe(false);
        expect(keep('112FPR')).toBe(false);    // Richardson five-panel: was shown before
        expect(keep('STC57')).toBe(false);     // visor
        expect(keep('PC54')).toBe(true);
        expect(keep('MM3032')).toBe(true);     // "Capital" blazer: was hidden before
        expect(keep('CP90')).toBe(true);       // flat headwear stays searchable, as before
        expect(config.filterFunction({ value: 'X', label: 'X - Sport-Tek Fitted Tee' })).toBe(true);
        expect(config.filterFunction({ value: 'Y', label: 'Y - Baseball Tee' })).toBe(true);
    });

    test('the legacy search filters the same way', async () => {
        window.fetch = global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(['C112', 'PC54', 'MM3032'].map(label)) }));
        const found = await new DTFQuoteProducts().searchProducts('PC');
        expect(found.map(p => p.value).sort()).toEqual(['MM3032', 'PC54']);
    });

    test('a missing classifier is a visible error, not a keyword guess', async () => {
        const saved = window.HeadwearClassifier;
        const shown = [];
        globalThis.showToast = (message, type) => shown.push(type);
        delete window.HeadwearClassifier;
        try {
            expect(() => new DTFQuoteProducts().isCapSuggestion(label('C112'))).toThrow(/cap\/garment check did not load/);
            window.fetch = global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([label('C112')]) }));
            expect(await new DTFQuoteProducts().searchProducts('C1')).toEqual([]);
            expect(shown).toEqual(['error', 'error']);
        } finally {
            window.HeadwearClassifier = saved;
            globalThis.showToast = recordToast;
        }
    });
});

describe('reopened EMB quote: price change notice', () => {
    const line = (over) => ({ EmbellishmentType: 'embroidery', Color: 'Black', LineNumber: 1, Quantity: 12, FinalUnitPrice: 15, ...over });
    const pricingFor = (entries) => ({
        products: entries.map(([style, isCap, unit, qty = 12, color = 'Black']) => ({
            product: { style, color, isCap },
            lineItems: [{ quantity: qty, unitPrice: unit }],
        })),
    });

    test('the saved side comes from ALGarmentQty/ALCapQty and the garments-first line order', () => {
        const items = [
            line({ StyleNumber: 'PC54', LineNumber: 1, Quantity: 12 }),
            line({ StyleNumber: 'PC54', LineNumber: 2, Quantity: 2, FinalUnitPrice: 17 }),
            line({ StyleNumber: 'CP90', LineNumber: 3, Quantity: 6 }),
            line({ StyleNumber: 'C112', LineNumber: 4, Quantity: 6 }),
            { EmbellishmentType: 'fee', StyleNumber: 'TAX', LineNumber: 5, Quantity: 1 },
            line({ StyleNumber: 'AL', EmbellishmentType: 'embroidery-additional', LineNumber: 6 }),
        ];
        const groups = embPersistence.savedProductGroups({ ALGarmentQty: 14, ALCapQty: 12 }, items);
        expect([...groups.keys()]).toEqual(['PC54|Black', 'CP90|Black', 'C112|Black']);
        expect(groups.get('PC54|Black').savedCap).toBe(false);
        expect(groups.get('CP90|Black').savedCap).toBe(true);
        expect(groups.get('C112|Black').savedCap).toBe(true);
        // Items arriving out of order are read in LineNumber order.
        const shuffled = embPersistence.savedProductGroups({ ALGarmentQty: 14, ALCapQty: 12 }, [items[3], items[2], items[1], items[0]]);
        expect(shuffled.get('CP90|Black').savedCap).toBe(true);
    });

    test('no proof → no side (counts missing, not adding up, or a line straddling the split)', () => {
        const items = [line({ StyleNumber: 'CP90', Quantity: 12 })];
        expect(embPersistence.savedProductGroups({}, items).get('CP90|Black').savedCap).toBeNull();
        expect(embPersistence.savedProductGroups({ ALGarmentQty: '', ALCapQty: '' }, items).get('CP90|Black').savedCap).toBeNull();
        expect(embPersistence.savedProductGroups({ ALGarmentQty: 0, ALCapQty: 24 }, items).get('CP90|Black').savedCap).toBeNull();
        expect(embPersistence.savedProductGroups({ ALGarmentQty: 6, ALCapQty: 6 }, items).get('CP90|Black').savedCap).toBeNull();
    });

    test('says "now priced as a garment" only when the old side is proven', () => {
        const items = [line({ StyleNumber: 'CP90', Quantity: 12, FinalUnitPrice: 15 })];
        const now = pricingFor([['CP90', false, 12.5]]);
        expect(embPersistence.describeRepricedProducts(embPersistence.savedProductGroups({ ALGarmentQty: 0, ALCapQty: 12 }, items), now))
            .toEqual(['CP90 is now priced as a garment ($15.00 → $12.50)']);
        expect(embPersistence.describeRepricedProducts(embPersistence.savedProductGroups({}, items), now))
            .toEqual(['CP90: $15.00 → $12.50']);
    });

    test('a cap that became a cap stays quiet about the side; unchanged products are not listed', () => {
        const items = [
            line({ StyleNumber: 'PC54', LineNumber: 1, Quantity: 12, FinalUnitPrice: 10 }),
            line({ StyleNumber: 'VISOR1', LineNumber: 2, Quantity: 12, FinalUnitPrice: 14 }),
        ];
        const saved = embPersistence.savedProductGroups({ ALGarmentQty: 24, ALCapQty: 0 }, items);
        expect(embPersistence.describeRepricedProducts(saved, pricingFor([['PC54', false, 10], ['VISOR1', true, 16]])))
            .toEqual(['VISOR1 is now priced as a cap ($14.00 → $16.00)']);
        expect(embPersistence.describeRepricedProducts(saved, pricingFor([['PC54', false, 10], ['VISOR1', false, 14]]))).toEqual([]);
    });

    test('an upcharge-only move shows the average; a missing product is called out; colours disambiguate', () => {
        const items = [
            line({ StyleNumber: 'PC54', LineNumber: 1, Quantity: 10, FinalUnitPrice: 10 }),
            line({ StyleNumber: 'PC54', LineNumber: 2, Quantity: 2, FinalUnitPrice: 12 }),
            line({ StyleNumber: 'PC54', Color: 'Navy', LineNumber: 3, Quantity: 12, FinalUnitPrice: 10 }),
        ];
        const saved = embPersistence.savedProductGroups({ ALGarmentQty: 24, ALCapQty: 0 }, items);
        const now = { products: [{ product: { style: 'PC54', color: 'Black', isCap: false }, lineItems: [{ quantity: 10, unitPrice: 10 }, { quantity: 2, unitPrice: 13, unitPriceWithLTM: 13 }] }] };
        expect(embPersistence.describeRepricedProducts(saved, now)).toEqual([
            'PC54 Black: average $10.33 → $10.50',
            'PC54 Navy could not be repriced — check that line before saving',
        ]);
    });

    test('the unit a save would write is compared (LTM included, save rounding)', () => {
        const items = [line({ StyleNumber: 'PC54', Quantity: 3, FinalUnitPrice: 36.67 })];
        const saved = embPersistence.savedProductGroups({ ALGarmentQty: 3, ALCapQty: 0 }, items);
        const now = { products: [{ product: { style: 'PC54', color: 'Black', isCap: false }, lineItems: [{ quantity: 3, unitPrice: 20, unitPriceWithLTM: 36.666666 }] }] };
        expect(embPersistence.describeRepricedProducts(saved, now)).toEqual([]);
    });

    test('the notice is a persistent, dismissible banner above the products, text only', () => {
        document.body.innerHTML = '<main><div class="product-table-wrapper"><table id="product-table"></table></div></main>';
        const banner = embPersistence.showRepricedNotice(['CP90 is now priced as a garment ($15.00 → $12.50)', '<img src=x>: $1.00 → $2.00']);
        expect(banner.id).toBe('reopen-price-notice');
        expect(banner.className).toBe('import-summary-banner banner-warning');
        expect(banner.getAttribute('role')).toBe('status');
        expect(banner.nextElementSibling.className).toBe('product-table-wrapper');
        expect(banner.querySelector('.banner-title').textContent).toBe('Prices changed from the saved quote');
        expect(banner.textContent).toContain('CP90 is now priced as a garment ($15.00 → $12.50)');
        expect(banner.querySelector('img')).toBeNull();
        expect(toasts.some(t => t.type === 'warning' && t.message.includes('CP90 is now priced as a garment'))).toBe(true);
        // One notice at a time; no changes → no notice.
        embPersistence.showRepricedNotice(['C112: $1.00 → $2.00']);
        expect(document.querySelectorAll('#reopen-price-notice')).toHaveLength(1);
        expect(embPersistence.showRepricedNotice([])).toBeNull();
        expect(document.getElementById('reopen-price-notice')).toBeNull();
        embPersistence.showRepricedNotice(['C112: $1.00 → $2.00']).querySelector('.btn-dismiss-banner').click();
        expect(document.getElementById('reopen-price-notice')).toBeNull();
    });
});
