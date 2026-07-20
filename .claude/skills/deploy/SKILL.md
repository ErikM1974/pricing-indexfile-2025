---
name: Deploy to Production
description: Deploy current develop branch to production. Use when user says /deploy, "deploy to production", "push to heroku", "release to production", "deploy changes", "ship it", or "release changes". No interactive prompts — pre-flight gates (auth, freshness, tests, memory) guard the deploy. Single-version cache-bust, --no-ff release merge with changelog of actual commits, real release-status verification, auto-restart on stale slug, optional Slack notification.
---

# Deploy to Production Skill

Automates Northwest Custom Apparel's deploy pipeline `develop` → `main` → Heroku. Fast, non-interactive, traceable. End-to-end ~25–30 seconds when nothing's wrong.

## What This Skill Does

1. **Pre-flight gates** (Step 0.1–0.6) refuse to deploy bad state
2. **Single-version cache-bust** — one `$DEPLOY_VERSION` applied to all `?v=` query strings
3. **Precise staging** — `git add -u` + explicit HTML files, never `-A`
4. **Release-marker merge** — `--no-ff` so `git log --first-parent main` is a clean release log
5. **CHANGELOG of actual commits** — captures develop's commits BEFORE the merge so the changelog isn't empty
6. **Real Heroku release verification** via `heroku releases --json`, not blind sleep
7. **Dynamic stale-slug detection** with `ps:restart` → `ps:scale` escalation
8. **Optional Slack notification** (silent skip if webhook unset; no debug chatter)
9. **Copy-pasteable rollback** procedure at end of skill

**Non-interactive by design.** Pre-flight gates are the only thing standing between "you typed /deploy" and "code is live on Heroku." No confirmation gate, no session-doc prompt — both proved to be friction without payoff in real runs.

## Triggers

`/deploy` · "deploy to production" · "push to heroku" · "release to production" · "deploy changes" · "ship it" · "release changes"

Flags: `--skip-tests` (emergency bypass for Step 0.6)

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

### Step 0.6 — Smoke tests (skippable)

If `--skip-tests` was NOT specified:

```bash
if [ -f package.json ] && node -e "process.exit(require('./package.json').scripts['test:parser']?0:1)" 2>/dev/null; then
  npm run test:parser
fi
```

If tests fail → abort. Tell user: "Tests failed. Fix or re-run with `/deploy --skip-tests` for emergencies."

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
CHANGED_ASSETS=$( (git diff --name-only origin/develop HEAD -- '*.js' '*.jsx' '*.css'; \
                   git status --porcelain | awk '/\.(jsx?|css)$/ {print $2}') | sort -u )
```

**`.jsx` MUST be included** (`*.jsx` pathspec + `jsx?` in the regex). In-browser-Babel
`.jsx` pages (today `dashboards/production-shifts/app.jsx`; originally the order form,
retired 2026-07-11) are referenced with `?v=` in their HTML. A `(js|css)` filter silently skips them, so the deploy ships new
`.jsx` that reps' browsers never load (stale cache) — a silent "deployed but nothing
changed" failure (caught 2026-06-09).

2. For each changed asset, find HTML refs and replace with `perl -i` (cross-platform — works in Windows git-bash, macOS, Linux; GNU `sed -i` does not):

```bash
BUMPED_HTML=""
for ASSET in $CHANGED_ASSETS; do
  # Match on the LAST TWO path segments (e.g. "pricing/shared.js"), NOT the bare
  # basename. Basenames like shared.js / print.css / index.js / utils.js collide
  # across apps — a basename bump rewrites the ?v= of UNRELATED pages that
  # reference a different file with the same name (caught 2026-06-09: an
  # order-form pricing/shared.js change bumped 8 dashboards' shared.js). HTML refs
  # are relative (e.g. "order-form/pricing/shared.js?v="), so a 2-segment suffix
  # is specific enough to hit the right ref and skip same-name lookalikes.
  # Last two path segments, pure-bash (NO `rev`/`cut` — `rev` is absent in
  # Windows git-bash, the deploy host; an empty MATCH would bump EVERY ?v=).
  BASE="${ASSET##*/}"; DIR="${ASSET%/*}"
  if [ "$DIR" = "$ASSET" ]; then MATCH="$BASE"; else MATCH="${DIR##*/}/$BASE"; fi
  # --exclude-dir=.claude: NEVER write into .claude/worktrees/* — those are OTHER
  # sessions' checkouts; bumping them mutates cross-session state (caught 2026-07-08).
  for HTML in $(grep -rl --include="*.html" --exclude-dir=.claude "${MATCH}?v=" .); do
    perl -i -pe "s|(\Q${MATCH}\E\?v=)[^\"' >]+|\${1}${DEPLOY_VERSION}|g" "$HTML"
    BUMPED_HTML="$BUMPED_HTML $HTML"
    echo "  bumped ${MATCH} in $HTML → ?v=${DEPLOY_VERSION}"
  done
