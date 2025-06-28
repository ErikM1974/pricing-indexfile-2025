# Git Workflow Documentation Index

Welcome to the comprehensive Git workflow documentation for the Northwest Custom Apparel Pricing Index project. This documentation set provides everything you need to efficiently manage feature development and deployment.

## 📚 Documentation Overview

### 1. [Complete Git Workflow Guide](./GIT_WORKFLOW_GUIDE.md)
The main comprehensive guide covering:
- Prerequisites and setup
- GitHub and Heroku authentication methods
- Step-by-step workflow from feature branch to production
- Troubleshooting common issues
- Best practices and emergency procedures

### 2. [Authentication Update](./GIT_AUTHENTICATION_UPDATE.md)
Detailed explanation of how authentication actually works:
- Git credentials via Windows Credential Manager
- Heroku CLI authentication
- No .env file needed for Git/Heroku credentials
- Security best practices
- Authentication verification scripts

### 3. [Quick Reference Card](./GIT_WORKFLOW_QUICK_REFERENCE.md)
A condensed, printable reference containing:
- Essential commands for the complete workflow
- One-line deployment scripts
- Branch naming conventions
- Quick status checks

### 4. [Visual Workflow Guide](./GIT_WORKFLOW_VISUAL_GUIDE.md)
Visual representations including:
- Mermaid workflow diagrams
- Branch timeline visualizations
- Decision trees for different scenarios
- Status indicators and emergency commands

### 5. [Automation Scripts](./GIT_WORKFLOW_AUTOMATION.md)
Ready-to-use automation scripts:
- PowerShell script for Windows
- Batch file for Command Prompt
- Bash script for Git Bash/WSL
- Customization options and enhancements

### 6. [Quick Summary](./GIT_WORKFLOW_SUMMARY.md)
Simple summary clarifying key points:
- Authentication facts
- 7-step workflow
- Pre-flight checklist
- Quick troubleshooting

## 🚀 Quick Start

### First Time Setup
1. Review authentication setup in the [main guide](./GIT_WORKFLOW_GUIDE.md#prerequisites--setup)
2. Choose and set up your preferred automation script from the [automation guide](./GIT_WORKFLOW_AUTOMATION.md)
3. Keep the [quick reference](./GIT_WORKFLOW_QUICK_REFERENCE.md) handy

### Daily Workflow
1. Start with a clean develop branch
2. Create your feature branch
3. Make changes and commit
4. Run the automation script or follow the manual steps
5. Start your next feature!

## 🔄 Standard Workflow Summary

```
Feature Branch → Develop → Main → GitHub & Heroku
```

1. **Create Feature**: `git checkout -b feature/name`
2. **Work & Commit**: Make changes, commit, push
3. **Merge to Develop**: Merge feature into develop
4. **Deploy**: Merge develop into main, push to GitHub and Heroku
5. **Cleanup**: Delete feature branch, create new one

## 🛠️ Common Tasks

### Deploy a Completed Feature
```bash
# Using automation (PowerShell)
.\deploy-feature.ps1 -FeatureBranch "feature/customer-calculator"

# Manual steps
git checkout develop
git merge feature/customer-calculator
git push origin develop
# ... continue with full workflow
```

### Check Current Status
```bash
git status          # Current changes
git branch          # Local branches
git log --oneline -5  # Recent commits
```

### Fix a Merge Conflict
1. See conflicted files: `git status`
2. Edit files to resolve conflicts
3. Add resolved files: `git add .`
4. Complete merge: `git commit`

## 📋 Checklist Before Deployment

- [ ] All changes committed
- [ ] Feature branch pushed to GitHub
- [ ] No merge conflicts with develop
- [ ] Tests passing (if applicable)
- [ ] Ready to delete feature branch

## 🔗 Quick Links

### Internal Documentation
- [Pricing Implementation Guide](../PRICING_IMPLEMENTATION_GUIDE.md)
- [Claude Development Log](../CLAUDE.md)
- [New Embellishment Guide](../docs/new-embellishment-guide.md)

### External Resources
- [GitHub Repository](https://github.com/ErikM1974/pricing-indexfile-2025.git)
- [Heroku Dashboard](https://dashboard.heroku.com)
- [Git Documentation](https://git-scm.com/doc)

## 💡 Tips for Success

1. **Always pull before merging** to avoid conflicts
2. **Use descriptive branch names** that clearly indicate the feature
3. **Commit frequently** with clear, descriptive messages
4. **Test locally** before pushing to develop
5. **Keep feature branches small** and focused on one task
6. **Document significant changes** in CLAUDE.md

## 🆘 Need Help?

### Quick Fixes
- **Swap file error**: `rm .git/.MERGE_MSG.swp`
- **Wrong branch**: `git checkout correct-branch`
- **Undo last commit**: `git reset --soft HEAD~1`

### Detailed Help
- See [Troubleshooting](./GIT_WORKFLOW_GUIDE.md#troubleshooting-common-issues) in the main guide
- Check [Visual Guide](./GIT_WORKFLOW_VISUAL_GUIDE.md) for workflow diagrams
- Review [Emergency Commands](./GIT_WORKFLOW_VISUAL_GUIDE.md#emergency-commands)

## 📝 Version History

- **v1.0** (June 2025): Initial documentation creation
  - Complete workflow guide
  - Quick reference card
  - Visual diagrams
  - Automation scripts

---

*Last updated: June 28, 2025*