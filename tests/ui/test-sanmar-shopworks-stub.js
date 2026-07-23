/* Harness stub: verifies the vendored libs + SKU service + transform module all
   load in the browser, runs a live sample conversion (fixup + full paths), and
   renders the styled result so it can be screenshotted. External file (CSP). */
(function () {
  var SW = window.SanmarShopworksParts;
  var libs = {
    Papa: typeof window.Papa !== 'undefined',
    XLSX: typeof window.XLSX !== 'undefined',
    SanmarShopworksParts: !!SW,
    SKUValidationService: typeof window.SKUValidationService !== 'undefined'
  };
  document.getElementById('sw-libcheck').textContent = 'libs loaded → ' + JSON.stringify(libs);
  if (!SW) return;

  var intRows = [
    { ID_Product: '29M', Description: 'Jerzees -  Dri-Power 50/50 Cotton/Poly T-Shirt.', Price_Unit_Piece: '4.12', Price_Unit_Case: '3.12', sts_LimitSize05: 1, sts_LimitSize06: 1 },
    { ID_Product: '29M_2XL', Description: 'Jerzees -  Dri-Power 50/50 Cotton/Poly T-Shirt.', Price_Unit_Piece: '5.91', Price_Unit_Case: '4.91', sts_LimitSize01: 1, sts_LimitSize02: 1, sts_LimitSize03: 1, sts_LimitSize04: 1, sts_LimitSize06: 1 },
    { ID_Product: 'L500_XXL', Description: "Port Authority Women's Silk Touch Polo.", Price_Unit_Piece: '20.00', Price_Unit_Case: '18.00', sts_LimitSize01: 1, sts_LimitSize02: 1, sts_LimitSize03: 1, sts_LimitSize04: 1, sts_LimitSize06: 1 }
  ];
  var fixup = SW.fixupRows(intRows, Object.keys(intRows[0]));
  var full = SW.fullConvertRows([
    { STYLE: 'PC54', SIZE: '2XL', PIECE_PRICE: '5.50', CASE_PRICE: '4.50', PRODUCT_TITLE: 'Port & Company Core Cotton Tee PC54' },
    { STYLE: 'PC54', SIZE: 'M', PIECE_PRICE: '3.50', CASE_PRICE: '3.00', PRODUCT_TITLE: 'Port & Company Core Cotton Tee PC54' }
  ]);
  var all = fixup.rows.concat(full.rows);

  document.getElementById('sw-stat-in').textContent = '5';
  document.getElementById('sw-stat-out').textContent = String(all.length);
  document.getElementById('sw-stat-fmt').textContent = 'demo: fixup + full conversion';
  document.getElementById('sw-preview-body').innerHTML = all.map(function (r) {
    var lim = ['sts_LimitSize01', 'sts_LimitSize02', 'sts_LimitSize03', 'sts_LimitSize04', 'sts_LimitSize05', 'sts_LimitSize06']
      .map(function (k) { return String(r[k]) === '1' ? '1' : '·'; }).join('');
    return '<tr><td class="sw-mono">' + r.ID_Product + '</td><td>' + r.Description + '</td><td class="sw-num">' + r.Price_Unit_Piece + '</td><td class="sw-num">' + r.Price_Unit_Case + '</td><td class="sw-mono sw-dim">' + lim + '</td></tr>';
  }).join('');
  document.getElementById('sw-results').style.display = '';
})();
