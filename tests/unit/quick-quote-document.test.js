/**
 * quick-quote-document.test.js — the customer line sheet (screen, copy text, PDF).
 * Erik 2026-09-16 (Nika/Taneisha): the price-break table is last week's
 * Qty | Per pc | Small-batch fee layout; an exact quantity adds one all-in line
 * that equals the engine total, so it still matches the Quote Builder.
 */
const { model, html, text, pdf, exactText } = require('../../calculators/quick-quote/quick-quote-document');

const NOW = new Date('2026-09-16T18:00:00Z');
const breaks = [
    { label: '10-23', range: { min: 10, max: 23 }, base: 36.33, ltmFee: 50, setup: 0 },
    { label: '24-47', range: { min: 24, max: 47 }, base: 30.5, ltmFee: 0, setup: 0 },
    { label: '48-71', range: { min: 48, max: 71 }, base: 27, ltmFee: 0, setup: 0 },
    { label: '72+', range: { min: 72, max: Infinity }, base: 23.5, ltmFee: 0, setup: 0 },
];
const input = (over = {}) => ({
    key: '1', method: 'dtf', product: { style: 'PC55', name: 'Core Blend Tee' }, color: { name: 'Safety Green', image: 'https://cdnm.sanmar.com/pc55.jpg' },
    description: 'Center front · ≤9×12"', unitWord: 'pc', tiers: breaks, quantityRequested: false,
    preview: { ok: true, itemQuantity: 10, groupTotal: 410, ltm: { fee: 50 }, fees: [] },
    ...over,
});
const sheet = (inputs, details = {}) => model(inputs, { mode: 'linesheet', method: 'dtf', subtitle: 'DTF transfer · Center front · ≤9×12"', ...details }, NOW);

test('price breaks show the tier price with the small-batch fee on its own row', () => {
    const doc = sheet([input()]);
    const out = html(doc);
    expect(out).toContain('Line Sheet · DTF transfer · Center front · ≤9×12&quot;');
    expect(out).toMatch(/<th scope="col">Qty<\/th><th scope="col">10–23<\/th><th scope="col">24–47<\/th><th scope="col">48–71<\/th><th scope="col">72\+<\/th>/);
    expect(out).toContain('<th scope="row">Per pc</th><td>$36.33</td><td>$30.50</td><td>$27.00</td><td>$23.50</td>');
    expect(out).toContain('<th scope="row">Small-batch fee</th><td class="warn">+$50.00</td><td>–</td>');
    expect(out).toContain('Small-batch fee is charged once per order.');
    expect(out).not.toContain('all-in');
    expect(out).not.toContain('$410.00');
});

test('copy text lists every break and says the fee is once per order', () => {
    const lines = text(sheet([input()])).split('\n');
    expect(lines[0]).toBe('Northwest Custom Apparel — Line Sheet · DTF transfer · Center front · ≤9×12"');
    expect(lines).toContain('  10–23: $36.33/pc + $50.00 small-batch fee (once per order)');
    expect(lines).toContain('  72+: $23.50/pc');
    expect(text(sheet([input()]))).not.toContain('all-in');
});

test.each([
    ['emb', 7, 221.5, [], '7 pcs: $31.64/pc all-in · $221.50 total'],
    ['capemb', 4, 172, [], '4 caps: $43.00/cap all-in · $172.00 total'],
    ['dtg', 6, 139.98, [], '6 pcs: $23.33/pc all-in · $139.98 total'],
    ['scp', 36, 530, [{ oneTime: true, label: 'Screen setup', amount: 30 }], '36 pcs: $13.89/pc all-in · $530.00 total incl. $30.00 one-time setup'],
    ['dtf', 23, 885.5, [], '23 pcs: $38.50/pc all-in · $885.50 total'],
])('%s exact quantity line carries the engine total unchanged', (method, qty, total, fees, line) => {
    const doc = sheet([input({ method, unitWord: method === 'capemb' ? 'cap' : 'pc', quantityRequested: true, preview: { ok: true, itemQuantity: qty, groupTotal: total, ltm: { fee: 50 }, fees } })], { method });
    const o = doc.options[0];
    expect(o.total).toBe(total);
    expect(exactText(o)).toBe(line);
    expect(html(doc)).toContain('data-total="' + total + '"');
    expect(text(doc)).toContain('  ' + line);
});

