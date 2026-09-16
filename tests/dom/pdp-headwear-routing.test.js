/**
 * Product page (root /product.html) — cap vs garment embroidery comes from the
 * shared HeadwearClassifier, the one rule every price surface uses (Erik 2026-09-16).
 *
 *   isCap  → cap placements + cap embroidery only (no category rules asked)
 *   flat   → garment embroidery with ONE placement, "Front" (leftChest key).
 *            Flat items listed under Caps (category or subcategory) are
 *            embroidery only WITHOUT the category rules: the live "Caps" rule
 *            turns every method off. A short note says why.
 *            Flat items anywhere else (FS07 gaiter in Personal Protection,
 *            headbands in Accessories, Workwear beanies/scrub caps) keep their
 *            category's rules — no new blocks on print methods.
 *   other  → garment path gated by the category rules (DecorationMethods)
 *   module missing → visible pricing error, configurator never starts (Rule 4)
 *
 * Also locked: the quote-conflict message names the placement with THIS page's
 * chip (a tee says "Left chest", never a beanie's "Front"), the add toast says
 * "View quote" for caps and one-size flat headwear, and the fallback meta
 * description lists embroidery only for caps and Caps-listed flat headwear.
 *
 * Runs the real product-2026.js + pdp-configurator.js against the real
 * product.html body, with the catalog rows from the classifier's live fixture.
 * No engine is loaded, so method chips land in their error state — routing and
 * chip rendering are what is under test; the add-to-quote cases stub a priced
 * selection on top of the real one.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(REPO, 'product.html'), 'utf8');
const PAGE = path.join(REPO, 'product', 'js', 'product-2026.js');
const CONFIGURATOR = path.join(REPO, 'product', 'js', 'pdp-configurator.js');
const CLASSIFIER = path.join(REPO, 'shared_components', 'js', 'headwear-classifier.js');
const { rows } = require('../fixtures/headwear-classifier-rows.json');

// Not in the classifier's live fixture; same row the classifier unit test uses.
const EXTRA_ROWS = {
    FS07: {
        STYLE: 'FS07',
        PRODUCT_TITLE: 'Port Authority Fleece Neck Gaiter. FS07',
        CATEGORY_NAME: 'Personal Protection',
        SUBCATEGORY_NAME: 'Face Coverings',
        PRODUCT_DESCRIPTION: 'A soft fleece neck gaiter that pulls up over the face.'
    }
};

const STATIC_TITLE = 'Product Details | Northwest Custom Apparel';

function catalogRow(style) {
    if (EXTRA_ROWS[style]) return EXTRA_ROWS[style];
    const hit = rows.find(function (r) { return r.row.STYLE === style; });
    if (!hit) throw new Error('No fixture row for ' + style);
    return hit.row;
}

const COLORS = ['Black', 'Navy'];

/** Two colors of one product, shaped like /api/product-details. */
function detailRows(row) {
    return COLORS.map(function (color) {
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

// Live decoration rules (checked 2026-09-16): Caps lists no garment method;
// Personal Protection = EMB + SCP + DTF; Accessories and Workwear = EMB only;
// T-Shirts allow all four.
function rulesFor(product) {
    const on = { EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'rules' };
    switch (product.CATEGORY_NAME) {
        case 'Caps': return Object.assign(on, { EMB: false });
        case 'Personal Protection': return Object.assign(on, { SCP: true, DTF: true });
        case 'Accessories':
        case 'Workwear': return on;
        default: return { EMB: true, DTG: 'yes', SCP: true, DTF: true, source: 'rules' };
    }
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

function json(status, body) {
    return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); } });
}

let initCalls;

/**
 * Boot the page for one style; returns once pricing has been routed.
 * opts.inventorySizes: stock sizes per color ([] = no rows, null = feed down).
 */
