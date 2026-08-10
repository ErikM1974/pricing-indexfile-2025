/**
 * vacation-carryover.test.js — the ten cases from Erik's 2026-08-03 carryover spec.
 *
 * The transform exists because payroll books hours to the tax year of the CHECK date, so
 * vacation taken in the last pay period of a year inflates BOTH accrued and used in the
 * next year by the same carryover. These tests pin the two things that must never drift:
 * the carryover is always derived (never a hardcoded 32), and sick hours are never touched.
 */
const VC = require('../../dashboards/js/vacation-carryover.js');

// The 7/24/2026 packet's as-of date, and a "today" close enough to it not to trip the
// 14-day staleness warning. Both injected so these tests don't rot with the wall clock.
const AS_OF = '2026-07-24';
const TODAY = '2026-07-27';

function employee(over) {
  return Object.assign({
    Payroll_Employee_ID: 6295,
    Employee_Full_Name: 'Test Employee',
    Leave_Balances_As_Of: AS_OF,
    Vacation_Hours_Available: 0,
    Vacation_Hours_Used: 0,
    Vacation_Hours_Remaining: 0,
    Vacation_Annual_Entitlement: 80,
    Sick_Accum_Hours_Available: 0,
    Sick_Hours_Used: 0,
    Sick_Hours_Remaining: 0,
  }, over);
}

const build = (over) => VC.buildSlipFigures(employee(over), { today: TODAY });
const codes = (r) => r.flags.map((f) => f.code).sort();

describe('§10 — the spec\'s test matrix', () => {
  test('1. Sorphorn Sorm 112/56/56 @80 → 80/24/56 (the primary case)', () => {
    const r = build({
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 56,
      Vacation_Annual_Entitlement: 80,
    });
    expect(r.carryover).toBe(32);
    expect(r.slip).toEqual({ accrued: 80, used: 24, remaining: 56 });
    expect(r.printable).toBe(true);
    expect(r.flags).toEqual([]);
  });

  test('2. Joseph Hallowell 80/44/36 @80 → unchanged, carryover 0', () => {
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 44, Vacation_Hours_Remaining: 36,
    });
    expect(r.carryover).toBe(0);
    expect(r.slip).toEqual({ accrued: 80, used: 44, remaining: 36 });
    expect(r.printable).toBe(true);
  });

  test('3. Bunsereytheavy Hoeu 80/88/−8 @80 → negative remaining is PRESERVED', () => {
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 88, Vacation_Hours_Remaining: -8,
    });
    expect(r.slip).toEqual({ accrued: 80, used: 88, remaining: -8 });
    expect(r.slip.remaining).toBeLessThan(0); // never floored to zero
    expect(r.printable).toBe(true);
  });

  test('4. Taneisha Clark 0/16/−16, pre-eligibility → entitlement in force is 0', () => {
    const r = build({
      Payroll_Employee_ID: 6391,
      Vacation_Hours_Available: 0, Vacation_Hours_Used: 16, Vacation_Hours_Remaining: -16,
      Vacation_Annual_Entitlement: 40,      // her post-anniversary grant …
      Vacation_Eligible_Date: '2026-08-12', // … which is not in force on 2026-07-24
    });
    expect(r.entitlement).toBe(0);
    expect(r.carryover).toBe(0);
    expect(r.slip).toEqual({ accrued: 0, used: 16, remaining: -16 });
    expect(r.printable).toBe(true);
  });

  // 🔴 Sothea Tann's 40 is her FULL annual grant, not a partial year (Erik 2026-08-03) — a
  // permanent, normal case. Never "correct" a non-80 entitlement, and never infer one from
  // tenure: accrual here does not track years of service (Sorphorn is above 80 at 15 years
  // while Erik at 29 and Ruthie at 28 are at 80).
  test('5. Sothea Tann 40/40/0 @40 → a non-80 entitlement is honoured', () => {
    const r = build({
      Vacation_Hours_Available: 40, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 0,
      Vacation_Annual_Entitlement: 40,
    });
    expect(r.carryover).toBe(0);
    expect(r.slip).toEqual({ accrued: 40, used: 40, remaining: 0 });
    expect(r.printable).toBe(true);
  });

  test('5b. a non-80 entitlement still subtracts its own carryover correctly', () => {
    // The case that would break if anything ever hardcoded 80: Sothea with a December
    // carryover. 56 accrued = 40 grant + 16 carried in; 24 used = 8 real + the same 16.
    const r = build({
      Vacation_Hours_Available: 56, Vacation_Hours_Used: 24, Vacation_Hours_Remaining: 32,
      Vacation_Annual_Entitlement: 40,
    });
    expect(r.carryover).toBe(16);
    expect(r.slip).toEqual({ accrued: 40, used: 8, remaining: 32 });
    expect(r.printable).toBe(true);
  });

  test('6. Sreyani Meang 80/80/0 @80 → fully used', () => {
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 80, Vacation_Hours_Remaining: 0,
    });
    expect(r.slip).toEqual({ accrued: 80, used: 80, remaining: 0 });
    expect(r.printable).toBe(true);
  });

  test('7. null entitlement → NO SLIP, flagged (§7.2 — never default to 80)', () => {
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 40,
      Vacation_Annual_Entitlement: null,
    });
    expect(r.printable).toBe(false);
    expect(r.slip).toBeNull();
    expect(codes(r)).toEqual(['missing-entitlement']);
    // The raw figures still survive for the audit trail.
    expect(r.raw).toEqual({ available: 80, used: 40, remaining: 40 });
  });

  test('8. 60/20/40 @80 → carryover would be negative: clamped to 0 AND flagged', () => {
    const r = build({
      Vacation_Hours_Available: 60, Vacation_Hours_Used: 20, Vacation_Hours_Remaining: 40,
    });
    expect(r.carryover).toBe(0);                              // never negative …
    expect(r.slip).toEqual({ accrued: 80, used: 20, remaining: 40 }); // … so used is not inflated
    expect(codes(r)).toEqual(['identity-failed', 'negative-carryover']);
    expect(r.printable).toBe(false); // 80 − 20 ≠ 40, so it must not reach paper
  });
});

