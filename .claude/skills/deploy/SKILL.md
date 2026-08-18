---
name: Deploy to Production
description: Deploy current develop branch to production. Use when user says /deploy, "deploy to production", "push to heroku", "release to production", "deploy changes", "ship it", or "release changes". No interactive prompts — pre-flight gates (auth, freshness, tests, memory, prior-deploy completion) guard the deploy. Single-version cache-bust, --no-ff release merge with changelog of actual commits, real release-status verification, auto-restart on stale slug, optional Slack notification. Also covers resuming a deploy that reached GitHub but never reached Heroku.
---

# Deploy to Production Skill

Automates Northwest Custom Apparel's deploy pipeline `develop` → `main` → Heroku. Fast, non-interactive, traceable. End-to-end ~35 seconds when nothing's wrong.

## What This Skill Does

1. **Pre-flight gates** (Step 0.1–0.7) refuse to deploy bad state — 0.6 runs every
   browser-free CI check (lint, typecheck, unit, DOM, a11y), 0.7 reads CI's own verdict
2. **Prior-deploy completion check** (0.4a) — catches a previous run that reached GitHub but
   never reached Heroku, the one failure every branch-level check reports as success
3. **Single-version cache-bust** — one `$DEPLOY_VERSION` applied to all `?v=` query strings
4. **Precise staging** — `git add -u` + explicit HTML files, never `-A`
5. **Release-marker merge** — `--no-ff` so `git log --first-parent main` is a clean release log
6. **CHANGELOG of actual commits** — captures develop's commits BEFORE the merge so the changelog isn't empty
7. **Real Heroku release verification** via `heroku releases --json`, not blind sleep
8. **Dynamic stale-slug detection** with `ps:restart` → `ps:scale` escalation
9. **Optional Slack notification** (silent skip if webhook unset; no debug chatter)
10. **Copy-pasteable resume + rollback** procedures at end of skill

**Non-interactive by design.** Pre-flight gates are the only thing standing between "you typed /deploy" and "code is live on Heroku." No confirmation gate, no session-doc prompt — both proved to be friction without payoff in real runs.

## Triggers

`/deploy` · "deploy to production" · "push to heroku" · "release to production" · "deploy changes" · "ship it" · "release changes"

Flags: `--skip-tests` (emergency bypass for Step 0.6 — skips lint, typecheck, unit, DOM and a11y)

## Implementation

Execute these steps in order. **Stop immediately if any pre-flight gate fails — nothing has been modified yet.**

---

### Step 0.1 — Fetch latest remote state

```bash
git fetch origin --prune --tags
```

If this fails (network down, auth issue), abort.

### Step 0.2 — Verify on develop branch

```bash
git branch --show-current
```

If not on `develop`, report and abort.

### Step 0.3 — Verify develop not behind origin

```bash
git rev-list --count HEAD..origin/develop
```

If non-zero, abort with:
> Local develop is N commits behind origin. Run `git pull --ff-only origin develop` first.

Prevents the silent "deployed stale local" disaster when work was pushed from another machine.

### Step 0.4 — Heroku auth + remote check

```bash
heroku auth:whoami
git remote get-url heroku
```

If `auth:whoami` fails → abort: "Run `heroku login` first."
If `git remote get-url heroku` fails → abort: "No heroku remote — run `heroku git:remote -a sanmar-inventory-app`."

Refusing to start a deploy that would fail at Step 11 keeps `main` and Heroku in sync.

### Step 0.4a — Prior-deploy completion check (added 2026-08-18)

**Step 0.1 fetches `origin`. It never touches `heroku`** — they are separate remotes reached by
separate pushes, and only one of them is the deploy. So every branch-level check can read "clean,
in sync, shipped" while production serves week-old code. Ask Heroku directly what it has:

```bash
HEROKU_SHA=$(git ls-remote heroku refs/heads/main 2>/dev/null | awk '{print $1}')
[ -z "$HEROKU_SHA" ] && { echo "✗ Could not read heroku/main — check auth (see Step 0.4)."; exit 1; }

UNDEPLOYED=$(git rev-list --count "${HEROKU_SHA}..origin/main" 2>/dev/null || echo 0)
NEW_WORK=$(git rev-list --count origin/main..origin/develop)

# Missing-tag tripwire: main's tip is a release commit whose tag was never created
TIP_SUBJECT=$(git log -1 --format=%s origin/main)
MISSING_TAG=""
case "$TIP_SUBJECT" in
  "Release v"*|"Changelog v"*)
    TIP_VER=$(printf '%s' "$TIP_SUBJECT" | sed -E 's/^(Release|Changelog) (v[0-9.]+).*/\2/')
    git rev-parse -q --verify "refs/tags/${TIP_VER}" >/dev/null 2>&1 || MISSING_TAG="$TIP_VER"
    ;;
esac
```

Then branch on the two numbers:

```bash
if [ "$UNDEPLOYED" -gt 0 ] && [ "$NEW_WORK" -eq 0 ]; then
  echo "✗ DEPLOY ABORTED — a prior deploy did not finish, and there is nothing new to release."
  echo "    origin/main : $(git rev-parse --short origin/main)  ($UNDEPLOYED commits NOT on Heroku)"
  echo "    heroku/main : ${HEROKU_SHA:0:8}"
  [ -n "$MISSING_TAG" ] && echo "    tag $MISSING_TAG was never created — the run died between Step 9 and Step 12."
  echo "  develop == main, so running this skill would mint an EMPTY release: an empty --no-ff"
  echo "  merge, a CHANGELOG heading with no commits, and a version number burned for nothing."
  echo "  RESUME the old deploy instead — see 'Resuming an interrupted deploy' below."
  exit 1

elif [ "$UNDEPLOYED" -gt 0 ]; then
  echo "⚠ Heroku is $UNDEPLOYED commits behind origin/main — a prior deploy did not finish."
  echo "  This deploy WILL ship them, but ${DEPLOY_TAG:-this release}'s CHANGELOG and tag cover"
  echo "  only origin/main..develop, so these ride along unmentioned:"
  git log "${HEROKU_SHA}..origin/main" --no-merges --pretty='    - %s'
  [ -n "$MISSING_TAG" ] && echo "  Also: tag $MISSING_TAG is missing — create it before deploying."
  echo "  Proceeding. Note them in the release summary."

elif [ -n "$MISSING_TAG" ]; then
  echo "⚠ Heroku is current, but tag $MISSING_TAG for main's tip was never created."
  echo "  Create it now so release history stays contiguous:"
  echo "    git tag -a $MISSING_TAG origin/main -m 'Release $MISSING_TAG' && git push origin $MISSING_TAG"
fi
```

