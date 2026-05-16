---
name: Deploy to Production
description: Deploy current develop branch to production. Use when user says /deploy, "deploy to production", "push to heroku", "release to production", "deploy changes", "ship it", or "release changes". Pre-flight gates (auth, freshness, tests, memory), single-version cache-bust, --no-ff release merge with changelog, real release-status verification, auto-restart on stale slug, Slack notification.
---

# Deploy to Production Skill

Automates Northwest Custom Apparel's deploy pipeline `develop` → `main` → Heroku with strict safety gates, traceable release artifacts, and self-healing for stale slugs.

## What This Skill Does

1. **Pre-flight gates** (Step 0.1–0.6) refuse to deploy bad state
2. **Single-version cache-bust** — one `$DEPLOY_VERSION` applied to all `?v=` query strings
3. **Precise staging** — `git add -u` + explicit HTML files, never `-A`
4. **Release-marker merge** — `--no-ff` so `git log --first-parent main` is a clean release log
5. **Auto-generated CHANGELOG.md** from `git log` between previous tag and HEAD
6. **Real Heroku release verification** via `heroku releases --json`, not blind sleep
7. **Dynamic stale-slug detection** with `ps:restart` → `ps:scale` escalation
8. **Slack deploy notification** (silent skip if webhook unset)
9. **Copy-pasteable rollback** procedure at end of skill

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

This prevents the silent "deployed stale local" disaster when work was pushed from another machine.

### Step 0.4 — Heroku auth + remote check

```bash
heroku auth:whoami
git remote get-url heroku
```

If `auth:whoami` fails → abort: "Run `heroku login` first."
If `git remote get-url heroku` fails → abort: "No heroku remote — run `heroku git:remote -a sanmar-inventory-app`."

Refusing to start a deploy that would fail at Step 12 keeps `main` and Heroku in sync.

### Step 0.5 — MEMORY.md size gate

```bash
MEMFILE="$HOME/.claude/projects/C--Users-erik-OneDrive---Northwest-Custom-Apparel-2025-Pricing-Index-File-2025/memory/MEMORY.md"
LINES=$(wc -l < "$MEMFILE")
echo "MEMORY.md: $LINES lines"
```

- `> 180` lines → **HARD STOP.** Condense MEMORY.md (move detail to topic files) before deploying.
- `> 150` lines → warning only, proceed.
- `≤ 150` lines → proceed silently.

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

1. Identify changed JS/CSS (both committed-vs-remote and working-tree dirty):

```bash
CHANGED_ASSETS=$( (git diff --name-only origin/develop HEAD -- '*.js' '*.css'; \
                   git status --porcelain | awk '/\.(js|css)$/ {print $2}') | sort -u )
```

2. For each changed asset, find HTML refs and replace with `perl -i` (cross-platform — works in Windows git-bash, macOS, Linux; GNU `sed -i` does not):

```bash
BUMPED_HTML=""
for ASSET in $CHANGED_ASSETS; do
  BASENAME=$(basename "$ASSET")
  for HTML in $(grep -rl --include="*.html" "${BASENAME}?v=" .); do
    perl -i -pe "s|(\Q${BASENAME}\E\?v=)[^\"' >]+|\${1}${DEPLOY_VERSION}|g" "$HTML"
    BUMPED_HTML="$BUMPED_HTML $HTML"
    echo "  bumped $BASENAME in $HTML → ?v=${DEPLOY_VERSION}"
  done
done
```

The regex `[^"' >]+` matches alphanumeric and any suffix format — `20260424b`, `v15`, `1.2.3-rc1` all replaced cleanly. No more half-replacements.

If no JS/CSS files changed, skip this step.

### Step 3 — Stage changes precisely

```bash
git add -u                          # tracked-file modifications only — never -A
for HTML in $BUMPED_HTML; do
  git add "$HTML"                   # bumped HTMLs from Step 2 (may already be tracked)
done
```

**Never `git add -A`** — would catch `.env`, log files, downloaded CSVs, anything stray in the working tree.

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

### Step 6 — 🛑 CONFIRMATION GATE (REQUIRED)

Use `AskUserQuestion`. Show:

```
READY TO DEPLOY TO PRODUCTION?

  Branch:        develop
  Deploy tag:    ${DEPLOY_TAG}
  Committed:     ${N_FILES} files (${TOP3})
  New commits since last release:
${git log $(git describe --tags --abbrev=0)..HEAD --oneline}

Next steps will:
  - Merge develop → main with --no-ff
  - Generate CHANGELOG.md entry
  - Create annotated tag with commit log
  - Push to GitHub + Heroku (PRODUCTION)
  - Verify live site, auto-restart if stale

Proceed?
```

If user says no → `git checkout develop` (already there) and stop. Develop is already pushed; nothing destructive happened.

### Step 7 — Switch to main, hard pull

