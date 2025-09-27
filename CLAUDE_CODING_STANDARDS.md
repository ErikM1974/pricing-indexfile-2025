# Claude Coding Standards - MANDATORY RULES
**Version 2.0 - Preventing Code Chaos Before It Starts**

## 🚨 CRITICAL: Read This First

This document contains MANDATORY rules that Claude (and all developers) MUST follow when writing code. These rules are designed to prevent the creation of messy, disorganized codebases that require massive cleanup efforts later.

**Failure to follow these rules has previously resulted in:**
- 71+ orphaned files
- 353 HTML files with inline code
- Multiple versions of the same file (`-FINAL`, `-FIXED`, `-backup`)
- Test files mixed with production code
- 48% of JavaScript files being unused

## 📁 1. MANDATORY Project Structure

### Initial Setup (REQUIRED from Day 1)

```
/project-root
├── src/                      # Source code ONLY
│   ├── components/           # Reusable UI components
│   │   ├── common/          # Shared across pages
│   │   └── specific/        # Page-specific components
│   ├── pages/               # Page-level components
│   ├── services/            # Business logic & API calls
│   │   ├── api/            # API service layers
│   │   └── utils/          # Helper functions
│   ├── styles/              # Global styles
│   │   ├── components/     # Component styles
│   │   └── global/         # Global CSS
│   └── config/              # Configuration files
├── public/                   # Static files (images, fonts)
├── tests/                    # ALL test files go here
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── sandbox/            # Experimental code
├── docs/                     # Documentation
│   ├── api/                # API documentation
│   └── guides/             # User guides
├── scripts/                  # Build and utility scripts
├── _deprecated/             # Files pending deletion (gitignored)
└── _archive/                # Old versions (gitignored)
```

### Folder Rules

| Folder | Purpose | What Goes Here | What NEVER Goes Here |
|--------|---------|----------------|---------------------|
| `/src` | Active source code | Current working files | Test files, backups |
| `/tests` | All testing | Test files, experiments | Production code |
| `/public` | Static assets | Images, fonts, downloads | JavaScript, CSS |
| `/_archive` | Historical code | Old versions for reference | Active code |
| `/_deprecated` | Pending removal | Files to be deleted soon | New development |

## ❌ 2. FORBIDDEN Practices (NEVER DO THIS)

### File Naming - BANNED Patterns

```javascript
// ❌ NEVER create files like this:
"calculator-FINAL.js"
"calculator-FIXED.js"
"calculator-backup.js"
"calculator-old.js"
"calculator-v2.js"  // Use Git branches instead
"calculator-test.js" // Tests go in /tests folder
"calculator-copy.js"
"calculator-working.js"
"calculator-broken.js"

// ✅ CORRECT approach:
"calculator.js"  // One file, one purpose
// Use Git for versions: git checkout -b feature/calculator-update
```

### Inline Code - STRICTLY FORBIDDEN

```html
<!-- ❌ NEVER do this -->
<div style="color: red; margin: 10px;">
  <script>
    function doSomething() {
      // Inline JavaScript is FORBIDDEN
    }
  </script>
</div>

<!-- ✅ ALWAYS do this -->
<div class="error-message">
  <script src="/src/components/error-handler.js"></script>
</div>
```

### Test Files - WRONG Location

```javascript
// ❌ NEVER put test files in root or src
/root/test-calculator.html
/src/debug-pricing.js
/root/verify-function.js

// ✅ ALWAYS put tests in tests folder
/tests/unit/calculator.test.js
/tests/integration/pricing.test.js
/tests/sandbox/experimental-feature.html
```

## ✅ 3. REQUIRED Practices

### A. File Creation Protocol

**Before creating ANY new file, you MUST:**

```markdown
1. CHECK: Does similar file already exist?
   - Search for similar names
   - Check all folders
   - Review existing functionality

2. DETERMINE: Correct folder placement
   - Component? → /src/components/
   - Page? → /src/pages/
   - Service? → /src/services/
   - Test? → /tests/
   - Style? → /src/styles/

3. NAME: Use consistent pattern
   - Components: `user-profile.js`
   - Services: `auth-service.js`
   - Tests: `auth-service.test.js`
   - Styles: `user-profile.css`

4. STRUCTURE: Follow module pattern
   - Export single purpose
   - Import dependencies
   - No global variables
   - Document with JSDoc

5. DOCUMENT: Update immediately
   - Add to ACTIVE_FILES.md
   - Update component diagram
   - Add JSDoc comments
```

