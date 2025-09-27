# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 MANDATORY: Coding Standards Enforcement

**CRITICAL: Before writing ANY code, you MUST read and follow:**
- **[CLAUDE_CODING_STANDARDS.md](./CLAUDE_CODING_STANDARDS.md)** - MANDATORY rules to prevent code chaos
- **Failure to follow these standards previously resulted in 71+ orphaned files and massive cleanup efforts**

## ✅ Pre-Flight Checklist (MANDATORY Before ANY Code Changes)

### Before Creating ANY New File:
```bash
□ DEFAULT to subdirectory - NOT root! (/tests/, /calculators/, /shared_components/)
□ If considering root: Is it on the WHITELIST?
   - Main HTML entry point? (index, cart, product)
   - Essential config? (package.json, webpack, server.js)
   - Critical .md? (README, CLAUDE, ACTIVE_FILES)
□ If NOT whitelisted → MUST go in subdirectory
□ Search for similar files: find . -name "*similar-name*"
□ Check ACTIVE_FILES.md for existing functionality
□ Use kebab-case naming (no spaces, no CAPS except components)
□ Plan external JS/CSS files (NO inline code)
□ Prepare to update ACTIVE_FILES.md immediately after creation
```

### Before Modifying ANY File:
```bash
□ Check if file is listed in ACTIVE_FILES.md
□ Verify no duplicate versions exist (search for -backup, -FINAL)
□ Confirm you're editing the right file (not a copy)
□ Review existing code patterns in the file
□ Check for hardcoded values that should be in config
```

### Before EVERY Commit:
```bash
□ Run: find . -name "*backup*" -o -name "*FINAL*" -o -name "*FIXED*"
□ Run: find . -name "*test*" -not -path "./tests/*"
□ Run: grep -l "style=" --include="*.html" -r .
□ Verify ACTIVE_FILES.md is updated
□ Remove all console.log statements
□ Check no hardcoded URLs exist
```

## 🚫 File Organization Enforcement

### ABSOLUTE RULES - Zero Tolerance:
1. **NO test files in root** → ALL tests go in `/tests/` folder
2. **NO version suffixes** → Never create -backup, -FINAL, -FIXED, -old files
3. **NO inline code** → Zero `<style>` or `<script>` tags with content in HTML
4. **NO file duplication** → One file, one purpose (use Git for versions)
5. **NO orphaned files** → Every file must be referenced and documented

### Automatic Cleanup Triggers
When you see these patterns, IMMEDIATELY clean them up:
1. Files with `-backup`, `-FINAL`, `-FIXED`, `-old` suffixes → Delete
2. Test files outside `/tests/` folder → Move immediately
3. Inline styles or scripts in HTML → Extract to external files
4. Duplicate files with similar names → Merge and delete redundant
5. Hardcoded URLs in JavaScript → Move to config file

### Required Documentation:
- Every new file → Add to ACTIVE_FILES.md within 5 minutes
- Every deleted file → Remove from ACTIVE_FILES.md immediately
- Every moved file → Update path in ACTIVE_FILES.md

## 🔒 Root Directory Protection Rules

### Files ALLOWED in Root (Whitelist Only):
**ONLY these file types belong in root:**
1. **Main HTML entry points** (index.html, cart.html, product.html, marketing.html, etc.)
2. **Essential config files** (package.json, server.js, webpack.config.js, .env.example, .gitignore)
3. **Critical documentation** (README.md, CLAUDE.md, ACTIVE_FILES.md - max 5 essential .md files)
4. **Git/Build files** (.gitignore, Procfile, postcss.config.js, .babelrc)
5. **Legacy JS files** (ONLY those documented in ACTIVE_FILES.md as technical debt)

### Files FORBIDDEN in Root - MUST Use Subdirectories:
| File Type | ❌ NEVER in Root | ✅ CORRECT Location |
|-----------|------------------|---------------------|
| Test files | test-*.html, *-test.js | /tests/ |
| Data exports | *.csv, *.json, *.xml | /docs/data-exports/ |
| Templates | *-template.*, instructions | /docs/templates/ |
| Documentation | API specs, guides, plans | /docs/guides/ |
| Log files | *.log, debug output | /logs/ |
| Scripts | *.sh, migration scripts | /scripts/ |
| CSS files | All stylesheets | /shared_components/css/ |
| New JS files | New JavaScript code | /shared_components/js/ |
| Backup files | *-backup, *-FINAL, *-old | DELETE - use Git! |

