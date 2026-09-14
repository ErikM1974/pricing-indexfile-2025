const fs = require('node:fs'), path = require('node:path'), parser = require('@babel/parser');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../..');
function extract(file, name) {
    const source = fs.readFileSync(path.join(root, file), 'utf8'); let found;
    function visit(n) { if (!n || typeof n !== 'object') return; if (['FunctionDeclaration', 'ClassMethod'].includes(n.type) && (n.id?.name || n.key?.name) === name) found = source.slice(n.start, n.end); for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v); }
    visit(parser.parse(source, { sourceType: 'unambiguous' })); if (!found) throw new Error('Missing actual function ' + name); return found;
}

test('saved customer quotes show inclusive units from the saved total, including merged sizes and free items', () => {
    const file = 'pages/js/quote-view.js';
    const view = new Function('return {' + extract(file, 'buildProductRows') + ',' + extract(file, 'parseSizeBreakdown') + '};')();
    const row = (qty, total, sizes) => ({ Quantity: qty, LineTotal: total, BaseUnitPrice: 25, FinalUnitPrice: 32.14, SizeBreakdown: JSON.stringify(sizes) });
    const group = { styleNumber: 'PC54', productName: 'Cotton Tee', color: 'Navy', items: [row(3, 100, { M: 3 }), row(4, 125, { M: 4 })] };
    const lines = view.buildProductRows(group, 0);
    expect(lines[0]).toMatchObject({ qty: 7, lineTotal: 225, unitPrice: 225 / 7 });
    expect(view.buildProductRows({ ...group, items: [row(2, 0, { '3XL': 2 })] }, 0)[0]).toMatchObject({ unitPrice: 0, lineTotal: 0 });
});

test.each(['emb', 'scp'])('%s PDF reads full precision instead of multiplying rounded visible cents', method => {
    const file = 'shared_components/js/builders/' + method + '/' + (method === 'emb' ? 'output' : 'save-output') + '.js';
    const name = method === 'emb' ? '_buildEmbInvoiceProduct' : '_buildScpInvoiceProduct';
    const dom = new JSDOM('<table><tr data-style="PC54" data-catalog-color="Navy" data-row-id="7"><td id="row-price-7" data-exact-unit-price="' + (25 + 50 / 7) + '">$32.14</td></tr></table>');
    const build = new Function('document', method + 'State', extract(file, name) + '; return ' + name)(dom.window.document, { childRowMap: {} });
    const invoice = build({ style: 'PC54', catalogColor: 'Navy', sizeBreakdown: { M: 7 }, productName: 'Cotton Tee', color: 'Navy' });
    expect(invoice.lineItems[0].total).toBeCloseTo(225, 8);
    expect(invoice.lineItems[0].unitPrice).toBe(25 + 50 / 7);
});

test('restoring separate display preferences retains a waiver but always uses inclusive customer pricing', () => {
    const dom = new JSDOM('<div id="ltm"></div>');
    const source = ['renderLtmControlPanel', 'getLtmControlState', 'setLtmControlState'].map(n => extract('shared_components/js/quote-builder-utils.js', n)).join('\n');
    const api = new Function('document', 'escapeHtml', source + ';return {renderLtmControlPanel,getLtmControlState,setLtmControlState};')(dom.window.document, s => s);
    api.renderLtmControlPanel('ltm', { feeAmount: 50, defaultMode: 'separate' });
    expect(dom.window.document.querySelector('input[value="separate"]')).toBeNull();
    expect(api.getLtmControlState('ltm')).toEqual({ enabled: true, displayMode: 'builtin' });
    api.setLtmControlState('ltm', { enabled: false, displayMode: 'separate' });
    expect(api.getLtmControlState('ltm')).toEqual({ enabled: false, displayMode: 'builtin' });
});
