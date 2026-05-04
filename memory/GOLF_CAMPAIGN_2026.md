# Golf Tournament Campaign 2026 — Launch Kit

**Campaign:** Summer 2026 Golf Tournament Apparel
**Landing page:** `pages/golf-tournaments-2026.html` (LIVE)
**Product detail page:** `pages/golf-tournament-product.html?style=XXX` (LIVE)
**Funnel:** MailChimp email → Landing page → (optional product detail) → Form → Sales team
**Built:** 2026-05-04 (revised same day with offer + page updates)

---

## Locked-in decisions

| Decision | Choice |
|---|---|
| **Hero offer** | Free $100 logo digitizing + free embroidered OGIO Vision 2.0 Golf Bag (SanMar style 425044, $189 MSRP) — on orders with **$2,000+ subtotal**. Bag goes to whoever the customer chooses (tournament organizer, scramble winner, raffle prize, or themselves) |
| **Fulfillment** | Pickup at our Milton factory OR ship to office/golf course (customer's choice; confirmed in quote) |
| **Date scope** | Summer 2026 — June, July, August. Hard offer deadline: **August 31, 2026** |
| **Standard turnaround** | **14 business days** from logo approval (NOT 7). Order early. Rush available for an extra fee. |
| **Customer-facing email** | `sales@nwcustomapparel.com` (NOT individual rep email) |
| **Customer-facing phone** | `253-922-5793` — labeled "Call or Text" |
| **Internal lead routing** | Lead-alert email goes to **Taneisha + Nika + Erik** (`taneisha@nwcustomapparel.com, nika@nwcustomapparel.com, erik@nwcustomapparel.com`) |
| **Lead persistence** | Saved to Caspio `quote_sessions` table with prefix `GOLF` (e.g. `GOLF0504-1`). Status `Open`, 30-day expiry. Tournament details packed into `Notes`. Confirmed working 2026-05-04 (test record `PK_ID: 1519` — safe to delete). |
| **List segment** | Send to all 5,000 in round 1. Build engaged-subset segment for follow-up drip (Day 2/5/10) |

---

## 1. What's built

| Asset | File | Status |
|---|---|---|
| Landing page | [pages/golf-tournaments-2026.html](../pages/golf-tournaments-2026.html) | ✅ Live |
| Product detail page | [pages/golf-tournament-product.html](../pages/golf-tournament-product.html) | ✅ Live |
| Landing page styles | [shared_components/css/golf-tournament-showcase.css](../shared_components/css/golf-tournament-showcase.css) | ✅ Live |
| Detail page styles | [shared_components/css/golf-tournament-product.css](../shared_components/css/golf-tournament-product.css) | ✅ Live |
| Landing page JS | [shared_components/js/golf-tournament-showcase.js](../shared_components/js/golf-tournament-showcase.js) | ✅ Live |
| Detail page JS | [shared_components/js/golf-tournament-product.js](../shared_components/js/golf-tournament-product.js) | ✅ Live |
| ACTIVE_FILES.md entries | All 5 files registered | ✅ Done |

**Architecture:**
- Landing page fetches the live Garment Tracker config + live embroidery pricing for all 24 preferred styles. Update prices in Caspio → page reflects within 5 minutes.
- Each product card on the landing page links to the **detail page** (clean catalog look — colors, sizes, full description, all 5 pricing tiers).
- Detail page CTA "Request Quote for This Style" links back to the landing page form with the style pre-filled into the notes + the right category checkbox auto-checked.
- Same `EmbroideryPricingService` is used by both pages AND the Embroidery Quote Builder — quotes the sales team generates match what customers see online.

**Smoke test results (2026-05-04):**
- 24 product cards render with live prices ($87/$86/$85/$85 for TM1MU410 across qty 24/48/72/144)
- 5-tier full pricing table renders on detail page (1-7, 8-23, 24-47, 48-71, 72+)
- Example package: $7,560 for 72 players (polo + towel) + $289 bonus value (free $100 digitizing + $189 OGIO golf bag)
- Detail page: 10 colors, 6 sizes, full description rendered for TM1MU410
- Prefill flow works: detail page → landing page form → notes pre-filled with friendly product name + correct category auto-checked
- Zero console errors

---

## 2. Things YOU need to do before launch

### A. Create 2 EmailJS templates

Service: `service_1c4k67j`
Public Key: `4qSbDO-SQs19TbP80`

#### Template 1: `template_golf_customer` — customer confirmation

**Subject:** `Got it — your tournament quote is in motion (Quote {{quote_id}})`

**To:** `{{to_email}}`
**Reply-to:** `{{reply_to}}` (resolves to `sales@nwcustomapparel.com`)
**From name:** `Northwest Custom Apparel Sales`

**Body:**
```
Hi {{customer_name}},

Thanks for your tournament apparel inquiry! Our sales team has your details
and will follow up within 1 business day with itemized pricing.

YOUR REQUEST
  Company:           {{company_name}}
  Tournament date:   {{tournament_date}}
  Player count:      {{player_count}}
  Items of interest: {{interests}}
  Notes:             {{notes}}

YOUR QUOTE ID
  {{quote_id}}
  (Reference this when we talk.)

Want to talk now? Call or text us at {{sales_phone}}, or reply to this email.

— Northwest Custom Apparel Sales Team
  {{sales_email}} · {{company_phone}}
  Family owned in Milton, WA since 1977

Reminder: standard production is 14 business days from logo approval —
book early to lock in your tournament date.
```

**EmailJS variables:**
`to_email, customer_name, company_name, quote_id, tournament_date, player_count, interests, notes, sales_email, sales_phone, company_phone, reply_to`

#### Template 2: `template_golf_lead` — internal lead alert (to Taneisha + Nika)

**Subject:** `{{lead_score_emoji}} GOLF LEAD ({{lead_score}}): {{company_name}} — {{player_count}} players, {{tournament_date}}`

**To:** `{{to_email}}` (resolves to `taneisha@nwcustomapparel.com, nika@nwcustomapparel.com`)
**Reply-to:** `{{reply_to}}` (the customer's email)

**Body:**
```
NEW GOLF TOURNAMENT LEAD
{{lead_score_emoji}} Lead score: {{lead_score}}

Quote ID: {{quote_id}}
Submitted: {{submitted_at}}

CUSTOMER
  Name:    {{customer_name}}
  Company: {{company_name}}
  Email:   {{customer_email}}
  Phone:   {{customer_phone}}

TOURNAMENT
  Date:           {{tournament_date}}
  Player count:   {{player_count}}
  Interests:      {{interests}}
  Notes:          {{notes}}

ATTRIBUTION
  Source:    {{utm_source}}
  Campaign:  {{utm_campaign}}
  Medium:    {{utm_medium}}

SUGGESTED FIRST-CALL TALKING POINTS
  {{talking_points}}

---
Reply to this email to go directly to the customer.
Standard turnaround: 14 business days from logo approval. Lead with the Summer Bonus
($100 digitizing + free OGIO Vision 2.0 golf bag at qty 72+).
```

**EmailJS variables:**
`to_email, quote_id, lead_score, lead_score_emoji, customer_name, customer_email, customer_phone, company_name, tournament_date, player_count, interests, notes, submitted_at, utm_source, utm_campaign, utm_medium, talking_points, reply_to`

---

### A.5. Lead persistence (already wired)

When a customer submits the form, **3 things happen in this order**:

1. **Caspio write** — A `quote_sessions` row is created with prefix `GOLF` (e.g. `GOLF0504-1`). Customer name/email/phone, company, player count, and tournament-date/interests/notes (packed into the Notes field) are saved. 30-day expiry. Status: `Open`. Implemented via the standard [base-quote-service.js](../shared_components/js/base-quote-service.js) class — same pattern as DTG, EMB, RICH, etc. quote builders.
2. **Customer confirmation email** — fires via EmailJS template `template_golf_customer` to the customer's address.
3. **Internal lead alert** — fires via EmailJS template `template_golf_lead` to **Taneisha, Nika, AND Erik** in parallel.

**Failure handling:** If Caspio is unreachable, the form still submits — a fallback random Quote ID is generated and EmailJS still fires. Lead never gets silently dropped. Console logs the full lead payload as a final backup.

**To search leads in Caspio:** filter `quote_sessions` by `QuoteID` starting with `GOLF`. Or query `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions?quoteID=GOLF0504-1`.

### B. Build the MailChimp campaign

**Send mechanics:**
- **From:** `Northwest Custom Apparel Sales <sales@nwcustomapparel.com>` (consistent with the landing page contact)
- **Reply-to:** `sales@nwcustomapparel.com`
- **Send time:** Tuesday or Wednesday, 9:30 AM Pacific
- **Soft launch:** 250 first (5%), wait 48 hours, then send to remaining 4,750 with the winning subject line

**Subject line A/B test:**
- **A:** `🏌️ Free $100 setup + free OGIO golf bag for your summer tournament`
- **B:** `Outfit your June-August golf tournament — embroidered polos from $80/player`

**Pre-header:**
`TravisMathew, Nike & OGIO with your logo embroidered. Order 72+ players and we'll comp the $100 digitizing fee + ship a free embroidered OGIO Vision 2.0 golf bag for the tournament organizer.`

**Email body:**

```
[HERO IMAGE: Embroidered TravisMathew polo on a golf course
 OR a composite of the OGIO Vision 2.0 Golf Bag + tournament shirts]

Planning a company golf tournament this June, July, or August?

Outfit every player in premium TravisMathew, Nike, or OGIO apparel
with your company logo embroidered — and impress them before
the first tee.

🎁 SUMMER 2026 TOURNAMENT BONUS
Order 72+ embroidered pieces and we'll cover:
  ✓ Your $100 logo digitizing fee — FREE
  ✓ A FREE OGIO Vision 2.0 Golf Bag ($189 value) embroidered
    with your tournament logo — give it to the organizer,
    raffle it off, or take it home yourself

WHY NWCA TOURNAMENT PACKAGES:
  ✓ TravisMathew, Nike, OGIO, Sport-Tek polos & 1/4-zips
  ✓ Port Authority golf towels & hats
  ✓ Volume pricing locked at 24, 48, 72 & 144 players
  ✓ 8,000-stitch logo embroidery included
  ✓ In-house embroidery — 14-business-day standard turnaround
  ✓ Trusted by Pacific NW companies since 1977

[PRIMARY CTA BUTTON]
See Tournament Apparel & Pricing →
```

**CTA URL:**
`https://www.teamnwca.com/pages/golf-tournaments-2026.html?utm_source=mailchimp&utm_campaign=golf-2026-q2&utm_medium=email`

**Closing:**
```
A 72-player polo package starts at $80/player embroidered.
Standard production is 14 business days from logo approval —
book by August 31, 2026 to lock in the bonus.

Questions? Reply to this email, call or text 253-922-5793,
or email sales@nwcustomapparel.com.

— Northwest Custom Apparel Sales Team
  Family owned in Milton, WA since 1977
```

---

### C. Build the 3-touch follow-up automation in MailChimp

| Day | Trigger | Subject |
|---|---|---|
| Day 2 | Opened email but didn't click | `Quick look: 60-second tournament apparel walkthrough` |
| Day 5 | Clicked landing page but didn't fill form | `Still planning your tournament? Production fills up fast at 14 business days out` |
| Day 10 | Clicked but didn't convert | `Last call — June/July tournament production booking up` |
| Day 21 | Form filled but didn't order | Manual personal email from Taneisha or Nika |

---

## 3. Lead routing & sales playbook

When a lead alert email arrives at `sales@`/Taneisha/Nika:

1. **Within 1 business day** (the only commitment we make on the page): personal response with:
   - Acknowledgment of their tournament date
   - Quote built in [Embroidery Quote Builder](../quote-builders/embroidery-quote-builder.html) (matches landing page math)
   - PDF + shareable URL for the quote
   - Mention the Summer Bonus eligibility based on their player count

2. **Lead scoring** (auto-included in alert email):
   - 🔥 **HOT** — Tournament date < 60 days + 72+ players (production deadline tight; may need rush fee)
   - 🟡 **WARM** — Tournament date < 90 days OR 48+ players (lead with Summer Bonus to upsell to 72)
   - 🟢 **STANDARD** — Everything else (educate on tier breakpoints to unlock the bonus)

3. **Talking points** auto-generated per lead score in the alert email.

---

## 4. Verification checklist before launch

- [ ] EmailJS template `template_golf_customer` created and tested
- [ ] EmailJS template `template_golf_lead` created and tested
- [ ] Submit a test lead from `golf-tournaments-2026.html`, confirm both emails arrive
- [ ] Test on iOS Safari + Chrome mobile (50%+ of B2B email clicks are mobile)
- [ ] Click into a product detail page from a card — colors/sizes/description render
- [ ] Click "Request Quote for This Style" on detail page — form pre-fills correctly with style + auto-checks category
- [ ] Pricing parity: pick 3 styles, compare landing page price at qty 72 vs Embroidery Quote Builder result (8K stitches, 1 logo). Must match to the cent.
- [ ] Add hero photo for the email (the landing page itself uses a green gradient + the bag image — both work; a real golf-course shot would be stronger for the email hero)
- [ ] MailChimp campaign drafted and previewed (at minimum: Gmail, Outlook desktop, iOS Mail)
- [ ] Soft launch to 250 contacts, watch open/click for 48 hours
- [ ] Send to remaining 4,750 with winning subject line

---

## 5. Files & reference

| File | Purpose |
|---|---|
| [pages/golf-tournaments-2026.html](../pages/golf-tournaments-2026.html) | Landing page |
| [pages/golf-tournament-product.html](../pages/golf-tournament-product.html) | Per-style detail page (`?style=XXX`) |
| [shared_components/js/golf-tournament-showcase.js](../shared_components/js/golf-tournament-showcase.js) | Landing page logic — change EMAILJS service/template IDs, sales rep emails here if needed |
| [shared_components/js/golf-tournament-product.js](../shared_components/js/golf-tournament-product.js) | Detail page logic |
| [shared_components/css/golf-tournament-showcase.css](../shared_components/css/golf-tournament-showcase.css) | Shared styles (header, footer, hero, product grid) |
| [shared_components/css/golf-tournament-product.css](../shared_components/css/golf-tournament-product.css) | Detail-page-only styles (gallery, swatches, size pills, full pricing table) |
| `https://.../api/garment-tracker/config` | Source of the 24 preferred styles |
| `https://.../api/products/search?q=STYLE` | Source of color swatches, sizes, description, image gallery |
| `https://.../api/pricing-bundle?method=EMB&styleNumber=XXX` | Per-style live pricing |
| [calculators/christmas-bundles.html:3727-3766](../calculators/christmas-bundles.html:3727) | EmailJS dual-fire pattern this funnel mirrors |

**Plan archived at:** `~/.claude/plans/what-i-need-you-clever-ember.md`
