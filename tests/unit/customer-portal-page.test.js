/**
 * Customer portal + login — structural locks from the 2026-09-05 review.
 *   1. Rule 3: no inline handlers / scripts / styles in either page.
 *   2. The global search is a real combobox (role, aria-autocomplete, aria-controls) and the
 *      results carry ids + aria-selected so ArrowDown/Up can drive aria-activedescendant.
 *   3. Every dialog restores focus to what opened it (rememberFocus/restoreFocus wired).
 *   4. Long ShopWorks design names are clamped in the tables and comma-tidied for display.
 *   5. Customers never see the internal reward cost bands (server-side reason sanitizer).
 *   6. The login email field has a real label.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

const portalHtml = strip(read('pages/customer-portal.html'));
const loginHtml = strip(read('pages/customer-login.html'));
const js = read('pages/js/customer-portal.js');
const css = read('pages/css/customer-portal.css');
const server = read('server.js');

describe('customer portal — Rule 3', () => {
    test.each([['pages/customer-portal.html', portalHtml], ['pages/customer-login.html', loginHtml]])('%s has no inline handlers, scripts or styles', (_rel, html) => {
        expect(html).not.toMatch(/\son(click|change|keypress|keydown|submit|load|error)=/);
        expect(html).not.toMatch(/<script>(?![\s\S]*?<\/script>\s*$)[\s\S]*?\S[\s\S]*?<\/script>/);
        expect(html).not.toMatch(/<style[\s>]/);
    });
    test('the portal js renders no onclick=', () => {
        expect(js.replace(/\/\/[^\n]*/g, '')).not.toMatch(/onclick="/);
    });
});

describe('customer portal — search combobox', () => {
    test('input is a combobox that controls the listbox', () => {
        expect(portalHtml).toMatch(/id="cp-global-search"[^>]*role="combobox"/);
        expect(portalHtml).toMatch(/id="cp-global-search"[^>]*aria-autocomplete="list"/);
        expect(portalHtml).toMatch(/id="cp-search-results"[^>]*role="listbox"/);
    });
    test('results carry ids + aria-selected and arrow keys move aria-activedescendant', () => {
        expect(js).toMatch(/role="option" aria-selected="false" id="cp-sres-' \+ i/);
        expect(js).toMatch(/function setSearchActive\(idx\)/);
        expect(js).toMatch(/inp\.setAttribute\('aria-activedescendant', it\.id\)/);
        expect(js).toMatch(/e\.key === 'ArrowDown'[\s\S]*setSearchActive\(_searchActive \+ 1\)/);
        expect(js).toMatch(/e\.key === 'ArrowUp'[\s\S]*setSearchActive\(_searchActive - 1\)/);
    });
});

describe('customer portal — focus management', () => {
    test('every dialog remembers and restores focus', () => {
        expect(js).toMatch(/function rememberFocus\(\)/);
        expect(js).toMatch(/function restoreFocus\(\)/);
        for (const fn of ['closeLogoLightbox', 'closeOrderDrawer', 'closeReqModal', 'closeGenModal', 'closeRedeem', 'closeStatement']) {
            const body = js.slice(js.indexOf('function ' + fn + '('));
            expect(body.slice(0, 400)).toMatch(/restoreFocus\(\)/);
        }
        expect((js.match(/rememberFocus\(\)/g) || []).length).toBeGreaterThanOrEqual(7); // definition + 6 openers
    });
    test('the phone menu moves focus in on open and back to the button on close', () => {
        expect(js).toMatch(/function openSidebar\(\)[\s\S]{0,600}first\.focus/);
        expect(js).toMatch(/function closeSidebar\(\)[\s\S]{0,600}btn\.focus/);
    });
});

describe('customer portal — design names + table clamp', () => {
    test('designLabel tidies ShopWorks comma spacing', () => {
        // eslint-disable-next-line no-new-func
        const designLabel = new Function(js.match(/function designLabel\(v\) \{[^\n]*\}/)[0] + '; return designLabel;')();
        expect(designLabel("P1008, Aaberg's - Navy ,Black, Red")).toBe("P1008, Aaberg's - Navy, Black, Red");
        expect(designLabel(null)).toBe('');
    });
    test('the orders table design cell is clamped with a tooltip', () => {
        expect(js).toMatch(/<td class="cp-cell-design" title="' \+ escapeAttr\(designLabel\(o\.designName\)/);
        expect(css).toMatch(/\.cp-table td\.cp-cell-design \{[^}]*text-overflow: ellipsis/);
        expect(css).toMatch(/\.cp-table td:first-child \.cp-cell-sub \{[^}]*text-overflow: ellipsis/);
    });
});

describe('customer portal — reward ledger never leaks cost bands', () => {
    const fn = new Function('return ' + server.match(/function portalCustomerReason\(reason\) \{[\s\S]*?\n\}/)[0])(); // eslint-disable-line no-new-func
    test('sanitizer strips the staff parenthetical', () => {
        expect(fn('Earned on paid order #140568 (12-mo program · band 40+, 20-39.99)')).toBe('Earned on paid order #140568');
        expect(fn('Redeemed on order #1 (RWD-REDEEM line on the ShopWorks order)')).toBe('Redeemed on order #1');
        expect(fn('Sample cost credited (thanks!)')).toBe('Sample cost credited (thanks!)');
        expect(fn(null)).toBe('');
    });
    test('the customer-facing entries use the sanitizer', () => {
        expect(server).toMatch(/reason: portalCustomerReason\(e\.reason\)/);
        expect(server).not.toMatch(/reason: e\.reason \|\| ''/);
    });
});

describe('customer login', () => {
    test('the email field has a label', () => {
        expect(loginHtml).toMatch(/<label for="cl-email"/);
    });
});
