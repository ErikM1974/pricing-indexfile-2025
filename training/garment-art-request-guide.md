# Submitting a Garment Art Request to Steve — AE Guide

This guide explains the **Submit Artwork to Steve → Garment** form on the AE Dashboard
(`teamnwca.com/ae-dashboard.html`). The form was rebuilt 2026-06-17 so every art request
arrives **complete and structured** — Steve should never have to guess or interpret long
notes. Fill in each section, run the final checklist, then submit.

> **The rule:** Steve doesn't receive a request until the required fields are complete.
> The form blocks submission if anything required is missing.

---

## The sections, in order

### 1. Customer & Order
- **Company*** — start typing to search; picking a company auto-fills the SW Cust# and contact list.
- **Contact Name*** — who at the customer this is for.
- **Due Date*** — defaults to 3 business days out; change as needed.
- **Design #*** — the ShopWorks design number. Type it and tab out; it's checked against ShopWorks. New design? Just type a new number.
- **Order #*** — the ShopWorks order number. Click to browse the customer's recent orders.
- **Art Estimate from AE** — optional GRT charge code if you're quoting art time.
- **Rush** — tick only if Steve genuinely needs it ASAP.

### 2. Artwork Status* & Approval Status*
- **Artwork Status** replaces the old New Artwork / Mockup toggle. Pick one:
  - *New artwork from scratch* — Steve designs it.
  - *Mockup only* — place an existing logo on a garment.
  - *Revision to existing proof* — change something on a proof already made.
  - *Repeat from previous order* — re-run a previous design (reveals section 8).
  - *Final approved / production ready* — the proof is already approved and this is just routing it.
- **Approval Status** — where the proof stands with the customer. If you choose
  **"Customer approved — ready for production,"** a reminder appears: *approved means
  final.* Steve may then prepare screens / production files, and changes after that may
  delay the order or add charges.

### 3. Decoration Method
Tick every method that applies (Screen Print, DTG, Embroidery, Transfer, etc.). Not sure?
Tick **"Not sure — Steve to advise."**

### 4. Garment / Product
One row per garment. Type a **style #** (e.g. PC54) and tab out — the **color** dropdown
loads automatically with a swatch. Add up to 4 garments. Non-SanMar style? Type the color
by hand.

### 5. Artwork Placement & Size
**One block per print location.** Give the **placement** (Left Chest, Full Back, Cap Front…),
the **width** in inches (required), the height if it matters, and short **placement
instructions** (e.g. *"centered, 2.5" down from collar"*). Add a location for the back, a
sleeve, etc.

### 6. Artwork Colors
- **Color Direction*** — exact PMS, closest match, match previous order, black/white only,
  full color, or "Steve to recommend."
- **PMS Colors / Thread Colors** — fill in if you know them.
- **Underbase on dark garments** — Yes / No / Steve to decide.

### 7. Exact Text in Artwork
Type the **exact** wording, spelling, dates, names, and phone numbers that go in the design.
Double-check spelling here — this is what Steve reproduces letter-for-letter. No text in the
design? Tick **"This design has no text."**

### 8. Previous Order / Design Reference
Required for a **repeat** or **revision**. Give the previous order # and design #, **what
should stay the same**, and **what should change**.

### 9. Files & File Type
Pick **what was provided** (vector / raster / screenshot / logo from previous order / nothing
usable), then drag in the files (.AI, .EPS, .PDF, .PNG, .JPG, .SVG, 20 MB each). Bigger than
20 MB? Upload to Box and paste the link in the notes. You must either attach a file, give a
previous design #, or mark "no usable artwork."

### 10. Additional Art Notes
**Short bullet points only.** Do **not** put size, placement, color, wording, or approval
status here — those each have their own field above. This box is for anything that doesn't fit.

### 11. AE Final Checklist
Confirm each item before submitting. If you marked **Customer approved**, the whole checklist
must be complete — including that the customer reviewed the final proof and understands
post-approval changes may delay the order or add charges. Use **Check all** when everything
is genuinely true.

---

## What "approved" means

**Approved = the artwork is final and production-ready.** Once a request is marked
*Customer approved — ready for production*, Steve may prepare screens, digital files, or
production files. Any change after that is a **post-approval change order** and may delay the
order and add charges.

Recommended wording to the customer before approval:
> *"Please review the artwork carefully for spelling, layout, color, size, and placement.
> Once approved, the file will be prepared for production. Changes after approval may delay
> your order and may require additional charges."*

---

## Quick how-tos

- **Repeat order** → Artwork Status = *Repeat from previous order* → fill section 8 (previous
  order #, design #, keep-same, changes).
- **Revision** → Artwork Status = *Revision to existing proof* → section 8 (previous design #
  and **what changes** are required).
- **Avoid long confusing notes** → put each detail in its proper field (placement, size,
  color, exact text). Keep section 10 to short bullets only.

---

## Rep Reference Mockup (Easy Shirt Designer)

On any art request (staff/AE view — never the customer view), the **🧵 Build Mockup** button
opens the Easy Shirt Designer pre-filled with that job's garment color, placement, and company.
Add the artwork (incl. Tajima **DST**), set thread colors + placement, then click
**💾 Save to Art Request**. The mockup attaches back as a purple **"Rep Reference Mockup"** card
(with garment / placement / thread specs) and prints on the job sheet.

- It is a **reference for Steve** — it does **not** become the customer proof and does **not**
  change Approval Status. Steve still creates and approves the production mockup.
- Customers never see it. **Re-edit** re-opens the designer pre-seeded, but you re-upload the
  artwork (the designer doesn't keep the source file).

---

*Form: `shared_components/js/garment-submit-form.js`. Submissions post to ShopWorks via
`/api/artrequests` and appear on Steve's dashboard, the AE galleries, and
`/art-request/{design#}` with every field rendered structurally.*
