---
name: policies-hub-update-playbook
description: "Step-by-step playbook for inserting, editing, and deleting Policies Hub policies from chat using the caspio-pricing-proxy admin endpoints. Refined over an 8-policy editing session 2026-05-26."
metadata: 
  node_type: memory
  type: howto
  originSessionId: 82538cd2-43b6-4a53-ad14-7a1609267324
---

# How to update Policies Hub from chat (playbook)

When the user asks to add, edit, or delete a policy in the Policies Hub (`https://www.teamnwca.com/pages/policies-hub.html`), follow this playbook. For architecture (auth model, schema, TipTap setup) see `policies-hub-details.md` *(machine-local auto-memory, not this tree)*. For the "always use the proxy" lesson see `feedback_use_proxy_for_caspio_writes.md` *(machine-local auto-memory, not this tree)*.

## The three operations

### 1. Insert a new policy

POST to the proxy admin endpoint. Server validates category, derives `Body_Plain`, stamps timestamps, handles slug uniqueness.

```js
// scripts/_tmp-insert-<slug>.cjs  (DELETE after success)
const fs = require('fs'), path = require('path');
const env = fs.readFileSync(path.resolve(__dirname,'..','..','caspio-pricing-proxy','.env'),'utf8')
  .split(/\r?\n/)                                                   // CRLF-aware
  .reduce((a,l)=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)a[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');return a},{});

const payload = {
  Policy_ID: 'kebab-case-slug',  // optional — proxy slugifies Title if omitted
  Category:  'HR',               // Financial | Operations | Customer Service | HR | Training
  Title:     '...',
  Summary:   '≤255-char summary',  // HARD CAP — Caspio Summary is Text(255); overflow → generic 500 (see gotchas)
  Body_HTML: '<h2>...</h2>...',  // server derives Body_Plain — do NOT set it
  Owner_Name:'Erik M.',
  Updated_By:'Erik M.',
  Sort_Order:100,
  Status:    'Published',        // Draft | Published | Archived
  Tags:      'comma,separated',
};

await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/policies', {
  method: 'POST',
  headers: { 'Content-Type':'application/json', 'X-CRM-API-Secret': env.CRM_API_SECRET },
  body: JSON.stringify(payload),
});
```

Slug collision auto-suffixes with `-<4 base36 chars>` (e.g. `csr-faqs` → `csr-faqs-mdu1`). **Uniqueness counts archived rows too** — and DELETE is soft-only (the physical row keeps occupying the slug). So a POST to a slug previously soft-deleted will *also* auto-suffix. To reclaim a clean slug held by an archived row, **PUT-revive it** instead of re-POSTing: `PUT /api/policies/<clean-slug>` with full payload + `Is_Active:true` + `Status:'Published'` + `If-Match` (PUT honors `Is_Active:true`), then soft-delete the suffixed duplicate.

### 2. Update an existing policy

GET → modify Body_HTML → PUT with `If-Match` (optimistic concurrency). Don't skip `If-Match` — a concurrent TipTap edit in the browser would silently overwrite. On 409, refetch and retry once.

```js
const fetchPolicy = async () => (await fetch(
  `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/policies-public/${POLICY_ID}?_=${Date.now()}`
).then(r=>r.json())).policy;

const current = await fetchPolicy();
const OLD = '<p>unique anchor substring</p>';
if (!current.Body_HTML.includes(OLD)) throw new Error('anchor missing — aborting');  // fail loud
const newBody = current.Body_HTML.replace(OLD, NEW);

let res = await fetch(`.../api/policies/${POLICY_ID}`, {
  method: 'PUT',
  headers: { 'Content-Type':'application/json', 'X-CRM-API-Secret': env.CRM_API_SECRET, 'If-Match': current.Updated_At },
  body: JSON.stringify({ Body_HTML: newBody }),
});
if (res.status === 409) { /* refetch + retry once */ }
```

### 3. Soft-delete a policy

`DELETE /api/policies/<policy_id>` with the secret header — flips `Is_Active=0, Status=Archived`. The public tree/list/get endpoints filter `Is_Active=1` so archived policies disappear from the hub. Not hard-deleted.

## Inspection (read-only, no auth)

- `GET /api/policies-public/tree` — categorized list of all active
- `GET /api/policies-public/<policy_id>` — single policy with full Body_HTML
- `GET /api/policies-public/search?q=...` — full-text search across Body_Plain
- Admin including drafts/archived: `GET /api/policies?category=HR&includeArchived=true` with `X-CRM-API-Secret` header

## Gotchas (collected from real edits)

- **CRLF in `.env`** — `caspio-pricing-proxy/.env` uses Windows line endings. Always split on `/\r?\n/` and `.trim()` values.
- **TipTap normalizes entities to Unicode** on every save. Once Erik (or any TipTap edit) touches a policy, `&ndash;` becomes `–` (U+2013), `&mdash;` → `—` (U+2014), `&ldquo;`/`&rdquo;` → `"`/`"` (U+201C/D). Your OLD anchor for string-replace MUST use the actual Unicode chars after a TipTap save. Inspect first:
  ```bash
  curl -s ".../api/policies-public/<id>" | python -c "
  import sys,json,re
  b=json.load(sys.stdin)['policy']['Body_HTML']
  m=re.search(r'<your anchor regex>',b,re.DOTALL)
  for ch in (m.group(0) if m else ''):
      if ord(ch)>127: print(f'U+{ord(ch):04X}  ({ch.encode(\"utf-8\")!r})')"
  ```
