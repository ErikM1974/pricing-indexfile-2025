# ShopWorks Data Entry Standards — Desk Reference

**Date:** 2026-02-15
**For:** Nika Lao, Taneisha Clark
**Purpose:** Clean data entry = clean quotes = correct revenue tracking

> **HTML version with live API prices:** [`/pages/data-entry-guide.html`](/pages/data-entry-guide.html) — accessible from the Staff Dashboard under Training & Reference.

> The 2026 quote builder parses your ShopWorks orders automatically. These rules help it work correctly. When data is entered wrong, the system either guesses (sometimes wrong) or drops the item entirely.

---

## SECTION 1: STOP — Bad Habits to Break

### 1. Stop using separator labels as line items

**What's wrong:** Entering "Transfer", "EMB", "Embroidery", or "DTF" as line items with a blank part number. These aren't services — they're labels that confuse the system.

**Real examples:**
- Order #136554 (Cardinal Baths): "Transfer" entered as a line item separator
- Order #136557 (Cosco Fire): "Embroidery" and "Transfer" labels mixed as items
- Order #136479: "EMB" as a standalone item

**Do this instead:** Put placement/method notes in the ShopWorks **Notes** field at the bottom of the order. The Notes field is designed for free-text instructions.

---

### 2. Stop using person names as line item dividers

**What's wrong:** Entering "Michael Bunce - Tonal Logo" or "Chad Matthew - Tonal Logo" as line items with blank part numbers to group products by person.

**Real example:**
- Order #136556 (Cosco Fire #1): Multiple person-name dividers between product groups

**Do this instead:** If you need to group products by person, use a single note in the Notes field: "Michael Bunce: items 1-3, Chad Matthew: items 4-6". Don't create line items for it.

---

### 3. Stop leaving Part Number blank on priced items

**What's wrong:** Entering a service description with a price but no part number. The system can't track revenue or classify the service correctly.

**Real examples:**
- Order #136562 (Fire Buffs): "Sew-on" at $12.50 with empty PN — should be **SEG**
- Order #136271: "Laser - Customer's Supplies" at $12.50 with empty PN

**Do this instead:** Every priced line item needs a part number. Use this reference:

| Service | Part Number |
|---------|------------|
| Sewing (garment) | **SEG** |
| Sewing (cap) | **SECC** |
| Digitizing (new) | **DD** |
| Digitizing (revision) | **DGT-002** |
| Digitizing (edit) | **DDE** |
| Digitizing (text-only) | **DDT** |
| Monogram | **Monogram** |
| Name embroidery | **NAME** |
| Weight | **WEIGHT** |
| Design transfer | **DT** |
| Patch setup | **GRT-50** |
| Graphic design | **GRT-75** |
| Contract (garment) | **CTR-GARMT** |
| Contract (cap) | **CTR-CAP** |

**See live prices at:** [`/pages/data-entry-guide.html`](/pages/data-entry-guide.html) or [`/calculators/service-price-cheat-sheet.html`](/calculators/service-price-cheat-sheet.html)

---

### 4. Stop using legacy/wrong service codes

**What's wrong:** Typing old codes or typos that the system has to guess about. The parser fixes 13 known typos automatically, but don't rely on it.

**Real examples:** "AONOGRAM" (typo), "EJB" (legacy), "SETUP FEE" (vague), "NAMES" (wrong)

**Do this instead:** Use the exact codes from the table above. See the alias reference at the bottom of this guide for what the system auto-corrects.

---

### 5. Stop mixing decoration types on one order

**What's wrong:** Same ShopWorks order has both "Transfer" items and "Embroidery" items. The quote builder can only generate one type of quote per order.

**Real examples:**
- Order #136554 (Cardinal Baths): Transfer separator + embroidery items
- Order #136557 (Cosco Fire): "Embroidery" and "Transfer" labels mixed

**Do this instead:** Create separate ShopWorks orders — one per decoration method. If a customer needs embroidery AND transfers, that's two orders.

---

### 6. Stop entering AL when you mean Full Back

**What's wrong:** Using AL (Additional Logo) at $40-120/piece. AL is for small secondary logos ($7-10/pc). If the price is that high, it's a Full Back embroidery job.

**Real examples:**
- Order #136257 (Little Wheels QMA): AL at **$120/pc** — this is not an Additional Logo
- Order #136429 (CCNW Commercial): AL at $12.50 — likely a Full Back job

**Do this instead:** If the logo covers the entire back of the garment, use **DECG-FB** (Full Back). AL is only for small secondary logos like a sleeve hit or a small chest logo added to an existing front logo.

