/* Parity tests for the SanMar → ShopWorks Parts transform.
   Rules verified 2026-07-22 against the 15,150 existing ShopWorks parts
   (Downloads/How to format the shopworks parts.csv) + the 07-14-26 integration list. */
const SW = require('../../dashboards/js/sanmar-shopworks-parts.js');

describe('detectFormat', () => {
  test('integration list (ID_Product + sts_LimitSize)', () => {
    expect(SW.detectFormat(['ID_Product', 'Description', 'Price_Unit_Piece', 'sts_LimitSize05'])).toBe('integration');
  });
  test('raw SanMar feed (STYLE + SIZE + PIECE_PRICE)', () => {
    expect(SW.detectFormat(['UNIQUE_KEY', 'STYLE', 'SIZE', 'PIECE_PRICE', 'COLOR_NAME'])).toBe('raw');
    expect(SW.detectFormat(['STYLE#', 'SIZE', 'PIECE_PRICE'])).toBe('raw');
  });
  test('unknown', () => { expect(SW.detectFormat(['foo', 'bar'])).toBe('unknown'); });
});

describe('limits() sts_LimitSize patterns', () => {
  const pat = (o) => ['sts_LimitSize01','sts_LimitSize02','sts_LimitSize03','sts_LimitSize04','sts_LimitSize05','sts_LimitSize06']
    .map(k => o[k] === 1 ? '1' : '-').join('');
  test('base S/M/L/XL = ----11', () => { ['S','M','L','XL'].forEach(s => expect(pat(SW.limits(s))).toBe('----11')); });
  test('2XL and XXL = 1111-1 (Size05)', () => { expect(pat(SW.limits('2XL'))).toBe('1111-1'); expect(pat(SW.limits('XXL'))).toBe('1111-1'); });
  test('others = 11111- (Size06)', () => { ['XS','3XL','4XL','OSFA','2XLT','S/M'].forEach(s => expect(pat(SW.limits(s))).toBe('11111-')); });
});

describe('FIXUP path (integration list) — matches existing parts', () => {
  const D = 'Jerzees -  Dri-Power 50/50 Cotton/Poly T-Shirt.'; // note double space + trailing period from source
  const CLEAN = 'Jerzees - Dri-Power 50/50 Cotton/Poly T-Shirt';
  const mk = (id) => SW.fixupRow({ ID_Product: id, Description: D, Price_Unit_Piece: '4.12', sts_LimitSize05: '' });

  test('base row: no suffix change, description tidied (no size prefix)', () => {
    const r = mk('29M');
    expect(r.ID_Product).toBe('29M');
    expect(r.Description).toBe(CLEAN);
  });
  test('2XL: _2XL -> _2X, description "Size 2XL -"', () => {
    const r = mk('29M_2XL');
    expect(r.ID_Product).toBe('29M_2X');
    expect(r.Description).toBe('Size 2XL - ' + CLEAN);
  });
  test('3XL: suffix kept, description "Size 3XL -"', () => {
    const r = mk('29M_3XL');
    expect(r.ID_Product).toBe('29M_3XL');
    expect(r.Description).toBe('Size 3XL - ' + CLEAN);
  });
  test('ladies XXL: suffix kept as _XXL, description "Size XXL -"', () => {
    const r = SW.fixupRow({ ID_Product: 'L500_XXL', Description: "Port Authority Women's Silk Touch Polo." });
    expect(r.ID_Product).toBe('L500_XXL');
    expect(r.Description).toBe("Size XXL - Port Authority Women's Silk Touch Polo");
  });
  test('OSFA / XS pass through with size prefix', () => {
    expect(SW.fixupRow({ ID_Product: 'B100_OSFA', Description: 'Port Authority Ideal Twill Grocery Tote.' }).Description)
      .toBe('Size OSFA - Port Authority Ideal Twill Grocery Tote');
    expect(SW.fixupRow({ ID_Product: 'S100_XS', Description: 'Port Authority Heavyweight Denim Shirt.' }).ID_Product).toBe('S100_XS');
  });
  test('2XL variants (Tall/Reg/Long) keep their suffix, get "Size 2XLT -" etc.', () => {
    const r = SW.fixupRow({ ID_Product: 'TLJ754_2XLT', Description: 'Port Authority Tall Challenger Jacket.' });
    expect(r.ID_Product).toBe('TLJ754_2XLT');
    expect(r.Description).toBe('Size 2XLT - Port Authority Tall Challenger Jacket');
  });
  test('prices / size flags are passed through untouched', () => {
    const r = SW.fixupRow({ ID_Product: '29M_2XL', Description: D, Price_Unit_Piece: '5.91', Price_Unit_Case: '4.91', sts_LimitSize05: '' });
    expect(r.Price_Unit_Piece).toBe('5.91');
    expect(r.Price_Unit_Case).toBe('4.91');
    expect(r.sts_LimitSize05).toBe('');
  });

  test('fixupRows over a batch leaves zero _2XL exact endings', () => {
    const rows = [{ ID_Product: 'A_2XL', Description: 'X.' }, { ID_Product: 'B_2XLT', Description: 'Y.' }, { ID_Product: 'C_XXL', Description: 'Z.' }];
    const out = SW.fixupRows(rows).rows;
    expect(out.filter(r => /_2XL$/.test(r.ID_Product)).length).toBe(0);
    expect(out.map(r => r.ID_Product)).toEqual(['A_2X', 'B_2XLT', 'C_XXL']);
  });
});

