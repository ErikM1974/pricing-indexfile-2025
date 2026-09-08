const fs = require('fs');
const path = require('path');
const vm = require('vm');
const espree = require('espree');

// Exercise the actual product loader, fetch stages and error UI without loading
// autocomplete, gallery or DOM-ready side effects unrelated to these requests.
function calculator(kind, failure) {
    const file = kind === 'cap' ? 'cap-embroidery-pricing-integrated-page.js' : 'embroidery-pricing-page.js';
    const source = fs.readFileSync(path.join(__dirname, '../../calculators/js', file), 'utf8');
    const names = new Set(['loadColors', 'showApiError', 'hideApiError', 'showLoading', 'showProduct', 'showNoProduct',
        kind === 'cap' ? 'loadCapProduct' : 'loadProduct', ...(kind === 'cap' ? [] : ['loadSizePricing'])]);
    const functions = espree.parse(source, {ecmaVersion: 'latest', range: true}).body
        .filter(n => n.type === 'FunctionDeclaration' && names.has(n.id.name))
        .map(n => source.slice(...n.range)).join('\n');
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, {style: {}, textContent: '', innerHTML: ''});
        return elements.get(id);
    };
    const sizeData = {StyleNumber: 'PC54', SizeUpcharges: {'2XL': 2}};
    const colors = [{COLOR_NAME: 'Black'}, {COLOR_NAME: 'Navy'}];
    const fetchPricingData = jest.fn().mockResolvedValue({pricing: {}});
    const context = vm.createContext({
        EMB_API_BASE: 'https://pricing.example.test', CAPEMB_API_BASE: 'https://pricing.example.test',
        currentProduct: null, currentColors: [], selectedColor: null, pricingData: null,
        window: {currentSizePricing: {StyleNumber: 'PREVIOUS'}},
        document: {getElementById: element, querySelector: element},
        loadingState: element('loading'), productHero: element('hero'),
        pricingSection: element('pricing'), orderInfoSection: element('order-info'),
        console: {error: jest.fn()},
        validateProductType: () => true,
        ProductCategoryFilter: {isFlatHeadwear: () => false, isStructuredCap: () => true},
        updateProductInfo: jest.fn(), setMainProductImage: jest.fn(), updateSelectedColor: jest.fn(),
        displayColorSwatches: jest.fn(), loadSizes: jest.fn(), updatePricing: jest.fn(),
        updateLTMPricingData: jest.fn(), updateCapPricing: jest.fn(), updateLTMCapPricing: jest.fn(),
        embroideryService: {fetchPricingData}, capService: {fetchPricingData},
        fetch: jest.fn(async url => {
            const endpoint = new URL(url).pathname;
            if (endpoint === failure?.endpoint) {
                if (failure.transport) throw new Error('Connection interrupted');
                if (failure.invalidJson) return {ok: true, json: async () => {throw new Error('Invalid JSON');}};
                return {ok: failure.ok ?? false, status: 503, json: async () => failure.body};
            }
            const data = {'/api/product-details': [{STYLE: 'PC54', PRODUCT_TITLE: 'Test Product'}],
                '/api/color-swatches': colors, '/api/size-pricing': [sizeData]}[endpoint];
            if (!data) throw new Error('Unexpected API request: ' + endpoint);
            return {ok: true, json: async () => data};
        }),
    });
    vm.runInContext(functions, context);
    return {context, element, colors, sizeData, fetchPricingData,
        load: () => context[kind === 'cap' ? 'loadCapProduct' : 'loadProduct']('PC54')};
}

describe.each(['garment', 'cap'])('%s calculator API errors', kind => {
    test.each([
        ['HTTP failure', {}], ['connection failure', {transport: true}],
        ['invalid response', {invalidJson: true}],
    ])('a color %s is visible and prevents pricing display', async (_label, failure) => {
        const h = calculator(kind, {endpoint: '/api/color-swatches', ...failure});
        await h.load();
        expect(h.element('apiErrorNotification').style.display).toBe('flex');
        expect(h.element('errorMessage').textContent).not.toBe('');
        expect(h.element('pricing').style.display).toBe('none');
        expect(h.fetchPricingData).not.toHaveBeenCalled();
    });
    test('successful colors and pricing retain the selected API color', async () => {
        const h = calculator(kind);
        await h.load();
        expect(h.context.currentColors).toEqual(h.colors);
        expect(h.context.selectedColor).toEqual(h.colors[0]);
        expect(h.context.displayColorSwatches).toHaveBeenCalledWith(h.colors);
        expect(h.fetchPricingData).toHaveBeenCalledWith('PC54');
        expect(h.element('pricing').style.display).toBe('block');
        if (kind === 'garment') expect(h.context.window.currentSizePricing).toEqual(h.sizeData);
    });
});

test.each([
    ['HTTP failure', {}], ['connection failure', {transport: true}],
    ['empty array', {ok: true, body: []}], ['wrong response shape', {ok: true, body: {error: 'unavailable'}}],
    ['invalid JSON', {invalidJson: true}],
])('size pricing %s clears the previous style and shows an error', async (_label, failure) => {
    const h = calculator('garment', {endpoint: '/api/size-pricing', ...failure});
    await h.load();
    expect(h.context.window.currentSizePricing).toBeNull();
    expect(h.element('apiErrorNotification').style.display).toBe('flex');
    expect(h.element('errorMessage').textContent).not.toBe('');
    expect(h.element('pricing').style.display).toBe('none');
    expect(h.fetchPricingData).not.toHaveBeenCalled();
});
