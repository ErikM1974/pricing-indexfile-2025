# Image Loading Troubleshooting Guide

**Last Updated:** 2025-11-04
**Purpose:** Diagnose and resolve product image loading issues
**Status:** Active troubleshooting guide

---

## 🚨 Quick Diagnosis: Is It Sanmar's CDN?

### Test #1: Direct CDN Check

Try loading this URL in your browser:
```
https://cdnm.sanmar.com/imglib/mresjpg/2022/f5/CT104616_navy_model_front.jpg
```

**Results:**
- ✅ **Image loads in <1 second** → Sanmar CDN is working fine
- ❌ **No image or 20+ seconds** → **Sanmar CDN is DOWN** (root cause confirmed)
- ⚠️ **Loads but slow (3-10 seconds)** → Sanmar CDN degraded

**Alternative Test URL:**
```
https://cdnm.sanmar.com/sanmar-resources/imglib/2400x3000/S/PC54_Black_Model_Front_072017.jpg
```

### Test #2: Network Tab Verification

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Filter: "Img"
4. Reload page
5. Click any `cdnm.sanmar.com` request
6. Check "Timing" tab:
   - **TTFB (Waiting) > 20 seconds** → **Sanmar CDN slow**
   - **Our API < 2 seconds** → Our code is fine ✅

---

## 🎯 Root Cause: Sanmar's Image Hosting

### Architecture Overview

All product images are hosted on Sanmar's CDN:
- **Domain:** `cdnm.sanmar.com`
- **Paths:** `/imglib/...` or `/sanmar-resources/imglib/...`
- **NOT on our servers** (Heroku/Caspio)
- **NOT proxied** through our API

### Data Flow

```
User visits page
  ↓
Our API responds (1 second) ✅
Returns JSON with image URLs: https://cdnm.sanmar.com/...
  ↓
Browser requests image from Sanmar CDN
  ↓
IF SANMAR DOWN: Browser waits 20-30 seconds → timeout ❌
IF SANMAR UP: Image loads <1 second ✅
```

### Where Images Come From

**Product images are stored in Caspio database but hosted on Sanmar:**

| Database Table | Field | URL Pattern | Host |
|----------------|-------|-------------|------|
| Sanmar_Bulk_251816_Feb2024 | PRODUCT_IMAGE | https://www.sanmar.com/... | Sanmar CDN |
| Sanmar_Bulk_251816_Feb2024 | COLOR_PRODUCT_IMAGE | https://cdnm.sanmar.com/... | Sanmar CDN |
| Sanmar_Bulk_251816_Feb2024 | FRONT_MODEL | https://www.sanmar.com/... | Sanmar CDN |
| Sanmar_Bulk_251816_Feb2024 | THUMBNAIL_IMAGE | https://c3eku948.caspio.com/... | Caspio (backup) |

**Key Point:** Our database stores the URLs, but Sanmar hosts the actual images.

---

## ❌ What We CANNOT Control

When Sanmar's CDN is down, we cannot:
- ❌ Make Sanmar's servers faster
- ❌ Proxy images through our server (would just move the timeout to Heroku)
- ❌ Cache external images in browser (they're not on our domain)
- ❌ Control Sanmar's uptime or performance

**Bottom Line:** If Sanmar's CDN is down, we must wait for them to fix it.

---

## ✅ What We CAN Control

### Our API Performance
- ✅ Optimized to respond in ~1 second
- ✅ Returns image URLs quickly
- ✅ Not the bottleneck (verified with Network tab)

### User Experience During Outages
- Show loading placeholders
- Detect timeouts and show helpful messages
- Implement fallback images (see Long-Term Solutions below)

---

## 🛠️ Temporary Workarounds

### Option 1: Use Caspio-Stored Thumbnails

Some products have backup images in Caspio:
- **Field:** `THUMBNAIL_IMAGE`
- **Hosted:** `c3eku948.caspio.com`
- **Quality:** Lower resolution but loads faster during Sanmar outages

```javascript
// Fallback to Caspio thumbnail if Sanmar times out
const imageUrl = product.COLOR_PRODUCT_IMAGE ||  // Try Sanmar first
                 product.PRODUCT_IMAGE ||        // Try alternate Sanmar
                 product.THUMBNAIL_IMAGE;        // Fallback to Caspio
```

### Option 2: Show Placeholder Images

Display brand logo or generic product placeholder:

```javascript
img.onerror = function() {
  this.src = '/images/placeholder-product.png';
  this.alt = 'Product image temporarily unavailable';
};
```

### Option 3: Add Timeout Detection

```javascript
// Detect slow loading and show message
const imgTimeout = setTimeout(() => {
  if (!img.complete) {
    showBanner('Images loading slowly due to supplier CDN issues. Please be patient.');
  }
}, 5000); // 5 second timeout

img.onload = () => clearTimeout(imgTimeout);
```

### Option 4: Hard Refresh

Tell users to try:
- **Chrome/Firefox:** Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)
- **Safari:** Cmd + Option + R
- This clears cached timeout responses

---

## 📊 Historical Incidents

### November 4, 2025
- **Duration:** ~2-3 hours (estimated)
- **Symptoms:** All Sanmar images not loading or 20-30 second load times
- **Test URL:** Confirmed down (no response)
- **Impact:** All pages with product images affected (index, catalog, top sellers)
- **Root Cause:** Sanmar CDN (cdnm.sanmar.com) outage
- **Resolution:** Sanmar recovered on their own (no action needed from us)
- **Lessons Learned:** Documented troubleshooting process, added test URLs

---

## 🔮 Long-Term Solutions

### Solution 1: Image Mirroring (Most Effective)

