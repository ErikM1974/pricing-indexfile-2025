# Portal per-customer recommendations + margin-tuned rewards — PROPOSAL (brainstorm, 2026-07-01)

> Status: **proposal delivered, awaiting Erik's go-ahead + 3 decisions.** NOT built. Source = Erik's `2026/Jim Financial Reports Claude 2026/NW Custom Apparel - AE Sales Playbook 2026.xlsx`. Companion to [CASPIO_PORTAL_DESIGN.md](CASPIO_PORTAL_DESIGN.md) + [PORTAL_PHASE4_CATALOG_PLAN.md](PORTAL_PHASE4_CATALOG_PLAN.md). Designed via a 5-agent Workflow (design panel + margin/arch/rewards/ingestion analyses).

## The ask
Pre-populate the customer portal so a logged-in customer sees a **per-customer** recommendation list from the playbook, prioritizing **higher-margin brand-name** items, shown **in the colors they usually order**; future: **reward $** for buying premium items (e.g. Carhartt jacket, Nike fleece). Erik gave permission to create Caspio tables.

## Playbook data (extracted, verified)
- 6 sheets. 3 per-AE account books (Nika 435 / Taneisha 386 / House 167) = **964 unique customers keyed by Cust ID = ShopWorks id_Customer**. Per-customer cols: Currently Buying (Brands), Top Styles, **Missing Brands to Pitch**, Recommended Styles to Pitch, Why/Sales Angle, # Opportunities.
- **KEY FINDING — do NOT import "Recommended Styles to Pitch":** only 30 distinct values across 964 rows; 67% get the identical generic "112/PC78H/PC54/PC61". Real per-customer signals = **"Missing Brands to Pitch"** (159 distinct) + the customer's **own order history** (styles owned + colors).
- **Brand margin (Popular Products Reference, GP% 2026):** Richardson 69.7, Port&Co 65, District 60, Port Authority 59.9, Sport-Tek 58.3, CornerStone 56, Gildan 55, Carhartt 50, Eddie Bauer 50, OGIO 48, Nike 47.6, North Face 45.4.
- **Missing-brand opportunity (customers who buy $0 of it):** Richardson 785, Carhartt 702, Sport-Tek 652, Nike 647, Port&Co 541, Port Authority 518, CornerStone 367, North Face 265.

## The strategic call: rank on GP **DOLLARS/pc**, not GP %
Resolves Erik's "high-margin brand-name" vs data's "staples have highest %" tension. GP$/pc = avg sell/pc × GP%:
- Carhartt Storm Defender jacket (CT104670): 50% × ~$160 = **~$80/pc**
- Carhartt hoodie (CTK121): 50% × ~$69 = ~$35/pc
- Nike polo (NKDC1963): 47% × ~$49 = ~$23/pc
- PC54 tee (staple): 65% × ~$15 = ~$9.50/pc
Premium brand-name items win on dollars ~8× despite lower %. Rewards = a small slice ($10) of a large absolute margin ($80) to convert the ~700 customers who buy zero Carhartt.

## Design (consensus of the 5-agent analysis)
- **FE = ZERO changes.** `productCardHtml(p,'rec')` (customer-portal.js:~329) already consumes `{style,color,title,blurb,comingSoon,image}` + wires the request modal (`source:'recommendation'`). Backend-only change.
- **Data model:** do NOT pre-bake 964 rows. **Extend `Portal_Recommendations`** into a small Erik-editable **candidate pool** (~20–40 hero rows). Add cols: `Brand`, `GP_Pct`, `Sell_Anchor` (INTERNAL ranking only — never shown as a price, Rule 9), `Is_Premium`, `Priority`, `Reward_Text`. (Optional tiny `Brand_Margin_Config` for the 12-brand GP table.)
- **Ranking — `buildRecommendations(cid)`** (server.js:~3511): (a) fetch pool; (b) `mine = buildMyProducts(cid)` → ownedStyles + colorByStyle + houseColor (most-frequent color); (c) **hard-filter out styles they already buy**; (d) score = `Sell_Anchor × GP_Pct × popularity`; (e) **6-card mix quota: 2 premium / 2 missing-staple / 2 top-popularity**, backfill so it never returns empty.
- **Colors = reuse existing.** Pass the customer's per-style/house color into `portalProductDisplay(style,color)` → `portalMatchColor`/`portalColorList` already resolve the right garment image. Zero new color code.
- **ONE-LINE REGRESSION TO FIX:** preview mirror `/api/portal-admin/preview/:id/recommendations` (server.js:~3739) currently drops `:id` — must thread `cid` through or staff preview shows the generic list.
- **Popularity ("what other customers use")** = # customers buying (playbook top-styles table) → ranking booster + social-proof copy ("88 other customers order this").

