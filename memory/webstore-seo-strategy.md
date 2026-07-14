# Webstore SEO — hub, spokes & the data-driven niche priority

**Hub page:** `/company-webstores` ([pages/company-webstores.html](../pages/company-webstores.html)) — targets the B2B
"company store / team store / employee uniform store" cluster; golf-showcase template + `pages/css/company-webstores.css`.
10 store-type cards. Legacy `/webstore-info.html` 301s here; `/pages/webstore-info.html` noindex+canonical. Platform = InkSoft
(never named on-site, per Erik).

## Where the InkSoft (webstore) order data lives — how to re-run the analysis

InkSoft/online-store orders in NWCA data = **`ManageOrders_Orders` where `id_OrderType=31` and `sts_Invoiced=1`**
(`Is_InkSoft` is a Caspio formula — can't filter formulas via API, so use `id_OrderType=31`; see
`caspio-pricing-proxy/src/routes/online-store-commissions.js`). Useful fields: `CustomerName`, `ParentCompany`,
`cur_SubTotal`, `date_Invoiced`, `id_Customer`, `CustomerServiceRep`. Aggregate by `ParentCompany||CustomerName`.

## The finding (2026-07-14, Jan–Jul 2026: 1,274 orders, 63 companies, $212.8K subtotal)

**NWCA's webstore business is B2B — construction, property management, hospitality, industrial, government — NOT the
schools/teams/fundraising InkSoft markets.** Top customers: Hops N Drops ($52K, restaurant), Absher Construction ($36K/423
orders!), Stella-Jones ($30K, industrial), Arrow Lumber ($18K, retail/building supply), Forma/Pro Vac/Emerald Fire/GNW
(construction & trades), AMC Properties + a huge tail of apartment communities (property management — a repeatable
store-per-community model), Puget Systems/Shift Innovations (tech cos), Pierce County/City of Tukwila/US Forest Service/
Puyallup Police (government), Mud Bay (pet retail), United Wound Healing (healthcare). **Almost ZERO schools/teams/nonprofits/
Greek** despite those being InkSoft's marketed niches.

## Data-driven spoke-page priority (build in this order)

1. **Construction & trades company stores** — #1 by volume + revenue (Absher, Forma, Pro Vac, Emerald Fire, GNW, Prospect).
2. **Property management / apartment-community stores** — dominant tail; the store-per-community model NWCA has cracked (AMC).
3. **Restaurant & hospitality stores** — Hops N Drops is the single biggest customer.
4. **Industrial / manufacturing company stores** — Stella-Jones, Rainier Pure Beef.
5. **Retail / building-supply / brand stores** — Arrow Lumber, Capital Lumber, Mud Bay.
6. **Government / municipal stores** — Pierce County, cities, police, Forest Service.
Tier 3 (InkSoft-popular but NOT current NWCA business — speculative expansion, lower priority): school spirit, team,
fundraising, college/Greek, nonprofit.

**InkSoft's own advice matched the data:** target specialized/underserved groups + mine your order history; they flag
nonprofits/schools as *their* most profitable, but NWCA's actual money is B2B company stores. Build spokes for the proven
winners first. Each spoke: hero + why-this-niche + recommended products + how-it-works + FAQ + CTA to /pages/webstore-inquiry.html,
links back to the hub, real customer angle where possible. Related: [[blog-content-differentiation]] (industry blog posts
already cover breweries/restaurants/etc. — cross-link spokes ↔ those posts).
