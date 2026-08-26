# 🔑 Durable gotchas — the expensive ones

Traps that have already cost real time or shipped real damage, each one earned. Moved out of the
auto-loaded `MEMORY.md` on 2026-08-12 (it was 60% of that file's byte budget, and past ~24 KB the
bottom of the index **silently stops loading**). Living here also puts them in **git** for the
first time — `MEMORY.md` is machine-local and unversioned, so these were one bad sync from gone.

**They no longer load automatically. Read this file when you are about to:**

| About to… | Read section |
|---|---|
| claim something is verified / write or trust a test or harness | **Verification** |
| touch a gate, forwarder, cookie, token or anything anonymous | **Auth / security** |
| write browser JS — guards, falsy checks, visibility, modals | **JS / DOM traps** |
| commit, branch, cache-bust, deploy, or touch Heroku | **Repo / deploy** |
| add a route, limiter, cross-repo field, or a "new report" | **Architecture / API** |

Related: [LESSONS_LEARNED.md](LESSONS_LEARNED.md) is the full bug log (problem → root cause → fix →
prevention); this file is the compressed, always-relevant residue. Architecture *rules* live in
`CLAUDE.md`. Files named `feedback_*.md` and `user_*.md` live in the machine-local auto-memory tree
at `~/.claude/projects/C--Users-erik-OneDrive---Northwest-Custom-Apparel-2025-Pricing-Index-File-2025/memory/`.

---

## Verification

- 🔴 **A workflow's own tally can under-report and still look green** — mine said 3 confirmed contradictions, the truth was 7 (result Map keyed on a NON-UNIQUE pair; 6 keys collided and findings got each other's verdicts). Count from the raw array, key fan-out on a synthetic id. → auto-memory `feedback_workflow_result_map_key_collisions.md`
- 🔴 **REASONING about an invariant is not VERIFYING it.** I proved in writing that swapping a derived column for a printed one broke no payroll slips; it silently blocked one (new hire ⇒ entitlement 0 ⇒ clamp INERT ⇒ old check passed exactly — the case my algebra skipped). Erik caught it by asking; 1490 green tests didn't. **Run the dependent code over real rows** — the module was Node-requireable and a 20-line script showed `printable: true → false`.
- 🔴 **A STUB THAT SKIPS THE HARD PART TESTS NOTHING** — my harness answered `done` on poll #1, so the upload's **poll chain was never exercised**, and a bug that KILLS that chain shipped past a green run. Stubs must reproduce the SHAPE (N× running, then done). 🔑 Also **cache-bust what a harness loads** — mine served a stale copy and showed the OLD behaviour after the fix was on disk.
- 🔴 **A harness can be structurally incapable of reproducing the bug.** An express+`compression()` upstream cannot reproduce a stale-`Content-Length` truncation, because `compression()` removes that header when it gzips — so the test passes against the broken code. **Pair every regression test with a negative control that asserts the OLD behaviour still fails**, or the harness can quietly stop reproducing and stay green forever.
- 🔑 **"Stuck spinner" ⇒ read response SIZES, not status codes** — every poll was a healthy-looking HTTP 200, all **20 bytes** (`running`), and the client stopped asking. That located it in the client instantly. 🔑 **A gate built on column TOTALS is invariant to row permutation** (skewed scan ⇒ right totals, wrong people).
- 🔴 **A BAD GATE REPORTS SUCCESS** — two audit checks I self-reviewed as safe had 6 real defects, caught only by adversarial review. 🔑 3 confirming passes were wrong where ONE adversarial REFUTE pass caught it.
- 🔴 **A source-grep lock can be VACUOUS — green against the very bug it "guards".** `not.toContain("upstream.headers.get('content-length')")` never matched anything: the code read `.get(h)` in a loop. **Prefer parsing the real value out of source and driving it through a live round trip**, and prove the lock goes RED by reintroducing the bug.
- 🔴 **`tests/setup.js`'s fetch stub NEVER installs** — it guards on `typeof fetch === 'undefined'` and Node 18 ships a native fetch, so "unit" tests silently hit the LIVE proxy (a 449 ms unit test is the tell). Stub `global.fetch` per test.
- 🔴 **`toContain()` cannot see a MISSING conjunct.** A jest lock asserted `toContain('PushedToShopWorks IS NOT NULL')` and stayed green while the predicate it guarded was a no-op — the `AND col<>''` half was simply absent. A substring assertion tests presence, never sufficiency: assert the part that carries the MEANING, not the part you happen to remember writing.
- 🔑 **Verify a WRITE with `&refresh=true`** — the proxy caches `quote_sessions` reads, so a post-fix verification GET returned the pre-fix row and read as "not fixed".
- 🔑 **Verify the OUTPUT, not the edit's exit code** — scripted rewrites report success and change nothing (OneDrive reverts).
- 🔑 **Verify an import by reconciling a TOTAL** — Atmos CC: every per-row check passed while 71 of 92 payables silently vanished.
- 🔑 **Unit tests can all pass while the thing is broken end-to-end** (Box artwork: 92% of customer proofs blank). Load a REAL user's page.
- 🔑 **A workflow's verify phase can fail wholesale (session limit) and still return findings as "killed"** — `sustained===0` because every vote was null. ALWAYS read the failures block; 8 of 9 "killed" findings once were real.
- 🔑 **A destructive sync needs a dry run a HUMAN reads, not just numeric guards.** ~530 live orders nearly deleted with all three guards (non-empty, in-range, 16.3% vs a 25% ceiling) PASSING; what caught it was eyeballing the sample. → [SHOPWORKS_ODBC_INTEGRATION.md](SHOPWORKS_ODBC_INTEGRATION.md)
- 🔑 **Pick the statistic before trusting vendor data** — SanMar `PIECE_WEIGHT` max would have re-weighed 284 variants; the **mode** matched the catalogue.
- 🔑 **Check the clock before calling a gap a bug** (sync job runs 12:30 UTC; my audits ran before it).
- 🔑 **A DOM shim can fabricate a failure** — verify controller results with browser semantics (textContent/innerHTML linked) before believing them.
- 🔑 **In-app Browser pane's `read_network_requests` misses cross-origin fetches** — every proxy API call looked absent while firing fine (2026-08-25 storefront sweep); read `performance.getEntriesByType('resource')` in the page instead. Synthetic `blur` also never triggers `focusout` delegation (blur doesn't bubble) — dispatch `FocusEvent('focusout',{bubbles:true,relatedTarget:document.body})` before calling a commit-on-focus-leave UI broken.

