/**
 * quote-cart-store.test.js — QuoteCartStore (Phase 2 customer quote-cart).
 *
 * Covers the storage contract from memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md:
 * versioned schema (`nwca.quoteCart.v1`), 24h TTL, add/updateQty/remove/clear,
 * same-tab onChange pub/sub, and the "no pricing in the store" shape (items
 * carry sizes/qty/options only — never money).
 *
 * Node-env jest with a manual sessionStorage shim (repo convention — see
 * tests/unit/web-quote-cart-parity.test.js).
 */

const path = require('path');

const STORE_PATH = path.join(__dirname, '..', '..', 'shared_components', 'js', 'quote-cart-store.js');
const KEY = 'nwca.quoteCart.v1';

function makeStorage() {
    return {
        _s: {},
        getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
        setItem(k, v) { this._s[k] = String(v); },
        removeItem(k) { delete this._s[k]; }
    };
}

/** Fresh store module + fresh storage for every test. */
function freshStore() {
    jest.resetModules();
    global.sessionStorage = makeStorage();
    delete global.window; // node path: store binds to globalThis
    return require(STORE_PATH);
}

function sampleItem(overrides) {
    return Object.assign({
        style: 'PC61',
        productTitle: 'Port & Company Essential Tee',
        color: 'Deep Marine',
        catalogColor: 'DeepMarine',
        qty: 24,
        sizes: { S: 24 },
        method: 'EMB',
        placement: 'leftChest',
        placementLabel: 'Left chest',
        methodLabel: 'Embroidery',
        inkColors: null,
        isCap: false
    }, overrides || {});
}

describe('QuoteCartStore', () => {
    afterEach(() => {
        delete global.sessionStorage;
    });

    test('add() stores the item with id + addedAt and count() reflects it', () => {
        const store = freshStore();
        expect(store.count()).toBe(0);

        const stored = store.add(sampleItem());
        expect(stored.id).toMatch(/^qc_/);
        expect(stored.addedAt).toBeGreaterThan(0);
        expect(stored.style).toBe('PC61');
        expect(stored.sizes).toEqual({ S: 24 });
        expect(store.count()).toBe(1);
        expect(store.totalPieces()).toBe(24);

        // Persisted under the versioned key with schema v1
        const raw = JSON.parse(global.sessionStorage.getItem(KEY));
        expect(raw.v).toBe(1);
        expect(raw.items).toHaveLength(1);
        expect(raw.createdAt).toBeGreaterThan(0);
    });

    test('getItems() returns deep copies — mutating them never touches the store', () => {
        const store = freshStore();
        store.add(sampleItem());
        const items = store.getItems();
        items[0].qty = 999;
        items[0].sizes.S = 999;
        expect(store.getItems()[0].qty).toBe(24);
        expect(store.getItems()[0].sizes.S).toBe(24);
    });

    test('updateQty() changes qty AND rewrites the single-size breakdown; min 1', () => {
        const store = freshStore();
        const stored = store.add(sampleItem());

        const updated = store.updateQty(stored.id, 30);
        expect(updated.qty).toBe(30);
        expect(updated.sizes).toEqual({ S: 30 });

        // floors at 1 (junk/zero input can never zero a line)
        expect(store.updateQty(stored.id, 0).qty).toBe(1);
        expect(store.updateQty('nope', 5)).toBeNull();
    });

    test('remove() deletes by id; clear() empties the cart', () => {
        const store = freshStore();
        const a = store.add(sampleItem());
        const b = store.add(sampleItem({ style: 'PC90H', qty: 6, sizes: { S: 6 } }));
        expect(store.count()).toBe(2);

        expect(store.remove(a.id)).toBe(true);
        expect(store.remove(a.id)).toBe(false); // already gone
        expect(store.count()).toBe(1);
        expect(store.getItems()[0].id).toBe(b.id);

        store.clear();
        expect(store.count()).toBe(0);
        expect(store.getItems()).toEqual([]);
    });

    test('24h TTL: an expired cart resets to empty on read', () => {
        const store = freshStore();
        store.add(sampleItem());

        // Backdate createdAt beyond the TTL
        const raw = JSON.parse(global.sessionStorage.getItem(KEY));
        raw.createdAt = Date.now() - (store.TTL_MS + 1000);
        global.sessionStorage.setItem(KEY, JSON.stringify(raw));

        expect(store.getItems()).toEqual([]);
        expect(store.count()).toBe(0);
        // and the reset was persisted with a fresh createdAt
        const after = JSON.parse(global.sessionStorage.getItem(KEY));
        expect(after.items).toEqual([]);
        expect(Date.now() - after.createdAt).toBeLessThan(5000);
    });

    test('schema version mismatch resets to an empty v1 cart', () => {
        const store = freshStore();
        global.sessionStorage.setItem(KEY, JSON.stringify({
            v: 2, createdAt: Date.now(), items: [{ id: 'x', style: 'PC61' }]
        }));
        expect(store.getItems()).toEqual([]);
        expect(JSON.parse(global.sessionStorage.getItem(KEY)).v).toBe(1);
    });

    test('corrupted JSON resets instead of throwing', () => {
        const store = freshStore();
        global.sessionStorage.setItem(KEY, '{not json');
        expect(store.getItems()).toEqual([]);
        expect(store.count()).toBe(0);
        // add() still works after the reset
        store.add(sampleItem());
        expect(store.count()).toBe(1);
    });

    test('onChange fires on add/updateQty/remove/clear with the item count; unsubscribe stops it', () => {
        const store = freshStore();
        const calls = [];
        const off = store.onChange((n) => calls.push(n));

        const a = store.add(sampleItem());            // → 1
        store.add(sampleItem({ style: 'PC54' }));      // → 2
        store.updateQty(a.id, 12);                     // → 2
        store.remove(a.id);                            // → 1
        store.clear();                                 // → 0
        expect(calls).toEqual([1, 2, 2, 1, 0]);

        off();
        store.add(sampleItem());
        expect(calls).toEqual([1, 2, 2, 1, 0]); // no further calls
    });

    test('add() requires a style and never stores price fields', () => {
        const store = freshStore();
        expect(() => store.add({})).toThrow(/style/);

        const stored = store.add(sampleItem({ price: { total: 504 }, perPiece: 21 }));
        expect(stored.price).toBeUndefined();
        expect(stored.perPiece).toBeUndefined();
        const raw = JSON.parse(global.sessionStorage.getItem(KEY));
        expect(JSON.stringify(raw)).not.toContain('504');
    });
});
