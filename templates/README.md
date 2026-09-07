# NWCA Calculator Template System

This directory contains reusable templates for creating new pricing calculators quickly and consistently.

## 🚀 Quick Start

**Time needed: 30-60 minutes per calculator**

1. Start with `NEW_CALCULATOR_CHECKLIST.md` - Your step-by-step guide
2. Review `TEMPLATE_USAGE_EXAMPLE.md` - See a complete example
3. Use the templates to build your calculator

## 📁 Template Files

### Page template (any new page — 2026-09-07)
- **`page-template.html`** - Copy this for ANY new staff or public page: tokens.css first (the `@layer`
  order), then the shared components/utilities, then ONE page stylesheet and ONE page script. It is already
  Rule-3 clean, versioned, landmarked and labelled, so a copy passes `tests/unit/repo-hygiene-final.test.js`
  on day one; `tests/unit/css-tokens.test.js` keeps the template itself that way. Write page CSS with
  `var(--…)` tokens — `npm run lint:css` rejects raw hex (`memory/CSS_STANDARDIZATION_PLAN_2026-09.md`).

### Core Templates
- **`calculator-template.html`** - Main calculator page with UI and logic structure
- **`quote-service-template.js`** - Database integration service
- **`email-template.html`** - EmailJS template structure

### Configuration & Documentation
- **`calculator-config-template.json`** - All configuration values in one place
- **`NEW_CALCULATOR_CHECKLIST.md`** - Step-by-step implementation guide
- **`TEMPLATE_USAGE_EXAMPLE.md`** - Complete example implementation

## 🎯 Benefits

1. **Consistency** - All calculators follow the same patterns
2. **Speed** - 30-60 minute implementation vs hours
3. **Quality** - Proven patterns reduce bugs
4. **Maintainability** - Updates to templates benefit all calculators

## 🏗️ Architecture

```
New Calculator
├── HTML Page (from calculator-template.html)
│   ├── Standard Header/Navigation
│   ├── Calculator Form
│   ├── Results Display
│   └── Quote Modal
├── Quote Service (from quote-service-template.js)
│   ├── Quote ID Generation
│   ├── Database Save
│   └── Retrieval Methods
└── EmailJS Integration
    ├── Template (from email-template.html)
    └── Variable Mapping
```

## 🔧 Common Patterns

### Quote ID Format
```
{PREFIX}{MMDD}-{sequence}
Examples: DTG0126-1, RICH0126-2, SP0126-3
```

### Standard Pricing Formula
```javascript
const margin = 0.6;
const markedUpPrice = basePrice / margin;
```

### LTM (Less Than Minimum)
```javascript
if (quantity < 24) {
    ltmFee = 50.00;
    ltmPerUnit = ltmFee / quantity;
}
```

## 📋 Calculator Types Implemented

1. **DTG Contract** (DTG prefix) - Single item, multiple locations
2. **Richardson Caps** (RICH prefix) - Multiple items, tiered pricing

## 🚦 Getting Started

1. **Identify your calculator type**:
   - Single item (like DTG) or Multi-item (like Richardson)?
   - Simple pricing or complex tiers?
   - Special features needed?

2. **Gather requirements**:
   - Pricing logic
   - Form fields needed
   - Email template design
   - Dashboard placement

3. **Follow the checklist**:
   - Use `NEW_CALCULATOR_CHECKLIST.md`
   - Check off each step
   - Test thoroughly

## 💡 Tips

- Always test on both desktop and mobile
- Check email rendering in multiple clients
- Verify database saves in console
- Use descriptive quote prefixes (3-4 letters max)
- Document any special logic in CLAUDE.md

## 🆘 Need Help?

1. Check existing calculators for examples
2. Review console logs for debugging
3. Test database saves separately
4. Verify EmailJS template variables match

---

*Created: January 2025*  
*Last Updated: January 27, 2025*