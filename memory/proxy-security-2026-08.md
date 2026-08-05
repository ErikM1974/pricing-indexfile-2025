# Proxy + app file-exposure security work — August 2026

Everything here came out of one thread: the app was serving its own source code, and
auditing the sibling proxy for the same bug turned up a worse one.

---

## 1. App: `/*.js` wildcard served the entire repo (FIXED, `v2026.08.05.13`)

```js
app.get('/*.js', (req, res) => res.sendFile(path.join(__dirname, req.params[0] + '.js')));
```

Express's `/*` **matches slashes**, so this resolved any depth. Verified in production
before the fix:

| Path | Response |
|---|---|
| `GET /server.js` | 200 — **704 KB, the whole server source** |
| `GET /lib/page-access.js` | 200 — the RBAC decision logic |
| `GET /lib/cors-allowlist.js` | 200 |

A `/*.css` twin had the same flaw. It also re-served the whole `tests/` tree, which is
why `.slugignore` (`v2026.08.05.12`) was load-bearing rather than belt-and-braces.

**Fix.** Reject separators / dot-segments / NUL so only true root-level files resolve;
deny `server.js` and `*.config.js` by name; `sendFile` errors fall through to 404.
`/tests` and `/scripts` mounts removed; three dead `/test-*.html` routes deleted.

🔴 **`config/app.config.js` had no mount of its own.** ~77 pages loaded it *only*
because the wildcard served arbitrary depth. It now has an explicit
`app.use('/config', …)` registered **before** the wildcards — tightening them without
that would have stripped `APP_CONFIG.API.BASE_URL` from every calculator and dashboard.

🔑 **Removing a mount proves nothing until you re-probe with the files still on disk.**
`/tests/...` still returned 200 after its mount was deleted — that surprise is what
exposed the wildcard. A 404 in production only meant `.slugignore` had removed the file.

---

## 2. Proxy: unauthenticated arbitrary file write (FIXED, `v2026.08.05.6`)

The app's wildcard bug does **not** exist in the proxy — no `express.static` mounts, no
wildcard asset routes, and every source path plus traversal encoding returns 404. (An
`express.static('.')` was removed there in July 2026 for the same reason.)

But the same **root-cause class** — a request-influenced value reaching a filesystem
path — was present as a *write*:

```js
// lib/file-upload-service.js, before
const tempFilePath = path.join(tempDir, `upload_${Date.now()}_${fileName}`);
fs.writeFileSync(tempFilePath, buffer);
```

`fileName` is caller-supplied. `path.join` normalises, and the `upload_<ts>_` prefix is
just one more segment for `..` to pop:

```
path.join('/tmp', 'upload_123_../../../app/server.js')  →  /app/server.js
path.join('/tmp', 'upload_123_../../../app/.env')       →  /app/.env
```

Reachable with **no credentials** via `POST /api/manageorders/orders/create`, because:

```js
// src/middleware/index.js — gates GET only; POST falls straight through
const guardReadsOnly = (mw) => (req, res, next) =>
  (req.method === 'GET' ? mw(req, res, next) : next());
```

and `server.js` mounts the push router with no gate at all. The write lands *before* the
Caspio token call, so it happens even with no valid credentials, and the error path
`unlinkSync`s the same traversed path — so the guaranteed primitive is
**overwrite-then-delete of any file on the dyno**, with a race window against the ~51
request-time lazy `require()` calls for code execution in the process holding the Caspio
`client_secret`.

**Fix.** `path.basename()` + charset filter + a `resolve().startsWith(tempDir + sep)`
assertion. The Caspio-facing filename keeps the caller's original string, so uploads
still land under the intended name. Jest-locked in
`tests/jest/upload-filename-traversal.test.js` (19 cases).

### HEAD bypassed every read gate

`guardReadsOnly` tested `req.method === 'GET'`. Express routes HEAD to the GET handler
but leaves `req.method === 'HEAD'`, so HEAD went past `requireCrmApiSecret` into the PII
handlers. Observed live: `HEAD /api/manageorders/orders` → 500 (it reached the handler)
while `GET` → 401. Now gates `['GET','HEAD']`; verified live HEAD → 401.

