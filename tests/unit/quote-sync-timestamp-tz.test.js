/**
 * quote-sync-timestamp-tz.test.js — ShopWorks_Last_Synced must be WRITTEN in the
 * same timezone it is READ in.
 *
 * WHY THIS EXISTS
 * 2026-08-17. The sync-from-shopworks handler stamped ShopWorks_Last_Synced with
 * `new Date().toISOString().replace(/\.\d{3}Z$/,'')` — a UTC wall-clock with the Z
 * filed off. Every reader treats that column as the naive PACIFIC wall-clock Caspio
 * stores everywhere else: parseCaspioPacificMs for the staleness test and the 30-day
 * purge (server.js), CaspioDate.parse for the dashboard's "Purges in N days".
 *
 * So a freshly-synced row parsed ~7-8 h in the FUTURE. `now - lastSynced` went
 * NEGATIVE, the 30-minute staleness test could not fire, and a just-synced quote was
 * skipped as a candidate for ~7.5 h instead of 30 min — quietly demoting the hourly
 * re-sync to roughly 3x/day. That cadence is not cosmetic: it is what detects
 * ShopWorks-side deletions and fires the ShipStation cancel-cascade.
 *
 * WHY IT IS NOT A SOURCE GREP
 * Asserting `server.js` contains "nowPacificNaiveIso()" would pass the moment
 * somebody writes the call, whether or not the two functions actually agree — and it
 * says nothing about the direction of the skew. Both functions are instead PARSED OUT
 * of the shipped server.js and executed, so the thing under test is the code the app
 * runs. The negative control below re-creates the old UTC writer and asserts the
 * round trip is hours wrong, which proves this file can go red.
 */

const fs = require('fs');
const path = require('path');

const SERVER = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');

/** Extract a top-level `function name(...) { ... }` by brace matching. */
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found in server.js`);
  let depth = 0;
  let i = src.indexOf('{', start);
  const open = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}

// eslint-disable-next-line no-new-func
const load = (names) => new Function(`${names.map(n => extractFn(SERVER, n)).join('\n')}
  return { ${names.join(', ')} };`)();

const { parseCaspioPacificMs, nowPacificNaiveIso } = load([
  'parseCaspioPacificMs',
  'nowPacificNaiveIso',
]);

// The retired writer, kept verbatim as the negative control.
const legacyUtcNaiveIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, '');

const HOUR = 60 * 60 * 1000;

describe('ShopWorks_Last_Synced — writer and reader agree on the timezone', () => {
  test('a stamp written now reads back as now (round trip within 5s)', () => {
    const before = Date.now();
    const stamp = nowPacificNaiveIso();
    const parsed = parseCaspioPacificMs(stamp);

    expect(Number.isFinite(parsed)).toBe(true);
    // Whole seconds only, so allow a small window either side.
    expect(Math.abs(parsed - before)).toBeLessThan(5000);
  });

  test('the stamp carries no timezone marker — Caspio wants a naive wall-clock', () => {
    // A trailing Z or ±HH:MM would take parseCaspioPacificMs down its explicit-offset
    // branch, which happens to be correct, and would mask a wrong naive value.
    expect(nowPacificNaiveIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  // NEGATIVE CONTROL — the bug, reproduced. If this ever stops failing the round-trip
  // assertion above has become vacuous (e.g. parseCaspioPacificMs quietly switched to
  // UTC), and the first test would go green against a broken pair.
  test('the retired UTC writer parses HOURS in the future — the bug, reproduced', () => {
    const skew = parseCaspioPacificMs(legacyUtcNaiveIso()) - Date.now();

    // Pacific is UTC-7 (PDT) or UTC-8 (PST); a UTC wall-clock read as Pacific lands
    // that far AHEAD of the true instant. Bounds are loose enough to survive DST.
    expect(skew).toBeGreaterThan(6.5 * HOUR);
    expect(skew).toBeLessThan(8.5 * HOUR);
  });

  test('a future-reading stamp defeats the 30-minute staleness test entirely', () => {
    // This is the actual consequence, expressed the way bulk-sync-from-shopworks
    // expresses it (server.js: `(now - lastSynced) > staleThresholdMs`).
    const STALE_AFTER = 30 * 60 * 1000;
    const now = Date.now();

    const buggy = parseCaspioPacificMs(legacyUtcNaiveIso());
    const fixed = parseCaspioPacificMs(nowPacificNaiveIso());

    // Under the bug the row is not merely fresh — the delta is NEGATIVE, so it stays
    // a non-candidate until real time catches up ~7.5 h later.
    expect(now - buggy).toBeLessThan(0);

    // Fixed: a just-synced row is fresh (correctly skipped) but only by seconds, so
    // it becomes a candidate again on the next run past the 30-minute threshold.
    expect(now - fixed).toBeGreaterThanOrEqual(0);
    expect(now - fixed).toBeLessThan(STALE_AFTER);
  });
});

describe('source guard — the sync handler uses the Pacific writer', () => {
  test('every ShopWorks_Last_Synced write is Pacific, not a UTC toISOString', () => {
    const writes = SERVER.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => line.startsWith('ShopWorks_Last_Synced:'));

    // Guard the guard: if the field is renamed this test must not silently pass.
    expect(writes.length).toBeGreaterThanOrEqual(4);

    for (const { line, n } of writes) {
      expect(`${n}: ${line}`).not.toMatch(/toISOString/);
      expect(`${n}: ${line}`).toMatch(/nowPacificNaiveIso\(\)|nowIso/);
    }
  });

  test('nowIso — the shared stamp for the update/soft-delete/pending paths — is Pacific', () => {
    // Scope to the sync-from-shopworks handler. server.js has a SECOND, unrelated
    // `const nowIso` in send-to-shipstation (ShipStation_Last_Synced, display-only,
    // written as a full ISO string WITH the Z) — a file-wide negative match would
    // fail on that one and teach the next person to delete this test.
    const start = SERVER.indexOf("app.post('/api/quote-sessions/:quoteId/sync-from-shopworks'");
    expect(start).toBeGreaterThan(-1);
    const next = SERVER.indexOf('\napp.', start + 1);
    const handler = SERVER.slice(start, next === -1 ? SERVER.length : next);

    expect(handler).toMatch(/const nowIso = nowPacificNaiveIso\(\);/);
    // Nothing in this handler may mint a timestamp from toISOString again.
    expect(handler).not.toMatch(/toISOString/);
  });
});