**Why this exists (2026-08-18).** A run completed Steps 8–9 (release merge, CHANGELOG) and Step
11's `git push origin main`, then stopped. Step 10 (`git tag`) and Step 12 (`git push heroku
main`) never ran. `develop`, `main`, `origin/develop` and `origin/main` were all clean and
identical at `a30c4c10` — every signal a human checks said shipped — while production served a
nine-hour-old slug missing the whole PR #30 PDP change. **Nothing in the skill asserts the deploy
landed**, and a run that dies after the GitHub push is indistinguishable from a successful one.
You cannot gate against your own crash from inside the run, so the catch has to be the *next*
run's pre-flight. Cost: one `ls-remote`.

⚠️ **The abort case is the important one.** It is exactly the state an interrupted deploy leaves
behind, and it is the state where blindly re-running does the most damage — an empty release that
burns a version number and writes a CHANGELOG entry with nothing under it.

### Step 0.5 — MEMORY.md size gate

```bash
MEMFILE="$HOME/.claude/projects/C--Users-erik-OneDrive---Northwest-Custom-Apparel-2025-Pricing-Index-File-2025/memory/MEMORY.md"
LINES=$(wc -l < "$MEMFILE")

if [ "$LINES" -gt 180 ]; then
  echo "✗ MEMORY.md is $LINES lines (hard limit 180). Condense before deploying."
  exit 1
elif [ "$LINES" -gt 150 ]; then
  echo "⚠ MEMORY.md is $LINES lines (warning ≥150, target ≤130). Condense soon."
else
  echo "MEMORY.md: $LINES lines"
fi
```

Runs *before* deploy so a failure here doesn't strand state half-changed.

### Step 0.6 — Deterministic gate (skippable)

If `--skip-tests` was NOT specified, run every check CI runs that needs no browser
and no network. Run them in cheapest-first order so a failure aborts fast:

```bash
for S in lint typecheck test:unit test:dom test:a11y; do
  node -e "process.exit(require('./package.json').scripts['$S']?0:1)" 2>/dev/null || continue
  echo "── $S"
  npm run "$S" || { echo "✗ $S failed — aborting deploy."; exit 1; }
done
```

If any fail → abort. Tell user: "`<name>` failed. Fix or re-run with `/deploy --skip-tests`
for emergencies."

**Why the whole set and not just `test:unit` (widened 2026-08-18).** `test:unit` alone was a
strict subset of CI, so three jobs could be — and were — red on `main` for **60+ consecutive
runs (2026-08-05 → 2026-08-18) across 10 releases**, with every deploy reporting ✅. ESLint went
red at v2026.08.10.9 on a missing `AbortController` global; `tsc checkJs` carried 15 errors;
Playwright lost all 10 specs the moment `/quote-builders` went behind the SAML gate. Nothing in
the deploy path looked at any of them, so "deploy is green" and "CI is green" quietly stopped
meaning the same thing. Measured 2026-08-18: **lint 2.2s · typecheck 4.9s · test:unit 8.9s ·
test:dom 3.1s · test:a11y 4.3s ≈ 23s total** — still cheaper than one Heroku build step.

⚠️ `--skip-tests` now bypasses ALL of it — unit, DOM, a11y, lint and typecheck. Treat it as a
genuine emergency lever (prod is down and the fix is verified another way), not a way past an
inconvenient red check. A red ratchet, parity or guard suite is exactly what this gate exists
to stop.

### Step 0.7 — CI conclusion for this commit (advisory)

The one CI job Step 0.6 cannot reproduce is **Playwright E2E**: it needs a browser download and
it reads live Caspio through the proxy. Running it here would put a vendor outage directly in
the deploy path — which this repo deliberately refuses to do (same reasoning as the diagnostic
capture job in `.github/workflows/ci.yml`). So check what CI already concluded instead of
re-running it:

```bash
if command -v gh >/dev/null 2>&1; then
  CONC=$(gh run list --branch develop --workflow ci.yml --limit 1 --json conclusion \
         --jq '.[0].conclusion' 2>/dev/null)
  case "$CONC" in
    success) echo "CI: ✅ green on develop" ;;
    "")      echo "⚠ CI: no run found for develop (or gh not authenticated) — E2E unverified." ;;
    *)       echo "⚠ CI: last develop run concluded '$CONC'. Step 0.6 covers everything EXCEPT"
             echo "  Playwright E2E — open the Actions tab and confirm the failure is not the"
             echo "  money path before shipping." ;;
  esac
else
  echo "⚠ gh CLI not installed — skipping the CI conclusion check (E2E unverified)."
fi
```

**Advisory, never an abort.** E2E depends on a third party being up, and a Caspio wobble must
not be able to block a release. A loud warning is enough: everything deterministic already had
its own hard gate one step above, so the only thing this can be warning about is E2E.

### Step 1 — Compute single deploy version

```bash
SHORT_SHA=$(git rev-parse --short HEAD)
TODAY=$(date +%Y.%m.%d)
N=$(( $(git tag -l "v${TODAY}.*" | wc -l) + 1 ))
DEPLOY_TAG="v${TODAY}.${N}"
DEPLOY_VERSION="${TODAY}.${N}"
echo "Deploy tag: $DEPLOY_TAG"
```

ONE version per deploy applied uniformly. No per-file divergence.

### Step 2 — Cache-bust auto-bump

1. Identify changed JS/JSX/CSS (both committed-vs-remote and working-tree dirty):

```bash
CHANGED_ASSETS=$( (git diff --name-only origin/main HEAD -- '*.js' '*.jsx' '*.css'; \
                   git status --porcelain | awk '/\.(jsx?|css)$/ {print $2}') | sort -u )
