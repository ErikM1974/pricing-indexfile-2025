/**
 * @jest-environment jsdom
 *
 * design-gallery-xss.test.js — XSS regression lock for the Design Vault.
 *
 * WHY THIS EXISTS
 * ---------------
 * The beta gallery it replaces built company filter chips by string-splicing
 * the company name into `onclick="filterByCompany('…')"` with nothing but
 * quote-escaping (pages/js/design-gallery.js:206-208). A company containing a
 * double quote broke out of the attribute; `<`, `&`, and `>` were never escaped
 * at all. Company and design names come from ShopWorks/Caspio — data staff type
 * — so this is a real sink, not a theoretical one.
 *
 * The rebuild bans inline handlers entirely: every interactive element carries
 * a data-* attribute and a delegated listener. These tests feed hostile names
 * through EVERY render path (grid card, drawer shell, image strip labels) and
 * assert the DOM that results is inert: no script nodes, no event-handler
 * attributes, no attribute breakout — and that the text still renders readably.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const BASE = 'https://proxy.example.test';

const HOSTILE = [
    '"onmouseover=alert(1) x="',
    "'); fetch('//evil.example'); //",
    '</div><script>window.__pwned = 1;</script>',
    '<img src=x onerror="window.__pwned=1">',
    '" autofocus onfocus="window.__pwned=1',
    '&<>\'"`',
    'javascript:alert(1)'
];

/** Load a browser IIFE module into this jsdom realm. */
function loadModule(rel) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', 'navigator', code)(window, document, window.navigator);
}

/** Minimal skeleton: only the ids the drawer actually binds. */
function mountSkeleton() {
    document.body.innerHTML = `
        <div id="dg-error"></div>
        <div id="dg-grid"></div>
        <div id="dg-spacer-top"></div><div id="dg-spacer-bottom"></div>
        <div id="dg-sentinel-top"></div><div id="dg-sentinel-bottom"></div>
        <div id="dg-drawer-overlay" hidden></div>
        <aside id="dg-drawer" hidden><div id="dg-drawer-body"></div></aside>
        <div id="dg-lightbox" hidden>
            <button id="dg-lightbox-close"></button>
            <img id="dg-lightbox-img" alt="">
            <div id="dg-lightbox-cap"></div>
        </div>`;
}

/** One index row per hostile string, in the positional wire format. */
function hostileIndex() {
    const rows = HOSTILE.map((bad, i) => ([
        1000 + i,          // 0 dn
        bad,               // 1 name
        bad,               // 2 company
        500 + i,           // 3 customerId
        1,                 // 4 repIdx
        1,                 // 5 custTypeIdx
        1,                 // 6 tierIdx
        9000,              // 7 maxStitch
        2,                 // 8 variantCount
        1 | 4 | 8,         // 9 srcBits
        'u:https://img.example/' + i + '.jpg', // 10 imgRef
        3,                 // 11 orderCount
        2506               // 12 lastOrderYYMM
    ]));
    return {
        version: 'dsi-test-1',
        builtAt: Date.now(),
        srcBits: { DIGITIZED: 1, SHOPWORKS: 2, THUMB: 4, ART: 8, RUTH: 16, PHOTO: 32, DESIGNS2026: 64 },
        dicts: { reps: ['', HOSTILE[0]], custTypes: ['', HOSTILE[1]], tiers: ['', 'Mid'] },
        rows,
        dupClusters: [[1000, 1001]],
        counts: { groups: rows.length }
    };
}

/** Every event-handler attribute present anywhere under a root. */
function handlerAttrs(root) {
    const found = [];
    root.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            if (/^on/i.test(attr.name)) found.push(el.tagName + '[' + attr.name + ']');
        }
    });
    return found;
}

beforeEach(() => {
    delete window.__pwned;
    window.APP_CONFIG = { API: { BASE_URL: BASE } };
    window.DG = undefined;
    mountSkeleton();
    loadModule('dashboards/js/design-gallery-search.js');
    loadModule('dashboards/js/design-gallery-grid.js');
    loadModule('dashboards/js/design-gallery-drawer.js');
    window.DG.search.decode(hostileIndex());
});

describe('DG.esc', () => {
    test('neutralises every HTML-significant character', () => {
        const out = window.DG.esc('<img src=x onerror="alert(1)"> & \'quotes\'');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('"');
        expect(out).not.toContain("'");
        expect(out).toContain('&lt;');
        expect(out).toContain('&amp;');
    });

    test('coerces non-strings without throwing', () => {
        expect(() => window.DG.esc(null)).not.toThrow();
        expect(() => window.DG.esc(12345)).not.toThrow();
        expect(() => window.DG.esc(undefined)).not.toThrow();
    });
});

