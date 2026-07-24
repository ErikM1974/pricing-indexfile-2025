// Invariants for the pure ladder module behind /custom-stickers.
//
// This is where the public page's judgement calls get locked: which savings
// badges are worth showing, which quantity nudges are worth making, how a
// non-square size resolves, and — above all — that the module never reads the
// stored PricePerSticker column, which disagrees with its own total on 26 of
// the 50 rows.

const L = require('../../pages/js/custom-stickers-ladder');

// Real published totals (Caspio Sticker_Pricing, verified live 2026-07-24).
const TOTALS = {
  '2x2': { 50: 87, 100: 104, 200: 140, 300: 186, 500: 234, 1000: 408, 2000: 654, 3000: 874, 5000: 1275, 10000: 2158 },
  '3x3': { 50: 98, 100: 124, 200: 234, 300: 296, 500: 406, 1000: 656, 2000: 1089, 3000: 1482, 5000: 2199, 10000: 3790 },
  '4x4': { 50: 153, 100: 212, 200: 294, 300: 378, 500: 544, 1000: 962, 2000: 1630, 3000: 2236, 5000: 3346, 10000: 5846 },
  '5x5': { 50: 183, 100: 266, 200: 412, 300: 536, 500: 784, 1000: 1322, 2000: 2266, 3000: 3123, 5000: 4694, 10000: 8892 },
  '6x6': { 50: 218, 100: 383, 200: 588, 300: 774, 500: 1125, 1000: 1740, 2000: 2940, 3000: 4080, 5000: 6250, 10000: 12000 },
};
const BEST_VALUE = { '2x2': 200, '3x3': 100, '4x4': 200, '5x5': 200, '6x6': 200 };

// Mirrors exactly what the server sends: unitPrice + savingsPct precomputed.
function buildGrid() {
  const grid = [];
  for (const size of Object.keys(TOTALS)) {
    const qtys = Object.keys(TOTALS[size]).map(Number).sort((a, b) => a - b);
    const baseline = TOTALS[size][qtys[0]] / qtys[0];
    qtys.forEach((qty, i) => {
      const total = TOTALS[size][qty];
      const unit = total / qty;
      grid.push({
        PartNumber: `STK-${size.toUpperCase()}-${qty}`,
        Size: size,
        Quantity: qty,
        TotalPrice: total,
        // Deliberately WRONG on every row — nothing may read this.
        PricePerSticker: 999,
        IsBestValue: BEST_VALUE[size] === qty,
        unitPrice: unit,
        savingsPct: i === 0 ? null : Math.round((1 - unit / baseline) * 100),
      });
    });
  }
  return grid;
}

const GRID = buildGrid();

describe('never reads the stored PricePerSticker', () => {
  test('unitOf ignores it entirely and derives from the total', () => {
    const row = GRID.find(r => r.PartNumber === 'STK-4X4-10000');
    expect(row.PricePerSticker).toBe(999);      // the trap is armed
    expect(L.unitOf(row)).toBeCloseTo(0.5846, 8);
  });

  test('falls back to TotalPrice/Quantity when the server sends no unitPrice', () => {
    // Guards the window before the proxy deploys.
    expect(L.unitOf({ TotalPrice: 962, Quantity: 1000, PricePerSticker: 0.96 })).toBeCloseTo(0.962, 8);
  });

  test('the penny table — derived unit always reconstructs its own total', () => {
    ['STK-4X4-10000', 'STK-2X2-10000', 'STK-2X2-5000', 'STK-4X4-3000', 'STK-3X3-3000', 'STK-4X4-1000']
      .forEach(pn => {
        const r = GRID.find(x => x.PartNumber === pn);
        expect(L.unitOf(r) * r.Quantity).toBeCloseTo(r.TotalPrice, 6);
      });
  });
});

