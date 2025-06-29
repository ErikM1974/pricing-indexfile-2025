# Git Workflow Quick Reference Card

## 🚀 Complete Feature Deployment Workflow

### 1️⃣ Start Clean
```bash
git checkout develop
git pull origin develop
git status  # Should be clean
```

### 2️⃣ Create Feature Branch
```bash
git checkout -b feature-name
```

### 3️⃣ Work & Commit
```bash
git add .
git commit -m "Description of changes"
git push origin feature-name
```

### 4️⃣ Merge to Develop
```bash
git checkout develop
git pull origin develop
git merge feature-name
git push origin develop
```

### 5️⃣ Clean Up Feature Branch
```bash
git branch -d feature-name
git push origin --delete feature-name
```

### 6️⃣ Deploy to Production
```bash
git checkout main
git pull origin main
git merge develop
git push origin main
git push heroku main
```

### 7️⃣ Start New Feature
```bash
git checkout develop
git checkout -b new-feature-name
```

---

## 🔑 Authentication Commands

### GitHub
```bash
gh auth login  # Using GitHub CLI
```

### Heroku
```bash
heroku login
heroku auth:whoami  # Verify
```

---

## 🆘 Common Fixes

### Remove Merge Message Swap File
```bash
rm .git/.MERGE_MSG.swp
```

### Check Remote Names
```bash
git remote -v
```

### Force Push to Heroku (if needed)
```bash
git push heroku main --force
```

---

## 📝 One-Line Deploy Script

Save as `deploy.bat` (Windows):
```batch
@echo off
set /p feature="Enter feature branch name: "
git checkout develop && git pull origin develop && git merge %feature% && git push origin develop && git branch -d %feature% && git push origin --delete %feature% && git checkout main && git pull origin main && git merge develop && git push origin main && git push heroku main && git checkout develop
set /p newbranch="Enter new branch name: "
git checkout -b %newbranch%
echo Deployment complete! Now on branch: %newbranch%
```

Or PowerShell `deploy.ps1`:
```powershell
$feature = Read-Host "Enter feature branch name"
git checkout develop; git pull origin develop; git merge $feature; git push origin develop
git branch -d $feature; git push origin --delete $feature
git checkout main; git pull origin main; git merge develop; git push origin main; git push heroku main
git checkout develop
$newbranch = Read-Host "Enter new branch name"
git checkout -b $newbranch
Write-Host "Deployment complete! Now on branch: $newbranch" -ForegroundColor Green
```

---

## 🎯 Branch Naming Conventions
- `feature/description` - New features
- `fix/description` - Bug fixes  
- `update/description` - Updates to existing features
- `hotfix/description` - Urgent production fixes

---

## ⚡ Quick Status Checks
```bash
git status          # Current branch status
git branch          # List local branches
git branch -r       # List remote branches
git log --oneline -5  # Recent commits