# Safe Cleanup Plan 2025 - NWCA Codebase

## 🎯 Goal
Create a clean, understandable codebase for AI and developers by removing duplicates, test files, and versioned confusion - WITHOUT breaking the website.

## 🛡️ Safety Principles
1. **MOVE, don't DELETE** - Everything goes to archive folders
2. **TEST after each phase** - Verify website still works
3. **CHECK dependencies** - Ensure files aren't being used
4. **DOCUMENT everything** - Track what was moved and why
5. **ROLLBACK ready** - Can restore files instantly if needed

---

## 📊 Current State Analysis

### What We Found:
- **342,872 lines** of code (after first cleanup)
- **190+ files** with version numbers (v1, v2, v3, v4)
- **50+ test files** in root directory (test-*.html)
- **Multiple archive folders** (/archive/, /_archive/)
- **273 HTML files** with inline CSS
- **259 HTML files** with inline JavaScript
- **Duplicate pricing systems** (v3 and v4 versions coexisting)

### Main Confusion Points for AI:
1. Which version is current? (dtg-pricing-v3.js or v4?)
2. Test files mixed with production files
3. Multiple ways to do the same thing
4. No clear folder organization
5. Inline code makes logic hard to follow

---

## 🔄 Phase-by-Phase Cleanup Plan

### **PHASE 1: Remove Obvious Test Files** ✅ SAFE
**Timeline**: Immediate (Day 1)
**Risk Level**: Zero - These are clearly test files

**Files to Move:**
```
test-*.html (50+ files in root)
dtg-v3-test.html
test-dtg-pricing-fix.html
test-dtg-reordered-flow.html
*-test.* (any test files)
*-demo.html
*-example.html
```

**Safety Check:**
- These all have "test" in the name
- Not linked from any navigation
- Used for development only

**Expected Reduction**: ~30,000 lines

---

### **PHASE 2: Consolidate Archive Folders** ✅ SAFE
**Timeline**: Day 1-2
**Risk Level**: Zero - Already archived

**Folders to Consolidate:**
```
/archive/ → /archive-2025-cleanup/
/_archive/ → /archive-2025-cleanup/
Any "old" folders → /archive-2025-cleanup/
```

**Safety Check:**
- These are already marked as archives
- Not referenced by active code

**Expected Reduction**: ~20,000 lines

---

### **PHASE 3: Resolve Version Conflicts** ⚠️ CAREFUL
**Timeline**: Day 3-4
**Risk Level**: Medium - Need to verify which version is active

**Version Analysis:**
```
ACTIVE (Keep):
✅ dtg-pricing-v4.js (used by dtg-pricing.html)
✅ screenprint-pricing-v2.js (latest version)
✅ cap-embroidery-pricing-v3.js (latest version)

INACTIVE (Archive):
❌ dtg-pricing-v3.js (only used by test files)
❌ Any v1 or v2 versions where v3/v4 exists
❌ Files with "-old" suffix
```

**Safety Process:**
1. Check which files reference each version
2. Verify the active calculator uses the latest
3. Move older versions to archive
4. Test calculator after moving

**Expected Reduction**: ~15,000 lines

---

### **PHASE 4: Clean Root Directory** ✅ SAFE
**Timeline**: Day 5
**Risk Level**: Low - Moving to organized folders

**Current Root Chaos** (50+ files should not be in root):
```
MOVE TO /calculators/:
- All calculator HTML files
- Calculator-specific JS files

MOVE TO /services/:
- API integration files
- Quote service files
- Pricing service files

MOVE TO /dashboards/:
- All dashboard HTML files
- Dashboard JS files

KEEP IN ROOT:
- index.html
- staff-dashboard.html (main entry)
- package.json
- webpack.config.js
- README files
```

**Expected Improvement**: Clear organization

---

### **PHASE 5: Remove Duplicate Functionality** ⚠️ CAREFUL
**Timeline**: Week 2
**Risk Level**: Medium - Need careful analysis

**Duplicates to Consolidate:**
```
Multiple cart systems:
- cart.js (1,921 lines)
- cart-integration.js (2,457 lines)
- cart-ui.js (1,058 lines)
→ Should be ONE cart system

Multiple pricing adapters doing same thing:
- Various adapter files with similar code
→ One adapter with configuration

Multiple dashboard versions:
- Check for functionality overlap
```

**Expected Reduction**: ~20,000 lines

---

### **PHASE 6: Extract Inline Code** 🔧 REFACTOR
**Timeline**: Week 3-4
**Risk Level**: Low - Just extracting, not changing logic

**Process:**
```
1. Create /styles/calculator-common.css
2. Create /scripts/calculator-base.js
3. Extract repeated inline styles to CSS file
4. Extract repeated inline scripts to JS file
5. Link files in HTML pages
```

**Expected Reduction**: ~40,000 lines

---

## ✅ Safety Checklist for Each File

Before moving ANY file, verify:

