const fs = require('fs');
const path = require('path');

test('active lessons stay within the documented 300-line hard limit', () => {
    const text = fs.readFileSync(path.join(__dirname, '../../memory/LESSONS_LEARNED.md'), 'utf8');
    expect(text.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(300);
});
