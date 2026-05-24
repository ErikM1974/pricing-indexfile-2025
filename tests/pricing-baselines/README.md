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

## Phase 0b vs Phase 0b.1

**Phase 0b (this is)** — 18/22 scenarios fully wired:
- ✅ DTG: all 5 (single-location simple)
- ✅ EMB: 3 of 7 (EMB-01, EMB-02, EMB-07 — standard garment 8K paths)
- ⏳ EMB: 4 stubbed (EMB-03/04/05/06 — need DECG + AL + cap-specific runners)
- ✅ DTF: all 5 (decoration-only, garmentCost=0)
- ✅ SCP: all 5 (primary + additional location, screen setup, two LTM tiers)

**Phase 0b.1 (next)** — wire the 4 EMB stubs:
- EMB-03: primary 8K LC + AL 5K right sleeve → uses `service.calculateALPrice()`
- EMB-04: Full Back 15K → uses `service.calculateDECGPrice(stitchCount)`
- EMB-05: Cap C112 8K front → uses cap-specific data path (Embroidery_Cap_Costs)
- EMB-06: Beanie CP90 5K → uses `ProductCategoryFilter.isFlatHeadwear()` detection

---

## Caveats / known issues

- **DTF returns "decoration only" prices** (no garment cost added). This matches what the DTFPricingService returns when `garmentCost=0`. Verify against the DTF builder UI — if the UI adds garment, we'll need to update the runner to fetch garment cost separately.
- **Pricing depends on live Caspio + ManageOrders** — if those are down, tests skip with a clear error. Not silently passing.
- **Per-test timeout 3min** — Puppeteer + 4 builders + 22 scenarios + network ≈ 60-90s normally.
- **Heroku scheduler**: don't run this on the prod Heroku scheduler; it's a deploy-time gate, not a runtime check.