```

**The baseline is `origin/main` — what is LIVE — not `origin/develop`.** Diffing against
develop makes this whole step a no-op whenever develop was pushed before deploying (a
normal thing to do): `origin/develop..HEAD` is then empty, nothing gets bumped, the deploy
reports ✅, the SHA check passes, and every browser keeps serving cached assets. Caught
2026-08-03; assets had to be hand-bumped for several releases.

**`.jsx` MUST be included** (`*.jsx` pathspec + `jsx?` in the regex). In-browser-Babel
`.jsx` pages (today `dashboards/production-shifts/app.jsx`; originally the order form,
retired 2026-07-11) are referenced with `?v=` in their HTML. A `(js|css)` filter silently skips them, so the deploy ships new
`.jsx` that reps' browsers never load (stale cache) — a silent "deployed but nothing
changed" failure (caught 2026-06-09).

2. For each changed asset, find HTML refs and replace with `perl -i` (cross-platform — works in Windows git-bash, macOS, Linux; GNU `sed -i` does not):

```bash
BUMPED_HTML=""
MISSED_ASSETS=""
for ASSET in $CHANGED_ASSETS; do
  # Last two path segments, pure-bash (NO `rev`/`cut` — `rev` is absent in
  # Windows git-bash, the deploy host; an empty MATCH would bump EVERY ?v=).
  BASE="${ASSET##*/}"; DIR="${ASSET%/*}"
  if [ "$DIR" = "$ASSET" ]; then MATCH="$BASE"; else MATCH="${DIR##*/}/$BASE"; fi
  HIT=0

  # ── PASS 1 — cross-directory refs, matched on the LAST TWO path segments
  # (e.g. "pricing/shared.js"), NOT the bare basename. Basenames like shared.js /
  # print.css / index.js / utils.js collide across apps — a basename bump rewrites
  # the ?v= of UNRELATED pages that reference a different file with the same name
  # (caught 2026-06-09: an order-form pricing/shared.js change bumped 8 dashboards'
  # shared.js). A page in ANOTHER directory must write at least one parent segment
  # to reach this file, so a 2-segment suffix hits it and skips lookalikes.
  # --exclude-dir=.claude: NEVER write into .claude/worktrees/* — those are OTHER
  # sessions' checkouts; bumping them mutates cross-session state (caught 2026-07-08).
  for HTML in $(grep -rl --include="*.html" --exclude-dir=.claude "${MATCH}?v=" . 2>/dev/null); do
    perl -i -pe "s|(\Q${MATCH}\E\?v=)[^\"' >]+|\${1}${DEPLOY_VERSION}|g" "$HTML"
    BUMPED_HTML="$BUMPED_HTML $HTML"; HIT=1
    echo "  bumped ${MATCH} in $HTML → ?v=${DEPLOY_VERSION}"
  done

  # ── PASS 2 — SIBLING refs, which pass 1 structurally cannot see. A page sitting
  # in the asset's OWN directory references it by BARE name ("embroidery-contract.js?v="),
  # so the 2-segment token "embroidery-contract/embroidery-contract.js" never matches
  # and the ?v= silently stays stale — new code served, old code cached. Caught
  # 2026-08-05 at v2026.08.05.3, where ~1000 changed lines of contract PRICING js
  # were about to ship behind a cached ?v=. EVERY self-contained
  # /calculators/*/index.html has this shape.
  # Two things keep the 2026-06-09 collision from coming back: the search is scoped
  # to HTML in the asset's own directory, and the negative lookbehind refuses to
  # match when the basename is preceded by a path separator — so a sibling page that
  # ALSO references "other/shared.js?v=" keeps its own version.
  if [ "$DIR" != "$ASSET" ]; then
    for HTML in $(grep -ls --include="*.html" "${BASE}?v=" "$DIR"/*.html 2>/dev/null); do
      perl -i -pe "s|(?<![\\w./-])(\Q${BASE}\E\?v=)[^\"' >]+|\${1}${DEPLOY_VERSION}|g" "$HTML"
      BUMPED_HTML="$BUMPED_HTML $HTML"; HIT=1
      echo "  bumped ${BASE} (sibling) in $HTML → ?v=${DEPLOY_VERSION}"
    done
  fi

  # ── Silent-no-op detector. The failure mode this whole step exists to prevent is
  # invisible by construction: nothing bumped looks identical to nothing needed
  # bumping. If a changed asset is referenced with a ?v= in a shape neither pass
  # matches (e.g. "../foo.js?v="), flag it rather than ship stale.
  #
  # The ref must RESOLVE to this asset — a basename test alone is not enough.
  # Measured 2026-08-05: basename-only flagged 14 of 763 assets FALSELY, and they
  # clustered in the most-edited code in the repo (builders/{emb,dtg,scp}/*.js —
  # pricing.js, persistence.js, utils.js are ESM imports with no ?v= of their own,
  # but those basenames DO appear with ?v= on unrelated pages). A gate that fires
  # on every quote-builder release just teaches everyone to set
  # CACHEBUST_ALLOW_MISS=1 by reflex, which is how a red gate becomes no gate.
  # Resolving first: 0 false positives, and a genuine "../foo.js?v=" miss is still
  # caught (both directions verified against this repo).
  if [ "$HIT" = "0" ]; then
    BASE_RE=$(printf '%s' "$BASE" | sed 's/[.[\*^$]/\\&/g')
    for HTML in $(grep -rls --include="*.html" --exclude-dir=.claude "${BASE}?v=" . 2>/dev/null); do
      for REF in $(grep -oE "[\"'][^\"' >]*${BASE_RE}\?v=" "$HTML" 2>/dev/null \
                   | sed "s/^[\"']//; s/?v=\$//"); do
        # normalize the written ref against the page that contains it
        RESOLVED=$(case "$REF" in
                     /*) printf '%s' "${REF#/}" ;;
                     *)  printf '%s/%s' "$(dirname "${HTML#./}")" "$REF" ;;
                   esac | awk -F/ '{n=0
                     for(i=1;i<=NF;i++){ if($i==".."){if(n>0)n--}
                                         else if($i!="."&&$i!=""){a[++n]=$i} }
                     s=""; for(i=1;i<=n;i++) s=s (i>1?"/":"") a[i]; print s}')
        if [ "$RESOLVED" = "$ASSET" ]; then
          MISSED_ASSETS="$MISSED_ASSETS $ASSET"
          break 2
        fi
      done
    done
  fi
done

BUMPED_HTML=$(echo "$BUMPED_HTML" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')

if [ -n "$MISSED_ASSETS" ] && [ "$CACHEBUST_ALLOW_MISS" != "1" ]; then
  echo "✗ DEPLOY ABORTED — changed asset(s) whose ?v= was NOT bumped:"
  for A in $MISSED_ASSETS; do echo "    $A"; done
  echo "  Something in the HTML references that basename with a ?v=, but neither the"
  echo "  2-segment nor the sibling pass matched it. Shipping now would serve new code"
  echo "  behind a cached old ?v= — silently, on customers' and reps' browsers."
  echo "  Fix: bump that ref by hand (or teach Step 2 the shape), then re-deploy."
  echo "  False positive? If the ?v= hit is a DIFFERENT file that merely shares this"
  echo "  basename, re-run with CACHEBUST_ALLOW_MISS=1 after confirming by eye."
  exit 1
fi
```

The regex `[^"' >]+` matches alphanumeric and any suffix format — `20260424b`, `v15`, `1.2.3-rc1` all replaced cleanly. `\Q…\E` quotes the match token so the `/` and `.` in it are literal. Pass 2's `(?<![\w./-])` is what makes a bare-basename rewrite safe.

If no JS/JSX/CSS files changed, skip this step.

### Step 3 — Stage changes precisely

```bash
git add -u                          # tracked-file modifications only — never -A
for HTML in $BUMPED_HTML; do
  git add "$HTML"                   # bumped HTMLs from Step 2
done
```

**Never `git add -A`** — would catch `.env`, log files, downloaded CSVs, anything stray in the working tree.

### Step 3.5 — Guard: untracked assets referenced by HTML

`git add -u` stages tracked-file *modifications* but NOT untracked NEW files. If a
new asset (e.g. a freshly-split shared CSS/JS) is referenced by an HTML page but
was never `git add`-ed, the deploy ships the HTML that points at it while the asset
itself 404s in production. This happened on 2026-05-29 — `contract-pricing-2026.css`
was untracked, so the dedup'd contract calculators shipped without their stylesheet.
Catch it BEFORE committing:

```bash
ORPHAN=""
for ASSET in $(git ls-files --others --exclude-standard -- '*.js' '*.jsx' '*.css'); do
  # Same two passes as Step 2 (pure-bash, no `rev`). Incl .jsx.
  BASE="${ASSET##*/}"; DIR="${ASSET%/*}"
  if [ "$DIR" = "$ASSET" ]; then MATCH="$BASE"; else MATCH="${DIR##*/}/$BASE"; fi
  # Pass 1 — 2-segment suffix; a bare basename searched repo-wide would
  # false-positive on a same-name file in another dir and abort spuriously.
  if grep -rqs --include="*.html" "$MATCH" .; then ORPHAN="$ORPHAN $ASSET"; continue; fi
  # Pass 2 — sibling refs. A brand-new asset dropped next to the page that uses it
  # is referenced by BARE name, which pass 1 can't see: the guard stayed silent and
  # the page shipped pointing at a file that was never committed. Scoping the search
  # to the asset's own directory keeps the basename safe to match.
  if [ "$DIR" != "$ASSET" ] && grep -qs --include="*.html" "$BASE" "$DIR"/*.html 2>/dev/null; then
    ORPHAN="$ORPHAN $ASSET"
  fi
done
if [ -n "$ORPHAN" ]; then
  echo "✗ DEPLOY ABORTED — untracked asset(s) referenced by HTML (would 404 in prod):"
  for A in $ORPHAN; do echo "    $A"; done
  echo "  Fix: 'git add <file>' to ship it (or remove the HTML reference), then re-deploy."
  git reset -q   # undo Step 3 staging so the tree is left clean
  exit 1
fi
```

### Step 3.6 — Guard: foreign hunks + server boot probe

Two gates added after the 2026-07-19 outage (v2026.07.19.15): `git add -u` in a
SHARED checkout swept in ANOTHER session's in-progress `server.js` routes whose
`lib/` dependency was still untracked → the slug crashed on boot (`Cannot find
module`) → prod served H10 503s until a Heroku rollback.

**(a) Foreign-hunk check.** Before committing, list what Step 3 staged and
compare against the files THIS session actually changed. If `server.js` (or any
staged file you didn't knowingly edit) is in the diff, inspect it:

```bash
git diff --cached --name-only
# For any staged file you didn't change yourself:
git diff --cached server.js | head -80    # foreign routes/require()s = another session's work
```

If foreign hunks are found: `git restore --staged <file> && git checkout -- <file>`
is WRONG (it destroys the other session's working tree) — instead `git restore
--staged <file>` only, so their edits stay in the working tree uncommitted, and
proceed without them. Never deploy code you can't identify.

**(b) Boot probe.** A slug that doesn't boot 503s EVERY page including customer
storefronts. `node --check` misses missing modules — actually load the server:

```bash
node --check server.js || { echo "✗ ABORT — server.js syntax error"; git reset -q; exit 1; }
PORT=3113 timeout 15 node server.js > /tmp/bootprobe.log 2>&1
if ! grep -qE "listening|running|started|Server" /tmp/bootprobe.log; then
  echo "✗ DEPLOY ABORTED — server.js did not boot:"; tail -5 /tmp/bootprobe.log
  git reset -q; exit 1
fi
```

(`timeout` kills the probe server after it proves it can start; the grep matches
the startup banner. A `Cannot find module` lands in the log and aborts here
instead of in production.)

### Step 4 — Commit

```bash
N_FILES=$(git diff --cached --name-only | wc -l)
TOP3=$(git diff --cached --name-only | head -3 | xargs -n1 basename | tr '\n' ', ' | sed 's/, $//')
git commit -m "Deploy ${DEPLOY_TAG}: ${N_FILES} files (${TOP3}...)"
```

### Step 5 — Push develop to GitHub

```bash
git push origin develop
```

### Step 6 — Switch to main, hard pull

```bash
# A dirty working tree (stray edits after Step 4's commit, CRLF churn, or a
# CONCURRENT session writing to the same checkout) makes `git checkout main` ABORT.
# If that error is ignored you silently stay on develop and the rest of the deploy
# runs against the wrong branch — main/Heroku never update, yet it can look like it
# worked. Fail loudly instead (2026-05-29 incident).
if ! git checkout main; then
  echo "✗ DEPLOY ABORTED — could not switch to main (working tree dirty?)."
  echo "  Run 'git status'; commit or stash the stray changes, then re-deploy."
  echo "  (develop is already pushed at this point, so nothing is lost.)"
  exit 1
fi
git pull --ff-only origin main
```

If `--ff-only` fails (main diverged), abort:
1. `git checkout develop`
2. Tell user: "main has diverged from origin. Investigate — somebody pushed a hotfix directly?"

### Step 7 — Capture release commits (BEFORE merge)

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)
RELEASE_COMMITS=$(git log "${LAST_TAG}..develop" --pretty="- %s" --reverse)
echo "$RELEASE_COMMITS"
```

**Critical**: this captures develop's commits BEFORE the merge muddies the topology. Used in both Step 9 (CHANGELOG) and Step 10 (tag). The `|| git rev-list --max-parents=0 HEAD` fallback handles the first-ever deploy in a repo (no prior tag).

### Step 8 — Merge develop with `--no-ff`

```bash
git merge --no-ff develop -m "Release ${DEPLOY_TAG}"
```

Creates an explicit release-marker commit on main. After: `git log main --first-parent --oneline` is your clean release history.

**Conflict handling:**
1. `git merge --abort`
2. `git checkout develop`
3. Tell user:
   ```
   DEPLOY ABORTED: Merge conflict on main.

   Resolve manually:
     git checkout main
     git merge develop
     [resolve in editor]
     git add . && git commit
     /deploy

   You are back on develop branch.
   ```
4. STOP.

### Step 9 — Generate CHANGELOG entry

```bash
{
  echo "## ${DEPLOY_TAG} (${TODAY})"
  echo ""
  echo "${RELEASE_COMMITS}"
  echo ""
  [ -f CHANGELOG.md ] && cat CHANGELOG.md
} > CHANGELOG.md.new && mv CHANGELOG.md.new CHANGELOG.md

git add CHANGELOG.md
git commit -m "Changelog ${DEPLOY_TAG}"
```

Uses `$RELEASE_COMMITS` from Step 7. `CHANGELOG.md` becomes the auto-maintained release log with actual commit subjects, not just `- Release X`.

### Step 10 — Create annotated tag with real commit list

```bash
git tag -a "${DEPLOY_TAG}" -m "Release ${DEPLOY_TAG}

${RELEASE_COMMITS}"
```

`git tag -ln20` now shows actual subjects instead of meta-commits.

### Step 11 — Push main + specific tag (NOT `--tags`)

```bash
git push origin main
git push origin "${DEPLOY_TAG}"
```

Pushing the specific tag avoids leaking local-only/experimental tags to remote.

### Step 12 — Push to Heroku

```bash
git push heroku main
```

### Step 13 — Wait for Heroku release `status=succeeded`

```bash
# Robust JSON parser fallback chain
parse_release_status() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.[0].status'
  elif command -v python >/dev/null 2>&1; then
    python -c "import sys,json; print(json.load(sys.stdin)[0]['status'])"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import sys,json; print(json.load(sys.stdin)[0]['status'])"
  else
    echo "PARSER_MISSING"
  fi
}

for i in $(seq 1 60); do
  STATUS=$(heroku releases --json --app sanmar-inventory-app 2>/dev/null | parse_release_status)
  case "$STATUS" in
    succeeded)      echo "  ✓ Release succeeded"; break ;;
    failed)         echo "  ✗ Heroku release FAILED — check 'heroku releases:output'"; exit 1 ;;
    PARSER_MISSING) echo "  ✗ No JSON parser available. Install jq or python to enable release verification."; exit 1 ;;
    *)              sleep 2 ;;
  esac
done
```

Real release-status polling, not blind sleep. Robust on systems without `jq` or `python`.

### Step 14 — Live-version verification

**Skip condition:** if Step 2 reported no bumped HTML files AND no `/api/version` endpoint is available, set `VERIFY_REPORT="skipped (config-only deploy)"` and continue to Step 15.

**14a. Backend SHA check** (preferred — works for ALL deploys):

```bash
LIVE_SHA=$(curl -s -m 10 "https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/api/version?_=$(date +%s)" \
  | parse_sha 2>/dev/null)

parse_sha() {
  if command -v jq >/dev/null 2>&1; then jq -r '.sha // "unknown"'
  elif command -v python >/dev/null 2>&1; then python -c "import sys,json; print(json.load(sys.stdin).get('sha','unknown'))"
  elif command -v python3 >/dev/null 2>&1; then python3 -c "import sys,json; print(json.load(sys.stdin).get('sha','unknown'))"
  fi
}

if [ "$LIVE_SHA" = "$SHORT_SHA" ]; then
  echo "  ✓ Backend SHA verified ($LIVE_SHA)"
  VERIFIED=1
  VERIFY_REPORT="backend SHA $LIVE_SHA"
fi
```

If `/api/version` doesn't exist yet (404 or `unknown`), fall through to 14b.

**14b. Frontend `?v=` check** (when assets were bumped):

⚠️ **This check false-negatives on any content-hashed page.** Hashed assets are served as
`/dist/…<hash>.js`, so the `?v=` written in the HTML source is not in the response and the perl
match finds nothing — 14b then hands a genuinely-successful deploy to 14c, which restarts and
scale-cycles a healthy dyno for ~2 minutes before reporting `STALE`. If `$LIVE_VERSION` comes
back empty (as opposed to an *older* version), check whether the page serves `/dist/` first and
verify on bytes instead — see "Verifying a content-hashed frontend deploy" below. An *older*
`?v=` is a real stale slug; an *empty* one usually is not.

```bash
FIRST_HTML=$(echo "$BUMPED_HTML" | tr ' ' '\n' | grep -v '^$' | head -1)
ROUTE=$(echo "$FIRST_HTML" | sed -e 's|^pages/||' -e 's|^|/|' -e 's|\.html$||' -e 's|^/index$|/|')
LIVE_URL="https://sanmar-inventory-app-4cd7b252508d.herokuapp.com${ROUTE}"
EXPECTED="$DEPLOY_VERSION"

sleep 5
LIVE_VERSION=$(curl -s -m 10 "${LIVE_URL}?_=$(date +%s)" \
  | perl -ne 'print "$1\n" if /\?v=([^"\047 >]+)/' | head -1)

if [ "$LIVE_VERSION" = "$EXPECTED" ]; then
  echo "  ✓ Live version matches ($EXPECTED)"
  VERIFIED=1
  VERIFY_REPORT="?v=$EXPECTED"
fi
```

Uses `perl -ne` (cross-platform) instead of `grep -oP` (GNU-only).

**14c. Stale-slug recovery** (if neither 14a nor 14b verified):

```bash
# Poll up to 25s for natural propagation
for i in $(seq 1 5); do
  sleep 5
  # repeat 14a/14b check, set VERIFIED=1 on match
  [ "$VERIFIED" = "1" ] && break
done

# Still stale? Auto-restart
if [ "$VERIFIED" != "1" ]; then
  echo "  ⚠ Heroku served stale slug after release — auto-restarting dyno"
  heroku ps:restart --app sanmar-inventory-app
  for i in $(seq 1 18); do
    sleep 5
    [ "$VERIFIED" = "1" ] && { echo "  ✓ Dyno restarted; live serving ${EXPECTED}"; VERIFY_REPORT="?v=$EXPECTED (after restart)"; break; }
  done
fi

# Still stale after restart? Scale cycle
if [ "$VERIFIED" != "1" ]; then
  echo "  ⚠ Restart didn't help — cycling dyno scale"
  heroku ps:scale web=0 --app sanmar-inventory-app
  sleep 5
  heroku ps:scale web=1 --app sanmar-inventory-app
  for i in $(seq 1 12); do
    sleep 5
    [ "$VERIFIED" = "1" ] && { VERIFY_REPORT="?v=$EXPECTED (after scale cycle)"; break; }
  done
fi

# Manual escalation if still failing
if [ "$VERIFIED" != "1" ]; then
  echo "  ⚠ Live site STILL stuck. Investigate — possibly bad release or platform issue."
  echo "  Check: heroku logs --tail --app sanmar-inventory-app"
  VERIFY_REPORT="STALE — manual investigation required"
fi
```

### Step 15 — Slack deploy notification (silent)

```bash
if [ -n "$SLACK_DEPLOY_WEBHOOK_URL" ]; then
  curl -s -X POST "$SLACK_DEPLOY_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"🚀 Deployed ${DEPLOY_TAG} — ${N_FILES} files: ${TOP3}\"}" \
    > /dev/null 2>&1
fi
```

If env var unset, skip silently — no echo, no warning, no chatter. Either it posts or it doesn't.

### Step 16 — Return to develop, keep in sync

```bash
git checkout develop
git merge --ff-only main
git push origin develop
```

`--ff-only` is safe because main just got the release-merge commit + changelog commit. Keeps develop's tip at the changelog commit.

### Step 17 — Success message

```
✅ DEPLOY SUCCESSFUL — ${DEPLOY_TAG}

  Files:       ${N_FILES} (${TOP3}...)
  Tag:         ${DEPLOY_TAG}
  Live:        https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/
  Verified:    ${VERIFY_REPORT:-skipped (no asset changes, no /api/version)}

  Rollback if needed (see Rollback Procedure below):
    Fast:  heroku releases:rollback --app sanmar-inventory-app
    Full:  git checkout main && git revert -m 1 HEAD && git push origin main && git push heroku main
```

`$VERIFY_REPORT` is set in Step 14 (or its skip block). Possible values:
- `backend SHA abc1234` — Step 14a succeeded
- `?v=2026.05.16.3` — Step 14b succeeded
- `?v=2026.05.16.3 (after restart)` — Step 14c first escalation worked
- `?v=2026.05.16.3 (after scale cycle)` — Step 14c second escalation worked
- `STALE — manual investigation required` — all verification failed
- `skipped (config-only deploy)` — Step 14 skip condition matched

---

## The pre-push guard (enable it per clone)

`main` is protected by a `pre-push` hook: a push to `refs/heads/main` is refused unless the tip
commit's subject starts `Release v` or `Changelog v` — i.e. one this skill produced. It catches
`git push origin main`, `git push heroku main` and `git push heroku develop:main` alike. Pushing
`develop` is never blocked.

Git never version-controls `.git/hooks/`, so a fresh clone starts with **no** hook. Point git at
the tracked directory instead of copying files into it:

```bash
git config core.hooksPath scripts/git-hooks
```

Check yours: `git config core.hooksPath` should print `scripts/git-hooks`. If it's empty, **the
guard is off** and a hand push to main will succeed silently.

Two things to know:

- **It's local config, not tracked.** One command per clone; nothing can make it automatic.
- **It replaces `.git/hooks/` entirely, it doesn't merge.** Anything living only in `.git/hooks/`
  stops running the moment you set it, and a hook that isn't executable (`chmod +x`, tracked as
  mode `100755`) is skipped *silently*. **Any new hook goes in `scripts/git-hooks/`.**

---

## Resuming an interrupted deploy

Step 0.4a aborted, or a run died partway. **Resume it — do not re-run `/deploy`.** With
`develop == main` the skill has nothing to release and produces an empty version. Work out how
far the old run got, then execute only what's left.

### 1. Find the failure point

```bash
git fetch origin --prune --tags
HEROKU_SHA=$(git ls-remote heroku refs/heads/main | awk '{print $1}')

git log -1 --format='%h %s' origin/main                       # did Steps 8-9 run?
git rev-list --count "${HEROKU_SHA}..origin/main"             # >0 → Step 12 never ran
git tag -l "v$(date +%Y.%m.%d).*"                             # absent → Step 10 never ran
git rev-list --count origin/main..origin/develop              # 0 → nothing new to release
```

Read the tip subject of `origin/main`:

| Tip subject | How far it got | What's left |
|---|---|---|
| `Changelog v…` | through Step 9 | tag (10), push tag (11), Heroku (12), verify (13–14), resync (16) |
| `Release v…` | through Step 8 | CHANGELOG (9) onward |
| anything else | merge never happened | re-run `/deploy` normally — it is not interrupted |

### 2. Run the gates anyway

Resuming skips the skill, not the safety. Run Steps 0.5–0.7 and the Step 0.6 suite
(`lint`, `typecheck`, `test:unit`, `test:dom`, `test:a11y`) against the commit you are about to
ship, and confirm CI is green **on that exact SHA** — not merely on the branch:

```bash
gh run list --branch develop --workflow ci.yml --limit 3 --json conclusion,headSha \
  --jq '.[] | "\(.conclusion) \(.headSha[0:8])"'
```

Also confirm the cache-bust from the interrupted run actually covers what changed — Step 2 runs
before the merge, so it did happen, but verify rather than assume:

```bash
git diff --name-only "${HEROKU_SHA}" origin/main -- '*.js' '*.jsx' '*.css'
grep -oE '(<asset>)\?v=[^"'"'"' >]+' <the HTML that references it>
```

### 3. Execute the remaining steps

```bash
LAST_TAG=$(git tag -l 'v*' --sort=-v:refname | sed -n 2p)     # tag BEFORE the one you're creating
TIP_VER=$(git log -1 --format=%s origin/main | sed -E 's/^(Release|Changelog) (v[0-9.]+).*/\2/')
RELEASE_COMMITS=$(git log "${LAST_TAG}..origin/main" --no-merges --pretty='- %s' --reverse)

