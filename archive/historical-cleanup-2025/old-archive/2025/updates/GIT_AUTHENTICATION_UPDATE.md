# Git Workflow Authentication - Updated Guide

## Current Setup

Your project is already configured with:
- **GitHub Remote**: `https://github.com/ErikM1974/pricing-indexfile-2025.git`
- **Heroku Remote**: `https://git.heroku.com/sanmar-inventory-app.git`
- **Git User**: Erik - Northwest Custom Apparel (erik@nwcustomapparel.com)

## How Authentication Actually Works

### Git/GitHub Authentication

Git credentials are **NOT** stored in the .env file. Instead, they use one of these methods:

1. **Windows Credential Manager** (Most Common)
   - Git stores credentials in Windows Credential Manager
   - Check stored credentials:
     ```powershell
     # View stored Git credentials
     git config --global credential.helper
     # Should show: manager or manager-core
     
     # To view in Windows:
     # Control Panel → User Accounts → Credential Manager → Windows Credentials
     # Look for: git:https://github.com
     ```

2. **Git Credential Helper**
   - Automatically manages credentials
   - Already configured if you can push/pull without entering password

3. **Personal Access Token (PAT)**
   - If using HTTPS (which you are), GitHub requires PAT instead of password
   - Token is stored by credential manager after first use

### Heroku Authentication

Heroku also doesn't use .env for authentication. It uses:

1. **Heroku CLI Authentication**
   ```bash
   # Check current login
   heroku auth:whoami
   
   # Login status stored in:
   # Windows: %LOCALAPPDATA%\heroku\config.json
   ```

2. **Heroku API Token**
   - Stored by Heroku CLI after `heroku login`
   - Can be viewed: `heroku auth:token`

## Verifying Your Authentication

### Check Git/GitHub Access
```bash
# Test GitHub connection
git remote -v
git ls-remote origin

# If prompted for credentials, use:
# Username: your-github-username
# Password: your-personal-access-token (NOT your GitHub password)
```

### Check Heroku Access
```bash
# Test Heroku connection
heroku auth:whoami
heroku apps

# Should list your apps including: sanmar-inventory-app
```

## If Authentication Fails

### GitHub Issues
```bash
# Clear stored credentials
git config --global --unset credential.helper

# Re-configure credential manager
git config --global credential.helper manager-core

# Next push/pull will prompt for credentials
# Enter your PAT as the password
```

### Heroku Issues
```bash
# Re-authenticate
heroku login

# Or use API key directly
heroku auth:token  # Copy this token
set HEROKU_API_KEY=your-token-here  # Windows CMD
$env:HEROKU_API_KEY="your-token-here"  # PowerShell
```

## Updated Automation Scripts

Since credentials are managed by Git and Heroku CLI, the automation scripts don't need credential handling. They just need to ensure you're logged in:

### Pre-flight Check Script
```powershell
# Save as check-auth.ps1
Write-Host "Checking authentication status..." -ForegroundColor Cyan

# Check Git user
$gitUser = git config user.name
$gitEmail = git config user.email
Write-Host "Git User: $gitUser ($gitEmail)" -ForegroundColor Green

# Check GitHub connection
Write-Host "`nTesting GitHub connection..."
$githubTest = git ls-remote origin HEAD 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ GitHub authentication working" -ForegroundColor Green
} else {
    Write-Host "✗ GitHub authentication failed" -ForegroundColor Red
    Write-Host "Run: git push origin main (to trigger login)" -ForegroundColor Yellow
}

# Check Heroku
Write-Host "`nChecking Heroku authentication..."
$herokuUser = heroku auth:whoami 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Heroku authenticated as: $herokuUser" -ForegroundColor Green
} else {
    Write-Host "✗ Heroku not authenticated" -ForegroundColor Red
    Write-Host "Run: heroku login" -ForegroundColor Yellow
}

# Check remotes
Write-Host "`nConfigured remotes:"
git remote -v
```

## Key Points

1. **.env file** is for application configuration (API keys, app settings)
2. **Git credentials** are managed by Windows Credential Manager
3. **Heroku credentials** are managed by Heroku CLI
4. Both use secure, OS-level credential storage
5. No need to manually manage tokens in files

## Security Best Practices

1. **Never commit credentials** to Git
2. **Use Personal Access Tokens** for GitHub (not passwords)
3. **Rotate tokens regularly**
4. **Use different tokens** for different machines
5. **Enable 2FA** on both GitHub and Heroku

This approach is more secure than storing credentials in files and integrates better with the tools' native authentication systems.