# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 TOP 5 NEVER-BREAK RULES (Read First!)

These rules prevent disasters. **Violating any of these caused 71+ orphaned files requiring massive cleanup.**

1. **🚫 NO Version Suffix Files** - Never create `-backup`, `-FINAL`, `-FIXED`, `-old` files. Use Git branches.
2. **📁 NO Test Files in Root** - ALL test files go in `/tests/` folder. No exceptions.
3. **💾 NO Inline Code** - Zero `<style>` or `<script>` tags with content in HTML files.
4. **⚠️ NO Silent API Failures** - ALWAYS show errors when API fails. Never use fallback data silently.
5. **📝 ALWAYS Update ACTIVE_FILES.md** - Every file create/delete/move must update documentation immediately.

```bash
# Quick violation check (run this NOW and fix any issues):
find . -name "*-backup*" -o -name "*-FINAL*" | head -5  # Must return nothing
find . -maxdepth 1 -name "*test*" | head -5              # Must return nothing
grep -l "style=" --include="*.html" -r . | head -5       # Should return nothing
```

## 📋 Table of Contents

- [Pre-Flight Checklist](#pre-flight-checklist) - Before ANY code changes
- [Critical Rules (Tier 1)](#tier-1-critical-rules) - Prevent disasters
- [Important Standards (Tier 2)](#tier-2-important-standards) - Maintain quality
- [Project Overview](#project-overview) - System architecture
- [Development Commands](#development-commands) - How to run the app
- [Common Issues & Fixes](#common-issues--fixes) - Quick solutions
- [Additional Resources](#additional-resources) - Helpful references

## Pre-Flight Checklist

### 🚀 Quick Check Before ANY Work:
```bash
# Run this 3-line check before starting:
find . -name "*-backup*" -o -name "*-FINAL*" | head -3  # Must be empty
find . -name "*test*" -not -path "./tests/*" -not -path "./node_modules/*" | head -3  # Must be empty
grep -r "console.log" --include="*.js" --exclude-dir="tests" --exclude-dir="node_modules" | head -3  # Should be empty
```

### 📁 Creating New Files:
1. **Default to subdirectory** (never root unless whitelisted)
2. **Check ACTIVE_FILES.md** for existing functionality
3. **Use kebab-case** naming (no spaces, no CAPS)
4. **No inline code** - always external JS/CSS files

### ✏️ Before Committing:
1. **Remove all console.logs**
2. **Update ACTIVE_FILES.md**
3. **No hardcoded URLs** (use config)
4. **Descriptive commit message**

## Tier 1: CRITICAL Rules (Prevent Disasters)

### 🗂️ File Organization
| Rule | ❌ NEVER | ✅ ALWAYS |
|------|----------|-----------|
| Test Files | In root directory | In `/tests/` folder |
| Versions | file-backup.js, file-FINAL.js | Use Git branches |
| Styles/Scripts | Inline in HTML | External files only |
| Documentation | Create orphaned files | Update ACTIVE_FILES.md |

### 📂 Root Directory Whitelist (ONLY these allowed):
- **Main HTML pages**: index.html, cart.html, product.html
- **Essential configs**: package.json, server.js, .env.example
- **Critical docs**: README.md, CLAUDE.md, ACTIVE_FILES.md
- **Everything else**: MUST go in subdirectories

### 🚫 API Error Handling (Erik's #1 Rule)
```javascript
// ❌ NEVER - Silent fallback
try {
  const data = await fetchAPI();
} catch (error) {
  const data = getCachedData(); // NO! Will cause wrong pricing
}

// ✅ ALWAYS - Visible failure
try {
  const data = await fetchAPI();
} catch (error) {
  showErrorBanner('Unable to load pricing. Please refresh.');
  console.error('API failed:', error);
  throw error; // Stop execution
}
```
**Remember:** Wrong pricing data is WORSE than showing an error!

## Tier 2: IMPORTANT Standards (Maintain Quality)

### 🧹 Code Cleanliness
- **No console.logs** in production code
- **No commented-out code** (use Git history)
- **No hardcoded URLs** (use config files)
- **Clear variable names** (no single letters except loops)
- **Descriptive commit messages** (not "fixes" or "WIP")

### 🔄 Git Best Practices
```bash
# Use branches for features
git checkout -b feature/new-calculator

# Clear commit messages
git commit -m "Add DTG pricing calculator with quote generation"  # Good
git commit -m "fixes"  # Bad

# Delete merged branches
git branch -d feature/new-calculator
```


## Project Overview

The NWCA Pricing System provides dynamic pricing calculators for apparel decoration (DTG, embroidery, screen printing, etc.) with quote generation and database persistence.

## Development Commands

```bash
npm start          # Start Express server (port 3000) - That's it!

# Optional: For safety tools testing (local only)
npm install puppeteer  # NOT needed for production/Heroku
```

### ⚠️ No Webpack/Build System
This app uses **simple static file serving** - no build step, no bundling, no webpack. We removed 18 webpack dependencies on 2025-01-27 because they added zero value. Keep it simple!

## 📁 WHERE DOES MY FILE GO? Complete Directory Guide

### Decision Tree for File Placement:
```
Creating a new file? Start here:
├─ Test file? → `/tests/`
│  ├─ UI test? → `/tests/ui/`
│  ├─ API test? → `/tests/api/`
│  └─ Unit test? → `/tests/unit/`
├─ Calculator? → `/calculators/`
├─ Quote builder? → `/quote-builders/`
├─ Dashboard? → `/dashboards/`
├─ Art/design tool? → `/art-tools/`
├─ Admin interface? → `/admin/`
├─ Vendor portal? → `/vendor-portals/`
├─ General page? → `/pages/`
├─ Policy document? → `/policies/`
├─ JavaScript file?
│  ├─ Shared/reusable? → `/shared_components/js/`
│  ├─ Calculator-specific? → `/calculators/`
│  └─ Page-specific? → Same folder as HTML
├─ CSS file?
│  ├─ Shared styles? → `/shared_components/css/`
│  └─ Page-specific? → Same folder as HTML
├─ Documentation? → `/docs/`
├─ Script/utility? → `/scripts/`
├─ Email template? → `/email-templates/`
└─ Is it index.html, cart.html, or product.html? → Root (ONLY THESE!)
   └─ Everything else → MUST go in a subdirectory!
```

### Directory Purpose Reference:
| Directory | Purpose | Example Files |
|-----------|---------|---------------|
| `/admin/` | Administrative tools | user-management.html, reports.html |
| `/art-tools/` | Art department tools | art-request-form.html, design-tracker.html |
| `/calculators/` | Pricing calculators | dtg-calculator.html, embroidery-pricing.html |
| `/dashboards/` | Staff dashboards | sales-dashboard.html, art-hub.html |
| `/pages/` | Secondary pages | about.html, policies-hub.html, resources.html |
| `/quote-builders/` | Quote generation | screen-print-quote.html, bundle-builder.html |
| `/tests/` | ALL test files | test-pricing.html, test-api.js |
| `/tools/` | Utility tools | inventory-checker.html, file-monitor.js |
| `/vendor-portals/` | Vendor pages | sanmar-portal.html, alphabroder.html |
| `/shared_components/` | Reusable code | adapters, common styles, utilities |

## ✅ File Creation Enforcement Checklist

**BEFORE creating ANY new file, complete this checklist:**

```markdown
□ 1. Is this a test file? → MUST go in /tests/ (no exceptions)
□ 2. Check the decision tree above → Follow the path to correct directory
□ 3. Does similar functionality exist? → Check ACTIVE_FILES.md first
□ 4. Is it going in root? → Only allowed if it's index.html, cart.html, or product.html
□ 5. Using proper naming? → kebab-case, no spaces, no CAPS, descriptive
□ 6. External JS/CSS? → No inline <script> or <style> tags with content
□ 7. Will you update ACTIVE_FILES.md? → Required immediately after creation
```

**Red flags that you're doing it wrong:**
- ❌ Creating `test-new-feature.html` in root → Should be `/tests/ui/test-new-feature.html`
- ❌ Creating `pricing-backup.js` → Use Git branches instead
- ❌ Creating `temp-fix.css` → Make proper fix or don't create file
- ❌ Adding inline styles → Create external CSS file
- ❌ Not updating ACTIVE_FILES.md → Creates orphaned files

## 🚨 Common Mistakes That Created 71+ Orphaned Files

### Mistake #1: Test Files in Root
**❌ WRONG:**
```bash
/test-dtg-pricing.html        # Test file in root
/test-api-integration.js      # Another test in root
/test-cap-summary.html        # Yet another in root
```
**✅ CORRECT:**
```bash
/tests/ui/test-dtg-pricing.html
/tests/api/test-api-integration.js
/tests/calculators/test-cap-summary.html
```

### Mistake #2: Version Suffixes Instead of Git
**❌ WRONG:**
```bash
cart-backup.js
cart-FINAL.js
cart-FIXED.js
cart-old.js
cart-temp.js
```
**✅ CORRECT:**
```bash
# Use Git branches for versions
git checkout -b fix/cart-calculation
# Make changes to cart.js
git commit -m "Fix cart calculation logic"
```

### Mistake #3: Scattered Secondary Pages
**❌ WRONG:**
```bash
/inventory-details.html    # Secondary page in root
/policies-hub.html         # Another secondary page in root
/resources.html            # More clutter in root
```
**✅ CORRECT:**
```bash
/pages/inventory-details.html
/pages/policies-hub.html
/pages/resources.html
```

### Mistake #4: Not Checking Before Creating
**❌ WRONG:**
```javascript
// Developer creates new pricing utility
// without checking existing code
function calculatePricing() { /* new code */ }
```
**✅ CORRECT:**
```javascript
// First check ACTIVE_FILES.md
// Found: /shared_components/js/pricing-utils.js already exists
// Use existing utility instead of creating duplicate
```

### Mistake #5: Forgetting to Update Documentation
**❌ WRONG:**
```bash
# Create new file
touch /calculators/new-calculator.html
# Start working immediately without documentation
```
**✅ CORRECT:**
```bash
# Create new file
touch /calculators/new-calculator.html
# IMMEDIATELY update ACTIVE_FILES.md
echo "- /calculators/new-calculator.html - New calculator for X" >> ACTIVE_FILES.md
```

## System Architecture

### Key Components:
1. **Adapters** (`/shared_components/js/*-adapter.js`) - Handle pricing data from Caspio
2. **Quote System** - Two tables: `quote_sessions` + `quote_items`, ID pattern: `[PREFIX][MMDD]-seq`
3. **API Proxy** - `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
4. **Cart Management** - Session-based, single embellishment type per cart

### 🌐 API Details
- **Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
- **Key Endpoints**: `/api/quote_sessions`, `/api/quote_items`
- **Quote Pattern**: `[PREFIX][MMDD]-seq` (e.g., DTG0130-1)
- **Full API Documentation**: @memory/CASPIO_API_TEMPLATE.md (55 endpoints, shared with API provider)

### 📍 Important Notes:
1. **New Pages**: Must add to route config and restart server with Erik
2. **API Failures**: Always visible - never silent (see API Error Handling above)


## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| EmailJS "Corrupted variables" | Add missing variables with defaults (`\|\| ''`) |
| Database not saving | Check endpoint `/api/quote_sessions` and field names |
| Quote ID not showing | Add display element in success message |
| Script parsing error | Escape closing tags: `<\/script>` |
| CSS not updating | Add cache-busting parameter to stylesheet |

### 🔑 Quick Reference
```
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
EmailJS Public Key: 4qSbDO-SQs19TbP80
EmailJS Service ID: service_1c4k67j
Company Phone: 253-922-5793

Quote Prefixes: DTG, RICH, EMB, EMBC, LT, PATCH, SPC, SSC, WEB
```

### 📚 Key Memory References
- **@memory/STAFF_DIRECTORY.md** - Current staff emails and contact info for dropdowns
- **@memory/DATABASE_PATTERNS.md** - Database schema for quote_sessions and quote_items
- **@memory/FILE_UPLOAD_API_REQUIREMENTS.md** - File upload API specifications

### 🧮 Active Calculators
- **DTG** - Direct-to-garment contract pricing
- **RICH** - Richardson caps
- **EMB** - Embroidery contract
- **EMBC** - Customer supplied embroidery
- **LT** - Laser tumblers
- **PATCH** - Embroidered emblems

### 🎨 Art Systems
- **Art Invoices** - `/art-invoices-dashboard.html`, service codes (GRT-25, GRT-50, etc.)
- **Art Hub** - Role-based dashboards for AEs and Artists

## Additional Resources

### 📚 Documentation
- **CLAUDE_CODING_STANDARDS.md** - Detailed coding standards
- **ACTIVE_FILES.md** - Registry of all active files
- **MONITORING_SETUP.md** - File monitoring system (optional dev tool)

### 🔧 Safety Tools (Optional)
```bash
# Enable monitoring (development only, disabled by default)
ENABLE_MONITORING=true npm start

# Quarantine files instead of deleting (90-day recovery)
node scripts/safety-tools/safe-delete.js quarantine [file] [reason]

# Dependency analysis
node scripts/safety-tools/dependency-mapper.js
```

### 📂 Documentation Locations
- **Root directory**: Active docs (CLAUDE.md, ACTIVE_FILES.md, README.md)
- **/docs/archive/**: Historical/completed documentation
- **/memory/**: API specifications only (not for general docs)

---

**Remember:** This document focuses on preventing the disasters that led to 71+ orphaned files. When in doubt, check the Top 5 Never-Break Rules at the beginning of this file.