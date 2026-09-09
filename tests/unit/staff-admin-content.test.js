const fs = require('node:fs'),
    path = require('node:path'),
    crypto = require('node:crypto'),
    { JSDOM } = require('jsdom');
const fixture = require('../fixtures/staff-admin-original-content.json'),
    root = path.resolve(__dirname, '../..'),
    norm = (s) => s.replace(/\s+/g, ' ').trim();
test.each(fixture.pages)('$file preserves its content, fields and business dependencies', (p) => {
    const d = new JSDOM(fs.readFileSync(path.join(root, p.file), 'utf8')).window.document;
    expect(d.title).toBe(p.title);
    d.querySelector('.skip-link').remove();
    expect(norm(d.querySelector('main').textContent)).toBe(p.mainText);
    expect(
        [...d.querySelectorAll('[id]')]
            .map((n) => n.id)
            .filter((id) => !id.startsWith('staff-tool-')),
    ).toEqual(p.ids);
    expect(
        [...d.querySelectorAll('a[href]')].map((n) => ({
            href: n.getAttribute('href'),
            label: norm(n.textContent),
        })),
    ).toEqual(p.links);
    expect([...d.images].map((n) => ({ src: n.getAttribute('src'), alt: n.alt }))).toEqual(
        p.images,
    );
    expect(
        [...d.querySelectorAll('script[src]')].map((n) => n.getAttribute('src').split('?')[0]),
    ).toEqual(p.scripts.map((s) => s.split('?')[0]));
    expect(d.querySelectorAll('style,[style],script:not([src]),[onclick]')).toHaveLength(0);
});
test.each(fixture.presentation)(
    '$file changes only recorded presentation hooks',
    ({ file, replacements }) => {
        let actual = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
        for (const { from, to } of [...replacements].reverse()) {
            expect(actual).toContain(to);
            actual = actual.split(to).join(from);
        }
        expect(crypto.createHash('sha256').update(actual).digest('hex')).toBe(fixture.hashes[file]);
    },
);
