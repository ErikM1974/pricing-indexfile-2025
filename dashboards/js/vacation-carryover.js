/**
 * vacation-carryover.js — corrects the prior-year vacation carryover artifact before a
 * slip is printed. Erik, 2026-08-03.
 *
 * THE PROBLEM. Payroll books hours to the tax year of the CHECK date, not the work date.
 * Vacation taken in the last pay period of a year is paid on a January check, so it lands
 * in the new payroll year — and to pay it, the prior year's balance is carried forward.
 * Both accrued and used are inflated by the same carryover, so they cancel:
 *
 *   Sorphorn Sorm, 2026: imports 112 accrued / 56 used / 56 remaining
 *     112 = 80 (2026 grant) + 32 carried in     (32 h taken 12/22, 12/23, 12/29, 12/30 2025,
 *      56 = 24 (actual 2026 use)  + 32 the same  paid on the 01/09/2026 check)
 *
 * That is correct cash-basis accounting on the accountant's side. It is a DISPLAY problem
 * on ours: her slip should read 80 / 24 / 56.
 *
 * 🔑 `Vacation_Hours_Remaining` is the only one of the three figures that can be trusted
 * as imported — it is right in both worlds, because the carryover cancels.
 *
 * 🔴 NEVER derive the carryover from a hardcoded 32. It changes whenever someone takes
 * vacation in the final pay period of a year, and clears at the year rollover. It is
 * always `available - entitlement`.
 *
 * 🔴 SICK HOURS ARE NOT TRANSFORMED. Washington State paid sick leave legitimately carries
 * over year to year (statutory, up to 40 h), so sick accrued above any annual figure is
 * expected and correct. Sick passes through untouched — see `sickPassthrough()`.
 *
 * The entitlement itself lives in Caspio (`Vacation_Annual_Entitlement`), hand-maintained
 * by Erik, and is read at slip-generation time. It must NOT live in any of the three
 * imported columns — the Friday payroll import overwrites all three, which would destroy
 * the value and silently revert Sorphorn to 112.
 *
 * ⚠️ HOW FAR THE VALIDATION ACTUALLY REACHES. The entitlement is hand-typed and has no
 * second source of truth, so it can only be checked against the imported figures. A wrong
 * entitlement is caught when it falls BELOW `remaining` (the carryover would then exceed
 * the hours the packet says were used — an impossible state, see `used-below-zero`). One
 * that stays at or above `remaining` yields a self-consistent slip and is undetectable
 * here: for Sorphorn's 112/56/56 the guard covers a mis-key of 24 hours or more, and 70
 * instead of 80 would print 70/14/56 unchallenged. Closing that needs a second authority
 * (an entitlement history, or the accountant's own grant figure), not a cleverer assertion.
 * Pinned in tests/unit/vacation-carryover.test.js.
 */
