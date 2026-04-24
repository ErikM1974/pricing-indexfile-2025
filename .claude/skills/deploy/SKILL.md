---
name: Deploy to Production
description: Deploy current develop branch to production. Use when user says /deploy, "deploy to production", "push to heroku", "release to production", "deploy changes", "ship it", or "release changes". Commits changes, pushes develop, merges to main, creates version tag, pushes to GitHub and Heroku, then returns to develop branch.
---

# Deploy to Production Skill

This skill automates the full deployment workflow for Northwest Custom Apparel's Pricing Index project.

## What This Skill Does

Executes a complete deployment pipeline:
1. Commits any uncommitted changes (auto-generated message)
2. Pushes develop branch to GitHub
3. Merges develop into main
4. Creates a version tag (e.g., v2025.12.23.1)
5. Pushes main to GitHub and Heroku
6. Returns to develop branch

## When to Use This Skill

Use this skill when the user says:
- "/deploy"
- "deploy to production"
- "push to heroku"
- "release to production"
- "deploy changes"
- "ship it"
- "release changes"

## Implementation

Execute these steps in order. **Stop immediately if any step fails.**

### Step 1: Check Current Branch and Status

```bash
# Verify we're on develop branch
git branch --show-current
```

If not on develop, inform the user and stop.

```bash
# Check for uncommitted changes
git status --porcelain
```

### Step 1.5: Auto-Bump Cache-Bust Versions

**REQUIRED before committing.** For each modified `.js` or `.css` file detected in Step 1:

1. Get the list of changed JS/CSS files:
```bash
git diff --name-only HEAD | grep -E '\.(js|css)$'
```
Also check unstaged/untracked:
```bash
git status --porcelain | grep -E '\.(js|css)$' | awk '{print $2}'
```

2. For each changed file, extract the filename and find all HTML files referencing it with `?v=`:
```bash
# Example for mockup-detail.js:
grep -rn "mockup-detail\.js?v=" --include="*.html" .
```

3. Bump the version number in each matching HTML file:
   - **Simple number** (e.g., `?v=12`): increment by 1 → `?v=13`
   - **Date-based** (e.g., `?v=20260317`): replace with today's date in YYYYMMDD format
   - Use `sed -i` for the replacement. Example:
```bash
sed -i "s/mockup-detail\.js?v=[0-9]*/mockup-detail.js?v=13/g" pages/mockup-detail.html
```

4. Stage the modified HTML files so they're included in the deploy commit.

5. Report what was bumped:
```
Cache-bust: mockup-detail.js v12→v13 (1 file), mockup-detail.css v11→v12 (1 file)
```

**If no JS/CSS files were changed, skip this step.**

### Step 2: Commit Changes (if any)

Only run if there are uncommitted changes from Step 1:

```bash
# Stage all changes
git add -A

# Get list of changed files for commit message
git diff --cached --name-only
```

Generate commit message based on changed files:
- Format: `Deploy: updated X files (file1.js, file2.css, ...)`
- If more than 3 files, show first 3 with "... and X more"

```bash
# Create commit with auto-generated message
git commit -m "Deploy: updated X files (file1, file2, ...)"
```

### Step 3: Push Develop to GitHub

```bash
git push origin develop
```

### Step 4: ASK FOR CONFIRMATION (REQUIRED)

**CRITICAL: You MUST ask the user for confirmation before proceeding to production.**

Display a summary and ask:
```
READY TO DEPLOY TO PRODUCTION?

Summary so far:
- Branch: develop
- Committed: X files
- Pushed to: GitHub (develop branch)

Next steps will:
- Merge develop → main
- Create version tag
- Push to GitHub (main) and Heroku (PRODUCTION)

Are you ready to proceed?
```

Use the AskUserQuestion tool to get explicit confirmation. **DO NOT proceed without user approval.**

If user says no or wants to stop, return to develop branch and stop.

### Step 5: Switch to Main Branch

```bash
git checkout main
```

### Step 6: Pull Latest Main (Safety Check)

```bash
git pull origin main
```

