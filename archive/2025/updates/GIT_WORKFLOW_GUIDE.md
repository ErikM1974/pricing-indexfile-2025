# Git Workflow Guide for Northwest Custom Apparel Pricing Index

## Table of Contents
1. [Prerequisites & Setup](#prerequisites--setup)
2. [GitHub Authentication](#github-authentication)
3. [Heroku Authentication](#heroku-authentication)
4. [Complete Feature Branch Workflow](#complete-feature-branch-workflow)
5. [Quick Reference Commands](#quick-reference-commands)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## Prerequisites & Setup

### Required Tools
- Git installed locally
- GitHub CLI (optional but recommended)
- Heroku CLI
- VS Code or preferred code editor

### Initial Setup Commands
```bash
# Verify Git installation
git --version

# Verify Heroku CLI installation
heroku --version

# Set Git user information (if not already set)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## GitHub Authentication

**Note**: Git credentials are managed by Windows Credential Manager, not stored in .env files.

### Current Setup
- **GitHub Remote**: `https://github.com/ErikM1974/pricing-indexfile-2025.git`
- **User**: Erik - Northwest Custom Apparel (erik@nwcustomapparel.com)

### Verify Authentication
```bash
# Check current user
git config user.name
git config user.email

# Test GitHub connection
git ls-remote origin HEAD

# If authentication fails, Git will prompt for credentials
# Username: your-github-username
# Password: your-personal-access-token (NOT GitHub password)
```

### Setting Up Personal Access Token
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Copy the token immediately
5. Use this token as your password when Git prompts

### Credential Storage
```bash
# Check credential helper (should show: manager or manager-core)
git config --global credential.helper

# Windows stores credentials in:
# Control Panel → User Accounts → Credential Manager → Windows Credentials
# Look for: git:https://github.com
```

---

## Heroku Authentication

**Note**: Heroku credentials are managed by Heroku CLI, not stored in .env files.

### Current Setup
- **Heroku Remote**: `https://git.heroku.com/sanmar-inventory-app.git`
- **App Name**: sanmar-inventory-app

### Verify Authentication
```bash
# Check who's logged in
heroku auth:whoami

# List your apps
heroku apps
```

### Login to Heroku
```bash
# Interactive login (opens browser)
heroku login

# After login, credentials are stored in:
# Windows: %LOCALAPPDATA%\heroku\config.json
```

### Authentication Check Script
See [git-workflow-authentication-update.md](./git-workflow-authentication-update.md) for a PowerShell script to verify all authentication is working.

---

## Complete Feature Branch Workflow

### Step 1: Start from Clean Develop Branch
```bash
# Ensure you're on develop branch
git checkout develop

# Pull latest changes
git pull origin develop

# Check status (should be clean)
git status
```

### Step 2: Create Feature Branch
```bash
# Create and switch to new feature branch
git checkout -b feature-branch-name

# Naming conventions:
# - feature/description (e.g., feature/customer-calculator)
# - fix/description (e.g., fix/pricing-bug)
# - update/description (e.g., update/dashboard-links)
```

### Step 3: Work on Feature
```bash
# Make your changes
# ... edit files ...

# Check what changed
git status

# Add changes
git add .
# Or add specific files
git add filename.html filename.js

# Commit with descriptive message
git commit -m "Add customer supplied calculator functionality"

# Push feature branch to GitHub
git push origin feature-branch-name
```

### Step 4: Merge Feature into Develop
```bash
# Switch to develop
git checkout develop

# Pull latest (in case of other changes)
git pull origin develop

# Merge feature branch
git merge feature-branch-name

# Push develop to GitHub
git push origin develop
```

### Step 5: Delete Feature Branch
```bash
# Delete local feature branch
git branch -d feature-branch-name

# Delete remote feature branch
git push origin --delete feature-branch-name
```

### Step 6: Merge Develop into Main
```bash
# Switch to main
git checkout main

# Pull latest main
git pull origin main

# Merge develop
git merge develop

# Push to GitHub
git push origin main
```

### Step 7: Deploy to Heroku
```bash
# Ensure you're on main branch
git checkout main

# Push to Heroku
git push heroku main

# If your Heroku remote is named differently:
# git remote -v  # to check remote names
# git push heroku-remote-name main
```

### Step 8: Return to Develop and Create New Branch
```bash
# Switch back to develop
git checkout develop

# Pull latest (to ensure you have the merged changes)
git pull origin develop

# Create new feature branch
echo "Enter name for new feature branch:"
read branch_name
git checkout -b $branch_name

# For Windows Command Prompt:
# set /p branch_name="Enter name for new feature branch: "
# git checkout -b %branch_name%

# For Windows PowerShell:
# $branch_name = Read-Host "Enter name for new feature branch"
# git checkout -b $branch_name
```

---

## Quick Reference Commands

### Complete Workflow Script (Windows PowerShell)
```powershell
# Save this as deploy-feature.ps1
param(
    [Parameter(Mandatory=$true)]
    [string]$FeatureBranch
)

Write-Host "Starting deployment of $FeatureBranch" -ForegroundColor Green

# Step 1: Merge feature into develop
git checkout develop
git pull origin develop
git merge $FeatureBranch
git push origin develop

# Step 2: Delete feature branch
git branch -d $FeatureBranch
git push origin --delete $FeatureBranch

# Step 3: Merge develop into main
git checkout main
git pull origin main
git merge develop
git push origin main

# Step 4: Deploy to Heroku
git push heroku main

# Step 5: Return to develop
git checkout develop

# Step 6: Create new branch
$newBranch = Read-Host "Enter name for new feature branch"
git checkout -b $newBranch

Write-Host "Deployment complete! Now on branch: $newBranch" -ForegroundColor Green
```

### Usage:
```powershell
.\deploy-feature.ps1 -FeatureBranch "feature/customer-calculator"
```

---

## Troubleshooting Common Issues

### Issue: Merge Conflicts
```bash
# If you encounter merge conflicts
git status  # See conflicted files
# Edit conflicted files manually
git add .
git commit -m "Resolve merge conflicts"
```

### Issue: .MERGE_MSG.swp File
```bash
# Remove swap file
rm .git/.MERGE_MSG.swp
# Then retry merge
```

### Issue: Heroku Push Rejected
```bash
# Ensure you're pushing the right branch
git push heroku main:main

# If using different branch names
git push heroku local-branch-name:main

# Force push (use with caution)
git push heroku main --force
```

### Issue: Authentication Failed
```bash
# For GitHub - refresh token
gh auth refresh

# For Heroku - re-login
heroku login

# Clear Git credentials (Windows)
git config --global --unset credential.helper
```

---

## Best Practices

1. **Always pull before merging** to avoid conflicts
2. **Use descriptive branch names** that indicate the feature/fix
3. **Commit frequently** with clear messages
4. **Test locally** before pushing to develop
5. **Never force push** to shared branches (develop/main)
6. **Keep feature branches small** and focused
7. **Delete branches** after merging to keep repository clean

---

## Version Tracking

When deploying to Heroku, track versions in your commit messages:
```bash
git commit -m "Deploy v104: Add customer supplied calculator"
```

This helps track what version is currently deployed.

---

## Emergency Rollback

If something goes wrong after deployment:
```bash
# View recent commits
git log --oneline -10

# Rollback to previous commit
git checkout main
git reset --hard <previous-commit-hash>
git push origin main --force
git push heroku main --force
```

**Warning**: Force pushing should only be done in emergencies and with team coordination.