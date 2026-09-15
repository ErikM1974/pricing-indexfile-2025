const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'shared_components/js/carhartt-bucks.js'), 'utf8');

function boot(date, file = 'pages/carhartt-bucks.html') {
    const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), { runScripts: 'outside-only', url: 'https://www.teamnwca.com/carhartt-bucks' });
    dom.window.Date.now = () => Date.parse(date);
    dom.window.setInterval = jest.fn();
    dom.window.eval(source);
    return dom;
}
test.each([
    ['2026-09-30T23:59:59-07:00', 'visit'],
    ['2026-10-01T00:00:00-07:00', 'redeem'],
    ['2026-10-15T23:59:59-07:00', 'redeem'],
    ['2026-10-16T00:00:00-07:00', 'expired'],
])('Pacific deadline at %s shows only %s actions', (date, phase) => {
    const dom = boot(date);
    for (const el of dom.window.document.querySelectorAll('[data-cb-phase]')) {
        expect(el.hidden).toBe(!el.dataset.cbPhase.split(' ').includes(phase));
    }
    dom.window.close();
});
test('an open page advances phases when the user returns', () => {
    const dom = boot('2026-09-30T22:00:00-07:00');
    dom.window.Date.now = () => Date.parse('2026-10-01T08:00:00-07:00');
    dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
    expect(dom.window.document.querySelector('[data-cb-title]').textContent).toMatch(/Redeem/);
    expect(dom.window.document.querySelector('[data-cb-phase="visit"]').hidden).toBe(true);
    dom.window.close();
});
test('rep invitation switches to redemption copy and preserves the exact minimum and no-combining rule', () => {
    const dom = boot('2026-10-02T10:00:00-07:00', 'dashboards/carhartt-bucks.html');
    const text = dom.window.document.querySelector('[data-cb-invitation]').value;
    expect(text).toMatch(/^Already visited/);
    expect(text).toContain('$1,000');
    expect(text).toContain('Cannot be combined with other offers.');
    dom.window.close();
});
test('clipboard denial exposes selectable text and an actionable status', async () => {
    const dom = boot('2026-09-15T12:00:00-07:00', 'dashboards/carhartt-bucks.html');
    Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
    dom.window.document.querySelector('[data-cb-copy="invitation"]').click();
    await new Promise(resolve => setImmediate(resolve));
    const field = dom.window.document.querySelector('[data-cb-invitation]');
    expect(dom.window.document.activeElement).toBe(field);
    expect(field.selectionEnd).toBe(field.value.length);
    expect(dom.window.document.querySelector('[data-cb-copy-status]').textContent).toContain('copy it manually');
    dom.window.close();
});
test('expired discovery placements disappear while staff resources remain', () => {
    const dom = boot('2026-10-16T01:00:00-07:00', 'index.html');
    expect([...dom.window.document.querySelectorAll('[data-cb-phase]')].every(el => el.hidden)).toBe(true);
    expect(dom.window.document.querySelector('[data-holiday-promotion]')).not.toBeNull();
    dom.window.close();
});

test('approved campaign mappings reproduce the prior source hashes exactly', () => {
    const crypto = require('crypto');
    const restore = require('../helpers/carhartt-bucks-source-mappings');
    const fixture = require('../fixtures/carhartt-bucks-source-mappings.json');
    for (const [file, expected] of Object.entries(fixture.baseHashes)) {
        const restored = restore(file, fs.readFileSync(path.join(root, file), 'utf8'));
        expect(crypto.createHash('sha256').update(restored).digest('hex')).toBe(expected);
    }
});
