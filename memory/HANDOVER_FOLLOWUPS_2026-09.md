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

- CSS design: the next phase is now mapped in [CSS_UNIFICATION_2026-09.md](CSS_UNIFICATION_2026-09.md), including the audit, shared staff/customer concept, three recommended design decisions and family migration gates. Production migration remains open.
- Browser global-variable audit: `no-undef` and `no-unused-vars` remain disabled in the legacy browser scope. All enabled rules are errors with a zero-warning budget; server/routes/lib use the strict Node scope.
- Frontend development audit: two high findings remain in the presentation-tooling dependency chain; the production audit is zero and CI enforces it.
- Backend dependency/runtime backlog observed during the caller-auth release: Node was unpinned and the production audit reported 15 findings (9 high, 6 moderate). This is separate from the frontend dependency upgrades and is not cleared by the caller-auth patch.
- Memory cleanup: `memory/INDEX.md` did not label a currently indexed file as superseded. No documentation was deleted based on age alone. Its existing deliberate retention notes remain authoritative.

- Transfer/Supacolor caller boundary confirmed by read-only source audit (2026-09-08): the proxy mounts have no earlier authentication. Protect transfer-orders, the separate transfer-order-notes write, and supacolor-jobs only after same-origin staff relays/callers and both authenticated cron scripts are ready. Supacolor Job Detail also needs the existing staff HTML gate. Existing vendor-session/ownership relays already send the secret; public customer mockup mode does not call transfer APIs. Three related vision extraction routes need a separate caller check and matching staff relays/gates. No anonymous business-data probes, writes, notifications or syncs were used. Prioritize this follow-through after the Ruth/Saved Mockups release.

Transfer/Supacolor implementation checkpoint (2026-09-08): frontend now has 28 staff relays in routes/transfers.js, the authenticated 10 MB vision parser before global parsing, six same-origin browser callers and the Supacolor detail HTML gate. The route fixture is updated to 485 registrations / 24 modules in the pending source change. Forty-six mocked relay/vendor unit checks and 20 browser checks pass, including real-server anonymous denials, signed-staff HTML access and customer mockup rendering with no staff transfer fetch. CI explicitly runs the new authentication browser spec. Full frontend release gates remain pending; backend d5fd4f242f17926da88ac5e881106fb89135466f has 1,777 passing unit tests and is held until the caller release is live. Existing production credentials match; no secret values or production business writes were used.
