/**
 * quote-cart-store.js — sessionStorage-backed store for the customer
 * quote cart (Phase 2 of the customer quote-cart project).
 *
 * Design: memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md (§Cart → STORE).
 *
 * WHAT IT OWNS: the cart's item list only — id, style, color, qty/sizes,
 * decoration method + placement choices, timestamps.
 *
 * WHAT IT NEVER OWNS: prices. Pricing happens at render time through
 * shared_components/js/quote-cart-engine.js (the staff-authority
 * orchestrator), so a Caspio price change reprices the cart on the next
 * view — no stale money ever persists here (Erik's #1 rule).
 *
 * Schema (sessionStorage key `nwca.quoteCart.v1`, 24h TTL):
 *   { v:1, createdAt, items:[{ id, style, productTitle, color, catalogColor,
 *     qty, sizes:{SIZE:qty}, method:'EMB'|'CAP'|'DTG'|'SCP'|'DTF',
 *     placement, placementLabel, methodLabel, inkColors, isCap, addedAt }] }
 *   - `sizes` is the engine-ready size breakdown captured at add time (one
 *     standard size in Phase 2); `qty` mirrors its sum for display.
 *   - Version mismatch, TTL expiry, or unparseable JSON → silent reset to an
 *     empty cart (a quote cart is a scratchpad, never a system of record).
 *
 * API (window.QuoteCartStore, also module.exports for jest):
 *   add(item) → stored item   updateQty(id, qty) → item|null
 *   remove(id) → boolean      clear()
 *   getItems() → deep copy    count() → item count
 *   totalPieces() → Σ qty     onChange(cb) → unsubscribe fn
 *
 * onChange fires on every same-tab mutation (pub/sub) AND on `storage`
 * events for the cart key, so masthead badges stay live everywhere.
 *
 * BADGE AUTO-INIT: when the document contains [data-quote-badge] elements,
 * the store wires them itself — hidden at 0, count into
 * [data-quote-badge-count] — so pages only need the markup + this script.
 */
