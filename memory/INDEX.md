# Memory Index

Repo `/memory/` is the CANONICAL tree (git-tracked). The machine-local auto-memory at
`~/.claude/projects/<slug>/memory/` holds `MEMORY.md` (the auto-loaded index) plus per-fact
files; where a topic exists in both, **the repo copy wins** and auto-memory keeps a pointer.

Last Updated: 2026-09-03 (/memory-maintain: MEMORY.md 24.0→~19 KB — Sept shipped-log compressed to one-liners, detail verified in SHOP_HOURLY_RATE / CUSTOMER_PORTAL / EMBROIDERY_STITCH_COST / VOLUME_QUOTE topic files; homepage-revert gotchas + VQ sequence note + DTG0831 post-import facts moved into their topic files before deletion; LESSONS 267→~200 (bonus-dial, staff-dashboard-hardening, inventorylevels archived); cross-tree copies verified as pointers)

| File | What it holds |
|---|---|
| [`253gear-analytics-access.md`](253gear-analytics-access.md) | 253gear Google/GA4 property access — who owns what, why never to re-verify |
| [`253gear-publisher.md`](253gear-publisher.md) | 253Gear design publisher — built + deployed, awaiting first real design |
| [`253gear-store-metrics.md`](253gear-store-metrics.md) | 253gear Shopify store metrics, catalogue fixes, ShopifyQL gotchas |
| [`CAP_PRICING_ANALYSIS.md`](CAP_PRICING_ANALYSIS.md) | Cap pricing — the composition artifact, why order-type series are wrong |
| [`CATALOG_CX_2026-08.md`](CATALOG_CX_2026-08.md) | Catalog CX overhaul in flight — search-index fix (proxy ddbf2e6, undeployed), live findings, audit-workflow resume, next steps |
| [`CUSTOMER_PORTAL_2026-09.md`](CUSTOMER_PORTAL_2026-09.md) | Customer portal 2026-09-01 redesign (self-service map) + reward-dollar ACCRUAL program — Service_Codes REWARD/RWD-EARN bands, paid rule, staff posting, verification |
| [`CASPIO_QUOTA_2026-07.md`](CASPIO_QUOTA_2026-07.md) | CANONICAL: Caspio Integrations quota, the $358 overage week (27 Jul–1 Aug) |
| [`CASPIO_SYNC_CLUSTER_COST.md`](CASPIO_SYNC_CLUSTER_COST.md) | Per-job Caspio call attribution for the sync cluster |
| [`COST_ALLOCATION_MODEL.md`](COST_ALLOCATION_MODEL.md) | Production-hour + order-pool cost model ($30.09/hr, art included) |
| [`CUSTOMER_ORDER_BEHAVIOUR.md`](CUSTOMER_ORDER_BEHAVIOUR.md) | Reorder behaviour — the 2nd order beats the 1st order’s size as a predictor |
| [`DASHBOARD_REVIEWS_2026-09.md`](DASHBOARD_REVIEWS_2026-09.md) | The 2026-09-04 Staff Dashboard (13 items) + AE Dashboard (redesign, colour-coding, 15 items) reviews: what shipped where, the ONE needs-review count (`ae:counts`), art fees from Service_Codes, the hashed staff dashboard, and the browser-pane / deploy-skill verification traps learned that day |
| [`DESIGN_COLOUR_CODE.md`](DESIGN_COLOUR_CODE.md) | **Colour = person/department** (Erik 2026-09-04): Steve green, Ruth purple, Bradley slate blue, personalization shop blue, AE chrome maroon — hex families, where each is defined, the checklist for colour-coding a NEW page, proposals not yet adopted |
| [`DURABLE_GOTCHAS.md`](DURABLE_GOTCHAS.md) | The expensive traps, by trigger (verification / auth / JS / deploy / API) — moved out of the auto-loaded index 2026-08-12 |
| [`EMBROIDERY_PRICING_REALIZATION.md`](EMBROIDERY_PRICING_REALIZATION.md) | 85% realization, the $442K gap — pricing is sound, it is not being charged |
| [`EMBROIDERY_STITCH_COST_2026-09.md`](EMBROIDERY_STITCH_COST_2026-09.md) | Cost per 1,000 stitches, 5K vs 8K logo, handling/setup fit from logs, worst-case multiplier, full absorption |
| [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md) | Active bug log — problem/root cause/fix/prevention (cap 300 lines) |
| [`LESSONS_LEARNED_ARCHIVE.md`](LESSONS_LEARNED_ARCHIVE.md) | Aged-out lessons (unbounded) |
| [`MEMORY_SYSTEM.md`](MEMORY_SYSTEM.md) | **How the memory system works** (not what is in it) — where a new fact goes, the 6 surfaces and when each loads, size budgets, which tree is canonical |
| [`PAYROLL_CASPIO_2026-07.md`](PAYROLL_CASPIO_2026-07.md) | Payroll/Caspio — leave upload, entitlement traps, slip generation |
| [`SANMAR_INBOUND_2026-08.md`](SANMAR_INBOUND_2026-08.md) | SanMar PSST inbound board + print sheets — what shipped, the drop-ship coverage gap, ranked backlog |
| [`SHOPWORKS_ODBC_INTEGRATION.md`](SHOPWORKS_ODBC_INTEGRATION.md) | ShopWorks ODBC + bandit sync cluster, thumbnails, ORDER_ODBC reconcile |
| [`SHOP_HOURLY_RATE_2026-09.md`](SHOP_HOURLY_RATE_2026-09.md) | Garage-style shop rate: $67 production / $91 shop / $120 company per billable machine-hour, $150 posted; cards per hour; VOL-HOUR-RATE is per PAID hour |
| [`VOLUME_QUOTE_2026-09.md`](VOLUME_QUOTE_2026-09.md) | Volume Quote admin tool — one-time price for 72+ orders, Braun NW numbers, Service_Codes VOL-* cost-model rows |
| [`contract-embroidery-dst.md`](contract-embroidery-dst.md) | Contract embroidery .DST quoting |
| [`deploy-cachebust.md`](deploy-cachebust.md) | Content-hashed assets + the ?v= cache-bust rules |
| [`dst-studio.md`](dst-studio.md) | DST Studio |
| [`dtg-art-fees.md`](dtg-art-fees.md) | DTG art charges GRT-50/GRT-75 — counts × live Caspio rate, never a typed $ |
| [`handbook-sync-workflow.md`](handbook-sync-workflow.md) | Employee Handbook ↔ Caspio chapters ↔ handbook.html ↔ PDF sync + Canva-scan cadence — **routed to by CLAUDE.md** (promoted from auto-memory 2026-08-17) |
| [`mockup-generator-retirement.md`](mockup-generator-retirement.md) | Mockup Generator + Pricing by Style retirement (302s, do-not-delete list) |
| [`nwca-policy-reconciliation-2026-08.md`](nwca-policy-reconciliation-2026-08.md) | Rough Draft 3 vs all 138 live policies — 8 rulings pending from Erik (promoted 2026-08-17) |
| [`placement-rules-spec.md`](placement-rules-spec.md) | **SPEC (not built)** Caspio `Placement_Rules` deny-overlay table + `/api/placement-rules` — hides placements a garment's construction rules out (zip/button front), on top of the shipped method-derived chip filter |
| [`policies-hub-update-playbook.md`](policies-hub-update-playbook.md) | Insert/edit/delete Policies Hub policies via the proxy admin endpoints — **routed to by CLAUDE.md** (promoted from auto-memory 2026-08-17) |
| [`policy-corpus-bulk-read.md`](policy-corpus-bulk-read.md) | Pull all 138 live policy bodies in one call — `/api/policies-public/tree` carries `Body_Plain` (promoted 2026-08-17) |
| [`pricing-analysis-data.json`](pricing-analysis-data.json) | Data behind the GENERATED Pricing Analysis page (edit Python+JSON, never HTML) |
| [`proxy-security-2026-08.md`](proxy-security-2026-08.md) | August 2026 proxy/app file-exposure + gating work |
| [`sample-request-routing.md`](sample-request-routing.md) | Free-sample request → Leads routing; the 12-place form-ID vocabulary |

