# Pricing Baselines — CI Regression Gate

**What this protects**: every per-piece price, line subtotal, LTM fee, and grand
total across all 22 scenarios in `SCENARIOS.md`. If a refactor accidentally
moves a price by even $0.50, the test fails before deploy.

**Source of truth**: `baselines.locked.json` — Erik signs off ONCE; CI
re-captures live prices on every commit and diffs against this file.

---

## The 3 files in this folder

| File | Purpose | Lifecycle |
|---|---|---|
| `SCENARIOS.md` | Human-readable scenario list (style, qty, sizes per case) | Updated only when adding/removing scenarios |
| `baselines.captured.json` | Fresh output from `npm run capture:pricing` | Overwritten on every capture run — **DO NOT manually edit** |
| `baselines.locked.json` | Erik-approved expected values — the regression target | Updated ONLY via explicit lock workflow below |
| `README.md` | This file | When workflow changes |

---

## Day-to-day workflows

### "I want to check pricing locally before pushing"

```bash
npm start                    # in one terminal — server on :3000
npm run capture:pricing      # in another — captures fresh, writes captured.json
npm run test:pricing-baselines   # runs capture + diffs against locked.json
```

### "CI failed with a pricing drift"

The error message shows exactly what changed:

```
Drift in SCP-02:
  grandTotalBeforeTax: expected 938 → got 986 (Δ +48)
  perSizeBreakdown.M.perPiece: expected 16 → got 17 (Δ +1)
```

Two possibilities:
1. **Intentional change** (e.g., Erik raised a margin) → re-lock (see below)
2. **Accidental drift** (refactor broke something) → revert the bad change, OR fix the code so prices come back to the locked values

### "Erik intentionally changed pricing — re-lock"

```bash
# 1. Make sure server is running with the new pricing live
npm start

# 2. Capture fresh
npm run capture:pricing

# 3. Eyeball baselines.captured.json — Erik confirms the new values are correct

# 4. Copy captured → locked
cp tests/pricing-baselines/baselines.captured.json tests/pricing-baselines/baselines.locked.json

# 5. Commit the new locked baseline
git add tests/pricing-baselines/baselines.locked.json
git commit -m "Lock new pricing baseline: <describe the change>"
```

### "I added a new test scenario"

1. Add the scenario to `SCENARIOS.md` (human spec)
2. Add the scenario to `SCENARIOS` const in `scripts/capture-pricing-baselines.js` (machine spec)
3. Run `npm run capture:pricing`
4. Verify the captured value is correct (manual eyeball)
5. Re-lock per the workflow above

---

## CI integration

In Heroku / GitHub Actions, the runner needs:
1. The server (Express) — spawn it: `npm run capture:pricing:ci` does this via `--start-server`
2. Headless Chrome — Puppeteer bundles it; usually works out of the box
3. Network access to Caspio (live pricing data) + ManageOrders (for some pricing surfaces)

Example GitHub Actions step (adapt to your workflow file):

```yaml
- name: Pricing baseline regression
  run: |
    npm install
    CI=1 npm run test:pricing-baselines
  timeout-minutes: 5
```

The `CI=1` env var triggers the test to spawn its own server (because no
existing `npm start` is running in CI).

---

## Scenario coverage — ALL 22 WIRED (Phase 0b.1 complete; README caught up 2026-07-09)

- ✅ DTG: all 5 (single-location simple)
- ✅ EMB: all 7 — incl. the once-stubbed EMB-03 (primary + AL), EMB-04 (Full Back DECG),
  EMB-05 (cap C112), EMB-06 (beanie/flat-headwear); runners live in
  `scripts/capture-pricing-baselines.js` (per-scenario blocks ~L293-380)
- ✅ DTF: all 5 (decoration-only, garmentCost=0)
- ✅ SCP: all 5 (primary + additional location, screen setup, two LTM tiers)

`tests/unit/pricing-baseline-invariants.test.js` (Batch 2.2) additionally proves the
LOCKED goldens are internally coherent (sizeTotal = perPiece×qty; Σsizes = line;
grand = line + LTM + screen setup) — a bad re-lock can't smuggle in inconsistent numbers.

---

## Caveats / known issues

- **DTF returns "decoration only" prices** (no garment cost added). This matches what the DTFPricingService returns when `garmentCost=0`. Verify against the DTF builder UI — if the UI adds garment, we'll need to update the runner to fetch garment cost separately.
- **Pricing depends on live Caspio + ManageOrders** — if those are down, tests skip with a clear error. Not silently passing.
- **Per-test timeout 3min** — Puppeteer + 4 builders + 22 scenarios + network ≈ 60-90s normally.
- **Heroku scheduler**: don't run this on the prod Heroku scheduler; it's a deploy-time gate, not a runtime check.
