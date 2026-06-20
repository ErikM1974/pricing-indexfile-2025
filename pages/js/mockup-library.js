/* ============================================================
   Saved Mockups library
   Lists every art request that has a Rep_Mockup attached by the
   Shirt Designer, so an AE can find, re-open, and re-send a
   previously-cleaned mockup instead of re-cleaning the logo.
   Reads existing data only — no new Caspio table.
   ============================================================ */
(function () {
  'use strict';

  var API_BASE = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

  var $ = function (id) { return document.getElementById(id); };
  var allRows = [];

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function show(id, on) { var el = $(id); if (el) el.style.display = on ? '' : 'none'; }

  function fmtDate(s) {
    if (!s) return '';
    try { var d = new Date(s); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString(); } catch (e) { return ''; }
  }

  function parseMeta(row) {
    try { return row.Rep_Mockup_Meta ? (JSON.parse(row.Rep_Mockup_Meta) || {}) : {}; }
    catch (e) { return {}; }
  }

  function load() {
    show('ml-loading', true); show('ml-error', false); show('ml-empty', false);
    var url = API_BASE + '/api/artrequests?repMockup=true'
      + '&select=' + encodeURIComponent('ID_Design,CompanyName,Rep_Mockup,Rep_Mockup_Meta,Date_Created,Status')
      + '&orderBy=' + encodeURIComponent('Date_Created DESC')
      + '&limit=500';
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('Server returned ' + r.status); return r.json(); })
      .then(function (data) {
        var rows = Array.isArray(data) ? data : (data && (data.Result || data.data)) || [];
        // Defensive: keep only rows that really have a mockup URL.
        allRows = rows.filter(function (x) { return x && x.Rep_Mockup && String(x.Rep_Mockup).trim(); });
        show('ml-loading', false);
        if (!allRows.length) { show('ml-empty', true); $('ml-count').textContent = ''; return; }
        render(allRows);
      })
      .catch(function (err) {
        // Never silently fail — show the error (Erik's #1 rule).
        show('ml-loading', false);
        var el = $('ml-error');
        el.textContent = 'Could not load saved mockups: ' + (err && err.message ? err.message : 'unknown error') + '. Please refresh.';
        show('ml-error', true);
        console.error('[mockup-library] load failed:', err);
      });
  }

  function render(rows) {
    var grid = $('ml-grid');
    $('ml-count').textContent = rows.length + ' mockup' + (rows.length === 1 ? '' : 's');
    grid.innerHTML = rows.map(cardHtml).join('');
    // wire lightbox + lazy nicety
    grid.querySelectorAll('.ml-card-img').forEach(function (el) {
      el.addEventListener('click', function () { openLightbox(el.getAttribute('data-full')); });
    });
  }

  function cardHtml(row) {
    var meta = parseMeta(row);
    var id = row.ID_Design;
    var img = String(row.Rep_Mockup);
    var company = row.CompanyName || '(no company)';
    var chips = [];
    if (meta.garmentName) chips.push(escapeHtml(meta.garmentName));
    if (meta.placement) chips.push(escapeHtml(meta.placement));
    if (meta.printWidthIn) chips.push(escapeHtml(meta.printWidthIn) + '&quot; wide');
    if (meta.threads && meta.threads.length) chips.push(meta.threads.length + ' thread' + (meta.threads.length === 1 ? '' : 's'));

    // Re-open the designer pre-seeded (garment color + placement + the request).
    var designerUrl = '/pages/garment-designer.html?designId=' + encodeURIComponent(id)
      + '&company=' + encodeURIComponent(company)
      + (meta.garmentName ? '&garmentName=' + encodeURIComponent(meta.garmentName) : '')
      + (meta.placement ? '&placement=' + encodeURIComponent(meta.placement) : '');
    var requestUrl = '/art-request/' + encodeURIComponent(id);

    return '<div class="ml-card">'
      + '<div class="ml-card-img" data-full="' + escapeHtml(img) + '" title="Click to enlarge">'
      + '<img loading="lazy" src="' + escapeHtml(img) + '" alt="Mockup for ' + escapeHtml(company) + '"></div>'
      + '<div class="ml-card-body">'
      + '<div class="ml-card-company">' + escapeHtml(company) + '</div>'
      + '<div class="ml-card-meta">Design #' + escapeHtml(id) + (fmtDate(row.Date_Created) ? ' · ' + escapeHtml(fmtDate(row.Date_Created)) : '') + '</div>'
      + (chips.length ? '<div class="ml-card-chips">' + chips.map(function (c) { return '<span class="ml-chip">' + c + '</span>'; }).join('') + '</div>' : '')
      + '</div>'
      + '<div class="ml-card-actions">'
      + '<a class="ml-btn primary" href="' + designerUrl + '">Open in Designer</a>'
      + '<a class="ml-btn" href="' + requestUrl + '">Open Request</a>'
      + '</div>'
      + '</div>';
  }

  // Pure search predicate (unit-tested): case-insensitive match on company + design#.
  function filterRows(rows, q) {
    q = String(q == null ? '' : q).trim().toLowerCase();
    if (!q) return (rows || []).slice();
    return (rows || []).filter(function (r) {
      return (String(r.CompanyName || '').toLowerCase().indexOf(q) > -1)
        || (String(r.ID_Design || '').toLowerCase().indexOf(q) > -1);
    });
  }
  function applySearch() {
    var q = ($('ml-search').value || '').trim();
    var filtered = filterRows(allRows, q);
    render(filtered);
    if (q && !filtered.length) { $('ml-grid').innerHTML = '<div class="ml-state">No mockups match &ldquo;' + escapeHtml(q.toLowerCase()) + '&rdquo;.</div>'; }
  }

  function openLightbox(src) {
    if (!src) return;
    $('ml-lightbox-img').src = src;
    $('ml-lightbox').classList.add('open');
  }
  function closeLightbox() { $('ml-lightbox').classList.remove('open'); $('ml-lightbox-img').src = ''; }

  // DOM wiring only runs in the browser; skipped under Node (Jest) so the pure
  // helpers below can be require()d for unit tests.
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      load();
      var s = $('ml-search');
      var t = null;
      if (s) s.addEventListener('input', function () { clearTimeout(t); t = setTimeout(applySearch, 180); });
      $('ml-lightbox-close').addEventListener('click', closeLightbox);
      $('ml-lightbox').addEventListener('click', function (e) { if (e.target === $('ml-lightbox')) closeLightbox(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });
    });
  }

  // Expose pure helpers for unit testing.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseMeta: parseMeta, escapeHtml: escapeHtml, filterRows: filterRows };
  }
})();
