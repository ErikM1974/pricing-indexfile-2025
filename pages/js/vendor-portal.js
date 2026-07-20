/* vendor-portal.js — L&P Screen Printing subcontractor job portal (/vendor).
 * Session-scoped: all data comes from same-origin /api/vendor/* (the app server
 * derives the vendor from the nwca_vendor cookie and projects vendor-safe fields;
 * this page never talks to the caspio-pricing-proxy directly).
 * Deep links use #job=<ID_Transfer> (hash — never query params). */
(function () {
  'use strict';

  var state = {
    jobs: [],
    filter: 'active',
    search: '',
    currentJobId: null,
    vendor: null,
  };

  var TERMINAL = { Received: true, Cancelled: true };

  // ── helpers ───────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(s) {
    if (!s) return '—';
    var d = (window.CaspioDate && window.CaspioDate.parse) ? window.CaspioDate.parse(s) : new Date(s);
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function showError(msg) {
    $('vp-error-text').textContent = msg;
    $('vp-error').hidden = false;
  }
  function clearError() { $('vp-error').hidden = true; }

  function apiGet(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          window.location.href = (j && j.loginUrl) || '/vendor/login';
          throw new Error('signed out');
        });
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function statusLabel(s) { return String(s || '').replace(/_/g, ' '); }
  function statusBadge(s) {
    var safe = /^[A-Za-z_]+$/.test(String(s || '')) ? s : 'Requested';
    return '<span class="vp-badge vp-badge--status-' + esc(safe) + '">' + esc(statusLabel(s)) + '</span>';
  }
  function rushBadge() { return '<span class="vp-badge vp-badge--rush"><i class="fas fa-bolt"></i> RUSH</span>'; }

  // ── list view ─────────────────────────────────────────────
  function jobMatchesFilter(job) {
    if (state.filter === 'active') return !TERMINAL[job.status];
    if (state.filter === 'completed') return job.status === 'Received';
    return true;
  }
  function jobMatchesSearch(job) {
    if (!state.search) return true;
    var q = state.search.toLowerCase();
    return [job.companyName, job.designNumber, job.id, job.customerName]
      .some(function (v) { return v && String(v).toLowerCase().indexOf(q) !== -1; });
  }

  function renderList() {
    var grid = $('vp-job-grid');
    var jobs = state.jobs.filter(jobMatchesFilter).filter(jobMatchesSearch);
    $('vp-empty').hidden = jobs.length > 0;
    grid.innerHTML = jobs.map(function (job) {
      var thumb = job.mockupThumbnailUrl
        ? '<img class="vp-job-thumb" src="' + esc(job.mockupThumbnailUrl) + '" alt="Mockup" loading="lazy">'
        : '<div class="vp-job-thumb vp-job-thumb--placeholder"><i class="fas fa-tshirt"></i></div>';
      return '<div class="vp-job-card" data-job="' + esc(job.id) + '" role="button" tabindex="0">' +
        thumb +
        '<div class="vp-job-body">' +
          '<div class="vp-job-id">' + esc(job.id) + '</div>' +
          '<div class="vp-job-company">' + esc(job.companyName || 'Unknown company') + '</div>' +
          '<div class="vp-job-meta">' +
            (job.designNumber ? '<span><i class="fas fa-hashtag"></i> Design ' + esc(job.designNumber) + '</span>' : '') +
            '<span><i class="far fa-calendar"></i> ' + fmtDate(job.requestedAt) + '</span>' +
            (job.fileCount ? '<span><i class="far fa-file"></i> ' + esc(job.fileCount) + ' file' + (job.fileCount === 1 ? '' : 's') + '</span>' : '') +
          '</div>' +
          '<div class="vp-job-badges">' + statusBadge(job.status) + (job.isRush ? rushBadge() : '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function loadJobs() {
    $('vp-loading').hidden = false;
    clearError();
    apiGet('/api/vendor/jobs').then(function (data) {
      state.jobs = data.jobs || [];
      state.vendor = data.vendor || null;
      if (state.vendor) {
        $('vp-vendor-name').textContent = state.vendor.name + ' — Job Portal';
        $('vp-user-email').textContent = state.vendor.contactName || state.vendor.email;
      }
      $('vp-loading').hidden = true;
      renderList();
    }).catch(function (e) {
      if (e.message === 'signed out') return;
      $('vp-loading').hidden = true;
      showError('Unable to load jobs. Please refresh — if this keeps happening, call NWCA at (253) 922-5793.');
      console.error('[vendor-portal] jobs load failed:', e);
    });
  }

  // ── detail view ───────────────────────────────────────────
  function showListView() {
    state.currentJobId = null;
    $('vp-detail-view').hidden = true;
    $('vp-list-view').hidden = false;
    if (location.hash) history.replaceState(null, '', location.pathname);
  }

  function fileIcon(mime, name) {
    var n = String(name || '').toLowerCase();
    if (/pdf/.test(String(mime)) || /\.pdf$/.test(n)) return 'fa-file-pdf';
    if (/\.(ai|eps|svg)$/.test(n)) return 'fa-bezier-curve';
    if (/image/.test(String(mime)) || /\.(png|jpe?g|gif|tiff?|webp)$/.test(n)) return 'fa-file-image';
    if (/\.(zip|rar|7z)$/.test(n)) return 'fa-file-zipper';
    return 'fa-file';
  }

  function renderDetail(data) {
    var job = data.job;
    $('vp-d-id').textContent = job.id;
    $('vp-d-company').textContent = job.companyName || 'Unknown company';
    var subBits = [];
    if (job.designNumber) subBits.push('Design #' + job.designNumber);
    if (job.shopworksPO) subBits.push('PO ' + job.shopworksPO);
    if (job.salesRepName) subBits.push('NWCA contact: ' + job.salesRepName);
    $('vp-d-sub').textContent = subBits.join(' · ');
    $('vp-d-badges').innerHTML = statusBadge(job.status) + (job.isRush ? rushBadge() : '');

    // Work-order meta
    var meta = [
      ['Requested', fmtDate(job.requestedAt)],
      ['Needed by', fmtDate(job.neededBy)],
      ['Est. ship', fmtDate(job.estimatedShipDate)],
      ['Transfer type', job.transferType || '—'],
      ['Fabric', job.fabricTarget || '—'],
      ['# Colors', job.colorCount != null ? job.colorCount : '—'],
      ['Primary color', job.primaryColor || '—'],
      ['Additional colors', job.additionalColors || '—'],
    ];
    $('vp-d-meta').innerHTML = meta.map(function (m) {
      return '<div><dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd></div>';
    }).join('');

    var instr = [job.specialInstructions, job.fileNotes].filter(Boolean).join('\n\n');
    $('vp-d-instructions').hidden = !instr;
    if (instr) {
      $('vp-d-instructions').innerHTML = '<strong><i class="fas fa-triangle-exclamation"></i> Instructions:</strong> ' + esc(instr);
    }

    // Lines
    var lines = data.lines || [];
    $('vp-d-lines-empty').hidden = lines.length > 0;
    $('vp-d-lines-table').hidden = lines.length === 0;
    $('vp-d-lines').innerHTML = lines.map(function (l) {
      var wh = (l.widthIn != null || l.heightIn != null)
        ? (l.widthIn != null ? l.widthIn : '?') + ' × ' + (l.heightIn != null ? l.heightIn : '?')
        : '—';
      return '<tr>' +
        '<td>' + esc(l.quantity != null ? l.quantity : '—') + '</td>' +
        '<td>' + esc(l.transferSize || '—') + '</td>' +
        '<td>' + esc(wh) + '</td>' +
        '<td>' + esc(l.pressCount != null ? l.pressCount : '—') + '</td>' +
        '<td>' + esc(l.notes || '') + '</td>' +
      '</tr>';
    }).join('');

    // Files (download = Box shared download links stored on the order)
    var files = data.files || [];
    $('vp-d-files-empty').hidden = files.length > 0;
    $('vp-d-files').innerHTML = files.map(function (f) {
      var dims = [];
      if (f.widthIn != null && f.heightIn != null) dims.push(f.widthIn + '" × ' + f.heightIn + '"');
      else if (f.widthPx != null && f.heightPx != null) dims.push(f.widthPx + ' × ' + f.heightPx + ' px');
      var thumb = f.thumbnailUrl
        ? '<img class="vp-file-thumb" src="' + esc(f.thumbnailUrl) + '" alt="" loading="lazy">'
        : '<div class="vp-file-icon"><i class="fas ' + fileIcon(f.mime, f.fileName) + '"></i></div>';
      var typeClass = f.fileType === 'mockup' ? ' vp-file-type--mockup' : '';
      return '<div class="vp-file">' +
        thumb +
        '<div class="vp-file-info">' +
          '<div class="vp-file-name">' + esc(f.fileName || 'file') + '</div>' +
          '<div class="vp-file-meta">' +
            '<span class="vp-file-type' + typeClass + '">' + esc(f.fileType || 'file') + '</span>' +
            (dims.length ? '<span>' + esc(dims.join(' ')) + '</span>' : '') +
            (f.notes ? '<span>' + esc(f.notes) + '</span>' : '') +
          '</div>' +
        '</div>' +
        (f.fileUrl
          ? '<a class="vp-btn vp-btn--primary" href="' + esc(f.fileUrl) + '" target="_blank" rel="noopener noreferrer"><i class="fas fa-download"></i> Download</a>'
          : '') +
      '</div>';
    }).join('');

    // Mockup hero (first mockup-type file with a viewable URL)
    var mockup = files.filter(function (f) { return f.fileType === 'mockup' && (f.thumbnailUrl || f.fileUrl); })[0];
    $('vp-d-mockup').innerHTML = mockup
      ? '<a href="' + esc(mockup.fileUrl || mockup.thumbnailUrl) + '" target="_blank" rel="noopener noreferrer">' +
          '<img class="vp-mockup-img" src="' + esc(mockup.thumbnailUrl || mockup.fileUrl) + '" alt="Mockup"></a>'
      : '<div class="vp-empty-panel">No mockup attached.</div>';

    renderNotes(data.notes || []);
  }

  function renderNotes(notes) {
    // Vendor-authored notes carry "(Vendor Name)" in Author_Name (set server-side).
    var mine = state.vendor ? ('(' + String(state.vendor.name).toLowerCase() + ')') : '';
    $('vp-d-notes').innerHTML = notes.slice().reverse().map(function (n) {
      var cls = 'vp-note';
      if (n.type && n.type !== 'comment') cls += ' vp-note--status';
      if (mine && n.authorName && n.authorName.toLowerCase().indexOf(mine) !== -1) cls += ' vp-note--vendor';
      return '<div class="' + cls + '">' +
        '<div class="vp-note-head"><strong>' + esc(n.authorName || 'NWCA') + '</strong> · ' + esc(fmtDate(n.createdAt)) + '</div>' +
        '<div class="vp-note-text">' + esc(n.text) + '</div>' +
      '</div>';
    }).join('') || '<div class="vp-empty-panel">No activity yet.</div>';
  }

  function openJob(id) {
    state.currentJobId = id;
    history.replaceState(null, '', '#job=' + encodeURIComponent(id));
    $('vp-list-view').hidden = true;
    $('vp-detail-view').hidden = false;
    $('vp-detail-main').hidden = true;
    $('vp-detail-loading').hidden = false;
    clearError();
    apiGet('/api/vendor/jobs/' + encodeURIComponent(id)).then(function (data) {
      $('vp-detail-loading').hidden = true;
      $('vp-detail-main').hidden = false;
      renderDetail(data);
    }).catch(function (e) {
      if (e.message === 'signed out') return;
      $('vp-detail-loading').hidden = true;
      showError('Unable to load this job. It may have been removed — go back and refresh.');
      console.error('[vendor-portal] job detail failed:', e);
    });
  }

  function postComment() {
    var input = $('vp-comment-input');
    var note = (input.value || '').trim();
    if (!note || !state.currentJobId) return;
    var btn = $('vp-comment-btn');
    btn.disabled = true;
    fetch('/api/vendor/jobs/' + encodeURIComponent(state.currentJobId) + '/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ note: note }),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      input.value = '';
      openJob(state.currentJobId); // reload to show the new note
    }).catch(function (e) {
      showError('Unable to post your note right now. Please try again.');
      console.error('[vendor-portal] note post failed:', e);
    }).finally(function () { btn.disabled = false; });
  }

  // ── wiring ────────────────────────────────────────────────
  $('vp-filters').addEventListener('click', function (e) {
    var chip = e.target.closest('.vp-chip');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    document.querySelectorAll('.vp-chip').forEach(function (c) { c.classList.remove('vp-chip--active'); });
    chip.classList.add('vp-chip--active');
    renderList();
  });
  $('vp-search').addEventListener('input', function (e) {
    state.search = (e.target.value || '').trim();
    renderList();
  });
  $('vp-job-grid').addEventListener('click', function (e) {
    var card = e.target.closest('.vp-job-card');
    if (card) openJob(card.dataset.job);
  });
  $('vp-job-grid').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var card = e.target.closest('.vp-job-card');
    if (card) openJob(card.dataset.job);
  });
  $('vp-back-btn').addEventListener('click', showListView);
  $('vp-comment-btn').addEventListener('click', postComment);

  // Boot: load list, then honor a #job= deep link.
  loadJobs();
  var m = location.hash.match(/^#job=(.+)$/);
  if (m) openJob(decodeURIComponent(m[1]));
})();
