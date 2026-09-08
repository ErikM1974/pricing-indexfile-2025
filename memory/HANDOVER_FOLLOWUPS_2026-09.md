# Handover follow-ups — 2026-09-07

The approved code-grade work is separate from new product behavior and CSS design. These local tickets give each remaining marker an explicit disposition. No external issue, message or alert was sent.

| Ticket | State | Source | Work and acceptance |
|---|---|---|---|
| SHIP-01 | Planned feature | `lib/shipstation/prepare.js` configured-carrier marker | Replace the existing Stamps.com allowlist only after verifying the account's carrier endpoint and agreeing how carrier removals/outages should behave. Cache the authoritative list, preserve explicit staff routing choices and test cache expiry, removal and upstream failure. The current USPS-only routing is preserved by 22 submission contracts. |
| QUOTE-01 | Requires schema and concurrency design | `routes/public-quotes.js` view-tracking marker | Provision or verify the quote view fields, define what counts as a view, and use an atomic increment/event record rather than the commented read-modify-write example. Tracking failure must never break a customer quote read or disclose it. The feature remains disabled. |
| DOC-01 | Editorial follow-up | `shared_components/js/embroidery-quote-pricing.js` item-type marker | Clarify the old garment-path comment alongside the dedicated `calculateCapProductPrice` flow. Any future change in the API's item-type pricing contract needs real fixture/surface parity; no pricing behavior was changed for this marker audit. |
| HIST-01 | Resolved; historical quotation | `routes/ai-chat.js` former-auth marker | The marker quotes the old unauthenticated state to explain its removal. The current forwarders are gated; this is not an outstanding auth task. Keep the incident context. |
| HIST-02 | Resolved; historical quotation | `calculators/safety-stripe-calculator.js` former-template marker | The marker describes the removed placeholder template that caused silent failures. It is incident history, not a live placeholder implementation. |

Scope checked: tracked JavaScript outside tests, tooling, archives and vendored/minified files, plus the new ShipStation files. Five markers remain in this scope; the original handover's eight was an earlier snapshot. No unclassified TODO/FIXME/HACK marker was found in that scope.

Other explicitly separate work:

- CSS design: override stacks, oversized sheets, DTG and webstore families, and Erik's three brand-page decisions remain for visual design sessions.
- Browser global-variable audit: `no-undef` and `no-unused-vars` remain disabled in the legacy browser scope. All enabled rules are errors with a zero-warning budget; server/routes/lib use the strict Node scope.
- Frontend development audit: two high findings remain in the presentation-tooling dependency chain; the production audit is zero and CI enforces it.
- Backend dependency/runtime backlog observed during the caller-auth release: Node was unpinned and the production audit reported 15 findings (9 high, 6 moderate). This is separate from the frontend dependency upgrades and is not cleared by the caller-auth patch.
- Memory cleanup: `memory/INDEX.md` did not label a currently indexed file as superseded. No documentation was deleted based on age alone. Its existing deliberate retention notes remain authoritative.
