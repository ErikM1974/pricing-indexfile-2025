/**
 * Product page (root /product.html) — cap vs garment embroidery comes from the
 * shared HeadwearClassifier, the one rule every price surface uses (Erik 2026-09-16).
 *
 *   isCap  → cap placements + cap embroidery only (no category rules asked)
 *   flat   → garment embroidery only, WITHOUT the category rules: the live "Caps"
 *            rule turns every method off, so asking it would leave no chips.
 *            The primary chip reads "Front", and a short note says why.
 *   other  → garment path gated by the category rules (DecorationMethods)
 *   module missing → visible pricing error, configurator never starts (Rule 4)
 *
 * Runs the real product-2026.js + pdp-configurator.js against the real
 * product.html body, with the catalog rows from the classifier's live fixture.
 * No engine is loaded, so method chips land in their error state — routing and
 * chip rendering are what is under test.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(REPO, 'product.html'), 'utf8');
const PAGE = path.join(REPO, 'product', 'js', 'product-2026.js');
const CONFIGURATOR = path.join(REPO, 'product', 'js', 'pdp-configurator.js');
const CLASSIFIER = path.join(REPO, 'shared_components', 'js', 'headwear-classifier.js');
const { rows } = require('../fixtures/headwear-classifier-rows.json');

function catalogRow(style) {
    const hit = rows.find(function (r) { return r.row.STYLE === style; });
    if (!hit) throw new Error('No fixture row for ' + style);
    return hit.row;
}

/** Two colors of one product, shaped like /api/product-details. */
function detailRows(row) {
    return ['Black', 'Navy'].map(function (color) {
        return Object.assign({}, row, {
            BRAND_NAME: 'Test Brand',
            PRODUCT_STATUS: 'Active',
            CATALOG_COLOR: color,
            COLOR_NAME: color,
            COLOR_SQUARE_IMAGE: '',
            FRONT_MODEL: '',
            PRODUCT_IMAGE: ''
        });
    });
}

// The live "Caps" rule lists no garment methods; T-Shirts allow all four.
function rulesFor(product) {
    if (product.CATEGORY_NAME === 'Caps') return { EMB: false, DTG: 'no', SCP: false, DTF: false, source: 'rules' };
    return { EMB: true, DTG: 'yes', SCP: true, DTF: true, source: 'rules' };
}

function bodyMarkup() {
    const open = HTML.indexOf('>', HTML.indexOf('<body')) + 1;
    const close = HTML.lastIndexOf('</body>');
    expect(open).toBeGreaterThan(0);
    expect(close).toBeGreaterThan(open);
    return HTML.slice(open, close);
}

async function until(check, label) {
    const started = Date.now();
    while (!check()) {
        if (Date.now() - started > 3000) throw new Error('Timed out waiting for ' + label);
        await new Promise(function (resolve) { setTimeout(resolve, 5); });
    }
}

let initCalls;

/** Boot the page for one style; returns once pricing has been routed. */
async function openProduct(style, opts) {
    const options = opts || {};
    jest.resetModules();
    document.body.innerHTML = bodyMarkup();
    window.history.replaceState({}, '', '/product.html?style=' + encodeURIComponent(style));
    delete window.PdpConfigurator;
    delete window.HeadwearClassifier;

    const row = catalogRow(style);
    const fetchMock = jest.fn(function (url) {
        const u = new URL(String(url), 'http://localhost');
        if (u.pathname.endsWith('/api/product-details')) {
            return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(detailRows(row)); } });
        }
        if (u.pathname.indexOf('/api/sanmar/inventory/') !== -1) {
            return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ inventory: [] }); } });
        }
        return Promise.resolve({ ok: false, status: 503, json: function () { return Promise.resolve(null); } });
    });
    window.fetch = global.fetch = fetchMock;

    window.DecorationMethods = { eligibleFor: jest.fn(function (p) { return Promise.resolve(rulesFor(p)); }) };

    if (!options.withoutClassifier) require(CLASSIFIER);
    expect(!!window.HeadwearClassifier).toBe(!options.withoutClassifier);

    require(CONFIGURATOR);
    initCalls = [];
    const realInit = window.PdpConfigurator.init;
    window.PdpConfigurator.init = function (ctx) {
        initCalls.push(ctx);
        return realInit(ctx);
    };

    require(PAGE);
    await until(function () {
        return initCalls.length > 0 || /Unable to load live pricing/.test(document.getElementById('methodAlert').textContent);
    }, style + ' pricing route');
    return { row: row, eligibleFor: window.DecorationMethods.eligibleFor };
}

function methodIds() {
    return Array.from(document.querySelectorAll('#cfgMethods [data-method]')).map(function (b) { return b.dataset.method; });
}

function chips() {
    return Array.from(document.querySelectorAll('#cfgLocations [data-loc]')).map(function (b) {
        return { key: b.dataset.loc, label: b.querySelector('.pdp-cfg-chip-label').textContent };
    });
}

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(function () {});
    jest.spyOn(console, 'warn').mockImplementation(function () {});
});

