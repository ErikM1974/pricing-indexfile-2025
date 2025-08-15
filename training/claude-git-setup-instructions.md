# Git Instructions for Claude Code CLI - Existing Project

## Project Context for Claude Code CLI

You are working with an existing Git repository that is already set up and configured. Here's what you need to know:

### Current Project Location
```
c:/Users/erik/OneDrive - Northwest Custom Apparel/2025/Pricing Index File 2025
```

### Repository Information
- **GitHub Repository**: https://github.com/ErikM1974/pricing-indexfile-2025.git
- **Heroku App**: sanmar-inventory-app
- **Heroku URL**: https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/

## Standard Git Workflow to Follow

This is the exact workflow pattern that has been successfully used:

### 1. Always Start by Checking Status
```bash
git status
```
This tells you:
- Which branch you're currently on
- If there are any uncommitted changes
- If your branch is up to date

### 2. The Standard Development Workflow

#### Step 1: Create a New Feature Branch
```bash
# Make sure you're on develop branch first
git checkout develop

# Create and switch to new feature branch
git checkout -b branch-name
```

Common branch naming patterns used:
- `update-dashboard`
- `polish-dashboard`
- `cleanup-dashboard`
- `fix-[issue-name]`
- `feature-[feature-name]`

#### Step 2: After Making Changes (if any)
```bash
# Check what files have changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Description of changes"
```

#### Step 3: Merge Feature Branch into Develop
```bash
# Switch to develop branch
git checkout develop

# Merge the feature branch
git merge branch-name

# Push develop to GitHub
git push origin develop
```

#### Step 4: Delete the Feature Branch
```bash
# Delete local branch
git branch -d branch-name
```

#### Step 5: Deploy to Production (Main Branch)
```bash
# Switch to main branch
git checkout main

# Merge develop into main with a commit message
git merge develop -m "Merge develop into main: Brief description of changes"

# Push main to GitHub
git push origin main

# Deploy to Heroku
git push heroku main
```

#### Step 6: Return to Develop and Create Next Branch
```bash
# Switch back to develop
git checkout develop

# Create new feature branch
git checkout -b new-branch-name
```

## Quick Command Reference

### Most Common Commands You'll Use

Check current branch:
```bash
git status
```

Switch to develop:
```bash
git checkout develop
```

Create new branch:
```bash
git checkout -b branch-name
```

Merge branch into current branch:
```bash
git merge branch-name
```

Push to GitHub:
```bash
git push origin branch-name
```

Delete local branch:
```bash
git branch -d branch-name
```

### The Complete Deployment Sequence

When ready to deploy changes to production:
```bash
# 1. Ensure feature branch is merged to develop
git checkout develop
git merge feature-branch
git push origin develop
git branch -d feature-branch

# 2. Deploy to production
git checkout main
git merge develop -m "Merge develop into main: [description]"
git push origin main
git push heroku main

# 3. Return to develop for next feature
git checkout develop
git checkout -b next-feature-branch
```

## Important Notes

1. **Never commit directly to main** - Always work through feature branches and develop
2. **Always check status first** - Use `git status` before any major operation
3. **Keep commit messages descriptive** - They help track what changed
4. **Wait for Heroku deployment** - The `git push heroku main` command takes a few minutes
5. **Working directory should be clean** - Commit or stash changes before switching branches

## Current State Information

As of the last update:
- You should be on the `cleanup-dashboard` branch
- The main branch is deployed to Heroku
- The develop branch is up to date with all recent changes

## If You Need to Check Remote Status

Verify remotes are configured:
```bash
git remote -v
```

Should show:
- origin pointing to GitHub
- heroku pointing to Heroku

## Typical Task Instructions

When given a task like "merge this branch into develop, push to GitHub, delete the branch, then deploy to production":

1. `git checkout develop`
2. `git merge current-branch-name`
3. `git push origin develop`
4. `git branch -d current-branch-name`
5. `git checkout main`
6. `git merge develop -m "Merge develop into main: Description"`
7. `git push origin main`
8. `git push heroku main`
9. `git checkout develop`
10. `git checkout -b new-branch-name`

This is the exact pattern that has been working successfully.