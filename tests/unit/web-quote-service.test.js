/**
 * web-quote-service.test.js — Phase 3 customer quote-cart SAVE contract lock.
 *
 * Locks shared_components/js/web-quote-service.js (WQ prefix):
 *   - QuoteID minting via GET /api/quote-sequence/WQ (+ visible fallback)
 *   - pre-save PARITY GATE (forceRefresh reprice; >1¢ move → PRICING_CHANGED,
 *     nothing saved)
 *   - quote_sessions / quote_items payload shapes vs goldens for a MIXED
 *     EMB+DTG cart (items FOOT to the engine group totals; fee/service rows
 *     follow the builders' EmbellishmentType:'fee' + service-code convention;
 *     SubtotalAmount === TotalAmount === engine grandTotal; TaxRate/TaxAmount 0;
 *     NO method-specific session columns — the 2026-06-04 phantom-default rule)
 *   - FOOTING_MISMATCH abort (rows that don't foot are never saved)
 *   - email behavior: reuses the existing service_jgrave3/template_quote_email,
 *     fire-and-forget (failure/absence never fails a save)
 *   - dry-run: payloads logged + returned, ZERO POSTs (preview walk-throughs)
 *
 * ALL network access is mocked — no Caspio rows are ever created here.
 */

const WebQuoteService = require('../../shared_components/js/web-quote-service.js');

// ---------------------------------------------------------------------------
// Engine-result fixtures — shapes copied from quote-cart-engine.js adapters,
// dollar values from the design doc's locked worked examples:
//   EMB (b): 5× PC61 tier 1-7, unit $25, $50 LTM baked → $35.00 effective
//            (+ $10/pc AL line + $100 DD digitizing added to exercise rows)
//   DTG (a): 24× PC61 LC tier 24-47 → $14.50/pc, $348.00
// ---------------------------------------------------------------------------
function embGroup() {
    return {
        method: 'EMB',
        groupId: 'emb:garment',
        pooledQty: 5,
        tierLabel: '1-7',
        lines: [{
            itemId: 'item-emb', styleNumber: 'PC61', color: 'Jet Black',
            label: 'S(2) M(2) L(1)', qty: 5,
            baseUnit: 25, effectiveUnit: 35, effectiveUnitDisplay: 35, lineTotal: 125
        }],
        serviceLines: [{ code: 'AL', label: 'Additional Logo - Back (8,000 stitches)', unitPrice: 10, quantity: 5, total: 50 }],
        fees: [{ code: 'DD', label: 'Digitizing / design setup', amount: 100, oneTime: true }],
        ltm: { fee: 50, perUnit: 10, mode: 'baked' },
        subtotal: 125,
        groupTotal: 325, // 125 products + 50 LTM (baked) + 50 AL + 100 DD
        nudge: null,
        trace: { source: 'emb-calculator' }
    };
}

function dtgGroup() {
    return {
        method: 'DTG',
        groupId: 'dtg:main',
        pooledQty: 24,
        tierLabel: '24-47',
        lines: [{
            itemId: 'item-dtg', styleNumber: 'PC61', color: 'White',
            label: 'M(24)', size: 'M', qty: 24,
            baseUnit: 14.5, effectiveUnit: 14.5, effectiveUnitDisplay: 14.5, lineTotal: 348
        }],
        serviceLines: [],
        fees: [],
        ltm: { fee: 0, perUnit: 0, mode: 'baked' },
        subtotal: 348,
        groupTotal: 348,
        nudge: null,
        trace: { source: 'dtg-endpoint' }
    };
}

function mixedResult() {
    const groups = [embGroup(), dtgGroup()];
    return { groups, grandTotal: 673, warnings: [], errors: [] };
}

