# Policy gap review — 2026 Canva Meetings & Huddles vs the Policies Hub (2026-09-15)

**What happened:** Erik asked for a pass through every 2026 Canva Meeting and Huddle deck to find content that should be in the Policies Hub. 164 decks (33 Tuesday all-hands, 131 morning huddles; 5 Jan – 25 Sep 2026; ~3,350 slides) were read page by page and compared with the 95 published policies (142 pages incl. chapters), bodies exported from `GET /api/policies-public/tree` the same day.

**Deliverable (report only — nothing was written to Caspio):** https://claude.ai/artifact/QY6q9AZiFL5RJXe8ThZD22 — "Huddle-to-Hub Gap Review". Attached file `all-deck-notes.md` (~590 KB) = page-cited extraction notes for every deck (rules, prices, owners, tools, design IDs). That attachment is the durable copy; the session scratchpad that produced it is temporary.

## Headline findings

**6 conflicts (hub says one thing, decks taught another) — fix first**
1. Per-box handling fee: Shipping Procedures + 6-16 cheat sheet say **$4.50/box**; 9-8 and 9-15 shipping trainings/scripts say **$4.00/box**.
2. LTM presentation: hub = separate $50 line for embroidery (≤7 pcs, per-piece price unchanged); 2-6 huddle "included in unit price"; 2-5 training used 1–23 pcs for contract/AL; live builders fold it into unit prices (v2026.09.13.6).
3. Contract Embroidery Guide still says **$40/hour** art cleanup (everything else GRT-75 $75/hr) and has no price list; Caspio contract card changed 2026-09-02.
4. Three stitch-allowance versions: formulas page (8,000 incl., 2024 multiplier model) vs ShopWorks cheat sheet (ES >12,000 @ $0.75/1K) vs 2-17 training (10,000 incl.; +$4 for 10,001–15,000; +$10 for 15,001–25,000; 4 thread colours free, +$1/colour) vs 8-12 Fountainhead ($17 base incl. 10K, +$4 high-stitch).
5. Christmas dates: 8-4 "opens Oct 1, final Nov 2" vs every later deck "Oct 1 deadline"; no holiday-deadline policy exists (Carhartt Bucks Sep 30/Oct 15, gift boxes Oct 15, BCA tees Oct 1–31 also undocumented).
6. Showroom banner "Group Orders 12-piece minimum" vs LTM minimums 8/24/48; golf page digitizing offer read as $100/$109/$189 on different slides — verify live page.

**16 new policies** (ranked; first four are complete in the decks and can be pasted): Business Credit Application SOP (8-18) · Where Files Live drive map S/X/W/K/T/R/B + Brother printer (8-25) · Purchasing from SanMar 13 steps + size-column annotation table (7-10) · Shipping charges & conversations + ShipStation/Stamps/WorldShip decision rule + Six Facts (9-8, 9-15) · Account assignment & hand-off protocol (1-19 → 2-5) · Embroidery pricing structure 2026 (2-5, 2-17, 6-23, 8-12) · PMS colour sign-off (6-4/6-5 + "Production Ready" deck) · Express Ordering & AI-artwork orders (6-12 → 6-19, 8-20) · Holiday/seasonal order calendar (8-4 → 9-15) · Idea Box Gold-Account sampling (2-23) · Stickers & banners: Roland minimums + price table (2-13) · Laser/plates/JDS drinkware ($25/plate slide never explained — verify in Service_Codes) · Golf tournament packages (3-13, 5-5) · Upsell playbook + Fountainhead pricing discipline (6-23, 7-8/9, 8-12) · 2026 incentive programs (Report Card, towel tiers, Go Home Early, Q3 Embroidery Bonus) · Staff tools directory (30+ tools announced in huddles, none documented).

**22 updates to existing policies** — itemised in the artifact (Part 3) with deck + page cites; biggest: "invoice art charge must exceed Steve's logged charge" (taught weekly Jan–Aug, never written), Rush Order button procedure, Source-of-Truth art gate (3-31), Box Labels PAID/NOT PAID rule, UPS My Choice intercept (1-16), all the coverage plans (Safety Net, Plan A/B/C, AE Plan A/B, Erik-away, Vacation Delivers WOW), Red Light trademark specifics, DTG garment avoid list, "quote by fabric not preference", phone extension/ring flow, fundraising W-9/1099, vendor contact refresh (SanMar rep Cherie, Absolute Heating, Chris' Plumbing, Ed @ L&P, JDS, Trotec).

**Already covered:** the Sept "Day 1–15" huddle series was built FROM the 8-11 order SOPs (Quote vs Order, Financial Release, Stop Authority, Proofs & Changes, customer-supplied, substitutions/rush, holds, cancellation, payment release, complaints) — no rewrite needed. Production-log reminders (8-11 → 9-15) are an adoption gap, not a wording gap.

## Method gotchas (reuse next time)
- Canva MCP `read-design` text export skips flattened training slides; read `thumbnails` (max **10 pages per call**, images come back inline and are legible at 596×335). Presenter notes are empty on every deck.
- `search-designs` relevance results are NOT exhaustive (4 pages of "Huddle" never returned Huddle 8-13-26 or "Huddle Financial Release 8-14-26"); `modified_descending` skipped whole months. Complete the inventory with weekday-name searches ("Monday 8-3-26") and date-string searches ("8-13-26", limit 3).
- Sonnet subagents can call the Canva MCP tools; ~100 pages per agent ≈ 220K cumulative tokens; 20-concurrent cap; writing one notes file per deck keeps progress durable.
- Policy bodies: `policies-tree.json` from the proxy includes `Body_Plain` for every policy — split to one .txt per Policy_ID and grep.

## Next
Erik decides; none of the findings are applied. A follow-up session can draft the four ready SOPs into Caspio via the hub's admin editor, after the conflict numbers are re-read from Caspio (Erik's rule: API is the source of truth). HR-adjacent items (coverage, no-contact, incentives) need the Employee Handbook two-way check before publishing.