## Auth / security

- 🔑 **A gate is per-IDENTITY, not per-origin** — `requireStaff` rejects the customer cookie; a staff fix does nothing for customers. Fix = HMAC capability token.
- 🔑 **A per-sub-prefix gate never covers its parent** — four gated sub-prefixes on a router mounted at `/api` left everything else anonymous for months. **Probe the WHOLE router surface.**
- 🔑 **Same-origin forwarder is the trick** — the SAML cookie rides along even on `<img>`. **Verify a forwarder's BODY against an echo server, never the 401** (the gate fires first, so an empty-body bug stays invisible).
- 🔑 **Ship the app forwarder FIRST and verify a REAL save through it before gating the proxy.** Prove a write gate with a *destructive* payload — an empty one gives 400 either way.
- 🔑 **`app.get('/*.js')` → `sendFile`: `/*` matches slashes, so ANY depth** — served the entire 704 KB `server.js` in prod. **Removing a mount proves nothing until you re-probe with the files still on disk.**
- 🔑 `guardReadsOnly` tested `=== 'GET'`, so **HEAD sailed past auth**. Anon-endpoint probe: POST + empty body → 401 gated, 400 open.
- 🔑 **A staff page gate is `.html`-ONLY — its `.js`/`.css` are ANONYMOUS.** `gateStaffHtml` does `if (!p.endsWith('.html')) return next()` so non-HTML assets stay public on purpose (no redirect loop). Verified live: `GET /dashboards/js/past-due-orders.js` → 200, no session. So **data baked into a dashboard's own JS is published**, gated page or not — keep it in `lib/` (never statically served) behind `requirePageAccess('<page>.html')`. Watch the COMMENTS in those files too. Served root dirs: admin art-tools calculators config dashboards dist email-templates forms guides hr images mockups pages policies product quote-builders styles tools training vendor-portals. → drive-access (2026-08-24)
- 🔑 **Registration ORDER is the access control** — the hashed-asset rewrite sits below every gate, above `express.static`; jest asserts it. → [proxy-security-2026-08.md](proxy-security-2026-08.md), [deploy-cachebust.md](deploy-cachebust.md)

## JS / DOM traps

- 🔑 **`[]` is TRUTHY** — a `parseErrors` guard fired on every SUCCESSFUL query. Mirror of `Number(null) === 0`.
- 🔑 **`Number(null) === 0` and 0 is finite** — an `isFinite` guard turns "no data" into the FACT "0". Reject empty BEFORE coercing; omit null members so absent ≠ zero. (`Number('') === 0` too — Caspio blank ≠ 0.)
- 🔑 **`blur` fires on MOUSEDOWN, before the click it belongs to** — never re-render a container on blur; update in place.
- 🔑 **Asserting `el.hidden` proves nothing about visibility — assert `getComputedStyle(el).display`.** `[hidden]{display:none}` is a UA rule, so any author `display:` wins. Fix: `.thing[hidden]{display:none}`.
- 🔑 `.onclick =` beats `cloneNode` for re-openable modals (clone copies `disabled`+innerHTML → reopens dead).

## Repo / deploy
- 🔴 **A shared checkout mid-`/deploy` swallows your commit into THEIR release.** Another session's deploy switched this checkout to `main` between its steps; my `git commit` landed on main under their release merge and shipped inside their version, unmentioned by their changelog (2026-08-26, trust band rode along in v2026.08.26.1 — content was fully gated, so it was let ride; NEVER do git surgery on a live deploy). **Check `git branch --show-current` immediately before every commit** — `main` + fresh `Release v…` commits = a deploy is running; wait for its Step 16.

