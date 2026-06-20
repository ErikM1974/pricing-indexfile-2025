/**
 * Unit tests for the Shirt Designer text engine (pure math — no canvas/DOM).
 * Locks the layout geometry + string/colour logic the designer delegates to.
 */
const E = require('../../shared_components/js/garment-text-engine.js');

describe('garment-text-engine: txtCase', () => {
  test('upper / lower / title / none', () => {
    expect(E.txtCase('aB cD', 'upper')).toBe('AB CD');
    expect(E.txtCase('aB cD', 'lower')).toBe('ab cd');
    expect(E.txtCase('aB cD', 'title')).toBe('Ab Cd');
    expect(E.txtCase('aB cD', 'none')).toBe('aB cD');
    expect(E.txtCase('aB cD')).toBe('aB cD');
  });
  test('null-safe', () => {
    expect(E.txtCase(null, 'upper')).toBe('');
    expect(E.txtCase(undefined, 'title')).toBe('');
  });
});

describe('garment-text-engine: defaultTextModel', () => {
  test('canonical key set', () => {
    const m = E.defaultTextModel();
    expect(Object.keys(m).sort()).toEqual([
      'align', 'arc', 'caseMode', 'fill', 'font', 'italic', 'lineHeight',
      'rotation', 'stroke', 'strokeOn', 'strokeW', 'text', 'tracking', 'weight'
    ]);
    expect(m.font).toBe('Anton');
    expect(m.weight).toBe(700);
    expect(m.strokeOn).toBe(false);
    expect(m.arc).toBe(0);
    expect(m.align).toBe('center');
  });
  test('returns a fresh object each call (no shared mutation)', () => {
    expect(E.defaultTextModel()).not.toBe(E.defaultTextModel());
  });
});

describe('garment-text-engine: rotatedBounds', () => {
  test('0deg is identity', () => {
    expect(E.rotatedBounds(100, 40, 0)).toEqual({ W: 100, H: 40 });
  });
  test('90deg swaps dimensions (within float rounding)', () => {
    const b = E.rotatedBounds(100, 40, 90);
    expect(b.W).toBeGreaterThanOrEqual(40);
    expect(b.W).toBeLessThanOrEqual(41);
    expect(b.H).toBe(100);
  });
  test('45deg projects a 100x40 rect to roughly square (~99x99)', () => {
    const b = E.rotatedBounds(100, 40, 45);
    expect(b.H).toBeGreaterThan(40);        // short side grows
    expect(b.W).toBeGreaterThanOrEqual(98); // long side projects to ~99
    expect(b.W).toBeLessThanOrEqual(100);
    expect(Math.abs(b.W - b.H)).toBeLessThanOrEqual(1); // near-square
  });
});

describe('garment-text-engine: arcLayout', () => {
  const widths = [50, 50, 50, 50];
  test('perChar count matches input', () => {
    expect(E.arcLayout(widths, 0.55, 220, 8).perChar.length).toBe(4);
  });
  test('theta is monotonic left→right and symmetric around 0', () => {
    const L = E.arcLayout(widths, 0.55, 220, 8);
    expect(L.perChar[0].theta).toBeLessThan(L.perChar[3].theta);
    expect(L.perChar[0].theta).toBeCloseTo(-L.perChar[3].theta, 6);
  });
  test('up vs down flips orientation', () => {
    expect(E.arcLayout(widths, 0.55, 220, 8).up).toBe(true);
    expect(E.arcLayout(widths, -0.55, 220, 8).up).toBe(false);
  });
  test('bigger bend → bigger sagitta', () => {
    expect(E.arcLayout(widths, 0.8, 220, 8).sagitta)
      .toBeGreaterThan(E.arcLayout(widths, 0.3, 220, 8).sagitta);
  });
  test('canvas size is positive and finite', () => {
    const L = E.arcLayout(widths, 0.55, 220, 8);
    expect(L.W).toBeGreaterThan(0);
    expect(L.H).toBeGreaterThan(0);
    expect(Number.isFinite(L.W) && Number.isFinite(L.H)).toBe(true);
  });
});

describe('garment-text-engine: hexLuminance', () => {
  test('black / white extremes', () => {
    expect(E.hexLuminance('#000000')).toBe(0);
    expect(Math.round(E.hexLuminance('#ffffff'))).toBe(255);
  });
  test('accepts no-hash and uppercase', () => {
    expect(Math.round(E.hexLuminance('FFFFFF'))).toBe(255);
  });
  test('null on bad input', () => {
    expect(E.hexLuminance('nope')).toBeNull();
    expect(E.hexLuminance('#fff')).toBeNull();
    expect(E.hexLuminance('')).toBeNull();
    expect(E.hexLuminance(null)).toBeNull();
  });
});

describe('garment-text-engine: pickContrastWarning', () => {
  test('high contrast → no warning', () => {
    expect(E.pickContrastWarning(169, 39)).toBe('');
  });
  test('light art on light shirt', () => {
    expect(E.pickContrastWarning(200, 210)).toMatch(/Light art/);
  });
  test('dark art on dark shirt', () => {
    expect(E.pickContrastWarning(40, 50)).toMatch(/Dark art/);
  });
  test('mid-tone low contrast → generic', () => {
    expect(E.pickContrastWarning(130, 120)).toMatch(/Low art\/shirt contrast/);
  });
  test('null inputs → no warning', () => {
    expect(E.pickContrastWarning(null, 50)).toBe('');
    expect(E.pickContrastWarning(50, null)).toBe('');
  });
});
