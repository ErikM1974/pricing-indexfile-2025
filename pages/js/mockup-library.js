/* Saved Mockups: existing art-request records, shared controls and keyboard image preview. */
(function () {
  'use strict';
  var API_BASE = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
  if (!API_BASE) console.error('[mockup-library] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');
  var $ = function (id) { return document.getElementById(id); };
  var allRows = [];
  var loading = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }
  function show(id, visible) { var element = $(id); if (element) element.hidden = !visible; }
  function fmtDate(value) {
    if (!value) return '';
    var text = String(value);
    var calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    var date = calendar ? new Date(Number(calendar[1]), Number(calendar[2]) - 1, Number(calendar[3])) : new Date(value);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function parseMeta(row) {
    try { return row.Rep_Mockup_Meta ? (JSON.parse(row.Rep_Mockup_Meta) || {}) : {}; }
    catch (_) { return {}; }
  }
  function imageUrl(url) { return typeof window.boxUrl === 'function' ? window.boxUrl(url) : url; }

  async function load() {
    if (loading) return;
    loading = true;
    allRows = [];
    $('ml-grid').replaceChildren();
    $('ml-count').textContent = '';
    show('ml-loading', true); show('ml-error', false); show('ml-empty', false);
    $('ml-retry').disabled = true;
    try {
      var response = await fetch(API_BASE + '/api/artrequests?repMockup=true'
        + '&select=' + encodeURIComponent('ID_Design,CompanyName,Rep_Mockup,Rep_Mockup_Meta,Date_Created,Status')
        + '&orderBy=' + encodeURIComponent('Date_Created DESC') + '&limit=500');
      if (!response.ok) throw new Error('Server returned ' + response.status);
      var data = await response.json();
      var rows = Array.isArray(data) ? data : data && (data.Result || data.data);
      if (!Array.isArray(rows)) throw new Error('The saved mockup list could not be read');
      allRows = rows.filter(function (row) { return row && row.Rep_Mockup && String(row.Rep_Mockup).trim(); });
      loading = false;
      if (!allRows.length) show('ml-empty', true);
      applySearch();
    } catch (error) {
      $('ml-error-text').textContent = 'Could not load saved mockups: ' + (error.message || 'request failed') + '. Try again.';
      show('ml-error', true);
      console.error('[mockup-library] load failed:', error);
    } finally {
      loading = false;
      show('ml-loading', false);
      $('ml-retry').disabled = false;
    }
  }

  function render(rows) {
    $('ml-count').textContent = rows.length + (rows.length !== allRows.length ? ' of ' + allRows.length : '') + ' mockup' + (allRows.length === 1 ? '' : 's');
    $('ml-grid').innerHTML = rows.map(cardHtml).join('');
  }
  function cardHtml(row) {
    var meta = parseMeta(row), id = row.ID_Design, company = row.CompanyName || '(no company)';
    var img = imageUrl(String(row.Rep_Mockup));
    var chips = [];
    if (meta.garmentName) chips.push(escapeHtml(meta.garmentName));
    if (meta.placement) chips.push(escapeHtml(meta.placement));
    if (meta.printWidthIn) chips.push(escapeHtml(meta.printWidthIn) + '&quot; wide');
    if (meta.threads && meta.threads.length) chips.push(meta.threads.length + ' thread' + (meta.threads.length === 1 ? '' : 's'));
    var designerUrl = '/pages/garment-designer.html?designId=' + encodeURIComponent(id)
      + '&company=' + encodeURIComponent(company)
      + (meta.garmentName ? '&garmentName=' + encodeURIComponent(meta.garmentName) : '')
      + (meta.placement ? '&placement=' + encodeURIComponent(meta.placement) : '');
    var date = fmtDate(row.Date_Created);
    return '<article class="ml-card">'
      + '<button type="button" class="ml-card-img" data-full="' + escapeHtml(img) + '" aria-label="Preview mockup for ' + escapeHtml(company) + '">'
      + '<img loading="lazy" src="' + escapeHtml(img) + '" alt="Mockup for ' + escapeHtml(company) + '">'
      + '<span class="ml-image-unavailable" hidden>Preview unavailable</span></button>'
      + '<div class="ml-card-body"><h2 class="ml-card-company">' + escapeHtml(company) + '</h2>'
      + '<div class="ml-card-meta">Design #' + escapeHtml(id) + (date ? ' · ' + escapeHtml(date) : '') + '</div>'
      + (chips.length ? '<div class="ml-card-chips">' + chips.map(function (chip) { return '<span class="ml-chip">' + chip + '</span>'; }).join('') + '</div>' : '')
      + '</div><div class="ml-card-actions">'
      + '<a class="ml-btn btn btn-primary" href="' + designerUrl + '">Open in Designer</a>'
      + '<a class="ml-btn btn" href="/art-request/' + encodeURIComponent(id) + '">Open Request</a>'
      + '</div></article>';
  }
  function filterRows(rows, query) {
    query = String(query == null ? '' : query).trim().toLowerCase();
    if (!query) return (rows || []).slice();
    return (rows || []).filter(function (row) {
      return String(row.CompanyName || '').toLowerCase().indexOf(query) > -1
        || String(row.ID_Design || '').toLowerCase().indexOf(query) > -1;
    });
  }
  function applySearch() {
    if (loading) return;
    var query = ($('ml-search').value || '').trim();
    var filtered = filterRows(allRows, query);
    render(filtered);
    if (query && !filtered.length && allRows.length) {
      $('ml-grid').innerHTML = '<p class="ml-state">No mockups match &ldquo;' + escapeHtml(query) + '&rdquo;.</p>';
    }
  }
  function openLightbox(src) {
    if (!src) return;
    if (!window.UiDialog) {
      $('ml-error-text').textContent = 'Image preview is unavailable. Refresh the page and try again.';
      show('ml-error', true);
      return;
    }
    show('ml-lightbox-img', false);
    $('ml-lightbox-status').textContent = 'Loading preview…';
    show('ml-lightbox-status', true);
    window.UiDialog.open($('ml-lightbox'), { focus: '#ml-lightbox-close', onDismiss: closeLightbox });
    $('ml-lightbox-img').src = imageUrl(src);
  }
  function closeLightbox() {
    if (window.UiDialog) window.UiDialog.close($('ml-lightbox'));
    $('ml-lightbox-img').removeAttribute('src');
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var timer;
      $('ml-search').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(applySearch, 180); });
      $('ml-retry').addEventListener('click', load);
      $('ml-grid').addEventListener('click', function (event) {
        var button = event.target.closest('.ml-card-img');
        if (button) openLightbox(button.getAttribute('data-full'));
      });
      $('ml-grid').addEventListener('error', function (event) {
        var img = event.target;
        if (!(img instanceof HTMLImageElement)) return;
        var button = img.closest('.ml-card-img');
        if (!button) return;
        img.hidden = true;
        button.querySelector('.ml-image-unavailable').hidden = false;
        button.disabled = true;
      }, true);
      $('ml-lightbox-img').addEventListener('load', function () { show('ml-lightbox-img', true); show('ml-lightbox-status', false); });
      $('ml-lightbox-img').addEventListener('error', function () { show('ml-lightbox-img', false); $('ml-lightbox-status').textContent = 'This image could not be loaded. Close the preview and try again.'; show('ml-lightbox-status', true); });
      $('ml-lightbox-close').addEventListener('click', closeLightbox);
      $('ml-lightbox').addEventListener('click', function (event) { if (event.target === $('ml-lightbox')) closeLightbox(); });
      load();
    });
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseMeta: parseMeta, escapeHtml: escapeHtml, filterRows: filterRows, fmtDate: fmtDate };
  }
})();