- ⚠️ **In a shared checkout a WIP commit on develop is a deploy candidate for EVERY session.** Use a feature branch; re-check `git branch --show-current` before committing. **Concurrent sessions deploy over each other — re-check `origin/main` right before you cut** (a cache-bust reporting ZERO changed assets usually means your work already shipped; confirm with `git merge-base --is-ancestor <sha> origin/main`).
- 🔑 **Releasing a shared checkout:** cut at YOUR sha, `git checkout HEAD -- <foreign file>` before committing the merge — then RESTORE it on sync-back or you delete the other session's WIP. A dirty tree blocks `git checkout main` → release from a `git worktree` at a SHORT path (Windows MAX_PATH).
- 🔴 **A `?v=` baseline must be what is LIVE (`main`), never what is PUSHED.** 🔴 OneDrive resurrects stale `?v=` and leaves it STAGED — re-check `git diff --cached` before any deploy.
- 🔑 **Fresh clone of either repo: `git config core.hooksPath scripts/git-hooks`** — LOCAL, untrackable; until set, `main` is unguarded. New hooks → mode 100755 (non-exec = skipped silently). The proxy's `pre-push` BLOCKS hand-pushes to `main`.
- 🔑 **`npm test` in the proxy exits 1 with everything PASSING** (jest worker teardown leak; Win · Node 22.11 · Jest 30.1) — `--forceExit` fixes it. A permanently-red gate teaches everyone to `--skip-tests`.
- 🔑 **Heroku CLI v11 — API and GIT auth through DIFFERENT stores.** `auth:whoami` fine while `git push heroku` dies; 🔴 never `heroku logout` to "reset". Verify: `git ls-remote heroku HEAD`.
- 🔑 **A live session may be mid-edit on YOUR files — check mtime + `list_sessions` before the first Edit**, not `git status` alone. → auto-memory `feedback_check_for_live_session_before_editing.md`
- 🔑 **`lib/hashed-pages.js` is THE list** (build.js AND server.js import it — drift = silent no-op). Staff pages deliberately NOT in it.
- 🔑 **Search ALL THREE repos for callers**, and verify both directions on ONE build.
- 🔑 **A machine-local file is not a record.** The auto-loaded `MEMORY.md` lives in `~/.claude`, is not in git, and had facts in it that existed nowhere else. Anything durable belongs in repo `/memory/`.

## Architecture / API

- 🔑 **THE WHOLE PROXY API was once capped at 30 req/min per IP** — `app.use('/api', limiter, router)` runs for EVERY /api request. **Any new limiter mounted on `/api` MUST carry a path-scoped `skip` — jest greps every such mount.**
- 🔑 **`/api/pricing-bundle` returned HTTP 200 with EMPTY arrays when Caspio rate-limits** (now throws).
- 🔑 **Proxy WHITELISTS `calcContext` — a new frontend field is a TWO-repo change, proxy first.**
- 🔴 **Never forward a `Content-Length` you did not measure.** HTTP clients inflate gzip transparently, so upstream's length describes the COMPRESSED bytes while you pipe decompressed ones — the browser frames short and truncates. **Not gateable on `content-encoding`: axios deletes that header after inflating.** Only ever set a length computed from the bytes you are about to write. → [LESSONS_LEARNED.md](LESSONS_LEARNED.md) 2026-08-12
- ⚠️ **`DashPage.fetchJson` prefixes the PROXY base** — a same-origin `/api/crm-proxy/*` route MUST use plain `fetch(...,{credentials:'same-origin'})` or it 401s.
- 🔑 **`POST /api/design-notes` is a strict SUPERSET of `/api/art-requests/:id/note`** (same table + Slack/email fan-out). Swap, never add a 2nd call, or you duplicate the timeline row. 🔴 The status write commits BEFORE the note write and never rolls back.
- 🔑 **A feature failing for exactly ONE person → diff their DATA against a working user's first.** 🔴 `AE_REGISTRY` and `REP_PERMISSION_BY_EMAIL` are hand-maintained — Ruth 404'd everywhere; ORDER_ODBC holds **`Ruthie Nhoung`**, inbox is `ruth@` (`ruthie@` isn't real). ✅ 4 more maps fixed + **jest-locked** (`tests/unit/rep-email-maps.test.js`) 2026-08-11.
- 🔑 Guard tests must scan `.js` too — DataPages go live via `iframe.src` with no `<script>` tag.
- 🔑 **Bandit IS reachable from laptop** — `Import-Clixml bandit-cred.xml` + `Invoke-Command -ComputerName bandit`. 🔴 double-hop blocks `\\NCA-FS01`; `Get-ScheduledTask` empty over remoting (use `schtasks`).
- 🔴 **Shopify: releasing an app version does NOT grant scopes** — the grant is on the INSTALL (*Install app* → *Update data access*). 🔑 ShopifyQL has no `sum()`, no bare `BY`, no `FROM products`. → [253gear-store-metrics.md](253gear-store-metrics.md)
- 🔑 **Erik asks for a NEW report; the right answer is often to FIX the existing one** — building beside it leaves the broken one running.
- 🔑 **Retire on USAGE, not parity** (Mockup Generator); **Pricing by Style was retired for having no parity test, not for being wrong.**
