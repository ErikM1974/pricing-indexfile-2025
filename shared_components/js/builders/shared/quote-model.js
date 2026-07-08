/**
 * Canonical quote-item model shared by the builders (roadmap 0.5).
 *
 * ONE line-item shape + ONE store API so "sync all builders" is real in
 * code: EMB migrates first (builders/emb/state.js instantiates the store);
 * SCP and DTF adopt it during their decompositions, deleting their bespoke
 * row-tracking (DTF's child-row Map plumbing) in favor of this.
 *
 * The store owns LINE-ITEM state only — method-specific config (logos,
 * print locations) lives in each builder's state module. Pricing stays in
 * the pricing services (Rule 9: the store never computes a price).
 */

/**
 * @typedef {import('../../types/quote').QuoteItem} QuoteItem
 * @typedef {import('../../types/quote').SizeQty} SizeQty
 */

let _nextItemId = 1;

/**
 * Create a canonical line item. Unknown extra fields are allowed (method
 * payloads ride in `decoration`), but the canonical keys always exist.
 * @param {Partial<QuoteItem> & {styleNumber?: string}} init
 * @returns {QuoteItem}
 */
export function createQuoteItem(init = {}) {
    const sizes = Array.isArray(init.sizes) ? init.sizes.map((s) => ({ size: String(s.size), qty: Number(s.qty) || 0 })) : [];
    return {
        id: init.id || `qi-${_nextItemId++}`,
        styleNumber: init.styleNumber || '',
        colorName: init.colorName || '',
        catalogColor: init.catalogColor || '',
        description: init.description || '',
        sizes,
        totalQty: sizes.reduce((sum, s) => sum + (Number(s.qty) || 0), 0),
        decoration: init.decoration || {},
        unitPrice: typeof init.unitPrice === 'number' ? init.unitPrice : undefined,
        lineTotal: typeof init.lineTotal === 'number' ? init.lineTotal : undefined,
        isService: !!init.isService,
        isCap: !!init.isCap,
    };
}

/**
 * The line-item store. Deliberately boring: an array + methods, no DOM,
 * no fetch, no price math. Consumers subscribe via onChange for renders.
 */
export class QuoteState {
    constructor() {
        /** @type {QuoteItem[]} */
        this.items = [];
        /** @type {Array<(items: QuoteItem[]) => void>} */
        this._listeners = [];
    }

    /** @param {(items: QuoteItem[]) => void} fn */
    onChange(fn) {
        this._listeners.push(fn);
        return () => {
            this._listeners = this._listeners.filter((l) => l !== fn);
        };
    }

    _emit() {
        for (const fn of this._listeners) {
            try {
                fn(this.items);
            } catch (err) {
                console.error('[QuoteState] onChange listener failed:', err);
            }
        }
    }

    /** @param {Partial<QuoteItem>} init @returns {QuoteItem} the stored item */
    addLine(init) {
        const item = createQuoteItem(init);
        this.items.push(item);
        this._emit();
        return item;
    }

    /** @param {string} id @param {Partial<QuoteItem>} patch @returns {QuoteItem|null} */
    updateLine(id, patch) {
        const item = this.items.find((i) => i.id === id);
        if (!item) return null;
        Object.assign(item, patch);
        if (patch.sizes) {
            item.sizes = patch.sizes.map((s) => ({ size: String(s.size), qty: Number(s.qty) || 0 }));
            item.totalQty = item.sizes.reduce((sum, s) => sum + s.qty, 0);
        }
        this._emit();
        return item;
    }

    /** @param {string} id @returns {QuoteItem|null} the removed item (for undo) */
    removeLine(id) {
        const idx = this.items.findIndex((i) => i.id === id);
        if (idx === -1) return null;
        const [removed] = this.items.splice(idx, 1);
        this._emit();
        return removed;
    }

    /** @param {string} id @returns {QuoteItem|null} the new copy */
    duplicateLine(id) {
        const src = this.items.find((i) => i.id === id);
        if (!src) return null;
        const copy = createQuoteItem({ ...src, id: undefined });
        this.items.push(copy);
        this._emit();
        return copy;
    }

    clear() {
        this.items = [];
        this._emit();
    }

    /** Total pieces across product lines (services excluded). */
    totalPieces() {
        return this.items.filter((i) => !i.isService).reduce((sum, i) => sum + (i.totalQty || 0), 0);
    }

    /** Sum of lineTotals that exist (display aid — pricing owns the math). */
    subtotal() {
        return this.items.reduce((sum, i) => sum + (typeof i.lineTotal === 'number' ? i.lineTotal : 0), 0);
    }

    /**
     * EMB rule: caps and garments TIER SEPARATELY — never combine their
     * quantities for a tier discount (CLAUDE.md). Returns both groups with
     * their independent piece counts.
     */
    tierGroups() {
        const groups = { garments: { items: [], pieces: 0 }, caps: { items: [], pieces: 0 } };
        for (const item of this.items) {
            if (item.isService) continue;
            const bucket = item.isCap ? groups.caps : groups.garments;
            bucket.items.push(item);
            bucket.pieces += item.totalQty || 0;
        }
        return groups;
    }
}