// SCP itemized-LTM scenario (worked-example style): 20 pcs, base $14.50/pc,
// $75 LTM ITEMIZED + 2-screen setup $60 — product rows foot at BASE price,
// the fees carry LTM + SPSU.
function scpResult() {
    return {
        groups: [{
            method: 'SCP',
            groupId: 'scp:design-1',
            pooledQty: 20,
            tierLabel: '13-36',
            lines: [{
                itemId: 'item-scp', styleNumber: 'PC54', color: 'Navy',
                label: 'M(20)', size: 'M', qty: 20,
                baseUnit: 14.5, effectiveUnit: 18.25, effectiveUnitDisplay: 18.25, lineTotal: 290
            }],
            serviceLines: [],
            fees: [
                { code: 'SPSU', label: 'Screen setup — 2 screens × $30', amount: 60, oneTime: true },
                { code: 'LTM', label: 'Small order fee', amount: 75, oneTime: false }
            ],
            ltm: { fee: 75, perUnit: 3.75, mode: 'itemized' },
            subtotal: 290,
            groupTotal: 425,
            nudge: null,
            trace: { source: 'scp-replica' }
        }],
        grandTotal: 425, warnings: [], errors: []
    };
}

const STORE_ITEMS = [
    { id: 'item-emb', style: 'PC61', productTitle: 'Port & Company Essential Tee', color: 'Jet Black', catalogColor: 'JetBlack', qty: 5, sizes: { S: 2, M: 2, L: 1 }, method: 'EMB', isCap: false },
    { id: 'item-dtg', style: 'PC61', productTitle: 'Port & Company Essential Tee', color: 'White', catalogColor: 'White', qty: 24, sizes: { M: 24 }, method: 'DTG', isCap: false }
];

const CART = {
    items: [
        { id: 'item-emb', method: 'EMB', styleNumber: 'PC61', colorName: 'Jet Black', catalogColor: 'JetBlack', sizes: { S: 2, M: 2, L: 1 }, isCap: false },
        { id: 'item-dtg', method: 'DTG', styleNumber: 'PC61', colorName: 'White', catalogColor: 'White', sizes: { M: 24 }, isCap: false }
    ],
    groups: {
        'emb:garment': { logos: { primary: { position: 'Left Chest', stitchCount: 8000, needsDigitizing: true }, additional: [{ position: 'Back', stitchCount: 8000 }] } },
        'dtg:main': { locationCode: 'LC' }
    }
};

const CUSTOMER = { name: 'Jane Smith', email: 'jane@acme.com', phone: '253-555-0100', company: 'Acme Co.', notes: 'Need names & numbers on 6 of the tees.' };
const ARTWORK = [{ groupId: 'emb:garment', externalKey: 'abc123', fileName: 'logo.png', url: 'https://api.test/api/files/abc123' }];

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
function makeMocks(opts = {}) {
    const posts = { sessions: [], items: [] };
    let itemFailuresLeft = opts.failItems || 0;
    const fetchMock = jest.fn(async (url, fetchOpts = {}) => {
        url = String(url);
        const method = (fetchOpts.method || 'GET').toUpperCase();
        if (url.includes('/api/quote-sequence/WQ')) {
            if (opts.sequenceDown) return { ok: false, status: 503, json: async () => ({}), text: async () => 'down' };
            return { ok: true, status: 200, json: async () => ({ prefix: 'WQ', year: 2026, sequence: 42 }), text: async () => '' };
        }
        if (method === 'POST' && url.includes('/api/quote_sessions')) {
            if (opts.sessionFails) return { ok: false, status: 500, json: async () => ({}), text: async () => 'caspio error' };
            posts.sessions.push(JSON.parse(fetchOpts.body));
            return { ok: true, status: 201, json: async () => ({}), text: async () => '' };
        }
        if (method === 'POST' && url.includes('/api/quote_items')) {
            if (itemFailuresLeft > 0) {
                itemFailuresLeft--;
                return { ok: false, status: 400, json: async () => ({}), text: async () => 'bad item' };
            }
            posts.items.push(JSON.parse(fetchOpts.body));
            return { ok: true, status: 201, json: async () => ({}), text: async () => '' };
        }
        throw new Error('Unmocked URL in test: ' + method + ' ' + url);
    });
    const engine = { priceCart: jest.fn(async () => opts.freshResult || mixedResult()) };
    return { fetchMock, engine, posts };
}

function makeService(mocks, extra = {}) {
    return new WebQuoteService(Object.assign({
        apiBase: 'https://api.test',
        fetch: mocks.fetchMock,
        engine: mocks.engine,
        emailjs: extra.emailjs !== undefined ? extra.emailjs : null
    }, extra));
}

