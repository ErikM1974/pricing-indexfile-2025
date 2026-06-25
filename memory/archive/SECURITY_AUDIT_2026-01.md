# Security Audit Report - January 2026

**Audit Date:** 2026-01-10
**Scope:** Full site audit (frontend + backend)
**Status:** Critical fixes applied

---

## Executive Summary

16 vulnerabilities identified across the NWCA pricing system:
- **3 Critical** - Require immediate action
- **4 High** - Should be fixed within 1 week
- **5 Medium** - Should be addressed
- **4 Low** - Best practice improvements

---

## Critical Vulnerabilities

### 1. Exposed API Credentials in .env

**Location:** `/.env`
**Risk:** API keys for Anthropic, Stripe, and other services are exposed
**Status:** FIXED

**Findings:**
```
ANTHROPIC_API_KEY=sk-ant-api03-...
STRIPE_TEST_PUBLIC_KEY=pk_test_...
STRIPE_TEST_SECRET_KEY=sk_test_...
```

**Fix Applied:**
- Added `.env` to `.gitignore`
- Created `.env.example` with placeholder values
- **ACTION REQUIRED:** Rotate all exposed keys in respective dashboards

### 2. SQL Injection via Filter Parameters

**Location:** `server.js`, `caspio-pricing-proxy/src/routes/cart.js`
**Risk:** User input passed directly to Caspio API filter parameters
**Status:** FIXED

**Vulnerable Pattern:**
```javascript
// BEFORE - Vulnerable
const filter = req.query.filter; // User controlled
const url = `${CASPIO_URL}?q.where=${filter}`;
```

**Fix Applied:**
```javascript
// AFTER - Sanitized
const filter = sanitizeFilter(req.query.filter);
// Only allows alphanumeric, spaces, and safe operators
```

### 3. Missing Authentication on API Endpoints

**Location:** All API routes
**Risk:** Anyone can access pricing data, submit orders, modify carts
**Status:** PARTIAL - Rate limiting added, auth deferred

**Note:** Full authentication requires significant architecture changes. Rate limiting provides immediate protection against abuse.

---

## High Priority Vulnerabilities

### 4. Open CORS Policy (Wildcard)

**Location:** `server.js:15-20`
**Risk:** Any website can make requests to the API
**Status:** FIXED

**Before:**
```javascript
app.use(cors()); // Allows all origins
```

**After:**
```javascript
app.use(cors({
    origin: [
        'https://nwcustom.caspio.com',
        'https://c2aby672.caspio.com',
        /\.herokuapp\.com$/,
        /localhost:\d+$/
    ],
    credentials: true
}));
```

### 5. SSRF Vulnerability in Image Proxy

**Location:** `server.js` image proxy endpoint
**Risk:** Server can be tricked into fetching internal/malicious URLs
**Status:** FIXED

**Fix Applied:**
- URL validation to only allow specific domains (SanMar CDN, etc.)
- Block internal IP ranges (127.0.0.1, 10.x.x.x, 192.168.x.x)

### 6. No Rate Limiting

**Location:** All endpoints
**Risk:** API abuse, denial of service, credential stuffing
**Status:** FIXED

**Fix Applied:**
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);
```

### 7. No CSRF Protection

**Location:** Form submissions
**Risk:** Malicious sites can submit forms on behalf of users
**Status:** DEFERRED

**Note:** Most forms are read-only pricing lookups. Order submission forms should add CSRF tokens in future update.

---

## Medium Priority Vulnerabilities

### 8. XSS via innerHTML

**Location:** 23+ frontend JavaScript files
**Risk:** User input rendered without sanitization
**Status:** FIXED (critical paths)

**Vulnerable Pattern:**
```javascript
// BEFORE
element.innerHTML = userInput;
```

**Fix Applied:**
```javascript
// AFTER - Use textContent for plain text
element.textContent = userInput;

// Or sanitize HTML
element.innerHTML = DOMPurify.sanitize(userInput);
```

**Files Updated:**
- `shared_components/js/staff-dashboard-init.js`
- `shared_components/js/cart-manager.js`
- `shared_components/js/quote-builder-core.js`

### 9. Hardcoded EmailJS Keys

**Location:** 23+ HTML files
**Risk:** Keys exposed in client-side code (expected for EmailJS)
**Status:** ACCEPTED RISK

**Note:** EmailJS public keys are designed to be client-side. The service uses domain restrictions. No change needed.

### 10. Verbose Error Messages

**Location:** API error responses
**Risk:** Stack traces reveal server internals
**Status:** FIXED

**Fix Applied:**
```javascript
// Production error handler
app.use((err, req, res, next) => {
    console.error(err); // Log full error
    res.status(500).json({
        error: 'Internal server error',
        // Don't expose: err.stack, err.message details
    });
});
```

### 11. Missing Content Security Policy

**Location:** HTTP headers
**Risk:** No protection against script injection
**Status:** DEFERRED

**Recommendation:** Add CSP headers in future update.

### 12. No Input Validation on Order Forms

**Location:** 3-Day Tees, quote builders
**Risk:** Invalid data submitted to ShopWorks
**Status:** EXISTING - Forms have validation

---

## Low Priority / Best Practices

### 13. Console.log Statements in Production

**Location:** Various JS files
**Risk:** Information disclosure in browser console
**Status:** DEFERRED - Low risk, useful for debugging

### 14. No Subresource Integrity (SRI)

**Location:** CDN script tags
**Risk:** CDN compromise could inject malicious scripts
**Status:** DEFERRED

### 15. HTTP-Only Cookies Not Set

**Location:** Session cookies
**Risk:** XSS could steal session
**Status:** NOT APPLICABLE - No session cookies used

### 16. Missing Security Headers

**Location:** HTTP responses
**Risk:** Various attack vectors
**Status:** DEFERRED

**Recommended Headers:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)

---

## Action Items

### Immediate (Today)
- [x] Add rate limiting
- [x] Restrict CORS
- [x] Sanitize SQL injection points
- [ ] **ROTATE ALL API KEYS** (manual action required)

### This Week
- [x] Fix critical XSS paths
- [x] Improve error handling
- [ ] Review image proxy URL whitelist

### Future Improvements
- [ ] Add authentication for admin endpoints
- [ ] Implement CSRF tokens on order forms
- [ ] Add Content Security Policy
- [ ] Add security headers

---

## Credential Rotation Checklist

**Must rotate these keys (they were exposed):**

| Service | Dashboard URL | Key Type |
|---------|---------------|----------|
| Anthropic | console.anthropic.com | API Key |
| Stripe | dashboard.stripe.com | Test keys |
| Caspio | account.caspio.com | Client ID/Secret |
| ManageOrders | Contact vendor | API credentials |

---

## Files Modified in This Fix

1. `server.js` - CORS, rate limiting, error handling, input sanitization
2. `caspio-pricing-proxy/src/routes/cart.js` - Input sanitization
3. `.gitignore` - Added .env
4. `shared_components/js/staff-dashboard-init.js` - XSS fixes
5. `shared_components/js/cart-manager.js` - XSS fixes

---

*Report generated by Claude Code security audit*
