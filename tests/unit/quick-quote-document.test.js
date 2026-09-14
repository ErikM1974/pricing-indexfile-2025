const { model, html, text, chargeRows } = require('../../calculators/quick-quote/quick-quote-document');
const input = (method = 'emb', quantity = 5, total = 275) => ({
    method, key: method, product: { style: 'PC54', name: 'Cotton Tee' }, color: { name: 'Navy' }, description: 'Left chest: 8,000 stitches',
    preview: { ok: true, itemQuantity: quantity, groupTotal: total, ltm: { fee: 50 }, fees: [{ oneTime: true, label: 'Digitizing', amount: 100 }] },
});
test.each(['emb', 'capemb', 'dtg', 'scp', 'dtf'])('customer %s price includes the small-order charge exactly once', method => {
    const m = model([input(method)], {}, new Date('2026-09-13T18:00:00Z'));
    expect(m.options[0].unit).toBe(35);
    expect(chargeRows(m.options[0])).toEqual([{ label: '5 pieces · garment + decoration + small-order pricing', amount: 175 }, { label: 'Digitizing · one time', amount: 100 }]);
    expect(chargeRows(m.options[0]).reduce((s, f) => s + f.amount, 0)).toBe(275);
    expect(html(m)).not.toContain('Small-order charge');
});
test('fractional per-piece display never changes the engine total', () => {
    const o = model([input('dtf', 6, 201.01)]).options[0];
    expect(o.total).toBe(201.01);
    expect(chargeRows(o).reduce((s, f) => s + f.amount, 0)).toBe(201.01);
});
test('customer fields and product content are escaped and unsafe image URLs omitted', () => {
    const i = input(); i.product.name = '<img src=x onerror=alert(1)>'; i.color.image = 'javascript:alert(1)';
    const result = html(model([i], { customer: '<script>bad()</script>' }));
    expect(result).not.toContain('<script>'); expect(result).not.toContain('src="javascript:');
    expect(result).toContain('&lt;script&gt;'); expect(result).toContain('&lt;img');
});
test('unavailable pricing cannot become a customer option', () => {
    const i = input(); i.preview.ok = false; expect(model([i]).options).toEqual([]);
});

const breaks = [
    { label: '10-23', range: { min: 10, max: 23 }, sampleQuantity: 10, sampleUnit: 27, sampleSetup: 100 },
    { label: '24-47', range: { min: 24, max: 47 }, sampleQuantity: 24, sampleUnit: 20, sampleSetup: 100 },
];
test('quantity browsing labels sampled prices and omits an unrequested total in screen and copy', () => {
    const doc = model([{ ...input('dtf', 10, 370), quantityRequested: false, tiers: breaks }]);
    for (const output of [html(doc), text(doc)]) {
        expect(output).toContain('10–23'); expect(output).toContain('$27.00');
        expect(output).toContain('$20.00'); expect(output).toContain('$100.00');
        expect(output).not.toContain('Estimated total'); expect(output).not.toContain('$370.00');
    }
    expect(text(doc)).toContain('10–23 pieces — at 10: $27.00/piece; one-time setup $100.00');
});
test('an exact quantity within a range replaces only that sample in every customer format', () => {
    const doc = model([{ ...input('dtf', 18, 541), tiers: breaks }]);
    for (const output of [html(doc), text(doc)]) {
        expect(output).toContain('$24.50'); expect(output).not.toContain('$27.00');
        expect(output).toContain('$20.00'); expect(output).toContain('$541.00');
    }
    expect(text(doc)).toContain('10–23 pieces — at 18: $24.50/piece; one-time setup $100.00');
    expect(text(doc)).toContain('Estimated total: $541.00');
});
