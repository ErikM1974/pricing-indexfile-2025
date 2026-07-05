# EmailJS Templates — Master Reference

> Audited 2026-07-05 across all 3 repos (Pricing Index, caspio-pricing-proxy, Python Inksoft).
> Locate any template's trigger fast: search this file by Template ID or feature.

## ✔️ Content audit (2026-07-05) — CLEAN
Pulled every template's HTML/subject/settings (from the dashboard React `dataSource`) and diffed each `{{variable}}` against the params the code sends. **All 32 active templates: content correct, variables align, recipients sensible.** Custom-tees order emails verified (code DOES send `products_table`/`payment_confirmation`/`customer_email` — full base object at `custom-tees-success.js:271`). `template_customer_mockup` intentionally "reply/call to approve" (no approval button by design). Two cosmetic-only notes (not bugs): `template_art_completed` (CC=`{{cc_email}}`) and `template_art_revision` (CC=`{{reply_to}}`) reference a var the code doesn't send → those internal art notifications never CC anyone (fix only if a rep-CC was intended).

## Services & keys
- **`service_jgrave3`** — client-side `emailjs.send()` (public key `4qSbDO-SQs19TbP80`). Most builder / art / transfer / quote emails.
- **`service_1c4k67j`** — server-side (EmailJS REST + `EMAILJS_PRIVATE_KEY`) AND some client sends (golf, free-sample, custom-tees, christmas). The "ORDER_EMAILJS_SERVICE".
- Python Inksoft (`../Python Inksoft`) uses **NO EmailJS** — its only "email" refs are ShopWorks data fields, not notifications.
- Proxy digests/transfers resolve their template ID from `EMAILJS_TEMPLATE_*` **Heroku config vars** (see each row).

---

## ✅ ACTIVE templates (in EmailJS AND referenced by live code)

### Art Hub (client, `service_jgrave3`)
| Template ID | Display | Trigger (file:line) | Params |
|---|---|---|---|
| `template_art_note_added` | Art Note Added | 13 sites in `pages/js/art-request-detail.js` + `art-actions-shared.js:224` + `mockup-detail.js:5212` + proxy `src/utils/send-art-note-email.js:32` (hardcoded) | to_email, to_name, design_id, company_name, note_text, note_type, header_emoji, header_title, detail_link, from_name |
| `art_approval_request` | Art Approval Request | `art-actions-shared.js:329` (primary + CC loop) & `:1553` (reminder); `art-request-detail.js:5252`; `mockup-detail.js` | to_email, to_name, design_id, company_name, revision_count, message, art_time_display, detail_link, from_name, mockup_url, mockup_images_html, mockup_count, mockup_notes_html · ⚠️ known bug: "View & Approve" link mangles `?view=ae` |
| `template_art_completed` | Art Completed | `art-actions-shared.js:286`; `art-request-detail.js:4836` | to_email, to_name, design_id, company_name, art_minutes, art_cost, detail_link, from_name |
| `template_art_revision` | Art Revisions | `art-actions-shared.js:271`; `art-request-detail.js:4851` | to_email, to_name, design_id, company_name, revision_notes, revision_count, detail_link, from_name |
| `template_art_in_progress` | Art In Progress | `art-request-detail.js:1506` | to_email, to_name, design_id, company_name, detail_link, from_name |

### Mockups (client, `service_jgrave3`)
| Template ID | Display | Trigger | Params |
|---|---|---|---|
| `template_customer_mockup` | Customer Mockup Share | `art-request-detail.js:3876` | to_email, to_name, company_name, design_number, message, mockup_url, approval_url, from_name, rep_email, rep_phone |
| `mockup_customer_approval` | Mockup Customer Approval | `mockup-detail.js:5165` (Ruth) | to_email, to_name, cc_emails, company_name, design_number, design_size, placement, work_order, sales_rep_name, mockup_images_html, mockup_count, approval_link, from_name |

