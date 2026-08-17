---
name: policy-corpus-bulk-read
description: How to pull all 138 live Policies Hub bodies in one unauthenticated call — /api/policies-public/tree carries Body_Plain
metadata: 
  node_type: memory
  type: reference
  originSessionId: 17035815-d520-407a-956a-54f491d4893f
  modified: 2026-08-11T22:47:45.216Z
---

**`GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/policies-public/tree` returns ALL live
policies WITH full `Body_Plain` in one ~690 KB call, no auth.** This is the way to read the whole policy
corpus — do not scrape the hub UI and do not fetch policies one at a time.

- 🔑 **`/api/policies` (admin) is 401 from curl; `/api/policies-public/*` is wide open** — mounted with no
  middleware (`proxy server.js`), filtered to `Status='Published' AND Is_Active=1`. CORS is browser-only, so
  server-side calls are unaffected.
- 🔑 **The tree response shape is grouped by category**, not a flat list: `tree[] → {category, policies[]}`,
  each policy having `children[]`. Walking it as a flat array silently yields 6 nodes instead of 138.
- ⚠️ **`toListShape` strips `Body_HTML` from list/tree payloads but leaves `Body_Plain`** — plenty for
  content analysis. Need real HTML? `GET /api/policies-public/<policy_id>` per record.
- Editing is a different door: `PUT /api/crm-proxy/policies/<id>` behind `policies-admin` (Erik only).
  `Body_HTML` caps at **64,000 chars** (413 over). `Body_Plain` is server-derived — never write it.
- 🔴 **`Summary` is Caspio `Text(255)` and the proxy does NOT validate it — over-length gives an opaque
  `500 {"error":"Failed to create policy"}`, not a 413.** Cost me three wrong theories (size, entities,
  transient token churn) on a 2026-08-11 write. `validateBodyLengths` covers only `Body_HTML`/`Body_Plain`.
  🔑 **Diagnostic that settled it: max `Summary` across all 138 live records was 252** — when a write fails,
  measure the field against what the live corpus actually contains rather than against the declared cap.
  ⚠️ A same-size body of plain `<p>` text posted fine, which is what ruled size out.
- **Server-side writes**: POST/PUT `…/api/policies` on the PROXY with header `x-crm-api-secret`
  (value in `caspio-pricing-proxy/.env`). Beats pasting large bodies through the browser session, and still
  gets slug generation, `Body_Plain` derivation and length validation. `Status` defaults to **`Published`** —
  pass `'Draft'` explicitly or it goes live to staff immediately. `DELETE` is a soft archive
  (`Status='Archived', Is_Active=0`), so a failed experiment is cleanable.
- House style for `Body_HTML` is class-free semantic HTML: `h2 p ul li strong em a table/thead/tbody/tr/th/td`.
  No divs, no classes, `&mdash;`/`&amp;` entities.

Related: [[nwca-policy-reconciliation-2026-08]]
