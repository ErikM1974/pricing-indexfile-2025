/**
 * @jest-environment jsdom
 *
 * The four quote builders — structural locks from the 2026-09-05 review. Pricing math is
 * covered elsewhere (parity + per-method tests); this locks wiring, dialogs and labels.
 *
 *   1. Rule 3 / builders rule: no onclick= in the four pages OR in the row templates the
 *      modules render — everything goes through the shared data-call delegator.
 *   2. No alert() left in the builder modules (confirm() for destructive actions stays).
 *   3. No console.log in shipped builder modules.
 *   4. The order-summary inputs (shared) and DTG's form inputs carry labels.
 *   5. Each page has a toast container so showToast is never a silent console line.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BUILDERS = ['embroidery', 'screenprint', 'dtf', 'dtg'];
const MODULE_DIRS = ['emb', 'scp', 'dtf', 'dtg'];
const modules = MODULE_DIRS.flatMap((d) => fs.readdirSync(path.join(ROOT, 'shared_components/js/builders', d)).filter((f) => f.endsWith('.js')).map((f) => `shared_components/js/builders/${d}/${f}`));
const utils = read('shared_components/js/quote-builder-utils.js');

describe('no inline handlers', () => {
    test.each(BUILDERS)('%s-quote-builder.html has no onclick= and loads the utils delegator', (b) => {
        const html = read(`quote-builders/${b}-quote-builder.html`).replace(/<!--[\s\S]*?-->/g, '');
        expect(html).not.toMatch(/\sonclick=/);
        expect(html).toMatch(/quote-builder-utils\.js/);
        expect((html.match(/data-call="/g) || []).length).toBeGreaterThan(0);
    });
    test.each(modules)('%s renders no onclick=', (rel) => {
        expect(read(rel).replace(/\/\/[^\n]*/g, '')).not.toMatch(/onclick="/);
    });
    // Classic shared scripts the builders load also render markup — same rule.
    test.each(['shared_components/js/quote-builder-utils.js', 'shared_components/js/quote-order-summary.js', 'shared_components/js/quote-extended-sizes.js'])('%s renders no onclick=', (rel) => {
        expect(read(rel).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/onclick="/);
    });
    test('the delegator exists, resolves dotted names, and toasts on a missing function', () => {
        expect(utils).toMatch(/function qbInstallCallDelegator/);
        expect(utils).toMatch(/closest\('\[data-call\], \[data-href\], \[data-toggle-hidden\], \[data-stop\]'\)/);
        expect(utils).toMatch(/name\.split\('\.'\)\.reduce/);
        expect(utils).toMatch(/isn't available \(\$\{name\}\)/);
        expect(utils).toMatch(/\$this\.dataset|\$this\./);
    });
    test('the delegator behaves (jsdom): args, $this, data-stop, data-toggle-hidden', () => {
        document.body.innerHTML = `
            <div id="hid" class="x"></div>
            <div id="outer"><button id="b1" data-call="spy" data-args='[3, "PC54", "$this"]'>go</button></div>
            <button id="b2" data-toggle-hidden="hid">t</button>
            <button id="b3" data-call="nested.fn" data-stop="1">n</button>
            <button id="b4" data-call="nope">x</button>`;
        const calls = [];
        window.spy = (...a) => calls.push(a);
        window.nested = { fn() { calls.push(['nested', this === window.nested]); } };
        const toasts = [];
        window.showToast = (m) => toasts.push(m);
        // Load the delegator function body into this window
        const src = utils.slice(utils.indexOf('function qbFocusMain'), utils.indexOf('if (typeof window !== \'undefined\') {\n    window.qbFocusMain'));
        // eslint-disable-next-line no-new-func
        new Function('showToast', src + '\nqbInstallCallDelegator();')(window.showToast);
        let outerClicks = 0;
        document.getElementById('outer').addEventListener('click', () => outerClicks++);
        document.getElementById('b1').click();
        expect(calls[0][0]).toBe(3);
        expect(calls[0][1]).toBe('PC54');
        expect(calls[0][2]).toBe(document.getElementById('b1'));
        document.getElementById('b2').click();
        expect(document.getElementById('hid').classList.contains('hidden')).toBe(true);
        document.getElementById('b3').click();
        expect(calls.pop()).toEqual(['nested', true]);
        document.getElementById('b4').click();
        expect(toasts.length).toBe(1);
        expect(outerClicks).toBe(1); // b1 bubbled (no data-stop)
    });
});

describe('dialogs, logs, labels, toast containers', () => {
    test.each(modules)('%s has no alert() and no console.log', (rel) => {
        const code = read(rel).replace(/\/\/[^\n]*/g, '');
        expect(code).not.toMatch(/\balert\(/);
        expect(code).not.toMatch(/console\.log\(/);
    });
    test('quote-builder-utils has no alert()', () => {
        expect(utils.replace(/\/\/[^\n]*/g, '')).not.toMatch(/\balert\(/);
    });
    test('the shared order-summary inputs carry aria-labels', () => {
        for (const cls of ['os-phone', 'os-order-number', 'os-po-number', 'os-shipping-fee', 'os-req-ship-date', 'os-drop-dead-date', 'os-ship-address', 'os-ship-city', 'os-ship-state', 'os-ship-zip', 'os-ship-method', 'os-notes']) {
            expect(utils).toMatch(new RegExp(`class="${cls} quote-input" aria-label="`));
        }
    });
    test('the DTG form inputs carry aria-labels', () => {
        const fc = read('shared_components/js/builders/dtg/form-core.js');
        for (const id of ['dtgContactPicker', 'dtgCompanyId', 'dtgPoNumber', 'dtgNewArtworkName', 'dtgNewArtworkInput', 'dtgShipAddress1', 'dtgShipCity', 'dtgShipState']) {
            expect(fc).toMatch(new RegExp(`id="${id}" aria-label="`));
        }
    });
    test.each(BUILDERS)('%s page has a toast container', (b) => {
        expect(read(`quote-builders/${b}-quote-builder.html`)).toMatch(/id="toast-container"/);
    });
});
