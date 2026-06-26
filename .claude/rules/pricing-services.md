---
paths:
  - "shared_components/js/*-pricing-service.js"
---

# Pricing service rules

Loads when you open a `*-pricing-service.js`. These services are the money path — get them wrong and a customer sees a wrong price.

- **Pricing = API, never hardcoded.** Every price/fee/upcharge/% comes from Caspio (`/api/pricing-bundle`, `Service_Codes`). A hardcoded number is a fallback ONLY and MUST surface a **visible warning** — never a silent wrong price (Erik's #1 rule).
- **Host-gate the manual-cost override.** Any `getManualCostOverride()` reading `?manualCost`/`?cost` MUST gate on `host === 'localhost' || host.endsWith('.herokuapp.com')` — an ungated override lets a crafted/shared link reprice a whole customer session (`?cost=0.01`). All 5 services are locked together by `tests/unit/web-quote-cart-parity.test.js` (`test.each`). **Any NEW `*-pricing-service.js` gets the gate from day one.**
- **3 price surfaces, one engine.** Catalog / Quick Quote / Builders all price via `QuoteCartEngine.singleItemPreview` → Caspio. ANY change here → re-run `web-quote-cart-parity` + `quick-quote-parity` and verify all 3. The catalog price **matrix** re-derives separately (`pdp-configurator buildMatrix`) — verify/lock it too.
- **Missing price component → throw / error-banner, never `|| 0`.** A pricing tier without matching cost-table rows must not silently price at $0 (fall back to the lowest non-LTM tier's costs, then throw if still missing).
- **Falsy-zero:** use `??` not `||` for rates/amounts where `0` is valid; route rate inputs through shared `parseRatePercent`.
