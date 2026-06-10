/**
 * 3dt-shipdate.test.js — behavioral spec for the 3-Day Tees ship-date engine.
 *
 * Promise rule: order before 9 AM Pacific on a business day → production
 * clock starts that day; otherwise it starts the NEXT business day. Ship =
 * production start + 3 business days (weekends + holiday calendar skipped).
 *
 * Times below are constructed in UTC and asserted against Pacific wall-clock
 * behavior (PDT = UTC-7 in June, PST = UTC-8 in January).
 */
const SD = require('../../pages/js/3-day-tees-shipdate.js');

// 2026-06-09 is a Tuesday (regular business day).
const utc = (s) => new Date(s);

describe('cutoff behavior (Pacific wall clock)', () => {
    test('Tue 8:59 AM PDT (15:59 UTC) — before cutoff, clock starts today, ships Friday', () => {
        const p = SD.promise(utc('2026-06-09T15:59:00Z'));
        expect(p.beforeCutoff).toBe(true);
        expect(p.shipDateIso).toBe('2026-06-12'); // Wed+Thu+Fri
        expect(p.cutoff.minutesAway).toBe(1);
    });

    test('Tue 9:00 AM PDT exactly (16:00 UTC) — cutoff missed, clock starts Wednesday, ships Monday', () => {
        const p = SD.promise(utc('2026-06-09T16:00:00Z'));
        expect(p.beforeCutoff).toBe(false);
        expect(p.shipDateIso).toBe('2026-06-15'); // Thu+Fri+Mon
    });

    test('Pacific/UTC boundary: Tue 7 PM PDT = Wed 02:00 UTC stays "Tuesday evening" in Pacific', () => {
        const p = SD.promise(utc('2026-06-10T02:00:00Z'));
        expect(p.beforeCutoff).toBe(false);
        expect(p.shipDateIso).toBe('2026-06-15'); // same as missing Tuesday's cutoff
    });

    test('January uses PST (UTC-8): Mon 2026-01-05 16:59 UTC = 8:59 AM PST, before cutoff', () => {
        const p = SD.promise(utc('2026-01-05T16:59:00Z'));
        expect(p.beforeCutoff).toBe(true);
        expect(p.shipDateIso).toBe('2026-01-08');
    });
});

describe('weekends and holidays', () => {
    test('Saturday order → clock starts Monday, ships Thursday', () => {
        const p = SD.promise(utc('2026-06-13T18:00:00Z')); // Sat 11 AM PDT
        expect(p.beforeCutoff).toBe(false);
        expect(p.shipDateIso).toBe('2026-06-18');
    });

    test('cutoff never applies on a weekend even before 9 AM', () => {
        const p = SD.promise(utc('2026-06-13T15:00:00Z')); // Sat 8 AM PDT
        expect(p.beforeCutoff).toBe(false);
    });

    test('order before July 3 2026 holiday (observed July 4): Thu 7/2 early → ships Wed 7/8', () => {
        // Clock starts Thu 7/2. +3 business days skipping Fri 7/3 (holiday),
        // Sat, Sun: Mon 7/6, Tue 7/7, Wed 7/8.
        const p = SD.promise(utc('2026-07-02T15:00:00Z')); // 8 AM PDT
        expect(p.beforeCutoff).toBe(true);
        expect(p.shipDateIso).toBe('2026-07-08');
    });

    test('Juneteenth 2026-06-19 (Friday) is skipped in the 3-day walk', () => {
        // Tue 6/16 before cutoff → Wed, Thu, (Fri 6/19 holiday), Mon 6/22.
        const p = SD.promise(utc('2026-06-16T15:00:00Z'));
        expect(p.shipDateIso).toBe('2026-06-22');
    });

    test('factory closure: Dec 24 2026 (Thu) after-cutoff order rides out the closure', () => {
        // Clock starts the next business day after 12/24: 12/25-12/31 all closed,
        // Jan 1-2 closed (Sat Jan 2), so Monday Jan 4 2027. +3 biz days → Jan 7.
        const p = SD.promise(utc('2026-12-24T20:00:00Z'));
        expect(p.shipDateIso).toBe('2027-01-07');
    });
});

describe('countdown + calendar runway', () => {
    test('after-cutoff countdown targets the next business day 9 AM', () => {
        const p = SD.promise(utc('2026-06-09T17:00:00Z')); // Tue 10 AM PDT
        // 23 hours to Wednesday 9 AM
        expect(p.cutoff.minutesAway).toBe(23 * 60);
        expect(p.cutoff.hours).toBe(23);
    });

    test('Friday after cutoff → countdown spans the weekend to Monday', () => {
        const p = SD.promise(utc('2026-06-12T17:00:00Z')); // Fri 10 AM PDT
        expect(p.cutoff.minutesAway).toBe(71 * 60); // Sat+Sun+23h
    });

    test('calendar has at least 13 months of runway from today', () => {
        expect(SD.calendarRunwayDays(new Date())).toBeGreaterThan(395);
    });

    test('formatting helpers', () => {
        expect(SD.formatShort({ y: 2026, m: 6, d: 12 })).toMatch(/Fri, Jun 12/);
        expect(SD.formatLong({ y: 2026, m: 6, d: 12 })).toMatch(/Friday, June 12, 2026/);
    });
});