(function (global) {
    'use strict';

    var KEY = 'nwca.quoteCart.v1';
    var SCHEMA_VERSION = 1;
    var TTL_MS = 24 * 60 * 60 * 1000; // 24h
    var listeners = [];
    var storageListenerWired = false;

    function storageArea() {
        // sessionStorage access can throw in privacy modes — degrade to a
        // memory-only cart rather than breaking the page.
        try {
            var s = global.sessionStorage;
            if (s) { return s; }
        } catch (e) { /* fall through */ }
        if (!storageArea._mem) {
            storageArea._mem = {
                _s: {},
                getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
                setItem: function (k, v) { this._s[k] = String(v); },
                removeItem: function (k) { delete this._s[k]; }
            };
        }
        return storageArea._mem;
    }

    function now() { return Date.now(); }

    function emptyState() {
        return { v: SCHEMA_VERSION, createdAt: now(), items: [] };
    }

    function readState() {
        var raw;
        try { raw = storageArea().getItem(KEY); } catch (e) { raw = null; }
        if (!raw) { return emptyState(); }
        var state;
        try { state = JSON.parse(raw); } catch (e) { return resetState(); }
        if (!state || state.v !== SCHEMA_VERSION || !Array.isArray(state.items)) {
            return resetState(); // schema mismatch → reset
        }
        var created = Number(state.createdAt);
        if (!isFinite(created) || (now() - created) > TTL_MS) {
            return resetState(); // 24h TTL expired
        }
        return state;
    }

    function resetState() {
        var state = emptyState();
        writeState(state);
        return state;
    }

    function writeState(state) {
        try { storageArea().setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota/privacy — memory copy still served this call */ }
    }

    function emit() {
        var n = count();
        listeners.forEach(function (cb) {
            try { cb(n); } catch (e) { /* one bad listener never blocks the rest */ }
        });
    }

    function genId() {
        return 'qc_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }

    function sumSizes(sizes) {
        var total = 0;
        Object.keys(sizes || {}).forEach(function (k) {
            var q = Number(sizes[k]);
            if (isFinite(q) && q > 0) { total += q; }
        });
        return total;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /** Add an item. Returns the stored item (with id + addedAt). */
    function add(item) {
        if (!item || !item.style) { throw new Error('QuoteCartStore.add: item.style is required'); }
        var state = readState();
        var sizes = item.sizes && sumSizes(item.sizes) > 0 ? deepCopy(item.sizes) : null;
        var qty = Math.max(1, Math.round(Number(item.qty)) || (sizes ? sumSizes(sizes) : 1));
        var stored = {
            id: genId(),
            style: String(item.style),
            productTitle: item.productTitle || String(item.style),
            color: item.color || '',
            catalogColor: item.catalogColor || '',
            qty: qty,
            sizes: sizes || {},
            method: item.method || '',
            placement: item.placement || '',
            placementLabel: item.placementLabel || '',
            methodLabel: item.methodLabel || '',
            inkColors: item.inkColors != null ? item.inkColors : null,
            isCap: item.isCap === true,
            addedAt: now()
        };
        if (state.items.length === 0) { state.createdAt = now(); } // fresh cart, fresh TTL
        state.items.push(stored);
        writeState(state);
        emit();
        return deepCopy(stored);
    }

    /** Update an item's quantity (min 1). Rewrites its single-size breakdown. */
    function updateQty(id, qty) {
        var n = Math.max(1, Math.round(Number(qty)) || 1);
        var state = readState();
        var item = null;
        for (var i = 0; i < state.items.length; i++) {
            if (state.items[i].id === id) { item = state.items[i]; break; }
        }
        if (!item) { return null; }
        item.qty = n;
        var sizeKeys = Object.keys(item.sizes || {});
        if (sizeKeys.length === 1) {
            item.sizes[sizeKeys[0]] = n;
        } else if (sizeKeys.length > 1) {
            // Multi-size items (not produced in Phase 2): put the delta on the
            // largest bucket so the breakdown stays engine-valid.
            var largest = sizeKeys.reduce(function (best, k) {
                return Number(item.sizes[k]) > Number(item.sizes[best]) ? k : best;
            }, sizeKeys[0]);
            item.sizes[largest] = Math.max(0, Number(item.sizes[largest]) + (n - sumSizes(item.sizes)));
        }
        writeState(state);
        emit();
        return deepCopy(item);
    }

    /** Remove an item by id. Returns true when something was removed. */
    function remove(id) {
        var state = readState();
        var before = state.items.length;
        state.items = state.items.filter(function (it) { return it.id !== id; });
        if (state.items.length === before) { return false; }
        writeState(state);
        emit();
        return true;
    }

    function clear() {
        writeState(emptyState());
        emit();
    }

    function getItems() {
        return deepCopy(readState().items);
    }

    function count() {
        return readState().items.length;
    }

    function totalPieces() {
        return readState().items.reduce(function (s, it) { return s + (Number(it.qty) || 0); }, 0);
    }

    /**
     * Subscribe to cart changes (same-tab mutations + storage events for the
     * cart key). cb receives the current item count. Returns an unsubscribe fn.
     */
    function onChange(cb) {
        if (typeof cb !== 'function') { throw new Error('QuoteCartStore.onChange: callback required'); }
        listeners.push(cb);
        if (!storageListenerWired && typeof global.addEventListener === 'function') {
            storageListenerWired = true;
            global.addEventListener('storage', function (e) {
                if (e && e.key === KEY) { emit(); }
            });
        }
        return function unsubscribe() {
            var idx = listeners.indexOf(cb);
            if (idx !== -1) { listeners.splice(idx, 1); }
        };
    }

    // ------------------------------------------------------------------
    // Masthead badge auto-init — pages add the markup, this script wires it:
    //   <a href="/quote-cart" data-quote-badge hidden>
    //     Quote <span data-quote-badge-count>0</span></a>
    // ------------------------------------------------------------------
    function initBadges() {
        var doc = global.document;
        if (!doc || typeof doc.querySelectorAll !== 'function') { return; }
        var badges = doc.querySelectorAll('[data-quote-badge]');
        if (!badges.length) { return; }
        function render() {
            var n = count();
            Array.prototype.forEach.call(badges, function (el) {
                el.hidden = n === 0;
                var countEl = el.querySelector('[data-quote-badge-count]');
                if (countEl) { countEl.textContent = String(n); }
            });
        }
        onChange(render);
        render();
    }

    var QuoteCartStore = {
        KEY: KEY,
        TTL_MS: TTL_MS,
        add: add,
        updateQty: updateQty,
        remove: remove,
        clear: clear,
        getItems: getItems,
        count: count,
        totalPieces: totalPieces,
        onChange: onChange
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = QuoteCartStore;
    }
    global.QuoteCartStore = QuoteCartStore;

    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', initBadges);
        } else {
            initBadges();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
