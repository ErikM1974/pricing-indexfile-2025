/**
 * EMB ↔ SCP size-constant drift lock — A-grade Batch 1.5.
 *
 * The two builders carry copies of the size constants (EXTENDED_SIZES,
 * SIZE_TO_SLOT, SIZE06_EXTENDED_SIZES). Copies drift; drift here mis-slots
 * ShopWorks line items (the PC54 Size05/Size06 lesson).
 *
 * RESOLVED 2026-07-09 (Erik + SHOPWORKS_SIZE_MAPPING.md): XXL shares the
 * Size05 column with 2XL (ShopWorks Pattern 3) — its distinctness is the SKU
 * suffix only (~589 ladies styles use _XXL, never _2X). Neither '2XL' nor
 * 'XXL' belongs in the Size06 list; both render as Size05-column child rows
 * that KEEP their names (reload paths fixed in Batch 2.0). The lists are now
 * IDENTICAL and this test keeps them that way.
 */
const fs = require('fs');
const path = require('path');

function extract(file, name) {
  const src = fs.readFileSync(path.join(__dirname, '../../shared_components/js/builders', file), 'utf8');
  const m = src.match(new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\]|\\{[\\s\\S]*?\\});`));
  if (!m) throw new Error(`${name} not found in ${file}`);
  return new Function(`return (${m[1]});`)();
}

const emb = {
  EXTENDED_SIZES: extract('emb/state.js', 'EXTENDED_SIZES'),
  SIZE_TO_SLOT: extract('emb/state.js', 'SIZE_TO_SLOT'),
  SIZE06: extract('emb/state.js', 'SIZE06_EXTENDED_SIZES'),
};
const scp = {
  EXTENDED_SIZES: extract('scp/state.js', 'EXTENDED_SIZES'),
  SIZE_TO_SLOT: extract('scp/state.js', 'SIZE_TO_SLOT'),
  SIZE06: extract('scp/state.js', 'SIZE06_EXTENDED_SIZES'),
};

describe('EMB/SCP size-constant drift lock (Batch 1.5)', () => {
  test('EXTENDED_SIZES identical', () => {
    expect(scp.EXTENDED_SIZES).toEqual(emb.EXTENDED_SIZES);
  });

  test('SIZE_TO_SLOT identical (2XL→Size05 rule intact on both)', () => {
    expect(scp.SIZE_TO_SLOT).toEqual(emb.SIZE_TO_SLOT);
    expect(emb.SIZE_TO_SLOT['2XL']).toBe('Size05');
  });

  test('SIZE06 lists identical (XXL delta resolved 2026-07-09)', () => {
    expect(emb.SIZE06).toEqual(scp.SIZE06);
  });

  test("neither list contains '2XL' or 'XXL' (both Size05-dedicated)", () => {
    for (const s of ['2XL', 'XXL']) {
      expect(emb.SIZE06).not.toContain(s);
      expect(scp.SIZE06).not.toContain(s);
    }
  });
});
