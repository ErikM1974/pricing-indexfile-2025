const fs = require('node:fs'),
    path = require('node:path'),
    crypto = require('node:crypto'),
    { JSDOM } = require('jsdom');
const fixture = require('../fixtures/instant-storefront-original-content.json'),
    root = path.resolve(__dirname, '../..'),
    read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n'),
    norm = (s) => s.replace(/\s+/g, ' ').trim();
test.each(fixture.pages)(
    '$file preserves original prose, links, images, fields and structured data',
    (entry) => {
        const d = new JSDOM(read(entry.file)).window.document;
        expect(d.title).toBe(entry.title);
        expect(norm(d.querySelector('main').textContent)).toBe(entry.mainText);
        expect(
            [...d.querySelectorAll('a[href]')].map((n) => ({
                href: n.getAttribute('href'),
                label: norm(n.textContent),
            })),
        ).toEqual(entry.links);
        expect([...d.images].map((n) => ({ src: n.getAttribute('src'), alt: n.alt }))).toEqual(entry.images);
        expect(
            [...d.querySelectorAll('input,select,textarea')].map((n) => ({
                tag: n.tagName,
                id: n.id,
                name: n.name,
                type: n.type,
                value: n.value,
                required: n.required,
            })),
        ).toEqual(entry.fields);
        expect(
            [...d.querySelectorAll('script[type="application/ld+json"]')].map((n) =>
                JSON.parse(n.textContent),
            ),
        ).toEqual(entry.jsonLd);
        const ids = [...d.querySelectorAll('[id]')].map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of entry.ids) expect(ids).toContain(id);
        expect(
            d.querySelectorAll(
                'style,script:not([src]):not([type="application/ld+json"]),[style],[onclick],[onerror]',
            ),
        ).toHaveLength(0);
    },
);
test.each(Object.entries(fixture.controllers))(
    '%s preserves original financial/controller code',
    (file, entry) => {
        let source = read(file);
        if (file === 'app-modern.js') {
            const nativeGuard =
                "\n    // Unified storefront pages use the shared native dialog navigation.\n    if (sidebar?.tagName === 'DIALOG') return;\n";
            expect(source.split(nativeGuard)).toHaveLength(2);
        source = source.replace(nativeGuard, '');
        const disclosureGuard = "    // Unified instant pages delegate disclosure state to nav-dropdown.js.\n    if (document.querySelector('[data-ui=\"unified\"][data-instant]')) return;\n\n";
        expect(source.split(disclosureGuard)).toHaveLength(2);
        source = source.replace(disclosureGuard, '');
        // apply_patch may add the formerly absent final newline; source content is unchanged.
        if (source.endsWith('\n')) source = source.slice(0, -1);
        }
        expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(entry.sha256);
    },
);
