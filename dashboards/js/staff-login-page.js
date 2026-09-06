/* staff-login-page.js — extracted 2026-09-06 from an inline <script> in dashboards/staff-login.html (Rule 3). Global scope kept: the page's data-call attributes resolve these functions on window. */
var STAFFL_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var stafflLog = STAFFL_LOG_ON ? console.log.bind(console) : function () {};
// Get redirect URL from query params (for CRM dashboard access)
const urlParams = new URLSearchParams(window.location.search);
const redirectUrl = urlParams.get('redirect');

// Establish CRM session with backend after Caspio auth
async function establishCrmSession(userName, userEmail) {
    try {
        const response = await fetch('/api/crm-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: userName, email: userEmail })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            stafflLog('[Login] CRM session established for:', data.firstName, 'with permissions:', data.permissions);
            return { success: true, permissions: data.permissions };
        } else if (response.status === 403) {
            // User authenticated but not authorized for CRM
            stafflLog('[Login] User not authorized for CRM dashboards');
            return { success: false, notAuthorized: true, message: data.message };
        } else {
            console.error('[Login] Failed to establish CRM session:', data.error);
            return { success: false };
        }
    } catch (error) {
        console.error('[Login] Error establishing CRM session:', error);
        return { success: false };
    }
}

// Check if already authenticated - redirect to dashboard
async function checkAuthAndRedirect() {
    const authCheck = document.getElementById('auth-check');
    const authValue = authCheck?.textContent?.trim();

    let firstName = '';
    let lastName = '';
    let email = '';

    // If auth field has a real name (not token placeholder), user is logged in
    if (authValue && authValue !== '' && !authValue.includes('[@authfield') && !authValue.includes('@authfield')) {
        firstName = authValue;
    }

    // Also check window.caspioUser
    if (window.caspioUser && window.caspioUser.firstName) {
        firstName = window.caspioUser.firstName;
        lastName = window.caspioUser.lastName || '';
        email = window.caspioUser.email || '';
    }

    // If we have a first name, user is authenticated
    if (firstName) {
        stafflLog('[Login] User authenticated:', firstName);

        // If there's a redirect URL (user was trying to access CRM), establish CRM session
        if (redirectUrl && redirectUrl.includes('/dashboards/')) {
            const fullName = firstName + (lastName ? ' ' + lastName : '');
            const result = await establishCrmSession(fullName, email);

            if (result.success) {
                // Session established, redirect to intended dashboard
                window.location.href = redirectUrl;
                return true;
            } else if (result.notAuthorized) {
                // User authenticated but not authorized - go to staff dashboard with message
                alert(result.message || 'You do not have permission to access that dashboard.');
                window.location.href = '/staff-dashboard.html';
                return true;
            }
            // Fall through to normal staff dashboard redirect if session establishment fails
        }

        // No CRM redirect or session established - go to staff dashboard
        window.location.href = '/staff-dashboard.html';
        return true;
    }

    return false;
}

// Check on page load with retries
window.addEventListener('load', function() {
    let retryCount = 0;
    const maxRetries = 5;

    function attemptCheck() {
        checkAuthAndRedirect().then(result => {
            if (!result && retryCount < maxRetries) {
                retryCount++;
                setTimeout(attemptCheck, 300);
            }
        });
    }

    setTimeout(attemptCheck, 500);
});

// Listen for Caspio events
document.addEventListener('DataPageReady', function() {
    setTimeout(checkAuthAndRedirect, 100);
});

window.addEventListener('caspioUserReady', function() {
    checkAuthAndRedirect();
});
