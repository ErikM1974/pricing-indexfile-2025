# Project Initialization Template
**Purpose:** Start every new project with proper structure to prevent code chaos

## 🚀 Quick Start Commands

```bash
# 1. Create new project from template
mkdir my-new-project && cd my-new-project

# 2. Initialize folder structure
mkdir -p src/{components/{common,specific},pages,services/{api,utils},styles/{components,global},config}
mkdir -p public/{images,fonts,downloads}
mkdir -p tests/{unit,integration,sandbox}
mkdir -p docs/{api,guides}
mkdir -p scripts
mkdir -p _deprecated _archive

# 3. Create essential files
touch README.md CLAUDE.md ACTIVE_FILES.md .gitignore
touch src/config/app.config.js
touch src/config/api.config.js

# 4. Initialize Git
git init
git add .
git commit -m "Initial project structure"
```

## 📁 Directory Structure Template

```
my-new-project/
├── src/
│   ├── components/
│   │   ├── common/          # Shared components
│   │   │   ├── Header.js
│   │   │   ├── Footer.js
│   │   │   └── Navigation.js
│   │   └── specific/        # Page-specific components
│   │       └── .gitkeep
│   ├── pages/               # Page components
│   │   ├── index.js
│   │   └── about.js
│   ├── services/            # Business logic
│   │   ├── api/
│   │   │   └── api-client.js
│   │   └── utils/
│   │       └── validators.js
│   ├── styles/              # Stylesheets
│   │   ├── components/
│   │   │   └── header.css
│   │   └── global/
│   │       ├── reset.css
│   │       └── variables.css
│   └── config/              # Configuration
│       ├── app.config.js
│       └── api.config.js
├── public/                  # Static assets
│   ├── images/
│   ├── fonts/
│   └── downloads/
├── tests/                   # All tests
│   ├── unit/
│   ├── integration/
│   └── sandbox/
├── docs/                    # Documentation
│   ├── api/
│   └── guides/
├── scripts/                 # Build/utility scripts
│   └── build.sh
├── _deprecated/            # Files to remove (gitignored)
├── _archive/               # Old versions (gitignored)
├── .gitignore
├── package.json
├── README.md
├── CLAUDE.md
└── ACTIVE_FILES.md
```

## 📄 Essential File Contents

### 1. `.gitignore`
```gitignore
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build outputs
dist/
build/
*.min.js
*.min.css

# Development
.env.local
.env.development.local
.env.test.local
.env.production.local
*.log
.DS_Store

# IDE
.vscode/
.idea/
*.sublime-*

# Testing
coverage/
.nyc_output/

# IMPORTANT: Archive folders
_deprecated/
_archive/
*-backup.*
*-FINAL.*
*-FIXED.*
*-old.*
*.backup

# Temporary
tmp/
temp/
*.tmp
```

### 2. `package.json`
```json
{
  "name": "my-new-project",
  "version": "1.0.0",
  "description": "Clean project structure from day 1",
  "main": "src/index.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "webpack --mode production",
    "test": "jest",
    "lint": "eslint src/",
    "clean": "rm -rf dist build _deprecated _archive",
    "audit-files": "node scripts/audit-files.js",
    "pre-commit": "npm run lint && npm run test"
  },
  "dependencies": {},
  "devDependencies": {
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "nodemon": "^3.0.0",
    "webpack": "^5.0.0"
  },
  "eslintConfig": {
    "rules": {
      "no-console": "error",
      "no-debugger": "error",
      "no-unused-vars": "error",
      "prefer-const": "error"
    }
  }
}
```

### 3. `CLAUDE.md`
```markdown
# CLAUDE.md - Project Guidelines

## MANDATORY: Read Before Coding
- **[CLAUDE_CODING_STANDARDS.md](./CLAUDE_CODING_STANDARDS.md)** - REQUIRED reading
- Follow all standards to prevent code chaos

## Project Overview
[Brief description of this project]

## Quick Commands
- `npm start` - Start development server
- `npm test` - Run tests
- `npm run lint` - Check code quality
- `npm run audit-files` - Check for orphaned files

## Active Features
[List main features]

## API Endpoints
[List API endpoints used]

## Before Creating Any File
1. Check if it already exists
2. Use correct folder
3. Follow naming conventions
4. No inline code
5. Update ACTIVE_FILES.md
```

### 4. `ACTIVE_FILES.md`
```markdown
# Active Files Registry
Last Updated: [DATE]

## Entry Points
- `/src/pages/index.js` - Main page

## Components
- `/src/components/common/Header.js` - Site header

## Services
- `/src/services/api/api-client.js` - API communication

## Styles
- `/src/styles/global/reset.css` - CSS reset

## Configuration
- `/src/config/app.config.js` - App settings
- `/src/config/api.config.js` - API settings

## Update Protocol
Update this file immediately after:
- Creating any new file
- Deleting any file
- Moving files
```