describe('FULL conversion path (raw SanMar feed)', () => {
  const raw = (style, size, piece, caseP, title) => ({
    STYLE: style, SIZE: size, PIECE_PRICE: piece, CASE_PRICE: caseP,
    PRODUCT_TITLE: title + ' ' + style, DOZEN_PRICE: piece, BRAND_NAME: 'Jerzees'
  });
  const TITLE = 'Jerzees - Dri-Power 50/50 Cotton/Poly T-Shirt.';
  const CLEAN = 'Jerzees - Dri-Power 50/50 Cotton/Poly T-Shirt';

  test('base size -> bare part#, no size in description', () => {
    const { rows } = SW.fullConvertRows([raw('29M', 'M', '4.12', '3.12', TITLE)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].ID_Product).toBe('29M');
    expect(rows[0].Description).toBe(CLEAN);
    expect(rows[0].Price_Unit_Piece).toBe('4.12');
    expect(rows[0].Price_Unit_Dozen).toBe('4.12');
    expect(rows[0].Price_Unit_Case).toBe('3.12');
    expect(rows[0].BrandName).toBe('Jerzees');
  });
  test('2XL -> _2X + "Size 2XL -" + Size05 flag', () => {
    const { rows } = SW.fullConvertRows([raw('29M', '2XL', '5.91', '4.91', TITLE)]);
    expect(rows[0].ID_Product).toBe('29M_2X');
    expect(rows[0].Description).toBe('Size 2XL - ' + CLEAN);
    expect(rows[0].sts_LimitSize05).toBe('');
    expect(rows[0].sts_LimitSize01).toBe(1);
  });
  test('ladies XXL -> _XXL + Size05 flag', () => {
    const { rows } = SW.fullConvertRows([{ STYLE: 'L500', SIZE: 'XXL', PIECE_PRICE: '20', CASE_PRICE: '18', PRODUCT_TITLE: "Port Authority Women's Silk Touch Polo L500" }]);
    expect(rows[0].ID_Product).toBe('L500_XXL');
    expect(rows[0].Description).toBe("Size XXL - Port Authority Women's Silk Touch Polo");
    expect(rows[0].sts_LimitSize05).toBe('');
  });
  test('dedupe across colors keeps the MAX piece price', () => {
    const { rows } = SW.fullConvertRows([
      raw('29M', 'M', '4.12', '3.12', TITLE),
      raw('29M', 'M', '4.98', '3.98', TITLE) // different color, higher price
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].Price_Unit_Piece).toBe('4.98');
  });
  test('accepts STYLE# as well as STYLE; drops zero-price rows', () => {
    const { rows } = SW.fullConvertRows([
      { 'STYLE#': 'PC54', SIZE: 'L', PIECE_PRICE: '3.50', CASE_PRICE: '3.00', PRODUCT_TITLE: 'Port & Company Core Cotton Tee PC54' },
      { 'STYLE#': 'PC54', SIZE: 'XL', PIECE_PRICE: '0', CASE_PRICE: '0', PRODUCT_TITLE: 'Port & Company Core Cotton Tee PC54' }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].ID_Product).toBe('PC54');
  });
});

describe('toCsv', () => {
  test('quotes fields containing commas', () => {
    const csv = SW.toCsv([{ ID_Product: 'A', Description: 'x, y' }], ['ID_Product', 'Description']);
    expect(csv).toBe('ID_Product,Description\r\nA,"x, y"');
  });
});
