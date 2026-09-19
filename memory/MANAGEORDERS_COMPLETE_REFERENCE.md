# ManageOrders current implementation notes

The older master reference was removed in the July 2026 memory reset; see
`MEMORY_SYSTEM.md` for archive locations. This file records new integration
work, and does not claim to reconstruct that historical reference.

## Embroidery web quotes (2026-09-19, release target v2026.09.19.2)

- Quote View exposes a staff-only review dialog for WQ quotes. Staff enters an
  existing active ShopWorks customer number, reviews the returned company,
  sizes, locations and subtotal, then confirms a push. Both same-origin POST
  `/api/web-quote-push/preview` and `/push-quote` require staff. Backend counterparts
  require the CRM secret for every request and use the existing write limiter.
- Initial scope: WQ web-cart embroidery garments/caps and known service codes.
  Other methods, missing catalog colors/sizes, unknown fees, recorded online
  payments, and totals that do not foot fail visibly. No partial imports.
- The existing EMB size translation and fee mapping are reused. Base part numbers
  stay unsuffixed; ColorCode is mandatory. Saved line cents are allocated between
  adjacent penny unit prices when rounding requires it; pricing is never rerun.
- Payload: `/onsite/order-push`, APISource `ManageOrders`, existing embroidery
  integration defaults, ExtOrderID `NWCA-{full WQ quote ID}`, `OnHold: 1`,
  `TaxTotal: 0`, no invented tax part/account or payment. Artwork URLs become
  attachments and production options/customer notes remain in order notes.
  Staff must assign the production design and confirm tax, shipping and payment
  before releasing the order. A successful POST means submitted, not imported.
- Preview SHA-256 binds the freshly fetched payload and customer. Confirm reloads
  persisted data and rejects changed previews. Submission uses a Caspio atomic
  conditional PUT on the newest Quote_Sessions PK_ID with empty PushedToShopWorks.
  The reservation value `WQ-REVIEW:{UUID}` blocks retries across processes/restarts.
  Only RecordsAffected=1 may send. Success replaces it with an ISO timestamp;
  a timeout, rejection or failed status save retains the reservation.
- Recovery: find the exact `NWCA-WQ-...` reference in ShopWorks/ManageOrders.
  Do not clear a reservation just because an import is not visible yet. Determine
  whether the request was accepted/queued before manually resolving the marker;
  link a verified imported order through the existing manual WO workflow. There
  is deliberately no force/retry action in the new endpoint.
- WQ's old stale Pending sync value no longer shows Pending import without a
  submission marker or linked order. WQ-REVIEW is shown as needing verification.
- Tests use synthetic customer/quote data and mocked business endpoints. No live
  quote, order, payment, email or artwork submission is part of validation.

### Validation / handoff

- Release target: `v2026.09.19.2` in both repos, through the normal develop/main pipeline.
- 74 Quote View/WQ Playwright checks passed, including 1440/768/390/320 widths,
  keyboard trapping, accessibility, payment/print regressions and intercepted pushes.
- 20 focused backend tests passed; existing EMB design/fee/size regression suites
  also passed. Source-history, staff-auth, route-table and CSS guards passed.
  CSS inventory timed out under parallel load, then passed alone; no timeout raised.
- CSS lint (289 files), changed frontend source ESLint and syntax checks passed.
- Read-only production-data mapping validated WQ-2026-010: 3 garments, $244,
  1 artwork, on hold. Customer selection and real submission remain staff actions.
- Deployment still requires the repositories' normal release gates; deploy backend
  and frontend together. The offline tests do not certify a live OnSite import.
