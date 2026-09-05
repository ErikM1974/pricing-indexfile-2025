/* vendor-portal.js — L&P Screen Printing subcontractor job portal (/vendor).
 * Session-scoped: all data comes from same-origin /api/vendor/* (the app server
 * derives the vendor from the nwca_vendor cookie and projects vendor-safe fields;
 * this page never talks to the caspio-pricing-proxy directly).
 * Deep links use #job=<ID_Transfer> (hash — never query params); opening a job
 * pushes a history entry so the browser Back button returns to the list. */
(function () {
  'use strict';

  var state = {
    jobs: [],
    filter: 'active',
    search: '',
    currentJobId: null,
    vendor: null,
    retry: null,          // what the error banner's Retry button re-runs
    lastCardId: null,     // card to re-focus when coming back to the list
  };

  var TERMINAL = { Received: true, Cancelled: true };
  var BASE_TITLE = 'Job Portal — Northwest Custom Apparel';

  // ── helpers ───────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function parseDate(s) {
    if (!s) return null;
    var d = (window.CaspioDate && window.CaspioDate.parse) ? window.CaspioDate.parse(s) : new Date(s);
    return (d && !isNaN(d.getTime())) ? d : null;
  }
  function fmtDate(s) {
    var d = parseDate(s);
    return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  }
  function isPastDue(job) {
    var d = parseDate(job.neededBy);
    if (!d || TERMINAL[job.status]) return false;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }
  function setTitle(prefix) { document.title = prefix ? prefix + ' | ' + BASE_TITLE : BASE_TITLE; }
  function showError(msg, retry) {
    $('vp-error-text').textContent = msg;
    state.retry = typeof retry === 'function' ? retry : null;
    $('vp-error-retry').hidden = !state.retry;
    $('vp-error').hidden = false;
  }
  function clearError() { $('vp-error').hidden = true; state.retry = null; }

  function apiGet(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          window.location.href = (j && j.loginUrl) || '/vendor/login';
          throw new Error('signed out');
        });
      }
      if (!r.ok) {
        // The server's own message when it sent one (503 "Unable to load jobs right now…",
        // 429 from the limiter) beats a generic line.
        return r.json().catch(function () { return {}; }).then(function (j) {
          var err = new Error('HTTP ' + r.status);
          err.status = r.status;
          err.serverMessage = (j && typeof j.error === 'string') ? j.error : '';
          if (r.status === 429 && !err.serverMessage) err.serverMessage = 'Too many requests — wait a minute and try again.';
          throw err;
        });
      }
      return r.json();
    });
  }

  function statusLabel(s) { return String(s || '').replace(/_/g, ' '); }
  function statusBadge(s) {
    var safe = /^[A-Za-z_]+$/.test(String(s || '')) ? s : 'Requested';
    return '<span class="vp-badge vp-badge--status-' + esc(safe) + '">' + esc(statusLabel(s)) + '</span>';
  }
  function rushBadge() { return '<span class="vp-badge vp-badge--rush"><i class="fas fa-bolt" aria-hidden="true"></i> RUSH</span>'; }

  // Image fallbacks (Rule 3: no inline onerror=). `error` does not bubble → capture phase.
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.onerror) return;
    var mode = img.dataset.onerror, ph;
    if (mode === 'job-thumb') {
      ph = document.createElement('div'); ph.className = 'vp-job-thumb vp-job-thumb--placeholder';
      ph.innerHTML = '<i class="fas fa-tshirt" aria-hidden="true"></i>';
      img.replaceWith(ph);
    } else if (mode === 'file-thumb') {
      ph = document.createElement('div'); ph.className = 'vp-file-icon';
      ph.innerHTML = '<i class="fas fa-file-image" aria-hidden="true"></i>';
      img.replaceWith(ph);
    } else if (mode === 'mockup') {
      var a = img.closest('a') || img;
      ph = document.createElement('div'); ph.className = 'vp-empty-panel';
      ph.textContent = 'Mockup preview unavailable — use the Download link in Artwork & Working Files.';
      a.replaceWith(ph);
    } else {
      img.remove();
    }
  }, true);

  // ── list view ─────────────────────────────────────────────
  function matchesFilter(job, filter) {
    if (filter === 'active') return !TERMINAL[job.status];
    if (filter === 'completed') return job.status === 'Received';
    return true;
  }
  function jobMatchesSearch(job) {
    if (!state.search) return true;
    var q = state.search.toLowerCase();
    return [job.companyName, job.designNumber, job.id, job.customerName]
      .some(function (v) { return v && String(v).toLowerCase().indexOf(q) !== -1; });
  }

  function emptyText() {
    if (state.search) return 'No jobs match “' + state.search + '”.';
    if (state.filter === 'active') return 'No active jobs right now.';
    if (state.filter === 'completed') return 'No completed jobs yet.';
    return 'No jobs here right now.';
  }

  function renderList() {
    var grid = $('vp-job-grid');
    // Chip counts ignore the search box — they describe the whole board.
    ['active', 'completed', 'all'].forEach(function (f) {
      var n = state.jobs.filter(function (j) { return matchesFilter(j, f); }).length;
      var el = document.querySelector('.vp-chip-count[data-count="' + f + '"]');
      if (el) el.textContent = state.jobs.length ? String(n) : '';
    });
    var jobs = state.jobs.filter(function (j) { return matchesFilter(j, state.filter); }).filter(jobMatchesSearch);
    $('vp-empty').hidden = jobs.length > 0;
    $('vp-empty-text').textContent = emptyText();
    grid.innerHTML = jobs.map(function (job) {
      var thumb = job.mockupThumbnailUrl
        ? '<img class="vp-job-thumb" src="' + esc(job.mockupThumbnailUrl) + '" alt="" loading="lazy" data-onerror="job-thumb">'
        : '<div class="vp-job-thumb vp-job-thumb--placeholder"><i class="fas fa-tshirt" aria-hidden="true"></i></div>';
      var pastDue = isPastDue(job);
      return '<div class="vp-job-card' + (pastDue ? ' vp-job-card--pastdue' : '') + '" data-job="' + esc(job.id) + '" role="button" tabindex="0" aria-label="Open job ' + esc(job.id) + ', ' + esc(job.companyName || 'Unknown company') + '">' +
        thumb +
        '<div class="vp-job-body">' +
          '<div class="vp-job-id">' + esc(job.id) + '</div>' +
          '<div class="vp-job-company">' + esc(job.companyName || 'Unknown company') + '</div>' +
          '<div class="vp-job-meta">' +
            (job.designNumber ? '<span><i class="fas fa-hashtag" aria-hidden="true"></i> Design ' + esc(job.designNumber) + '</span>' : '') +
            '<span><i class="far fa-calendar" aria-hidden="true"></i> ' + fmtDate(job.requestedAt) + '</span>' +
            (job.neededBy ? '<span' + (pastDue ? ' class="vp-overdue"' : '') + '><i class="far fa-clock" aria-hidden="true"></i> Needed ' + fmtDate(job.neededBy) + (pastDue ? ' · past due' : '') + '</span>' : '') +
            (job.fileCount ? '<span><i class="far fa-file" aria-hidden="true"></i> ' + esc(job.fileCount) + ' file' + (job.fileCount === 1 ? '' : 's') + '</span>' : '') +
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
        if (!state.currentJobId) setTitle(state.vendor.name);
      }
      $('vp-loading').hidden = true;
      renderList();
    }).catch(function (e) {
      if (e.message === 'signed out') return;
      $('vp-loading').hidden = true;
      showError(e.serverMessage || 'Unable to load jobs. Please try again — if this keeps happening, call NWCA at (253) 922-5793.', loadJobs);
      console.error('[vendor-portal] jobs load failed:', e);
    });
  }

  // ── detail view ───────────────────────────────────────────
  function showListView(fromHistory) {
    state.currentJobId = null;
    clearError();
    $('vp-detail-view').hidden = true;
    $('vp-list-view').hidden = false;
    if (!fromHistory && location.hash) history.pushState(null, '', location.pathname);
    setTitle(state.vendor ? state.vendor.name : '');
    var card = state.lastCardId && document.querySelector('.vp-job-card[data-job="' + state.lastCardId.replace(/"/g, '\\"') + '"]');
    if (card) card.focus();
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
    setTitle(job.id + ' · ' + (job.companyName || 'Unknown company'));

    // Work-order meta — [label, value, extra class]
    var pastDue = isPastDue(job);
    var meta = [
      ['Requested', fmtDate(job.requestedAt)],
      ['Needed by', fmtDate(job.neededBy) + (pastDue ? ' · past due' : ''), pastDue ? 'vp-overdue' : ''],
      ['Est. ship', fmtDate(job.estimatedShipDate)],
      ['Transfer type', job.transferType || '—'],
      ['Fabric', job.fabricTarget || '—'],
      ['# Colors', job.colorCount != null ? job.colorCount : '—'],
      ['Primary color', job.primaryColor || '—'],
      ['Additional colors', job.additionalColors || '—'],
    ];
    $('vp-d-meta').innerHTML = meta.map(function (m) {
      return '<div><dt>' + esc(m[0]) + '</dt><dd' + (m[2] ? ' class="' + m[2] + '"' : '') + '>' + esc(m[1]) + '</dd></div>';
    }).join('');

    var instr = [job.specialInstructions, job.fileNotes].filter(Boolean).join('\n\n');
    $('vp-d-instructions').hidden = !instr;
    if (instr) {
      $('vp-d-instructions').innerHTML = '<strong><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Instructions:</strong> ' + esc(instr);
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
        ? '<img class="vp-file-thumb" src="' + esc(f.thumbnailUrl) + '" alt="" loading="lazy" data-onerror="file-thumb">'
        : '<div class="vp-file-icon"><i class="fas ' + fileIcon(f.mime, f.fileName) + '" aria-hidden="true"></i></div>';
      var typeClass = f.fileType === 'mockup' ? ' vp-file-type--mockup' : '';
      return '<div class="vp-file">' +
        thumb +
        '<div class="vp-file-info">' +
          '<div class="vp-file-name" title="' + esc(f.fileName || 'file') + '">' + esc(f.fileName || 'file') + '</div>' +
          '<div class="vp-file-meta">' +
            '<span class="vp-file-type' + typeClass + '">' + esc(f.fileType || 'file') + '</span>' +
            (dims.length ? '<span>' + esc(dims.join(' ')) + '</span>' : '') +
            (f.notes ? '<span>' + esc(f.notes) + '</span>' : '') +
          '</div>' +
        '</div>' +
        (f.fileUrl
          ? '<a class="vp-btn vp-btn--primary" href="' + esc(f.fileUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Download ' + esc(f.fileName || 'file') + '"><i class="fas fa-download" aria-hidden="true"></i> Download</a>'
          : '') +
      '</div>';
    }).join('');

    // Mockup hero (first mockup-type file with a viewable URL)
    var mockup = files.filter(function (f) { return f.fileType === 'mockup' && (f.thumbnailUrl || f.fileUrl); })[0];
    $('vp-d-mockup').innerHTML = mockup
      ? '<a href="' + esc(mockup.fileUrl || mockup.thumbnailUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Open mockup full size">' +
          '<img class="vp-mockup-img" src="' + esc(mockup.thumbnailUrl || mockup.fileUrl) + '" alt="Mockup for ' + esc(job.companyName || job.id) + '" data-onerror="mockup"></a>'
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

  function openJob(id, fromHistory) {
    state.currentJobId = id;
    state.lastCardId = id;
    var hash = '#job=' + encodeURIComponent(id);
    if (!fromHistory && location.hash !== hash) history.pushState(null, '', hash);
    $('vp-list-view').hidden = true;
    $('vp-detail-view').hidden = false;
    $('vp-detail-main').hidden = true;
    $('vp-detail-loading').hidden = false;
    clearError();
    apiGet('/api/vendor/jobs/' + encodeURIComponent(id)).then(function (data) {
      if (state.currentJobId !== id) return;   // user already moved on
      $('vp-detail-loading').hidden = true;
      $('vp-detail-main').hidden = false;
      renderDetail(data);
      $('vp-d-company').focus();
    }).catch(function (e) {
      if (e.message === 'signed out') return;
      $('vp-detail-loading').hidden = true;
      var msg = e.status === 404
        ? 'This job is no longer available to you — it may have been removed or reassigned. Go back to All jobs.'
        : (e.serverMessage || 'Unable to load this job right now.');
      showError(msg, e.status === 404 ? null : function () { openJob(id, true); });
      console.error('[vendor-portal] job detail failed:', e);
    });
  }

  function postComment() {
    var input = $('vp-comment-input');
    var note = (input.value || '').trim();
    if (!state.currentJobId) return;
    if (!note) { input.focus(); return; }
    var btn = $('vp-comment-btn');
    var jobId = state.currentJobId;
    btn.disabled = true;
    btn.textContent = 'Posting…';
    fetch('/api/vendor/jobs/' + encodeURIComponent(jobId) + '/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ note: note }),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      input.value = '';
      $('vp-comment-status').textContent = 'Posted — NWCA will see it on the job.';
      $('vp-comment-status').hidden = false;
      openJob(jobId, true); // reload to show the new note
    }).catch(function (e) {
      showError('Unable to post your note right now. Your text is still in the box — please try again.', function () { postComment(); });
      console.error('[vendor-portal] note post failed:', e);
    }).finally(function () {
      btn.innerHTML = '<i class="fas fa-paper-plane" aria-hidden="true"></i> Post';
      btn.disabled = !(input.value || '').trim();
    });
  }

  // ── wiring ────────────────────────────────────────────────
  $('vp-filters').addEventListener('click', function (e) {
    var chip = e.target.closest('.vp-chip');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    document.querySelectorAll('.vp-chip').forEach(function (c) {
      var on = c === chip;
      c.classList.toggle('vp-chip--active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
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
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.vp-job-card');
    if (!card) return;
    e.preventDefault();
    openJob(card.dataset.job);
  });
  $('vp-back-btn').addEventListener('click', function () { showListView(false); });
  $('vp-error-retry').addEventListener('click', function () { var fn = state.retry; clearError(); if (fn) fn(); });
  $('vp-comment-btn').addEventListener('click', postComment);
  $('vp-comment-input').addEventListener('input', function (e) {
    $('vp-comment-btn').disabled = !(e.target.value || '').trim();
    $('vp-comment-status').hidden = true;
  });
  $('vp-comment-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); postComment(); }
  });
  // Esc anywhere outside a field = back to the list.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || $('vp-detail-view').hidden) return;
    var t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
    showListView(false);
  });
  // Browser Back/Forward walks list ↔ job.
  window.addEventListener('popstate', function () {
    var m = location.hash.match(/^#job=(.+)$/);
    if (m) openJob(decodeURIComponent(m[1]), true);
    else if (state.currentJobId) showListView(true);
  });

  // Boot: load list, then honor a #job= deep link.
  loadJobs();
  var m = location.hash.match(/^#job=(.+)$/);
  if (m) openJob(decodeURIComponent(m[1]), true);
})();