### Automatic Root Directory Violation Check:
```bash
# Before creating ANY file in root, ask yourself:
1. Is this a main HTML entry point? → OK in root
2. Is this an essential config file? → OK in root
3. Is this critical documentation (README, CLAUDE, ACTIVE_FILES)? → OK in root
4. Is this anything else? → MUST go in subdirectory!

# Quick check command:
ls -la | grep -E "^-" | wc -l  # Should be < 50 files
```

### When Claude Creates a New File:
1. **DEFAULT BEHAVIOR:** Always create in appropriate subdirectory
2. **EXCEPTION ONLY:** Root placement requires matching whitelist above
3. **VERIFICATION:** Check against allowed list before placing in root
4. **JUSTIFICATION:** If root placement needed, explain in commit message

### Examples of Violations and Corrections:
```bash
# ❌ WRONG - Test file in root
/test-pricing.html → /tests/integration/test-pricing.html

# ❌ WRONG - Data export in root
/customer_data.csv → /docs/data-exports/customer_data.csv

# ❌ WRONG - Documentation in root
/API_GUIDE.md → /docs/guides/API_GUIDE.md

# ❌ WRONG - New CSS in root
/new-styles.css → /shared_components/css/new-styles.css

# ✅ CORRECT - Main entry point
/index.html → OK in root (main entry point)

# ✅ CORRECT - Essential config
/package.json → OK in root (essential config)
```

## ⚠️ Common Pitfalls & How to Avoid Them

**Based on the 71+ file cleanup disaster, NEVER do these:**

### DON'T Create Multiple Versions → USE Git Branches
```bash
# ❌ WRONG - Creates mess
calculator.js
calculator-backup.js
calculator-FINAL.js
calculator-FIXED.js

# ✅ RIGHT - Use Git
git checkout -b feature/calculator-fix
# Edit calculator.js
git commit -m "Fix calculator logic"
```

### DON'T Put Test Files Everywhere → USE /tests/ Folder
```bash
# ❌ WRONG - Tests scattered
/root/test-pricing.html
/calculators/debug-dtg.js
/shared_components/verify-adapter.js

# ✅ RIGHT - Organized tests
/tests/unit/pricing.test.js
/tests/integration/dtg.test.js
/tests/sandbox/adapter-experiment.js
```

### DON'T Use Inline Code → USE External Files
```html
<!-- ❌ WRONG -->
<div style="color: red; margin: 10px;">
  <script>
    function calculate() { /* inline JS */ }
  </script>
</div>

<!-- ✅ RIGHT -->
<link rel="stylesheet" href="/shared_components/css/calculator.css">
<script src="/shared_components/js/calculator.js"></script>
```

### DON'T Hardcode Values → USE Config Files
```javascript
// ❌ WRONG
const API_URL = 'https://caspio-pricing-proxy.herokuapp.com';
const TIMEOUT = 5000;

// ✅ RIGHT
import { API_CONFIG } from './config/api.config.js';
const url = API_CONFIG.BASE_URL;
```

### DON'T Create Orphaned Files → UPDATE Documentation
```bash
# After creating new file:
1. Add to ACTIVE_FILES.md immediately
2. Document dependencies
3. Add JSDoc comments
4. Update component diagram if needed
```

## 🔍 Dependency Management

### Preventing Orphaned Files:

#### Check Before Deleting
```bash
# Find all references to a file before removing
grep -r "filename.js" --include="*.html" --include="*.js"

# Use dependency mapper to see connections
node scripts/safety-tools/dependency-mapper.js
```

#### Safe Removal Process
```bash
# NEVER delete directly! Always quarantine first:
node scripts/safety-tools/safe-delete.js quarantine old-file.js "No longer needed"

# Monitor for 2 weeks
# If no issues, then permanently remove

# If something breaks, recover instantly:
node scripts/safety-tools/safe-delete.js recover old-file.js
```

