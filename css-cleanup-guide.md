# CSS Cleanup Guide for staff-dashboard.html

## Identified Issues

### 1. Duplicate Selectors Found
- `.nav-section-title` appears multiple times (lines 212, 259)
- `.nav-section-subtitle` appears multiple times (lines 267, 277)
- `.nav-section-content` appears multiple times (lines 238, 271)
- `.quick-access-bar` has duplicate styles
- Multiple animation keyframes for similar effects

### 2. Organizational Structure Needed

The CSS should be reorganized into these logical sections:

```css
/* =====================================================
   1. ROOT VARIABLES & DESIGN SYSTEM
   ===================================================== */
   
/* =====================================================
   2. ANIMATIONS & KEYFRAMES
   ===================================================== */
   
/* =====================================================
   3. BASE STYLES & RESETS
   ===================================================== */
   
/* =====================================================
   4. LAYOUT COMPONENTS
   ===================================================== */
   - Dashboard Container
   - Main Content Area
   
/* =====================================================
   5. SIDEBAR COMPONENTS
   ===================================================== */
   - Sidebar Container
   - Sidebar Header
   - Sidebar Navigation
   - Nav Sections
   - Nav Links
   
/* =====================================================
   6. TOP HEADER COMPONENTS
   ===================================================== */
   - Top Header Container
   - User Dropdown
   - Breadcrumb Navigation
   
/* =====================================================
   7. QUICK ACCESS BARS
   ===================================================== */
   - Quick Access Container
   - Quick Access Buttons
   
/* =====================================================
   8. COMMAND BAR
   ===================================================== */
   
/* =====================================================
   9. PRODUCTION SCHEDULE
   ===================================================== */
   
/* =====================================================
   10. ANNOUNCEMENT CARDS
   ===================================================== */
   
/* =====================================================
   11. METRICS DASHBOARD
   ===================================================== */
   
/* =====================================================
   12. CALCULATOR CARDS
   ===================================================== */
   
/* =====================================================
   13. MODAL STYLES
   ===================================================== */
   
/* =====================================================
   14. UTILITY CLASSES
   ===================================================== */
   
/* =====================================================
   15. RESPONSIVE STYLES
   ===================================================== */
```

### 3. Rules to Consolidate

1. Merge duplicate nav-section styles
2. Combine similar animation keyframes
3. Group related hover states together
4. Consolidate color usage to variables
5. Remove redundant !important declarations where possible

### 4. Performance Optimizations

1. Use CSS containment for cards
2. Reduce complex selectors
3. Optimize animation performance with will-change
4. Remove unused styles