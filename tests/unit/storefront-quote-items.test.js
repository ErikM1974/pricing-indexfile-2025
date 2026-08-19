/**
 * Unit tests for shared_components/js/storefront-quote-items.js — synthesizing
 * quote_items rows from a storefront order's colorConfigs so /quote + /invoice
 * render line items. Rows MUST foot to the order subtotal (the reader contract).
 */

const { buildStorefrontQuoteItems, storefrontEmbType } = require('../../shared_components/js/storefront-quote-items');

const sum = (items) => Math.round(items.reduce((s, i) => s + i.LineTotal, 0) * 100) / 100;

describe('storefrontEmbType', () => {
  test('caps → cap-embroidery, everything else → dtg', () => {
    expect(storefrontEmbType('custom-caps')).toBe('cap-embroidery');
    expect(storefrontEmbType('custom-tees')).toBe('dtg');
    expect(storefrontEmbType('3-day-tees')).toBe('dtg');
    expect(storefrontEmbType(undefined)).toBe('dtg');
  });
});

describe('buildStorefrontQuoteItems — caps (the CAP0612-5539 repro)', () => {
  const colorConfigs = {
    Black: { catalogColor: 'Black', displayColor: 'Black', totalQuantity: 24, sizeBreakdown: { OSFA: { quantity: 24, unitPrice: 30.75 } } }
  };
  const orderTotals = { subtotal: 738, shipping: 0, salesTax: 74.54, taxRate: 0.101 };
  const orderSettings = { channel: 'custom-caps', styleNumber: '112', productTitle: 'Richardson Trucker Cap 112', printLocationCode: 'CF_CB', printLocationName: 'Cap Front + Cap Back' };

  test('one row, cap-embroidery, OSFA 24 @ $30.75, foots to $738', () => {
    const items = buildStorefrontQuoteItems('CAP0612-5539', colorConfigs, orderTotals, orderSettings);
    expect(items).toHaveLength(1);
    const r = items[0];
    expect(r.StyleNumber).toBe('112');
    expect(r.EmbellishmentType).toBe('cap-embroidery');
    expect(r.Color).toBe('Black');
    expect(r.ColorCode).toBe('Black');
    expect(r.PrintLocationName).toBe('Cap Front + Cap Back');
    expect(r.Quantity).toBe(24);
    expect(r.FinalUnitPrice).toBe(30.75);
    expect(r.LineTotal).toBe(738);
    expect(JSON.parse(r.SizeBreakdown)).toEqual({ OSFA: 24 });
    expect(sum(items)).toBe(orderTotals.subtotal);
  });

  test('caps have free shipping → no SHIP row', () => {
    const items = buildStorefrontQuoteItems('CAP0612-5539', colorConfigs, orderTotals, orderSettings);
    expect(items.find((i) => i.StyleNumber === 'SHIP')).toBeUndefined();
  });
});

describe('buildStorefrontQuoteItems — tees (multi-color, extended sizes, shipping)', () => {
  // 12 PC54 Black (S 6 @ $23, 2XL 6 @ $25) + 12 White (M 12 @ $23) + $7.99 ship.
  const colorConfigs = {
    Black: { catalogColor: 'Black', displayColor: 'Black', totalQuantity: 12, sizeBreakdown: { S: { quantity: 6, unitPrice: 23 }, '2XL': { quantity: 6, unitPrice: 25 } } },
    White: { catalogColor: 'White', displayColor: 'White', totalQuantity: 12, sizeBreakdown: { M: { quantity: 12, unitPrice: 23 } } }
  };
  // subtotal = (6*23 + 6*25) + (12*23) = 288 + 276 = 564
  const orderTotals = { subtotal: 564, shipping: 7.99, salesTax: 57.71, taxRate: 0.101 };
  const orderSettings = { channel: 'custom-tees', styleNumber: 'PC54', productTitle: 'Port & Company Core Cotton Tee', printLocationCode: 'LC', printLocationName: 'Left Chest' };

  test('one row per color + a SHIP fee row, dtg type', () => {
    const items = buildStorefrontQuoteItems('DTG0612-1234', colorConfigs, orderTotals, orderSettings);
    const product = items.filter((i) => i.EmbellishmentType === 'dtg');
    expect(product).toHaveLength(2);
    expect(product.every((r) => r.StyleNumber === 'PC54')).toBe(true);
    const ship = items.find((i) => i.StyleNumber === 'SHIP');
    expect(ship).toBeDefined();
    expect(ship.EmbellishmentType).toBe('fee');
    expect(ship.LineTotal).toBe(7.99);
  });

  test('extended-size upcharge lands in LineTotal; product rows foot to subtotal', () => {
    const items = buildStorefrontQuoteItems('DTG0612-1234', colorConfigs, orderTotals, orderSettings);
    const black = items.find((i) => i.Color === 'Black');
    expect(black.FinalUnitPrice).toBe(23);     // base (S) shown
    expect(black.LineTotal).toBe(288);          // 6*23 + 6*25 (2XL upcharge in total)
    expect(JSON.parse(black.SizeBreakdown)).toEqual({ S: 6, '2XL': 6 });
    const productSum = Math.round(items.filter((i) => i.EmbellishmentType === 'dtg').reduce((s, i) => s + i.LineTotal, 0) * 100) / 100;
    expect(productSum).toBe(orderTotals.subtotal);
  });
});