test('an exact quantity highlights its break and keeps the tier prices', () => {
    const out = html(sheet([input({ quantityRequested: true, preview: { ok: true, itemQuantity: 12, groupTotal: 486, ltm: { fee: 50 }, fees: [] } })]));
    expect(out).toContain('<th scope="col" class="is-current">10–23</th>');
    expect(out).toContain('<td class="is-current">$36.33</td>');
    expect(out).toContain('<td class="is-current warn">+$50.00</td>');
    expect(out).toContain('12 pcs: $40.50/pc all-in · $486.00 total');
});

test('one-time setup is stated once, or per break when it differs', () => {
    const scp = tiers => input({ method: 'scp', tiers, preview: { ok: true, itemQuantity: 24, groupTotal: 380, ltm: { fee: 50 }, fees: [{ oneTime: true, label: 'Screen setup', amount: 30 }] } });
    const same = breaks.map(t => ({ ...t, setup: 30 }));
    expect(html(sheet([scp(same)], { method: 'scp' }))).toContain('Plus $30.00 one-time setup (Screen setup).');
    const varied = same.map((t, i) => ({ ...t, setup: i ? 30 : 60 }));
    const out = html(sheet([scp(varied)], { method: 'scp' }));
    expect(out).toContain('<th scope="row">Setup (one time)</th><td>$60.00</td><td>$30.00</td>');
    expect(out).not.toContain('Plus $');
});

test('caps say per cap, and a row priced differently from the sheet names its own decoration', () => {
    const cap = input({ key: '2', method: 'capemb', unitWord: 'cap', product: { style: '112FPR', name: 'Five-Panel with Rope' }, description: 'Cap front 8,000 stitches' });
    const tee = input({ key: '3', method: 'emb', product: { style: 'PC54', name: 'Core Cotton Tee' }, description: 'Left chest 8,000 stitches' });
    const doc = sheet([cap, tee], { method: 'capemb', subtitle: 'Cap embroidery · Cap front 8,000 stitches' });
    const out = html(doc);
    expect(out).toContain('<th scope="row">Per cap</th>');
    expect(out).toContain('<p class="qq-sheet-method"><strong>Embroidery</strong> · Left chest 8,000 stitches</p>');
    expect(out.match(/qq-sheet-method/g)).toHaveLength(1);
    expect(text(doc)).toContain('Embroidery · Left chest 8,000 stitches');
});

test('quick-price estimates number the options and name each decoration', () => {
    const doc = model([
        input({ key: 'emb', method: 'emb', tiers: [], quantityRequested: true, description: 'Left chest 8,000 stitches', preview: { ok: true, itemQuantity: 24, groupTotal: 504, fees: [] } }),
        input({ key: 'dtg', method: 'dtg', tiers: [], quantityRequested: true, description: 'Left chest · 4×4"', preview: { ok: true, itemQuantity: 24, groupTotal: 348, fees: [] } }),
    ], { mode: 'quick', customer: 'Example Customer' }, NOW);
    const out = html(doc);
    expect(doc.title).toBe('Decoration options');
    expect(out).toContain('Option 1');
    expect(out).toContain('<strong>DTG print</strong> · Left chest · 4×4&quot;');
    expect(out).toContain('24 pcs: $21.00/pc all-in · $504.00 total');
    expect(out).toContain('options are not added together');
    expect(out).not.toContain('qq-sheet-ladder');
});

test('dates, validity, customer, rep and notes appear on the sheet', () => {
    const doc = sheet([input()], { customer: 'Example Customer', company: 'Example Co', rep: 'Nika', email: 'nika@example.com', notes: 'Crew shirts' });
    const out = html(doc);
    expect(out).toContain('Sep 16, 2026<br>Valid through Oct 16, 2026');
    expect(out).toContain('Prepared for <strong>Example Customer · Example Co</strong>');
    expect(out).toContain('Nika · Northwest Custom Apparel · (253) 922-5793 · nika@example.com');
    expect(out).toContain('<p class="qq-sheet-notes">Crew shirts</p>');
});

test('a quick-price size mix is listed and replaces the standard-size wording', () => {
    const doc = model([input({ method: 'emb', tiers: [], quantityRequested: true, sizes: 'Sizes: 2XL 12, 3XL 12', preview: { ok: true, itemQuantity: 24, groupTotal: 564, fees: [] } })], { mode: 'quick' }, NOW);
    for (const output of [html(doc), text(doc)]) {
        expect(output).toContain('Sizes: 2XL 12, 3XL 12');
        expect(output).toContain('Priced for the sizes listed.');
        expect(output).not.toContain('Standard sizes shown');
    }
});