describe('§6 — sick hours are never transformed', () => {
  test('Sorphorn\'s sick figures pass through completely untouched', () => {
    const r = build({
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 56,
      Sick_Accum_Hours_Available: 53.35, Sick_Hours_Used: 31, Sick_Hours_Remaining: 22.35,
    });
    expect(r.sick).toEqual({ accrued: 53.35, used: 31, remaining: 22.35 });
  });

  test('sick accrued far above any annual figure is left alone (WA statutory carryover)', () => {
    const r = build({
      Vacation_Annual_Entitlement: 80,
      Sick_Accum_Hours_Available: 107.4, Sick_Hours_Used: 0, Sick_Hours_Remaining: 107.4,
    });
    expect(r.sick.accrued).toBe(107.4); // NOT capped at 40 or at the vacation entitlement
  });

  test('negative sick balances survive (Deland −14, Som −0.93)', () => {
    expect(build({ Sick_Hours_Remaining: -14 }).sick.remaining).toBe(-14);
    expect(build({ Sick_Hours_Remaining: -0.93 }).sick.remaining).toBe(-0.93);
  });
});

describe('§7.2 — blank is not zero', () => {
  test.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string (what Caspio returns for a blank NUMBER)', ''],
  ])('%s entitlement blocks the slip', (_label, value) => {
    const r = build({ Vacation_Annual_Entitlement: value });
    expect(r.entitlement).toBeNull();
    expect(r.printable).toBe(false);
  });

  test('a real 0 entitlement is honoured, not treated as missing (Jim Mickelson)', () => {
    const r = build({
      Payroll_Employee_ID: 1000, Vacation_Annual_Entitlement: 0,
      Vacation_Hours_Available: 0, Vacation_Hours_Used: 0, Vacation_Hours_Remaining: 0,
    });
    expect(r.entitlement).toBe(0);
    expect(r.printable).toBe(true);
    expect(r.slip).toEqual({ accrued: 0, used: 0, remaining: 0 });
    expect(codes(r)).toEqual([]);
  });
});