```bash
git checkout main
git pull --ff-only origin main
```

If `--ff-only` fails (main diverged), abort:
1. `git checkout develop`
2. Tell user: "main has diverged from origin. Investigate — somebody pushed a hotfix directly?"

### Step 8 — Merge develop with `--no-ff`

```bash
git merge --no-ff develop -m "Release ${DEPLOY_TAG}"
```

Creates an explicit release-marker commit on main. After: `git log main --first-parent --oneline` is your clean release history.

**Conflict handling (unchanged from old skill):**
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
LAST_TAG=$(git describe --tags --abbrev=0 HEAD^)
{
  echo "## ${DEPLOY_TAG} (${TODAY})"
  echo ""
  git log "${LAST_TAG}..HEAD" --first-parent --pretty="- %s" --reverse
  echo ""
  [ -f CHANGELOG.md ] && cat CHANGELOG.md
} > CHANGELOG.md.new && mv CHANGELOG.md.new CHANGELOG.md

git add CHANGELOG.md
git commit -m "Changelog ${DEPLOY_TAG}"
```

`CHANGELOG.md` is now the auto-maintained release log — no manual editing required, ever.

### Step 10 — Create annotated tag with real message

```bash
git tag -a "${DEPLOY_TAG}" -m "Release ${DEPLOY_TAG}

$(git log "${LAST_TAG}..HEAD" --first-parent --pretty='- %s' --reverse)"
```

`git tag -ln20` now shows useful summaries instead of identical "Production deploy" lines.

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
for i in $(seq 1 60); do
  STATUS=$(heroku releases --json --app sanmar-inventory-app | head -c 4096 | python -c "import sys,json; print(json.load(sys.stdin)[0]['status'])" 2>/dev/null)
  case "$STATUS" in
    succeeded) echo "  Release succeeded"; break ;;
    failed)    echo "  Heroku release FAILED — check 'heroku releases:output'"; exit 1 ;;
    *)         sleep 2 ;;
  esac
done
```