async function openProduct(style, opts) {
    const options = opts || {};
    jest.resetModules();
    document.head.innerHTML = '<title>' + STATIC_TITLE + '</title>';
    document.body.innerHTML = bodyMarkup();
    window.history.replaceState({}, '', '/product.html?style=' + encodeURIComponent(style));
    delete window.PdpConfigurator;
    delete window.HeadwearClassifier;

    const row = catalogRow(style);
    const inventorySizes = options.inventorySizes === undefined ? [] : options.inventorySizes;
    const fetchMock = jest.fn(function (url) {
        const u = new URL(String(url), 'http://localhost');
        if (u.pathname.endsWith('/api/product-details')) return json(200, detailRows(row));
        if (u.pathname.indexOf('/api/sanmar/inventory/') !== -1) {
            if (inventorySizes === null) return json(503, null);
            return json(200, {
                inventory: COLORS.flatMap(function (color) {
                    return inventorySizes.map(function (size) { return { color: color, size: size, totalQty: 500 }; });
                })
            });
        }
        return json(503, null);
    });
    window.fetch = global.fetch = fetchMock;

    window.DecorationMethods = { eligibleFor: jest.fn(function (p) { return Promise.resolve(rulesFor(p)); }) };
    if (options.cart) window.QuoteCartStore = options.cart;

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
    // Inventory loads on its own; wait for it to settle (grid, no-rows note or error).
    await until(function () {
        return !document.querySelector('#inventoryBody .skeleton');
    }, style + ' inventory');
    return { row: row, eligibleFor: window.DecorationMethods.eligibleFor };
}

function methodIds() {
    return Array.from(document.querySelectorAll('#cfgMethods [data-method]')).map(function (b) { return b.dataset.method; });
}

function chips() {
    return Array.from(document.querySelectorAll('#cfgLocations [data-loc]')).map(function (b) {
        return {
            key: b.dataset.loc,
            label: b.querySelector('.pdp-cfg-chip-label').textContent,
            sub: b.querySelector('.pdp-cfg-chip-sub').textContent
        };
    });
}

const FRONT_ONLY = [{ key: 'leftChest', label: 'Front', sub: 'Front logo' }];

/** In-memory QuoteCartStore with the three calls the page makes. */
function cartWith(items) {
    const list = items.slice();
    return {
        getItems: function () { return list.slice(); },
        add: jest.fn(function (item) { list.push(item); }),
        count: function () { return list.length; }
    };
}

/**
 * Stand in for a landed engine price on top of the REAL selection (real
 * placement key/label, method, isCap), then let the page refresh its CTAs.
 */
function priceSelection(sizes) {
    const real = window.PdpConfigurator.getSelection;
    window.PdpConfigurator.getSelection = function () {
        const sel = real();
        return sel && Object.assign({}, sel, {
            status: 'ok',
            price: { total: 240, perPiece: 10, tierLabel: '24-47', oneTimeFees: [] },
            sizes: sizes
        });
    };
    initCalls[0].onChange();
    expect(document.getElementById('cfgAddToQuote').disabled).toBe(false);
}

function addToQuote() {
    document.getElementById('cfgAddToQuote').click();
    const toasts = document.querySelectorAll('#toastStack .toast');
    return toasts[toasts.length - 1];
}

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(function () {});
    jest.spyOn(console, 'warn').mockImplementation(function () {});
    try { sessionStorage.clear(); } catch (e) { /* storage unavailable */ }
});

afterEach(() => {
    jest.restoreAllMocks();
    delete window.DecorationMethods;
    delete window.QuoteCartStore;
});

describe('flat headwear listed under Caps: garment embroidery only, Front only', () => {
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
        // ONE placement: the garment leftChest key (same engine inputs), headwear words.
        expect(chips()).toEqual(FRONT_ONLY);
        expect(window.PdpConfigurator.getLocations()).toEqual(FRONT_ONLY);
        expect(document.getElementById('cfgLocations').textContent).not.toMatch(/Left chest|Back/);
        expect(document.getElementById('flatHeadwearNote').textContent)
            .toContain('Beanies and other soft headwear are embroidered flat');
        expect(document.getElementById('methodAlert').querySelector('.alert')).toBeNull();

        const sel = window.PdpConfigurator.getSelection();
        expect(sel).toMatchObject({ locationKey: 'leftChest', locationLabel: 'Front', engineMethod: 'EMB', isCap: false });
        expect(document.getElementById('cfgInkRow').hidden).toBe(true);
    });

    test('a Caps subcategory counts too (case-insensitive)', async () => {
        const row = Object.assign({}, catalogRow('CP90'), { STYLE: 'YB1', CATEGORY_NAME: 'Youth', SUBCATEGORY_NAME: 'CAPS' });
        EXTRA_ROWS.YB1 = row;
        try {
            const { eligibleFor } = await openProduct('YB1');
            expect(initCalls[0]).toMatchObject({ isCap: false, isFlat: true });
            expect(initCalls[0].eligibility.source).toBe('flat-headwear');
            expect(eligibleFor).not.toHaveBeenCalled();
            expect(methodIds()).toEqual(['emb']);
            expect(document.getElementById('flatHeadwearNote')).not.toBeNull();
        } finally {
            delete EXTRA_ROWS.YB1;
        }
    });
});

