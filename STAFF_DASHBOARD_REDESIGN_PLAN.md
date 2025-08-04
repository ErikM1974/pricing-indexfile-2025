# Staff Dashboard Redesign Plan
## Northwest Custom Apparel - 2025

---

## Executive Summary

### Current State
The NWCA Staff Dashboard serves as the central hub for all internal operations but suffers from:
- **Poor Organization**: 12+ sections with no clear hierarchy
- **Accessibility Issues**: Critical Art Operations tools buried in section #8
- **Visual Problems**: Small text (13px), inconsistent spacing, no visual hierarchy
- **Information Overload**: 29+ menu items competing for attention
- **Role Confusion**: Same interface for all users regardless of their primary tasks

### Proposed Solution
A phased redesign focusing on:
1. ✅ **Phase 1**: Command bar for instant Art Operations access (COMPLETE)
2. **Phase 2**: Role-focused dashboard content
3. **Phase 3**: Streamlined sidebar navigation
4. **Phase 4**: Role-based view switching
5. **Phase 5**: Advanced features and polish

### Expected Outcomes
- **50% reduction** in clicks to access daily tools
- **Improved readability** with 15px base font size
- **Role-specific workflows** reducing cognitive load
- **Better visual hierarchy** guiding users to their tasks
- **Increased productivity** through optimized information architecture

---

## 1. Current State Analysis

### 1.1 Sidebar Navigation Inventory

| Section | Items | Daily Use | Issues |
|---------|-------|-----------|---------|
| Reports & Analytics | 1 | Low | Single item section |
| Art Workflow | 3 | **HIGH** | Buried at position #8 |
| Office Assistant Dashboard | 6 | Medium | No sub-organization |
| Contract Pricing | 2 | Medium | Missing screen print |
| Customer Supplied | 3 | Medium | Good grouping |
| Specialty Items | 1 | Low | Single item section |
| Other Vendors | 1 | Low | Single item section |
| Manual Calculators | 7 | Low | Too many items, rarely used |
| Developer Tools | 1 | Low | Should be hidden |
| Product Viewers | 1 | Low | Unclear purpose |
| Guides & Resources | 2 | Low | Could be combined |
| Management | 1 | Low | Single item section |

### 1.2 Key Problems Identified

#### Navigation Issues
- **Art Operations at position #8** despite being used "all the time"
- **12 sections** create decision fatigue
- **4 single-item sections** waste vertical space
- **No visual hierarchy** - all items look equally important

#### Visual Design Problems
- **Font size: 13px (0.8125rem)** - too small for comfortable reading
- **Sidebar width: 200px** - cramped for longer labels
- **No hover states** on many elements
- **Inconsistent spacing** between sections
- **Mixed emoji usage** creates visual noise

#### User Experience Issues
- **No role-based customization** - everyone sees everything
- **Critical tools require scrolling** to access
- **No keyboard shortcuts** for frequent actions
- **No search functionality** for finding tools quickly

### 1.3 Usage Patterns (Based on User Feedback)

#### High-Frequency (Daily/Hourly)
- AE Art Dashboard
- Art Hub Dashboard  
- Artist Dashboard
- Art Invoice System
- Sanmar Vendor Portal

#### Medium-Frequency (Weekly)
- DTG Calculator
- Embroidery Calculator
- Screen Print Calculator
- Order Dashboard

#### Low-Frequency (Monthly or Less)
- Manual Calculators
- Developer Tools
- Guides & Resources

---

## 2. User Personas & Workflows

### 2.1 Art Coordinator (Office Assistant)
**Primary Tasks:**
- Track art requests from submission to billing
- Coordinate between AEs and artists
- Manage art invoicing
- Monitor workflow status

**Pain Points:**
- Must scroll to find Art Hub tools
- No overview of pending tasks
- Switching between portals is cumbersome

**Needs:**
- Instant access to Art Hub Dashboard
- Real-time status indicators
- Quick navigation between related tools

### 2.2 Account Executive (AE)
**Primary Tasks:**
- Submit art requests
- Check art status
- Access pricing calculators
- Review customer quotes

**Pain Points:**
- Art tools mixed with unrelated items
- Calculators spread across multiple sections
- No quick way to see their submissions

**Needs:**
- Grouped art and sales tools
- Fast calculator access
- Personal dashboard view

