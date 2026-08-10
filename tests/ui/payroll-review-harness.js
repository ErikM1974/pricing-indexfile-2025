/**
 * QA harness for the payroll upload review. Loads the REAL payroll.html markup and the REAL
 * payroll.js, and stubs only window.fetch — so what renders here is what an admin sees.
 *
 * The live page needs a SAML session plus the payroll.html row in Staff_Page_Access, which
 * makes the review screen impossible to eyeball locally. This fills that gap.
 *
 * Not wired into jest. Manual only: serve the repo root (the "static-qa" launch entry) and
 * open /tests/ui/payroll-review-harness.html.
 */
(function () {
  'use strict';

  var stateEl = document.getElementById('qa-state');
  var scenarioEl = document.getElementById('qa-scenario');
  var mount = document.getElementById('qa-mount');

  function say(s) { stateEl.textContent = s; }

  // HH:MM as printed on the report -> decimal hours, the same conversion the extractor does.
  function hm(h, m) { return Math.round((h + m / 60) * 10000) / 10000; }

  // The real 2026-08-07 "Available Vacation And Sick Time" page, all 21 employees.
  // [name, id, vacAccrued, vacUsed, vacAvail, sickAccrued, sickUsed, sickAvail]
  var LEAVE_ROWS = [
    ['MICKELSON JAMES A', 1000, 0, 0, 0, 96, 0, 96],
    ['MICKELSON ERIK J', 6087, 80, 56, 24, hm(109, 24), 0, hm(109, 24)],
    ['NHOUNG RUTH E', 6221, 80, 48, 32, hm(57, 29), 39, hm(18, 29)],
    ['SOM SAVY', 6292, 80, 40, 40, hm(40, 19), hm(39, 15), hm(1, 4)],
    ['SORM SORPHORN', 6295, 112, 64, 48, hm(55, 9), 31, hm(24, 9)],
    ['LAO RATANAKAKNIKA', 6310, 80, 48, 32, hm(54, 18), 16, hm(38, 18)],
    ['HANSON TAYLAR', 6331, 0, 0, 0, 0, 0, 0],
    ['HOEU BUNSEREYTHEAVY', 6333, 80, 88, -8, hm(56, 49), 40, hm(16, 49)],
    ['WRIGHT BRADLEY', 6347, 80, 72, 8, hm(75, 14), 0, hm(75, 14)],
    ['DELAND STEVEN A', 6349, 80, 72, 8, 28, 40, -12],
    ['CHHORN KANHA', 6356, 80, 64, 16, hm(47, 17), 16, hm(31, 17)],
    ['BEARDSLEY BRIAN', 6366, 80, 24, 56, hm(35, 19), 24, hm(11, 19)],
    ['HALLOWELL JOSEPH A', 6372, 80, 44, 36, hm(41, 59), 22, hm(19, 59)],
    ['MEANG SREYANI', 6376, 80, 80, 0, hm(35, 54), 32, hm(3, 54)],
    ['MASSEY ANTONIO', 6380, 0, 0, 0, hm(2, 55), 0, hm(2, 55)],
    ['TANN SOTHEA', 6382, 40, 40, 0, hm(76, 43), hm(50, 30), hm(26, 13)],
    ['PON SANOU', 6383, 0, 0, 0, hm(34, 13), 0, hm(34, 13)],
    ['KHIEV SOTHIDA', 6384, 0, 0, 0, hm(0, 49), 0, hm(0, 49)],
    ['HEDE MIKALAH', 6389, 80, 40, 40, hm(45, 11), hm(31, 45), hm(13, 26)],
    ['TRUJILLO ADRIYELLA', 6390, 0, 0, 0, hm(5, 42), 0, hm(5, 42)],
    // The floored row: 0 accrued, 16 used, printed available 00:00 rather than -16:00.
    ['CLARK TANEISHA', 6391, 0, 16, 0, hm(38, 26), hm(78, 30), -hm(40, 4)],
  ];

  function leaveEmployees() {
    return LEAVE_ROWS.map(function (r) {
      return {
        nameOnPacket: r[0], payrollEmployeeId: r[1], hoursPerDay: 8,
        vacationAccrued: r[2], vacationUsed: r[3], vacationAvailable: r[4],
        sickAccrued: r[5], sickUsed: r[6], sickAvailable: r[7],
      };
    });
  }

  function check(label, derived, printed, unit) {
    return { label: label, derived: derived, printed: printed, unit: unit || 'hours',
      ok: Math.abs(derived - printed) <= 0.02 };
  }

  function leaveReview(broken) {
    var emps = leaveEmployees();
    var sum = function (k) {
      return Math.round(emps.reduce(function (a, x) { return a + (Number(x[k]) || 0); }, 0) * 100) / 100;
    };
    var vacAccrued = broken ? 1000 : 1112;
    return {
      mode: 'leave',
      asOfDate: '2026-08-07',
      sourceFile: 'Page 1 of 1.pdf',
      employees: emps,
      reconciliation: {
        checks: [
          check('Vacation accrued', sum('vacationAccrued'), vacAccrued),
          check('Vacation used', sum('vacationUsed'), 796),
          check('Vacation available', sum('vacationAvailable'), 332),
          check('Sick accrued', sum('sickAccrued'), hm(937, 10)),
          check('Sick used', sum('sickUsed'), 460),
          check('Sick available', sum('sickAvailable'), hm(477, 10)),
        ],
        rowIssues: broken ? [] : [],
        notes: ['CLARK TANEISHA: vacation available is printed as 0h, but accrued minus used '
          + 'is -16h — saving the printed 0h'],
        passed: !broken,
      },
    };
  }

  function packetReview() {
    return {
      checkDate: '2026-08-07', periodStart: '2026-07-16', periodEnd: '2026-07-31',
      checkNumber: '20481', sourceFile: 'packet.pdf',
      employees: [
        { payrollEmployeeId: 6087, nameOnPacket: 'MICKELSON ERIK J', paid: true,
          hoursRegular: 80, hoursOvertime: 0, hoursSick: 0, hoursVacationPTO: 0,
          hoursHoliday: 0, hoursTotal: 80,
          vacationAccrued: 80, vacationUsed: 56, vacationAvailable: 24,
          sickAccrued: hm(109, 24), sickUsed: 0, sickAvailable: hm(109, 24) },
        { payrollEmployeeId: 6391, nameOnPacket: 'CLARK TANEISHA', paid: false,
          hoursRegular: 0, hoursOvertime: 0, hoursSick: 0, hoursVacationPTO: 0,
          hoursHoliday: 0, hoursTotal: 0,
          vacationAccrued: 0, vacationUsed: 16, vacationAvailable: 0,
          sickAccrued: hm(38, 26), sickUsed: hm(78, 30), sickAvailable: -hm(40, 4) },
      ],
      reconciliation: {
        checks: [
          check('Gross wages', 4820.5, 4820.5, 'money'),
          check('Net payroll', 3612.18, 3612.18, 'money'),
          check('Total deductions', 1208.32, 1208.32, 'money'),
          check('Check count', 1, 1, 'count'),
          check('Vacation accrued', 80, 80),
          check('Vacation used', 72, 72),
          check('Vacation available', 24, 24),
          // Sick joined the packet gate on 2026-08-10, alongside saving the printed column.
          check('Sick accrued', hm(147, 50), hm(147, 50)),
          check('Sick used', hm(78, 30), hm(78, 30)),
          check('Sick available', hm(69, 20), hm(69, 20)),
        ],
        rowIssues: [],
        // A floored row is noted on this path too — both gates share flooredRowNotes().
        notes: ['CLARK TANEISHA: vacation available is printed as 0h, but accrued minus used '
          + 'is -16h — saving the printed 0h'],
        passed: true,
      },
    };
  }

  function currentReview() {
    var s = scenarioEl.value;
    if (s === 'packet') return packetReview();
    return leaveReview(s === 'leave-bad');
  }

  // Employees-table rows for the Leave Balances tab and the printable slips. Four shapes
  // that exercise every footnote branch: an ordinary balance, a carryover case, a genuine
  // negative, and a balance the packet floors at 00:00.
  var LEAVE_EMPLOYEES = [
    {
      Payroll_Employee_ID: 6087, Employee_Full_Name: 'Erik Mickelson',
      Leave_Balances_As_Of: '2026-08-07', Vacation_Annual_Entitlement: 80,
      Vacation_Eligible_Date: '2000-01-01',
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 56, Vacation_Hours_Remaining: 24,
      Sick_Accum_Hours_Available: 109.4, Sick_Hours_Used: 0, Sick_Hours_Remaining: 109.4,
    },
    {
      // Carryover: 112 accrued includes 32 taken last December, so the slip reads 80/32/48.
      Payroll_Employee_ID: 6295, Employee_Full_Name: 'Sorphorn Sorm',
      Leave_Balances_As_Of: '2026-08-07', Vacation_Annual_Entitlement: 80,
      Vacation_Eligible_Date: '2000-01-01',
      Vacation_Hours_Available: 112, Vacation_Hours_Used: 64, Vacation_Hours_Remaining: 48,
      Sick_Accum_Hours_Available: 55.15, Sick_Hours_Used: 31, Sick_Hours_Remaining: 24.15,
    },
    {
      // A genuine negative the report DOES print — footnote says so, balance stays -8.
      Payroll_Employee_ID: 6333, Employee_Full_Name: 'Bunsereytheavy Hoeu',
      Leave_Balances_As_Of: '2026-08-07', Vacation_Annual_Entitlement: 80,
      Vacation_Eligible_Date: '2000-01-01',
      Vacation_Hours_Available: 80, Vacation_Hours_Used: 88, Vacation_Hours_Remaining: -8,
      Sick_Accum_Hours_Available: 56.8167, Sick_Hours_Used: 40, Sick_Hours_Remaining: 16.8167,
    },
    {
      // 🔴 The floored row: 0 accrued, 16 used, packet prints 00:00 rather than -16:00.
      // Short of her one-year anniversary, so the entitlement is forced to 0.
      Payroll_Employee_ID: 6391, Employee_Full_Name: 'Taneisha Clark',
      Leave_Balances_As_Of: '2026-08-07', Vacation_Annual_Entitlement: 40,
      Vacation_Eligible_Date: '2027-03-01', Vacation_Eligible_Hours: 40,
      Vacation_Hours_Available: 0, Vacation_Hours_Used: 16, Vacation_Hours_Remaining: 0,
      Sick_Accum_Hours_Available: 38.4333, Sick_Hours_Used: 78.5, Sick_Hours_Remaining: -40.0667,
    },
    {
      // Floored AND past their anniversary, so the "vacation resets on…" note does not apply.
      // This is the only row that reaches the floored-remaining footnote — without it that
      // branch ships unseen, and it is text an employee reads off paper.
      Payroll_Employee_ID: 6999, Employee_Full_Name: 'Floored Past-Anniversary',
      Leave_Balances_As_Of: '2026-08-07', Vacation_Annual_Entitlement: 0,
      Vacation_Eligible_Date: '2026-03-01',
      Vacation_Hours_Available: 0, Vacation_Hours_Used: 24, Vacation_Hours_Remaining: 0,
      Sick_Accum_Hours_Available: 10, Sick_Hours_Used: 2, Sick_Hours_Remaining: 8,
    },
  ];

  // --- network stub --------------------------------------------------------
  var realFetch = window.fetch.bind(window);

  // The print button ends in window.print() plus a CSV download. Neither belongs in a
  // harness run — stub them so the slip markup can be inspected without a print dialog.
  window.print = function () { };
  var realCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) {
    try { return realCreateObjectURL(blob); } catch (e) { return 'blob:stubbed'; }
  };

  function json(body, status) {
    return Promise.resolve(new Response(JSON.stringify(body),
      { status: status || 200, headers: { 'Content-Type': 'application/json' } }));
  }

  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/crm-proxy/payroll') === -1) return realFetch(url, opts);

    if (/\/parse\/[^/]+$/.test(u)) return json({ status: 'done', review: currentReview() });
    if (/\/parse$/.test(u)) {
      var body = {};
      try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) { /* ignore */ }
      say('POST /parse mode=' + body.mode);
      return json({ jobId: 'qa_job', status: 'running', mode: body.mode }, 202);
    }
    if (/\/import$/.test(u)) {
      var rev = currentReview();
      var leave = rev.mode === 'leave';
      return json({
        imported: rev.employees.length, total: rev.employees.length,
        mode: leave ? 'leave' : 'packet',
        effectiveDate: leave ? rev.asOfDate : rev.checkDate,
        checkDate: leave ? null : rev.checkDate,
        registerRowsWritten: leave ? 0 : rev.employees.length,
        failures: [], reconciliation: rev.reconciliation,
      });
    }
    if (/\/employees/.test(u)) return json({ employees: LEAVE_EMPLOYEES });
    if (/\/periods/.test(u)) return json({ periods: [] });
    if (/\/register/.test(u)) return json({ rows: [] });
    return json({}, 404);
  };

  // --- boot ----------------------------------------------------------------
  // 🔑 Always cache-busted. Without this the harness happily runs a stale copy of the very
  // file you just edited and reports the OLD behaviour as current — which is exactly what it
  // did on 2026-08-10, showing a blocked slip that the fix on disk had already unblocked.
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src + (src.indexOf('?') === -1 ? '?' : '&') + 'qa=' + Date.now();
      s.onload = resolve;
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      document.body.appendChild(s);
    });
  }

  (async function boot() {
    say('loading real page markup…');
    var html = await realFetch('/dashboards/payroll.html').then(function (r) { return r.text(); });
    var doc = new DOMParser().parseFromString(html, 'text/html');
    // innerHTML never executes injected <script> tags, so the real scripts are loaded below
    // in order — after the markup exists, which payroll.js requires at IIFE time.
    mount.innerHTML = doc.body.innerHTML;

    await loadScript('/dashboards/js/vacation-carryover.js');
    await loadScript('/dashboards/js/payroll.js');

    // Open the Upload tab the way a user would.
    var tab = mount.querySelector('.pr-tab[data-panel="upload"]');
    if (tab) tab.click();
    say('ready');
  })().catch(function (e) { say('boot failed: ' + e.message); });

  document.getElementById('qa-run').addEventListener('click', function () {
    var modeEl = document.getElementById('packet-mode');
    var fileEl = document.getElementById('packet-file');
    var parseBtn = document.getElementById('packet-parse');
    if (!modeEl || !fileEl || !parseBtn) return say('page not mounted yet');

    modeEl.value = scenarioEl.value === 'packet' ? 'packet' : 'leave';
    modeEl.dispatchEvent(new Event('change'));

    var dt = new DataTransfer();
    dt.items.add(new File([new Blob(['%PDF-1.4 qa'], { type: 'application/pdf' })],
      'Page 1 of 1.pdf', { type: 'application/pdf' }));
    fileEl.files = dt.files;
    fileEl.dispatchEvent(new Event('change'));

    parseBtn.click();
    say('reading… (the real poll waits 3s)');
  });
})();
