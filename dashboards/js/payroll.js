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
 */
(function () {
  'use strict';

  var API = '/api/crm-proxy/payroll';
  var statusEl = document.getElementById('pr-status');
  var jobId = null;
  var pollTimer = null;
  var allEmployees = [];

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

  function renderLeave(rows) {
    var body = document.getElementById('leave-body');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="pr-loading">No active employees found.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (e) {
      var name = e.Employee_Full_Name || ((e.First_Name || '') + ' ' + (e.Last_Name || '')).trim();
      // Not yet at the 1-year mark → the negative vacation balance is expected, so say so
      // instead of letting it read as a data error.
      var eligible = day(e.Vacation_Eligible_Date);
      var pill = '';
      if (eligible && eligible > new Date().toISOString().slice(0, 10)) {
        pill = '<span class="pr-pill pr-pill-wait">accrues ' + esc(eligible) + '</span>';
      }
      return '<tr>'
        + '<td><span class="pr-name">' + esc(name) + '</span>' + pill + '</td>'
        + '<td class="pr-dept">' + esc(e.Department || '—') + '</td>'
        + '<td class="pr-num">' + hrs(e.Vacation_Hours_Available) + '</td>'
        + '<td class="pr-num">' + hrs(e.Vacation_Hours_Used) + '</td>'
        + '<td class="pr-num">' + hrs(e.Vacation_Hours_Remaining) + '</td>'
        + '<td class="pr-num">' + hrs(e.Sick_Accum_Hours_Available) + '</td>'
        + '<td class="pr-num">' + hrs(e.Sick_Hours_Used) + '</td>'
        + '<td class="pr-num">' + hrs(e.Sick_Hours_Remaining) + '</td>'
        + '</tr>';
    }).join('');
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

  async function loadLeave() {
    try {
      var data = await api('/employees');
      allEmployees = data.employees || [];
      renderLeave(allEmployees);
      var stamps = allEmployees.map(function (e) { return day(e.Leave_Balances_As_Of); })
        .filter(Boolean).sort();
      document.getElementById('leave-asof').textContent = stamps.length
        ? 'Balances as of ' + stamps[stamps.length - 1]
        : 'No packet imported yet';
    } catch (e) {
      document.getElementById('leave-body').innerHTML =
        '<tr><td colspan="8" class="pr-loading">Could not load balances.</td></tr>';
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

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    parseBtn.disabled = !f;
    noteEl.textContent = f ? (Math.round(f.size / 104857.6) / 10) + ' MB selected' : '';
    resetReview();
  });

  function resetReview() {
    jobId = null;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    reviewEl.hidden = true;
    commitBtn.disabled = true;
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
    setStatus('Uploading and reading the packet — this usually takes under a minute…', 'info');
    try {
      var b64 = await readAsBase64(f);
      var started = await api('/parse', {
        method: 'POST',
        body: JSON.stringify({ filename: f.name, dataBase64: b64 }),
      });
      jobId = started.jobId;
      pollParse();
    } catch (e) {
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
        parseBtn.disabled = false;
        if (res.status === 'error') return setStatus('Could not read the packet: ' + res.error, 'error');
        renderReview(res.review);
      } catch (e) {
        parseBtn.disabled = false;
        setStatus('Could not read the packet: ' + e.message, 'error');
      }
    }, 3000);
  }

  function renderReview(rev) {
    var rec = rev.reconciliation || {};
    var checks = rec.checks || [];
    var issues = rec.rowIssues || [];

    document.getElementById('review-checks').innerHTML = checks.map(function (c) {
      return '<tr>'
        + '<td>' + esc(c.label) + '</td>'
        + '<td class="pr-num">' + esc(money(c.printed)) + '</td>'
        + '<td class="pr-num">' + esc(money(c.derived)) + '</td>'
        + '<td>' + (c.ok ? '<span class="pr-ok">Matches</span>' : '<span class="pr-bad">Differs</span>') + '</td>'
        + '</tr>';
    }).join('');

    var verdict = document.getElementById('review-verdict');
    if (rec.passed) {
      verdict.className = 'pr-verdict is-ok';
      verdict.innerHTML = 'Every figure matches the packet\'s own printed totals — '
        + esc(String((rev.employees || []).length)) + ' employees read from '
        + esc(rev.checkDate || '') + '. Safe to save.';
    } else {
      verdict.className = 'pr-verdict is-bad';
      verdict.innerHTML = 'This read does <strong>not</strong> match the packet. Nothing can be saved '
        + 'until it does — re-scan the packet or enter this period by hand.'
        + (issues.length ? '<ul>' + issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '');
    }

    document.getElementById('review-rows').innerHTML = (rev.employees || []).map(function (x) {
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
    setStatus(rec.passed
      ? 'Packet read and verified. Review below, then save.'
      : 'Packet read, but the totals do not reconcile.', rec.passed ? 'ok' : 'error');
  }

  commitBtn.addEventListener('click', async function () {
    if (!jobId) return;
    commitBtn.disabled = true;
    setStatus('Saving…', 'info');
    try {
      // Only the job id goes up — the server writes its own verified copy of the figures.
      var res = await api('/import', { method: 'POST', body: JSON.stringify({ jobId: jobId }) });
      var msg = 'Saved ' + res.imported + ' of ' + res.total + ' employees for ' + res.checkDate + '.';
      if (res.failures && res.failures.length) {
        setStatus(msg + ' ' + res.failures.length + ' row(s) failed: ' + res.failures.join('; '), 'error');
      } else {
        setStatus(msg, 'ok');
      }
      resetReview();
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

  document.getElementById('leave-search').addEventListener('input', applyLeaveFilter);

  loadLeave();
  loadPeriods();
})();