#### Regular Maintenance
```bash
# Weekly: Find potentially orphaned files
node scripts/safety-tools/dependency-mapper.js

# Check for unused CSS classes
grep -oh "class=\"[^\"]*\"" *.html | sed 's/class="//g;s/"//g' | tr ' ' '\n' | sort -u > used-classes.txt

# Find files not in ACTIVE_FILES.md
find . -name "*.js" -o -name "*.html" | while read file; do
  grep -q "$file" ACTIVE_FILES.md || echo "Not documented: $file"
done
```

## 👋 New Developer Onboarding

### Day 1 - MANDATORY Reading:
1. **Read [CLAUDE_CODING_STANDARDS.md](./CLAUDE_CODING_STANDARDS.md)** - Non-negotiable rules
2. **Read [ACTIVE_FILES.md](./ACTIVE_FILES.md)** - Know what exists
3. **Read this file completely** - Understand the system
4. **Check [MONITORING_SETUP.md](./MONITORING_SETUP.md)** - Learn safety tools

### Quick-Start Rules:
```bash
# 1. ALWAYS check before creating
find . -name "*similar-functionality*"
grep -r "similar-feature" --include="*.js"

# 2. ALWAYS use correct folders
Tests → /tests/
Calculators → /calculators/
Shared code → /shared_components/
Docs → /docs/

# 3. NEVER create these
*-backup.js, *-FINAL.html, *-FIXED.css
test-*.js (outside /tests/)
inline <style> or <script> with content

# 4. ALWAYS update documentation
After creating → Update ACTIVE_FILES.md
After deleting → Update ACTIVE_FILES.md
After moving → Update ACTIVE_FILES.md
```

### Development Setup:
```bash
# Enable monitoring for safety
ENABLE_MONITORING=true npm start

# Run initial checks
find . -name "*backup*" -o -name "*FINAL*"
find . -name "*test*" -not -path "./tests/*"
grep -l "style=" --include="*.html" -r .

# If you find issues, fix them BEFORE starting work
```

## 🚨 Red Flags That Require IMMEDIATE Action

**When you see these, STOP and clean them up:**

### 1. Version Suffix Files
```bash
# If you see: calculator-backup.js, pricing-FINAL.html, cart-FIXED.js
# ACTION: Check if content differs from original, merge if needed, DELETE suffix version
find . -name "*-backup*" -o -name "*-FINAL*" -o -name "*-FIXED*" -o -name "*-old*"
```

### 2. Test Files Outside /tests/
```bash
# If you see: test files in root, calculators, or anywhere except /tests/
# ACTION: Move to /tests/ immediately
find . -name "*test*" -not -path "./tests/*" -not -path "./node_modules/*"
```

### 3. Inline Styles or Scripts
```bash
# If you see: <style> or <script> tags with content in HTML
# ACTION: Extract to external files immediately
grep -l "style=" --include="*.html" -r .
grep -l "<script>" --include="*.html" -r . | xargs grep -l "function"
```

### 4. Duplicate Functionality
```bash
# If you see: calculator.js AND pricing-calculator.js doing similar things
# ACTION: Merge functionality, delete duplicate
find . -type f -name "*.js" | sed 's/.*\///' | sed 's/\.js$//' | sort | uniq -d
```

### 5. Hardcoded Sensitive Data
```bash
# If you see: API keys, passwords, URLs in code
# ACTION: Move to environment variables or config immediately
grep -r "api_key\|password\|secret" --include="*.js"
grep -r "http:/\|https:/" --include="*.js" | grep -v "config"
```

### 6. Console Logs in Production Code
```bash
# If you see: console.log statements (except in /tests/)
# ACTION: Remove before committing
grep -r "console.log" --include="*.js" --exclude-dir="tests"
```

# Northwest Custom Apparel (NWCA) Pricing System

## Project Overview

The NWCA Pricing System is a comprehensive web application providing dynamic pricing calculators for various decoration methods on apparel and promotional products. It features product catalog browsing, real-time pricing calculations, quote generation with database persistence, and staff management tools.

## Development Commands

