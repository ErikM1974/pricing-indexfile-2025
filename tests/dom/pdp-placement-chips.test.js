/**
 * PDP configurator — placement chips, default-open price table, fee row.
 *
 * Three behaviours are locked here, all customer-visible on /product.html:
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
 *  3. The small-order fee reads as a real charge — a pill, an explicit
 *     "No fee" on the tiers that don't carry it, and a note naming the
 *     threshold. On styles whose two cheapest tiers share a per-piece price
 *     (EMB 1-7 / 8-23 on CT103828: both $177.50) the fee is the ONLY
 *     difference between those columns, so it cannot read as a footnote.
 *
 * The fixture is sliced out of the real product.html so the markup's default
 * state (aria-expanded, the un-hidden #cfgMatrix) is locked too — a revert in
 * the HTML alone fails this suite.
 *
 * The first two blocks deliberately run with NO engine: window.QuoteCartEngine
 * is absent, so every method lands in the caught 'error' branch of
 * priceMethod(). Chip rendering is what's under test, and it must survive
 * that. The fee block stubs an engine, since it needs a rendered table.
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

/**
 * Small-order fee row.
 *
 * Rendering the matrix needs an engine, so this block stubs one. The ladder
 * mirrors the real CT103828 embroidery data: 1-7 and 8-23 are BOTH $177.50
 * (identical Caspio decoration cost) and differ only by the $50 fee — the
 * exact case the fee styling exists to make legible.
 */
