#!/bin/bash

# Cap Embroidery Beta Migration Script
# This script helps migrate the beta button to production

echo "========================================="
echo "Cap Embroidery Beta Migration Script"
echo "========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1 failed!${NC}"
        exit 1
    fi
}

# Confirmation
echo -e "${YELLOW}This script will:${NC}"
echo "1. Switch to main branch"
echo "2. Pull latest changes"
echo "3. Merge beta button branches"
echo "4. Push to origin"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 1
fi

echo ""
echo "Starting migration..."
echo ""

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"
echo ""

# Step 1: Switch to main
echo "Step 1: Switching to main branch..."
git checkout main
check_status "Switched to main"
echo ""

# Step 2: Pull latest
echo "Step 2: Pulling latest changes..."
git pull origin main
check_status "Pulled latest changes"
echo ""

# Step 3: Merge beta button branch
echo "Step 3: Merging beta button branch..."
git merge feature/cap-embroidery-beta-button -m "Merge beta button implementation for cap embroidery"
check_status "Merged beta button branch"
echo ""

# Step 4: Merge enhancements branch
echo "Step 4: Merging enhancements branch..."
git merge feature/cap-embroidery-enhancements -m "Merge UI enhancements for cap embroidery beta"
check_status "Merged enhancements branch"
echo ""

# Step 5: Show what changed
echo "Step 5: Files changed:"
git diff --name-only HEAD~2..HEAD
echo ""

# Step 6: Push to origin
echo -e "${YELLOW}Ready to push to origin.${NC}"
read -p "Push changes to origin/main? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pushing to origin..."
    git push origin main
    check_status "Pushed to origin"
else
    echo -e "${YELLOW}Changes merged locally but NOT pushed.${NC}"
    echo "To push later, run: git push origin main"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Migration Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Deploy to your production environment"
echo "2. Test the beta button on live site"
echo "3. Monitor for any issues"
echo ""
echo "To rollback if needed:"
echo "  git revert HEAD"
echo "  git push origin main"
echo ""