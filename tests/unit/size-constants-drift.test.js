/**
 * Size-constant single-source lock — Batch 1.5 drift lock upgraded by Batch 7.5.
 *
 * The size constants (EXTENDED_SIZES, SIZE_TO_SLOT, SIZE06_EXTENDED_SIZES) now
 * live in ONE file — builders/shared/size-constants.js — and emb/scp state.js
 * RE-EXPORT them. Copies drift; drift here mis-slots ShopWorks line items
 * (the PC54 Size05/Size06 lesson), so this test now locks:
 *   1. the shared file's invariants (2XL→Size05; neither '2XL' nor 'XXL' in
 *      the Size06 list — XXL is the ladies 2XL, Size05 column, _XXL suffix,
 *      resolved with Erik 2026-07-09 / SHOPWORKS_SIZE_MAPPING.md), and
 *   2. that the builder copies STAY re-exports (no re-forked literals).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../shared_components/js/builders');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function extract(src, name) {
  const m = src.match(new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\]|\\{[\\s\\S]*?\\});`));
  if (!m) throw new Error(`${name} literal not found`);
  return new Function(`return (${m[1]});`)();
}

const sharedSrc = read('shared/size-constants.js');
const shared = {
  EXTENDED_SIZES: extract(sharedSrc, 'EXTENDED_SIZES'),
  SIZE_TO_SLOT: extract(sharedSrc, 'SIZE_TO_SLOT'),
  SIZE06: extract(sharedSrc, 'SIZE06_EXTENDED_SIZES'),
};

describe('shared size-constants invariants', () => {
  test('2XL→Size05 rule intact; standard slots stable', () => {
    expect(shared.SIZE_TO_SLOT['2XL']).toBe('Size05');
    expect(shared.SIZE_TO_SLOT.S).toBe('Size01');
    expect(shared.SIZE_TO_SLOT.XL).toBe('Size04');
    expect(shared.SIZE_TO_SLOT.OSFA).toBe('Size06');
  });

  test("SIZE06 list contains neither '2XL' nor 'XXL' (both Size05-dedicated)", () => {
    for (const s of ['2XL', 'XXL']) {
      expect(shared.SIZE06).not.toContain(s);
    }
    // spot anchors so an accidental truncation fails loudly
    for (const s of ['XS', '3XL', 'OSFA', 'YXS', '2T', 'XXS', 'LT']) {
      expect(shared.SIZE06).toContain(s);
    }
  });

  test('EXTENDED_SIZES stable', () => {
    expect(shared.EXTENDED_SIZES).toEqual(['XS', '2XL', '3XL', '4XL', '5XL', '6XL']);
  });
});

describe('builder copies stay re-exports (anti-refork ratchet)', () => {
  for (const file of ['emb/state.js', 'scp/state.js']) {
    test(`${file} re-exports from shared/size-constants.js and holds no literal`, () => {
      const src = read(file);
      expect(src).toMatch(
        /export \{ EXTENDED_SIZES, SIZE_TO_SLOT, SIZE06_EXTENDED_SIZES \} from '\.\.\/shared\/size-constants\.js';/
      );
      for (const name of ['EXTENDED_SIZES', 'SIZE_TO_SLOT', 'SIZE06_EXTENDED_SIZES']) {
        expect(src).not.toMatch(new RegExp(`export const ${name} =`));
      }
    });
  }
});
