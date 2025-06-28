# Git Workflow Automation Scripts

## PowerShell Automation Script

Save this as `deploy-feature.ps1` in your project root:

```powershell
# PowerShell script for automated feature deployment
# Usage: .\deploy-feature.ps1

param(
    [string]$FeatureBranch
)

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Function to check if command succeeded
function Test-LastCommand {
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput Red "Error: Last command failed with exit code $LASTEXITCODE"
        exit 1
    }
}

# Get feature branch name if not provided
if (-not $FeatureBranch) {
    $currentBranch = git rev-parse --abbrev-ref HEAD
    if ($currentBranch -eq "develop" -or $currentBranch -eq "main") {
        $FeatureBranch = Read-Host "Enter the feature branch name to deploy"
    } else {
        $FeatureBranch = $currentBranch
        Write-ColorOutput Yellow "Using current branch: $FeatureBranch"
    }
}

Write-ColorOutput Green "`n=== Starting deployment of $FeatureBranch ==="

# Step 1: Ensure we're on develop and it's up to date
Write-ColorOutput Cyan "`nStep 1: Updating develop branch..."
git checkout develop
Test-LastCommand
git pull origin develop
Test-LastCommand

# Step 2: Merge feature branch
Write-ColorOutput Cyan "`nStep 2: Merging $FeatureBranch into develop..."
git merge $FeatureBranch
Test-LastCommand

# Step 3: Push develop to GitHub
Write-ColorOutput Cyan "`nStep 3: Pushing develop to GitHub..."
git push origin develop
Test-LastCommand

# Step 4: Delete feature branch
Write-ColorOutput Cyan "`nStep 4: Cleaning up feature branch..."
git branch -d $FeatureBranch
git push origin --delete $FeatureBranch

# Step 5: Merge develop into main
Write-ColorOutput Cyan "`nStep 5: Merging develop into main..."
git checkout main
Test-LastCommand
git pull origin main
Test-LastCommand
git merge develop
Test-LastCommand

# Step 6: Push main to GitHub
Write-ColorOutput Cyan "`nStep 6: Pushing main to GitHub..."
git push origin main
Test-LastCommand

# Step 7: Deploy to Heroku
Write-ColorOutput Cyan "`nStep 7: Deploying to Heroku..."
git push heroku main
Test-LastCommand

# Step 8: Return to develop
Write-ColorOutput Cyan "`nStep 8: Returning to develop branch..."
git checkout develop
Test-LastCommand

# Step 9: Create new feature branch
Write-ColorOutput Green "`n=== Deployment Complete! ==="
$newBranch = Read-Host "`nEnter name for new feature branch (or press Enter to stay on develop)"
if ($newBranch) {
    git checkout -b $newBranch
    Write-ColorOutput Green "`nCreated and switched to new branch: $newBranch"
} else {
    Write-ColorOutput Yellow "`nStaying on develop branch"
}

Write-ColorOutput Green "`nAll done! 🚀"
```

## Batch Script for Windows Command Prompt

Save this as `deploy-feature.bat` in your project root:

```batch
@echo off
setlocal enabledelayedexpansion

