/**
 * 3-day-tees-shipdate.js — PURE ship-date promise engine for 3-Day Tees.
 *
 * One source of truth for "order by 9 AM Pacific on a business day → ships
 * 3 business days later". Loaded by the page (banner + Pay button + review)
 * AND require()d by server.js, which stamps the BINDING promise date on the
 * quote session at checkout time — so the customer's screen and the order
 * record can never disagree.
 *
 * All math is done in Pacific wall-clock {y,m,d,hour,minute} components
 * extracted via Intl (no Date arithmetic across time zones — the legacy
 * page mixed toISOString() UTC days with local-time Dates, which mislabeled
 * holidays for evening users east of Pacific).
 *
 * `now` is injectable everywhere for tests (tests/unit/3dt-shipdate.test.js).
 */
(function (global) {
    'use strict';

    // US federal holidays + NWCA factory closure (Dec 26-31 annually).
    // Jan 1-2 of the following year close out each year's closure window.
    // Extend annually — selfCheck() (called at page boot + server boot)
    // complains loudly when the calendar has under ~13 months of runway.
    const NON_BUSINESS_DAYS = [
        // 2025
        '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26',
        '2025-06-19', '2025-07-04', '2025-09-01', '2025-10-13',
        '2025-11-11', '2025-11-27', '2025-11-28', '2025-12-25',
        '2025-12-26', '2025-12-27', '2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31',
        // 2026
        '2026-01-01', '2026-01-02', '2026-01-19', '2026-02-16', '2026-05-25',
        '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12',
        '2026-11-11', '2026-11-26', '2026-11-27', '2026-12-25',
        '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
        // 2027
        '2027-01-01', '2027-01-02', '2027-01-18', '2027-02-15', '2027-05-31',
        '2027-06-18', '2027-07-05', '2027-09-06', '2027-10-11',
        '2027-11-11', '2027-11-25', '2027-11-26', '2027-12-24',
        '2027-12-26', '2027-12-27', '2027-12-28', '2027-12-29', '2027-12-30', '2027-12-31',
        // 2028
        '2028-01-01', '2028-01-02', '2028-01-17', '2028-02-21', '2028-05-29',
        '2028-06-19', '2028-07-04', '2028-09-04', '2028-10-09',
        '2028-11-10', '2028-11-23', '2028-11-24', '2028-12-25',
        '2028-12-26', '2028-12-27', '2028-12-28', '2028-12-29', '2028-12-30', '2028-12-31',
        // 2029
        '2029-01-01', '2029-01-02', '2029-01-15', '2029-02-19', '2029-05-28',
        '2029-06-19', '2029-07-04', '2029-09-03', '2029-10-08',
        '2029-11-12', '2029-11-22', '2029-11-23', '2029-12-25',
        '2029-12-26', '2029-12-27', '2029-12-28', '2029-12-29', '2029-12-30', '2029-12-31',
        // 2030
        '2030-01-01', '2030-01-02', '2030-01-21', '2030-02-18', '2030-05-27',
        '2030-06-19', '2030-07-04', '2030-09-02', '2030-10-14',
        '2030-11-11', '2030-11-28', '2030-11-29', '2030-12-25',
        '2030-12-26', '2030-12-27', '2030-12-28', '2030-12-29', '2030-12-30', '2030-12-31',
        // 2031
        '2031-01-01', '2031-01-02', '2031-01-20', '2031-02-17', '2031-05-26',
        '2031-06-19', '2031-07-04', '2031-09-01', '2031-10-13',
        '2031-11-11', '2031-11-27', '2031-11-28', '2031-12-25',
        '2031-12-26', '2031-12-27', '2031-12-28', '2031-12-29', '2031-12-30', '2031-12-31',
        // 2032 boundary
        '2032-01-01', '2032-01-02',
    ];
    const HOLIDAY_SET = new Set(NON_BUSINESS_DAYS);

    const CUTOFF_HOUR = 9; // 9 AM Pacific
    const PROMISE_BUSINESS_DAYS = 3;

    /** Pacific wall-clock components of `now`. */
    function pacificNow(now) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Los_Angeles',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(now || new Date());
        const get = (t) => parseInt(parts.find((p) => p.type === t).value, 10);
        // Intl gives hour 24 for midnight in some engines; normalize.
        return { y: get('year'), m: get('month'), d: get('day'),
                 hour: get('hour') % 24, minute: get('minute') };
    }

    /** Pacific short timezone label (PST / PDT) for `now`. */
    function pacificTzAbbr(now) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles', timeZoneName: 'short', hour: 'numeric',
        }).formatToParts(now || new Date());
        const tz = parts.find((p) => p.type === 'timeZoneName');
        return tz ? tz.value : 'PT';
    }

    function iso(day) {
        const mm = String(day.m).padStart(2, '0');
        const dd = String(day.d).padStart(2, '0');
        return `${day.y}-${mm}-${dd}`;
    }

    /** Day-of-week of a calendar date (0=Sun..6=Sat) — timezone-free. */
    function dayOfWeek(day) {
        return new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
    }

    function addDays(day, n) {
        const dt = new Date(Date.UTC(day.y, day.m - 1, day.d));
        dt.setUTCDate(dt.getUTCDate() + n);
        return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    }

    function isHoliday(day) {
        return HOLIDAY_SET.has(iso(day));
    }

    function isBusinessDay(day) {
        const dow = dayOfWeek(day);
        return dow !== 0 && dow !== 6 && !isHoliday(day);
    }

    function nextBusinessDay(day) {
        let d = day;
        while (!isBusinessDay(d)) d = addDays(d, 1);
        return d;
    }

    function addBusinessDays(day, n) {
        let d = day;
        let added = 0;
        while (added < n) {
            d = addDays(d, 1);
            if (isBusinessDay(d)) added++;
        }
        return d;
    }

    /** 'Thursday, June 12, 2026' */
    function formatLong(day) {
        return new Date(Date.UTC(day.y, day.m - 1, day.d)).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
        });
    }

    /** 'Thu, Jun 12' */
    function formatShort(day) {
        return new Date(Date.UTC(day.y, day.m - 1, day.d)).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
        });
    }

    /**
     * The whole promise in one call.
     * {
     *   beforeCutoff,                      true = today's 9 AM still reachable
     *   orderDay,                          production-clock start day
     *   shipDay,                           promised ship day
     *   shipDateIso / shipDateLong / shipDateShort,
     *   cutoff: { day, minutesAway, hours, minutes },   next live cutoff
     *   tzAbbr,
     * }
     */
    function promise(now) {
        const p = pacificNow(now);
        const today = { y: p.y, m: p.m, d: p.d };
        const beforeCutoff = isBusinessDay(today) && p.hour < CUTOFF_HOUR;

        const orderDay = beforeCutoff ? today : nextBusinessDay(addDays(today, 1));
        const shipDay = addBusinessDays(orderDay, PROMISE_BUSINESS_DAYS);

        // Countdown to the next live cutoff (today 9 AM if reachable, else
        // 9 AM on the next business day).
        const cutoffDay = beforeCutoff ? today : nextBusinessDay(addDays(today, 1));
        let dayGap = 0;
        let walk = today;
        while (iso(walk) !== iso(cutoffDay)) { walk = addDays(walk, 1); dayGap++; }
        const minutesAway = dayGap * 24 * 60 + (CUTOFF_HOUR * 60 - (p.hour * 60 + p.minute));

        return {
            beforeCutoff: beforeCutoff,
            orderDay: orderDay,
            shipDay: shipDay,
            shipDateIso: iso(shipDay),
            shipDateLong: formatLong(shipDay),
            shipDateShort: formatShort(shipDay),
            cutoff: {
                day: cutoffDay,
                dayLong: formatLong(cutoffDay),
                minutesAway: minutesAway,
                hours: Math.floor(minutesAway / 60),
                minutes: minutesAway % 60,
            },
            tzAbbr: pacificTzAbbr(now),
        };
    }

    /**
     * Calendar-runway check. Returns the number of days of calendar coverage
     * left; callers warn when it dips under ~400 (13 months). Never throws.
     */
    function calendarRunwayDays(now) {
        const p = pacificNow(now);
        const last = NON_BUSINESS_DAYS[NON_BUSINESS_DAYS.length - 1].split('-').map(Number);
        const msLeft = Date.UTC(last[0], last[1] - 1, last[2]) - Date.UTC(p.y, p.m - 1, p.d);
        return Math.floor(msLeft / 86400000);
    }

    const TDTShipDate = {
        promise: promise,
        isBusinessDay: isBusinessDay,
        isHoliday: isHoliday,
        addBusinessDays: addBusinessDays,
        nextBusinessDay: nextBusinessDay,
        pacificNow: pacificNow,
        formatLong: formatLong,
        formatShort: formatShort,
        calendarRunwayDays: calendarRunwayDays,
        CUTOFF_HOUR: CUTOFF_HOUR,
        PROMISE_BUSINESS_DAYS: PROMISE_BUSINESS_DAYS,
        NON_BUSINESS_DAYS: NON_BUSINESS_DAYS,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TDTShipDate;
    }
    global.TDTShipDate = TDTShipDate;
})(typeof window !== 'undefined' ? window : globalThis);
