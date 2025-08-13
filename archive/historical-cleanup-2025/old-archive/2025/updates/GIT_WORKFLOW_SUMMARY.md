# Git Workflow - Quick Summary

## 🔑 Key Points About Authentication

1. **Git/GitHub credentials are NOT in .env file**
   - Managed by Windows Credential Manager
   - Stored securely by the operating system
   - Automatically used when you push/pull

2. **Heroku credentials are NOT in .env file**
   - Managed by Heroku CLI
   - Stored in `%LOCALAPPDATA%\heroku\config.json`
   - Set up with `heroku login`

3. **The .env file is for application settings only**
   - API keys for your app (like Claude/Anthropic)
   - Configuration values
   - NOT for Git/Heroku authentication

## 📋 Your Current Setup

```
GitHub Repository: https://github.com/ErikM1974/pricing-indexfile-2025.git
Heroku App: sanmar-inventory-app
Git User: Erik - Northwest Custom Apparel
```

## 🚀 Complete Workflow (7 Steps)

```bash
# 1. Merge feature into develop
git checkout develop
git merge feature-branch
git push origin develop

# 2. Delete feature branch
git branch -d feature-branch
git push origin --delete feature-branch

# 3. Merge develop into main
git checkout main
git merge develop

# 4. Push to GitHub
git push origin main

# 5. Deploy to Heroku
git push heroku main

# 6. Return to develop
git checkout develop

# 7. Create new feature branch
git checkout -b new-feature-name
```

## ✅ Pre-Flight Checklist

Before starting deployment:
```bash
# Check Git authentication
git ls-remote origin HEAD

# Check Heroku authentication
heroku auth:whoami

# Check current branch
git branch --show-current

# Check for uncommitted changes
git status
```

## 🔧 If Authentication Fails

### GitHub
```bash
# You'll be prompted for:
# Username: your-github-username
# Password: your-personal-access-token (NOT password)

# Get a token from:
# GitHub.com → Settings → Developer settings → Personal access tokens
```

### Heroku
```bash
# Just run:
heroku login
# This opens a browser to log in
```

## 📁 Documentation Files

1. **[Full Guide](./git-workflow-guide.md)** - Complete detailed instructions
2. **[Authentication Details](./git-workflow-authentication-update.md)** - How auth really works
3. **[Quick Reference](./git-workflow-quick-reference.md)** - Commands at a glance
4. **[Visual Guide](./git-workflow-visual-guide.md)** - Workflow diagrams
5. **[Automation Scripts](./git-workflow-automation.md)** - One-click deployment

## 💡 Remember

- Your credentials are already set up and working
- Git and Heroku handle authentication automatically
- The .env file is only for your application's API keys
- Use the automation scripts to avoid manual errors
- Always start from a clean develop branch