```markdown
□ Search for filename in all HTML files
□ Search for filename in all JS files  
□ Check if linked in navigation
□ Test the related feature works
□ Move to archive (not delete)
□ Test feature again after moving
□ Document what was moved
```

---

## 🧪 Testing Protocol

### After Each Phase:
1. **Load main dashboard** - Does it display?
2. **Click through navigation** - All links work?
3. **Test a calculator** - Does pricing work?
4. **Check browser console** - Any 404 errors?
5. **Submit a test quote** - Does it save?

### Red Flags to Stop:
- 404 errors in console
- Broken images or styles
- Calculator not working
- Navigation links broken
- JavaScript errors

---

## 📁 Final Structure Goal

```
/
├── index.html
├── staff-dashboard.html
├── package.json
├── README.md
│
├── /src
│   ├── /calculators      # All calculator files
│   ├── /dashboards       # Dashboard files
│   ├── /services         # API and services
│   ├── /components       # Shared components
│   └── /utils           # Utility functions
│
├── /public
│   ├── /styles          # All CSS files
│   ├── /scripts         # All JS files
│   └── /images          # All images
│
├── /training            # Training materials
├── /docs               # Documentation
└── /archive-2025       # All archived files
```

---

## 🔄 Rollback Plan

If ANYTHING breaks:

1. **Immediate Rollback** (< 1 minute):
```bash
# Move file back from archive
mv archive-2025-cleanup/[filename] ./[original-location]/
```

2. **Git Rollback** (< 5 minutes):
```bash
# Revert to previous commit
git revert HEAD
```

3. **Full Restore** (< 10 minutes):
```bash
# Restore entire archive if needed
mv archive-2025-cleanup/* ./
```

---

## 📈 Expected Results

### Before Cleanup:
- **Lines of Code**: 342,872
- **Files**: 750+
- **Confusion Level**: High
- **AI Understanding**: 60%

### After Complete Cleanup:
- **Lines of Code**: ~150,000 (56% reduction)
- **Files**: ~400 (organized)
- **Confusion Level**: None
- **AI Understanding**: 95%

### Benefits:
1. **AI/Claude** can understand entire codebase
2. **No duplicate confusion** 
3. **Clear file purposes**
4. **Faster development**
5. **Easier maintenance**
6. **Better performance**

---

## 🚦 Implementation Schedule

### Week 1 (Safe Cleanup):
- **Day 1**: Remove test files (Phase 1)
- **Day 2**: Consolidate archives (Phase 2)
- **Day 3-4**: Resolve versions (Phase 3)
- **Day 5**: Organize directories (Phase 4)

### Week 2 (Careful Cleanup):
- **Day 6-8**: Remove duplicates (Phase 5)
- **Day 9-10**: Testing and verification

### Week 3-4 (Optimization):
- Extract inline code (Phase 6)
- Final testing and documentation

---

## ⚠️ DO NOT TOUCH List

These files/folders are CRITICAL - never move:

```
✗ node_modules/
✗ .git/
✗ package.json
✗ package-lock.json
✗ webpack.config.js
✗ server.js
✗ /shared_components/js/ (active versions only)
✗ index.html
✗ staff-dashboard.html (current version)
```

---

## 📝 Progress Tracking

### Phase 1: Test Files ⬜
- [ ] Identify all test files
- [ ] Move to archive
- [ ] Test website
- [ ] Document results

### Phase 2: Archives ⬜
- [ ] Consolidate archive folders
- [ ] Test website
- [ ] Document results

### Phase 3: Versions ⬜
- [ ] Identify active versions
- [ ] Archive old versions
- [ ] Update references
- [ ] Test calculators
- [ ] Document results

### Phase 4: Organization ⬜
- [ ] Create folder structure
- [ ] Move files to proper folders
- [ ] Update paths
- [ ] Test website
- [ ] Document results

### Phase 5: Duplicates ⬜
- [ ] Identify duplicate functionality
- [ ] Consolidate code
- [ ] Test features
- [ ] Document results

### Phase 6: Inline Code ⬜
- [ ] Extract CSS
- [ ] Extract JavaScript
- [ ] Update HTML files
- [ ] Test everything
- [ ] Document results

---

## 🎯 Success Criteria

The cleanup is successful when:

1. ✅ Website works perfectly (no broken features)
2. ✅ No test files in production folders
3. ✅ No version confusion (only latest versions)
4. ✅ Clear folder organization
5. ✅ No duplicate functionality
6. ✅ AI can understand the entire codebase
7. ✅ Code reduced by 50%+
8. ✅ Everything documented

---

## 🚀 Ready to Start?

**Phase 1 is completely safe** - just moving test files that aren't used.

Start with:
```bash
# Create archive if not exists
mkdir -p archive-2025-cleanup

# Move test files (completely safe)
mv test-*.html archive-2025-cleanup/

# Test the website still works
# If all good, continue to Phase 2
```

---

*Document Created: August 13, 2025*
*Purpose: Safe, systematic cleanup of NWCA codebase*
*Priority: Make codebase AI-friendly while maintaining functionality*