### B. Code Organization Rules

```javascript
// Every JavaScript file MUST follow this structure:

/**
 * @fileoverview Description of what this file does
 * @module moduleName
 * @requires dependencyList
 */

// 1. Imports (grouped and ordered)
import { Component } from 'react';           // Framework
import { validateUser } from '../utils';     // Internal utils
import { API_BASE } from '../config';        // Config
import './styles.css';                       // Styles

// 2. Constants
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

// 3. Main export (class or function)
export class UserService {
  // Implementation
}

// 4. Helper functions (if needed)
function helperFunction() {
  // Implementation
}

// 5. Default export (if applicable)
export default UserService;
```

### C. Configuration Management

```javascript
// ❌ NEVER hardcode values
const API_URL = 'https://api.example.com';  // WRONG!

// ✅ ALWAYS use central config
// config/api.config.js
export const API_CONFIG = {
  BASE_URL: process.env.API_URL || 'https://api.example.com',
  TIMEOUT: 5000,
  RETRY_COUNT: 3
};

// In your file:
import { API_CONFIG } from '../config/api.config';
const url = API_CONFIG.BASE_URL;
```

## 🔄 4. Version Control Rules

### Use Git Properly - No File Duplication

```bash
# ❌ WRONG: Creating multiple versions
calculator.js
calculator-backup.js
calculator-old.js
calculator-FINAL.js

# ✅ RIGHT: Use Git branches
git checkout -b feature/calculator-improvement
# Make changes to calculator.js
git commit -m "Improve calculator logic"
# If it fails, just revert:
git checkout main -- calculator.js
```

### Clean As You Go

```javascript
// After EVERY coding session, run:
1. Remove unused imports
2. Delete commented code
3. Remove console.logs
4. Delete test files from production
5. Update documentation
```

## 📝 5. Documentation Requirements

### ACTIVE_FILES.md (Required in root)

```markdown
# Active Files Registry
Last Updated: [DATE]

## Core Application Files
- `/src/pages/index.js` - Main landing page
- `/src/services/api/auth.js` - Authentication service
- `/src/components/common/Header.js` - Site header

## Dependencies Map
- `index.js` → requires → `auth.js`, `Header.js`
- `auth.js` → requires → `api.config.js`

## Deprecated (Remove by: [DATE])
- `/src/old-calculator.js` - Replaced by new-calculator.js
```

### Component Documentation

```javascript
/**
 * UserProfile Component
 * @component
 * @param {Object} props - Component props
 * @param {string} props.userId - User ID to display
 * @param {boolean} props.editable - Whether profile can be edited
 * @returns {JSX.Element} Rendered user profile
 * @example
 * <UserProfile userId="123" editable={true} />
 *
 * @requires ../services/user-service
 * @requires ../styles/user-profile.css
 */
```

## 🎯 6. Automatic Cleanup Triggers

### Claude MUST automatically clean up when seeing:

1. **Duplicate Functionality**
   ```javascript
   // If you see calculator.js AND pricing-calculator.js
   // → Merge functionality into one file
   // → Delete the redundant file
   ```

2. **Version Suffixes**
   ```javascript
   // If you see any file with -backup, -old, -FINAL
   // → Immediately delete after verifying content
   ```

3. **Test Files in Wrong Location**
   ```javascript
   // If you see test files outside /tests
   // → Move to /tests immediately
   ```

4. **Inline Code**
   ```javascript
   // If you see <style> or <script> in HTML
   // → Extract to external files immediately
   ```

5. **Unused Files**
   ```javascript
   // After any refactor, check for orphans
   // → Run dependency check
   // → Delete unreferenced files
   ```

## 🏗️ 7. Project Initialization Checklist

When starting ANY new project:

```markdown
□ Create folder structure from template
□ Initialize Git with .gitignore
□ Create ACTIVE_FILES.md
□ Create CLAUDE.md with project rules
□ Set up ESLint with strict rules
□ Configure pre-commit hooks
□ Create /tests folder structure
□ Set up central config file
□ Document in README.md
```

## 🚦 8. Pre-Commit Checklist

Before EVERY commit:

```markdown
□ No test files in root
□ No inline styles/scripts
□ No duplicate files
□ No -backup/-FINAL files
□ All files in correct folders
□ ACTIVE_FILES.md updated
□ No hardcoded URLs
□ No console.log statements
□ JSDoc comments added
□ Unused imports removed
```

