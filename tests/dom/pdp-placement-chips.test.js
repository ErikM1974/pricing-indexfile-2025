/**
 * PDP configurator — placement chips + default-open price table.
 *
 * Two behaviours are locked here, both customer-visible on /product.html:
 *
 *  1. Only placements that at least ONE eligible decoration method can price
 *     are rendered. Before this, the chip row was a hardcoded six-item list
 *     rendered regardless of eligibility, so every embroidery-only product
 *     (Workwear / Outerwear / Woven Shirts / Bags / Accessories per
 *     /api/decoration-methods) showed Center front, Full front and Center
 *     back — chips whose only possible outcome was "not available for this
 *     placement". Real example: CT103828, Carhartt Duck Detroit Jacket.
 *
 *  2. The full quantity price table renders OPEN, not behind an accordion.
 *
 * The fixture is sliced out of the real product.html so the markup's default
 * state (aria-expanded, the un-hidden #cfgMatrix) is locked too — a revert in
 * the HTML alone fails this suite.
 *
 * Pricing itself is deliberately NOT exercised: window.QuoteCartEngine is
 * absent, so every method lands in the caught 'error' branch of priceMethod().
 * Chip rendering is what's under test, and it must survive that.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(REPO, 'product.html'), 'utf8');
const MODULE = path.join(REPO, 'product', 'js', 'pdp-configurator.js');

/** The configurator block + the mobile CTA bar, straight from product.html. */
function fixtureMarkup() {
    const start = HTML.indexOf('<div class="pdp-cfg" id="pdpConfigurator"');
    const end = HTML.indexOf('</section>', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const barStart = HTML.indexOf('<div class="pdp-mobile-cta"');
    const barEnd = HTML.indexOf('</div>', HTML.indexOf('ctaSampleMobile'));
    expect(barStart).toBeGreaterThan(-1);

    return HTML.slice(start, end) + HTML.slice(barStart, barEnd + 6);
}

function ctx(eligibility, over) {
    return Object.assign({
        style: 'CT103828',
        isCap: false,
        productName: 'Carhartt Duck Detroit Jacket',
        eligibility: eligibility,
        getColor: function () { return { name: 'Carhartt Brown', catalog: 'CarharttBrn' }; },
        onChange: function () {}
    }, over || {});
}

/** Visible placement chips, in render order. */
function chipLabels() {
    return Array.from(document.querySelectorAll('#cfgLocations [data-loc]'))
        .map(function (b) { return b.querySelector('.pdp-cfg-chip-label').textContent; });
}

function chipKeys() {
    return Array.from(document.querySelectorAll('#cfgLocations [data-loc]'))
        .map(function (b) { return b.dataset.loc; });
}

const EMB_ONLY = { EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'rules' };
const ALL_FOUR = { EMB: true, DTG: 'yes', SCP: true, DTF: true, source: 'rules' };

beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = fixtureMarkup();
    delete window.PdpConfigurator;
    require(MODULE);
});

describe('placement chips are filtered to what an eligible method can price', () => {
    test('embroidery-only garment (Workwear/Outerwear) hides the three dead chips', () => {
        window.PdpConfigurator.init(ctx(EMB_ONLY));

        // METHODS.emb.supports = { leftChest, back, frontBack } — fullFront is
        // explicitly false; centerFront/centerBack are DTF-only keys.
        expect(chipKeys()).toEqual(['leftChest', 'back', 'frontBack']);
        expect(chipLabels()).toEqual(['Left chest', 'Back', 'Front + back']);

        ['Center front', 'Full front', 'Center back'].forEach(function (dead) {
            expect(document.getElementById('cfgLocations').textContent).not.toContain(dead);
        });
    });

    test('every dead chip removed was genuinely unpriceable, not merely hidden', () => {
        window.PdpConfigurator.init(ctx(EMB_ONLY));

        // Nothing survived that the one eligible method cannot price, and
        // nothing was dropped that it can: exact set equality, both ways.
        const shown = chipKeys();
        expect(shown).toHaveLength(3);
        shown.forEach(function (key) {
            const chip = document.querySelector('[data-loc="' + key + '"]');
            expect(chip).not.toBeNull();
        });
    });

    test('all-four-method garment (T-Shirts) still shows all six placements', () => {
        window.PdpConfigurator.init(ctx(ALL_FOUR, { style: 'PC61', productName: 'Port & Company Tee' }));

        expect(chipKeys()).toEqual([
            'leftChest', 'centerFront', 'fullFront', 'back', 'centerBack', 'frontBack'
        ]);
    });

    test('DTF alone keeps the center-front / center-back chips it owns', () => {
        window.PdpConfigurator.init(ctx({ EMB: false, DTG: 'no', SCP: false, DTF: true, source: 'rules' }));

        expect(chipKeys()).toContain('centerFront');
        expect(chipKeys()).toContain('centerBack');
    });

    test('caps are unaffected — both cap placements survive the filter', () => {
        window.PdpConfigurator.init(ctx(null, { isCap: true, style: 'C112', productName: 'Trucker Cap' }));

        expect(chipKeys()).toEqual(['front', 'frontBack']);
    });

    test('the default placement is always one of the rendered chips', () => {
        [EMB_ONLY, ALL_FOUR, { EMB: false, DTG: 'no', SCP: false, DTF: true, source: 'rules' }].forEach(function (elig) {
            document.body.innerHTML = fixtureMarkup();
            window.PdpConfigurator.init(ctx(elig));
            const pressed = document.querySelector('#cfgLocations [aria-pressed="true"]');
            expect(pressed).not.toBeNull();
            expect(chipKeys()).toContain(pressed.dataset.loc);
        });
    });
});

describe('the full price table is open by default', () => {
    test('product.html ships the matrix expanded, not behind a collapsed accordion', () => {
        const toggle = document.getElementById('cfgMatrixToggle');
        const box = document.getElementById('cfgMatrix');

        // Asserted on the raw fixture, BEFORE init() — the markup itself must
        // not flash a collapsed table on slow JS.
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(box.hasAttribute('hidden')).toBe(false);
    });

    test('init() re-asserts the open state and the collapse label', () => {
        window.PdpConfigurator.init(ctx(EMB_ONLY));

        const toggle = document.getElementById('cfgMatrixToggle');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.textContent).toContain('Hide the full price table');
        expect(document.getElementById('cfgMatrix').hasAttribute('hidden')).toBe(false);
    });

    test('the toggle still collapses and re-expands', () => {
        window.PdpConfigurator.init(ctx(EMB_ONLY));
        const toggle = document.getElementById('cfgMatrixToggle');
        const box = document.getElementById('cfgMatrix');

        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.textContent).toContain('See every quantity price');
        expect(box.hasAttribute('hidden')).toBe(true);

        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.textContent).toContain('Hide the full price table');
        expect(box.hasAttribute('hidden')).toBe(false);
    });
});
