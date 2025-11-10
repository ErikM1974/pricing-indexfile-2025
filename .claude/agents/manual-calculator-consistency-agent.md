# Manual Calculator Header & CSS Consistency Agent

## Purpose
This agent ensures all manual pricing calculators on the staff dashboard maintain consistent branding, headers, and CSS styling that matches NWCA standards.

## Agent Configuration
```yaml
name: manual-calculator-consistency
type: audit
scope: /calculators/*-manual-pricing.html
frequency: on-change
```

## NWCA Brand Standards

### Required Color Palette
```css
:root {
    --primary-color: #3a7c52;     /* NWCA Green */
    --primary-dark: #2d5f3f;      /* Dark Green */
    --primary-light: #4cb861;     /* Light Green */
    --primary-lighter: #e8f5e9;   /* Very Light Green */
}
```

### Required Font
- **Primary Font**: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- **Font Import**: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`

### Required Icons
- **Font Awesome**: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css`
- **Favicon**: `https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1`

## Required CSS Loading Order

All manual pricing calculators MUST load CSS files in this exact order:

```html
<head>
    <!-- 1. FONTS - Load first -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <!-- 2. ICONS -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">

    <!-- 3. UNIVERSAL PRICING CSS (Foundation layer) -->
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-layout.css">
    <link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-components.css">

    <!-- 4. SHARED COMPONENTS CSS -->
    <link rel="stylesheet" href="/shared_components/css/shared-pricing-styles.css">
    <link rel="stylesheet" href="/shared_components/css/modern-enhancements.css">
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">

    <!-- 5. FORCE GREEN THEME (Critical for brand consistency) -->
    <link rel="stylesheet" href="/shared_components/css/force-green-theme.css">

    <!-- 6. MANUAL CALCULATOR SHARED STYLES -->
    <link rel="stylesheet" href="manual-calculator-styles.css">

    <!-- 7. Calculator-specific styles (if needed) -->
    <style>
        /* Custom styles for this specific calculator */
    </style>
</head>
```

## Required Meta Tags

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>[Calculator Name] Manual Pricing Calculator - Northwest Custom Apparel</title>
<link rel="icon" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1" type="image/png">
```

## Required Header Structure

All manual calculators must include:

```html
<!-- Standard header with logo and breadcrumb -->
<div class="header">
    <div class="header-container">
        <div class="header-left">
            <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png"
                 alt="Northwest Custom Apparel"
                 class="logo">
            <div class="breadcrumb">
                <a href="/dashboards/staff-dashboard.html">Staff Tools</a>
                <span class="breadcrumb-separator">›</span>
                <span>[Calculator Name]</span>
            </div>
        </div>
    </div>
</div>
```

## Audit Checklist

When auditing a manual pricing calculator, verify:

### ✅ File Structure
- [ ] File is in `/calculators/` directory
- [ ] Filename follows pattern: `*-manual-pricing.html`
- [ ] No duplicate or backup versions in root

### ✅ Head Section
- [ ] Has all required meta tags
- [ ] Correct favicon URL
- [ ] Inter font loaded from Google Fonts
- [ ] Font Awesome 6.0+ loaded
- [ ] CSS files loaded in correct order
- [ ] `force-green-theme.css` included
- [ ] `manual-calculator-styles.css` included

### ✅ Color Theme
- [ ] Uses `--primary-color: #3a7c52` (NWCA Green)
- [ ] No conflicting color schemes (orange, blue, etc.)
- [ ] Inline styles don't override green theme
- [ ] Buttons use primary green color

### ✅ Header Structure
- [ ] Has `.header` container
- [ ] Includes NWCA logo
- [ ] Has breadcrumb navigation back to Staff Tools
- [ ] Logo links to dashboard or home

### ✅ Typography
- [ ] Body text uses Inter font
- [ ] Headings use Inter font
- [ ] Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### ✅ Layout
- [ ] Uses consistent card-based design
- [ ] Responsive on mobile (tested at 375px width)
- [ ] Proper spacing and padding
- [ ] Follows `.header-container` max-width pattern

## Common Issues & Fixes

### Issue: Orange theme appearing
**Cause**: `force-green-theme.css` not loaded or loaded too early
**Fix**: Ensure `force-green-theme.css` is loaded AFTER universal pricing CSS but BEFORE custom styles