```bash
# Development & Production
npm start          # Start Node.js Express server (port 3000) - THIS IS ALL YOU NEED!
```

## 🚫 IMPORTANT: No Webpack/Build System

**This application uses SIMPLE STATIC FILE SERVING - AND THAT'S GOOD!**

We deliberately REMOVED webpack and all build tooling on 2025-01-27 because:
1. **The app works perfectly without it** - Simple Express static serving is sufficient
2. **Build complexity adds ZERO value** - No bundling needed for this architecture
3. **Webpack was a failed experiment** - Config existed but was never used
4. **Simple is better** - Easier to maintain, debug, and understand

**What was removed:**
- webpack.config.js → Archived as failed experiment
- postcss.config.js → Not needed
- .babelrc → Not needed
- src/ directory structure → Empty aspirational folders
- 18 webpack-related npm dependencies → Cleaned up

**Current Architecture (KEEP IT THIS WAY):**
- Static files organized by feature (calculators/, dashboards/, etc.)
- Express serves files directly - no build step
- CSS and JS files loaded individually - and that's FINE
- No bundling, no transpiling, no complexity

## 🔍 File Monitoring & Safety System (Optional Development Tool)

The monitoring system helps with safe file cleanup and dependency tracking. **It's disabled by default and has no production impact.**

### When to Use
- Before major file cleanup operations
- When tracking file usage patterns
- For dependency analysis
- To safely quarantine files instead of deleting

### How to Enable
```bash
# Enable monitoring for current session
ENABLE_MONITORING=true npm start

# You should see: "🔍 Monitoring system enabled"
```

### Available Tools
```bash
# Safe file quarantine (never deletes, 90-day recovery)
node scripts/safety-tools/safe-delete.js quarantine [file] [reason]
node scripts/safety-tools/safe-delete.js recover [file]

# Dependency analysis
node scripts/safety-tools/dependency-mapper.js

# Test all pages
node scripts/safety-tools/comprehensive-test-suite.js test

# Access monitoring dashboards
curl http://localhost:3000/api/monitor/stats
curl http://localhost:3000/api/monitor/report
```

### Important Notes
- **Disabled by default** - No impact unless explicitly enabled
- **Development only** - Never use in production
- **Requires devDependencies** - Run `npm install --save-dev` to get puppeteer/axios
- **Full documentation** - See `MONITORING_SETUP.md` for detailed guide

## Project Structure

The codebase has been organized into logical directories for better maintainability:

```
/
├── calculators/          # Pricing calculators and bundles
├── dashboards/           # Staff and management dashboards
├── quote-builders/       # Quote generation tools
├── art-tools/            # Art department tools
├── tools/                # Utility and helper tools
├── admin/                # Administrative interfaces
├── email-templates/      # Email template files
├── mockups/              # UI mockups and prototypes
├── tests/                # Test files and pages
├── training/             # User-specific dashboards (adriyella)
├── policies/             # SOP and policy documentation
├── caspio-tables/        # Caspio setup instructions
├── templates/            # Template documentation and configs
├── product/              # Product-specific code
├── src/                  # Source code modules
├── shared_components/    # Shared JS and CSS components
│   ├── js/              # JavaScript modules and adapters
│   └── css/             # Stylesheets
├── scripts/             # Standalone scripts
│   └── safety-tools/    # File monitoring and cleanup tools
├── memory/              # API specs (limited files)
└── docs/                # Documentation
    └── archive/         # Outdated/completed documentation
```

### Core Files (Root Directory)
The following files remain in the root directory as they are core to the application:

**HTML Pages:**
- `index.html` - Main landing page
- `product.html` - Product display page
- `cart.html` - Shopping cart

**JavaScript Files (legacy location - should eventually move to shared_components):**
- `app-modern.js`, `cart.js`, `cart-ui.js` - Core functionality
- `catalog-search.js`, `autocomplete-new.js` - Search features
- `product-search-service.js`, `utils.js` - Services
- Several other JS files that index.html and cart.html depend on

**System Files:**
- `server.js` - Node.js Express server
- `package.json` - Project dependencies
- Configuration files (.env, webpack.config.js, etc.)

## High-Level Architecture

