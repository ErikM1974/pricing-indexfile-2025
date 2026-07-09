/**
 * EMB ↔ SCP size-constant drift lock — A-grade Batch 1.5.
 *
 * The two builders carry copies of the size constants (EXTENDED_SIZES,
 * SIZE_TO_SLOT, SIZE06_EXTENDED_SIZES). Copies drift; drift here mis-slots
 * ShopWorks line items (the PC54 Size05/Size06 lesson).
 *
 * KNOWN, DELIBERATE delta pending Erik's verdict (2026-07-09): EMB's
 * SIZE06_EXTENDED_SIZES includes 'XXL', SCP's does not. XXL is a REAL SanMar
 * size distinct from 2XL (~589 ladies styles use _XXL, 0 overlap with _2XL —
 * shopworks-import-parser.js:42), so EMB's list is believed correct; SCP
 * routes XXL into the Size05/2XL column instead. Changing either side changes
 * push output for ladies XXL products → Erik decides before unification.
 * This test pins the delta to EXACTLY ['XXL'] and everything else identical,
 * so no NEW drift can sneak in while that decision is pending.
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

  test("SIZE06 delta is EXACTLY ['XXL'] (EMB-only, pending Erik verdict) — nothing else may drift", () => {
    const embOnly = emb.SIZE06.filter((s) => !scp.SIZE06.includes(s));
    const scpOnly = scp.SIZE06.filter((s) => !emb.SIZE06.includes(s));
    expect(embOnly).toEqual(['XXL']);
    expect(scpOnly).toEqual([]);
  });

  test("neither list contains '2XL' (Size05-dedicated — LESSONS archive rule)", () => {
    expect(emb.SIZE06).not.toContain('2XL');
    expect(scp.SIZE06).not.toContain('2XL');
  });
});
