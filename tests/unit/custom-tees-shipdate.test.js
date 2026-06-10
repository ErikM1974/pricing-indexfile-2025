/**
 * custom-tees-shipdate.test.js — locks the STANDARD 7-10 business-day promise
 * (the rush promise() is the unchanged 3DT engine, locked by 3dt-shipdate.test.js;
 * a couple of smoke cases here prove the clone still behaves).
 */
const SD = require('../../pages/js/custom-tees-shipdate.js');

// Pacific-time instants (PDT = UTC-7 in June 2026)
const tue_june9_8am = new Date('2026-06-09T15:00:00Z');   // Tue 8:00 AM PDT (before cutoff)
const tue_june9_2pm = new Date('2026-06-09T21:00:00Z');   // Tue 2:00 PM PDT (after cutoff)
const fri_july3 = new Date('2026-07-02T20:00:00Z');       // Thu Jul 2, 1 PM PDT (Jul 3 = holiday)

describe('standardPromise — 7-10 business day window', () => {
    test('clock starts NEXT business day regardless of order time', () => {
        const morning = SD.standardPromise(tue_june9_8am);
        const afternoon = SD.standardPromise(tue_june9_2pm);
        // Same order day (Wed Jun 10) whether ordered 8 AM or 2 PM — no cutoff.
        expect(morning.orderDay).toEqual({ y: 2026, m: 6, d: 10 });
        expect(afternoon.orderDay).toEqual(morning.orderDay);
    });

    test('window = +7 to +10 business days from the order day', () => {
        const p = SD.standardPromise(tue_june9_2pm);
        // Order day Wed Jun 10. +7 biz days: 11,12,15,16,17,18 — wait Jun 19 is a
        // holiday (Juneteenth) → 11,12,15,16,17,18,22 = Mon Jun 22.
        expect(p.shipStartIso).toBe('2026-06-22');
        // +10: 23,24,25 → Thu Jun 25.
        expect(p.shipEndIso).toBe('2026-06-25');
    });

    test('binding stamped date is the END of the window (shipDateIso keys)', () => {
        const p = SD.standardPromise(tue_june9_2pm);
        expect(p.shipDateIso).toBe(p.shipEndIso);
        expect(p.shipDateLong).toContain('June 25');
        expect(p.rangeLabel).toMatch(/Jun 22.*Jun 25/);
    });

    test('holiday + weekend skipping near July 4th window', () => {
        const p = SD.standardPromise(fri_july3);
        // Order Thu Jul 2 1 PM → order day Mon Jul 6 (Jul 3 holiday, weekend skipped).
        expect(p.orderDay).toEqual({ y: 2026, m: 7, d: 6 });
    });

    test('mode flag is standard', () => {
        expect(SD.standardPromise(tue_june9_8am).mode).toBe('standard');
    });
});

describe('rush promise() smoke — clone unchanged', () => {
    test('before 9 AM cutoff ships +3 business days', () => {
        const p = SD.promise(tue_june9_8am);
        expect(p.beforeCutoff).toBe(true);
        // Order day Tue Jun 9 → +3 biz: Jun 10, 11, 12 → Fri Jun 12.
        expect(p.shipDateIso).toBe('2026-06-12');
    });

    test('after cutoff rolls to next business day', () => {
        const p = SD.promise(tue_june9_2pm);
        expect(p.beforeCutoff).toBe(false);
        // Order day Wed Jun 10 → 11, 12, 15 → Mon Jun 15.
        expect(p.shipDateIso).toBe('2026-06-15');
    });
});