### Master Bundle Pattern
The system uses a "Master Bundle" approach where Caspio sends comprehensive pricing data that's managed client-side:

1. **Caspio Backend** → Calculates ALL price permutations for a decoration type
2. **PostMessage Communication** → Sends master bundle to adapter via iframe
3. **Adapters** (e.g., `DTGAdapter.js`) → Store bundle and extract relevant pricing based on user selections
4. **Event System** → Adapters dispatch `pricingDataLoaded` events
5. **UI Components** → Listen for events and update pricing displays

### Key Architectural Components

1. **Adapters** (`/shared_components/js/*-adapter.js`)
   - Each decoration type has its own adapter
   - Handles master bundle storage and data extraction
   - Dispatches standardized events

2. **Quote System** 
   - Two-table database structure: `quote_sessions` + `quote_items`
   - Quote IDs follow pattern: `[PREFIX][MMDD]-[sequence]`
   - Database operations via Heroku proxy API

3. **Cart Management** (`shared_components/js/cart.js`)
   - Local and server-side session management
   - Enforces business rules (single embellishment type per cart)
   - Real-time price recalculation

4. **API Proxy** (`server.js` → Heroku)
   - Base URL: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
   - Handles all Caspio database operations
   - Modular route structure in `/src/routes/`

## API Documentation

### Caspio Pricing Proxy API
The application uses a Heroku-hosted proxy for all Caspio database operations.

**API Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`

**Key Endpoints:**
- Enhanced product search with faceted filtering
- Cart management (sessions, items, sizes)
- Pricing calculations for all decoration methods
- Order processing and dashboard metrics with CSR performance
- Art requests and invoicing with full CRUD
- Quote system: `/api/quote_sessions` and `/api/quote_items`
- Transfer pricing and inventory management
- Production schedules

**Note:** Detailed API documentation may be available in the proxy server repository. Check with the development team for access to the complete API specification.


## Claude Development Guidelines

1. First understand the existing patterns by reading relevant files
2. Create a plan in tasks/todo.md before making changes
3. Make minimal, focused changes that impact as little code as possible
4. Follow established patterns (adapters, quote system, event communication)
5. Always verify security - no sensitive data in frontend, validate all inputs
6. Test changes incrementally using browser console

## ⚠️ IMPORTANT: Routing Requirements for New Pages

**REMINDER: When Claude creates a new page, the following MUST be done to avoid white screen/page not loading errors:**

1. **Add the new page to the route configuration** - The page must be registered in the routing system or it will not load
2. **Ask Erik to restart the local server (port 3000)** - After adding a new page, Erik must restart the server using Roocode for the changes to take effect

**Failure to do these steps will result in:**
- White screen when trying to access the new page
- Page not loading error
- Routes not being recognized

**Always remember:** New page → Add to routes → Restart server with Erik's help

## 🚫 API Error Handling Policy - NO Silent Failures

**ERIK'S REQUIREMENT: Never use fallback/cached data when API connections fail!**

**Why this matters:**
- Using incorrect pricing data is WORSE than showing an error
- Silent failures hide problems that need to be fixed
- Customers could receive wrong quotes if fallback data is outdated

**Implementation Requirements:**

1. **When API calls fail, you MUST:**
   - Display a visible warning/error message on the page
   - Prevent the calculator/tool from proceeding with potentially wrong data
   - Log the error details to the console for debugging

2. **Never do this:**
   ```javascript
   // ❌ WRONG - Silent fallback
   try {
     const data = await fetchAPI();
   } catch (error) {
     const data = getCachedData(); // NO! Don't silently use fallback
   }
   ```

3. **Always do this:**
   ```javascript
   // ✅ CORRECT - Visible failure
   try {
     const data = await fetchAPI();
   } catch (error) {
     showErrorBanner('Unable to load current pricing. Please refresh or contact support.');
     console.error('API failed:', error);
     throw error; // Stop execution
   }
   ```

**Remember:** It's better to show "Service temporarily unavailable" than to quietly use wrong pricing data!


## Critical Resources

### API & URLs
```
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
Company Logo: https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1
Company Phone: 253-922-5793
```

### EmailJS Credentials
```
Public Key: 4qSbDO-SQs19TbP80
Service ID: service_1c4k67j
```

### Quick Reference - Essential Information
```
Phone Number: 253-922-5793 (consistent across all templates)
Company Year: 1977
Quote ID Pattern: [PREFIX][MMDD]-[sequence] (e.g., DTG0130-1)
Database Endpoints: /api/quote_sessions and /api/quote_items
```

### Active Quote Prefixes
```
DTG     // DTG Contract
RICH    // Richardson Caps  
EMB     // Embroidery Contract
EMBC    // Customer Supplied Embroidery
LT      // Laser Tumblers
PATCH   // Embroidered Emblems
SPC     // Customer Screen Print
SSC     // Safety Stripe Creator
WEB     // Webstore Setup
```

## Pricing Calculations

### Minimum Fee Calculation
- Less than minimum fee is calculated as a flat $50.00 when the total order value falls below the established minimum order threshold
- This ensures a baseline revenue for small orders that do not meet the standard minimum pricing requirements

## Development Guides & References

### Key Implementation Patterns
- **Calculator Implementation**: All calculators follow similar patterns with HTML page, quote service, EmailJS integration
- **Database Structure**: Two-table structure (quote_sessions + quote_items)
- **Quote ID Pattern**: [PREFIX][MMDD]-[sequence] (e.g., DTG0130-1)
- **EmailJS Integration**: Always provide all template variables with defaults to avoid corruption

### Available Memory Files
The `/memory/` folder contains limited documentation:
- `FILE_UPLOAD_API_REQUIREMENTS.md` - File upload API specifications

**Note:** Most implementation guides have been moved to `/docs/archive/` after completion. Check there for historical documentation on specific features.

## Key Takeaways & Common Issues

### Implementation Standards
1. **Follow Established Patterns**: All calculators use same architecture - HTML page, quote service, EmailJS integration
2. **Database Integration**: Always use two-table structure (quote_sessions + quote_items)
3. **EmailJS Variables**: Provide ALL template variables with defaults to avoid corruption
4. **Quote IDs**: Use unique prefixes and daily sequence reset
5. **Error Handling**: Log details but don't stop email send on database failure
6. **Testing**: Always show quote ID in success message for user reference

### Common Fixes
- **EmailJS "Corrupted variables"**: Add missing variables with defaults (`|| ''`)
- **Database not saving**: Check endpoint `/api/quote_sessions` and field names  
- **Quote ID not showing**: Add display element in success message
- **Wrong template**: Use template ID, not name
- **Script parsing error**: Escape closing tags: `<\/script>`
- **CSS not updating**: Add cache-busting parameter to stylesheet link

### Console Debug Commands
```javascript
// Check calculator initialization
console.log(window.[name]Calculator);