### 5. `src/config/app.config.js`
```javascript
/**
 * @fileoverview Central application configuration
 * @module config/app
 */

export const APP_CONFIG = {
  // Application settings
  APP_NAME: 'My New Project',
  VERSION: '1.0.0',

  // Feature flags
  FEATURES: {
    ENABLE_DEBUG: process.env.NODE_ENV === 'development',
    ENABLE_ANALYTICS: false,
  },

  // UI settings
  UI: {
    THEME: 'light',
    ANIMATIONS_ENABLED: true,
  }
};

// Freeze to prevent accidental modification
Object.freeze(APP_CONFIG);
```

### 6. `src/config/api.config.js`
```javascript
/**
 * @fileoverview API configuration - NO HARDCODED URLs
 * @module config/api
 */

export const API_CONFIG = {
  // Base configuration
  BASE_URL: process.env.API_URL || 'http://localhost:3000/api',
  TIMEOUT: 5000,

  // Endpoints
  ENDPOINTS: {
    AUTH: '/auth',
    USERS: '/users',
    PRODUCTS: '/products',
  },

  // Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
  }
};

// Freeze configuration
Object.freeze(API_CONFIG);
```

### 7. `README.md`
```markdown
# My New Project

## Overview
[Project description]

## Quick Start
```bash
npm install
npm start
```

## Project Structure
```
src/           # Source code
tests/         # Test files
docs/          # Documentation
public/        # Static assets
```

## Development Guidelines
- Read `CLAUDE_CODING_STANDARDS.md` before contributing
- Update `ACTIVE_FILES.md` when adding/removing files
- No inline styles or scripts
- No test files in production folders
- Use Git branches, not backup files

## Scripts
- `npm start` - Start development
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run lint` - Check code quality
- `npm run audit-files` - Find orphaned files

## Contributing
1. Create feature branch
2. Follow coding standards
3. Update documentation
4. Run tests
5. Submit PR
```

## 🛠️ Setup Scripts

### `scripts/audit-files.js`
```javascript
#!/usr/bin/env node

/**
 * Audit script to find problematic files
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Auditing project files...\n');

// Check for backup files
const backupPatterns = ['-backup', '-FINAL', '-FIXED', '-old', '-copy'];
let issues = 0;

function walkDir(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      walkDir(filePath);
    } else if (stat.isFile()) {
      // Check for problematic patterns
      backupPatterns.forEach(pattern => {
        if (file.includes(pattern)) {
          console.log(`❌ Backup file found: ${filePath}`);
          issues++;
        }
      });

      // Check for test files outside tests folder
      if (file.includes('test') && !filePath.includes('/tests/')) {
        console.log(`❌ Test file in wrong location: ${filePath}`);
        issues++;
      }
    }
  });
}

walkDir('./src');

if (issues === 0) {
  console.log('✅ No issues found! Project structure is clean.');
} else {
  console.log(`\n⚠️  Found ${issues} issues that need attention.`);
  process.exit(1);
}
```

## 🎯 Pre-commit Hook Setup

### Install husky for pre-commit hooks
```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run pre-commit"
```

### `.husky/pre-commit`
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run linter
npm run lint

# Check for problematic files
node scripts/audit-files.js

# Check for inline styles
if grep -r "style=" --include="*.html" src/; then
  echo "❌ Inline styles found! Extract to CSS files."
  exit 1
fi

# Check for console.log
if grep -r "console.log" --include="*.js" src/; then
  echo "❌ console.log found! Remove before committing."
  exit 1
fi

echo "✅ All pre-commit checks passed!"
```

## 📋 Initialization Checklist

When starting a new project, complete this checklist:

```markdown
## Project Setup Checklist

### Initial Setup
- [ ] Create folder structure using template
- [ ] Copy all template files
- [ ] Initialize Git repository
- [ ] Create .gitignore with all patterns
- [ ] Set up package.json
- [ ] Install ESLint
- [ ] Configure pre-commit hooks

### Configuration
- [ ] Create app.config.js
- [ ] Create api.config.js
- [ ] Set up environment variables
- [ ] Configure build scripts

### Documentation
- [ ] Write README.md
- [ ] Create CLAUDE.md
- [ ] Initialize ACTIVE_FILES.md
- [ ] Add coding standards

### Quality Checks
- [ ] Run audit script
- [ ] Test pre-commit hooks
- [ ] Verify folder structure
- [ ] Check no hardcoded values

### First Commit
- [ ] Review all files
- [ ] Ensure clean structure
- [ ] Commit with message: "Initial project structure from template"
```

## 🚫 Anti-patterns to Avoid

### Never Do This at Project Start:
```javascript
// ❌ Creating files without structure
index.html
script.js
style.css
test.html
index-backup.html

// ✅ Always use proper structure
src/pages/index.html
src/scripts/main.js
src/styles/main.css
tests/index.test.html
```

### Never Start Coding Without:
1. Folder structure in place
2. Configuration files created
3. Git initialized
4. .gitignore configured
5. ACTIVE_FILES.md created

## 🎉 Result

Following this template will:
- **Prevent** 90% of structural problems
- **Enforce** clean code from day 1
- **Enable** easy maintenance
- **Avoid** massive cleanup efforts
- **Create** self-documenting projects

---

*This template prevented the need for a 71-file cleanup. Use it for EVERY new project!*