describe('grid card rendering', () => {
    test('hostile company/design names produce NO executable DOM', () => {
        const host = document.createElement('div');
        for (let i = 0; i < HOSTILE.length; i++) {
            host.innerHTML = window.DG.grid.cardHTML(window.DG.search.byDn(1000 + i), i);
            expect(host.querySelector('script')).toBeNull();
            expect(handlerAttrs(host)).toEqual([]);
            expect(window.__pwned).toBeUndefined();
        }
    });

    test('the payload renders as visible TEXT, not markup', () => {
        const host = document.createElement('div');
        host.innerHTML = window.DG.grid.cardHTML(window.DG.search.byDn(1002), 0);
        const company = host.querySelector('.dg-card-company');
        expect(company.textContent).toContain('<script>');   // shown literally…
        expect(company.querySelector('script')).toBeNull();  // …never parsed
    });

    test('card identity/action hooks are data-attributes, never inline handlers', () => {
        const host = document.createElement('div');
        host.innerHTML = window.DG.grid.cardHTML(window.DG.search.byDn(1000), 0);
        const card = host.querySelector('.dg-card');
        expect(card.getAttribute('data-dn')).toBe('1000');
        expect(host.querySelector('[data-copy-dn]')).not.toBeNull();
        expect(host.querySelector('[data-customer]')).not.toBeNull();
        expect(host.innerHTML).not.toMatch(/\son[a-z]+\s*=/i);
    });

    test('a hostile name cannot break out of the aria-label attribute', () => {
        const host = document.createElement('div');
        host.innerHTML = window.DG.grid.cardHTML(window.DG.search.byDn(1004), 0); // autofocus/onfocus payload
        const card = host.querySelector('.dg-card');
        expect(card).not.toBeNull();
        expect(card.hasAttribute('autofocus')).toBe(false);
        expect(card.hasAttribute('onfocus')).toBe(false);
    });
});

describe('grid full-render path (setData → mounted cards)', () => {
    test('mounting every hostile record leaves the document inert', () => {
        window.DG.grid.init({ onOpen: function () { }, onCustomerClick: function () { } });
        const recs = HOSTILE.map((_, i) => window.DG.search.byDn(1000 + i));
        window.DG.grid.setData(recs);
        const grid = document.getElementById('dg-grid');
        expect(grid.querySelector('script')).toBeNull();
        expect(handlerAttrs(grid)).toEqual([]);
        expect(window.__pwned).toBeUndefined();
    });
});

describe('drawer rendering', () => {
    test('opening a hostile record renders inert markup', () => {
        window.DG.drawer.init({ onNavigate: function () { }, onCustomerClick: function () { } });
        for (let i = 0; i < HOSTILE.length; i++) {
            expect(window.DG.drawer.open(1000 + i, { list: [1000 + i], idx: 0 })).toBe(true);
            const body = document.getElementById('dg-drawer-body');
            expect(body.querySelector('script')).toBeNull();
            expect(handlerAttrs(body)).toEqual([]);
            expect(window.__pwned).toBeUndefined();
        }
    });

    test('drawer action hooks are data-attributes and a real Quote href', () => {
        window.DG.drawer.init({});
        window.DG.drawer.open(1000, { list: [1000], idx: 0 });
        const body = document.getElementById('dg-drawer-body');
        expect(body.querySelector('[data-act="copy"]')).not.toBeNull();
        expect(body.querySelector('[data-act="share"]')).not.toBeNull();
        const quote = body.querySelector('[data-act="quote"]');
        expect(quote.getAttribute('href')).toBe('/quote-builders/embroidery-quote-builder.html?design=1000');
        expect(body.innerHTML).not.toMatch(/\son[a-z]+\s*=/i);
    });

    test('hostile rep/customer-type dictionary values are escaped in metadata', () => {
        window.DG.drawer.init({});
        window.DG.drawer.open(1000, { list: [1000], idx: 0 });
        const body = document.getElementById('dg-drawer-body');
        expect(body.textContent).toContain('onmouseover');   // rendered as text
        expect(handlerAttrs(body)).toEqual([]);
    });
});

describe('no module ships an inline-handler template', () => {
    const FILES = [
        'dashboards/js/design-gallery-search.js',
        'dashboards/js/design-gallery-store.js',
        'dashboards/js/design-gallery-grid.js',
        'dashboards/js/design-gallery-rails.js',
        'dashboards/js/design-gallery-drawer.js',
        'dashboards/js/design-gallery.js'
    ];

    test.each(FILES)('%s builds no on*= attribute strings', (rel) => {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        // Attribute-position handlers inside template strings, e.g. ' onclick="'.
        expect(src).not.toMatch(/['"`]\s*on(click|error|load|focus|mouseover|change|input)\s*=/i);
    });

    test.each(FILES)('%s hardcodes no proxy host (APP_CONFIG only)', (rel) => {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        expect(src).not.toMatch(/herokuapp\.com/);
        expect(src).not.toMatch(/caspio-pricing-proxy-[a-z0-9]+/);
    });
});