Real release-status polling, not blind `sleep 5`. (Use `python` instead of `jq` since `jq` isn't always on Windows git-bash. If `jq` is available, substitute `jq -r '.[0].status'`.)

### Step 14 — Live-version verification

**Skip condition:** if Step 2 reported no bumped HTML files AND no `/api/version` endpoint is available, skip to Step 15.

**14a. Backend SHA check** (preferred — works for ALL deploys):

```bash
LIVE_SHA=$(curl -s -m 10 "https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/api/version?_=$(date +%s)" | python -c "import sys,json; print(json.load(sys.stdin).get('sha','unknown'))" 2>/dev/null)

if [ "$LIVE_SHA" = "$SHORT_SHA" ]; then
  echo "  ✓ Backend SHA verified ($LIVE_SHA)"
  VERIFIED=1
fi
```

If `/api/version` doesn't exist yet (404 or `unknown`), fall through to 14b.

**14b. Frontend `?v=` check** (when assets were bumped):

```bash
# Pick the first bumped HTML and derive its live URL
FIRST_HTML=$(echo "$BUMPED_HTML" | tr ' ' '\n' | grep -v '^$' | head -1)
ROUTE=$(echo "$FIRST_HTML" | sed -e 's|^pages/||' -e 's|^|/|' -e 's|\.html$||' -e 's|^/index$|/|')
LIVE_URL="https://sanmar-inventory-app-4cd7b252508d.herokuapp.com${ROUTE}"

# Expected version is whatever Step 2 just wrote
EXPECTED="$DEPLOY_VERSION"

sleep 5
LIVE_VERSION=$(curl -s -m 10 "${LIVE_URL}?_=$(date +%s)" | grep -oP '\?v=\K[^"]+' | head -1)

if [ "$LIVE_VERSION" = "$EXPECTED" ]; then
  echo "  ✓ Live version matches ($EXPECTED)"
  VERIFIED=1
fi
```

**14c. Stale-slug recovery** (if neither 14a nor 14b verified):

```bash
# Poll up to 25s for natural propagation
for i in $(seq 1 5); do
  sleep 5
  # repeat 14a/14b check
  [ "$VERIFIED" = "1" ] && break
done

# Still stale? Auto-restart
if [ "$VERIFIED" != "1" ]; then
  echo "  ⚠ Heroku served stale slug after release — auto-restarting dyno"
  heroku ps:restart --app sanmar-inventory-app
  for i in $(seq 1 18); do
    sleep 5
    # repeat check
    [ "$VERIFIED" = "1" ] && { echo "  ✓ Dyno restarted; live serving ${EXPECTED}"; break; }
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
    [ "$VERIFIED" = "1" ] && break
  done
fi

# Manual escalation if still failing
if [ "$VERIFIED" != "1" ]; then
  echo "  ⚠ Live site STILL stuck. Investigate — possibly bad release or platform issue."
  echo "  Check: heroku logs --tail --app sanmar-inventory-app"
fi
```

### Step 15 — Slack deploy notification (silent fallback)

```bash
if [ -n "$SLACK_DEPLOY_WEBHOOK_URL" ]; then
  curl -s -X POST "$SLACK_DEPLOY_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"🚀 Deployed ${DEPLOY_TAG} — ${N_FILES} files: ${TOP3}\"}" \
    > /dev/null
fi
```

If env var unset, skip silently — no error, no warning.

### Step 16 — Return to develop, keep in sync

```bash
git checkout develop
git merge --ff-only main
git push origin develop
```

`--ff-only` here is safe because main just got a release commit develop doesn't have yet. Keeps develop's tip at the release-merge.

### Step 17 — Success message

```
✅ DEPLOY SUCCESSFUL — ${DEPLOY_TAG}

  Files:        ${N_FILES} (${TOP3}...)
  Tag:          ${DEPLOY_TAG}
  Live:         https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/
  SHA verified: ${LIVE_SHA:-via ?v=}

  Rollback if needed (see Rollback Procedure below):
    Fast:  heroku releases:rollback --app sanmar-inventory-app
    Full:  git checkout main && git revert -m 1 HEAD && git push origin main && git push heroku main
```

### Step 18 — Session documentation (non-blocking)

Use `AskUserQuestion`:
- **Bug fix** → Collect Problem/Root Cause/Solution/Prevention, append to `/memory/LESSONS_LEARNED.md`. If the fix changes documented behavior, update MEMORY.md too.
- **New feature / integration** → Add a concise entry to MEMORY.md (key facts, sync rules, gotchas only). Details >10 lines → topic file.
- **Nothing notable** → Skip.

**Rules for MEMORY.md updates:**
- Sync rules, gotchas, architecture decisions, essential API facts only
- Detail goes in topic files (`emb-builder-details.md`, etc.), not MEMORY.md
- One-time script results, batch stats → nowhere
- After updating, re-check line count. If over 150, condense before next deploy

This step does NOT block deploy success. Deploy is already done by here.

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
| Merge conflict on main | Auto `merge --abort`, return to develop | Resolve manually, re-run |
| `--ff-only` pull fails | Abort | Investigate divergent main |
| Heroku release `failed` | Abort | `heroku releases:output` to see why |
| Stale slug after release | Auto `ps:restart` → `ps:scale` cycle | Manual `heroku logs --tail` only if both fail |
| Push to Heroku hangs | None | `Ctrl-C`, check `heroku status`, retry |

---

## Environment Variables

| Var | Required? | Purpose |
|---|---|---|
| `SLACK_DEPLOY_WEBHOOK_URL` | Optional | Posts deploy summary to a Slack channel. Skill skips silently if unset. Use same pattern as existing `SLACK_SUPACOLOR_HEALTH_WEBHOOK_URL`. |

## Follow-up tasks (not part of this skill)

1. **Add `/api/version` endpoint to caspio-pricing-proxy** — returns `{sha: process.env.HEROKU_SLUG_COMMIT}`. Heroku auto-sets `HEROKU_SLUG_COMMIT` if the `runtime-dyno-metadata` lab is enabled (`heroku labs:enable runtime-dyno-metadata`). Until this lands, Step 14a falls through to 14b (frontend `?v=` check), which still works.
2. **Wire `SLACK_DEPLOY_WEBHOOK_URL`** — create a `#deploys` channel webhook, add the URL to `.env` (and Heroku config vars if you want the running app to share the channel).

---

## What Changed From The Previous Version

This is a full rewrite addressing 18 issues identified in 2026-05-16 review. Highlights:

| Old behavior | New behavior |
|---|---|
| `git add -A` | `git add -u` + explicit HTML files (no .env risk) |
| No remote freshness check | Step 0.3 refuses if local develop is behind origin |
| Per-file independent version bumps | Single `$DEPLOY_VERSION` applied uniformly |
| `sed -i` (GNU-only, half-replaces suffixed versions) | `perl -i` with robust regex |
| `--no-edit` fast-forward merge | `--no-ff` with release-marker commit |
| Tag message: "Production deploy" | Tag message: actual commit list from `git log` |
| `git push origin main --tags` | `git push origin main && git push origin <tag>` |
| Blind `sleep 5` then check live URL | Polls `heroku releases --json` until `succeeded` |
| Hardcoded `art-request-detail.js` sample | Dynamic — picks first bumped file, derives route |
| MEMORY.md audit happens post-deploy | Pre-flight gate (Step 0.5) — can't strand mid-deploy |
| No CHANGELOG | Auto-generated from `git log` each release |
| No rollback docs | Two-playbook Rollback Procedure section |
| No deploy notification | Slack webhook (optional, silent skip if unset) |
