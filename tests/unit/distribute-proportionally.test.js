/**
 * distributeProportionally — lock for the clickable quantity-nudge math
 * (UX audit P1 #3, 2026-07-06). Clicking the nudge chip adds the missing
 * pieces to reach the next tier, scaled proportionally across the size cells
 * the rep already typed (largest-remainder method).
 *
 * Contract: the additions ALWAYS sum to exactly `delta` (a nudge that lands
 * one piece short leaves the order below the tier it just promised), bigger
 * sizes absorb more, zero-qty cells never receive pieces, and the result is
 * deterministic (stable index tie-break).
 */
const { distributeProportionally } = require('../../shared_components/js/quote-builder-utils.js');

const sum = (a) => a.reduce((s, x) => s + x, 0);

describe('distributeProportionally (clickable quantity nudge)', () => {
    test('exact proportional split when delta divides evenly', () => {
        // 10+20+30=60, delta 6 → 1/2/3
        expect(distributeProportionally([10, 20, 30], 6)).toEqual([1, 2, 3]);
    });

    test('additions ALWAYS sum to exactly delta (the tier-landing guarantee)', () => {
        for (const [qtys, delta] of [
            [[7, 11, 3], 5],
            [[1, 1, 1], 2],
            [[5, 5, 5, 5], 3],
            [[48], 24],
            [[2, 4, 6, 8, 1], 17],
        ]) {
            const adds = distributeProportionally(qtys, delta);
            expect(sum(adds)).toBe(delta);
            expect(adds.every((a) => a >= 0)).toBe(true);
        }
    });

    test('largest remainder wins; equal remainders break ties by index (deterministic)', () => {
        // 3 equal cells, delta 2 → raw 0.667 each; first two cells get the pieces
        expect(distributeProportionally([1, 1, 1], 2)).toEqual([1, 1, 0]);
    });

    test('single cell takes the whole delta (SCP nudge from 16 → 24 on one size)', () => {
        expect(distributeProportionally([16], 8)).toEqual([8]);
    });

    test('bigger sizes absorb more (typical S/M/L/XL bell curve)', () => {
        // EMB: 6+12+18+8=44, nudge to 48 → delta 4
        const adds = distributeProportionally([6, 12, 18, 8], 4);
        expect(sum(adds)).toBe(4);
        expect(adds[2]).toBeGreaterThanOrEqual(adds[0]); // L gets at least what S gets
    });

    test('zero/invalid delta or empty quantities → all zeros', () => {
        expect(distributeProportionally([5, 5], 0)).toEqual([0, 0]);
        expect(distributeProportionally([5, 5], -3)).toEqual([0, 0]);
        expect(distributeProportionally([], 5)).toEqual([]);
        expect(distributeProportionally([0, 0], 5)).toEqual([0, 0]);
    });

    test('zero-qty cells never receive pieces', () => {
        const adds = distributeProportionally([10, 0, 10], 5);
        expect(adds[1]).toBe(0);
        expect(sum(adds)).toBe(5);
    });
});