describe('small-order fee row', () => {
    const LADDER = [
        { label: '1-7', min: 1, max: 7, price: 177.50, ltm: 50 },
        { label: '8-23', min: 8, max: 23, price: 177.50, ltm: 0 },
        { label: '24-47', min: 24, max: 47, price: 173.50, ltm: 0 },
        { label: '48-71', min: 48, max: 71, price: 172.50, ltm: 0 },
        { label: '72+', min: 72, max: Infinity, price: 171.50, ltm: 0 }
    ];

    function tierFor(qty) {
        return LADDER.filter(function (t) { return qty >= t.min && qty <= t.max; })[0] || LADDER[LADDER.length - 1];
    }

    /** Minimal stand-ins for the two authorities renderMatrix() reaches for. */
    function stubEngine(ladder) {
        const rows = ladder || LADDER;
        window.EmbroideryPricingService = function () {
            return {
                fetchPricingData: function () {
                    const pricing = {};
                    rows.forEach(function (t) { pricing[t.label] = { S: 84.50 }; });
                    return Promise.resolve({
                        pricing: pricing,
                        uniqueSizes: ['S', 'M', 'L'],
                        tierData: rows.map(function (t) {
                            return {
                                TierLabel: t.label,
                                MinQuantity: t.min,
                                MaxQuantity: t.max === Infinity ? 0 : t.max,
                                LTM_Fee: t.ltm
                            };
                        })
                    });
                },
                fetchALPricing: function () { return Promise.resolve({}); },
                calculateALPrice: function () { return Promise.resolve({ unitPrice: 0 }); }
            };
        };
        window.QuoteCartEngine = {
            singleItemPreview: function (item) {
                const qty = Object.keys(item.sizes).reduce(function (n, k) { return n + item.sizes[k]; }, 0);
                const t = (function () {
                    return rows.filter(function (r) { return qty >= r.min && qty <= r.max; })[0] || rows[rows.length - 1];
                })();
                return Promise.resolve({
                    ok: true,
                    tierLabel: t.label,
                    itemQuantity: qty,
                    groupTotal: t.price * qty + t.ltm,
                    lines: [{ id: '__cfg__' }],
                    fees: [],
                    ltm: { fee: t.ltm },
                    trace: { tierTable: rows.map(function (r) { return { minQty: r.min }; }) }
                });
            }
        };
    }

    /** renderMatrix() is async — poll until the table lands. */
    async function waitForTable() {
        for (let i = 0; i < 80; i++) {
            const table = document.querySelector('#cfgMatrix .tier-table');
            if (table && table.querySelectorAll('tbody tr').length >= 2) return table;
            await new Promise(function (r) { setTimeout(r, 10); });
        }
        throw new Error('matrix table never rendered: ' + document.getElementById('cfgMatrix').innerHTML);
    }

    afterEach(() => {
        delete window.QuoteCartEngine;
        delete window.EmbroideryPricingService;
    });

    test('the fee is a pill, and the free tiers say "No fee" — never a bare em dash', async () => {
        stubEngine();
        window.PdpConfigurator.init(ctx(EMB_ONLY));
        const table = await waitForTable();

        const feeCells = Array.from(table.querySelectorAll('tbody tr:nth-child(2) td')).slice(1);
        expect(feeCells).toHaveLength(5);

        // 1-7 carries the charge, as a pill with its "per order" unit spelled out.
        expect(feeCells[0].querySelector('.tier-fee-yes').textContent).toBe('+$50.00');
        expect(feeCells[0].querySelector('.tier-fee-unit').textContent).toBe('per order');

        // Every other tier states the absence explicitly.
        feeCells.slice(1).forEach(function (td) {
            expect(td.querySelector('.tier-fee-no').textContent).toBe('No fee');
            expect(td.textContent).not.toContain('—');
        });
    });

    test('the note names the threshold and, here, that the fee IS the whole difference', async () => {
        stubEngine();
        window.PdpConfigurator.init(ctx(EMB_ONLY));
        await waitForTable();

        const note = document.querySelector('#cfgMatrix .pdp-cfg-fee-note');
        expect(note).not.toBeNull();
        expect(note.textContent).toContain('Orders under 8 pieces add a one-time $50.00 small-order fee.');
        // 1-7 and 8-23 are both $177.50, so the identical-price clause applies.
        expect(note.textContent).toContain('At 1-7 and 8-23 the per-piece price is identical');
        expect(note.textContent).toContain('the fee is the whole difference');
    });

    test('the identical-price clause is dropped when the prices actually differ', async () => {
        stubEngine([
            { label: '1-7', min: 1, max: 7, price: 190.00, ltm: 50 },
            { label: '8-23', min: 8, max: 23, price: 177.50, ltm: 0 },
            { label: '24-47', min: 24, max: 47, price: 173.50, ltm: 0 },
            { label: '48-71', min: 48, max: 71, price: 172.50, ltm: 0 },
            { label: '72+', min: 72, max: Infinity, price: 171.50, ltm: 0 }
        ]);
        window.PdpConfigurator.init(ctx(EMB_ONLY));
        await waitForTable();

        const note = document.querySelector('#cfgMatrix .pdp-cfg-fee-note');
        expect(note.textContent).toContain('Orders under 8 pieces add a one-time $50.00 small-order fee.');
        expect(note.textContent).not.toContain('identical');
    });

    test('a ladder with no small-order fee renders neither the row nor the note', async () => {
        stubEngine(LADDER.map(function (t) { return Object.assign({}, t, { ltm: 0 }); }));
        window.PdpConfigurator.init(ctx(EMB_ONLY));
        const table = await waitForTable().catch(function () { return null; });

        // Only the price row survives, and no fee note is emitted.
        const rows = document.querySelectorAll('#cfgMatrix .tier-table tbody tr');
        expect(rows).toHaveLength(1);
        expect(document.querySelector('#cfgMatrix .pdp-cfg-fee-note')).toBeNull();
        expect(table === null || rows.length === 1).toBe(true);
    });

    test('the fee styling does not steal the active-tier highlight', async () => {
        stubEngine();
        window.PdpConfigurator.init(ctx(EMB_ONLY));
        await waitForTable();

        // Default qty 24 highlights its own tier.
        expect(document.querySelector('#cfgMatrix thead th.is-active-tier').textContent).toBe('24-47');

        // Drop to 4: that column is now BOTH the active tier and the fee tier.
        // The qty input debounces 350ms before repricing, hence the poll.
        const input = document.getElementById('cfgQtyInput');
        input.value = '4';
        input.dispatchEvent(new window.Event('input', { bubbles: true }));

        let activeHeader = null;
        for (let i = 0; i < 150; i++) {
            activeHeader = document.querySelector('#cfgMatrix thead th.is-active-tier');
            if (activeHeader && activeHeader.textContent === '1-7') break;
            await new Promise(function (r) { setTimeout(r, 10); });
        }
        expect(activeHeader).not.toBeNull();
        expect(activeHeader.textContent).toBe('1-7');

        // The fee cell in that column keeps BOTH signals: the highlight and the pill.
        const feeCell = document.querySelector('#cfgMatrix tbody tr:nth-child(2) td:nth-child(2)');
        expect(feeCell.classList.contains('is-active-tier')).toBe(true);
        expect(feeCell.querySelector('.tier-fee-yes').textContent).toBe('+$50.00');
    });
});
