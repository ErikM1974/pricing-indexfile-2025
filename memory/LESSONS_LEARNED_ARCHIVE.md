

## Gating a shared image route broke every CUSTOMER, and only a real login showed it (2026-08-05)

**Problem.** The Aug 5 Box gating (`b9e9d2a3`) put `/api/box/thumbnail/:fileId` behind
`requireStaff`. Customer-portal artwork is STORED as absolute URLs pointing at exactly that route,
so every proof a customer saw started 401ing. Measured against live data: **92% of art proofs, 8 of
9 mockup proofs, and 100% of the logo library** (128/128) — the whole "My Logos" showcase was blank.
Nobody reported it, because customers do not file bug reports.

**Root cause.** The gate was designed and verified entirely from a STAFF session, where
same-origin + the SAML cookie makes it work. `/portal` is a different identity: `requireCustomer`
sets `req.customerSession.portalCustomer`, which has no `crmUser`, so `requireStaff` rejects it.
The obvious fix — `boxUrl()`, which repointed stored URLs at this origin and fixed all the staff
pages — does **nothing** here: same-origin still lands on `requireStaff`.

**Solution.** A capability, not a relaxation. `portalProofUrl()` rewrites each stored Box URL to
`/api/portal/proof-image/<token>` while projecting rows the server has ALREADY authorized as that
customer's; the token is HMAC-signed (`lib/customer-magic-link`) and binds one fileId to one
customer. The route takes the fileId ONLY from the verified token, so the customer never supplies a
Box id and there is nothing to enumerate — the "any id, any file" power the staff route still has
was deliberately not extended. Not `requireCustomer`-gated, because `/mockup/:id` and
`/art-request/:designId` are public email-link pages whose images must render for a logged-out
customer; when a session IS present it must match, so a token cannot be replayed into another
customer's browser.

**Prevention.**
- 🔑 **"Verify with a real session" is not a formality.** 18 unit tests passed and the whole thing
  was still broken end to end: `portalLimiter` allows 60 req/15 min, and one portal page view is
  **53 images**, so the customer 429'd out of their own portal partway down the page. Nothing short
  of loading a real customer's portal would have found that. Images now have their own budget.
- 🔑 **A gate is per-IDENTITY, not per-origin.** Before gating a shared route, enumerate every
  identity that reaches it — staff SAML, customer portal cookie, logged-out email link, server-side
  callers — and test each. Two of the four here were never considered.
- 🔑 **Two token types signed with the same key need a `t` discriminator**, or a stolen session
  cookie is an image capability and vice versa. Jest-locked both directions.
- 🔑 **A customer route must not inherit a staff forwarder's param allowlist.** Reusing
  `boxForward` also reused `BOX_FORWARD_QUERY` (`full`, `url`, `folderId`, …). The proxy's
  thumbnail route ignores those *today*, so nothing leaked — but the customer route would have
  silently widened the day upstream started honouring one. It now forwards `size` only, and forces
  `Cache-Control: private` rather than echoing upstream, since the response is a per-caller
  capability that must never land in a shared cache.
- 🔑 Distinguish "my code is broken" from "the data is": 2 of the 53 failures were Box files that
  no longer exist (`Item not found`) — a pre-existing dead reference, not the fix. Check the asset
  before blaming the change.
- Drift guard: `tests/unit/portal-proof-image.test.js` fails if any Box-carrying field in the four
  portal projections stops going through `portalProofUrl` — an unwrapped field is invisible, it
  just renders broken for a customer who will never tell you.

---
