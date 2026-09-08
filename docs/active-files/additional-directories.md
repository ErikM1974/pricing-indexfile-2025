# 📁 Additional Directories

### Training Materials (`/training/` — 47 files)

Operational guides, training modules, and Adriyella's daily-task tooling. Most are standalone HTML pages with embedded JS/CSS.

| File | Purpose | Status |
|------|---------|--------|
| `/training/index.html` | **NEW (2026-07-10)** Training Center — role-track directory of ALL training (static guides + live Policies Hub Training category via public API); dashboard Training nav lands here | ✅ Active |
| `/training/training-center.js` | Training Center controller — curated role tracks + live hub Training-category list | ✅ Active |
| `/training/training-center.css` | Training Center styles (2026 tokens, dash-shell) | ✅ Active |
| `/training/garment-art-request-guide.md` | **NEW (2026-06-17)** AE field guide for the rebuilt Garment art-request form — each field, what's required, what "approved" means, repeat/revision how-tos, short-notes rule | ✅ Active |
| `/training/api-test-runner.html` | API test runner harness | ✅ Active |
| `/training/art-approval-guide.html` | Art approval workflow guide | ✅ Active |
| `/training/cap-training.html` | Cap embroidery training | ✅ Active |
| `/training/customer-categorization-training.html` | Customer categorization training | ✅ Active |
| `/training/customer-service.html` | Customer service training | ✅ Active |
| `/training/get-to-know-erik.html` | "Get to know Erik" intro page | ✅ Active |
| `/training/google-review-guide.html` | Google review request guide | ✅ Active |
| `/training/lead-email-templates.html` | Lead email templates | ✅ Active |
| `/training/lead-follow-up-guide.html` | Lead follow-up guide | ✅ Active |
| `/training/lead-sheet-guide.html` | Lead sheet guide | ✅ Active |
| `/training/lead-source-training.html` | Lead source training | ✅ Active |
| `/training/nwca-language-reference.html` | NWCA language/terminology reference | ✅ Active |
| `/training/quick-reference-tips.html` | Quick reference tips | ✅ Active |
| `/training/sales-coordinator-manual.html` | Sales coordinator manual | ✅ Active |
| `/training/sales-coordinator-training-schedule.html` | Sales coordinator training schedule | ✅ Active |
| `/training/sales-tax-code-trainer.html` | Sales tax code trainer | ✅ Active |
| `/training/sanmar-purchasing-guide.html` | **NEW (2026-07-10)** SanMar purchasing via ShopWorks API training guide — 3 phases (cost line items / build+send PO / note order), size-annotation cheat sheet, ShopWorks screenshots from Bradley's deck, official ShopWorks Wistia videos. Linked from staff-dashboard Training nav | ✅ Active |
| `/training/sanmar-purchasing-guide.css` | Styles for the SanMar purchasing training guide (print-friendly) | ✅ Active |
| `/training/sanmar-purchasing-guide.js` | SanMar purchasing guide behaviour: print, persistent checklists, back-to-top | ✅ Active |
| `/training/images/sanmar-purchasing/` | 8 ShopWorks screenshots for the SanMar purchasing guide (from Bradley's PPTX; account # redacted) | ✅ Active |
| `/training/shipping-receiving-guide.html` | Shipping & Receiving Clerk training guide (receiving/shipping/pickups/close-day/hand-off) | ✅ Active |
| `/training/shipping-receiving-guide.css` | Styles for the Shipping & Receiving training guide (print-friendly) | ✅ Active |
| `/training/shipping-receiving-guide.js` | Shipping & Receiving guide behaviour: print, persistent checklists, back-to-top | ✅ Active |
| `/training/shopworks-customer-setup.html` | ShopWorks customer setup guide | ✅ Active |
| `/training/shopworks-customer-setup-enhanced.html` | ShopWorks customer setup (enhanced) | ✅ Active |
| `/training/shopworks-embroidery-order-type.html` | ShopWorks embroidery order type guide | ✅ Active |
| `/training/shopworks-notes.html` | ShopWorks notes reference | ✅ Active |
| `/training/shopworks-sales-tax-training.html` | ShopWorks sales tax training | ✅ Active |
| `/training/team-match-game.html` | Team match game (training) | ✅ Active |
| `/training/thank-you-card-guide.html` | Thank-you card guide | ✅ Active |
| `/training/training-games-hub.html` | Training games hub | ✅ Active |
| `/training/server.js` | Local training server (dev only) | ⚙️ Tooling |
| `/training/simple-server.js` | Simple training server (dev only) | ⚙️ Tooling |

### Mockups & Prototypes (`/mockups/` — 11 files)

UI/UX prototypes used during design iteration. Not in production routes.

| File | Purpose | Status |
|------|---------|--------|

### Other Active Directories (file-count summary)

These directories contain code but aren't enumerated at file level — list grows on demand.

| Directory | File Count | Contents |
|-----------|-----------|----------|
| `/admin/` | 4 HTML | Announcements admin, BOGO promo admin, universal records admin |
| `/art-tools/` | 3 HTML | AE art dashboard, AE submit art, art approval |
| `/email-templates/` | 7 HTML | EmailJS templates: BCA customer email, xmas bundle, ready, embroidery, sample request, screenprint customer |
| `/employee-bundles/` | 2 HTML | streich-bros-bundle, wcttr-bundle |
| `/policies/` (root-level) | 8 HTML | Bundle kitting xmas, customer notification SOP, DTG artwork checklist, LTM fee policy, LTM order decision algorithm, payment terms, retail-vs-wholesale policy, sales office procedures |
| `/richardson-caps/` | docs + data only | Richardson is CLOSED (Erik); the page + script were deleted 2026-09-06 (final census). `docs/`, `data/`, `README.md` kept as reference. |
| `/scripts/` | 14 JS | Backfill, validation, prevention, cleanup, doc-freshness, generate-new-products, parse-production-schedule, etc. |
| `/scripts/safety-tools/` | 7 JS | auto-recovery, comprehensive-test-suite, dependency-mapper, error-monitor, file-access-monitor, safe-delete, validate-critical-paths |
| `/templates/` | 5 HTML + 1 JS | Page template (any new page, 2026-09-07), calculator template, email template, emblem email template, laser tumbler EmailJS template, quote service template |
| `/tools/` | 1 HTML | custom-tees-calibrate (the five developer diagnostics were deleted 2026-09-06 — orphans) |
| `/vendor-portals/` | 3 HTML | sanmar-credits, sanmar-invoices, sanmar-vendor-portal |
| `/config/` | 1 JS | app.config.js (central configuration) |
| `/temp/` | 1 JS | verify-dtg-pricing.js (likely cruft — verify and remove) |

### Support & Documentation
| Directory | Purpose | Status | Notes |
|-----------|---------|--------|-------|
| `/admin/` | Administrative tools and utilities | ✅ Active | Backend administration |
| `/art-tools/` | Art department tools | ✅ Active | Design utilities |
| `/caspio-tables/` | Caspio database configurations | ✅ Active | Database schemas |
| `/email-templates/` | EmailJS templates | ✅ Active | Quote email templates |
| `/logs/` | Log and generated files | 🚫 Ignored | Not in version control |
| `/memory/` | Claude AI memory files | ✅ Active | API specs only |
| `/mockups/` | Design mockups | ✅ Active | UI/UX references |
| `/node_modules/` | NPM dependencies | 🔧 Generated | Do not modify |
| `/policies/` | Business policies | ✅ Active | Company procedures |
| `/product/` | Product pages | ✅ Active | Product display system |
| `/scripts/` | Utility scripts | ✅ Active | Contains safety-tools/ |
| `/src/` | Server source code | ✅ Active | Node.js backend |
| `/templates/` | HTML templates | ✅ Active | Reusable components; page-template.html = the skeleton for any new page (2026-09-07) |
| `/tests/` | **Automated Testing Suite** | ✅ Active | **Screen print calculator validation** |
| `/tools/` | Development tools | ✅ Active | Build and dev utilities |
| `/training/` | Training materials | ✅ Active | Staff training docs |
| `/vendor-portals/` | Vendor integrations | ✅ Active | External vendor access |

[Back to the registry index](../../ACTIVE_FILES.md)
