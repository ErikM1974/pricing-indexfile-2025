/**
 * css-tokens.test.js — locks for CSS standardization Step 1 + 3 (2026-09-07).
 *
 *   1. shared_components/css/tokens.css is the app-wide token file: its first statement is the @layer
 *      ORDER (the first order statement a browser meets wins, so the file must precede every layered rule),
 *      and it defines the primitives every page shares.
 *   2. staff-dashboard/tokens.css holds ONLY the dashboard's theme additions — no primitive is defined twice
 *      (one fact, one home), and every page that loads it loads the app-wide file first.
 *   3. templates/page-template.html — the skeleton for new pages — is itself Rule-3 clean, versioned,
 *      landmarked, and links tokens.css before anything else local, so a page copied from it passes
 *      tests/unit/repo-hygiene-final.test.js on day one (templates/ is skipped by that lock, hence this one).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const APP = 'shared_components/css/tokens.css';
const DASH = 'shared_components/css/staff-dashboard/tokens.css';
const LAYER_ORDER = '@layer reset, tokens, base, components, utilities, overrides;';

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const definedProps = (css) => new Set([...stripComments(css).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

describe('app-wide tokens.css', () => {
    const css = read(APP);
    test('declares the @layer order before anything else', () => {
        expect(stripComments(css).trim().startsWith(LAYER_ORDER)).toBe(true);
    });
    test('defines the shared primitives and the semantic palette', () => {
        const props = definedProps(css);
        for (const p of ['--font-sans', '--font-mono', '--font-size-md', '--nw-500', '--space-4', '--radius-md', '--motion-base', '--z-modal',
            '--color-brand', '--color-brand-dark', '--color-ink', '--color-muted', '--color-line', '--color-surface',
            '--color-danger', '--color-warning', '--color-warning-bg', '--color-warning-ink', '--shadow-sm', '--shadow-md', '--z-nav', '--z-toast']) {
            expect({ token: p, defined: props.has(p) }).toEqual({ token: p, defined: true });
        }
    });
    test('every definition sits inside @layer tokens', () => {
        expect(/@layer tokens\s*\{/.test(css)).toBe(true);
        // nothing declared before the layered block except the order statement
        const before = stripComments(css).split('@layer tokens')[0].replace(LAYER_ORDER, '').trim();
        expect(before).toBe('');
    });
});

describe('staff-dashboard/tokens.css = theme additions only', () => {
    test('no custom property is defined in both files', () => {
        const app = definedProps(read(APP));
        const dash = definedProps(read(DASH));
        expect([...dash].filter((p) => app.has(p))).toEqual([]);
    });
    test('the dashboard theme tokens are still here', () => {
        const dash = definedProps(read(DASH));
        for (const p of ['--bg', '--bg-card', '--text', '--accent', '--accent-bg', '--focus-ring', '--surface-card', '--pad-card']) {
            expect({ token: p, defined: dash.has(p) }).toEqual({ token: p, defined: true });
        }
    });
    test('every page that loads the dashboard tokens loads the app-wide tokens FIRST', () => {
        const tracked = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
        const pages = tracked.filter((f) => !/^(dist|node_modules)\//.test(f) && read(f).includes('staff-dashboard/tokens.css'));
        expect(pages.length).toBeGreaterThanOrEqual(2); // company-numbers + the staff dashboard, plus the tests/ui fixtures
        for (const p of pages) {
            const html = read(p);
            const app = html.indexOf('/shared_components/css/tokens.css');
            const dash = html.indexOf('/shared_components/css/staff-dashboard/tokens.css');
            expect({ page: p, appTokensLinked: app > -1, appBeforeDash: app > -1 && app < dash }).toEqual({ page: p, appTokensLinked: true, appBeforeDash: true });
            // and no other local stylesheet precedes the app tokens
            const firstLocal = html.search(/<link[^>]*rel="stylesheet"[^>]*href="\/(?!\/)[^"]+\.css/);
            expect({ page: p, tokensFirst: firstLocal === -1 || html.slice(firstLocal, firstLocal + 200).includes('/shared_components/css/tokens.css') })
                .toEqual({ page: p, tokensFirst: true });
        }
    });
});

describe('templates/page-template.html', () => {
    const raw = read('templates/page-template.html');
    const html = raw.replace(/<!--[\s\S]*?-->/g, '');
    test('is Rule-3 clean: no <style>, no inline script body, no on*= handlers, no bare icons', () => {
        expect((html.match(/<style[\s>]/g) || []).length).toBe(0);
        expect(/<script(?![^>]*\bsrc=)[^>]*>\s*[^\s<]/.test(html)).toBe(false);
        expect(/\son(click|change|input|blur|keydown|keyup|keypress|error|load|submit|mouseover|mouseout|focus)=/.test(html)).toBe(false);
        expect(/<i\b(?![^>]*aria-hidden)(?![^>]*aria-label)[^>]*\bclass="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"[^>]*><\/i>/.test(html)).toBe(false);
    });
    test('every local asset is versioned except /config/app.config.js', () => {
        const unversioned = html.match(/(?:href|src)="\/(?!config\/app\.config\.js)[^"?]+\.(?:css|js)"/g) || [];
        expect(unversioned).toEqual([]);
        expect(html).toMatch(/<script src="\/config\/app\.config\.js"><\/script>/);
    });
    test('landmarks + accessibility: lang, title, one main, header, footer, labelled input, alt on the logo', () => {
        expect(/<html\b[^>]*\blang=/.test(html)).toBe(true);
        expect(/<title>/.test(html)).toBe(true);
        expect((html.match(/<main[\s>]/g) || []).length).toBe(1);
        expect(/<header\b/.test(html) && /<footer\b/.test(html)).toBe(true);
        for (const m of html.matchAll(/<img\b[^>]*>/g)) expect(m[0]).toMatch(/\balt=/);
        for (const m of html.matchAll(/<input\b([^>]*)>/g)) {
            const id = (m[1].match(/\bid="([^"]+)"/) || [])[1];
            expect({ input: m[0].slice(0, 60), labelled: !!id && html.includes(`for="${id}"`) }).toEqual({ input: m[0].slice(0, 60), labelled: true });
        }
    });
    test('loads tokens.css as its first local stylesheet and routes clicks through data-call-delegator.js', () => {
        const locals = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(\/[^"?]+\.css)/g)].map((m) => m[1]);
        expect(locals[0]).toBe('/shared_components/css/tokens.css');
        expect(html).toMatch(/data-call-delegator\.js\?v=/);
        expect(html).toMatch(/\bdata-call="/);
    });
});