## Rewards (on the EXISTING append-only Customer_Reward_Ledger — invariants untouched)
- **v1 marketing-only:** a `Reward_Text` "Buy this — earn $10 in rewards" pill on premium cards. **No money moves.** Ships without accounting.
- **Real accrual (needs accounting sign-off):** a per-brand/style **reward-amounts** config; a **system** grant (`Created_By='system:accrual'`, minted SERVER-side, never client) into the ledger triggered by an **actual invoiced ShopWorks order** — NEVER the portal request-button click (farmable). Idempotent via `Order_Ref` query-before-write (Caspio has no unique index). Reuses `customer-rewards.js` POST /entry + overdraw guard.
- Fixed $ per premium item (e.g. Carhartt jacket $10, Nike/NF $8, staples $0), decoupled from GP%.

## Phased plan
1. **Per-customer recs + ordered colors + "earn $X" pills** — ~1 day, ships without accounting. The visible win.
2. **Reward-amounts config table** — Erik sets $ per premium brand.
3. **Automated accrual on invoiced orders** — needs accounting sign-off.
4. *(opt)* ingest "Missing Brands to Pitch" per customer for sharper targeting.

## 3 DECISIONS pending from Erik (before Phase 1 build)
1. **Hero SKU per premium brand** — proposed seed: Carhartt→CT104670(jacket)+CTK121(hoodie), Nike→NKDC1963, North Face→a flagship jacket, Richardson→112, Port&Co→PC61/PC54, Sport-Tek→ST650. Confirm/swap.
2. **6-card mix** — 2 premium / 2 staple / 2 popular, or reweight?
3. **Reward amounts** now, or defer to Phase 2?

## Resume pointer
Erik was about to decide direction. Next action when he returns: get the 3 decisions → build Phase 1 (candidate-pool table via a `caspio-pricing-proxy/scripts/` script copying `create-portal-phase4-tables.js`; `buildRecommendations(cid)` rank + color; fix the preview-mirror `:id`; add `Reward_Text` pills) → verify in `/portal-admin/preview/<id>`.

---

## ✅ PHASE 1 SHIPPED + browser-verified 2026-07-01 (FE v2026.07.01.5 · proxy v2026.07.01.1)

Erik's decisions: **top-3 premium brands** (Carhartt/Nike/North Face) · **4 premium / 2 popular** mix · **reward pills now, Erik sets the $**.

- **Caspio `Portal_Recommendations` extended** into the candidate pool (added `Brand, GP_Pct, Sell_Anchor, Is_Premium, Priority, Reward_Text`; `Sell_Anchor` = INTERNAL rank anchor, never shown — Rule 9). Seeded 10 active rows via `caspio-pricing-proxy/scripts/setup-portal-recs-phase1.js` (idempotent upsert; deactivated old C112/CP90/PC55): 4 premium heroes **CT104670** (Carhartt Storm Defender jacket), **CTK121** (Carhartt hoodie), **NF0A3LGX** (North Face soft shell), **NKDC1963** (Nike polo) — each `Reward_Text='Earn reward dollars'`; 6 popular staples PC78H/112/PC54/PC61/ST650/PC90H (blank reward). **Erik edits this table in Caspio — no deploy.**
- **Proxy `portal-reorder.js` GET /recommendations** now returns the pool + margin/premium/reward metadata (FE ranks).
- **FE `server.js` `buildRecommendations(cid)`**: fetch pool → `buildMyProductsCached(cid)` (NEW 120s-TTL memo shared with /my-products, no double history fetch) → derive ownedStyles + houseColor + colorByStyle → hard-filter owned → rank `score=Sell_Anchor×GP%` (Priority tiebreak) → fill 4 premium/2 popular w/ backfill (never empty) → enrich with the customer's house color via `portalProductDisplay` → **customer-safe projection** (strips gpPct/sellAnchor/brand/priority/isPremium — margin never reaches the browser; caught by adversarial review). Fixed the preview mirror that **dropped `:id`**.
- **FE `customer-portal.js`** renders a gold `.cp-rec-reward` pill from `rewardText` on rec cards only (marketing; NO money moves, nothing writes to the ledger).
- **Verified (preview 8891, house color Jet Black):** 6 recs = 4 premium (pill) + 2 popular (no pill); Carhartt/Nike shown in Jet Black, North Face clean-falls-back (no Jet Black variant); owned W401/PC150 excluded; 0 console errors. Pricing Rule-9 parity re-run green (100 tests) since the release also carried the screenprint fix.

## ⏳ PENDING (Phase 2/3)
- **Erik to set reward $ amounts** — edit `Portal_Recommendations.Reward_Text` per premium row in Caspio (e.g. "Earn $10 in rewards"). Blank = no pill. (He chose "I'll set the $".)
- **Phase 3 = real accrual** (needs accounting sign-off): system-grant into `Customer_Reward_Ledger` on an ACTUAL invoiced ShopWorks order (never the portal click), `Created_By='system:accrual'` minted server-side, idempotent via Order_Ref query-before-write.
- **Phase 4 (opt):** ingest playbook "Missing Brands to Pitch" per customer for sharper targeting + expand the pool beyond 3 premium brands.