// Test quote ID generation  
console.log(new [Name]QuoteService().generateQuoteID());

// Debug email data
console.log('Email data:', emailData);
```

## Active Calculators

The following calculators are currently active in the system:
- **DTG Contract** (DTG) - Contract pricing for direct-to-garment printing
- **Richardson Caps** (RICH) - Richardson vendor cap pricing
- **Embroidery Contract** (EMB) - Contract embroidery pricing
- **Customer Supplied Embroidery** (EMBC) - Embroidery on customer-supplied garments
- **Laser Tumblers** (LT) - Polar Camel laser engraved tumblers
- **Embroidered Emblems** (PATCH) - Custom patches and badges

Remember: These existing calculators serve as working examples. When in doubt, reference their implementation patterns.

## Art Invoice System

### Overview
The Art Invoice System provides comprehensive invoice management for design services with quote ID format: ART-{ID_Design}.

### Recent Improvements (2025-06-30)
- **Enhanced dashboard layout** with separate Email Actions and Payment Actions columns
- **Improved undo payment functionality** with better date parsing and same-day restriction
- **Email tracking display** showing when invoices were sent and to whom
- **Resend capability** for all sent invoices with proper tracking
- **Status enhancement** with detailed email and payment tracking information
- **Professional UI redesign** with better organization and mobile responsiveness

### Key Features
- **Dynamic field handling**: API automatically handles any fields in Caspio tables
- **Service code billing**: GRT-25, GRT-50, GRT-75, etc. with automatic suggestions
- **Professional invoice theme**: Blue/gray professional appearance
- **Void functionality**: Proper audit trail with 24-hour payment undo restriction
- **Email integration**: EmailJS with template system for sending invoices
- **Database integration**: Full CRUD operations via Heroku proxy API

### Files
- `/art-invoices-dashboard.html` - Main dashboard with enhanced layout
- `/art-invoice-view.html` - Individual invoice viewing and editing
- `/calculators/art-invoice-creator.html` - Invoice creation page
- `/calculators/art-invoice-service-v2.js` - Backend service with full API integration

### Dashboard Functionality
- **Email Actions Column**: View, Send, Resend, Remind
- **Payment Actions Column**: Mark Paid, Undo Payment, Add Payment
- **Enhanced Status Display**: Shows email sent dates and payment tracking
- **Improved Filtering**: By status, date range, customer, and project
- **Bulk Operations**: Mark multiple invoices as paid
- **Mobile Responsive**: Optimized layout for all devices

## Art Hub System

### Overview
The Art Hub provides a centralized dashboard for managing art requests and notes across different user roles (AEs and Artists).

### Key Features
- **Role-based dashboards**: Separate views for Account Executives and Artists
- **Modal-based note system**: Add and view notes without leaving the dashboard
- **Smart page refresh**: Only refreshes when notes are actually submitted
- **Royal Blue theme**: Consistent visual design (#4169E1)

### Files
- `/art-hub-dashboard.html` - Main AE dashboard (green theme)
- `/art-hub-steve.html` - Artist dashboard (royal blue theme)

### Recent Updates
- **Conditional refresh logic**: Pages only refresh when notes are submitted via tracking `noteWasSubmitted` flag
- **Improved user experience**: Prevents unnecessary page refreshes when modals are closed without action

## 📋 Code Review Checklist (Run BEFORE Every Work Session)

### Start of Session Checks:
```bash
# 1. Check for bad patterns
echo "=== Checking for version suffix files ==="
find . -name "*-backup*" -o -name "*-FINAL*" -o -name "*-FIXED*" -o -name "*-old*" | head -20