### 2.3 Artist (Steve)
**Primary Tasks:**
- Review assigned art jobs
- Update job status
- Log time spent
- Upload completed artwork

**Pain Points:**
- Dashboard shows irrelevant sales data
- Must navigate through clutter to reach tools
- No focus on art-specific metrics

**Needs:**
- Art-focused interface
- Queue of assigned work
- Time tracking integration

### 2.4 Management
**Primary Tasks:**
- Monitor overall metrics
- Review performance
- Access reports
- Oversee operations

**Pain Points:**
- Metrics scattered across dashboard
- No executive summary view
- Must dig for high-level insights

**Needs:**
- Executive dashboard
- Customizable metrics
- Drill-down capabilities

---

## 3. Information Architecture Redesign

### 3.1 New Category System

```
PRIMARY TOOLS (Always Visible)
├── Art Operations ─────────┬─► AE Portal
│                           ├─► Art Coordinator Portal
│                           └─► Artist Portal
│
├── Quick Calculators ──────┬─► DTG
│                           ├─► Embroidery
│                           └─► Screen Print
│
└── Vendor Portals ─────────┬─► Sanmar
                            └─► ShopWorks

SECONDARY TOOLS (Collapsible)
├── All Calculators ────────┬─► Contract Pricing
│                           ├─► Customer Supplied
│                           ├─► Specialty Items
│                           └─► Manual Tools
│
├── Resources ──────────────┬─► Guides
│                           ├─► Product Viewers
│                           └─► Forms
│
└── Administration ─────────┬─► Reports
                            ├─► Settings
                            └─► Developer Tools
```

### 3.2 Priority-Based Organization

#### Tier 1: Command Bar (Instant Access)
- Art Operations (3 portals)
- Already implemented ✅

#### Tier 2: Dashboard Widgets (One Click)
- Role-specific metrics
- Quick actions
- Status summaries

#### Tier 3: Sidebar Navigation (Two Clicks)
- Grouped by function
- Collapsible sections
- Search functionality

#### Tier 4: Hidden/Advanced (Three+ Clicks)
- Developer tools
- Rarely used calculators
- Administrative functions

---

## 4. Visual Design Improvements

### 4.1 Typography Hierarchy

```css
/* Current → Proposed */
Base font: 13px → 15px (0.9375rem)
Section titles: 11px → 13px (0.8125rem)
Headers: 14px → 18px (1.125rem)
Buttons: 14px → 15px (0.9375rem)
```

### 4.2 Color Coding System

```
Art Operations: WSU Crimson (#981e32)
Calculators: NWCA Green (#4cb354)
Vendor Portals: Blue (#2563eb)
Resources: Gray (#6b7280)
Administration: Purple (#7c3aed)
```

### 4.3 Spacing Standards

```css
/* Consistent spacing system */
--spacing-xs: 0.25rem;  /* 4px */
--spacing-sm: 0.5rem;   /* 8px */
--spacing-md: 1rem;     /* 16px */
--spacing-lg: 1.5rem;   /* 24px */
--spacing-xl: 2rem;     /* 32px */
```

### 4.4 Interactive States

```css
/* All interactive elements */
Default: Normal appearance
Hover: Subtle background change + cursor pointer
Active: Pressed state with slight scale
Focus: Visible outline for keyboard navigation
Disabled: 50% opacity + not-allowed cursor
```

---

## 5. Phased Implementation Plan

### Phase 1: Command Bar ✅ COMPLETE
**Timeline**: Complete
**Status**: Deployed

- Created sticky command bar below header
- 3 Art Operations buttons with white text on crimson
- Named: AE Portal, Art Coordinator Portal, Artist Portal

### Phase 2: Dashboard Content Reorganization - Operations First
**Timeline**: Week 1-2
**Priority**: HIGH

#### 2.1 New Layout Hierarchy - Daily Operations Focus