- **`Body_Plain` is server-derived** — never set it yourself. Bypassing the proxy with a direct Caspio insert leaves it empty and breaks search.
- **64 KB `Body_HTML` cap** is enforced server-side (413 response). Split into sub-procedures via `Parent_Policy_ID` if you hit it.
- **`Summary` is Caspio Text(255)** — a summary over 255 chars makes POST/PUT return a *generic* `HTTP 500 {"success":false,"error":"Failed to create policy"}` (NOT a 413, NOT a field-named validation error). Symptom is indistinguishable from a server error, so it burns diagnostic time — keep summaries ≤ ~240 chars. Confirmed by field-isolation testing 2026-05-28 (a large `Body_HTML` is fine; an over-long `Summary` is what 500s).
- **`If-Match` uses `Updated_At` as the value**, not an ETag. Pull from the GET response.
- **Soft-delete is invisible to a stale browser** — public API filters correctly but the user's already-loaded hub page still shows the deleted card. Tell them to hard-refresh (Ctrl+Shift+R) when they say "I still see it."
- **`/api/policies-public/get/<id>` does NOT exist** — the path is `/api/policies-public/<id>` (no `/get`). Easy mistake.

## Temp-script convention

- Path: `scripts/_tmp-<short-description>.cjs` — the `_tmp-` prefix is grep-able if you forget to delete
- Self-contained: only `fs` + `path` imports + global `fetch` (Node ≥ 18)
- Load creds from `../caspio-pricing-proxy/.env`
- No CLI args — fire-and-forget
- **DELETE after successful run**: `rm scripts/_tmp-*.cjs`
- Don't commit to git (the prefix signals throwaway)

## Verification pattern

After every write, fetch the public endpoint with a cache-buster and assert specific substrings:

```bash
curl -s "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/policies-public/<id>?_=$(date +%s)" \
  | python -c "
import sys,json
b=json.load(sys.stdin)['policy']['Body_HTML']
checks={'New text landed':'expected substring' in b,'Old text gone':'old wording' not in b}
for k,v in checks.items(): print(('OK   ' if v else 'FAIL ') + k)"
```

Print `OK`/`FAIL` rather than ✓/✗ — Windows terminals mangle the Unicode marks. The substring checks catch: silent no-op replacements, TipTap normalization mismatches, partial edits.

## When NOT to use this playbook

- Frontend bugs in the hub UI itself → edit `shared_components/js/policies/*.js` directly (see `policies-hub-details.md` *(machine-local auto-memory, not this tree)* for the file map)
- Caspio schema changes (new fields) → coordinate with `caspio-pricing-proxy/src/routes/policies.js` and Caspio admin UI
- Bulk migrations (>5 policies at once) → write a proper script with logging, not a `_tmp-` throwaway

## Attachments (PDFs / images in policies)

Host policy attachments in the **repo `/forms/policies/`** dir (served at `https://www.teamnwca.com/forms/policies/<file>` via the `/forms` static route in server.js — same precedent as `Employee-Handbook-Latest.pdf`). Reference them in `Body_HTML` with **relative** paths (`/forms/policies/<file>`) — portable across teamnwca.com / herokuapp / localhost. Images embed inline as `<img src="/forms/policies/x.png" style="max-width:100%;height:auto;">` (the policy-detail renderer DOES display inline `<img>` from Body_HTML — verified 2026-05-29). Adding files needs a **deploy** (new binaries aren't picked up by `/deploy`'s `git add -u` — stage `forms/policies/` manually, commit, then push main+heroku). **Do NOT use Caspio Files**: its CDN only serves from folders explicitly marked public (e.g. `cdn.caspio.com/A0E15000/Safety Stripes/...` works, but root files 403), and the REST API can't create or mark a public folder. Keep **internal-only** forms (hiring tests, eval forms) OUT of the public repo — store in an internal folder and reference by name.

## Valid value reference

- **Category**: `Financial` · `Operations` · `Customer Service` · `HR` · `Training`
- **Status**: `Draft` · `Published` · `Archived`
- **Default `Sort_Order`**: 100 (leave gaps for inserts)
- **Backend source**: `caspio-pricing-proxy/src/routes/policies.js`

## Handbook cross-check — REQUIRED for every new or substantially-changed policy

The 22-chapter **Employee Handbook** is the higher authority on HR/employment topics. Whenever you insert or materially edit a policy, run this two-way check **before calling the task done**:

1. **Contradiction scan.** Read the handbook (the `employee-handbook` policy + its chapter policies via `/api/policies-public/...`, or `forms/.../Employee-Handbook-Latest.pdf`) and confirm the new policy doesn't conflict. HR policies **defer to the handbook** — never restate or contradict it (e.g., overtime → Ch. 19, sick leave → Ch. 13). On a conflict: reword the policy to point at the handbook, or flag it to Erik to resolve.
2. **Handbook-currency check.** Ask: does this new/changed policy introduce or alter something the handbook should reflect? If yes, propose the matching handbook update so the handbook stays current (don't let it drift) — see `handbook-sync-workflow.md` for editing chapters / regenerating the PDF. Surface the proposed update to Erik; don't silently skip it.

Applies to all categories, but especially HR and anything touching pay, time off, conduct, safety, or benefits. State the result in your summary to Erik ("handbook checked — no conflict" or "handbook needs X").
