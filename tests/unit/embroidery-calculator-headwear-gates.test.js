/**
 * embroidery-calculator-headwear-gates.test.js — the public flat (/pricing/embroidery) and cap
 * (/pricing/cap-embroidery) calculators decide cap vs garment with the shared headwear classifier
 * (Erik 2026-09-16: one rule on every price surface). isCap → cap calculator; flat headwear
 * (beanies, knit/skull caps, headbands, gaiters) and garments → flat calculator.
 *
 * Runs the real page functions (product gate, search sorting, error UI) in a VM with stub DOM and
 * fetch, over the live catalog rows in tests/fixtures/headwear-classifier-rows.json.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const espree = require('espree');
const HeadwearClassifier = require('../../shared_components/js/headwear-classifier');
const { rows } = require('../fixtures/headwear-classifier-rows.json');

const PAGES = {
    flat: {
        file: 'embroidery-pricing-page.js', loader: 'loadProduct',
        functions: ['classifyHeadwear', 'validateProductType', 'hideLoading', 'loadProduct', 'setupSearch',
            'showLoading', 'showProduct', 'showNoProduct', 'showApiError', 'hideApiError'],
    },
    cap: {
        file: 'cap-embroidery-pricing-integrated-page.js', loader: 'loadCapProduct',
        functions: ['classifyHeadwear', 'loadCapProduct', 'setupSearch',
            'showLoading', 'showProduct', 'showNoProduct', 'showApiError'],
    },
};

function calculator(kind, { classifier = HeadwearClassifier, product = {}, suggestions = [] } = {}) {
    const page = PAGES[kind];
    const source = fs.readFileSync(path.join(__dirname, '../../calculators/js', page.file), 'utf8');
    const wanted = new Set(page.functions);
    const nodes = espree.parse(source, { ecmaVersion: 'latest', range: true }).body
        .filter(n => n.type === 'FunctionDeclaration' && wanted.has(n.id.name));
    expect(nodes.map(n => n.id.name).sort()).toEqual([...wanted].sort());

    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { style: {}, textContent: '', innerHTML: '', className: '' });
        return elements.get(id);
    };
    const results = { innerHTML: '', classList: { add() {}, remove() {} }, querySelectorAll: () => [] };
    const handlers = {};
    const searchInput = { addEventListener: (type, fn) => { handlers[type] = fn; }, blur() {} };
    const fetchPricingData = jest.fn().mockResolvedValue({ pricing: {} });
    const context = vm.createContext({
        window: { HeadwearClassifier: classifier, location: { href: '' } },
        document: {
            getElementById: id => (id === 'styleSearch' ? searchInput : id === 'searchBtn' ? { addEventListener() {} } : element(id)),
            querySelector: selector => (selector === '.search-wrapper' ? { appendChild() {}, contains: () => true } : element(selector)),
            createElement: () => results,
            addEventListener() {},
        },
        console: { error: jest.fn() },
        setTimeout: fn => { fn(); return 1; }, // no debounce wait
        clearTimeout() {},
        URLSearchParams,
        EMB_API_BASE: 'https://pricing.example.test', CAPEMB_API_BASE: 'https://pricing.example.test',
        currentProduct: null, pricingData: null,
        loadingState: element('loading'), productHero: element('hero'),
        pricingSection: element('pricing'), orderInfoSection: element('order-info'),
        showProductMismatchOverlay: jest.fn(),
        updateProductInfo: jest.fn(), setMainProductImage: jest.fn(), loadColors: jest.fn(),
        loadSizePricing: jest.fn(), loadSizes: jest.fn(), updatePricing: jest.fn(), updateLTMPricingData: jest.fn(),
        updateCapPricing: jest.fn(), updateLTMCapPricing: jest.fn(),
        embroideryService: { fetchPricingData }, capService: { fetchPricingData },
        fetch: jest.fn(async url => {
            if (url.startsWith('/api/stylesearch?')) return { ok: true, json: async () => suggestions };
            if (new URL(url).pathname === '/api/product-details') return { ok: true, json: async () => [product] };
            throw new Error('Unexpected API request: ' + url);
        }),
    });
    vm.runInContext(nodes.map(n => source.slice(...n.range)).join('\n'), context);

    return {
        context, element, fetchPricingData,
        overlay: context.showProductMismatchOverlay,
        load: () => context[page.loader](product.STYLE || 'TEST'),
        async search(term) {
            context.setupSearch();
            handlers.input({ target: { value: term } });
            await new Promise(resolve => setImmediate(resolve)); // let the stubbed fetch settle
            return {
                html: results.innerHTML,
                listed: [...results.innerHTML.matchAll(/data-style="([^"]*)"/g)].map(m => m[1]),
            };
        },
    };
}

const accepted = h => h.fetchPricingData.mock.calls.length === 1 && !h.overlay.mock.calls.length;
const visibleError = h => h.element('apiErrorNotification').style.display === 'flex' && h.element('errorMessage').textContent;

describe('product gates use the shared headwear classifier on the full product-details row', () => {
    test.each(rows.map(r => [r.row.STYLE, r.expected, r.row]))('%s (%s) opens only on its calculator', async (_style, expected, row) => {
        const flat = calculator('flat', { product: row });
        await flat.load();
        expect(accepted(flat)).toBe(expected !== 'cap');
        if (expected === 'cap') {
            expect(flat.overlay).toHaveBeenCalledWith(row.STYLE, row.PRODUCT_TITLE,
                'This product is a structured cap and requires cap embroidery pricing.');
            expect(flat.element('apiErrorNotification').style.display).not.toBe('flex');
            expect(flat.element('loading').style.display).toBe('none');
        }

        const cap = calculator('cap', { product: row });
        await cap.load();
        expect(accepted(cap)).toBe(expected === 'cap');
        if (expected !== 'cap') {
            expect(cap.overlay).toHaveBeenCalledTimes(1);
            expect(cap.overlay.mock.calls[0][2]).toBe(expected === 'flat'
                ? 'This is a flat headwear item that requires flat embroidery, not cap embroidery.'
                : 'This product requires flat embroidery pricing, not cap embroidery.');
            expect(cap.fetchPricingData).not.toHaveBeenCalled();
        }
    });

    test.each([
        ['Canvas Tote whose description says capacity', { STYLE: 'B150', PRODUCT_TITLE: 'Port Authority Canvas Tote', CATEGORY_NAME: 'Bags', PRODUCT_DESCRIPTION: 'Large capacity main compartment.' }, 'flat'],
        ['blank-category tote whose description says capacity', { STYLE: 'TOTE1', PRODUCT_TITLE: 'Canvas Tote', CATEGORY_NAME: '', PRODUCT_DESCRIPTION: 'Holds up to 20 lb capacity.' }, 'flat'],
        ['C975 bucket hat', { STYLE: 'C975', PRODUCT_TITLE: 'Port Authority Twill Classic Bucket Hat C975', CATEGORY_NAME: '', PRODUCT_DESCRIPTION: 'Unstructured' }, 'cap'],
        ['CP90 knit cap', { STYLE: 'CP90', PRODUCT_TITLE: 'Port Authority Knit Cap. CP90', CATEGORY_NAME: 'Caps', SUBCATEGORY_NAME: 'Fleece/Beanies' }, 'flat'],
        ['HT01 skull cap', { STYLE: 'HT01', PRODUCT_TITLE: 'Skull Cap', CATEGORY_NAME: 'Caps' }, 'flat'],
        ['NKFB6446 visor', { STYLE: 'NKFB6446', PRODUCT_TITLE: 'Nike Dri-FIT Ace Visor NKFB6446', CATEGORY_NAME: '' }, 'cap'],
    ])('%s prices on the %s calculator', async (_label, row, owner) => {
        const flat = calculator('flat', { product: row });
        const cap = calculator('cap', { product: row });
        await flat.load();
        await cap.load();
        expect(accepted(flat)).toBe(owner === 'flat');
        expect(accepted(cap)).toBe(owner === 'cap');
    });

    test('an unconfident cap answer is still a cap (legacy Richardson numbering)', async () => {
        const row = { STYLE: '999', PRODUCT_TITLE: '', CATEGORY_NAME: '' };
        expect(HeadwearClassifier.classify(row)).toMatchObject({ isCap: true, confident: false });
        const flat = calculator('flat', { product: row });
        const cap = calculator('cap', { product: row });
        await flat.load();
        await cap.load();
        expect(accepted(flat)).toBe(false);
        expect(accepted(cap)).toBe(true);
    });

    test.each(['flat', 'cap'])('%s calculator: a missing classifier is a visible error and never prices', async kind => {
        const h = calculator(kind, { classifier: null, product: rows[0].row });
        await h.load();
        expect(visibleError(h)).toMatch(/product type check did not load/);
        expect(h.fetchPricingData).not.toHaveBeenCalled();
        expect(h.overlay).not.toHaveBeenCalled();
        expect(h.element('pricing').style.display).toBe('none');
    });
});

describe('search suggestions are sorted by the classifier on their label', () => {
    const suggestions = rows.map(r => ({ value: r.row.STYLE, label: r.row.PRODUCT_TITLE }))
        .concat([{ value: 'TOTE1', label: 'Canvas Tote' }]);
    const labelKind = s => HeadwearClassifier.classify({ PRODUCT_TITLE: s.label }).kind;

    test('flat calculator lists flat headwear and garments, and points caps to the cap page', async () => {
        const { html, listed } = await calculator('flat', { suggestions }).search('ca');
        const caps = suggestions.filter(s => labelKind(s) === 'cap');
        expect(listed).toEqual(suggestions.filter(s => labelKind(s) !== 'cap').map(s => s.value));
        expect(html).toContain(`Found ${caps.length} cap item(s).`);
        for (const style of ['CP90', 'HT01', 'C916', 'TOTE1', 'NEA220', 'MM3032']) expect(listed).toContain(style);
        for (const style of ['C975', 'NKFB6446', 'C112']) expect(listed).not.toContain(style);
    });

    test('cap calculator lists caps, counts flat headwear, and leaves garments out', async () => {
        const { html, listed } = await calculator('cap', { suggestions }).search('ca');
        const flats = suggestions.filter(s => labelKind(s) === 'flat');
        expect(listed).toEqual(suggestions.filter(s => labelKind(s) === 'cap').map(s => s.value));
        expect(html).toContain(`Found ${flats.length} beanie/knit item(s).`);
        for (const style of ['C975', 'NKFB6446', 'C112']) expect(listed).toContain(style);
        for (const style of ['CP90', 'HT01', 'C916', 'TOTE1', 'NEA220', 'MM3032']) expect(listed).not.toContain(style);
    });

    test('every title-decided fixture row sorts the same from its label alone', () => {
        for (const r of rows.filter(x => HeadwearClassifier.classify(x.row).reason === 'title')) {
            expect([r.row.STYLE, labelKind({ label: r.row.PRODUCT_TITLE })]).toEqual([r.row.STYLE, r.expected]);
        }
    });

    test('only-cap results on the flat page keep the cap-page message', async () => {
        const { html, listed } = await calculator('flat', { suggestions: [{ value: 'NKFB6446', label: 'Nike Dri-FIT Ace Visor NKFB6446' }] }).search('NKFB');
        expect(listed).toEqual([]);
        expect(html).toContain('Found 1 cap item(s). Please use the');
        expect(html).toContain('href="/pricing/cap-embroidery"');
    });

    test('only-flat results on the cap page keep the beanie message', async () => {
        const { html, listed } = await calculator('cap', { suggestions: [{ value: 'CP90', label: 'Port Authority Knit Cap. CP90' }] }).search('CP9');
        expect(listed).toEqual([]);
        expect(html).toContain('Found 1 beanie/knit item(s).');
        expect(html).toContain('No cap styles found. See message above for beanie/knit options.');
    });

    test.each(['flat', 'cap'])('%s calculator: a missing classifier fails the search visibly', async kind => {
        const h = calculator(kind, { classifier: null, suggestions });
        const { html, listed } = await h.search('ca');
        expect(listed).toEqual([]);
        expect(html).toContain('Search failed');
        expect(visibleError(h)).toMatch(/product type check did not load/);
    });
});