## Known backlog

- 🔴 **CLAUDE.md routes ManageOrders discoveries to files that do not exist.**
  `MANAGEORDERS_COMPLETE_REFERENCE.md` and `MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md`
  (plus `CASPIO_API_CORE.md`, `SANMAR_API_REFERENCE.md`, `sanmar-po/README.md`,
  `3-day-tees/ORDER_PUSH_FLOW.md`) survive ONLY in Downloads/repo-memory-backup-2026-07-28/.
  Restore them or retarget the rule — but they predate 2026-07-28 and ManageOrders has
  moved since (ORDER_ODBC reconcile, 2026-08-10), so check currency before copying back.
- 🔴 **WA sales tax rules are UNRECOVERED and the pointer to them dangled.** The repo copy died in
  the 2026-07-28 reset while the auto-memory stub still said "canonical copy is the repo file", so
  anyone following it found nothing — a wrong-price trap on a TAX fact. The stub now names the
  recovery source (`git show cc9a61e4^:memory/wa-sales-tax-rules.md`, also in the Downloads
  backup). ⏭️ **Restore it to THIS tree after a currency check against Caspio/DOR** — it predates
  2026-07-28 and nobody should quote a rate from it until verified.
- ⏭️ **PDP placement work is IN PR #30 against `develop`** (2026-08-18,
  `claude/catalog-pricing-placement-7aowwc`, 8 commits, ~800 lines). Dead placement chips
  hidden, price table open by default, small-order fee made legible. All suites green;
  mergeable, awaiting Erik's merge. Once it lands, the spec below is in-tree on develop and
  this entry can collapse to the open decisions alone.
  **Three decisions still travel with it:** (1) build the Caspio `Placement_Rules` deny-overlay
  table or not — see [`placement-rules-spec.md`](placement-rules-spec.md); (2) the four seeding
  calls in that spec's §3 (polos, scrubs, aprons, sweaters); (3) confirm its §6 **fail-OPEN**
  posture, which deliberately inverts the fail-closed rule decoration methods use — worth a
  conscious call even if the table is never built.
  🔑 Superseded two earlier notes that both said "parked, no PR": Erik opened the PR on
  2026-08-18. Deploying is still a separate, human `/deploy` step — merging to develop does
  not touch the live site.