| What It Is | Part Number | Price Range |
|-----------|------------|-------------|
| Small secondary logo | **AL** | $7-10/pc |
| Full back embroidery | **DECG-FB** | Stitch-count based |

---

### 7. Stop entering addresses with lowercase states or typos

**What's wrong:** "Wa" instead of "WA", "Antt:" instead of "Attn:". The tax lookup system needs a clean uppercase state code to determine the correct tax rate.

**Real examples:**
- Order #136566: "Wa" instead of "WA"
- Order #136557: "Antt:" instead of "Attn:"

**Do this instead:** Always use 2-letter uppercase state codes (WA, OR, CA, AK). Spell "Attn:" correctly. Include the full 5-digit ZIP code.

---

## SECTION 2: START — Correct Practices

### 1. Always provide a Part Number for every priced line item

No exceptions. If a line item has a dollar amount, it needs a part number. Refer to the service code table in Section 1, item 3 above.

### 2. Use the Notes field for non-product information

The ShopWorks Notes field (bottom of the order) is for:
- Placement instructions ("Left Chest", "Back Logo")
- Person name groupings ("Michael: items 1-3")
- Method labels ("This section is Transfer")
- Special instructions ("Rush — need by Friday")

None of these should be line items.

### 3. Follow the address format

```
Company Name, Street Address, City, ST ZIP
```

- **State:** Always 2-letter uppercase (WA, OR, CA, AK — not "Wa" or "wa")
- **ZIP:** Always 5-digit (or 5+4 with dash: 98402-1234)
- **Attn:** Spell it correctly if needed ("Attn: John Smith")

### 4. One decoration type per order

- Embroidery order → only embroidery items
- Transfer order → only transfer items
- DTG order → only DTG items
- If customer needs both → create two separate orders

### 5. Complete Design Numbers

Format: `Design #:XXXXX - [full description]`

- Include the design name so the quote builder can display it
- Don't leave trailing dashes with no description
- Example: `Design #:39186 - Roadmen Car Club back logo`

### 6. Correct size suffixes on part numbers

| Size | Suffix | Example |
|------|--------|---------|
| 2XL | `_2X` | PC54_2X |
| 3XL | `_3X` | PC54_3X |
| 4XL | `_4X` | PC54_4X |
| 5XL | `_5X` | — |
| 6XL | `_6X` | — |
| One size | `_OSFA` | CP90_OSFA |

Don't combine sizes: `_4/5X` should be separate items for 4XL and 5XL.

---

## SECTION 3: PRE-SUBMIT CHECKLIST

**Check these before saving every order:**

- [ ] Every line item has a Part Number (no blank PNs on priced items)
- [ ] No separator/label rows (Transfer, EMB, person names → moved to Notes)
- [ ] Correct service codes used (DD not "SETUP FEE", SEG not "Sew-on")
- [ ] Ship-to address: uppercase state + 5-digit ZIP
- [ ] One decoration type per order
- [ ] Design number has full description (no trailing dash)
- [ ] AL pricing is $7-10/pc range (if higher → probably Full Back, use DECG-FB)
- [ ] DECG pricing follows tier card (not flat $15-20)
- [ ] Digitizing is DD = $100 (not $50, not $150)

---

## SECTION 4: COMMON ALIAS REFERENCE

The parser auto-corrects these, but entering the correct code saves time and avoids warnings:

| What Reps Type | Parser Maps To | What You Should Type |
|---|---|---|
| AONOGRAM | MONOGRAM | **Monogram** |
| NNAME / NNAMES | NAME | **NAME** |
| NAMES | MONOGRAM | **Monogram** |
| EJB | FB | **DECG-FB** |
| FLAG | AL | **AL** |
| SETUP | GRT-50 | **GRT-50** |
| SETUP FEE | DD | **DD** |
| DESIGN PREP | GRT-75 | **GRT-75** |
| EXCESS STITCH | AS-GARM | **AS-Garm** |
| SEW / SEW-ON | SEG | **SEG** |
| COLOR CHG | COLOR CHANGE | *(rare — ask Erik)* |

The parser fixes these automatically, but entering the correct code in the first place means fewer warnings and cleaner data.

---

**Live reference:** `/calculators/service-price-cheat-sheet.html` — always up-to-date from the database.
**Pricing tiers:** See the Quick Reference Card in the [Pricing Gap Analysis](./REP_TRAINING_PRICING_GAP_ANALYSIS.md#quick-reference-card-for-reps).