### Quotes (mixed)
| Template ID | Display | Trigger | Service | Params |
|---|---|---|---|---|
| `template_quote_email` | Quote Email | `quote-builder-utils.js:1549` (emailQuote), `web-quote-service.js:629/641`, `quote-management.js:1360` (resend) | jgrave3 | to_email, customer_name, quote_id, quote_link, reply_to, company_name, company_phone |
| `template_quote_accepted_customer` | Quote Accepted — Customer | **server** `server.js:900` | 1c4k67j | to_email, to_name, quote_id, quote_amount |
| `quote_accepted_staff` | Quote Accepted — Sales | **server** `server.js:907` (short ID = 24-char cap) | 1c4k67j | to_email, to_name, quote_id, customer_name, customer_email, company_name, quote_amount, quote_url |
| `template_igd6jtm` | Customer Supplied Screenprint | `calculators/screenprint-customer/screenprint-customer-calculator.js:523` | jgrave3 | to_email, from_name, reply_to, quote_type, quote_id, quote_date, customer_name, customer_email, company_name, customer_phone, project_name, grand_total, products_html, notes, sales_rep_name, sales_rep_email, sales_rep_phone, company_year |
| `webstore` | Webstore | `calculators/webstores-calculator.js:257` | jgrave3 | to_email, from_name, reply_to, quote_type, quote_id, quote_date, customer_name, company_name, customer_email, customer_phone, project_name, notes, grand_total, sales_rep_*, company_year, store_type, annual_volume, logo_count, setup_total, surcharge_info, store_benefits_html, products_html |

### Custom Tees / Samples
| Template ID | Display | Trigger | Service | Params |
|---|---|---|---|---|
| `template_sample_customer` | Custom T-Shirts Order Confirmation — Customer | `custom-tees-success.js:310` | (EMAILJS_SERVICE const) | to_email, to_name, customer_name, order_number, order_date, item_count, subtotal, total, ship_promise, delivery_section, shipping_row, tax_row, ltm_row, rush_flag, rush_banner (triple-brace HTML), questions_cta, message_section, company_phone, reply_to, order_status_url |
| `template_sample_sales` | Custom T-Shirts New Order — Sales | `custom-tees-success.js:317` → erik@ | (EMAILJS_SERVICE const) | same base as sample_customer |
| `template_order_shipped` | Custom T-Shirts Order Shipped — Customer | **server** `server.js:9891` (per-channel `config/storefront-channels.js`) | 1c4k67j | to_email, to_name, order_number, customer_name, carrier, tracking_number, tracking_url, order_status_url, style_name, company_phone, reply_to |
| `template_free_sample` | Free Sample | `pages/top-sellers-showcase.html:740` (inline SampleRequestService) | 1c4k67j | to_email, from_name, reply_to, customer_*, company_name, request_id, request_date, sample_count, delivery_method, samples_html, shipping_*, samples_cost, shipping_cost, tax_amount, total_amount, project_type, estimated_quantity, timeline, notes, company_year, company_phone, next_steps, delivery_timeline |
| `template_wjxuice` | Sample-Order-API | `shared_components/js/sample-order-service.js:414` → erik@ | jgrave3 | to_email, to_name, subject, order_number, company, message, order_date |

### Golf (client, `service_1c4k67j`)
| Template ID | Display | Trigger | Params |
|---|---|---|---|
| `template_golf_customer` | Golf Customer | `golf-tournament-showcase.js:676` | to_email, customer_name, company_name, quote_id, tournament_date, player_count, interests, notes, sales_email, sales_phone, company_phone, reply_to |
| `template_golf_lead` | Golf Leads | `golf-tournament-showcase.js:677` → SALES_REP_EMAILS | to_email, quote_id, lead_score, lead_score_emoji, customer_*, company_name, tournament_date, player_count, interests, notes, submitted_at, utm_*, talking_points, reply_to |