- ⏭️ **E2E money-path sleeps: 41s of the 48s is still unconverted, and NOT for lack of trying**
  (2026-08-18). The a11y half is done — `document.fonts.ready` replaced two fixed 3500ms waits,
  measured 116s → 101s locally. The eight remaining `page.waitForTimeout` calls in
  `tests/e2e/money-path.spec.js` (lines 111/134/152/186/208/226/234, plus 216) were deliberately
  left alone: **the money-path suite cannot run in the Claude Code cloud container.** The builder
  page loads and `#product-search` renders, but typing a style fires ZERO network requests
  (only `/api/version`), because the container's egress policy resets `fonts.googleapis.com` and
  `cdn.caspio.com` and the builder's init never completes. Verified by probe, not inferred.
  🔴 Do NOT convert those sleeps blind. The dangerous failure is not a poll that times out (that
  fails loudly in CI) — it is a poll that resolves against an element already on screen, which
  silently removes the wait and lets a save fire against unsettled pricing. That is the money
  path asserting on stale dollars while staying green.
  🔑 `money-path.spec.js:216`'s 3000ms is NOT a settle-wait at all — it is a negative-assertion
  grace window proving a late POST never arrives after a blocked save. It must stay a real
  duration whatever else changes.
  ⏭️ Needs a machine that can run `npm run test:e2e` green first (Erik's, or CI with a debug
  step). Local run needs Chromium r1228; this container ships r1194 at `/opt/pw-browsers`, so a
  throwaway config with `launchOptions.executablePath` is required even to get that far.
- ✅ **Resolved 2026-08-17:** four durable docs lived ONLY in machine-local auto-memory while
  CLAUDE.md and this index routed real work to them (`handbook-sync-workflow.md`,
  `policies-hub-update-playbook.md`, `nwca-policy-reconciliation-2026-08.md`,
  `policy-corpus-bulk-read.md`). Promoted into this tree; auto-memory keeps one-line pointers.
  🔑 Deliberately NOT promoted: `MEMORY.md` (the auto-loaded index belongs there by design),
  `caspio-schema.md`, and the `feedback_*` per-fact files (auto-memory's native format).
- ⚠️ **Docs promoted out of auto-memory carry sibling links that only resolve over there.**
  `handbook-sync-workflow.md` and `policies-hub-update-playbook.md` pointed at
  `policies-hub-details.md` and `feedback_use_proxy_for_caspio_writes.md`, which stayed
  machine-local by design. The links now say so in text instead of 404-ing (2026-08-18).
  Promote those two if the detail is ever needed in-repo — do not just re-add the links.
  Same class of break: `PAYROLL_CASPIO_2026-07.md` → `STAFF_AUTH_DESIGN.md` (a 2026-07-28
  reset casualty), now repointed at CLAUDE.md § Security Checklist + `lib/page-access.js`.
- Auto-memory `caspio-api-usage-audit-2026-07.md` (166 lines, waves 2–3: 18 + 26 Jul)
  overlaps `CASPIO_QUOTA_2026-07.md` (27 Jul–1 Aug) in SUBJECT but not in DATE RANGE.
  Not collapsed — folding it into the repo copy would drop the wave-2 record. Reconcile
  deliberately, do not just delete.
