const fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    acorn = require('acorn'),
    { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../..'),
    read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const fixture = JSON.parse(read('tests/fixtures/api-reference-original-content.json'));
const normalize = (value) => value.replace(/\s+/g, ' ').trim();
function literals(source, wanted) {
    const found = {};
    function walk(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'VariableDeclarator' && wanted.includes(n.id.name)) {
            const stable = JSON.stringify(n.init, (k, v) => (['start', 'end', 'raw'].includes(k) ? undefined : v));
            found[n.id.name] = crypto.createHash('sha256').update(stable).digest('hex');
        }
        for (const v of Object.values(n))
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v === 'object') walk(v);
    }
    walk(acorn.parse(source, { ecmaVersion: 'latest' }));
    return found;
}
describe('API reference family preserves original technical content', () => {
    test.each(fixture.lessons)('$file retains every lesson record', (entry) => {
        expect(literals(read(entry.file), entry.variables)).toEqual(entry.hashes);
    });
    test.each(fixture.pages)('$file retains prose, fields/options and destinations', (entry) => {
        const d = new JSDOM(read(entry.file)).window.document,
            text = normalize(d.body.textContent);
        entry.paragraphs.forEach((p) => expect(text).toContain(p));
        const fields = [...d.querySelectorAll('input,select,textarea')].map((e) => ({
            id: e.id,
            type: e.type,
            name: e.name,
            options: e.options ? [...e.options].map((o) => [o.value, normalize(o.textContent)]) : null,
        }));
        expect(fields).toEqual(entry.fields);
        const links = [...d.querySelectorAll('a[href]')].map((e) => e.getAttribute('href'));
        entry.links.forEach((link) =>
            expect(links).toContain(link),
        );
        expect(d.querySelectorAll('[style],[onclick],[onchange],script:not([src]),style').length).toBe(0);
        const ids = [...d.querySelectorAll('[id]')].map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

test('ODBC schema remains the exact original read-only catalogue', () => { expect(crypto.createHash('sha256').update(read(fixture.schema.file).replace(/\r\n/g, '\n')).digest('hex')).toBe(fixture.schema.sha256); });
