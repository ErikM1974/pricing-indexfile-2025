# Placement Rules — Caspio table spec (v1, drafted 2026-08-18)

**Status: SPEC, not built.** Nothing below exists yet. The front-end half of the problem shipped
on `claude/catalog-pricing-placement-7aowwc`; this document specifies the backend data that
closes the remaining gap.

---

## 1. What this solves, and what already solved half of it

The customer PDP configurator (`product/js/pdp-configurator.js`) asks "where does your design
go?" and renders placement chips: Left chest · Center front · Full front · Back · Center back ·
Front + back.

**Already fixed (shipped 2026-08-18):** `currentLocations()` intersects that list with the
`supports` map of every method the product is eligible for. On an embroidery-only product
(Workwear / Outerwear / Woven Shirts / Bags / Accessories per `/api/decoration-methods`) the
three chips embroidery can't do — Center front, Full front, Center back — no longer render. That
needed no backend data: the answer was computable from what the page already had.

**Still broken:** a garment with a zipper or buttons down the middle can't take a center-front or
full-front print *regardless of method*. The method filter cannot see this — DTG, SCP and DTF all
support "full front" in the abstract; it's the **garment's construction** that rules it out.

### How big is the gap (measured 2026-08-18, live `/api/products/search`)

Only categories with a non-embroidery method are affected, because embroidery-only categories are
already handled by the shipped filter:

| Category | Subcategory | Unique styles | Methods eligible |
|---|---|---|---|
| Sweatshirts/Fleece | Full Zip | **94** | EMB · DTG · SCP · DTF |
| Sweatshirts/Fleece | 1/2 & 1/4 Zip | **75** | EMB · DTG · SCP · DTF |
| Activewear | Athletic/Warm-Ups | **32** | EMB · SCP · DTF |

Roughly 200 styles where a customer can today choose "Full front" on a full-zip hoodie and get a
live price for something we would have to call them about. Counts are unique style numbers
(the API's `pagination.total` counts style×color rows — 345 for Full Zip — and must not be quoted
as a product count).

---

## 2. The design decision that matters: deny-by-exception

The table is a **deny overlay** on top of the method-derived set, not an allow-list.

- Allow-list: 101 subcategories × 6 placements = **606 rows** to author and maintain, and every
  new SanMar subcategory silently hides every placement until someone adds 6 rows.
- Deny-list: **~20 rows**, and an unknown subcategory behaves exactly as it does today.

The default for anything not named in the table is **allow**. That keeps the failure direction
right: a missing rule shows a placement we might not be able to do (the rep catches it on the
proof), rather than hiding a placement we can sell (a lost order nobody ever hears about).

---

## 3. Caspio table: `Placement_Rules`

| Column | Type | Notes |
|---|---|---|
| `PK_ID` | Autonumber | Primary key |
| `Scope` | Text (255) | `category` \| `subcategory` \| `style` — which product field `Key` matches |
| `Key` | Text (255) | The category name, subcategory name, or style number. Matched case-insensitively, whitespace-trimmed |
| `Placement` | Text (255) | One of `leftChest` `centerFront` `fullFront` `back` `centerBack` `frontBack`, or cap-only `front`. Must match the chip keys in `pdp-configurator.js` exactly |
| `Allow` | Yes/No | `No` = hide this placement. `Yes` = force it back on (lets a style-scoped row overturn a subcategory-scoped deny) |
| `Reason` | Text (255) | Internal — why. e.g. "Zip runs down the center chest". Not shown to customers in v1 |
| `Active` | Yes/No | Soft delete. Inactive rows are skipped |
| `Notes` | Text (255) | Free text |

### Precedence — most specific wins

```
style  >  subcategory  >  category  >  (default: allow)
```

Within one scope, a `Placement` may appear once. If it appears twice, the route returns them in
`PK_ID` order and the front end takes the **last** — document this rather than relying on it; the
Caspio UI should carry a note not to duplicate.

`frontBack` is a composite (left chest + full back). It is denied only if a rule denies it
explicitly — do **not** infer it from a `centerFront` deny, because its front component is a left
chest, which zip-front garments handle fine.

### Seed rows

Scope `subcategory`, `Allow` = No, for the three subcategories measured above:

| Key | Placement | Reason |
|---|---|---|
| Full Zip | centerFront | Zip runs down the center chest |
| Full Zip | fullFront | Zip runs down the center chest |
| 1/2 & 1/4 Zip | centerFront | Placket runs through the print area |
| 1/2 & 1/4 Zip | fullFront | Placket runs through the print area |
| Athletic/Warm-Ups | centerFront | Warm-up jackets are zip-front |
| Athletic/Warm-Ups | fullFront | Warm-up jackets are zip-front |

Worth adding, but lower value — these subcategories sit in embroidery-only categories, so the
shipped method filter already hides those chips. Add them anyway so the rule survives a future
`/api/decoration-methods` change that turns DTF on for outerwear: `3-in-1`, `Corporate Jackets`,
`Insulated Jackets`, `Parkas/ Shells/ Systems`, `Rainwear`, `Soft Shells`, `Vests`, `Work
Jackets`, `Golf Outerwear`, `Camp Shirts`, `Industrial Work Shirts`, `Oxfords`, `Premium Wovens`,
`Easy Care`, `Twill`, `Stain/Soil Resistant`.

