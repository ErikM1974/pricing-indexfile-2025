/**
 * Inventory Badges — shared helper for table-based quote builders
 *
 * Wraps the existing OrderFormInventory module (pages/order-form/inventory/
 * inventory-check.js) and renders small stock badges next to each size input
 * cell in a product row.
 *
 * DTG uses OrderFormInventory directly via React-style re-render. This module
 * provides a DOM-mutation API for table-based builders (EMB, DTF, SCP) so
 * they don't need to rewrite their render layer.
 *
 * Usage:
 *   // After style + catalogColor are set on a row:
 *   InventoryBadges.attach(rowEl, {
 *     style: 'PC54',
 *     catalogColor: 'Navy',
 *     sizeCellSelector: 'input.size-input',  // selects all per-size inputs in the row
 *   });
 *
 *   // Optional: clear badges when row is removed or color changes
 *   InventoryBadges.clear(rowEl);
 *
 * What it renders:
 *   Each matched size input gets a small `.inv-badge` span injected as a
 *   sibling. Color-coded by stock level:
 *     - green:  >= 100 in stock           (.inv-badge--good)
 *     - amber:  1-99 in stock              (.inv-badge--low)
 *     - red:    0 in stock                 (.inv-badge--oos)
 *     - gray:   API returned unknown       (.inv-badge--unknown)
 *
 *   Hover shows exact qty + cache age tooltip.
 *
 * Created 2026-05-23 — Phase 10.1 (DTG feature parity).
 */

(function (global) {
    'use strict';

    const BADGE_CLASS = 'inv-badge';

    // Map between common size name variants — SanMar inventory API uses
    // some keys (XXL) while the form inputs may use others (2XL). Mirror.
    const SIZE_ALIASES = {
        '2XL': ['XXL'],
        'XXL': ['2XL'],
    };

    /**
     * Look up stock for a size, considering aliases.
     */
    function getStockForSize(bySize, size) {
        if (bySize == null) return null;
        if (bySize[size] != null) return bySize[size];
        const aliases = SIZE_ALIASES[size];
        if (aliases) {
            for (const a of aliases) {
                if (bySize[a] != null) return bySize[a];
            }
        }
        return null;
    }

    /**
     * Classify a stock level into a status class.
     */
    function classifyStock(qty) {
        if (qty == null) return 'unknown';
        if (qty === 0) return 'oos';
        if (qty < 100) return 'low';
        return 'good';
    }

    /**
     * Format the badge label. Compact — fits under size input cells.
     */
    function formatLabel(qty, status) {
        if (status === 'unknown') return '—';
        if (status === 'oos') return 'OOS';
        if (qty >= 10000) return Math.floor(qty / 1000) + 'k';
        if (qty >= 1000) return (qty / 1000).toFixed(1) + 'k';
        return String(qty);
    }

    /**
     * Remove all .inv-badge elements from a row (or any container).
     */
    function clear(containerEl) {
        if (!containerEl) return;
        containerEl.querySelectorAll('.' + BADGE_CLASS).forEach((el) => el.remove());
    }

    /**
     * Attach inventory badges to size inputs inside a row.
     *
     * @param {HTMLElement} rowEl - The row (or any container) holding size inputs
     * @param {Object} opts
     * @param {string} opts.style          - SanMar style # (e.g. 'PC54')
     * @param {string} opts.catalogColor   - CATALOG_COLOR (e.g. 'Navy')
     * @param {string} [opts.sizeCellSelector='input.size-input'] - Selector for size inputs
     */
    async function attach(rowEl, opts) {
        if (!rowEl || !opts || !opts.style || !opts.catalogColor) return;
        if (typeof window === 'undefined' || !window.OrderFormInventory) {
            console.warn('[InventoryBadges] OrderFormInventory module not loaded');
            return;
        }

        const sizeCellSelector = opts.sizeCellSelector || 'input.size-input';

        // Clear any prior badges in this row before re-fetching
        clear(rowEl);

        let result;
        try {
            result = await window.OrderFormInventory.getInventoryForRow(
                opts.style, opts.catalogColor
            );
        } catch (err) {
            console.warn('[InventoryBadges] Fetch failed:', err);
            return;
        }

        if (!result || result.status === 'error') return;
        if (!result.bySize || Object.keys(result.bySize).length === 0) return;

        const inputs = Array.from(rowEl.querySelectorAll(sizeCellSelector));
        inputs.forEach((input) => {
            const size = input.dataset.size;
            if (!size) return;

            const qty = getStockForSize(result.bySize, size);
            const status = classifyStock(qty);
            const label = formatLabel(qty, status);

            // Look for existing badge (in case of race condition or re-call)
            // and replace; otherwise create new sibling after the input.
            const parent = input.parentElement;
            if (!parent) return;
            let badge = parent.querySelector('.' + BADGE_CLASS);
            if (!badge) {
                badge = document.createElement('span');
                badge.className = BADGE_CLASS;
                parent.appendChild(badge);
            }
            badge.classList.remove(
                BADGE_CLASS + '--good',
                BADGE_CLASS + '--low',
                BADGE_CLASS + '--oos',
                BADGE_CLASS + '--unknown'
            );
            badge.classList.add(BADGE_CLASS + '--' + status);
            badge.textContent = label;
            badge.title = status === 'unknown'
                ? `Stock unknown for ${size} (try again in a moment)`
                : `${qty.toLocaleString()} in stock for ${size} (${result.cacheAge || 'live'})`;
        });
    }

    global.InventoryBadges = { attach, clear, classifyStock, formatLabel };
})(typeof window !== 'undefined' ? window : globalThis);
