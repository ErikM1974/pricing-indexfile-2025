/**
 * Cap vs garment in the builders' DOM paths — jsdom behaviour lock (Erik 2026-09-16).
 *
 *   • EMB + SCP onStyleChange classify with everything /api/product-colors carries
 *     (SUBCATEGORY_NAME, PRODUCT_DESCRIPTION, productTitle) through the shared rule.
 *   • The ShopWorks import maps cap sizes from the ROW's cap flag only — no second guess.
 *   • DTF search hides a row only when the old keyword rule AND the shared rule both call
 *     it a cap (nothing it listed before disappears), and an exact hidden style says why.
 *   • A ShopWorks vendor product is filed under Caps from the same text the import prices
 *     from, and loads on the same side every later time.
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

// The real shared rule (and, for DTF search, the old keyword rule), loaded before the
// bundles exactly like the pages do.
require('../../shared_components/js/headwear-classifier.js');
require('../../shared_components/js/product-category-filter.js');
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

    test('the cap word in the brand counts: the whole description is classified, as the import prices it', () => {
        expect(emb.parseShopWorksDescription('Pacific Headwear P747 Perforated, Black', 'P747'))
            .toEqual({ brand: 'Pacific Headwear', name: 'P747 Perforated', color: 'Black', category: 'Caps' });
        expect(emb.parseShopWorksDescription('Outdoor Cap OC771 Cotton Twill, Khaki', 'OC771'))
            .toEqual({ brand: 'Outdoor Cap', name: 'OC771 Cotton Twill', color: 'Khaki', category: 'Caps' });
        // The ShopWorks service prefix is not a cap word, same as the import's pricing.
        expect(emb.parseShopWorksDescription('Di. Embroider Cap - T-shirt', 'X9').category).toBe('T-Shirts');
    });

    // What forceImportAsNonSanmar prices from, and what populateNonSanmarRow reads back later
    // (the saved ProductName + Category) — the two must agree for every description.
    const DESCRIPTIONS = [
        ['Pacific Headwear P747 Perforated, Black', 'P747'],
        ['Outdoor Cap OC771 Cotton Twill, Khaki', 'OC771'],
        ['Richardson Trucker Cap 112, Black', '112'],
        ['Richardson Hood River 173, Black', '173'],   // a cap only by its style; "hood" is flat inside Caps
        ['Port Authority Knit Beanie, Navy', 'CP90'],
        ['Kitchen Skull Cap: Edwards, Black', 'SK1'],
        ['Duck Trucker Jacket, Brown', 'J1'],
        ["Women's Cap Sleeve Tee, White", 'LT1'],
        ['Di. Embroider Cap - T-shirt', 'X9'],
        ['Pacific Headwear Knit Headband, Grey', 'PH1'],
    ];
    test.each(DESCRIPTIONS)('%s keeps the side it was imported on when it loads again', (description, partNumber) => {
        const importedCap = emb.isCapProduct(partNumber, description);
        const parsed = emb.parseShopWorksDescription(description, partNumber);
        const saved = { StyleNumber: partNumber, ProductName: parsed.name || description, Category: parsed.category, DefaultColors: 'Black' };
        expect(emb.isCapProduct(saved.StyleNumber, saved.ProductName, saved.Category)).toBe(importedCap);
        const row = mountRow();
        emb.populateNonSanmarRow(row, 1, saved);
        expect(row.dataset.isCap).toBe(String(importedCap));
    });

    test('the Pacific Headwear and Outdoor Cap examples are caps on import and on every later load', () => {
        for (const [description, partNumber] of DESCRIPTIONS.slice(0, 2)) {
            expect(emb.isCapProduct(partNumber, description)).toBe(true);
            const parsed = emb.parseShopWorksDescription(description, partNumber);
            const row = mountRow();
            emb.populateNonSanmarRow(row, 1, { StyleNumber: partNumber, ProductName: parsed.name, Category: parsed.category, DefaultColors: 'Black' });
            expect(row.dataset.isCap).toBe('true');
        }
        // Hood River stays a cap because it is filed without a category.
        expect(emb.parseShopWorksDescription('Richardson Hood River 173, Black', '173').category).toBe('');
    });

    test('filing a vendor product without the shared rule is a visible error', () => {
        const saved = window.HeadwearClassifier;
        const shown = [];
        globalThis.showToast = (message, type) => shown.push(type);
        delete window.HeadwearClassifier;
        try {
            expect(() => emb.parseShopWorksDescription('Pacific Headwear P747 Perforated, Black', 'P747')).toThrow(/cap\/garment check did not load/);
            expect(shown).toEqual(['error']);
        } finally {
            window.HeadwearClassifier = saved;
            globalThis.showToast = recordToast;
        }
    });
});

describe('DTF search hides a row only when both cap rules agree', () => {
    let DTFQuoteProducts;
    let DTFQuoteBuilder;
    let RealExactMatchSearch;
    beforeAll(() => {
        const src = fs.readFileSync(path.join(__dirname, '../../shared_components/js/dtf-quote-products.js'), 'utf8');
        window.APP_CONFIG = window.APP_CONFIG || { API: { BASE_URL: 'http://test.invalid/api-base' } };
        window.DTFQuotePricing = function DTFQuotePricing() {};
        DTFQuoteProducts = new Function(`${src}\nreturn DTFQuoteProducts;`)();
        RealExactMatchSearch = require('../../shared_components/js/exact-match-search.js');
        ({ DTFQuoteBuilder } = bundle('dtf-quote-builder-class.cjs'));
    });
    const label = (style) => { const r = fixtureRow(style); return { value: r.STYLE, label: `${r.STYLE} - ${r.PRODUCT_TITLE}` }; };
    // The filter the search module is given, exactly as the page wires it.
    const searchFilter = () => {
        let config;
        window.ExactMatchSearch = function ExactMatchSearch(c) { config = c; };
        const manager = new DTFQuoteProducts();
        expect(manager.initializeExactMatchSearch(() => {}, () => {})).toBe(true);
        return config;
    };

    test('caps both rules agree on stay hidden; everything listed before stays listed', () => {
        const config = searchFilter();
        const keep = (style) => config.filterFunction(label(style));
        expect(keep('C112')).toBe(false);
        expect(keep('112')).toBe(false);
        expect(keep('STC57')).toBe(false);     // visor
        expect(keep('PC54')).toBe(true);
        expect(keep('CP90')).toBe(true);       // flat headwear stays searchable, as before
        // Listed before (the keyword rule never called them caps) — still listed.
        for (const style of ['C975', 'NKBFN6319', '810', '112FPR', '169']) expect([style, keep(style)]).toEqual([style, true]);
        // Hidden before by the keyword list, not caps by the shared rule — listed now.
        for (const style of ['MM3032', 'WW3040', 'HT01']) expect([style, keep(style)]).toEqual([style, true]);
        expect(config.filterFunction({ value: 'X', label: 'X - Sport-Tek Fitted Tee' })).toBe(true);
        expect(config.filterFunction({ value: 'Y', label: 'Y - Baseball Tee' })).toBe(true);
    });

    test('nothing the keyword rule listed is hidden now (every classifier fixture row)', () => {
        const config = searchFilter();
        let checked = 0;
        for (const { row } of rows) {
            const item = { value: row.STYLE, label: `${row.STYLE} - ${row.PRODUCT_TITLE}` };
            if (window.ProductCategoryFilter.isStructuredCap(item)) continue;
            expect([row.STYLE, config.filterFunction(item)]).toEqual([row.STYLE, true]);
            checked++;
        }
        expect(checked).toBeGreaterThan(10);
    });

    test('the legacy search filters the same way', async () => {
        window.fetch = global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(['C112', 'PC54', 'MM3032', '112FPR'].map(label)) }));
        const found = await new DTFQuoteProducts().searchProducts('PC');
        expect(found.map(p => p.value).sort()).toEqual(['112FPR', 'MM3032', 'PC54']);
    });

    test.each([
        ['HeadwearClassifier'],
        ['ProductCategoryFilter'],
    ])('a missing %s is a visible error, not a guess', async (name) => {
        const saved = window[name];
        const shown = [];
        globalThis.showToast = (message, type) => shown.push(type);
        delete window[name];
        try {
            expect(() => new DTFQuoteProducts().isCapSuggestion(label('C112'))).toThrow(/cap\/garment check did not load/);
            expect(() => new DTFQuoteProducts().isCapSuggestion(label('PC54'))).toThrow(/cap\/garment check did not load/);
            window.fetch = global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([label('C112')]) }));
            expect(await new DTFQuoteProducts().searchProducts('C1')).toEqual([]);
            expect(shown).toEqual(['error', 'error', 'error']);
        } finally {
            window[name] = saved;
            globalThis.showToast = recordToast;
        }
    });

    describe('the search box says why a hidden cap is missing', () => {
        const RESULTS = {
            C112: ['C112', 'STC57'],   // the exact style and another cap — all hidden
            C11: ['C112', '112'],      // only caps, none typed exactly
            ZZ: [],                    // nothing at all
            PC54: ['PC54'],
        };
        let builder;
        let searchCalls;
        const box = () => /** @type {HTMLInputElement} */ (document.getElementById('product-search'));
        const suggestions = () => document.getElementById('search-suggestions');
        const settle = () => new Promise(resolve => setTimeout(resolve, 0));
        async function search(text) {
            box().value = text;
            box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await settle();
            await settle();
        }

        beforeEach(() => {
            window.ExactMatchSearch = RealExactMatchSearch;
            document.body.innerHTML = `
                <div class="search-input-wrapper">
                  <input id="product-search" type="text">
                  <div id="search-suggestions" class="search-suggestions"></div>
                </div>`;
            searchCalls = [];
            window.fetch = global.fetch = jest.fn((url) => {
                const term = new URL(String(url)).searchParams.get('term');
                searchCalls.push(term);
                return Promise.resolve({ ok: true, json: () => Promise.resolve((RESULTS[term] || []).map(label)) });
            });
            builder = Object.assign(Object.create(DTFQuoteBuilder.prototype), {
                productsManager: new DTFQuoteProducts(),
                selectProduct: jest.fn(),
            });
            builder.setupSearchListeners();
        });

        test('an exact hidden style names itself', async () => {
            await search('c112');
            expect(suggestions().style.display).toBe('block');
            expect(suggestions().querySelector('.no-results').textContent).toBe('C112 is a cap — DTF search doesn’t list caps.');
            expect(builder.selectProduct).not.toHaveBeenCalled();
        });

        test('a repeat search (served from the search cache) still says why', async () => {
            await search('C112');
            await search('PC54');
            await search(' C112 ');
            expect(searchCalls).toEqual(['C112', 'PC54']);
            expect(suggestions().querySelector('.no-results').textContent).toBe('C112 is a cap — DTF search doesn’t list caps.');
        });

        test('only caps match, none typed exactly', async () => {
            await search('C11');
            expect(suggestions().querySelector('.no-results').textContent).toBe('Only caps match C11 — DTF search doesn’t list caps.');
        });

        test('no results at all is still "No products found"; a listed style still loads', async () => {
            await search('ZZ');
            expect(suggestions().querySelector('.no-results').textContent).toBe('No products found');
            await search('PC54');
            expect(builder.selectProduct).toHaveBeenCalledWith('PC54');
        });
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

    const TABLE = '<main><div class="product-table-wrapper" role="region" tabindex="0"><table id="product-table"></table></div><button id="elsewhere">x</button></main>';
    const filled = () => new Promise(resolve => setTimeout(resolve, 60));

    test('the notice is a persistent, dismissible banner above the products, text only', async () => {
        document.body.innerHTML = TABLE;
        const banner = embPersistence.showRepricedNotice(['CP90 is now priced as a garment ($15.00 → $12.50)', '<img src=x>: $1.00 → $2.00']);
        expect(banner.id).toBe('reopen-price-notice');
        expect(banner.className).toBe('alert alert-warn');   // the shared warning alert the builder page styles
        expect(banner.nextElementSibling.className).toBe('product-table-wrapper');
        await filled();
        expect(banner.querySelector('.banner-title').textContent).toBe('Prices changed from the saved quote');
        expect(banner.textContent).toContain('CP90 is now priced as a garment ($15.00 → $12.50)');
        expect(banner.textContent).toContain('The saved quote keeps its old prices until you save a revision.');
        expect(banner.querySelector('img')).toBeNull();
        expect(toasts).toContainEqual({ message: 'Prices changed from the saved quote — see the notice above the products.', type: 'warning' });
        // One notice at a time; no changes → no notice.
        embPersistence.showRepricedNotice(['C112: $1.00 → $2.00']);
        expect(document.querySelectorAll('#reopen-price-notice')).toHaveLength(1);
        expect(embPersistence.showRepricedNotice([])).toBeNull();
        expect(document.getElementById('reopen-price-notice')).toBeNull();
        embPersistence.showRepricedNotice(['C112: $1.00 → $2.00']).querySelector('.btn-dismiss-banner').click();
        expect(document.getElementById('reopen-price-notice')).toBeNull();
    });

    test('the text is announced: an empty polite live region goes in first and is filled after insertion', async () => {
        document.body.innerHTML = TABLE;
        const banner = embPersistence.showRepricedNotice(['CP90: $15.00 → $12.50']);
        expect(banner.hasAttribute('role')).toBe(false);
        const live = banner.querySelector('[aria-live]');
        expect(live.getAttribute('role')).toBe('status');
        expect(live.getAttribute('aria-live')).toBe('polite');
        expect(live.getAttribute('aria-atomic')).toBe('true');
        expect(live.isConnected).toBe(true);
        expect(live.textContent).toBe('');   // inserted empty…
        await filled();
        expect(live.querySelector('.banner-title').textContent).toBe('Prices changed from the saved quote');   // …then filled
        expect(live.textContent).toContain('CP90: $15.00 → $12.50');
        // Dismiss is not part of what is read out.
        expect(live.contains(banner.querySelector('.btn-dismiss-banner'))).toBe(false);
        // A notice removed before the fill never writes into the detached region.
        const gone = embPersistence.showRepricedNotice(['C112: $1.00 → $2.00']);
        embPersistence.clearRepricedNotice();
        await filled();
        expect(gone.querySelector('[aria-live]').textContent).toBe('');
    });

    test('a duplicated quote is worded as a new quote', async () => {
        document.body.innerHTML = TABLE;
        const banner = embPersistence.showRepricedNotice(['CP90: $15.00 → $12.50'], { forDuplicate: true });
        await filled();
        expect(banner.querySelector('.banner-title').textContent).toBe('Prices changed from the original quote');
        expect(banner.textContent).toContain('Saving creates a new quote at these prices.');
        expect(banner.textContent).not.toContain('save a revision');
        expect(toasts).toContainEqual({ message: 'Prices changed from the original quote — see the notice above the products.', type: 'warning' });
    });

    test('Dismiss moves keyboard focus to the product table, not <body>', () => {
        document.body.innerHTML = TABLE;
        const wrapper = document.querySelector('.product-table-wrapper');
        const dismiss = embPersistence.showRepricedNotice(['CP90: $15.00 → $12.50']).querySelector('.btn-dismiss-banner');
        dismiss.focus();
        expect(document.activeElement).toBe(dismiss);
        dismiss.click();
        expect(document.activeElement).toBe(wrapper);
        expect(wrapper.getAttribute('tabindex')).toBe('0');   // the page's own tab stop, unchanged
        // A click that never focused the button (Safari) leaves focus where it was.
        const elsewhere = document.getElementById('elsewhere');
        elsewhere.focus();
        embPersistence.showRepricedNotice(['CP90: $15.00 → $12.50']).querySelector('.btn-dismiss-banner').click();
        expect(document.activeElement).toBe(elsewhere);
    });

    test('with no scroll wrapper, the table itself takes focus', () => {
        document.body.innerHTML = '<table id="product-table"></table>';
        const dismiss = embPersistence.showRepricedNotice(['CP90: $15.00 → $12.50']).querySelector('.btn-dismiss-banner');
        dismiss.focus();
        dismiss.click();
        const table = document.getElementById('product-table');
        expect(document.activeElement).toBe(table);
        expect(table.getAttribute('tabindex')).toBe('-1');
    });
});