describe('buildStorefrontQuoteItems — samples (the SAM0819-8320 repro)', () => {
  // Real cart shape from the live SAM0819-8320 row: colorConfigs is {} and the
  // samples live in orderSettings.samples — the launch code skipped quote_items
  // entirely, so /quote showed "No items in this quote".
  const orderSettings = {
    channel: 'samples',
    samples: [
      { style: '637165', size: 'L', name: "Nike Women's Dri-FIT Vertical Mesh Polo", color: 'Blustery', catalogColor: 'Blustery', type: 'paid', price: 47 },
      { style: 'NKDC1991', size: 'L', name: "Nike Women's Dri-FIT Micro Pique 2.0 Polo NKDC1991", color: 'Cool Grey', catalogColor: 'CoolGrey', type: 'paid', price: 45.5 }
    ]
  };
  const orderTotals = { subtotal: 92.5, shipping: 0, salesTax: 8.23, taxRate: 0.089 };

  test('one row per sample from orderSettings.samples, foots to subtotal', () => {
    const items = buildStorefrontQuoteItems('SAM0819-8320', {}, orderTotals, orderSettings);
    expect(items).toHaveLength(2);
    const [first, second] = items;
    expect(first.StyleNumber).toBe('637165');
    expect(first.ProductName).toBe("Sample — Nike Women's Dri-FIT Vertical Mesh Polo");
    expect(first.Color).toBe('Blustery');
    expect(first.ColorCode).toBe('Blustery');
    expect(first.EmbellishmentType).toBe('blank');
    expect(first.Quantity).toBe(1);
    expect(first.FinalUnitPrice).toBe(47);
    expect(first.LineTotal).toBe(47);
    expect(JSON.parse(first.SizeBreakdown)).toEqual({ L: 1 });
    expect(second.StyleNumber).toBe('NKDC1991');
    expect(second.ColorCode).toBe('CoolGrey');   // CATALOG_COLOR, not display
    expect(second.LineTotal).toBe(45.5);
    expect(sum(items)).toBe(orderTotals.subtotal);
  });

  test('free samples become $0 rows with a FREE label; no SHIP row (free shipping)', () => {
    const settings = {
      channel: 'samples',
      samples: [
        { style: 'PC54', size: 'M', name: 'Port & Company Core Cotton Tee', color: 'Black', catalogColor: 'Black', type: 'free', price: 0 },
        { style: 'J790', size: 'L', name: 'Port Authority Glacier Jacket', color: 'Black/Chrome', catalogColor: 'Blk/Chrome', type: 'paid', price: 39 }
      ]
    };
    const items = buildStorefrontQuoteItems('SAM0101-0001', {}, { subtotal: 39, shipping: 0 }, settings);
    expect(items).toHaveLength(2);
    const free = items.find((i) => i.StyleNumber === 'PC54');
    expect(free.ProductName).toMatch(/^FREE sample — /);
    expect(free.FinalUnitPrice).toBe(0);
    expect(free.LineTotal).toBe(0);
    expect(items.find((i) => i.StyleNumber === 'SHIP')).toBeUndefined();
    expect(sum(items)).toBe(39);
  });

  test('malformed sample entries are skipped, LineNumbers stay sequential', () => {
    const settings = { channel: 'samples', samples: [null, { size: 'L' }, { style: 'PC54', size: 'M', name: 'Tee', color: 'Black', type: 'paid', price: 10 }] };
    const items = buildStorefrontQuoteItems('SAM0101-0002', {}, { subtotal: 10, shipping: 0 }, settings);
    expect(items).toHaveLength(1);
    expect(items[0].LineNumber).toBe(1);
  });
});

describe('buildStorefrontQuoteItems — robustness', () => {
  test('empty / missing colorConfigs → [] (never throws)', () => {
    expect(buildStorefrontQuoteItems('X', {}, {}, {})).toEqual([]);
    expect(buildStorefrontQuoteItems('X', null, null, null)).toEqual([]);
  });

  test('zero-quantity sizes are skipped', () => {
    const cc = { Red: { catalogColor: 'Red', displayColor: 'Red', sizeBreakdown: { S: { quantity: 0, unitPrice: 20 }, M: { quantity: 5, unitPrice: 20 } } } };
    const items = buildStorefrontQuoteItems('X', cc, { subtotal: 100, shipping: 0 }, { channel: 'custom-tees' });
    expect(items).toHaveLength(1);
    expect(items[0].Quantity).toBe(5);
    expect(JSON.parse(items[0].SizeBreakdown)).toEqual({ M: 5 });
  });
});
