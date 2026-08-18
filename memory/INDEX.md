# Memory Index

Repo `/memory/` is the CANONICAL tree (git-tracked). The machine-local auto-memory at
`~/.claude/projects/<slug>/memory/` holds `MEMORY.md` (the auto-loaded index) plus per-fact
files; where a topic exists in both, **the repo copy wins** and auto-memory keeps a pointer.

Last Updated: 2026-08-18 (branch/deploy audit: LESSONS_LEARNED trimmed 275→231 lines, 2 entries archived; all 6 dangling cross-doc links repaired — doc-freshness broken links 6→0, health 45→75)

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
| [`handbook-sync-workflow.md`](handbook-sync-workflow.md) | Employee Handbook ↔ Caspio chapters ↔ handbook.html ↔ PDF sync + Canva-scan cadence — **routed to by CLAUDE.md** (promoted from auto-memory 2026-08-17) |
| [`mockup-generator-retirement.md`](mockup-generator-retirement.md) | Mockup Generator + Pricing by Style retirement (302s, do-not-delete list) |
| [`nwca-policy-reconciliation-2026-08.md`](nwca-policy-reconciliation-2026-08.md) | Rough Draft 3 vs all 138 live policies — 8 rulings pending from Erik (promoted 2026-08-17) |
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