echo "=== Checking for test files outside /tests/ ==="
find . -name "*test*" -not -path "./tests/*" -not -path "./node_modules/*" | head -20

echo "=== Checking for inline styles ==="
grep -l "style=" --include="*.html" -r . | head -20

# 2. Verify documentation is current
echo "=== Files not in ACTIVE_FILES.md ==="
find . \( -name "*.js" -o -name "*.html" \) -not -path "./node_modules/*" | while read file; do
  grep -q "$(basename $file)" ACTIVE_FILES.md || echo "Not documented: $file"
done | head -20

# 3. Check for console.logs
echo "=== Console.logs in production code ==="
grep -r "console.log" --include="*.js" --exclude-dir="tests" --exclude-dir="node_modules" | head -20
```

### End of Session Checks:
```bash
# 1. Verify no new bad patterns introduced
# 2. Confirm ACTIVE_FILES.md is updated
# 3. Check all tests still pass
# 4. Remove any temporary/debug code
# 5. Commit with descriptive message
```

## 🔄 Version Control Best Practices

### One File, One Purpose - Use Git for Versions
```bash
# ❌ NEVER create multiple versions
calculator.js
calculator-v2.js
calculator-new.js
calculator-improved.js

# ✅ ALWAYS use Git branches
git checkout -b feature/improve-calculator
# Work on calculator.js
git add calculator.js
git commit -m "Improve calculator performance"
git checkout main
git merge feature/improve-calculator
```

### Clean Git History
```bash
# Before committing, always:
1. Remove all console.log statements
2. Delete commented-out code
3. Remove test files from production folders
4. Update documentation

# Good commit messages:
git commit -m "Add DTG pricing calculator with quote generation"
git commit -m "Fix embroidery adapter data extraction bug"
git commit -m "Refactor cart management to use sessions"

# Bad commit messages (avoid these):
git commit -m "fixes"
git commit -m "WIP"
git commit -m "backup before trying something"
```

### Branch Management
```bash
# Feature branches
git checkout -b feature/new-calculator

