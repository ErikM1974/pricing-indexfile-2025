/**
 * Sample request → Leads card (2026-09-07, Erik: "fix the sample card").
 *
 * memory/sample-request-routing.md lists three traps that were caught only by review, never by a test:
 *   1. the `sample-request` form id must exist in EVERY app-side vocabulary site (badge map, status choices,
 *      lead form list, source meta, drag map, Inbox chip, CSS) — miss one and the row saves but stays invisible
 *      or, worse, closes as a $0 "Completed" win;
 *   2. 'House' is the dropdown DEFAULT, not a rep — it must be sent as '' so auto-assign runs;
 *   3. the endpoint requires a company; the form does not — it must fall back so a lead is never rejected.
 * Live check 2026-09-07: no SRQ row has ever landed (`/api/crm-proxy/form-submissions?formIds=sample-request`
 * → []), so the code path is still unproven on a real request. These lock what the code promises meanwhile.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

function literal(src, name) {
    // `var NAME = { ... };` → the object literal, evaluated (no functions inside these maps)
    const m = src.match(new RegExp(`var ${name} = (\\{[\\s\\S]*?\\n\\s*\\});`));
    if (!m) throw new Error('literal missing: ' + name);
    return new Function('return ' + m[1].replace(/\/\/[^\n]*/g, ''))();
}

describe('the sample-request form id is in every app-side vocabulary site', () => {
    const leadsCommon = read('dashboards/js/leads-common.js');
    const inbox = read('dashboards/js/form-submissions.js');
    test('leads-common: form list, source meta, status choices, drag map', () => {
        expect(leadsCommon).toMatch(/var LEAD_FORM_IDS = \[[^\]]*'sample-request'/);
        expect(literal(leadsCommon, 'SOURCE_META')['sample-request']).toEqual({ label: 'Sample Request', icon: 'fa-shirt' });
        expect(literal(leadsCommon, 'STATUS_CHOICES')['sample-request']).toEqual(['New', 'Contacted', 'Quoted', 'Won', 'Lost', 'Archived']);
        expect(literal(leadsCommon, 'DRAG_STATUS')['sample-request']).toEqual({ new: 'New', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost' });
    });
    test('Forms Inbox: badge, status choices (never the ["New","Completed"] fallback — Completed is a WON status), chip, CSS', () => {
        expect(literal(inbox, 'STATUS_CHOICES')['sample-request']).toEqual(['New', 'Contacted', 'Quoted', 'Won', 'Lost', 'Archived']);
        expect(inbox).toMatch(/'sample-request': \{ label: 'Sample Request', icon: 'fa-shirt', cls: 'badge--srq' \}/);
        expect(read('dashboards/form-submissions.html')).toMatch(/data-form="quote-request,sample-request,manual-lead"/);
        expect(read('dashboards/css/form-submissions.css')).toMatch(/\.badge--srq \{/);
    });
    test('every lead form the Inbox can show has its pipeline there, identical to leads-common', () => {
        const a = literal(leadsCommon, 'STATUS_CHOICES'); const b = literal(inbox, 'STATUS_CHOICES');
        const inboxForms = Object.keys(literal(inbox, 'FORM_META'));
        const leadForms = leadsCommon.match(/var LEAD_FORM_IDS = \[([^\]]*)\]/)[1].match(/'([^']+)'/g).map((s) => s.replace(/'/g, ''));
        for (const id of leadForms.filter((f) => inboxForms.includes(f))) {
            expect({ id, choices: b[id] }).toEqual({ id, choices: a[id] });
        }
    });
});

describe('createSampleLead (pages/js/sample-cart-page.js) posts a lead the board can route', () => {
    const src = read('pages/js/sample-cart-page.js');
    const start = src.indexOf('async function createSampleLead(');
    const end = src.indexOf('\n}\n', start) + 3;
    const fnSrc = src.slice(start, end);

    function run(customer, items, opts = {}) {
        const calls = [];
        const errors = [];
        const fetchImpl = async (url, o) => { calls.push({ url, body: JSON.parse(o.body) }); return opts.fail ? { ok: false, status: 500 } : { ok: true, json: async () => ({ submissionId: 'SRQ0907-1234' }) }; };
        const APP_CONFIG = opts.noConfig ? {} : { API: { BASE_URL: 'https://proxy.test/' } };
        const fn = new Function('readSampleLeadStash', 'window', 'APP_CONFIG', 'fetch', 'console',
            fnSrc + '\nreturn createSampleLead;');
        const createSampleLead = fn(() => opts.stash || null, { APP_CONFIG }, APP_CONFIG, fetchImpl, { error: (...a) => errors.push(a.join(' ')) });
        return createSampleLead('NWCA-SAMPLE-0907-1-123', customer, items).then(() => ({ calls, errors }));
    }
    const items = [{ style: 'PC61', name: 'Essential Tee', color: 'Jet Black', catalogColor: 'JetBlack', sizes: { M: 1, L: 2 } }];

    test('House (the dropdown default) is sent as a blank rep so auto-assign runs; payload is the house shape', async () => {
        const { calls } = await run({ firstName: 'Cory', lastName: 'Kelly', company: 'Inland Beef', email: 'c@x.com', phone: '555', salesRep: 'House', shippingMethod: 'UPS Ground' }, items);
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('https://proxy.test/api/form-submissions');
        const b = calls[0].body;
        expect(b).toMatchObject({ formId: 'sample-request', company: 'Inland Beef', contactName: 'Cory Kelly', salesRep: '', summary: '3 free samples · PC61 · NWCA-SAMPLE-0907-1-123' });
        expect(b.payload.fields).toEqual(expect.arrayContaining([['ShopWorks Order', 'NWCA-SAMPLE-0907-1-123'], ['Rep chosen', 'House']]));
        expect(b.payload.tables[0].rows).toEqual([['PC61', 'Essential Tee', 'Jet Black', 'M(1) L(2)']]);
        expect(b.payload.items[0].catalogColor).toBe('JetBlank'.replace('Blank', 'Black'));
    });

    test('a real rep is passed through; a missing company falls back to the person, then to a label', async () => {
        const a = await run({ firstName: 'Ann', lastName: 'Lee', salesRep: 'Taneisha Clark' }, items);
        expect(a.calls[0].body).toMatchObject({ salesRep: 'Taneisha Clark', company: 'Ann Lee' });
        const b = await run({ salesRep: '' }, items);
        expect(b.calls[0].body.company).toBe('Sample request');
    });

    test('never throws: a lead already stashed by an AE → no second row; a failed POST is logged, the order still stands', async () => {
        const stashed = await run({ firstName: 'A' }, items, { stash: { submissionId: 'SRQ0901-0001' } });
        expect(stashed.calls).toEqual([]);
        const failed = await run({ firstName: 'A' }, items, { fail: true });
        expect(failed.calls).toHaveLength(1);
        expect(failed.errors[0]).toMatch(/request NOT added to Leads \(order NWCA-SAMPLE-0907-1-123 WAS still placed\)/);
        const noCfg = await run({ firstName: 'A' }, items, { noConfig: true });
        expect(noCfg.calls).toEqual([]);
        expect(noCfg.errors[0]).toMatch(/APP_CONFIG\.API\.BASE_URL missing/);
    });
});