---

## 2b. Box reads: the session-gated forwarder (app half LIVE `v2026.08.05.17`)

The proxy's Box READ routes move behind a same-origin forwarder in the app
(`server.js` `boxForward`). The property that makes this work: a browser sends
its SAML cookie automatically on **same-origin `<img>` requests**, so
`<img src="/api/box/thumbnail/123">` authenticates where a cross-origin call to
the proxy never could. `requireStaff` proves the session; only the app holds the
secret it uses upstream.

Shape: **7 explicitly enumerated read routes**, numeric-only `fileId`, and a
query allowlist (`size, full, folderId, designNumber, limit, offset, query,
type, url`) checked against the real call sites — dropping `full=1` or
`size=large` silently degrades an image instead of failing. No wildcard: after
the `/*.js` incident this forwarder must never become the thing it replaced.

🔴 **Absolute proxy URLs were already PERSISTED in Caspio.** Transfer/mockup
rows store `Thumbnail_URL` as a full proxy URL (written by
`transfer-actions-shared.js`), so gating the proxy would 401 every existing
record. Rather than rewrite the rows, `shared_components/js/box-url.js`
normalises them at RENDER time — read routes only, idempotent, null-safe.

`art-request-detail` / `mockup-detail` / `transfer-detail` were **public** while
every dashboard caller was gated; now gated (evidence they are internal: noindex,
linked only from gated dashboards, every emailed link goes to an
`@nwcustomapparel.com` address). 🔑 **`app.get`, not `app.use`** — `app.use`
strips the mount path, so `gateStaffHtml` saw `req.path === '/'`, failed its
`.html` test, and waved the request through. The gate looked installed and did
nothing.

✅ **Proxy gate SHIPPED** (`v2026.08.05.7`) after Erik confirmed the imagery in a
browser. All 7 read routes now 401 anonymously; the same requests carrying the
app's `CRM_API_SECRET` return 200, which is the leg the forwarder uses.
🔑 **Check the two `CRM_API_SECRET` config vars MATCH before gating** — the
forwarder appears to work while the proxy is open regardless of whether its
secret is correct, so that proves nothing until the gate is on. The 4 Box WRITE routes
(`shared-link`, `create-mockup-folder`, `upload-to-folder`, `file` delete) are
untouched and still go browser→proxy directly.

---

## 3. Still open in the proxy — deliberately not blind-gated

Anonymous in production today (the Box **reads** in this list are now closed — see 2b):

- `POST /api/manageorders/orders/create` — creates real ShopWorks orders
- The four Box **WRITE** routes: `POST shared-link`, `POST create-mockup-folder`,
  `POST upload-to-folder`, `DELETE file/:fileId`

🔑 **A secret cannot simply be added.** `pages/sample-cart.html` posts to the push route
**directly from the browser** at a hardcoded proxy URL, so gating it breaks paid sample
orders; the Box write routes are likewise called straight from the browser. Anything in
browser JS is not a secret.

**The fix is the one proven in 2b** — move each caller behind the app's session-gated
same-origin forwarder, then gate the proxy route, app first. `upload-to-folder` is the
awkward one: it is multipart, so the forwarder has to stream the upload rather than
`fetch`-and-forward the way the read routes do.

---

## Method notes worth keeping

- 🔑 **Audit the class, not the instance.** "Does the proxy have this wildcard?" answered
  *no* in ten minutes; "can a request influence a filesystem path?" found something worse.
- ⚠️ **Scope live-probing agents explicitly.** An audit agent authorised for "read-only
  GET probes" enumerated and downloaded real customer Box files (a 4.4 MB PDF, a 1.5 MB
  image) to prove endpoints were open. Status-code checks would have proved the same
  thing. Say "status codes only, never retrieve customer content".
- 🔑 **Check who calls a route before gating it.** Two of the four findings could not be
  fixed the obvious way precisely because browsers call them directly.
