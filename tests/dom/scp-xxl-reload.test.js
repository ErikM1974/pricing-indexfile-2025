/**
 * SCP reload keeps every size — XXL by NAME — Batch 2.0 lock.
 *
 * The monolith's addProductFromQuote dropped ALL non-standard sizes (empty
 * else), so an edited quote re-saved without its XS/XXL/3XL+/tall pieces; and
 * the Quick-Quote path's own child-row fix deleted an XXL child right after
 * creating it (unprimed parent input → onSizeChange removes at qty 0).
 * Locks the Batch-2.0 rewrite: standard sizes fill inputs, XXL becomes a
 * NAMED child row (Size05 family, SKU suffix _XXL ≠ _2X) with the parent 2XL
 * input primed, other extended sizes become child rows, and the row is
 * targeted by minted id (never the transient .new-row class).
 */

const path = require('path');

// Pre-bundled by tests/dom/global-setup.js (esbuild cannot run inside jsdom).
const { addProductFromQuote } = require(path.join(__dirname, '.bundles', 'scp-persistence.cjs'));

function stubGlobals() {
    document.body.innerHTML = '<table><tbody id="product-tbody"></tbody></table>';
    window.addNewRow = jest.fn(() => {
        const tr = document.createElement('tr');
        tr.id = 'row-1';
        tr.dataset.rowId = '1';
        tr.innerHTML =
            '<td><input class="style-input"></td><td>' +
            ['S', 'M', 'L', 'XL', '2XL']
                .map((s) => `<input class="size-input" data-size="${s}" value="">`)
                .join('') +
            '</td>';
        document.getElementById('product-tbody').appendChild(tr);
        return 1;
    });
    window.onStyleChange = jest.fn(async () => {});
    window.selectColor = jest.fn();
    window.createChildRow = jest.fn();
    window.onSizeChange = jest.fn();
    window.showToast = jest.fn();
    window.escapeHtml = (s) => String(s);
}

describe('SCP addProductFromQuote size restoration (Batch 2.0)', () => {
    beforeEach(stubGlobals);

    test('XXL becomes a NAMED child row with the parent 2XL input primed', async () => {
        await addProductFromQuote({ styleNumber: 'LPC54', color: 'Black', sizeBreakdown: { M: 1, XXL: 4 } });
        const row = document.getElementById('row-1');
        expect(row.querySelector('input[data-size="M"]').value).toBe('1');
        expect(window.createChildRow).toHaveBeenCalledWith(1, 'XXL', 4);
        expect(row.querySelector('input[data-size="2XL"]').value).toBe('4');
        expect(window.onSizeChange).toHaveBeenCalledWith(1);
    });

    test('extended sizes (3XL, XS, talls) create child rows instead of vanishing', async () => {
        await addProductFromQuote({ styleNumber: 'PC61', color: 'White', sizeBreakdown: { '3XL': 2, XS: 3, XLT: 1 } });
        expect(window.createChildRow.mock.calls).toEqual([
            [1, '3XL', 2],
            [1, 'XS', 3],
            [1, 'XLT', 1],
        ]);
        expect(window.onSizeChange).toHaveBeenCalledTimes(1);
    });

    test('plain 2XL still flows through the parent input (no child minted here)', async () => {
        await addProductFromQuote({ styleNumber: 'PC54', color: 'Navy', sizeBreakdown: { '2XL': 5 } });
        expect(document.getElementById('row-1').querySelector('input[data-size="2XL"]').value).toBe('5');
        expect(window.createChildRow).not.toHaveBeenCalled();
    });
});
