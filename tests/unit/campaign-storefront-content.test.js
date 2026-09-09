const fs = require('node:fs'),
    path = require('node:path'),
    crypto = require('node:crypto'),
    espree = require('espree'),
    { JSDOM } = require('jsdom');
const fixture = require('../fixtures/campaign-storefront-original-content.json'),
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
    '%s preserves financial and submission implementation',
    (file, entry) => {
        let s = read(file);
        if (entry.excludedFunctions) s = omit(s, entry.excludedFunctions);
        if (entry.normalization !== 'line-endings')
            s = norm(s.replace(/\sclass="[^"]*"/g, '').replace(/\sstyle="[^"]*"/g, ''));
        expect(crypto.createHash('sha256').update(s).digest('hex')).toBe(entry.sha256);
    },
);

function omit(source, names) {
    const edits = [];
    function walk(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'FunctionDeclaration' && names.includes(n.id.name)) {
            edits.push(n.range);
            return;
        }
        for (const v of Object.values(n))
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v === 'object') walk(v);
    }
    walk(espree.parse(source, { ecmaVersion: 'latest', range: true }));
    if (edits.length !== names.length) throw Error('Missing excluded function');
    for (const [a, b] of edits.sort((x, y) => y[0] - x[0]))
        source = source.slice(0, a) + '/* reviewed delivery outcome adapter */' + source.slice(b);
    return source;
}
