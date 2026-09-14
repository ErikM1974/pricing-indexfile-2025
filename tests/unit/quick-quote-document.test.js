const { model, html, chargeRows } = require('../../calculators/quick-quote/quick-quote-document');
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
