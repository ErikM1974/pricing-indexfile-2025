# NWCA Documentation Index

**Last Updated:** 2026-07-21 (regenerated from `git ls-files memory` by `/memory-maintain`)
**Purpose:** Master navigation for `/memory`. How memory itself works → [MEMORY_SYSTEM.md](MEMORY_SYSTEM.md).
**Regenerate:** run `/memory-maintain` (do not hand-edit file-by-file — it drifts).

## 🚀 Start Here / Navigation

_Read these first._

- [CROSS_PROJECT_HUB.md](CROSS_PROJECT_HUB.md) — **START HERE** for cross-project work (all 3 NWCA repos)
- [INDEX.md](INDEX.md) — this file — master navigation
- [GLOSSARY.md](GLOSSARY.md) — shared terminology (color fields, status/currency, quote prefixes)
- [MEMORY_SYSTEM.md](MEMORY_SYSTEM.md) — **how project memory works** — tiers, routing, budgets, maintenance
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [PATTERNS.md](PATTERNS.md)
- [DATABASE_PATTERNS.md](DATABASE_PATTERNS.md)

## 🐞 Lessons / Debugging

_Check first when debugging._

- [LESSONS_LEARNED.md](LESSONS_LEARNED.md) — active bug log (recurring bugs/gotchas; < 300 lines)
- [LESSONS_LEARNED_ARCHIVE.md](LESSONS_LEARNED_ARCHIVE.md) — resolved/historical lessons (unbounded)
- [DEBUGGING_COMMUNICATION.md](DEBUGGING_COMMUNICATION.md)
- [TROUBLESHOOTING_IMAGE_LOADING.md](TROUBLESHOOTING_IMAGE_LOADING.md)

## 💵 Pricing — durable references

_Single sources of truth for pricing._

- [PRICING_TIERS_MASTER_REFERENCE.md](PRICING_TIERS_MASTER_REFERENCE.md) — ⭐ MASTER pricing tiers reference
- [2026_PRICING_MARGINS.md](2026_PRICING_MARGINS.md)
- [SERVICE_CODES_TABLE.md](SERVICE_CODES_TABLE.md)
- [wa-sales-tax-rules.md](wa-sales-tax-rules.md) — ⭐ canonical WA sales-tax rules (reconciled 2026-06-25)
- [EMBROIDERY_PRICING_2026.md](EMBROIDERY_PRICING_2026.md)
- [EMBROIDERY_PRICING_PHILOSOPHY.md](EMBROIDERY_PRICING_PHILOSOPHY.md)
- [EMBROIDERY_ITEM_TYPES.md](EMBROIDERY_ITEM_TYPES.md)
- [DTF_PRICING_SYSTEM.md](DTF_PRICING_SYSTEM.md)
- [DTG_PRICING_CONSISTENCY.md](DTG_PRICING_CONSISTENCY.md)
- [DECG_PRICING_2026.md](DECG_PRICING_2026.md)
- [PRODUCT_SKU_PATTERNS.md](PRODUCT_SKU_PATTERNS.md)
- [SAMPLE_CART_PRICING.md](SAMPLE_CART_PRICING.md)
- [PRINT_METHOD_MARGIN_STRATEGY_2026-06.md](PRINT_METHOD_MARGIN_STRATEGY_2026-06.md)

## 🧰 Quote Builders — guides & architecture

_How the 4 builders are built/changed._