git tag -a "$TIP_VER" origin/main -m "Release $TIP_VER

$RELEASE_COMMITS"
git push origin "$TIP_VER"
git push heroku main
```

Then Steps 13–14 as written (release polling, live verification), and Step 16 to resync `develop`.

⚠️ **The pre-push hook allows this**: `main`'s tip is already a `Release v…`/`Changelog v…`
commit, so no `--no-verify` is needed. If you find yourself reaching for `--no-verify` here,
something else is wrong — re-read the tip subject.

### Verifying a content-hashed frontend deploy

**Step 14b's `?v=` check cannot work on this app** and returns a false negative every time.
Assets are content-hashed into `/dist/…<hash>.js`, so the `?v=` written in the HTML source never
appears in the served page. Verify on bytes instead — pick an identifier that exists only in the
new code, then grep the live hashed bundle:

```bash
JS=$(curl -s -m 25 "https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/product.html?style=PC54&_=$(date +%s)" \
     | grep -oE '/dist/product/js/[a-z-]+\.[a-f0-9]+\.js')
curl -s -m 25 "https://sanmar-inventory-app-4cd7b252508d.herokuapp.com${JS}" | grep -c '<marker>'
```

A marker that goes 0 → 1 across the push, plus a changed bundle hash, is proof the new code is
live. ⚠️ **Pick markers from string literals or CSS class names, never from variable names** —
minification mangles locals and changes case, so `smallOrderFee` vanishes while
`"pdp-cfg-fee-note"` survives. Get the candidate list straight from the diff:

```bash
git diff "${HEROKU_SHA}" origin/main -- <asset> | grep '^+' | grep -oE '"[a-z][a-zA-Z-]{8,}"' | sort -u
```

---

## Rollback Procedure

Two steps, in order. Step 1 stops the bleeding in seconds and touches no git; Step 2 is how the
revert actually lands. **Step 2 is not optional** — after a slug rollback, `main` still contains
the bad code, so the next `/deploy` would ship it straight back out.

### Step 1 — Stop the bleeding: Heroku slug rollback

Instant, git history untouched. Use the moment prod is broken; investigate after.

```bash
# See recent releases
heroku releases --app sanmar-inventory-app

