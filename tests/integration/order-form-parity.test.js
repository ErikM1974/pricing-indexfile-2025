/**
 * Order-Form ↔ Live Quote-Page Parity — CI gate (Phase 0/1, 2026-06-09)
 *
 * Enforces Erik's #1 rule for the order-form redesign: the order form must price
 * IDENTICALLY to the quote pages. Drives the order-form engine + the live builder
 * math on the same page and fails the build on ANY money divergence.
 *
 * Coverage today: SCP 5/5, DTG 5/5, DTF 5/5, EMB standard 3/3, + the SCP white-
 * underbase adversarial lock. EMB AL/Full-Back/cap/beanie are skipped-with-reason
 * (order-form coverage gaps, not failures) until those paths are wired.
 *
 * Local: needs `npm start` on :3000 (skips with a notice if absent).
 * CI:    set CI=1 → spawns its own server (`run({startServer:true})`).
 *
 * Re-run manually + see the per-scenario table: `npm run capture:order-form-parity`.
 */

const http = require('http');
const { run } = require('../../scripts/capture-order-form-baselines');

const SERVER_PROBE = 'http://localhost:3000/pages/order-form.html';

function serverUp() {
  return new Promise(resolve => {
    const req = http.get(SERVER_PROBE, res => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2500, () => { req.destroy(); resolve(false); });
  });
}

describe('Order-form pricing parity — regression gate', () => {
  let reachable = false;

  beforeAll(async () => {
    // In CI the harness spawns its own server. Locally we pre-check reachability
    // ourselves so the script's internal process.exit (on a missing server) can
    // never kill the jest worker — we just soft-skip instead.
    reachable = process.env.CI ? true : await serverUp();
    if (!reachable) {
      console.log('\n⏭  No dev server on :3000 — skipping order-form parity gate.');
      console.log('    Start one with `npm start`, or run in CI (CI=1) to spawn one.\n');
    }
  }, 20000);

  test('order form prices identically to the live quote page (0 mismatches)', async () => {
    if (!reachable) return; // soft-skip when no local server and not CI

    const { failCount, results } = await run({ startServer: !!process.env.CI, headless: true });
    const covered = results.filter(r => !r.skipped);

    // Sanity: the covered set didn't silently shrink (a mapper/registration break
    // would drop scenarios to skipped and hide a regression behind a green run).
    expect(covered.length).toBeGreaterThanOrEqual(19);

    if (failCount > 0) {
      const detail = results
        .filter(r => r.diffs && r.diffs.length)
        .map(r => `  ${r.scenario.id}: ` + r.diffs
          .map(d => `${d.field} quote=${d.expected} order-form=${d.actual}`).join('; '))
        .join('\n');
      throw new Error(`Order form diverges from the live quote page in ${failCount} scenario(s):\n${detail}`);
    }
    expect(failCount).toBe(0);
  }, 180000); // puppeteer + ~19 scenarios on the in-browser-Babel order form
});