describe('savings badges', () => {
  test('the baseline tier is never badged', () => {
    expect(L.badgeFor(GRID.find(r => r.PartNumber === 'STK-3X3-50'))).toBeNull();
  });

  test('6x6 @ 100 is suppressed — 12% reads as a broken volume story', () => {
    const row = GRID.find(r => r.PartNumber === 'STK-6X6-100');
    expect(row.savingsPct).toBe(12);
    expect(L.badgeFor(row)).toBeNull();
  });

  test('healthy breaks still render', () => {
    expect(L.badgeFor(GRID.find(r => r.PartNumber === 'STK-2X2-200'))).toBe(60);
    expect(L.badgeFor(GRID.find(r => r.PartNumber === 'STK-3X3-10000'))).toBe(81);
  });

  test('every rendered badge is at or above the floor', () => {
    GRID.forEach(r => {
      const b = L.badgeFor(r);
      if (b !== null) expect(b).toBeGreaterThanOrEqual(L.MIN_SAVINGS_BADGE_PCT);
    });
  });

  test('falls back to a ratio of two totals when the server sends no savingsPct', () => {
    // The window before the proxy ships savingsPct. Without this the whole
    // savings column — the strongest merchandising element on the page — is
    // silently blank.
    const bare = GRID.map(({ savingsPct, ...rest }) => rest);
    const rows = L.ladderFor(bare, '3x3', 100);
    expect(rows.map(r => r.savingsPct)).toEqual([null, 37, 40, 50, 59, 67, 72, 75, 78, 81]);
  });

  test('the fallback still suppresses weak breaks and never badges the baseline', () => {
    const bare = GRID.map(({ savingsPct, ...rest }) => rest);
    const rows = L.ladderFor(bare, '6x6', null);
    expect(rows[0].savingsPct).toBeNull();   // baseline
    expect(rows[1].savingsPct).toBeNull();   // 6x6 @ 100 computes to 12%
    expect(rows[2].savingsPct).toBe(33);
  });
});

describe('quantity nudge', () => {
  test('🔴 the DEFAULT state (3x3 @ 100) produces no nudge', () => {
    // 200 improves only 5.6% (below the bar); 300 improves 20.4% but costs
    // +$172 on a $124 order — a +139% ask to a first-time visitor before they
    // have clicked anything. Both guards are needed to suppress it.
    expect(L.nudgeFrom(GRID, '3x3', 100)).toBeNull();
  });

  test('the three good nudges survive', () => {
    const a = L.nudgeFrom(GRID, '2x2', 50);
    expect(a.quantity).toBe(100);
    expect(a.deltaTotal).toBe(17);

    const b = L.nudgeFrom(GRID, '4x4', 100);
    expect(b.quantity).toBe(200);
    expect(b.deltaTotal).toBe(82);

    const c = L.nudgeFrom(GRID, '2x2', 300);
    expect(c.quantity).toBe(500);
    expect(c.deltaTotal).toBe(48);
  });

  test('a nudge never proposes a worse per-unit price', () => {
    L.sizesIn(GRID).forEach(size => {
      L.rowsForSize(GRID, size).forEach(row => {
        const n = L.nudgeFrom(GRID, size, row.Quantity);
        if (n) expect(n.unitPrice).toBeLessThan(n.fromUnitPrice);
      });
    });
  });

  test('a nudge never asks for more than the customer is already spending', () => {
    L.sizesIn(GRID).forEach(size => {
      L.rowsForSize(GRID, size).forEach(row => {
        const n = L.nudgeFrom(GRID, size, row.Quantity);
        if (n) expect(n.deltaTotal).toBeLessThanOrEqual(row.TotalPrice);
      });
    });
  });

  test('the last tier has nothing to nudge toward', () => {
    expect(L.nudgeFrom(GRID, '2x2', 10000)).toBeNull();
  });
});