describe('§9 — the entitlement is date-effective', () => {
  const clark = {
    Payroll_Employee_ID: 6391,
    Vacation_Annual_Entitlement: 40,
    Vacation_Eligible_Date: '2026-08-12',
  };

  test('the day before eligibility → 0', () => {
    expect(VC.entitlementInForce(clark, '2026-08-11')).toBe(0);
  });

  test('the eligibility date itself → the full grant', () => {
    expect(VC.entitlementInForce(clark, '2026-08-12')).toBe(40);
  });

  test('after eligibility → the full grant', () => {
    expect(VC.entitlementInForce(clark, '2026-09-01')).toBe(40);
  });

  test('the value in force follows Leave_Balances_As_Of, NOT today', () => {
    // Slips reprinted in September for the July packet must still read as of July.
    const r = VC.buildSlipFigures(employee(Object.assign({
      Leave_Balances_As_Of: AS_OF,
      Vacation_Hours_Available: 0, Vacation_Hours_Used: 16, Vacation_Hours_Remaining: -16,
    }, clark)), { today: '2026-09-01' });
    expect(r.entitlement).toBe(0);
    expect(r.slip.accrued).toBe(0);
  });

  test('no eligible date → the stored entitlement applies at any as-of', () => {
    expect(VC.entitlementInForce({ Vacation_Annual_Entitlement: 80 }, '1999-01-01')).toBe(80);
  });
});

describe('§7.4 — stale balances warn but still print', () => {
  test('14 days is not yet stale', () => {
    const r = build({ Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 40 });
    const at14 = VC.buildSlipFigures(employee({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 40,
    }), { today: '2026-08-07' });
    expect(r.flags).toEqual([]);
    expect(codes(at14)).toEqual([]);
  });

  test('15 days warns — and the slip still prints', () => {
    const r = VC.buildSlipFigures(employee({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 40,
    }), { today: '2026-08-08' });
    expect(codes(r)).toEqual(['stale-balances']);
    expect(r.printable).toBe(true);
    expect(r.staleDays).toBe(15);
  });
});

describe('§12 — the carryover is derived, never hardcoded', () => {
  test.each([
    [112, 56, 56, 80, 32],
    [104, 48, 56, 80, 24],   // a different December, a different carryover
    [88, 32, 56, 80, 8],
    [80, 24, 56, 80, 0],     // 2027 rollover — the artifact clears on its own
    [120, 80, 40, 40, 80],   // a 40-hour entitlement carries differently
  ])('%i/%i/%i @%i → carryover %i', (avail, used, rem, ent, expected) => {
    const r = build({
      Vacation_Hours_Available: avail, Vacation_Hours_Used: used,
      Vacation_Hours_Remaining: rem, Vacation_Annual_Entitlement: ent,
    });
    expect(r.carryover).toBe(expected);
    expect(r.slip.accrued).toBe(ent);
    expect(r.slip.used).toBe(used - expected);
    expect(r.slip.remaining).toBe(rem); // always the trusted imported figure
    expect(r.printable).toBe(true);
  });

  test('a carryover run carries the audit reason string (§11)', () => {
    const withCarry = build({
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 56,
    });
    expect(withCarry.carryoverReason).toBe('prior-year vacation paid on a current-year check date');
    expect(build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 40,
    }).carryoverReason).toBe('');
  });
});

