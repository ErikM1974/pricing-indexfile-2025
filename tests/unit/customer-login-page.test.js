/**
 * Customer + vendor magic-link login pages — locks from the 2026-09-05 login review.
 *   1. Deep links survive sign-in: the gate's ?next= is forwarded with the request-link POST, the
 *      emailed link carries it, and both /verify routes re-validate it with safeLoginNext().
 *   2. Rule 3 + a11y: real label, role=alert notice, visible focus, autofocus, invalid-email outline.
 *   3. The rate limiter (429) and a dead network (0) are told to the user; every other response is
 *      the SAME "check your email" state (no account enumeration).
 *   4. "try again" returns to the form in place (keeps ?next=); the sent heading takes focus.
 *   5. The two pages share markup + CSS — what one has, the other has.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

const pages = [
    ['customer', strip(read('pages/customer-login.html')), read('pages/js/customer-login.js'), '/portal', '/customer/login'],
    ['vendor', strip(read('pages/vendor-login.html')), read('pages/js/vendor-login.js'), '/vendor', '/vendor/login'],
];
const css = read('pages/css/customer-login.css');
const server = read('server.js');

describe.each(pages)('%s login page', (_name, html, js, prefix, loginPath) => {
    test('Rule 3 + structure', () => {
        expect(html).not.toMatch(/\son(click|change|submit|load|error)=/);
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/style="/);
        expect(html).toMatch(/<meta name="robots" content="noindex, nofollow">/);
        expect(html).toMatch(/customer-login\.css\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
        expect(html).toMatch(/-login\.js\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
    });
    test('form a11y: label, autofocus, alert notice, focusable sent heading', () => {
        expect(html).toMatch(/<label for="cl-email" class="cl-sr">Email address<\/label>/);
        expect(html).toMatch(/id="cl-email"[^>]*autocapitalize="off"[^>]*autofocus/);
        expect(html).toMatch(/id="cl-error" role="alert" hidden/);
        expect(html).toMatch(/<h1 tabindex="-1">Check your email<\/h1>/);
        expect(html).toMatch(new RegExp(`<a href="${loginPath}" id="cl-again">try again</a>`));
    });
    test('forwards ?next= under its own prefix only', () => {
        expect(js).toMatch(new RegExp(`var NEXT_RE = /\\^\\\\${prefix}\\(`));
        expect(js).toMatch(/if \(nextPath\) body\.next = nextPath;/);
        // eslint-disable-next-line no-new-func
        const re = new Function('return ' + js.match(/var NEXT_RE = (\/[^\n]*\/);/)[1])();
        expect(re.test(prefix + '/product/PC54')).toBe(true);
        expect(re.test(prefix)).toBe(true);
        expect(re.test(prefix + 'x/evil')).toBe(false);
        expect(re.test('https://evil.example/')).toBe(false);
    });
    test('429 and network failure are surfaced; everything else is the same sent state', () => {
        expect(js).toMatch(/if \(status === 429\) \{ resetButton\(\); showError\('Too many sign-in requests/);
        expect(js).toMatch(/if \(status === 0\) \{ resetButton\(\); showError\('We couldn’t reach the server/);
        expect(js).toMatch(/formView\.hidden = true;\s*sentView\.hidden = false;\s*var h = sentView\.querySelector\('h1'\);\s*if \(h\) h\.focus\(\);/);
        expect(js).toMatch(/emailEl\.setAttribute\('aria-invalid', 'true'\)/);
        expect(js).toMatch(/again\.addEventListener\('click'/);
    });
});

describe('shared login CSS', () => {
    test('visible focus, invalid outline, readable footer, phone padding', () => {
        expect(css).toMatch(/#cl-submit:focus-visible, \.cl-card a:focus-visible \{ outline: 3px solid/);
        expect(css).toMatch(/#cl-email\[aria-invalid="true"\] \{ border-color: #a32d2d; \}/);
        expect(css).not.toMatch(/\.cl-foot \{ color:#bbb;/);
        expect(css).not.toMatch(/\.cl-hint \{ color:#999;/);
        expect(css).toMatch(/@media \(max-width: 420px\) \{[\s\S]*\.cl-card \{ padding: 2rem 1\.25rem 1\.5rem;/);
    });
});

describe('server — safeLoginNext carries the deep link through the magic link', () => {
    // eslint-disable-next-line no-new-func
    const fn = new Function('return ' + server.match(/function safeLoginNext\(raw, prefix\) \{[\s\S]*?\n\}/)[0])();
    test('accepts plain same-site paths under the prefix', () => {
        expect(fn('/portal/product/PC54', '/portal')).toBe('/portal/product/PC54');
        expect(fn('/portal?tab=orders', '/portal')).toBe('/portal?tab=orders');
        expect(fn('/vendor/job/123', '/vendor')).toBe('/vendor/job/123');
    });
    test('drops anything that could redirect off-site or is malformed', () => {
        expect(fn('//evil.example/portal', '/portal')).toBe('');
        expect(fn('https://evil.example/portal', '/portal')).toBe('');
        expect(fn('/portal/x://evil', '/portal')).toBe('');
        expect(fn('/portal/<script>', '/portal')).toBe('');
        expect(fn('/vendor/job', '/portal')).toBe('');
        expect(fn('/portal/' + 'a'.repeat(400), '/portal')).toBe('');
        expect(fn(undefined, '/portal')).toBe('');
        expect(fn(['/portal'], '/portal')).toBe('');
    });
    test('both request-link routes append it and both verify routes re-check it', () => {
        expect(server).toMatch(/const nextPath = safeLoginNext\(req\.body && req\.body\.next, '\/portal'\);\s*const link = `\$\{PUBLIC_SITE_ORIGIN\}\/auth\/customer\/verify\?token=[^`]*` \+ \(nextPath \? `&next=\$\{encodeURIComponent\(nextPath\)\}` : ''\);/);
        expect(server).toMatch(/const nextPath = safeLoginNext\(req\.body && req\.body\.next, '\/vendor'\);\s*const link = `\$\{PUBLIC_SITE_ORIGIN\}\/auth\/vendor\/verify\?token=[^`]*` \+ \(nextPath \? `&next=\$\{encodeURIComponent\(nextPath\)\}` : ''\);/);
        expect(server).toMatch(/const next = safeLoginNext\(req\.query\.next, '\/portal'\) \|\| '\/portal';/);
        expect(server).toMatch(/const next = safeLoginNext\(req\.query\.next, '\/vendor'\) \|\| '\/vendor';/);
        expect(server).toMatch(/res\.redirect\('\/customer\/login\?next=' \+ encodeURIComponent\(req\.originalUrl\)\)/);
        expect(server).toMatch(/res\.redirect\('\/vendor\/login\?next=' \+ encodeURIComponent\(req\.originalUrl\)\)/);
    });
});