test('price breaks say each price applies from the first quantity in its range', () => {
    expect(html(sheet([input()]))).toContain('Each price applies from the first quantity in its range.');
    expect(html(model([input({ tiers: [], quantityRequested: true })], { mode: 'quick' }, NOW))).not.toContain('first quantity in its range');
});

test('large totals keep thousands separators', () => {
    const doc = sheet([input({ quantityRequested: true, preview: { ok: true, itemQuantity: 72, groupTotal: 1692, fees: [] } })]);
    expect(exactText(doc.options[0])).toBe('72 pcs: $23.50/pc all-in · $1,692.00 total');
});

test('customer fields and product content are escaped and unsafe image URLs omitted', () => {
    const i = input({ product: { style: 'PC54', name: '<img src=x onerror=alert(1)>' }, color: { name: 'Navy', image: 'javascript:alert(1)' } });
    const result = html(sheet([i], { customer: '<script>bad()</script>' }));
    expect(result).not.toContain('<script>'); expect(result).not.toContain('src="javascript:');
    expect(result).toContain('&lt;script&gt;'); expect(result).toContain('&lt;img');
});

test('unavailable pricing or malformed breaks cannot reach the customer', () => {
    expect(sheet([input({ preview: { ok: false } })]).options).toEqual([]);
    expect(sheet([input({ preview: { ok: true, itemQuantity: 5, groupTotal: NaN } })]).options).toEqual([]);
    expect(sheet([input({ preview: { ok: true, itemQuantity: 5, groupTotal: 100, fees: [{ oneTime: true, amount: 'x' }] } })]).options).toEqual([]);
    const o = sheet([input({ tiers: [...breaks, { label: 'bad', range: {}, base: 1 }] })]).options[0];
    expect(o.tiers).toHaveLength(4);
});

test('the Quick Quote version goes into the PDF file properties only', async () => {
    const properties = [];
    class FakePdf {
        constructor() { this.pages = 1; }
        setLineHeightFactor() {} setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {} setLineWidth() {} setFillColor() {}
        line() {} rect() {} addImage() {} setPage() {} addPage() {} text() {}
        setProperties(value) { properties.push(value); }
        getNumberOfPages() { return this.pages; }
        splitTextToSize(value) { return [value]; }
    }
    const doc = sheet([input()], { release: '2026.09.16.3' });
    await pdf(doc, FakePdf, async () => null);
    expect(properties[0]).toMatchObject({ title: 'NWCA Line Sheet', creator: 'NWCA Quick Quote 2026.09.16.3' });
    expect(html(doc)).not.toContain('2026.09.16.3');
    expect(text(doc)).not.toContain('2026.09.16.3');
    expect(sheet([input()], { release: '<b>1</b>' }).release).toBe('');
    await pdf(sheet([input()]), FakePdf, async () => null);
    expect(properties[1].creator).toBe('NWCA Quick Quote');
});

test('the PDF writes the same table rows and exact line as the screen', async () => {
    const written = [];
    class FakePdf {
        constructor() { this.pages = 1; }
        setLineHeightFactor() {} setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {} setLineWidth() {} setFillColor() {}
        line() {} rect() {} addImage() {} setProperties() {} setPage() {}
        addPage() { this.pages += 1; }
        getNumberOfPages() { return this.pages; }
        splitTextToSize(value) { return [value]; }
        text(lines) { written.push(...lines); }
    }
    const doc = sheet([input({ quantityRequested: true, preview: { ok: true, itemQuantity: 12, groupTotal: 486, ltm: { fee: 50 }, fees: [] } })], { rep: 'Nika' });
    const file = await pdf(doc, FakePdf, async () => null);
    expect(file.getNumberOfPages()).toBe(1);
    for (const value of ['Qty', '10-23', '72+', 'Per pc', '$36.33', 'Small-batch fee', '+$50.00', '12 pcs: $40.50/pc all-in  |  $486.00 total', 'Line Sheet  |  DTF transfer  |  Center front  |  up to 9x12"']) {
        expect(written).toContain(value);
    }
    expect(written.join('\n')).toContain('Small-batch fee is charged once per order.');
    expect(written.join('\n')).toContain('Nika | Northwest Custom Apparel');
});
