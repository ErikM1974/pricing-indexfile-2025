/**
 * Customer product (re-order) page — structural locks from the 2026-09-05 review.
 *   1. Rule 3: no inline handlers or inline style= toggles; image fallbacks go through ONE
 *      capture-phase `error` listener driven by data-onerror.
 *   2. The product name is the page's <h1>; the header brand is a div; document.title is set.
 *   3. The header uses the site logo + /favicon.png (the old Box shared-static PNG was broken).
 *   4. A failed load offers Retry; loading/error/content toggle with `hidden`.
 *   5. Availability dots are announced (aria-label), not just title-tooltipped.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('pages/customer-product.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('pages/js/customer-product.js');
const css = read('pages/css/customer-product.css');
const rl = read('pages/js/portal-reorder-list.js');

describe('customer product page', () => {
    test('Rule 3: no inline handlers, no style= toggles, no inline scripts', () => {
        expect(html).not.toMatch(/\son(click|error|change|load)=/);
        expect(html).not.toMatch(/style="display/);
        expect(html).not.toMatch(/<script>[\s\S]*?\S[\s\S]*?<\/script>/);
        expect(js.replace(/\/\/[^\n]*/g, '')).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(js).toMatch(/document\.addEventListener\('error', function \(e\)[\s\S]*?\}, true\);/);
        for (const mode of ['hide', 'hide-parent', 'hide-thumb', 'noimg', 'remove']) expect(js).toMatch(new RegExp(`data-onerror="${mode}"`));
    });
    test('product name is the h1, header brand is a div, title is set', () => {
        expect(html).not.toMatch(/<h1/);
        expect(html).toMatch(/<div class="cp-header-brand">Northwest Custom Apparel<\/div>/);
        expect(js).toMatch(/<h1 class="pp-title">/);
        expect(js).toMatch(/document\.title = esc\(p\.style\) \+ ' · ' \+ esc\(p\.title\)/);
        expect(css).toMatch(/\.cp-header-brand \{/);
    });
    test('site logo + favicon, back link in the header and in the body', () => {
        expect(html).not.toMatch(/box\.com\/shared\/static/);
        expect(html).toMatch(/href="\/favicon\.png"/);
        expect(html).toMatch(/cdn\.caspio\.com\/A0E15000\/Safety%20Stripes\/web%20northwest%20custom%20apparel%20logo\.png/);
        expect(html).toMatch(/id="pp-back-top"/);
        expect(js).toMatch(/\['pp-back', 'pp-back-top'\]\.forEach/);
    });
    test('failed load offers Retry; panels toggle with hidden', () => {
        expect(html).toMatch(/id="pp-error" hidden role="alert"/);
        expect(html).toMatch(/id="pp-error-retry" hidden/);
        expect(html).toMatch(/id="pp-content" hidden/);
        expect(js).toMatch(/showError\('We couldn’t load this product[^']*', true\)/);
        expect(js).toMatch(/retryBtn\.addEventListener\('click'/);
    });
    test('the shared re-order list widget toggles with hidden, no inline style= or onerror=', () => {
        expect(rl).not.toMatch(/style="/);
        expect(rl).not.toMatch(/\.style\.display/);
        expect(rl.replace(/\/\/[^\n]*/g, '')).not.toMatch(/(?<!data-)onerror=/);
        expect(rl).toMatch(/id="rl-fab" hidden/);
        expect(read('pages/css/portal-reorder-list.css')).toMatch(/\.rl-fab \{\s*display: inline-flex;/);
    });
    test('the phone header shortens the back link and drops the tagline', () => {
        expect(html).toMatch(/<span class="pp-back-long">Back to your account<\/span><span class="pp-back-short">Account<\/span>/);
        expect(css).toMatch(/\.cp-header-link \.pp-back-long \{ display: none; \}/);
    });
    test('availability dots carry aria-labels', () => {
        expect(js).toMatch(/class="pp-dot pp-dot--' \+ lv \+ '" role="img" title="[^"]*" aria-label="/);
    });
});
