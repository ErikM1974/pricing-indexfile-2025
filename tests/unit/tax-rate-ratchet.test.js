/**
 * Tax-rate literal ratchet — A-grade Batch 1.4.
 *
 * Milton went 10.1% → 10.2% on 2026-07-06 and the sweep took three sessions to
 * finish because stragglers hid in defaults, seeds, and labels. This test makes
 * the NEXT rate change a one-day job: any 10.1/0.101 tax literal reappearing in
 * live code fails CI.
 *
 * 2026-07-09: Erik created the Tax_10.2 / 2200.102 ShopWorks accounts, the
 * identifier sites flipped, and the allowlist was deleted — the gate is now
 * absolute. (Old saved quotes still carry 2200.101 in their Notes — that's
 * data, not code, and stays historically accurate.)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

const SCAN_DIRS = [
  { dir: 'shared_components/js', exts: ['.js'], skip: [/vendor[\\/]/] },
  { dir: 'quote-builders', exts: ['.html'], skip: [] },
  { dir: 'pages', exts: ['.js', '.jsx', '.html'], skip: [] },
  { dir: 'calculators', exts: ['.html', '.js'], skip: [/archive[\\/]/] },
  { dir: 'config', exts: ['.js'], skip: [] },
];

// 10.1 as a standalone number (not 10.15, not 210.1) or decimal 0.101
const STALE_RATE = /(?<![\d.])0\.101(?![\d])|(?<![\d.])10\.1(?![\d])/;

function walk(dir, exts, skip, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (skip.some((re) => re.test(rel))) continue;
    if (entry.isDirectory()) walk(full, exts, skip, out);
    else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // JS block comments
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
    .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1'); // JS line comments (not ://)
}

test('no live-code 10.1 / 0.101 tax literals outside the ShopWorks-identifier allowlist', () => {
  const offenders = [];
  for (const { dir, exts, skip } of SCAN_DIRS) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    for (const file of walk(base, exts, skip, [])) {
      const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (!STALE_RATE.test(line)) return;
        if (/\?v=|version|calibration/i.test(line)) return; // cache-bust / unrelated numerics
        offenders.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 120)}`);
      });
    }
  }
  expect(offenders).toEqual([]);
});