## 📊 9. Code Quality Metrics

Your code MUST maintain these standards:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| File Organization | 100% in correct folders | `find . -name "test*" -not -path "./tests/*"` |
| No Inline Code | 0 instances | `grep -r "style=" --include="*.html"` |
| No Duplicates | 0 backup files | `find . -name "*backup*" -o -name "*FINAL*"` |
| Documentation | 100% of exports | JSDoc coverage tool |
| Config Usage | 0 hardcoded URLs | `grep -r "http" --include="*.js"` |

## 🔥 10. Emergency Cleanup Commands

If mess already exists, run these immediately:

```bash
# Find and list all backup files
find . -type f \( -name "*backup*" -o -name "*FINAL*" -o -name "*FIXED*" \)

# Find test files outside tests folder
find . -name "*test*" -type f -not -path "./tests/*" -not -path "./node_modules/*"

# Find files with inline styles
grep -l "style=" --include="*.html" -r .

# Find orphaned JS files
# (Compare files on disk vs files referenced in HTML/JS)

# Find duplicate functionality
# (Files with similar names that might do the same thing)
find . -type f -name "*.js" | sed 's/.*\///' | sort | uniq -d
```

## ⚡ 11. Performance Rules

### File Size Limits

- JavaScript files: Max 500 lines (split if larger)
- CSS files: Max 1000 lines (split by component)
- HTML files: Max 200 lines (use templates)
- Single function: Max 50 lines (refactor if larger)

### Import Optimization

```javascript
// ❌ WRONG: Importing entire library
import * as _ from 'lodash';

// ✅ RIGHT: Import only what you need
import { debounce } from 'lodash/debounce';
```

## 🎨 12. Naming Conventions

### Strict Naming Rules

| Type | Pattern | Example |
|------|---------|---------|
| **Files** | kebab-case | `user-profile.js` |
| **Folders** | kebab-case | `shared-components/` |
| **Components** | PascalCase | `UserProfile` |
| **Functions** | camelCase | `getUserData()` |
| **Constants** | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| **CSS Classes** | kebab-case | `user-profile-header` |
| **Test Files** | *.test.js | `user-service.test.js` |

## 📋 13. File Creation Template

```javascript
/**
 * @fileoverview [Brief description of file purpose]
 * @author [Your name or "Claude"]
 * @created [Date]
 * @modified [Date]
 * @module [module-name]
 * @requires [list of dependencies]
 */

'use strict';

// ============================================================================
// IMPORTS
// ============================================================================

// External dependencies
import React from 'react';

// Internal dependencies
import { validateInput } from '../utils/validators';

// Styles
import './component.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIMEOUT = 5000;

// ============================================================================
// MAIN COMPONENT/FUNCTION
// ============================================================================

/**
 * Main component/function description
 * @param {Object} props - Description
 * @returns {*} Description
 */
export function MainComponent(props) {
  // Implementation
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper function description
 * @private
 */
function helperFunction() {
  // Implementation
}

// ============================================================================
// EXPORTS
// ============================================================================

export default MainComponent;
```

## ✅ 14. Self-Audit Questions

Before writing ANY code, ask yourself:

1. **Does this file already exist in another form?**
2. **Am I putting this in the right folder?**
3. **Am I following the naming convention?**
4. **Have I checked for similar functionality?**
5. **Is my code modular and reusable?**
6. **Have I avoided inline styles/scripts?**
7. **Have I used configuration instead of hardcoding?**
8. **Have I documented this properly?**
9. **Will another developer understand this in 6 months?**
10. **Have I cleaned up any test/temporary code?**

## 🚀 Implementation

### How Claude Should Use This Document

1. **Before Starting:** Read sections 1-3
2. **While Coding:** Follow sections 4-7
3. **Before Committing:** Check sections 8-9
4. **If Mess Exists:** Use section 10
5. **Regular Review:** Audit with sections 11-14

### Enforcement

These rules are MANDATORY. Code that violates these standards should:
1. Not be committed
2. Be immediately refactored
3. Trigger automatic cleanup

---

**Remember:** It's 100x easier to maintain clean code from the start than to clean up a mess later. These standards prevented a 71-file cleanup disaster. Follow them religiously.

*Last Updated: 2025-01-27*
*Version: 2.0*
*Status: MANDATORY FOR ALL CODE*