describe('a too-low entitlement can never reach paper (adversarial review, 2026-08-03)', () => {
  // 🔴 The §7.1 identity assertion CANNOT catch this. Whenever entitlement <= available the
  // max() clamp is inert and the entitlement cancels out of accrued − used entirely:
  //   E − (U − (A − E)) = A − U, which the import guarantees equals remaining.
  // A carryover is hours both accrued AND used in the prior year, so carryover > used is an
  // impossible state — that is the invariant with actual power over the entitlement.
  test.each([
    ['one digit dropped', 8, -48],
    ['half the grant', 40, -16],
    ['zero-ish typo', 0, -56],
    ['one below the boundary', 55, -1],
  ])('Sorphorn 112/56/56 with entitlement %s (%i) is BLOCKED, not printed as used=%i',
    (_label, ent, expectedUsed) => {
      const r = build({
        Vacation_Hours_Available: 112, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 56,
        Vacation_Annual_Entitlement: ent,
      });
      expect(r.slip.used).toBe(expectedUsed);   // the arithmetic still reports what it computed …
      expect(codes(r)).toContain('used-below-zero');
      expect(r.printable).toBe(false);          // … but it never reaches an employee's hand
    });

  test('the identity assertion alone would have passed every one of those', () => {
    // Pinning WHY the extra guard is needed: remove it and these all sail through.
    const r = build({
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 56,
      Vacation_Annual_Entitlement: 8,
    });
    expect(codes(r)).not.toContain('identity-failed'); // 8 − (−48) = 56 ✔ — a tautology here
    expect(codes(r)).toEqual(['used-below-zero']);
  });

  test('the §9 eligibility gate can trigger it too, with no typo at all', () => {
    // A pre-eligibility employee whose packet already shows accrued hours: the gate forces
    // the entitlement to 0, so the whole accrual reads as carryover.
    const r = build({
      Vacation_Hours_Available: 40, Vacation_Hours_Used: 16, Vacation_Hours_Remaining: 24,
      Vacation_Annual_Entitlement: 40, Vacation_Eligible_Date: '2026-08-12',
    });
    expect(r.entitlement).toBe(0);
    expect(r.slip.used).toBe(-24);
    expect(r.printable).toBe(false);
  });

  test('a legitimate zero used is NOT blocked', () => {
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 0, Vacation_Hours_Remaining: 80,
    });
    expect(r.slip.used).toBe(0);
    expect(r.printable).toBe(true);
    expect(r.flags).toEqual([]);
  });

  test('carryover exactly equal to used lands on zero and still prints', () => {
    const r = build({
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 32, Vacation_Hours_Remaining: 80,
      Vacation_Annual_Entitlement: 80,
    });
    expect(r.carryover).toBe(32);
    expect(r.slip).toEqual({ accrued: 80, used: 0, remaining: 80 });
    expect(r.printable).toBe(true);
  });

  // ⚠️ KNOWN LIMIT, DELIBERATELY PINNED. The guard fires when the carryover exceeds the
  // imported used hours, i.e. when entitlement < remaining. A mis-keyed entitlement that
  // stays at or above `remaining` produces a self-consistent slip and CANNOT be detected:
  // there is no second source of truth for a hand-maintained number. For Sorphorn (112/56/56)
  // the detectable range is entitlement < 56 — a typo of 24 hours or more.
  // If this ever needs closing, the answer is a second authority (an entitlement history
  // table, or the accountant's own grant figure), not a cleverer assertion here.
  test('a mis-key that stays above `remaining` is NOT detectable — documenting the gap', () => {
    const r = build({
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 56,
      Vacation_Annual_Entitlement: 70, // true value is 80
    });
    expect(r.slip).toEqual({ accrued: 70, used: 14, remaining: 56 }); // plausible, and wrong
    expect(r.flags).toEqual([]);
    expect(r.printable).toBe(true);
  });

  test('the detection boundary is exactly `entitlement < remaining`', () => {
    const at = (ent) => build({
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 56,
      Vacation_Annual_Entitlement: ent,
    }).printable;
    expect(at(56)).toBe(true);   // carryover 56 == used 56 → slip_used 0
    expect(at(55)).toBe(false);  // carryover 57 > used 56 → impossible state, blocked
  });
});

describe('as-of is per employee, never borrowed from the roster (adversarial review)', () => {
  // The import PUTs Employees one row at a time inside a try/catch, and an active employee
  // absent from the packet is never touched — so one person really can sit months behind.
  const behind = {
    Leave_Balances_As_Of: '2026-01-30T00:00:00',
    Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 40,
  };

  test('an un-refreshed employee is judged on THEIR date and warns', () => {
    const r = VC.buildSlipFigures(employee(behind), {
      fallbackAsOf: '2026-07-24', today: '2026-07-27',
    });
    expect(r.asOf).toBe('2026-01-30');
    expect(r.staleDays).toBe(178);
    expect(codes(r)).toEqual(['stale-balances']);
  });

  test('the roster stamp cannot suppress that warning', () => {
    // The roster max is always >= the individual, so borrowing it only ever HIDES staleness.
    const r = VC.buildSlipFigures(employee(behind), {
      fallbackAsOf: '2026-12-31', today: '2026-07-27',
    });
    expect(r.asOf).toBe('2026-01-30');
    expect(codes(r)).toContain('stale-balances');
  });

  test('§9 is evaluated on the employee\'s own date, not the roster\'s', () => {
    const r = VC.buildSlipFigures(employee({
      Leave_Balances_As_Of: '2026-07-24T00:00:00',
      Vacation_Hours_Available: 0, Vacation_Hours_Used: 16, Vacation_Hours_Remaining: -16,
      Vacation_Annual_Entitlement: 40, Vacation_Eligible_Date: '2026-08-12',
    }), { fallbackAsOf: '2026-09-30', today: '2026-07-27' });
    expect(r.entitlement).toBe(0); // 2026-07-24 < 2026-08-12, despite the later roster stamp
  });

  test('no stamp of their own → borrow the roster\'s, but say so', () => {
    const r = VC.buildSlipFigures(employee({
      Leave_Balances_As_Of: '',
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 40,
    }), { fallbackAsOf: '2026-07-24', today: '2026-07-27' });
    expect(r.asOf).toBe('2026-07-24');
    expect(codes(r)).toEqual(['borrowed-as-of']);
    expect(r.printable).toBe(true); // a warning, not a block
  });

  test('no stamp anywhere → flagged as undateable', () => {
    const r = VC.buildSlipFigures(employee({
      Leave_Balances_As_Of: '',
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 40,
    }), { today: '2026-07-27' });
    expect(r.asOf).toBe('');
    expect(codes(r)).toEqual(['unknown-as-of']);
  });
});

