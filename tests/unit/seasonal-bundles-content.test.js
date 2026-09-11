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
