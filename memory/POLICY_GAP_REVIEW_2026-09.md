# Policy gap review — 2026 Canva Meetings & Huddles vs the Policies Hub (2026-09-15)

**What happened:** Erik asked for a pass through every 2026 Canva Meeting and Huddle deck to find content that should be in the Policies Hub. 164 decks (33 Tuesday all-hands, 131 morning huddles; 5 Jan – 25 Sep 2026; ~3,350 slides) were read page by page and compared with the 95 published policies (142 pages incl. chapters), bodies exported from `GET /api/policies-public/tree` the same day. The same day Erik said "go ahead": the findings were then APPLIED to the hub (section "What was written to the hub" below).

**Report:** https://claude.ai/artifact/QY6q9AZiFL5RJXe8ThZD22 — "Huddle-to-Hub Gap Review". Attached file `all-deck-notes.md` (~590 KB) = page-cited extraction notes for every deck (rules, prices, owners, tools, design IDs). That attachment is the durable copy; the session scratchpad that produced it is temporary.

## Headline findings

**6 conflicts (hub says one thing, decks taught another) — Erik still has to decide; NOT changed in the hub**
1. Per-box handling fee: Shipping Procedures + 6-16 cheat sheet say **$4.50/box**; 9-8 and 9-15 shipping trainings/scripts say **$4.00/box**. The new Shipping Charges SOP uses $4.00 "as trained" and both pages carry an "Open item for Erik" note.
2. LTM presentation: hub = separate $50 line for embroidery (≤7 pcs, per-piece price unchanged); 2-6 huddle "included in unit price"; 2-5 training used 1–23 pcs for contract/AL; live builders fold it into unit prices (v2026.09.13.6).
3. Contract Embroidery Guide still says **$40/hour** art cleanup (everything else GRT-75 $75/hr) and has no price list; Caspio contract card changed 2026-09-02.
4. Three stitch-allowance versions: formulas page (8,000 incl., 2024 multiplier model) vs ShopWorks cheat sheet (ES >12,000 @ $0.75/1K) vs 2-17 training (10,000 incl.; +$4 for 10,001–15,000; +$10 for 15,001–25,000; 4 thread colours free, +$1/colour) vs 8-12 Fountainhead ($17 base incl. 10K, +$4 high-stitch). The draft "Embroidery Pricing Structure 2026" lists all of them as open items.
5. Christmas dates: 8-4 "opens Oct 1, final Nov 2" vs every later deck "Oct 1 deadline". The draft "Holiday & Seasonal Order Calendar 2026" shows both readings as "to be settled".
6. Showroom banner "Group Orders 12-piece minimum" vs LTM minimums 8/24/48; golf page digitizing offer read as $100/$109/$189 on different slides — verify live page (flagged in the golf draft).

**Already covered:** the Sept "Day 1–15" huddle series was built FROM the 8-11 order SOPs — no rewrite needed; their slides were appended to the matching policies instead. Production-log reminders (8-11 → 9-15) are an adoption gap, not a wording gap.

## What was written to the hub (2026-09-15, via the proxy admin API, Updated_By = "Claude …")

- **16 new policies created as `Status = Draft`** (owner Erik; invisible on the public tree until he publishes): `business-credit-application-sop`, `where-files-live`, `purchasing-from-sanmar`, `shipping-charges-and-conversations` (the four "paste-ready" SOPs, written from the slides), plus `account-handoff-protocol`, `embroidery-pricing-structure-2026`, `pms-colour-signoff`, `express-ordering-and-ai-artwork`, `holiday-and-seasonal-order-calendar`, `idea-box-sampling-program`, `custom-stickers-and-banners`, `laser-engraving-plates-and-jds`, `golf-tournament-packages`, `upsell-playbook-and-pricing-discipline`, `incentive-programs-2026` (HR — carries a Handbook cross-check table), `staff-tools-directory`. Every price in them is labelled "as taught on <date>" with a "Caspio is the source of truth" banner; open questions are in an "Open items for Erik" section of each page.
- **28 published policies got an appended "From the 2026 huddles: …" section** (rules the decks added + the training slides as images with captions). Two sentences were also corrected in place: Artwork Intake's "email Steve to escalate a rush" → the Rush Order button; Customer Order Pickup's "update ShopWorks" → mark shipped with the Customer Pickup address. The pre-edit bodies were saved in the session scratchpad `backup/<id>.before.html` (temporary); the hub keeps `Updated_At`/`Updated_By`.
- ~270 training slides were exported from Canva as 1600-px PNGs and uploaded to the proxy file store (`POST /api/files/upload` → `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/<externalKey>`), the same store the hub editor uses.