### Issue: Wrong logo or missing logo
**Cause**: Incorrect CDN URL or missing logo element
**Fix**: Use `https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png`

### Issue: Inconsistent header height
**Cause**: Missing or conflicting header styles
**Fix**: Ensure `manual-calculator-styles.css` is loaded and not overridden

### Issue: Font not loading
**Cause**: Google Fonts link missing or blocked
**Fix**: Add Inter font link as first stylesheet in `<head>`

### Issue: Breadcrumb not working
**Cause**: Missing breadcrumb structure or broken links
**Fix**: Use standard breadcrumb HTML structure with link to `/dashboards/staff-dashboard.html`

## Agent Actions

When inconsistencies are found, the agent should:

1. **Log Issues**: Create detailed report of violations
2. **Suggest Fixes**: Provide exact code snippets to fix issues
3. **Prioritize**: Critical (breaks branding) vs Minor (cosmetic)
4. **Batch Updates**: Group similar fixes across multiple files

## Example Audit Report

```
MANUAL CALCULATOR AUDIT REPORT
Generated: 2025-10-04
Files Checked: 8

CRITICAL ISSUES:
- dtg-manual-pricing.html: Missing force-green-theme.css
- laser-manual-pricing.html: Using orange color scheme instead of green

MODERATE ISSUES:
- sticker-manual-pricing.html: Wrong CSS loading order
- embroidery-manual-pricing.html: Missing breadcrumb navigation

MINOR ISSUES:
- cap-embroidery-manual.html: Outdated Font Awesome version (5.x)

RECOMMENDATIONS:
1. Add force-green-theme.css to dtg-manual-pricing.html
2. Remove orange overrides from laser-manual-pricing.html
3. Reorder CSS in sticker-manual-pricing.html
4. Add standard breadcrumb to embroidery-manual-pricing.html
5. Update Font Awesome to 6.0+ in cap-embroidery-manual.html
```

## Automated Fixes Template

```javascript
// Example: Fix CSS loading order
const correctCSSOrder = [
    '/shared_components/css/universal-pricing-header.css',
    '/shared_components/css/universal-pricing-layout.css',
    '/shared_components/css/universal-calculator-theme.css',
    '/shared_components/css/universal-pricing-components.css',
    '/shared_components/css/force-green-theme.css',
    'manual-calculator-styles.css'
];

// Example: Ensure green theme
const ensureGreenTheme = `
:root {
    --primary-color: #3a7c52 !important;
    --primary: #3a7c52 !important;
    --primary-dark: #2d5f3f !important;
}
`;
```

## Testing After Updates

After applying fixes, verify:

1. **Visual Check**: Open calculator in browser
2. **Color Verification**: All buttons/headers use NWCA Green (#3a7c52)
3. **Font Check**: Text displays in Inter font
4. **Breadcrumb Test**: Click breadcrumb, returns to staff dashboard
5. **Mobile Test**: Responsive at 375px width
6. **Console Check**: No CSS loading errors

## Integration with Claude Code

When invoked by Claude Code, this agent should:

1. Scan all files matching `/calculators/*-manual-pricing.html`
2. Check each file against the audit checklist
3. Generate detailed report with specific line numbers
4. Provide copy-paste ready fixes
5. Optionally apply fixes automatically with user approval

## Usage Example

```bash
# Invoke the agent
claude agent:run manual-calculator-consistency

# Output:
Scanning 8 manual pricing calculators...
✓ dtg-manual-pricing.html - PASSED
✓ screenprint-manual-pricing.html - PASSED
✗ laser-manual-pricing.html - 2 CRITICAL ISSUES
✗ sticker-manual-pricing.html - 1 MODERATE ISSUE

Apply fixes automatically? (y/n)
```

## Maintenance Schedule

- **On File Save**: Check modified file only
- **Daily**: Full audit of all manual calculators
- **Before Deploy**: Complete audit + visual testing
- **Monthly**: Review and update brand standards

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main coding standards
- [CLAUDE_PATTERNS.md](../memory/CLAUDE_PATTERNS.md) - Code patterns
- [manual-calculator-styles.css](../calculators/manual-calculator-styles.css) - Shared styles
- [Staff Dashboard](../dashboards/staff-dashboard.html) - Main navigation hub