describe('bounding-box size resolution', () => {
  test('the larger dimension rounds UP to the next standard square', () => {
    expect(L.resolveSize(GRID, 2, 3).size).toBe('3x3');
    expect(L.resolveSize(GRID, 2.5, 2.5).size).toBe('3x3');
    expect(L.resolveSize(GRID, 4, 2).size).toBe('4x4');
    expect(L.resolveSize(GRID, 0.75, 0.75).size).toBe('2x2');
  });

  test('width and height are interchangeable', () => {
    expect(L.resolveSize(GRID, 2, 5)).toEqual(
      expect.objectContaining({ size: L.resolveSize(GRID, 5, 2).size })
    );
  });

  test('an exact standard square is not flagged as rounded or upgradeable', () => {
    const r = L.resolveSize(GRID, 3, 3);
    expect(r.wasRounded).toBe(false);
    expect(r.canUpgrade).toBe(false);
  });

  test('a smaller design on a bigger tier can upgrade for free', () => {
    const r = L.resolveSize(GRID, 2, 3);
    expect(r.wasRounded).toBe(true);
    expect(r.canUpgrade).toBe(true);   // 2x3 sits on the 3x3 tier
  });

  test('over the largest square is oversize, not a price', () => {
    const r = L.resolveSize(GRID, 6.1, 6.1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('oversize');
    expect(r.size).toBeUndefined();
  });

  test('incomplete input yields no size and no price', () => {
    ['', null, 0, -1, 'abc'].forEach(v => {
      expect(L.resolveSize(GRID, v, 3).ok).toBe(false);
      expect(L.resolveSize(GRID, 3, v).ok).toBe(false);
    });
  });
});

describe('quantity resolution rounds UP, never down', () => {
  test('off-tier takes the next tier up', () => {
    expect(L.resolveQty(GRID, '3x3', 250).quantity).toBe(300);
    expect(L.resolveQty(GRID, '3x3', 75).quantity).toBe(100);
    expect(L.resolveQty(GRID, '3x3', 101).quantity).toBe(200);
  });

  test('🔴 250 never resolves DOWN to the 200 tier', () => {
    // The retired front-end service rounded down, quoting $175 against a
    // published 300-tier of $186 — below our own sheet. Locked out.
    const r = L.resolveQty(GRID, '2x2', 250);
    expect(r.quantity).toBe(300);
    expect(r.quantity).not.toBe(200);
  });

  test('below the minimum is refused, with the minimum reported for the message', () => {
    const r = L.resolveQty(GRID, '3x3', 10);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('below_minimum');
    expect(r.minimum).toBe(50);
    expect(r.minimumRow.TotalPrice).toBe(98);
    expect(r.quantity).toBeUndefined();
  });

  test('above the maximum is refused', () => {
    const r = L.resolveQty(GRID, '2x2', 10001);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('above_maximum');
    expect(r.quantity).toBeUndefined();
  });

  test('an exact tier is not flagged as rounded', () => {
    expect(L.resolveQty(GRID, '3x3', 100).wasRounded).toBe(false);
    expect(L.resolveQty(GRID, '3x3', 99).wasRounded).toBe(true);
  });
});

describe('ladder assembly', () => {
  test('ten rows, ascending, one best-value flag, selection marked', () => {
    const rows = L.ladderFor(GRID, '3x3', 100);
    expect(rows).toHaveLength(10);
    expect(rows.map(r => r.quantity)).toEqual([50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000]);
    expect(rows.filter(r => r.isBestValue)).toHaveLength(1);
    expect(rows.filter(r => r.isSelected).map(r => r.quantity)).toEqual([100]);
  });

  test('the default state puts the best-value badge on the selected row', () => {
    const rows = L.ladderFor(GRID, '3x3', 100);
    const sel = rows.find(r => r.isSelected);
    expect(sel.isBestValue).toBe(true);
    expect(sel.totalPrice).toBe(124);
  });

  test('every row carries a total straight from the grid', () => {
    L.ladderFor(GRID, '4x4', 200).forEach(r => {
      expect(r.totalPrice).toBe(TOTALS['4x4'][r.quantity]);
    });
  });
});

describe('selection + formatting', () => {
  test('selectRow returns the published total untouched', () => {
    const r = L.selectRow(GRID, '3x3', 100);
    expect(r.totalPrice).toBe(124);
    expect(r.partNumber).toBe('STK-3X3-100');
    expect(r.unitPrice).toBeCloseTo(1.24, 8);
  });

  test('a missing combination returns null, never a fallback price', () => {
    expect(L.selectRow(GRID, '3x3', 175)).toBeNull();
    expect(L.selectRow(GRID, '9x9', 100)).toBeNull();
  });

  test('per-unit shows 3dp under a dollar, 2dp at or above', () => {
    expect(L.formatUnit(0.5846)).toBe('0.585');
    expect(L.formatUnit(0.216)).toBe('0.216');
    expect(L.formatUnit(1.24)).toBe('1.24');
    expect(L.formatUnit(3.06)).toBe('3.06');
  });

  test('totals are exact to the cent with thousands separators', () => {
    expect(L.formatMoney(5846)).toBe('5,846.00');
    expect(L.formatMoney(124)).toBe('124.00');
    expect(L.formatInt(10000)).toBe('10,000');
  });

  test('sizes render human-readable', () => {
    expect(L.formatSize('3x3')).toBe('3 × 3 in');
    expect(L.formatSize('10x10')).toBe('10 × 10 in');
  });
});