describe('the identity holds across decimal hours', () => {
  test('a fractional carryover still reconciles inside tolerance', () => {
    const r = build({
      Vacation_Hours_Available: 107.4, Vacation_Hours_Used: 51.4,
      Vacation_Hours_Remaining: 56, Vacation_Annual_Entitlement: 80,
    });
    expect(r.carryover).toBe(27.4);
    expect(r.slip).toEqual({ accrued: 80, used: 24, remaining: 56 });
    expect(r.printable).toBe(true);
  });

  test('inputs that contradict each other are caught, not printed', () => {
    // remaining doesn't equal available − used in the import itself.
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 999,
    });
    expect(codes(r)).toContain('identity-failed');
    expect(r.printable).toBe(false);
  });
});

describe('the live 2026-07-24 roster all reconciles', () => {
  // Every active employee as Caspio actually held them on 2026-08-03, with the entitlements
  // from the spec's §9 table. All 16 must produce a printable slip.
  const ROSTER = [
    ['Bradley Wright', 6347, 80, 72, 8, 80],
    ['Brian Beardsley', 6366, 80, 24, 56, 80],
    ['Bunsereytheavy Hoeu', 6333, 80, 88, -8, 80],
    ['Erik Mickelson', 6087, 80, 56, 24, 80],
    ['Jim Mickelson', 1000, 0, 0, 0, 0],
    ['Joseph Hallowell', 6372, 80, 44, 36, 80],
    ['Kanha Chhorn', 6356, 80, 64, 16, 80],
    ['Mikalah Hede', 6389, 80, 40, 40, 80],
    ['Nika Lao', 6310, 80, 40, 40, 80],
    ['Ruthie Nhoung', 6221, 80, 40, 40, 80],
    ['Savy Som', 6292, 80, 40, 40, 80],
    ['Sorphorn Sorm', 6295, 80, 24, 56, 80],
    ['Sothea Tann', 6382, 40, 40, 0, 40],
    ['Sreyani Meang', 6376, 80, 80, 0, 80],
    ['Steve Deland', 6349, 80, 72, 8, 80],
  ];

  test.each(ROSTER)('%s prints cleanly', (name, id, avail, used, rem, ent) => {
    const r = build({
      Employee_Full_Name: name, Payroll_Employee_ID: id,
      Vacation_Hours_Available: avail, Vacation_Hours_Used: used,
      Vacation_Hours_Remaining: rem, Vacation_Annual_Entitlement: ent,
    });
    expect(r.printable).toBe(true);
    expect(r.flags).toEqual([]);
  });

  test('Taneisha Clark prints cleanly too, via the eligibility gate', () => {
    const r = build({
      Employee_Full_Name: 'Taneisha Clark', Payroll_Employee_ID: 6391,
      Vacation_Hours_Available: 0, Vacation_Hours_Used: 16, Vacation_Hours_Remaining: -16,
      Vacation_Annual_Entitlement: 40, Vacation_Eligible_Date: '2026-08-12',
      Sick_Accum_Hours_Available: 36.6333, Sick_Hours_Used: 70.5, Sick_Hours_Remaining: -33.87,
    });
    expect(r.printable).toBe(true);
    expect(r.slip).toEqual({ accrued: 0, used: 16, remaining: -16 });
    expect(r.sick.remaining).toBe(-33.87);
  });

  test('Sorphorn reverts to 112/56 at the next import and STILL prints 80/24/56', () => {
    // The 80/24/56 currently in Caspio is a hand-patch the Friday import will overwrite.
    const r = build({
      Employee_Full_Name: 'Sorphorn Sorm', Payroll_Employee_ID: 6295,
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 56,
      Vacation_Annual_Entitlement: 80,
      Sick_Accum_Hours_Available: 53.35, Sick_Hours_Used: 31, Sick_Hours_Remaining: 22.35,
    });
    expect(r.slip).toEqual({ accrued: 80, used: 24, remaining: 56 });
    expect(r.sick).toEqual({ accrued: 53.35, used: 31, remaining: 22.35 });
    expect(r.printable).toBe(true);
  });
});

