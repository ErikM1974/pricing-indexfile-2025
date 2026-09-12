const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const original = require('../fixtures/seasonal-bundles-original-content.json');
test.each(Object.entries(original.hashes))('%s retains its original source behind reviewed UI mappings', (file, hash) => {
    let source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of original.changes.filter(c => c.file === file).reverse()) {
        expect(source.split(change.after).length - 1).toBe(change.count);
        source = source.split(change.after).join(change.before);
    }
    expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(hash);
});
const {JSDOM} = require('jsdom');
test('awareness content, product images, destinations, and initial field values remain intact', () => {
    const file = 'calculators/archive/seasonal-2025/breast-cancer-awareness-bundle.html';
    const before = new JSDOM(original.changes.find(c => c.file === file).before).window.document;
    const after = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8')).window.document;
    const norm = text => text.replace(/\s+/g, ' ').trim();
    const copy = doc => [...doc.querySelectorAll('h1,h2,h3,h4,p,li,label')].filter(n => !n.closest('#logoPreview')).map(n => norm(n.textContent)).sort();
    expect(copy(after)).toEqual(copy(before));
    const links = doc => [...doc.querySelectorAll('a[href]')].map(n => [n.getAttribute('href'), norm(n.textContent)]).sort();
    expect(links(after)).toEqual(links(before));
    const images = doc => [...doc.querySelectorAll('img')].map(n => [n.getAttribute('src'), n.alt]).sort();
    expect(images(after)).toEqual(images(before));
    const fields = doc => [...doc.querySelectorAll('input,select,textarea')].map(n => ({id:n.id,name:n.name,value:n.value,checked:n.checked,min:n.min,max:n.max,required:n.required}));
    expect(fields(after)).toEqual(fields(before));
    expect(after.querySelector('script[src*="tailwind"]')).toBeNull();
    expect(after.querySelector('style,[style],[onclick],[onchange]')).toBeNull();
    const paths = [...after.querySelectorAll('link[rel="stylesheet"]')].map(n => n.getAttribute('href').split('?')[0]);
    expect(paths.indexOf('/shared_components/css/tokens.css')).toBeLessThan(paths.indexOf('/shared_components/css/components.css'));
    expect(paths.at(-1)).toBe('/calculators/breast-cancer-awareness-bundle.css');
});
