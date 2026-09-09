const fs = require('node:fs'),
    path = require('node:path'),
    crypto = require('node:crypto'),
    { JSDOM } = require('jsdom');
const fixture = require('../fixtures/announcements-original-content.json'),
    root = path.resolve(__dirname, '../..'),
    norm = (s) => s.replace(/\s+/g, ' ').trim();
test.each(fixture.pages)('$file preserves original hosted app and navigation', (p) => {
    const d = new JSDOM(fs.readFileSync(path.join(root, p.file), 'utf8')).window.document;
    expect(d.title).toBe(p.title);
    expect([...d.querySelectorAll('script[src]')].map((n) => n.getAttribute('src'))).toEqual(
        p.scripts,
    );
    expect([...d.images].map((n) => ({ src: n.getAttribute('src'), alt: n.alt }))).toEqual(
        p.images,
    );
    expect(d.querySelector('.hosted-help a').getAttribute('href')).toBe(
        p.scripts.find((s) => s.startsWith('https://c3eku948.caspio.com/')).replace(/\/emb$/, ''),
    );
    expect(d.querySelector('[aria-current="page"]').getAttribute('href')).toBe(
        '/' + path.basename(p.file),
    );
    expect(d.querySelector('#loadingOverlay').getAttribute('role')).toBe('status');
    d.querySelectorAll('[data-hosted-addition],.skip-link').forEach((n) => n.remove());
    expect(norm(d.querySelector('main').textContent)).toBe(p.mainText);
    expect(
        [...d.querySelectorAll('a[href]')].map((n) => ({
            href: n.getAttribute('href'),
            label: norm(n.textContent),
        })),
    ).toEqual(p.links);
    expect(d.querySelectorAll('style,[style],script:not([src]),[onclick]')).toHaveLength(0);
});
test.each(Object.entries(fixture.controllers))(
    '%s retains existing hosted loading and navigation behavior',
    (file, sha) => {
        expect(
            crypto
                .createHash('sha256')
                .update(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'))
                .digest('hex'),
        ).toBe(sha);
    },
);