describe('flat headwear outside Caps keeps its category rules', () => {
    test('FS07 (Personal Protection gaiter) → embroidery, screen print and DTF, Front only', async () => {
        const { eligibleFor } = await openProduct('FS07');
        const ctx = initCalls[0];

        expect(ctx.isCap).toBe(false);
        expect(ctx.isFlat).toBe(true);
        expect(eligibleFor).toHaveBeenCalledTimes(1);
        expect(eligibleFor.mock.calls[0][0]).toMatchObject({ CATEGORY_NAME: 'Personal Protection', styleNumber: 'FS07' });
        expect(ctx.eligibility).toEqual({ EMB: true, DTG: 'no', SCP: true, DTF: true, source: 'rules' });

        expect(methodIds()).toEqual(['emb', 'scp', 'dtf']);
        expect(chips()).toEqual(FRONT_ONLY);
        expect(document.getElementById('flatHeadwearNote')).toBeNull();
        expect(document.getElementById('methodAlert').textContent.trim()).toBe('');
        expect(document.getElementById('cfgInkRow').hidden).toBe(false);
        // Embroidery on a gaiter is still GARMENT embroidery.
        expect(window.PdpConfigurator.getSelection()).toMatchObject({
            methodId: 'emb', engineMethod: 'EMB', isCap: false, locationKey: 'leftChest', locationLabel: 'Front'
        });
    });

    test.each([
        ['C910', 'Accessories'],
        ['STA35', 'Accessories'],
        ['WW3040', 'Workwear'],
        ['CS800', 'Workwear']
    ])('%s (%s) → the category rule (embroidery only), Front only, no flat note', async (style, category) => {
        const { eligibleFor } = await openProduct(style);
        const ctx = initCalls[0];

        expect(ctx).toMatchObject({ isCap: false, isFlat: true });
        expect(eligibleFor).toHaveBeenCalledTimes(1);
        expect(eligibleFor.mock.calls[0][0]).toMatchObject({ CATEGORY_NAME: category, styleNumber: style });
        expect(ctx.eligibility.source).toBe('rules');
        expect(methodIds()).toEqual(['emb']);
        expect(chips()).toEqual(FRONT_ONLY);
        expect(document.getElementById('flatHeadwearNote')).toBeNull();
        expect(window.PdpConfigurator.getSelection()).toMatchObject({ engineMethod: 'EMB', isCap: false, locationLabel: 'Front' });
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
        expect(chips()[0]).toEqual({ key: 'leftChest', label: 'Left chest', sub: 'Logo size' });
        expect(chips().map(function (c) { return c.key; })).toContain('back');
        expect(document.getElementById('flatHeadwearNote')).toBeNull();
    });
});

describe('fallback meta description names only the methods on offer', () => {
    function description() {
        const meta = document.head.querySelector('meta[name="description"]');
        return meta ? meta.getAttribute('content') : '';
    }

    test.each(['CP90', 'C112'])('%s → embroidery only', async (style) => {
        await openProduct(style);
        expect(description()).toContain('decoration pricing — embroidery from Northwest Custom Apparel');
        expect(description()).not.toMatch(/screen print|DTG|DTF/);
    });

    test.each(['NEA100', 'FS07'])('%s → the full method list', async (style) => {
        await openProduct(style);
        expect(description()).toContain('embroidery, screen print, DTG, and DTF from Northwest Custom Apparel');
    });
});