**Decisions for Erik before seeding** (deliberately left out of the list above):
- **Polos** — the placket is only ~4", but is a full-front DTG print on a polo something we do?
- **Medical/Scrubs** — V-neck, chest pockets. Center front usable or not?
- **Aprons** — center front is the *primary* spot; do NOT deny. Confirm.
- **Sweaters** — mixed cardigans and pullovers in one subcategory. Style-scoped rows instead?

---

## 4. Proxy endpoint

`GET /api/placement-rules` — mirrors `/api/decoration-methods` exactly, so the front-end module is
a near-copy of `decoration-methods.js`.

```json
{
  "rules": [
    { "scope": "subcategory", "key": "Full Zip", "placement": "centerFront",
      "allow": false, "reason": "Zip runs down the center chest" }
  ]
}
```

- One call returns **every** active rule. No per-product query — the set is ~20 rows, and a
  per-product call would put a network round-trip in front of the chip render.
- Filter `Active = Yes` server-side. Never return inactive rows.
- Cache-Control: 5 min, matching the other reference feeds.
- CRUD (`POST` / `PUT` / `DELETE`) is **not** needed for v1 — Erik edits the table in the Caspio
  UI. Add it only if a staff admin page is ever built.
- Sanitize `Key` with `sanitizeFilterInput()` if any filter param is ever accepted.

---

## 5. Front end

New shared module `shared_components/js/placement-rules.js`, structured like
`decoration-methods.js` (sessionStorage cache, 1h TTL, failures never cached, cache dropped on
shape drift):

```js
PlacementRules.deniedFor(product)   // → Set of denied placement keys, or null if unavailable
```

`product` accepts the same dual shape as `eligibleFor()` — raw Caspio rows
(`CATEGORY_NAME` / `SUBCATEGORY_NAME` / `STYLE`) or camelCase (`category` / `subcategory` /
`styleNumber`). Those fields are already on `state.product` in `product-2026.js` and already
passed into `getEligibility()`, so no new product fetch is needed.

**Integration point — one function.** `currentLocations()` in `pdp-configurator.js:654` already
narrows by method; it gains a second narrowing:

```js
const live = all
    .filter(l => state.methods.some(m => METHODS[m.id] && METHODS[m.id].supports[l.key]))
    .filter(l => !state.ctx.deniedPlacements || !state.ctx.deniedPlacements.has(l.key));
return live.length ? live : all;
```

`deniedPlacements` is resolved once by `product-2026.js` alongside `getEligibility()` and passed
in on the `init(ctx)` object — keeping the configurator synchronous and network-free, as it is
today. The existing empty-intersection fallback still applies.

---

## 6. Failure posture — and why it is NOT the decoration-methods posture

`decoration-methods.js` fails **closed**: unreachable API → embroidery-only + a visible
alert-warn. That is right there, because offering a method we cannot produce leads to a price we
cannot honour.

`placement-rules` should fail **open**: unreachable API → no product-level narrowing, the
method-derived set renders, **no customer-facing banner**.

The reasoning, which should survive into the code comments:

- A missing placement rule does not produce a **wrong price**. The price shown for "full front
  DTF" is the correct price for full-front DTF; the question is only whether this particular
  garment's zipper is in the way. Erik's #1 rule targets wrong prices, and this isn't one.
- Failing closed would hide placements on **every** product, including the ~15,000 that have no
  rule at all — trading a rare, rep-catchable annoyance for a catalog-wide loss of options.
- The page already carries "Final pricing confirmed with your free proof," which is exactly the
  step that catches this.

Log the failure to `console.error` and never cache it, so the next page view retries.

**This is a decision, not a derivation — flag it to Erik on implementation.** If he wants it to
fail closed instead, the cost is that a proxy outage hides center-front on aprons.

---

## 7. Explicitly out of scope for v1

- **Placement-specific pricing.** This table gates *visibility* only. Every price still comes from
  `QuoteCartEngine.singleItemPreview`. Never let a rule row carry a number.
- **Per-color rules.** No known case.
- **Customer-facing reasons.** `Reason` is internal in v1. If it is ever surfaced, it must be
  escaped with `escapeHTML()` — it is Erik-authored text rendered into the DOM.
- **The other surfaces.** Quick Quote and the staff quote builders let a rep pick any placement on
  purpose; a rep overriding this is a feature. Customer PDP only.

---

## 8. Test plan

- `tests/dom/pdp-placement-chips.test.js` already covers the method-derived filter. Extend it with
  a stubbed `deniedPlacements` set: a full-zip hoodie (all four methods eligible) must render
  Left chest · Back · Front + back and must NOT render Center front or Full front.
- Precedence: a style-scoped `Allow = Yes` must overturn a subcategory-scoped `Allow = No`.
- Fail-open: `deniedPlacements = null` must render exactly what ships today.
- Mutation-check each, as the existing suite does.
- Re-run `npm run test:parity` — not because pricing changes (it does not), but because the PDP is
  one of the three price surfaces.

---

## 9. Build order

1. Create `Placement_Rules` in Caspio + the 6 seed rows.
2. Add `GET /api/placement-rules` to the proxy (`../caspio-pricing-proxy`), modelled on
   `src/routes/decoration-methods`.
3. `shared_components/js/placement-rules.js` + register in `shared_components/js/GUIDE.md`.
4. Wire `product-2026.js` → `init(ctx)` → `currentLocations()`.
5. Tests, `ACTIVE_FILES.md`, cache-bust bump on `product.html`.

Steps 1–2 are backend and can land independently; the front end no-ops safely until the endpoint
exists, because an unreachable feed is the fail-open path.