afterEach(() => {
    jest.restoreAllMocks();
    delete window.DecorationMethods;
});

describe('flat headwear takes the garment path with embroidery only', () => {
    test.each(['CP90', 'C916'])('%s (Caps / Fleece-Beanies) → garment embroidery, no category rules', async (style) => {
        const { eligibleFor } = await openProduct(style);
        const ctx = initCalls[0];

        expect(ctx.isCap).toBe(false);
        expect(ctx.isFlat).toBe(true);
        expect(ctx.eligibility).toEqual({ EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'flat-headwear' });
        // The live Caps rule would switch every method off — it must not be asked.
        expect(eligibleFor).not.toHaveBeenCalled();

        expect(methodIds()).toEqual(['emb']);
        expect(document.getElementById('pdpConfigurator').hidden).toBe(false);
        // Same garment keys (same engine inputs), headwear words.
        expect(chips()).toEqual([
            { key: 'leftChest', label: 'Front' },
            { key: 'back', label: 'Back' },
            { key: 'frontBack', label: 'Front + back' }
        ]);
        expect(document.getElementById('cfgLocations').textContent).not.toContain('Left chest');
        expect(document.getElementById('flatHeadwearNote').textContent)
            .toContain('Beanies and other soft headwear are embroidered flat');
        expect(document.getElementById('methodAlert').querySelector('.alert')).toBeNull();

        const sel = window.PdpConfigurator.getSelection();
        expect(sel).toMatchObject({ locationKey: 'leftChest', locationLabel: 'Front', engineMethod: 'EMB', isCap: false });
        expect(document.getElementById('cfgInkRow').hidden).toBe(true);
    });
});

describe('caps take the cap path', () => {
    test.each([
        ['112FPR', 'blank category Richardson cap'],
        ['STC57', 'blank category visor'],
        ['YC914', 'Youth / Caps subcategory'],
        ['C112', 'Caps category']
    ])('%s (%s) → cap embroidery only', async (style) => {
        const { eligibleFor } = await openProduct(style);
        const ctx = initCalls[0];

        expect(ctx.isCap).toBe(true);
        expect(ctx.isFlat).toBe(false);
        expect(ctx.eligibility).toBeNull();
        expect(eligibleFor).not.toHaveBeenCalled();
        expect(methodIds()).toEqual(['capemb']);
        expect(chips().map(function (c) { return c.key; })).toEqual(['front', 'frontBack']);
        expect(document.getElementById('methodAlert').textContent.trim()).toBe('');
        expect(window.PdpConfigurator.getSelection()).toMatchObject({ engineMethod: 'CAP', isCap: true });
    });
});

describe('garments keep the category rules', () => {
    test('NEA100 (New Era tee, T-Shirts) → garment path gated by the rules', async () => {
        const { eligibleFor } = await openProduct('NEA100');
        const ctx = initCalls[0];

        expect(ctx.isCap).toBe(false);
        expect(ctx.isFlat).toBe(false);
        expect(eligibleFor).toHaveBeenCalledTimes(1);
        expect(eligibleFor.mock.calls[0][0]).toMatchObject({ CATEGORY_NAME: 'T-Shirts', styleNumber: 'NEA100' });
        expect(ctx.eligibility.source).toBe('rules');
        expect(methodIds()).toEqual(['emb', 'dtg', 'scp', 'dtf']);
        expect(chips()[0]).toEqual({ key: 'leftChest', label: 'Left chest' });
        expect(document.getElementById('flatHeadwearNote')).toBeNull();
    });
});

describe('a missing classifier is a visible error, never a guess', () => {
    test('no HeadwearClassifier → pricing error, configurator never starts', async () => {
        await openProduct('112FPR', { withoutClassifier: true });

        const alert = document.querySelector('#methodAlert .alert-error');
        expect(alert).not.toBeNull();
        expect(alert.getAttribute('role')).toBe('alert');
        expect(alert.textContent).toContain('Unable to load live pricing');
        expect(alert.textContent).toContain('253-922-5793');
        expect(initCalls).toEqual([]);
        expect(document.getElementById('pdpConfigurator').hidden).toBe(true);
        expect(document.getElementById('cfgAddToQuote').disabled).toBe(true);
        // The rest of the page still renders for the customer.
        expect(document.getElementById('pdpContent').hidden).toBe(false);
        expect(document.getElementById('productTitle').textContent).toContain('Richardson Five-Panel');
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('HeadwearClassifier module missing'));
    });
});

describe('product.html loads the shared classifier before the product scripts', () => {
    test('script order', () => {
        const at = function (src) {
            const i = HTML.indexOf('<script src="' + src);
            expect(i).toBeGreaterThan(-1);
            return i;
        };
        const classifier = at('/shared_components/js/headwear-classifier.js?v=');
        expect(classifier).toBeLessThan(at('/product/js/pdp-configurator.js'));
        expect(classifier).toBeLessThan(at('/product/js/product-2026.js'));
        expect(HTML).toMatch(/<script src="\/shared_components\/js\/headwear-classifier\.js\?v=[^"]+" defer><\/script>/);
    });
});
