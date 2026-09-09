const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const fixture = require('../fixtures/photo-original-content.json');
const root = path.resolve(__dirname, '../..'), norm = text => text.replace(/\s+/g, ' ').trim();

test.each(fixture.pages)('$file preserves photo instructions, inputs and destinations', original => {
    const doc = new JSDOM(fs.readFileSync(path.join(root, original.file), 'utf8')).window.document;
    expect(doc.title).toBe(original.title); doc.querySelector('.skip-link').remove();
    expect(norm(doc.querySelector('main').textContent)).toBe(original.mainText);
    // Native file inputs now sit beside their labels; every original identity remains.
    expect([...doc.querySelectorAll('[id]')].map(n => n.id).filter(id => !id.startsWith('photo-')).sort()).toEqual([...original.ids].sort());
    if (original.file.endsWith('/finished-photos.html')) {
        for (const id of ['fp-file', 'fp-file-album']) {
            const input = doc.getElementById(id);
            expect(input.hidden).toBe(false); expect(input.type).toBe('file');
            expect(input.parentElement.querySelector('label').htmlFor).toBe(id);
        }
        expect(doc.getElementById('fp-file').getAttribute('capture')).toBe('environment');
    }
    expect([...doc.querySelectorAll('a[href]')].map(n => ({ href: n.getAttribute('href'), label: norm(n.textContent) }))).toEqual(original.links);
    expect([...doc.images].map(n => ({ src: n.getAttribute('src'), alt: n.alt }))).toEqual(original.images);
    expect([...doc.querySelectorAll('script[src]')].map(n => n.getAttribute('src').split('?')[0]).filter(s => s !== '/shared_components/js/ui-dialog.js')).toEqual(original.scripts.map(s => s.split('?')[0]));
    expect(doc.querySelectorAll('style,[style],script:not([src]),[onclick]')).toHaveLength(0);
});
test.each(Object.keys(fixture.hashes))('%s retains helpers outside recorded UI and failure-state edits', file => {
    let source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of fixture.changes.filter(c => c.file === file).reverse()) {
        expect(source).toContain(change.to); source = source.replace(change.to, change.from);
    }
    expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(fixture.hashes[file]);
});