**Primary Zone (Always Visible - Top of Page)**

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION SCHEDULE                      │
├─────────────────────────────────────────────────────────────┤
│  Current Availability (as of Today)                         │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │
│  │   DTG    │Embroidery│   Caps   │ Screen   │ Transfers │ │
│  │  2 days  │  3 days  │  2 days  │  5 days  │  1 day    │ │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘ │
│  ⚠️ Rush Orders: Contact production for availability        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📢 ANNOUNCEMENTS                                     [−]    │
├─────────────────────────────────────────────────────────────┤
│ • Holiday Schedule: Closed Dec 25-26                        │
│ • New Screen Print pricing effective Jan 1                  │
│ • System maintenance tonight 10pm-midnight                  │
└─────────────────────────────────────────────────────────────┘
```

**Secondary Zone (Quick Actions - One Scroll Down)**

```
┌─────────────────────────────────────────────────────────────┐
│                      QUICK ACTIONS                          │
├───────────────┬────────────────┬────────────────────────────┤
│ [New Quote]   │ [Check Order]  │ [Submit Art Request]       │
│ [Calculator]  │ [View Invoice] │ [Production Status]        │
└───────────────┴────────────────┴────────────────────────────┘
```

**Tertiary Zone (Collapsible Metrics - Hidden by Default)**

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Sales Metrics                                    [+]     │
└─────────────────────────────────────────────────────────────┘
(Collapsed - Click to expand for revenue, orders, etc.)
```

#### 2.2 Smart Information Display

**Production Schedule Widget**
- **Large, clear display** with color coding:
  - Green: Available within normal timeframe
  - Yellow: Getting busy (3-5 days out)
  - Red: Backed up (5+ days)
- **Auto-updates** every hour from production team
- **Click for details** shows specific notes/exceptions

**Announcements Panel**
- **Smart filtering** by relevance:
  - Urgent/Today items always shown
  - General announcements collapsible
  - Expired items auto-hide
- **Dismiss functionality** per user
- **Priority indicators**: 🔴 Urgent, 🟡 Important, 🟢 FYI

**Sales Metrics (When Expanded)**
- Moved to **bottom third** of page
- **Opt-in viewing** - collapsed by default
- **Role-based visibility** - only show to those who need it
- Small, subdued styling to avoid "vanity metric syndrome"

#### 2.3 Role-Based Default Views

```javascript
// User preference system
const dashboardProfiles = {
  'operations': {
    showProduction: true,      // Always
    showAnnouncements: true,   // Always
    showSales: false,          // Hidden
    showArtMetrics: false      // Hidden
  },
  'sales': {
    showProduction: true,      // Always
    showAnnouncements: true,   // Always  
    showSales: true,           // Visible but not prominent
    showArtMetrics: false      // Hidden
  },
  'art': {
    showProduction: true,      // Always
    showAnnouncements: true,   // Always
    showSales: false,          // Hidden
    showArtMetrics: true       // Visible
  },
  'executive': {
    showProduction: true,      // Always
    showAnnouncements: true,   // Always
    showSales: true,           // Visible
    showArtMetrics: true       // Visible
  }
};
```

#### 2.4 Visual Hierarchy Improvements

**Size & Weight Strategy**
```css
/* Production Schedule - Largest, most prominent */
.production-schedule {
  font-size: 1.125rem;  /* 18px */
  font-weight: 600;
  border: 2px solid var(--primary-color);
  background: linear-gradient(to right, #f0fdf4, #ffffff);
}

/* Announcements - Clear but not overwhelming */
.announcements {
  font-size: 1rem;     /* 16px */
  font-weight: 400;
  border: 1px solid #e5e7eb;
  max-height: 200px;    /* Prevent taking over page */
  overflow-y: auto;
}

/* Sales Metrics - Subdued when visible */
.sales-metrics {
  font-size: 0.875rem;  /* 14px */
  opacity: 0.9;
  background: #f9fafb;  /* Subtle gray background */
}
```

#### 2.5 Implementation Approach

**Current Dashboard Restructuring**
```javascript
// Move existing elements to new priority zones
const dashboardRestructure = {
  // ZONE 1: Above the fold - Operational Priority
  productionSchedule: {
    currentLocation: 'buried in content',
    newLocation: 'top of main content',
    styling: 'prominent card with live data',
    updateFrequency: 'hourly from API'
  },
  
  announcements: {
    currentLocation: 'large static section',
    newLocation: 'collapsible panel below production',
    styling: 'compact list with priority indicators',
    features: ['dismiss per user', 'auto-expire old items']
  },
  
  // ZONE 2: Secondary - Quick Actions
  quickActions: {
    currentLocation: 'scattered in sidebar',
    newLocation: 'action bar below announcements',
    styling: 'button grid 3x2 layout',
    content: ['quotes', 'orders', 'art', 'calculators', 'invoices', 'status']
  },
  
  // ZONE 3: Tertiary - Metrics (De-emphasized)
  salesDashboard: {
    currentLocation: 'prominent top position',
    newLocation: 'collapsible section at bottom',
    defaultState: 'collapsed',
    styling: 'muted colors, smaller text'
  }
};
```

