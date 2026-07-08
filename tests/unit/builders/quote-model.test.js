/**
 * builders/shared/quote-model.js — roadmap 0.5 lock.
 *
 * The canonical line-item model all three builders converge on. Locks the
 * store API (add/update/remove/duplicate, totals) and the EMB tier rule:
 * caps and garments tier SEPARATELY (CLAUDE.md — never combine their
 * quantities for a tier discount).
 */

const path = require('path');
const esbuild = require('esbuild');

function loadModule() {
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, '../../../shared_components/js/builders/shared/quote-model.js')],
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        write: false,
        logLevel: 'silent',
    });
    const moduleObj = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'console', result.outputFiles[0].text)(
        moduleObj, moduleObj.exports, { log() {}, warn() {}, error() {} }
    );
    return moduleObj.exports;
}

const { QuoteState, createQuoteItem } = loadModule();

describe('createQuoteItem', () => {
    test('derives totalQty from sizes and fills canonical keys', () => {
        const item = createQuoteItem({
            styleNumber: 'PC54',
            colorName: 'Brilliant Orange',
            catalogColor: 'BrillOrng',
            sizes: [{ size: 'M', qty: 5 }, { size: 'L', qty: '7' }],
        });
        expect(item.totalQty).toBe(12);
        expect(item.id).toMatch(/^qi-/);
        expect(item.catalogColor).toBe('BrillOrng'); // API/PO color, not display
        expect(item.isService).toBe(false);
        expect(item.isCap).toBe(false);
    });
});

describe('QuoteState', () => {
    test('add/update/remove/duplicate keep totals consistent + notify listeners', () => {
        const qs = new QuoteState();
        const seen = [];
        qs.onChange((items) => seen.push(items.length));

        const a = qs.addLine({ styleNumber: 'PC54', sizes: [{ size: 'M', qty: 10 }] });
        qs.addLine({ styleNumber: 'C112', isCap: true, sizes: [{ size: 'OSFA', qty: 24 }] });
        expect(qs.totalPieces()).toBe(34);

        qs.updateLine(a.id, { sizes: [{ size: 'M', qty: 4 }] });
        expect(qs.totalPieces()).toBe(28);

        const copy = qs.duplicateLine(a.id);
        expect(copy.id).not.toBe(a.id);
        expect(qs.totalPieces()).toBe(32);

        const removed = qs.removeLine(copy.id);
        expect(removed.id).toBe(copy.id);
        expect(qs.totalPieces()).toBe(28);
        expect(seen).toEqual([1, 2, 2, 3, 2]);
    });

    test('tierGroups: caps and garments tier SEPARATELY (EMB rule)', () => {
        const qs = new QuoteState();
        qs.addLine({ styleNumber: 'PC54', sizes: [{ size: 'M', qty: 20 }] });
        qs.addLine({ styleNumber: 'C112', isCap: true, sizes: [{ size: 'OSFA', qty: 30 }] });
        qs.addLine({ styleNumber: 'AL', isService: true, sizes: [{ size: 'OSFA', qty: 99 }] });
        const g = qs.tierGroups();
        expect(g.garments.pieces).toBe(20); // NOT 50 — caps never pool with garments
        expect(g.caps.pieces).toBe(30);
        expect(g.garments.items).toHaveLength(1);
        expect(g.caps.items).toHaveLength(1); // service excluded entirely
    });

    test('subtotal sums only priced lines (display aid; pricing owns math)', () => {
        const qs = new QuoteState();
        qs.addLine({ styleNumber: 'A', lineTotal: 100.5 });
        qs.addLine({ styleNumber: 'B' });
        expect(qs.subtotal()).toBe(100.5);
    });
});
