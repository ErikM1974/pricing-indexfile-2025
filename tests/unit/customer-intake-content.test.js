const fs = require('node:fs'),
    path = require('node:path'),
    crypto = require('node:crypto'),
    { JSDOM } = require('jsdom');
const fixture = require('../fixtures/customer-intake-original-content.json');
const read = (f) =>
    fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8').replace(/\r\n/g, '\n');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
test.each(fixture.pages)(
    '$file keeps complete original form content and hosted destinations',
    (p) => {
        const d = new JSDOM(read(p.file)).window.document;
        expect(d.title).toBe(p.title);
        expect(
            [...d.querySelectorAll('iframe[src],script[src^="https://form.jotform.com/"]')].map(
                (n) => ({
                    tag: n.tagName,
                    src: n.getAttribute('src'),
                    title: n.getAttribute('title'),
                }),
            ),
        ).toEqual(p.embeds);
        expect(
            [...d.querySelectorAll('input,select,textarea')].map((n) => ({
                tag: n.tagName,
                id: n.id,
                name: n.name,
                type: n.type,
                value: n.value,
                required: n.required,
            })),
        ).toEqual(p.fields);
        expect([...d.images].map((n) => ({ src: n.getAttribute('src'), alt: n.alt }))).toEqual(
            p.images,
        );
        const ids = [...d.querySelectorAll('[id]')].map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
        p.ids.forEach((id) => expect(ids).toContain(id));
        const extras = [...d.querySelectorAll('[data-intake-addition]')];
        expect(extras.map((n) => n.dataset.intakeAddition)).toEqual(
            p.embeds.length ? ['hosted-fallback', 'paper-destination'] : [],
        );
        if (p.embeds.length) {
            const link = d.querySelector('.intake-embed-help a');
            expect(link.href).toBe(fixture.hostedLinks[p.file]);
            expect(link.target).toBe('_blank');
            expect(link.rel).toBe('noopener');
        }
        extras.forEach((n) => n.remove());
        d.querySelector('.skip-link').remove();
        expect(norm(d.querySelector('main').textContent)).toBe(p.mainText);
        expect(
            [...d.querySelectorAll('a[href]')].map((n) => ({
                href: n.getAttribute('href'),
                label: norm(n.textContent),
            })),
        ).toEqual(p.links);
        expect(d.querySelectorAll('style,[style],[onclick],script:not([src])')).toHaveLength(0);
    },
);
test.each(Object.entries(fixture.controllers))(
    '%s preserves original request, upload, lookup and embed behavior',
    (file, entry) => {
        expect(crypto.createHash('sha256').update(read(file)).digest('hex')).toBe(entry.sha256);
    },
);
