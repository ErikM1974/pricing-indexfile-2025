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

## 2b. Box: the session-gated forwarder (FULLY CLOSED — reads `v2026.08.05.7`, writes `.8`)

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
secret is correct, so that proves nothing until the gate is on.

✅ **The 4 WRITE routes followed** (`shared-link`, `create-mockup-folder`,
`upload-to-folder`, `file` delete — app `v2026.08.05.19` → proxy `.8`). Every
page calling them was already SAML-gated, so there was no public caller to
migrate. The guard test now asserts EVERY route declared in `box-upload.js` is
covered, so a Box route added later fails the build until someone decides its
auth story. All 11 Box routes are gated.

---

## 3. Sample-order push: the one that could not take a session (CLOSED)

`POST /api/manageorders/orders/create` creates a real ShopWorks order, and
`pages/sample-cart.html` posted to it **directly from the browser** at a
hardcoded proxy URL — anyone could create orders with curl, no auth, no
payment.

🔴 **This one could not take `requireStaff`.** Every Box caller was a staff page;
the sample cart is a CUSTOMER flow with no SAML session to prove. So the app
forwarder (`v2026.08.05.21`) is deliberately PUBLIC. What it actually buys:

- the proxy route stops being an open order-creation endpoint to the whole
  internet — only the app can reach it, with the shared secret
- abuse controls live somewhere we own: `strictLimiter`, 20/hr per IP (the same
  bucket the other order-submission routes use), verified tripping at exactly 20
- the payload is validated and bounded before it can reach ShopWorks
  (orderNumber / customer / non-empty lineItems ≤200 / files ≤5 / per-file size);
  a rejection never reaches upstream

⚠️ **Order creation is still UNAUTHENTICATED.** Relocation is not authentication.
The real fix is verifying a payment before pushing — a product change.

🔴 **The three SERVER-SIDE callers in the app sent NO secret at all**
(`server.js` 1939 / 8783 / 10079). Gating would have broken all three; they were
fixed in the same release. Nothing in Python Inksoft calls this route.

Proxy side: the `guardReadsOnly` wrapper came off `/api/manageorders/orders`, so
writes are gated too (`proxy v2026.08.05.9`). `/lineitems` keeps it — no write
callers to migrate.

## 4. ManageOrders tracking (CLOSED, proxy `v2026.08.05.11`)

`GET /api/manageorders/tracking` returned **~911 KB of tracking records** —
customer shipment identifiers and addresses — to anyone with the URL.
`/tracking/{pull,verify}` were open beside it, and `/tracking/push` WRITES
tracking numbers into OnSite.

Gated with `requireCrmApiSecret` on the `/api/manageorders/tracking` prefix —
**every method, not `guardReadsOnly`**, since a reads-only wrapper is exactly
what left `/orders/create` anonymous for months. One prefix covers BOTH routers
(`manageorders.js` and `manageorders-push.js` both hang off it), registered
above both mounts.

🔴 **The only real caller was in a THIRD repo.** Python Inksoft's order view
(`web/app.py`) calls `GET /tracking/{shopworks_id}` and sent no secret. It was
fixed and deployed FIRST (`inksoft-transform`). Its call sits inside a
`try/except` that swallows failures — "tracking is optional" — so gating without
that fix would have made tracking **silently vanish** from the order view rather
than error. The worst failure mode: no alarm, just missing data.

⭐ **That fix repaired a live bug two lines above it.** The same function's order
lookup (`GET /api/manageorders/orders/{id}`) also skipped the existing
`_proxy_headers()` helper, so it had been 401ing since the July GET gate and
dying on `raise_for_status()`. Verified against production before and after.

🔑 **CLAUDE.md's cross-project rule earned its place here** — a repo-local caller
search would have found nothing and the gate would have looked safe.

### Still anonymous in the push router (each needs its own caller audit)

`GET /push/health` (no data) · `POST /auth/test` (exercises the ManageOrders
credentials). Tracking is closed — see section 4.

---

### Forwarding a body: three modes, and the distinction is load-bearing

- **json** — `bodyParser.json` (global, mounted long before these routes) has
  ALREADY consumed and parsed the stream. Re-serialise from `req.body`; piping
  `req` here sends an empty body.
- **stream** — multipart. `bodyParser.json` ignores it precisely because the
  content-type doesn't match, so `req` is unread and pipes straight through. The
  app relays a 20 MB upload without buffering it, and multer upstream still sees
  an intact body with its boundary.
- **none** — DELETE carries no body; only the query needs carrying.

🔑 **Verify a forwarder's body against an echo server, never against the 401.**
The gate fires before the body code ever runs, so a 401 proves nothing about
whether the body arrives — and an empty forwarded body fails silently. A
throwaway echo server standing in for the proxy showed the real bytes: 22 B of
correct JSON, `?force=true` preserved on a bodyless DELETE, and 358,743 B of
multipart with the boundary header intact — all carrying the secret, and nothing
created in Box.

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
