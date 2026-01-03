# Caspio Staff Dashboard Authentication

## Overview

The staff dashboard (`/staff-dashboard.html`) uses Caspio authentication to identify logged-in users and display a personalized welcome message.

## Authentication Flow

```
1. User visits teamnwca.com/staff-dashboard.html
2. Embedded Caspio DataPage checks authentication
3. If NOT logged in → Caspio redirects to login portal
4. User enters credentials on Caspio login page
5. After success → Caspio redirects to /staff-dashboard.html (configured in Caspio)
6. Dashboard loads with user's name from [@authfield:First_Name] token
7. "Welcome, [Name]" displays in header
```

## Caspio Admin Settings

**Location:** Caspio > Authentications > TEAMNWCA_WEBSITE > Advanced Settings

| Setting | Value |
|---------|-------|
| Logout destination | https://www.teamnwca.com/ |
| Timeout and redirection | 3 days, None |
| **Login redirection on success** | https://www.teamnwca.com/staff-dashboard.html |
| Unrecognized user handling | Show message |
| Enable cross-app login | ✓ Checked |
| Auto-redirect to Directory's login screen | ✓ Checked |

**CRITICAL:** The "Login redirection on success" URL must be exact - no trailing spaces!

## Code Implementation

### File: `/staff-dashboard.html`

**Auth Container (HTML):**
```html
<!-- Hidden Caspio Authentication Container -->
<div class="caspio-auth" style="display: none;">
    <div id="auth-firstname">[@authfield:First_Name]</div>
    <div id="auth-lastname">[@authfield:Last_Name]</div>
    <div id="auth-email">[@authfield:Email]</div>
    <div id="auth-role">[@authfield:Role]</div>
    <script type="text/javascript" src="https://c3eku948.caspio.com/dp/a0e15000a0bb470ed2be4ec5943e/emb"></script>
</div>
```

**How `[@authfield:...]` Tokens Work:**
- These are Caspio server-side tokens
- When page is served through Caspio (teamnwca.com), tokens are replaced with actual user data
- When served locally (localhost:3000), tokens remain as literal text
- JavaScript checks if tokens were replaced to determine auth status

**Auth JavaScript Logic:**
```javascript
function checkCaspioAuth() {
    const firstName = document.getElementById('auth-firstname')?.textContent?.trim();

    // Check if token was replaced with real name
    if (firstName && !firstName.includes('[@authfield')) {
        // User is authenticated
        return true;
    }

    // Also check window.caspioUser (set by Caspio DataPage)
    if (window.caspioUser && window.caspioUser.firstName) {
        return true;
    }

    return false;
}
```

**Fallback Behavior:**
- If auth check fails after 10 retries, dashboard shows anyway (fallback mode)
- This matches the old working behavior - dashboard is accessible but without personalization
- No redirect to login page on auth failure

### File: `/dashboards/staff-login.html`

**Purpose:** Landing page with "Sign In to Staff Portal" button

**Auto-redirect:** If user is already authenticated and lands on this page, JavaScript detects auth and redirects to dashboard.

```javascript
// If already authenticated, redirect to dashboard
if (authValue && !authValue.includes('[@authfield')) {
    window.location.href = '/staff-dashboard.html';
}
```

## Caspio DataPage

**DataPage ID:** `a0e15000a0bb470ed2be4ec5943e`
**Embed URL:** `https://c3eku948.caspio.com/dp/a0e15000a0bb470ed2be4ec5943e/emb`

This DataPage:
- Checks if user is authenticated with Caspio
- May set `window.caspioUser` object with user data
- Fires `DataPageReady` event when loaded
- May fire `caspioUserReady` custom event

## Event Listeners

The dashboard listens for these events:

```javascript
// Caspio DataPage finished loading
document.addEventListener('DataPageReady', function(event) {
    // Check auth status
});

// Caspio user data is ready
window.addEventListener('caspioUserReady', function(event) {
    // Initialize with user data
});
```

## Testing Notes

**Cannot test auth locally:**
- `[@authfield:...]` tokens only work on teamnwca.com (served through Caspio)
- Caspio session cookies are tied to teamnwca.com domain
- Must deploy to Heroku and test on production

**To test auth flow:**
1. Visit https://c3eku948.caspio.com/folderlogout (logout)
2. Go to teamnwca.com/staff-dashboard.html
3. Should redirect to Caspio login
4. Enter credentials
5. Should redirect back to dashboard with "Welcome, [Name]"

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Redirects to Caspio portal instead of embedded login | Expected behavior with current setup | This is normal - Caspio handles login |
| "Cannot GET /staff-dashboard.html%20%20%20" | Trailing spaces in Caspio redirect URL | Remove spaces from URL in Caspio settings |
| Welcome message not showing | Auth tokens not processed | Must test on teamnwca.com, not localhost |
| Stuck on login page after logging in | Caspio redirect URL misconfigured | Check "Login redirection on success" in Caspio |
| Dashboard shows but no name | Fallback mode active | User may not be fully authenticated |

## Files Summary

| File | Purpose |
|------|---------|
| `/staff-dashboard.html` | Main dashboard with auth container |
| `/dashboards/staff-login.html` | Login landing page with Caspio portal link |
| `/shared_components/css/staff-dashboard-*.css` | Dashboard styles |
| `/shared_components/js/staff-dashboard-*.js` | Dashboard functionality |

## Related Commits

- `e125f14` - Fix Caspio authentication (restore @authfield tokens)
- `e24b513` - Fix staff dashboard auth (use fallback instead of redirect)
- `118ad85` - Add welcome message with user name
- `b8d6507` - Add auto-redirect from login page when authenticated
