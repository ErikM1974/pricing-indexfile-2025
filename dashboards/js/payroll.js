/**
 * payroll.js — admin-only payroll dashboard.
 *
 * Reads/writes through the same-origin, admin-gated crm-proxy route:
 *   /api/crm-proxy/payroll/{employees,periods,register,parse,import}
 *
 * 🔒 This page NEVER displays a pay rate or salary — Erik 2026-07-27. The upstream
 * doesn't send them either, so there is nothing here to accidentally render.
 *
 * Packet upload is deliberately three steps (read → review → save): the PDF is a scan,
 * so the server checks its extraction against the packet's own printed totals and the
 * Save button stays disabled until that reconciles.
 *
 * Vacation accrued/used are corrected for the prior-year carryover before they reach a
 * slip — see vacation-carryover.js, which must load first. Sick hours are never touched.
 */
(function () {
  'use strict';

  var API = '/api/crm-proxy/payroll';
  var statusEl = document.getElementById('pr-status');
  var jobId = null;
  var pollTimer = null;
  // True only between "the upload was accepted" and "the poll came back done/error". Lets
  // resetReview() tell an ABANDONED read apart from a finished one, so cancelling says so
  // while a successful save keeps its own message.
  var parsing = false;
  var allEmployees = [];
  // employee record -> its computed slip figures + flags. Keyed by object identity rather
  // than payroll ID, which 8 of the 29 Employees rows don't have. Rebuilt on every load so
  // the leave table, the printed slips and the audit CSV can never disagree.
  var slipFigures = new Map();

  var VC = window.VacationCarryover;

  // --- helpers -------------------------------------------------------------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'pr-status' + (kind ? ' is-' + kind : '');
  }

  // Hours render to 2dp; negatives are real balances, so flag them rather than hide them.
  function hrs(n) {
    var v = Number(n);
    if (!isFinite(v)) return '<span class="pr-zero">—</span>';
    var txt = esc(v.toFixed(2));
    if (v < 0) return '<span class="pr-neg">' + txt + '</span>';
    if (v === 0) return '<span class="pr-zero">' + txt + '</span>';
    return txt;
  }

  function money(n) {
    var v = Number(n) || 0;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function day(s) { return String(s || '').slice(0, 10); }

  async function api(path, opts) {
    var r = await fetch(API + path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
    }, opts || {}));
    var data = null;
    try { data = await r.json(); } catch (_) { /* non-JSON body */ }
    if (!r.ok) {
      var msg = (data && (data.error || data.message)) || ('Request failed (' + r.status + ')');
      var err = new Error(msg);
      err.payload = data;
      err.status = r.status;
      throw err;
    }
    return data;
  }

  // --- tabs ----------------------------------------------------------------

  Array.prototype.forEach.call(document.querySelectorAll('.pr-tab'), function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.pr-tab'), function (t) {
        t.classList.toggle('is-active', t === tab);
      });
      var name = tab.getAttribute('data-panel');
      Array.prototype.forEach.call(document.querySelectorAll('.pr-panel'), function (p) {
        p.classList.toggle('is-active', p.id === 'panel-' + name);
      });
      setStatus('');
    });
  });

  // --- leave balances ------------------------------------------------------

  function fullName(e) {
    return e.Employee_Full_Name || ((e.First_Name || '') + ' ' + (e.Last_Name || '')).trim();
  }

  // "112 → 80" when the carryover moved the figure, plain otherwise. Showing both keeps the
  // accountant's number on screen for reconciliation while making the printed one obvious.
  function adjusted(rawValue, slipValue, carryover) {
    if (!carryover) return hrs(rawValue);
    return '<span class="pr-raw">' + hrs(rawValue) + '</span>'
      + '<span class="pr-arrow">→</span>' + hrs(slipValue);
  }

  function renderLeave(rows) {
    var body = document.getElementById('leave-body');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="10" class="pr-loading">No active employees found.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (e) {
      var f = slipFigures.get(e);
      // Not yet at the 1-year mark → the negative vacation balance is expected, so say so
      // instead of letting it read as a data error.
      var eligible = day(e.Vacation_Eligible_Date);
      var pills = '';
      if (eligible && eligible > new Date().toISOString().slice(0, 10)) {
        pills += '<span class="pr-pill pr-pill-wait">accrues ' + esc(eligible) + '</span>';
      }
      if (f && !f.printable) pills += '<span class="pr-pill pr-pill-flag">no slip</span>';

      var slip = (f && f.slip) || null;
      var carry = (f && f.carryover) || 0;

      return '<tr' + (f && !f.printable ? ' class="pr-row-flag"' : '') + '>'
        + '<td><span class="pr-name">' + esc(fullName(e)) + '</span>' + pills + '</td>'
        + '<td class="pr-dept">' + esc(e.Department || '—') + '</td>'
        + '<td class="pr-num pr-entitle">'
          + (f && f.entitlement !== null ? hrs(f.entitlement) : '<span class="pr-missing">not set</span>') + '</td>'
        + '<td class="pr-num">' + adjusted(e.Vacation_Hours_Available, slip && slip.accrued, carry) + '</td>'
        + '<td class="pr-num">' + adjusted(e.Vacation_Hours_Used, slip && slip.used, carry) + '</td>'
        + '<td class="pr-num">' + hrs(e.Vacation_Hours_Remaining) + '</td>'
        + '<td class="pr-num">' + (carry ? hrs(carry) : '<span class="pr-zero">—</span>') + '</td>'
        + '<td class="pr-num">' + hrs(e.Sick_Accum_Hours_Available) + '</td>'
        + '<td class="pr-num">' + hrs(e.Sick_Hours_Used) + '</td>'
        + '<td class="pr-num">' + hrs(e.Sick_Hours_Remaining) + '</td>'
        + '</tr>';
    }).join('');
  }

  // Every flag, named, above the table. A blocked record must be impossible to miss —
  // it silently drops out of the printout otherwise.
  function renderFlags() {
    var box = document.getElementById('leave-flags');
    var items = [];
    allEmployees.forEach(function (e) {
      var f = slipFigures.get(e);
      if (!f || !f.flags.length) return;
      f.flags.forEach(function (flag) {
        items.push('<li class="pr-flag-' + esc(flag.severity) + '">'
          + '<strong>' + esc(fullName(e)) + '</strong> — ' + esc(flag.message)
          + (flag.severity === 'block' ? ' <em>No slip will print for this employee.</em>' : '')
          + '</li>');
      });
    });
    if (!items.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<ul class="pr-flag-list">' + items.join('') + '</ul>';
  }

  function applyLeaveFilter() {
    var q = (document.getElementById('leave-search').value || '').trim().toLowerCase();
    if (!q) return renderLeave(allEmployees);
    renderLeave(allEmployees.filter(function (e) {
      var hay = ((e.Employee_Full_Name || '') + ' ' + (e.First_Name || '') + ' '
        + (e.Last_Name || '') + ' ' + (e.Department || '') + ' ' + (e.Job_Title || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    }));
  }

  // The newest stamp on the roster — used for the toolbar summary, and as a LAST-RESORT
  // fallback for an employee carrying no stamp of their own. 🔴 Never as the as-of for
  // someone who has one: the import writes these per employee, so a single failed PUT (or
  // an active employee absent from the packet) leaves one person months behind while the
  // roster maximum advances. Each slip prints its own employee's date.
  function rosterAsOf() {
    var stamps = allEmployees.map(function (e) { return day(e.Leave_Balances_As_Of); })
      .filter(Boolean).sort();
    return stamps.length ? stamps[stamps.length - 1] : '';
  }

  async function loadLeave() {
    try {
      var data = await api('/employees');
      allEmployees = data.employees || [];

      // Compute once, here — the table, the slips and the audit CSV all read this map, so
      // there is no second code path that could apply the carryover differently.
      var asOf = rosterAsOf();
      slipFigures = new Map();
      allEmployees.forEach(function (e) {
        slipFigures.set(e, VC.buildSlipFigures(e, { fallbackAsOf: asOf || undefined }));
      });

      renderLeave(allEmployees);
      renderFlags();
      document.getElementById('leave-asof').textContent = asOf
        ? 'Balances as of ' + asOf
        : 'No packet imported yet';
    } catch (e) {
      document.getElementById('leave-body').innerHTML =
        '<tr><td colspan="10" class="pr-loading">Could not load balances.</td></tr>';
      setStatus('Unable to load leave balances: ' + e.message, 'error');
    }
  }

  // --- pay periods ---------------------------------------------------------

  async function loadPeriods() {
    try {
      var data = await api('/periods');
      var sel = document.getElementById('period-select');
      var periods = data.periods || [];
      if (!periods.length) {
        sel.innerHTML = '<option value="">No pay periods imported yet</option>';
        return;
      }
      sel.innerHTML = periods.map(function (p) {
        return '<option value="' + esc(p.checkDate) + '">' + esc(p.checkDate)
          + '  (' + esc(p.periodStart) + ' – ' + esc(p.periodEnd) + ', '
          + esc(String(p.paidCount)) + ' checks)</option>';
      }).join('');
      loadRegister(periods[0].checkDate);
    } catch (e) {
      setStatus('Unable to load pay periods: ' + e.message, 'error');
    }
  }

  async function loadRegister(checkDate) {
    var body = document.getElementById('period-body');
    if (!checkDate) { body.innerHTML = '<tr><td colspan="8" class="pr-loading">Select a pay date.</td></tr>'; return; }
    body.innerHTML = '<tr><td colspan="8" class="pr-loading">Loading…</td></tr>';
    try {
      var data = await api('/register?checkDate=' + encodeURIComponent(checkDate));
      var rows = data.rows || [];
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="8" class="pr-loading">No rows for this pay date.</td></tr>';
        return;
      }
      body.innerHTML = rows.map(function (r) {
        return '<tr>'
          + '<td><span class="pr-name">' + esc(r.Employee_Full_Name || '') + '</span></td>'
          + '<td>' + (r.Paid_This_Period ? '<span class="pr-yes">Yes</span>' : '<span class="pr-no">No check</span>') + '</td>'
          + '<td class="pr-num">' + hrs(r.Hours_Regular) + '</td>'
          + '<td class="pr-num">' + hrs(r.Hours_Overtime) + '</td>'
          + '<td class="pr-num">' + hrs(r.Hours_Sick) + '</td>'
          + '<td class="pr-num">' + hrs(r.Hours_Vacation_PTO) + '</td>'
          + '<td class="pr-num">' + hrs(r.Hours_Holiday) + '</td>'
          + '<td class="pr-num">' + hrs(r.Hours_Total) + '</td>'
          + '</tr>';
      }).join('');
    } catch (e) {
      body.innerHTML = '<tr><td colspan="8" class="pr-loading">Could not load this period.</td></tr>';
      setStatus('Unable to load period: ' + e.message, 'error');
    }
  }

  document.getElementById('period-select').addEventListener('change', function (ev) {
    loadRegister(ev.target.value);
  });

  // --- packet upload -------------------------------------------------------

  var fileInput = document.getElementById('packet-file');
  var parseBtn = document.getElementById('packet-parse');
  var commitBtn = document.getElementById('packet-commit');
  var discardBtn = document.getElementById('packet-discard');
  var noteEl = document.getElementById('packet-note');
  var reviewEl = document.getElementById('review');
  var modeEl = document.getElementById('packet-mode');
  var hintEl = document.getElementById('packet-hint');
  var progressEl = document.getElementById('packet-progress');
  var readStartedAt = 0;
  var tickTimer = null;

  function readLabel() { return modeEl.value === 'leave' ? 'Read page' : 'Read packet'; }

  // The spinner element is built ONCE and only its sibling's text is rewritten each second.
  // Re-rendering the innerHTML every tick would recreate the element and restart its CSS
  // animation, so the ring would stutter in place — the exact "hung" look this exists to
  // dispel.
  function startBusy() {
    readStartedAt = Date.now();
    parseBtn.textContent = 'Reading…';
    progressEl.innerHTML = '<span class="pr-spin"></span><span class="pr-elapsed">reading… 0s</span>';
    progressEl.hidden = false;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tickBusy, 1000);
  }

  function tickBusy() {
    var el = progressEl.querySelector('.pr-elapsed');
    if (el) el.textContent = 'reading… ' + Math.round((Date.now() - readStartedAt) / 1000) + 's';
  }

  function stopBusy() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    progressEl.hidden = true;
    progressEl.innerHTML = '';
    parseBtn.textContent = readLabel();
  }

  // The mode is sent to the server, never inferred there. A leave page pushed through the
  // packet reader reconciles $0 against $0 and passes a gate that checked nothing.
  var MODE_HINT = {
    packet: 'The full monthly packet — Payroll Register, Check Register and the vacation/sick '
      + 'page. Saving writes a pay period and refreshes leave balances.',
    leave: 'The "Available Vacation And Sick Time" page on its own. Saving refreshes vacation '
      + 'and sick balances only — no pay period, no hours, no pay rates.',
  };

  function syncMode() {
    hintEl.textContent = MODE_HINT[modeEl.value] || '';
    resetReview();            // may cancel a read in flight and reset the label via stopBusy
    parseBtn.textContent = readLabel();
  }
  modeEl.addEventListener('change', syncMode);
  syncMode();

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    parseBtn.disabled = !f;
    noteEl.textContent = f ? (Math.round(f.size / 104857.6) / 10) + ' MB selected' : '';
    resetReview();
  });

  function resetReview() {
    // 🔴 THIS ABANDONS AN IN-FLIGHT READ, and it is reachable from the Document dropdown,
    // the file picker and Discard — all of which stay live while a read is running. On
    // 2026-08-10 that stranded the page in production: the poll chain was killed mid-read,
    // so parseBtn (disabled on click, re-enabled only inside the poll callback) stayed
    // DISABLED, and the status line went on claiming "Uploading and reading…" forever. The
    // server had the answer the whole time. A cancelled read must say so and hand the button
    // back, or the page is simply stuck with no way out but a reload.
    var wasParsing = parsing;
    var hadReview = !reviewEl.hidden;
    parsing = false;
    jobId = null;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    stopBusy();
    reviewEl.hidden = true;
    commitBtn.disabled = true;
    // Throwing away a running read OR a rendered review both leave the status line
    // describing something that is no longer on screen. Callers that set their own message
    // (read, discard, save) do it straight after and overwrite this.
    if (wasParsing || hadReview) {
      parseBtn.disabled = !(fileInput.files && fileInput.files[0]);
      setStatus((wasParsing ? 'That read was cancelled before it finished.' : 'That review was discarded.')
        + ' Click ' + readLabel() + ' to start again.', 'info');
    }
  }

  discardBtn.addEventListener('click', function () {
    resetReview();
    setStatus('Discarded. Nothing was saved.', 'info');
  });

  function readAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Could not read the file.')); };
      fr.onload = function () {
        var s = String(fr.result || '');
        resolve(s.slice(s.indexOf(',') + 1)); // strip the data: URL prefix
      };
      fr.readAsDataURL(file);
    });
  }

  parseBtn.addEventListener('click', async function () {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    resetReview();
    parseBtn.disabled = true;
    setStatus('Uploading and reading the ' + (modeEl.value === 'leave' ? 'page' : 'packet')
      + ' — this usually takes under a minute…', 'info');
    // Starts before the upload, not after it: a 2.8 MB base64 POST is itself several seconds
    // of nothing happening on screen.
    startBusy();
    try {
      var b64 = await readAsBase64(f);
      var started = await api('/parse', {
        method: 'POST',
        body: JSON.stringify({ filename: f.name, dataBase64: b64, mode: modeEl.value }),
      });
      jobId = started.jobId;
      parsing = true;
      pollParse();
    } catch (e) {
      parsing = false;
      stopBusy();
      parseBtn.disabled = false;
      setStatus('Upload failed: ' + e.message, 'error');
    }
  });

  function pollParse() {
    if (!jobId) return;
    pollTimer = setTimeout(async function () {
      try {
        var res = await api('/parse/' + encodeURIComponent(jobId));
        if (res.status === 'running') return pollParse();
        parsing = false;
        stopBusy();
        parseBtn.disabled = false;
        if (res.status === 'error') return setStatus('Could not read the packet: ' + res.error, 'error');
        renderReview(res.review);
      } catch (e) {
        parsing = false;
        stopBusy();
        parseBtn.disabled = false;
        setStatus('Could not read the packet: ' + e.message, 'error');
      }
    }, 3000);
  }

  var HEAD_PACKET = '<tr>'
    + '<th>Employee</th><th>Paid</th>'
    + '<th class="pr-num">Regular</th><th class="pr-num">OT</th><th class="pr-num">Sick</th>'
    + '<th class="pr-num">Vac/PTO</th><th class="pr-num">Total</th>'
    + '<th class="pr-num">Vac Avail</th><th class="pr-num">Sick Avail</th></tr>';

  var HEAD_LEAVE = '<tr>'
    + '<th>Employee</th><th class="pr-num">ID</th>'
    + '<th class="pr-num">Vac accrued</th><th class="pr-num">Vac used</th><th class="pr-num">Vac avail</th>'
    + '<th class="pr-num">Sick accrued</th><th class="pr-num">Sick used</th><th class="pr-num">Sick avail</th></tr>';

  // Each check carries its own unit — the vacation rows were being printed as dollars.
  // hrs() emits its own escaped markup, so it must not be run through esc() again.
  function checkNum(v, unit) {
    if (unit === 'hours') return hrs(v);
    if (unit === 'count') return esc(String(Number(v) || 0));
    return esc(money(v));
  }

  function renderReview(rev) {
    var rec = rev.reconciliation || {};
    var checks = rec.checks || [];
    var issues = rec.rowIssues || [];
    var notes = rec.notes || [];
    var leave = rev.mode === 'leave';
    var count = (rev.employees || []).length;
    var dated = leave ? (rev.asOfDate || '') : (rev.checkDate || '');

    document.getElementById('review-checks').innerHTML = checks.map(function (c) {
      return '<tr>'
        + '<td>' + esc(c.label) + '</td>'
        + '<td class="pr-num">' + checkNum(c.printed, c.unit) + '</td>'
        + '<td class="pr-num">' + checkNum(c.derived, c.unit) + '</td>'
        + '<td>' + (c.ok ? '<span class="pr-ok">Matches</span>' : '<span class="pr-bad">Differs</span>') + '</td>'
        + '</tr>';
    }).join('');

    var verdict = document.getElementById('review-verdict');
    if (rec.passed) {
      verdict.className = 'pr-verdict is-ok';
      verdict.innerHTML = leave
        ? 'All six columns match the report\'s own Total row — ' + esc(String(count))
          + ' employees, as of ' + esc(dated) + '. Saving updates vacation and sick balances '
          + 'only; <strong>no pay period is created.</strong>'
        : 'Every figure matches the packet\'s own printed totals — ' + esc(String(count))
          + ' employees read from ' + esc(dated) + '. Safe to save.';
    } else {
      verdict.className = 'pr-verdict is-bad';
      verdict.innerHTML = 'This read does <strong>not</strong> match the '
        + (leave ? 'report' : 'packet') + '. Nothing can be saved until it does — re-scan it '
        + 'or enter these figures by hand.'
        + (issues.length ? '<ul>' + issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '');
    }

    // Reconciled but noteworthy — shown, never blocking. Save stays enabled.
    var notesEl = document.getElementById('review-notes');
    notesEl.hidden = !notes.length;
    notesEl.innerHTML = notes.length
      ? 'Reconciled, but worth a look before saving:<ul>'
        + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
      : '';

    document.getElementById('review-rows-title').textContent = leave
      ? 'Leave balances to be saved'
      : 'Hours and leave to be saved';
    document.getElementById('review-head').innerHTML = leave ? HEAD_LEAVE : HEAD_PACKET;

    document.getElementById('review-rows').innerHTML = (rev.employees || []).map(function (x) {
      if (leave) {
        return '<tr>'
          + '<td><span class="pr-name">' + esc(x.nameOnPacket || '') + '</span></td>'
          + '<td class="pr-num">' + esc(x.payrollEmployeeId == null ? '' : String(x.payrollEmployeeId)) + '</td>'
          + '<td class="pr-num">' + hrs(x.vacationAccrued) + '</td>'
          + '<td class="pr-num">' + hrs(x.vacationUsed) + '</td>'
          + '<td class="pr-num">' + hrs(x.vacationAvailable) + '</td>'
          + '<td class="pr-num">' + hrs(x.sickAccrued) + '</td>'
          + '<td class="pr-num">' + hrs(x.sickUsed) + '</td>'
          + '<td class="pr-num">' + hrs(x.sickAvailable) + '</td>'
          + '</tr>';
      }
      return '<tr>'
        + '<td><span class="pr-name">' + esc(x.nameOnPacket || '') + '</span></td>'
        + '<td>' + (x.paid ? '<span class="pr-yes">Yes</span>' : '<span class="pr-no">No check</span>') + '</td>'
        + '<td class="pr-num">' + hrs(x.hoursRegular) + '</td>'
        + '<td class="pr-num">' + hrs(x.hoursOvertime) + '</td>'
        + '<td class="pr-num">' + hrs(x.hoursSick) + '</td>'
        + '<td class="pr-num">' + hrs(x.hoursVacationPTO) + '</td>'
        + '<td class="pr-num">' + hrs(x.hoursTotal) + '</td>'
        + '<td class="pr-num">' + hrs(x.vacationAvailable) + '</td>'
        + '<td class="pr-num">' + hrs(x.sickAvailable) + '</td>'
        + '</tr>';
    }).join('');

    reviewEl.hidden = false;
    commitBtn.disabled = !rec.passed;
    commitBtn.textContent = leave ? 'Save leave balances' : 'Save to payroll records';

    // 🔴 Bring the review TO the operator. A read takes ~40s, so by the time it lands the
    // person has usually looked away — on 2026-08-10 Erik read the page successfully, went
    // to the Leave Balances tab to check, saw the old figures and reported "nothing was
    // updated". The review had rendered perfectly, below the fold on another tab, with the
    // Save button nobody had pressed. A read that finishes unseen is a read that never
    // happened, so the panel it lives on is re-shown and scrolled into view.
    var uploadTab = document.querySelector('.pr-tab[data-panel="upload"]');
    if (uploadTab && !uploadTab.classList.contains('is-active')) uploadTab.click();
    try { reviewEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (_) { reviewEl.scrollIntoView(); }   // older browsers: no options object
    setStatus(rec.passed
      ? (leave ? 'Page read and verified. Review below, then save.'
        : 'Packet read and verified. Review below, then save.')
      : 'Read finished, but the totals do not reconcile.', rec.passed ? 'ok' : 'error');
  }

  commitBtn.addEventListener('click', async function () {
    if (!jobId) return;
    commitBtn.disabled = true;
    setStatus('Saving…', 'info');
    try {
      // Only the job id goes up — the server writes its own verified copy of the figures.
      var res = await api('/import', { method: 'POST', body: JSON.stringify({ jobId: jobId }) });
      var msg = res.mode === 'leave'
        ? 'Saved leave balances for ' + res.imported + ' of ' + res.total + ' employees, as of '
          + res.effectiveDate + '. No pay period was created.'
        : 'Saved ' + res.imported + ' of ' + res.total + ' employees for ' + res.checkDate + '.';
      // resetReview() FIRST — it clears the status when it hides a rendered review, so the
      // save result has to be written after it or it gets wiped by the tidy-up.
      resetReview();
      if (res.failures && res.failures.length) {
        setStatus(msg + ' ' + res.failures.length + ' row(s) failed: ' + res.failures.join('; '), 'error');
      } else {
        setStatus(msg, 'ok');
      }
      fileInput.value = '';
      noteEl.textContent = '';
      loadLeave();
      loadPeriods();
    } catch (e) {
      commitBtn.disabled = false;
      var detail = e.payload && e.payload.detail;
      setStatus('Save failed: ' + e.message + (detail ? ' — ' + (Array.isArray(detail) ? detail.join('; ') : detail) : ''), 'error');
    }
  });

  // --- printable cut-apart slips ---------------------------------------------

  // Slips are handed to a person, so hours print as plain numbers (no red, no dashes
  // for zero) and a negative vacation balance gets an explanatory line instead of
  // looking like a mistake.
  function slipHrs(n) {
    var v = Number(n);
    return esc((isFinite(v) ? v : 0).toFixed(2));
  }

  function currentLeaveRows() {
    var q = (document.getElementById('leave-search').value || '').trim().toLowerCase();
    if (!q) return allEmployees;
    return allEmployees.filter(function (e) {
      var hay = ((e.Employee_Full_Name || '') + ' ' + (e.First_Name || '') + ' '
        + (e.Last_Name || '') + ' ' + (e.Department || '') + ' ' + (e.Job_Title || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function slipRow(label, value, star) {
    return '<div class="slip-row"><span class="slip-label">' + label + (star || '')
      + '</span><span class="slip-val">' + slipHrs(value) + '</span></div>';
  }

  function buildSlips(rows) {
    return rows.map(function (e) {
      var f = slipFigures.get(e);
      // This employee's own balance date — never the roster's. Printing a borrowed date
      // would have the paper assert a date the numbers did not come from.
      var asOf = f.asOf || 'an unknown date';
      var eligible = day(e.Vacation_Eligible_Date);
      var grant = Number(e.Vacation_Eligible_Hours || 0);
      // The note tracks the FIGURES, not the wall clock: the eligibility gate is what
      // zeroed the entitlement, so it is what the employee needs explained.
      var pending = eligible && f.entitlement === 0 && Number(e.Vacation_Annual_Entitlement) > 0;

      // Someone still short of their first anniversary gets an asterisk beside the
      // vacation line and a matching footnote, so a negative balance reads as "not yet
      // accrued" rather than "you are in the hole". Grant hours come from the record,
      // not a hardcoded 40 — the next new hire is handled without a code change.
      var notes = [];
      if (pending) {
        notes.push('* Your vacation resets on ' + esc(eligible) + ', your one-year anniversary'
          + (grant ? ', when you receive ' + esc(grant.toFixed(0)) + ' hours' : '')
          + '. Until then this balance can be negative.');
      } else if (f.slip.remaining < 0) {
        notes.push('* You have used more vacation than has accrued so far this year.');
      } else if (f.flags.some(function (x) { return x.code === 'floored-remaining'; })) {
        // The packet floors an over-drawn balance at 00:00 and we print what it says, so
        // without this the slip shows "Hours used 16.00" above "Hours remaining 0.00" and
        // reads as an error to the person holding it.
        notes.push('* This shows 0.00 because the payroll report does not print a negative '
          + 'balance. You have used more vacation than has accrued so far this year.');
      }
      var star = notes.length ? '<span class="slip-star">*</span>' : '';

      // §7.4 — say the balances are old rather than print one that looks current.
      if (f.flags.some(function (x) {
        return x.code === 'stale-balances' || x.code === 'unknown-as-of' || x.code === 'borrowed-as-of';
      })) {
        notes.push('These balances are from ' + esc(asOf) + ' and may not include recent time off.');
      }

      return '<div class="slip">'
        + '<div class="slip-co">Northwest Custom Apparel</div>'
        + '<div class="slip-name">' + esc(fullName(e)) + '</div>'
        + '<div class="slip-asof">Balances as of ' + esc(asOf) + '</div>'
        + '<div class="slip-rows">'
        + '<div class="slip-group">Vacation</div>'
        + slipRow('Hours accrued', f.slip.accrued)
        + slipRow('Hours used', f.slip.used)
        + slipRow('Hours remaining', f.slip.remaining, star)
        + '<div class="slip-group">Sick</div>'
        + slipRow('Hours accrued', f.sick.accrued)
        + slipRow('Hours used', f.sick.used)
        + slipRow('Hours remaining', f.sick.remaining)
        + '</div>'
        + (notes.length ? '<div class="slip-note">' + notes.join('<br>') + '</div>' : '')
        + '</div>';
    }).join('');
  }

  // --- audit trail ------------------------------------------------------------

  // §11 — every slip run is reconcilable back to the accountant's report, so the RAW
  // imported figures are kept beside the adjusted ones. Written as a CSV the browser
  // downloads: no Caspio quota, no new table, and it files alongside the payroll packet.
  var AUDIT_COLUMNS = [
    'employee_name', 'payroll_id', 'run_date', 'balances_as_of',
    'raw_available', 'raw_used', 'raw_remaining',
    'entitlement', 'carryover',
    'slip_accrued', 'slip_used', 'slip_remaining',
    'sick_accrued', 'sick_used', 'sick_remaining',
    'slip_printed', 'carryover_reason', 'flags',
  ];

  function csvCell(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }

  function auditRow(e, f, runDate, printed) {
    return [
      fullName(e), f.payrollId || '', runDate, f.asOf,
      f.raw.available, f.raw.used, f.raw.remaining,
      f.entitlement === null ? '' : f.entitlement, f.carryover,
      f.slip ? f.slip.accrued : '', f.slip ? f.slip.used : '', f.slip ? f.slip.remaining : '',
      f.sick.accrued, f.sick.used, f.sick.remaining,
      printed ? 'yes' : 'no', f.carryoverReason,
      f.flags.map(function (x) { return x.code + ': ' + x.message; }).join(' | '),
    ].map(csvCell).join(',');
  }

  function downloadAudit(rows, runDate) {
    var lines = [AUDIT_COLUMNS.join(',')];
    rows.forEach(function (r) { lines.push(auditRow(r.employee, r.figures, runDate, r.printed)); });
    // BOM so Excel reads the UTF-8 in the flag messages instead of mojibake.
    var blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'payroll-slip-audit-' + runDate + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  document.getElementById('print-slips').addEventListener('click', function () {
    var rows = currentLeaveRows();
    if (!rows.length) return setStatus('Nothing to print — no employees match the filter.', 'error');

    var runDate = new Date().toISOString().slice(0, 10);

    // §7.1/§7.2 — a record whose figures don't reconcile, or that has no entitlement set,
    // does NOT go on paper. It still goes in the audit CSV, marked not-printed, so a
    // missing slip is explained rather than just absent.
    var printable = rows.filter(function (e) {
      var f = slipFigures.get(e);
      return f && f.printable;
    });
    var blocked = rows.filter(function (e) { return printable.indexOf(e) === -1; });

    downloadAudit(rows.map(function (e) {
      return { employee: e, figures: slipFigures.get(e), printed: printable.indexOf(e) !== -1 };
    }), runDate);

    if (!printable.length) {
      return setStatus('No slips printed — every matching employee is flagged. See the list above '
        + 'and the audit CSV just downloaded.', 'error');
    }

    // Pad to a full row of 2 so the last sheet's cut lines run edge to edge rather than
    // stopping halfway across — otherwise the final slip has no line to cut against.
    var html = buildSlips(printable);
    if (printable.length % 2 !== 0) html += '<div class="slip"></div>';
    document.getElementById('print-slips-grid').innerHTML = html;

    document.body.classList.add('print-slips');
    var cleanup = function () {
      document.body.classList.remove('print-slips');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // Safari/older browsers don't always fire afterprint — don't strand the page hidden.
    setTimeout(cleanup, 3000);

    var msg = 'Sent ' + printable.length + ' slip' + (printable.length === 1 ? '' : 's')
      + ' to the printer, and saved the audit CSV.';
    if (blocked.length) {
      setStatus(msg + ' ' + blocked.length + ' employee' + (blocked.length === 1 ? ' was' : 's were')
        + ' skipped: ' + blocked.map(fullName).join(', ') + '. See the flags above.', 'error');
    } else {
      setStatus(msg, 'ok');
    }
  });

  document.getElementById('leave-search').addEventListener('input', applyLeaveFilter);

  loadLeave();
  loadPeriods();
})();
