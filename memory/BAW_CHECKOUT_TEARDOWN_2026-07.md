# Broken Arrow Wear checkout teardown vs NWCA (2026-07-05)

> Research for the storefront Phase 3 decision ([[STOREFRONT_CHECKOUT_PROPOSAL_2026-07]]).
> Sources: live walk of brokenarrowwear.com in Erik's Chrome (designer, cart, guest-checkout
> modal, how-to-order page) + Erik's 5 screenshots (size/quote grid, cart, login, saved
> designs, designer).

## Their flow (design-first, pay-in-full)

1. **Pick product** (catalog/PDP) → "Design Now"
2. **Designer** — ⚠️ **licensed, not built: "InkSoft Embedded Design Studio" iframe**
   (found in their DOM). Upload Image / Add Text / Add Art on a live garment mockup;
   placement + decoration (screen print / embroidery / digital) chosen as part of the
   design, not as a pricing question. NWCA ran InkSoft for years (Python Inksoft repo
   still syncs InkSoft→ShopWorks) — they license the front half we abandoned.
3. **Step 2: size/qty grid** per color with instant ALL-IN per-piece ladder
   (qty × size-range matrix, "buy more save more") + running order summary → Add to Cart.
4. **Cart**: decoration summary line, **add-ons upsell** (Fold & Bag +$0.65/shirt, Fold
   Only +$0.32), **cross-sell "apply your design to any of these products"** (design
   reuse!), Estimated Tax/Shipping shown as $0.00 until checkout, **Guest Checkout =
   email-address-only modal**, or login (incl. Google SSO) / Retrieve Saved Design by
   email (no password).
5. **Step 3: Shipping/Payment** + **delivery-date-driven checkout** — free date promised
   in the header sitewide ("ORDER TODAY, DELIVERED BY TUE JUL 14" w/ strikethrough slower
   date), rush dates purchasable. Pay in full online.
6. **Proof AFTER payment** (same as our custom-tees `needsArtReview` model).

## Verdict

Their flow is **better for self-serve/first-time buyers** (one continuous session from
design → paid order; live my-logo-on-garment mockup; date promise up front; email-only
guest checkout; upsells). It is **worse for consultative B2B** (no method price
comparison — our PDP shows EMB/DTG/SCP/DTF side-by-side; tax+shipping hidden until the
last step; canvas can't handle complex multi-location/pooled/contract orders).
**NWCA already runs the BAW model** on /custom-tees and /custom-caps — the gap is scope
(2 product families) not architecture. Do NOT replace the quote funnel; extend express.

## Adoption list (ranked, cheapest first)

1. **Delivery-date promise on PDP/cart/header** — "Order today → ships by X" (proxy
   already has production-schedules data). BAW's single strongest conversion device.
2. **Pickup orders can skip the rep gate entirely** — pickup = $0 shipping + fixed Milton
   tax rate, so accept→enable→pay can collapse into ONE session (auto-enable payment link
   on accept for pickup). Biggest funnel unlock without new pricing machinery.
3. **Cart add-ons upsell** via Service_Codes (fold/polybag etc.) — API-driven fees exist.
4. **Cross-sell "apply this to another style"** on quote cart (engine can reprice same
   config on sibling styles — the PDP nudge logic already computes this).
5. **Guest-checkout lightness**: keep quote-save to email-first (Phase #18 capture
   exists); consider passwordless "retrieve by email" like BAW instead of any account.
6. **Phase 3 catalog-express** (the existing proposal): extend the custom-tees pattern
   (upload logo, static placement preview, pay in full, proof after payment) to top-N
   catalog styles. Consider LICENSING a designer (InkSoft embedded studio / DecoNetwork)
   instead of building a canvas — BAW proves buy-not-build works at scale, and NWCA has
   InkSoft integration history.

## Facts worth keeping

- BAW prices are all-in (garment+decoration), same convention as our engine — parity in
  presentation, so a side-by-side price comparison page vs BAW is feasible.
- Their qty ladder shows odd non-monotonic rows (qty 5 pricier/piece than 4 at some
  sizes) — instant-quote table, estimate-only disclaimer.
- Embroidery sold as "Stitch up to 4 inches" (size-based) not stitch-count-based.
- Cart keeps Estimated Tax/Shipping at $0.00 pre-checkout (surprise risk they accept).
