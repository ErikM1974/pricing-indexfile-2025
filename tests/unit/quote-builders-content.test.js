const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const original = require('../fixtures/quote-builders-original-content.json');
const root = path.resolve(__dirname, '../..');
test.each(Object.keys(original.hashes))('%s preserves original builder logic and dependencies outside recorded presentation changes', file => {
    let source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of original.changes.filter(c => c.file === file).reverse()) {
        expect(change.after).not.toBe('');
        expect(source.split(change.after).length - 1).toBe(change.count);
        source = source.split(change.after).join(change.before);
    }
    expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(original.hashes[file]);
});