**HTML Structure Reorganization**
```html
<!-- New Dashboard Layout -->
<div class="dashboard-container">
  <!-- Zone 1: Operational Priority -->
  <section class="operations-zone">
    <div class="production-schedule-widget" id="productionSchedule">
      <!-- Live production data here -->
    </div>
    
    <div class="announcements-panel collapsible expanded" id="announcements">
      <header class="panel-header">
        <h3>📢 Announcements</h3>
        <button class="collapse-btn">−</button>
      </header>
      <div class="panel-content">
        <!-- Priority-sorted announcements -->
      </div>
    </div>
  </section>
  
  <!-- Zone 2: Quick Actions -->
  <section class="actions-zone">
    <div class="quick-actions-grid">
      <!-- 6 most-used actions -->
    </div>
  </section>
  
  <!-- Zone 3: Metrics (Hidden by default) -->
  <section class="metrics-zone">
    <div class="sales-dashboard collapsible collapsed" id="salesMetrics">
      <header class="panel-header">
        <h3>📊 Sales & Performance</h3>
        <button class="expand-btn">+</button>
      </header>
      <div class="panel-content hidden">
        <!-- Sales data when expanded -->
      </div>
    </div>
  </section>
</div>
```

### Phase 3: Sidebar Navigation Overhaul
**Timeline**: Week 2-3
**Priority**: HIGH

#### 3.1 Implement New Structure
- Consolidate 12 sections into 5
- Add expand/collapse functionality
- Increase font size to 15px
- Add search box at top

#### 3.2 Code Implementation
```javascript
// Collapsible sections
const sections = {
  'primary-tools': { expanded: true, icon: 'star' },
  'calculators': { expanded: false, icon: 'calculator' },
  'resources': { expanded: false, icon: 'book' },
  'admin': { expanded: false, icon: 'cog' }
};
```

### Phase 4: Role-Based Views
**Timeline**: Week 3-4
**Priority**: MEDIUM

#### 4.1 View Switcher
```html
<select id="viewMode">
  <option value="art">Art Operations</option>
  <option value="sales">Sales</option>
  <option value="operations">Operations</option>
  <option value="executive">Executive</option>
</select>
```

#### 4.2 Customized Dashboards
- **Art View**: Art metrics, queue, status
- **Sales View**: Revenue, quotes, calculators
- **Operations View**: Production, inventory, vendors
- **Executive View**: KPIs, trends, summaries

### Phase 5: Advanced Features
**Timeline**: Week 4+
**Priority**: LOW

#### 5.1 Enhancements
- Keyboard shortcuts (Alt+A for Art, Alt+C for Calculators)
- Customizable widget placement
- Dark mode support
- Export/print capabilities
- Mobile app consideration

---

## 6. Technical Specifications

### 6.1 CSS Architecture

```css
/* BEM Methodology */
.dashboard {}
.dashboard__sidebar {}
.dashboard__sidebar--collapsed {}
.dashboard__content {}
.dashboard__widget {}
.dashboard__widget--art {}
```

### 6.2 JavaScript Enhancements

```javascript
// Module pattern for organization
const DashboardManager = {
  init() {
    this.bindEvents();
    this.loadUserPreferences();
    this.initializeWidgets();
  },
  
  bindEvents() {
    // Event delegation for performance
    document.querySelector('.dashboard')
      .addEventListener('click', this.handleClick.bind(this));
  },
  
  loadUserPreferences() {
    // Load from localStorage
    const prefs = localStorage.getItem('dashboardPrefs');
    if (prefs) this.applyPreferences(JSON.parse(prefs));
  }
};
```

### 6.3 Performance Optimizations

- Lazy load widgets below the fold
- Debounce search input
- Cache frequently accessed data
- Use CSS containment for layout stability
- Implement virtual scrolling for long lists

### 6.4 Accessibility Requirements

- WCAG 2.1 AA compliance
- Keyboard navigation for all features
- ARIA labels for screen readers
- High contrast mode support
- Focus indicators on all interactive elements

---

## 7. Mockups and Wireframes

### 7.1 Desktop Layout (1920x1080)