function savePayload(overrides = {}) {
    return Object.assign({
        cart: CART,
        storeItems: STORE_ITEMS,
        displayedResult: mixedResult(),
        customer: CUSTOMER,
        artwork: ARTWORK,
        engineOptions: {}
    }, overrides);
}

// ---------------------------------------------------------------------------
describe('QuoteID minting (WQ prefix)', () => {
    test('formats WQ-{year}-{NNN} from /api/quote-sequence/WQ (EMB pattern with WQ prefix)', async () => {
        const mocks = makeMocks();
        const svc = makeService(mocks);
        const id = await svc.generateQuoteID();
        expect(id.quoteId).toBe('WQ-2026-042');
        expect(id.usedFallback).toBe(false);
        expect(mocks.fetchMock).toHaveBeenCalledWith('https://api.test/api/quote-sequence/WQ');
    });

    test('sequence API down → WQmmdd-nnnn fallback flagged for a visible warning', async () => {
        const mocks = makeMocks({ sequenceDown: true });
        const svc = makeService(mocks);
        const id = await svc.generateQuoteID();
        expect(id.quoteId).toMatch(/^WQ\d{4}-\d{4}$/);
        expect(id.usedFallback).toBe(true);
    });
});

describe('Pre-save parity gate (forceRefresh reprice)', () => {
    test('re-runs priceCart with forceRefresh:true', async () => {
        const mocks = makeMocks();
        const svc = makeService(mocks);
        await svc.saveQuote(savePayload());
        expect(mocks.engine.priceCart).toHaveBeenCalledTimes(1);
        expect(mocks.engine.priceCart.mock.calls[0][1]).toMatchObject({ forceRefresh: true });
    });

    test('a group total moving > $0.01 returns PRICING_CHANGED and saves NOTHING', async () => {
        const fresh = mixedResult();
        fresh.groups[0].groupTotal = 326; // +$1.00 vs displayed 325
        fresh.grandTotal = 674;
        const mocks = makeMocks({ freshResult: fresh });
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload());
        expect(res.success).toBe(false);
        expect(res.code).toBe('PRICING_CHANGED');
        expect(res.fresh.grandTotal).toBe(674);
        expect(res.changed).toEqual([{ groupId: 'emb:garment', was: 325, now: 326 }]);
        expect(mocks.posts.sessions).toHaveLength(0);
        expect(mocks.posts.items).toHaveLength(0);
    });

    test('a ≤1¢ move passes the gate (tolerance, custom-tees pattern)', async () => {
        const fresh = mixedResult();
        fresh.groups[1].groupTotal = 348.01;
        fresh.grandTotal = 673.01;
        const mocks = makeMocks({ freshResult: fresh });
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload());
        expect(res.success).toBe(true);
        expect(mocks.posts.sessions).toHaveLength(1);
    });

    test('engine errors (grandTotal withheld) → PRICING_FAILED, nothing saved', async () => {
        const mocks = makeMocks({
            freshResult: { groups: [], grandTotal: null, warnings: [], errors: [{ groupId: 'dtg:main', code: 'API_ERROR', message: 'DTG pricing endpoint failed' }] }
        });
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload());
        expect(res.success).toBe(false);
        expect(res.code).toBe('PRICING_FAILED');
        expect(mocks.posts.sessions).toHaveLength(0);
    });
});