(function (global) {
  'use strict';

  // §7.4 — two missed Friday packets. Warn on the slip rather than printing a balance
  // that looks current when it isn't.
  var STALE_AFTER_DAYS = 14;
  // §7.1 — the identity is exact algebraically; the slack is for decimal hours (33.3667).
  var TOLERANCE = 0.01;
  var CARRYOVER_REASON = 'prior-year vacation paid on a current-year check date';

  /**
   * Caspio returns an empty NUMBER as '' or null, and `Number('') === 0`. A missing
   * entitlement and an entitlement of 0 mean completely different things here (§7.2 says
   * skip the slip; Jim Mickelson is a legitimate 0), so they must never collapse.
   */
  function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function num(v) {
    var n = numOrNull(v);
    return n === null ? 0 : n;
  }

  function day(s) { return String(s == null ? '' : s).slice(0, 10); }

  function isIsoDay(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

  /** Whole days between two YYYY-MM-DD strings. UTC so a DST boundary can't shift it. */
  function daysBetween(fromIso, toIso) {
    if (!isIsoDay(fromIso) || !isIsoDay(toIso)) return null;
    var a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
    var b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
    return Math.round((b - a) / 86400000);
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  /**
   * The entitlement in force ON A GIVEN DATE — not today's value (§9).
   *
   * Taneisha Clark moves from 0 to 40 at her one-year anniversary (2026-08-12). Rather
   * than a second effective-date column, this reuses `Vacation_Eligible_Date`, which
   * Caspio already carries for exactly this purpose: before that date the employee has no
   * annual grant at all, so the entitlement in force is 0 and her -16 balance is correct
   * and expected rather than a carryover artifact.
   *
   * Returns null when the entitlement is genuinely unset — the caller must flag, not guess.
   */
  function entitlementInForce(employee, asOfIso) {
    var stored = numOrNull(employee.Vacation_Annual_Entitlement);
    if (stored === null) return null;
    var eligible = day(employee.Vacation_Eligible_Date);
    if (isIsoDay(eligible) && isIsoDay(asOfIso) && asOfIso < eligible) return 0;
    return stored;
  }

  /** §6 — sick is printed exactly as imported. No transform, no entitlement cap. */
  function sickPassthrough(employee) {
    return {
      accrued: num(employee.Sick_Accum_Hours_Available),
      used: num(employee.Sick_Hours_Used),
      remaining: num(employee.Sick_Hours_Remaining),
    };
  }

  /**
   * Build one employee's slip figures plus every validation flag.
   *
   * opts: { fallbackAsOf: 'YYYY-MM-DD' used ONLY when this employee has no
   *           Leave_Balances_As_Of of their own — see the flag below,
   *         today: 'YYYY-MM-DD' (injected so the staleness check is testable) }
   *
   * 🔴 The employee's OWN Leave_Balances_As_Of always wins. The import PUTs Employees one
   * row at a time inside a try/catch, and an active employee missing from the packet is
   * never touched at all — so one person's balances can sit months behind everyone else's.
   * Scoring them against the roster's newest stamp (the previous behaviour) meant the
   * §7.4 staleness check could never fire for exactly the person it exists to catch, and
   * the §9 entitlement was evaluated on a date belonging to somebody else.
   *
   * Severity contract:
   *   'block' — do not print (§7.2 missing entitlement, §7.1 identity, used-below-zero)
   *   'warn'  — print, but say so (§7.3 negative carryover, §7.4 stale/unknown as-of)
   */
  function buildSlipFigures(employee, opts) {
    opts = opts || {};
    var ownAsOf = day(employee.Leave_Balances_As_Of);
    var borrowedAsOf = !isIsoDay(ownAsOf) && isIsoDay(opts.fallbackAsOf || '');
    var asOf = isIsoDay(ownAsOf) ? ownAsOf : (borrowedAsOf ? opts.fallbackAsOf : '');
    var today = isIsoDay(opts.today || '') ? opts.today : new Date().toISOString().slice(0, 10);

    var rawAvailable = num(employee.Vacation_Hours_Available);
    var rawUsed = num(employee.Vacation_Hours_Used);
    // Trusted as imported — the carryover cancels out of it, so it is never adjusted.
    var rawRemaining = num(employee.Vacation_Hours_Remaining);

    var entitlement = entitlementInForce(employee, asOf);
    var flags = [];

    if (entitlement === null) {
      // §7.2 — do NOT default to 80 and do not guess. 80 is merely the common case; a
      // guess here prints a wrong number on paper and hands it to an employee.
      flags.push({
        code: 'missing-entitlement',
        severity: 'block',
        message: 'No annual vacation entitlement set in Caspio — cannot tell a carryover '
          + 'from a genuine grant. Set Vacation_Annual_Entitlement on this employee.',
      });
      return {
        payrollId: employee.Payroll_Employee_ID || null,
        asOf: asOf,
        raw: { available: rawAvailable, used: rawUsed, remaining: rawRemaining },
        entitlement: null,
        carryover: 0,
        slip: null,
        sick: sickPassthrough(employee),
        flags: flags,
        printable: false,
        carryoverReason: '',
      };
    }

    // max(0, …): a negative carryover would otherwise INFLATE slip_used, i.e. tell an
    // employee they used hours they never took.
    var rawCarryover = round2(rawAvailable - entitlement);
    var carryover = Math.max(0, rawCarryover);

    var slip = {
      accrued: round2(entitlement),
      used: round2(rawUsed - carryover),
      remaining: round2(rawRemaining), // §5 — unchanged, always trusted
    };

    if (rawCarryover < -TOLERANCE) {
      // §7.3 — clamped, but never silently. Usually means the Caspio entitlement is stale
      // or the employee's grant changed mid-year.
      flags.push({
        code: 'negative-carryover',
        severity: 'warn',
        message: 'Imported accrued (' + rawAvailable + ') is below the annual entitlement ('
          + entitlement + '). Carryover clamped to 0 — check whether the entitlement in '
          + 'Caspio is stale or the grant changed mid-year.',
      });
    }

    // 🔴 THIS — not the identity below — is what actually constrains the entitlement.
    // A carryover is by construction hours that were BOTH accrued and used in the prior
    // year, so it can never exceed the hours the packet says were used: carryover > rawUsed
    // is an impossible state. Without this guard an entitlement typed too low (8 instead of
    // 80) silently prints "Hours used −48.00" on paper, because the identity assertion is
    // structurally blind to it — see the note there.
    if (slip.used < -TOLERANCE) {
      flags.push({
        code: 'used-below-zero',
        severity: 'block',
        message: 'Computed vacation used is negative (' + slip.used + '). The carryover ('
          + carryover + ') exceeds the imported used hours (' + rawUsed + '), which cannot '
          + 'happen — the annual entitlement of ' + entitlement + ' is almost certainly too '
          + 'low for an imported accrual of ' + rawAvailable + '.',
      });
    }

    // §7.1 — assert it, but do NOT rely on it to validate the entitlement.
    // 🔴 Whenever entitlement <= available the max() clamp is inert, so
    //      accrued − used = E − (U − (A − E)) = A − U
    // and the entitlement CANCELS OUT. The import writes Vacation_Hours_Remaining as
    // exactly r2(accrued − used), so in that regime this check is a tautology. It has real
    // power in only two places: when the clamp fires (entitlement above accrued, §7.3), and
    // when the imported figures contradict each other. The used-below-zero guard above is
    // what covers the other direction.
    var identity = round2(slip.accrued - slip.used);
    if (Math.abs(identity - slip.remaining) > TOLERANCE + 1e-9) {
      flags.push({
        code: 'identity-failed',
        severity: 'block',
        message: 'accrued − used ≠ remaining (' + slip.accrued + ' − ' + slip.used + ' = '
          + identity + ', but remaining is ' + slip.remaining + '). Raw import was '
          + rawAvailable + ' / ' + rawUsed + ' / ' + rawRemaining
          + ' against an entitlement of ' + entitlement + '.',
      });
    }

    if (!isIsoDay(asOf)) {
      // No date at all is strictly worse than an old one — we cannot even say how stale the
      // balances are, and the §9 eligibility gate has nothing to compare against.
      flags.push({
        code: 'unknown-as-of',
        severity: 'warn',
        message: 'No Leave_Balances_As_Of on this record, so the balances cannot be dated '
          + 'and the eligibility date cannot be applied.',
      });
    } else if (borrowedAsOf) {
      flags.push({
        code: 'borrowed-as-of',
        severity: 'warn',
        message: 'This employee has no Leave_Balances_As_Of; using the roster\'s ' + asOf
          + '. Their balances may not have come from that packet.',
      });
    }

    var staleDays = daysBetween(asOf, today);
    if (staleDays !== null && staleDays > STALE_AFTER_DAYS) {
      flags.push({
        code: 'stale-balances',
        severity: 'warn',
        message: 'Balances are ' + staleDays + ' days old (as of ' + asOf + ').',
      });
    }

    return {
      payrollId: employee.Payroll_Employee_ID || null,
      asOf: asOf,
      raw: { available: rawAvailable, used: rawUsed, remaining: rawRemaining },
      entitlement: entitlement,
      carryover: carryover,
      slip: slip,
      sick: sickPassthrough(employee),
      flags: flags,
      printable: !flags.some(function (f) { return f.severity === 'block'; }),
      staleDays: staleDays,
      carryoverReason: carryover > 0 ? CARRYOVER_REASON : '',
    };
  }

  var API = {
    STALE_AFTER_DAYS: STALE_AFTER_DAYS,
    TOLERANCE: TOLERANCE,
    CARRYOVER_REASON: CARRYOVER_REASON,
    numOrNull: numOrNull,
    daysBetween: daysBetween,
    entitlementInForce: entitlementInForce,
    sickPassthrough: sickPassthrough,
    buildSlipFigures: buildSlipFigures,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.VacationCarryover = API;
})(typeof window !== 'undefined' ? window : null);
