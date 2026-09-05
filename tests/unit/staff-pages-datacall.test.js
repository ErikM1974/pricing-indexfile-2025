/**
 * @jest-environment jsdom
 *
 * Staff-dashboard sweep batch 2 (2026-09-05): the pages that used to render inline onclick=
 * handlers now use the shared data-call delegator. This locks
 *   1. no onclick= left in those pages or the modules that render their markup,
 *   2. each page loads /shared_components/js/data-call-delegator.js,
 *   3. the delegator itself behaves (args, $this, dotted names, data-href, data-stop, missing fn).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const PAGES = [
    'admin/universal-records-admin.html',
    'calculators/embroidery-pricing-all/index.html',
    'dashboards/art-hub-ruth.html',
    'calculators/screenprint-customer/index.html',
    'dashboards/names-numbers-dashboard.html',
    'dashboards/art-hub-steve.html',
    'dashboards/commission-structure.html',
    'calculators/manual-pricing.html',
    'dashboards/monogram-dashboard.html',
    'pages/data-entry-guide.html',
    'dashboards/nika-crm.html',
    'dashboards/taneisha-crm.html',
    'dashboards/house-accounts.html',
    'dashboards/portal-directory.html',
];
const MODULES = [
    'admin/js/universal-records-admin.js',
    'calculators/embroidery-pricing-all/embroidery-pricing-all.js',
    'shared_components/js/mockup-ruth.js',
    'shared_components/js/names-numbers-dashboard.js',
    'shared_components/js/art-hub-steve.js',
    'dashboards/js/portal-directory.js',
    'dashboards/js/house-accounts.js',
    'shared_components/js/monogram-dashboard.js',
];

describe('staff pages: onclick → data-call', () => {
    test.each(PAGES)('%s has no onclick= and loads the delegator', (rel) => {
        const html = strip(read(rel));
        expect(html).not.toMatch(/\sonclick=/);
        expect(html).toMatch(/\/shared_components\/js\/data-call-delegator\.js/);
    });
    test.each(MODULES)('%s renders no onclick=', (rel) => {
        expect(strip(read(rel))).not.toMatch(/onclick="/);
    });
    test('lexical globals the templates call are exposed on window', () => {
        expect(read('calculators/manual-pricing.js')).toMatch(/window\.manualCalc = manualCalc/);
        expect(read('shared_components/js/names-numbers-dashboard.js')).toMatch(/window\.dashboard = dashboard/);
    });
});

describe('data-call-delegator.js behaviour', () => {
    beforeAll(() => {
        document.body.innerHTML = `
            <div id="outer">
              <button id="b1" data-call="spy" data-args='[3, "PC54", "$this"]'>go</button>
            </div>
            <button id="b2" data-call="nested.fn" data-stop="1">n</button>
            <button id="b3" data-call="nope">x</button>
            <a id="b4" href="#" data-call="spy" data-args='["$event"]'>link</a>
            <div id="hid" class="x"></div><button id="b5" data-toggle-hidden="hid">t</button>
            <div id="row" data-call="spy" data-args='["row"]'><span id="cell" data-stop="1"><span id="inner">i</span></span></div>`;
        window.__nwcaDataCallDelegator = undefined;
        // eslint-disable-next-line no-new-func
        new Function(read('shared_components/js/data-call-delegator.js'))();
    });
    test('args, $this, dotted names with this-binding, data-stop, data-toggle-hidden, missing fn', () => {
        const calls = [];
        window.spy = (...a) => calls.push(a);
        window.nested = { fn() { calls.push(['nested', this === window.nested]); } };
        const errors = [];
        const origErr = console.error; console.error = (m) => errors.push(String(m));
        let outer = 0; document.getElementById('outer').addEventListener('click', () => outer++);
        document.getElementById('b1').click();
        expect(calls[0][0]).toBe(3); expect(calls[0][1]).toBe('PC54'); expect(calls[0][2]).toBe(document.getElementById('b1'));
        expect(outer).toBe(1);
        document.getElementById('b2').click();
        expect(calls.pop()).toEqual(['nested', true]);
        document.getElementById('b3').click();
        expect(errors.some((e) => /isn't available \(nope\)/.test(e))).toBe(true);
        document.getElementById('b4').click();
        expect(calls.pop()[0]).toBeInstanceOf(Event);
        document.getElementById('b5').click();
        expect(document.getElementById('hid').classList.contains('hidden')).toBe(true);
        const before = calls.length;
        document.getElementById('inner').click(); // the inner data-stop wins over the row's data-call (old td onclick="event.stopPropagation()" semantics)
        expect(calls.length).toBe(before);
        console.error = origErr;
    });
});