/**
 * A floored balance still reaches paper (2026-08-10).
 *
 * The payroll import stopped deriving Vacation_Hours_Remaining and now saves the packet's
 * printed "Hrs Avail." column verbatim (Erik: "exactly what Liesls payroll packet says").
 * The report floors an over-drawn balance at 00:00 rather than printing a negative, so for
 * one shape of row the saved figure no longer equals available − used.
 *
 * 🔴 The first cut of that change compared the entitlement algebra straight against the
 * printed column and BLOCKED Taneisha Clark's slip — 0 accrued, 16 used, printed 00:00. She
 * is short of her one-year anniversary, so her entitlement is forced to 0, the carryover
 * clamp is inert, and the old check passed exactly (−16 against −16). She printed before the
 * change and not after. These tests exist so that cannot happen again quietly.
 */
describe('a balance the packet floors at zero', () => {
  const floored = {
    Vacation_Hours_Available: 0, Vacation_Hours_Used: 16, Vacation_Hours_Remaining: 0,
  };

  test('Taneisha still gets a slip, and it prints what the packet prints', () => {
    const r = build(Object.assign({}, floored, {
      Vacation_Annual_Entitlement: 40, Vacation_Eligible_Date: '2027-03-01', // not yet eligible
    }));
    expect(r.printable).toBe(true);
    expect(r.slip).toEqual({ accrued: 0, used: 16, remaining: 0 });
    expect(codes(r)).toContain('floored-remaining');
    expect(codes(r)).not.toContain('identity-failed');
  });

  test('the floor is a warning, never a block', () => {
    const r = build(Object.assign({}, floored, {
      Vacation_Annual_Entitlement: 0, Vacation_Eligible_Date: '2026-03-01',
    }));
    expect(r.flags.filter((f) => f.severity === 'block')).toEqual([]);
    const warn = r.flags.find((f) => f.code === 'floored-remaining');
    expect(warn.severity).toBe('warn');
    expect(warn.message).toContain('-16'); // says how far over-drawn, for the footnote
  });

  test('an ordinary balance is untouched by any of this', () => {
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 24,
      Vacation_Eligible_Date: '2000-01-01',
    });
    expect(r.printable).toBe(true);
    expect(r.flags).toEqual([]);
  });

  // The floor is recognised NARROWLY — over-drawn on the arithmetic AND printed as exactly
  // zero. Anything else that disagrees with available − used is still a contradictory import.
  test('a negative remaining that is NOT the packet\'s floor still blocks', () => {
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: -16,
      Vacation_Eligible_Date: '2000-01-01',
    });
    expect(codes(r)).toContain('identity-failed');
    expect(codes(r)).not.toContain('floored-remaining');
    expect(r.printable).toBe(false);
  });

  test('a zero remaining that is not over-drawn still blocks', () => {
    // 80 accrued, 40 used, remaining printed 0 — the arithmetic says 40, and nothing about
    // this row is a floor. Reading it as one would let a misread wipe someone's balance.
    const r = build({
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 40, Vacation_Hours_Remaining: 0,
      Vacation_Eligible_Date: '2000-01-01',
    });
    expect(codes(r)).toContain('identity-failed');
    expect(codes(r)).not.toContain('floored-remaining');
    expect(r.printable).toBe(false);
  });
});

/**
 * The anniversary hand-over (Erik, 2026-08-10: Taneisha's year starts 2026-08-12, 40 hours).
 *
 * 🔑 entitlementInForce() compares the BALANCE date to the eligibility date, NOT the wall
 * clock — so the entitlement flips the moment a packet dated on or after the anniversary is
 * imported, and it flips whether or not that packet actually posted the grant. Balances and
 * entitlement therefore move together, which is what keeps the changeover safe.
 */
