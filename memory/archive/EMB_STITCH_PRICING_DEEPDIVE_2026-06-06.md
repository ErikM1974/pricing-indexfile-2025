I have everything I need to synthesize this. All six analyses converge on a clear, consistent picture, and I can resolve the few apparent tensions between them (e.g., "$0/$4/$10 matches by luck" vs. "all surfaces agree"). Writing the decision report for Erik now.

---

# DECISION REPORT — Embroidery "Additional Stitches" + "Additional Logo" Pricing

**Prepared for: Erik | Date: 2026-06-05 | Author: Lead Pricing Engineer**

---

## 1. BOTTOM LINE

**Yes — keep the flat-band model ($0 / +$4 / +$10, first 10K included).** It is mathematically sound (monotonic, no gaps, no bad cliffs — the 15,001-stitch jump to +$10 is correct step-function behavior, not a bug), it is *cheaper to the customer than the old per-1K math above 10K*, and it is far clearer for a rep quoting on the phone and a customer reading an invoice. It is the right call and it is the easiest correct method.

**Is it correctly + consistently implemented today? Functionally yes, structurally no.** For the two real inputs you'd quote (a 12K logo and a 14K additional logo), **all five surfaces produce identical dollars** — there is no live wrong price and no quoted-vs-pushed mismatch. **But that correctness is by luck, not by design**: every surface reads the band from a *fragile positional parse* over *duplicate Caspio rows*, with a *hardcoded 25,000 cap*. The day someone deletes the duplicate rows (the obvious cleanup), three surfaces silently start under-billing. This is a latent violation of your #1 rule sitting one Caspio edit away.

**Yes/no per surface (does it match the canonical page today / is it structurally safe):**

| Surface | Matches page today? | Structurally safe? |
|---|---|---|
| Calculator page (stitch-charges tab) | ✅ Yes ($4 / $10) | ❌ No — positional parse + hardcoded 10,001 & 25,000 strings + silent fallback |
| On-screen quote (builder) | ✅ Yes | ❌ No — same positional parse + hardcoded 25,000 cap |
| Services-bar Additional Logo | ✅ Yes (different mechanism, agrees) | ⚠️ Partial — correct at runtime, but dead 5000/$1.00 garment fallback can mis-base if API field drops |
| Saved quote_items | ✅ Yes | ✅ Yes — faithfully persists the computed number |
| ShopWorks push | ✅ Yes | ✅ Yes — pure pass-through, never recomputes |

The fix is small, mechanical, and centralizes everything on ONE clean Caspio source.

---

## 2. CURRENT STATE TABLE

Two distinct mechanisms are in play, and it's essential to keep them separate:

- **AS-Garm / AS-CAP** = the *primary* logo's extra-stitch surcharge (flat band, first 10K free). A **12K logo** triggers this → **+$4/pc**.
- **AL (Additional Logo)** = a *second* logo in another location, which has its own per-logo base **plus** a stitch overage. A **14K additional logo** triggers this → **$15.50/pc** (at the 24–47 tier: $8 base + 6K over 8K × $1.25).

These are different products and price on different formulas. The table shows what each surface charges for **both** inputs at qty 24.

| Surface | 12K-stitch primary logo (AS-Garm) | 14K additional logo (AL, 24–47 tier) | Matches page? |
|---|---|---|---|
| **Calculator page** (`embroidery-pricing-all.js`) | **+$4/pc** — stitch-charges tab "Mid" pill, live from Caspio | **$15.50/pc** — separate AL-retail tab/calc (`$8 + 6×$1.25`) | ✅ Reference |
| **On-screen quote** (`embroidery-quote-pricing.js`) | **+$4/pc** → $96 line (`getStitchSurcharge(12000)`) | **$15.50/pc** → $372 line (AL block) | ✅ |
| **Services-bar AL** (`embroidery-pricing-service.js`) | N/A — this path only prices additional logos | **$15.50/pc** → $372 (`calculateALPrice`, runtime 8000/$1.25) | ✅ |
| **Saved quote** (`embroidery-quote-service.js`) | **$4.00/pc** → $96 (`GarmentStitchCharge`, `StyleNumber:'AS-Garm'`) | **$15.50/pc** → $372 (`StyleNumber:'AL'`) | ✅ |
| **ShopWorks push** (`embroidery-push-transformer.js`) | **$4.00/pc** → $96 (pass-through `FinalUnitPrice`) | **$15.50/pc** → $372 (pass-through) | ✅ |

