/**
 * DTF child-row state API — roadmap 1.14 lock.
 *
 * this.childRows (a Map) is the ONLY money-bearing record of extended-size
 * child rows; DOM rows are display-only. registerChildRow / setChildRowQty /
 * removeProduct are the sole writers (2026-06-11 P2 closure). These tests
 * exercise the REAL methods off DTFQuoteBuilder.prototype against a minimal
 * receiver — no constructor side effects, pure state semantics.
 */

const path = require('path');

// Pre-bundled by tests/dom/global-setup.js (esbuild cannot run inside jsdom).
const { DTFQuoteBuilder } = require(path.join(__dirname, '.bundles', 'dtf-quote-builder-class.cjs'));

function makeState() {
    return {
        childRows: new Map(),
        products: [],
        dirty: 0,
        markAsUnsaved() { this.dirty++; },
        // real methods under test, bound to this minimal state
        registerChildRow: DTFQuoteBuilder.prototype.registerChildRow,
        setChildRowQty: DTFQuoteBuilder.prototype.setChildRowQty,
        getChildRowsForParent: DTFQuoteBuilder.prototype.getChildRowsForParent,
        removeProduct: DTFQuoteBuilder.prototype.removeProduct,
    };
}

describe('registerChildRow', () => {
    test('coerces ids to Number and qty/baseCost to numerics', () => {
        const s = makeState();
        s.registerChildRow('12', { parentId: '3', size: '3XL', qty: '5', baseCost: '2.50', sizeUpcharges: { '3XL': 2 } });
        const entry = s.childRows.get(12); // Number key, not '12'
        expect(entry).toEqual({ parentId: 3, size: '3XL', qty: 5, baseCost: 2.5, sizeUpcharges: { '3XL': 2 } });
    });

    test('garbage qty/baseCost land as 0 (never NaN into money math)', () => {
        const s = makeState();
        s.registerChildRow(7, { parentId: 1, size: '4XL', qty: 'abc', baseCost: undefined });
        expect(s.childRows.get(7).qty).toBe(0);
        expect(s.childRows.get(7).baseCost).toBe(0);
    });
});

describe('setChildRowQty', () => {
    test('updates via string or number id; ignores unknown ids', () => {
        const s = makeState();
        s.registerChildRow(9, { parentId: 1, size: '3XL', qty: 1 });
        s.setChildRowQty('9', 24);
        expect(s.childRows.get(9).qty).toBe(24);
        expect(() => s.setChildRowQty(999, 5)).not.toThrow();
    });
});

describe('getChildRowsForParent', () => {
    test('filters by parent and preserves insertion order (legacy childRowMap order)', () => {
        const s = makeState();
        s.registerChildRow(11, { parentId: 1, size: '3XL', qty: 3 });
        s.registerChildRow(12, { parentId: 2, size: '4XL', qty: 1 });
        s.registerChildRow(13, { parentId: 1, size: '5XL', qty: 2 });
        expect(s.getChildRowsForParent('1').map((c) => c.id)).toEqual([11, 13]);
        expect(s.getChildRowsForParent(2).map((c) => c.id)).toEqual([12]);
    });
});

describe('removeProduct — the single state-removal chokepoint', () => {
    test('removes a product row and marks unsaved', () => {
        const s = makeState();
        s.products.push({ id: 5, styleNumber: 'PC54' });
        s.removeProduct(5);
        expect(s.products).toHaveLength(0);
        expect(s.dirty).toBe(1);
    });

    test('removes a CHILD row from childRows (deleteRow funnels child ids here too)', () => {
        const s = makeState();
        s.registerChildRow(21, { parentId: 1, size: '3XL', qty: 6 });
        s.removeProduct(21);
        expect(s.childRows.has(21)).toBe(false);
        expect(s.dirty).toBe(1);
    });

    test('unknown id: no state change, no dirty mark, no throw', () => {
        const s = makeState();
        s.products.push({ id: 5 });
        s.removeProduct(404);
        expect(s.products).toHaveLength(1);
        expect(s.dirty).toBe(0);
    });
});
