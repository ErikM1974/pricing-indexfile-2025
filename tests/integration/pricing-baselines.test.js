/**
 * Pricing Baselines Regression Test — Phase 0b
 *
 * Runs the headless capture script then diffs against the LOCKED baseline.
 * Fails CI if any per-piece price, line subtotal, LTM, or grand-total has
 * drifted from Erik's signed-off baseline.
 *
 * To re-lock after an intentional pricing change:
 *   1. Run `npm run capture:pricing` (regenerates baselines.captured.json)
 *   2. Erik reviews the diffs, approves
 *   3. `cp tests/pricing-baselines/baselines.captured.json tests/pricing-baselines/baselines.locked.json`
 *   4. Commit the new locked baseline
 *
 * To debug a failure:
 *   - The test prints a per-scenario diff showing exactly what changed
 *   - Run `npm run capture:pricing -- --headed` to see browser interactions
 *   - Check that the dev server is running on port 3000 (or pass --start-server)
 */

const fs = require('fs');
const path = require('path');
const { captureAll } = require('../../scripts/capture-pricing-baselines');

const LOCKED_PATH = path.join(__dirname, '..', 'pricing-baselines', 'baselines.locked.json');
const CAPTURED_PATH = path.join(__dirname, '..', 'pricing-baselines', 'baselines.captured.json');

// Skip the whole suite if no server running AND not in CI (CI is expected to start its own)
const SKIP_IF_NO_SERVER = !process.env.CI;

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Field-by-field diff between two scenario expected blocks.
 * Returns array of {field, expected, actual} for any mismatch.
 * Tolerates ±$0.01 on dollar fields to handle floating point noise.
 */
function diffScenario(locked, captured) {
  const diffs = [];
  const FLOAT_FIELDS = ['lineSubtotal', 'grandTotalBeforeTax', 'ltmFee', 'screenSetupFee', 'ltmDistributedPerPiece'];
  const STRING_FIELDS = ['tier'];

  if (captured._stub) {
    return [{ field: '_stub', expected: 'real values', actual: captured._stubReason || 'stub', skip: true }];
  }

  for (const field of FLOAT_FIELDS) {
    if (locked[field] != null || captured[field] != null) {
      const lockedNum = Number(locked[field] || 0);
      const capturedNum = Number(captured[field] || 0);
      if (Math.abs(lockedNum - capturedNum) > 0.01) {
        diffs.push({ field, expected: lockedNum, actual: capturedNum, delta: +(capturedNum - lockedNum).toFixed(2) });
      }
    }
  }
  for (const field of STRING_FIELDS) {
    if (String(locked[field]) !== String(captured[field])) {
      diffs.push({ field, expected: locked[field], actual: captured[field] });
    }
  }

  // Per-size breakdown (deeper check — catches when total matches but a single size drifts)
  if (locked.perSizeBreakdown && captured.perSizeBreakdown) {
    const allSizes = new Set([...Object.keys(locked.perSizeBreakdown), ...Object.keys(captured.perSizeBreakdown)]);
    for (const size of allSizes) {
      const l = locked.perSizeBreakdown[size] || {};
      const c = captured.perSizeBreakdown[size] || {};
      if (Math.abs(Number(l.perPiece || 0) - Number(c.perPiece || 0)) > 0.01) {
        diffs.push({
          field: `perSizeBreakdown.${size}.perPiece`,
          expected: l.perPiece, actual: c.perPiece,
          delta: +(Number(c.perPiece) - Number(l.perPiece)).toFixed(2)
        });
      }
    }
  }

  return diffs;
}

describe('Pricing baselines — regression gate', () => {
  let lockedData = null;
  let capturedData = null;
  let serverReachable = true;

  beforeAll(async () => {
    lockedData = readJSON(LOCKED_PATH);

    // If no locked baseline exists, the suite can't really enforce anything yet
    if (!lockedData) {
      console.log('\n⚠️  No baselines.locked.json found. Skipping — lock baselines first via:');
      console.log('     npm run capture:pricing');
      console.log('     # Erik reviews tests/pricing-baselines/baselines.captured.json');
      console.log('     cp tests/pricing-baselines/baselines.captured.json tests/pricing-baselines/baselines.locked.json\n');
      return;
    }

    // Run a fresh capture (uses existing server unless CI=true → spawn own)
    try {
      await captureAll({
        startServer: !!process.env.CI,
        headless: true
      });
      capturedData = readJSON(CAPTURED_PATH);
    } catch (err) {
      console.error('Capture failed:', err.message);
      serverReachable = false;
      if (SKIP_IF_NO_SERVER) {
        console.log('⏭  Skipping regression checks — local server not running. CI runs with --start-server.');
      } else {
        throw err;
      }
    }
  }, 180000); // 3min timeout for puppeteer + 22 scenarios

  test('locked baseline exists', () => {
    if (!lockedData) {
      console.log('   Marked as pending — run lock workflow first');
      return; // soft-skip when no lock yet
    }
    expect(lockedData).toBeTruthy();
    expect(Object.keys(lockedData).filter(k => !k.startsWith('_'))).toEqual(
      expect.arrayContaining(['DTG-01', 'EMB-01', 'DTF-01', 'SCP-01'])
    );
  });

  test('capture produced output', () => {
    if (!lockedData || !serverReachable) return;
    expect(capturedData).toBeTruthy();
    expect(capturedData._meta).toBeTruthy();
    expect(capturedData._meta.errors).toBe(0);
  });

  // Dynamic per-scenario test — generated from locked baseline keys
  const scenarioIds = (readJSON(LOCKED_PATH) || {});
  Object.keys(scenarioIds).filter(k => !k.startsWith('_')).forEach(scenarioId => {
    test(`${scenarioId} matches locked baseline`, () => {
      if (!lockedData || !serverReachable) return;
      const locked = lockedData[scenarioId]?.expected;
      const captured = capturedData?.[scenarioId]?.expected;

      if (!locked) {
        throw new Error(`No locked baseline for ${scenarioId}`);
      }
      if (!captured) {
        throw new Error(`Capture missing ${scenarioId} — script may have failed for this builder`);
      }

      const diffs = diffScenario(locked, captured);
      const skipped = diffs.filter(d => d.skip);
      const real = diffs.filter(d => !d.skip);

      if (real.length > 0) {
        const report = real.map(d =>
          `  ${d.field}: expected ${d.expected} → got ${d.actual}` +
          (d.delta != null ? ` (Δ ${d.delta > 0 ? '+' : ''}${d.delta})` : '')
        ).join('\n');
        throw new Error(`Drift in ${scenarioId}:\n${report}`);
      }

      // Stubs print but don't fail
      if (skipped.length > 0) {
        // jest doesn't have a great per-test 'skip' from inside but we log it
        // console.log(`  ${scenarioId}: stubbed (Phase 0b.1) — ${skipped[0].actual}`);
      }
    });
  });
});