# Roll back one release
heroku releases:rollback --app sanmar-inventory-app

# …or to a specific known-good one
heroku releases:rollback v<NNN> --app sanmar-inventory-app
```

Also the right and *only* tool when the bug is in the **slug, not the code** — a bad config var,
a platform glitch, a crashed dyno. In that case there is nothing to revert in git; fix the config
and redeploy.

### Step 2 — Land the revert in git: revert on develop, then `/deploy`

Revert on **develop** and ship it through the normal gated path. One revert commit, flowing
develop → main the way every other change does, with a tag and a CHANGELOG entry.

```bash
# Find the release merge commit you're undoing
git log main --first-parent --oneline | head -3      # look for "Release vYYYY.MM.DD.N"

git checkout develop
git pull --ff-only origin develop
git revert -m 1 <release-merge-sha> --no-edit        # -m 1: it's a merge commit
```

Then:

```
/deploy
```

**Do NOT revert on `main` and push by hand.** It produces a second, duplicate revert commit that
the next develop → main merge has to reconcile, and it skips every gate — which is how the bad
release got out in the first place. Prefer fixing forward if the fix is small and obvious;
`/deploy` runs the same gates either way.

### Last resort — hand revert on main

Only when the Heroku CLI is unavailable AND you cannot wait for `/deploy`'s gates.

```bash
git checkout main
git pull --ff-only origin main
git revert -m 1 HEAD --no-edit

