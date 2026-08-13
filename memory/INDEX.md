# Memory Index

Repo `/memory/` is the CANONICAL tree (git-tracked). The machine-local auto-memory at
`~/.claude/projects/<slug>/memory/` holds `MEMORY.md` (the auto-loaded index) plus per-fact
files; where a topic exists in both, **the repo copy wins** and auto-memory keeps a pointer.

Last Updated: 2026-08-12

| File | What it holds |
|---|---|
| [`253gear-analytics-access.md`](253gear-analytics-access.md) | 253gear Google/GA4 property access — who owns what, why never to re-verify |
| [`253gear-publisher.md`](253gear-publisher.md) | 253Gear design publisher — built + deployed, awaiting first real design |
| [`253gear-store-metrics.md`](253gear-store-metrics.md) | 253gear Shopify store metrics, catalogue fixes, ShopifyQL gotchas |
| [`CAP_PRICING_ANALYSIS.md`](CAP_PRICING_ANALYSIS.md) | Cap pricing — the composition artifact, why order-type series are wrong |
| [`CASPIO_QUOTA_2026-07.md`](CASPIO_QUOTA_2026-07.md) | CANONICAL: Caspio Integrations quota, the $358 overage week (27 Jul–1 Aug) |
| [`CASPIO_SYNC_CLUSTER_COST.md`](CASPIO_SYNC_CLUSTER_COST.md) | Per-job Caspio call attribution for the sync cluster |
| [`COST_ALLOCATION_MODEL.md`](COST_ALLOCATION_MODEL.md) | Production-hour + order-pool cost model ($30.09/hr, art included) |
| [`CUSTOMER_ORDER_BEHAVIOUR.md`](CUSTOMER_ORDER_BEHAVIOUR.md) | Reorder behaviour — the 2nd order beats the 1st order’s size as a predictor |
| [`DURABLE_GOTCHAS.md`](DURABLE_GOTCHAS.md) | The expensive traps, by trigger (verification / auth / JS / deploy / API) — moved out of the auto-loaded index 2026-08-12 |
| [`EMBROIDERY_PRICING_REALIZATION.md`](EMBROIDERY_PRICING_REALIZATION.md) | 85% realization, the $442K gap — pricing is sound, it is not being charged |
| [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md) | Active bug log — problem/root cause/fix/prevention (cap 300 lines) |
| [`LESSONS_LEARNED_ARCHIVE.md`](LESSONS_LEARNED_ARCHIVE.md) | Aged-out lessons (unbounded) |
| [`MEMORY_SYSTEM.md`](MEMORY_SYSTEM.md) | **How the memory system works** (not what is in it) — where a new fact goes, the 6 surfaces and when each loads, size budgets, which tree is canonical |
| [`PAYROLL_CASPIO_2026-07.md`](PAYROLL_CASPIO_2026-07.md) | Payroll/Caspio — leave upload, entitlement traps, slip generation |
| [`SHOPWORKS_ODBC_INTEGRATION.md`](SHOPWORKS_ODBC_INTEGRATION.md) | ShopWorks ODBC + bandit sync cluster, thumbnails, ORDER_ODBC reconcile |
| [`contract-embroidery-dst.md`](contract-embroidery-dst.md) | Contract embroidery .DST quoting |
| [`deploy-cachebust.md`](deploy-cachebust.md) | Content-hashed assets + the ?v= cache-bust rules |
| [`dst-studio.md`](dst-studio.md) | DST Studio |
| [`dtg-art-fees.md`](dtg-art-fees.md) | DTG art charges GRT-50/GRT-75 — counts × live Caspio rate, never a typed $ |
| [`mockup-generator-retirement.md`](mockup-generator-retirement.md) | Mockup Generator + Pricing by Style retirement (302s, do-not-delete list) |
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
- Auto-memory `caspio-api-usage-audit-2026-07.md` (166 lines, waves 2–3: 18 + 26 Jul)
  overlaps `CASPIO_QUOTA_2026-07.md` (27 Jul–1 Aug) in SUBJECT but not in DATE RANGE.
  Not collapsed — folding it into the repo copy would drop the wave-2 record. Reconcile
  deliberately, do not just delete.