describe('quote_sessions payload (mixed EMB+DTG golden)', () => {
    let session;
    beforeAll(async () => {
        const mocks = makeMocks();
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload());
        expect(res.success).toBe(true);
        session = mocks.posts.sessions[0];
    });

    test('identity + status + rep routing', () => {
        expect(session.QuoteID).toBe('WQ-2026-042');
        expect(session.SessionID).toMatch(/^web_quote_cart_\d+_/);
        expect(session.Status).toBe('Web Quote Request');
        expect(session.SalesRepEmail).toBe('sales@nwcustomapparel.com');
        expect(session.CustomerName).toBe('Jane Smith');
        expect(session.CustomerEmail).toBe('jane@acme.com');
        expect(session.CompanyName).toBe('Acme Co.');
        expect(session.Phone).toBe('253-555-0100');
    });

    test("readers' contract: SubtotalAmount === TotalAmount === engine grandTotal (pre-tax all-in)", () => {
        expect(session.SubtotalAmount).toBe(673);
        expect(session.TotalAmount).toBe(673);
        expect(session.TotalQuantity).toBe(29);
        expect(session.LTMFeeTotal).toBe(50); // informational (baked)
    });

    test('tax deferred to the rep: TaxRate/TaxAmount 0 + documented taxNote', () => {
        expect(session.TaxRate).toBe(0);
        expect(session.TaxAmount).toBe(0);
        const notes = JSON.parse(session.Notes);
        expect(notes.channel).toBe('web-quote-cart');
        expect(notes.taxNote).toMatch(/rep/i);
        expect(notes.customerNotes).toBe(CUSTOMER.notes);
    });

    test('Notes JSON carries the groups summary + artworkKeys', () => {
        const notes = JSON.parse(session.Notes);
        expect(notes.groups).toHaveLength(2);
        expect(notes.groups[0]).toMatchObject({ groupId: 'emb:garment', method: 'EMB', tierLabel: '1-7', pooledQty: 5, groupTotal: 325 });
        expect(notes.groups[1]).toMatchObject({ groupId: 'dtg:main', method: 'DTG', tierLabel: '24-47', groupTotal: 348 });
        expect(notes.artworkKeys).toEqual([{ groupId: 'emb:garment', externalKey: 'abc123', fileName: 'logo.png', url: 'https://api.test/api/files/abc123' }]);
        const importNotes = JSON.parse(session.ImportNotes);
        expect(importNotes.referenceArtwork).toEqual(['https://api.test/api/files/abc123']);
    });

    test('NO method-specific session columns (2026-06-04 phantom-default rule)', () => {
        ['PrintLocation', 'StitchCount', 'DigitizingFee', 'CapPrintLocation', 'CapStitchCount',
            'AdditionalLogoLocation', 'ALChargeGarment', 'GarmentStitchCharge'].forEach((col) => {
                expect(session).not.toHaveProperty(col);
            });
    });
});

