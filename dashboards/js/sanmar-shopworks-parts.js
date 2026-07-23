/* ==========================================================================
   sanmar-shopworks-parts.js — pure transform for the SanMar → ShopWorks Parts
   converter (admin dashboard). No DOM/IO here so it is unit-testable in Node
   and reusable in the browser.

   Two input paths, one output (the 17-col ShopWorks parts format):
   - FIXUP  (ShopWorks "Integration Only Price List", already ID_Product/sts_*):
       add "Size X - " to extended-size descriptions, rewrite _2XL -> _2X
       (leave ladies _XXL), tidy descriptions. Prices/limits preserved.
   - FULL   (raw SanMar feed: STYLE/STYLE#, SIZE, PIECE_PRICE, PRODUCT_TITLE):
       collapse colors -> one row per style+size (max piece price), build
       ID_Product via the app's canonical sanmarToShopWorksSKU, prices, size
       flags, size-in-description.

   Rules verified 2026-07-22 against the 15,150 existing ShopWorks parts.
   ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.SanmarShopworksParts = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The ShopWorks parts columns (matches the Integration Only Price List / existing parts).
  var OUTPUT_COLS = [
    'ID_Product', 'Description', 'ColorRange',
    'Price_Unit_Piece', 'Price_Unit_Dozen', 'Price_Unit_Case', 'Price_Unit_Special',
    'PageNumber',
    'sts_LimitSize01', 'sts_LimitSize02', 'sts_LimitSize03',
    'sts_LimitSize04', 'sts_LimitSize05', 'sts_LimitSize06',
    'BarCodeValue', 'ProductColor', 'BrandName'
  ];
  var STD = ['S', 'M', 'L', 'XL'];

  // --- SKU service resolution (node require OR browser global) -----------------
  var _skuSvc;
  function getSkuSvc() {
    if (_skuSvc !== undefined) return _skuSvc;
    _skuSvc = null;
    try {
      if (typeof module !== 'undefined' && module.exports) {
        var S = require('../../shared_components/js/sku-validation-service.js');
        _skuSvc = new S();
      } else if (typeof window !== 'undefined' && window.SKUValidationService) {
        _skuSvc = new window.SKUValidationService();
      }
    } catch (e) { _skuSvc = null; }
    return _skuSvc;
  }
  function skuFor(style, size) {
    var svc = getSkuSvc();
    if (svc && typeof svc.sanmarToShopWorksSKU === 'function') return svc.sanmarToShopWorksSKU(style, size);
    // Minimal fallback (should not happen in prod): 2XL->_2X, else _SIZE
    var sz = String(size || '').trim();
    if (STD.indexOf(sz.toUpperCase()) !== -1) return String(style);
    if (sz.toUpperCase() === '2XL') return style + '_2X';
    return style + '_' + sz.replace(/\s+/g, '');
  }

  // --- helpers ----------------------------------------------------------------
  function cleanDesc(s) {
    s = (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
    return s.replace(/\.+$/, '').trim(); // strip trailing period(s) — existing parts have none
  }
  function splitId(pn) {
    pn = String(pn == null ? '' : pn);
    var i = pn.indexOf('_');
    return i < 0 ? [pn, ''] : [pn.slice(0, i), pn.slice(i + 1)];
  }
  function isStd(size) { return STD.indexOf(String(size || '').trim().toUpperCase()) !== -1; }

  // sts_LimitSize flags: blocked = 1, allowed = '' (empty).
  // base(S/M/L/XL)= ----11 ; 2XL/XXL = 1111-1 (Size05) ; else = 11111- (Size06)
  function limits(size) {
    var sz = String(size || '').trim().toUpperCase();
    var b = { sts_LimitSize01: 1, sts_LimitSize02: 1, sts_LimitSize03: 1, sts_LimitSize04: 1, sts_LimitSize05: 1, sts_LimitSize06: 1 };
    if (STD.indexOf(sz) !== -1) { b.sts_LimitSize01 = b.sts_LimitSize02 = b.sts_LimitSize03 = b.sts_LimitSize04 = ''; }
    else if (sz === '2XL' || sz === 'XXL') { b.sts_LimitSize05 = ''; }
    else { b.sts_LimitSize06 = ''; }
    return b;
  }

  function num2(v) {
    var n = parseFloat(v);
    return isNaN(n) ? '' : n.toFixed(2);
  }

  // --- format detection -------------------------------------------------------
  function detectFormat(fields) {
    var set = {};
    (fields || []).forEach(function (h) { set[String(h).trim().toUpperCase()] = true; });
    if (set['ID_PRODUCT'] && (set['STS_LIMITSIZE01'] || set['STS_LIMITSIZE05'])) return 'integration';
    if ((set['STYLE'] || set['STYLE#']) && set['SIZE'] && set['PIECE_PRICE']) return 'raw';
    return 'unknown';
  }

  // --- FIXUP path (integration list) -----------------------------------------
  function fixupRow(row) {
    var out = {};
    for (var k in row) if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
    var parts = splitId(row.ID_Product);
    var style = parts[0], suf = parts[1];
    var base = cleanDesc(row.Description);
    if (suf === '') { out.Description = base; return out; }
    var newSuf, disp;
    if (suf === '2XL') { newSuf = '2X'; disp = '2XL'; }
    else if (suf === 'XXL') { newSuf = 'XXL'; disp = 'XXL'; }
    else { newSuf = suf; disp = suf; }
    out.ID_Product = style + '_' + newSuf;
    out.Description = 'Size ' + disp + ' - ' + base;
    return out;
  }
  function fixupRows(rows, inputCols) {
    var cols = (inputCols && inputCols.length) ? inputCols.slice()
      : (rows[0] ? Object.keys(rows[0]) : OUTPUT_COLS.slice());
    return { rows: rows.map(fixupRow), cols: cols };
  }

  // --- FULL conversion path (raw SanMar feed) --------------------------------
  function cleanRawDescription(title, style, size) {
    var s = (title == null ? '' : String(title)).trim();
    style = String(style || '').trim();
    if (style && s.toUpperCase().slice(-style.length) === style.toUpperCase()) {
      s = s.slice(0, s.length - style.length);
    }
    s = cleanDesc(s);
    var sz = String(size || '').trim();
    if (sz && !isStd(sz)) s = 'Size ' + sz + ' - ' + s;
    return s;
  }

  // Streaming-friendly accumulator: feed raw rows one at a time, then .result().
  function RawAccumulator(opts) {
    opts = opts || {};
    var skuFn = opts.skuFn || skuFor;
    var map = new Map();
    this.seen = 0;
    this.add = function (row) {
      this.seen++;
      var style = String(row.STYLE || row['STYLE#'] || '').trim();
      if (!style) return;
      var size = String(row.SIZE || '').trim();
      var piece = parseFloat(row.PIECE_PRICE);
      if (isNaN(piece) || piece <= 0) return; // skip blank/zero-price rows
      var id = skuFn(style, size);
      var prev = map.get(id);
      if (prev && piece <= prev._piece) return; // keep the max piece price (standard, not closeout)
      var lim = limits(size);
      map.set(id, {
        ID_Product: id,
        Description: cleanRawDescription(row.PRODUCT_TITLE, style, size),
        ColorRange: '',
        Price_Unit_Piece: piece.toFixed(2),
        Price_Unit_Dozen: piece.toFixed(2), // ShopWorks convention: Dozen = Piece
        Price_Unit_Case: num2(row.CASE_PRICE),
        Price_Unit_Special: '',
        PageNumber: '',
        sts_LimitSize01: lim.sts_LimitSize01, sts_LimitSize02: lim.sts_LimitSize02,
        sts_LimitSize03: lim.sts_LimitSize03, sts_LimitSize04: lim.sts_LimitSize04,
        sts_LimitSize05: lim.sts_LimitSize05, sts_LimitSize06: lim.sts_LimitSize06,
        BarCodeValue: '',
        ProductColor: '',
        BrandName: row.BRAND_NAME || row.MILL || '',
        _piece: piece
      });
    };
    this.result = function () {
      var rows = [];
      map.forEach(function (r) { var c = {}; for (var k in r) if (k !== '_piece') c[k] = r[k]; rows.push(c); });
      return { rows: rows, cols: OUTPUT_COLS.slice() };
    };
  }
  function fullConvertRows(rows, opts) {
    var acc = new RawAccumulator(opts);
    (rows || []).forEach(function (r) { acc.add(r); });
    return acc.result();
  }

  // --- CSV output -------------------------------------------------------------
  function csvVal(v) {
    if (v == null) return '';
    v = String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function toCsv(rows, cols) {
    var lines = [cols.map(csvVal).join(',')];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      lines.push(cols.map(function (c) { return csvVal(r[c]); }).join(','));
    }
    return lines.join('\r\n');
  }

  return {
    OUTPUT_COLS: OUTPUT_COLS,
    detectFormat: detectFormat,
    cleanDesc: cleanDesc,
    splitId: splitId,
    limits: limits,
    fixupRow: fixupRow,
    fixupRows: fixupRows,
    cleanRawDescription: cleanRawDescription,
    RawAccumulator: RawAccumulator,
    fullConvertRows: fullConvertRows,
    toCsv: toCsv
  };
});