## Hub write path (reuse; all scripts lived in the session scratchpad)
- Admin API: `POST/PUT /api/policies[/:id]` with header `X-CRM-API-Secret` (= `CRM_API_SECRET` in the repo `.env`); `GET /api/policies/:id` returns `Body_HTML`. POST accepts `Policy_ID` and `Status`; default Status is **Published**, so send `"Status":"Draft"`. Public read: `/api/policies-public/tree|/:id`.
- 🔴 **Caspio `Summary` is a 255-char text field** — a longer Summary makes the POST fail with a bare HTTP 500 (no message). Keep ≤ 240. `Body_HTML`/`Body_Plain` max 64,000 (validated, returns 413).
- 🔴 **`/api/files/*` sits behind the proxy `writeLimiter` — 120 requests per 15 min per client IP, and GET `/api/files/<key>` image reads count against the SAME bucket** (verified 2026-09-15: a GET answers `RateLimit-Policy: 120;w=900`; the whole office NAT shares one bucket, and the file GET sets no `Cache-Control`, so every hub page view re-fetches every slide). Five parallel upload agents produced ~50 HTTP 429s; a 30+ agent swarm hit 100% 429s. One paced uploader at ≥ 8 s per request (uploads + reads combined) never trips it. `hub.ps1 upload` never sent `X-CRM-API-Secret`, and `writeLimiter` has no secret-exempt `skip` anyway (sanmar/digitized/monograms/rosters/pricingRead limiters do) — ✅ FIXED on proxy develop 2026-09-15 (Erik chose it): `writeLimiter` now skips CRM-secret callers and meters writes only on `/api/files`, file GETs are `immutable` for a year, locked by `files-write-limiter` + `files-get-cache-control` jest suites; `hub.ps1 upload` now sends the header. ✅ LIVE v2026.09.15.2 / Heroku v1133 (2026-09-15 16:05): live probes confirm anon GET carries no limiter headers, anon POST still `120;w=900`, secret POST exempt, file GET `immutable`.
- PowerShell 5.1 `Add-Content -Encoding utf8` writes a UTF-8 BOM on a new file — strip `﻿` before matching the first row of any log it creates.
- Canva `export-design` (type png, width 1600, `pages` list) returns one presigned URL per page (expires within hours; download immediately). No 10-page cap on export, unlike `read-design` thumbnails.
- Body conventions that render cleanly through the hub's DOMPurify: `<h2>/<h3>`, `<table><thead><tbody>`, `<ul>/<ol>`, `<p><strong>`, `<code>`, `<img src alt>` + `<p><em>caption</em></p>`; HTML entities for quotes; no `<div>`, `<style>`, inline styles.

## Method gotchas (reading the decks)
- Canva MCP `read-design` text export skips flattened training slides; read `thumbnails` (max **10 pages per call**). Presenter notes are empty on every deck.
- `search-designs` relevance results are NOT exhaustive; complete the inventory with weekday-name searches ("Monday 8-3-26") and date-string searches ("8-13-26", limit 3).
- Sonnet subagents can call the Canva MCP tools; ~100 pages per agent ≈ 220K cumulative tokens; 20-concurrent cap; one notes file per deck keeps progress durable. Drafting agents (3 policies each, notes as input, strict HTML/META template, `%%IMG:design:page|alt%%` placeholders resolved at build time) produced publishable drafts with correct "not on the slides" flags.

## Next (Erik)
1. Review the 16 Drafts in the hub editor and publish the ones he accepts (HR item: run the Employee Handbook two-way check first — the draft's cross-check table lists what the handbook would need).
2. Decide the six conflicts, re-reading each number from Caspio first, then edit the losing documents (Shipping Procedures $4.50, LTM Fee Policy, Contract Embroidery Guide $40/hr, Embroidery Pricing Formulas / ShopWorks Cheat Sheet stitch tiers, Christmas dates, the showroom banner and golf page).
3. Skim the 28 appended sections on the live site; each starts with an "Added 15 September 2026" line so it is easy to find and trim.
