const fs = require('node:fs'),
    path = require('node:path'),
    { JSDOM } = require('jsdom');
const fixture = require('../fixtures/vendor-portals-original-content.json');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
test.each(fixture.pages)(
    '$file retains original invoice/credit app, content and navigation',
    (p) => {
        const d = new JSDOM(fs.readFileSync(path.join(__dirname, '../..', p.file), 'utf8')).window
            .document;
        expect(d.title).toBe(p.title);
        expect([...d.querySelectorAll('script[src]')].map((n) => n.getAttribute('src'))).toEqual(
            p.embeds,
        );
        expect([...d.images].map((n) => ({ src: n.getAttribute('src'), alt: n.alt }))).toEqual(
            p.images,
        );
        const help = d.querySelector('.vendor-help a');
        expect(help.href).toBe(p.embeds[0].replace(/\/emb$/, ''));
        expect(help.rel).toBe('noopener');
        expect(help.target).toBe('_blank');
        expect(
            [...d.querySelectorAll('[data-vendor-addition]')].map((n) => n.dataset.vendorAddition),
        ).toEqual(['hosted-fallback', 'paper-destination']);
        d.querySelectorAll('[data-vendor-addition],.skip-link').forEach((n) => n.remove());
        expect(norm(d.querySelector('main').textContent)).toBe(p.mainText);
        expect(
            [...d.querySelectorAll('a[href]')].map((n) => ({
                href: n.getAttribute('href'),
                label: norm(n.textContent),
            })),
        ).toEqual(p.links);
        expect(d.querySelectorAll('style,[style],script:not([src]),[onclick]')).toHaveLength(0);
    },
);
