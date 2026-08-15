/**
 * The shared small-batch fee ROW — jsdom behaviour lock (2026-08-15).
 *
 * Customer-supplied garments/caps and full back all earn the same $50 fee and share ONE
 * synthesized row. Full back joined that row on 2026-08-15, which made the wiring the
 * most intricate part of the change and — until this file — the only part with no test:
 * two independent sync paths (syncALRows for full back, syncDECGRows for DECG/DECC) write
 * into shared module state and both re-render the row from the combined picture.
 *
 * What must hold:
 *   • garment + cap keep SUMMING (they tier and run separately — predates full back)
 *   • full back does NOT stack on top (it's a location on garments already counted)
 *   • a full-back-only order still gets the fee
 *   • the row disappears when the fee stops applying
 *   • deleting the row waives it until the fee itself changes
 */
const path = require('path');

const { _syncDecgLtmRow } = require(path.join(__dirname, '.bundles', 'emb-pricing-sync.cjs'));

function mountTable() {
    document.body.innerHTML = '<table><tbody id="product-tbody"></tbody></table>';
    // createServiceProductRow reads embState.rowCounter off the window bridge.
    window.embState = window.embState || {};
    window.embState.rowCounter = 0;
    window.showToast = () => {};
    window.escapeHtml = s => String(s == null ? '' : s);
}

const feeRow = () => document.querySelector('#product-tbody tr[data-service-type="ltm"]');
const feeAmount = () => {
    const r = feeRow();
    return r ? parseFloat(r.dataset.unitPrice) : null;
};

beforeEach(mountTable);

describe('who contributes to the fee', () => {
    test('customer-supplied garment alone → one fee', () => {
        _syncDecgLtmRow({ garment: 50, cap: 0, fullback: 0 }, { garment: 3, cap: 0, fullback: 0 });
        expect(feeRow()).toBeTruthy();
        expect(feeAmount()).toBe(50);
    });

    test('garment + cap SUM — they are separate machine runs (unchanged behaviour)', () => {
        _syncDecgLtmRow({ garment: 50, cap: 50, fullback: 0 }, { garment: 3, cap: 4, fullback: 0 });
        expect(feeAmount()).toBe(100);
    });

    test('full back alone earns the fee — the case that used to charge nothing', () => {
        _syncDecgLtmRow({ garment: 0, cap: 0, fullback: 50 }, { garment: 0, cap: 0, fullback: 5 });
        expect(feeRow()).toBeTruthy();
        expect(feeAmount()).toBe(50);
    });

    test('full back does NOT stack on customer-supplied goods', () => {
        // A full back is a location on garments that have already been counted, so an
        // order with both must not jump to $100.
        _syncDecgLtmRow({ garment: 50, cap: 0, fullback: 50 }, { garment: 3, cap: 0, fullback: 3 });
        expect(feeAmount()).toBe(50);
    });

    test('garment + cap + full back is still just the supplied sum', () => {
        _syncDecgLtmRow({ garment: 50, cap: 50, fullback: 50 }, { garment: 3, cap: 2, fullback: 3 });
        expect(feeAmount()).toBe(100);
    });
});

describe('the row appears and disappears with the fee', () => {
    test('no fee → no row', () => {
        _syncDecgLtmRow({ garment: 0, cap: 0, fullback: 0 }, { garment: 0, cap: 0, fullback: 0 });
        expect(feeRow()).toBeNull();
    });

    test('quantity rises past the band → the row is removed', () => {
        _syncDecgLtmRow({ garment: 0, cap: 0, fullback: 50 }, { garment: 0, cap: 0, fullback: 5 });
        expect(feeRow()).toBeTruthy();
        // qty 30 → the engine returns ltmFee 0 → the row must go
        _syncDecgLtmRow({ garment: 0, cap: 0, fullback: 0 }, { garment: 0, cap: 0, fullback: 30 });
        expect(feeRow()).toBeNull();
    });

    test('the last customer-supplied row going away leaves a full-back fee standing', () => {
        _syncDecgLtmRow({ garment: 50, cap: 0, fullback: 50 }, { garment: 3, cap: 0, fullback: 3 });
        expect(feeAmount()).toBe(50);
        // rep deletes the DECG line; the full back is still on the order
        _syncDecgLtmRow({ garment: 0, cap: 0, fullback: 50 }, { garment: 0, cap: 0, fullback: 3 });
        expect(feeRow()).toBeTruthy();
        expect(feeAmount()).toBe(50);
    });

    test('exactly ONE fee row ever exists, however many times we sync', () => {
        for (let i = 0; i < 5; i++) {
            _syncDecgLtmRow({ garment: 50, cap: 0, fullback: 50 }, { garment: 3, cap: 0, fullback: 3 });
        }
        expect(document.querySelectorAll('#product-tbody tr[data-service-type="ltm"]').length).toBe(1);
    });
});

describe('waiving', () => {
    test('deleting the row waives the fee until the fee itself changes', () => {
        _syncDecgLtmRow({ garment: 50, cap: 0, fullback: 0 }, { garment: 3, cap: 0, fullback: 0 });
        feeRow().remove();

        // same fee → stays waived
        _syncDecgLtmRow({ garment: 50, cap: 0, fullback: 0 }, { garment: 3, cap: 0, fullback: 0 });
        expect(feeRow()).toBeNull();

        // fee CHANGES (a cap joins the order) → a fresh decision point, row returns
        _syncDecgLtmRow({ garment: 50, cap: 50, fullback: 0 }, { garment: 3, cap: 2, fullback: 0 });
        expect(feeRow()).toBeTruthy();
        expect(feeAmount()).toBe(100);
    });

    test('a full back arriving after a waive is also a fresh decision point', () => {
        _syncDecgLtmRow({ garment: 50, cap: 0, fullback: 0 }, { garment: 3, cap: 0, fullback: 0 });
        feeRow().remove();
        // full back joins → the signature changes even though the TOTAL does not,
        // because the fee is keyed on what earned it, not just the amount.
        _syncDecgLtmRow({ garment: 50, cap: 0, fullback: 50 }, { garment: 3, cap: 0, fullback: 3 });
        expect(feeRow()).toBeTruthy();
    });
});