### Transfers / Screenprint (client `service_jgrave3` via `transfer-actions-shared.js`; `transfer_shipped` server)
| Template ID | Display | Trigger | Params |
|---|---|---|---|
| `screenprint_requested` | Screen Print Request to Bradley | `transfer-actions-shared.js` (screenprint channel) | id_transfer, design_number, company_name, customer_name, rep_*, quantity, transfer_size, press_count, line_count, needed_by_date, detail_link, supacolor_num, shopworks_po, estimated_ship_date, rush_reason, current_status |
| `transfer_requested` | transfer_requested | `transfer-actions-shared.js` (transfer channel) | (transfer request fields) |
| `transfer_ordered` | transfer_ordered | `transfer-actions-shared.js` + proxy `send-transfer-ordered-email.js:110` (auto-link) | to_email, to_name, cc_email, id_transfer, design_number, company_name, customer_name, rep_*, supacolor_num, supacolor_location, transfer_type, estimated_ship_date, actor_*, requested_by_name, current_status, detail_link, subject_line |
| `transfer_received` | transfer_received | `transfer-actions-shared.js` | (transfer fields) |
| `transfer_rush` | transfer_rush | `transfer-actions-shared.js` | (transfer fields) |
| `transfer_shipped` | Transfer shipped | **proxy** `send-transfer-shipped-email.js:130` (status mirror) · env `EMAILJS_TEMPLATE_TRANSFER_SHIPPED` | to_email, to_name, cc_email, id_transfer, design_number, company_name, customer_name, quantity, transfer_size, supacolor_num, carrier, shipping_method, tracking_number, tracking_url, date_shipped, requested_by_name, detail_link, subject_line |
| `template_rush_confirm` | Rush Order Confirmation | `art-actions-shared.js:419` (AE) + `:436` (Steve/Ruth) | to_email, to_name, cc_email, ae_name, design_name, company, recipient, detail_link, rush_time, from_name |

### Order Form / Portal / Screenprint request
| Template ID | Display | Trigger | Service | Params |
|---|---|---|---|---|
| `template_order_approved` | Order Approved Form | `pages/order-form/components/customer-approval-view.jsx:402` | jgrave3 | to_email, rep_name, draft_id, order_number, approved_at, customer_*, total_amount, total_qty, summary_html, company_name, company_phone, share_url, reply_to |
| `template_utvx9iw` | Magic Link | **server** `server.js:3072` & `:4186` (portal login) | 1c4k67j | to_email, company_name, magic_link, expiry_minutes |

### Proxy digests & alerts (server-side crons)
| Template ID | Display | Trigger | Env var | Params |
|---|---|---|---|---|
| `template_jg2qvfg` | AE Approval Digest | `src/utils/send-ae-approval-digest.js` (weekday 8AM) | `EMAILJS_TEMPLATE_AE_APPROVAL_DIGEST` | to_email, to_name, ae_name, item_count, scan_date, items_html, dashboard_link |
| `template_1a52tyr` | Orphan Box Folder Digest | `src/utils/send-orphan-digest.js` (1st-of-month 8AM) | `EMAILJS_TEMPLATE_ORPHAN_DIGEST` | to_email, to_name, orphan_count, box_total, caspio_total, dedup_skipped, test_skipped, empty_skipped, scan_date, orphans_html |
| `broken` | Steve Broken Mockups Digest | `src/utils/send-steve-digest.js` + `send-ruth-digest.js` (daily) | `EMAILJS_TEMPLATE_STEVE_DIGEST` (Ruth falls back to same) | to_email, to_name, broken_count, scan_date, records_html, dashboard_link |
| `template_zero_billing` | Zero Billing Alert | `scripts/check-zero-billing.js` (daily ~6:30AM, raw REST) | hardcoded | to_email, rep_name, order_number, customer_name, sanmar_po, items_html, total_cost |

---

## 🗑️ ORPHANS — safe to DELETE from EmailJS (zero live code; git-history confirmed)

