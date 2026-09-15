# Carhartt Bucks showroom promotion

Source: Erik's Carhartt Bucks.png; approved September 15, 2026.

## Plan

- [x] Public /carhartt-bucks page, homepage priority banner, replacement seasonal tile, Custom Carhartt placement.
- [x] Staff Dashboard / Sales access, rep toolkit, printable certificate, Forms Library entry, and printable visit log.
- [x] Pacific-time visit / redemption / expired states; accessible clipboard feedback.
- [x] Mobile/desktop, date boundaries, download, staff access, CSS/build and local deterministic checks.

Publication requires a successful exact-source GitHub CI run, then release-tag and Heroku status verification. Release evidence is recorded in GitHub Actions and Heroku release history.

## Offer and design

Visit by September 30, 2026; place a qualifying Carhartt apparel/accessories order of $1,000 or more by October 15, 2026; $100 credit toward that order. One certificate per company; cannot combine with other offers. Appointments preferred; walk-ins 9 a.m.-5 p.m. on the site's established Monday-Friday business days. Showroom: 2025 Freeman Road East, Milton, WA 98354. Phone 253-922-5793. Nika and Taneisha's public email contacts come from the flyer; Mikalah is also named as an issuing rep on the certificate.

Reuse canonical Public Sans, white surfaces, store-green-950 (#122b18), store-green-700 (#2f7d3b), amber-100 (#fef3c7), amber-500 (#f59e0b) and neutral ink. Layout: offer and visit action on the left, original certificate on the right, then the three qualification steps and directions. The flyer is the visual anchor; no invented imagery or unrelated decorative cards.

## Tracking and boundaries

The toolkit offers a copyable customer-account note and a blank printable visit log. Reps keep completed notes in existing customer accounts or retain the printed log; no customer data is stored in a public page or browser-only database. Certificate reference NWCA1977 is NOT wired into checkout or the holiday gift-box invitation system. Credit is verified/applied by the rep at order placement.

Visit phase ends 2026-10-01T00:00:00-07:00. Redemption ends 2026-10-16T00:00:00-07:00. Shared browser behavior rechecks on load, visibility change and every minute. Dates remain explicit without JavaScript; expiration does not issue/redeem a credit automatically.

## Verification

Both one-page PDFs rendered and visually reviewed. Six focused browser cases cover four widths (1440/768/390/320), public/staff pages, four discovery placements, WCAG AA checks, clipboard success/denial, Pacific boundaries, public downloads and anonymous staff denial. The light promotion banner supplies its own canonical accent tokens so dark staff theme buttons retain contrast. Source mappings preserve original brand, catalog and staff content fixtures. Browser navigation contracts explicitly assert the approved campaign links and compare every other historical link. Shared CSS adds one necessary campaign owner; manifest budgets increase by that owner’s measured bytes only. Release target: v2026.09.15.3; local lint/typecheck passed; unit suite 265 suites / 6,355 passed / 26 existing skips; DOM+a11y 12 suites / 92 passed; live pricing and quote-path browser checks 12 passed.
