/* ==========================================================================
   sanmar-ftp-integration.js — SanMar FTP Downloads (admin).
   Lists the files on SanMar's FTP via the same-origin, admin-gated endpoint
   /api/staff/sanmar-ftp/list and renders a Download button per file that
   streams from /api/staff/sanmar-ftp/download. No external config: same origin.
   ========================================================================== */
(function () {
  'use strict';

  var LIST_URL = '/api/staff/sanmar-ftp/list';
  var DL_URL = '/api/staff/sanmar-ftp/download';

  var statusEl = document.getElementById('sf-status');
  var filesEl = document.getElementById('sf-files');
  var checkedEl = document.getElementById('sf-checked');
  var configNote = document.getElementById('sf-config-note');
  var refreshBtn = document.getElementById('sf-refresh');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function humanSize(n) {
    n = Number(n) || 0;
    var units = ['B', 'KB', 'MB', 'GB'];
    for (var i = 0; i < units.length; i++) {
      if (n < 1024 || i === units.length - 1) return n.toFixed(n < 10 && i > 0 ? 1 : 0) + ' ' + units[i];
      n /= 1024;
    }
    return n + ' B';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
           ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  // Human "what it is" from the file name.
  function describe(name) {
    if (/^SanMarPI-Bulk-.*\.csv$/i.test(name)) return 'Product &amp; pricing master (import into Sanmar_Bulk)';
    if (/^sanmar_dip\.txt$/i.test(name)) return 'Inventory + pricing by warehouse (hourly)';
    if (/^Category_/i.test(name)) return 'Single-category product subset';
    if (/SaleItems/i.test(name)) return 'Current sale items';
    if (/\.zip$/i.test(name)) return 'Zipped data file';
    return 'SanMar data file';
  }

  function setStatus(html, isError) {
    statusEl.innerHTML = html;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function render(payload) {
    var files = (payload && payload.files) || [];
    var masterKey = payload && payload.masterKey;

    if (!files.length) {
      filesEl.innerHTML = '<div class="sf-msg">No downloadable files were found in the SanMar folders right now.</div>';
      return;
    }

    // Master (pricing) file first, then the rest as returned (newest first).
    files.sort(function (a, b) {
      var am = (a.dir + a.name) === masterKey ? 0 : 1;
      var bm = (b.dir + b.name) === masterKey ? 0 : 1;
      return am - bm;
    });

    var rows = files.map(function (f) {
      var key = f.dir + f.name;
      var isMaster = key === masterKey;
      var href = DL_URL + '?dir=' + encodeURIComponent(f.dir) + '&name=' + encodeURIComponent(f.name);
      return '' +
        '<tr class="' + (isMaster ? 'sf-row--master' : '') + '">' +
          '<td><span class="sf-file-name">' + esc(f.name) + '</span>' +
            (isMaster ? '<span class="sf-tag">Pricing master</span>' : '') + '</td>' +
          '<td class="sf-file-kind">' + describe(f.name) + '</td>' +
          '<td class="sf-file-meta">' + humanSize(f.size) + '</td>' +
          '<td class="sf-file-meta">' + esc(fmtDate(f.modifiedAt)) + '</td>' +
          '<td><a class="sf-btn" href="' + href + '" download="' + esc(f.name) + '">' +
            '<i class="fas fa-download"></i> Download</a></td>' +
        '</tr>';
    }).join('');

    filesEl.innerHTML =
      '<div class="sf-table-wrap"><table class="sf-table">' +
      '<thead><tr><th>File</th><th>What it is</th><th>Size</th><th>Updated</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function load(fresh) {
    setStatus('<i class="fas fa-rotate sf-spin"></i> Connecting to SanMar…', false);
    filesEl.innerHTML = '';
    if (configNote) configNote.hidden = true;
    if (refreshBtn) refreshBtn.classList.add('is-busy');

    fetch(LIST_URL + (fresh ? '?fresh=1' : ''), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) { return { status: r.status, body: body }; });
      })
      .then(function (res) {
        if (refreshBtn) refreshBtn.classList.remove('is-busy');
        var b = res.body || {};
        if (res.status === 401) {
          setStatus('Your session expired. <a href="/auth/saml/login">Sign in again</a>.', true);
          return;
        }
        if (res.status === 503 && b.error === 'not_configured') {
          setStatus('', false);
          filesEl.innerHTML = '<div class="sf-msg sf-msg--error"><b>Not set up yet.</b> ' + esc(b.message || 'The SanMar FTP password is not configured on the app.') + '</div>';
          if (configNote) configNote.hidden = false;
          return;
        }
        if (res.status !== 200) {
          setStatus('', false);
          filesEl.innerHTML = '<div class="sf-msg sf-msg--error"><b>Could not reach SanMar.</b> ' + esc(b.message || ('Error ' + res.status)) + ' — try Refresh in a minute.</div>';
          return;
        }
        setStatus('', false);
        render(b);
        if (checkedEl) checkedEl.textContent = b.checkedAt ? ('Listing as of ' + fmtDate(b.checkedAt) + '. Large files (the pricing master is ~330 MB) can take a minute to download.') : '';
      })
      .catch(function (e) {
        if (refreshBtn) refreshBtn.classList.remove('is-busy');
        setStatus('', false);
        filesEl.innerHTML = '<div class="sf-msg sf-msg--error"><b>Network error.</b> ' + esc(e.message || '') + '</div>';
      });
  }

  if (refreshBtn) refreshBtn.addEventListener('click', function () { load(true); });
  load(false);
})();