describe('crossing a one-year anniversary', () => {
  const taneisha = (asOf, available, used, remaining) => build({
    Leave_Balances_As_Of: asOf,
    Vacation_Annual_Entitlement: 40,
    Vacation_Eligible_Date: '2026-08-12',
    Vacation_Eligible_Hours: 40,
    Vacation_Hours_Available: available,
    Vacation_Hours_Used: used,
    Vacation_Hours_Remaining: remaining,
  });

  test('balances predating the anniversary still print, entitlement held at 0', () => {
    const r = taneisha('2026-08-07', 0, 16, 0);
    expect(r.entitlement).toBe(0);
    expect(r.printable).toBe(true);
    expect(r.slip).toEqual({ accrued: 0, used: 16, remaining: 0 });
  });

  test('once a packet posts the 40-hour grant it prints normally', () => {
    const r = taneisha('2026-08-21', 40, 16, 24);
    expect(r.entitlement).toBe(40);
    expect(r.printable).toBe(true);
    expect(r.slip).toEqual({ accrued: 40, used: 16, remaining: 24 });
    expect(r.flags).toEqual([]);
  });

  // ⚠️ KNOWN, DATED EXPOSURE — pinned deliberately, not an accident. If the first packet
  // dated on/after 2026-08-12 has NOT yet posted her 40 hours, the entitlement flips to 40
  // against an imported accrual of 0 and the slip BLOCKS. Printing 40 accrued / 16 used /
  // 0 remaining would be worse — it contradicts itself on paper — but the operator sees only
  // "no slip", so this is the case to re-check after the next import.
  test('a post-anniversary packet that has not posted the grant blocks, by design', () => {
    const r = taneisha('2026-08-21', 0, 16, 0);
    expect(r.entitlement).toBe(40);
    expect(r.printable).toBe(false);
    expect(codes(r)).toContain('identity-failed');
    expect(codes(r)).toContain('negative-carryover');
  });
});

/**
 * The 2027 calendar reset (Erik, 2026-08-10). A new hire's vacation comes in TWO stages:
 * a pro-rated grant on their one-year anniversary, then the normal 1 January company-wide
 * reset — "so she is on track with all the other employees". Taneisha: 40 hours on
 * 2026-08-12, then her 2027 hours on 2027-01-01.
 *
 * 🔑 Nothing in the code models stage two, and nothing needs to. Vacation_Eligible_Date is a
 * ONE-TIME gate: once it is in the past, entitlementInForce() just returns the stored
 * entitlement and she is an ordinary employee. The hand-off is automatic.
 *
 * ⚠️ What is NOT automatic is Vacation_Annual_Entitlement — hand-maintained, never written by
 * the import. If her 2027 grant differs from her 2026 one it must be updated on 1 January.
 */
describe('the 1 January reset that follows the anniversary', () => {
  const jan2027 = (entitlement, available, used, remaining) => build({
    Leave_Balances_As_Of: '2027-01-08',
    Vacation_Eligible_Date: '2026-08-12', // last year's anniversary — now inert
    Vacation_Eligible_Hours: 40,
    Vacation_Annual_Entitlement: entitlement,
    Vacation_Hours_Available: available,
    Vacation_Hours_Used: used,
    Vacation_Hours_Remaining: remaining,
  });

  test('the anniversary gate goes inert once its date is past', () => {
    const r = jan2027(40, 40, 0, 40);
    expect(r.entitlement).toBe(40); // no longer forced to 0
    expect(r.printable).toBe(true);
    expect(r.slip).toEqual({ accrued: 40, used: 0, remaining: 40 });
    expect(r.flags).toEqual([]);
  });

  test('a December 2026 carryover cancels out of her slip like anyone else\'s', () => {
    // 8 hours taken in Dec 2026 but paid on a January check inflate BOTH accrued and used.
    const r = jan2027(40, 48, 8, 40);
    expect(r.carryover).toBe(8);
    expect(r.slip).toEqual({ accrued: 40, used: 0, remaining: 40 });
    expect(r.printable).toBe(true);
  });

  // 🔴 The one thing a human has to do. If her 2027 grant rises to 80 and the entitlement is
  // left at 40, the slip does NOT quietly print a wrong number — used-below-zero blocks it.
  test('a stale entitlement against a bigger 2027 grant blocks, it does not print', () => {
    const r = jan2027(40, 80, 0, 80);
    expect(r.printable).toBe(false);
    expect(codes(r)).toContain('used-below-zero');
  });
});