- [quote-builder-architecture.md](quote-builder-architecture.md) — ⭐ active change-routing manifest (cited by CLAUDE.md)
- [emb-decomposition-plan.md](emb-decomposition-plan.md) — ⭐ roadmap-0.4 working map: cluster table + proven strangler mechanics for splitting embroidery-quote-builder.js into builders/emb/* (update as clusters land)
- [QUOTE_BUILDER_BEST_PRACTICES.md](QUOTE_BUILDER_BEST_PRACTICES.md)
- [QUOTE_BUILDER_API_INTEGRATION.md](QUOTE_BUILDER_API_INTEGRATION.md)
- [QUOTE_BUILDER_LINE_ITEMS.md](QUOTE_BUILDER_LINE_ITEMS.md)
- [QUOTE_BUILDER_TEMPLATE.md](QUOTE_BUILDER_TEMPLATE.md)
- [QUOTE_BUILDER_GUIDE.md](QUOTE_BUILDER_GUIDE.md)
- [QUOTE_BUILDER_WORKFLOWS.md](QUOTE_BUILDER_WORKFLOWS.md)
- [QUOTE_BUILDER_ARCHITECTURE.md](QUOTE_BUILDER_ARCHITECTURE.md) — Jan-2026 'create a new builder' guide (NOTE: distinct from lowercase quote-builder-architecture.md)
- [EMBROIDERY_QUOTE_BUILDER.md](EMBROIDERY_QUOTE_BUILDER.md)
- [SCREENPRINT_QUOTE_BUILDER.md](SCREENPRINT_QUOTE_BUILDER.md)
- [QUOTE_BUILDER_FEATURE_AUDIT.md](QUOTE_BUILDER_FEATURE_AUDIT.md)

## 🧮 Calculators (manual / customer)

- [MANUAL_CALCULATOR_CONCEPTS.md](MANUAL_CALCULATOR_CONCEPTS.md)
- [MANUAL_CALCULATOR_REFERENCE.md](MANUAL_CALCULATOR_REFERENCE.md)
- [MANUAL_CALCULATOR_TEMPLATES.md](MANUAL_CALCULATOR_TEMPLATES.md)
- [PRICING_CALCULATOR_GUIDE.md](PRICING_CALCULATOR_GUIDE.md)
- [BUNDLE_CALCULATOR_GUIDE.md](BUNDLE_CALCULATOR_GUIDE.md)
- [DTF_CALCULATOR_SPECIFICATION.md](DTF_CALCULATOR_SPECIFICATION.md)
- [WEBSTORE_FUNDRAISER_CALCULATOR.md](WEBSTORE_FUNDRAISER_CALCULATOR.md)

## 📦 ManageOrders / ShopWorks (integration)

_Order push/pull + ShopWorks setup._

- [MANAGEORDERS_COMPLETE_REFERENCE.md](MANAGEORDERS_COMPLETE_REFERENCE.md) — ⭐ MASTER ManageOrders reference
- [MANAGEORDERS_API_GUIDE_OFFICIAL.md](MANAGEORDERS_API_GUIDE_OFFICIAL.md)
- [MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md](MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md)
- [MANAGEORDERS_INTEGRATION.md](MANAGEORDERS_INTEGRATION.md)
- [MANAGEORDERS_PUSH_WEBSTORE.md](MANAGEORDERS_PUSH_WEBSTORE.md)
- [manageorders-api-guide-2024.pdf](manageorders-api-guide-2024.pdf)
- [SHOPWORKS_ODBC_INTEGRATION.md](SHOPWORKS_ODBC_INTEGRATION.md) — 🟡 FileMaker ODBC direct-read research (2026-07-16): vendor rules, driver/DSN facts, FM SQL gotchas, push-agent→proxy→Caspio architecture
- [SHOPWORKS_EDP_INTEGRATION.md](SHOPWORKS_EDP_INTEGRATION.md)
- [SHOPWORKS_SIZE_MAPPING.md](SHOPWORKS_SIZE_MAPPING.md)
- [SHOPWORKS_EXTENDED_SKU_PATTERNS.md](SHOPWORKS_EXTENDED_SKU_PATTERNS.md)
- [SHOPWORKS_DATA_ENTRY_GUIDE.md](SHOPWORKS_DATA_ENTRY_GUIDE.md)
- [SHOPWORKS_IMPORT_PLAN.md](SHOPWORKS_IMPORT_PLAN.md)
- [SANMAR_TO_SHOPWORKS_GUIDE.md](SANMAR_TO_SHOPWORKS_GUIDE.md)
- [PC61_SHOPWORKS_SETUP_GUIDE.md](PC61_SHOPWORKS_SETUP_GUIDE.md)

## 🏭 SanMar

_Read API + PO (write) side._

- [SANMAR_API_REFERENCE.md](SANMAR_API_REFERENCE.md) — ⭐ SanMar read-side API (**v24.5 Jul 2026** — MiiR restricted; MAP restructured: basics → No-MAP, 25% = Flexfit/Richardson caps). Admin cheat-sheet `/dashboards/sanmar-api-reference.html`
- [sanmar-api-guide-24.5-jul2026.pdf](sanmar-api-guide-24.5-jul2026.pdf) — current official guide (supersedes `sanmar-api-2025-doc.pdf`)
- [SANMAR_INBOUND_2026-07.md](SANMAR_INBOUND_2026-07.md) — SanMar Inbound dashboard: PO→WO match via `PurchaseOrders.ID_PO`, UPS-real arrival day, shipment received dates, report-by-rep (proxy v913–v917)
- [SANMAR_PAYABLES_2026-07.md](SANMAR_PAYABLES_2026-07.md) — SanMar Payables page (2026-07-20): `/dashboards/sanmar-payables.html` open-payables worklist (SanMar GetUnpaidInvoices × ShopWorks cross-ref → Imported?/Paid? flags), Marketing Fund tab; vendor split Net30→1002 / MRKFUND→2425; `ShopWorks_Payables` table + sync/read routes (⏳ probe on bandit). Commission/bonus reconciliation of the AE dashboards lives in AE_MISSION_CONTROL_2026-07.md
- [LEADS_CRM_2026-07.md](LEADS_CRM_2026-07.md) — Leads CRM (2026-07-18): JotForm 6-form REST-first ingest + backfill into `Form_Submissions`, AE auto-assign rule, kanban board + lead workspace + `Lead_Activity` timeline + follow-up digest + quote handoff; endpoints, gotchas (hash links / lazy-require caspio / npm flags), open items
- [AE_MISSION_CONTROL_2026-07.md](AE_MISSION_CONTROL_2026-07.md) — AE Mission Control (2026-07-19): per-AE cockpit page + proxy `/api/ae-dashboard/summary` aggregate (cache, per-panel errors), session-derived identity + admin view-as, post-SAML landing, rep-name shapes (AE_REGISTRY), in-page kit/outreach actions, Phase 3 backlog

## 🗄️ Caspio / Backend / Auth / API

- [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md) — ⭐ Caspio **platform** REST v3 (Swagger) capability map: tables/views/files/webhooks/directories/tasks/bridge-apps, what NWCA uses vs untapped, auth, plan-gating, webhook-fires-on-REST (+ `caspio-swagger-snapshot-2026-06-29.json`)
- [CASPIO_REST_API_V4_REFERENCE.md](CASPIO_REST_API_V4_REFERENCE.md) — ⭐ Caspio **platform** REST **v4** delta vs v3 (base path, ops, query semantics): bulk ops (≤1000, `207`), full T-SQL `where/select`, single-call schema discovery, fileAssets/webhook CRUD, AI manifest+lenses; opt-in/additive, proxy still runs v3. Staff-viewable at `/dashboards/caspio-api-reference.html` (Erik-only)
- [caspio-v4-live-inventory-2026-07-09.md](caspio-v4-live-inventory-2026-07-09.md) — real `c3eku948` inventory snapshot from an authenticated v4 read: 163 tables/19 views/14 bridge apps/24 Zapier webhooks (all Datasheet-only, none fire on REST), key table IDs + schemas, profile `ProdDetailsAPI` sees all objects
- [CASPIO_INTEGRATION_TODO.md](CASPIO_INTEGRATION_TODO.md) — ⭐ **9-item build list + session resume** (Swagger-driven security/integration roadmap; #1 portal-data-min & #2 staff SAML auth ✅ LIVE)
- [STAFF_AUTH_DESIGN.md](STAFF_AUTH_DESIGN.md) — staff-dashboard auth via Caspio "Staff" App Connection SAML SSO (app=SP, Caspio=IdP); killed forgeable `/api/crm-session` (#2, LIVE v1477)
- [AIRTIGHT_PII_PROXY_PLAN_2026-07.md](AIRTIGHT_PII_PROXY_PLAN_2026-07.md) — plan/record for secret-only gating of ManageOrders PII reads on the proxy; caller-repoint waves + the "sweep `scripts/` before flipping a gate" discipline (see LESSONS "PII gate flips break callers in waves")
- [EMAILJS_TEMPLATES_REFERENCE.md](EMAILJS_TEMPLATES_REFERENCE.md) — EmailJS service + template ID reference and the flow each template serves (quote share/accept, art, digitizing, leads outreach)
- [CASPIO_PORTAL_DESIGN.md](CASPIO_PORTAL_DESIGN.md) — customer portal: data-minimization + magic-link auth + admin console + Phase 5 reward-dollars ledger (LIVE 2026-06-30)
- [STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md](STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md) — 58-agent adversarial audit that found + closed 3 anon staff-page backdoors around the gate (`gateStaffHtml`, gift-certs secret, creditcard-atmos)
- [SIDE_DOOR_REMEDIATION_PLAN_2026-06.md](SIDE_DOOR_REMEDIATION_PLAN_2026-06.md) — public-proxy "side-door" gating plan (waves 1–4; Inksoft Flask routing + FE-dashboard SAML)
- [PORTAL_PHASE4_CATALOG_PLAN.md](PORTAL_PHASE4_CATALOG_PLAN.md) — customer portal Phase 4: personalized catalog + product page + method-aware re-order + Re-order List (v.18–v.27, 2026-07)
- [PORTAL_RECS_REWARDS_PROPOSAL_2026-07.md](PORTAL_RECS_REWARDS_PROPOSAL_2026-07.md) — PROPOSAL (awaiting Erik + 3 decisions): per-customer portal recs from the AE Sales Playbook, ranked by margin $/pc, + margin-tuned rewards
- [STOREFRONT_CHECKOUT_PROPOSAL_2026-07.md](STOREFRONT_CHECKOUT_PROPOSAL_2026-07.md) — online quote payment (LIVE v2026.07.05.9, pay-in-full via DEPOSIT-PCT=100) + catalog redesign quick wins + funnel fixes; Phase 2 refunds/pay-balance + Phase 3 catalog-express still proposals
- [BAW_CHECKOUT_TEARDOWN_2026-07.md](BAW_CHECKOUT_TEARDOWN_2026-07.md) — Broken Arrow Wear checkout teardown (design-first InkSoft-licensed designer, date-driven checkout, guest email-only): verdict + 6-item ranked adoption list feeding Phase 3
- [PORTAL_MY_LOGOS.md](PORTAL_MY_LOGOS.md) — "My Logos" brainstorm + **ID REGISTRY** (Canva/Box MCP server ids, logo folder ids, Caspio design tables). KEY: Canva logo filenames are ShopWorks-id-prefixed → auto-linkable. Simple next step = `Customer_Logos` table + staff add-form + portal gallery
- [PROXY_SIDE_DOOR_AUDIT_2026-06.md](PROXY_SIDE_DOOR_AUDIT_2026-06.md) — 🔴 **#9 remediation plan**: 92 proxy routes audited, 98 HIGH/CRITICAL endpoints OPEN to the internet (only 7 gated). Severity table + Pattern A (secret) / B (SAML) + phased rollout. ~5 CRITICAL anonymous money/data holes gateable Phase-1 with zero customer risk.
- [CASPIO_API_CORE.md](CASPIO_API_CORE.md) — our **proxy's** API (distinct from the platform API above)
- [CASPIO_STAFF_AUTH.md](CASPIO_STAFF_AUTH.md)
- [CASPIO_CSS_ISOLATION.md](CASPIO_CSS_ISOLATION.md)
- [CRM_DASHBOARD_AUTH.md](CRM_DASHBOARD_AUTH.md)
- [CRM_DASHBOARD_RECONCILIATION.md](CRM_DASHBOARD_RECONCILIATION.md)
- [CUSTOMER_LOOKUP_SYSTEM.md](CUSTOMER_LOOKUP_SYSTEM.md)
- [QUOTE_SEQUENCE_API.md](QUOTE_SEQUENCE_API.md)
- [FILE_UPLOAD_API_REQUIREMENTS.md](FILE_UPLOAD_API_REQUIREMENTS.md)
- [ARTREQUESTS_FILE_UPLOAD_GUIDE.md](ARTREQUESTS_FILE_UPLOAD_GUIDE.md)
- [PROXY_BILLING_ADDRESS_IMPLEMENTATION.md](PROXY_BILLING_ADDRESS_IMPLEMENTATION.md)

## ✨ Features — durable detail (shipped 2026)

_Per-feature topic files the index links to._

- [CUSTOM_DECAL_PRICING_2026-06.md](CUSTOM_DECAL_PRICING_2026-06.md)
- [GARMENT_ART_FORM_REBUILD_2026-06.md](GARMENT_ART_FORM_REBUILD_2026-06.md)
- [MULTI_MOCKUP_SEND_2026-06.md](MULTI_MOCKUP_SEND_2026-06.md)
- [QUICK_QUOTE_TOOL_2026-06.md](QUICK_QUOTE_TOOL_2026-06.md)
- [QUICK_QUOTE_SCP_REDESIGN_2026-06.md](QUICK_QUOTE_SCP_REDESIGN_2026-06.md)
- [QUICK_QUOTE_LINESHEET_2026-06.md](QUICK_QUOTE_LINESHEET_2026-06.md)
- [SHIRT_DESIGNER_INTEGRATION_2026-06.md](SHIRT_DESIGNER_INTEGRATION_2026-06.md)
- [CUSTOMER_SITE_REDESIGN_2026-06.md](CUSTOMER_SITE_REDESIGN_2026-06.md)
- [CUSTOMER_QUOTE_CART_DESIGN_2026-06.md](CUSTOMER_QUOTE_CART_DESIGN_2026-06.md)
- [LASER_PATCH_IMPLEMENTATION.md](LASER_PATCH_IMPLEMENTATION.md)
- [MONOGRAM_FORM_SYSTEM.md](MONOGRAM_FORM_SYSTEM.md)
- [EXACT_MATCH_SEARCH_IMPLEMENTATION_SUMMARY.md](EXACT_MATCH_SEARCH_IMPLEMENTATION_SUMMARY.md)
- [blog-content-differentiation.md](blog-content-differentiation.md) — SEO lane split **v2 2026-07-14** (.net = local/service + education; teamnwca = product/style/tools); .net topic map + `reference/nwcustomapparel-net-blogs/` (316-post export)
- [webstore-seo-strategy.md](webstore-seo-strategy.md) — hub + spokes; InkSoft webstore niche DATA (construction/property-mgmt/hospitality win, NOT schools/teams)
- [TEAMNWCA_SEO_PLAN_2026-07.md](TEAMNWCA_SEO_PLAN_2026-07.md) — teamnwca SEO plan v2, phased to run alongside Mehar's .net recovery roadmap (`reference/net-seo-recovery-roadmap-2026-07.html`)

## 📊 Dashboards / Staff / Ops

- [STAFF_DASHBOARD_DATA_GUIDE.md](STAFF_DASHBOARD_DATA_GUIDE.md)
- [NIKA_DASHBOARD_BUILD_GUIDE.md](NIKA_DASHBOARD_BUILD_GUIDE.md)
- [STAFF_DIRECTORY.md](STAFF_DIRECTORY.md)
- [PRODUCTION_SCHEDULE_GUIDE.md](PRODUCTION_SCHEDULE_GUIDE.md)
- [DAILY_SALES_ARCHIVE.md](DAILY_SALES_ARCHIVE.md)

## 🔌 Other integrations / training

- [STRIPE_INTEGRATION_GUIDE.md](STRIPE_INTEGRATION_GUIDE.md)
- [SAMPLE_INVENTORY_INTEGRATION_GUIDE.md](SAMPLE_INVENTORY_INTEGRATION_GUIDE.md)
- [SAMPLE_ORDER_TESTING_GUIDE.md](SAMPLE_ORDER_TESTING_GUIDE.md)
- [emailjs-custom-tees-templates.md](emailjs-custom-tees-templates.md)
- [REP_TRAINING_PRICING_GAP_ANALYSIS.md](REP_TRAINING_PRICING_GAP_ANALYSIS.md)

## 🗺️ Roadmaps / active plans / TODO

_Forward-looking; verify status before trusting._

- [ROADMAP_2026_05.md](ROADMAP_2026_05.md)
- [DTF_SCP_PARITY_ROADMAP.md](DTF_SCP_PARITY_ROADMAP.md)
- [DTG_PARITY_ROADMAP.md](DTG_PARITY_ROADMAP.md)
- [GOLF_CAMPAIGN_2026.md](GOLF_CAMPAIGN_2026.md)
- [B2B_REWARDS_SYSTEM_PLAN.md](B2B_REWARDS_SYSTEM_PLAN.md)
- [UPS_SHIPPING_INTEGRATION_PLAN.md](UPS_SHIPPING_INTEGRATION_PLAN.md)
- [TODO_QUOTE_REVISIONS.md](TODO_QUOTE_REVISIONS.md)
- [TODO_QUOTE_ACCEPTANCE_EMAILS.md](TODO_QUOTE_ACCEPTANCE_EMAILS.md)
- [QUOTE_BUILDER_UNIFICATION_PLAN.md](QUOTE_BUILDER_UNIFICATION_PLAN.md)
- [CATALOG_PRICING_QUOTE_UX_AUDIT_2026-07.md](CATALOG_PRICING_QUOTE_UX_AUDIT_2026-07.md) — customer catalog/pricing/quote/PDF UX audit + prioritized enhancement proposal (2026-07-01)
- [CALCULATOR_PRICING_AUDIT_2026-07.md](CALCULATOR_PRICING_AUDIT_2026-07.md) — 30-agent sweep of all 14 live calculators for hardcoded/drifted pricing + submit-flow bugs; ranked findings + fix order (2026-07-01)
- [QUOTE_BUILDER_UX_AUDIT_2026-07.md](QUOTE_BUILDER_UX_AUDIT_2026-07.md) — order-entry UX audit of all 4 quote builders: click scorecard, verified price-display risks (10.1 residuals, silent SCP fallbacks), P1–P3 rec list, skin verdict (2026-07-06)
- [QUOTE_BUILDER_EXPERT_AUDIT_2026-07-07.md](QUOTE_BUILDER_EXPERT_AUDIT_2026-07-07.md) — 5-expert audit (EMB/DTF/SCP domain + workflow + CSS): 62 verified findings, NONE fixed — money leaks (DTF zero-location, EMB DECG LTM, SCP $0 back), SCP email dead end, PNW shell never switched on; week-1 punch list + Erik policy decisions (2026-07-07)
- [HR_DASHBOARD_TRAINING_REORG_2026-07.md](HR_DASHBOARD_TRAINING_REORG_2026-07.md) — staff-dashboard 2-category reorg (Policies & Procedures + Training): all 436 SweetProcess docs classified vs live hub/training, worksheet in OneDrive HR folder, nav redesign pending Erik (2026-07-10)

## 🔎 Audit / findings detail — historical, still pointed-to (NOT current state)

_Kept because a live doc links them; not the source of truth for behavior._

- [PRICING_AUDIT_2026-06-09.md](PRICING_AUDIT_2026-06-09.md)
- [PRICING_ENGINE_AUDIT_2026-06.md](PRICING_ENGINE_AUDIT_2026-06.md)
- [ORDER_FORM_ARCHITECTURE_REVIEW_2026-06-09.md](ORDER_FORM_ARCHITECTURE_REVIEW_2026-06-09.md)
- [EMB_REDESIGN_PICKUP.md](EMB_REDESIGN_PICKUP.md)
- [EMB_FINAL_VERDICT_2026-06-06.md](EMB_FINAL_VERDICT_2026-06-06.md)
- [EMB_TO100_ACTIONLIST_2026-06-06.md](EMB_TO100_ACTIONLIST_2026-06-06.md)
- [DTF_MEDIUM_SIZE_AUDIT_2026-06.md](DTF_MEDIUM_SIZE_AUDIT_2026-06.md)
- [CUSTOMER_SITE_REDESIGN_2026-06_FINDINGS.md](CUSTOMER_SITE_REDESIGN_2026-06_FINDINGS.md)
- [PRINTS_SIZE_MODEL_PROTOTYPE_2026-06.md](PRINTS_SIZE_MODEL_PROTOTYPE_2026-06.md)
- [PRICING_ROUNDING_CUTOVER_AUDIT_2026-06.md](PRICING_ROUNDING_CUTOVER_AUDIT_2026-06.md)

## 📁 Subfolders

- **`3-day-tees/`** (19 files) — 3-Day Tees feature bundle (ORDER_PUSH_FLOW.md is the durable one)
- **`api/`** (8 files) — per-endpoint API references
- **`archive/`** (16 files) — one-time historical docs (moved 2026-06-25 — NOT current state; see archive/README.md)
- **`edp/`** (7 files) — ShopWorks EDP blocks
- **`manageorders/`** (7 files) — ManageOrders PULL docs
- **`manageorders-push/`** (17 files) — ManageOrders PUSH docs (+ SWAGGER)
- **`quote-builders/`** (1 files) — quote-builder blueprints
- **`sanmar-po/`** (9 files) — SanMar PO submission (write side) + templates
- **`templates/`** (4 files) — copy-paste scaffolds
- **`training/`** (1 files) — staff-facing training