done
```

The regex `[^"' >]+` matches alphanumeric and any suffix format — `20260424b`, `v15`, `1.2.3-rc1` all replaced cleanly. `\Q…\E` quotes the match token so the `/` and `.` in the 2-segment suffix are literal.

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
  # Same 2-segment match as Step 2 (pure-bash, no `rev`) — a bare basename would
  # false-positive on a same-name file in another dir and abort spuriously. Incl .jsx.
  BASE="${ASSET##*/}"; DIR="${ASSET%/*}"
  if [ "$DIR" = "$ASSET" ]; then MATCH="$BASE"; else MATCH="${DIR##*/}/$BASE"; fi
  if grep -rqs --include="*.html" "$MATCH" .; then ORPHAN="$ORPHAN $ASSET"; fi
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

## Rollback Procedure

Two playbooks. Pick based on whether the bug is in the **slug** (env vars, Heroku platform) or the **code** (logic bug, regression).

### Fast — Heroku slug rollback (code unchanged)

Use when: bad config var, Heroku platform glitch, dyno crash, or you need to revert NOW and investigate later.

```bash
# See recent releases
heroku releases --app sanmar-inventory-app

# Roll back to a specific known-good release
heroku releases:rollback v<NNN> --app sanmar-inventory-app

# Or just roll back one release
heroku releases:rollback --app sanmar-inventory-app
```

Git history is untouched. Re-deploying without further changes will redeploy the broken slug — so this is a stopgap, not a fix.

### Full — Git revert + redeploy

Use when: the bug is in the actual code. Creates a clean revert commit and a new release.

```bash
git checkout main
git pull --ff-only origin main

# Revert the release merge commit (-m 1 = keep main's history, drop develop's changes)
git revert -m 1 HEAD --no-edit

# Push the revert
git push origin main
git push heroku main

# Bring develop back to a sane state
git checkout develop
git revert -m 1 <release-merge-sha> --no-edit
git push origin develop
```

After: develop and main are both back to pre-release state. Investigate the bug, fix on develop, `/deploy` again.

---

## Error Handling Quick Reference

| Failure | Auto-action | Manual step needed |
|---|---|---|
| Not on develop | Abort | `git checkout develop` |
| develop behind origin | Abort | `git pull --ff-only origin develop` |
| Not heroku-authed | Abort | `heroku login` |
| MEMORY.md > 180 lines | Abort | Condense to topic files |
| Tests fail | Abort | Fix tests, or `--skip-tests` for emergency |
| Untracked asset referenced by HTML (Step 3.5) | Abort — would 404 in prod | `git add` the new file, re-deploy |
| Dirty tree blocks `checkout main` (Step 6) | Abort — won't deploy wrong branch | Commit/stash stray changes, re-deploy |
| Merge conflict on main | Auto `merge --abort`, return to develop | Resolve manually, re-run |
| `--ff-only` pull fails | Abort | Investigate divergent main |
| Heroku release `failed` | Abort | `heroku releases:output` to see why |
| No `jq` / `python` for status parsing | Abort | Install jq (`scoop install jq` or `brew install jq`) |
| Stale slug after release | Auto `ps:restart` → `ps:scale` cycle | Manual `heroku logs --tail` only if both fail |
| Push to Heroku hangs | None | `Ctrl-C`, check `heroku status`, retry |

---

## Environment Variables

| Var | Required? | Purpose |
|---|---|---|
| `SLACK_DEPLOY_WEBHOOK_URL` | Optional | Posts deploy summary to a Slack channel. Skill skips silently if unset. Use same pattern as existing `SLACK_SUPACOLOR_HEALTH_WEBHOOK_URL`. |

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
