(function () {
  'use strict';

  var API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

  var styleInput = document.getElementById('style-input');
  var runBtn = document.getElementById('run-btn');
  var runStatus = document.getElementById('run-status');

  var summaryEl = document.getElementById('summary');
  var metaEl = document.getElementById('meta');

  var lastResult = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statusBadge(status) {
    var s = String(status || '').toLowerCase();
    if (s === 'active') return '<span class="badge badge-active">Active</span>';
    if (s.indexOf('discontin') !== -1 || s.indexOf('closeout') !== -1) {
      return '<span class="badge badge-discontinued">' + escapeHtml(status) + '</span>';
    }
    if (!status) return '<span class="badge badge-other muted">—</span>';
    return '<span class="badge badge-other">' + escapeHtml(status) + '</span>';
  }

  function renderTable(tableEl, headers, rows) {
    var thead = '<thead><tr>' + headers.map(function (h) {
      return '<th>' + escapeHtml(h) + '</th>';
    }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + rows.map(function (cols) {
      return '<tr>' + cols.map(function (c) {
        if (c && typeof c === 'object' && 'html' in c) {
          return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + c.html + '</td>';
        }
        return '<td>' + escapeHtml(c) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    tableEl.innerHTML = thead + tbody;
  }

  function showBucket(id, count) {
    document.getElementById(id).hidden = count === 0;
  }

  function setStatus(msg, isError) {
    runStatus.textContent = msg;
    runStatus.className = 'status' + (isError ? ' error' : '');
  }

  function fmtSizes(sizes) {
    if (!sizes || !sizes.length) return '';
    return sizes.join(', ');
  }

  function render(result) {
    lastResult = result;

    document.getElementById('sum-sync').textContent       = result.inSync.count;
    document.getElementById('sum-mismatch').textContent   = result.caspioMismatch.count;
    document.getElementById('sum-orphan').textContent     = result.caspioOrphan.count;
    document.getElementById('sum-sanmar-only').textContent = result.sanmarOnly.count;
    document.getElementById('sum-drift').textContent      = result.internalDrift.count;
    summaryEl.hidden = false;

    document.getElementById('meta-style').textContent = result.style;
    document.getElementById('meta-caspio-rows').textContent = result.caspioRowsFetched;
    document.getElementById('meta-caspio-colors').textContent = result.caspioColorsUnique;
    document.getElementById('meta-sanmar-colors').textContent = result.sanmarColors;
    document.getElementById('meta-generated').textContent = new Date(result.generatedAt).toLocaleString();
    var apiErr = document.getElementById('meta-api-error');
    if (result.sanmarApiError) {
      apiErr.hidden = false;
      apiErr.textContent = 'SanMar API error: ' + result.sanmarApiError;
    } else {
      apiErr.hidden = true;
    }
    metaEl.hidden = false;

    // Mismatches (the actionable bucket)
    document.getElementById('cnt-mismatch').textContent = result.caspioMismatch.count;
    renderTable(
      document.getElementById('tbl-mismatch'),
      ['COLOR_NAME', 'Caspio CATALOG_COLOR', 'Caspio SANMAR_MAINFRAME_COLOR', 'SanMar live mainframeColor', 'SanMar status', 'Sizes'],
      result.caspioMismatch.rows.map(function (r) {
        return [
          r.colorName,
          { html: '<span class="mono diff-bad">' + escapeHtml(r.caspioCatalogColor || '—') + '</span>', cls: 'mono' },
          { html: '<span class="mono">' + escapeHtml(r.caspioMainframeColor || '—') + '</span>', cls: 'mono' },
          { html: '<span class="mono diff-good">' + escapeHtml(r.sanmarMainframeColor) + '</span>', cls: 'mono' },
          { html: statusBadge(r.sanmarProductStatus) },
          { html: '<span class="muted">' + escapeHtml(fmtSizes(r.sizes)) + '</span>' }
        ];
      })
    );
    showBucket('bkt-mismatch', result.caspioMismatch.count);

    // Internal drift
    document.getElementById('cnt-drift').textContent = result.internalDrift.count;
    renderTable(
      document.getElementById('tbl-drift'),
      ['COLOR_NAME', 'CATALOG_COLOR', 'SANMAR_MAINFRAME_COLOR', 'PRODUCT_STATUS', 'Sizes'],
      result.internalDrift.rows.map(function (r) {
        return [
          r.colorName,
          { html: '<span class="mono">' + escapeHtml(r.caspioCatalogColor || '—') + '</span>', cls: 'mono' },
          { html: '<span class="mono">' + escapeHtml(r.caspioMainframeColor || '—') + '</span>', cls: 'mono' },
          { html: statusBadge(r.productStatus) },
          { html: '<span class="muted">' + escapeHtml(fmtSizes(r.sizes)) + '</span>' }
        ];
      })
    );
    showBucket('bkt-drift', result.internalDrift.count);

    // Caspio orphans
    document.getElementById('cnt-orphan').textContent = result.caspioOrphan.count;
    renderTable(
      document.getElementById('tbl-orphan'),
      ['COLOR_NAME', 'CATALOG_COLOR', 'SANMAR_MAINFRAME_COLOR', 'Caspio PRODUCT_STATUS', 'Sizes'],
      result.caspioOrphan.rows.map(function (r) {
        return [
          r.colorName,
          { html: '<span class="mono">' + escapeHtml(r.caspioCatalogColor || '—') + '</span>', cls: 'mono' },
          { html: '<span class="mono">' + escapeHtml(r.caspioMainframeColor || '—') + '</span>', cls: 'mono' },
          { html: statusBadge(r.productStatus) },
          { html: '<span class="muted">' + escapeHtml(fmtSizes(r.sizes)) + '</span>' }
        ];
      })
    );
    showBucket('bkt-orphan', result.caspioOrphan.count);

    // SanMar only
    document.getElementById('cnt-sanmaronly').textContent = result.sanmarOnly.count;
    renderTable(
      document.getElementById('tbl-sanmaronly'),
      ['SanMar displayName', 'mainframeColor', 'productStatus', 'Sizes'],
      result.sanmarOnly.rows.map(function (r) {
        return [
          r.colorName,
          { html: '<span class="mono">' + escapeHtml(r.sanmarMainframeColor) + '</span>', cls: 'mono' },
          { html: statusBadge(r.sanmarProductStatus) },
          { html: '<span class="muted">' + escapeHtml(fmtSizes(r.sizes)) + '</span>' }
        ];
      })
    );
    showBucket('bkt-sanmaronly', result.sanmarOnly.count);

    // In sync
    document.getElementById('cnt-sync').textContent = result.inSync.count;
    renderTable(
      document.getElementById('tbl-sync'),
      ['COLOR_NAME', 'Caspio CATALOG_COLOR', 'Caspio SANMAR_MAINFRAME_COLOR', 'SanMar mainframeColor'],
      result.inSync.rows.map(function (r) {
        return [
          r.colorName,
          { html: '<span class="mono">' + escapeHtml(r.caspioCatalogColor || '—') + '</span>', cls: 'mono' },
          { html: '<span class="mono">' + escapeHtml(r.caspioMainframeColor || '—') + '</span>', cls: 'mono' },
          { html: '<span class="mono diff-good">' + escapeHtml(r.sanmarMainframeColor) + '</span>', cls: 'mono' }
        ];
      })
    );
    showBucket('bkt-sync', result.inSync.count);

    setStatus('Loaded ' + result.caspioRowsFetched + ' Caspio rows + ' + result.sanmarColors + ' SanMar colors.', false);
  }

  function tsv(headers, rows) {
    var out = headers.join('\t') + '\n';
    out += rows.map(function (r) {
      return r.map(function (v) {
        return String(v == null ? '' : v).replace(/\t/g, ' ').replace(/\n/g, ' ');
      }).join('\t');
    }).join('\n');
    return out;
  }

  function copyForBucket(target) {
    if (!lastResult) return null;
    if (target === 'mismatch') {
      return tsv(
        ['COLOR_NAME', 'Caspio_CATALOG_COLOR', 'Caspio_SANMAR_MAINFRAME_COLOR', 'SanMar_mainframeColor', 'SanMar_status', 'Sizes'],
        lastResult.caspioMismatch.rows.map(function (r) {
          return [r.colorName, r.caspioCatalogColor, r.caspioMainframeColor, r.sanmarMainframeColor, r.sanmarProductStatus, fmtSizes(r.sizes)];
        })
      );
    }
    if (target === 'drift') {
      return tsv(
        ['COLOR_NAME', 'CATALOG_COLOR', 'SANMAR_MAINFRAME_COLOR', 'PRODUCT_STATUS', 'Sizes'],
        lastResult.internalDrift.rows.map(function (r) {
          return [r.colorName, r.caspioCatalogColor, r.caspioMainframeColor, r.productStatus, fmtSizes(r.sizes)];
        })
      );
    }
    if (target === 'orphan') {
      return tsv(
        ['COLOR_NAME', 'CATALOG_COLOR', 'SANMAR_MAINFRAME_COLOR', 'PRODUCT_STATUS', 'Sizes'],
        lastResult.caspioOrphan.rows.map(function (r) {
          return [r.colorName, r.caspioCatalogColor, r.caspioMainframeColor, r.productStatus, fmtSizes(r.sizes)];
        })
      );
    }
    if (target === 'sanmaronly') {
      return tsv(
        ['displayName', 'mainframeColor', 'productStatus', 'Sizes'],
        lastResult.sanmarOnly.rows.map(function (r) {
          return [r.colorName, r.sanmarMainframeColor, r.sanmarProductStatus, fmtSizes(r.sizes)];
        })
      );
    }
    return null;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.copy-btn');
    if (!btn) return;
    var target = btn.getAttribute('data-target');
    var text = copyForBucket(target);
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.classList.add('copied');
      btn.textContent = 'Copied!';
      setTimeout(function () {
        btn.classList.remove('copied');
        btn.textContent = orig;
      }, 1400);
    });
  });

  async function runAudit() {
    var style = (styleInput.value || '').trim().toUpperCase();
    if (!style) { setStatus('Enter a style first.', true); return; }
    runBtn.disabled = true;
    setStatus('Fetching Caspio + SanMar live data…', false);

    try {
      var resp = await fetch(API_BASE + '/api/sanmar/catalog-color-audit/' + encodeURIComponent(style));
      if (!resp.ok) {
        var msg = 'API error ' + resp.status;
        try { var j = await resp.json(); if (j && j.error) msg = j.error + (j.details ? ' (' + j.details + ')' : ''); } catch (_) {}
        throw new Error(msg);
      }
      var data = await resp.json();
      render(data);
    } catch (err) {
      console.error('[catalog-color-audit] fetch failed:', err);
      setStatus(err.message || 'Audit failed', true);
    } finally {
      runBtn.disabled = false;
    }
  }

  runBtn.addEventListener('click', runAudit);
  styleInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') runAudit();
  });

  // Auto-run for style 112 on first load (per plan: pre-fill + show results)
  runAudit();
})();