### Step 7: Merge Develop into Main

```bash
git merge develop --no-edit
```

**CRITICAL: If merge fails due to conflict:**
1. Run `git merge --abort`
2. Run `git checkout develop`
3. Display error message to user:
   ```
   DEPLOY ABORTED: Merge conflict detected!

   Please resolve conflicts manually:
   1. git checkout main
   2. git merge develop
   3. Resolve conflicts in your editor
   4. git add . && git commit
   5. Run /deploy again

   You are back on develop branch.
   ```
4. **STOP** - do not continue with remaining steps

### Step 8: Create Version Tag

Generate tag in format: `vYYYY.MM.DD.N` where N is sequence number for the day.

```bash
# Get today's date
date +%Y.%m.%d

# Check for existing tags today to determine sequence number
git tag -l "v$(date +%Y.%m.%d).*"
```

If no tags exist for today, use `.1`. Otherwise increment the last sequence number.

```bash
# Create annotated tag
git tag -a v2025.12.23.1 -m "Production deploy"
```

### Step 9: Push Main to GitHub (with tags)

```bash
git push origin main --tags
```

### Step 10: Push Main to Heroku

```bash
git push heroku main
```

### Step 10.5: Verify Heroku Serves Fresh Content (Auto-Restart if Stale)

**Why this exists**: We've observed repeatedly (2026-04-23 and 2026-04-24) that Heroku reports `Released vNNN` and the git push completes successfully, yet the live dyno keeps serving the **previous slug** — sometimes for several minutes, sometimes indefinitely until a manual `heroku ps:restart`. Root cause appears to be session affinity on a single-dyno setup (see the `heroku-session-affinity` cookie in every response). Without this step, the `/deploy` success message is misleading — the user refreshes, sees old code, and wastes time debugging what's actually a stale-slug issue.

**Skip condition**: If Step 1.5 reported no JS/CSS cache-bumps (i.e., no frontend changes), there's nothing to verify — skip to Step 11.

**Procedure**:

1. Pick ONE representative cache-bumped JS file from Step 1.5. First choice: `pages/js/art-request-detail.js` if it was bumped (most common). Otherwise the first file in the bumped list.

2. Extract the NEW version value from the local HTML that hosts it. Example:
```bash
# If art-request-detail.js was bumped
NEW_VERSION=$(grep -oP 'art-request-detail\.js\?v=\K[^"]+' pages/art-request-detail.html | head -1)
echo "Expected live version: $NEW_VERSION"
```

3. Initial pause for natural slug propagation (~5s), then curl-check the live URL that serves that HTML. Use a unique cache-bust query param:
```bash
sleep 5
LIVE_URL="https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/art-request/52833"
LIVE_VERSION=$(curl -s "${LIVE_URL}?_=$(date +%s)" | grep -oP 'art-request-detail\.js\?v=\K[^"]+' | head -1)
```

4. Compare. If `LIVE_VERSION` equals `NEW_VERSION` → live site is fresh, proceed to Step 11.

5. If mismatch, poll once every 5 seconds for up to 20 seconds total (using Monitor with an until-loop or run_in_background). If it catches up naturally within that window → proceed.

6. **If still stale after 25 seconds**: Heroku isn't propagating on its own. Auto-restart the dyno:
```bash
heroku ps:restart --app sanmar-inventory-app
```
Report to user: `⚠ Heroku served stale slug after release — auto-restarting dyno.`

7. After `ps:restart`, poll again (every 5s for up to 90s) until `LIVE_VERSION == NEW_VERSION`. Once matched, report `✓ Dyno restarted; live site now serving $NEW_VERSION` and proceed to Step 11.

8. **Escalation path** (rare): if after the restart the site is still stale for 90+ seconds, try a scale cycle:
```bash
heroku ps:scale web=0 --app sanmar-inventory-app
sleep 5
heroku ps:scale web=1 --app sanmar-inventory-app
```
Then poll for up to 60 more seconds. If still stale after that, stop and tell the user: `⚠ Live site is stuck serving $LIVE_VERSION. Investigate manually — possibly a bad release or platform issue.`