**Read this carefully:** every cell agrees. There is **no surface charging the wrong number today**. The problem in §3 is not a current mismatch — it is structural fragility that turns into a silent mismatch on the next Caspio cleanup.

---

## 3. THE DIVERGENCES THAT MATTER

None of these produce a wrong price *right now*. Each is a latent under-bill (Erik's #1 rule) that fires on a specific, plausible trigger.

### D1 — Positional parse breaks the instant you clean up Caspio (HIGH, under-charges)
- **$ gap:** A 12K logo bills **$0 instead of $4** (−$4/pc); a 20K logo bills **$4 instead of $10** (−$6/pc). On a 48-pc order that's **$192–$288 given away per order, silently.**
- **Root cause:** `embroidery-quote-pricing.js:165-181` (and the *identical* copy in `embroidery-pricing-all.js:769-779`) filters `ItemType==='AS-Garm'`, sorts by StitchCount, then blindly reads `[0]`/`[1]`. Today Caspio has **4 AS-Garm rows** — 2 legacy `ALL` rows (PK 235/236) + 2 canonical `Mid`/`Large` rows (PK 241/242). The legacy rows happen to sort first and happen to carry the same $4/$10, so the parse lands right **by coincidence**. Delete the legacy rows (the natural cleanup) and `[0]`/`[1]` become the Mid/Large rows → bands collapse to `{≤15K:$0, ≤25K:$4, ...}`.
- **Over/under:** **Under-charges.** Worse: it's *also* reading the fee off the legacy rows, so **editing the canonical Mid/Large price in Caspio is silently ignored today** — "change the price in Caspio, no deploy" does not actually work on the rows a human would edit.

### D2 — Hardcoded 25,000 cap is not sourced from Caspio (MEDIUM, blocks no-deploy changes)
- **$ gap:** $0 today; latent. If you move the Full-Back cutover (e.g. to 30K) in Caspio, the front end ignores it until a code deploy.
- **Root cause:** `{ max: 25000, ... }` literal at `embroidery-quote-pricing.js:172`, plus the `– 25,000` and `10,001` **strings** hardcoded in the calculator's card labels (`embroidery-pricing-all.js:805/811`). The canonical `Large` row's StitchCount **is** 25000 and is sitting right there unused.
- **Over/under:** Neither yet — it's a no-deploy-promise violation. Becomes wrong if the cutover ever moves.

### D3 — AS-CAP rows exist in Caspio but nothing reads them (MEDIUM, latent drift)
- **$ gap:** $0 today (cap fees are byte-identical to garment); latent.
- **Root cause:** The parse filters `AS-Garm` only and applies it to caps by assumption (`embroidery-quote-pricing.js:164` comment "AS-Cap uses same tiers"). The four `AS-Cap` Caspio rows are dead data. Edit a cap stitch fee in Caspio expecting it to take effect → **silently ignored**.
- **Over/under:** Whichever direction you edit the cap price — the change just won't apply.

### D4 — Services-bar garment fallback mis-bases if the API field drops (LOW, under-charges)
- **$ gap:** If `/api/al-pricing` ever omits `baseStitches`/`perThousandUpcharge` for garments, `calculateALPrice` falls back to **5000/$1.00** instead of **8000/$1.25**. A 14K logo would then bill **$17.00 instead of $15.50** — actually an *over*-charge in this direction, but the real risk is the inconsistency.
- **Root cause:** Dead literals at `embroidery-pricing-service.js:624-625` (`|| 5000`, `|| 1.00`) don't match the legacy path's 8000/$1.25.
- **Over/under:** Over-charges on a 14K logo (5000 base = more "extra K"); the point is it diverges from the page on API degradation. Fix the fallback literals to 8000/$1.25.

### D5 — 26K non-Full-Back logo caps at $10 instead of routing to Full Back (LOW, policy question)
- **$ gap:** A 26K logo placed at a *non-FB* position (e.g. Left Chest) bills **$10 flat** via the `return 10` fallback, vs ~$32.50/pc if priced as Full Back. **−$22.50/pc.**
- **Root cause:** Primary logos route to Full-Back pricing **by position, not stitch count** (`embroidery-quote-pricing.js:1419-1433`); a 26K non-FB logo falls through all bands to the `return 10` safety net.
- **Over/under:** Under-charges, but **this is a policy decision, not a parse bug** — see Open Questions.

---

## 4. CASPIO SOURCE OF TRUTH

### The authoritative data — there are TWO sources today; one is clean, one is a mess.

**A. The MESS — `Embroidery_Costs` via `GET /api/pricing-bundle?method=EMB` → `allEmbroideryCostsR` (what every surface reads today):**

| PK_ID | ItemType | StitchCount | TierLabel | EmbroideryCost | Status |
|---|---|---|---|---|---|
| 235 | AS-Garm | 10000 | **ALL** | 4 | 🔴 LEGACY DUP |
| 236 | AS-Garm | 15000 | **ALL** | 10 | 🔴 LEGACY DUP |
| 241 | AS-Garm | 15000 | **Mid** | 4 | ✅ CANONICAL |
| 242 | AS-Garm | 25000 | **Large** | 10 | ✅ CANONICAL |
| 237/238/243/244 | AS-Cap | (same 4-row pattern) | ALL/ALL/Mid/Large | 4/10/4/10 | 2 legacy + 2 canonical |

The legacy `ALL` rows encode bands as `(threshold, fee-at-threshold)`; the canonical `Mid`/`Large` rows encode them as `(band-ceiling, fee-in-band)`. **Two incompatible semantics for the same surcharge in one table.** This is the root of D1/D2.

**B. The CLEAN source — `Service_Codes` via `GET /api/service-codes?code=AS-Garm` (already queryable, NOT used by the band logic today):**

| PK_ID | ServiceCode | Tier | SellPrice | DisplayName |
|---|---|---|---|---|
| 231 | AS-Garm | **Standard** | **0** | "Standard garment stitches (≤10K, included)" |
| 232 | AS-Garm | **Mid** | **4** | "Mid garment stitches (10K–15K) +$4" |
| 233 | AS-Garm | **Large** | **10** | "Large garment stitches (15K–25K) +$10" |
| 223/229/230 | AS-CAP | Standard/Mid/Large | 0/4/10 | (cap equivalents, byte-identical) |

One row per band, a self-describing `Tier` column, prices in `SellPrice`, band boundaries spelled out in `DisplayName`. No duplicates, no positional ambiguity, no incompatible semantics. **This is the source to standardize on.** It is also the same table that feeds all your other service fees (setup, digitizing, monogram, rush) — so the whole builder converges on one fee table.

> Note: there is **no server-side stitch-band endpoint** — `/api/embroidery-costs?stitchCount=N` does an exact match (12000 → empty; 15000 → ambiguous two rows), and the `service-codes` tier engine only understands quantity ranges, not the stitch `Tier` column. Every surface resolves the band client-side. That's fine — keep it client-side, just read from the clean rows.

### The exact clean schema to standardize on
Read the three `Service_Codes` rows per item (Standard/Mid/Large), keyed by the `Tier` column, price from `SellPrice`. Build the band table as **interval objects** with the three ceilings as named structural constants (band *definitions* change far less than prices, and prices come from the API — which satisfies your rule that every *price* is API-sourced):

```js
// One canonical shape, built from Service_Codes (Tier → SellPrice):
stitchSurchargeTiers = [
  { min: 0,      max: 10000, fee: row('Standard').SellPrice },  // $0  included
  { min: 10001,  max: 15000, fee: row('Mid').SellPrice      },  // $4
  { min: 15001,  max: 25000, fee: row('Large').SellPrice     }  // $10
];
// > 25000 in a non-FB slot → fee = row('Large').SellPrice (no hardcoded literal)
```

---

## 5. RECOMMENDED METHOD

**Endorsed: keep the flat 3-band model. It is the easiest method that is also mathematically correct. Do not switch to anything else.** Here is the direct answer to your question, with the math.

### Why flat-band is mathematically correct
- **Monotonic** (more stitches never costs less), **total** (every stitch count 0→∞ maps to exactly one fee, with the top closed so a huge logo can't fall through to $0), and **no gap/overlap**. The only "cliff" — a 15,001-stitch logo paying $6 more than a 15,000 one — is inherent to *any* banded scheme, is bounded at $6, and essentially never bites (almost nothing lands within a few hundred stitches of 15K). That's not a flaw; that's the cost of simplicity, and it's a good trade.

### Why it beats the alternatives (real numbers, qty-agnostic per-piece)

| Stitches | **FLAT band (keep)** | per-1K linear ($1.25/K over 8K) |
|---:|---:|---:|
| 9,000 | **$0** | $1.25 |
| 12,000 | **$4** | $5.00 |
| 14,000 | **$4** | $7.50 |
| 18,000 | **$10** | $12.50 |
| 22,000 | **$10** | $17.50 |

- **vs per-1K linear:** Linear is "fairer" in pure proportionality but is *more complex AND more expensive to the customer above 10K*. The rep must subtract a base, divide by 1,000, round up, and multiply — four steps per logo, on the phone, error-prone. Flat-band is "which of three buckets?" — a glance. And because **most logos are ~8,000 stitches → the $0 band**, the rep says "no stitch charge" instantly for the 90% case. Flat-band wins on clarity *and* on customer price.
- **vs one flat fee per logo:** Not a sound cost proxy — a 30K back hit and a 9K chest logo cost very different machine time. Rejected.
- **vs per-1K with a cap:** Mathematically elegant but *more* to explain (a rate AND a cap). Wrong direction for clarity.
- **vs 2 bands:** The $4↔$10 spread is large and 15K is exactly where "decent logo" becomes "oversized." Collapsing to 2 bands over- or under-charges a whole range. **3 bands is the right granularity** — fair enough, few enough to memorize. Don't add a 4th either; that's what Full Back is for above 25K.

### The AE / rep / customer clarity argument
- **Rep:** one glance, no arithmetic, no calculator; zero cognitive load on the dominant ~8K case.
- **Customer invoice:** `Additional Stitches (Mid) — $4.00/pc` reads as a *published rate card / policy*. The per-1K equivalent (`13K over 8K × $1.25 = +$6.25`) invites "why $1.25? why 8K? did you round my 12,300 up?" Banding reads as policy; linear reads as a formula someone could have fudged.
- **Reproducibility:** two reps quoting the same logo get the same number — no rounding-direction ambiguity.

### One framing refinement (no price changes)
The model says "10,000 included" but the garment base cost is built on an **8,000-stitch base**, and 8K is your "most logos" figure. The 8K→10K window is effectively free and slightly under-charges the 8–10K logos that dominate volume. **I'm not recommending you change the bands** — I'm flagging that the "included" story should be told as ONE coherent sentence everywhere (page + invoice) so a rep never has to reconcile "8K base" vs "10K included." If you ever want to recapture that margin, the lever is moving the included threshold from 10K → 8K in Caspio — but that's a pricing decision for you, not an engineering fix. (See Open Questions.)

### The Additional Logo is a *different* product — handle deliberately
Do **not** flatten the additional logo into the bare $0/$4/$10 band: an 8K second logo would then bill **$0**, giving away an entire extra embroidery run (its own setup, hooping, run time). It legitimately needs a **per-logo base** ($10→$7 by volume). The clean target is a **hybrid**:

> **Additional Logo price = per-logo tier base (from `Service_Codes` / EMB-AL tiers) + the SAME flat stitch band (from the AS-Garm/AS-CAP rows).**

This keeps the real per-logo run cost, and replaces the opaque per-1K stitch term with the same flat band used everywhere else — so there is **ONE stitch-pricing concept across all surfaces** (calculator stitch-charges tab, primary AS line, additional-logo stitch component), and it retires the 5000/$1.00-vs-8000/$1.25 divergence (D4) entirely. This is optional polish — it changes the additional-logo stitch math from linear to banded, so confirm you want that (Open Questions) before shipping it. The §6 sync plan is correct and sufficient *without* it.

---

## 6. SYNC PLAN

Ordered so nothing breaks mid-flight. **Do the code fix BEFORE the data cleanup** — reversing the order trips the exact latent bug in D1.

**Step 1 — Harden the band parse to be label-driven, read from the clean source.**
- File: `shared_components/js/embroidery-quote-pricing.js`, lines 165–181 (`stitchSurchargeTiers` build) + 819–824 (`getStitchSurcharge`).
- Switch the source to `Service_Codes` (`GET /api/service-codes?code=AS-Garm`, keyed on `Tier`: Standard→$0, Mid→$4, Large→$10). If you prefer to stay on `pricing-bundle` for now, at minimum replace `[0]`/`[1]` with `rows.find(r => r.TierLabel==='Mid')` / `'Large'` and read fee from those canonical rows.
- Build interval objects `{min,max,fee}`; **delete the hardcoded `25000` literal** — derive the top ceiling from the `Large` row (D2).
- Add a **visible warning banner + safe fallback** if the three tiers aren't all present (replaces today's silent `if (length>=2)` — closes the soft #1-rule violation).

**Step 2 — Make AS-CAP read its own rows.**
- Same file. Parse `AS-CAP` (`?code=AS-CAP`) independently instead of assuming garment parity, so a future cap/garment price split is honored automatically (D3).

**Step 3 — Apply the identical fix to the calculator page (the Sync rule — these two MUST match).**
- File: `calculators/embroidery-pricing-all/embroidery-pricing-all.js`, lines 758–785 (`fetchStitchChargeData`/`STITCH_CHARGE_DATA`) + 790–813 (`updateStitchChargesTierCards`).
- Same label-driven read; replace the hardcoded `10,001` and `25,000` card-label strings (lines 805/811) with values derived from the parsed bands; add the same visible-failure fallback (currently silent `console.error`).

**Step 4 — Fix the services-bar garment fallback literals.**
- File: `shared_components/js/embroidery-pricing-service.js`, lines 624–625. Change garment fallback `|| 5000` → `|| 8000` and `|| 1.00` → `|| 1.25` so a dropped API field can't mis-base garment AL (D4). (Caps legitimately stay 5000/$1.00.)

**Step 5 — Lock it with a test.**
- File: `tests/unit/pricing/stitch-surcharge.test.js` (extend existing). Assert the boundary fees come from the **parsed Mid/Large rows**, not literals: 8000→$0, 10001→$4, 15000→$4, 15001→$10, 25000→$10 — so the test fails loudly if data/parse drift. (No change needed to `embroidery-quote-service.js` save path or `embroidery-push-transformer.js` — both faithfully carry whatever the engine computes; they're already safe.)

**Step 6 — Caspio data cleanup (ONLY after Steps 1–5 ship and verify).**
- Delete the 4 legacy `ALL` rows: **PK_ID 235, 236 (AS-Garm) and 237, 238 (AS-Cap)** from `Embroidery_Costs`, via the proxy (per your "writes go through the proxy" rule), leaving only canonical `Mid`/`Large`. After Step 1, this cleanup is *safe* — it's exactly the action that breaks the code today.
- If you standardize on `Service_Codes` (recommended), the `Embroidery_Costs` AS rows become reference-only; keep the canonical Mid/Large there for any legacy reader, or remove them once nothing reads them.

**No-deploy promise after this:** changing any AS-Garm/AS-CAP price is a single `SellPrice` edit on one `Service_Codes` row, and all five surfaces reflect it with no deploy.

### OPEN QUESTIONS — only Erik can answer
1. **Included threshold: 10K or 8K?** The base garment cost is built on an 8K base but you advertise "10K included." Keep 10K (current, simplest customer story) or tighten to 8K to recapture margin on the high-volume 8–10K logos? Pricing call, not engineering.
2. **26K logo at a non-Full-Back position (D5):** charge the $10 Large cap (current), or force any logo over 25K to Full-Back pricing regardless of placement (≈$32.50/pc)? This is a policy decision about oversized non-FB logos.
3. **Adopt the Additional-Logo hybrid (§5)?** Replace the additional logo's per-1K stitch term with the flat band (one stitch concept everywhere, retires D4), or leave AL on linear per-1K? Steps 1–6 stand on their own either way; this is the only step that changes a customer-facing number on the additional logo.
4. **AS-CAP independence (D3):** confirm caps and garments should be *able* to diverge (Step 2 enables it). They're identical today; Step 2 just stops silently ignoring a future cap-only price change.

### Key files (all absolute)
- `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025\shared_components\js\embroidery-quote-pricing.js` — band parse 165–181, `getStitchSurcharge` 819–824, AL block 1617–1663, totals 1736–1744
- `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025\calculators\embroidery-pricing-all\embroidery-pricing-all.js` — `fetchStitchChargeData` 758–785, card labels 790–813
- `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025\shared_components\js\embroidery-pricing-service.js` — `calculateALPrice` 584–659, fallback literals 624–625
- `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025\shared_components\js\embroidery-quote-service.js` — `GarmentStitchCharge` 281, fee POST 672–894 (safe, no change)
- `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\caspio-pricing-proxy\lib\embroidery-push-transformer.js` — `buildServiceLine` 337–382 (safe pass-through, no change)
- `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\caspio-pricing-proxy\src\routes\service-codes.js` — `?code=` filter 158–163 (the clean source to standardize on)
- `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025\tests\unit\pricing\stitch-surcharge.test.js` — lock boundaries to parsed data