describe('quote_items payload (mixed EMB+DTG golden)', () => {
    let items;
    beforeAll(async () => {
        const mocks = makeMocks();
        const svc = makeService(mocks);
        await svc.saveQuote(savePayload());
        items = mocks.posts.items;
    });

    test('row count + sequential LineNumbers (EMB product, AL, DD, DTG product)', () => {
        expect(items).toHaveLength(4);
        expect(items.map((i) => i.LineNumber)).toEqual([1, 2, 3, 4]);
        expect(items.map((i) => i.StyleNumber)).toEqual(['PC61', 'AL', 'DD', 'PC61']);
    });

    test('EMB product row: baked-LTM billing (FinalUnitPrice = effective, LineTotal = effective × qty)', () => {
        const row = items[0];
        expect(row).toMatchObject({
            QuoteID: 'WQ-2026-042',
            StyleNumber: 'PC61',
            ProductName: 'Port & Company Essential Tee - Jet Black',
            Color: 'Jet Black',
            ColorCode: 'JetBlack',          // CATALOG_COLOR (two-color-field rule)
            EmbellishmentType: 'embroidery',
            PrintLocation: 'Left Chest + Back',
            Quantity: 5,
            HasLTM: 'Yes',
            // Staff EMB convention: BaseUnitPrice ALSO carries the billed
            // (LTM-inclusive) unit so quote-view's Unit × Qty = Total reads
            // true; pre-LTM base = FinalUnitPrice − LTMPerUnit.
            BaseUnitPrice: 35,
            LTMPerUnit: 10,
            FinalUnitPrice: 35,
            LineTotal: 175,                 // 35 × 5 — LTM inside, no separate row
            PricingTier: '1-7'
        });
        expect(JSON.parse(row.SizeBreakdown)).toEqual({ S: 2, M: 2, L: 1 });
        const specs = JSON.parse(row.LogoSpecs);
        expect(specs.method).toBe('EMB');
        expect(specs.options.logos.primary.position).toBe('Left Chest');
    });

    test("service + fee rows follow the builders' convention (EmbellishmentType 'fee', StyleNumber = code)", () => {
        expect(items[1]).toMatchObject({
            StyleNumber: 'AL', EmbellishmentType: 'fee',
            Quantity: 5, BaseUnitPrice: 10, FinalUnitPrice: 10, LineTotal: 50, HasLTM: 'No'
        });
        expect(items[2]).toMatchObject({
            StyleNumber: 'DD', EmbellishmentType: 'fee',
            Quantity: 1, FinalUnitPrice: 100, LineTotal: 100
        });
    });

    test('DTG product row: per-size line, location code + name, no LTM', () => {
        const row = items[3];
        expect(row).toMatchObject({
            StyleNumber: 'PC61',
            Color: 'White',
            ColorCode: 'White',
            EmbellishmentType: 'dtg',
            PrintLocation: 'LC',
            PrintLocationName: 'Left Chest',
            Quantity: 24,
            HasLTM: 'No',
            BaseUnitPrice: 14.5,
            FinalUnitPrice: 14.5,
            LineTotal: 348,
            PricingTier: '24-47'
        });
        expect(JSON.parse(row.SizeBreakdown)).toEqual({ M: 24 });
        expect(JSON.parse(row.LogoSpecs)).toMatchObject({ method: 'DTG', options: { locationCode: 'LC' } });
    });

    test('FOOTING: items sum to every group total and the grand total exactly', () => {
        const embRows = items.slice(0, 3);
        const dtgRows = items.slice(3);
        const sum = (rows) => rows.reduce((s, r) => s + r.LineTotal, 0);
        expect(sum(embRows)).toBe(325);  // engine emb groupTotal
        expect(sum(dtgRows)).toBe(348);  // engine dtg groupTotal
        expect(sum(items)).toBe(673);    // === session.TotalAmount (readers foot from line items)
    });
});

describe('SCP itemized-LTM convention', () => {
    test('product rows bill at BASE unit; LTM + SPSU save as fee rows; everything foots', async () => {
        const mocks = makeMocks({ freshResult: scpResult() });
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload({
            cart: {
                items: [{ id: 'item-scp', method: 'SCP', styleNumber: 'PC54', colorName: 'Navy', catalogColor: 'Navy', sizes: { M: 20 }, isCap: false }],
                groups: { 'scp:design-1': { frontColors: 2, backColors: 0, darkGarment: false, safetyStripes: false } }
            },
            storeItems: [{ id: 'item-scp', style: 'PC54', productTitle: 'Core Cotton Tee', color: 'Navy', catalogColor: 'Navy', qty: 20, sizes: { M: 20 }, method: 'SCP', isCap: false }],
            displayedResult: scpResult(),
            artwork: []
        }));
        expect(res.success).toBe(true);
        const items = mocks.posts.items;
        expect(items.map((i) => i.StyleNumber)).toEqual(['PC54', 'SPSU', 'LTM']);
        expect(items[0]).toMatchObject({
            EmbellishmentType: 'screenprint', HasLTM: 'No', LTMPerUnit: 0,
            FinalUnitPrice: 14.5, LineTotal: 290 // BASE price — LTM is its own row
        });
        expect(items[1]).toMatchObject({ EmbellishmentType: 'fee', LineTotal: 60 });
        expect(items[2]).toMatchObject({ EmbellishmentType: 'fee', LineTotal: 75, ProductName: 'Small order fee' });
        expect(items.reduce((s, r) => s + r.LineTotal, 0)).toBe(425); // groupTotal + grandTotal
    });
});