**Important**: Never skip this step on frontend deploys. The stale-slug issue is silent to Heroku's build logs but visible to end users.

### Step 11: Return to Develop Branch

```bash
git checkout develop
```

### Step 12: Display Success Message

```
DEPLOY SUCCESSFUL!

Summary:
- Committed: X files
- Version tag: v2025.12.23.1
- Pushed to: GitHub (develop + main) and Heroku

Main branch is now live at:
https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/
```

### Step 13: Memory Audit (REQUIRED)

Before asking about session documentation, check MEMORY.md health:

```bash
MEMFILE="$HOME/.claude/projects/C--Users-erik-OneDrive---Northwest-Custom-Apparel-2025-Pricing-Index-File-2025/memory/MEMORY.md"
wc -l < "$MEMFILE"
```

- If **over 180 lines**: STOP and condense MEMORY.md before continuing. Move detailed content to topic files.
- If **under 180 lines**: Report the count (e.g., "MEMORY.md: 94/200 lines") and continue.

### Step 14: Session Documentation (REQUIRED)

Ask the user what type of work was done this session:

Use AskUserQuestion with options:
- "Bug fix" → Collect Problem/Root Cause/Solution/Prevention, add to `/memory/LESSONS_LEARNED.md`. If the fix changes documented behavior, also update MEMORY.md.
- "New feature or integration" → Add a concise entry to MEMORY.md (key facts, sync rules, gotchas only). If details exceed 10 lines, create/update a topic file instead.
- "Nothing notable" → Skip documentation, deploy is complete.

**Rules for MEMORY.md updates:**
- Only add sync rules, gotchas, key architectural decisions, and essential API facts
- Detailed implementation notes go in topic files (emb-builder-details.md, design-lookup-details.md, etc.)
- One-time script results, batch stats, historical counts → do NOT add anywhere
- After any update, re-check line count. If over 180, condense immediately.

## Error Handling

| Error | Action |
|-------|--------|
| Not on develop branch | Stop, inform user |
| Merge conflict | Abort merge, return to develop, show manual resolution steps |
| Push fails | Show error, suggest `git pull` first |
| Heroku push fails | Show error, suggest checking Heroku login status |
| Heroku released but live dyno serves stale slug | Step 10.5 auto-runs `heroku ps:restart`; if that fails too, auto-escalates to `ps:scale web=0` + `web=1` cycle |

## Example Output

```
Starting deployment...

[1/12] Checking branch... develop
[2/12] Committing changes... 3 files staged
       Commit: "Deploy: updated 3 files (calculator.js, styles.css, index.html)"
[3/12] Pushing develop to GitHub... done

[4/12] CONFIRMATION REQUIRED...

       READY TO DEPLOY TO PRODUCTION?

       Summary so far:
       - Branch: develop
       - Committed: 3 files
       - Pushed to: GitHub (develop branch)

       Next steps will:
       - Merge develop → main
       - Create version tag
       - Push to GitHub (main) and Heroku (PRODUCTION)

       [User confirms: Yes, proceed]

[5/13]  Switching to main... done
[6/13]  Pulling latest main... already up to date
[7/13]  Merging develop into main... done
[8/13]  Creating version tag... v2025.12.23.1
[9/13]  Pushing main to GitHub... done
[10/13] Pushing to Heroku... done
[10.5/13] Verifying live content freshness...
         Expected: art-request-detail.js?v=20260424c
         Live:     art-request-detail.js?v=20260424b (stale)
         ⚠ Stale slug detected — running heroku ps:restart...
         ✓ Dyno restarted; live site now serving 20260424c
[11/13] Returning to develop... done

DEPLOY SUCCESSFUL! Version v2025.12.23.1 is now live.
```

## Important Notes

- Always verify you're on develop branch before starting
- Never force push - if push fails, investigate why
- Version tags provide rollback points: `git checkout v2025.12.23.1`
- If Heroku fails but GitHub succeeds, you can manually run `git push heroku main`
