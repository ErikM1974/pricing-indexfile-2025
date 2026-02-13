# /test-batch — ShopWorks Order Batch Testing

**Trigger:** `/test-batch <filepath>` or `/test-batch` (will ask for path)

Run the e2e batch runner against a ShopWorks order text file, analyze results, fix any issues, and report.

## Arguments

- `<filepath>` — Path to the ShopWorks order text file (e.g., `C:\Users\erik\Downloads\shopworks_orders_batch2.txt`)
- If no filepath provided, ask the user for the file path before proceeding

## Workflow

### Step 1: Run Dry-Run

```bash
node tests/e2e-batch-runner.js <filepath>
```

This runs in **dry-run mode** (no Caspio saves). Capture the full output.

### Step 2: Analyze Results

Check the batch runner output for:

1. **Failed orders** — Any orders that threw errors during processing. Report the order number and error message.

2. **Non-SanMar products** — For each non-SanMar style number found:
   - Call `GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products/style/{style}` to check if it's already in the database
   - If **missing**: ask Erik for the cost and brand, then add via `POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products` with the product details
   - If **exists**: note it as already registered

3. **Misclassified service codes** — Warnings from the SERVICE_CODES guard (e.g., DTG order detected as embroidery)

4. **Price discrepancies** — Flag if Our Total vs ShopWorks Total differ by more than ~50%. Small differences are expected (different margin assumptions), but large gaps indicate a problem.

5. **Parser warnings** — Unmatched lines, unexpected data, missing fields

### Step 3: Fix Code If Needed

If parser bugs or batch runner issues are found:
1. Fix the code (parser in `shared_components/js/shopworks-import-parser.js`, pricing engine in `shared_components/js/embroidery-quote-pricing.js`, or batch runner in `tests/e2e-batch-runner.js`)
2. Run `npm run test:parser` to confirm no regressions
3. Re-run the batch: `node tests/e2e-batch-runner.js <filepath>`
4. Verify the fix resolved the issue

### Step 4: Summary Report

Report to Erik:
- **Orders processed** / passed / failed (with counts)
- **Non-SanMar products** found — which are already in the DB vs which need to be added
- **Code fixes made** — what changed and why
- **Remaining issues** — anything that needs manual attention

### Step 5: Flag Improvements

Review all batch findings and propose improvements to the actual builder code. **Do NOT implement these automatically** — present them for Erik to approve.

**Types of improvements to flag:**

1. **Parser gaps** — New part number patterns the parser doesn't recognize, unrecognized service codes, fields being silently dropped. Check `shopworks-import-parser.js`.

2. **Pricing gaps** — Service types not being priced correctly, missing fee calculations, tier logic not matching real orders. Check `embroidery-quote-pricing.js`.

3. **Data gaps** — Styles/products that should be in the non-SanMar DB or SanMar catalog but aren't. Products that failed lookup but appear in multiple orders.

4. **Import flow gaps** — Patterns the builder's ShopWorks import doesn't handle that the batch revealed (e.g., unusual size formats, new embellishment types, field combinations the UI doesn't support). Check `embroidery-quote-builder.html`.

**Output format — "Proposed Builder Improvements" section:**

```
## Proposed Builder Improvements

### 1. [Short description]
- **Observed:** What the batch revealed (e.g., "3 orders had part number suffix `_YTH` which the parser drops")
- **File(s):** Which file(s) would change
- **Fix:** What the change would be
- **Orders affected:** Which batch orders hit this

### 2. ...

(If none found: "No builder improvements identified — all patterns handled correctly.")
```

**Key rule:** Batch runner bugs and test infrastructure issues → fix immediately (Step 3). Builder/parser/pricing engine changes → propose only (this step). Erik decides which to implement.

## Rules

- **NO `--live` mode** unless Erik explicitly asks. Dry-run only by default.
- **NO commits** — use `/deploy` separately for that.
- **NO pricing logic changes** without asking Erik first.
- **Always run `npm run test:parser`** before and after any parser changes.
- If a fixture file would be useful for a new edge case, save it to `tests/fixtures/shopworks-orders/` following existing naming conventions.