describe('Footing assert + save robustness', () => {
    test('rows that do not foot to the engine total → FOOTING_MISMATCH, nothing saved', async () => {
        const corrupt = mixedResult();
        corrupt.groups[0].groupTotal = 999; // rows will foot to 325, not 999
        corrupt.grandTotal = 1347;
        const mocks = makeMocks({ freshResult: corrupt });
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload({ displayedResult: corrupt }));
        expect(res.success).toBe(false);
        expect(res.code).toBe('FOOTING_MISMATCH');
        expect(mocks.posts.sessions).toHaveLength(0);
        expect(mocks.posts.items).toHaveLength(0);
    });

    test('session POST failure → SAVE_FAILED with the upstream detail', async () => {
        const mocks = makeMocks({ sessionFails: true });
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload());
        expect(res.success).toBe(false);
        expect(res.code).toBe('SAVE_FAILED');
        expect(mocks.posts.items).toHaveLength(0);
    });

    test('item POST failures surface as partialSave + visible warning (never silent)', async () => {
        const mocks = makeMocks({ failItems: 1 });
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload());
        expect(res.success).toBe(true);
        expect(res.partialSave).toBe(true);
        expect(res.warning).toMatch(/1 of 4/);
    }, 15000); // _fetchWithRetry backs off 1s+2s on the failed item

    test('share link points at /quote/{quoteId}', async () => {
        const mocks = makeMocks();
        const svc = makeService(mocks);
        const res = await svc.saveQuote(savePayload());
        expect(res.sharePath).toBe('/quote/WQ-2026-042');
        expect(res.shareUrl).toMatch(/\/quote\/WQ-2026-042$/);
    });
});

describe('Emails (fire-and-forget, existing template reuse)', () => {
    test('sends customer copy + sales alert via service_jgrave3/template_quote_email', async () => {
        const emailjs = { send: jest.fn(async () => ({ status: 200 })), init: jest.fn() };
        const svc = makeService(makeMocks(), { emailjs });
        const out = await svc.sendEmails({ quoteId: 'WQ-2026-042', shareUrl: 'https://www.teamnwca.com/quote/WQ-2026-042', customer: CUSTOMER });
        expect(out).toMatchObject({ customerSent: true, salesSent: true, skipped: false });
        expect(emailjs.send).toHaveBeenCalledTimes(2);
        const [svcId1, tpl1, params1] = emailjs.send.mock.calls[0];
        expect(svcId1).toBe('service_jgrave3');
        expect(tpl1).toBe('template_quote_email');
        expect(params1).toMatchObject({
            to_email: 'jane@acme.com',
            quote_id: 'WQ-2026-042',
            quote_link: 'https://www.teamnwca.com/quote/WQ-2026-042',
            reply_to: 'sales@nwcustomapparel.com'
        });
        const [, , params2] = emailjs.send.mock.calls[1];
        expect(params2.to_email).toBe('sales@nwcustomapparel.com');
        expect(params2.reply_to).toBe('jane@acme.com'); // rep replies straight to the customer
        expect(params2.customer_name).toMatch(/new web quote from Jane Smith \(Acme Co\.\)/);
    });

    test('email failure never throws (save already succeeded)', async () => {
        const emailjs = { send: jest.fn(async () => { throw new Error('EmailJS down'); }), init: jest.fn() };
        const svc = makeService(makeMocks(), { emailjs });
        const out = await svc.sendEmails({ quoteId: 'WQ-2026-042', shareUrl: 'x', customer: CUSTOMER });
        expect(out).toMatchObject({ customerSent: false, salesSent: false });
    });

    test('EmailJS not loaded → skipped, no throw', async () => {
        const svc = makeService(makeMocks(), { emailjs: null });
        const out = await svc.sendEmails({ quoteId: 'WQ-2026-042', shareUrl: 'x', customer: CUSTOMER });
        expect(out.skipped).toBe(true);
    });
});

describe('Dry-run (preview walk-throughs — never POSTs)', () => {
    test('returns the exact payloads, creates no Caspio rows', async () => {
        const mocks = makeMocks();
        const svc = makeService(mocks, { dryRun: true });
        const res = await svc.saveQuote(savePayload());
        expect(res.success).toBe(true);
        expect(res.dryRun).toBe(true);
        expect(res.quoteId).toBe('WQ-2026-042');
        expect(res.payloads.session.TotalAmount).toBe(673);
        expect(res.payloads.items).toHaveLength(4);
        expect(mocks.posts.sessions).toHaveLength(0);
        expect(mocks.posts.items).toHaveLength(0);
    });
});