:: Colors
set RED=[91m
set GREEN=[92m
set YELLOW=[93m
set CYAN=[96m
set RESET=[0m

:: Get feature branch name
set feature=%1
if "%feature%"=="" (
    set /p feature="Enter feature branch name to deploy: "
)

echo.
echo %GREEN%=== Starting deployment of %feature% ===%RESET%
echo.

:: Step 1: Update develop
echo %CYAN%Step 1: Updating develop branch...%RESET%
git checkout develop
if errorlevel 1 goto :error
git pull origin develop
if errorlevel 1 goto :error

:: Step 2: Merge feature
echo.
echo %CYAN%Step 2: Merging %feature% into develop...%RESET%
git merge %feature%
if errorlevel 1 goto :error

:: Step 3: Push develop
echo.
echo %CYAN%Step 3: Pushing develop to GitHub...%RESET%
git push origin develop
if errorlevel 1 goto :error

:: Step 4: Delete feature branch
echo.
echo %CYAN%Step 4: Cleaning up feature branch...%RESET%
git branch -d %feature%
git push origin --delete %feature%

:: Step 5: Merge to main
echo.
echo %CYAN%Step 5: Merging develop into main...%RESET%
git checkout main
if errorlevel 1 goto :error
git pull origin main
if errorlevel 1 goto :error
git merge develop
if errorlevel 1 goto :error

:: Step 6: Push main
echo.
echo %CYAN%Step 6: Pushing main to GitHub...%RESET%
git push origin main
if errorlevel 1 goto :error

:: Step 7: Deploy to Heroku
echo.
echo %CYAN%Step 7: Deploying to Heroku...%RESET%
git push heroku main
if errorlevel 1 goto :error

:: Step 8: Return to develop
echo.
echo %CYAN%Step 8: Returning to develop branch...%RESET%
git checkout develop
if errorlevel 1 goto :error

:: Step 9: Create new branch
echo.
echo %GREEN%=== Deployment Complete! ===%RESET%
set /p newbranch="Enter name for new feature branch (or press Enter to stay on develop): "
if not "%newbranch%"=="" (
    git checkout -b %newbranch%
    echo %GREEN%Created and switched to new branch: %newbranch%%RESET%
) else (
    echo %YELLOW%Staying on develop branch%RESET%
)

echo.
echo %GREEN%All done! 🚀%RESET%
goto :end

:error
echo.
echo %RED%Error: Command failed!%RESET%
exit /b 1

:end
endlocal
```

## Bash Script (Git Bash/WSL)

Save this as `deploy-feature.sh` in your project root:

```bash
#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check command success
check_command() {
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Command failed!${NC}"
        exit 1
    fi
}

# Get feature branch name
FEATURE_BRANCH=$1
if [ -z "$FEATURE_BRANCH" ]; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" == "develop" ] || [ "$CURRENT_BRANCH" == "main" ]; then
        read -p "Enter feature branch name to deploy: " FEATURE_BRANCH
    else
        FEATURE_BRANCH=$CURRENT_BRANCH
        echo -e "${YELLOW}Using current branch: $FEATURE_BRANCH${NC}"
    fi
fi

echo -e "\n${GREEN}=== Starting deployment of $FEATURE_BRANCH ===${NC}\n"

# Step 1: Update develop
echo -e "${CYAN}Step 1: Updating develop branch...${NC}"
git checkout develop
check_command
git pull origin develop
check_command

# Step 2: Merge feature
echo -e "\n${CYAN}Step 2: Merging $FEATURE_BRANCH into develop...${NC}"
git merge $FEATURE_BRANCH
check_command

# Step 3: Push develop
echo -e "\n${CYAN}Step 3: Pushing develop to GitHub...${NC}"
git push origin develop
check_command

# Step 4: Delete feature branch
echo -e "\n${CYAN}Step 4: Cleaning up feature branch...${NC}"
git branch -d $FEATURE_BRANCH
git push origin --delete $FEATURE_BRANCH

# Step 5: Merge to main
echo -e "\n${CYAN}Step 5: Merging develop into main...${NC}"
git checkout main
check_command
git pull origin main
check_command
git merge develop
check_command

# Step 6: Push main
echo -e "\n${CYAN}Step 6: Pushing main to GitHub...${NC}"
git push origin main
check_command

# Step 7: Deploy to Heroku
echo -e "\n${CYAN}Step 7: Deploying to Heroku...${NC}"
git push heroku main
check_command

# Step 8: Return to develop
echo -e "\n${CYAN}Step 8: Returning to develop branch...${NC}"
git checkout develop
check_command

# Step 9: Create new branch
echo -e "\n${GREEN}=== Deployment Complete! ===${NC}"
read -p "Enter name for new feature branch (or press Enter to stay on develop): " NEW_BRANCH
if [ ! -z "$NEW_BRANCH" ]; then
    git checkout -b $NEW_BRANCH
    echo -e "${GREEN}Created and switched to new branch: $NEW_BRANCH${NC}"
else
    echo -e "${YELLOW}Staying on develop branch${NC}"
fi

echo -e "\n${GREEN}All done! 🚀${NC}"
```

## Usage Instructions

### PowerShell
```powershell
# Make script executable (one time)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run with branch name
.\deploy-feature.ps1 -FeatureBranch "feature/customer-calculator"

# Run without parameters (will prompt)
.\deploy-feature.ps1
```

### Command Prompt
```batch
# Run with branch name
deploy-feature.bat feature/customer-calculator

# Run without parameters (will prompt)
deploy-feature.bat
```

### Bash/Git Bash
```bash
# Make executable (one time)
chmod +x deploy-feature.sh

# Run with branch name
./deploy-feature.sh feature/customer-calculator

# Run without parameters (will prompt)
./deploy-feature.sh
```

## Features of These Scripts

1. **Error Handling**: Scripts check for errors after each Git command and stop if something fails
2. **Color Output**: Important messages are color-coded for easy reading
3. **Flexible Input**: Can run with or without specifying the branch name
4. **Current Branch Detection**: If on a feature branch, it will use that by default
5. **Optional New Branch**: After deployment, you can create a new branch or stay on develop
6. **Clean Output**: Clear step-by-step progress indicators

## Customization Options

### Add Version Tagging
Add this before pushing to Heroku:
```bash
# Get current version
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0")
VERSION_NUMBER=${CURRENT_VERSION#v}
NEW_VERSION="v$((VERSION_NUMBER + 1))"

# Create and push tag
git tag -a $NEW_VERSION -m "Deploy version $NEW_VERSION"
git push origin $NEW_VERSION
```

### Add Slack/Discord Notifications
```powershell
# Add after successful deployment
$webhook = "YOUR_WEBHOOK_URL"
$message = @{
    text = "🚀 Deployed $FeatureBranch to production!"
} | ConvertTo-Json
Invoke-RestMethod -Uri $webhook -Method Post -Body $message -ContentType 'application/json'
```

### Add Pre-deployment Tests
```bash
# Add before merging to main
echo "Running tests..."
npm test
if [ $? -ne 0 ]; then
    echo "Tests failed! Aborting deployment."
    exit 1
fi