git push --no-verify origin main
git push --no-verify heroku main
```

⚠️ **`--no-verify` is REQUIRED here, and it is easy to lose ten minutes to.** `.git/hooks/pre-push`
only lets a push to `main` through when the tip commit's subject starts `Release v` or
`Changelog v` (source: `scripts/git-hooks/pre-push`). A revert's subject is
`Revert "Release v2026.07.29.2"` — it does not match, so the push is refused. Mid-incident that
reads like git itself is broken.

Afterwards, resync and let the tooling catch up:

```bash
git checkout develop
git merge --ff-only main
git push origin develop
```

Then run `/deploy` on the next real change so the tag and CHANGELOG stop lagging main.

---

## Error Handling Quick Reference

| Failure | Auto-action | Manual step needed |
|---|---|---|
| Not on develop | Abort | `git checkout develop` |
| Heroku behind origin/main + nothing new to release (0.4a) | Abort — re-running would mint an empty release | Resume the interrupted deploy: tag, `git push heroku main`, verify. See "Resuming an interrupted deploy" |
| Heroku behind origin/main + develop has new work (0.4a) | Warn, proceed | None — the deploy ships them; note the ride-along commits in the release summary |
| Tag missing for main's tip release commit (0.4a) | Warn | `git tag -a <ver> origin/main -m 'Release <ver>' && git push origin <ver>` |
| develop behind origin | Abort | `git pull --ff-only origin develop` |
| Not heroku-authed | Abort | `heroku login` |
| MEMORY.md > 180 lines | Abort | Condense to topic files |
| Tests fail (any suite in `tests/unit/`) | Abort | Fix the test — it's the never-break rules speaking. `--skip-tests` is for prod-is-down emergencies only |
| Untracked asset referenced by HTML (Step 3.5) | Abort — would 404 in prod | `git add` the new file, re-deploy |
| Dirty tree blocks `checkout main` (Step 6) | Abort — won't deploy wrong branch | Commit/stash stray changes, re-deploy |
| Merge conflict on main | Auto `merge --abort`, return to develop | Resolve manually, re-run |
| `--ff-only` pull fails | Abort | Investigate divergent main |
| Heroku release `failed` | Abort | `heroku releases:output` to see why |
| No `jq` / `python` for status parsing | Abort | Install jq (`scoop install jq` or `brew install jq`) |
| Stale slug after release | Auto `ps:restart` → `ps:scale` cycle | Manual `heroku logs --tail` only if both fail |
| Push to Heroku hangs | None | `Ctrl-C`, check `heroku status`, retry |
| `fatal: Authentication failed for 'https://git.heroku.com/…'` **while `heroku auth:whoami` succeeds** | Abort at Step 12 | Git and the API authenticate SEPARATELY — see "Heroku CLI v11 git auth" below. Do NOT keep re-running `heroku login`; it cannot fix this on its own |
| `✗ Push to main blocked` from pre-push hook | Abort — by design | You pushed to `main` by hand. Use `/deploy`. The one legitimate `--no-verify` case is the hand rollback (see Rollback Procedure) — a `Revert "Release v…"` subject never matches the allowlist |

---

## Heroku CLI v11 git auth (fixed 2026-08-03 — read before "just log in again")

**Symptom:** `heroku auth:whoami` prints your email, but Step 12 dies with
`fatal: Authentication failed for 'https://git.heroku.com/sanmar-inventory-app.git/'`.

**Why:** the API and git authenticate through *different* stores. CLI **v11 removed the
`heroku git:credentials` command**, but the global git config still registered
`credential.https://git.heroku.com.helper = !heroku git:credentials`. That helper now
resolves to nothing, and v11's `heroku login` no longer writes `~/_netrc` either — so git
had no credential source at all while the API worked fine. Re-running `heroku login`
cannot fix it: the CLI stores its token in `%LOCALAPPDATA%\heroku\`, which the dead helper
never reads. Cost ~5 rounds of "I'm logged in" / "still unauthorized" before it was found.

**Fix (already applied, global config — one-time per machine):**

```bash
KEY='credential.https://git.heroku.com.helper'
git config --global --unset-all "$KEY"
git config --global --add "$KEY" ""
git config --global --add "$KEY" '!f() { if [ "$1" = get ]; then echo username=heroku; echo "password=$(heroku auth:token)"; fi; }; f'
```

The empty value resets the inherited helper list **for that host only**, so Windows
Credential Manager can't answer first with nothing usable; GitHub keeps using `manager`
and is untouched. The helper shells out to `heroku auth:token` on every push, so it always
uses whatever the CLI currently holds — meaning a plain `heroku login` DOES fix an expired
token from here on.

**Verify without pushing:** `git ls-remote heroku HEAD` — a SHA means auth works.

⚠️ `heroku auth:token` warns the session token expires (~30 days). When deploys start
failing again, `heroku login` is now genuinely sufficient. For a year-long token instead,
use `heroku authorizations:create`.

⚠️ **Do not run `heroku logout` to "reset" a broken login.** It empties `_netrc`, which on
an older CLI was the *last* thing still feeding git — that turns a working git push into a
broken one and makes the diagnosis harder.

## Environment Variables

| Var | Required? | Purpose |
|---|---|---|
| `SLACK_DEPLOY_WEBHOOK_URL` | Optional | Posts deploy summary to a Slack channel. Skill skips silently if unset. Use same pattern as existing `SLACK_SUPACOLOR_HEALTH_WEBHOOK_URL`. |
| `CACHEBUST_ALLOW_MISS` | Optional | Set to `1` to proceed past Step 2's silent-no-op abort. **Only** after eyeballing the listed assets and confirming the `?v=` hit belongs to a *different* file that merely shares the basename. If the ref really is unbumped, fix it instead — that is the exact failure this abort exists to catch. |

## Known cosmetic noise

Heroku CLI v9.x prints `Warning: heroku update available from 9.0.0 to 11.3.0.` on every call (to stderr). None of `HEROKU_UPDATE_CHECKER=false`, `HEROKU_DISABLE_AUTOUPDATE=1`, or `HEROKU_SUPPRESS_UPDATE_WARNINGS=1` suppress it on this CLI version. The warning is harmless — it leaks to the terminal but doesn't pollute captured stdout. To eliminate: run `heroku update` to upgrade the CLI.

## Follow-up tasks (not part of this skill)

1. **Add `/api/version` endpoint to caspio-pricing-proxy** — returns `{sha: process.env.HEROKU_SLUG_COMMIT}`. Heroku auto-sets `HEROKU_SLUG_COMMIT` if the `runtime-dyno-metadata` lab is enabled (`heroku labs:enable runtime-dyno-metadata`). Until this lands, Step 14a falls through to 14b (frontend `?v=` check), which still works.
2. **Wire `SLACK_DEPLOY_WEBHOOK_URL`** — create a `#deploys` channel webhook, add the URL to `.env` (and Heroku config vars if you want the running app to share the channel).

