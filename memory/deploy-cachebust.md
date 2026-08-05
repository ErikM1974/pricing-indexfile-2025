# Deploy cache-busting — how `?v=` bumping works, and what it is (and isn't) protecting

Covers `.claude/skills/deploy/SKILL.md` Step 2 (cache-bust auto-bump) and Step 3.5
(orphan-asset guard). Fixed 2026-08-05 across `2909f58f` + `f92a33fc`.

## The three bugs that were in Step 2

**1. Wrong baseline.** It diffed `origin/develop HEAD`, which answers *"what have I
not pushed yet?"* — nothing to do with what production serves. The normal workflow
is commit → `git push origin develop` → `/deploy`, at which point `origin/develop ==
HEAD` and the diff is **empty**: nothing bumped, deploy reports ✅, SHA check passes.
Baseline is now **`origin/main`** (what is LIVE). Step 0.1 fetches, so it's fresh.

Worse than bumping nothing, it degraded into *partial hand-bumping*: whoever noticed
fixed the page they had in mind and missed other pages loading the same shared asset.
Real instance 2026-08-05 — `dst-parser.js` changed; `pages/dst-viewer.html` was
hand-bumped, `calculators/embroidery-contract/index.html` was not.

**2. Sibling refs were invisible.** Matching used the last TWO path segments
(`js/dst-viewer.js`) to avoid basename collisions. But a page in the asset's **own
directory** references it by BARE name — `calculators/embroidery-contract/index.html`
contains `embroidery-contract.js?v=`, which the token
`embroidery-contract/embroidery-contract.js` can never match. Every self-contained
`/calculators/*/index.html` has this shape, plus root `index.html` and `brands.html`
(17 bare refs across 6 pages). Nearly shipped ~1000 changed lines of contract PRICING
js behind an unbumped `?v=`.

Fix: a second pass scoped to the asset's own directory, with a `(?<![\w./-])`
lookbehind so a basename preceded by a separator is refused. The 2026-06-09 collision
(an order-form `pricing/shared.js` change bumping 8 dashboards' `shared.js`) cannot
return.

**3. The failure was invisible by construction** — "nothing bumped" looks exactly like
"nothing needed bumping". Hence the silent-no-op detector, which aborts when a changed
asset's `?v=` went untouched. `CACHEBUST_ALLOW_MISS=1` overrides.

## Why the detector had to resolve refs (`f92a33fc`)

The detector first tested whether the **basename** appeared with a `?v=` anywhere.
Measured over all 763 assets: **14 would have aborted a deploy falsely**, and they
clustered in the most-edited code in the repo —
`shared_components/js/builders/{emb,dtg,scp}/*.js`. `pricing.js`, `persistence.js`,
`utils.js`, `catalog-search.js`, `artwork.js` are ESM imports with no `?v=` of their
own, but those basenames *do* carry a `?v=` on unrelated pages.

So essentially every quote-builder release would have hit the abort, and the
documented remedy is to set `CACHEBUST_ALLOW_MISS=1` — which, done reflexively, turns
the gate off permanently. Same failure mode as a chronically red test gate teaching
everyone `--skip-tests`.

It now resolves each candidate ref against the page containing it (absolute,
relative, and `../` forms) and flags only an exact match. **0 false positives**, and a
synthetic `../widget.js?v=` miss still aborts.

**Verification method worth reusing:** extract the fenced `bash` block straight out of
SKILL.md, `sh -n` it, then execute it against a throwaway copy of the repo's HTML tree
and diff. That tests the документed code rather than a paraphrase of it.

## ⚠️ The `?v=` scheme currently protects nothing

Every JS/CSS response carries:

```
Cache-Control: no-cache, no-store, must-revalidate
Expires: 0
```

on Heroku direct **and** on `www.teamnwca.com` (no CDN — `Server: Heroku`, no
`cf-cache-status`/`x-cache`/`Age`). `no-store` means browsers do not retain the file
at all, so **a stale `?v=` cannot serve stale code**, and every page load refetches
every asset. `favicon.png` gets `public, max-age=86400`, so this is specific to JS/CSS,
not a blanket policy.

Consequences:
- Every documented "stale cache" incident in this repo's history was, under these
  headers, not actually serving stale code.
- The site pays a full re-download of every JS/CSS file on every navigation.

**Open decision for Erik.** Either:
1. Keep `no-store`. Correctness is already guaranteed; `?v=` becomes documentation and
   the deploy step stops being a source of incidents.
2. Serve versioned assets `max-age=31536000, immutable` for real speed — but ONLY once
   the bump logic is trusted, because it converts every latent stale ref into a live one.

**14 assets currently carry inconsistent `?v=` across pages** (audited 2026-08-05),
including `dtg-pricing-service.js` pinned 21–28 days behind on three pricing surfaces
(`product.html`, `quote-builders/dtg-quote-builder.html`,
`calculators/quick-quote/index.html`). Harmless today; live bugs the day caching is
enabled. Fix them **before** option 2.

Audit tooling used (session scratchpad, re-creatable): `audit_versions.py` (find refs
disagreeing across pages), `triage_stale.py` (which of those are genuinely behind the
file's last-modified date).