```
┌──────────────────────────────────────────────────────────────┐
│                         HEADER (60px)                         │
├──────────────────────────────────────────────────────────────┤
│          COMMAND BAR - Art Operations (50px)                  │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                  │
│            │              QUICK ACTIONS                       │
│            │   [Create] [View] [Status] [Quote]              │
│  SIDEBAR   │                                                  │
│   (240px)  ├─────────────────────────────────────────────────┤
│            │                                                  │
│  ┌──────┐  │  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │Search│  │  │ Widget 1│  │ Widget 2│  │ Widget 3│        │
│  └──────┘  │  └─────────┘  └─────────┘  └─────────┘        │
│            │                                                  │
│  Primary   │  ┌──────────────────────────────────┐          │
│  > Art     │  │                                  │          │
│  > Calc    │  │      Main Content Area          │          │
│  > Vendor  │  │                                  │          │
│            │  └──────────────────────────────────┘          │
│  Secondary │                                                  │
│  > More    │                                                  │
│            │                                                  │
└────────────┴─────────────────────────────────────────────────┘
```

### 7.2 Mobile Layout (375x812)

```
┌─────────────────┐
│     HEADER      │
├─────────────────┤
│   COMMAND BAR   │
│ [AE] [AC] [Art] │
├─────────────────┤
│   ☰ Menu        │
├─────────────────┤
│                 │
│    Widget 1     │
│                 │
├─────────────────┤
│                 │
│    Widget 2     │
│                 │
├─────────────────┤
│                 │
│  Quick Actions  │
│                 │
└─────────────────┘
```

---

## 8. Success Metrics

### 8.1 Quantitative Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Clicks to Art Hub | 3-4 | 1 | User tracking |
| Page load time | 2.5s | <1s | Performance API |
| Mobile usability | 60% | 95% | Lighthouse score |
| Task completion | 70% | 95% | User testing |

### 8.2 Qualitative Metrics

- User satisfaction surveys (quarterly)
- Task completion ease ratings
- Feature adoption rates
- Support ticket reduction
- Employee feedback sessions

### 8.3 Key Performance Indicators

1. **Time to First Action**: Reduce from 5s to 2s
2. **Daily Active Users**: Increase engagement 30%
3. **Feature Discovery**: 80% find new tools within first week
4. **Error Rate**: Reduce misclicks by 50%
5. **Mobile Usage**: Increase from 10% to 25%

---

## 9. Risk Mitigation

### 9.1 Potential Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| User resistance to change | High | Medium | Gradual rollout, training |
| Technical debt | Medium | High | Refactor incrementally |
| Performance degradation | High | Low | Optimize before launch |
| Mobile compatibility | Medium | Medium | Test on all devices |

### 9.2 Rollback Plan

- Keep old dashboard accessible at `/legacy-dashboard`
- Feature flags for gradual rollout
- A/B testing for major changes
- User preference to switch back

---

## 10. Next Steps

### Immediate Actions (This Week)
1. ✅ Deploy command bar (COMPLETE)
2. Gather user feedback on command bar
3. Begin Phase 2 dashboard widgets
4. Create detailed mockups for review

### Short Term (Next 2 Weeks)
1. Implement role-specific widgets
2. Redesign sidebar navigation
3. Deploy Phase 2 & 3
4. User testing sessions

### Long Term (Next Month)
1. Role-based views
2. Advanced features
3. Mobile optimization
4. Performance monitoring

---

## Appendix A: Technical Debt Items

- Remove jQuery dependencies
- Consolidate duplicate CSS
- Optimize image loading
- Implement proper error handling
- Add unit tests for critical functions
- Document API endpoints
- Standardize naming conventions

## Appendix B: Accessibility Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Proper heading hierarchy (h1 → h6)
- [ ] Alt text for all images
- [ ] ARIA labels for icon-only buttons
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Focus indicators visible
- [ ] Screen reader testing complete
- [ ] Reduced motion support

## Appendix C: Browser Support Matrix

| Browser | Version | Support Level |
|---------|---------|---------------|
| Chrome | 90+ | Full |
| Firefox | 88+ | Full |
| Safari | 14+ | Full |
| Edge | 90+ | Full |
| Mobile Safari | 14+ | Full |
| Chrome Mobile | 90+ | Full |

---

*Document Version: 1.0*  
*Last Updated: 2025*  
*Author: NWCA Development Team*