#!/usr/bin/env bash
# PostToolUse hook for the Write tool — fires after Claude creates a file.
# If the file is .html / .js / .css and its basename is not mentioned in
# ACTIVE_FILES.md, emits a systemMessage + additionalContext reminder.
#
# Per CLAUDE.md Top 8 Rule #5: "ALWAYS Update ACTIVE_FILES.md — Every file
# create/delete/move must update documentation immediately."
#
# Reads PostToolUse JSON on stdin. Outputs hook JSON on stdout if the file
# is missing from the registry; silent otherwise.

set -u

# Read tool_input.file_path from stdin
file=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$file" ] && exit 0

# Normalize Windows backslashes to forward slashes for matching
fnorm="${file//\\//}"

# Skip non-code files
case "$fnorm" in
  *.html|*.js|*.css) ;;
  *) exit 0 ;;
esac

# Skip excluded directories
case "$fnorm" in
  */node_modules/*|*/.git/*|*/tests/*|*/.claude/*|*/archive-working-files/*|*/dist/*|*/build/*|*/tmp_audit/*|*/temp/*)
    exit 0 ;;
esac

base=$(basename "$fnorm")

# Find ACTIVE_FILES.md via git toplevel (works in worktrees too)
dir=$(dirname "$fnorm")
toplevel=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)
[ -z "$toplevel" ] && exit 0

# In a worktree, look in the worktree's checkout. In the main repo, same path.
registry="$toplevel/ACTIVE_FILES.md"
[ ! -f "$registry" ] && exit 0

# Don't fire on edits to ACTIVE_FILES.md itself
case "$fnorm" in
  */ACTIVE_FILES.md|ACTIVE_FILES.md) exit 0 ;;
esac

# Check: does the basename appear anywhere in ACTIVE_FILES.md?
if ! grep -qF "$base" "$registry"; then
  jq -nc \
    --arg base "$base" \
    --arg file "$fnorm" \
    '{
      systemMessage: ("[ACTIVE_FILES.md hook] " + $base + " is not in ACTIVE_FILES.md. Add it per CLAUDE.md Top 8 Rule #5."),
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: ("[ACTIVE_FILES.md hook] You just created " + $file + " but it is not in ACTIVE_FILES.md. Per CLAUDE.md Top 8 Rule #5, add an entry to ACTIVE_FILES.md before finishing this task. Find the appropriate section (Pages, Calculators, Services & Components, Stylesheets, Dashboard, etc.) and add a row with: file path, purpose, dependencies, status.")
      }
    }'
fi

exit 0
