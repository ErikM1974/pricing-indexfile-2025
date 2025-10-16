# Step 2 Modern Design - Quick Testing Guide

**For:** Nika & Taneisha
**Purpose:** Test the new "2025" design for Step 2 (Add Products) in quote builders
**Date:** October 15, 2025
**Testing Time:** ~10-15 minutes per builder

---

## 🎯 What We're Testing

The **Step 2 (Add Products)** section of both Embroidery and Cap Embroidery quote builders has been redesigned with a modern, clean interface. We need your feedback to ensure it works perfectly!

---

## 📝 Testing Checklist

### Embroidery Quote Builder
**URL:** `https://teamnwca.com/quote-builders/embroidery-quote-builder.html`

#### Visual Design (Just Look & Feel)
- [ ] **Hero Search Card** - Does the search area look professional and modern?
- [ ] **Icons** - Can you see the search icon (magnifying glass) and other icons?
- [ ] **Spacing** - Does everything have good "breathing room" or feel cramped?
- [ ] **Colors** - Do the green accents match our NWCA branding?

#### Search Functionality
- [ ] **Style Search** - Type a style number (try "PC54")
  - Does the input field work smoothly?
  - Can you see the blinking cursor?
  - Does the "Load Product" button enable when you type?

#### Color Swatches (Progressive Disclosure)
- [ ] **Before Loading** - Swatches should be **hidden** initially
- [ ] **After Loading** - Click "Load Product"
  - Do color swatches appear smoothly?
  - Are swatches displayed in a nice grid (not stretched)?
  - Can you hover over swatches to see names?
  - Does clicking a swatch show a checkmark?

#### Empty State (When No Products Added)
- [ ] **First Load** - Should show a friendly empty state with:
  - Package icon with floating animation
  - "No Products Yet" message
  - "Start Searching" button
- [ ] **Button Click** - Does clicking "Start Searching" focus the search input?

#### Product Cards
- [ ] **Add First Product** - After selecting style and color
  - Does empty state disappear?
  - Does product card display properly?
  - Can you see product details (style, color, quantity)?
  - Does the remove button (X) work?

#### Mobile Testing (Optional but Helpful)
- [ ] **Phone View** - Open on your phone
  - Does it look good on small screens?
  - Can you tap swatches easily?
  - Are buttons large enough to tap?

---

### Cap Embroidery Quote Builder
**URL:** `https://teamnwca.com/quote-builders/cap-embroidery-quote-builder.html`

#### Same Tests as Above, But Look For:
- [ ] Cap-specific icon (baseball cap) instead of t-shirt
- [ ] Cap-specific placeholder text ("e.g., C112, C828")
- [ ] "Load Cap" button text instead of "Load Product"
- [ ] Everything else should match embroidery builder design

---

## 🐛 What to Report

### Good Bug Report Example:
> "PC54 shows swatches, but when I click a swatch, no checkmark appears. Using Chrome on Windows."

### Include These Details:
1. **What you were doing** - "Searching for style PC54"
2. **What happened** - "Color swatches are stretched full width"
3. **What you expected** - "Swatches should be in a grid"
4. **Your browser** - "Chrome, Firefox, Edge, Safari"
5. **Screenshot** - Super helpful! (Slack it to Erik)

---

## 🎨 Design Goals (What Good Looks Like)

### The Modern Look Should Have:
- ✅ **Clean white cards** with subtle shadows
- ✅ **Plenty of white space** between elements
- ✅ **Smooth animations** when swatches appear
- ✅ **Rounded corners** on cards and buttons
- ✅ **NWCA green** accents (#3a7c52)
- ✅ **Professional icons** (Font Awesome)

### Progressive Disclosure Means:
- Swatches are **hidden** until you load a product
- Empty state shows **only when you have no products**
- UI adapts to what you're doing (shows/hides smartly)

---

## ⏱️ Quick Test Scenarios

### Scenario 1: Happy Path (2 minutes)
1. Open embroidery builder
2. Search for "PC54"
3. Click "Load Product"
4. See swatches appear
5. Click a color swatch
6. See checkmark appear
7. Enter some quantities
8. Click "Add to Quote"
9. See product card appear, empty state disappears

### Scenario 2: Multiple Products (3 minutes)
1. Add first product (PC54)
2. Search for second product (C112)
3. Load and add second product
4. Verify both product cards show
5. Remove first product
6. Verify second product remains
7. Remove last product
8. Verify empty state returns

### Scenario 3: Mobile Quick Check (2 minutes)
1. Open on phone
2. Check that search input is usable
3. Check that swatches are tappable
4. Check that buttons are large enough

---

## 📱 How to Report Issues

**Slack Erik** with:
```
🐛 Step 2 Design Issue
━━━━━━━━━━━━━━━━━
Builder: Embroidery / Cap
Issue: [describe what's wrong]
Expected: [what should happen]
Browser: Chrome / Firefox / Edge
Screenshot: [attach if possible]
```

**Example:**
```
🐛 Step 2 Design Issue
━━━━━━━━━━━━━━━━━
Builder: Embroidery
Issue: Color swatches not appearing after loading PC54
Expected: Should see grid of color swatches below search
Browser: Chrome
Screenshot: [attached]
```

---

## ✅ What We Already Know Works

These features were tested during development:
- API connections
- Pricing calculations
- Database saves
- Email functionality
- Print/PDF generation

**We're ONLY testing the visual design and user experience of Step 2!**

---

## 🎉 Thank You!

Your feedback is critical to making these tools perfect. The new design aims to:
- Make the interface more intuitive
- Reduce visual clutter
- Match modern design standards
- Improve mobile experience

**Questions?** Slack Erik anytime!

---

**Remember:** There are no stupid questions or "small" issues. If something feels off, report it! 🙏