| Template ID | Display | Why it's dead |
|---|---|---|
| `template_wlty7o8` | Cap Embroidery Quote | Only ref was `cap-quote-builder.js`, DELETED in commit 6110eb12 (v2026.06.09.4). No successor references it. |
| `template_vpou6va` | Embroidered_Patches | Only refs were emblem calculators, all DELETED (commits 25456d38/30ad33bc/85b1ccdf). |
| `template_3wmw3no` | Embroidery Quote | The `embroidery-quote-service.js` send block was DELETED in 6110eb12; live EMB quote path now uses the engine + `template_quote_email`. |
| `template_6bie1il` | Laser_Tumbler_Template | `laser-tumbler-calculator.js` DELETED in 2155c331 ("delete dead laser code"); live page uses `laser-tumbler-simple.js` (no email). |

---

## ⚠️ MISSING-IN-EMAILJS — live code points at a template NOT in the account → SILENT 400 (no email sent, no error shown)

These are the same class of bug as `template_quote_email` was. Each needs the template CREATED (or the send code removed if the feature is retired). Ordered by impact:

| Template ID | Live code (file:line) | What breaks | Service |
|---|---|---|---|
| ✅ **`ArtInvoice`** | `art-invoice-viewer.js:441` (`art-invoice-config.js:86`) | **CREATED + verified 200 (2026-07-05)** — art invoices to sales rep | jgrave3 |
| ✅ **`template_sample_request`** | `pages/sample-cart.html:1880` | **CREATED + verified 200 (2026-07-05)** — sample-cart order notification (To hardcoded erik@) | 1c4k67j |
| ⚪ `template_fastquote_customer` | `screenprint-fast-quote-service.js:199` | OPTIONAL — Fast Quote customer; tool not linked in nav, nothing fails today | jgrave3 |
| ⚪ `template_fastquote_sales` | `screenprint-fast-quote-service.js:236` | OPTIONAL — Fast Quote sales alert; tool not linked | jgrave3 |
| 🟡 `template_v80ysfp` | `christmas-bundles.html:3729` (inline class) | DEFER to Q4 — Christmas Bundle customer (seasonal, offer expired Oct 2025) | 1c4k67j |
| 🟡 `template_sales_xmas` | `christmas-bundles.html:3759` (inline class) | DEFER to Q4 — Christmas Bundle sales alert (seasonal) | 1c4k67j |
| 🔴 ~~`template_stripe`~~ | `safety-stripe-calculator.js` | **RETIRED 2026-07-05** — dead send removed (TODO stub, orphaned tool) | — |
| 🔴 ~~`adriyella_daily_report`~~ | ~~`training/adriyella-daily-report.html`~~ | **RETIRED 2026-07-05** — feature unused; page + send code deleted | — |

> Verify a create by test-send (see `template_quote_email` fix). If "template ID not found" → create it or delete the dead send.

---

## 🧹 DEAD CONFIG in code (no EmailJS template involved — code cleanup only)

- **`config/app.config.js:22-33`** — the entire `APP_CONFIG.EMAIL.TEMPLATES` map (`template_dtg_quote`, `template_rich_quote`, `template_emb_quote`, `template_embc_quote`, `template_lt_quote`, `template_patch_quote`, `template_spc_quote`, `template_ssc_quote`, `template_web_quote`, `template_art_invoice`) has **zero consumers** — safe to delete the map.
- **Archived files** (under `calculators/archive/…`, not loaded by any live HTML): `Embroidery_Template` + `template_wna04vr` (embroidery-contract), `template_2rlgjio` + `template_af6h6kh` (seasonal-2025 breast-cancer), `template_cap_manual`, `template_f5q2ym5` (manual-pricing-deprecated), `template_christmas_bundle` (`christmas-bundle-service.js`, `<script>` commented out).
- `template_vinyl_quote` — appears only in `memory/QUOTE_BUILDER_GUIDE.md` as a doc example. Ignore.
