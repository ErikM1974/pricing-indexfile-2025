/**
 * SCP draft-restore completion — A-grade Batch 1.1 regression lock.
 *
 * The monolith (and the verbatim S1a move) called the never-defined
 * updateRowQuantityTotal() per restored size, so restoring any draft with
 * product quantities threw mid-loop: half-restored row, no recalc, no toast.
 * Locks the fix: restore reaches recalculatePricing() + showToast(), size
 * values land in the inputs, and onSizeChange fires once per restored row
 * (the same handler a manual size edit fires).
 */

const path = require('path');

// Pre-bundled by tests/dom/global-setup.js (esbuild cannot run inside jsdom).
const { restoreScreenPrintDraft } = require(path.join(__dirname, '.bundles', 'scp-persistence.cjs'));

function stubGlobals() {
    document.body.innerHTML = '<table><tbody id="product-tbody"></tbody></table>';
    let nextRow = 1;
    window.addNewRow = jest.fn(() => {
        const id = nextRow++;
        const tr = document.createElement('tr');
        tr.id = `row-${id}`;
        tr.innerHTML =
            '<td class="cell-style"></td><td class="cell-desc"></td><td class="cell-color"></td>' +
            '<td>' +
            ['S', 'M', 'L', 'XL', '2XL']
                .map((s) => `<input class="size-input" data-size="${s}" value="">`)
                .join('') +
            '</td>';
        document.getElementById('product-tbody').appendChild(tr);
        return id;
    });
    window.onSizeChange = jest.fn();
    window.recalculatePricing = jest.fn();
    window.showToast = jest.fn();
    window.escapeHtml = (s) => String(s);
    window.updatePrintConfig = jest.fn();
    delete window.renderOrderRecap;
}

const DRAFT = {
    customerName: 'Draft Customer',
    products: [
        { style: 'PC61', color: 'Jet Black', catalogColor: 'JetBlack', description: 'Tee', sizes: { M: 5, L: 3 } },
        { style: 'PC54', color: 'White', catalogColor: 'White', description: 'Tee 2', sizes: { S: 2 } },
    ],
};

describe('restoreScreenPrintDraft (Batch 1.1)', () => {
    beforeEach(stubGlobals);

    test('completes: size values restored, recalc + success toast reached', () => {
        expect(() => restoreScreenPrintDraft(DRAFT)).not.toThrow();

        const row1 = document.getElementById('row-1');
        expect(row1.querySelector('input[data-size="M"]').value).toBe('5');
        expect(row1.querySelector('input[data-size="L"]').value).toBe('3');
        expect(document.getElementById('row-2').querySelector('input[data-size="S"]').value).toBe('2');

        expect(window.recalculatePricing).toHaveBeenCalled();
        expect(window.showToast).toHaveBeenCalledWith('Draft restored successfully', 'success');
    });

    test('onSizeChange fires once per restored row (not per size, not zero)', () => {
        restoreScreenPrintDraft(DRAFT);
        expect(window.onSizeChange.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    });

    test('rows with no restorable sizes skip the size handler', () => {
        restoreScreenPrintDraft({ products: [{ style: 'X', sizes: { M: 0 } }] });
        expect(window.onSizeChange).not.toHaveBeenCalled();
        expect(window.showToast).toHaveBeenCalled();
    });
});
