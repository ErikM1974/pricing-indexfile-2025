/* ==========================================================================
   sanmar-shopworks-converter.js — controller for the SanMar → ShopWorks Parts
   converter admin page. Reads a file locally (PapaParse for CSV streaming,
   SheetJS for XLSX), runs the pure transform in sanmar-shopworks-parts.js, and
   downloads the ShopWorks-import CSV. Nothing is uploaded — the file stays in
   the browser (handles the big raw feed without a server round-trip).
   Depends on globals: SanmarShopworksParts, Papa, XLSX, SKUValidationService.
   ========================================================================== */
(function () {
  'use strict';
  var SW = window.SanmarShopworksParts;

  var el = function (id) { return document.getElementById(id); };
  var fileInput = el('sw-file'), fileName = el('sw-file-name');
  var btnConvert = el('sw-convert'), btnDownload = el('sw-download'), btnReset = el('sw-reset');
  var statusEl = el('sw-status'), resultsEl = el('sw-results'), errEl = el('sw-error');
  var statOut = el('sw-stat-out'), statIn = el('sw-stat-in'), statFmt = el('sw-stat-fmt');
  var previewBody = el('sw-preview-body');

  var converted = null; // {rows, cols}

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function show(node, on) { if (node) node.style.display = on ? '' : 'none'; }
  function setStatus(html) { statusEl.innerHTML = html || ''; }
  function fail(msg) { show(statusEl, false); errEl.textContent = msg; show(errEl, true); btnConvert.disabled = false; }

  fileInput.addEventListener('change', function () {
    converted = null; show(resultsEl, false); show(errEl, false);
    if (this.files.length) {
      var f = this.files[0];
      fileName.textContent = f.name + '  (' + (f.size / 1048576).toFixed(1) + ' MB)';
      btnConvert.disabled = false;
    } else { fileName.textContent = 'No file selected'; btnConvert.disabled = true; }
  });

  btnConvert.addEventListener('click', function () {
    if (!fileInput.files.length) return;
    var file = fileInput.files[0];
    show(resultsEl, false); show(errEl, false);
    setStatus('<i class="fas fa-rotate sw-spin"></i> Reading file…'); show(statusEl, true);
    btnConvert.disabled = true;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'xlsx' || ext === 'xls') convertExcel(file);
      else convertCsv(file);
    } catch (e) { fail(e.message || String(e)); }
  });

  function convertCsv(file) {
    var fmt = null, headerFields = null, acc = null, intRows = [];
    window.Papa.parse(file, {
      header: true, skipEmptyLines: 'greedy',
      step: function (res) {
        if (!fmt) {
          headerFields = (res.meta && res.meta.fields) || Object.keys(res.data || {});
          fmt = SW.detectFormat(headerFields);
          if (fmt === 'raw') acc = new SW.RawAccumulator();
        }
        if (fmt === 'raw') acc.add(res.data);
        else intRows.push(res.data);
      },
      complete: function () {
        try {
          if (fmt === 'raw') finish(acc.result(), acc.seen, 'raw');
          else if (fmt === 'integration') finish(SW.fixupRows(intRows, headerFields), intRows.length, 'integration');
          else fail('Unrecognized file. Expected a ShopWorks integration price list (ID_Product…) or a raw SanMar feed (STYLE, SIZE, PIECE_PRICE).');
        } catch (e) { fail(e.message || String(e)); }
      },
      error: function (e) { fail('Could not read the CSV: ' + (e && e.message ? e.message : e)); }
    });
  }

  function convertExcel(file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        setStatus('<i class="fas fa-rotate sw-spin"></i> Parsing spreadsheet…');
        var wb = window.XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (!rows.length) return fail('The spreadsheet has no data rows.');
        var headerFields = Object.keys(rows[0]);
        var fmt = SW.detectFormat(headerFields);
        if (fmt === 'integration') finish(SW.fixupRows(rows, headerFields), rows.length, 'integration');
        else if (fmt === 'raw') finish(SW.fullConvertRows(rows), rows.length, 'raw');
        else fail('Unrecognized spreadsheet. Expected a ShopWorks integration price list (ID_Product…) or a raw SanMar feed (STYLE, SIZE, PIECE_PRICE).');
      } catch (e) { fail(e.message || String(e)); }
    };
    reader.onerror = function () { fail('Could not read the spreadsheet file.'); };
    reader.readAsArrayBuffer(file);
  }

  function finish(out, inputCount, fmt) {
    converted = out;
    show(statusEl, false);
    statIn.textContent = Number(inputCount || 0).toLocaleString();
    statOut.textContent = Number(out.rows.length).toLocaleString();
    statFmt.textContent = fmt === 'raw' ? 'Raw SanMar feed → full conversion' : 'ShopWorks integration list → fixup';
    renderPreview(out.rows.slice(0, 12));
    show(resultsEl, true);
    btnConvert.disabled = false;
  }

  function renderPreview(rows) {
    previewBody.innerHTML = rows.map(function (r) {
      var lim = ['sts_LimitSize01', 'sts_LimitSize02', 'sts_LimitSize03', 'sts_LimitSize04', 'sts_LimitSize05', 'sts_LimitSize06']
        .map(function (k) { return String(r[k]) === '1' ? '1' : '·'; }).join('');
      return '<tr><td class="sw-mono">' + esc(r.ID_Product) + '</td><td>' + esc(r.Description) +
        '</td><td class="sw-num">' + esc(r.Price_Unit_Piece) + '</td><td class="sw-num">' + esc(r.Price_Unit_Case) +
        '</td><td class="sw-mono sw-dim">' + lim + '</td></tr>';
    }).join('');
  }

  btnDownload.addEventListener('click', function () {
    if (!converted || !converted.rows.length) return;
    var csv = SW.toCsv(converted.rows, converted.cols);
    var blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'Shopworks_Import_Converted.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  btnReset.addEventListener('click', function () {
    fileInput.value = ''; fileName.textContent = 'No file selected';
    btnConvert.disabled = true; converted = null;
    show(resultsEl, false); show(errEl, false); show(statusEl, false);
  });
})();
