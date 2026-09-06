/**
 * @jest-environment jsdom
 *
 * Quote builders — 2026-09-06 review locks (Rule 3 completion + hygiene, synced across all 4 per Rule 8).
 *   1. Zero inline handlers of ANY kind (onchange/oninput/onblur/onkeydown/onerror/onclick) in the six
 *      builder pages and in every module template — the shared delegator in quote-builder-utils.js now
 *      handles change / input / blur / keydown / image-error through data-* attributes.
 *   2. The delegator's new events behave (jsdom): lists, "?optional", args with $this/$event, keyclick,
 *      data-enter (+unless), data-onerror modes.
 *   3. Icons decorative everywhere, every asset versioned, fast-quote has no
 *      inline <style>/<script> and no CDN script.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const stripJs = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const HANDLER = /\son(change|input|blur|keydown|keyup|keypress|error|click|submit)=/;
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"(?![^>]*aria-hidden)[^>]*><\/i>/;
const PAGES = fs.readdirSync(path.join(ROOT, 'quote-builders')).filter((f) => f.endsWith('.html')).map((f) => 'quote-builders/' + f);
const MODULES = ['dtf', 'dtg', 'emb', 'scp', 'shared'].flatMap((d) => fs.readdirSync(path.join(ROOT, 'shared_components/js/builders', d)).filter((f) => f.endsWith('.js')).map((f) => `shared_components/js/builders/${d}/${f}`));
const utils = read('shared_components/js/quote-builder-utils.js');

describe('no inline handlers anywhere', () => {
    test.each(PAGES)('%s', (rel) => {
        const html = strip(read(rel));
        expect(html).not.toMatch(HANDLER);
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/<script>\s*[^\s<]/);
        expect(html).not.toMatch(/(href|src)="\/(?!config\/app\.config\.js)[^"?]+\.(css|js)"/);
        expect(html).not.toMatch(/<script[^>]*src="https?:\/\/cdn\./);
        // (no h1 assertion: the four builders deliberately carry no h1 — an added sr-only h1 broke the axe heading-order/region baselines)
    });
    test.each(MODULES)('%s', (rel) => {
        const js = stripJs(read(rel));
        expect(js).not.toMatch(HANDLER);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(/<i class="fas (?:fa-)?\$\{[^}]+\}[^"]*"><\/i>/);
    });
    test.each(['artwork-upload', 'dtf-quote-products', 'dtg-catalog', 'dtg-quote-page', 'embroidery-chat', 'embroidery-quote-invoice', 'monogram-form-controller', 'product-thumbnail-modal', 'quote-builder-guided', 'quote-extended-sizes', 'quote-order-summary', 'quote-services-bar', 'quote-session', 'quote-share-modal', 'safety-stripe-recs', 'screenprint-fast-quote-page'])('shared script %s renders decorative icons only', (f) => {
        const js = stripJs(read(`shared_components/js/${f}.js`));
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(/<i class="fas (?:fa-)?\$\{[^}]+\}[^"]*"><\/i>/);
    });
    test.each(['dtg-quote-page', 'dtg-catalog', 'quote-order-summary', 'quote-builder-utils'])('classic script %s renders no inline handlers', (f) => {
        expect(stripJs(read(`shared_components/js/${f}.js`))).not.toMatch(HANDLER);
    });
    test('utils renders no bare icons and documents the new contract', () => {
        expect(utils).not.toMatch(BARE);
        expect(utils).toMatch(/data-keyclick="1"/);
        expect(utils).toMatch(/function qbRunList\(/);
        expect(utils).toMatch(/document\.addEventListener\('focusout'/);
    });
});

describe('delegator events (jsdom)', () => {
    const src = utils.slice(utils.indexOf('function qbFocusMain'), utils.indexOf("if (typeof window !== 'undefined') {\n    window.qbFocusMain"));
    beforeAll(() => {
        // eslint-disable-next-line no-new-func
        new Function('showToast', src + '\nqbInstallCallDelegator();')(() => {});
    });
    test('change list with optional + args, input, blur, keyclick, enter, onerror', () => {
        document.body.innerHTML = `
            <select id="s1" data-change="a,?missing,b" ></select>
            <input id="i1" data-input="withArgs" data-input-args='["$this", 7, "x"]'>
            <input id="z1" data-blur="onBlur">
            <div id="k1" role="button" tabindex="0" data-keyclick="1" data-call="clicked"></div>
            <input id="e1" data-enter="onEnter" data-enter-args='["garment"]'>
            <input id="e2" data-enter="onEnter2" data-enter-unless="_galleryMode">
            <input id="kd" data-keydown="onKey" data-keydown-args='["$event", "$this"]'>
            <div id="p1"><img id="im1" data-onerror="hide-parent"></div>
            <div id="p2"><img id="im2" data-onerror="placeholder-icon"></div>
            <img id="im3" src="x.png" data-onerror="placeholder-src">
            <figure class="or-thumb" id="f4"><img id="im4" data-onerror="hide-closest" data-onerror-closest=".or-thumb"></figure>
            <div id="p5"><img id="im5" data-onerror="hide" data-onerror-parent-class="hero-missing"></div>`;
        const calls = [];
        window.a = () => calls.push('a'); window.b = () => calls.push('b');
        window.withArgs = (el, n, s) => calls.push(['withArgs', el.id, n, s]);
        window.onBlur = () => calls.push('blur');
        window.clicked = () => calls.push('clicked');
        window.onEnter = (w) => calls.push(['enter', w]);
        window.onEnter2 = () => calls.push('enter2');
        window.onKey = (e, el) => calls.push(['key', e.key, el.id]);
        document.getElementById('s1').dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('i1').dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('z1').dispatchEvent(new Event('focusout', { bubbles: true }));
        document.getElementById('k1').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        document.getElementById('e1').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const e2 = document.getElementById('e2'); e2._galleryMode = true;
        e2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        e2._galleryMode = false;
        e2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        document.getElementById('kd').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        document.getElementById('im1').dispatchEvent(new Event('error'));
        document.getElementById('im2').dispatchEvent(new Event('error'));
        ['im3', 'im4', 'im5'].forEach((id) => document.getElementById(id).dispatchEvent(new Event('error')));
        expect(calls).toEqual(['a', 'b', ['withArgs', 'i1', 7, 'x'], 'blur', 'clicked', ['enter', 'garment'], 'enter2', ['key', 'Tab', 'kd']]);
        expect(document.getElementById('p1').hidden).toBe(true);
        expect(document.getElementById('p2').innerHTML).toBe('<i class="fas fa-image" aria-hidden="true"></i>');
        expect(document.getElementById('im3').classList.contains('placeholder')).toBe(true);
        expect(document.getElementById('im3').hasAttribute('src')).toBe(false);
        expect(document.getElementById('f4').hidden).toBe(true);
        expect(document.getElementById('im5').hidden).toBe(true);
        expect(document.getElementById('p5').classList.contains('hero-missing')).toBe(true);
    });
});

describe('fast quote page', () => {
    test('external page script + vendored EmailJS + delegator', () => {
        const html = read('quote-builders/screenprint-fast-quote.html');
        expect(html).toContain('/shared_components/css/screenprint-fast-quote.css?v=');
        expect(html).toContain('/shared_components/js/screenprint-fast-quote-page.js?v=');
        expect(html).toContain('/shared_components/vendor/emailjs/email.min.js');
        expect(html).toMatch(/data-call="submitQuote"/);
        expect(html).toMatch(/data-href="\/"/);
        expect(read('shared_components/js/screenprint-fast-quote-page.js')).toMatch(/function submitQuote\(/);
    });
});