# Bug fix branches
git checkout -b bugfix/pricing-error

# Delete branches after merging
git branch -d feature/new-calculator

# NEVER leave stale branches
git branch -a  # Check for old branches
```

## 📊 Code Health Metrics Dashboard

### Target Metrics (Zero Tolerance):
| Metric | Target | Check Command | Current |
|--------|--------|---------------|---------|
| Version suffix files | 0 | `find . -name "*-backup*" -o -name "*-FINAL*" \| wc -l` | Must be 0 |
| Test files in root | 0 | `find . -maxdepth 1 -name "*test*" \| wc -l` | Must be 0 |
| Root directory files | <50 | `ls -la \| grep -E "^-" \| wc -l` | Target <50 |
| CSV/JSON in root | 0 | `find . -maxdepth 1 \\( -name "*.csv" -o -name "*.json" \\) ! -name "package*.json" \| wc -l` | Must be 0 |
| Inline styles | 0 | `grep -l "style=" --include="*.html" -r . \| wc -l` | Target 0 |
| Inline scripts | 0 | `grep -l "<script>" --include="*.html" -r . \| xargs grep -l "function" \| wc -l` | Target 0 |
| Orphaned files | 0 | `node scripts/safety-tools/dependency-mapper.js` | Review weekly |
| Console.logs | 0 | `grep -r "console.log" --include="*.js" --exclude-dir="tests" \| wc -l` | Must be 0 |
| Hardcoded URLs | 0 | `grep -r "http" --include="*.js" \| grep -v "config" \| wc -l` | Target 0 |

### Weekly Health Check:
```bash
# Run this script weekly to ensure code health
echo "=== Code Health Report ==="
echo "Version files: $(find . -name "*-backup*" -o -name "*-FINAL*" | wc -l) (Target: 0)"
echo "Root test files: $(find . -maxdepth 1 -name "*test*" | wc -l) (Target: 0)"
echo "Inline styles: $(grep -l "style=" --include="*.html" -r . | wc -l) (Target: 0)"
echo "Console.logs: $(grep -r "console.log" --include="*.js" --exclude-dir="tests" | wc -l) (Target: 0)"
echo "=== Run full dependency check ==="
node scripts/safety-tools/dependency-mapper.js
```

## 📚 Documentation Structure

### Active Documentation (Root Directory)
The following .md files in the root directory are **actively maintained and should be followed**:
- **CLAUDE.md** (this file) - Primary instruction file for Claude
- **CLAUDE_CODING_STANDARDS.md** - Mandatory coding standards
- **MONITORING_SETUP.md** - File monitoring system guide
- **README.md** - Project overview
- **ACTIVE_FILES.md** - List of actively maintained files

### Archived Documentation
Historical documentation has been moved to `/docs/archive/` and should be considered **outdated or completed**:
- Cleanup phase reports (PHASE4, PHASE5, etc.)
- Old implementation plans
- Completed feature documentation
- Superseded safety guides

### Memory Folder - RESTRICTED USE
The `/memory/` folder is **NOT for general documentation**:
- ✅ **ONLY for:** API specifications, critical system references
- ❌ **NOT for:** Guides, plans, reports, general documentation
- **Current contents:**
  - `FILE_UPLOAD_API_REQUIREMENTS.md` - File upload API specifications
  - `backup-20250815/` - Backup folder from earlier work
- **If adding to memory:** Must update CLAUDE.md with @memory/ reference

### Important for Claude and Developers
1. **Always check CLAUDE.md first** - This is the single source of truth
2. **Ignore archived docs** unless specifically researching history
3. **When creating new documentation:**
   - Temporary docs → Create in `/docs/`, use, then move to `/docs/archive/`
   - Permanent docs → Keep in root and update this section
   - API specs only → `/memory/` folder with CLAUDE.md update
4. **Reduce confusion** - If you find outdated info, check if the doc is archived

### Maintaining Documentation
- Archive completed docs immediately after use
- Keep root directory clean (10-15 essential .md files max)
- Update this section when adding permanent documentation
- Use clear, descriptive filenames
- Regular cleanup: Move outdated docs to `/docs/archive/`