---

## What Changed From The Previous Version

Two rewrites in 2026-05-16:

**Pass 1 (initial rewrite, 18 issues):**

| Old behavior | New behavior |
|---|---|
| `git add -A` | `git add -u` + explicit HTML files (no .env risk) |
| No remote freshness check | Step 0.3 refuses if local develop is behind origin |
| Per-file independent version bumps | Single `$DEPLOY_VERSION` applied uniformly |
| `sed -i` (GNU-only) | `perl -i` cross-platform |
| `--no-edit` fast-forward merge | `--no-ff` with release-marker commit |
| Tag message: "Production deploy" | Tag message: actual commit list |
| `git push origin main --tags` | `git push origin main && git push origin <tag>` |
| Blind `sleep 5` then check live URL | Polls `heroku releases --json` until `succeeded` |
| Hardcoded `art-request-detail.js` sample | Dynamic — picks first bumped file |
| MEMORY.md audit happens post-deploy | Pre-flight gate (Step 0.5) |
| No CHANGELOG | Auto-generated from `git log` each release |
| No rollback docs | Two-playbook Rollback Procedure |
| No deploy notification | Optional Slack webhook |

**Pass 2 (post-run review, this version):**

| Old behavior | New behavior |
|---|---|
| Confirmation gate (AskUserQuestion at Step 6) | **Removed** — pre-flight gates are sufficient |
| Session-doc prompt (AskUserQuestion at Step 18) | **Removed** — memory updates happen separately per CLAUDE.md |
| `git log --first-parent` AFTER merge | **`$RELEASE_COMMITS` captured BEFORE merge** so CHANGELOG/tag bodies contain real commits |
| `grep -oP` (GNU-only) in Step 14b | `perl -ne` cross-platform |
| `LIVE_SHA:-via ?v=` (misleading when nothing ran) | `$VERIFY_REPORT` with accurate state |
| Silent timeout on python-less systems | `parse_release_status` chain: jq → python → python3 → explicit error |
| Heroku CLI update warning attempted to suppress | Documented as harmless cosmetic noise (env vars don't work on CLI v9.x) |
| MEMORY.md warning at 150–180 was silent | Explicit `⚠ MEMORY.md is X lines` echo |
| Slack "skipped silently" debug echo | Truly silent (no echo at all) |
| End-to-end 60–90s (with prompts) | End-to-end ~25–30s |

**Pass 3 (2026-07-28) — the smoke gate was too narrow:**

| Old behavior | New behavior |
|---|---|
| Step 0.6 ran `npm run test:parser` (`tests/unit/parser` only) | Runs `npm run test:unit` — the whole `tests/unit/` tree (~95 suites / ~1900 tests, <7s), falling back to `test:parser` if the script is absent |

Prompted by a real miss: `builders-function-length.test.js` went red on 2026-07-19 and rode
through several releases unnoticed, because the gate only ever looked at the parser suite.
The pricing-parity, security-guard, and ratchet suites that encode the never-break rules all
live in `tests/unit/` and were unguarded. Cost of the fix: ~7 seconds per deploy.

**Pass 4 (2026-08-05) — the cache-bust silently skipped whole classes of asset:**

| Old behavior | New behavior |
|---|---|
| `CHANGED_ASSETS` diffed against `origin/develop` | Diffs against **`origin/main`** — what is actually live. The old baseline made the step a no-op whenever develop had been pushed first |
| One matching pass (2-segment suffix only) | **Two passes**: 2-segment for cross-directory refs, plus a directory-scoped bare-basename pass for SIBLING refs |
| A miss was invisible | **Silent-no-op detector** aborts when a changed asset's basename carries a `?v=` that neither pass bumped (`CACHEBUST_ALLOW_MISS=1` to override after eyeballing) |
| Step 3.5 orphan guard used the 2-segment match only | Same two passes, so a brand-new sibling asset can't ship as a 404 |

Prompted by v2026.08.05.3: `calculators/embroidery-contract/index.html` references its own
assets as `embroidery-contract.js?v=` (bare — they're siblings), which the 2-segment token
`embroidery-contract/embroidery-contract.js` can never match. ~1000 changed lines of contract
**pricing** JS were about to ship behind a cached `?v=`, i.e. reps' browsers running the old
pricing code against the new server. Caught by hand during the deploy; every self-contained
`/calculators/*/index.html` has that shape.

The 2026-06-09 collision (a bare-basename bump rewriting 8 unrelated dashboards) does NOT come
back: pass 2 only searches HTML in the asset's **own directory**, and its `(?<![\w./-])`
lookbehind refuses to match a basename preceded by a path separator. Verified on fixtures — a
sibling `shared.js?v=` bumps while `sub/shared.js?v=` in the same file and another app's own
`shared.js?v=` both stay untouched.

**Pass 5 (2026-08-18) — nothing checked that the deploy actually deployed:**

| Old behavior | New behavior |
|---|---|
| Pre-flight looked only at `origin` | **Step 0.4a** reads `heroku/main` via `git ls-remote` and compares against `origin/main` |
| An interrupted run was undetectable | Aborts when Heroku is behind AND `develop == main`; warns (with the ride-along commit list) when there is new work |
| A skipped Step 10 left no trace | Missing-tag tripwire on `main`'s tip `Release v…`/`Changelog v…` subject |
| No recovery path — the only option was re-running the whole skill | **"Resuming an interrupted deploy"** section: failure-point table, which gates to re-run, and the exact remaining commands |
| Step 14b's `?v=` check treated as universal | Documented as a guaranteed false negative on content-hashed pages, with a byte-level marker check that does work |

Prompted by v2026.08.18.4. A run completed the release merge, the CHANGELOG, and `git push origin
main`, then stopped — Step 10 (tag) and Step 12 (Heroku push) never ran. `develop`, `main`,
`origin/develop` and `origin/main` were all clean and identical at `a30c4c10`, so **every
branch-level check reported success** while production served a nine-hour-old slug missing the
whole PR #30 PDP change (unpriceable placement chips still rendering, price table still collapsed,
small-order fee still a footnote). The tag `v2026.08.18.4` existed nowhere, local or remote.

Two things made this invisible. `origin` and `heroku` are **separate remotes reached by separate
pushes**, and only one of them is the deploy — so `origin/main` being current is not evidence
production is current, and nothing in the skill had ever asked Heroku what it had. And a run
cannot assert its own completion from inside itself, so the catch has to live in the *next* run's
pre-flight. Cost: one `ls-remote`.

The abort case earns its keep by refusing the *repair* that looks obvious: with `develop == main`,
re-running `/deploy` mints an empty release — an empty `--no-ff` merge, a CHANGELOG heading with
no commits under it, and a version number burned. The fix is to resume at Step 10, not restart at
Step 1. This was the second interrupted run in two days (the 2026-08-17 outage diagnosis found a
prior run's Step 16 had never completed either), so the recovery path is now written down rather
than re-derived each time.