**Concept:** Mirror top 100-500 product images to our own CDN

**Implementation:**
1. Create image mirror in Caspio files or AWS S3
2. Daily/weekly sync of popular product images
3. Fallback to mirror when Sanmar times out

**Benefits:**
- ✅ Fast loading even during Sanmar outages
- ✅ Full control over uptime
- ✅ Can optimize/compress images ourselves

**Drawbacks:**
- ❌ Storage costs
- ❌ Sync maintenance required
- ❌ Images may be outdated if Sanmar updates

### Solution 2: Multi-CDN Strategy

**Concept:** Maintain image URLs from multiple sources

```javascript
const imageSources = {
  primary: product.COLOR_PRODUCT_IMAGE,   // Sanmar CDN
  backup: product.THUMBNAIL_IMAGE,        // Caspio files
  fallback: getBrandPlaceholder(brand)    // Generic placeholder
};
```

### Solution 3: Smart Image Loading with Timeout

```javascript
async function loadImageWithFallback(primaryUrl, fallbackUrl, timeout = 5000) {
  try {
    const img = new Image();
    img.src = primaryUrl;

    // Race between load and timeout
    await Promise.race([
      new Promise((resolve) => { img.onload = resolve; }),
      new Promise((_, reject) =>
        setTimeout(() => reject('timeout'), timeout)
      )
    ]);

    return img;
  } catch (error) {
    console.warn(`Primary image timed out, using fallback: ${error}`);
    // Use fallback if Sanmar times out
    img.src = fallbackUrl;
    return img;
  }
}

// Usage
const img = await loadImageWithFallback(
  'https://cdnm.sanmar.com/...',  // Sanmar (primary)
  'https://c3eku948.caspio.com/...'  // Caspio (fallback)
);
```

### Solution 4: Lazy Loading with Intersection Observer

```javascript
// Only load images when they're about to enter viewport
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    }
  });
}, { rootMargin: '50px' }); // Start loading 50px before visible

document.querySelectorAll('img[data-src]').forEach(img => {
  observer.observe(img);
});
```

---

## 📞 When to Escalate

### Do NOT escalate if:
- ✅ Sanmar test URL is down
- ✅ Our API responds in <2 seconds
- ✅ Other external sites also slow (www.sanmar.com loads slowly)
- ✅ Network tab shows TTFB > 20 seconds for cdnm.sanmar.com

**This is a Sanmar issue. Wait for them to recover.**

### DO escalate if:
- ❌ Sanmar test URL works fine (<1 second)
- ❌ Our API is slow (>5 seconds)
- ❌ Only our site is affected (other image-heavy sites load fine)
- ❌ Images from other CDNs (Caspio, AWS) are also slow

**This might be our code, Heroku, or network issue.**

---

## 🧪 Testing Checklist

Before reporting "images not loading" issue:

- [ ] **Test Sanmar URL:** https://cdnm.sanmar.com/imglib/mresjpg/2022/f5/CT104616_navy_model_front.jpg
- [ ] **Check Network tab** for TTFB times on cdnm.sanmar.com requests
- [ ] **Verify our API response time** (<2 seconds expected)
- [ ] **Test other image-heavy sites** (amazon.com, sanmar.com, etc.)
- [ ] **Clear browser cache** and retry (Ctrl+Shift+R)
- [ ] **Test from different network** (mobile vs wifi, VPN on/off)
- [ ] **Check if www.sanmar.com loads slowly** (confirms their infrastructure issue)

---

## 🔧 Diagnostic Commands

### Browser Console

```javascript
// Test image loading speed
console.time('Sanmar Image Load');
const img = new Image();
img.onload = () => console.timeEnd('Sanmar Image Load');
img.onerror = () => console.log('Image failed to load');
img.src = 'https://cdnm.sanmar.com/imglib/mresjpg/2022/f5/CT104616_navy_model_front.jpg';

// Check if images are cached
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('cdnm.sanmar.com'))
  .forEach(r => console.log(r.name, r.duration + 'ms'));
```

### Network Tab Filters

```
Filter: cdnm.sanmar.com
Sort by: Duration (descending)
Look for: TTFB (Time To First Byte) > 5000ms
```

---

## 💬 Customer Communication Template

**If customers report slow images:**

> "We're aware product images are loading slowly today. This is due to our supplier's image hosting service (Sanmar) experiencing technical issues. Our development team has verified that our website and API are functioning normally with <1 second response times.
>
> Our team has deployed major performance improvements (89% faster API) that will make the site significantly faster once the supplier's service recovers. The issue is on the supplier's end and will resolve when their service recovers.
>
> Thank you for your patience!"

---

## 📚 Related Documentation

- **[CLAUDE.md](../CLAUDE.md)** - Main development guide (Common Issues & Fixes section)
- **[CLAUDE_PATTERNS.md](CLAUDE_PATTERNS.md)** - Code patterns and common solutions
- **[CASPIO_API_CORE.md](CASPIO_API_CORE.md)** - API architecture and endpoints
- **Product images source:** Sanmar_Bulk_251816_Feb2024 table in Caspio database

---

## 🎓 Key Takeaways

1. **Images are hosted externally** - We store URLs in our database, but Sanmar hosts the files
2. **Test URL is diagnostic tool** - Quick way to confirm Sanmar CDN status
3. **We cannot fix Sanmar's infrastructure** - Must wait for them to recover
4. **Our API is fast** - Performance improvements deployed (v170, 89% faster)
5. **Long-term solutions exist** - Image mirroring, fallbacks, smart loading

---

**Next Review:** After next Sanmar incident or within 30 days
**Status:** Active troubleshooting guide
**Maintainer:** Development team