describe('quote conflict names the placement the way THIS page does', () => {
    const beanieFront = { style: 'CP90', method: 'EMB', placement: 'leftChest', placementLabel: 'Front', isCap: false };
    const teeBack = { style: 'NEA100', method: 'EMB', placement: 'back', placementLabel: 'Back', isCap: false };
    const teeLeftChest = { style: 'NEA100', method: 'EMB', placement: 'leftChest', placementLabel: 'Left chest', isCap: false };

    test('tee page: a beanie\'s stored "Front" is worded as this page\'s "Left chest"', async () => {
        const cart = cartWith([beanieFront]);
        await openProduct('NEA100', { cart: cart });
        document.querySelector('#cfgLocations [data-loc="back"]').click();
        priceSelection({ S: 24 });

        const toast = addToQuote();
        expect(toast.className).toContain('toast-warn');
        expect(toast.textContent).toContain('Your quote\'s Embroidery pieces use "Left chest"');
        expect(toast.textContent).toContain('Switch the placement to match');
        expect(toast.textContent).not.toContain('"Front"');
        expect(cart.add).not.toHaveBeenCalled();
    });

    test('beanie page: a tee\'s back placement is not offered here, so no chip is named', async () => {
        const cart = cartWith([teeBack]);
        await openProduct('CP90', { cart: cart, inventorySizes: ['OSFA'] });
        priceSelection({ OSFA: 24 });

        const toast = addToQuote();
        expect(toast.className).toContain('toast-warn');
        expect(toast.textContent).toContain('Your quote\'s Embroidery pieces use a placement this style doesn\'t offer');
        expect(toast.textContent).not.toMatch(/Back|Left chest|Switch the placement/);
        expect(cart.add).not.toHaveBeenCalled();
    });

    test('beanie page: a tee on the same key pools — the beanie is added as "Front"', async () => {
        const cart = cartWith([teeLeftChest]);
        await openProduct('CP90', { cart: cart, inventorySizes: ['OSFA'] });
        priceSelection({ OSFA: 24 });

        const toast = addToQuote();
        expect(toast.className).toContain('toast-success');
        expect(toast.textContent).not.toContain('Left chest');
        expect(cart.add).toHaveBeenCalledTimes(1);
        expect(cart.add.mock.calls[0][0]).toMatchObject({
            style: 'CP90', method: 'EMB', placement: 'leftChest', placementLabel: 'Front', isCap: false, sizes: { OSFA: 24 }
        });
    });

    test('cap page: a stored cap placement uses the cap chip words', async () => {
        const cart = cartWith([{ style: 'C112', method: 'CAP', placement: 'frontBack', placementLabel: 'Front + back logos', isCap: true }]);
        await openProduct('C112', { cart: cart, inventorySizes: ['OSFA'] });
        priceSelection({ OSFA: 24 });

        const toast = addToQuote();
        expect(toast.textContent).toContain('pieces use "Front + back"');
        expect(cart.add).not.toHaveBeenCalled();
    });
});

describe('add-to-quote toast link', () => {
    function link(toast) {
        const a = toast.querySelector('a[href="/quote-cart"]');
        expect(a).not.toBeNull();
        return a.textContent;
    }

    test.each([
        ['C112', { inventorySizes: ['OSFA'] }, { OSFA: 24 }, 'View quote (1)', 'cap'],
        ['CP90', { inventorySizes: ['OSFA'] }, { OSFA: 24 }, 'View quote (1)', 'one-size beanie'],
        ['CP90', { inventorySizes: null }, { OSFA: 24 }, 'View quote (1)', 'stock feed down, OSFA priced'],
        ['FS07', { inventorySizes: ['OSFA'] }, { OSFA: 24 }, 'View quote (1)', 'one-size gaiter'],
        ['C910', { inventorySizes: ['S/M', 'L/XL'] }, { 'S/M': 24 }, 'Set sizes & view quote (1)', 'two-size headband'],
        ['NEA100', { inventorySizes: ['S', 'M', 'L'] }, { S: 24 }, 'Set sizes & view quote (1)', 'tee'],
        ['NEA100', { inventorySizes: null }, { S: 24 }, 'Set sizes & view quote (1)', 'tee, stock feed down']
    ])('%s (%s → %s) %s', async (style, opts, sizes, expected) => {
        const cart = cartWith([]);
        await openProduct(style, Object.assign({ cart: cart }, opts));
        priceSelection(sizes);

        const toast = addToQuote();
        expect(toast.className).toContain('toast-success');
        expect(link(toast)).toBe(expected);
        expect(cart.add).toHaveBeenCalledTimes(1);
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
